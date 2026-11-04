// Plumo stands out (2026-11-01, mockups 3jxoQJegE3dDhJJ7UcBAJP + 1siPonVecvHoJadyWNYaTM; the user chose A on computers,
// C on phones):
//  • computers: a Plumo hero on top of Home — the anime farm scene (weather follows his mood), his face, a speech
//    bubble with today's headline and red items, Open morning report + Birds Eye View, and the batch panel
//    (the old batch banner, moved in). On phones the hero folds away and the batch banner shows as before.
//  • phones: the floating Plumo is a big tile with a mood-coloured ring, a count of red items and a speech bubble
//    while today's report is unread.
// The scene is drawn once in code (no images) and reused; its classes and ids are scoped (.phs, ph…).
const PH_MOOD={calm:['#18A57A','Calm'],thinking:['#6C8CFF','Thinking…'],happy:['#FF8A1F','Fired up'],alert:['#E5383B','Battle mode'],stress:['#FFB020','Stressed'],rest:['#8E95A3','Sleepy']};
let phSceneCache=null;
function phSceneHtml(){
  if(phSceneCache)return phSceneCache;
  const sr=(a,b)=>a+Math.random()*(b-a),f=n=>n.toFixed(1),INK='#2A3346';
  // drawn wide (2026-11-01): the hero is about 3.5× wider than tall, so a 540-wide picture was blown up and cropped.
  // 1080 × 350 fills it at its own size; the bottom stays put, a little sky comes off the top.
  const W=1080,SX=940,VB=`viewBox="0 50 ${W} 350" preserveAspectRatio="xMidYMax slice"`;
  let seed=11;const rnd=(a,b)=>{seed=(seed*16807)%2147483647;return a+(seed/2147483647)*(b-a);};   // same layout every load
  const SK={calm:['#3F86DC','#86BEF0','#D6ECF8','#FFF0D2'],thinking:['#141B48','#33408C','#8486CC','#F0A9C0'],happy:['#4E86D6','#9CC4EE','#FFE2B0','#FFC07A'],
    alert:['#0E0208','#3A0918','#8A1B2C','#E8573A'],rain:['#3E4B63','#66758F','#9DA9BC','#C4CCD8'],cloud:['#71839F','#9FAEC4','#CBD4E1','#E6EAF0'],stress:['#5A2A12','#B0602A','#E99A4C','#FFD48A'],rest:['#02041A','#0B1240','#1E2A62','#39407C']};
  let defs='',skies='';
  for(const k in SK){const c=SK[k];defs+=`<linearGradient id="phsk-${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset=".38" stop-color="${c[1]}"/><stop offset=".66" stop-color="${c[2]}"/><stop offset="1" stop-color="${c[3]}"/></linearGradient>`;
    skies+=`<rect class="sky sky-${k}" width="${W}" height="400" fill="url(#phsk-${k})"/>`;}
  const puff=(cx,cy,r)=>`<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}"/>`;
  function cumulus(x,y,s){
    const P=[[0,0,34],[30,-14,40],[64,-4,32],[18,-46,30],[48,-52,34],[34,-86,26],[60,-90,22],[-24,6,24],[88,10,24]];
    return `<g class="cB">${P.map(([a,b,r])=>puff(x+a*s+4*s,y+b*s+10*s,r*s)).join('')}</g><g class="cA">${P.map(([a,b,r])=>puff(x+a*s,y+b*s,r*s)).join('')}</g><g class="cC" opacity=".85">${P.map(([a,b,r])=>puff(x+a*s+5*s,y+b*s-5*s,r*s*.72)).join('')}</g>`;
  }
  const streak=(x,y,w)=>`<ellipse class="cA" cx="${x}" cy="${y}" rx="${w}" ry="${f(w*.07)}" opacity=".75"/><ellipse class="cC" cx="${x+8}" cy="${y-2}" rx="${f(w*.6)}" ry="${f(w*.035)}" opacity=".9"/>`;
  const sky1=o=>cumulus(150+o,196,1.35)+cumulus(330+o,204,.85)+streak(90+o,52,60)+streak(280+o,34,50)+streak(470+o,100,44);
  let stars='';for(let i=0;i<110;i++)stars+=`<circle cx="${f(sr(0,W))}" cy="${f(sr(50,220))}" r="${f(sr(.5,1.8))}" fill="#fff" style="animation-delay:-${f(sr(0,3))}s"/>`;
  let rays='';for(let i=0;i<12;i++){const a=i*Math.PI/6;rays+=`<path d="M${SX} 78L${f(SX+Math.cos(a-.1)*300)} ${f(78+Math.sin(a-.1)*300)}L${f(SX+Math.cos(a+.1)*300)} ${f(78+Math.sin(a+.1)*300)}Z"/>`;}
  let beams='';[[-1.95,.07],[-2.2,.05],[-2.45,.09],[-2.75,.05],[-1.7,.04]].forEach(([a,w],i)=>{const A=a+Math.PI;
    beams+=`<path d="M${SX} 78L${f(SX+Math.cos(A-w)*820)} ${f(78+Math.sin(A-w)*820)}L${f(SX+Math.cos(A+w)*820)} ${f(78+Math.sin(A+w)*820)}Z" style="animation-delay:-${i*.7}s"/>`;});
  const fl=[[.28,10,'#fff',.22],[.42,5,'#FFE9A8',.35],[.55,16,'#9FE3FF',.12],[.7,7,'#fff',.25],[.86,22,'#FFD0F0',.08]].map(([t,r,c,o])=>{const x=SX+(320-SX)*t*1.2,y=78+(320-78)*t*1.2;
    return `<polygon points="${[0,1,2,3,4,5].map(k=>f(x+Math.cos(k*Math.PI/3)*r)+','+f(y+Math.sin(k*Math.PI/3)*r)).join(' ')}" fill="${c}" opacity="${o}"/>`;}).join('');
  const bird=(x,y,d)=>`<g transform="translate(${x} ${y})"><g class="bird"><path d="M0 0q5-6 10 0q5-6 10 0" fill="none" stroke="#1F2A3A" stroke-width="2" stroke-linecap="round" style="animation-delay:${d}s"/></g></g>`;
  let wind='';for(let i=0;i<9;i++)wind+=`<path d="M0 ${f(sr(30,260))}h${f(sr(40,110))}" style="animation-delay:-${f(sr(0,1.6))}s;animation-duration:${f(sr(1,1.8))}s"/>`;
  const cl=(a,b)=>{let s='';for(const o of [0,540,1080])for(const [x,y,z] of [[30,70,1],[190,38,.75],[320,112,.6],[450,60,1.1]])s+=`<g transform="translate(${x+o} ${y}) scale(${z})"><ellipse cx="22" cy="14" rx="42" ry="11" fill="${b}"/><circle cx="0" cy="2" r="16" fill="${a}"/><circle cx="20" cy="-8" r="22" fill="${a}"/><circle cx="42" cy="0" r="15" fill="${a}"/><ellipse cx="21" cy="8" rx="40" ry="11" fill="${a}"/></g>`;return s;};
  const SKY=`<svg class="L" ${VB} aria-hidden="true"><defs>${defs}
  <radialGradient id="phsunGlow"><stop offset="0" stop-color="#FFFBE6" stop-opacity=".95"/><stop offset=".35" stop-color="#FFF1B8" stop-opacity=".45"/><stop offset="1" stop-color="#FFF1B8" stop-opacity="0"/></radialGradient>
  <linearGradient id="phbeamG" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFBE0" stop-opacity=".5"/><stop offset="1" stop-color="#FFFBE0" stop-opacity="0"/></linearGradient></defs>${skies}
  <g class="stars">${stars}</g>
  <g class="moonG"><circle cx="${SX}" cy="78" r="60" fill="url(#phsunGlow)" opacity=".35"/><path d="M${SX} 52a26 26 0 1 0 24 36 21 21 0 1 1-24-36z" fill="#FFF3CF"/></g>
  <g class="clouds"><g class="cl">${sky1(0)}${sky1(540)}${sky1(1080)}</g></g>
  <g class="sunG"><g class="rays" fill="#FFF3C4" fill-opacity=".14">${rays}</g><circle cx="${SX}" cy="78" r="110" fill="url(#phsunGlow)"/><circle cx="${SX}" cy="78" r="21" fill="#FFFDF2"/><path d="M${SX-56} 78h112M${SX} 22v112" stroke="#FFFBE6" stroke-width="1.4" opacity=".7"/></g>
  <g class="beams" fill="url(#phbeamG)">${beams}</g>
  <g class="lflare">${fl}</g>
  <g class="storm"><g class="cl">${cl('#3B1E2A','#1E0D16')}</g></g>
  <path class="sbolt" d="M520 40l-14 60 18-4-22 70 10-2-18 60" fill="none" stroke="#FFE8EC" stroke-width="3.5" stroke-linejoin="round"/>
  <g class="birds">${bird(0,70,0)}${bird(26,58,.15)}${bird(48,80,.3)}</g>
  <g class="wind" stroke="#FFF6E0" stroke-width="2" stroke-linecap="round" fill="none" opacity=".75">${wind}</g></svg>`;
  
  // ---- land ----
  // far hills' tree rows, patchwork fields
  let treeRow='';for(let x=0;x<W;x+=9){const y=226+Math.sin(x*.05)*6;treeRow+=`<circle cx="${x}" cy="${f(y)}" r="${f(5+Math.cos(x*.3)*1.5)}" fill="#3F8C52"/><circle cx="${x+1.5}" cy="${f(y-2)}" r="${f(3)}" fill="#6CB65E"/>`;}
  // the big tree: dark mass, mid body, sunlit clumps on the right
  const canopy=[[40,170,46],[92,150,40],[10,214,36],[78,206,40],[130,192,30],[54,124,32],[120,140,26]];
  const tree=`<path d="M58 352C62 300 54 262 46 226L60 224C64 252 72 300 76 352Z" fill="#6B4A32" stroke="${INK}" stroke-width="1.2"/><path d="M60 250L94 214M56 236L26 210" stroke="#6B4A32" stroke-width="6" stroke-linecap="round"/>
   <g fill="#24603B">${canopy.map(([x,y,r])=>puff(x,y,r)).join('')}</g><g fill="#3E8F4E">${canopy.map(([x,y,r])=>puff(x+5,y-4,r*.78)).join('')}</g><g fill="#7DCB64">${canopy.map(([x,y,r])=>puff(x+12,y-10,r*.38)).join('')}</g>
   <ellipse cx="80" cy="356" rx="74" ry="9" fill="#2C6A33" opacity=".35"/>`;
  // Aussie water windmill + corrugated tank on the hill
  const mill=`<g stroke="#5A4636" stroke-width="1.4" fill="none"><path d="M168 262L178 182L188 262"/><path d="M171 236h14M174 212h8M170 248L186 230M186 248L170 230"/></g>
   <g transform="translate(178 180)"><g class="blades" fill="#E9EEF3" stroke="${INK}" stroke-width=".6">${[0,1,2,3,4,5,6,7,8,9,10,11].map(i=>`<path d="M0 0L${f(Math.cos(i*Math.PI/6-.12)*18)} ${f(Math.sin(i*Math.PI/6-.12)*18)}L${f(Math.cos(i*Math.PI/6+.12)*18)} ${f(Math.sin(i*Math.PI/6+.12)*18)}Z"/>`).join('')}</g><circle r="2.6" fill="${INK}"/><path d="M2 0h14l5 -5v10l-5-5" fill="#D9DEE4" stroke="${INK}" stroke-width=".8"/></g>
   <rect x="196" y="244" width="26" height="18" fill="#C9D2DB" stroke="${INK}" stroke-width="1"/><path d="M199 244v18M203 244v18M207 244v18M211 244v18M215 244v18M219 244v18" stroke="#9AA6B3" stroke-width=".7"/><ellipse cx="209" cy="244" rx="13" ry="3" fill="#E6EBF0" stroke="${INK}" stroke-width="1"/>`;
  // tunnel shed at an angle on the right, gable end with fans toward us, two silos behind
  const fan=(cx,cy)=>`<rect x="${cx-8}" y="${cy-8}" width="16" height="16" rx="1.5" fill="#2E3A4C" stroke="${INK}" stroke-width=".9"/><circle cx="${cx}" cy="${cy}" r="6.6" fill="#161E2A"/><g class="blades" fill="#B9C9D8"><ellipse cx="${cx}" cy="${cy}" rx="1.6" ry="6"/><ellipse cx="${cx}" cy="${cy}" rx="6" ry="1.6"/></g>`;
  const silo=(cx,top,h,w)=>`<rect x="${cx-w/2}" y="${top}" width="${w}" height="${h}" fill="url(#phsiloC)" stroke="${INK}" stroke-width="1.2"/><path d="M${cx-w/2} ${top}L${cx} ${top-w*.7}L${cx+w/2} ${top}Z" fill="#E8EEF4" stroke="${INK}" stroke-width="1.2"/><path d="M${cx+w*.18} ${top+4}v${h-8}" stroke="#fff" stroke-width="2" opacity=".9"/><path d="M${cx-w/2} ${top+h}L${cx} ${top+h+8}L${cx+w/2} ${top+h}Z" fill="#9AA6B5" stroke="${INK}" stroke-width="1"/>`;
  let inl='';for(let i=0;i<9;i++){const t=i/8,x=350+(492-350)*t,y=252+(282-252)*t,w=6+5*t,h=2.6+2.4*t;inl+=`<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx=".8"/>`;}
  let corr='';for(let i=0;i<=24;i++){const t=i/24,x1=342+(500-342)*t,y1=245+(278-245)*t;corr+=`M${f(x1)} ${f(y1)}L${f(x1+10+8*t)} ${f(y1-6-5*t)}`;}
  const shed=`<path d="M330 262L520 304L540 304V312L330 270Z" fill="#2C6A33" opacity=".3"/>
   <polygon points="342,258 500,300 500,280 342,246" fill="#EFF3F6" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>
   <polygon points="342,254 500,294 500,288 342,250" fill="#3E8E86"/>
   <g fill="#5E738C">${inl}</g>
   <polygon points="342,246 500,280 518,267 354,239" fill="#F4EFE6" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/><path d="${corr}" stroke="#CFC7BA" stroke-width=".8"/>
   <path d="M354 239L518 267" stroke="#fff" stroke-width="1.6"/>
   <polygon points="500,300 500,280 518,267 536,280 536,300" fill="#DCE3EA" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/><polygon points="518,267 536,280 536,300 518,300" fill="#BCC7D2" opacity=".7"/>
   ${fan(509,289)}${fan(527,289)}`;
  const lits=`<polygon points="342,254 500,294 500,288 342,250"/>${inl}`;
  // road: from the bottom middle, winding back to the hills
  const road=`<path d="M206 400C226 352 298 330 286 300C276 274 246 262 262 246C270 238 284 234 296 232L302 232C292 236 280 242 276 248C264 262 300 276 312 300C326 332 288 360 334 400Z" fill="#E2C48E"/>
   <path d="M226 400C244 356 300 334 296 300C290 276 262 262 272 248" fill="none" stroke="#C9A56A" stroke-width="1.6" opacity=".8"/><path d="M314 400C302 360 318 330 304 300C294 278 276 262 286 246" fill="none" stroke="#C9A56A" stroke-width="1.6" opacity=".8"/>`;
  // round hay bales
  const bale=(x,y,r)=>`<ellipse cx="${x+r*.9}" cy="${y+r*.85}" rx="${r*1.2}" ry="${r*.3}" fill="#2C6A33" opacity=".35"/><rect x="${x-r*.2}" y="${y-r}" width="${r*1.2}" height="${r*2}" fill="#D9A84E" stroke="${INK}" stroke-width=".8"/><circle cx="${x-r*.2}" cy="${y}" r="${r}" fill="#F0C66C" stroke="${INK}" stroke-width=".8"/><path d="M${x-r*.2} ${y}m-${r*.55} 0a${r*.55} ${r*.55} 0 1 1 ${r*1.1} 0a${r*.3} ${r*.3} 0 1 1 -${r*.6} 0" fill="none" stroke="#C99A44" stroke-width=".9"/>`;
  // wooden fence along the front left
  const posts=[[110,318,1],[150,322,.9],[186,325,.8],[0,312,1.2],[46,315,1.1]];
  const fence=`<g stroke="#7A5434" stroke-width="2.4" stroke-linecap="round"><path d="M0 300L200 316M0 312L200 326"/></g>${posts.map(([x,y,s])=>`<rect x="${x-3*s}" y="${y-26*s}" width="${6*s}" height="${32*s}" rx="1" fill="#8A5E3C" stroke="${INK}" stroke-width=".8"/><rect x="${x-3*s}" y="${y-26*s}" width="${2*s}" height="${32*s}" fill="#B98A5E"/>`).join('')}`;
  let flowers='';for(let i=0;i<80;i++){const x=rnd(0,W),y=rnd(332,398),c=['#FFFFFF','#FFE680','#FFC2DA','#C9B6FF'][i%4];flowers+=`<circle cx="${f(x)}" cy="${f(y)}" r="${f(rnd(1.2,2.6))}" fill="${c}"/>`;}
  const tuft=(x,y,s,c)=>`<g transform="translate(${x} ${y}) scale(${s})"><path class="tuft" d="M0 0q-3-14-9-21q7 6 9 14q1-13 6-23q-2 13-1 23q3-9 9-15q-5 9-5 22z" fill="${c}" stroke="#1F5A2E" stroke-width=".8"/></g>`;
  const tufts=[[14,400,1.6],[42,400,1.1],[160,402,1.2],[380,400,1.3],[620,400,1.4],[760,402,1.1],[900,400,1.3],[1040,400,1.6],[1068,398,1.1]].map(([x,y,s],i)=>tuft(x,y,s,i%2?'#3F9A45':'#58B254')).join('');
  const LAND=`<svg ${VB} aria-hidden="true"><defs>
   <linearGradient id="phsiloC" x1="0" x2="1"><stop offset="0" stop-color="#C3CEDA"/><stop offset=".3" stop-color="#F8FAFC"/><stop offset=".62" stop-color="#DCE4EC"/><stop offset=".62" stop-color="#8794A6"/><stop offset="1" stop-color="#8794A6"/></linearGradient>
   <linearGradient id="phfarM" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7FA6DA"/><stop offset="1" stop-color="#BFD8F0"/></linearGradient>
   <linearGradient id="phhazeG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".55"/></linearGradient>
   <linearGradient id="phhillA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9AD879"/><stop offset="1" stop-color="#5DAE58"/></linearGradient>
   <linearGradient id="phgrassG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8FD46E"/><stop offset=".5" stop-color="#58B254"/><stop offset="1" stop-color="#2E7E3C"/></linearGradient></defs>
   <g transform="scale(2 1)">
   <path d="M0 214L50 190 96 204 150 170 196 196 246 176 300 198 352 172 410 196 470 168 540 192V260H0Z" fill="url(#phfarM)"/>
   <path d="M150 170l-10 9 6 1zM352 172l-10 9 6 1zM470 168l-11 10 7 0z" fill="#fff" opacity=".85"/>
   <rect y="186" width="540" height="56" fill="url(#phhazeG)"/></g>
   ${treeRow}
   <g transform="scale(2 1)">
   <path d="M0 236C90 218 170 222 240 236C300 222 400 214 540 230V300H0Z" fill="url(#phhillA)"/>
   <path d="M0 236C90 218 170 222 240 236C300 222 400 214 540 230" fill="none" stroke="#D2F7A4" stroke-width="2" opacity=".85" vector-effect="non-scaling-stroke"/>
   <path d="M300 238L540 232V250L330 252Z" fill="#E9CB72" opacity=".9"/><path d="M330 252L540 250V264L360 266Z" fill="#7CC363"/><path d="M360 266L540 264V276L392 278Z" fill="#E2BE5E" opacity=".9"/>
   <path d="M0 250L150 246L130 258L0 262Z" fill="#E9CB72" opacity=".85"/></g>
   ${mill}
   <g transform="translate(540 0)">${silo(446,212,50,16)}${silo(470,220,46,15)}</g>
   <g transform="scale(2 1)"><path d="M0 270C120 256 220 262 300 272C380 262 470 258 540 266V400H0Z" fill="url(#phgrassG)"/></g>
   <g transform="translate(270 0)">${road}${bale(240,296,7)}${bale(262,292,6)}</g>${bale(760,330,9)}
   <g transform="translate(540 0)">${shed}</g>
   ${tree}
   ${fence}
   <g>${flowers}</g>
   ${tufts}</svg>`;
  // weather, night lights, light specks and petals (not darkened)
  let drops='';for(let i=0;i<170;i++){const x=sr(-20,W+40),y=sr(0,420);drops+=`<path class="drop" d="M${f(x)} ${f(y)}l-4 15" style="animation-delay:-${f(sr(0,.55))}s"/>`;}
  let flies='';for(let i=0;i<18;i++)flies+=`<circle class="fly" cx="${f(sr(20,W-20))}" cy="${f(sr(300,380))}" r="1.8" fill="#FFF3A0" style="animation-delay:-${f(sr(0,3.6))}s"/>`;
  let motes='';for(let i=0;i<40;i++)motes+=`<g transform="translate(${f(sr(0,W))} ${f(sr(120,400))})"><circle class="mote" r="${f(sr(.8,2.2))}" fill="#FFFBE0" style="animation-delay:-${f(sr(0,8))}s;animation-duration:${f(sr(6,11))}s"/></g>`;
  let petals='';for(let i=0;i<20;i++)petals+=`<g transform="translate(${f(sr(60,W+80))} 50)"><ellipse class="petal" rx="3.4" ry="1.8" fill="${i%2?'#FFD3E4':'#FFFFFF'}" style="animation-delay:-${f(sr(0,10))}s;animation-duration:${f(sr(8,13))}s"/></g>`;
  const WX=`<svg class="L" ${VB} aria-hidden="true"><defs><filter id="phglowB" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.6"/></filter></defs>
   <g class="lit" transform="translate(540 0)"><g filter="url(#phglowB)" fill="#FFC94D" opacity=".85">${lits}</g><g fill="#FFE08A">${lits}</g><path d="M512 300L500 330H530L524 300Z" fill="#FFE9A0" opacity=".18"/></g>
   <g class="flies" filter="url(#phglowB)">${flies}</g><g class="flies">${flies}</g>
   <g class="motes">${motes}</g><g class="petals">${petals}</g>
   <g class="rainG" stroke="#C8D6FF" stroke-width="1.2" stroke-linecap="round" opacity=".55">${drops}</g></svg>`;
  phSceneCache=SKY+`<div class="land">${LAND}</div>`+WX+'<div class="skyflash"></div>';
  return phSceneCache;
}
// The sky follows today's forecast from Tasks (2026-11-01), not Plumo's mood: storm, heat haze, rain, night after
// dark, overcast, else a sunny day
function phSceneMood(){
  try{const cw=typeof mgrBriefCw==='function'?mgrBriefCw():null,w=cw&&cw.wx;if(!w)return 'calm';
    const al=(w.alerts||[]).join(' ');
    if(w.tone==='storm')return 'alert';
    if(/Heat/.test(al))return 'stress';
    if(w.tone==='rain'||w.tone==='snow')return 'rain';
    if(w.night)return 'rest';
    if(w.tone==='cloud')return 'cloud';
    return 'calm';
  }catch(e){return 'calm';}
}
function phSceneTitle(){try{const w=mgrBriefCw().wx;return w?`Today: ${w.label} · ${w.maxT} / ${w.minT}`:'';}catch(e){return '';}}
// What Plumo says on Home: his mood, the headline and up to two of today's plan items (red first)
function phData(){
  const out={mood:'calm',say:'Quiet morning — every shed is on track.',items:[],red:0,unread:false};
  try{
    if(!farmData||typeof rsModel!=='function')return out;
    const st=rsLoad(),R=rsModel(st,rsData());
    out.mood=R.mood||'calm';
    out.items=R.plan.slice(0,2).map(p=>({t:p.title,tone:p.f&&p.f.tone||''}));
    out.red=R.plan.filter(p=>p.f&&p.f.tone==='r').length;
    // Plumo's own words once the AI report is written; before that a headline that doesn't repeat the items
    const n=R.plan.length;
    out.say=(R.M&&R.say?R.say:n?(out.red?`${out.red} thing${out.red===1?' needs':'s need'} you first today${n>out.red?`, ${n} in all`:''}.`:`${n} thing${n===1?'':'s'} for today, most urgent first.`):'Nothing urgent — every shed is on track.').replace(/\s+/g,' ').trim();
    out.unread=new Date().getHours()>=7&&!st.seen;
  }catch(e){}
  return out;
}
function phChip(D){const m=PH_MOOD[D.mood]||PH_MOOD.calm;return `<i style="background:${m[0]}"></i>${escapeHtml(m[1])}${D.red?` · ${D.red} red item${D.red===1?'':'s'}`:''}`;}
function phBubbleHtml(D){
  const day=new Date().toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
  return `<span class="ph-k">Plumo · morning report · ${escapeHtml(day)}</span><h2>${escapeHtml(D.say)}</h2>`
    +(D.items.length?`<ul class="ph-items">${D.items.map(i=>`<li class="t-${i.tone||'n'}">${escapeHtml(i.t)}</li>`).join('')}</ul>`:'');
}
// Minimised hero (2026-11-01): the scene folds away and Plumo's head sits on the right of the batch banner with a
// greeting that fits his mood. Remembered on this device.
function phMinOn(){try{return localStorage.getItem('pw-hero-min')==='1';}catch(e){return false;}}
function phGreet(D){
  const h=new Date().getHours(),hi=h<12?'Morning!':h<18?'Afternoon!':'Evening!';
  try{const fo=typeof foToday==='function'?foToday():null;if(fo&&!fo.done&&!foSnoozed())return `Feed off today · ${foLabel(fo.sheds).replace(/\u00a0/g,' ')} — tap me.`;}catch(e){}
  if(D.mood==='alert')return `${D.red||1} red item${D.red===1?'':'s'} today — tap me.`;
  if(D.mood==='thinking')return 'Reading the farm…';
  if(D.mood==='rest')return 'Resting — the report has it all.';
  if(D.mood==='happy')return D.unread?`${hi} Report's ready.`:`${hi} All on track.`;
  return D.unread?`${hi} Report's ready — tap me.`:`${hi} Every shed is on track.`;
}
function phMiniHtml(D){return `<div class="ph-mini" id="phMini"><span class="ph-mbub" id="phMiniBub">${escapeHtml(phGreet(D))}</span>`
  +`<button type="button" class="ph-mhead" id="phMiniHead" title="Plumo · show his farm" aria-label="Plumo · show his farm">${PlumoFace.html(D.mood)}</button>`
  +`<button type="button" class="ph-mexp" data-ph-expand title="Show Plumo's farm again" aria-label="Show Plumo's farm again"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg></button></div>`;}
