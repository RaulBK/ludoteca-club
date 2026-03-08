// Netlify Function — Proxy seguro para operaciones de admin
// Usa SUPABASE_SERVICE_KEY (nunca expuesta al cliente)
// Variable de entorno: SUPABASE_SERVICE_KEY, ADMIN_TOKEN_SECRET

const SUPABASE_URL = 'https://jenjnkidfdtlcxxvntst.supabase.co';

function getServiceHeaders(serviceKey) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation'
  };
}

// Validate that the request comes from an authenticated admin session
function isAuthorized(req, adminPassword) {
  const token = req.headers.get('x-admin-token');
  if (!token) return false;
  try {
    const parts = atob(token).split(':');
    if (parts[0] !== 'dsm-admin') return false;
    const ts = parseInt(parts[1]);
    if ((Date.now() - ts) > 30 * 24 * 60 * 60 * 1000) return false;
    // Verify token was signed with correct password
    const expectedSuffix = adminPassword.split('').reverse().join('');
    return parts[2] === expectedSuffix;
  } catch(e) { return false; }
}

export default async (req, context) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE',
        'Access-Control-Allow-Headers': 'Content-Type, x-admin-token'
      }
    });
  }

  const SERVICE_KEY    = process.env.SUPABASE_SERVICE_KEY;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

  if (!SERVICE_KEY || !ADMIN_PASSWORD) {
    return json({ error: 'Servidor mal configurado' }, 500);
  }

  if (!isAuthorized(req, ADMIN_PASSWORD)) {
    return json({ error: 'No autorizado' }, 401);
  }

  const sbH = getServiceHeaders(SERVICE_KEY);
  const url = new URL(req.url);
  // Route: /api/proxy?resource=games&...
  const resource = url.searchParams.get('resource');
  const filter   = url.searchParams.get('filter') || '';
  const order    = url.searchParams.get('order')  || '';
  const select   = url.searchParams.get('select') || '*';
  const limit    = url.searchParams.get('limit')  || '';

  if (!resource) return json({ error: 'Falta resource' }, 400);

  // Whitelist of allowed resources
  const allowed = ['games', 'sessions', 'registrations', 'loans'];
  if (!allowed.includes(resource)) return json({ error: 'Recurso no permitido' }, 403);

  try {
    // filter is already url-encoded from client, decode and append raw
    const rawFilter = filter ? decodeURIComponent(filter) : '';
    let path = `/rest/v1/${resource}?select=${select}`;
    if (rawFilter) path += `&${rawFilter}`;
    if (order)     path += `&order=${decodeURIComponent(order)}`;
    if (limit)     path += `&limit=${limit}`;

    if (req.method === 'GET') {
      const getH = { ...sbH };
      delete getH.Prefer;
      const res  = await fetch(`${SUPABASE_URL}${path}`, { headers: getH });
      const data = await res.json();
      return json(data, res.status);
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const res  = await fetch(`${SUPABASE_URL}/rest/v1/${resource}`, {
        method: 'POST', headers: sbH, body: JSON.stringify(body)
      });
      const data = await res.json();
      return json(data, res.status);
    }

    if (req.method === 'PATCH') {
      const body = await req.json();
      const res  = await fetch(`${SUPABASE_URL}/rest/v1/${resource}?${decodeURIComponent(filter)}`, {
        method: 'PATCH',
        headers: { ...sbH, Prefer: 'return=minimal' },
        body: JSON.stringify(body)
      });
      return new Response(null, { status: res.status, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    if (req.method === 'DELETE') {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${resource}?${decodeURIComponent(filter)}`, {
        method: 'DELETE', headers: sbH
      });
      return new Response(null, { status: res.status, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    return json({ error: 'Método no soportado' }, 405);

  } catch(e) {
    return json({ error: e.message }, 500);
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

export const config = { path: '/api/proxy' };
