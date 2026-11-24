// Lógica compartida de los recordatorios personales de hitos de cada sesión.
// La usan: milestone-reminders-cron.js (programada) y milestone-reminders.js (prueba manual).
//
// Hitos (la sesión es un sábado; "semana de la sesión" = lunes a domingo):
//   1. Lunes de 3 semanas antes  -> pedir al colegio que envíe el correo de convocatoria
//   2. Lunes de la semana        -> enviar el correo de devoluciones de préstamos
//   3. Jueves de la semana       -> pedir al colegio que abra y deje el carro

import { createTransport } from "nodemailer";

const SUPABASE_URL = 'https://jenjnkidfdtlcxxvntst.supabase.co';
const DAYS_ES   = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

// ── Fechas (todo en "YYYY-MM-DD", cálculos en UTC para evitar líos de horario) ──
const toMs   = s => Date.parse(s + 'T00:00:00Z');
const toStr  = ms => new Date(ms).toISOString().slice(0, 10);
const addDays = (s, n) => toStr(toMs(s) + n * 86400000);
const mondayOf = s => addDays(s, -((new Date(toMs(s)).getUTCDay() + 6) % 7));

export function fmtDateEs(s) {
  const d = new Date(toMs(s));
  return `${DAYS_ES[d.getUTCDay()]} ${d.getUTCDate()} de ${MONTHS_ES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

export function todayMadrid(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(now);
}
export function hourMadrid(now = new Date()) {
  return parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', hour12: false }).format(now), 10);
}

export const MILESTONES = {
  convocatoria: { icon: '📣', title: 'Pide al colegio que envíe la convocatoria', detail: 'Escribe al colegio para que envíen el correo de convocatoria de la sesión.' },
  devoluciones: { icon: '📦', title: 'Envía el correo de devoluciones de préstamos', detail: 'Manda el recordatorio de devolución a las familias con préstamos activos.' },
  carro:        { icon: '🛒', title: 'Pide al colegio que abra y te deje el carro', detail: 'Escribe al colegio para que abran el cole y te dejen el carro para llevar los juegos a la cafetería.' },
};

// Devuelve los hitos que tocan hoy: [{ key, session_date }]
export function dueToday(sessions, today) {
  const due = [];
  for (const s of sessions) {
    const monday = mondayOf(s.date);
    const dates = {
      convocatoria: addDays(monday, -21),
      devoluciones: monday,
      carro:        addDays(monday, 3),
    };
    for (const [key, date] of Object.entries(dates)) {
      if (date === today) due.push({ key, session_date: s.date });
    }
  }
  return due;
}

export function buildEmail(due, { activeLoans, baseUrl, test }) {
  const items = due.map(d => ({ ...MILESTONES[d.key], key: d.key, session_date: d.session_date }));
  const subject = (test ? '[PRUEBA] ' : '') + (items.length === 1
    ? `${items[0].icon} ${items[0].title}`
    : `🔔 ${items.length} recordatorios del Club de Juegos`);

  const rows = items.map(it => {
    let extra = '';
    if (it.key === 'devoluciones') {
      extra = `<div style="margin-top:6px;color:#555">Préstamos activos ahora mismo: <strong>${activeLoans ?? '?'}</strong>.
        <a href="${baseUrl}/loan/" style="color:#118AB2;font-weight:700">Abrir Préstamos →</a></div>`;
    }
    return `<tr><td style="padding:14px 0;border-bottom:1px solid #E2EAF4">
      <div style="font-size:1.15rem;font-weight:800;color:#2D2D2D">${it.icon} ${it.title}</div>
      <div style="margin-top:4px;color:#555">${it.detail}</div>
      <div style="margin-top:6px;color:#888;font-size:.9rem">Sesión del ${fmtDateEs(it.session_date)}</div>${extra}
    </td></tr>`;
  }).join('');

  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">
    <div style="background:#118AB2;color:#fff;padding:18px 22px;border-radius:14px 14px 0 0;font-size:1.2rem;font-weight:800">🔔 Recordatorio · Club de Juegos</div>
    <div style="background:#fff;border:1px solid #E2EAF4;border-top:0;padding:6px 22px 18px;border-radius:0 0 14px 14px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
      <p style="color:#aaa;font-size:.8rem;margin-top:14px">Recordatorio automático del Club de Juegos${test ? ' (correo de prueba)' : ''}.</p>
    </div></div>`;

  const text = items.map(it => `${it.icon} ${it.title}\n${it.detail}\nSesión del ${fmtDateEs(it.session_date)}` +
    (it.key === 'devoluciones' ? `\nPréstamos activos: ${activeLoans ?? '?'} — ${baseUrl}/loan/` : '')).join('\n\n');

  return { subject, html, text };
}

// Calcula lo que toca hoy y, si send=true, envía el correo.
export async function run({ today, send, test }) {
  const SERVICE_KEY    = process.env.SUPABASE_SERVICE_KEY;
  const GMAIL_USER     = process.env.GMAIL_USER;
  const GMAIL_PASSWORD = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, '');
  const TO             = process.env.REMINDER_TO;
  const BASE_URL       = process.env.URL || 'https://ludoteca-dsm.netlify.app';

  if (!SERVICE_KEY) throw new Error('Falta SUPABASE_SERVICE_KEY');
  const sbH = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

  // Sesiones futuras (open/closed). Cogemos desde hace 30 días por margen y filtramos con las fechas de hitos.
  const from = addDays(today, -30);
  const sRes = await fetch(`${SUPABASE_URL}/rest/v1/sessions?select=id,date,status&status=in.(open,closed)&date=gte.${from}&order=date.asc`, { headers: sbH });
  if (!sRes.ok) throw new Error('No se pudieron leer las sesiones');
  const sessions = await sRes.json();

  const due = dueToday(sessions, today);
  const result = { today, due, sent: false };
  if (!due.length) return result;

  let activeLoans = null;
  if (due.some(d => d.key === 'devoluciones')) {
    const lRes = await fetch(`${SUPABASE_URL}/rest/v1/loans?select=id&returned_at=is.null`, { headers: sbH });
    if (lRes.ok) activeLoans = (await lRes.json()).length;
  }

  const mail = buildEmail(due, { activeLoans, baseUrl: BASE_URL, test });
  result.subject = mail.subject;
  if (!send) return result;

  if (!GMAIL_USER || !GMAIL_PASSWORD) throw new Error('Faltan GMAIL_USER / GMAIL_APP_PASSWORD');
  if (!TO) throw new Error('Falta la variable REMINDER_TO (destinatario)');
  const transporter = createTransport({ service: 'gmail', auth: { user: GMAIL_USER, pass: GMAIL_PASSWORD } });
  await transporter.sendMail({ from: `Club de Juegos <${GMAIL_USER}>`, to: TO, subject: mail.subject, text: mail.text, html: mail.html });
  result.sent = true;
  return result;
}
