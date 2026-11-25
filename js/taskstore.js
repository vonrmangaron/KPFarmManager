/* The farm's Tasks file (tasks, history, batches, events, settings, templates, maintenance/routine jobs, shed prep),
   held in one place: merging the apps, step 3a (25 Nov 2026).
   ProdWise owns it. The Tasks screens (still inside ProdWise until each one moves in) use ProdWise's copy instead of
   their own, so every screen sees the same data and there is one sync. Opened on its own, Tasks makes its own copy.

   store = TaskStore.get(farmName)
     store.data           what's on screen (normalized; never edit it in place: copy, change, commit)
     store.base           the cloud copy this device last agreed with (for the 3-way merge)
     store.commit(snap, from)   a screen saved a change: keep it on this device, send it to the cloud soon
     store.pull()         read the cloud and merge this device's unsent changes in → { ok, created, needsPush }
     store.run()          send waiting changes now (retries on its own if there's no signal)
     store.flush()        same, without waiting (the app is closing)
     store.loadCache()    this device's own copy (works with no signal) → the saved entry or null
     store.loaded         true once it holds the farm (from this device's copy or the cloud)
     store.on(event, fn)  'change' {from}  'status' {state, pending, inFlight, lastSyncAt}  'saved'  → returns off()
     store.prepareSave    list of functions run on the merged file just before it's saved (e.g. drop duplicate weigh-ins)
   Saving and merging use the shared engine (js/farmsync.js) with Tasks' rules: a deleted task stays deleted,
   this device's order first, history entries matched by id (or time + text for old ones). */
