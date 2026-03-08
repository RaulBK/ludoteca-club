// Netlify Function — Traducción EN→ES
// Usa LibreTranslate (sin límite diario) con MyMemory como fallback

const CHUNK_SIZE = 490;

function splitIntoChunks(text, size) {
  const chunks = [];
  const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
  let current = '';
  for (const sentence of sentences) {
    if ((current + sentence).length > size) {
      if (current) chunks.push(current.trim());
      if (sentence.length > size) {
        for (let i = 0; i < sentence.length; i += size)
          chunks.push(sentence.substring(i, i + size));
        current = '';
      } else {
        current = sentence;
      }
    } else {
      current += sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

async function translateWithLibre(text) {
  // Multiple free LibreTranslate public instances as fallbacks
  const endpoints = [
    'https://libretranslate.com/translate',
    'https://translate.argosopentech.com/translate',
    'https://libretranslate.de/translate',
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, source: 'en', target: 'es', format: 'text' }),
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.translatedText) return data.translatedText;
    } catch(e) { continue; }
  }
  throw new Error('LibreTranslate no disponible');
}

async function translateWithMyMemory(chunk) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=en|es`;
  const res  = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const data = await res.json();
  if (data?.responseStatus === 200) return data.responseData.translatedText;
  throw new Error('MyMemory: ' + (data?.responseDetails || 'error'));
}

export default async (req, context) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' }
    });
  }

  try {
    const { text } = await req.json();
    if (!text) return new Response(JSON.stringify({ error: 'Falta el texto' }), { status: 400 });

    const input = text.substring(0, 1500);
    let translated;

    // Try LibreTranslate first (no daily limit), then MyMemory as fallback
    try {
      translated = await translateWithLibre(input);
    } catch(e) {
      // Fallback: MyMemory in chunks
      const chunks = splitIntoChunks(input, CHUNK_SIZE);
      const results = await Promise.all(chunks.map(translateWithMyMemory));
      translated = results.join(' ');
    }

    return new Response(JSON.stringify({ translated }), {
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

export const config = { path: '/api/translate' };
