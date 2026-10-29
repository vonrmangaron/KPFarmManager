// Farm Notify — phone notifications for the Crew app and ProdWise (Web Push, free on Cloudflare).
//
//   POST /?action=<name>   JSON body, always with { farm } (the farm name)
//   subscribe   { farm, id, sub, name, role, device, tz }   this phone wants notifications (sub = PushSubscription JSON)
//   unsubscribe { farm, id }                                  this phone turned them off
//   status      { farm, id }                                  → { on }
//   notify      { farm, from, by, events:[…] }                something happened (see EVENTS below)
//   day         { farm, tz, days:{ 'YYYY-MM-DD': { '<name key>': { name, open:[titles], done, overdue } } } }
//                                                             each person's jobs, for "Your day" and the reminder
//   settings    { farm, set? }        manager: read (and with set, save) quiet hours, times and switches
//   list        { farm }              manager: who has notifications on
//   test        { farm, target? }     manager: send a test to one phone (default: the one asking)
//   feedoff     { farm, events:[{ date, kill, sheds:[ids], birds, done }] }   manager: the feed-off days (ProdWise)
//
// FEED OFF (2026-10-26): the kill sheet date is the pickup; birds are caught the evening before, so Cluck tells the
// managers at foTime (7:00) on that day to turn the feed off, again at foRemindTime (11:00) if nobody tapped
// "Feed is off". It ignores quiet hours and stays on screen (requireInteraction) where the phone allows it.
//
// EVENTS
//   { type:'task', kind:'new'|'moved'|'changed', to:[names], id, title, date, from }   → those workers
//   { type:'report', urgent, id, title, shed, by }                                       → managers
//   { type:'done', id, title, by }    a high-priority task finished                     → managers
//   { type:'feed', id, title, body }  a feed / silo warning                             → managers
//
// A task event for several tasks in a row is grouped: each person gets one notification ("3 new tasks for Wednesday").
// Quiet hours (the manager sets them): nothing is sent; it's kept and sent when quiet hours end. Urgent problem
// reports still go to managers straight away when "break through" is on.
//
// Setup in the Cloudflare dashboard (Workers & Pages → Create → Worker, name it "farm-notify", paste this file):
//   • Settings → Variables and Secrets → Add → type Secret, name VAPID_PRIVATE, value = the key ProdWise's
//     setup note gives you (a {"kty":"EC",…} line). Never put it in the app or on GitHub.
//   • Settings → Bindings → Add → KV namespace: a new one called "farm-notify", variable NOTIFY   (required)
//   • Settings → Bindings → Add → KV namespace: the sync server's KEYS                              (only signed-in phones)
//   • Settings → Triggers → Cron Triggers → Add → */15 * * * *      ("Your day", the reminder, the end of quiet hours)
//
// Free plan: 100,000 requests and 1,000 KV saves a day. Nothing here saves on every notification — only new phones,
// settings, the day lists (when they change) and what's held back in quiet hours.

const ALLOWED_ORIGINS = ['https://vonrmangaron.github.io'];
const APP = 'https://vonrmangaron.github.io/KPFarmManager/';
const CREW_URL = APP + 'cluckwise/viewer.html';
const MGR_URL = APP + 'index.html';
const VAPID_PUBLIC = 'BAEoMBJJ_Wgy55j8R55a5Wvh9nu_DrXIoqrheJr2SZRCEkPpzAr-L8yAyGjf1nL-NAz20OAj3nPRpfzoMOfSCPU';
const VAPID_SUB = 'https://vonrmangaron.github.io';
const MAX_BODY = 64 * 1024;
const MAX_SUBS = 60;
const DEFAULTS = {
  tz: 'Australia/Sydney',
  quietOn: true, quietFrom: '20:00', quietTo: '05:30', urgentBreak: true,
  dayOn: true, dayTime: '06:00',
  remindOn: false, remindTime: '15:00',
  wNew: true, wMoved: true,
  mReports: true, mDone: true, mFeed: false,
  foOn: true, foTime: '07:00', foRemindOn: true, foRemindTime: '11:00',   // Cluck: feed off the morning of the catch
};

