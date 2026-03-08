// Netlify Function — Proxy para la API de BGG
// El token queda seguro en el servidor, nunca expuesto al navegador

export default async (req, context) => {
  const url = new URL(req.url);
  const bggId = url.searchParams.get('id');

  if (!bggId) {
    return new Response(JSON.stringify({ error: 'Falta el parámetro id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const BGG_TOKEN = process.env.BGG_TOKEN;
  const bggUrl = `https://boardgamegeek.com/xmlapi2/thing?stats=1&id=${bggId}`;

  try {
    const res = await fetch(bggUrl, {
      headers: {
        'Authorization': `Bearer ${BGG_TOKEN}`,
        'Accept': 'application/xml'
      }
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `BGG respondió con error ${res.status}` }), {
        status: res.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const xml = await res.text();

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = { path: '/api/bgg' };
