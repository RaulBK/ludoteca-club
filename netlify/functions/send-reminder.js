// Netlify Function — Envío de recordatorios via Gmail SMTP
// Variables de entorno en Netlify:
//   GMAIL_USER         → club.juegos.dsm@gmail.com
//   GMAIL_APP_PASSWORD → contraseña de aplicación de 16 caracteres

import { createTransport } from "nodemailer";

export default async (req, context) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }

  try {
    const { emails, subject, sessionDate, sessionDateDe, timeStart, timeEnd, locationEs, locationDe } = await req.json();
    const dateDe = sessionDateDe || sessionDate; // fallback to ES if DE not provided

    if (!emails?.length) {
      return new Response(JSON.stringify({ error: 'No hay emails destinatarios' }), { status: 400 });
    }

    const GMAIL_USER     = process.env.GMAIL_USER;
    const GMAIL_PASSWORD = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, '');

    if (!GMAIL_USER || !GMAIL_PASSWORD) {
      return new Response(JSON.stringify({ error: 'Credenciales de email no configuradas' }), { status: 500 });
    }

    const transporter = createTransport({
      service: 'gmail',
      auth: { user: GMAIL_USER, pass: GMAIL_PASSWORD }
    });

    const uniqueEmails = [...new Set(emails)];

    const bodyText = `Hola,

Os recordamos que la próxima sesión del Club de Juegos es:

📅 Fecha: ${sessionDate}
🕐 Horario: ${timeStart} – ${timeEnd} h
📍 Lugar: ${locationEs}
💶 Donativo: 5 € por grupo (destinado a la compra de juegos para el colegio)

🎲 Consulta nuestro catálogo de juegos:
https://ludoteca-dsm.netlify.app/

---

Hallo,

wir möchten euch an die nächste Sitzung des Familien-Spieleclubs erinnern:

📅 Datum: ${dateDe}
🕐 Zeit: ${timeStart} – ${timeEnd} Uhr
📍 Ort: ${locationDe}
💶 Spende: 5 € pro Gruppe (für den Kauf von Spielen für die Schule)

🎲 Unseren Spielekatalog findet ihr hier:
https://ludoteca-dsm.netlify.app/

---

¡Nos vemos allí! / Wir sehen uns dort!
Club de Juegos`;

    const bodyHtml = `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#2D2D2D">
  <div style="background:linear-gradient(135deg,#845EC2,#118AB2);padding:28px 24px;border-radius:16px 16px 0 0;text-align:center">
    <h1 style="color:#fff;font-size:1.4rem;margin:0">🎲 Club de Juegos</h1>
    <p style="color:rgba(255,255,255,.85);margin:6px 0 0;font-size:.9rem">Recordatorio de sesión / Sitzungserinnerung</p>
  </div>
  <div style="background:#fff;padding:28px 24px;border:1px solid #E2EAF4">

    <p style="margin-bottom:6px">Hola,</p>
    <p style="margin-bottom:20px;color:#555">Os recordamos que la próxima sesión del Club de Juegos es:</p>

    <div style="background:#F4F7FB;border-radius:12px;padding:18px 20px;margin-bottom:20px">
      <div style="margin-bottom:10px">📅 <strong>${sessionDate}</strong></div>
      <div style="margin-bottom:10px">🕐 <strong>${timeStart} – ${timeEnd} h</strong></div>
      <div style="margin-bottom:10px">📍 <strong>${locationEs}</strong></div>
      <div>💶 <strong>5 € por grupo</strong> (destinado a la compra de juegos para el colegio)</div>
    </div>

    <div style="border-top:2px dashed #E2EAF4;margin:24px 0"></div>

    <p style="margin-bottom:6px">Hallo,</p>
    <p style="margin-bottom:20px;color:#555">wir möchten euch an die nächste Sitzung des Familien-Spieleclubs erinnern:</p>

    <div style="background:#F4F7FB;border-radius:12px;padding:18px 20px;margin-bottom:20px">
      <div style="margin-bottom:10px">📅 <strong>${dateDe}</strong></div>
      <div style="margin-bottom:10px">🕐 <strong>${timeStart} – ${timeEnd} Uhr</strong></div>
      <div style="margin-bottom:10px">📍 <strong>${locationDe}</strong></div>
      <div>💶 <strong>5 € pro Gruppe</strong> (für den Kauf von Spielen für die Schule)</div>
    </div>

    <div style="text-align:center;margin:24px 0">
      <a href="https://ludoteca-dsm.netlify.app/"
         style="background:#845EC2;color:#fff;padding:13px 28px;border-radius:40px;text-decoration:none;font-weight:700;font-size:.95rem;display:inline-block">
        🎲 Ver catálogo / Spielekatalog
      </a>
    </div>
    <p style="color:#888;font-size:.85rem;text-align:center">
      ¡Nos vemos allí! / Wir sehen uns dort!
    </p>
  </div>
  <div style="background:#F4F7FB;padding:14px 24px;border-radius:0 0 16px 16px;text-align:center;font-size:.8rem;color:#888">
    Club de Juegos · die Schule
  </div>
</div>`;

    await transporter.sendMail({
      from:    `Club de Juegos <${GMAIL_USER}>`,
      to:      GMAIL_USER,       // to: own address
      bcc:     uniqueEmails,     // bcc: all registrants (they don't see each other)
      subject,
      text:    bodyText,
      html:    bodyHtml,
    });

    return new Response(JSON.stringify({ ok: true, sent: uniqueEmails.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch(e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = { path: '/api/send-reminder' };
