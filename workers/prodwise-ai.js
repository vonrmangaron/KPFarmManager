// ProdWise AI — the morning greeting and "✨ Ask the farm", on Cloudflare Workers AI (free daily allowance).
//
//   POST /ai/<farm-slug>   { mode: 'ross' | 'greet' | 'ask', part, name, facts, context, ... }
//   'ross'  → Ross, the farm's AI (named after the Ross 308), writes the morning report:
//             part 'main'  → JSON {overview, plan:[{fact,title,why}], crew, warnings:[...], weather}
//             part 'sheds' → JSON {sheds:{"1":"note",…}}
//   'greet' → a plain 2–3 sentence summary (older app versions)
//                          → { text, src, left }  or, when the manager asks for a change, { actions: [...], text, left }
//
// Changes (2026-10-25): the AI never changes anything itself. It turns "Shed 1 mortality 2156" or "move Shed 5's
// pickup to Monday" into proposed actions; the app checks them, shows a confirm card and applies them only after
// the manager taps Confirm, through the app's own save code.
//
// Setup in the Cloudflare dashboard (Workers & Pages → Create → Worker, name it "prodwise-ai", paste this file):
//   • Settings → Bindings → Add → Workers AI, variable name AI            (required)
//   • Settings → Bindings → Add → KV namespace: the sync server's KEYS    (optional: only the manager may ask)
//   • Settings → Bindings → Add → KV namespace: a new one, variable USAGE (optional: daily limit per farm)
//
// Free plan: 10,000 neurons a day for the whole account. When they're used up Workers AI refuses until
// 00:00 UTC — there is never a bill. The app then shows the plain facts instead.
// The app sends only a short summary of today's numbers, never the farm file. Nothing is stored here
// except a per-farm question count (USAGE) that expires after two days.

const ALLOWED_ORIGINS = ['https://vonrmangaron.github.io'];
const MODELS = ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/meta/llama-3.1-8b-instruct'];   // first one that works
const DAILY_LIMIT = 40;          // questions + greetings per farm per day (only with USAGE bound)
const MAX_BODY = 40 * 1024;

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Farm-Device, X-Farm-Key',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}
function reply(status, body, cors) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}
async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
// Same rules as the sync server: 'manager' | 'worker' | 'open', or null when refused.
async function phoneRole(request, env, farmSlug) {
  if (!env.KEYS) return 'open';
  const parts = farmSlug.split('-');
  let farm = null, rec = null;
  for (let i = 1; i <= Math.min(parts.length, 6) && !rec; i++) {
    farm = parts.slice(0, i).join('-');
    const v = await env.KEYS.get(`farm:${farm}`);
    rec = v ? JSON.parse(v) : null;
  }
  if (!rec) return 'open';
  const id = request.headers.get('X-Farm-Device'), key = request.headers.get('X-Farm-Key');
  if (id && key) {
    const v = await env.KEYS.get(`dev:${farm}:${id}`);
    const dev = v ? JSON.parse(v) : null;
    if (!dev || dev.keyHash !== await sha256(key) || (dev.role === 'manager' && dev.gen !== rec.mgrGen)) return null;
    return dev.role;
  }
  return rec.locked ? null : 'open';
}

const clip = (s, n) => String(s || '').slice(0, n);
const RULES = `You are the farm assistant inside ProdWise, an app for a broiler (meat chicken) farm.
Use ONLY the FARM DATA given. Never invent numbers, dates, sheds or names. If the data doesn't answer the question, say so plainly.
Write in plain Australian English for a busy farm manager. Units: kg, t (tonnes), birds, days. Dates like "Wed 28 Oct".`;

