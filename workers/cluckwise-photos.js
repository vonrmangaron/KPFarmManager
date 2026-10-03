// CluckWise photo server — a Cloudflare Worker with one Workers KV namespace bound as PHOTOS.
// (KV is on Cloudflare's free plan with no card; 1 GB holds ~5,000 shrunk photos.)
// Stores one shrunk JPEG per problem report. Separate from the farm-data sync
// worker on purpose, so photos can never affect farm data.
//
//   PUT    /photo/<farm-slug>/<report-id>.jpg   save (JPEG only, max 800 KB, no overwrite)
//   GET    /photo/<farm-slug>/<report-id>.jpg   show
//   DELETE /photo/<farm-slug>/<report-id>.jpg   remove (when the manager deletes the report)
//
// Report ids are random UUIDs, so a photo link can't be guessed. Saving and
// deleting are only accepted from the CluckWise site. Each photo expires by
// itself after KEEP_DAYS, so storage never builds up.

const ALLOWED_ORIGINS = ['https://vonrmangaron.github.io'];
const MAX_BYTES = 800 * 1024;
const KEEP_DAYS = 180;
const PATH_RE = /^\/photo\/([a-z0-9-]{1,60})\/(rpt-[A-Za-z0-9-]{8,80})\.jpg$/;

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function reply(status, body, cors) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const match = new URL(request.url).pathname.match(PATH_RE);
    if (!match) return reply(404, { error: 'not found' }, cors);
    const key = `${match[1]}/${match[2]}.jpg`;

    if (request.method === 'GET') {
      const photo = await env.PHOTOS.get(key, { type: 'arrayBuffer', cacheTtl: 86400 });
      if (!photo) return reply(404, { error: 'no photo' }, cors);
      return new Response(photo, {
        headers: { ...cors, 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=31536000, immutable' },
      });
    }

    if (!ALLOWED_ORIGINS.includes(origin)) return reply(403, { error: 'not allowed' }, cors);

    if (request.method === 'PUT') {
      if ((request.headers.get('Content-Type') || '').split(';')[0].trim() !== 'image/jpeg') {
        return reply(415, { error: 'jpeg only' }, cors);
      }
      const declared = Number(request.headers.get('Content-Length') || 0);
      if (declared > MAX_BYTES) return reply(413, { error: 'too big' }, cors);
      const body = await request.arrayBuffer();
      if (body.byteLength < 1000 || body.byteLength > MAX_BYTES) return reply(413, { error: 'bad size' }, cors);
      const head = new Uint8Array(body, 0, 3);
      if (head[0] !== 0xff || head[1] !== 0xd8 || head[2] !== 0xff) return reply(415, { error: 'not a jpeg' }, cors);
      const existing = await env.PHOTOS.get(key, { type: 'stream' });
      if (existing) { existing.cancel(); return reply(409, { ok: true, exists: true }, cors); }
      await env.PHOTOS.put(key, body, { expirationTtl: KEEP_DAYS * 86400 });
      return reply(201, { ok: true }, cors);
    }

    if (request.method === 'DELETE') {
      await env.PHOTOS.delete(key);
      return reply(200, { ok: true }, cors);
    }

    return reply(405, { error: 'method not allowed' }, cors);
  },
};
