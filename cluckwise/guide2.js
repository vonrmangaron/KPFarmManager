// Farm guide, per shed (2026-11-03, mockup 1j4jqFay5tjcjmtZv192Xr). Shared by the Crew app (viewer.html)
// and Tasks (index.html), so the two guides can't drift apart.
//   CWGuide2.shedList(batches, todayKey) → every shed with its own age (or empty + next chicks date)
//   CWGuide2.html(o) → the page for o.view: home (shed tiles + quick checks), one shed, an empty shed,
//     or a quick check (the manager's Sheds / Edit guide / Standards pages live in guide-mgr.js)
//   CWGuide2.scene(kind, age) → the drinker / feeder drawing for a bird of that age
// Drawings are sized from the Ross 308 weight for the day: a yellow chick to day 10, half-feathered
// to day 14, white with a comb from day 15. Drinkers are Big Dutchman one-arm drip cups.
(function(){
  const TXT = {
    en: {
      hi:"Tap your shed. I'll show you what's right for its age today.", checks:'Quick checks', every:'every shed',
      shed:'Shed {n}', day:'Day {n}', empty:'Empty', birds:'{n} birds', back:'Back', chicks:'Chicks {d}',
      tip0:'Chicks first! Warm floor, water and feed close by. Walk slow.',
      tip1:'Still babies. Keep them warm, and lift the drinkers a little every couple of days.',
      tip2:'Growing fast! Lift drinkers and pans to their height.',
      tip3:'Big birds now. Watch for heat — panting means they need more air.',
      dtag0:'Eye level', dtag1:'Just above head', dtag2:'Stretch up', ftagF:'On the floor', ftagB:'Back height',
      feedF:'Pans still down on the litter, full of feed. Chicks walk in to eat.',
      temp:'Temperature', rh:'Humidity {rh} %', ctrl:'The shed controller should show about this.',
      light:'Lighting', lh:'{h} h light', dh:'{h} h dark', bright:'Bright — 30 to 40 lux so chicks find feed and water.', dim:'Dim — 5 to 10 lux. Dark hours all in one block.',
      ross:'Ross 308 · day {n} · per bird', weight:'Weight', feed:'Feed', water:'Water', target:'target', aday:'a day', whole:'Whole shed today',
      note:"Targets from the Ross 308 handbook and your manager's settings. If the shed looks wrong, tell your manager.",
      emptyHi:'No birds yet. This is how Shed {n} should look when the chicks walk in.', ready:'Ready for chicks',
      r1t:'Heat on early', r1d:'Warm the shed for 1–2 days before chicks come. Floor 28–30°, air {t}° at chick height.',
      r2t:'Humidity {rh} %', r2d:'Check the controller screen.',
      r3t:'Litter even', r3d:'Spread flat and level. No wet or caked patches.',
      r4t:'Water fresh', r4d:'Flush every line. Nipples at chick eye level, a drop showing on each.',
      r5t:'Feed down', r5d:'Pans down on the litter and full. Paper with feed near the drinkers.',
      r6t:'Lights bright', r6d:'30–40 lux, even across the shed. {lh} h light, {dh} h dark.',
      crop:'After they arrive · crop check', cropD:'Pick up 10 chicks from different spots. Feel the crop (under the neck): soft and round means it has eaten and drunk.',
      crop8:'8 hours in', cropAm:'Next morning', of10:'{a} of 10', full:'soft and full', cropW:'Hard or empty crops? Tell your manager.',
      see:'You will see', doit:'Do this', tell:'Tell the manager', hiAlert:'Act now, then tell the manager.', hiCheck:'Check this on every walk.',
      noBatch:'No batch running — showing day {n}. Use − / + to look at any age.'
    },
    es: {
      hi:'Toca tu galpón. Te muestro lo correcto para su edad hoy.', checks:'Revisiones rápidas', every:'todos los galpones',
      shed:'Galpón {n}', day:'Día {n}', empty:'Vacío', birds:'{n} aves', back:'Volver', chicks:'Pollitos {d}',
      tip0:'¡Primero los pollitos! Piso tibio, agua y alimento cerca. Camina despacio.',
      tip1:'Todavía son bebés. Mantenlos calientes y sube un poco los bebederos cada par de días.',
      tip2:'¡Crecen rápido! Sube bebederos y platos a su altura.',
      tip3:'Ya son aves grandes. Cuidado con el calor: si jadean necesitan más aire.',
      dtag0:'Altura de los ojos', dtag1:'Justo sobre la cabeza', dtag2:'Estirados', ftagF:'En el piso', ftagB:'Altura del lomo',
      feedF:'Platos todavía en la cama, llenos de alimento. Los pollitos entran a comer.',
      temp:'Temperatura', rh:'Humedad {rh} %', ctrl:'El controlador del galpón debe mostrar más o menos esto.',
      light:'Iluminación', lh:'{h} h de luz', dh:'{h} h de oscuridad', bright:'Brillante: 30 a 40 lux para que encuentren agua y alimento.', dim:'Tenue: 5 a 10 lux. Las horas de oscuridad en un solo bloque.',
      ross:'Ross 308 · día {n} · por ave', weight:'Peso', feed:'Alimento', water:'Agua', target:'objetivo', aday:'al día', whole:'Todo el galpón hoy',
      note:'Objetivos del manual Ross 308 y de tu encargado. Si el galpón se ve mal, avisa al encargado.',
      emptyHi:'Todavía no hay aves. Así debe verse el Galpón {n} cuando entren los pollitos.', ready:'Listo para los pollitos',
      r1t:'Calefacción temprano', r1d:'Calienta el galpón 1–2 días antes. Piso 28–30°, aire {t}° a la altura de los pollitos.',
      r2t:'Humedad {rh} %', r2d:'Revisa la pantalla del controlador.',
      r3t:'Cama pareja', r3d:'Plana y nivelada. Sin partes mojadas ni apelmazadas.',
      r4t:'Agua fresca', r4d:'Purga cada línea. Niples a la altura de los ojos, con una gota en cada uno.',
      r5t:'Alimento abajo', r5d:'Platos en la cama y llenos. Papel con alimento cerca de los bebederos.',
      r6t:'Luces fuertes', r6d:'30–40 lux, parejo en todo el galpón. {lh} h de luz, {dh} h de oscuridad.',
      crop:'Al llegar · revisión del buche', cropD:'Toma 10 pollitos de distintos lugares. Toca el buche (bajo el cuello): blando y redondo significa que comió y bebió.',
      crop8:'A las 8 horas', cropAm:'A la mañana siguiente', of10:'{a} de 10', full:'blandos y llenos', cropW:'¿Buches duros o vacíos? Avisa al encargado.',
      see:'Verás', doit:'Haz esto', tell:'Avisar al encargado', hiAlert:'Actúa ya y luego avisa al encargado.', hiCheck:'Revisa esto en cada recorrido.',
      noBatch:'No hay lote activo — mostrando el día {n}. Usa − / + para ver cualquier edad.'
    },
    tl: {
      hi:'I-tap ang kulungan mo. Ipapakita ko kung ano ang tama sa edad nito ngayon.', checks:'Mabilisang tsek', every:'lahat ng kulungan',
      shed:'Kulungan {n}', day:'Araw {n}', empty:'Walang laman', birds:'{n} ibon', back:'Bumalik', chicks:'Sisiw {d}',
      tip0:'Sisiw muna! Mainit na sahig, tubig at pakain na malapit. Maglakad nang dahan-dahan.',
      tip1:'Mga sanggol pa. Panatilihing mainit, at itaas nang kaunti ang inuman kada ilang araw.',
      tip2:'Mabilis lumaki! Itaas ang inuman at pakainan sa taas nila.',
      tip3:'Malalaki na. Bantayan ang init — kapag humihingal, kailangan ng mas maraming hangin.',
      dtag0:'Kapantay ng mata', dtag1:'Bahagyang taas ng ulo', dtag2:'Tumitingala', ftagF:'Nasa sahig', ftagB:'Taas ng likod',
      feedF:'Nakababa pa ang pan sa sapin, puno ng pakain. Pumapasok ang sisiw para kumain.',
      temp:'Temperatura', rh:'Halumigmig {rh} %', ctrl:'Dapat ganito halos ang nasa controller ng kulungan.',
      light:'Ilaw', lh:'{h} oras na ilaw', dh:'{h} oras na dilim', bright:'Maliwanag — 30 hanggang 40 lux para makita ng sisiw ang pakain at tubig.', dim:'Madilim-dilim — 5 hanggang 10 lux. Isang tuloy-tuloy na bloke ang dilim.',
      ross:'Ross 308 · araw {n} · bawat ibon', weight:'Timbang', feed:'Pakain', water:'Tubig', target:'target', aday:'bawat araw', whole:'Buong kulungan ngayon',
      note:'Mga target mula sa Ross 308 at sa manager mo. Kung may mali sa kulungan, sabihan ang manager.',
      emptyHi:'Wala pang ibon. Ganito dapat ang Kulungan {n} pagdating ng sisiw.', ready:'Handa na sa sisiw',
      r1t:'Painitin nang maaga', r1d:'Painitin ang kulungan 1–2 araw bago dumating ang sisiw. Sahig 28–30°, hangin {t}° sa taas ng sisiw.',
      r2t:'Halumigmig {rh} %', r2d:'Tingnan ang screen ng controller.',
      r3t:'Pantay na sapin', r3d:'Patag at pantay. Walang basa o buo-buong parte.',
      r4t:'Sariwang tubig', r4d:'I-flush ang bawat linya. Nipple kapantay ng mata ng sisiw, may patak sa bawat isa.',
      r5t:'Nakababa ang pakain', r5d:'Pan nakababa sa sapin at puno. Papel na may pakain malapit sa inuman.',
      r6t:'Maliwanag na ilaw', r6d:'30–40 lux, pantay sa buong kulungan. {lh} oras na ilaw, {dh} oras na dilim.',
      crop:'Pagdating · tsek ng butsi', cropD:'Kumuha ng 10 sisiw sa iba-ibang lugar. Kapain ang butsi (sa ilalim ng leeg): malambot at bilog ay nakakain at nakainom na.',
      crop8:'Pagkalipas ng 8 oras', cropAm:'Kinaumagahan', of10:'{a} sa 10', full:'malambot at puno', cropW:'Matigas o walang laman ang butsi? Sabihan ang manager.',
      see:'Makikita mo', doit:'Gawin ito', tell:'Sabihan ang manager', hiAlert:'Kumilos ngayon, saka sabihan ang manager.', hiCheck:'Tingnan ito sa bawat ikot.',
      noBatch:'Walang tumatakbong batch — ipinapakita ang araw {n}. Gamitin ang − / + para sa ibang edad.'
    },
    id: {
      hi:'Ketuk kandangmu. Aku tunjukkan yang benar untuk umurnya hari ini.', checks:'Cek cepat', every:'semua kandang',
      shed:'Kandang {n}', day:'Hari {n}', empty:'Kosong', birds:'{n} ekor', back:'Kembali', chicks:'DOC {d}',
      tip0:'Anak ayam dulu! Lantai hangat, air dan pakan dekat. Jalan pelan-pelan.',
      tip1:'Masih bayi. Jaga tetap hangat, dan naikkan tempat minum sedikit tiap dua hari.',
      tip2:'Tumbuh cepat! Naikkan tempat minum dan pakan setinggi mereka.',
      tip3:'Sudah besar. Awas panas — terengah-engah berarti perlu udara lebih.',
      dtag0:'Setinggi mata', dtag1:'Sedikit di atas kepala', dtag2:'Menjulur ke atas', ftagF:'Di lantai', ftagB:'Setinggi punggung',
      feedF:'Piring pakan masih di litter, penuh pakan. Anak ayam masuk untuk makan.',
      temp:'Suhu', rh:'Kelembapan {rh} %', ctrl:'Controller kandang harus menunjukkan kira-kira ini.',
      light:'Pencahayaan', lh:'{h} jam terang', dh:'{h} jam gelap', bright:'Terang — 30 sampai 40 lux agar anak ayam menemukan pakan dan air.', dim:'Redup — 5 sampai 10 lux. Jam gelap dalam satu blok.',
      ross:'Ross 308 · hari {n} · per ekor', weight:'Bobot', feed:'Pakan', water:'Air', target:'target', aday:'per hari', whole:'Seluruh kandang hari ini',
      note:'Target dari panduan Ross 308 dan manajermu. Kalau kandang terlihat salah, beri tahu manajer.',
      emptyHi:'Belum ada ayam. Begini Kandang {n} harus terlihat saat anak ayam masuk.', ready:'Siap untuk DOC',
      r1t:'Pemanas lebih awal', r1d:'Hangatkan kandang 1–2 hari sebelum DOC datang. Lantai 28–30°, udara {t}° setinggi anak ayam.',
      r2t:'Kelembapan {rh} %', r2d:'Cek layar controller.',
      r3t:'Litter rata', r3d:'Datar dan rata. Tidak ada bagian basah atau menggumpal.',
      r4t:'Air segar', r4d:'Flush setiap jalur. Nipple setinggi mata anak ayam, ada tetesan di tiap nipple.',
      r5t:'Pakan di bawah', r5d:'Piring pakan di litter dan penuh. Kertas dengan pakan dekat tempat minum.',
      r6t:'Lampu terang', r6d:'30–40 lux, rata di seluruh kandang. {lh} jam terang, {dh} jam gelap.',
      crop:'Setelah datang · cek tembolok', cropD:'Ambil 10 anak ayam dari tempat berbeda. Raba tembolok (di bawah leher): lembut dan bulat berarti sudah makan dan minum.',
      crop8:'Setelah 8 jam', cropAm:'Besok pagi', of10:'{a} dari 10', full:'lembut dan penuh', cropW:'Tembolok keras atau kosong? Beri tahu manajer.',
      see:'Yang terlihat', doit:'Lakukan ini', tell:'Beri tahu manajer', hiAlert:'Bertindak sekarang, lalu beri tahu manajer.', hiCheck:'Cek ini setiap keliling.',
      noBatch:'Tidak ada batch berjalan — menampilkan hari {n}. Pakai − / + untuk umur lain.'
    }
  };
  const t = (lang, k, v)=> Object.keys(v || {}).reduce((s, x)=> s.split('{' + x + '}').join(v[x]), (TXT[lang] && TXT[lang][k]) || TXT.en[k] || k);
  const esc = s=> String(s == null ? '' : s).replace(/[&<>"']/g, c=> ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const ICON = {
    water:'M12 2.7 6.3 8.4a8 8 0 1 0 11.4 0z',
    feed:'M12 21V10M12 10c-3-1-4.5-3.5-4.5-6 3 .8 4.5 3 4.5 6zM12 10c3-1 4.5-3.5 4.5-6-3 .8-4.5 3-4.5 6zM12 16c-3-1-4.5-3.5-4.5-6 3 .8 4.5 3 4.5 6zM12 16c3-1 4.5-3.5 4.5-6-3 .8-4.5 3-4.5 6z',
    weight:'M6 8h12l2 12H4zM9 8a3 3 0 0 1 6 0',
    pan:'M10 3h4v6l6 3-1 4H5l-1-4 6-3zM7 16c0 3 2 5 5 5s5-2 5-5',
    back:'m15 18-6-6 6-6', chev:'m9 6 6 6-6 6',
    heat:'M14 14.8V4a2 2 0 0 0-4 0v10.8a4 4 0 1 0 4 0z', rh:'M12 2.7 6.3 8.4a8 8 0 1 0 11.4 0zM9 14h6',
    litter:'M3 18h18M5 14h14M8 10h8', bulb:'M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V16h8v-1.3A7 7 0 0 0 12 2z',
    good:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01',
    hot:'M14 14.8V4a2 2 0 0 0-4 0v10.8a4 4 0 1 0 4 0zM18 5l2-2M19 9h2',
    cold:'M12 2v20M4.9 7l14.2 10M4.9 17 19.1 7M9 4l3 2 3-2M9 20l3-2 3 2',
    hand:'M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8a8 8 0 0 0 16 0v-2a2 2 0 0 0-4 0',
    sick:'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM12 8v6M9 11h6',
    bio:'M7 3h5v11l6 3v4H7zM7 14h5',
    msg:'M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z',
    edit:'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z', phone:'M7 2h10v20H7zM11 18h2', book:'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5zM4 19.5V22h16',
    plus:'M12 5v14M5 12h14', x:'M18 6 6 18M6 6l12 12'
  };
  // quick check → icon + colour (tone class); the drawing stays the host's bird's-eye floor plan
  const CHECK_LOOK = { good:['good','g2-teal'], hot:['hot','g2-coral'], cold:['cold','g2-blue'], litter:['hand','g2-amber'], ratio:['water','g2-blue'], sick:['sick','g2-violet'], bio:['bio','g2-teal'] };
  const ALERT_CHECKS = ['hot', 'cold', 'sick'];
  const PAIR = ['#E8A13A','#E8A13A','#3AA0D8','#3AA0D8','#D7577E','#D7577E','#6E9B3A','#6E9B3A'];
  const ic = (d, s)=> `<svg width="${s || 20}" height="${s || 20}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
  const plumo = (mood, cls)=> window.PlumoFace ? `<span class="g2-plumo ${cls || ''}">${window.PlumoFace.html(mood)}</span>` : '';
  const fmt = n=> Math.round(n).toLocaleString('en-AU');

  // ---------- temperature: the manager's set points, ramped evenly day by day (2026-11-04) ----------
  // Rows are [day, °C]. Day 3 at 33° and day 7 at 29° gives 32°, 31°, 30° on days 4–6. Humidity and dark hours stay steps.
  const spRows = rows=> (rows || []).map(r=> [Number(r[0]), Number(r[1])]).filter(r=> isFinite(r[0]) && isFinite(r[1])).sort((a, b)=> a[0] - b[0]);
  function tempRamp(rows, age){
    const r = spRows(rows);
    for(let i = 0; i < r.length - 1; i++){ const [d0, v0] = r[i], [d1, v1] = r[i + 1]; if(d1 > d0 && age >= d0 && age < d1) return { d0, v0, d1, v1, per: (v1 - v0) / (d1 - d0) }; }
    return null;
  }
  function tempAt(rows, age){
    const r = spRows(rows); if(!r.length) return null;
    if(age <= r[0][0]) return r[0][1];
    const m = tempRamp(r, age); return m ? m.v0 + m.per * (age - m.d0) : r[r.length - 1][1];
  }
  function stepAt(rows, age){ let v = rows[0][1]; rows.slice().sort((a, b)=> a[0] - b[0]).forEach(r=>{ if(age >= +r[0]) v = r[1]; }); return v; }
  const t1 = v=> v == null || !isFinite(v) ? '—' : (Math.round(v * 10) / 10).toFixed(1);

  // ---------- the drawing ----------
  let uid = 0;
  function bodyLook(age){
    const chick = age <= 10, grown = age >= 15;
    return { chick, grown,
      b1: chick ? '#FBD95A' : grown ? '#FFFFFF' : '#FAF1D2', b2: chick ? '#E9B52C' : grown ? '#E4DCCB' : '#E6D39A',
      edge: chick ? '#C9971C' : grown ? '#B9AE98' : '#C8B47A', wing: chick ? '#F3C53C' : grown ? '#F1ECE1' : '#EFE2B6' };
  }
  function scene(kind, age, kgAt){
    const id = 'g2s' + (++uid), drink = kind === 'drink';
    // a 3 kg bird fills the frame; size grows with the cube root of the weight
    const kg = kgAt(age), s = Math.max(0.36, Math.cbrt(Math.min(kg, 3) / 3)), L = bodyLook(age), u = n=> `url(#${id}${n})`;
    // head pose: stretched up to the nipple when drinking, level at the pan
    const hx = drink ? 38 : 40, hy = drink ? -106 : -90, hr = L.chick ? 16 : 13;
    const neck = drink ? 'M8 -72Q22 -96 28 -108L48 -100Q38 -82 34 -62Z' : 'M12 -70Q24 -84 28 -92L48 -84Q40 -72 36 -60Z';
    const beakTop = drink ? `M${hx+9} ${hy-7}L${hx+21} ${hy-16}L${hx+13} ${hy-3}Z` : `M${hx+11} ${hy-4}L${hx+23} ${hy}L${hx+11} ${hy+1}Z`;
    const beakBot = drink ? `M${hx+13} ${hy-3}L${hx+19} ${hy-12}L${hx+11} ${hy+1}Z` : `M${hx+11} ${hy+1}L${hx+20} ${hy+2}L${hx+11} ${hy+5}Z`;
    const tip = drink ? [hx + 21, hy - 16] : [hx + 23, hy];
    const bx = drink ? 120 : 110;
    const bird = `<g transform="translate(${bx} 158) scale(${s.toFixed(3)})">
      ${L.grown ? `<path d="M-36 -62C-50 -70 -62 -84 -60 -94C-52 -86 -46 -82 -40 -80C-50 -90 -50 -100 -43 -106C-39 -94 -33 -86 -24 -77Z" fill="${u('b')}" stroke="${L.edge}" stroke-width="2" stroke-linejoin="round"/>` : ''}
      <path d="M-8 -24L-9 -3M6 -24L7 -3" stroke="#E8913A" stroke-width="5" stroke-linecap="round"/>
      <path d="M-9 -3l-9 2M-9 -3l1 3M-9 -3l8 2M7 -3l-8 2M7 -3l1 3M7 -3l10 2" stroke="#D97A26" stroke-width="3" stroke-linecap="round"/>
      <ellipse cx="-4" cy="-50" rx="42" ry="30" fill="${u('b')}" stroke="${L.edge}" stroke-width="2"/>
      <ellipse cx="14" cy="-58" rx="15" ry="13" fill="#fff" opacity=".45"/>
      ${L.chick ? `<path d="M-45 -54l-7 -5l5 7l-8 2l8 3l-6 5l8 -2" fill="none" stroke="${L.edge}" stroke-width="2" stroke-linejoin="round"/><path d="M-24 -54C-14 -62 0 -60 4 -50C-6 -42 -18 -42 -24 -48Z" fill="${L.wing}" stroke="${L.edge}" stroke-width="1.6"/>`
        : `<path d="M-34 -56C-20 -70 6 -66 12 -52C2 -40 -22 -36 -34 -44Z" fill="${L.wing}" stroke="${L.edge}" stroke-width="1.8"/><path d="M-26 -47C-16 -49 -6 -51 4 -51M-28 -53C-18 -57 -8 -59 2 -59" stroke="${L.edge}" stroke-width="1.4" fill="none"/>`}
      <path d="${neck}" fill="${u('b')}"/>
      <circle cx="${hx}" cy="${hy}" r="${hr}" fill="${L.b1}" stroke="${L.edge}" stroke-width="2"/>
      ${L.chick ? `<path d="M${hx-6} ${hy-hr+1}q2 -7 5 -1q2 -6 5 0" fill="none" stroke="${L.edge}" stroke-width="2" stroke-linecap="round"/>` : ''}
      ${L.grown ? `<path d="M${hx-10} ${hy-10}l2 -9l4 5l3 -9l4 6l4 -7l2 9Z" fill="#E3262E" stroke="#A8141B" stroke-width="1.2" stroke-linejoin="round"/><ellipse cx="${hx+10}" cy="${hy+10}" rx="3.2" ry="5.5" fill="#E3262E"/>` : ''}
      <circle cx="${hx+5}" cy="${hy-3}" r="3" fill="#16191B"/><circle cx="${hx+6}" cy="${hy-4}" r="1" fill="#fff"/>
      <path d="${beakTop}" fill="#F0A13C"/><path d="${beakBot}" fill="#D27A1E"/></g>`;
    const defs = `<defs><linearGradient id="${id}w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${drink ? '#F1F4F7' : '#F7F3EA'}"/><stop offset="1" stop-color="${drink ? '#DCE3E9' : '#EBE3D2'}"/></linearGradient>
      <linearGradient id="${id}l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E4CC98"/><stop offset="1" stop-color="#C7A468"/></linearGradient>
      <linearGradient id="${id}p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D5DCE2"/><stop offset=".45" stop-color="#A9B3BC"/><stop offset="1" stop-color="#6F7B86"/></linearGradient>
      <linearGradient id="${id}o" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F28A35"/><stop offset="1" stop-color="#C85A12"/></linearGradient>
      <linearGradient id="${id}r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EA5B3D"/><stop offset="1" stop-color="#AE3520"/></linearGradient>
      <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${L.b1}"/><stop offset="1" stop-color="${L.b2}"/></linearGradient></defs>`;
    const ground = `<rect width="340" height="160" fill="${u('w')}"/><rect y="116" width="340" height="8" fill="#000" opacity=".06"/><rect y="156" width="340" height="24" fill="${u('l')}"/>
      <path d="M8 165l6 -2M30 171l7 1M52 163l5 2M78 168l6 -1M104 174l5 -2M131 164l7 1M160 170l5 2M188 165l6 -1M214 172l7 -2M240 163l5 1M266 169l6 2M292 165l7 -1M318 172l5 -2" stroke="#A9864C" stroke-width="2" stroke-linecap="round"/>
      <path d="M18 175l5 1M44 160l4 -1M92 161l5 1M120 176l4 -1M176 160l5 1M228 177l4 -1M282 160l5 1M330 166l4 1" stroke="#F3E2B8" stroke-width="2" stroke-linecap="round"/>
      <ellipse cx="${(bx - 4 * s).toFixed(1)}" cy="158" rx="${Math.round(46 * s)}" ry="4" fill="#5A4220" opacity=".18"/>`;
    let back = '', front = '';
    if(drink){
      const x = Math.round(bx + tip[0] * s), tipY = Math.round(158 + tip[1] * s - 3), py = tipY - 20, cy = tipY + 16;
      back = `<path d="M40 0V${py}M300 0V${py}" stroke="#8C96A0" stroke-width="1.6"/><rect y="${py - 6}" width="340" height="11" rx="5.5" fill="${u('p')}"/><path d="M0 ${py - 3}H340" stroke="#fff" stroke-width="1.4" opacity=".7"/>`;
      front = `<rect x="${x - 10}" y="${py - 9}" width="42" height="17" rx="3" fill="${u('o')}"/><rect x="${x - 10}" y="${py + 5}" width="42" height="6" rx="1" fill="#D86A1C"/>
        <rect x="${x - 4}" y="${py + 5}" width="8" height="${tipY - py - 5}" rx="2" fill="${u('p')}" stroke="#6F7B86"/><rect x="${x - 6}" y="${py + 11}" width="12" height="4" rx="1.5" fill="#8C96A0"/>
        <path d="M${x} ${tipY}q-3 4 0 6q3 -2 0 -6Z" fill="#3A8DDE"/>
        <rect x="${x + 28}" y="${py + 5}" width="6" height="${cy - py + 1}" rx="1" fill="${u('o')}"/>
        <path d="M${x - 14} ${cy}H${x + 34}Q${x + 34} ${cy + 11} ${x + 25} ${cy + 11}H${x - 5}Q${x - 14} ${cy + 11} ${x - 14} ${cy}Z" fill="${u('o')}"/>
        <path d="M${x - 12} ${cy + 1.5}H${x + 32}" stroke="#FFC08A" stroke-width="1.6" stroke-linecap="round"/>
        <path d="M318 158V${tipY}M312 ${tipY}h12M312 158h12" stroke="#2F6BD8" stroke-width="2"/><path d="M${x + 40} ${tipY}H318" stroke="#2F6BD8" stroke-width="1.5" stroke-dasharray="4 3"/>`;
    } else {
      const c = 250, lip = age <= 7 ? 146 : Math.round(158 - 80 * s), backY = age <= 7 ? lip : Math.round(158 - 80 * s);
      let pel = ''; for(let i = 0; i < 9; i++) pel += `M${c - 32 + i * 8} ${lip - 1 - (i % 3)}h.01`;
      back = `<rect y="4" width="340" height="12" rx="6" fill="${u('p')}"/><path d="M0 7H340" stroke="#fff" stroke-width="1.4" opacity=".7"/><rect x="${c - 6}" y="14" width="12" height="${lip - 40}" fill="${u('p')}"/>
        ${age <= 3 ? `<path d="M10 157L196 157L192 160L14 160Z" fill="#fff" stroke="#D8D2C4"/><path d="M28 155h.01M46 154h.01M64 155h.01M82 154h.01M100 155h.01M118 154h.01M136 155h.01M154 154h.01M172 155h.01" stroke="#B9863A" stroke-width="4" stroke-linecap="round"/>` : ''}`;
      front = `<path d="M${c - 10} ${lip - 28}H${c + 10}L${c + 20} ${lip - 4}H${c - 20}Z" fill="${u('r')}" stroke="#8E2A18" stroke-width="1.4"/>
        <path d="M${c - 20} ${lip - 4}L${c - 40} ${lip + 1}M${c + 20} ${lip - 4}L${c + 40} ${lip + 1}M${c - 8} ${lip - 4}L${c - 14} ${lip + 4}M${c + 8} ${lip - 4}L${c + 14} ${lip + 4}" stroke="#8E2A18" stroke-width="2"/>
        <path d="M${c - 44} ${lip}C${c - 44} ${lip + 14} ${c - 30} ${lip + 18} ${c} ${lip + 18}C${c + 30} ${lip + 18} ${c + 44} ${lip + 14} ${c + 44} ${lip}Z" fill="${u('r')}" stroke="#8E2A18" stroke-width="1.6"/>
        <ellipse cx="${c}" cy="${lip}" rx="44" ry="5" fill="#C98F45" stroke="#8E2A18" stroke-width="1.6"/><path d="${pel}" stroke="#9C6A2A" stroke-width="3.4" stroke-linecap="round"/>
        <path d="M${Math.round(bx + (age <= 7 ? 46 : 30) * s)} ${backY}H${c - 46}" stroke="#8A5300" stroke-width="1.6" stroke-dasharray="4 3"/>`;
    }
    return `<svg class="g2-scene" viewBox="0 0 340 180" role="img" aria-label="${drink ? 'Drinker' : 'Feeder pan'} height for a day ${age} bird">${defs}${ground}${back}${bird}${front}</svg>`;
  }
  // a small bird for the shed tiles, sized like the big drawing
  function miniBird(age, kgAt){
    const s = Math.cbrt(kgAt(age) / 2) * 1.05, L = bodyLook(age);
    return `<svg class="g2-mini" width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><g transform="translate(20 37) scale(${s.toFixed(2)})"><ellipse cx="-2" cy="-12" rx="12" ry="9" fill="${L.b1}" stroke="${L.edge}" stroke-width="1.5"/><circle cx="9" cy="-22" r="5.5" fill="${L.b1}" stroke="${L.edge}" stroke-width="1.5"/>${L.grown ? '<path d="M5 -27l1 -3 2 2 1 -3 2 3" fill="#E3262E"/>' : ''}<path d="M14 -23l4 1-4 2z" fill="#E8913A"/><path d="M-4 -3v3M1 -3v3" stroke="#E8913A" stroke-width="1.6"/></g></svg>`;
  }

  // ---------- sheds ----------
  // Every shed in the running batch and the next one: its own age (from its placement day) and birds now,
  // or empty with the next chicks date. Sheds placed on different days keep their own age.
  function shedList(batches, td){
    const days = (a, z)=> Math.round((new Date(z + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
    const num = s=> { const m = String(s).match(/\d+/); return m ? Number(m[0]) : null; };
    const live = (batches || []).filter(b=> b && b.start && b.end && td >= b.start && td <= b.end).sort((a, b)=> b.start.localeCompare(a.start))[0];
    const next = (batches || []).filter(b=> b && b.start && b.start > td).sort((a, b)=> a.start.localeCompare(b.start));
    const out = {};
    const put = (n, v)=>{ if(n == null) return; out[n] = Object.assign(out[n] || { n, age: null, birds: 0, chicks: null }, v); };
    if(live) (live.sheds || []).forEach(sh=>{
      const n = num(sh.shed); if(n == null) return;
      const inNow = sh.placement && sh.placement <= td && td <= (sh.cleanout || live.end);
      if(inNow){ const pb = live.birdsNow && live.birdsNow.perShed; put(n, { age: days(sh.placement, td), birds: Number(pb && pb[String(n)]) || 0 }); }
      else if(sh.placement && sh.placement > td) put(n, { chicks: sh.placement });
      else put(n, {});
    });
    next.forEach(b=> (b.sheds || []).forEach(sh=>{ const n = num(sh.shed); if(n == null) return; const cur = out[n];
      if(!cur) put(n, { chicks: sh.placement || b.start }); else if(cur.age == null && !cur.chicks) put(n, { chicks: sh.placement || b.start }); }));
    return Object.values(out).sort((a, b)=> a.n - b.n);
  }

  // ---------- pages ----------
  // o: { lang, view:{v, shed, check, age}, sheds, cfg (host guideCfg), at (guideAt), kg, feedG, waterMl, X (text with the
  //      manager's own wording), T (host guide text), checks (GUIDE_CHECKS), spread (bird's-eye drawing), dateLabel, report (bool), board (bool) }
  function html(o){
    const L = o.lang || 'en', tt = (k, v)=> t(L, k, v), v = o.view || { v: 'home' };
    let h;
    if(!o.sheds.length) h = shedHtml(o, tt, { n: null, age: v.age, birds: 0 }) + checksHtml(o, tt);
    else if(v.v === 'shed'){ const sh = o.sheds.find(s=> s.n === v.shed) || o.sheds[0]; h = (sh.age == null ? emptyHtml(o, tt, sh) : shedHtml(o, tt, sh)) + checksHtml(o, tt); }
    else if(v.v === 'check') h = checkHtml(o, tt, v.check);
    else h = homeHtml(o, tt);
    return `<div class="g2">${h}</div>`;
  }
  function bubble(mood, text, cls){ return `<div class="g2-say ${cls || ''}">${plumo(mood)}<div class="g2-bubble">${esc(text)}</div></div>`; }
  function homeHtml(o, tt){
    const tiles = o.sheds.map((s, i)=> `<button type="button" class="g2-tile" data-g2-shed="${s.n}"><span class="g2-bar" style="background:${PAIR[(s.n - 1) % 8]}"></span>
      <span class="g2-tile-t"><span class="g2-tile-n">${esc(tt('shed', { n: s.n }))}</span><span class="g2-tile-d${s.age == null ? ' g2-violet-t' : ''}">${esc(s.age == null ? tt('empty') : tt('day', { n: s.age }))}</span></span>
      ${s.age == null ? '' : miniBird(s.age, o.kg)}</button>`).join('');
    return `<div class="g2-hero">${plumo('calm', 'g2-plumo-lg')}<div class="g2-hero-t"><h2>${esc(o.T('g_title'))}</h2><div class="g2-bubble">${esc(tt('hi'))}</div></div></div>
      <div class="g2-tiles">${tiles}</div>${checksHtml(o, tt)}`;
  }
  function checksHtml(o, tt){
    const c = o.cfg;
    const rows = o.checks.filter(([k])=> !c.hidden.includes(k)).map(([k])=>{ const [i, tone] = CHECK_LOOK[k] || ['good', 'g2-teal'];
      return `<button type="button" class="g2-row" data-g2-check="${k}"><span class="g2-ico ${tone}">${ic(ICON[i], 22)}</span><span class="g2-row-t">${esc(o.X('g_' + k + '_t'))}</span>${ic(ICON.chev, 18)}</button>`; });
    c.custom.filter(x=> x.title || x.body).forEach(x=> rows.push(`<button type="button" class="g2-row" data-g2-check="own:${esc(x.id)}"><span class="g2-ico g2-grey g2-emo">${esc(x.icon || '📌')}</span><span class="g2-row-t">${esc(x.title || '')}</span>${ic(ICON.chev, 18)}</button>`));
    return `<div class="g2-sec">${esc(tt('checks'))} <span>· ${esc(tt('every'))}</span></div><div class="g2-rows">${rows.join('')}</div>`;
  }
  function headHtml(o, tt, sh, sub, title, titleCls){
    const pills = o.sheds.length ? `<div class="g2-pills">${o.sheds.map(s=> `<button type="button" class="g2-pill${s.n === sh.n ? ' on' : ''}" style="--pc:${PAIR[(s.n - 1) % 8]}" data-g2-shed="${s.n}">${s.n}<small>${s.age == null ? esc(tt('empty')) : 'd' + s.age}</small></button>`).join('')}</div>` : '';
    const step = sh.n == null ? `<div class="g2-step"><button type="button" data-g2-age="-1" aria-label="Previous day">−</button><button type="button" data-g2-age="1" aria-label="Next day">+</button></div>` : '';
    const backBtn = o.sheds.length ? `<button type="button" class="g2-back" data-g2-back aria-label="${esc(tt('back'))}">${ic(ICON.back, 22)}</button>` : '';
    return `<div class="g2-head"><div class="g2-head-row">${backBtn}<div class="g2-head-t"><span class="g2-sub">${esc(sub)}</span><span class="g2-title ${titleCls || ''}">${esc(title)}</span></div>${step}</div>${pills}</div>`;
  }
  function shedHtml(o, tt, sh){
    const c = o.cfg, age = Math.max(0, sh.age || 0), at = rows=> o.at(rows, age);
    const temp = t1(tempAt(c.temp, age)), rh = at(c.rh), dark = Number(at(c.dark)) || 0;
    const stage = age <= 2 ? 0 : age <= 10 ? 1 : 2;
    const feedKey = age <= 3 ? 'g_feed_0' : null;
    const tip = tt(age <= 3 ? 'tip0' : age <= 10 ? 'tip1' : age <= 20 ? 'tip2' : 'tip3');
    const kg = o.kg(age), fg = o.feedG(age), wm = o.waterMl(age), circ = 2 * Math.PI * 30;
    const ownLight = String(c.text.light_n || '').trim();   // the manager's own lighting note, if any
    const sub = sh.n == null ? o.T('g_now') : tt('shed', { n: sh.n }) + (sh.birds ? ' · ' + tt('birds', { n: fmt(sh.birds) }) : '');
    let h = headHtml(o, tt, sh, sub, tt('day', { n: age }));
    if(sh.n == null) h += `<p class="g2-hint">${esc(tt('noBatch', { n: age }))}</p>`;
    h += `<div class="g2-body">${bubble('calm', tip)}
      <div class="g2-card g2-pic"><div class="g2-card-h"><span class="g2-ico g2-blue">${ic(ICON.water)}</span><b>${esc(o.T('g_drink_t'))}</b><span class="g2-tag g2-blue">${esc(tt('dtag' + stage))}</span></div>
        ${scene('drink', age, o.kg)}<p>${esc(o.X('g_drink_' + stage))}</p></div>
      <div class="g2-card g2-pic"><div class="g2-card-h"><span class="g2-ico g2-amber">${ic(ICON.pan)}</span><b>${esc(o.T('g_feed_t'))}</b><span class="g2-tag g2-amber">${esc(tt(age <= 7 ? 'ftagF' : 'ftagB'))}</span></div>
        ${scene('feed', age, o.kg)}<p>${esc(feedKey ? o.X(feedKey) : age <= 7 ? tt('feedF') : o.X('g_feed_1'))}</p></div>
      <div class="g2-two">
        <div class="g2-card"><span class="g2-cap g2-coral-t">${esc(tt('temp'))}</span><span class="g2-big">${esc(String(temp))}°</span><span class="g2-mid">${esc(tt('rh', { rh }))}</span><span class="g2-small">${esc(tt('ctrl'))}</span></div>
        <div class="g2-card"><span class="g2-cap g2-amber-t">${esc(tt('light'))}</span>
          <div class="g2-clock"><svg width="54" height="54" viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="30" fill="none" stroke="#F5C842" stroke-width="14"/><circle cx="40" cy="40" r="30" fill="none" stroke="#2B3566" stroke-width="14" stroke-dasharray="${(circ * dark / 24).toFixed(1)} ${circ.toFixed(1)}" transform="rotate(-90 40 40)"/></svg>
          <span><b>${esc(tt('lh', { h: 24 - dark }))}</b><b class="g2-night">${esc(tt('dh', { h: dark }))}</b></span></div>
          <span class="g2-small">${esc(tt(age < 7 ? 'bright' : 'dim'))}</span>${ownLight ? `<span class="g2-small">${esc(ownLight)}</span>` : ''}</div>
      </div>
      <div class="g2-card"><span class="g2-cap g2-teal-t">${esc(tt('ross', { n: age }))}</span>
        <div class="g2-stats">
          <div class="g2-stat g2-teal">${'<span class="g2-dot">' + ic(ICON.weight, 18) + '</span>'}<span class="g2-k">${esc(tt('weight'))}</span><b>${kg < 1 ? Math.round(kg * 1000) + ' g' : kg.toFixed(2) + ' kg'}</b><span class="g2-u">${esc(tt('target'))}</span></div>
          <div class="g2-stat g2-amber"><span class="g2-dot">${ic(ICON.feed, 18)}</span><span class="g2-k">${esc(tt('feed'))}</span><b>${fg} g</b><span class="g2-u">${esc(tt('aday'))}</span></div>
          <div class="g2-stat g2-blue"><span class="g2-dot">${ic(ICON.water, 18)}</span><span class="g2-k">${esc(tt('water'))}</span><b>${wm} ml</b><span class="g2-u">${esc(tt('aday'))}</span></div>
        </div>
        ${sh.birds ? `<div class="g2-whole"><span class="g2-small"><b>${esc(tt('whole'))}</b></span>
          <span class="g2-line"><span class="g2-ico g2-amber g2-sm">${ic(ICON.feed, 16)}</span><span>${esc(tt('feed'))}</span><b>${fmt(sh.birds * fg / 1000)} kg</b></span>
          <span class="g2-line"><span class="g2-ico g2-blue g2-sm">${ic(ICON.water, 16)}</span><span>${esc(tt('water'))}</span><b>${fmt(sh.birds * wm / 1000)} L</b></span></div>` : ''}
      </div>
      <p class="g2-note">${esc(tt('note'))}</p></div>`;
    return h;
  }
  function emptyHtml(o, tt, sh){
    const c = o.cfg, t0 = t1(tempAt(c.temp, 0)), rh0 = o.at(c.rh, 0), d0 = Number(o.at(c.dark, 0)) || 0;
    const items = [['r1', ICON.heat, 'g2-coral', { t: t0 }], ['r2', ICON.rh, 'g2-blue', { rh: rh0 }], ['r3', ICON.litter, 'g2-amber'], ['r4', ICON.water, 'g2-blue'], ['r5', ICON.pan, 'g2-amber'], ['r6', ICON.bulb, 'g2-amber', { lh: 24 - d0, dh: d0 }]];
    const title = sh.chicks ? tt('chicks', { d: o.dateLabel(sh.chicks) }) : tt('empty');
    return headHtml(o, tt, sh, tt('shed', { n: sh.n }) + ' · ' + tt('empty'), title) + `<div class="g2-body">${bubble('thinking', tt('emptyHi', { n: sh.n }))}
      <div class="g2-card g2-list"><span class="g2-cap g2-violet-t">${esc(tt('ready'))}</span>
        ${items.map(([k, i, tone, vv])=> `<div class="g2-li"><span class="g2-ico ${tone}">${ic(i, 22)}</span><span><b>${esc(tt(k + 't', vv))}</b><span>${esc(tt(k + 'd', vv))}</span></span></div>`).join('')}</div>
      <div class="g2-card"><span class="g2-cap g2-teal-t">${esc(tt('crop'))}</span><p>${esc(tt('cropD'))}</p>
        <div class="g2-stats g2-stats2"><div class="g2-stat g2-grey"><span class="g2-k">${esc(tt('crop8'))}</span><b>${esc(tt('of10', { a: 8 }))}</b><span class="g2-u">${esc(tt('full'))}</span></div>
          <div class="g2-stat g2-grey"><span class="g2-k">${esc(tt('cropAm'))}</span><b>${esc(tt('of10', { a: 10 }))}</b><span class="g2-u">${esc(tt('full'))}</span></div></div>
        <span class="g2-warn">${esc(tt('cropW'))}</span></div></div>`;
  }
  function checkHtml(o, tt, key){
    const back = `<button type="button" class="g2-back" data-g2-back aria-label="${esc(tt('back'))}">${ic(ICON.back, 22)}</button>`;
    if(String(key).startsWith('own:')){
      const x = o.cfg.custom.find(c=> 'own:' + c.id === key) || {};
      return `<div class="g2-head"><div class="g2-head-row">${back}<div class="g2-head-t"><span class="g2-sub">${esc(tt('checks'))}</span><span class="g2-title">${esc(x.title || '')}</span></div></div></div>
        <div class="g2-body"><div class="g2-card"><p class="g2-pre">${esc(x.body || '')}</p></div></div>`;
    }
    const def = o.checks.find(c=> c[0] === key) || o.checks[0], k = def[0], alert = ALERT_CHECKS.includes(k);
    const tone = (CHECK_LOOK[k] || ['', 'g2-teal'])[1];
    return `<div class="g2-head"><div class="g2-head-row">${back}<div class="g2-head-t"><span class="g2-sub">${esc(tt('checks'))} · ${esc(tt('every'))}</span><span class="g2-title ${tone}-t">${esc(o.X('g_' + k + '_t'))}</span></div></div></div>
      ${def[2] ? `<div class="g2-plan">${o.spread(def[2])}</div>` : ''}
      <div class="g2-body">${bubble(alert ? 'alert' : 'calm', tt(alert ? 'hiAlert' : 'hiCheck'))}
        <div class="g2-card"><span class="g2-cap">${esc(tt('see'))}</span><p>${esc(o.X('g_' + k + '_s'))}</p></div>
        <div class="g2-card"><span class="g2-cap">${esc(tt('doit'))}</span><p>${esc(o.X('g_' + k + '_a'))}</p></div>
        ${o.report ? `<button type="button" class="g2-tell" data-g2-report>${ic(ICON.msg, 22)}${esc(tt('tell'))}</button>` : ''}</div>`;
  }
  // ---------- look (both apps; colours follow light / dark) ----------
  const CSS = `
  .g2{ --g2-card:var(--surface,#fff); --g2-ink:var(--ink,#16191B); --g2-line:var(--line,#E2E5DF); --g2-muted:var(--muted,#5E666A); --g2-page:var(--bg,#F4F5F2);
    --g2-teal:#0F8A75; --g2-teal-s:#DFF4EF; --g2-blue:#2F6BD8; --g2-blue-s:#E6EEFD; --g2-coral:#C9402D; --g2-coral-s:#FDE8E4; --g2-amber:#8A5300; --g2-amber-s:#FFF3DC; --g2-violet:#5B44C2; --g2-violet-s:#EEEAFC; --g2-night:#2B3566; --g2-night-s:#E8EAF4; --g2-grey-s:#F1F3EF;
    max-width:560px; width:100%; min-width:0; box-sizing:border-box; margin:0 auto; display:flex; flex-direction:column; gap:12px; color:var(--g2-ink); font-family:'Inter',sans-serif; }
  .g2 > *, .g2-head, .g2-body, .g2-card{ min-width:0; }
  body.theme-dark .g2{ --g2-teal:#3CC9A8; --g2-teal-s:rgba(60,201,168,.14); --g2-blue:#7AA7FF; --g2-blue-s:rgba(122,167,255,.14); --g2-coral:#FF8270; --g2-coral-s:rgba(255,130,112,.15); --g2-amber:#F5B524; --g2-amber-s:rgba(245,181,36,.14); --g2-violet:#A893FF; --g2-violet-s:rgba(168,147,255,.15); --g2-night:#AEB8FF; --g2-night-s:rgba(174,184,255,.14); --g2-grey-s:rgba(255,255,255,.06); }
  .g2-wide{ max-width:none; min-width:0; width:100%; }
  .g2 button{ font-family:inherit; color:var(--g2-ink); cursor:pointer; }
  .g2 p{ margin:0; font-size:16px; line-height:1.45; font-weight:600; }
  .g2-plumo{ display:block; width:58px; height:58px; flex-shrink:0; }
  .g2-plumo .plumoF, .g2-plumo svg{ width:100%; height:100%; display:block; }
  .g2-plumo-lg{ width:76px; height:76px; }
  .g2-hero{ display:flex; align-items:flex-end; gap:10px; padding-top:4px; }
  .g2-hero-t{ display:flex; flex-direction:column; gap:6px; min-width:0; }
  .g2-hero h2{ margin:0; font-family:'Sora',sans-serif; font-size:26px; font-weight:800; }
  .g2-bubble{ background:var(--g2-card); border:1px solid var(--g2-line); border-radius:18px 18px 18px 4px; padding:10px 13px; font-size:16px; font-weight:600; line-height:1.35; }
  .g2-say{ display:flex; align-items:flex-end; gap:8px; }
  .g2-tiles{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
  .g2-tile{ height:78px; border-radius:16px; border:1px solid var(--g2-line); background:var(--g2-card); padding:0 12px 0 0; overflow:hidden; display:flex; align-items:center; gap:10px; text-align:left; }
  .g2-bar{ width:6px; align-self:stretch; flex-shrink:0; }
  .g2-tile-t{ flex:1; display:flex; flex-direction:column; gap:1px; min-width:0; }
  .g2-tile-n{ font-size:13px; font-weight:800; color:var(--g2-muted); }
  .g2-tile-d{ font-family:'Sora',sans-serif; font-weight:800; font-size:21px; }
  .g2-sec{ font-size:13px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:var(--g2-muted); padding-top:6px; }
  .g2-sec span{ letter-spacing:0; text-transform:none; font-weight:600; }
  .g2-rows{ display:flex; flex-direction:column; gap:8px; }
  .g2-row{ min-height:56px; border-radius:14px; border:1px solid var(--g2-line); background:var(--g2-card); padding:6px 12px 6px 8px; display:flex; align-items:center; gap:12px; text-align:left; font-size:16px; font-weight:700; }
  .g2-row > svg{ color:var(--g2-muted); flex-shrink:0; }
  .g2-row-t{ flex:1; }
  .g2-ico{ width:40px; height:40px; border-radius:11px; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; }
  .g2-ico.g2-sm{ width:30px; height:30px; border-radius:50%; }
  .g2-emo{ font-size:20px; }
  .g2-teal{ background:var(--g2-teal-s); color:var(--g2-teal); } .g2-blue{ background:var(--g2-blue-s); color:var(--g2-blue); } .g2-coral{ background:var(--g2-coral-s); color:var(--g2-coral); }
  .g2-amber{ background:var(--g2-amber-s); color:var(--g2-amber); } .g2-violet{ background:var(--g2-violet-s); color:var(--g2-violet); } .g2-grey{ background:var(--g2-grey-s); color:var(--g2-ink); }
  .g2-night-c{ background:var(--g2-night-s); color:var(--g2-night); }
  .g2-teal-t{ color:var(--g2-teal); } .g2-coral-t{ color:var(--g2-coral); } .g2-amber-t{ color:var(--g2-amber); } .g2-violet-t{ color:var(--g2-violet); } .g2-night-t, .g2-night{ color:var(--g2-night); } .g2-blue-t{ color:var(--g2-blue); }
  .g2-head{ background:var(--g2-card); border:1px solid var(--g2-line); border-radius:18px; padding:12px; display:flex; flex-direction:column; gap:12px; }
  .g2-head-row{ display:flex; align-items:center; gap:12px; }
  .g2-back{ width:46px; height:46px; border-radius:14px; border:1px solid var(--g2-line); background:var(--g2-page); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .g2-head-t{ flex:1; display:flex; flex-direction:column; min-width:0; }
  .g2-sub{ font-size:14px; font-weight:800; color:var(--g2-muted); }
  .g2-title{ font-family:'Sora',sans-serif; font-weight:800; font-size:28px; line-height:1.1; }
  .g2-step{ display:flex; gap:6px; }
  .g2-step button{ width:46px; height:46px; border-radius:12px; border:1px solid var(--g2-line); background:var(--g2-page); font-size:22px; font-weight:800; }
  .g2-pills{ display:flex; gap:6px; overflow-x:auto; scrollbar-width:none; }
  .g2-pills::-webkit-scrollbar{ display:none; }
  .g2-pill{ flex-shrink:0; min-width:52px; height:48px; border-radius:12px; border:1px solid var(--pc); background:var(--g2-card); display:flex; flex-direction:column; align-items:center; justify-content:center; font-size:15px; font-weight:800; line-height:1.1; }
  .g2-pill small{ font-size:11px; font-weight:700; opacity:.85; }
  .g2-pill.on{ background:var(--g2-ink); color:var(--g2-card) !important; border:2px solid var(--g2-ink); }
  .g2-hint{ font-size:14px !important; color:var(--g2-muted); }
  .g2-body{ display:flex; flex-direction:column; gap:12px; }
  .g2-card{ background:var(--g2-card); border:1px solid var(--g2-line); border-radius:20px; padding:14px; display:flex; flex-direction:column; gap:8px; min-width:0; }
  .g2-pic{ padding:0; overflow:hidden; gap:0; }
  .g2-pic p{ padding:10px 14px 14px; }
  .g2-card-h{ padding:12px 14px 8px; display:flex; align-items:center; gap:10px; }
  .g2-card-h .g2-ico{ width:36px; height:36px; border-radius:10px; }
  .g2-card-h b{ flex:1; font-family:'Sora',sans-serif; font-size:18px; font-weight:800; }
  .g2-tag{ padding:5px 10px; border-radius:999px; font-size:13px; font-weight:800; white-space:nowrap; }
  .g2-scene{ display:block; width:100%; height:auto; }
  .g2-two{ display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .g2-cap{ font-size:13px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; color:var(--g2-muted); }
  .g2-big{ font-family:'Sora',sans-serif; font-size:40px; font-weight:800; line-height:1; }
  .g2-mid{ font-size:14px; font-weight:700; }
  .g2-small{ font-size:13px; font-weight:600; color:var(--g2-muted); line-height:1.35; }
  .g2-clock{ display:flex; align-items:center; gap:10px; }
  .g2-clock > span{ display:flex; flex-direction:column; font-size:15px; line-height:1.25; }
  .g2-stats{ display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; }
  .g2-stats2{ grid-template-columns:1fr 1fr; }
  .g2-stat{ border-radius:14px; padding:10px; display:flex; flex-direction:column; gap:3px; color:var(--g2-ink) !important; }
  .g2-stat b{ font-family:'Sora',sans-serif; font-size:20px; font-weight:800; }
  .g2-stat .g2-k{ font-size:12px; font-weight:800; }
  .g2-stat.g2-teal .g2-k{ color:var(--g2-teal); } .g2-stat.g2-amber .g2-k{ color:var(--g2-amber); } .g2-stat.g2-blue .g2-k{ color:var(--g2-blue); }
  .g2-u{ font-size:12px; font-weight:600; color:var(--g2-muted); }
  .g2-dot{ width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff; }
  .g2-stat.g2-teal .g2-dot{ background:#0F8A75; } .g2-stat.g2-amber .g2-dot{ background:#C27A0E; } .g2-stat.g2-blue .g2-dot{ background:#2F6BD8; }
  .g2-whole{ display:flex; flex-direction:column; gap:8px; border-top:1px solid var(--g2-line); padding-top:12px; }
  .g2-line{ display:flex; align-items:center; gap:10px; font-size:16px; font-weight:700; }
  .g2-line > span:nth-child(2){ flex:1; }
  .g2-line b{ font-variant-numeric:tabular-nums; }
  .g2-note{ font-size:13px !important; color:var(--g2-muted); padding:0 4px; }
  .g2-list{ gap:0; padding:6px 14px; }
  .g2-list .g2-cap{ padding:10px 0 6px; }
  .g2-li{ display:flex; gap:12px; padding:10px 0; border-top:1px solid var(--g2-line); }
  .g2-li > span:last-child{ display:flex; flex-direction:column; gap:2px; }
  .g2-li b{ font-size:16px; }
  .g2-li > span:last-child > span{ font-size:15px; font-weight:600; line-height:1.35; color:var(--g2-ink); opacity:.85; }
  .g2-warn{ font-size:14px; font-weight:700; color:var(--g2-coral); }
  .g2-plan{ background:var(--g2-card); border:1px solid var(--g2-line); border-radius:18px; padding:10px; }
  .g2-plan svg{ width:100%; height:auto; display:block; }
  .g2-pre{ white-space:pre-line; }
  .g2-tell{ height:60px; border-radius:16px; border:0; background:#DC4A36; color:#fff !important; font-size:18px; font-weight:800; display:flex; align-items:center; justify-content:center; gap:10px; }
  @media (max-width:380px){ .g2-two{ grid-template-columns:1fr; } .g2-stat b{ font-size:17px; } }
  `;
  (function(){ const st = document.createElement('style'); st.id = 'cwGuide2Css'; st.textContent = CSS; (document.head || document.documentElement).appendChild(st); })();

  window.CWGuide2 = { html, scene, shedList, text: t, tempAt, tempRamp, stepAt, spRows, t1,
    ui: { ic, ICON, CHECK_LOOK, PAIR, esc, fmt, plumo } };
})();
