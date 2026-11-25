/* One sync engine for ProdWise and Tasks (merging the apps, step 2, 25 Nov 2026; Crew joins when it moves in).
   - get / put: read and save one farm file on the sync server. A save says which version it's based on (sha);
     if another device saved first, put answers { conflict:true } and the caller merges and tries again.
   - merge3: the 3-way merge every app uses. base = the copy this device and the cloud last agreed on,
     ours = this device now, theirs = the cloud now.
       · a part only one side changed takes that side's version
       · lists of records merge record by record (by id unless the caller names a key)
       · a record one side removed stays removed, unless the other side edited it since
       · the same value changed on both sides: this device's edit wins
   - same / stable / clone: compare and copy saved data (key order doesn't matter).
   Before this, ProdWise and Tasks each had their own copy of all of this, and a fix had to be made twice. */
(function(){
  const SERVER = 'https://prodplan-sync.vonrmangaron.workers.dev', REPO = 'vonrmangaron/farmdata';
  const url = file => `${SERVER}/?farm=${encodeURIComponent(file)}&repo=${encodeURIComponent(REPO)}`;
  const listUrl = prefix => `${SERVER}/?repo=${encodeURIComponent(REPO)}&prefix=${encodeURIComponent(prefix)}`;

  // Read a file. { ok:true, data, sha } · { ok:true, notFound:true } · { ok:false, status, reason }
  async function getUrl(u, opts){
    try{
      const res = await fetch(u, opts && opts.fresh ? { cache:'no-store' } : undefined);
      if(res.status === 404) return { ok:true, notFound:true, data:null, sha:null };
      if(!res.ok) return { ok:false, status:res.status, reason:'http-' + res.status };
      const j = await res.json();
      if(!j || j.notFound) return { ok:true, notFound:true, data:null, sha:null };
      return { ok:true, data:j.data, sha:j.sha || null };
    }catch(e){ return { ok:false, status:0, reason:(e && e.message) || 'network-error' }; }
  }
  // Save a file over version sha (null = a new file). { ok:true, sha } · { ok:false, conflict:true } · { ok:false, status, reason }
  async function putUrl(u, sha, data){
    try{
      const res = await fetch(u, { method:'PUT', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ sha, data }) });
      if(res.status === 409 || res.status === 422) return { ok:false, conflict:true, status:res.status, reason:'conflict' };
      if(!res.ok) return { ok:false, status:res.status, reason:'http-' + res.status };
      const j = await res.json().catch(()=> null);
      return { ok:true, sha:(j && j.sha) || null };
    }catch(e){ return { ok:false, status:0, reason:(e && e.message) || 'network-error' }; }
  }

  function stable(v){
    if(v === undefined) return 'undefined';
    if(v === null || typeof v !== 'object') return JSON.stringify(v);
    if(Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    return '{' + Object.keys(v).filter(k=> v[k] !== undefined).sort().map(k=> JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
  }
  const same = (a, b)=> stable(a) === stable(b);
  const clone = v=> v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  const isObj = v=> v !== null && typeof v === 'object' && !Array.isArray(v);
  // A list's records are matched by id; lists of days (date / d) are matched by day and kept in date order.
  function autoKey(list){
    for(const k of ['id', 'date', 'd']){
      if(list.length && list.every(x=> isObj(x) && x[k] != null && x[k] !== '')){ const f = x=> String(x[k]); f.sorted = k !== 'id' ? k : null; return f; }
    }
    return null;
  }
  // opts.key(path) → a function giving each record's key, for lists that need their own (path: 'tasks', 'farmData.sheds'…)
  // opts.order: 'theirs' (default: the cloud's order, then this device's new records) or 'ours'
  // opts.removeWins: a record removed on this device stays removed even if the other device edited it since
  //   (Tasks' rule: a deleted task doesn't come back). Default: the other device's edit brings it back (Production's rule).
  function merge3(base, ours, theirs, opts, path){
    opts = opts || {}; path = path || '';
    if(same(ours, theirs)) return theirs;
    if(base !== undefined && base !== null){ if(same(ours, base)) return theirs; if(same(theirs, base)) return ours; }
    if(Array.isArray(ours) && Array.isArray(theirs)){
      const b = Array.isArray(base) ? base : [];
      const kf = (opts.key && opts.key(path)) || autoKey([...ours, ...theirs, ...b]);
      if(!kf) return ours;
      const bm = new Map(b.map(x=> [kf(x), x])), om = new Map(ours.map(x=> [kf(x), x])), tm = new Map(theirs.map(x=> [kf(x), x]));
      const first = opts.order === 'ours' ? ours : theirs, second = opts.order === 'ours' ? theirs : ours, fm = opts.order === 'ours' ? om : tm;
      const order = [...first.map(kf), ...second.map(kf).filter(k=> !fm.has(k))], out = [];
      order.forEach(k=>{
        const bb = bm.get(k), o = om.get(k), t = tm.get(k);
        if(o !== undefined && t !== undefined){ out.push(merge3(bb, o, t, opts, path + '[]')); return; }
        if(o !== undefined){ if(bb !== undefined && same(o, bb)) return; out.push(o); return; }   // they removed it (we hadn't changed it)
        if(t !== undefined){ if(bb !== undefined && (opts.removeWins || same(t, bb))) return; out.push(t); }   // we removed it
      });
      if(kf.sorted) out.sort((x, y)=> String(x[kf.sorted]).localeCompare(String(y[kf.sorted])));
      return out;
    }
    if(isObj(ours) && isObj(theirs)){
      const b = isObj(base) ? base : {}, out = {};
      new Set([...Object.keys(ours), ...Object.keys(theirs)]).forEach(k=>{
        const inO = k in ours, inT = k in theirs, p = path ? path + '.' + k : k;
        if(inO && inT){ out[k] = merge3(b[k], ours[k], theirs[k], opts, p); return; }
        if(inO){ if(k in b && same(ours[k], b[k])) return; out[k] = ours[k]; return; }
        if(k in b && same(theirs[k], b[k])) return; out[k] = theirs[k];
      });
      return out;
    }
    return ours;   // the same value changed on both devices: this device's edit wins
  }

  window.FarmSync = {
    SERVER, REPO, url, listUrl, getUrl, putUrl,
    get: (file, opts)=> getUrl(url(file), opts),
    put: (file, sha, data)=> putUrl(url(file), sha, data),
    merge3, stable, same, clone
  };
})();
