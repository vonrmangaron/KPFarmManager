// ProdWise / CluckWise sync server — a Cloudflare Worker in front of the private
// GitHub repo that holds each farm's data files.
//
// Settings in the Cloudflare dashboard:
//   GITHUB_TOKEN  (Secret)       token that can read and write the farm data repo
//   KEYS          (KV binding)   farm passwords and phone keys. Without it the
//                                worker works as before: farm name only.
//   REPO          (optional)     data repo, default vonrmangaron/farmdata
//
// Files (unchanged for the apps):
//   GET  ?farm=<file>            → { sha, data }   (404 { notFound:true })
//   PUT  ?farm=<file>            body { sha, data } → { ok, sha }   (409 { conflict:true })
//   GET  ?prefix=<text>          → { files:[{ name, sha, size }] }   (manager only)
//
// Farm passwords (POST ?action=…, JSON body), set in ProdWise › Account › Security:
// the manager password (ProdWise and CluckWise) and the farm password (workers in
// the Viewer). A farm can also be turned on with one shared `password`; the manager
// then sets a manager password of their own.
//   info    { farm } → { setup, locked, oldPassword, single }   (public)
//   setup   { farm, managerPassword, farmPassword (or one shared password), current?, deviceId, name, device }
//           first time only. If the farm already has a password from the old CluckWise
//           Workers screen, `current` must be that password.
//   join    { farm, role:'manager'|'worker', password, deviceId, name, device } → { key, role }
//   leave   (with key) this phone signs itself out
//   manage  (manager key) { op:'status' | 'passwords' | 'revoke' | 'signoutAll' | 'lock' | 'organize' | 'aiLink', … }
//           aiLink {} → { on, key, at } · { make:true, tz } new link (the old one stops) · { off:true }
//
// AI read-only link (2026-11-25): GET ?export=<farm>&key=<key>[&full=1] → the whole farm as one JSON
// reply, for an AI assistant to read without opening the apps. It only ever reads. The key is its own
// (not a phone key, so "sign out all devices" leaves it alone); the manager turns it off in ProdWise.
//           passwords { managerPassword } other manager devices sign in again;
//           { farmPassword } workers already signed in stay connected.
//
// A phone sends X-Farm-Device and X-Farm-Key with every request. The farm is always
// worked out here from the file name (never taken from the phone).
//   - A wrong or removed key is always refused (401 { signedOut:true }).
//   - Without a key: allowed until the manager locks the farm, then 401 { needKey:true }.
//   - Workers (Viewer) can only read and write the farm's task file and its reports.
//   - Managers can use every file of their own farm. No key ever reaches another farm.

