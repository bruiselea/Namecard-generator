const MAX_PAYLOAD_LENGTH = 50000;
const CARD_ID_PATTERN = /^[A-Za-z0-9_-]{12}$/;
const PAYLOAD_PATTERN = /^[jz][A-Za-z0-9_-]+$/;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex',
};

function json(body, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

function createCardId() {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!env.CARD_STORAGE) {
    return json({ error: 'Storage is not configured.' }, 503);
  }

  const url = new URL(request.url);

  if (request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return json({ error: 'Invalid JSON.' }, 400);
    }

    const payload = body?.payload;
    if (typeof payload !== 'string' || payload.length > MAX_PAYLOAD_LENGTH || !PAYLOAD_PATTERN.test(payload)) {
      return json({ error: 'Invalid card data.' }, 400);
    }

    const id = createCardId();
    await env.CARD_STORAGE.put(`cards/${id}`, payload, {
      httpMetadata: { contentType: 'text/plain; charset=utf-8' },
      customMetadata: { createdAt: new Date().toISOString() },
    });
    return json({ id }, 201);
  }

  if (request.method === 'GET') {
    const id = url.searchParams.get('id') || '';
    if (!CARD_ID_PATTERN.test(id)) return json({ error: 'Invalid card ID.' }, 400);

    const card = await env.CARD_STORAGE.get(`cards/${id}`);
    if (!card) return json({ error: 'Card not found.' }, 404);

    return new Response(card.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }

  return json({ error: 'Method not allowed.' }, 405);
}
