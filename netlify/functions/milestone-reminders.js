// Netlify Function — prueba manual de los recordatorios de hitos (solo admin).
//   GET /api/milestone-reminders                       -> simulación: qué tocaría hoy (no envía nada)
//   GET /api/milestone-reminders?today=2026-12-14      -> simulación para otra fecha
//   GET /api/milestone-reminders?today=2026-12-14&send=1 -> envía de verdad el correo (asunto con [PRUEBA])
// Requiere cabecera x-admin-token (la misma sesión de /admin).

import { run, todayMadrid } from "../lib/milestones.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), { status, headers: { 'Content-Type': 'application/json' } });
}

function isAuthorized(req, adminPassword) {
  const token = req.headers.get('x-admin-token');
  if (!token || !adminPassword) return false;
  try {
    const parts = atob(token).split(':');
    if (parts[0] !== 'dsm-admin') return false;
    if ((Date.now() - parseInt(parts[1])) > 30 * 24 * 60 * 60 * 1000) return false;
    return parts[2] === adminPassword.split('').reverse().join('');
  } catch (e) { return false; }
}

export default async (req) => {
  if (!isAuthorized(req, process.env.ADMIN_PASSWORD)) return json({ error: 'No autorizado' }, 401);
  const url = new URL(req.url);
  const today = url.searchParams.get('today') || todayMadrid();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return json({ error: 'today debe ser YYYY-MM-DD' }, 400);
  const send = url.searchParams.get('send') === '1';
  try {
    return json(await run({ today, send, test: true }));
  } catch (e) {
    return json({ error: e.message }, 500);
  }
};

export const config = { path: '/api/milestone-reminders' };
