// Netlify Function — Confirmación automática de inscripción
// Se llama al enviar el formulario de inscripción

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
    const {
      toEmail, adultName,
      sessionDate, sessionDateDe,
      timeStart, timeEnd,
      locationEs, locationDe,
      numAdults, numChildren, grades,
      preferredGame
    } = await req.json();

    const GMAIL_USER     = process.env.GMAIL_USER;
    const GMAIL_PASSWORD = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, '');

    if (!GMAIL_USER || !GMAIL_PASSWORD) {
      return new Response(JSON.stringify({ error: 'Credenciales no configuradas' }), { status: 500 });
    }

    const transporter = createTransport({
      service: 'gmail',
      auth: { user: GMAIL_USER, pass: GMAIL_PASSWORD }
    });

    const gradesText = grades.filter(Boolean).join(', ');
    const gameText   = preferredGame ? `\n🎲 Juego preferido: ${preferredGame}\n   Wunschspiel: ${preferredGame}` : '';

    const bodyText = `Hola ${adultName},

Hemos recibido vuestra inscripción para la sesión del Club de Juegos. ¡Nos vemos pronto!

📅 Fecha: ${sessionDate}
🕐 Horario: ${timeStart} – ${timeEnd} h
📍 Lugar: ${locationEs}
💶 Donativo: 5 € por grupo
👥 Grupo: ${numAdults} adulto${numAdults>1?'s':''} + ${numChildren} niño${numChildren>1?'s':''}
${gradesText ? `🎒 Cursos: ${gradesText}` : ''}${gameText}

Si necesitas cancelar o tienes alguna duda, responde a este email.

---

Hallo ${adultName},

wir haben eure Anmeldung für die Sitzung des Familien-Spieleclubs erhalten. Wir sehen uns bald!

📅 Datum: ${sessionDateDe}
🕐 Zeit: ${timeStart} – ${timeEnd} Uhr
📍 Ort: ${locationDe}
💶 Spende: 5 € pro Gruppe
👥 Gruppe: ${numAdults} Erwachsene${numAdults>1?'r':''} + ${numChildren} Kind${numChildren>1?'er':''}
${gradesText ? `🎒 Klassen: ${gradesText}` : ''}${gameText}

Falls ihr absagen möchtet oder Fragen habt, antwortet auf diese E-Mail.

---

Club de Juegos · die Schule`;

    const bodyHtml = `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#2D2D2D">
  <div style="background:linear-gradient(135deg,#06D6A0,#118AB2);padding:28px 24px;border-radius:16px 16px 0 0;text-align:center">
    <div style="font-size:2.5rem;margin-bottom:8px">✅</div>
    <h1 style="color:#fff;font-size:1.4rem;margin:0">¡Inscripción confirmada!</h1>
    <p style="color:rgba(255,255,255,.9);margin:6px 0 0;font-size:.9rem">Anmeldung bestätigt!</p>
  </div>
  <div style="background:#fff;padding:28px 24px;border:1px solid #E2EAF4">

    <p style="margin-bottom:6px">Hola <strong>${adultName}</strong>,</p>
    <p style="margin-bottom:20px;color:#555">Hemos recibido vuestra inscripción. ¡Nos vemos pronto!</p>

    <div style="background:#F4F7FB;border-radius:12px;padding:18px 20px;margin-bottom:16px">
      <div style="margin-bottom:10px">📅 <strong>${sessionDate}</strong></div>
      <div style="margin-bottom:10px">🕐 <strong>${timeStart} – ${timeEnd} h</strong></div>
      <div style="margin-bottom:10px">📍 <strong>${locationEs}</strong></div>
      <div style="margin-bottom:10px">💶 <strong>5 € por grupo</strong></div>
      <div style="margin-bottom:${gradesText?'10px':'0'}">👥 <strong>${numAdults} adulto${numAdults>1?'s':''} + ${numChildren} niño${numChildren>1?'s':''}</strong></div>
      ${gradesText ? `<div>🎒 <strong>Cursos: ${gradesText}</strong></div>` : ''}
      ${preferredGame ? `<div style="margin-top:10px">🎲 <strong>Juego preferido: ${preferredGame}</strong></div>` : ''}
    </div>

    <div style="border-top:2px dashed #E2EAF4;margin:20px 0"></div>

    <p style="margin-bottom:6px">Hallo <strong>${adultName}</strong>,</p>
    <p style="margin-bottom:20px;color:#555">Wir haben eure Anmeldung erhalten. Wir sehen uns bald!</p>

    <div style="background:#F4F7FB;border-radius:12px;padding:18px 20px;margin-bottom:20px">
      <div style="margin-bottom:10px">📅 <strong>${sessionDateDe}</strong></div>
      <div style="margin-bottom:10px">🕐 <strong>${timeStart} – ${timeEnd} Uhr</strong></div>
      <div style="margin-bottom:10px">📍 <strong>${locationDe}</strong></div>
      <div style="margin-bottom:10px">💶 <strong>5 € pro Gruppe</strong></div>
      <div style="margin-bottom:${gradesText?'10px':'0'}">👥 <strong>${numAdults} Erwachsene${numAdults>1?'r':''} + ${numChildren} Kind${numChildren>1?'er':''}</strong></div>
      ${gradesText ? `<div>🎒 <strong>Klassen: ${gradesText}</strong></div>` : ''}
      ${preferredGame ? `<div style="margin-top:10px">🎲 <strong>Wunschspiel: ${preferredGame}</strong></div>` : ''}
    </div>

    <div style="text-align:center;margin:24px 0">
      <a href="https://ludoteca-dsm.netlify.app/"
         style="background:#06D6A0;color:#fff;padding:13px 28px;border-radius:40px;text-decoration:none;font-weight:700;font-size:.95rem;display:inline-block">
        🎲 Ver catálogo / Spielekatalog
      </a>
    </div>
    <p style="color:#888;font-size:.82rem;text-align:center">
      Si necesitas cancelar, responde a este email.<br>
      Falls ihr absagen möchtet, antwortet auf diese E-Mail.
    </p>
  </div>
  <div style="background:#F4F7FB;padding:14px 24px;border-radius:0 0 16px 16px;text-align:center;font-size:.8rem;color:#888">
    Club de Juegos · die Schule
  </div>
</div>`;

    await transporter.sendMail({
      from:    `Club de Juegos <${GMAIL_USER}>`,
      to:      toEmail,
      subject: `✅ Inscripción confirmada — Club de Juegos | ${sessionDate}`,
      text:    bodyText,
      html:    bodyHtml,
    });

    return new Response(JSON.stringify({ ok: true }), {
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

export const config = { path: '/api/send-confirmation' };
