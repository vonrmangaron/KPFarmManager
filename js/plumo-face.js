// Plumo's face, the action-anime look (2026-11-01, mockup 1siPonVecvHoJadyWNYaTM): spiky comb, headband with
// the claw-slash plate, band tails, cheek scar, and a mood aura. Shared by ProdWise and Tasks.
//   PlumoFace.svg(mood)  → '<svg …>' for mood calm | thinking | happy | alert | stress | rest
//   PlumoFace.html(mood, cls) → the svg in a <span class="plumoF pf-<mood> cls"> (prefixed: Bootstrap owns .alert)
// Drawn in code, no images; stays still when the device asks for reduced motion.
(function(){
  const O = '#141824';
  const M = s => `<g transform="matrix(-1 0 0 1 140 0)">${s}</g>`;   // mirror to the right side
  const WHITE = 'M32 76L60 82 58 87Q46 93 35 85Z', LID = 'M26 71L62 80 60 83.5 30 76Z', BROW = 'M29 66L61 74 60 69.5 32 60.5Z';
  const calmEye = `<path d="${WHITE}" fill="#fff"/><ellipse cx="49" cy="84.3" rx="5" ry="4.6" fill="url(#pfIris)"/><ellipse cx="49.6" cy="84.4" rx="2" ry="2.7" fill="#05080F"/><path d="M46 81.4h2.6l-1.1 2.3h-2.6z" fill="#fff"/><path d="${WHITE}" fill="none" stroke="${O}" stroke-width="2"/><path d="${LID}" fill="${O}"/><path d="${BROW}" fill="${O}"/>`;
  const alertEye = `<path d="${WHITE}" fill="#1A0710"/><path d="M33 80L12 74 14 79z" fill="#FF3B4E" opacity=".85"/><ellipse cx="49" cy="84.3" rx="4.6" ry="4.3" fill="#FF2E45"/><ellipse cx="49" cy="84.3" rx="1.3" ry="3.2" fill="#FFE1E4"/><path d="${WHITE}" fill="none" stroke="${O}" stroke-width="2"/><path d="M25 69L62 79.5 60 83.5 29 75Z" fill="${O}"/><path d="M28 62L61 73.5 60.5 68.5 31 56.5Z" fill="${O}"/>`;
  const stressEye = `<ellipse cx="47" cy="84" rx="11" ry="9.5" fill="#fff" stroke="${O}" stroke-width="2.2"/><circle cx="44" cy="84" r="2.6" fill="#0B2B4A"/><path d="M37 96q10 3.5 20 0" stroke="#8C8FB8" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M29 71L59 63.5 60 67.5 30.5 75Z" fill="${O}"/>`;
  const EYES = {
    calm: calmEye + M(calmEye) + `<path d="M81 97.5l7-3.5" stroke="${O}" stroke-width="2.6" stroke-linecap="round"/>`,
    thinking: `<path d="M33 84L59 84.5" stroke="${O}" stroke-width="4" stroke-linecap="round"/><path d="M29 74L61 78 60.5 73.5 31 68.5Z" fill="${O}"/>`
      + M(`<path d="${WHITE}" fill="#fff"/><ellipse cx="51" cy="83" rx="5" ry="4.6" fill="url(#pfIris)"/><ellipse cx="51.5" cy="83" rx="2" ry="2.7" fill="#05080F"/><path d="${WHITE}" fill="none" stroke="${O}" stroke-width="2"/><path d="${LID}" fill="${O}"/><path d="M30 61L61 66 60 61.5 33 55.5Z" fill="${O}"/>`)
      + `<path d="M107 84L99 97.9 83 97.9 75 84 83 70.1 99 70.1Z" fill="#4FE0FF" fill-opacity=".22" stroke="#4FE0FF" stroke-width="2" stroke-linejoin="round"/><g fill="none" stroke="#A8F4FF" stroke-width="1.2"><circle cx="91" cy="84" r="7" stroke-dasharray="4 3"/><path d="M91 74.5v4M91 89.5v4M81.5 84h4M96.5 84h4"/></g>`,
    happy: `<g fill="none" stroke="${O}" stroke-width="4.6" stroke-linecap="round"><path d="M34 85L47 77 59 84"/><path d="M106 85L93 77 81 84"/></g><path d="${BROW}" fill="${O}" transform="translate(0 -3)"/>${M(`<path d="${BROW}" fill="${O}" transform="translate(0 -3)"/>`)}`,
    alert: alertEye + M(alertEye) + `<g stroke="#FF3B4E" stroke-width="2.6" fill="none" stroke-linecap="round"><path d="M102 92q4 0 4-4M112 92q-4 0-4-4M102 98q4 0 4 4M112 98q-4 0-4 4"/></g>`,
    stress: stressEye + M(stressEye.replace('cx="44"', 'cx="50"')) + `<g fill="#9BE3FF" stroke="${O}" stroke-width="1.6"><path d="M14 66c-3 5-4 7-4 9a4 4 0 0 0 8 0c0-2-1-4-4-9z"/><path d="M124 52c-4 6-6 9-6 12a6 6 0 0 0 12 0c0-3-2-6-6-12z"/></g>`,
    rest: `<g fill="none" stroke="${O}" stroke-width="4" stroke-linecap="round"><path d="M33 84Q46 88 59 84"/><path d="M107 84Q94 88 81 84"/><path d="M30 74L60 77" stroke-width="5"/><path d="M110 74L80 77" stroke-width="5"/></g><text x="118" y="36" style="font:800 15px Sora,sans-serif;fill:#C9D2E3">z</text><text x="130" y="20" style="font:800 12px Sora,sans-serif;fill:#C9D2E3">z</text>`
  };
  // aura colour, aura strength, headband emblem colour
  const AURA = { calm:['#3FD0FF', .24, '#3FD0FF'], thinking:['#6C8CFF', .3, '#8FA8FF'], happy:['#FF8A1F', .55, '#FFD23F'],
    alert:['#FF2E45', .6, '#FF3B4E'], stress:['#FFB020', .42, '#FFB020'], rest:['#5D6577', 0, '#5D6577'] };
  const FLAME = 'M70 4L81 22 97 7 99 28 119 19 113 40 135 40 123 58 139 70 125 82 137 100 119 104 125 124 103 118 97 140 70 128 43 140 37 118 15 124 21 104 3 100 15 82 1 70 17 58 5 40 27 40 21 19 41 28 43 7 59 22Z';
  // chicken wings, folded away until he flies (2026-11-01); the right one is the left one mirrored
  // chicken wings (2026-11-01, redrawn): a rounded wing with layered feathers and grey primary tips, folded away
  // until he flies; the whole wing flaps from the shoulder. The right one is the left one mirrored.
  const WING = `<g class="pf-wing"><path d="M28 90C16 72-4 66-22 72C-34 76-42 86-40 94C-46 98-46 106-38 108C-42 114-38 120-29 119C-27 125-17 127-10 122C0 120 14 112 28 104Z" fill="#FFFFFF" stroke="${O}" stroke-width="2.6" stroke-linejoin="round"/>`
    + `<path d="M-40 94C-46 98-46 106-38 108C-34 104-30 100-28 97ZM-38 108C-42 114-38 120-29 119C-27 114-26 110-26 107ZM-29 119C-27 125-17 127-10 122C-12 118-14 115-15 112Z" fill="#DDE3EC"/>`
    + `<path d="M-28 97C-16 96-2 98 12 102M-26 107C-14 107 0 106 12 106M-15 112C-6 113 4 111 14 108M-8 84C2 82 12 85 22 92" stroke="#B9C3D2" stroke-width="1.8" fill="none" stroke-linecap="round"/></g>`;
  let seq = 0;
  function svg(mood){
    const m = EYES[mood] ? mood : 'calm', a = AURA[m], u = (++seq).toString(36);
    // every face gets its own gradient ids: a gradient inside a hidden copy (the header button on Home) can't be
    // used by the others, which left the head see-through
    return (`<svg viewBox="0 0 140 156" aria-hidden="true"><defs>`
      + `<linearGradient id="pfIris" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0B2B4A"/><stop offset="1" stop-color="#35C8FF"/></linearGradient>`
      + `<linearGradient id="pfHead" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E4E9F1"/></linearGradient>`
      + `<linearGradient id="pfPlate" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E6ECF4"/><stop offset="1" stop-color="#8E99AC"/></linearGradient></defs>`
      + `<circle class="pf-ring" cx="70" cy="80" r="52" fill="none" stroke="${m === 'calm' ? '#9FE6FF' : a[2]}" stroke-width="5" opacity="0"/>`
      + `<g class="pf-float"><path class="pf-aura" d="${FLAME}" fill="${a[0]}" opacity="${a[1]}"/>`
      + `<g class="pf-tails"${m === 'rest' ? ' transform="rotate(30 115 60)"' : ''}><path d="M114 58C128 54 140 58 150 68L144 73C136 65 126 62 115 64Z" fill="#232B3E" stroke="${O}" stroke-width="2.6" stroke-linejoin="round"/><path d="M115 62C127 66 134 76 137 90L130 91C128 80 123 72 115 68Z" fill="#1A2030" stroke="${O}" stroke-width="2.6" stroke-linejoin="round"/></g>`
      + `<g class="pf-wings"><g>${WING}</g><g transform="matrix(-1 0 0 1 140 0)">${WING}</g></g>`
      + `<path d="M42 38L30 12 52 26 52 2 69 22 82 0 86 25 108 9 102 36 116 30 104 44Z" fill="#E3262E" stroke="${O}" stroke-width="3" stroke-linejoin="round"/><path d="M52 26L55 34M69 22L68 32M86 25L82 34M102 36L95 40" stroke="#9E1219" stroke-width="2.4" stroke-linecap="round"/>`
      + `<path d="M18 80C18 46 40 26 70 26s52 20 52 54c0 22-10 36-24 44l-28 10-28-10C28 116 18 102 18 80z" fill="url(#pfHead)" stroke="${O}" stroke-width="3.2"/>`
      + `<path d="M22 54Q70 28 118 54L119 65Q70 40 21 65Z" fill="#232B3E" stroke="${O}" stroke-width="2.8" stroke-linejoin="round"/>`
      + `<rect x="55" y="38" width="30" height="16" rx="3" fill="url(#pfPlate)" stroke="${O}" stroke-width="2.4"/><path d="M63 51.5L67.5 41h2.2L65.2 51.5zM68.6 52L73.1 40.5h2.2L70.8 52zM74.2 51.5L78.7 41h2.2L76.4 51.5z" fill="${a[2]}"/>`
      + `<path d="M29 92L40 104" stroke="#B4424A" stroke-width="2.4" stroke-linecap="round"/><path d="M30.5 97.5l4-4M34.5 101.5l4-4" stroke="#B4424A" stroke-width="1.6" stroke-linecap="round"/>`
      + `<g class="pf-eyes">${EYES[m]}</g>`
      + `<path d="M63 99L79 99 71 107Z" fill="#D9711A" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"${m === 'happy' ? ' transform="rotate(26 66 99)"' : ''}/>`
      + `<path d="M57 91Q70 85 83 91L80 96 71 103 62 96Z" fill="#FF9A2E" stroke="${O}" stroke-width="2.8" stroke-linejoin="round"/>`
      + `<path d="M65 106c-2 6 0 11 5 11s6-5 4-11z" fill="#E3262E" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/></g></svg>`)
      .replace(/pf(Iris|Head|Plate)/g, 'pf$1' + u);
  }
  // Plumo from behind (2026-11-01: seen flying away toward the shed): the back of his head, the comb, the headband
  // knot with its tails, a fluffy chicken tail at the bottom, and both wings spread.
  function back(){
    const u = (++seq).toString(36);
    return `<svg viewBox="0 0 140 156" aria-hidden="true"><defs><linearGradient id="pfBk${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#DCE2EB"/></linearGradient></defs>`
      + `<g class="pf-float"><g class="pf-wings"><g>${WING}</g><g transform="matrix(-1 0 0 1 140 0)">${WING}</g></g>`
      + `<path d="M58 124c-6 10-4 22 4 26-1-8 2-14 8-18 4 6 6 12 4 20 8-4 10-16 6-26 6 4 10 10 10 18 6-8 4-18-4-24z" fill="#FFFFFF" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/>`
      + `<path d="M42 38L30 12 52 26 52 2 69 22 82 0 86 25 108 9 102 36 116 30 104 44Z" fill="#C81E26" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>`
      + `<path d="M18 80C18 46 40 26 70 26s52 20 52 54c0 22-10 36-24 44l-28 10-28-10C28 116 18 102 18 80z" fill="url(#pfBk${u})" stroke="${O}" stroke-width="3.2"/>`
      + `<path d="M40 100c8 10 18 15 30 15s22-5 30-15" stroke="#C9D2E0" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M50 84c6 4 14 6 20 6s14-2 20-6" stroke="#E2E7EF" stroke-width="2.4" fill="none" stroke-linecap="round"/>`
      + `<path d="M21 56Q70 40 119 56L119 67Q70 52 21 67Z" fill="#232B3E" stroke="${O}" stroke-width="2.8" stroke-linejoin="round"/>`
      + `<g class="pf-tails"><path d="M66 60C60 70 54 84 52 98L60 99C62 86 66 74 70 64Z" fill="#232B3E" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/><path d="M74 60C80 70 88 82 92 96L84 98C80 86 76 74 70 64Z" fill="#1A2030" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/></g>`
      + `<ellipse cx="70" cy="60" rx="8" ry="6" fill="#2C3650" stroke="${O}" stroke-width="2.4"/></g></svg>`;
  }
  // a short flight: wings out and flapping, up, a little loop, and back down (≈1.7 s). With ms (a longer trip the
  // page moves him on) he just bobs while flapping, for that long.
  function fly(el, ms){
    const f = el && (el.matches && el.matches('.plumoF,.rossR') ? el : el.querySelector && el.querySelector('.plumoF,.rossR'));   // .rossR: the report's own wrapper
    if(!f || f.classList.contains('pf-fly')) return;
    if(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const long = ms > 1800;
    f.classList.add('pf-fly'); if(long) f.classList.add('pf-cruise');
    setTimeout(()=> f.classList.remove('pf-fly', 'pf-cruise'), long ? ms : 1750);
  }
  // Entrances and expressions (2026-11-02, from mockup 1siPonVecvHoJadyWNYaTM): each mood has its own entrance
  // (calm settles in with a ripple, thinking turns his head, fired up jump-spins, battle mode charges and bursts,
  // stressed gets bonked, sleepy slumps). It plays when his mood changes and again every minute or so. In between,
  // now and then one face pulls a quick expression: a blink, a wink, a grin, a glance, a startle, a sleepy peek.
  const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const faceOf = el => el && (el.matches && el.matches('.plumoF,.rossR') ? el : el.querySelector && el.querySelector('.plumoF,.rossR'));
  const moodOf = f => { const m = (f.className.baseVal === undefined ? f.className : '').match(/\bpf-(calm|thinking|happy|alert|stress|rest)\b/) || [];
    return m[1] || (EYES[f.dataset.m] ? f.dataset.m : 'calm'); };
  const busy = f => f.classList.contains('pf-fly') || f.classList.contains('pf-emoting') || f.classList.contains('pf-blink') || f.dataset.pfe
    || f.__pfxRun || (f.parentElement && f.parentElement.__pfxRun);
  function enter(el){
    const f = faceOf(el); if(!f || reduced() || f.classList.contains('pf-fly')) return;
    delete f.dataset.pfe; void f.getBoundingClientRect(); f.dataset.pfe = moodOf(f);
    clearTimeout(f.__pfeT); f.__pfeT = setTimeout(()=>{ delete f.dataset.pfe; }, 1300);
  }
  const eyeAt = x => calmEye.replace('cx="49"', `cx="${x}"`).replace('cx="49.6"', `cx="${x + .6}"`).replace('M46 81.4', `M${x - 3} 81.4`);
  const shut = `<g fill="none" stroke="${O}" stroke-width="4.6" stroke-linecap="round"><path d="M34 85L47 77 59 84"/></g><path d="${BROW}" fill="${O}" transform="translate(0 -3)"/>`;
  const wide = `<ellipse cx="47" cy="83" rx="10" ry="10.5" fill="#fff" stroke="${O}" stroke-width="2.4"/><circle cx="47" cy="84" r="3.4" fill="#0B2B4A"/><circle cx="45.8" cy="82.6" r="1.1" fill="#fff"/><path d="M31 64L59 60 59.5 64.5 32 68Z" fill="${O}"/>`;
  const EMO = {
    wink: calmEye + M(shut), grin: EYES.happy, surprised: wide + M(wide),
    lookL: eyeAt(45) + M(eyeAt(53)), lookR: eyeAt(53) + M(eyeAt(45)),
    peek: calmEye + M(`<g fill="none" stroke="${O}" stroke-width="4" stroke-linecap="round"><path d="M33 84Q46 88 59 84"/><path d="M30 74L60 77" stroke-width="5"/></g>`)
  };
  const EMO_BY = { calm:['blink','blink','wink','grin','lookL','lookR'], thinking:['blink','lookL','lookR'], happy:['wink','lookL','lookR','surprised'],
    alert:['blink','blink','surprised','lookL'], stress:['blink','surprised','lookL','lookR'], rest:['peek'] };
  function emote(el, kind){
    const f = faceOf(el); if(!f || busy(f)) return;
    const list = EMO_BY[moodOf(f)] || EMO_BY.calm; kind = kind || list[Math.floor(Math.random() * list.length)];
    if(kind === 'blink'){ f.classList.add('pf-blink'); setTimeout(()=> f.classList.remove('pf-blink'), 260); return kind; }
    const eyes = f.querySelector('.pf-eyes'); if(!eyes || !EMO[kind]) return;
    const ir = f.querySelector('[id^="pfIris"]');
    eyes.insertAdjacentHTML('afterend', `<g class="pf-emo">${EMO[kind].replace(/pfIris/g, ir ? ir.id : 'pfIris')}</g>`);
    f.classList.add('pf-emoting'); f.dataset.pfo = kind;
    setTimeout(()=>{ const g = f.querySelector('.pf-emo'); if(g) g.remove(); f.classList.remove('pf-emoting'); delete f.dataset.pfo; }, kind === 'wink' ? 950 : 1400);
    return kind;
  }
  // faces big enough to notice, on screen and not mid-move
  const shown = () => [...document.querySelectorAll('.plumoF,.rossR')].filter(f => {
    if(f.offsetWidth < 40 || !f.offsetParent || busy(f)) return false;
    const r = f.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; });
  (function emoTick(){ setTimeout(()=>{ if(document.visibilityState === 'visible'){ const a = shown(); if(a.length) emote(a[Math.floor(Math.random() * a.length)]); } emoTick(); }, 7000 + Math.random() * 6000); })();
  (function enterTick(first){ setTimeout(()=>{ if(document.visibilityState === 'visible') shown().forEach((f, i)=> setTimeout(()=> enter(f), i * 180)); enterTick(false); },
    first ? 2500 : 55000 + Math.random() * 30000); })(true);
  function html(mood, cls){ return `<span class="plumoF pf-${EYES[mood] ? mood : 'calm'}${cls ? ' ' + cls : ''}">${svg(mood)}</span>`; }
  if(!document.getElementById('plumoFaceCss')){
    const st = document.createElement('style'); st.id = 'plumoFaceCss';
    st.textContent = '.plumoF{display:inline-block;line-height:0}.plumoF svg{width:100%;height:100%;overflow:visible;display:block}'
      + ':is(.plumoF,.rossR) .pf-float{transform-box:fill-box;transform-origin:50% 50%;animation:pfHover 3.2s ease-in-out infinite}'
      + ':is(.plumoF,.rossR) .pf-aura{transform-box:fill-box;transform-origin:50% 60%;animation:pfFlick 1.4s ease-in-out infinite}'
      + '.plumoF.pf-alert .pf-aura,.rossR.alert .pf-aura{animation-duration:.5s}.plumoF.pf-stress .pf-aura,.rossR.stress .pf-aura{animation-duration:.3s}.plumoF.pf-rest .pf-float,.rossR.rest .pf-float{animation-duration:6s}'
      + '@keyframes pfHover{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}@keyframes pfFlick{0%,100%{transform:scale(1)}50%{transform:scale(1.05,1.09)}}'
      + ':is(.plumoF,.rossR) .pf-wings{opacity:0;transition:opacity .15s}:is(.plumoF,.rossR) .pf-wing{transform-box:fill-box;transform-origin:100% 40%}'
      + ':is(.plumoF,.rossR).pf-fly .pf-wings{opacity:1}:is(.plumoF,.rossR).pf-fly .pf-wing{animation:pfFlap .13s cubic-bezier(.5,0,.5,1) infinite alternate}'
      + ':is(.plumoF,.rossR).pf-fly .pf-float{animation:pfFly 1.7s cubic-bezier(.4,0,.3,1)}'
      + ':is(.plumoF,.rossR).pf-fly.pf-cruise .pf-float{animation:pfCruise .45s ease-in-out infinite alternate}'
      + '@keyframes pfCruise{from{transform:translateY(0) rotate(-4deg)}to{transform:translateY(-7px) rotate(4deg)}}'
      + '@keyframes pfFlap{0%{transform:rotate(-34deg) scale(1.05,1.08)}100%{transform:rotate(30deg) scale(.95,.72)}}'
      + '@keyframes pfFly{0%{transform:translate(0,0)}12%{transform:translate(0,5px) scale(1.06,.94)}30%{transform:translate(-8px,-30px) rotate(-8deg)}50%{transform:translate(4px,-44px) rotate(4deg)}68%{transform:translate(10px,-30px) rotate(9deg)}86%{transform:translate(0,-6px) rotate(-2deg)}93%{transform:translate(0,3px) scale(1.05,.95)}100%{transform:translate(0,0)}}'
      + ':is(.plumoF,.rossR) .pf-ring{transform-box:fill-box;transform-origin:50% 50%}'
      + ':is(.plumoF,.rossR)[data-pfe=calm] .pf-float{animation:pfEnCalm .8s cubic-bezier(.3,1.4,.5,1)}:is(.plumoF,.rossR)[data-pfe=calm] .pf-ring{animation:pfRing 1.1s ease-out}'
      + ':is(.plumoF,.rossR)[data-pfe=thinking] .pf-float{animation:pfEnTurn .8s ease-in-out}'
      + ':is(.plumoF,.rossR)[data-pfe=happy] .pf-float{animation:pfEnJump .9s cubic-bezier(.3,.7,.4,1)}:is(.plumoF,.rossR)[data-pfe=happy] .pf-ring{animation:pfRing .6s .5s ease-out}:is(.plumoF,.rossR)[data-pfe=happy] .pf-aura{animation:pfBurst .6s .5s ease-out}'
      + ':is(.plumoF,.rossR)[data-pfe=alert] .pf-float{animation:pfEnBurst .8s cubic-bezier(.2,1.4,.4,1)}:is(.plumoF,.rossR)[data-pfe=alert] .pf-ring{animation:pfRing .5s .28s ease-out}:is(.plumoF,.rossR)[data-pfe=alert] .pf-aura{animation:pfBurst .5s .28s ease-out}'
      + ':is(.plumoF,.rossR)[data-pfe=stress] .pf-float{animation:pfEnBonk 1s ease-out}'
      + ':is(.plumoF,.rossR)[data-pfe=rest] .pf-float{animation:pfEnSlump 1.1s ease-in-out}'
      + '@keyframes pfRing{0%{opacity:1;transform:scale(.4);stroke-width:6}100%{opacity:0;transform:scale(1.7);stroke-width:1}}'
      + '@keyframes pfBurst{0%{transform:scale(.7)}50%{transform:scale(1.25,1.3)}100%{transform:scale(1)}}'
      + '@keyframes pfEnCalm{0%{transform:translateY(-16px) scale(.94)}60%{transform:translateY(3px) scale(1.02,.98)}100%{transform:none}}'
      + '@keyframes pfEnTurn{0%{transform:none}25%{transform:scaleX(.12)}50%{transform:rotate(-12deg)}75%{transform:rotate(4deg)}100%{transform:none}}'
      + '@keyframes pfEnJump{0%{transform:translateY(4px) scale(1.12,.84)}20%{transform:translateY(-30px) scale(.9,1.1)}55%{transform:translateY(-36px) rotate(360deg)}80%{transform:translateY(0) scale(1.16,.84) rotate(360deg)}100%{transform:rotate(360deg)}}'
      + '@keyframes pfEnBurst{0%{transform:none}12%{transform:translate(-1px,2px) scale(1.04,.94)}24%{transform:translate(1px,3px) scale(1.06,.92)}34%{transform:translateY(4px) scale(1.08,.9)}42%{transform:translateY(4px) scale(.88,1.14)}66%{transform:translateY(-10px) scale(1.06,.97)}100%{transform:none}}'
      + '@keyframes pfEnBonk{0%,25%{transform:translateY(-6px)}35%{transform:translateY(8px) scale(1.14,.8)}50%{transform:translateY(-6px) scale(.94,1.06)}62%{transform:translateY(2px) scale(1.04,.96)}70%{transform:translateX(-4px) rotate(-6deg)}80%{transform:translateX(4px) rotate(6deg)}90%{transform:translateX(-2px)}100%{transform:none}}'
      + '@keyframes pfEnSlump{0%{transform:translateY(-4px)}35%{transform:translateY(-8px) rotate(4deg) scale(.97,1.05)}70%{transform:translateY(12px) rotate(-12deg) scale(1.04,.94)}100%{transform:none}}'
      + ':is(.plumoF,.rossR).pf-blink .pf-eyes{transform-box:fill-box;transform-origin:50% 50%;animation:pfBlink .24s ease-in-out}'
      + '@keyframes pfBlink{0%,100%{transform:scaleY(1)}45%,55%{transform:scaleY(.08)}}'
      + ':is(.plumoF,.rossR).pf-emoting .pf-eyes{opacity:0}:is(.plumoF,.rossR) .pf-emo{transform-box:fill-box;transform-origin:50% 50%;animation:pfEmoIn .16s ease-out}'
      + '@keyframes pfEmoIn{from{transform:scaleY(.2)}to{transform:none}}'
      + ':is(.plumoF,.rossR)[data-pfo=wink] .pf-float{animation:pfTilt .95s ease-in-out}:is(.plumoF,.rossR)[data-pfo=grin] .pf-float{animation:pfBop .7s ease-in-out 2}'
      + ':is(.plumoF,.rossR)[data-pfo=surprised] .pf-float{animation:pfStartle .6s ease-out}'
      + ':is(.plumoF,.rossR)[data-pfo=lookL] .pf-float{animation:pfLook 1.4s ease-in-out}:is(.plumoF,.rossR)[data-pfo=lookR] .pf-float{animation:pfLookR 1.4s ease-in-out}'
      + '@keyframes pfTilt{0%,100%{transform:none}30%,70%{transform:rotate(-8deg) translateY(-2px)}}'
      + '@keyframes pfBop{0%,100%{transform:none}40%{transform:translateY(-7px) scale(.97,1.04)}80%{transform:translateY(1px) scale(1.03,.97)}}'
      + '@keyframes pfStartle{0%{transform:none}20%{transform:translateY(-9px) scale(.95,1.07)}50%{transform:translateY(1px) scale(1.04,.96)}100%{transform:none}}'
      + '@keyframes pfLook{0%,100%{transform:none}20%,80%{transform:rotate(-4deg) translateX(-2px)}}@keyframes pfLookR{0%,100%{transform:none}20%,80%{transform:rotate(4deg) translateX(2px)}}'
      + '@media (prefers-reduced-motion:reduce){.plumoF *,.rossR *{animation:none!important}}';
    (document.head || document.documentElement).appendChild(st);
  }
  window.PlumoFace = { svg, html, back, fly, enter, emote, moods: Object.keys(EYES) };
})();