function phSetMin(on){try{localStorage.setItem('pw-hero-min',on?'1':'0');}catch(e){}const h=document.getElementById('plumoHero');if(h)h.classList.toggle('ph-min',on);
  if(on&&window.PlumoFX){const f=document.getElementById('phFace');if(f&&f.__pfxRun)PlumoFX.cancel(f.__pfxRun);}}
document.addEventListener('click',e=>{
  if(e.target.closest&&e.target.closest('[data-ph-min]')){phSetMin(true);return;}
  if(e.target.closest&&e.target.closest('[data-ph-expand]')){phSetMin(false);return;}
  const m=e.target.closest&&e.target.closest('#phMiniHead');if(m){if(window.PlumoFace)PlumoFace.fly(m.querySelector('.plumoF'));setTimeout(()=>phSetMin(false),380);}});   // his head opens the hero again
// Home's batch banner goes in as the hero's batch panel
function plumoHeroWrap(headHtml){
  const D=phData();
  return `<section class="ph-hero${phMinOn()?' ph-min':''}" id="plumoHero" aria-label="Plumo">
    <div class="phs" data-m="${phSceneMood()}" aria-hidden="true">${phSceneHtml()}</div>
    <span class="ph-chip" id="phChip">${phChip(D)}</span>
    <button type="button" class="ph-minbtn" data-ph-min title="Minimise Plumo — keep just his head" aria-label="Minimise Plumo"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg></button>
    ${phMiniHtml(D)}
    <button type="button" class="ph-face" id="phFace" title="Plumo — tap me" aria-label="Plumo">${PlumoFace.html(D.mood)}</button>
    <div class="ph-mid"><div id="phFoWrap">${typeof foHeroHtml==='function'?foHeroHtml():''}</div><div class="ph-bub" id="phBub">${phBubbleHtml(D)}</div>
      <div class="ph-acts"><button type="button" class="ph-btn primary" data-ph-report>Open morning report</button><button type="button" class="ph-btn" data-bev-open><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>Birds Eye View</button></div></div>
    ${headHtml}
  </section>`;
}
// Keep the hero and the phone tile in step with the report (mood, headline, red count, unread)
function phRefresh(){
  const D=phData();
  // Plumo dresses for today's weather from Tasks (2026-11-02): umbrella, sunglasses, beanie, frizzed comb…
  try{const cw=typeof mgrBriefCw==='function'?mgrBriefCw():null;if(cw&&window.PlumoFace&&PlumoFace.setWeather)PlumoFace.setWeather(cw.wx&&cw.wx.gear||'');}catch(e){}   // Tasks not loaded yet: keep what he has
  const h=document.getElementById('plumoHero');
  if(h){
    const sc=h.querySelector('.phs'),sm=phSceneMood();if(sc&&sc.dataset.m!==sm)sc.dataset.m=sm;
    const st=phSceneTitle();if(h.title!==st)h.title=st;
    const f=document.getElementById('phFace');if(f&&!f.querySelector('.pf-'+D.mood)){f.innerHTML=PlumoFace.html(D.mood);if(PlumoFace.enter)PlumoFace.enter(f);}   // a new mood comes in with its entrance
    const c=document.getElementById('phChip');if(c){const x=phChip(D);if(c.innerHTML!==x)c.innerHTML=x;}
    const b=document.getElementById('phBub');if(b){const x=phBubbleHtml(D);if(b.innerHTML!==x)b.innerHTML=x;}
    const fw=document.getElementById('phFoWrap');if(fw&&typeof foHeroHtml==='function'){const x=foHeroHtml();if(fw.innerHTML!==x)fw.innerHTML=x;}
    const mb=document.getElementById('phMiniBub');if(mb){const x=phGreet(D);if(mb.textContent!==x)mb.textContent=x;}
    const mh=document.getElementById('phMiniHead');if(mh&&!mh.querySelector('.pf-'+D.mood)){mh.innerHTML=PlumoFace.html(D.mood);if(PlumoFace.enter)PlumoFace.enter(mh);}
  }
  const t=document.getElementById('rossBtn');
  if(t){
    t.style.setProperty('--ph-ring',(PH_MOOD[D.mood]||PH_MOOD.calm)[0]);
    let n=t.querySelector('.ph-count');if(!n){n=document.createElement('span');n.className='ph-count';t.appendChild(n);}
    n.textContent=D.red;n.hidden=!D.red;
    let bub=t.querySelector('.ph-tbub');if(!bub){bub=document.createElement('span');bub.className='ph-tbub';t.appendChild(bub);}
    const msg=D.unread?(D.red?`${D.red} red item${D.red===1?'':'s'} today — tap me.`:"Report's ready! Tap me."):'';
    bub.textContent=msg;bub.hidden=!msg;
  }
}
document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('[data-ph-report]')&&typeof rsOpen==='function')rsOpen();});
// Plumo's moves (2026-11-01, js/plumo-moves.js): one tap flies him to the shed and back (crouch, burst, cruise, dash,
// land); a double-tap does the Kawarimi teleport — poof, a log drops where he stood, he pops in elsewhere on the hero
// and teleports home a few seconds later. Now and then he does one of them on his own. The phone tile poofs into the
// report; ticking a red item in the report makes him dodge.
function phShedPoint(h){const H=h.getBoundingClientRect(),s=H.width/1080,crop=Math.max(0,350*s-H.height);return {x:985*s,y:(250-50)*s-crop};}   // the shed in the 1080-wide scene
function phFlyAcross(){
  const f=document.getElementById('phFace'),h=document.getElementById('plumoHero');
  if(!f||!h||!window.PlumoFX||!window.PlumoFace)return;
  const pf=f.querySelector('.plumoF');if(!pf)return;
  const mood=(pf.className.match(/pf-(\w+)/)||[])[1]||'calm';
  PlumoFX.playFly({host:h,face:f,measure:pf,target:phShedPoint(h),front:PlumoFace.html(mood),back:`<span class="plumoF pf-${mood}">${PlumoFace.back()}</span>`});
}
let phAwayTimer=null;
function phKawarimi(home){
  const f=document.getElementById('phFace'),h=document.getElementById('plumoHero');if(!f||!h||!window.PlumoFX)return;
  clearTimeout(phAwayTimer);
  if(home||+(f.dataset.pfxDx||0)||+(f.dataset.pfxDy||0)){PlumoFX.playKawarimi({face:f,host:h,to:{dx:0,dy:0}});return;}
  const H=h.getBoundingClientRect(),F=f.getBoundingClientRect(),hx=F.left-H.left+F.width/2,sp=phShedPoint(h);
  const spots=[{dx:sp.x-110-hx,dy:0},{dx:H.width*.46-hx,dy:4},{dx:H.width-300-hx,dy:4}].filter(t=>t.dx>80);
  const to=spots[Math.floor(Math.random()*spots.length)]||{dx:H.width*.4,dy:10};
  PlumoFX.playKawarimi({face:f,host:h,to,onEnd:()=>{phAwayTimer=setTimeout(()=>phKawarimi(true),2600+Math.random()*1400);}});
}
let phTapTimer=null;
document.addEventListener('click',e=>{const f=e.target.closest&&e.target.closest('#phFace');if(!f)return;
  if(phTapTimer){clearTimeout(phTapTimer);phTapTimer=null;phKawarimi();return;}            // double-tap: teleport
  phTapTimer=setTimeout(()=>{phTapTimer=null;if(+(f.dataset.pfxDx||0))phKawarimi(true);else phFlyAcross();},260);});
