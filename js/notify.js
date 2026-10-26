// Phone notifications — shared by ProdWise, Tasks (CluckWise) and the Crew app (2026-10-26).
//
// The farm-notify worker (workers/farm-notify.js) sends them with Web Push. This file:
//   • turns notifications on/off on this phone (asks permission, subscribes, tells the worker who it is)
//   • notices task changes the manager makes (new / moved / renamed, new people on it) and sends them,
//     grouped: changes made within ~40 s of each other go as one batch, so 6 new tasks = 1 notification each
//   • keeps the worker's list of each person's jobs for the next week up to date ("Your day" + the reminder)
// iPhone: only once the app is on the Home Screen (iOS 16.4+). Android: Chrome, straight away.
(function(){
  const URL_ = 'https://farm-notify.vonrmangaron.workers.dev';
  const PUBLIC_KEY = 'BAEoMBJJ_Wgy55j8R55a5Wvh9nu_DrXIoqrheJr2SZRCEkPpzAr-L8yAyGjf1nL-NAz20OAj3nPRpfzoMOfSCPU';
  const GROUP_MS = 40e3;
  const slug = s => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const nk = n => String(n || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const ls = {
    get(k, d){ try{ const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); }catch(e){ return d; } },
    set(k, v){ try{ if(v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); }catch(e){} },
  };
  const iso = d => { const x = d || new Date(); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  const addDays = (k, n) => { const d = new Date(k + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };

  const ua = () => navigator.userAgent || '';
  const isIOS = () => /iPhone|iPad|iPod/.test(ua()) || (/Macintosh/.test(ua()) && navigator.maxTouchPoints > 1);
  const isAndroid = () => /Android/.test(ua());
  const standalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const device = () => (window.FarmKey && FarmKey.deviceLabel) ? FarmKey.deviceLabel() : (isIOS() ? 'iPhone' : isAndroid() ? 'Android' : 'Browser');
  // This phone's id: the farm sign-in id when there is one (the worker checks it), otherwise our own
  function phoneId(farm, role){
    const k = window.FarmKey && FarmKey.get(farm, role);
    if(k && k.deviceId) return k.deviceId;
    let id = ls.get('farm-notify-id', null);
    if(!id){ id = 'n-' + (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)); ls.set('farm-notify-id', id); }
    return id;
  }
  async function call(action, body, keepalive){
    const res = await fetch(`${URL_}/?action=${action}`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body), keepalive: !!keepalive });
    let j = null; try{ j = await res.json(); }catch(e){}
    if(!res.ok) { const e = new Error((j && j.error) || ('Notify ' + res.status)); e.status = res.status; e.setup = !!(j && j.setup); throw e; }
    return j || {};
  }
  function keyBytes(){
    const s = PUBLIC_KEY.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((PUBLIC_KEY.length + 3) % 4);
    return Uint8Array.from(atob(s), c => c.charCodeAt(0));
  }
  // This page's service worker (never waits for ever: no worker yet = not available)
  async function reg(){
    const r = await navigator.serviceWorker.getRegistration();
    if(r && r.active) return r;
    return Promise.race([navigator.serviceWorker.ready, new Promise((_, no) => setTimeout(() => no(new Error('The app is still installing — try again in a moment')), 6000))]);
  }

  // 'unsupported' | 'install' (iPhone: add to Home Screen first) | 'denied' | 'on' | 'off'
  async function state(){
    if(isIOS() && !standalone()) return 'install';
    if(!supported()) return 'unsupported';
    if(Notification.permission === 'denied') return 'denied';
    try{ const r = await reg(); const s = await r.pushManager.getSubscription(); return s && Notification.permission === 'granted' && ls.get('farm-notify-on', false) ? 'on' : 'off'; }
    catch(e){ return 'off'; }
  }
  // Turn on: must run from a tap (the permission prompt needs one). opts: { farm, name, role }
  async function enable(opts){
    if(!supported()) throw new Error(isIOS() && !standalone() ? 'Add the app to your Home Screen first' : 'This browser can’t show notifications');
    const p = await Notification.requestPermission();
    if(p !== 'granted') throw new Error(p === 'denied' ? 'Notifications are blocked for this app in the phone’s settings' : 'Notifications were not allowed');
    const r = await reg();
    let sub = await r.pushManager.getSubscription();
    if(!sub) sub = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes() });
    let tz = ''; try{ tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; }catch(e){}
    await call('subscribe', { farm: opts.farm, id: phoneId(opts.farm, opts.role), sub: sub.toJSON(), name: opts.name || '', role: opts.role, device: device(), tz });
    ls.set('farm-notify-on', true);
    ls.set('farm-notify-who', { farm: slug(opts.farm), name: opts.name || '', role: opts.role });
  }
  async function disable(opts){
    ls.set('farm-notify-on', null);
    try{ const r = await reg(); const s = await r.pushManager.getSubscription(); if(s) await s.unsubscribe(); }catch(e){}
    await call('unsubscribe', { farm: opts.farm, id: phoneId(opts.farm, opts.role) }).catch(()=>{});
  }
  // The name changed (e.g. the manager set their name): tell the worker, quietly
  async function refresh(opts){
    if(!ls.get('farm-notify-on', false) || !supported() || Notification.permission !== 'granted') return;
    const w = ls.get('farm-notify-who', {}) || {};
    if(w.farm === slug(opts.farm) && w.name === (opts.name || '') && w.role === opts.role) return;
    try{ await enable(opts); }catch(e){}
  }

  // ---------- sending events, grouped ----------
  const QKEY = 'farm-notify-queue';
  let qTimer = null;
  function send(farm, role, events, by){
    if(!farm || !events.length) return;
    const q = ls.get(QKEY, []) || [];
    q.push({ farm: slug(farm), role, by: by || '', events, at: Date.now() });
    ls.set(QKEY, q.slice(-40));
    clearTimeout(qTimer);
    qTimer = setTimeout(flush, events.some(e => e.urgent) ? 0 : GROUP_MS);
  }
  function flush(keepalive){
    clearTimeout(qTimer); qTimer = null;
    const q = ls.get(QKEY, []) || [];
    if(!q.length) return;
    ls.set(QKEY, null);
    const byFarm = new Map();
    q.forEach(x => { const k = x.farm + '|' + x.role; if(!byFarm.has(k)) byFarm.set(k, { farm: x.farm, role: x.role, by: x.by, events: [] }); byFarm.get(k).events.push(...x.events); });
    byFarm.forEach(b => {
      call('notify', { farm: b.farm, id: phoneId(b.farm, b.role), by: b.by, events: b.events.slice(-80) }, keepalive).catch(e => {
        if(e.status === 403 || e.status === 503 || e.status === 400) return;   // signed out / not set up: drop
        const left = ls.get(QKEY, []) || [];   // no signal: try again later
        left.unshift({ farm: b.farm, role: b.role, by: b.by, events: b.events, at: Date.now() });
        ls.set(QKEY, left.slice(-40));
      });
    });
  }
  document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'hidden') flush(true); });
  window.addEventListener('pagehide', () => flush(true));
  window.addEventListener('online', () => setTimeout(() => flush(false), 2000));
  if((ls.get(QKEY, []) || []).length) qTimer = setTimeout(flush, 5000);

  // ---------- task changes (Tasks / CluckWise, the manager's copy) ----------
  // Compare the tasks with the last copy we saw; first call (or after a sync from elsewhere) only remembers.
  const pick = t => ({ d: t.date || null, a: (Array.isArray(t.assignees) ? t.assignees : []).map(String), n: String(t.name || ''), s: t.status || '' });
  let base = null;
  function taskBaseline(tasks){ base = new Map(); (tasks || []).forEach(t => { if(t && t.id) base.set(t.id, pick(t)); }); }
  function taskChanges(tasks){
    if(!base){ taskBaseline(tasks); return []; }
    const today = iso(), out = [];
    (tasks || []).forEach(t => {
      if(!t || !t.id) return;
      const now = pick(t), was = base.get(t.id);
      base.set(t.id, now);
      if(now.s === 'done' || !now.a.length || (now.d && now.d < today)) return;
      const ev = { type:'task', id: t.id, title: now.n, date: now.d };
      if(!was){ out.push({ ...ev, kind:'new', to: now.a }); return; }
      const wasA = new Set(was.a.map(nk)), added = now.a.filter(n => !wasA.has(nk(n))), stay = now.a.filter(n => wasA.has(nk(n)));
      if(added.length) out.push({ ...ev, kind:'new', to: added });
      if(!stay.length) return;
      if(was.d !== now.d) out.push({ ...ev, kind:'moved', to: stay });
      else if(was.n !== now.n) out.push({ ...ev, kind:'changed', to: stay });
    });
    return out;
  }

  // ---------- each person's jobs for the next week ----------
  // tasks: the farm's tasks; show(t) → false for ones the crew never sees
  const DKEY = 'farm-notify-day';
  let dTimer = null;
  function dayDigest(tasks, show){
    const today = iso(), last = addDays(today, 6), days = {};
    const overdue = {};
    (tasks || []).forEach(t => {
      if(!t || !t.date || !Array.isArray(t.assignees) || !t.assignees.length || (show && !show(t))) return;
      if(t.status === 'done'){   // still list the person, so a finished day replaces an older list
        if(t.date >= today && t.date <= last) t.assignees.forEach(n => { const k = nk(n); if(!k) return; const d = days[t.date] = days[t.date] || {}; d[k] = d[k] || { name: String(n).trim(), open: [] }; });
        return;
      }
      if(t.date < today){ if(t.date >= addDays(today, -14)) t.assignees.forEach(n => { overdue[nk(n)] = (overdue[nk(n)] || 0) + 1; }); return; }
      if(t.date > last) return;
      const d = days[t.date] = days[t.date] || {};
      t.assignees.forEach(n => { const k = nk(n); if(!k) return; const p = d[k] = d[k] || { name: String(n).trim(), open: [] }; p.open.push(String(t.name || 'Task')); });
    });
    const td = days[today] = days[today] || {};
    Object.keys(overdue).forEach(k => { (td[k] = td[k] || { name: k.replace(/\b\w/g, c => c.toUpperCase()), open: [] }).overdue = overdue[k]; });
    return days;
  }
  // Send it when it changed (checked a few seconds after the last edit)
  function sendDay(farm, role, tasks, show){
    if(!farm) return;
    clearTimeout(dTimer);
    dTimer = setTimeout(() => {
      const days = dayDigest(tasks(), show), s = JSON.stringify(days), k = DKEY + '-' + slug(farm);
      if(ls.get(k, null) === s) return;
      call('day', { farm, days }).then(() => ls.set(k, s)).catch(() => {});
    }, 8000);
  }

  // ---------- "what's new since I last looked" (Crew app) ----------
  function seenKey(farm){ return 'farm-notify-seen-' + slug(farm); }
  // → Map id → 'new' | 'moved' for my tasks that changed since the snapshot; null the first time
  function changedSince(farm, tasks, me){
    const seen = ls.get(seenKey(farm), null);
    const out = new Map();
    if(!seen) return out;
    (tasks || []).forEach(t => {
      if(!t || !t.id || t.status === 'done' || !(t.assignees || []).some(n => nk(n) === nk(me))) return;
      const was = seen[t.id];
      if(was === undefined) out.set(t.id, 'new');
      else if(was !== (t.date || '')) out.set(t.id, 'moved');
    });
    return out;
  }
  function markSeen(farm, tasks, ids){
    const seen = ls.get(seenKey(farm), null) || {};
    (tasks || []).forEach(t => { if(t && t.id && (!ids || ids.includes(t.id))) seen[t.id] = t.date || ''; });
    if(!ids){ const live = new Set((tasks || []).map(t => t && t.id)); Object.keys(seen).forEach(k => { if(!live.has(k)) delete seen[k]; }); }
    ls.set(seenKey(farm), seen);
  }

  // ---------- manager settings ----------
  const settings = (farm, set) => call('settings', set ? { farm, set } : { farm });
  const phones = farm => call('list', { farm });
  const feedoff = (farm, events) => call('feedoff', { farm, events });
  const test = (farm, target) => call('test', target ? { farm, target } : { farm, id: phoneId(farm, 'manager') });

  window.FarmNotify = { URL: URL_, isIOS, isAndroid, standalone, supported, state, enable, disable, refresh, phoneId,
    hasSeen: farm => ls.get(seenKey(farm), null) != null,
    send, flush, feedoff, taskBaseline, taskChanges, dayDigest, sendDay, changedSince, markSeen, settings, phones, test };
})();
