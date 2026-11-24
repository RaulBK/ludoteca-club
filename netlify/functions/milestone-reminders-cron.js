// Netlify Scheduled Function — recordatorios personales de hitos de sesión.
// Se lanza lunes y jueves a las 06:00 y 07:00 UTC; solo actúa cuando en Madrid son las 08:00
// (así se mantiene a las 8:00 tanto en horario de invierno como de verano).
// Solo envía si REMINDERS_ENABLED=true (activar únicamente en el site de PRODUCCIÓN).

import { run, todayMadrid, hourMadrid } from "../lib/milestones.js";

export default async () => {
  if (process.env.REMINDERS_ENABLED !== 'true') {
    console.log('[milestones] desactivado (REMINDERS_ENABLED != true)');
    return;
  }
  if (hourMadrid() !== 8) return;
  try {
    const r = await run({ today: todayMadrid(), send: true, test: false });
    console.log('[milestones]', JSON.stringify(r));
  } catch (e) {
    console.error('[milestones] error:', e.message);
  }
};

export const config = { schedule: "0 6,7 * * 1,4" };
