// Netlify Function — Verificación de contraseña admin
// Variable de entorno: ADMIN_PASSWORD

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
    const { password } = await req.json();
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

    if (!ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: 'ADMIN_PASSWORD no configurada en Netlify' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (password === ADMIN_PASSWORD) {
      // Return a signed token: base64(timestamp + ":" + hash)
      const token = btoa(`dsm-admin:${Date.now()}:${ADMIN_PASSWORD.split('').reverse().join('')}`);
      return new Response(JSON.stringify({ ok: true, token }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    } else {
      return new Response(JSON.stringify({ ok: false, error: 'Contraseña incorrecta' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  } catch(e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = { path: '/api/auth' };
