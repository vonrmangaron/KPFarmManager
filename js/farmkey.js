// Farm passwords — shared by ProdWise, CluckWise and the CluckWise Viewer.
//
// Once the manager turns passwords on (CluckWise → Settings → Workers), the sync
// server only trusts phones that signed in once: the manager password in ProdWise
// and CluckWise, the farm password in the Viewer. The server gives the phone a key,
// kept here and sent with every request to the sync and photo servers.
// Until the manager locks the farm, phones without a key keep working as before.
(function(){
  const STORE = 'farm-keys-v1';
  const slug = s => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const all = () => { try{ return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; }catch(e){ return {}; } };
  function get(farm, role){ const f = all()[slug(farm)]; return (f && f[role]) || null; }
  function set(farm, role, v){
    const a = all(), f = slug(farm);
    if(!f) return;
    a[f] = a[f] || {};
    if(v) a[f][role] = v; else delete a[f][role];
    try{ localStorage.setItem(STORE, JSON.stringify(a)); }catch(e){}
  }
  function newDeviceId(role){
    const r = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
    return (role === 'manager' ? 'm-' : 'w-') + r;
  }
  function deviceLabel(){
    const ua = navigator.userAgent || '';
    if(/iPhone/.test(ua)) return 'iPhone';
    if(/iPad/.test(ua)) return 'iPad';
    if(/Android/.test(ua)) return 'Android';
    if(/Mac/.test(ua)) return 'Mac';
    if(/Windows/.test(ua)) return 'Windows';
    return 'Browser';
  }

  let cfg = null, refusedBusy = false;
  // Adds this phone's key to every request to the farm's servers, and notices when the
  // server refuses the phone (signed out, or the farm is locked and the phone has no key).
  function install(c){
    cfg = c;
    const orig = window.fetch.bind(window);
    window.fetch = async function(input, init){
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      const ours = cfg.urls().some(u => u && url.startsWith(u));
      const k = ours && cfg.farm() ? get(cfg.farm(), cfg.role) : null;
      if(k){
        init = Object.assign({}, init || {});
        const h = new Headers(init.headers || (typeof input !== 'string' && input.headers) || {});
        h.set('X-Farm-Device', k.deviceId); h.set('X-Farm-Key', k.key);
        init.headers = h;
      }
      const res = await orig(input, init);
      if(ours && res.status === 401){
        res.clone().json().then(j => {
          if(!j || !(j.signedOut || j.needKey) || refusedBusy) return;
          if(j.signedOut && cfg.farm()) set(cfg.farm(), cfg.role, null);
          refusedBusy = true;
          Promise.resolve(cfg.onRefused && cfg.onRefused(j)).finally(() => { setTimeout(() => { refusedBusy = false; }, 3000); });
        }).catch(() => {});
      }
      return res;
    };
  }

  // POST ?action=… to the sync server. Returns { status, j } — j is null when the
  // server is the old one (no passwords there yet) or there's no signal.
  async function action(name, body){
    try{
      const res = await fetch(`${cfg.server}/?action=${encodeURIComponent(name)}`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body || {}) });
      let j = null; try{ j = await res.json(); }catch(e){}
      // The old server answers "Missing farm parameter": it doesn't know about passwords.
      if(j && j.error === 'Missing farm parameter') j = null;
      return { status: res.status, j };
    }catch(e){ return { status: 0, j: null }; }
  }
  // { setup, locked, oldPassword } or null (old server / no signal)
  async function info(farm){ const r = await action('info', { farm }); return r.j && r.j.ok ? r.j : null; }

  // Sign this phone in. Returns null when it worked, or the message to show.
  // deviceId: the Viewer passes the id it already joined with, so the Workers list stays one entry per phone.
  async function signIn(farm, password, name, deviceId){
    const role = cfg.role;
    const r = await action('join', { farm, role, password, name: name || '', device: deviceLabel(), deviceId: deviceId || (get(farm, role) || {}).deviceId || newDeviceId(role) });
    if(r.j && r.j.key){ set(farm, role, { key: r.j.key, deviceId: r.j.deviceId, role, at: Date.now() }); return null; }
    return cfg.text(r.j && r.j.wrongPassword ? 'wrong' : r.j && r.j.wait ? 'wait' : r.j && r.j.noSetup ? 'noSetup' : 'offline');
  }

  // A small sign-in box over the app. opts: { title, text, label, button, later, onSubmit(pw) → error|null }
  function prompt(opts){
    injectCss();
    const old = document.getElementById('fkModal'); if(old) old.remove();
    const wrap = document.createElement('div');
    wrap.id = 'fkModal'; wrap.className = 'fk-scrim';
    wrap.innerHTML = `<form class="fk-box" autocomplete="on"><h3 class="fk-title"></h3><p class="fk-text"></p>
      <label class="fk-label"><span></span><input type="password" class="fk-input" autocomplete="current-password"></label>
      <p class="fk-err" role="alert"></p>
      <div class="fk-btns"><button type="button" class="fk-later"></button><button type="submit" class="fk-go"></button></div></form>`;
    wrap.querySelector('.fk-title').textContent = opts.title;
    wrap.querySelector('.fk-text').textContent = opts.text || '';
    wrap.querySelector('.fk-label span').textContent = opts.label;
    wrap.querySelector('.fk-go').textContent = opts.button;
    const later = wrap.querySelector('.fk-later');
    if(opts.later){ later.textContent = opts.later; later.addEventListener('click', () => wrap.remove()); } else later.remove();
    const input = wrap.querySelector('.fk-input'), err = wrap.querySelector('.fk-err'), go = wrap.querySelector('.fk-go');
    wrap.querySelector('form').addEventListener('submit', async e => {
      e.preventDefault();
      if(!input.value){ input.focus(); return; }
      go.disabled = true; err.textContent = '';
      const msg = await opts.onSubmit(input.value);
      go.disabled = false;
      if(msg){ err.textContent = msg; input.select(); return; }
      wrap.remove();
    });
    document.body.appendChild(wrap);
    setTimeout(() => input.focus(), 60);
  }
  let cssDone = false;
  function injectCss(){
    if(cssDone) return; cssDone = true;
    const st = document.createElement('style');
    st.textContent = `
      .fk-scrim{ position:fixed; inset:0; z-index:100000; background:rgba(20,16,10,.55); display:flex; align-items:center; justify-content:center; padding:16px; }
      .fk-box{ width:100%; max-width:380px; background:#fff; color:#2B2116; border-radius:18px; padding:20px; box-shadow:0 18px 50px rgba(0,0,0,.3); display:flex; flex-direction:column; gap:10px; font-family:Inter, system-ui, sans-serif; }
      .fk-title{ margin:0; font:800 19px Sora, Inter, sans-serif; }
      .fk-text{ margin:0; font-size:14.5px; line-height:1.45; color:#6B5B45; }
      .fk-label{ display:flex; flex-direction:column; gap:6px; font-size:13px; font-weight:700; color:#6B5B45; }
      .fk-input{ font:600 16px Inter, sans-serif; padding:12px 14px; border-radius:12px; border:1.5px solid #E2D6C3; background:#FFFCF6; color:inherit; }
      .fk-input:focus{ outline:none; border-color:#E0A339; box-shadow:0 0 0 3px rgba(224,163,57,.25); }
      .fk-err{ margin:0; min-height:1em; font-size:13.5px; font-weight:700; color:#C1502E; }
      .fk-btns{ display:flex; gap:8px; justify-content:flex-end; }
      .fk-btns button{ font:800 15px Sora, Inter, sans-serif; border-radius:12px; padding:11px 16px; cursor:pointer; border:1.5px solid transparent; }
      .fk-go{ background:#2B2116; color:#fff; }
      .fk-go:disabled{ opacity:.6; }
      .fk-later{ background:transparent; color:#6B5B45; border-color:#E2D6C3 !important; }
      body.theme-dark .fk-box{ background:#1E2740; color:#EEF1F8; }
      body.theme-dark .fk-text, body.theme-dark .fk-label, body.theme-dark .fk-later{ color:#AEB8D0; }
      body.theme-dark .fk-input{ background:#151C2F; border-color:#3C4869; }
      body.theme-dark .fk-go{ background:#F5C443; color:#1A1300; }
      body.theme-dark .fk-later{ border-color:#3C4869 !important; }
      body.theme-dark .fk-err{ color:#FF8A6B; }`;
    document.head.appendChild(st);
  }

  window.FarmKey = { slug, get, set, install, action, info, signIn, prompt, deviceLabel, newDeviceId };
})();
