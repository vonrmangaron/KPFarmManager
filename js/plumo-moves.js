// Plumo's moves (2026-11-01): the anime flight and the Kawarimi (substitution) teleport.
//   PlumoFX.playFly(opts)       — crouch → burst → cruise → dash → land (the hero's trip to the shed and back)
//   PlumoFX.playKawarimi(opts)  — flash → poof (a log drops where he stood) → smoke implodes → he pops in elsewhere
//   PLUMO_FX                    — every duration, count, colour and easing in one place
// One clock drives it all: particles are worked out from their start (not stepped), and every Web Animation is paused
// and given its time each frame — so a move can be slowed, paused, scrubbed (the demo page) and cancelled cleanly.
// Only transform and opacity move; particles are drawn on a canvas; the log is a small SVG. No images.
// A new move on the same Plumo cancels the one running. Reduced motion: a plain fade, no particles.
(function(){
  const PLUMO_FX = window.PLUMO_FX = {
    speed: 1,                                   // 1 = real time (the demo page slows it down)
    reducedMotion: null,                        // null = follow the device; true/false forces it (the demo page)
    ease: { back:'cubic-bezier(.34,1.56,.64,1)', out:'cubic-bezier(.22,1,.36,1)', inOut:'cubic-bezier(.65,0,.35,1)', in:'cubic-bezier(.55,0,1,.45)' },
    fly: { total:6800, anticipation:180, burstEnd:400, cruiseEnd:2000, dashEnd:3100, circleEnd:4100, returnEnd:6100, touchdown:6350,
           afterimageEvery:140, dashAfterimageEvery:50, afterimageLife:200, speedLineEvery:60, sparkleEvery:90,
           windCount:10, dustCount:18, endScale:.24 },
    kawarimi: { flash:90, hideAt:40, poofAt:60, logAt:80, implodeAt:260, popAt:420, popDur:180, afterimage:100,
                logHold:1200, logFade:260, total:1900, smokeCount:12, debrisCount:9, chipCount:10, leafCount:5 },
    colors: { dust:'255,248,232', smoke:'240,242,247', smokeShade:'190,197,210', debris:'255,214,120', speed:'255,255,255',
              spark:'255,246,200', wood:'#A8723F', bark:'#5E3D22', grain:'#D9AE76', leaves:['#6DBE5A','#9AD27A','#E8C24A'] }
  };
  const C = PLUMO_FX.colors;
  const RM = ()=> typeof PLUMO_FX.reducedMotion === 'boolean' ? PLUMO_FX.reducedMotion : !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const clamp = (v, a, b)=> Math.max(a, Math.min(b, v));
  const smooth = p=> p * p * (3 - 2 * p);
  const outCubic = p=> 1 - Math.pow(1 - p, 3);
  const backOut = p=>{ const c = 1.70158; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };
  function seeded(seed){ let s = seed >>> 0 || 1; return ()=>{ s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // ── the clock ──
  let T = 0, last = 0, raf = 0, paused = false;
  const runs = new Set(), layers = new Map();
  function loop(now){
    raf = 0;
    const dt = last ? Math.min(64, now - last) : 16; last = now;
    if(!paused) T += dt * PLUMO_FX.speed;
    step();
    if(runs.size || [...layers.values()].some(L=> L.parts.length)) raf = requestAnimationFrame(loop); else last = 0;
  }
  function wake(){ if(!raf) raf = requestAnimationFrame(loop); }
  function step(){
    runs.forEach(r=>{
      const el = T - r.start;
      while(r.i < r.events.length && r.events[r.i].t <= el){ const e = r.events[r.i++]; try{ e.fn(r.start + e.t); }catch(err){ console.warn('PlumoFX', err); } }
      r.anims.forEach(x=>{ const ct = el - x.at; try{ x.a.currentTime = ct < 0 ? -1 : Math.min(ct, x.d); }catch(e){} });
      if(el >= r.end) finish(r);
    });
    layers.forEach(drawLayer);
  }

  // ── layers: a canvas for particles (+ room for the log, clones and the flyer), inside the host or over the page ──
  function layerFor(host){
    const key = host || document.body;
    let L = layers.get(key);
    if(L && L.el.isConnected) return L;
    const el = document.createElement('div'); el.className = 'pfx-layer' + (host ? '' : ' pfx-fixed'); el.setAttribute('aria-hidden', 'true');
    const cv = document.createElement('canvas'); el.appendChild(cv); key.appendChild(el);
    L = { el, cv, ctx: cv.getContext('2d'), parts: [], key }; layers.set(key, L); return L;
  }
  function rel(L, r){ const b = L.el.getBoundingClientRect(); return { x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height }; }
  function drawLayer(L){
    if(!L.el.isConnected){ layers.delete(L.key); return; }
    const w = L.el.clientWidth, h = L.el.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
    if(L.cv.width !== Math.round(w * dpr) || L.cv.height !== Math.round(h * dpr)){ L.cv.width = Math.round(w * dpr); L.cv.height = Math.round(h * dpr); }
    const g = L.ctx; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    L.parts = L.parts.filter(P=>{
      const age = T - P.born;
      if(age > P.life){ if(P.el) P.el.remove(); return false; }
      if(age < 0){ if(P.el) P.el.style.opacity = 0; return true; }
      const p = age / P.life, s = age / 1000;
      if(P.el){ const q = P.pose(age, p); P.el.style.transform = `translate(${q.x}px,${q.y}px) rotate(${q.r || 0}deg) scale(${q.sx ?? 1},${q.sy ?? 1})`; P.el.style.opacity = q.o ?? 1; return true; }
      DRAW[P.k](g, P, p, s);
      return true;
    });
  }
  const pos = (P, s)=>{ const k = P.drag || 0, f = k ? (1 - Math.exp(-k * s)) / k : s; return { x: P.x + P.vx * f + (P.sway ? Math.sin(s * P.sw + P.ph) * P.sway : 0), y: P.y + P.vy * f + .5 * (P.g || 0) * s * s }; };
  const DRAW = {
    dust(g, P, p, s){ const q = pos(P, s), r = P.size * (.5 + 1.2 * outCubic(p)), a = Math.pow(1 - p, 1.6) * (P.a || .85);
      const gr = g.createRadialGradient(q.x, q.y, 0, q.x, q.y, r); gr.addColorStop(0, `rgba(${C.dust},${a})`); gr.addColorStop(1, `rgba(${C.dust},0)`);
      g.fillStyle = gr; g.beginPath(); g.ellipse(q.x, q.y, r, r * (P.flat || 1), 0, 0, 7); g.fill(); },
    ring(g, P, p){ const r = P.r0 + (P.r1 - P.r0) * outCubic(p); g.strokeStyle = `rgba(${P.rgb || '255,255,255'},${(1 - p) * .9})`; g.lineWidth = P.w * (1 - p) + .5;
      g.beginPath(); g.ellipse(P.x, P.y, r, r * (P.flat || 1), 0, 0, 7); g.stroke(); },
    streak(g, P, p){ const k = smooth(p), x = P.x + (P.tx - P.x) * k, y = P.y + (P.ty - P.y) * k, len = P.len * (1 - p);
      const ang = Math.atan2(P.ty - P.y, P.tx - P.x); g.strokeStyle = `rgba(255,255,255,${.85 * Math.sin(Math.PI * p)})`; g.lineWidth = 2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, y); g.lineTo(x - Math.cos(ang) * len, y - Math.sin(ang) * len); g.stroke(); },
    speed(g, P, p){ const r1 = P.r + 60 * p, r2 = r1 + P.len; g.strokeStyle = `rgba(${C.speed},${(1 - p) * .85})`; g.lineWidth = P.w * (1 - p * .6); g.lineCap = 'round';
      g.beginPath(); g.moveTo(P.x + Math.cos(P.a) * r1, P.y + Math.sin(P.a) * r1); g.lineTo(P.x + Math.cos(P.a) * r2, P.y + Math.sin(P.a) * r2); g.stroke(); },
    smoke(g, P, p, s){ const q = pos(P, s), r = P.size * (.45 + .9 * outCubic(p)), a = Math.pow(1 - p, 1.3) * .95;
      P.lobes.forEach(([dx, dy, k], i)=>{ const x = q.x + dx * r, y = q.y + dy * r, rr = r * k;
        const gr = g.createRadialGradient(x - rr * .3, y - rr * .35, rr * .1, x, y, rr); gr.addColorStop(0, `rgba(${C.smoke},${a})`); gr.addColorStop(.7, `rgba(${C.smokeShade},${a * .8})`); gr.addColorStop(1, `rgba(${C.smokeShade},0)`);
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill(); }); },
    implode(g, P, p){ const k = smooth(p), r = P.R * (1 - k), x = P.x + Math.cos(P.a) * r, y = P.y + Math.sin(P.a) * r, rr = P.size * (1 - k * .6), a = Math.sin(Math.PI * p) * .9;
      const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, `rgba(${C.smoke},${a})`); gr.addColorStop(1, `rgba(${C.smokeShade},0)`); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill(); },
    debris(g, P, p, s){ const q = pos(P, s), a = 1 - p; g.fillStyle = `rgba(${C.debris},${a})`; g.shadowColor = `rgba(${C.debris},${a})`; g.shadowBlur = 8;
      g.beginPath(); g.arc(q.x, q.y, P.size * (1 - p * .5), 0, 7); g.fill(); g.shadowBlur = 0; },
    spark(g, P, p, s){ const q = pos(P, s), r = P.size * (1 - p * .8), a = 1 - p; g.save(); g.translate(q.x, q.y); g.rotate(p * 2.4); g.fillStyle = `rgba(${C.spark},${a})`;
      g.shadowColor = `rgba(${C.spark},${a})`; g.shadowBlur = 6; g.beginPath(); for(let i = 0; i < 8; i++){ const rr = i % 2 ? r * .35 : r, an = i * Math.PI / 4; g.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } g.fill(); g.restore(); },
    chip(g, P, p, s){ const q = pos(P, s); g.save(); g.translate(q.x, q.y); g.rotate(P.rot + P.vr * s); g.globalAlpha = 1 - Math.pow(p, 3);
      g.fillStyle = P.c; g.fillRect(-P.size, -P.size * .45, P.size * 2, P.size * .9); g.fillStyle = C.bark; g.fillRect(-P.size, -P.size * .45, P.size * 2, P.size * .25); g.restore(); },
    leaf(g, P, p, s){ const q = pos(P, s); g.save(); g.translate(q.x, q.y); g.rotate(P.rot + Math.sin(s * 5 + P.ph) * .9); g.globalAlpha = 1 - Math.pow(p, 2.4);
      g.fillStyle = P.c; g.beginPath(); g.ellipse(0, 0, P.size, P.size * .45, 0, 0, 7); g.fill(); g.restore(); }
  };

  // ── runs ──
  function newRun(owner, end, seed){
    if(owner && owner.__pfxRun) cancel(owner.__pfxRun);
    const r = { start: T, end, events: [], i: 0, anims: [], els: [], parts: [], owner, rnd: seeded(seed || (Math.random() * 1e9) | 0), onEnd: null, restore: null };
    r.at = (t, fn)=>{ r.events.push({ t, fn }); r.events.sort((a, b)=> a.t - b.t); return r; };
    r.anim = (el, kf, o)=>{ if(!el) return; const a = el.animate(kf, { duration: o.duration, easing: o.easing || 'linear', fill: 'forwards', composite: 'replace' }); a.pause(); a.currentTime = -1; r.anims.push({ a, at: o.at || 0, d: o.duration }); return a; };
    r.part = (L, P)=>{ P.run = r; L.parts.push(P); r.parts.push([L, P]); return P; };
    if(owner) owner.__pfxRun = r;
    runs.add(r); wake(); return r;
  }
  function finish(r){ runs.delete(r); r.anims.forEach(x=>{ try{ x.a.cancel(); }catch(e){} }); r.els.forEach(e=> e.remove()); if(r.owner && r.owner.__pfxRun === r) r.owner.__pfxRun = null;
    try{ r.restore && r.restore(true); }catch(e){} try{ r.onEnd && r.onEnd(); }catch(e){} }
  function cancel(r){ if(!r || !runs.has(r)) return; runs.delete(r); r.anims.forEach(x=>{ try{ x.a.cancel(); }catch(e){} }); r.els.forEach(e=> e.remove());
    r.parts.forEach(([L, P])=>{ const i = L.parts.indexOf(P); if(i >= 0) L.parts.splice(i, 1); if(P.el) P.el.remove(); });
    if(r.owner && r.owner.__pfxRun === r) r.owner.__pfxRun = null; try{ r.restore && r.restore(false); }catch(e){} }
  function cancelAll(){ [...runs].forEach(cancel); layers.forEach(L=>{ L.parts.forEach(P=> P.el && P.el.remove()); L.parts = []; }); }

  // ── particle helpers ──
  function dustRing(r, L, x, y, at, w, n){ for(let i = 0; i < n; i++){ const a = (i / n) * Math.PI * 2 + r.rnd() * .3, sp = 140 + r.rnd() * 160;
      r.part(L, { k:'dust', born: at + r.rnd() * 30, life: 520 + r.rnd() * 260, x, y, vx: Math.cos(a) * sp * 1.6, vy: Math.sin(a) * sp * .35 - 20, drag: 5, size: w * (.1 + r.rnd() * .08), flat: .55 }); }
    r.part(L, { k:'ring', born: at, life: 420, x, y, r0: w * .18, r1: w * .95, w: 5, flat: .32, rgb: C.dust }); }
  function windIn(r, L, x, y, at, n){ for(let i = 0; i < n; i++){ const a = r.rnd() * Math.PI * 2, R = 90 + r.rnd() * 60;
      r.part(L, { k:'streak', born: at + r.rnd() * 40, life: 170, x: x + Math.cos(a) * R, y: y + Math.sin(a) * R * .7, tx: x + Math.cos(a) * 18, ty: y + Math.sin(a) * 12, len: 26 + r.rnd() * 18 }); } }
  function speedLines(r, L, x, y, at, w){ for(let i = 0; i < 5; i++) r.part(L, { k:'speed', born: at, life: 220, x, y, a: r.rnd() * Math.PI * 2, r: w * (.55 + r.rnd() * .2), len: 30 + r.rnd() * 50, w: 2.4 }); }
  function sparkle(r, L, x, y, at, sc){ r.part(L, { k:'spark', born: at, life: 700, x: x + (r.rnd() - .5) * 30 * sc, y: y + (r.rnd() - .5) * 20 * sc, vx: (r.rnd() - .5) * 30, vy: 30 + r.rnd() * 30, size: 7 * sc + 2 }); }
  function puff(r, L, x, y, at, w){
    for(let i = 0; i < PLUMO_FX.kawarimi.smokeCount; i++){ const a = (i / PLUMO_FX.kawarimi.smokeCount) * Math.PI * 2 + r.rnd() * .5, sp = 260 + r.rnd() * 260;
      r.part(L, { k:'smoke', born: at + r.rnd() * 40, life: 520 + r.rnd() * 220, x: x + Math.cos(a) * 6, y: y + Math.sin(a) * 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * .8 - 40, drag: 7, size: w * (.22 + r.rnd() * .12),
        lobes: [[0, 0, 1], [r.rnd() * .6 - .3, -.35, .7 + r.rnd() * .2], [.4, .1, .6 + r.rnd() * .2], [-.4, .15, .55 + r.rnd() * .2]] }); }
    r.part(L, { k:'ring', born: at, life: 320, x, y, r0: w * .2, r1: w * 1.15, w: 6 });
    for(let i = 0; i < PLUMO_FX.kawarimi.debrisCount; i++){ const a = r.rnd() * Math.PI * 2, sp = 260 + r.rnd() * 260;
      r.part(L, { k:'debris', born: at, life: 520 + r.rnd() * 240, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, g: 900, drag: 1.5, size: 2 + r.rnd() * 2.4 }); } }
  function implode(r, L, x, y, at, w){ for(let i = 0; i < 10; i++){ const a = (i / 10) * Math.PI * 2 + r.rnd() * .4;
      r.part(L, { k:'implode', born: at + r.rnd() * 20, life: 170, x, y, a, R: w * (.7 + r.rnd() * .3), size: w * (.18 + r.rnd() * .08) }); } }
  function residue(r, L, x, y, at, w){
    for(let i = 0; i < PLUMO_FX.kawarimi.chipCount; i++) r.part(L, { k:'chip', born: at + r.rnd() * 300, life: 1100 + r.rnd() * 300, x: x + (r.rnd() - .5) * w * .4, y: y - w * .1,
      vx: (r.rnd() - .5) * 260, vy: -180 - r.rnd() * 160, g: 1300, drag: 1.2, rot: r.rnd() * 6, vr: (r.rnd() - .5) * 14, size: 3 + r.rnd() * 3, c: r.rnd() > .5 ? C.wood : C.grain });
    for(let i = 0; i < PLUMO_FX.kawarimi.leafCount; i++) r.part(L, { k:'leaf', born: at + r.rnd() * 500, life: 1500 + r.rnd() * 500, x: x + (r.rnd() - .5) * w * .8, y: y - w * (.4 + r.rnd() * .3),
      vx: (r.rnd() - .5) * 30, vy: 46 + r.rnd() * 20, sway: 14, sw: 4 + r.rnd() * 2, ph: r.rnd() * 6, rot: r.rnd() * 6, size: 4 + r.rnd() * 2.5, c: C.leaves[i % C.leaves.length] }); }
  // a DOM piece driven by the clock: its pose comes from a function of its age
  function elPart(r, L, el, at, life, pose){ el.style.position = 'absolute'; el.style.left = '0'; el.style.top = '0'; el.style.opacity = 0; el.style.willChange = 'transform,opacity'; L.el.appendChild(el);
    return r.part(L, { el, born: at, life, pose }); }
  function cloneOf(node, w, h, cls){ const d = document.createElement('div'); d.className = 'pfx-clone ' + (cls || ''); d.style.width = w + 'px'; d.style.height = h + 'px'; d.innerHTML = node.innerHTML || node; return d; }
  const LOG_SVG = ()=> `<svg viewBox="0 0 64 30" width="100%" height="100%" aria-hidden="true"><rect x="3" y="5" width="50" height="20" rx="5" fill="${C.wood}" stroke="#3B2614" stroke-width="2"/>`
    + `<path d="M8 10h16M14 15h22M8 20h14M30 10h12M26 20h18" stroke="${C.bark}" stroke-width="1.6" stroke-linecap="round"/><path d="M22 5l-3 -4M36 25l2 4" stroke="#3B2614" stroke-width="1.6" stroke-linecap="round"/>`
    + `<ellipse cx="53" cy="15" rx="7" ry="10" fill="${C.grain}" stroke="#3B2614" stroke-width="2"/><ellipse cx="53" cy="15" rx="4" ry="6" fill="none" stroke="${C.bark}" stroke-width="1.2"/><ellipse cx="53" cy="15" rx="1.4" ry="2.2" fill="${C.bark}"/></svg>`;
  function dropLog(r, L, cx, floor, at, w){
    const lw = w * .62, lh = lw * 30 / 64, K = PLUMO_FX.kawarimi, el = document.createElement('div'); el.className = 'pfx-log'; el.style.width = lw + 'px'; el.style.height = lh + 'px'; el.innerHTML = LOG_SVG();
    const y0 = floor - w * .55, vy0 = -260, g = 2600, vx = (r.rnd() - .5) * 60, rest = (r.rnd() - .5) * 12;
    const yF = floor - lh, disc = vy0 * vy0 + 2 * g * (yF - y0), t1 = (-vy0 + Math.sqrt(Math.max(0, disc))) / g, v1 = -(vy0 + g * t1) * .32, t2 = t1 + 2 * -v1 / g;
    elPart(r, L, el, at, K.logHold + K.logFade, (age)=>{ const s = age / 1000;
      let y, rot; if(s < t1){ y = y0 + vy0 * s + .5 * g * s * s; rot = -30 + 260 * s; }
      else if(s < t2){ const u = s - t1; y = yF + v1 * u + .5 * g * u * u; rot = -30 + 260 * t1 + (rest - (-30 + 260 * t1)) * (u / (t2 - t1)); }
      else { y = yF; rot = rest; }
      const x = cx - lw / 2 + vx * Math.min(s, t2);
      return { x, y, r: rot, o: age > K.logHold ? 1 - (age - K.logHold) / K.logFade : 1 }; }); }

  // ── Kawarimi: flash → poof + log where he stood → smoke implodes at the target → he pops in ──
  // opts: face (the Plumo element that vanishes), host (clipping box, or null for the page), to {dx,dy} (move the face
  // there, measured from its home spot) or toEl() (another element he appears in), events [{t, fn}], onEnd
  function playKawarimi(o){
    const face = o.face; if(!face) return null;
    const K = PLUMO_FX.kawarimi, L = layerFor(o.host || null);
    const fr = face.getBoundingClientRect(); if(!fr.width) return null;
    const r0 = rel(L, fr), c0 = { x: r0.x + r0.w / 2, y: r0.y + r0.h / 2 };
    const pdx = +(face.dataset.pfxDx || 0), pdy = +(face.dataset.pfxDy || 0);
    const to = o.to || null, home = { x: c0.x - pdx, y: c0.y - pdy };
    const setHome = (dx, dy)=>{ face.dataset.pfxDx = dx; face.dataset.pfxDy = dy; face.style.transform = dx || dy ? `translate(${dx}px,${dy}px)` : ''; };
    if(RM()){ // reduced motion: a cross-fade, no particles
      const r = newRun(face, 420, 1); r.anim(face, [{ opacity: 1 }, { opacity: 0 }], { at: 0, duration: 160 });
      (o.events || []).forEach(e=> r.at(Math.min(e.t, 200), e.fn));
      r.at(200, ()=>{ if(to) setHome(to.dx, to.dy); });
      r.anim(face, [{ opacity: 0 }, { opacity: 1 }], { at: 220, duration: 180 });
      r.restore = ()=>{ face.style.opacity = ''; if(to) setHome(to.dx, to.dy); }; r.onEnd = o.onEnd; return r;
    }
    const r = newRun(face, K.total, o.seed);
    r.restore = ()=>{ face.style.opacity = ''; if(to) setHome(to.dx, to.dy); };
    r.onEnd = o.onEnd;
    // 1 · pre-teleport: a white silhouette flash, then he's gone
    r.at(0, at=>{ const s = cloneOf(face, r0.w, r0.h, 'pfx-sil'); elPart(r, L, s, at, K.flash, (age, p)=> ({ x: r0.x, y: r0.y, sx: 1 + p * .08, sy: 1 + p * .08, o: p < .35 ? p / .35 : 1 - (p - .35) / .65 })); });
    r.anim(face, [{ opacity: 1 }, { opacity: 0 }], { at: K.hideAt, duration: 24 });
    // 2 · poof: smoke, shockwave, glowing debris; 3 · the log drops where he stood
    r.at(K.poofAt, at=> puff(r, L, c0.x, c0.y, at, r0.w));
    r.at(K.logAt, at=> dropLog(r, L, c0.x, r0.y + r0.h, at, r0.w));
    (o.events || []).forEach(e=> r.at(e.t, e.fn));
    // 4 · the target: smoke implodes, he pops in with a squash and stretch and an afterimage of the old pose
    let target = null;
    r.at(K.implodeAt, at=>{
      if(o.toEl){ const el = o.toEl(); if(el){ const tr = rel(L, el.getBoundingClientRect()); target = { el, x: tr.x + tr.w / 2, y: tr.y + tr.h / 2, w: tr.w, h: tr.h };
          r.anim(el, [{ opacity: 0 }, { opacity: 0 }], { at: K.implodeAt, duration: K.popAt - K.implodeAt });
          r.anim(el, [{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'scale(1.18,.84)', offset: .45 }, { transform: 'scale(.95,1.06)', offset: .75 }, { opacity: 1, transform: 'scale(1)' }], { at: K.popAt, duration: K.popDur, easing: PLUMO_FX.ease.out }); } }
      else { const dx = to ? to.dx : pdx, dy = to ? to.dy : pdy; target = { x: home.x + dx, y: home.y + dy, w: r0.w, h: r0.h, dx, dy }; }
      if(target) implode(r, L, target.x, target.y, at, target.w || r0.w);
    });
    if(!o.toEl){ const dx = to ? to.dx : pdx, dy = to ? to.dy : pdy, tf = s=> `translate(${dx}px,${dy}px) scale(${s})`;
      r.anim(face, [{ opacity: 0, transform: tf('.3') }, { opacity: 1, transform: `translate(${dx}px,${dy}px) scale(1.18,.84)`, offset: .45 }, { transform: `translate(${dx}px,${dy}px) scale(.95,1.06)`, offset: .75 }, { opacity: 1, transform: tf(1) }],
        { at: K.popAt, duration: K.popDur, easing: PLUMO_FX.ease.out }); }
    r.at(K.popAt, at=>{ if(!target) return; const s = cloneOf(face, r0.w, r0.h, 'pfx-after');
      elPart(r, L, s, at, K.afterimage, (age, p)=> ({ x: target.x - r0.w / 2 - 10, y: target.y - r0.h / 2, o: .45 * (1 - p) })); });
    // 5 · residue: wood chips and leaves drift down at both spots
    r.at(K.popAt + 80, at=>{ residue(r, L, c0.x, r0.y + r0.h, at, r0.w); if(target) residue(r, L, target.x, target.y + (target.h || r0.h) / 2, at + 60, (target.w || r0.w) * .7); });
    return r;
  }

  // ── Flight: anticipation → takeoff burst → cruise → dash → (circle) → return → landing ──
  // opts: host (the hero), face (Plumo's spot; hidden while the copy flies), front/back (html of each view),
  // target {x,y} in the host (where he flies to), onEnd
  function playFly(o){
    const face = o.face, host = o.host; if(!face || !host) return null;
    if(RM()) return null;
    const F = PLUMO_FX.fly, L = layerFor(host), fr = rel(L, (o.measure || face).getBoundingClientRect()); if(!fr.w) return null;   // measure: the drawing inside the face's box
    const r = newRun(face, F.total, o.seed);
    const cx = fr.x + fr.w / 2, feet = fr.y + fr.h * .92, dx = o.target.x - cx, dy = o.target.y - (fr.y + fr.h / 2), u = fr.w / 190;
    // the path: [time, x, y, scale, squashX, squashY, rotate, easing into this key]
    const E = PLUMO_FX.ease, K = [
      [0, 0, 0, 1, 1, 1, 0], [F.anticipation, 0, 10 * u, 1, 1.1, .8, 0, E.out], [F.burstEnd, dx * .05, -95 * u, 1, .86, 1.22, -4, E.back],
      [600, dx * .12, -110 * u, .96, 1, 1, -6, E.out], [1300, dx * .28, -120 * u + dy * .1, .82, 1, 1, 3, E.inOut], [F.cruiseEnd, dx * .42, dy * .35 - 100 * u, .66, 1, 1, -2, E.inOut],
      [F.dashEnd, dx, dy - 8, F.endScale, 1.08, .94, 4, E.in], [3500, dx + 40 * u, dy - 26 * u, F.endScale * .92, 1, 1, 8, E.out], [3900, dx - 20 * u, dy - 40 * u, F.endScale, 1, 1, -8, E.inOut],
      [F.circleEnd, dx * .98, dy - 30 * u, F.endScale * 1.08, 1, 1, 0, E.inOut], [5000, dx * .6, dy * .4 - 90 * u, .5, 1, 1, -6, E.inOut], [5700, dx * .2, -80 * u, .86, 1, 1, 4, E.inOut],
      [F.returnEnd, 0, -30 * u, 1, 1, 1, 0, E.out], [F.touchdown, 0, 10 * u, 1, 1.14, .84, 0, E.in], [6550, 0, -6 * u, 1, .95, 1.06, 0, E.back], [F.total, 0, 0, 1, 1, 1, 0, E.out]];
    const tfm = k=> `translate(${k[1]}px,${k[2]}px) scale(${k[3] * k[4]},${k[3] * k[5]}) rotate(${k[6]}deg)`;
    const at = t=>{ let i = 0; while(i < K.length - 2 && K[i + 1][0] <= t) i++; const a = K[i], b = K[i + 1], p = clamp((t - a[0]) / (b[0] - a[0]), 0, 1), q = smooth(p);
      return { x: a[1] + (b[1] - a[1]) * q, y: a[2] + (b[2] - a[2]) * q, s: a[3] + (b[3] - a[3]) * q }; };
    // the flying copy: glow (the core brightening), front view, back view
    const fl = document.createElement('div'); fl.className = 'pfx-flyer'; fl.style.cssText = `left:${fr.x}px;top:${fr.y}px;width:${fr.w}px;height:${fr.h}px`;
    fl.innerHTML = `<span class="pfx-glow"></span><span class="pfx-fv">${o.front}</span><span class="pfx-bv">${o.back}</span>`;
    L.el.appendChild(fl); r.els.push(fl);
    fl.querySelectorAll('.plumoF').forEach(x=>{ x.classList.add('pf-fly', 'pf-cruise'); });
    const fv = fl.querySelector('.pfx-fv'), bv = fl.querySelector('.pfx-bv'), glow = fl.querySelector('.pfx-glow');
    r.anim(fl, K.map((k, i)=>{ const f = { offset: k[0] / F.total, transform: tfm(k) }; if(K[i + 1]) f.easing = K[i + 1][7] || E.inOut; return f; }), { at: 0, duration: F.total });   // each leg eases into the next key
    const flip = (a, b)=> [{ opacity: a, offset: 0 }, { opacity: a, offset: 520 / F.total }, { opacity: b, offset: 600 / F.total }, { opacity: b, offset: 4100 / F.total }, { opacity: a, offset: 4180 / F.total }, { opacity: a, offset: 1 }];
    r.anim(fv, flip(1, 0), { at: 0, duration: F.total }); r.anim(bv, flip(0, 1), { at: 0, duration: F.total });
    r.anim(glow, [{ opacity: 0 }, { opacity: 1, offset: .5 }, { opacity: 0 }], { at: 0, duration: 600 });
    r.anim(glow, [{ opacity: 0 }, { opacity: .7, offset: .2 }, { opacity: .7, offset: .85 }, { opacity: 0 }], { at: F.cruiseEnd, duration: F.dashEnd - F.cruiseEnd });
    r.anim(face, [{ opacity: 0 }, { opacity: 0 }], { at: 0, duration: F.total });
    r.restore = ()=>{ face.style.opacity = ''; };
    r.onEnd = o.onEnd;
    const view = t=> (t >= 560 && t < 4140 ? bv : fv);
    const ghost = (t, life, cls, op)=> r.at(t, a=>{ const p = at(t), s = cloneOf(view(t), fr.w, fr.h, cls);
      elPart(r, L, s, a, life, (age, q)=> ({ x: fr.x + p.x, y: fr.y + p.y, sx: p.s, sy: p.s, o: op * (1 - q) })); });
    // anticipation: wind gathers in at his feet; burst: dust ring, shockwave and a one-frame smear
    r.at(0, a=> windIn(r, L, cx, feet, a, F.windCount));
    r.at(F.anticipation, a=>{ dustRing(r, L, cx, feet, a, fr.w, F.dustCount); const s = cloneOf(fv, fr.w, fr.h, 'pfx-smear');
      elPart(r, L, s, a, 60, (age, q)=> ({ x: fr.x, y: fr.y - 40 * u * q, sx: .9, sy: 1.5, o: .55 * (1 - q) })); });
    // cruise: a soft trail of afterimages; dash: speed lines, quick afterimages and a colour fringe
    for(let t = 600; t < F.cruiseEnd; t += F.afterimageEvery) ghost(t, F.afterimageLife * 1.4, 'pfx-trail', .28);
    for(let t = F.cruiseEnd; t < F.dashEnd; t += F.dashAfterimageEvery) ghost(t, F.afterimageLife, 'pfx-trail', .4);
    for(let t = F.cruiseEnd; t < F.dashEnd; t += F.speedLineEvery) r.at(t, a=>{ const p = at(t); speedLines(r, L, fr.x + fr.w / 2 + p.x, fr.y + fr.h / 2 + p.y, a, fr.w * p.s); });
    r.at(F.cruiseEnd, ()=> fl.classList.add('pfx-fringe')); r.at(F.dashEnd, ()=> fl.classList.remove('pfx-fringe'));
    for(let t = 600; t < F.returnEnd; t += F.sparkleEvery) r.at(t, a=>{ const p = at(t); sparkle(r, L, fr.x + fr.w / 2 + p.x, fr.y + fr.h * .65 + p.y * 1, a, p.s); });
    // landing: dust ring at touchdown; the wings fold with a damped bounce
    r.at(F.touchdown, a=> dustRing(r, L, cx, feet, a, fr.w, Math.round(F.dustCount * .7)));
    r.at(6550, ()=> fl.querySelectorAll('.pf-wings').forEach(w=>{ w.style.transformBox = 'fill-box'; w.style.transformOrigin = '50% 40%';
      r.anim(w, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.62,1.12)', offset: .4 }, { transform: 'scale(.86,.94)', offset: .7 }, { transform: 'scale(.3)', opacity: 0 }], { at: 6550, duration: 250, easing: E.out }); }));
    return r;
  }

  window.PlumoFX = { playFly, playKawarimi, cancel, cancelAll, config: PLUMO_FX,
    // the demo page: pause / step / scrub the clock
    get time(){ return T; }, setTime(t){ T = t; step(); }, pause(on){ paused = !!on; wake(); }, get paused(){ return paused; }, step, wake };
  if(!document.getElementById('plumoMovesCss')){
    const st = document.createElement('style'); st.id = 'plumoMovesCss';
    st.textContent = '.pfx-layer{position:absolute;inset:0;pointer-events:none;z-index:6;overflow:hidden}.pfx-layer.pfx-fixed{position:fixed;z-index:10200;overflow:visible}'
      + '.pfx-layer canvas{position:absolute;inset:0;width:100%;height:100%}'
      + '.pfx-flyer{position:absolute;transform-origin:50% 60%;will-change:transform}.pfx-flyer .pfx-fv,.pfx-flyer .pfx-bv{position:absolute;inset:0}.pfx-flyer .pfx-bv{opacity:0}'
      + '.pfx-flyer .plumoF,.pfx-clone .plumoF{width:100%;height:100%}.pfx-flyer .plumoF{filter:drop-shadow(0 12px 14px rgba(0,0,0,.35))}'
      + '.pfx-glow{position:absolute;inset:-12%;border-radius:50%;opacity:0;background:radial-gradient(closest-side,rgba(160,240,255,.85),rgba(120,200,255,.35) 55%,rgba(120,200,255,0))}'
      + '.pfx-flyer.pfx-fringe .plumoF{filter:drop-shadow(3px 0 0 rgba(0,229,255,.75)) drop-shadow(-3px 0 0 rgba(255,60,140,.6)) drop-shadow(0 12px 14px rgba(0,0,0,.3))}'
      + '.pfx-clone{pointer-events:none;transform-origin:50% 60%}.pfx-clone > *{width:100%;height:100%}.pfx-clone svg{width:100%;height:100%;overflow:visible}'
      + '.pfx-sil{filter:brightness(0) invert(1) drop-shadow(0 0 10px rgba(255,255,255,.9))}.pfx-trail{filter:saturate(.6) brightness(1.15)}.pfx-smear{filter:blur(1.5px) brightness(1.2)}'
      + '.pfx-log{pointer-events:none;filter:drop-shadow(0 4px 4px rgba(0,0,0,.3))}';
    (document.head || document.documentElement).appendChild(st);
  }
})();
