// Netlify Function — Recordatorio de devolución de préstamo
// Comprueba si el email está inscrito en la próxima sesión y envía email personalizado

import { createTransport } from "nodemailer";

const SUPABASE_URL = 'https://jenjnkidfdtlcxxvntst.supabase.co';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DAYS_ES   = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const MONTHS_DE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const DAYS_DE   = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];

function fmtDateEs(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return `${DAYS_ES[d.getDay()]}, ${d.getDate()} de ${MONTHS_ES[d.getMonth()]} de ${d.getFullYear()}`;
}
function fmtDateDe(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return `${DAYS_DE[d.getDay()]}, ${d.getDate()}. ${MONTHS_DE[d.getMonth()]} ${d.getFullYear()}`;
}

export default async (req, context) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Solo POST' }, 405);

  const SERVICE_KEY    = process.env.SUPABASE_SERVICE_KEY;
  const GMAIL_USER     = process.env.GMAIL_USER;
  const GMAIL_PASSWORD = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, '');
  const BASE_URL       = process.env.URL || 'https://ludoteca-dsm.netlify.app';

  if (!SERVICE_KEY || !GMAIL_USER || !GMAIL_PASSWORD) {
    return json({ error: 'Variables de entorno no configuradas' }, 500);
  }

  let body;
  try { body = await req.json(); }
  catch(e) { return json({ error: 'JSON inválido' }, 400); }

  const { loan_id } = body;
  if (!loan_id) return json({ error: 'loan_id requerido' }, 400);

  const sbH = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };

  try {
    // 1. Get loan with game info
    const loanRes = await fetch(
      `${SUPABASE_URL}/rest/v1/loans?id=eq.${loan_id}&select=*,games(name_es,location)&returned_at=is.null`,
      { headers: sbH }
    );
    const loans = await loanRes.json();
    if (!loans.length) return json({ error: 'Préstamo no encontrado o ya devuelto' }, 404);
    const loan = loans[0];

    // 2. Get next open session by date
    const today = new Date().toISOString().split('T')[0];
    const sessRes = await fetch(
      `${SUPABASE_URL}/rest/v1/sessions?status=eq.open&date=gte.${today}&order=date.asc&limit=1&select=*`,
      { headers: sbH }
    );
    const sessions = await sessRes.json();
    if (!sessions.length) return json({ error: 'No hay sesiones abiertas próximas' }, 404);
    const session = sessions[0];

    // 3. Check if loan email is registered for that session
    const regRes = await fetch(
      `${SUPABASE_URL}/rest/v1/registrations?session_id=eq.${session.id}&email=eq.${encodeURIComponent(loan.email)}&select=id`,
      { headers: sbH }
    );
    const regs = await regRes.json();
    const isRegistered = regs.length > 0;

    const sessionDateEs = fmtDateEs(session.date);
    const sessionDateDe = fmtDateDe(session.date);
    const timeStr = `${session.time_start} – ${session.time_end} h`;
    const locationEs = session.location_es || '';
    const locationDe = session.location_de || session.location_es || '';
    const gameName = loan.games?.name_es || 'el juego';
    const gameLocation = loan.games?.location === 'ludoteca' ? 'Ludoteca' : 'Club';

    const confirmBase = `${BASE_URL}/return-confirm/?loan=${loan_id}`;
    const btnSesion   = `${confirmBase}&method=sesion`;
    const btnPorteria = `${confirmBase}&method=porteria`;

    // 4. Build email
    const transporter = createTransport({
      service: 'gmail',
      auth: { user: GMAIL_USER, pass: GMAIL_PASSWORD }
    });

    let subjectEs, subjectDe, bodyHtml;

    if (isRegistered) {
      // Case A: already registered for next session
      subjectEs = `📦 Recuerda traer "${gameName}" a la próxima sesión`;
      subjectDe = `📦 Bitte bring "${gameName}" zur nächsten Sitzung mit`;

      bodyHtml = `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#2D2D2D">
  <div style="background:linear-gradient(135deg,#7C3AED,#2563EB);padding:28px 24px;border-radius:16px 16px 0 0;text-align:center">
    <div style="font-size:2.5rem;margin-bottom:8px">📦</div>
    <h1 style="color:#fff;font-size:1.4rem;margin:0">Recordatorio de devolución</h1>
    <p style="color:rgba(255,255,255,.85);margin:6px 0 0;font-size:.9rem">Rückgabe-Erinnerung</p>
  </div>
  <div style="background:#fff;padding:28px 24px;border:1px solid #E2EAF4">
    <p>Hola,</p>
    <p>Tienes prestado <strong>"${gameName}"</strong> (${gameLocation}). Como estás inscrito en la próxima sesión, recuerda traerlo.</p>
    <div style="background:#F4F7FB;border-radius:12px;padding:18px 20px;margin:16px 0">
      <div style="margin-bottom:8px">📅 <strong>${sessionDateEs}</strong></div>
      <div style="margin-bottom:8px">🕐 <strong>${timeStr}</strong></div>
      <div>📍 <strong>${locationEs}</strong></div>
    </div>
    <div style="text-align:center;margin:24px 0">
      <a href="${btnSesion}" style="background:#06D6A0;color:#fff;padding:13px 28px;border-radius:40px;text-decoration:none;font-weight:700;font-size:.95rem;display:inline-block">
        ✅ Lo traeré a la sesión
      </a>
    </div>
    <hr style="border:none;border-top:2px dashed #E2EAF4;margin:24px 0">
    <p>Hallo,</p>
    <p>Du hast <strong>"${gameName}"</strong> (${gameLocation}) ausgeliehen. Da du für die nächste Sitzung angemeldet bist, denk daran, es mitzubringen.</p>
    <div style="background:#F4F7FB;border-radius:12px;padding:18px 20px;margin:16px 0">
      <div style="margin-bottom:8px">📅 <strong>${sessionDateDe}</strong></div>
      <div style="margin-bottom:8px">🕐 <strong>${timeStr}</strong></div>
      <div>📍 <strong>${locationDe}</strong></div>
    </div>
    <div style="text-align:center;margin:24px 0">
      <a href="${btnSesion}" style="background:#06D6A0;color:#fff;padding:13px 28px;border-radius:40px;text-decoration:none;font-weight:700;font-size:.95rem;display:inline-block">
        ✅ Ich bringe es zur Sitzung mit
      </a>
    </div>
  </div>
  <div style="background:#F4F7FB;padding:14px 24px;border-radius:0 0 16px 16px;text-align:center;font-size:.8rem;color:#888">
    Club de Juegos · Familien-Spieleclub
  </div>
</div>`;

    } else {
      // Case B: not registered — offer two options
      subjectEs = `📦 Devolución de "${gameName}" — elige cómo devolver`;
      subjectDe = `📦 Rückgabe von "${gameName}" — bitte wählen`;

      bodyHtml = `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#2D2D2D">
  <div style="background:linear-gradient(135deg,#7C3AED,#2563EB);padding:28px 24px;border-radius:16px 16px 0 0;text-align:center">
    <div style="font-size:2.5rem;margin-bottom:8px">📦</div>
    <h1 style="color:#fff;font-size:1.4rem;margin:0">Recordatorio de devolución</h1>
    <p style="color:rgba(255,255,255,.85);margin:6px 0 0;font-size:.9rem">Rückgabe-Erinnerung</p>
  </div>
  <div style="background:#fff;padding:28px 24px;border:1px solid #E2EAF4">
    <p>Hola,</p>
    <p>Tienes prestado <strong>"${gameName}"</strong> (${gameLocation}). Por favor, elige cómo quieres devolverlo:</p>

    <div style="display:flex;flex-direction:column;gap:12px;margin:20px 0">
      <div style="border:2px solid #06D6A0;border-radius:12px;padding:16px 20px">
        <strong>📅 Opción 1 — Próxima sesión</strong>
        <p style="color:#555;margin:6px 0 12px;font-size:.9rem">
          Tráelo el <strong>${sessionDateEs}</strong> de ${timeStr} en ${locationEs}.
        </p>
        <a href="${btnSesion}" style="background:#06D6A0;color:#fff;padding:10px 22px;border-radius:40px;text-decoration:none;font-weight:700;font-size:.9rem;display:inline-block">
          ✅ Lo traeré a la sesión
        </a>
      </div>
      <div style="border:2px solid #7C3AED;border-radius:12px;padding:16px 20px">
        <strong>🏫 Opción 2 — Portería del colegio</strong>
        <p style="color:#555;margin:6px 0 12px;font-size:.9rem">
          Déjalo en portería antes del ${sessionDateEs}. Indica tu nombre y el día.
        </p>
        <a href="${btnPorteria}" style="background:#7C3AED;color:#fff;padding:10px 22px;border-radius:40px;text-decoration:none;font-weight:700;font-size:.9rem;display:inline-block">
          🏫 Lo dejo en portería
        </a>
      </div>
    </div>

    <hr style="border:none;border-top:2px dashed #E2EAF4;margin:24px 0">

    <p>Hallo,</p>
    <p>Du hast <strong>"${gameName}"</strong> (${gameLocation}) ausgeliehen. Bitte wähle, wie du es zurückbringen möchtest:</p>

    <div style="display:flex;flex-direction:column;gap:12px;margin:20px 0">
      <div style="border:2px solid #06D6A0;border-radius:12px;padding:16px 20px">
        <strong>📅 Option 1 — Nächste Sitzung</strong>
        <p style="color:#555;margin:6px 0 12px;font-size:.9rem">
          Bring es am <strong>${sessionDateDe}</strong>, ${timeStr} in ${locationDe} mit.
        </p>
        <a href="${btnSesion}" style="background:#06D6A0;color:#fff;padding:10px 22px;border-radius:40px;text-decoration:none;font-weight:700;font-size:.9rem;display:inline-block">
          ✅ Ich bringe es zur Sitzung
        </a>
      </div>
      <div style="border:2px solid #7C3AED;border-radius:12px;padding:16px 20px">
        <strong>🏫 Option 2 — Schulpforte</strong>
        <p style="color:#555;margin:6px 0 12px;font-size:.9rem">
          Gib es vor dem ${sessionDateDe} an der Schulpforte ab. Bitte Name und Tag angeben.
        </p>
        <a href="${btnPorteria}" style="background:#7C3AED;color:#fff;padding:10px 22px;border-radius:40px;text-decoration:none;font-weight:700;font-size:.9rem;display:inline-block">
          🏫 Ich gebe es an der Pforte ab
        </a>
      </div>
    </div>
  </div>
  <div style="background:#F4F7FB;padding:14px 24px;border-radius:0 0 16px 16px;text-align:center;font-size:.8rem;color:#888">
    Club de Juegos · Familien-Spieleclub
  </div>
</div>`;
    }

    await transporter.sendMail({
      from:    `Club de Juegos <${GMAIL_USER}>`,
      to:      loan.email,
      subject: `${subjectEs} | ${subjectDe}`,
      html:    bodyHtml,
    });

    return json({ ok: true, isRegistered });

  } catch(e) {
    return json({ error: e.message }, 500);
  }
};

export const config = { path: '/api/send-return-reminder' };
