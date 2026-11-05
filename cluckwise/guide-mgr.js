// Farm guide for the manager in Tasks (2026-11-04, mockup 1j4jqFay5tjcjmtZv192Xr, version 1): three tabs.
//   Sheds      — one shed at a time, laid out like the Crew app's page but wide (shed buttons, drawings,
//                temperature with its day-by-day ramp, lighting, Ross 308 targets, quick checks)
//   Edit guide — set points and card words; changes wait for Apply / Discard (the host keeps the draft)
//   Standards  — Ross 308 and Cobb 500 day-by-day tables, and a general good-practice guide
// Uses CWGuide2 (guide2.js) for the drawings, text, icons and the temperature ramp.
(function(){
  const G = window.CWGuide2, U = G.ui, ic = U.ic, ICON = U.ICON, esc = U.esc, fmt = U.fmt;
  const tt = (k, v)=> G.text('en', k, v);
  const t1 = G.t1;
  // Ross 308 (Aviagen 2022) and Cobb 500 (Cobb-Vantress 2022) as-hatched objectives, day 0–56:
  // [weight g, daily gain g, feed g a day, feed so far g, FCR]. Cobb gives no daily feed before day 8.
  const ROSS = [[44,0,0,0,0],[62,18,12,12,0.196],[81,19,16,28,0.352],[102,21,20,48,0.476],[125,23,24,72,0.577],[151,26,27,100,0.658],[181,29,31,131,0.724],[213,32,35,166,0.78],[249,36,39,206,0.826],[288,39,44,249,0.865],[330,42,48,297,0.9],[376,46,52,349,0.93],[425,49,57,406,0.957],[477,52,62,468,0.982],[533,56,67,535,1.005],[592,59,72,608,1.026],[655,62,77,685,1.047],[720,66,83,768,1.066],[789,69,88,856,1.086],[860,72,94,950,1.105],[935,74,100,1050,1.123],[1012,77,105,1155,1.142],[1092,80,111,1266,1.16],[1174,82,117,1383,1.178],[1258,85,122,1505,1.196],[1345,87,128,1633,1.214],[1434,89,134,1767,1.233],[1524,91,139,1907,1.251],[1616,92,145,2051,1.269],[1710,94,150,2202,1.288],[1805,95,156,2357,1.306],[1901,96,161,2518,1.325],[1999,97,166,2684,1.343],[2097,98,171,2855,1.362],[2196,99,176,3031,1.381],[2296,100,180,3211,1.399],[2396,100,185,3396,1.418],[2496,100,189,3584,1.437],[2597,101,193,3777,1.456],[2697,101,197,3974,1.474],[2798,100,201,4175,1.493],[2898,100,204,4379,1.512],[2998,100,207,4586,1.531],[3097,100,211,4797,1.55],[3197,99,213,5010,1.569],[3295,98,216,5226,1.587],[3393,98,219,5445,1.606],[3490,97,221,5666,1.625],[3586,96,223,5890,1.644],[3681,95,225,6115,1.663],[3776,94,227,6342,1.681],[3869,93,229,6571,1.7],[3961,92,230,6801,1.719],[4052,91,231,7032,1.738],[4142,90,233,7265,1.756],[4230,89,233,7498,1.775],[4318,87,234,7733,1.793]];
  const COBB = [[42,0,null,null,null],[55,13,null,null,null],[71,16,null,null,null],[90,19,null,null,null],[112,22,null,null,null],[138,26,null,null,null],[168,30,null,null,null],[202,34,null,180,0.891],[240,38,40,220,0.917],[283,43,44,264,0.933],[330,47,50,314,0.952],[382,52,57,371,0.971],[440,58,64,435,0.991],[503,63,73,508,1.012],[570,67,80,588,1.029],[639,69,84,672,1.05],[711,72,91,763,1.072],[786,75,98,861,1.094],[864,78,105,966,1.116],[945,81,111,1077,1.138],[1029,84,118,1195,1.16],[1116,87,125,1320,1.182],[1205,89,131,1451,1.203],[1296,91,137,1588,1.224],[1390,94,143,1731,1.245],[1486,96,149,1880,1.265],[1583,97,154,2034,1.284],[1682,99,160,2194,1.303],[1783,101,165,2359,1.322],[1886,103,169,2528,1.34],[1989,103,174,2702,1.358],[2094,105,178,2880,1.375],[2200,106,183,3063,1.392],[2306,106,187,3250,1.409],[2413,107,191,3441,1.425],[2521,108,194,3635,1.441],[2629,108,198,3833,1.457],[2738,109,202,4035,1.474],[2846,108,206,4241,1.49],[2954,108,209,4450,1.506],[3062,108,213,4663,1.522],[3170,108,217,4880,1.539],[3278,108,220,5100,1.555],[3384,106,224,5324,1.573],[3490,106,228,5552,1.59],[3595,105,232,5784,1.608],[3699,104,236,6020,1.627],[3801,102,239,6259,1.646],[3902,101,243,6502,1.666],[4001,99,247,6749,1.686],[4099,98,250,6999,1.707],[4195,96,253,7252,1.728],[4289,94,256,7508,1.75],[4380,91,258,7766,1.772],[4470,90,260,8026,1.795],[4557,87,261,8287,1.818],[4641,84,262,8549,1.842]];
  const STD = { ross: { name: 'Ross 308', rows: ROSS, src: 'Aviagen Ross 308 Performance Objectives 2022, as-hatched.' },
    cobb: { name: 'Cobb 500', rows: COBB, src: 'Cobb500 Broiler Performance & Nutrition Supplement 2022, as-hatched. Cobb gives no daily feed for the first week.' } };
  const GEN = [
    { t: 'Arrival', tone: 'g2-violet', i: 'heat', rows: [['Floor / litter', '28–30 °C'], ['Air at chick height', '30–32 °C'], ['Humidity', '60–70 %'], ['Light', '23 h · 30–40 lux'], ['Crop fill 8 h', '8 of 10 full'], ['Crop fill 24 h', '10 of 10']] },
    { t: 'Air & litter', tone: 'g2-teal', i: 'litter', rows: [['Humidity after day 7', '50–70 %'], ['Ammonia', 'under 10 ppm'], ['Carbon dioxide', 'under 3,000 ppm'], ['Litter moisture', '25–35 %'], ['Heat from', '32 °C (farm rule)']] },
    { t: 'Light', tone: 'g2-amber', i: 'bulb', rows: [['Day 0–7', '1 h dark · 30–40 lux'], ['Day 7 on', '4–6 h dark in one block'], ['After day 7', '5–10 lux'], ['Before catching', 'back to 1 h dark']] },
    { t: 'Water & feed', tone: 'g2-blue', i: 'water', rows: [['Water : feed', '1.6–2.0 at 21 °C'], ['Nipples', '1 per 10–12 birds'], ['Feeder pans', '1 per 50–70 birds'], ['Drinker height', 'eye → head → stretch up']] }];

  const stageOf = a=> a <= 7 ? 'Brooding' : a <= 14 ? 'Starter' : a <= 28 ? 'Grower' : 'Finisher';
  const kgTxt = kg=> kg < 1 ? Math.round(kg * 1000) + ' g' : kg.toFixed(2) + ' kg';
  const sgn = n=> (n < 0 ? '−' : '+') + t1(Math.abs(n));
  const perTxt = r=> r ? (r.per === 0 ? 'steady' : sgn(r.per) + '° a day') : 'steady';
  const rampTxt = (rows, a)=>{ const r = G.tempRamp(rows, a); if(r) return 'Day ' + r.d0 + ' ' + t1(r.v0) + '° → day ' + r.d1 + ' ' + t1(r.v1) + '°';
    const s = G.spRows(rows); return s.length ? 'Holds from day ' + s[s.length - 1][0] : ''; };
  const pill = (s, on)=> `<button type="button" class="g2-pill gm-pill${on ? ' on' : ''}" style="--pc:${U.PAIR[(s.n - 1) % 8]}" data-gm-shed="${s.n}">${s.n}<small>${s.age == null ? esc(tt('empty')) : 'd' + s.age}</small></button>`;
  // the temperature line through every day, drawn into a box
  function tempLine(rows, b, days){
    const pts = Array.from({ length: days + 1 }, (_, d)=> [d, G.tempAt(rows, d)]);
    return pts.map((p, i)=> (i ? 'L' : 'M') + (b.x + p[0] / days * b.w).toFixed(1) + ' ' + (b.y + b.h - (p[1] - b.lo) / (b.hi - b.lo) * b.h).toFixed(1)).join(' ');
  }
  function tempRange(rows){ const v = G.spRows(rows).map(r=> r[1]); return { lo: Math.floor(Math.min(...v) - 1), hi: Math.ceil(Math.max(...v) + 1) }; }

  // ---------- Sheds ----------
  function tempCard(c, a, chart, ahead){
    const ramp = G.tempRamp(c.temp, a), temp = G.tempAt(c.temp, a);
    let svg = '';
    if(chart){
      const r = tempRange(c.temp), b = { x: 0, y: 6, w: 300, h: 52, lo: r.lo, hi: r.hi }, p = tempLine(c.temp, b, 42);
      const mx = (Math.min(a, 42) / 42 * 300).toFixed(1), my = (b.y + b.h - (temp - b.lo) / (b.hi - b.lo) * b.h).toFixed(1);
      svg = `<svg class="gm-spark" viewBox="0 0 300 64" preserveAspectRatio="none" aria-label="Set point from day 0 to day 42"><path d="${p} L300 64 L0 64 Z" fill="var(--g2-coral-s)"/><path d="${p}" fill="none" stroke="var(--g2-coral)" stroke-width="2" vector-effect="non-scaling-stroke"/>
        <line x1="${mx}" x2="${mx}" y1="0" y2="64" stroke="var(--g2-ink)" stroke-width="1.5" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/></svg>
        <span class="gm-dot" style="left:${(Math.min(a, 42) / 42 * 100).toFixed(2)}%;top:${(my / 64 * 100).toFixed(2)}%"></span>`;
    }
    return `<div class="gm-card gm-tc"><span class="gm-ch"><span class="g2-ico g2-coral">${ic(ICON.heat)}</span><b>${esc(tt('temp'))}</b><span class="g2-tag g2-coral">${esc(perTxt(ramp))}</span></span>
      <span class="gm-tbig"><b class="g2-coral-t">${t1(temp)}°</b><span>${ahead ? 'set point on day ' + a : 'set point today'}</span></span>
      <span class="gm-ramp">${esc(rampTxt(c.temp, a))}</span>
      ${chart ? `<span class="gm-sparkw">${svg}</span><span class="gm-axis"><span>day 0</span><span>day 21</span><span>day 42</span></span>` : ''}
      <span class="gm-tf"><span>Humidity <b>${esc(String(G.stepAt(c.rh, a)))} %</b></span><span>Controller set to this</span></span></div>`;
  }
  function lightCard(c, a){
    const dark = Number(G.stepAt(c.dark, a)) || 0, circ = 2 * Math.PI * 30, own = String(c.text.light_n || '').trim();
    return `<div class="gm-card gm-lc"><span class="gm-ch"><span class="g2-ico g2-amber">${ic(ICON.bulb)}</span><b>${esc(tt('light'))}</b><span class="g2-tag g2-amber">${a < 7 ? '30–40' : '5–10'} lux</span></span>
      <span class="gm-clock"><svg width="62" height="62" viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="30" fill="none" stroke="#F5C842" stroke-width="14"/><circle cx="40" cy="40" r="30" fill="none" stroke="#2B3566" stroke-width="14" stroke-dasharray="${(circ * dark / 24).toFixed(1)} ${circ.toFixed(1)}" transform="rotate(-90 40 40)"/></svg>
      <span><b>${esc(tt('lh', { h: 24 - dark }))}</b><b class="g2-night">${esc(tt('dh', { h: dark }))}</b><small>${esc(own || 'Keep the dark in one block.')}</small></span></span></div>`;
  }
  function checkChips(o){
    const c = o.cfg;
    const chips = o.checks.filter(([k])=> !c.hidden.includes(k)).map(([k])=>{ const [i, tone] = U.CHECK_LOOK[k] || ['good', 'g2-teal'];
      return `<button type="button" class="gm-qc" data-g2-check="${k}"><span class="g2-ico ${tone}">${ic(ICON[i], 15)}</span>${esc(o.X('g_' + k + '_t'))}</button>`; })
      .concat(c.custom.filter(x=> x.title).map(x=> `<button type="button" class="gm-qc" data-g2-check="own:${esc(x.id)}"><span class="g2-ico g2-grey">${esc(x.icon || '📌')}</span>${esc(x.title)}</button>`));
    return chips.length ? `<div class="gm-qcs"><span class="g2-cap">${esc(tt('checks'))} · ${esc(tt('every'))}</span>${chips.join('')}</div>` : '';
  }
  function shedsHtml(o){
    const c = o.cfg, list = o.sheds || [];
    const sel = list.find(s=> s.n === o.shed) || list.find(s=> s.age != null) || list[0] || null;
    // a shed with birds can be stepped days ahead or back from its age today
    const off = sel && sel.age != null ? G.dayOff(sel, o.dayOff) : 0;
    const a = sel ? (sel.age == null ? 0 : Math.max(0, sel.age) + off) : Math.max(0, o.age || 0);
    let tb = 0, tf = 0, tw = 0;
    list.forEach(s=>{ if(s.age != null && s.birds){ tb += s.birds; tf += s.birds * o.feedG(s.age) / 1000; tw += s.birds * o.waterMl(s.age) / 1000; } });
    const totals = tb ? [['Birds', fmt(tb), ''], ['Feed today', fmt(tf), 'kg'], ['Water today', fmt(tw), 'L']].map(([k, v, u])=> `<span><small>${k}</small><b>${v}${u ? ' <i>' + u + '</i>' : ''}</b></span>`).join('') : '';
    const bar = list.length ? `<div class="gm-bar"><div class="gm-pills">${list.map(s=> pill(s, s === sel)).join('')}</div><div class="gm-tot">${totals}</div></div>`
      : `<div class="gm-bar"><p class="g2-hint">${esc(tt('noBatch', { n: a }))}</p><div class="g2-step"><button type="button" data-g-age="-1" aria-label="Previous day">−</button><button type="button" data-g-age="1" aria-label="Next day">+</button></div></div>`;
    const empty = sel && sel.age == null;
    const sub = !sel ? o.T('g_now') : tt('shed', { n: sel.n }) + (empty ? ' · ' + tt('empty') : (off ? ' · ' + tt('todayIs', { n: sel.age }) : sel.birds ? ' · ' + tt('birds', { n: fmt(sel.birds) }) : '') + ' · ' + stageOf(a));
    const title = empty ? (sel.chicks ? tt('chicks', { d: o.dateLabel(sel.chicks) }) : tt('empty')) : tt('day', { n: a });
    const tip = empty ? tt('emptyHi', { n: sel.n }) : tt(a <= 3 ? 'tip0' : a <= 10 ? 'tip1' : a <= 20 ? 'tip2' : 'tip3');
    const step = sel && !empty ? `<span class="g2-step gm-daystep"><button type="button" data-g2-day="-1" aria-label="Previous day" title="Previous day">−</button>${off ? `<button type="button" class="g2-today" data-g2-day="0" title="Back to its age today">${esc(tt('today'))}</button>` : ''}<button type="button" data-g2-day="1" aria-label="Next day" title="Next day">+</button></span>` : '';
    const head = `<div class="gm-title"><span class="gm-tt"><span class="gm-sub">${esc(sub)}</span><span class="gm-day">${esc(title)}</span></span>${step}
      <span class="gm-say">${U.plumo(empty ? 'thinking' : 'calm')}<span class="g2-bubble">${esc(tip)}</span></span></div>`;
    let grid;
    if(empty){
      const t0 = t1(G.tempAt(c.temp, 0)), rh0 = G.stepAt(c.rh, 0), d0 = Number(G.stepAt(c.dark, 0)) || 0;
      const items = [['r1', ICON.heat, 'g2-coral', { t: t0 }], ['r2', ICON.rh, 'g2-blue', { rh: rh0 }], ['r3', ICON.litter, 'g2-amber'], ['r4', ICON.water, 'g2-blue'], ['r5', ICON.pan, 'g2-amber'], ['r6', ICON.bulb, 'g2-amber', { lh: 24 - d0, dh: d0 }]];
      grid = `<div class="gm-grid gm-grid-e"><div class="gm-card gm-ready"><span class="g2-cap g2-violet-t">${esc(tt('ready'))}</span><div class="gm-ready-l">
          ${items.map(([k, i, tone, vv])=> `<div class="g2-li"><span class="g2-ico ${tone}">${ic(i, 22)}</span><span><b>${esc(tt(k + 't', vv))}</b><span>${esc(tt(k + 'd', vv))}</span></span></div>`).join('')}</div>
        <div class="gm-crop"><span class="g2-cap g2-teal-t">${esc(tt('crop'))}</span><p>${esc(tt('cropD'))}</p>
          <span class="gm-crop-n"><span><small>${esc(tt('crop8'))}</small><b>${esc(tt('of10', { a: 8 }))}</b></span><span><small>${esc(tt('cropAm'))}</small><b>${esc(tt('of10', { a: 10 }))}</b></span></span></div></div>
        <div class="gm-col">${tempCard(c, 0, true)}${lightCard(c, 0)}</div></div>`;
    } else {
      const stage = a <= 2 ? 0 : a <= 10 ? 1 : 2;
      const feedTxt = a <= 3 ? o.X('g_feed_0') : a <= 7 ? tt('feedF') : o.X('g_feed_1');
      grid = `<div class="gm-grid">
        <div class="gm-card gm-pic"><span class="gm-ch"><span class="g2-ico g2-blue">${ic(ICON.water)}</span><b>${esc(o.T('g_drink_t'))}</b><span class="g2-tag g2-blue">${esc(tt('dtag' + stage))}</span></span>
          ${G.scene('drink', a, o.kg)}<p>${esc(o.X('g_drink_' + stage))}</p></div>
        <div class="gm-card gm-pic"><span class="gm-ch"><span class="g2-ico g2-amber">${ic(ICON.pan)}</span><b>${esc(o.T('g_feed_t'))}</b><span class="g2-tag g2-amber">${esc(tt(a <= 7 ? 'ftagF' : 'ftagB'))}</span></span>
          ${G.scene('feed', a, o.kg)}<p>${esc(feedTxt)}</p></div>
        <div class="gm-col">${tempCard(c, a, true, !!off)}${lightCard(c, a)}</div></div>`;
      const birds = sel ? sel.birds || 0 : 0, fg = o.feedG(a), wm = o.waterMl(a);
      const stats = [[ICON.weight, 'g2-teal', 'Weight · target', kgTxt(o.kg(a)), '—'], [ICON.feed, 'g2-amber', 'Feed · a day', fg + ' g', birds ? fmt(birds * fg / 1000) + ' kg' : '—'],
        [ICON.water, 'g2-blue', 'Water · a day', wm + ' ml', birds ? fmt(birds * wm / 1000) + ' L' : '—']];
      grid += `<div class="gm-card gm-ross"><span class="g2-cap g2-teal-t">Ross 308 · day ${a}</span>${stats.map(([i, tone, k, v, tot])=>
        `<span class="gm-rs"><span class="g2-ico ${tone}">${ic(i, 15)}</span><span class="gm-rv"><small>${k}</small><b>${v}</b></span><span class="gm-rv gm-rt"><small>whole shed</small><b>${tot}</b></span></span>`).join('')}</div>`;
    }
    return `<div class="g2 g2-wide gm gm-sheds">${bar}${head}${grid}${checkChips(o)}</div>`;
  }

  // ---------- Edit guide ----------
  const SECS = [['temp', 'Temperature', 'heat', 'g2-coral'], ['rh', 'Humidity', 'rh', 'g2-blue'], ['light', 'Lighting', 'bulb', 'g2-amber'], ['drink', 'Drinkers', 'water', 'g2-blue'],
    ['feed', 'Feeder pans', 'pan', 'g2-amber'], ['checks', 'Quick checks', 'good', 'g2-teal'], ['own', 'Your own cards', 'edit', 'g2-grey'], ['std', 'Standard', 'book', 'g2-violet']];
  function rowsEditor(k, rows, unit, type, ramp){
    const sorted = rows.map((r, i)=> ({ d: r[0], v: r[1], i })).sort((x, y)=> x.d - y.d);
    return sorted.map((r, j)=>{
      const n = sorted[j + 1];
      let note = '';
      if(ramp){ const v0 = Number(r.v), v1 = n ? Number(n.v) : null;
        note = n && n.d > r.d && isFinite(v0) && isFinite(v1) ? `<span class="gm-rampchip"><span>${v1 === v0 ? 'Holds ' + t1(v0) + '°' : sgn((v1 - v0) / (n.d - r.d)) + '° a day for ' + (n.d - r.d) + (n.d - r.d === 1 ? ' day' : ' days')}</span><small>→ ${t1(v1)}° on day ${n.d}</small></span>`
          : `<span class="gm-hold">Holds to the end of the batch</span>`; }
      else note = `<span class="gm-hold">${n ? 'Until day ' + (n.d - 1) : 'To the end of the batch'}</span>`;
      return `<div class="gm-sp"><label><span>Day</span><input type="number" min="0" max="70" class="gm-in gm-in-d" value="${esc(r.d)}" data-gm-row="${k}:${r.i}:d" aria-label="From day"></label>
        <label><input type="${type}" ${type === 'number' ? 'step="0.1"' : ''} class="gm-in gm-in-v" value="${esc(ramp ? t1(r.v) : r.v)}" data-gm-row="${k}:${r.i}:v" aria-label="Value"><span>${unit}</span></label>
        ${note}<button type="button" class="gm-x" data-gm-rdel="${k}:${r.i}" aria-label="Remove row" title="Remove this row"${rows.length < 2 ? ' disabled' : ''}>${ic(ICON.x, 16)}</button></div>`;
    }).join('') + `<span class="gm-add"><button type="button" class="gm-btn" data-gm-radd="${k}">${ic(ICON.plus, 15)}${ramp ? 'Add a set point' : 'Add a row'}</button></span>`;
  }
  function tempEditor(c){
    const r = tempRange(c.temp), B = { x: 44, y: 18, w: 640, h: 196, lo: r.lo, hi: r.hi }, path = tempLine(c.temp, B, 42);
    const Y = v=> (B.y + B.h - (v - B.lo) / (B.hi - B.lo) * B.h).toFixed(1), X = d=> (B.x + Math.min(d, 42) / 42 * B.w).toFixed(1);
    const step = (r.hi - r.lo) > 10 ? 4 : 2, yt = []; for(let v = Math.ceil(r.lo / step) * step; v <= r.hi; v += step) yt.push(v);
    const svg = `<svg class="gm-chart" viewBox="0 0 700 240" role="img" aria-label="Temperature set points by day">
      ${yt.map(v=> `<line x1="44" x2="684" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--g2-line)"/><text x="36" y="${(+Y(v) + 4).toFixed(1)}" text-anchor="end">${v}°</text>`).join('')}
      ${[0, 7, 14, 21, 28, 35, 42].map(d=> `<text x="${X(d)}" y="234" text-anchor="middle">d${d}</text>`).join('')}
      <path d="${path} L684 ${B.y + B.h} L44 ${B.y + B.h} Z" fill="var(--g2-coral-s)" opacity=".75"/><path d="${path}" fill="none" stroke="var(--g2-coral)" stroke-width="2.5" stroke-linejoin="round"/>
      ${G.spRows(c.temp).filter(p=> p[0] <= 42).map(([d, v])=> `<circle cx="${X(d)}" cy="${Y(v)}" r="7" fill="var(--g2-card)" stroke="var(--g2-coral)" stroke-width="3"/><text x="${X(d)}" y="${(+Y(v) - 12).toFixed(1)}" text-anchor="middle" class="gm-chart-v">${t1(v)}°</text>`).join('')}</svg>`;
    return `<div class="gm-card gm-ed-card"><span class="gm-ch gm-ch-l"><span class="g2-ico g2-coral">${ic(ICON.heat)}</span><span class="gm-cht"><b>Temperature set points</b><small>Put the days you want. The app lowers the set point evenly every day in between.</small></span>
        <button type="button" class="gm-btn" data-gm-reset="temp">Reset to Ross 308</button></span>${svg}</div>
      <div class="gm-card gm-ed-rows">${rowsEditor('temp', c.temp, '°C', 'number', true)}</div>`;
  }
  function calendar(c){
    const sp = new Set(G.spRows(c.temp).map(r=> r[0]));
    return `<div class="gm-card gm-cal-card"><span class="g2-cap">Every day · what the crew sees</span><span class="gm-cal-sub">One week a row, day 0–41</span>
      <div class="gm-cal">${Array.from({ length: 42 }, (_, d)=> `<span class="${sp.has(d) ? 'sp' : ''}"><small>d${d}</small>${t1(G.tempAt(c.temp, d))}</span>`).join('')}</div>
      <span class="gm-legend"><i class="sp"></i>your set point<i></i>worked out</span></div>`;
  }
  function textBox(o, key, label, rows, pic){
    const own = o.cfg.text[key] || '';
    return `<label class="gm-txt">${pic ? `<span class="gm-txt-pic">${pic}</span>` : ''}<span class="gm-txt-b"><span class="gm-txt-l">${label}</span>
      <textarea class="gm-in gm-ta" rows="${rows || 3}" data-gm-text="${key}" placeholder="${esc(o.T('g_' + key))}">${esc(own)}</textarea></span></label>`;
  }
  function sectionHtml(o, sec){
    const c = o.cfg, card = (k, title, sub, body)=>{ const s = SECS.find(x=> x[0] === k);
      return `<div class="gm-card gm-ed-card"><span class="gm-ch gm-ch-l"><span class="g2-ico ${s[3]}">${ic(ICON[s[2]])}</span><span class="gm-cht"><b>${title}</b><small>${sub}</small></span></span>${body}</div>`; };
    const hint = '<p class="gm-note">Leave a box empty to use the built-in words (translated for each worker). Words you type are shown as typed.</p>';
    if(sec === 'rh') return card('rh', 'Humidity', 'Each row holds until the next one.', `<div class="gm-rows">${rowsEditor('rh', c.rh, '%', 'text', false)}</div>`);
    if(sec === 'light') return card('light', 'Hours of dark', 'Each row holds until the next one. Keep the dark in one block.', `<div class="gm-rows">${rowsEditor('dark', c.dark, 'h dark', 'number', false)}</div>`)
      + card('light', 'Lighting note', 'Shown on the crew\'s lighting card.', textBox(o, 'light_n', 'Note', 2));
    if(sec === 'drink') return card('drink', 'Drinker line', 'The words change with the birds\' age.', [0, 1, 2].map(s=> textBox(o, 'drink_' + s, ['Day 0–2 · ', 'Day 3–10 · ', 'Day 11 on · '][s] + tt('dtag' + s), 3, G.scene('drink', [1, 6, 24][s], o.kg))).join('') + hint);
    if(sec === 'feed') return card('feed', 'Feeder pans', 'The words change with the birds\' age.', textBox(o, 'feed_0', 'Day 0–3 · ' + tt('ftagF'), 3, G.scene('feed', 2, o.kg)) + textBox(o, 'feed_1', 'Day 8 on · ' + tt('ftagB'), 3, G.scene('feed', 20, o.kg)) + hint);
    if(sec === 'checks') return card('checks', 'Quick checks', 'Turn a check off to hide it from the crew. Edit the words if you like.', o.checks.map(([k])=>{ const [i, tone] = U.CHECK_LOOK[k] || ['good', 'g2-teal'], off = c.hidden.includes(k);
      return `<details class="gm-chk${off ? ' off' : ''}"><summary><span class="g2-ico ${tone}">${ic(ICON[i], 16)}</span><b>${esc(o.X('g_' + k + '_t'))}</b>
        <label class="gm-sw" title="Show to the crew"><input type="checkbox" data-gm-hide="${k}"${off ? '' : ' checked'}><i></i></label></summary>
        <div class="gm-chk-b"><label class="gm-txt-l">Name<input class="gm-in" data-gm-text="${k}_t" value="${esc(c.text[k + '_t'] || '')}" placeholder="${esc(o.T('g_' + k + '_t'))}"></label>
        <label class="gm-txt-l">${esc(o.T('g_signs'))}<textarea class="gm-in gm-ta" rows="2" data-gm-text="${k}_s" placeholder="${esc(o.T('g_' + k + '_s'))}">${esc(c.text[k + '_s'] || '')}</textarea></label>
        <label class="gm-txt-l">${esc(o.T('g_do'))}<textarea class="gm-in gm-ta" rows="2" data-gm-text="${k}_a" placeholder="${esc(o.T('g_' + k + '_a'))}">${esc(c.text[k + '_a'] || '')}</textarea></label></div></details>`; }).join('') + hint);
    if(sec === 'own') return card('own', 'Your own cards', 'Extra cards for the crew, shown with the quick checks.', c.custom.map(x=> `<div class="gm-own"><div class="gm-own-r"><input class="gm-in gm-own-ic" maxlength="4" data-gm-own="${esc(x.id)}:icon" value="${esc(x.icon || '')}" placeholder="📌" aria-label="Icon">
        <input class="gm-in" data-gm-own="${esc(x.id)}:title" value="${esc(x.title || '')}" placeholder="Card title, e.g. Tunnel mode steps" aria-label="Card title"><button type="button" class="gm-x" data-gm-own-del="${esc(x.id)}" aria-label="Delete card" title="Delete this card">${ic(ICON.x, 16)}</button></div>
        <textarea class="gm-in gm-ta" rows="3" data-gm-own="${esc(x.id)}:body" placeholder="What workers should know or do…" aria-label="Card text">${esc(x.body || '')}</textarea></div>`).join('')
      + `<span class="gm-add"><button type="button" class="gm-btn" data-gm-own-add>${ic(ICON.plus, 15)}Add your own card</button></span>`);
    return tempEditor(c);
  }
  function editHtml(o){
    const c = o.cfg, sec = SECS.some(s=> s[0] === o.sec) ? o.sec : 'temp';
    const count = { temp: G.spRows(c.temp).length + ' set points', rh: String(c.rh.length), light: String(c.dark.length), drink: 'words', feed: 'words',
      checks: (o.checks.length - o.checks.filter(([k])=> c.hidden.includes(k)).length) + ' shown', own: String(c.custom.length), std: 'Ross 308' };
    const nav = SECS.map(([k, label, i, tone])=> `<button type="button" class="gm-nv${k === sec ? ' on' : ''}" ${k === 'std' ? 'data-gm-tab="std"' : `data-gm-sec="${k}"`}><span class="g2-ico ${tone}">${ic(ICON[i], 15)}</span><span>${label}</span><small>${esc(count[k])}</small></button>`).join('');
    return `<div class="g2 g2-wide gm gm-edit${sec === 'temp' ? ' gm-has-side' : ''}"><nav class="gm-nav" aria-label="Guide sections">${nav}</nav>
      <div class="gm-ed-main">${sectionHtml(o, sec)}</div>${sec === 'temp' ? `<aside class="gm-ed-side">${calendar(c)}</aside>` : ''}</div>`;
  }

  // ---------- Standards ----------
  function stdHtml(o){
    const tab = o.std === 'cobb' || o.std === 'gen' ? o.std : 'ross';
    const seg = `<span class="gm-seg">${[['ross', 'Ross 308'], ['cobb', 'Cobb 500'], ['gen', 'General guide']].map(([k, l])=> `<button type="button" class="${k === tab ? 'on' : ''}" data-gm-std="${k}">${l}</button>`).join('')}</span>`;
    if(tab === 'gen') return `<div class="g2 g2-wide gm gm-std">${seg}<div class="gm-gen">${GEN.map(g=> `<div class="gm-card"><span class="gm-ch gm-ch-l"><span class="g2-ico ${g.tone}">${ic(ICON[g.i], 16)}</span><b>${g.t}</b></span>
      ${g.rows.map(([k, v])=> `<span class="gm-kv"><span>${k}</span><b>${v}</b></span>`).join('')}</div>`).join('')}</div>
      <div class="gm-card gm-src">Good practice for any breed, from the breed handbooks and common farm codes — check your integrator's and your country's rules. Your own targets live in Edit guide.</div></div>`;
    const S = STD[tab], R = S.rows;
    const rows = R.slice(0, 43).map((r, d)=> `<tr class="${d % 7 === 0 && d ? 'wk' : ''}${o.age === d ? ' now' : ''}"><td>${d}</td><td>${fmt(r[0])}</td><td>${r[1] || '—'}</td><td>${r[2] || '—'}</td><td>${r[3] ? fmt(r[3]) : '—'}</td><td>${r[4] ? r[4].toFixed(3) : '—'}</td><td>${r[2] ? Math.round(r[2] * 1.8) : '—'}</td></tr>`).join('');
    const B = { x: 40, y: 10, w: 470, h: 196 }, top = 3400, X = d=> (B.x + d / 42 * B.w).toFixed(1), Y = v=> (B.y + B.h - v / top * B.h).toFixed(1);
    const wPath = R.slice(0, 43).map((r, d)=> (d ? 'L' : 'M') + X(d) + ' ' + Y(r[0])).join(' ');
    const fPts = R.slice(0, 43).map((r, d)=> [d, r[2]]).filter(p=> p[1]);
    const fPath = fPts.map((p, i)=> (i ? 'L' : 'M') + X(p[0]) + ' ' + Y(p[1] * 14)).join(' ');
    const chart = `<svg class="gm-chart" viewBox="0 0 520 230" role="img" aria-label="${S.name} weight and feed by day">
      ${[0, 1000, 2000, 3000].map(v=> `<line x1="40" x2="510" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--g2-line)"/><text x="34" y="${(+Y(v) + 4).toFixed(1)}" text-anchor="end">${v ? v / 1000 + ' kg' : '0'}</text>`).join('')}
      ${[0, 7, 14, 21, 28, 35, 42].map(d=> `<text x="${X(d)}" y="224" text-anchor="middle">d${d}</text>`).join('')}
      <path d="${wPath}" fill="none" stroke="var(--g2-teal)" stroke-width="2.5"/><path d="${fPath}" fill="none" stroke="#E39813" stroke-width="2.5" stroke-dasharray="6 4"/></svg>`;
    const mk = (d, s)=> `<div class="gm-card gm-mark"><span class="g2-cap">Day ${d}</span><b>${kgTxt(R[d][0] / 1000)}</b><small>${s}</small></div>`;
    const marks = mk(7, (R[7][0] / R[0][0]).toFixed(1) + ' × the ' + R[0][0] + ' g chick') + mk(35, 'FCR ' + R[35][4].toFixed(3)) + mk(42, 'FCR ' + R[42][4].toFixed(3) + ' · ' + (R[42][3] / 1000).toFixed(2) + ' kg feed');
    return `<div class="g2 g2-wide gm gm-std">${seg}<div class="gm-std-g">
      <div class="gm-card gm-tbl"><table><thead><tr><th>Day</th><th>Weight g</th><th>Gain g/day</th><th>Feed g/day</th><th>Feed so far g</th><th>FCR</th><th>Water ml/day</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="gm-std-r"><div class="gm-card gm-ed-card"><span class="gm-ch gm-ch-l"><span class="g2-ico g2-teal">${ic(ICON.weight, 16)}</span><b>Weight and feed by day</b>
          <span class="gm-key"><span><i style="background:var(--g2-teal)"></i>Weight</span><span><i style="background:#E39813"></i>Feed a day</span></span></span>${chart}</div>
        <div class="gm-marks">${marks}</div>
        <div class="gm-card gm-src">${esc(S.src)} Water is worked out at 1.8 × feed (21 °C). Days 43–56 are in the breed's full table.</div></div></div></div>`;
  }

  // ---------- page header (tabs + actions) ----------
  function headHtml(o){
    const tabs = `<span class="gm-seg gm-tabs">${[['sheds', 'Sheds'], ['edit', 'Edit guide'], ['std', 'Standards']].map(([k, l])=> `<button type="button" class="${k === o.tab ? 'on' : ''}" data-gm-tab="${k}">${l}</button>`).join('')}</span>`;
    let right = '';
    if(o.tab === 'sheds') right = `<button type="button" class="gm-btn gm-crewbtn${o.crew ? ' on' : ''}" data-gm-crew title="See the guide as it looks on a crew phone">${ic(ICON.phone, 16)}${o.crew ? 'Manager view' : 'Crew view'}</button>`;
    else if(o.tab === 'edit') right = (o.dirty ? `<span class="gm-dirty">${o.dirty} change${o.dirty > 1 ? 's' : ''} not applied</span>` : '<span class="gm-dirty gm-clean">All changes applied</span>')
      + `<button type="button" class="gm-btn" data-gm-discard${o.dirty ? '' : ' disabled'}>Discard</button><button type="button" class="gm-btn gm-apply" data-gm-apply${o.dirty ? '' : ' disabled'}>Apply</button>`;
    else right = `<span class="gm-uses">${ic(ICON.book, 15)}Guide uses Ross 308</span>`;
    return tabs + `<span class="gm-right">${right}</span>`;
  }

  const CSS = `
  .gm{ gap:14px; }
  .gm button{ font-family:inherit; cursor:pointer; }
  .gm-card{ background:var(--g2-card); border:1px solid var(--g2-line); border-radius:16px; min-width:0; box-sizing:border-box; }
  .gm-ch{ display:flex; align-items:center; gap:10px; padding:12px 14px; }
  .gm-ch > b{ flex:1; font-size:15.5px; font-weight:800; }
  .gm-ch .g2-ico{ width:36px; height:36px; border-radius:10px; }
  .gm-ch .g2-tag{ font-size:12px; padding:4px 10px; }
  .gm-btn, .gm-head-host .gm-btn{ height:38px; padding:0 14px; border-radius:10px; border:1px solid var(--g2-line); background:var(--g2-card); color:var(--g2-ink); font-weight:700; font-size:13px; display:inline-flex; align-items:center; gap:7px; white-space:nowrap; }
  .gm-btn:hover:not(:disabled){ border-color:var(--g2-muted); }
  .gm-btn:disabled{ opacity:.45; cursor:default; }
  .gm-btn.gm-apply{ background:#F0A21A; border-color:#E39813; color:#16191B; }
  .gm-btn.on{ background:var(--g2-ink); border-color:var(--g2-ink); color:var(--g2-card); }
  .gm-seg{ display:inline-flex; padding:3px; border-radius:11px; background:var(--g2-grey-s, #EEF0EC); gap:2px; max-width:100%; overflow-x:auto; scrollbar-width:none; flex-shrink:0; }
  .gm-seg button, .gm-head-host .gm-seg button{ height:32px; padding:0 14px; border:0; border-radius:9px; background:transparent; color:var(--g2-muted, #5E666A); font-size:13px; font-weight:700; white-space:nowrap; }
  .gm-seg button.on{ background:var(--g2-card, #fff); color:var(--g2-ink, #16191B); box-shadow:0 1px 2px rgba(0,0,0,.08); }
  .gm-right{ display:flex; align-items:center; gap:10px; }
  .gm-dirty{ font-size:12.5px; font-weight:700; color:var(--g2-amber, #8A5300); white-space:nowrap; }
  .gm-dirty.gm-clean{ color:var(--g2-muted, #5E666A); font-weight:600; }
  .gm-uses{ display:inline-flex; align-items:center; gap:7px; height:38px; padding:0 12px; border-radius:10px; background:var(--g2-violet-s, #EEEAFC); color:var(--g2-violet, #5B44C2); font-size:13px; font-weight:700; white-space:nowrap; }
  .gm-head-host{ --g2-card:var(--surface,#fff); --g2-ink:var(--ink,#16191B); --g2-line:var(--line,#E2E5DF); --g2-muted:var(--muted,#5E666A); --g2-grey-s:#EEF0EC; --g2-amber:#8A5300; --g2-violet:#5B44C2; --g2-violet-s:#EEEAFC; --g2-ink-c:var(--ink,#16191B); }
  body.theme-dark .gm-head-host{ --g2-grey-s:rgba(255,255,255,.06); --g2-amber:#F5B524; --g2-violet:#A893FF; --g2-violet-s:rgba(168,147,255,.15); }
  /* Sheds */
  .gm-bar{ display:flex; align-items:center; gap:16px; flex-wrap:wrap; }
  .gm-pills{ display:flex; gap:8px; overflow-x:auto; scrollbar-width:none; min-width:0; max-width:100%; }
  .gm-pills::-webkit-scrollbar{ display:none; }
  .gm-pill{ min-width:58px; height:50px; }
  .gm-tot{ margin-left:auto; display:flex; gap:26px; font-variant-numeric:tabular-nums; }
  .gm-tot span{ display:flex; flex-direction:column; gap:1px; }
  .gm-tot small{ font-size:11.5px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:var(--g2-muted); }
  .gm-tot b{ font-family:'Sora',sans-serif; font-size:21px; font-weight:700; white-space:nowrap; }
  .gm-tot i{ font-style:normal; font-family:'Inter',sans-serif; font-size:12.5px; font-weight:600; color:var(--g2-muted); }
  .gm-title{ display:flex; align-items:flex-end; gap:14px 30px; flex-wrap:wrap; }
  .gm-daystep{ align-self:center; }
  .gm-tt{ display:flex; flex-direction:column; gap:3px; }
  .gm-sub{ font-size:12.5px; font-weight:600; color:var(--g2-muted); }
  .gm-day{ font-family:'Sora',sans-serif; font-weight:700; font-size:34px; line-height:1.05; letter-spacing:-.02em; }
  .gm-say{ display:flex; align-items:flex-end; gap:8px; min-width:0; max-width:580px; }
  .gm-say .g2-plumo{ width:52px; height:52px; }
  .gm-say .g2-bubble{ font-size:14.5px; }
  .gm-grid{ display:grid; grid-template-columns:minmax(0,1.15fr) minmax(0,1.15fr) minmax(0,1fr); gap:14px; align-items:start; }
  .gm-grid-e{ grid-template-columns:minmax(0,2.3fr) minmax(0,1fr); }
  .gm-col{ display:flex; flex-direction:column; gap:14px; min-width:0; }
  .gm-pic{ overflow:hidden; }
  .gm-pic p{ margin:0; padding:12px 14px 14px; font-size:14px; font-weight:600; line-height:1.45; }
  .gm-tc, .gm-lc{ padding:14px 16px; display:flex; flex-direction:column; gap:8px; }
  .gm-tc .gm-ch, .gm-lc .gm-ch{ padding:0; }
  .gm-tbig{ display:flex; align-items:baseline; gap:10px; }
  .gm-tbig b{ font-family:'Sora',sans-serif; font-size:46px; font-weight:700; line-height:1; letter-spacing:-.02em; }
  .gm-tbig span, .gm-tf{ font-size:13px; font-weight:600; color:var(--g2-muted); }
  .gm-ramp{ font-size:13px; font-weight:600; }
  .gm-sparkw{ position:relative; display:block; height:64px; }
  .gm-spark{ display:block; width:100%; height:64px; }
  .gm-dot{ position:absolute; width:9px; height:9px; margin:-6.5px 0 0 -6.5px; border-radius:50%; background:var(--g2-card); border:2px solid var(--g2-ink); }
  .gm-axis{ display:flex; justify-content:space-between; font-size:12px; font-weight:600; color:var(--g2-muted); font-variant-numeric:tabular-nums; }
  .gm-tf{ display:flex; gap:16px; flex-wrap:wrap; border-top:1px solid var(--g2-line); padding-top:8px; }
  .gm-tf b{ color:var(--g2-ink); }
  .gm-clock{ display:flex; align-items:center; gap:14px; }
  .gm-clock svg{ flex-shrink:0; }
  .gm-clock > span{ display:flex; flex-direction:column; gap:3px; font-size:15px; font-weight:800; }
  .gm-clock small{ font-size:13px; font-weight:600; color:var(--g2-muted); }
  .gm-ross{ padding:10px 14px; display:flex; align-items:center; gap:14px 22px; flex-wrap:wrap; }
  .gm-ross > .g2-cap{ width:130px; font-size:11.5px; }
  .gm-rs{ display:flex; align-items:center; gap:9px; }
  .gm-rs .g2-ico{ width:28px; height:28px; border-radius:50%; }
  .gm-rv{ display:flex; flex-direction:column; font-variant-numeric:tabular-nums; }
  .gm-rv small{ font-size:12px; font-weight:600; color:var(--g2-muted); }
  .gm-rv b{ font-size:17px; font-weight:800; white-space:nowrap; }
  .gm-rt{ margin-left:6px; padding-left:12px; border-left:1px solid var(--g2-line); }
  .gm-rt b{ font-size:15px; }
  .gm-qcs{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
  .gm-qcs .g2-cap{ font-size:11.5px; margin-right:4px; }
  .gm-qc{ height:36px; padding:0 12px 0 4px; border-radius:999px; border:1px solid var(--g2-line); background:var(--g2-card); color:var(--g2-ink); display:inline-flex; align-items:center; gap:8px; font-size:13px; font-weight:700; white-space:nowrap; }
  .gm-qc:hover{ border-color:var(--g2-muted); }
  .gm-qc .g2-ico{ width:28px; height:28px; border-radius:50%; font-size:14px; }
  .gm-ready{ padding:14px 16px; display:flex; flex-direction:column; gap:10px; }
  .gm-ready-l{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px 18px; }
  .gm-ready .g2-li{ display:flex; gap:10px; align-items:flex-start; }
  .gm-ready .g2-li > span:last-child{ display:flex; flex-direction:column; gap:2px; font-size:13px; font-weight:600; color:var(--g2-muted); line-height:1.4; }
  .gm-ready .g2-li b{ font-size:14px; color:var(--g2-ink); }
  .gm-crop{ border-top:1px solid var(--g2-line); padding-top:12px; display:flex; flex-direction:column; gap:8px; }
  .gm-crop p{ margin:0; font-size:13.5px; font-weight:600; line-height:1.45; }
  .gm-crop-n{ display:flex; gap:24px; }
  .gm-crop-n span{ display:flex; flex-direction:column; } .gm-crop-n small{ font-size:12px; font-weight:600; color:var(--g2-muted); } .gm-crop-n b{ font-size:17px; }
  /* Edit guide */
  .gm-edit{ flex-direction:row; align-items:flex-start; gap:22px; }
  .gm-nav{ width:230px; flex-shrink:0; display:flex; flex-direction:column; gap:4px; position:sticky; top:0; }
  .gm-nv{ height:42px; border-radius:11px; padding:0 10px; display:flex; align-items:center; gap:10px; font-size:14px; font-weight:700; background:transparent; border:1px solid transparent; color:var(--g2-ink); text-align:left; }
  .gm-nv:hover{ background:var(--g2-card); }
  .gm-nv.on{ background:var(--g2-card); border-color:var(--g2-line); }
  .gm-nv .g2-ico{ width:28px; height:28px; border-radius:50%; }
  .gm-nv > span:nth-child(2){ flex:1; }
  .gm-nv small{ font-size:12px; font-weight:600; color:var(--g2-muted); }
  .gm-ed-main{ flex:1; min-width:0; display:flex; flex-direction:column; gap:14px; }
  .gm-ed-side{ width:300px; flex-shrink:0; position:sticky; top:0; }
  .gm-ed-card{ padding:16px 18px; display:flex; flex-direction:column; gap:10px; }
  .gm-ch-l{ padding:0; }
  .gm-cht{ flex:1; display:flex; flex-direction:column; gap:2px; min-width:0; }
  .gm-cht b{ font-size:16px; font-weight:800; }
  .gm-cht small{ font-size:12.5px; font-weight:600; color:var(--g2-muted); }
  .gm-chart{ display:block; width:100%; height:auto; }
  .gm-chart text{ font-size:11px; font-weight:600; fill:var(--g2-muted); font-family:'Inter',sans-serif; }
  .gm-chart text.gm-chart-v{ font-size:12px; font-weight:800; fill:var(--g2-ink); }
  .gm-ed-rows{ padding:6px 18px 12px; }
  .gm-sp{ display:grid; grid-template-columns:150px 150px minmax(0,1fr) 34px; gap:14px; align-items:center; padding:7px 0; border-bottom:1px solid var(--g2-line); }
  .gm-sp label{ display:flex; align-items:center; gap:8px; font-size:13px; font-weight:600; color:var(--g2-muted); }
  .gm-in, .g2.gm input.gm-in, .g2.gm textarea.gm-in{ height:36px; border-radius:9px; border:1px solid var(--g2-line); background:var(--g2-card); color:var(--g2-ink); padding:0 10px; font:700 14px 'Inter',sans-serif; box-sizing:border-box; font-variant-numeric:tabular-nums; min-width:0; }
  .g2.gm .gm-in::placeholder{ color:var(--g2-muted); opacity:.75; font-weight:500; }
  .g2.gm .gm-in:focus{ outline:2px solid #F0A21A; outline-offset:0; border-color:#F0A21A; }
  .g2.gm input.gm-in-d{ width:62px; } .g2.gm input.gm-in-v{ width:78px; } .g2.gm input.gm-own-ic{ width:52px; }
  .gm-ta, .g2.gm textarea.gm-ta{ height:auto; width:100%; padding:8px 10px; font-weight:600; font-size:13.5px; line-height:1.45; resize:vertical; }
  .gm-rampchip{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-size:12.5px; font-weight:700; color:var(--g2-amber); background:var(--g2-amber-s); border:1px dashed color-mix(in srgb, var(--g2-amber) 40%, transparent); border-radius:10px; padding:6px 10px; }
  .gm-rampchip small{ font-size:12.5px; font-weight:600; color:var(--g2-muted); }
  .gm-hold{ font-size:12.5px; font-weight:600; color:var(--g2-muted); }
  .gm-x{ width:34px; height:34px; border-radius:9px; border:0; background:transparent; color:var(--g2-muted); display:inline-flex; align-items:center; justify-content:center; }
  .gm-x:hover:not(:disabled){ background:var(--g2-coral-s); color:var(--g2-coral); }
  .gm-x:disabled{ opacity:.3; cursor:default; }
  .gm-add{ display:flex; margin-top:10px; }
  .gm-rows .gm-sp{ grid-template-columns:150px 170px minmax(0,1fr) 34px; }
  .gm-cal-card{ padding:14px; display:flex; flex-direction:column; gap:10px; }
  .gm-cal{ display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:4px; font-variant-numeric:tabular-nums; }
  .gm-cal span{ border-radius:7px; padding:4px 0 5px; display:flex; flex-direction:column; align-items:center; font-size:12.5px; font-weight:800; line-height:1.1; background:var(--g2-grey-s); }
  .gm-cal small{ font-size:9.5px; font-weight:700; color:var(--g2-muted); }
  .gm-cal span.sp{ background:var(--g2-coral); color:#fff; } .gm-cal span.sp small{ color:rgba(255,255,255,.8); }
  .gm-cal-sub{ margin-top:-6px; font-size:12px; font-weight:600; color:var(--g2-muted); }
  .gm-legend{ display:flex; align-items:center; gap:6px 8px; flex-wrap:wrap; font-size:12.5px; font-weight:600; color:var(--g2-muted); }
  .gm-legend i{ width:16px; height:12px; border-radius:3px; background:var(--g2-grey-s); border:1px solid var(--g2-line); margin-left:6px; } .gm-legend i:first-child{ margin-left:0; }
  .gm-legend i.sp{ background:var(--g2-coral); border-color:var(--g2-coral); }
  .gm-txt{ display:flex; gap:14px; align-items:flex-start; padding:10px 0; border-top:1px solid var(--g2-line); }
  .gm-txt-pic{ width:170px; flex-shrink:0; border-radius:10px; overflow:hidden; }
  .gm-txt-b{ flex:1; display:flex; flex-direction:column; gap:6px; min-width:0; }
  .gm-txt-l{ display:flex; flex-direction:column; gap:6px; font-size:13px; font-weight:700; color:var(--g2-muted); }
  .gm-note{ margin:0; font-size:12.5px !important; font-weight:600; color:var(--g2-muted); }
  .gm-chk{ border-top:1px solid var(--g2-line); }
  .gm-chk summary{ list-style:none; display:flex; align-items:center; gap:10px; padding:10px 0; cursor:pointer; }
  .gm-chk summary::-webkit-details-marker{ display:none; }
  .gm-chk summary .g2-ico{ width:30px; height:30px; border-radius:50%; }
  .gm-chk summary b{ flex:1; font-size:14px; }
  .gm-chk.off summary b, .gm-chk.off summary .g2-ico{ opacity:.45; }
  .gm-chk-b{ display:flex; flex-direction:column; gap:10px; padding:0 0 12px 40px; }
  .gm-sw{ position:relative; width:38px; height:22px; flex-shrink:0; }
  .gm-sw input{ position:absolute; inset:0; opacity:0; margin:0; cursor:pointer; }
  .gm-sw i{ position:absolute; inset:0; border-radius:11px; background:var(--g2-line); pointer-events:none; transition:background .15s; }
  .gm-sw i::after{ content:''; position:absolute; left:3px; top:3px; width:16px; height:16px; border-radius:50%; background:#fff; transition:left .15s; }
  .gm-sw input:checked + i{ background:var(--g2-teal); } .gm-sw input:checked + i::after{ left:19px; }
  .gm-own{ display:flex; flex-direction:column; gap:8px; padding:10px 0; border-top:1px solid var(--g2-line); }
  .gm-own-r{ display:flex; gap:8px; align-items:center; } .gm-own-r .gm-in:nth-child(2){ flex:1; }
  .gm-own-ic{ width:52px; text-align:center; }
  /* Standards */
  .gm-std > .gm-seg{ align-self:flex-start; }
  .gm-std-g{ display:grid; grid-template-columns:minmax(0,1.25fr) minmax(0,1fr); gap:16px; align-items:start; }
  .gm-tbl{ overflow:auto; max-height:calc(100vh - 200px); }
  .gm-tbl table{ width:100%; border-collapse:collapse; font-size:13px; font-variant-numeric:tabular-nums; }
  .gm-tbl th{ position:sticky; top:0; background:var(--g2-card); text-align:right; font-size:11px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; color:var(--g2-muted); padding:9px 12px; border-bottom:1px solid var(--g2-line); white-space:nowrap; }
  .gm-tbl td{ text-align:right; padding:7px 12px; border-bottom:1px solid var(--g2-line); font-weight:600; white-space:nowrap; }
  .gm-tbl th:first-child, .gm-tbl td:first-child{ text-align:left; font-weight:800; }
  .gm-tbl tr.wk td{ background:var(--g2-amber-s); font-weight:800; }
  .gm-std-r{ display:flex; flex-direction:column; gap:12px; min-width:0; }
  .gm-key{ display:flex; gap:12px; font-size:12.5px; font-weight:600; color:var(--g2-muted); }
  .gm-key span{ display:flex; align-items:center; gap:5px; } .gm-key i{ width:10px; height:10px; border-radius:50%; }
  .gm-marks{ display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }
  .gm-mark{ padding:12px 14px; display:flex; flex-direction:column; gap:3px; }
  .gm-mark b{ font-family:'Sora',sans-serif; font-size:24px; font-weight:700; font-variant-numeric:tabular-nums; }
  .gm-mark small{ font-size:12.5px; font-weight:600; color:var(--g2-muted); }
  .gm-src{ padding:12px 14px; font-size:12.5px; font-weight:600; color:var(--g2-muted); line-height:1.5; }
  .gm-gen{ display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
  .gm-gen > .gm-card{ padding:14px 16px; display:flex; flex-direction:column; gap:8px; }
  .gm-gen .gm-ch b{ font-size:15px; }
  .gm-kv{ display:flex; gap:8px; font-size:13px; border-top:1px solid var(--g2-line); padding-top:7px; }
  .gm-kv span{ color:var(--g2-muted); font-weight:600; } .gm-kv b{ margin-left:auto; text-align:right; }
  @media (max-width:1180px){
    .gm-grid{ grid-template-columns:repeat(2,minmax(0,1fr)); } .gm-grid > .gm-col{ grid-column:1 / -1; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); }
    .gm-grid-e{ grid-template-columns:1fr; }
    .gm-ed-side{ display:none; } .gm-std-g{ grid-template-columns:1fr; } .gm-gen{ grid-template-columns:repeat(2,minmax(0,1fr)); }
  }
  @media (max-width:760px){
    .gm-grid, .gm-grid > .gm-col, .gm-ready-l, .gm-gen, .gm-marks{ grid-template-columns:1fr; }
    .gm-tot{ margin-left:0; gap:18px; } .gm-tot b{ font-size:17px; }
    .gm-edit{ flex-direction:column; gap:12px; }
    .gm-nav{ width:100%; flex-direction:row; overflow-x:auto; position:static; scrollbar-width:none; }
    .gm-nv{ flex-shrink:0; } .gm-nv small{ display:none; }
    .gm-sp, .gm-rows .gm-sp{ grid-template-columns:auto auto 34px; } .gm-sp > span:not(.gm-add){ grid-column:1 / -1; grid-row:2; }
    .gm-txt{ flex-direction:column; } .gm-txt-pic{ width:100%; max-width:240px; }
    .gm-chk-b{ padding-left:0; }
    .gm-ch-l{ flex-wrap:wrap; } .gm-ch-l .gm-cht{ flex:1 1 200px; } .gm-ch-l > .gm-btn{ margin-left:46px; }
    .gm-tbl{ max-height:none; }
  }`;
  (function(){ const st = document.createElement('style'); st.id = 'cwGuideMgrCss'; st.textContent = CSS; (document.head || document.documentElement).appendChild(st); })();

  window.CWGuideMgr = { shedsHtml, editHtml, stdHtml, headHtml, SECS, STD };
})();