function buildMessages(b) {
  const name = clip(b.name, 40).trim();
  if (b.mode === 'greet') {
    return [
      { role: 'system', content: `${RULES}
Write the summary for the top of today's Daily report for ${name || 'the farm manager'}: 2–3 sentences, 40–70 words, from TODAY'S FACTS only.
Tone: calm, professional, factual — like a farm supervisor's handover note. Most important first (red, then amber), then one line on how things stand overall.
No greeting, no list, no heading, no emoji, no exclamation marks, no sign-off.` },
      { role: 'user', content: `TODAY'S FACTS (red = act today, amber = keep an eye on, blue = for info, green = fine):\n${clip(b.facts, 4000)}` },
    ];
  }
  if (b.mode === 'ross') {
    const who = name || 'the manager';
    if (b.part === 'sheds') {
      return [
        { role: 'system', content: `You are Ross, the farm assistant inside ProdWise (named after the Ross 308 broiler). ${RULES}
Write one short note per shed for this morning's report: how it is doing and the one thing that matters for it next. Under 16 words each, plain words, no shed number at the start.
Reply with ONLY one JSON object: {"sheds":{"1":"…","2":"…"}} — one key per shed in SHEDS.` },
        { role: 'user', content: `SHEDS:\n${clip(b.context, 6000)}` },
      ];
    }
    return [
      { role: 'system', content: `You are Ross, the farm assistant inside ProdWise (named after the Ross 308 broiler). ${RULES}
Write this morning's report for ${who}. Reply with ONLY one JSON object, nothing before or after:
{"overview":"3–4 sentences. Start with 'Morning ${name || ''}.' then how the day looks, what to do first and why, and how the batch stands overall.",
 "plan":[{"fact":"F3","title":"short instruction, e.g. Book a feed load for Sheds 5–6","why":"one sentence with the useful number or reason"}],
 "crew":"one sentence on the crew's workload today (who is overloaded, unassigned jobs, a suggested move) or empty",
 "warnings":["one sentence each — risks building up, from TRENDS and FACTS"],
 "weather":"1–2 sentences of farm advice for the coming days from WEATHER (heat, cold, rain, wind, on pickup or clean-out days) or empty"}
plan: the 3–5 most important things to do today, most urgent first, each pointing at one FACT id it comes from. warnings: 0–4, only real ones.
Calm, practical, like a good farm supervisor. No emoji, no exclamation marks.` },
      { role: 'user', content: `TODAY: ${clip(b.today, 40)}\n\n${clip(b.context, 16000)}` },
    ];
  }
  const hist = Array.isArray(b.history) ? b.history.slice(-6).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: clip(m.content, 1200) })) : [];
  return [
    { role: 'system', content: `${RULES}
Lead with the answer in one short sentence. Keep it short.
FORMAT: whenever you list 3 or more things (tasks, sheds, dates, jobs), put them in a bullet list — one per line, each line starting with "- " — and give each bullet its useful detail (shed, who it's for, day, number), e.g. "- Weigh Sheds 6 and 7 · Miguel". Group bullets under a short line ending in ":" when it helps (e.g. "Morning:" / "Afternoon:" or "Shed 5:" / "Shed 6:"). Use **bold** only for shed numbers or the key number. No headings, no tables.
On the last line write "From:" and the names of the FARM DATA sections you used, e.g. "From: Silos · Feed loads".

CHANGES: if the manager asks you to change, set, update, move, add or tick something, do NOT answer in sentences.
Reply with ONLY one JSON object, nothing before or after it:
{"say":"one short sentence","actions":[ ... ]}
Allowed actions (use as many as the manager asked for, one per shed or task):
{"type":"set_mortality","shed":1,"total":2156}   total dead birds so far in that shed (a whole number)
{"type":"move_pickup","shed":5,"from":null,"to":"2026-10-26"}   a planned pickup; "from" = its current date if the manager names it, otherwise null for the next one
{"type":"set_cleanout","shed":5,"to":"2026-10-29"}   the shed's clean-out date (its last pickup)
{"type":"add_task","name":"Check drinkers","date":"2026-10-26","who":["Miguel"]}   date null = backlog, who [] = anyone
{"type":"tick_task","name":"Order shavings","date":null}   mark a task done; date only if the manager gives one
Dates are YYYY-MM-DD — use the CALENDAR to turn "Monday", "tomorrow" or "Oct 26" into a date. Shed numbers are whole numbers.
If the change isn't one of these, answer in a sentence that you can't make that change and where to do it in the app.

CALENDAR: ${clip(b.calendar, 900)}

FARM DATA (today: ${clip(b.today, 40)}):
${clip(b.context, 24000)}

TODAY'S FACTS:
${clip(b.facts, 4000)}` },
    ...hist,
    { role: 'user', content: clip(b.question, 600) },
  ];
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!ALLOWED_ORIGINS.includes(origin)) return reply(403, { error: 'Not allowed' }, cors);
    const m = new URL(request.url).pathname.match(/^\/ai\/([a-z0-9-]{1,60})$/);
    if (!m || request.method !== 'POST') return reply(404, { error: 'Not found' }, cors);
    const farm = m[1];
    if (!env.AI) return reply(503, { error: 'Workers AI is not bound to this worker (variable name AI).', setup: true }, cors);

    // Manager only. 403 (not 401) so the app never signs the phone out because of the AI.
    const role = await phoneRole(request, env, farm);
    if (role !== 'manager' && role !== 'open') return reply(403, { error: 'Only the manager can use Ask.', refused: true }, cors);

    const raw = await request.text();
    if (raw.length > MAX_BODY) return reply(413, { error: 'Too much data' }, cors);
    let b; try { b = JSON.parse(raw); } catch (e) { return reply(400, { error: 'Bad request' }, cors); }
    if (b.mode !== 'greet' && !(b.mode === 'ross' && String(b.context || '').trim()) && !(b.mode === 'ask' && String(b.question || '').trim())) return reply(400, { error: 'Nothing to answer' }, cors);

    // Daily limit per farm (optional)
    const day = new Date().toISOString().slice(0, 10), ck = `n:${farm}:${day}`;
    let used = 0;
    if (env.USAGE) { used = Number(await env.USAGE.get(ck)) || 0; if (used >= DAILY_LIMIT) return reply(429, { error: 'Daily limit reached', limit: true, left: 0 }, cors); }

    const messages = buildMessages(b);
    let text = '', lastErr = null;
    for (const model of MODELS) {
      try {
        const out = await env.AI.run(model, { messages, max_tokens: b.mode === 'greet' ? 220 : b.mode === 'ross' ? (b.part === 'sheds' ? 500 : 1100) : 420, temperature: 0.3 });
        // Workers AI hands back JSON answers as an object, not text (2026-10-25: showed as "[object Object]")
        const r = out && (out.response != null ? out.response : out.result && out.result.response);
        text = (r && typeof r === 'object' ? JSON.stringify(r) : String(r || '')).trim();
        if (text) break;
      } catch (e) { lastErr = e; if (/neuron|quota|limit|4006|capacity/i.test(String(e && e.message))) break; }
    }
    if (!text) {
      const msg = String(lastErr && lastErr.message || '');
      if (/neuron|quota|limit|4006/i.test(msg)) return reply(429, { error: 'The free AI allowance is used up for today', limit: true, left: 0 }, cors);
      return reply(502, { error: 'The AI did not answer', detail: msg.slice(0, 200) }, cors);
    }
    if (env.USAGE) { used++; await env.USAGE.put(ck, String(used), { expirationTtl: 172800 }); }

    // A change request: pass the proposed actions on (the app checks every one before showing them)
    if (b.mode === 'ask') {
      const a = text.indexOf('{'), z = text.lastIndexOf('}');
      if (a >= 0 && z > a) {
        try {
          const j = JSON.parse(text.slice(a, z + 1));
          const OK = ['set_mortality', 'move_pickup', 'set_cleanout', 'add_task', 'tick_task'];
          const actions = (Array.isArray(j.actions) ? j.actions : []).filter(x => x && OK.includes(x.type)).slice(0, 12);
          if (actions.length) return reply(200, { actions, text: String(j.say || '').slice(0, 300), left: env.USAGE ? Math.max(0, DAILY_LIMIT - used) : null }, cors);
        } catch (e) { /* not JSON — treat as a normal answer */ }
      }
    }
    // "From: …" goes in its own field so the app can show it small
    let src = '';
    const fm = text.match(/\n\s*\**From:\**\s*(.+)\s*$/i);
    if (fm) { src = fm[1].trim().replace(/\*+/g, ''); text = text.slice(0, fm.index).trim(); }
    return reply(200, { text, src, left: env.USAGE ? Math.max(0, DAILY_LIMIT - used) : null }, cors);
  },
};
