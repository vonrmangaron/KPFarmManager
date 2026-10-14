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
// Farm passwords (POST ?action=…, JSON body):
//   info    { farm } → { setup, locked, oldPassword }   (public)
//   setup   { farm, managerPassword, farmPassword, current?, deviceId, name, device }
//           first time only. If the farm already has a password from the CluckWise
//           Workers screen, `current` must be that password.
//   join    { farm, role:'manager'|'worker', password, deviceId, name, device } → { key, role }
//   leave   (with key) this phone signs itself out
//   manage  (manager key) { op:'status' | 'passwords' | 'revoke' | 'signoutAll' | 'lock' | 'organize', … }
//
// A phone sends X-Farm-Device and X-Farm-Key with every request. The farm is always
// worked out here from the file name (never taken from the phone).
//   - A wrong or removed key is always refused (401 { signedOut:true }).
//   - Without a key: allowed until the manager locks the farm, then 401 { needKey:true }.
//   - Workers (Viewer) can only read and write the farm's task file and its reports.
//   - Managers can use every file of their own farm. No key ever reaches another farm.

const DEFAULT_REPO = 'vonrmangaron/farmdata';
const PBKDF2_ITERATIONS = 20000;
const MAX_FAILS = 10;              // wrong passwords per farm…
const FAIL_WINDOW_MS = 15 * 60e3;  // …within 15 minutes, then wait
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
//   fail:<farm>              { n, since }
const farmKey = farm => `farm:${farm}`;
const devKey = (farm, id) => `dev:${farm}:${id}`;
const getJson = async (env, k) => { const v = await env.KEYS.get(k); return v ? JSON.parse(v) : null; };
const putJson = (env, k, v) => env.KEYS.put(k, JSON.stringify(v));

async function tooManyFails(env, farm) {
  const f = await getJson(env, `fail:${farm}`);
  return !!f && f.n >= MAX_FAILS && Date.now() - f.since < FAIL_WINDOW_MS;
}
async function noteFail(env, farm) {
  const f = await getJson(env, `fail:${farm}`);
  const fresh = !f || Date.now() - f.since >= FAIL_WINDOW_MS;
  await env.KEYS.put(`fail:${farm}`, JSON.stringify({ n: fresh ? 1 : f.n + 1, since: fresh ? Date.now() : f.since }), { expirationTtl: 3600 });
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
    return json({ ok: true, setup: !!rec, locked: !!(rec && rec.locked), oldPassword });
  }

  if (action === 'setup') {
    if (await getJson(env, farmKey(farm))) return json({ error: 'This farm already has passwords', exists: true }, 409);
    if (await tooManyFails(env, farm)) return json({ error: 'Too many tries. Wait 15 minutes.', wait: true }, 429);
    const mp = String(b.managerPassword || ''), fp = String(b.farmPassword || '');
    if (mp.length < 6 || fp.length < 4) return json({ error: 'Manager password: at least 6 characters. Farm password: at least 4.' }, 400);
    if (mp === fp) return json({ error: 'Use a different manager password from the farm password' }, 400);
    // A password set earlier on CluckWise's Workers screen proves this is the farm's manager.
    const access = await gh.read(farm + '-access');
    const old = access.data && access.data.password;
    if (old && old.hash) {
      const h = await sha256(`${old.salt}|${farm}|${String(b.current || '')}`);
      if (!same(h, old.hash)) { await noteFail(env, farm); return json({ error: 'The current farm password is not right', wrongCurrent: true }, 403); }
    }
    const rec = { farmPw: await makePassword(fp), mgrPw: await makePassword(mp), locked: false, mgrGen: 1, setAt: Date.now() };
    await putJson(env, farmKey(farm), rec);
    return json({ ok: true, ...(await issueKey(env, farm, rec, 'manager', b)) });
  }

  if (action === 'join') {
    const rec = await getJson(env, farmKey(farm));
    if (!rec) return json({ error: 'This farm has no passwords yet', noSetup: true }, 404);
    if (await tooManyFails(env, farm)) return json({ error: 'Too many tries. Wait 15 minutes.', wait: true }, 429);
    const role = b.role === 'manager' ? 'manager' : 'worker';
    if (!(await checkPassword(role === 'manager' ? rec.mgrPw : rec.farmPw, b.password))) {
      await noteFail(env, farm);
      return json({ error: 'That password is not right', wrongPassword: true }, 403);
    }
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
    if (b.farmPassword != null) {
      if (String(b.farmPassword).length < 4) return json({ error: 'Farm password: at least 4 characters' }, 400);
      next.farmPw = await makePassword(b.farmPassword); next.farmPwAt = Date.now();   // workers already in stay in
    }
    if (b.managerPassword != null) {
      if (String(b.managerPassword).length < 6) return json({ error: 'Manager password: at least 6 characters' }, 400);
      next.mgrPw = await makePassword(b.managerPassword); next.mgrPwAt = Date.now();
      next.mgrGen = (rec.mgrGen || 1) + 1;                                            // other manager phones sign in again
    }
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
