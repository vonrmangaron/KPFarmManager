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
  const WING = `<path class="pf-wing" d="M27 90C10 66-18 66-34 80C-22 82-25 88-30 95C-17 95-18 101-21 108C-7 104 9 103 27 104Z" fill="#FFFFFF" stroke="${O}" stroke-width="2.6" stroke-linejoin="round"/>`
    + `<path class="pf-wing" d="M-14 86C-2 86 10 90 22 96M-12 98C0 97 12 99 22 101" stroke="#C9D2E0" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  let seq = 0;
  function svg(mood){
    const m = EYES[mood] ? mood : 'calm', a = AURA[m], u = (++seq).toString(36);
    // every face gets its own gradient ids: a gradient inside a hidden copy (the header button on Home) can't be
    // used by the others, which left the head see-through
    return (`<svg viewBox="0 0 140 156" aria-hidden="true"><defs>`
      + `<linearGradient id="pfIris" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0B2B4A"/><stop offset="1" stop-color="#35C8FF"/></linearGradient>`
      + `<linearGradient id="pfHead" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E4E9F1"/></linearGradient>`
      + `<linearGradient id="pfPlate" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E6ECF4"/><stop offset="1" stop-color="#8E99AC"/></linearGradient></defs>`
      + `<g class="pf-float"><path class="pf-aura" d="${FLAME}" fill="${a[0]}" opacity="${a[1]}"/>`
      + `<g class="pf-tails"${m === 'rest' ? ' transform="rotate(30 115 60)"' : ''}><path d="M114 58C128 54 140 58 150 68L144 73C136 65 126 62 115 64Z" fill="#232B3E" stroke="${O}" stroke-width="2.6" stroke-linejoin="round"/><path d="M115 62C127 66 134 76 137 90L130 91C128 80 123 72 115 68Z" fill="#1A2030" stroke="${O}" stroke-width="2.6" stroke-linejoin="round"/></g>`
      + `<g class="pf-wings"><g>${WING}</g><g transform="matrix(-1 0 0 1 140 0)">${WING}</g></g>`
      + `<path d="M42 38L30 12 52 26 52 2 69 22 82 0 86 25 108 9 102 36 116 30 104 44Z" fill="#E3262E" stroke="${O}" stroke-width="3" stroke-linejoin="round"/><path d="M52 26L55 34M69 22L68 32M86 25L82 34M102 36L95 40" stroke="#9E1219" stroke-width="2.4" stroke-linecap="round"/>`
      + `<path d="M18 80C18 46 40 26 70 26s52 20 52 54c0 22-10 36-24 44l-28 10-28-10C28 116 18 102 18 80z" fill="url(#pfHead)" stroke="${O}" stroke-width="3.2"/>`
      + `<path d="M22 54Q70 28 118 54L119 65Q70 40 21 65Z" fill="#232B3E" stroke="${O}" stroke-width="2.8" stroke-linejoin="round"/>`
      + `<rect x="55" y="38" width="30" height="16" rx="3" fill="url(#pfPlate)" stroke="${O}" stroke-width="2.4"/><path d="M63 51.5L67.5 41h2.2L65.2 51.5zM68.6 52L73.1 40.5h2.2L70.8 52zM74.2 51.5L78.7 41h2.2L76.4 51.5z" fill="${a[2]}"/>`
      + `<path d="M29 92L40 104" stroke="#B4424A" stroke-width="2.4" stroke-linecap="round"/><path d="M30.5 97.5l4-4M34.5 101.5l4-4" stroke="#B4424A" stroke-width="1.6" stroke-linecap="round"/>`
      + EYES[m]
      + `<path d="M63 99L79 99 71 107Z" fill="#D9711A" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"${m === 'happy' ? ' transform="rotate(26 66 99)"' : ''}/>`
      + `<path d="M57 91Q70 85 83 91L80 96 71 103 62 96Z" fill="#FF9A2E" stroke="${O}" stroke-width="2.8" stroke-linejoin="round"/>`
      + `<path d="M65 106c-2 6 0 11 5 11s6-5 4-11z" fill="#E3262E" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/></g></svg>`)
      .replace(/pf(Iris|Head|Plate)/g, 'pf$1' + u);
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
  function html(mood, cls){ return `<span class="plumoF pf-${EYES[mood] ? mood : 'calm'}${cls ? ' ' + cls : ''}">${svg(mood)}</span>`; }
  if(!document.getElementById('plumoFaceCss')){
    const st = document.createElement('style'); st.id = 'plumoFaceCss';
    st.textContent = '.plumoF{display:inline-block;line-height:0}.plumoF svg{width:100%;height:100%;overflow:visible;display:block}'
      + ':is(.plumoF,.rossR) .pf-float{transform-box:fill-box;transform-origin:50% 50%;animation:pfHover 3.2s ease-in-out infinite}'
      + ':is(.plumoF,.rossR) .pf-aura{transform-box:fill-box;transform-origin:50% 60%;animation:pfFlick 1.4s ease-in-out infinite}'
      + '.plumoF.pf-alert .pf-aura,.rossR.alert .pf-aura{animation-duration:.5s}.plumoF.pf-stress .pf-aura,.rossR.stress .pf-aura{animation-duration:.3s}.plumoF.pf-rest .pf-float,.rossR.rest .pf-float{animation-duration:6s}'
      + '@keyframes pfHover{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}@keyframes pfFlick{0%,100%{transform:scale(1)}50%{transform:scale(1.05,1.09)}}'
      + ':is(.plumoF,.rossR) .pf-wings{opacity:0;transition:opacity .15s}.plumoF .pf-wing{transform-box:fill-box;transform-origin:100% 45%}'
      + ':is(.plumoF,.rossR).pf-fly .pf-wings{opacity:1}:is(.plumoF,.rossR).pf-fly .pf-wing{animation:pfFlap .16s ease-in-out infinite alternate}'
      + ':is(.plumoF,.rossR).pf-fly .pf-float{animation:pfFly 1.7s cubic-bezier(.4,0,.3,1)}'
      + ':is(.plumoF,.rossR).pf-fly.pf-cruise .pf-float{animation:pfCruise .45s ease-in-out infinite alternate}'
      + '@keyframes pfCruise{from{transform:translateY(0) rotate(-4deg)}to{transform:translateY(-7px) rotate(4deg)}}'
      + '@keyframes pfFlap{from{transform:rotate(-28deg) scaleY(1.05)}to{transform:rotate(26deg) scaleY(.8)}}'
      + '@keyframes pfFly{0%{transform:translate(0,0)}12%{transform:translate(0,5px) scale(1.06,.94)}30%{transform:translate(-8px,-30px) rotate(-8deg)}50%{transform:translate(4px,-44px) rotate(4deg)}68%{transform:translate(10px,-30px) rotate(9deg)}86%{transform:translate(0,-6px) rotate(-2deg)}93%{transform:translate(0,3px) scale(1.05,.95)}100%{transform:translate(0,0)}}'
      + '@media (prefers-reduced-motion:reduce){.plumoF *,.rossR *{animation:none!important}}';
    (document.head || document.documentElement).appendChild(st);
  }
  window.PlumoFace = { svg, html, fly, moods: Object.keys(EYES) };
})();