// the phone tile: he poofs out of the tile and pops into the report as it opens
document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('#rossBtn.ross-float');if(!t||!window.PlumoFX)return;
  e.stopImmediatePropagation();e.preventDefault();
  const face=t.querySelector('.ross-mk')||t;
  const r=PlumoFX.playKawarimi({face,host:null,toEl:()=>document.querySelector('#rsModal.open #rsFace'),events:[{t:150,fn:()=>{if(typeof rsOpen==='function')rsOpen();}}]});
  if(!r&&typeof rsOpen==='function')rsOpen();},true);
// a red item ticked off in the report: Plumo dodges to the side and back
function plumoDodge(){const f=document.querySelector('#rsModal.open #rsFace');if(!f||!window.PlumoFX)return;
  PlumoFX.playKawarimi({face:f,host:null,to:{dx:76,dy:-6},onEnd:()=>setTimeout(()=>{const g=document.querySelector('#rsModal.open #rsFace');if(g)PlumoFX.playKawarimi({face:g,host:null,to:{dx:0,dy:0}});},1200)});}
(function phAutoFly(){setTimeout(()=>{if(document.visibilityState==='visible'&&window.PlumoFace){
  const hf=document.getElementById('phFace');if(hf&&hf.offsetParent&&!hf.__pfxRun){if(Math.random()<.65)phFlyAcross();else phKawarimi();}
  const mh=document.querySelector('#phMiniHead .plumoF');if(mh&&mh.offsetParent)PlumoFace.fly(mh);
  const tile=document.querySelector('#rossBtn.ross-float .rossR');if(tile&&tile.offsetParent)PlumoFace.fly(tile);}
  phAutoFly();},35000+Math.random()*30000);})();
document.addEventListener('DOMContentLoaded',()=>setTimeout(phRefresh,4200));
setInterval(()=>{if(document.visibilityState==='visible')phRefresh();},60000);