const DEFAULT_REPO = 'vonrmangaron/farmdata';
const PBKDF2_ITERATIONS = 20000;
const MAX_TRIES = 5;               // wrong passwords in a row on one phone…
const MAX_NET_TRIES = 20;          // …or from one network (someone switching phones)…
const LOCK_MS = 10 * 60e3;         // …then sign-in is locked there for 10 minutes
const SEEN_EVERY_MS = 12 * 3600e3; // refresh a phone's "last seen" at most twice a day (KV writes are limited)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Farm-Device, X-Farm-Key',
  'Access-Control-Max-Age': '86400',
};
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// Same sanitising the apps use, so file names and farm names always line up.
const slugify = s => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const sha256 = async s => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
const randomHex = n => hex(crypto.getRandomValues(new Uint8Array(n)));
async function pbkdf2(pw, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(String(pw)), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations }, key, 256));
}
// Compares the whole string every time, so timing doesn't hint at how much matched.
function same(a, b) {
  a = String(a || ''); b = String(b || '');
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
async function makePassword(pw) {
  const salt = randomHex(16);
  return { salt, it: PBKDF2_ITERATIONS, hash: await pbkdf2(pw, salt, PBKDF2_ITERATIONS) };
}
async function checkPassword(rec, pw) {
  return !!rec && same(rec.hash, await pbkdf2(pw, rec.salt, rec.it || PBKDF2_ITERATIONS));
}

// ── GitHub ──────────────────────────────────────────────────
// One folder per farm, then per app (2026-10-14):
//   <farm>/prodwise/batches/<batch>.json      ← <farm>-feed-<batch>        (no batch: legacy.json)
//   <farm>/prodwise/excel/<batch>.json        ← <farm>-feed-<batch>-file
//   <farm>/prodwise/history.json              ← <farm>-prodwise-history
//   <farm>/cluckwise/tasks.json               ← <farm>
//   <farm>/cluckwise/reports.json             ← <farm>-reports
//   <farm>/cluckwise/access.json              ← <farm>-access
//   <farm>/cluckwise/restore-points/<slot>.json ← <farm>-snap-<slot>
//   <farm>/cluckwise/restore-points/old-all-in-one.json ← <farm>-snapshots (old single-file store)
//   <farm>/cluckwise/archive/<name>.json      ← <farm>-archive-<name>
// The apps keep using the same file names (slugs); only this server maps them to paths.
// Files not moved yet are still found where they were: prodwise/ or cluckwise/ (the old
// app folders) or the top of the repo. New farms are written straight into their folder.
// "Organise cloud files" (action manage, op organize) moves a farm in one commit.
function pathFor(slug) {
  let m;
  if ((m = /^(.+?)-feed-file$/.exec(slug))) return `${m[1]}/prodwise/excel/legacy.json`;
  if ((m = /^(.+?)-feed-(.+)-file$/.exec(slug))) return `${m[1]}/prodwise/excel/${m[2]}.json`;
  if ((m = /^(.+?)-feed$/.exec(slug))) return `${m[1]}/prodwise/batches/legacy.json`;
  if ((m = /^(.+?)-feed-(.+)$/.exec(slug))) return `${m[1]}/prodwise/batches/${m[2]}.json`;
  if ((m = /^(.+?)-prodwise-history$/.exec(slug))) return `${m[1]}/prodwise/history.json`;
  if ((m = /^(.+?)-reports$/.exec(slug))) return `${m[1]}/cluckwise/reports.json`;
  if ((m = /^(.+?)-access$/.exec(slug))) return `${m[1]}/cluckwise/access.json`;
  if ((m = /^(.+?)-snapshots$/.exec(slug))) return `${m[1]}/cluckwise/restore-points/old-all-in-one.json`;
  if ((m = /^(.+?)-snap-(.+)$/.exec(slug))) return `${m[1]}/cluckwise/restore-points/${m[2]}.json`;
  if ((m = /^(.+?)-archive-(.+)$/.exec(slug))) return `${m[1]}/cluckwise/archive/${m[2]}.json`;
  return `${slug}/cluckwise/tasks.json`;
}
// The other way: a path in the farm layout back to the file name the apps use
function slugForPath(path) {
  const m = /^([^/]+)\/(prodwise|cluckwise)\/(.+)\.json$/.exec(path); if (!m) return null;
  const [, farm, app, rest] = m;
  if (app === 'prodwise') {
    let r;
    if ((r = /^batches\/(.+)$/.exec(rest))) return r[1] === 'legacy' ? `${farm}-feed` : `${farm}-feed-${r[1]}`;
    if ((r = /^excel\/(.+)$/.exec(rest))) return r[1] === 'legacy' ? `${farm}-feed-file` : `${farm}-feed-${r[1]}-file`;
    if (rest === 'history') return `${farm}-prodwise-history`;
    return null;
  }
  if (rest === 'tasks') return farm;
  if (rest === 'reports') return `${farm}-reports`;
  if (rest === 'access') return `${farm}-access`;
  if (rest === 'restore-points/old-all-in-one') return `${farm}-snapshots`;
  let r;
  if ((r = /^restore-points\/(.+)$/.exec(rest))) return `${farm}-snap-${r[1]}`;
  if ((r = /^archive\/(.+)$/.exec(rest))) return `${farm}-archive-${r[1]}`;
  return null;
}
const appFolderFor = slug => (/-feed(-|$)/.test(slug) || /-prodwise-history$/.test(slug)) ? 'prodwise' : 'cluckwise';
// Where a file may still be, oldest layout last
const oldPaths = slug => [`${appFolderFor(slug)}/${slug}.json`, `${slug}.json`];

function github(env) {
  const repo = env.REPO || DEFAULT_REPO;
  const headers = { Authorization: `token ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'ProdPlanWorker' };
  const api = `https://api.github.com/repos/${repo}`;
  const pathUrl = path => `${api}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
  async function readAt(path) {
    const res = await fetch(pathUrl(path), { headers });
    if (res.status === 404) return { notFound: true };
    if (!res.ok) return { error: res.status };
    const meta = await res.json();
    let text;
    if (meta.content && meta.encoding === 'base64') {
      text = decodeURIComponent(escape(atob(meta.content.replace(/\n/g, ''))));
    } else {
      // Over 1 MB GitHub leaves the content out: fetch the raw file instead.
      const raw = await fetch(pathUrl(path), { headers: { ...headers, Accept: 'application/vnd.github.raw' } });
      if (!raw.ok) return { error: raw.status };
      text = await raw.text();
    }
    return { sha: meta.sha, data: JSON.parse(text) };
  }
  // The file as text, not parsed (the AI link passes big files straight through)
  async function rawAt(path) {
    const res = await fetch(pathUrl(path), { headers: { ...headers, Accept: 'application/vnd.github.raw' } });
    if (res.status === 404) return { notFound: true };
    if (!res.ok) return { error: res.status };
    return { text: await res.text() };
  }
  async function writeAt(path, sha, data) {
    const body = { message: `ProdPlan.VM update ${new Date().toISOString()}`, content: btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2)))) };
    if (sha) body.sha = sha;
    const res = await fetch(pathUrl(path), { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.status === 409 || res.status === 422) return { conflict: true };
    const out = await res.json().catch(() => ({}));
    if (!res.ok) return { error: res.status, detail: out };
    return { ok: true, sha: out.content && out.content.sha };
  }
  async function exists(path) {
    const res = await fetch(pathUrl(path), { method: 'GET', headers });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('GitHub error ' + res.status);
    const meta = await res.json();
    return meta.sha || null;
  }
  // The whole repo as { path → blob sha } in one call (plus the branch head for commits)
  async function snapshot() {
    const info = await fetch(api, { headers }).then(r => r.json());
    const branch = info.default_branch || 'main';
    const ref = await fetch(`${api}/git/ref/heads/${branch}`, { headers }).then(r => r.json());
    const commitSha = ref.object && ref.object.sha;
    const commit = await fetch(`${api}/git/commits/${commitSha}`, { headers }).then(r => r.json());
    const tree = await fetch(`${api}/git/trees/${commit.tree.sha}?recursive=1`, { headers }).then(r => r.json());
    const files = new Map();
    (tree.tree || []).forEach(t => { if (t.type === 'blob' && t.path.endsWith('.json')) files.set(t.path, { sha: t.sha, size: t.size || 0 }); });
    return { branch, commitSha, treeSha: commit.tree.sha, files };
  }
  return {
    async readRaw(slug) {
      for (const path of [pathFor(slug), ...oldPaths(slug)]) {
        const r = await rawAt(path);
        if (!r.notFound) return r;
      }
      return { notFound: true };
    },
    async read(slug) {
      for (const path of [pathFor(slug), ...oldPaths(slug)]) {
        const r = await readAt(path);
        if (!r.notFound) return r;
      }
      return { notFound: true };
    },
    // Writes where the file is now; a file that isn't anywhere yet goes into the farm folder.
    async write(slug, sha, data) {
      for (const path of [pathFor(slug), ...oldPaths(slug)]) {
        if (await exists(path)) return writeAt(path, sha, data);
      }
      return writeAt(pathFor(slug), sha, data);
    },
    async list(prefix) {
      const snap = await snapshot();
      const seen = new Map();
      for (const [path, f] of snap.files) {
        let slug = slugForPath(path);
        if (!slug) { const m = /^(?:(?:cluckwise|prodwise)\/)?([^/]+)\.json$/.exec(path); slug = m ? m[1] : null; }
        if (!slug || !slug.startsWith(prefix) || seen.has(slug)) continue;
        seen.set(slug, { name: `${slug}.json`, sha: f.sha, size: f.size });
      }
      return { files: [...seen.values()] };
    },
    // Moves one farm's files into <farm>/… in ONE commit: same file contents (same blob), new path,
    // old path removed. Nothing is downloaded or rewritten, so size doesn't matter and phones
    // keep the same version id (sha). If someone saves at the same moment, it starts again.
    async organize(farm) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const snap = await snapshot();
        const entries = [], moved = [], skipped = [];
        for (const [path, f] of snap.files) {
          const m = /^(?:(cluckwise|prodwise)\/)?([^/]+)\.json$/.exec(path); if (!m) continue;
          const slug = m[2];
          if (!(slug === farm || slug.startsWith(farm + '-'))) continue;
          const target = pathFor(slug);
          const there = snap.files.get(target);
          if (there && there.sha !== f.sha) { skipped.push(slug); continue; }   // a different copy is already in place: leave both
          if (!there) entries.push({ path: target, mode: '100644', type: 'blob', sha: f.sha });
          entries.push({ path, mode: '100644', type: 'blob', sha: null });
          moved.push(slug);
        }
        if (!entries.length) return { moved: [], skipped };
        const tree = await fetch(`${api}/git/trees`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ base_tree: snap.treeSha, tree: entries }) }).then(r => r.json());
        if (!tree.sha) throw new Error('Could not build the new folder layout');
        const commit = await fetch(`${api}/git/commits`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `Organise ${farm}: ${moved.length} files into ${farm}/prodwise and ${farm}/cluckwise`, tree: tree.sha, parents: [snap.commitSha] }) }).then(r => r.json());
        if (!commit.sha) throw new Error('Could not save the new folder layout');
        const upd = await fetch(`${api}/git/refs/heads/${snap.branch}`, { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ sha: commit.sha }) });
        if (upd.ok) return { moved, skipped };
        if (upd.status !== 422) throw new Error('GitHub error ' + upd.status);   // 422: a phone saved meanwhile — try again
      }
      throw new Error('The farm files kept changing — try again in a minute');
    },
  };
}

// ── Farm records (KV) ───────────────────────────────────────
//   farm:<farm>              { farmPw, mgrPw, locked, mgrGen, setAt }
//   dev:<farm>:<deviceId>    { keyHash, role, name, device, gen, at, seen }
//   fail:<farm>:dev:<id>     { n, last, until }   wrong passwords on one phone
//   fail:<farm>:ip:<ip>      { n, last, until }   wrong passwords from one network
const farmKey = farm => `farm:${farm}`;
const devKey = (farm, id) => `dev:${farm}:${id}`;
const getJson = async (env, k) => { const v = await env.KEYS.get(k); return v ? JSON.parse(v) : null; };
const putJson = (env, k, v) => env.KEYS.put(k, JSON.stringify(v));

// Wrong passwords: 5 in a row on one phone locks that phone's sign-in for 10 minutes, so one
// worker's mistakes never lock anyone else out. 20 from one network (someone clearing or switching
// phones to keep guessing) locks that network. A right password clears the phone's count.
// Phones already signed in never type the password, so a lock doesn't touch them.
const failKeys = (farm, request, b) => ({
  dev: `fail:${farm}:dev:${String(b.deviceId || 'none').slice(0, 80)}`,
  net: `fail:${farm}:ip:${request.headers.get('CF-Connecting-IP') || 'unknown'}`,
});
const minutes = ms => Math.max(1, Math.ceil(ms / 60e3));
const lockedReply = ms => json({ error: `Too many incorrect attempts. Please try again in ${minutes(ms)} minute${minutes(ms) === 1 ? '' : 's'}.`, wait: true, retryAfter: Math.ceil(ms / 1000) }, 429);
async function lockLeft(env, fk) {
  const [d, n] = await Promise.all([getJson(env, fk.dev), getJson(env, fk.net)]);
  const now = Date.now();
  return Math.max(0, ...[d, n].map(f => f && f.until && f.until > now ? f.until - now : 0));
}
async function bump(env, k, max) {
  const f = await getJson(env, k), now = Date.now();
  const fresh = !f || (f.until && f.until <= now) || now - (f.last || 0) > LOCK_MS;
  const n = (fresh ? 0 : f.n) + 1;
  const until = n >= max ? now + LOCK_MS : 0;
  await env.KEYS.put(k, JSON.stringify({ n, last: now, until }), { expirationTtl: 1800 });
  return { left: Math.max(0, max - n), locked: !!until };
}
async function noteFail(env, fk) {
  const [d, n] = await Promise.all([bump(env, fk.dev, MAX_TRIES), bump(env, fk.net, MAX_NET_TRIES)]);
  return { left: Math.min(d.left, n.left), lockMs: d.locked || n.locked ? LOCK_MS : 0 };
}
// The reply for a wrong password: attempts left, or the lock that just started
function wrongReply(fail, what, extra) {
  if (fail.lockMs) return lockedReply(fail.lockMs);
  return json({ error: `Incorrect ${what}. ${fail.left} attempt${fail.left === 1 ? '' : 's'} remaining.`, left: fail.left, ...extra }, 403);
}
async function issueKey(env, farm, rec, role, b) {
  const deviceId = String(b.deviceId || '').slice(0, 80) || randomHex(8);
  const key = randomHex(32);
  await putJson(env, devKey(farm, deviceId), {
    keyHash: await sha256(key), role, gen: role === 'manager' ? rec.mgrGen : 0,
    name: String(b.name || '').trim().slice(0, 60), device: String(b.device || '').slice(0, 80), at: Date.now(), seen: Date.now(),
  });
  return { key, role, deviceId };
}

// Which farm a file belongs to: the shortest leading part of its name ("kiripark1" in
// "kiripark1-feed-2701") that has farm passwords. None → the farm isn't protected yet.
async function resolveFarm(env, fileSlug) {
  if (!env.KEYS || !fileSlug) return { farm: null, rec: null };
  const parts = fileSlug.split('-');
  for (let i = 1; i <= Math.min(parts.length, 6); i++) {
    const farm = parts.slice(0, i).join('-');
    const rec = await getJson(env, farmKey(farm));
    if (rec) return { farm, rec };
  }
  return { farm: null, rec: null };
}

// Who is calling: { role:'manager'|'worker'|'open', deviceId } or { refuse: Response }
async function whoIsCalling(request, env, farm, rec, ctx) {
  if (!env.KEYS || !farm || !rec) return { role: 'open' };
  const deviceId = request.headers.get('X-Farm-Device');
  const key = request.headers.get('X-Farm-Key');
  if (deviceId && key) {
    const dev = await getJson(env, devKey(farm, deviceId));
    const ok = dev && same(dev.keyHash, await sha256(key)) && (dev.role !== 'manager' || dev.gen === rec.mgrGen);
    if (!ok) return { refuse: json({ error: 'This phone was signed out of the farm', signedOut: true }, 401) };
    if (Date.now() - (dev.seen || 0) > SEEN_EVERY_MS) ctx.waitUntil(putJson(env, devKey(farm, deviceId), { ...dev, seen: Date.now() }));
    return { role: dev.role, deviceId, dev, rec };
  }
  if (rec.locked) return { refuse: json({ error: 'This farm needs its password', needKey: true }, 401) };
  return { role: 'open', rec };
}

// Which files a role may use: always only its own farm's files.
function allowed(role, farm, fileSlug, method) {
  if (role === 'open') return true;   // not locked yet: same as before
  const own = fileSlug === farm || fileSlug.startsWith(farm + '-');
  if (!own) return false;
  if (role === 'manager') return true;
  // Workers (Viewer): the task file and the reports file. No feed data, no access list, no backups.
  return (fileSlug === farm || fileSlug === farm + '-reports') && (method === 'GET' || method === 'PUT');
}

// ── Access list file (<farm>-access): keeps CluckWise's Workers screen in step ──
async function updateAccessFile(gh, farm, mutate) {
  for (let i = 0; i < 4; i++) {
    const cur = await gh.read(farm + '-access');
    if (cur.error) return;
    const d = cur.data && typeof cur.data === 'object' ? cur.data : {};
    if (!Array.isArray(d.members)) d.members = [];
    mutate(d);
    const res = await gh.write(farm + '-access', cur.sha || null, d);
    if (!res.conflict) return;
  }
}
const memberKey = n => String(n || '').trim().replace(/\s+/g, ' ').toLowerCase();

// ── AI read-only link ───────────────────────────────────────
//   ai:<farm>   { key, at, tz, by }
const aiKey = farm => `ai:${farm}`;
const validTz = tz => { try { new Intl.DateTimeFormat('en-CA', { timeZone: String(tz) }); return !!tz; } catch (e) { return false; } };
// Today's date where the manager made the link (their device's local time)
function localDay(tz, when = new Date()) {
  const p = {}; new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(when).forEach(x => { p[x.type] = x.value; });
  return `${p.year}-${p.month}-${p.day}`;
}
const localToday = tz => localDay(tz);
// A real moment (a report made, a job ticked) as the day it was where the manager is
const stampDay = (v, tz) => { if (!v) return null; const d = new Date(v); return isNaN(d) ? null : localDay(tz, d); };
// A calendar day from the apps: 'YYYY-MM-DD', or a timestamp saved as a device's local midnight
// (after 12:00 UTC that is the next day, east of UTC) or as 12:00 UTC. Same rule as ProdWise's calDate.
function day(v) {
  if (!v) return null;
  const s = String(v);
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); if (m) return s;
  m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s);
  if (!m) return null;
  const h = +m[4], mi = +m[5], d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + (/Z$|[+-]00:?00$/.test(s) && (h > 12 || (h === 12 && mi > 0)) ? 1 : 0)));
  return d.toISOString().slice(0, 10);
}
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);
const addDays = (a, n) => new Date(Date.parse(a + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const num = v => (v == null || v === '' || !Number.isFinite(Number(v))) ? null : Number(v);
const siloKg = r => r == null || r === '' || !Number.isFinite(Number(r)) || Number(r) < 0 ? null : 10000 + 8000 * Math.min(5, Math.floor(Number(r)));   // same as the app: cone 10 t + 8 t a ring
const ABOUT = 'Read-only copy of the farm from ProdWise (production) and Tasks. Dates are calendar days (YYYY-MM-DD) in the manager\'s local time; "today" is that day. '
  + 'Weights in kg, feed in kg (1,000 kg = 1 t), birds are counts. Sheds come in pairs (Sheds 1-2 = pair 1, 3-4 = pair 2 …); each pair has 3 silos. '
  + 'A silo reading counts rings: 0 = cone only (about 10 t), each ring adds about 8 t, 5 rings = full (about 50 t). birdsNow = placed - morts - birds picked up so far. '
  + 'Past batch results are in "batchResults" (same names and formulas as ProdWise: ALW = total live weight ÷ birds out, FCR = feed ÷ live weight). '
  + 'In the raw farm history (full link), finalAvgKg is ONLY the final pickup\'s average weight (the last, heaviest birds), not the batch ALW. '
  + 'This link never changes anything. Add &full=1 for every file in full.';
// One past batch's result, worked out like ProdWise's Farm history (batchKpis in js/calc.js)
const CFCR_REF_KG = 2.45, CFCR_BETA = 0.27;
const r2 = (v, d) => v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d;
function batchResult(h) {
  const placed = num(h.placed) || 0, out = num(h.picked) || 0, lw = num(h.liveWeightKg) || 0, feed = num(h.feedKg) || 0, age = num(h.avgAge) || 0;
  const alw = out > 0 && lw > 0 ? lw / out : null, fcr = lw > 0 && feed > 0 ? feed / lw : null;
  const liv = placed > 0 ? out / placed * 100 : null;
  return {
    batch: h.batch, endDate: h.endDate || null, finished: !!h.finished || undefined,
    birdsPlaced: placed, birdsOut: out, livabilityPct: r2(liv, 2), mortalityPct: liv == null ? null : r2(100 - liv, 2),
    totalLiveWeightKg: r2(lw, 0), ALW_kg: r2(alw, 3), feedEatenKg: r2(feed, 0), FCR: r2(fcr, 3),
    cFCR_2_45: fcr && alw ? r2(fcr - (alw - CFCR_REF_KG) * CFCR_BETA, 3) : null,
    avgAgeAtPickupDays: r2(age, 1), PIF: liv && alw && age && fcr ? r2(liv * alw / (age * fcr) * 100, 0) : null,
    firstThinAgeDays: num(h.firstThinAge), firstThinSharePct: h.firstThinShare != null ? r2(h.firstThinShare * 100, 1) : null,
    finalPickupAgeDays: num(h.finalAge), finalPickupAvgKg: r2(num(h.finalAvgKg), 3), finalPickupSharePct: h.finalShare != null ? r2(h.finalShare * 100, 1) : null,
    pickupsPerShed: num(h.pickupsPerShed), feedLeftoverKg: num(h.leftoverKg), feedIntakePctOfRoss: num(h.intakePct),
  };
}

async function handleExport(url, env, gh) {
  if (!env.KEYS) return json({ error: 'Not available on this sync server' }, 501);
  const farm = slugify(url.searchParams.get('export'));
  const key = String(url.searchParams.get('key') || '');
  const link = farm && key ? await getJson(env, aiKey(farm)) : null;
  if (!link || !same(link.key, key)) return json({ error: 'This link is turned off or not right. Make a new one in ProdWise › Settings › Sync & cloud.' }, 403);
  const tz = validTz(link.tz) ? link.tz : 'UTC', today = localToday(tz);
  const listed = await gh.list(`${farm}-feed`);
  const pre = `${farm}-feed-`;
  const batches = (listed.files || []).map(f => f.name.replace(/\.json$/, '')).filter(n => n.startsWith(pre) && !n.endsWith('-file')).map(n => n.slice(pre.length))
    .sort((a, b) => (parseFloat(b) - parseFloat(a)) || b.localeCompare(a));
  const current = batches[0] || null;
  const head = { farm, kind: url.searchParams.get('full') === '1' ? 'full' : 'summary', generatedAt: new Date().toISOString(), today, timeZone: tz, about: ABOUT, currentBatch: current, batches };
  const noStore = { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };

  if (head.kind === 'full') {
    // Files go out exactly as saved (not parsed here: big files stay cheap)
    const keep = batches.slice(0, 6);
    const [hist, tasks, reports, ...bt] = await Promise.all([gh.readRaw(`${farm}-prodwise-history`), gh.readRaw(farm), gh.readRaw(`${farm}-reports`), ...keep.map(b => gh.readRaw(pre + b))]);
    const raw = r => r && r.text ? r.text : 'null';
    const body = JSON.stringify(head).slice(0, -1)
      + `,"batchFiles":{${keep.map((b, i) => `${JSON.stringify(b)}:${raw(bt[i])}`).join(',')}}`
      + `,"farmHistory":${raw(hist)},"tasks":${raw(tasks)},"reports":${raw(reports)}}`;
    return new Response(body, { headers: noStore });
  }

  // raw text + one parse: cheaper than the base64 copy (Cloudflare limits the worker's CPU time)
  const asData = r => { try { return r && r.text ? { data: JSON.parse(r.text) } : null; } catch (e) { return null; } };
  const [feedR, histR, tasksR, repR] = (await Promise.all([current ? gh.readRaw(pre + current) : null, gh.readRaw(`${farm}-prodwise-history`), gh.readRaw(farm), gh.readRaw(`${farm}-reports`)])).map(asData);
  const feed = feedR && feedR.data || {}, fd = feed.farmData || {}, pred = feed.predictions || {};
  const sheds = (fd.sheds || []).map(s => {
    const placement = day(s.placementDate), placed = num(s.initialPopulation) || 0, morts = num(s.mortality) || 0;
    const done = (s.pickups || []).map(p => ({ date: day(p.date), birds: num(p.birds) || 0, final: !!p.isFinal, avgKg: num(p.totalWeightKg) && num(p.birds) ? Math.round(p.totalWeightKg / p.birds * 1000) / 1000 : null })).filter(p => p.date).sort((a, b) => a.date < b.date ? -1 : 1);
    const picked = done.filter(p => p.date <= today).reduce((a, p) => a + p.birds, 0);
    const closed = s.closed && s.closed.date ? day(s.closed.date) : null;
    return {
      shed: s.id, pair: Math.ceil(Number(s.id) / 2), placement, ageDays: placement && placement <= today ? daysBetween(placement, today) : null,
      daysToPlacement: placement && placement > today ? daysBetween(today, placement) : null,
      cleanout: day(s.cleanoutDate), closed, birdsPlaced: placed, morts, mortsUpdated: day(s.mortalityUpdatedAt), birdsPickedUp: picked,
      birdsNow: placement && !closed ? Math.max(0, placed - morts - picked) : 0,
      dailyMortPct: num(s.mortalityRatePercent), chickWeightKg: num(s.chickWeightKg), feedIntakePct: num(s.feedAdjustPct),
      weighIns: (s.inYardSamples || []).map(x => ({ date: day(x.date), avgKg: num(x.avgWeightKg), birds: num(x.birds) || null, official: !!x.isOfficial })).filter(x => x.date).sort((a, b) => a.date < b.date ? -1 : 1).slice(-8),
      pickups: done, plannedPickups: (s.predictedPickups || []).map(p => ({ date: day(p.date), birds: num(p.birds) || 0, final: !!p.isFinal })).filter(p => p.date && p.date > today),
    };
  });
  const silos = {};
  Object.entries(feed.siloData || {}).forEach(([pair, v]) => {
    silos[pair] = (v && v.readings || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(-10).map(x => {
      const kg = [x.silo1Rings, x.silo2Rings, x.silo3Rings].map(siloKg);
      return { date: x.date, time: x.time || null, rings: [x.silo1Rings, x.silo2Rings, x.silo3Rings], kg, totalKg: kg.some(k => k != null) ? kg.reduce((a, k) => a + (k || 0), 0) : null, open: x.open || null };
    });
  });
  const loads = (feed.farmLoads || []).map(l => ({ date: l.date, feed: l.feedType || null, plannedKg: num(l.plannedKg), actualKg: num(l.actualKg), received: typeof l.received === 'boolean' ? l.received : null, kgPerPair: l.splitKg || null, docket: l.docket || null }))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const settings = {};
  ['safetyDays', 'feedWarnDays', 'deliveryTiming', 'starterSilo', 'carryoverKg', 'carryoverFarmKg', 'feedQuota', 'targetHarvestWeightKg', 'noPickupDays', 'truckSplitMode'].forEach(k => { if (pred[k] !== undefined) settings[k] = pred[k]; });

  const T = tasksR && tasksR.data || {};
  const tl = Array.isArray(T.tasks) ? T.tasks : [];
  const brief = t => ({ name: t.name, date: t.date || null, status: t.status || 'open', assignees: t.assignees && t.assignees.length ? t.assignees : undefined, shed: t.shedNum || (t.prep && t.prep.shed) || undefined,
    steps: Array.isArray(t.subs) && t.subs.length ? `${t.subs.filter(x => x.done).length}/${t.subs.length}` : undefined, doneBy: t.doneBy || undefined, notes: t.notes || undefined });
  const open = tl.filter(t => t.status !== 'done');
  const soon = addDays(today, 14), weekAgo = addDays(today, -7);
  const prep = (Array.isArray(T.shedPrep) ? T.shedPrep : []).filter(c => !c.archived && !c.isTpl && (c.status !== 'ready' || (c.nextPlacement && c.nextPlacement >= weekAgo))).map(c => {
    let n = 0, d = 0; (c.sections || []).forEach(sec => (sec.items || []).forEach(it => { n++; if (it.done) d++; }));
    return { shed: c.shed, batch: c.batch || null, status: c.status || null, closedAt: day(c.closedAt), chicksIn: c.nextPlacement || null, jobsDone: d, jobs: n };
  });
  const reports = (repR && repR.data && Array.isArray(repR.data.reports) ? repR.data.reports : []);
  const out = {
    ...head,
    batch: current ? { number: current, sheds, birdsNow: sheds.reduce((a, s) => a + s.birdsNow, 0), feed: { loads, siloReadings: silos, settings } } : null,
    batchResults: ((histR && histR.data && histR.data.farmHistory) || pred.farmHistory || []).map(batchResult).sort((a, b) => String(b.endDate || '').localeCompare(String(a.endDate || ''))),
    tasks: {
      overdue: open.filter(t => t.date && t.date < today).map(brief),
      today: open.filter(t => t.date === today).map(brief),
      next14Days: open.filter(t => t.date && t.date > today && t.date <= soon).map(brief),
      doneLast7Days: tl.filter(t => t.status === 'done' && t.date && t.date >= weekAgo && t.date <= today).map(brief),
      openWithoutDate: open.filter(t => !t.date).map(brief),
    },
    routines: (Array.isArray(T.maintenance) ? T.maintenance : []).map(m => ({ name: m.name, shed: m.shed || null, category: m.category || null, every: m.every || null, pausedUntil: m.resumeOn && m.resumeOn > today ? m.resumeOn : undefined })),
    shedPrep: prep,
    maintenanceReports: {
      open: reports.filter(x => x.status !== 'Resolved').map(x => ({ code: x.code || null, status: x.status, urgent: !!x.urgent, shed: x.shed || null, location: x.location || null, problem: x.problemType || null, notes: x.notes || null, assignee: x.assignee || null, reported: stampDay(x.createdAt, tz), by: x.createdBy || null })),
      resolvedLast14Days: reports.filter(x => x.status === 'Resolved' && x.resolvedAt && stampDay(x.resolvedAt, tz) >= addDays(today, -14)).length,
    },
  };
  return new Response(JSON.stringify(out, null, 1), { headers: noStore });
}

// ── Actions ─────────────────────────────────────────────────
async function handleAction(action, request, env, ctx, gh) {
  let b;
  try { b = await request.json(); } catch (e) { return json({ error: 'Invalid JSON body' }, 400); }
  const farm = slugify(b.farm);
  if (!farm) return json({ error: 'Missing farm' }, 400);
  // A farm without passwords (or a server without password storage) is open to every phone
  // already, so its manager can organise its files too. The move never changes a file's content.
  if (action === 'manage' && b.op === 'organize' && (!env.KEYS || !(await getJson(env, farmKey(farm))))) {
    const out = await gh.organize(farm);
    return json({ ok: true, moved: out.moved.length, skipped: out.skipped });
  }
  if (!env.KEYS) return json({ error: 'Passwords are not set up on the sync server yet (KEYS storage missing)' }, 501);

  if (action === 'info') {
    // Public: does this farm use passwords yet, is it locked. Nothing else.
    const rec = await getJson(env, farmKey(farm));
    let oldPassword = false;
    if (!rec) { const a = await gh.read(farm + '-access'); oldPassword = !!(a.data && a.data.password && a.data.password.hash); }
    return json({ ok: true, setup: !!rec, locked: !!(rec && rec.locked), oldPassword, single: !!(rec && rec.single) });
  }

  if (action === 'setup') {
    if (await getJson(env, farmKey(farm))) return json({ error: 'This farm already has passwords', exists: true }, 409);
    const fk = failKeys(farm, request, b), wait = await lockLeft(env, fk);
    if (wait) return lockedReply(wait);
    const single = b.password != null;
    const mp = String(single ? b.password : b.managerPassword || ''), fp = String(single ? b.password : b.farmPassword || '');
    if (single && mp.length < 6) return json({ error: 'Farm password: at least 6 characters' }, 400);
    if (!single && (mp.length < 6 || fp.length < 4)) return json({ error: 'Manager password: at least 6 characters. Farm password: at least 4.' }, 400);
    if (!single && mp === fp) return json({ error: 'Use a different manager password from the farm password' }, 400);
    // A password set earlier on CluckWise's Workers screen proves this is the farm's manager.
    const access = await gh.read(farm + '-access');
    const old = access.data && access.data.password;
    if (old && old.hash) {
      const h = await sha256(`${old.salt}|${farm}|${String(b.current || '')}`);
      if (!same(h, old.hash)) return wrongReply(await noteFail(env, fk), 'current password', { wrongCurrent: true });
    }
    ctx.waitUntil(env.KEYS.delete(fk.dev));
    const pw = single ? await makePassword(mp) : null;
    const rec = { farmPw: pw || await makePassword(fp), mgrPw: pw || await makePassword(mp), single, locked: false, mgrGen: 1, setAt: Date.now() };
    await putJson(env, farmKey(farm), rec);
    // The server checks the password from now on: drop the old Workers-screen hash from the access file.
    if (old && old.hash) ctx.waitUntil(updateAccessFile(gh, farm, d => { delete d.password; }));
    return json({ ok: true, ...(await issueKey(env, farm, rec, 'manager', b)) });
  }

  if (action === 'join') {
    const rec = await getJson(env, farmKey(farm));
    if (!rec) return json({ error: 'This farm has no passwords yet', noSetup: true }, 404);
    const fk = failKeys(farm, request, b), wait = await lockLeft(env, fk);
    if (wait) return lockedReply(wait);
    const role = b.role === 'manager' ? 'manager' : 'worker';
    if (!(await checkPassword(role === 'manager' ? rec.mgrPw : rec.farmPw, b.password))) {
      return wrongReply(await noteFail(env, fk), 'password', { wrongPassword: true });
    }
    ctx.waitUntil(env.KEYS.delete(fk.dev));
    const out = await issueKey(env, farm, rec, role, b);
    if (role === 'worker' && String(b.name || '').trim()) {
      // Add the phone to the Workers list the manager sees in CluckWise.
      ctx.waitUntil(updateAccessFile(gh, farm, d => {
        const name = String(b.name).trim().replace(/\s+/g, ' ').slice(0, 60);
        let m = d.members.find(x => memberKey(x.name) === memberKey(name));
        if (!m) { m = { id: randomHex(8), name, joinedAt: Date.now(), devices: [] }; d.members.push(m); }
        if (!Array.isArray(m.devices)) m.devices = [];
        if (!m.devices.some(x => x.id === out.deviceId)) m.devices.push({ id: out.deviceId, device: String(b.device || '').slice(0, 80), joinedAt: Date.now() });
      }));
    }
    return json({ ok: true, ...out });
  }

  // Everything below needs this phone's key.
  const who = await whoIsCalling(request, env, farm, await getJson(env, farmKey(farm)), ctx);
  if (who.refuse) return who.refuse;
  if (!who.deviceId) return json({ error: 'Sign in to the farm first', needKey: true }, 401);

  if (action === 'leave') {
    await env.KEYS.delete(devKey(farm, who.deviceId));
    if (who.role === 'worker') ctx.waitUntil(updateAccessFile(gh, farm, d => {
      d.members.forEach(m => { m.devices = (m.devices || []).filter(x => x.id !== who.deviceId); });
      d.members = d.members.filter(m => m.devices.length);
    }));
    return json({ ok: true });
  }

  if (action !== 'manage') return json({ error: 'Unknown action' }, 400);
  if (who.role !== 'manager') return json({ error: 'Managers only' }, 403);
  const rec = who.rec;

  if (b.op === 'status') {
    const devices = [];
    let cursor;
    do {
      const page = await env.KEYS.list({ prefix: `dev:${farm}:`, cursor });
      for (const k of page.keys) {
        const d = await getJson(env, k.name);
        if (d) devices.push({ deviceId: k.name.slice(`dev:${farm}:`.length), role: d.role, name: d.name, device: d.device, at: d.at, seen: d.seen, current: d.role !== 'manager' || d.gen === rec.mgrGen });
      }
      cursor = page.list_complete ? null : page.cursor;
    } while (cursor);
    return json({ ok: true, locked: !!rec.locked, setAt: rec.setAt, farmPwAt: rec.farmPwAt || rec.setAt, mgrPwAt: rec.mgrPwAt || rec.setAt, devices });
  }

  if (b.op === 'passwords') {
    const next = { ...rec };
    if (b.password != null) {
      if (String(b.password).length < 6) return json({ error: 'Farm password: at least 6 characters' }, 400);
      const pw = await makePassword(b.password);
      next.farmPw = pw; next.mgrPw = pw; next.single = true;
      next.farmPwAt = next.mgrPwAt = Date.now();
      next.mgrGen = (rec.mgrGen || 1) + 1;                                            // other manager devices sign in again; workers stay
    }
    // Two passwords from here on: the manager password must not open the Viewer's door and vice versa.
    if (b.managerPassword != null && await checkPassword(rec.farmPw, b.managerPassword)) return json({ error: 'Use a different manager password from the farm password' }, 400);
    if (b.farmPassword != null && b.managerPassword == null && !rec.single && await checkPassword(rec.mgrPw, b.farmPassword)) return json({ error: 'Use a different farm password from the manager password' }, 400);
    if (b.farmPassword != null) {
      if (String(b.farmPassword).length < 4) return json({ error: 'Farm password: at least 4 characters' }, 400);
      next.farmPw = await makePassword(b.farmPassword); next.farmPwAt = Date.now();   // workers already in stay in
    }
    if (b.managerPassword != null) {
      if (String(b.managerPassword).length < 6) return json({ error: 'Manager password: at least 6 characters' }, 400);
      next.mgrPw = await makePassword(b.managerPassword); next.mgrPwAt = Date.now();
      next.mgrGen = (rec.mgrGen || 1) + 1;                                            // other manager phones sign in again
    }
    if (b.password == null && (b.managerPassword != null || b.farmPassword != null)) next.single = false;
    await putJson(env, farmKey(farm), next);
    if (next.mgrGen !== rec.mgrGen) await putJson(env, devKey(farm, who.deviceId), { ...who.dev, gen: next.mgrGen });
    return json({ ok: true });
  }

  if (b.op === 'revoke') {
    const ids = (Array.isArray(b.deviceIds) ? b.deviceIds : []).map(String).filter(id => id && id !== who.deviceId);
    await Promise.all(ids.map(id => env.KEYS.delete(devKey(farm, id))));
    return json({ ok: true, removed: ids.length });
  }

  if (b.op === 'signoutAll') {
    let cursor, n = 0;
    do {
      const page = await env.KEYS.list({ prefix: `dev:${farm}:`, cursor });
      for (const k of page.keys) if (k.name !== devKey(farm, who.deviceId)) { await env.KEYS.delete(k.name); n++; }
      cursor = page.list_complete ? null : page.cursor;
    } while (cursor);
    return json({ ok: true, removed: n });
  }

  if (b.op === 'organize') {
    const out = await gh.organize(farm);
    return json({ ok: true, moved: out.moved.length, skipped: out.skipped });
  }

  if (b.op === 'aiLink') {
    const k = aiKey(farm);
    if (b.off) { await env.KEYS.delete(k); return json({ ok: true, on: false }); }
    if (b.make) {
      const tz = validTz(b.tz) ? String(b.tz) : 'UTC';
      const link = { key: randomHex(24), at: Date.now(), tz, by: who.deviceId };
      await putJson(env, k, link);
      return json({ ok: true, on: true, key: link.key, at: link.at, tz });
    }
    const cur = await getJson(env, k);
    return json({ ok: true, on: !!cur, key: cur ? cur.key : null, at: cur ? cur.at : null, tz: cur ? cur.tz : null });
  }

  if (b.op === 'lock') {
    await putJson(env, farmKey(farm), { ...rec, locked: !!b.locked });
    return json({ ok: true, locked: !!b.locked });
  }

  return json({ error: 'Unknown op' }, 400);
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (!env.GITHUB_TOKEN) return json({ error: 'Worker is missing GITHUB_TOKEN configuration' }, 500);
    const gh = github(env);
    const url = new URL(request.url);
    try {
      const exp = url.searchParams.get('export');
      if (exp !== null) {
        if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
        return await handleExport(url, env, gh);
      }
      const action = url.searchParams.get('action');
      if (action) {
        if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
        return await handleAction(action, request, env, ctx, gh);
      }

      // Listing (ProdWise batch picker): managers only for a protected farm.
      const prefix = url.searchParams.get('prefix');
      if (prefix !== null) {
        if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
        const { farm, rec } = await resolveFarm(env, slugify(prefix));
        const who = await whoIsCalling(request, env, farm, rec, ctx);
        if (who.refuse) return who.refuse;
        if (who.role === 'worker') return json({ error: 'Managers only' }, 403);
        const out = await gh.list(prefix);
        if (out.error) return json({ error: `GitHub error ${out.error}` }, 502);
        if (env.KEYS && who.role === 'open') {
          // A short prefix must not reveal a protected farm's file names.
          const seen = new Map();
          const keep = [];
          for (const f of out.files) {
            const slug = f.name.replace(/\.json$/, '');
            const head = slug.split('-')[0];
            if (!seen.has(head)) seen.set(head, (await resolveFarm(env, slug)).rec);
            const r = seen.get(head);
            if (!r || !r.locked) keep.push(f);
          }
          out.files = keep;
        }
        return json(out);
      }

      const fileSlug = slugify(url.searchParams.get('farm')) || '';
      if (!fileSlug) return json({ error: 'Missing farm parameter' }, 400);
      const { farm, rec } = await resolveFarm(env, fileSlug);
      const who = await whoIsCalling(request, env, farm, rec, ctx);
      if (who.refuse) return who.refuse;
      if (!allowed(who.role, farm, fileSlug, request.method)) return json({ error: 'Not allowed for this phone' }, 403);

      if (request.method === 'GET') {
        const out = await gh.read(fileSlug);
        if (out.notFound) return json({ notFound: true }, 404);
        if (out.error) return json({ error: `GitHub error ${out.error}` }, 502);
        return json(out);
      }
      if (request.method === 'PUT') {
        let body;
        try { body = await request.json(); } catch (e) { return json({ error: 'Invalid JSON body' }, 400); }
        const out = await gh.write(fileSlug, body.sha, body.data);
        if (out.conflict) return json({ conflict: true }, 409);
        if (out.error) return json({ error: `GitHub error ${out.error}`, detail: out.detail }, 502);
        return json(out);
      }
      return json({ error: 'Method not allowed' }, 405);
    } catch (e) {
      return json({ error: 'Sync server error', detail: String(e && e.message || e) }, 500);
    }
  },
};