// ---------- small helpers ----------
const enc = new TextEncoder();
function b64u(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64u(s) {
  s = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function concat(...parts) {
  const n = parts.reduce((a, p) => a + p.length, 0), out = new Uint8Array(n);
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
const clip = (s, n) => String(s == null ? '' : s).slice(0, n);
const nameKey = n => String(n || '').trim().replace(/\s+/g, ' ').toLowerCase();
const slug = s => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
async function getJson(env, k) { const v = await env.NOTIFY.get(k); try { return v ? JSON.parse(v) : null; } catch (e) { return null; } }
const putJson = (env, k, v) => env.NOTIFY.put(k, JSON.stringify(v));

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Farm-Device, X-Farm-Key',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}
async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
// Same rules as the sync server: { role:'manager'|'worker'|'open' } or null when refused.
async function phoneRole(request, env, farm) {
  if (!env.KEYS) return 'open';
  const v = await env.KEYS.get(`farm:${farm}`);
  const rec = v ? JSON.parse(v) : null;
  if (!rec) return 'open';
  const id = request.headers.get('X-Farm-Device'), key = request.headers.get('X-Farm-Key');
  if (id && key) {
    const d = await env.KEYS.get(`dev:${farm}:${id}`);
    const dev = d ? JSON.parse(d) : null;
    if (!dev || dev.keyHash !== await sha256(key) || (dev.role === 'manager' && dev.gen !== rec.mgrGen)) return null;
    return dev.role;
  }
  return rec.locked ? null : 'open';
}

// ---------- Web Push (RFC 8291 aes128gcm + RFC 8292 VAPID) ----------
async function hkdf(salt, ikm, info, len) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, len * 8));
}
async function encryptPayload(sub, text) {
  const uaPublic = unb64u(sub.keys.p256dh), auth = unb64u(sub.keys.auth);
  const as = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256));
  const ikm = await hkdf(auth, shared, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(enc.encode(text), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]);   // record size 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}