(function(){
  const HISTORY_MAX = 1500;
  const LISTS = ['tasks', 'history', 'batches', 'events', 'frequentTemplates', 'maintenance', 'shedPrep'];
  function normalize(d){
    d = d || {};
    const out = { settings: (d.settings && typeof d.settings === 'object' && !Array.isArray(d.settings)) ? d.settings : {} };
    LISTS.forEach(k=>{ out[k] = Array.isArray(d[k]) ? d[k] : []; });
    return { tasks: out.tasks, history: out.history, batches: out.batches, events: out.events, settings: out.settings, frequentTemplates: out.frequentTemplates, maintenance: out.maintenance, shedPrep: out.shedPrep };
  }
  const EMPTY = ()=> normalize(null);
  const histKey = h=> h.id || `${h.ts}|${h.action}|${h.detail}`;
  const KEYS = { tasks: x=> x.id, history: histKey, batches: b=> b.number, events: x=> x.id, frequentTemplates: x=> x.id, maintenance: x=> x.id, shedPrep: x=> x.id };
  const OPTS = { key: p=> KEYS[p] || null, order:'ours', removeWins:true };
  function merge(base, local, server){
    const m = normalize(FarmSync.clone(FarmSync.merge3(normalize(base), normalize(local), normalize(server), OPTS)));
    m.history = m.history.sort((a, b)=> (b.ts || 0) - (a.ts || 0)).slice(0, HISTORY_MAX);
    return m;
  }
  // One list merged by key (Undo puts back only its own action's changes this way)
  function mergeList(base, local, server, keyFn){
    return FarmSync.clone(FarmSync.merge3(base, local, server, { key: p=> p === '' ? keyFn : null, order:'ours', removeWins:true }));
  }
  const slug = name=> (String(name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'farm');
  const same = (a, b)=> FarmSync.same(a, b), clone = FarmSync.clone;

  function create(farm){
    const cacheKey = 'cw-local-v1-' + slug(farm) + '.json';
    const listeners = { change:[], status:[], saved:[] };
    const s = {
      farm, loaded: false, data: EMPTY(), base: null, sha: null, pending: false, inFlight: false, state: 'idle', lastSyncAt: null,
      prepareSave: [],
      on(ev, fn){ (listeners[ev] = listeners[ev] || []).push(fn); return ()=>{ listeners[ev] = listeners[ev].filter(f=> f !== fn); }; }
    };
    // a listener from a Tasks screen that has since closed or reloaded must not stop the others
    function emit(ev, info){ (listeners[ev] || []).slice().forEach(fn=>{ try{ fn(info || {}); }catch(e){ console.warn('Tasks data listener', e); } }); }
    function status(state){ if(state) s.state = state; emit('status', { state:s.state, pending:s.pending, inFlight:s.inFlight, lastSyncAt:s.lastSyncAt }); }

    s.saveCache = function(){ try{ localStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), pending: !!s.pending, data: s.data, base: s.base })); }catch(e){} };
    s.loadCache = function(){
      let v = null; try{ v = JSON.parse(localStorage.getItem(cacheKey) || 'null'); }catch(e){ v = null; }
      if(!v || !v.data) return null;
      s.data = normalize(v.data); s.base = v.base ? normalize(v.base) : null; s.loaded = true;
      if(v.pending) s.pending = true;
      return v;
    };
    s.commit = function(snap, from){
      s.data = normalize(clone(snap)); s.pending = true; s.saveCache();
      status('syncing'); schedule(); emit('change', { from: from || 'app' });
    };

    // ── sending: wait 2 s for more changes (30 s at most), retry with no signal ──
    let debounce = null, maxWait = null, retry = 0;
    function schedule(){
      s.pending = true; clearTimeout(debounce); debounce = setTimeout(()=> s.run(), 2000);
      if(!maxWait) maxWait = setTimeout(()=> s.run(), 30000);
    }
    s.run = async function(){
      clearTimeout(debounce); debounce = null; clearTimeout(maxWait); maxWait = null;
      if(!s.pending) return true;
      if(s.inFlight){ debounce = setTimeout(()=> s.run(), 2000); return false; }
      s.pending = false; s.inFlight = true; status();
      let ok = false;
      try{ ok = await push(); }catch(e){ console.error('Tasks save failed', e); ok = false; }finally{ s.inFlight = false; }
      if(ok){ retry = 0; if(!s.pending) status('idle'); return true; }
      // keep the changes marked unsent, so coming back online or a refresh sends them instead of a pull losing them
      s.pending = true; s.saveCache(); status('error');
      if(retry < 4){ retry++; debounce = setTimeout(()=> s.run(), 4000 * retry); } else retry = 0;
      return false;
    };
    s.flush = function(){ if(s.pending && !s.inFlight){ s.run(); } };

    async function push(attempt){
      attempt = attempt || 0;
      const server = await FarmSync.get(farm, { fresh:true });
      if(!server.ok){ console.error('Tasks save failed', server.reason); return false; }
      const localAtStart = clone(s.data);
      let merged = server.notFound ? localAtStart : merge(s.base || EMPTY(), localAtStart, server.data);
      s.prepareSave.forEach(fn=>{ try{ merged = fn(merged) || merged; }catch(e){ console.warn('Before save', e); } });
      const res = await FarmSync.put(farm, server.notFound ? null : server.sha, merged);
      if(res.conflict){
        if(attempt < 4){ await new Promise(r=> setTimeout(r, 400 * (attempt + 1))); return push(attempt + 1); }
        console.error('Tasks save: another device kept saving first'); return false;
      }
      if(!res.ok){ console.error('Tasks save failed', res.reason); return false; }
      if(res.sha) s.sha = res.sha;
      s.base = clone(merged);
      // keep changes made while this was being sent, on top of what was just saved
      const current = s.data;
      const next = same(current, localAtStart) ? merged : merge(localAtStart, current, merged);
      if(!same(next, current)){ s.data = normalize(clone(next)); emit('change', { from:'push' }); }
      if(!same(next, merged)) schedule();
      else s.lastSyncAt = Date.now();
      s.saveCache(); emit('saved', {});
      return true;
    }

    // ── reading: merge this device's unsent changes into the cloud copy ──
    let pulling = null;
    s.pull = function(){
      if(pulling) return pulling;
      pulling = (async ()=>{ try{
        const server = await FarmSync.get(farm, { fresh:true });
        if(!server.ok){ status('error'); return { ok:false, reason: server.reason }; }
        if(server.notFound){ s.pending = true; const ok = await s.run(); return { ok, created:true }; }
        s.sha = server.sha; s.loaded = true;
        const cloud = normalize(server.data);
        const merged = s.base ? merge(s.base, s.data, cloud) : cloud;
        s.base = clone(cloud);
        s.data = normalize(clone(merged));
        const needsPush = !same(merged, cloud);
        if(needsPush) schedule();
        else if(!s.pending){ s.lastSyncAt = Date.now(); status('idle'); }
        s.saveCache();
        emit('change', { from:'pull' });
        return { ok:true, needsPush };
      }catch(e){ console.error('Tasks read failed', e); status('error'); return { ok:false, reason: e.message }; }
      finally{ pulling = null; } })();
      return pulling;
    };
    return s;
  }

  const stores = {};
  window.TaskStore = {
    HISTORY_MAX, normalize, merge, mergeList, histKey,
    get(farm){ if(!farm) return null; const k = slug(farm); return stores[k] || (stores[k] = create(farm)); }
  };
})();
