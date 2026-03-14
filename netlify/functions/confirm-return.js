// Netlify Function — Confirmar método de devolución
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

export default async (req, context) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Solo POST' }, 405);

  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SERVICE_KEY) return json({ error: 'Servidor mal configurado' }, 500);

  let body;
  try { body = await req.json(); }
  catch(e) { return json({ error: 'JSON inválido' }, 400); }

  const { loan_id, method, return_name, return_date, _check_only } = body;
  if (!loan_id) return json({ error: 'loan_id requerido' }, 400);

  const sbH = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };

  try {
    // Fetch loan info
    const loanRes = await fetch(
      `${SUPABASE_URL}/rest/v1/loans?id=eq.${loan_id}&select=*,games(name_es)`,
      { headers: sbH }
    );
    const loans = await loanRes.json();
    if (!loans.length) return json({ error: 'Préstamo no encontrado' }, 404);
    const loan = loans[0];

    // Check only — return current state, game name and next session date
    if (_check_only) {
      // Get next session date for calendar max
      const today = new Date().toISOString().split('T')[0];
      const sessRes = await fetch(
        `${SUPABASE_URL}/rest/v1/sessions?status=eq.open&date=gte.${today}&order=date.asc&limit=1&select=date`,
        { headers: sbH }
      );
      const sessions = await sessRes.json().catch(() => []);
      const sessionDate = sessions[0]?.date || null;
      return json({
        ok: true,
        game_name: loan.games?.name_es || '',
        already_confirmed: !!loan.return_method,
        session_date: sessionDate,
      });
    }

    // Validate
    if (!method) return json({ error: 'method requerido' }, 400);
    if (!['sesion', 'porteria'].includes(method)) return json({ error: 'method inválido' }, 400);
    if (method === 'porteria' && (!return_name || !return_date)) {
      return json({ error: 'Nombre y fecha requeridos para portería' }, 400);
    }

    // Already confirmed
    if (loan.return_method) return json({ ok: true, already_confirmed: true });

    const patch = { return_method: method };
    if (method === 'porteria') {
      patch.return_name = String(return_name).trim().slice(0, 200);
      patch.return_date = return_date;
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/loans?id=eq.${loan_id}`, {
      method: 'PATCH',
      headers: { ...sbH, Prefer: 'return=minimal' },
      body: JSON.stringify(patch),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return json({ error: err.message || 'Error al actualizar' }, res.status);
    }

    return json({ ok: true });
  } catch(e) {
    return json({ error: e.message }, 500);
  }
};

export const config = { path: '/api/confirm-return' };