let vapidKey = null;
async function vapidAuth(env, endpoint) {
  if (!vapidKey) vapidKey = await crypto.subtle.importKey('jwk', JSON.parse(env.VAPID_PRIVATE), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const u = new URL(endpoint);
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u(enc.encode(JSON.stringify({ aud: u.origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: VAPID_SUB })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, vapidKey, enc.encode(head + '.' + body));
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${VAPID_PUBLIC}`;
}
// → 'ok' | 'gone' (the phone turned it off / reinstalled: forget it) | 'fail'
async function sendPush(env, sub, msg, urgent) {
  try {
    const body = await encryptPayload(sub, JSON.stringify(msg));
    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        Authorization: await vapidAuth(env, sub.endpoint),
        'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream',
        TTL: String(urgent ? 6 * 3600 : 24 * 3600), Urgency: urgent ? 'high' : 'normal',
      },
      body,
    });
    if (res.status === 404 || res.status === 410) return 'gone';
    return res.ok ? 'ok' : 'fail';
  } catch (e) { return 'fail'; }
}

// ---------- farm time ----------
function localNow(tz) {
  const p = {};
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date()).forEach(x => { p[x.type] = x.value; });
  } catch (e) { return localNow(DEFAULTS.tz); }
  return { day: `${p.year}-${p.month}-${p.day}`, min: (+p.hour) * 60 + (+p.minute) };
}
const toMin = s => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '')); return m ? Math.min(23, +m[1]) * 60 + Math.min(59, +m[2]) : 0; };
function isQuiet(cfg, min) {
  if (!cfg.quietOn) return false;
  const a = toMin(cfg.quietFrom), b = toMin(cfg.quietTo);
  if (a === b) return false;
  return a < b ? (min >= a && min < b) : (min >= a || min < b);
}
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// 'today' | 'tomorrow' | 'Thursday' | 'Wed 4 Nov' | 'the backlog'
function dayWord(date, today) {
  if (!date) return 'the backlog';
  const d = new Date(date + 'T12:00:00Z'), t = new Date(today + 'T12:00:00Z');
  if (isNaN(d)) return '';
  const diff = Math.round((d - t) / 864e5);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  if (diff > 1 && diff < 7) return DOW[d.getUTCDay()];
  return `${DOW[d.getUTCDay()].slice(0, 3)} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
}

// ---------- who gets what ----------
async function farmState(env, farm) {
  const cfg = Object.assign({}, DEFAULTS, (await getJson(env, `cfg:${farm}`)) || {});
  const subs = (await getJson(env, `subs:${farm}`)) || {};
  return { cfg, subs };
}
// Turn events into one message per phone: [{ id, msg, urgent }]
function buildMessages(events, subs, cfg, today, fromId) {
  const out = [];
  const list = Object.entries(subs);
  // Workers (and a manager who is on a task): task events, grouped per person
  const perPerson = new Map();
  for (const ev of events) {
    if (ev.type !== 'task') continue;
    if (ev.kind === 'new' && !cfg.wNew) continue;
    if (ev.kind !== 'new' && !cfg.wMoved) continue;
    for (const n of (ev.to || [])) {
      const k = nameKey(n); if (!k) continue;
      if (!perPerson.has(k)) perPerson.set(k, []);
      perPerson.get(k).push(ev);
    }
  }
  for (const [k, evs] of perPerson) {
    const seen = new Set(), uniq = evs.filter(e => !seen.has(e.id + e.kind) && seen.add(e.id + e.kind));
    let title, body;
    const by = clip(uniq[0].by, 30);
    if (uniq.length === 1) {
      const e = uniq[0];
      if (e.kind === 'new') { title = by ? `New task from ${by}` : 'New task'; body = `${e.title} · ${dayWord(e.date, today)}`; }
      else if (e.kind === 'moved') { title = 'Task moved'; body = `${e.title} → ${dayWord(e.date, today)}`; }
      else { title = 'Task changed'; body = `${e.title} · ${dayWord(e.date, today)}`; }
    } else {
      const allNew = uniq.every(e => e.kind === 'new'), days = new Set(uniq.map(e => e.date || ''));
      const one = days.size === 1 ? dayWord(uniq[0].date, today) : '';
      title = allNew ? `${uniq.length} new tasks${one ? (one === 'the backlog' ? ' in the backlog' : ` for ${one}`) : ''}` : `${uniq.length} task changes${one ? ` for ${one}` : ''}`;
      body = uniq.slice(0, 4).map(e => e.title).join(', ') + (uniq.length > 4 ? ` +${uniq.length - 4} more` : '');
    }
    const first = uniq[0];
    for (const [id, s] of list) {
      if (id === fromId || !(nameKey(s.name) === k || nameKey(s.name).split(' ')[0] === k)) continue;
      const base = s.role === 'manager' ? MGR_URL : CREW_URL;
      out.push({ id, msg: { title, body, tag: 'tasks', url: `${base}?nt=${encodeURIComponent('task:' + (first.id || ''))}`, app: s.role }, urgent: false });
    }
  }
  // Managers: reports, finished high-priority tasks, feed warnings
  for (const ev of events) {
    let title, body, nt, urgent = false, tag;
    if (ev.type === 'report') {
      if (!cfg.mReports) continue;
      urgent = !!ev.urgent;
      title = `${urgent ? '🚩 Urgent: ' : 'Problem: '}${clip(ev.title, 60)}${ev.shed ? ` · ${clip(ev.shed, 30)}` : ''}`;
      body = `Reported by ${clip(ev.by, 30) || 'the crew'}. Tap to open the report.`;
      nt = 'report:' + (ev.id || ''); tag = 'report-' + (ev.id || '');
    } else if (ev.type === 'done') {
      if (!cfg.mDone) continue;
      title = `Done: ${clip(ev.title, 70)}`; body = `${clip(ev.by, 30) || 'Someone'} finished a high-priority task.`;
      nt = 'task:' + (ev.id || ''); tag = 'done-' + (ev.id || '');
    } else if (ev.type === 'feed') {
      if (!cfg.mFeed) continue;
      title = clip(ev.title, 80); body = clip(ev.body, 140);
      nt = 'feed:'; tag = 'feed-' + clip(ev.id, 40);
    } else continue;
    for (const [id, s] of list) {
      if (s.role !== 'manager') continue;
      out.push({ id, msg: { title, body, tag, url: `${MGR_URL}?nt=${encodeURIComponent(nt)}`, app: 'manager' }, urgent });
    }
  }
  return out;
}
async function deliver(env, farm, subs, msgs) {
  let gone = false, sent = 0;
  for (const m of msgs) {
    const s = subs[m.id]; if (!s) continue;
    const r = await sendPush(env, s.sub, m.msg, m.urgent);
    if (r === 'gone') { delete subs[m.id]; gone = true; } else if (r === 'ok') sent++;
  }
  if (gone) await putJson(env, `subs:${farm}`, subs);
  return sent;
}
async function rememberFarm(env, farm) {
  const farms = (await getJson(env, 'farms')) || [];
  if (!farms.includes(farm)) { farms.push(farm); await putJson(env, 'farms', farms.slice(-50)); }
}

// ---------- feed off before the catch ----------
const fmtDay = d => { const x = new Date(d + 'T12:00:00Z'); return isNaN(x) ? '' : `${DOW[x.getUTCDay()].slice(0, 3)} ${x.getUTCDate()} ${MON[x.getUTCMonth()]}`; };
const shedsLabel = a => { const s = (a || []).slice().sort((x, y) => x - y); return s.length === 1 ? 'Shed ' + s[0] : 'Sheds ' + s.slice(0, -1).join(', ') + ' & ' + s[s.length - 1]; };
async function feedOffTick(env, farm, cfg, subs, now) {
  const evs = (await getJson(env, `fo:${farm}`)) || [];
  const ev = evs.find(e => e.date === now.day);
  if (!ev || ev.done) return;
  const sent = (await getJson(env, `fosent:${farm}`)) || {};
  const t1 = toMin(cfg.foTime), t2 = toMin(cfg.foRemindTime);
  let kind = null;
  if (sent[ev.date] !== 1 && sent[ev.date] !== 2 && now.min >= t1 && now.min < t1 + 240) kind = 1;
  else if (sent[ev.date] === 1 && cfg.foRemindOn && now.min >= t2 && now.min < t2 + 240) kind = 2;
  if (!kind) return;
  const label = shedsLabel(ev.sheds), birds = ev.birds ? ` · ${Number(ev.birds).toLocaleString('en-US')} birds` : '';
  const msg = kind === 1
    ? { title: `Feed off today: ${label}`, body: `Cluck: they’re caught tonight (kill sheet ${fmtDay(ev.kill)}${birds}). Tap when the feed is off.` }
    : { title: `Still to do: feed off ${label}`, body: `Cluck: nobody has marked the feed off yet. Catch tonight, kill sheet ${fmtDay(ev.kill)}.` };
  const msgs = Object.entries(subs).filter(([, s]) => s.role === 'manager')
    .map(([id]) => ({ id, msg: { ...msg, tag: 'feedoff-' + ev.date, sticky: true, url: `${MGR_URL}?nt=${encodeURIComponent('feedoff:' + ev.date)}`, app: 'manager' }, urgent: true }));
  Object.keys(sent).forEach(k => { if (k < now.day) delete sent[k]; });
  sent[ev.date] = kind;
  await putJson(env, `fosent:${farm}`, sent);
  if (msgs.length) await deliver(env, farm, subs, msgs);
}

// ---------- the 15-minute timer ----------
function dayMessage(p, kind) {
  const open = (p.open || []).length, od = p.overdue || 0;
  if (kind === 'day') {
    const first = (p.open || [])[0];
    return {
      title: `Your day, ${String(p.name || '').split(' ')[0]}`,
      body: open ? `${open} job${open === 1 ? '' : 's'} today${od ? ` · ${od} overdue` : ''}.${first ? ` First: ${first}.` : ''}`
        : `Nothing new today · ${od} overdue job${od === 1 ? '' : 's'} still open.`,
    };
  }
  return { title: `Still open today: ${open} job${open === 1 ? '' : 's'}`, body: (p.open || []).slice(0, 4).join(', ') };
}
async function tick(env) {
  const farms = (await getJson(env, 'farms')) || [];
  for (const farm of farms) {
    const { cfg, subs } = await farmState(env, farm);
    if (!Object.keys(subs).length) continue;
    const now = localNow(cfg.tz), quiet = isQuiet(cfg, now.min);
    if (cfg.foOn) await feedOffTick(env, farm, cfg, subs, now);
    if (quiet) continue;
    // 1. what quiet hours held back
    const held = await getJson(env, `held:${farm}`);
    if (held && held.length) {
      await env.NOTIFY.delete(`held:${farm}`);
      await deliver(env, farm, subs, buildMessages(held, subs, cfg, now.day, null));
    }
    // 2. "Your day" and the afternoon reminder, once a day each, within 3 hours of their time
    const sent = (await getJson(env, `sent:${farm}`)) || {};
    const want = [];
    if (cfg.dayOn && sent.day !== now.day && now.min >= toMin(cfg.dayTime) && now.min < toMin(cfg.dayTime) + 180) want.push('day');
    if (cfg.remindOn && sent.remind !== now.day && now.min >= toMin(cfg.remindTime) && now.min < toMin(cfg.remindTime) + 180) want.push('remind');
    if (!want.length) continue;
    const days = (await getJson(env, `day:${farm}`)) || {};
    const today = days[now.day] || {};
    const msgs = [];
    for (const kind of want) {
      sent[kind] = now.day;
      for (const [id, s] of Object.entries(subs)) {
        const p = today[nameKey(s.name)] || today[nameKey(s.name).split(' ')[0]];
        if (!p || !((p.open || []).length || (kind === 'day' && p.overdue))) continue;
        const m = dayMessage(p, kind);
        msgs.push({ id, msg: { ...m, tag: kind === 'day' ? 'your-day' : 'reminder', url: s.role === 'manager' ? `${MGR_URL}?nt=tasks` : CREW_URL, app: s.role }, urgent: false });
      }
    }
    await putJson(env, `sent:${farm}`, sent);
    await deliver(env, farm, subs, msgs);
  }
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin);
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method === 'GET') return json({ ok: true, service: 'farm-notify', publicKey: VAPID_PUBLIC, setup: !!(env.NOTIFY && env.VAPID_PRIVATE) });
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
    if (!env.NOTIFY || !env.VAPID_PRIVATE) return json({ error: 'Notifications are not set up yet', setup: true }, 503);
    if (Number(request.headers.get('Content-Length') || 0) > MAX_BODY) return json({ error: 'Too big' }, 413);
    let b; try { b = JSON.parse(await request.text()); } catch (e) { return json({ error: 'Bad request' }, 400); }
    const action = new URL(request.url).searchParams.get('action') || '';
    const farm = slug(b.farm).slice(0, 60);
    if (!farm) return json({ error: 'Missing farm' }, 400);
    const role = await phoneRole(request, env, farm);
    if (!role) return json({ error: 'Sign in first' }, 403);
    const isMgr = role === 'manager' || role === 'open';
    // This phone: its signed-in id when the farm is locked (so nobody can stand in for another phone)
    const self = request.headers.get('X-Farm-Device');
    const id = clip(role !== 'open' && self ? self : (b.id || self), 90);

    if (action === 'subscribe') {
      const sub = b.sub || {};
      if (!id || !/^https:\/\//.test(sub.endpoint || '') || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) return json({ error: 'Bad subscription' }, 400);
      const subs = (await getJson(env, `subs:${farm}`)) || {};
      if (!subs[id] && Object.keys(subs).length >= MAX_SUBS) return json({ error: 'Too many phones' }, 400);
      subs[id] = {
        sub: { endpoint: clip(sub.endpoint, 800), keys: { p256dh: clip(sub.keys.p256dh, 200), auth: clip(sub.keys.auth, 60) } },
        name: clip(b.name, 40).trim(), role: b.role === 'manager' && isMgr ? 'manager' : 'worker',
        device: clip(b.device, 30), at: Date.now(),
      };
      await putJson(env, `subs:${farm}`, subs);
      // The first manager phone sets the farm's time zone
      if (subs[id].role === 'manager' && b.tz) {
        const cfg = (await getJson(env, `cfg:${farm}`)) || {};
        if (!cfg.tz) { cfg.tz = clip(b.tz, 60); await putJson(env, `cfg:${farm}`, cfg); }
      }
      ctx.waitUntil(rememberFarm(env, farm));
      return json({ ok: true });
    }
    if (action === 'unsubscribe') {
      const subs = (await getJson(env, `subs:${farm}`)) || {};
      if (subs[id]) { delete subs[id]; await putJson(env, `subs:${farm}`, subs); }
      return json({ ok: true });
    }
    if (action === 'status') {
      const subs = (await getJson(env, `subs:${farm}`)) || {};
      return json({ ok: true, on: !!subs[id] });
    }
    if (action === 'notify') {
      let events = (Array.isArray(b.events) ? b.events : []).slice(0, 80).map(e => ({
        type: clip(e.type, 10), kind: clip(e.kind, 10), to: (Array.isArray(e.to) ? e.to : []).slice(0, 20).map(n => clip(n, 40)),
        id: clip(e.id, 90), title: clip(e.title, 120), date: /^\d{4}-\d{2}-\d{2}$/.test(e.date || '') ? e.date : null,
        shed: clip(e.shed, 40), by: clip(e.by || b.by, 40), body: clip(e.body, 200), urgent: !!e.urgent,
      }));
      // Workers can only tell the manager something (a report, a finished task)
      if (!isMgr) events = events.filter(e => e.type === 'report' || e.type === 'done');
      if (!events.length) return json({ ok: true, sent: 0 });
      const { cfg, subs } = await farmState(env, farm);
      const now = localNow(cfg.tz);
      if (isQuiet(cfg, now.min)) {
        const now1 = cfg.urgentBreak ? events.filter(e => e.type === 'report' && e.urgent) : [];
        const later = events.filter(e => !now1.includes(e));
        if (later.length) {
          const held = (await getJson(env, `held:${farm}`)) || [];
          await putJson(env, `held:${farm}`, held.concat(later).slice(-200));
          ctx.waitUntil(rememberFarm(env, farm));
        }
        const sent = now1.length ? await deliver(env, farm, subs, buildMessages(now1, subs, cfg, now.day, id)) : 0;
        return json({ ok: true, sent, held: later.length });
      }
      const sent = await deliver(env, farm, subs, buildMessages(events, subs, cfg, now.day, id));
      return json({ ok: true, sent });
    }
    if (action === 'day') {
      const days = {};
      for (const [d, people] of Object.entries(b.days || {}).slice(0, 10)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !people || typeof people !== 'object') continue;
        days[d] = {};
        for (const [k, p] of Object.entries(people).slice(0, 40)) {
          days[d][nameKey(k)] = { name: clip(p && p.name, 40), open: (Array.isArray(p && p.open) ? p.open : []).slice(0, 12).map(x => clip(x, 80)), overdue: Math.max(0, Math.min(99, +(p && p.overdue) || 0)) };
        }
      }
      const cur = await env.NOTIFY.get(`day:${farm}`);
      // The Crew app doesn't have the manager-only tasks: keep the people it doesn't know about
      if (!isMgr && cur) {
        let old = {}; try { old = JSON.parse(cur) || {}; } catch (e) {}
        for (const d of Object.keys(days)) for (const [k, p] of Object.entries(old[d] || {})) if (!days[d][k]) days[d][k] = p;
      }
      const next = JSON.stringify(days);
      if (next !== cur) await env.NOTIFY.put(`day:${farm}`, next);
      return json({ ok: true });
    }
    if (!isMgr) return json({ error: 'Managers only' }, 403);
    if (action === 'settings') {
      const cfg = (await getJson(env, `cfg:${farm}`)) || {};
      if (b.set && typeof b.set === 'object') {
        for (const k of Object.keys(DEFAULTS)) {
          if (!(k in b.set)) continue;
          const v = b.set[k];
          if (typeof DEFAULTS[k] === 'boolean') cfg[k] = !!v;
          else if (k === 'tz') cfg.tz = clip(v, 60);
          else if (/^\d{1,2}:\d{2}$/.test(v)) cfg[k] = v;
        }
        await putJson(env, `cfg:${farm}`, cfg);
      }
      return json({ ok: true, settings: Object.assign({}, DEFAULTS, cfg) });
    }
    if (action === 'feedoff') {
      const evs = (Array.isArray(b.events) ? b.events : []).slice(0, 20)
        .filter(e => e && /^\d{4}-\d{2}-\d{2}$/.test(e.date || '') && /^\d{4}-\d{2}-\d{2}$/.test(e.kill || ''))
        .map(e => ({ date: e.date, kill: e.kill, sheds: (Array.isArray(e.sheds) ? e.sheds : []).slice(0, 12).map(Number).filter(n => n > 0 && n < 100), birds: Math.max(0, Math.min(1e6, Math.round(+e.birds || 0))), done: !!e.done }));
      const next = JSON.stringify(evs), cur = await env.NOTIFY.get(`fo:${farm}`);
      if (next !== cur) await env.NOTIFY.put(`fo:${farm}`, next);
      ctx.waitUntil(rememberFarm(env, farm));
      return json({ ok: true, events: evs.length });
    }
    if (action === 'list') {
      const subs = (await getJson(env, `subs:${farm}`)) || {};
      return json({ ok: true, phones: Object.entries(subs).map(([pid, s]) => ({ id: pid, name: s.name, role: s.role, device: s.device, at: s.at })) });
    }
    if (action === 'test') {
      const subs = (await getJson(env, `subs:${farm}`)) || {};
      const target = clip(b.target || id, 90), s = subs[target];
      if (!s) return json({ error: 'That phone has notifications off' }, 404);
      const r = await sendPush(env, s.sub, { title: 'Test from ProdWise', body: `Notifications work on ${s.name || 'this phone'}'s ${s.device || 'phone'}.`, tag: 'test', url: s.role === 'manager' ? MGR_URL : CREW_URL, app: s.role }, true);
      if (r === 'gone') { delete subs[target]; await putJson(env, `subs:${farm}`, subs); }
      return json({ ok: r === 'ok', result: r });
    }
    return json({ error: 'Unknown action' }, 400);
  },
  async scheduled(event, env, ctx) {
    if (!env.NOTIFY || !env.VAPID_PRIVATE) return;
    ctx.waitUntil(tick(env));
  },
};
