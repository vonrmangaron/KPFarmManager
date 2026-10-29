// ── Manager home + Farm settings (2026-10) ─────────────────────────────
// Home answers what a manager checks every day: where the batch will finish,
// birds, feed (to order, booked, in silos, when silos run low), what needs
// doing and the next 7 days. Farm settings holds every setting that changes
// the projection or the feed forecast, with the ones not at normal first.
// Nothing here calculates anything new: it only shows the app's own figures.

function mgrToday(){return dateOnly(new Date());}
function mgrDays(a,b){return Math.round((dateOnly(b)-dateOnly(a))/864e5);}
function mgrWhen(d){const n=mgrDays(mgrToday(),d);return n===0?'Today':n===1?'Tomorrow':fmtShortNoYear(d);}
// A small calendar tile for a day: weekday over the date number; today filled amber, tomorrow outlined
function mgrDayTile(d){
  const dt=dateOnly(d),n=mgrDays(mgrToday(),dt);
  const wd=dt.toLocaleDateString('en-GB',{weekday:'short'}).toUpperCase(),mo=dt.toLocaleDateString('en-GB',{month:'short'});
  const cls=n===0?' today':n===1?' tomorrow':'';
  const tip=n===0?'Today':n===1?'Tomorrow':dt.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
  return `<span class="mgr-day${cls}" title="${escapeAttr(tip)}"><span class="mgr-day-wd">${n===0?'TODAY':wd}</span><b>${dt.getDate()}</b><span class="mgr-day-mo">${escapeHtml(mo)}</span></span>`;
}
function mgrT(kg){return `${Math.round((Number(kg)||0)/1000).toLocaleString('en-US')} t`;}
function mgrPlaced(){return (farmData&&farmData.sheds||[]).filter(s=>s.placementDate);}

// Pickups still to come per shed: kill-sheet ones already entered, then your planned ones (never the auto plan)
function mgrComingPickups(shed){
  const today=mgrToday();const real=(shed.pickups||[]).filter(p=>p.date&&dateOnly(p.date)>today).map(p=>({date:dateOnly(p.date),birds:Number(p.birds)||0}));
  const realDates=new Set((shed.pickups||[]).map(p=>iso(p.date)));
  const plan=(shed.predictedPickups||[]).filter(p=>p.date&&dateOnly(p.date)>today&&!realDates.has(iso(p.date))).map(p=>({date:dateOnly(p.date),birds:Number(p.birds)||0,planned:true}));
  return real.concat(plan).sort((a,b)=>a.date-b.date);
}
// Each pair's silo run-out (with booked loads), soonest first
function mgrSiloOutlook(){
  return [1,2,3,4].filter(g=>shedsForGroup(g).some(s=>s.placementDate)).map(g=>{
    let dep=null;try{const f=computeSiloForecast(g,{start:0,end:60},{});dep=f&&f.depletedDate?dateOnly(f.depletedDate):null;}catch(e){}
    const r=latestReading(g);
    // Sheds still holding birds more than a day after the silos run low — the rest are being run down for clean-out (2026-10-29)
    const out=s=>typeof shedOutDate==='function'?shedOutDate(s):s.cleanoutDate?dateOnly(s.cleanoutDate):null;
    const feeding=dep?shedsForGroup(g).filter(s=>s.placementDate&&!s.closed&&!(out(s)&&mgrDays(dep,out(s))<=1)).map(s=>s.id):[];
    return {g,dep,days:dep?mgrDays(mgrToday(),dep):null,feeding,reading:r,stock:r?readingTotalKg(r):null,readAge:r?mgrDays(dateOnly(r.date),mgrToday()):null};
  }).sort((a,b)=>(a.dep?a.dep.getTime():Infinity)-(b.dep?b.dep.getTime():Infinity));
}
function mgrFeedingLabel(x){const f=x.feeding||[];return f.length&&f.length<shedsForGroup(x.g).filter(s=>s.placementDate&&!s.closed).length?'Shed'+(f.length===1?' ':'s ')+f.join(' & '):pairLabel(x.g);}
// Up to 4 things to do now; growth notes stay in the bell
function mgrNeeds(silos){
  const out=typeof closeNeeds==='function'?closeNeeds():[],today=mgrToday(),hour=new Date().getHours();
  if(typeof pairAllClosed==='function')silos=silos.filter(x=>!pairAllClosed(x.g));   // finished pairs: no silo reminders
  // Sheds with no placement date or no birds yet: one row to the Set up sheds page
  const unset=farmData?farmData.sheds.filter(s=>!s.placementDate||!(Number(s.initialPopulation)>0)):[];
  if(unset.length)out.push({tone:'warn',title:`Set up ${unset.length===farmData.sheds.length?'the sheds':unset.length+' shed'+(unset.length===1?'':'s')}`,sub:'Placement date and birds placed still missing',act:'data-tab="shedsetup"'});
  silos.filter(x=>x.dep&&x.days<=10&&x.feeding.length).forEach(x=>out.push({tone:x.days<=3?'bad':'warn',title:`Book a load for ${mgrFeedingLabel(x)}`,sub:`Silos run low ${/^(today|tomorrow)$/i.test(mgrWhen(x.dep))?mgrWhen(x.dep).toLowerCase():mgrWhen(x.dep)}${x.days>1?`, in ${x.days} days`:''}`,act:`data-tab="g${x.g}"`}));
  // Mortality not entered since before yesterday (sheds that still have birds)
  const late=mgrPlaced().filter(s=>{if(s.closed)return false;const c=s.cleanoutDate?dateOnly(s.cleanoutDate):null;if(c&&c<today)return false;const u=s.mortalityUpdatedAt?dateOnly(s.mortalityUpdatedAt):null;return !u||mgrDays(u,today)>=2;});
  if(late.length)out.push({tone:'warn',title:`Enter mortality for ${late.length===mgrPlaced().length?'all sheds':late.length+' shed'+(late.length===1?'':'s')}`,sub:'Not updated for 2 days or more',act:'data-mgr-mort'});
  silos.filter(x=>!x.reading||(x.readAge>0&&hour>=9)).forEach(x=>out.push({tone:'warn',title:`Read the silos for ${pairLabel(x.g)}`,sub:x.reading?`Last reading ${mgrWhen(dateOnly(x.reading.date)).toLowerCase()==='today'?'today':fmtShortNoYear(x.reading.date)}`:'No reading yet this batch',act:'data-mgr-silo'}));
  const sum=farmLoadsSummary();if(sum.needsActual>0)out.push({tone:'warn',title:`Enter docket weights for ${sum.needsActual} load${sum.needsActual===1?'':'s'}`,sub:'Delivered loads still on their planned weight',act:'data-mgr-loads'});
  const est=mgrPlaced().reduce((n,s)=>n+(s.pickups||[]).filter(p=>p.date&&dateOnly(p.date)<=today&&p.weightEstimated).length,0);
  if(est>0)out.push({tone:'warn',title:`Enter kill-sheet weights for ${est} pickup${est===1?'':'s'}`,sub:'Past pickups still on an estimated weight',act:'data-mgr-pickups'});
  return out.slice(0,4);
}
// Loads and pickups for today and the next 6 days
// This week (2026-10-23): every day of the next 7 with its loads and pickups, for the strip + event list
function mgrWeekDays(){
  const today=mgrToday(),out=[];
  for(let i=0;i<7;i++)out.push({date:addDays(today,i),loads:[],pick:[]});
  const at=d=>out.find(x=>iso(x.date)===iso(d));
  farmLoads.forEach(l=>{if(!l.date)return;const x=at(dateOnly(l.date));if(x)x.loads.push(l);});
  mgrPlaced().forEach(s=>(s.pickups||[]).concat((s.predictedPickups||[]).map(p=>({...p,planned:true}))).forEach(p=>{if(!p.date)return;const d=dateOnly(p.date),x=at(d);if(!x||x.pick.some(q=>q.shed===s.id))return;x.pick.push({shed:s.id,birds:Number(p.birds)||0,final:!!p.isFinal,planned:!!p.planned,age:ageInDays(s,d)});}));
  out.forEach(x=>x.pick.sort((a,b)=>a.shed-b.shed));
  return out;
}
let mgrWeekSel=null;   // a day picked in the strip (iso), or null for the whole week
document.addEventListener('click',e=>{const d=e.target.closest&&e.target.closest('[data-wk-day]');if(!d)return;mgrWeekSel=mgrWeekSel===d.dataset.wkDay?null:d.dataset.wkDay;render();});
function mgrWeekHtml(){
  const days=mgrWeekDays(),WD=['SUN','MON','TUE','WED','THU','FRI','SAT'],todayK=iso(mgrToday());
  if(mgrWeekSel&&!days.some(x=>iso(x.date)===mgrWeekSel))mgrWeekSel=null;
  const kgOf=l=>l.actualKg!=null?Number(l.actualKg)||0:Number(l.plannedKg)||0;
  const nLoads=days.reduce((n,x)=>n+x.loads.length,0),tLoads=days.reduce((n,x)=>n+x.loads.reduce((m,l)=>m+kgOf(l),0),0);
  const picks=days.flatMap(x=>x.pick),nFin=picks.filter(p=>p.final).length,nBirds=picks.reduce((n,p)=>n+p.birds,0);
  const I={feed:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 17h13V7H3zM16 10h3l2 3v4h-5"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
    pick:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>'};
  const strip=days.map(x=>{const k=iso(x.date),has=x.loads.length||x.pick.length;
    return `<button type="button" class="wk-day${k===todayK?' today':''}${k===mgrWeekSel?' sel':''}${has?'':' empty'}" data-wk-day="${k}" title="${escapeAttr(fmtShortNoYear(x.date))}${has?'':' · nothing booked'}" aria-pressed="${k===mgrWeekSel}"><small>${WD[x.date.getDay()]}</small><b>${x.date.getDate()}</b><span class="wk-dots">${x.loads.length?`<i class="wk-dot feed">${I.feed}</i>`:''}${x.pick.length?`<i class="wk-dot pick">${I.pick}</i>`:''}</span></button>`;}).join('');
  const evs=[];
  days.filter(x=>!mgrWeekSel||iso(x.date)===mgrWeekSel).forEach(x=>{
    const when=`<span class="wk-when"><small>${WD[x.date.getDay()]}</small><b>${x.date.getDate()}</b></span>`;
    x.loads.forEach(l=>{const gs=[1,2,3,4].filter(g=>Number(l.splitKg&&l.splitKg[g])>0);
      evs.push(`<div class="wk-ev">${when}<span class="wk-ic feed">${I.feed}</span><span class="wk-tx"><b>Feed load${l.feedType?' · '+escapeHtml(feedTypeLabel(l.feedType).toLowerCase()):''}</b><span>${gs.map(g=>`${escapeHtml(pairLabel(g))} ${mgrT(Number(l.splitKg[g]))}`).join(' · ')||'not split yet'}</span></span><span class="wk-amt">${mgrT(kgOf(l))}</span></div>`);});
    x.pick.forEach(p=>evs.push(`<div class="wk-ev">${when}<span class="wk-ic pick">${I.pick}</span><span class="wk-tx"><b>${p.final?'Final pickup':'Pickup'} · Shed ${p.shed}</b><span>${p.final?'clean-out · ':''}day ${p.age}${p.planned?' · planned':''}</span></span><span class="wk-amt">${p.birds.toLocaleString('en-US')}<small>birds</small></span></div>`));
  });
  const chips=[nLoads?`<span class="wk-chip feed">${nLoads} load${nLoads===1?'':'s'} · ${mgrT(tLoads)}</span>`:'',picks.length?`<span class="wk-chip pick">${nFin&&nFin===picks.length?`${nFin} final pickup${nFin===1?'':'s'}`:`${picks.length} pickup${picks.length===1?'':'s'}`} · ${nBirds.toLocaleString('en-US')} birds</span>`:''].join('');
  return `<section class="mgr-card mgr-week2">
      <div class="wk-head"><span class="mgr-title">This week</span><span class="wk-chips">${chips}</span></div>
      <div class="wk-strip">${strip}</div>
      ${evs.length?`<div class="wk-list">${evs.join('')}</div>`:`<p class="mgr-none">${mgrWeekSel?'Nothing booked that day.':'No loads or pickups in the next 7 days.'}</p>`}
      <div class="wk-foot"><span>${mgrWeekSel?'Showing one day · tap it again for the whole week':'Tap a day to see just that day'}</span><button type="button" class="mgr-link" data-mgr-loads>Feed loads ›</button></div>
    </section>`;
}
function mgrWeek(){
  const today=mgrToday(),end=addDays(today,6),days=new Map();
  const day=d=>{const k=iso(d);if(!days.has(k))days.set(k,{date:d,loads:[],pick:[]});return days.get(k);};
  farmLoads.forEach(l=>{if(!l.date)return;const d=dateOnly(l.date);if(d<today||d>end)return;day(d).loads.push(l);});
  mgrPlaced().forEach(s=>(s.pickups||[]).concat((s.predictedPickups||[]).map(p=>({...p,planned:true}))).forEach(p=>{if(!p.date)return;const d=dateOnly(p.date);if(d<today||d>end)return;const x=day(d);if(!x.pick.some(q=>q.shed===s.id&&iso(q.date)===iso(d)))x.pick.push({shed:s.id,birds:Number(p.birds)||0,date:d,final:!!p.isFinal,planned:!!p.planned,age:ageInDays(s,d)});}));
  return [...days.values()].sort((a,b)=>a.date-b.date).map(x=>{
    const parts=[];
    if(x.pick.length){const b=x.pick.reduce((n,p)=>n+p.birds,0);parts.push(`Pickup${x.pick.length>1?'s':''} Shed${x.pick.length>1?'s':''} ${x.pick.map(p=>p.shed).sort((a,b)=>a-b).join(', ')} · ${b.toLocaleString('en-US')} birds`);}
    if(x.loads.length){const kg=x.loads.reduce((n,l)=>n+(l.actualKg!=null?Number(l.actualKg):Number(l.plannedKg)||0),0);const types=[...new Set(x.loads.map(l=>l.feedType).filter(Boolean))];const pairs=[...new Set(x.loads.flatMap(l=>[1,2,3,4].filter(g=>Number(l.splitKg&&l.splitKg[g])>0)))].sort();
      parts.push(`Feed ${x.loads.length>1?x.loads.length+' loads · ':''}${mgrT(kg)}${types.length?' '+types.join(' + '):''}${pairs.length?' → '+pairs.map(g=>pairLabel(g).replace('Sheds ','')).join(', '):''}`);}
    return {date:x.date,text:parts.join(' · ')};
  });
}

function renderHomeView(){
  const t=computeFarmTotals();
  if(!t.hasData)return renderDashboardView();
  const today=mgrToday(),sheds=mgrPlaced();
  const e=farmTotalsEarly(),lr=lastHistoryRec(),lk=lr?historyKpis(lr):null;
  const span=(a,b,dp)=>{if(a==null||!(e&&e.hasData))return b.toFixed(dp);const lo=Math.min(a,b),hi=Math.max(a,b);return lo.toFixed(dp)===hi.toFixed(dp)?hi.toFixed(dp):`${lo.toFixed(dp)}–${hi.toFixed(dp)}`;};
  const ec=e&&e.hasData?e:null;
  const placed=sheds.reduce((n,s)=>n+(Number(s.initialPopulation)||0),0);
  const live=sheds.reduce((n,s)=>n+Math.max(0,liveAtStartOfDay(s,today)),0);
  const picked=sheds.reduce((n,s)=>n+(s.pickups||[]).filter(p=>p.date&&dateOnly(p.date)<=today).reduce((m,p)=>m+(Number(p.birds)||0),0),0);
  const mort=sheds.reduce((n,s)=>n+Math.max(0,Number(s.mortality)||0),0);
  const first=sheds.map(s=>dateOnly(s.placementDate)).reduce((a,b)=>b<a?b:a);
  const day=Math.max(0,mgrDays(first,today));
  const cleans=sheds.map(s=>s.cleanoutDate?dateOnly(s.cleanoutDate):null).filter(Boolean).sort((a,b)=>a-b);
  const cycleDays=cleans.length?Math.max(1,mgrDays(first,cleans[cleans.length-1])):null;
  const fo=farmFeedToOrder();
  const silos=mgrSiloOutlook();
  const inSilos=silos.reduce((n,x)=>n+(x.stock||0),0),allRead=silos.length&&silos.every(x=>x.reading&&x.readAge===0);
  let perDay=0;sheds.forEach(s=>{perDay+=shedFeedOn(s,today)||0;});
  const needs=mgrNeeds(silos);
  const week=mgrWeek();
  const off=farmSettingsNotNormal();
  const firstLow=silos.find(x=>x.dep)||silos[0];

  // Where we'll finish: cFCR and FCR tiles ("low / to high"), then last batch with a verdict
  const rng=(a,b)=>{if(a==null||!(e&&e.hasData))return {lo:b,hi:b};return {lo:Math.min(a,b),hi:Math.max(a,b)};};
  const rv=(r,dp)=>r.lo.toFixed(dp)===r.hi.toFixed(dp)?r.hi.toFixed(dp):`<span>${r.lo.toFixed(dp)}</span><span><span class="mgr-ft-to">to</span>${r.hi.toFixed(dp)}</span>`;
  const rc=rng(ec&&ec.cfcr,t.cfcr),rf=rng(ec&&ec.fcr,t.fcr);
  let verdict='';
  if(lk&&Number.isFinite(lk.cfcr)&&lk.cfcr>0){
    const L=lk.cfcr,near=0.005;
    const [cls,txt]=rc.hi<L-near?['good','better than last batch']
      :rc.lo>L+near?['bad','higher than last batch']
      :(rc.hi-L>0.01&&L-rc.lo<=0.01)?['warn','similar to slightly higher']
      :(L-rc.lo>0.01&&rc.hi-L<=0.01)?['good','similar to slightly lower']
      :['neutral','about the same'];
    verdict=`<span class="mgr-verdict ${cls}" title="cFCR: lower is better">${txt}</span>`;
  }
  // Top row (2026-10-17): four equal KPI tiles, then the jobs and the flock side by side
  const lkC=lk&&Number.isFinite(lk.cfcr)&&lk.cfcr>0?lk.cfcr:null;
  const tv=r=>r.lo.toFixed(3)===r.hi.toFixed(3)?`${r.hi.toFixed(3)}`:`${r.lo.toFixed(3)} <small>– ${r.hi.toFixed(3)}</small>`;
  // the Cfcr2.45 range drawn on a scale around last batch
  let rangeBar='';
  if(lkC!=null){const lo=Math.min(rc.lo,lkC)-0.03,hi=Math.max(rc.hi,lkC)+0.03,P=v=>((v-lo)/(hi-lo)*100).toFixed(1);
    rangeBar=`<div class="mk-range" title="Projected range ${rc.lo.toFixed(3)}–${rc.hi.toFixed(3)} · last batch ${lkC.toFixed(3)} (lower is better)"><i style="left:${P(rc.lo)}%;width:${Math.max(1.5,P(rc.hi)-P(rc.lo))}%"></i><b style="left:${P(lkC)}%"></b></div>`;}
  let rt=null;try{const bm=batchMeasured(new Date());rt=bm&&bm.kpi;}catch(e){}
  const rtLine=k=>rt&&rt[k]>0?`<button type="button" class="mk-today" data-tab="dashboard" data-rec-today title="From records only: dockets, silo readings and plant weights — tap for the workings"><span>Today</span><b>${rt[k].toFixed(3)}</b><span>from records</span></button>`:'';
  const mortPct=placed?mort/placed*100:0;
  const kpis=`<div class="mk-strip">
      <div class="mk-tile hero k-green" title="Projected Cfcr2.45 at clean-out (FCR corrected to 2.45 kg)"><div class="mk-top"><span class="mgr-k">Cfcr2.45 · finish</span><span class="mk-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m4 15 5-5 4 4 7-7"/></svg></span></div><b class="mk-v">${tv(rc)}</b>${rangeBar}
        <span class="mk-s">${lkC!=null?`last batch ${escapeHtml(String(lr.batch||''))} · ${lkC.toFixed(3)} ${verdict}`:'FCR corrected to 2.45 kg'}</span>${ec&&Math.abs(ec.cfcr-t.cfcr)>=0.0005?`<span class="mk-s faint">Low end if the last birds go ${PROJ_EARLY_DAYS} days early</span>`:''}${rtLine('cfcr')}</div>
      <div class="mk-tile k-blue" title="Projected FCR at clean-out"><div class="mk-top"><span class="mgr-k">FCR · finish</span><span class="mk-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m7 14 4-4 3 3 5-6"/></svg></span></div><b class="mk-v">${tv(rf)}</b><span class="mk-s">feed ÷ live weight</span>${rtLine('fcr')}</div>
      <div class="mk-tile k-amber"><div class="mk-top"><span class="mgr-k">Birds on hand</span><span class="mk-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><path d="M16 4a3 3 0 0 1 0 6M21 20c0-2.5-1.8-4.3-4-4.8"/></svg></span></div><b class="mk-v">${live.toLocaleString('en-US')}</b><span class="mk-s">of ${placed.toLocaleString('en-US')} placed</span><div class="mk-foot"><span>Picked up</span><b>${picked.toLocaleString('en-US')}</b></div></div>
      <div class="mk-tile k-red"><div class="mk-top"><span class="mgr-k">Mortality</span><span class="mk-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10z"/></svg></span></div><b class="mk-v">${mortPct.toFixed(1)}%</b><span class="mk-s">${mort.toLocaleString('en-US')} birds <span class="mgr-verdict ${mortPct>4?'bad':'good'}" title="Livability target ≥ 96%">${mortPct>4?'above 4% target':'within 4% target'}</span></span><div class="mk-foot"><span>Livability</span><b>${(100-mortPct).toFixed(1)}%</b></div></div>
    </div>`;
  const ACT_LABEL=[['data-mgr-loads','Feed loads'],['data-mgr-mort','Enter mortality'],['data-mgr-silo','Record reading'],['data-mgr-pickups','Pickups'],['data-close-go','Close shed'],['data-lo-go','Enter leftover'],['data-carry-use','Use it'],['data-tab="shedsetup"','Set up'],['data-tab="g','Open']];
  const actLabel=a=>{const f=ACT_LABEL.find(([k])=>String(a).includes(k));return f?f[1]:'Open';};
  const needsHtml=`<section class="mgr-card mk-needs">
      <span class="mgr-k">Needs you</span>
      ${needs.length?`<div class="mk-need-list">${needs.map(n=>`<button type="button" class="mk-need ${n.tone}" ${n.act}><span class="mk-need-tx"><b>${escapeHtml(n.title)}</b><span>${escapeHtml(n.sub)}</span></span><span class="mk-need-go${n.tone==='bad'?' primary':''}">${actLabel(n.act)}</span></button>`).join('')}</div>`:`<p class="mgr-none">Nothing needs you right now.</p>`}
    </section>`;
  const deadPct=placed?mort/placed*100:0,pickPct=placed?picked/placed*100:0,livePct=Math.max(0,100-deadPct-pickPct);
  const flock=`<section class="mgr-card mk-flock">
      <span class="mgr-k">Flock</span>
      <div class="mk-stack" role="img" aria-label="${live.toLocaleString('en-US')} on hand, ${picked.toLocaleString('en-US')} picked up, ${mort.toLocaleString('en-US')} dead of ${placed.toLocaleString('en-US')} placed"><i class="on" style="width:${livePct.toFixed(2)}%"></i><i class="pk" style="width:${pickPct.toFixed(2)}%"></i><i class="dd" style="width:${deadPct.toFixed(2)}%"></i></div>
      <div class="mk-lg"><div><span><i class="on"></i>On hand</span><b>${live.toLocaleString('en-US')}</b></div><div><span><i class="pk"></i>Picked up</span><b>${picked.toLocaleString('en-US')}</b></div><div><span><i class="dd"></i>Dead</span><b>${mort.toLocaleString('en-US')}</b></div></div>
      <button type="button" class="mgr-link" data-tab="dashboard">Result detail: PIF, ALW, dockets &amp; leftover ›</button>
    </section>`;
  const siloRows=silos.map(x=>`<div class="mgr-silo"><span class="mgr-dot ${x.dep&&x.days<=3?'bad':x.dep&&x.days<=10?'warn':'ok'}"></span><span class="mgr-silo-name">${pairLabel(x.g)}</span><span class="mgr-silo-stock">${x.stock!=null?mgrT(x.stock):'—'}</span><span class="mgr-silo-when${x.dep&&x.days<=10?' low':''}">${x.dep?`${mgrWhen(x.dep)}${x.days>1?` · ${x.days} days`:''}`:'Lasts to clean-out'}</span></div>`).join('');
  const feed=`<section class="mgr-card mgr-feed">
      <div class="mgr-feed-head"><span class="mgr-title">Feed</span><span class="mgr-sub">to clean-out</span></div>
      <div class="mgr-tiles">
        <div class="mgr-tile accent"><span>Still to order</span><b>${fo?mgrT(fo.expected):'—'}</b>${fo&&Math.abs(fo.safe-fo.expected)>=500?`<em>${mgrT(fo.safe)} if no more pickups</em>`:''}</div>
        <div class="mgr-tile"><span>Booked</span><b>${fo?mgrT(fo.booked):'—'}</b></div>
        <div class="mgr-tile"><span>In silos</span><b>${mgrT(inSilos)}</b><em>${allRead?'read today':'latest readings'}</em></div>
        <div class="mgr-tile"><span>Eating per day</span><b>${mgrT(perDay)}</b></div>
      </div>
      <div class="mgr-silos"><span class="mgr-k">Silos run low (with booked loads)</span>${siloRows}</div>
      <div class="mgr-actions">
        <button type="button" class="mgr-btn primary" data-mgr-loads>Feed loads</button>
        <button type="button" class="mgr-btn" data-mgr-feed="${firstLow?firstLow.g:1}" data-mgr-compare="1" title="Opens Compare feed with this pair: tap a day to add a test delivery">Test a delivery${firstLow?` · ${escapeHtml(pairLabel(firstLow.g))}`:''}</button>
      </div>
    </section>`;
  const weekHtml=`<section class="mgr-card mgr-week">
      <span class="mgr-k">Next 7 days</span>
      ${week.length?week.map(w=>`<div class="mgr-week-row">${mgrDayTile(w.date)}<span>${escapeHtml(w.text)}</span></div>`).join(''):'<p class="mgr-none">No loads or pickups in the next 7 days.</p>'}
    </section>`;
  const shedRows=sheds.map(s=>{const nx=mgrComingPickups(s)[0];return `<tr><td><b>${s.id}</b></td><td>${ageInDays(s,today)} d</td><td class="num">${Math.max(0,liveAtStartOfDay(s,today)).toLocaleString('en-US')}</td><td>${nx?`${escapeHtml(fmtShortNoYear(nx.date))} · ${nx.birds.toLocaleString('en-US')}${nx.planned?' <span class="mgr-plan">plan</span>':''}`:'—'}</td><td>${s.cleanoutDate?escapeHtml(fmtShortNoYear(s.cleanoutDate)):'—'}</td></tr>`;}).join('');
  const shedsHtml=`<section class="mgr-card mgr-sheds">
      <span class="mgr-k">Sheds</span>
      <div class="mgr-table-wrap"><table class="mgr-table"><thead><tr><th>Shed</th><th>Age</th><th class="num">Birds</th><th>Next pickup</th><th>Clean-out</th></tr></thead><tbody>${shedRows}</tbody></table></div>
    </section>`;
  const offHtml=off.length?`<button type="button" class="mgr-off" data-tab="farmsettings"><span><b>${off.length} farm setting${off.length===1?'':'s'} not at normal</b> and changing these numbers: ${escapeHtml(off.map(o=>o.short).join(', '))}</span><span class="mgr-off-go">Review ›</span></button>`:'';
  return `<div class="mgr-home">
    <div class="mgr-head">${(()=>{const last=cleans.length?cleans[cleans.length-1]:null,tot=last?daysBetween(first,last):0,pct=tot>0&&first<=today?Math.max(0,Math.min(100,daysBetween(first,today)/tot*100)):0;return tot>0?`<span class="mgr-prog" title="${Math.round(pct)}% of the batch, first placement to last clean-out"><i style="width:${pct.toFixed(1)}%"></i><em>${Math.round(pct)}%</em></span>`:'';})()}<button type="button" class="mgr-batch" data-batch-info title="Batch details"><b>Batch ${escapeHtml(String(predState.batchNumber||farmData.batchNumber||''))} · ${first>today?'starts '+escapeHtml(fmtShortNoYear(first)):'Day '+day}</b><span>${escapeHtml(fmtShortNoYear(today))}${cleans.length?` · first clean-out ${escapeHtml(fmtShortNoYear(cleans[0]))}${cleans.length>1&&iso(cleans[cleans.length-1])!==iso(cleans[0])?`, last ${escapeHtml(fmtShortNoYear(cleans[cleans.length-1]))}`:''}`:''}</span></button></div>
    ${typeof changeoverHtml==='function'?changeoverHtml():''}
    ${kpis}
    <div class="mk-row">${needsHtml}${mgrWeekHtml()}</div>
    ${feed}
    ${mgrFeedUseHtml()}
    ${typeof leftoverCardHtml==='function'?leftoverCardHtml():''}
    <div class="mgr-row2">${shedsHtml}${flock}</div>
    ${offHtml}
  </div>`;
}

// ── Home: feed eaten so far (records) vs expected by the finish (forecast) — v237 ──
function mgrFeedUseHtml(){
  if(!farmData)return '';
  let so=null,t=null;try{so=batchMeasured(new Date());}catch(e){}try{t=computeFarmTotals();}catch(e){}
  if(!t||!t.hasData)return '';
  const today=dateOnly(new Date());
  const eaten=so&&!so.missing.length&&so.eaten>0?so.eaten:null,exp=t.totalFeed;
  const recv=carryoverTotalKg()+(farmLoads||[]).filter(l=>l.date&&dateOnly(l.date)<=today).reduce((n,l)=>n+(l.actualKg!=null?Number(l.actualKg)||0:Number(l.plannedKg)||0),0);
  let left=null;
  if(typeof dashPairInfo==='function'){const inf=[1,2,3,4].map(g=>dashPairInfo(g,today)).filter(Boolean);if(inf.length)left=inf.reduce((n,p)=>n+(p.open.length?Math.max(0,Number(p.leftover)||0):(p.lo?Number(p.lo.kg)||0:0)),0);}
  const pct=eaten!=null&&exp>0?Math.max(0,Math.min(100,eaten/exp*100)):0;
  return `<section class="mgr-card mfu" title="Eaten so far = dockets + carry-over − feed in the silos (records). Expected at finish = the forecast to clean-out.">
    <div class="mfu-head"><span class="mgr-title">Feed consumption</span><button type="button" class="mgr-link" data-tab="dashboard">Result detail ›</button></div>
    <div class="mfu-nums"><div><span class="mgr-k">Eaten so far</span><b>${eaten!=null?fmtTonnesAlways(eaten):'—'}</b>${so&&so.missing.length?`<em>needs a silo reading for ${escapeHtml(so.missing.map(pairShort).join(', '))}</em>`:''}</div>
      <div><span class="mgr-k">Expected at finish</span><b>${fmtTonnesAlways(exp)}</b></div></div>
    <div class="mfu-bar" role="img" aria-label="${pct.toFixed(0)}% of the expected feed eaten"><i style="width:${pct.toFixed(1)}%"></i><span>${eaten!=null?pct.toFixed(0)+'%':''}</span></div>
    <div class="mfu-foot">Received <b>${fmtTonnesAlways(recv)}</b>${left!=null?` · expected leftover <b>≈ ${fmtTonnesAlways(left)}</b>`:''}</div>
  </section>`;
}

// ── Farm settings ──────────────────────────────────────────────
function fsDens(){return predState.densityGlobal||{...DEFAULT_DENSITY_GLOBAL};}
function fsSetDens(k,v){const dg={...fsDens(),[k]:v};
  if(dg.targetDensity>=dg.triggerDensity)dg.targetDensity=Math.max(10,dg.triggerDensity-0.5);
  if(dg.maxDensity<dg.triggerDensity)dg.maxDensity=dg.triggerDensity;
  predState.densityGlobal=dg;}
const FS_ITEMS=[
  {key:'acc',sec:'Silos and feed',label:'Reading accuracy',hint:'Share of the silo reading the feed forecast plans with',kind:'step',min:50,max:100,step:5,fmt:v=>`${v}%`,normal:100,
    get:()=>Math.round(siloConfidence()*100),set:v=>{predState.siloConfidencePct=v;},changes:["When each pair's silos run low",'Feed still to order'],not:'FCR, cFCR or your recorded readings'},
  {key:'safety',sec:'Silos and feed',label:'Safety stock',hint:'Warn this long before the silos are empty',kind:'step',min:0,max:3,step:0.5,fmt:v=>`${v} day${v===1?'':'s'}`,normal:1,
    get:()=>siloSafetyDays(),set:v=>{predState.safetyDays=v;},changes:['When the app says silos run low','Feed alerts'],not:'FCR, cFCR or feed to order'},
  {key:'timing',sec:'Silos and feed',label:'Feed trucks arrive',hint:'Before or after the morning silo reading',kind:'seg',options:[['early','Early morning'],['day','During the day']],normal:'early',
    fmt:v=>v==='early'?'Early morning':'During the day',get:()=>deliveryTimingEarly()?'early':'day',set:v=>{predState.deliveryTiming=v;},changes:['Silo stock on delivery days'],not:'FCR or cFCR'},
  {key:'carry',sec:'Silos and feed',label:'Carried over from last batch',hint:'Feed left in the silos when the chicks arrived',kind:'step',min:0,max:300,step:1,fmt:v=>`${v} t`,normal:null,
    get:()=>Math.round(carryoverTotalKg()/100)/10,set:v=>{predState.carryoverFarmKg=Math.round(v*1000);predState.carryoverKg={1:0,2:0,3:0,4:0};predState.carryoverMode='manual';predState.carryoverAuto=null;},changes:['Feed eaten, and FCR once the batch is finished','Silo stock'],typeIn:true},
  {key:'target',sec:'Weights and result',label:'Target weight',hint:'Per pair, used for cFCR (Industry)',kind:'pairs',normal:null,
    fmt:()=>[1,2,3,4].map(g=>pairTargetKg(g).toFixed(2)).join(' · '),get:()=>[1,2,3,4].map(g=>pairTargetKg(g)),set:v=>{[1,2,3,4].forEach((g,i)=>{const n=Number(v[i]);if(Number.isFinite(n)&&n>0)predState.targetHarvestWeightKg[g]=Math.max(0.5,Math.min(5,n));});},changes:['cFCR (Industry)'],not:'FCR or Cfcr2.45'},
  {key:'bias',sec:'Weights and result',label:'Shed weight to plant weight',hint:'Shed weighings × this = plant weight; set from your kill sheets',kind:'step',min:Math.round(MIN_BIAS_FACTOR*100),max:Math.round(MAX_BIAS_FACTOR*100),step:0.5,fmt:v=>`${v}%`,normal:null,
    get:()=>Math.round(currentBiasFactor()*1000)/10,set:v=>{if(farmData){farmData.biasFactor=Math.max(MIN_BIAS_FACTOR,Math.min(MAX_BIAS_FACTOR,v/100));saveState();}},changes:['Projected weights and the result'],not:'Your recorded weighings'},
  {key:'uplift',sec:'Weights and result',label:'Last pickup heavier',hint:'Final birds vs thinning birds at the same age',rec:()=>{const l=typeof learnedFinalUplift==='function'?learnedFinalUplift():null;return l?{pct:l.pct,each:l.each,use:Math.max(0,Math.min(15,Math.round(l.pct)))}:null;},kind:'step',min:0,max:15,step:1,fmt:v=>`+${v}%`,normal:DEFAULT_FINAL_UPLIFT_PCT,
    get:()=>Number.isFinite(Number(predState.finalUpliftPct))?Number(predState.finalUpliftPct):DEFAULT_FINAL_UPLIFT_PCT,set:v=>{predState.finalUpliftPct=v;},changes:['Projected weight of the last pickups','The result'],not:'Kill sheets you have entered'},
  {key:'trig',sec:'Pickup planning',label:'Thin when density reaches',hint:'',kind:'step',min:15,max:45,step:0.5,fmt:v=>`${v} kg/m²`,normal:null,get:()=>Number(fsDens().triggerDensity),set:v=>fsSetDens('triggerDensity',v),changes:['Auto-planned pickups in the projection']},
  {key:'tgt',sec:'Pickup planning',label:'Thin down to',hint:'',kind:'step',min:10,max:40,step:0.5,fmt:v=>`${v} kg/m²`,normal:null,get:()=>Number(fsDens().targetDensity),set:v=>fsSetDens('targetDensity',v),changes:['Auto-planned pickups in the projection']},
  {key:'max',sec:'Pickup planning',label:'Never above',hint:'',kind:'step',min:15,max:50,step:0.5,fmt:v=>`${v} kg/m²`,normal:null,get:()=>Number(fsDens().maxDensity),set:v=>fsSetDens('maxDensity',v),changes:['Auto-planned pickups in the projection']},
  {key:'tp',sec:'Pickup planning',label:'Pickups per shed',hint:'',kind:'step',min:MIN_PICKUPS_PER_SHED,max:MAX_PICKUPS_PER_SHED,step:1,fmt:v=>String(v),normal:null,get:()=>Number(fsDens().targetPickups),set:v=>fsSetDens('targetPickups',v),changes:['Auto-planned pickups in the projection']},
];
function fsItem(key){return FS_ITEMS.find(i=>i.key===key);}
// Settings that differ from normal, with how to reset each
function farmSettingsNotNormal(){
  const out=[];
  FS_ITEMS.forEach(i=>{if(i.normal==null)return;const v=i.get();if(v!==i.normal)out.push({key:i.key,label:i.label,short:`${i.label.toLowerCase()} ${i.fmt(v)}`,value:i.fmt(v),normal:i.fmt(i.normal)});});
  const tw=[1,2,3,4].map(pairTargetKg);
  if(new Set(tw.map(v=>v.toFixed(2))).size>1){
    const common=fsMostCommon(tw);const odd=[1,2,3,4].filter(g=>pairTargetKg(g).toFixed(2)!==common.toFixed(2));
    out.push({key:'target',label:`Target weight, ${odd.map(pairLabel).join(', ')}`,short:`${odd.map(pairLabel).join(', ')} target weight ${odd.map(g=>pairTargetKg(g).toFixed(2)).join('/')} kg`,value:odd.map(g=>pairTargetKg(g).toFixed(2)+' kg').join(', '),normal:`${common.toFixed(2)} kg like the other pairs`});
  }
  mgrPlaced().filter(s=>typeof hasManualFeedPct==='function'&&hasManualFeedPct(s)&&Number(s.feedAdjustPct)!==100).forEach(s=>out.push({key:'feed:'+s.id,label:`Feed intake, Shed ${s.id}`,short:`Shed ${s.id} feed ${Math.round(Number(s.feedAdjustPct))}%`,value:`${Math.round(Number(s.feedAdjustPct))}% of Ross`,normal:'100%'}));
  return out;
}
function fsMostCommon(arr){const c=new Map();arr.forEach(v=>{const k=v.toFixed(2);c.set(k,(c.get(k)||0)+1);});return Number([...c.entries()].sort((a,b)=>b[1]-a[1])[0][0]);}
function fsAfterChange(label){pwActivity('settings',String(label||'').replace(/\.$/,''));savePredState();if(farmData)saveState();schedulePush();autoPlanCache=new Map();farmRangeCache=null;
  if(document.getElementById('siloModal')?.classList.contains('open'))renderSiloModalBody();
  if(feedCompareState.modalOpen)renderCompareModalBody();
  render();if(label)showToast(label);}
function fsReset(key){
  if(key==='target'){const c=fsMostCommon([1,2,3,4].map(pairTargetKg));[1,2,3,4].forEach(g=>{predState.targetHarvestWeightKg[g]=c;});fsAfterChange(`Target weight: every pair ${c.toFixed(2)} kg.`);return;}
  if(key.startsWith('feed:')){const s=farmData&&farmData.sheds[Number(key.slice(5))-1];if(s){s.feedAdjustPct=null;fsAfterChange(`Shed ${s.id} feed back to 100% of Ross.`);}return;}
  const i=fsItem(key);if(!i||i.normal==null)return;i.set(i.normal);fsAfterChange(`${i.label}: back to ${i.fmt(i.normal)}.`);
}
function fsResetAll(){const keys=farmSettingsNotNormal().map(o=>o.key);keys.forEach(k=>{if(k==='target'){const c=fsMostCommon([1,2,3,4].map(pairTargetKg));[1,2,3,4].forEach(g=>{predState.targetHarvestWeightKg[g]=c;});}else if(k.startsWith('feed:')){const s=farmData&&farmData.sheds[Number(k.slice(5))-1];if(s)s.feedAdjustPct=null;}else{const i=fsItem(k);if(i&&i.normal!=null)i.set(i.normal);}});fsAfterChange('All settings back to normal.');}

function renderFarmSettingsView(embedded,onlySec){
  // onlySec: the Settings page shows one section (Feed & silos, Weights & result, Pickup planning) at a time
  const inSec=k=>!onlySec||(fsItem(k)||{}).sec===onlySec;
  const off=farmSettingsNotNormal().filter(o=>inSec(o.key));
  const secs=[...new Set(FS_ITEMS.map(i=>i.sec))].filter(x=>!onlySec||x===onlySec);
  const chev='<svg class="fs-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
  const offHtml=off.length?`<section class="fs-group fs-off">
      <div class="fs-off-head"><span class="fs-sec-title">Not at normal</span><span class="fs-off-sub">these change your numbers</span>${off.length>1?'<button type="button" class="fs-reset" data-fs-reset-all>Reset all</button>':''}</div>
      <div class="fs-list">${off.map(o=>`<div class="fs-row fs-off-row"><span class="fs-row-text"><b>${escapeHtml(o.label)}</b><span><strong>${escapeHtml(o.value)}</strong> · normal ${escapeHtml(o.normal)}</span></span><button type="button" class="fs-reset" data-fs-reset="${escapeAttr(o.key)}">Reset</button></div>`).join('')}</div>
    </section>`:`<p class="fs-allnormal">Every setting is at normal.</p>`;
  const offKeys=new Set(off.map(o=>o.key));
  const secHtml=secs.map(sec=>`<section class="fs-group"><span class="fs-sec-label">${escapeHtml(sec)}</span><div class="fs-list">
      ${FS_ITEMS.filter(i=>i.sec===sec).map(i=>`<button type="button" class="fs-row" data-fs-edit="${i.key}"><span class="fs-row-text"><b>${escapeHtml(i.label)}</b>${i.hint?`<span>${escapeHtml(i.hint)}</span>`:''}${(()=>{const r=i.rec&&i.rec();return r?`<span class="fs-rec">Closed sheds: ${r.each.map(x=>`Shed ${x.id} ${x.pct>=0?'+':''}${x.pct.toFixed(1)}%`).join(' · ')} — average +${r.pct.toFixed(1)}%</span>`:'';})()}</span><span class="fs-val${offKeys.has(i.key)?' off':''}">${escapeHtml(i.fmt(i.get()))}</span>${chev}</button>`).join('')}
    </div></section>`).join('');
  return `<div class="fs-page">
    ${onlySec?'':'<div class="fs-intro">These only change how ProdWise projects and plans. Your recorded data never changes, and every change is kept in History.</div>'}
    ${offHtml}
    <div class="fs-grid">${secHtml}
      ${embedded?'':`<section class="fs-group"><span class="fs-sec-label">Per pair and per shed</span><div class="fs-list"><button type="button" class="fs-row" data-toggle-adjustments="1"><span class="fs-row-text"><b>More adjustments</b><span>Scale correction per shed, mortality rate, no-pickup days</span></span>${chev}</button></div></section>`}
    </div>
  </div>`;
}

// One setting at a time, in a small sheet (phone) or dialog (desktop)
let fsEditKey=null,fsDraft=null;
function openFarmSettingEdit(key){const i=fsItem(key);if(!i)return;fsEditKey=key;fsDraft=i.kind==='pairs'?i.get().slice():i.get();renderFsSheet();}
function closeFarmSettingEdit(){fsEditKey=null;fsDraft=null;renderFsSheet();}
function renderFsSheet(){
  let root=document.getElementById('fsSheetRoot');
  if(!root){root=document.createElement('div');root.id='fsSheetRoot';document.body.appendChild(root);}
  const i=fsEditKey&&fsItem(fsEditKey);
  if(!i){root.innerHTML='';return;}
  let ctrl='';
  if(i.kind==='step')ctrl=`<div class="fs-step"><button type="button" class="fs-step-btn" data-fs-step="-1" aria-label="Less">−</button><div class="fs-step-val">${i.typeIn?`<input type="number" inputmode="decimal" class="fs-num" data-fs-input value="${escapeAttr(String(fsDraft))}" aria-label="${escapeAttr(i.label)}"><span class="fs-unit">t</span>`:`<b>${escapeHtml(i.fmt(fsDraft))}</b>`}${i.normal!=null?`<span>normal ${escapeHtml(i.fmt(i.normal))}</span>`:''}</div><button type="button" class="fs-step-btn" data-fs-step="1" aria-label="More">+</button></div>`;
  else if(i.kind==='seg')ctrl=`<div class="fs-seg">${i.options.map(([v,l])=>`<button type="button" class="${fsDraft===v?'active':''}" data-fs-seg="${v}" aria-pressed="${fsDraft===v}">${escapeHtml(l)}</button>`).join('')}</div>`;
  else if(i.kind==='pairs')ctrl=`<div class="fs-pairs">${[1,2,3,4].map((g,ix)=>`<label><span>${escapeHtml(pairLabel(g))}</span><input type="number" step="0.05" min="0.5" max="5" inputmode="decimal" class="fs-num" data-fs-pair="${ix}" value="${Number(fsDraft[ix]).toFixed(2)}"></label>`).join('')}</div>`;
  const tick='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
  const cross='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  root.innerHTML=`<div class="fs-scrim" data-fs-close></div>
    <div class="fs-sheet" role="dialog" aria-modal="true" aria-label="${escapeAttr(i.label)}">
      <div class="fs-grip" aria-hidden="true"></div>
      <div class="fs-sheet-head"><div><h3>${escapeHtml(i.label)}</h3>${i.hint?`<p>${escapeHtml(i.hint)}</p>`:''}</div><button type="button" class="fs-x" data-fs-close aria-label="Close">${cross}</button></div>
      ${ctrl}
      ${(()=>{const r=i.rec&&i.rec();if(!r)return '';return `<div class="fs-recbox"><b>From your closed sheds</b><span>${r.each.map(x=>`Shed ${x.id}: ${x.pct>=0?'+':''}${x.pct.toFixed(1)}%`).join(' · ')}</span><span>Average <b>+${r.pct.toFixed(1)}%</b> — each shed is different, so it's only a guide.</span>${Number(fsDraft)!==r.use?`<button type="button" class="fs-btn" data-fs-userec="${r.use}">Use +${r.use}%</button>`:'<em>Matches your setting</em>'}</div>`;})()}
      <div class="fs-changes"><span class="fs-k">This changes</span>${(i.changes||[]).map(c=>`<span class="fs-ch yes">${tick}${escapeHtml(c)}</span>`).join('')}${i.not?`<span class="fs-ch no">${cross}Not ${escapeHtml(i.not)}</span>`:''}</div>
      <div class="fs-sheet-btns">${i.normal!=null?`<button type="button" class="fs-btn" data-fs-normal>Reset to ${escapeHtml(i.fmt(i.normal))}</button>`:'<span></span>'}<button type="button" class="fs-btn primary" data-fs-save>Save</button></div>
    </div>`;
}
function fsStep(dir){const i=fsItem(fsEditKey);if(!i||i.kind!=='step')return;const v=Math.round((Number(fsDraft)+dir*i.step)*100)/100;fsDraft=Math.max(i.min,Math.min(i.max,v));renderFsSheet();}
function fsSave(){const i=fsItem(fsEditKey);if(!i)return;
  if(i.kind==='step'){const n=Number(fsDraft);if(!Number.isFinite(n))return;fsDraft=Math.max(i.min,Math.min(i.max,n));}
  i.set(fsDraft);const label=`${i.label}: ${i.fmt(i.get())}.`;closeFarmSettingEdit();fsAfterChange(label);}

document.addEventListener('click',e=>{
  const ed=e.target.closest('[data-fs-edit]');if(ed){openFarmSettingEdit(ed.dataset.fsEdit);return;}
  const rs=e.target.closest('[data-fs-reset]');if(rs){fsReset(rs.dataset.fsReset);return;}
  if(e.target.closest('[data-fs-reset-all]')){fsResetAll();return;}
  if(e.target.closest('[data-fs-close]')){closeFarmSettingEdit();return;}
  const ur=e.target.closest('[data-fs-userec]');if(ur){fsDraft=Number(ur.dataset.fsUserec);renderFsSheet();return;}
  const st=e.target.closest('[data-fs-step]');if(st){fsStep(Number(st.dataset.fsStep));return;}
  const sg=e.target.closest('[data-fs-seg]');if(sg){fsDraft=sg.dataset.fsSeg;renderFsSheet();return;}
  if(e.target.closest('[data-fs-normal]')){const i=fsItem(fsEditKey);if(i&&i.normal!=null){fsDraft=i.normal;renderFsSheet();}return;}
  if(e.target.closest('[data-fs-save]')){fsSave();return;}
  if(e.target.closest('[data-mgr-loads]')){openLoadsModal();return;}
  if(e.target.closest('[data-mgr-silo]')){openSiloModal();return;}
  if(e.target.closest('[data-mgr-pickups]')){openPickupsModal();return;}
  if(e.target.closest('[data-open-farmsettings]')){
    if(document.getElementById('siloModal')?.classList.contains('open'))closeSiloModal();
    if(feedCompareState.modalOpen)closeCompareModal();
    if(adjModalOpen){adjModalOpen=false;adjDraft=null;}
    activeTab='farmsettings';render();return;}
});
document.addEventListener('input',e=>{
  if(e.target.matches&&e.target.matches('[data-fs-input]')){fsDraft=e.target.value===''?'':Number(e.target.value);return;}
  if(e.target.matches&&e.target.matches('[data-fs-pair]')&&Array.isArray(fsDraft)){fsDraft[Number(e.target.dataset.fsPair)]=Number(e.target.value);}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&fsEditKey){closeFarmSettingEdit();}});

// Replaces the three planning controls on the silo screens: one line + a link
function siloSettingsLineHtml(){
  const conf=Math.round(siloConfidence()*100),safety=siloSafetyDays();
  return `<div class="silo-set-line">Reading accuracy <b>${conf}%</b> · safety stock <b>${safety} day${safety===1?'':'s'}</b> · trucks <b>${deliveryTimingEarly()?'early morning':'during the day'}</b><button type="button" class="silo-set-link" data-open-farmsettings>Change in Settings ›</button></div>`;
}

// ── One page per pair (Sheds + Predictions combined, 2026-10) ──────────
// Tabs by job: Overview · Feed & silo · Pickups · Growth · Setup. Feed & silo
// is the existing planner; Pickups, Growth and Setup reuse the prediction
// card's own pieces, so every edit works exactly as before.
const PAIR_TABS=[['overview','Overview'],['planner','Feed & silo'],['pickups','Pickups'],['growth','Growth'],['setup','Setup']];
function pairTabsHtml(g,view){
  let feedDot=false;try{feedDot=computeFarmAlerts().some(x=>x.feedGroup===g&&!x.starter);}catch(e){}
  return `<nav class="pair-tabs" aria-label="${escapeAttr(pairLabel(g))} sections">${PAIR_TABS.map(([v,l])=>`<button type="button" class="pair-tab${v===view?' active':''}" data-shedview="${v}" data-group="${g}" aria-pressed="${v===view}">${escapeHtml(l)}${v==='planner'&&feedDot?'<i class="pair-tab-dot" title="Feed needs a look"></i>':''}</button>`).join('')}</nav>`;
}
// Shed inputs, rarely changed (from the old Sheds page card)
function shedSetupHtml(shed){
  const idx=shed.id-1,chickW=shedChickWeight(shed),fp=finalPickupOf(shed);
  const row=(id,label,input)=>`<div class="field-row"><label for="${id}">${label}</label>${input}</div>`;
  return `<div class="panel pair-setup"><h4>Shed setup</h4>
    ${row(`setPlace_${idx}`,'Placement date',`<input id="setPlace_${idx}" type="date" value="${iso(shed.placementDate)}" data-shed="${idx}" data-field="placementDate" />`)}
    ${row(`setPop_${idx}`,'Birds placed',`<input id="setPop_${idx}" type="number" min="0" value="${shed.initialPopulation}" data-shed="${idx}" data-field="initialPopulation" />`)}
    ${row(`setChick_${idx}`,'Chick weight (g)',`<input id="setChick_${idx}" type="number" step="0.1" min="30" max="80" value="${Math.round(chickW*1000)}" data-shed="${idx}" data-field="chickWeightGrams" />`)}
    ${row(`setFeed_${idx}`,'Feed intake (% of Ross)',`<input id="setFeed_${idx}" type="number" step="1" min="50" max="150" value="${shed.feedAdjustPct!=null?shed.feedAdjustPct:''}" placeholder="100 = standard" data-shed="${idx}" data-field="feedAdjustPct" title="Daily feed per bird as a % of the Ross 308 intake. Leave empty for the standard (100%)." />`)}
    ${row(`setClean_${idx}`,'Clean-out date',`<input id="setClean_${idx}" type="date" value="${iso(shed.cleanoutDate)}" data-shed="${idx}" data-field="cleanoutDate" ${fp?'title="Set automatically from the final pickup"':''} />`)}
  </div>`;
}
function pairGrowthChip(shed,today){
  const age=ageInDays(shed,today);if(age<=0)return '';
  const f=forecastWeightModeAware(shed,today);if(!f||f.kg==null)return '';
  const dv=daysVsTarget(age,f.kg);if(dv==null)return '';
  const sev=daysBehindSeverity(dv);
  const txt=Math.abs(dv)<0.5?'On standard':dv>0?`${dv.toFixed(1)} days ahead`:`${(-dv).toFixed(1)} days behind`;
  return `<span class="pair-chip ${sev}" title="Growth vs ${stdName()}">${txt}</span>`;
}
// ── Pair Overview (2026-10-17 redesign): answer first, three numbers per shed, detail one tap away.
// One line under the pair name instead of the four number chips
function pairSummaryLine(g){
  const today=mgrToday(),sheds=shedsForGroup(g).filter(s=>s.placementDate);if(!sheds.length)return '';
  const parts=[];
  const ages=sheds.map(s=>ageInDays(s,today)).filter(a=>a>0);
  if(ages.length)parts.push('Day '+ages.join(' and '));
  const live=sheds.reduce((n,s)=>n+Math.max(0,liveAtStartOfDay(s,today)),0);
  parts.push(live.toLocaleString('en-US')+' birds');
  if(sheds.every(s=>s.closed))parts.push('both sheds closed');
  else{const d=sheds.filter(s=>!s.closed&&s.cleanoutDate).map(s=>mgrDays(today,dateOnly(s.cleanoutDate)));
    if(d.length){const lo=Math.min(...d),hi=Math.max(...d);
      parts.push(hi<0?'clean-out has passed':lo<=0&&hi<=0?'clean-out today':lo===hi?`clean-out in ${lo} day${lo===1?'':'s'}`:`clean-out in ${Math.max(0,lo)}–${hi} days`);}}
  return parts.join(' · ');
}
// The jobs for this pair only, each with the button that does it
function pairNeeds(g){
  const out=[],today=mgrToday(),hour=new Date().getHours();
  const sheds=shedsForGroup(g).filter(s=>s.placementDate&&!s.closed);if(!sheds.length)return out;
  const done=typeof pairAllClosed==='function'&&pairAllClosed(g);
  const silo=done?null:mgrSiloOutlook().find(x=>x.g===g);
  if(silo&&silo.dep&&silo.days<=10&&silo.feeding.length){
    const next=farmLoads.filter(l=>l.date&&dateOnly(l.date)>=today&&Number(l.splitKg&&l.splitKg[g])>0).sort((a,b)=>dateOnly(a.date)-dateOnly(b.date))[0];
    const late=next&&dateOnly(next.date)>silo.dep;
    out.push({tone:silo.days<=3?'bad':'warn',title:`Silos run low ${/^(today|tomorrow)$/i.test(mgrWhen(silo.dep))?mgrWhen(silo.dep).toLowerCase():mgrWhen(silo.dep)}`,
      sub:next?`Next load ${fmtShortNoYear(next.date)}${late?` — ${mgrDays(silo.dep,dateOnly(next.date))} day${mgrDays(silo.dep,dateOnly(next.date))===1?'':'s'} late`:''}`:'No load booked yet',btn:'Book a load',act:'data-mgr-loads'});
  }
  if(silo&&(!silo.reading||(silo.readAge>0&&hour>=9)))out.push({tone:'warn',title:'Read the silos',sub:silo.reading?`Last reading ${fmtShortNoYear(silo.reading.date)}`:'No reading yet this batch',btn:'Record reading',act:'data-mgr-silo'});
  const late=sheds.filter(s=>{const c=s.cleanoutDate?dateOnly(s.cleanoutDate):null;if(c&&c<today)return false;const u=s.mortalityUpdatedAt?dateOnly(s.mortalityUpdatedAt):null;return !u||mgrDays(u,today)>=2;});
  if(late.length)out.push({tone:'warn',title:`Enter mortality for ${late.map(s=>'Shed '+s.id).join(' and ')}`,sub:'Not updated for 2 days or more',btn:'Enter mortality',act:'data-mgr-mort'});
  const est=sheds.reduce((n,s)=>n+(s.pickups||[]).filter(p=>p.date&&dateOnly(p.date)<=today&&p.weightEstimated).length,0);
  if(est)out.push({tone:'warn',title:`Enter kill-sheet weight${est===1?'':'s'} for ${est} pickup${est===1?'':'s'}`,sub:'Past pickups still on an estimated weight',btn:'Pickups',act:'data-mgr-pickups'});
  return out;
}
// In-yard weights day 7–28 on one line, with the latest check against the standard
function pairInYardLine(s){
  const got=TARGET_DAYS.filter(d=>Number(s.targetCurve&&s.targetCurve[d])>0);
  if(!got.length)return `<div class="pov-iy">In-yard weights: none yet · <button type="button" class="mgr-link" data-shedview="growth" data-group="${Math.ceil(s.id/2)}">enter on Growth ›</button></div>`;
  const vals=TARGET_DAYS.map(d=>{const v=Number(s.targetCurve&&s.targetCurve[d]);return v>0?`d${d} <b>${v.toFixed(2)}</b>`:`d${d} <span class="pov-miss">—</span>`;}).join(' · ');
  const last=got[got.length-1],kg=Number(s.targetCurve[last])*shedBiasFactor(s),dv=daysVsTarget(last,kg);
  const chip=dv==null?'':`<span class="pair-chip ${daysBehindSeverity(dv)}" title="Day ${last} reading (×${Math.round(shedBiasFactor(s)*100)}% to plant weight) vs ${escapeAttr(stdName())}">${Math.abs(dv)<0.5?'on std':(dv>0?'+':'−')+Math.abs(dv).toFixed(1)+' d'} at d${last}</span>`;
  return `<div class="pov-iy">In-yard: ${vals} kg ${chip}</div>`;
}
// Density now (kg/m²): birds in the shed × today's weight ÷ floor area, against the shed's thin trigger
function shedDensityNow(s,today,live){
  if(!s.placementDate||s.closed)return null;
  const w=(forecastWeightModeAware(s,today).kg)||0;if(!(w>0)||!(live>0))return null;
  const ds=getShedDensitySettings(s);
  return {d:live*w/FIXED_FLOOR_AREA_M2,trig:Number(ds.triggerDensity),max:Number(ds.maxDensity),w};
}
function shedDensityTone(x){return x.d>=x.max?'bad':x.d>=x.trig?'warn':'';}
function shedDensityTileHtml(s,today,live){
  const x=shedDensityNow(s,today,live);
  if(!x)return `<div><span>Density now</span><b>—</b><em>no weight yet</em></div>`;
  const t=shedDensityTone(x);
  return `<div class="pov-dens${t?' '+t:''}" title="${live.toLocaleString('en-US')} birds × ${x.w.toFixed(2)} kg ÷ ${FIXED_FLOOR_AREA_M2.toLocaleString('en-US')} m² · thin at ${x.trig} · never above ${x.max} kg/m²"><span>Density now</span><b>${x.d.toFixed(1)}</b><em>kg/m² · thin at ${x.trig}</em></div>`;
}
function shedDensityNowHtml(s,today,live,cls){
  const x=shedDensityNow(s,today,live);if(!x)return '';
  const t=shedDensityTone(x);
  return `<span class="${cls}${t?' '+t:''}" title="${live.toLocaleString('en-US')} birds × ${x.w.toFixed(2)} kg ÷ ${FIXED_FLOOR_AREA_M2.toLocaleString('en-US')} m²">Density now <b>${x.d.toFixed(1)} kg/m²</b> · thin at ${x.trig}</span>`;
}
function pairOverviewHtml(g){
  const today=mgrToday(),sheds=shedsForGroup(g).filter(s=>s.placementDate);
  if(!sheds.length)return `<div class="empty-card">${pairLabel(g)} has no birds yet.</div>`;
  const needs=pairNeeds(g);
  const needsHtml=needs.length?`<div class="pov-needs">${needs.map(n=>`<div class="pov-need ${n.tone}"><span class="pov-need-tx"><b>${escapeHtml(n.title)}</b><span>${escapeHtml(n.sub)}</span></span><button type="button" class="mgr-btn${n.tone==='bad'?' primary':''}" ${n.act}>${escapeHtml(n.btn)}</button></div>`).join('')}</div>`:'';
  const card=s=>{
    const age=ageInDays(s,today),live=Math.max(0,liveAtStartOfDay(s,today)),placed=Number(s.initialPopulation)||0,mort=Number(s.mortality)||0;
    const done=(s.pickups||[]).filter(p=>p.date&&dateOnly(p.date)<=today&&!p.weightEstimated&&Number(p.birds)>0&&Number(p.totalWeightKg)>0).sort((a,b)=>dateOnly(a.date)-dateOnly(b.date));
    const last=done[done.length-1],coming=mgrComingPickups(s);
    const loggedFinal=(s.pickups||[]).find(p=>p.isFinal&&p.date&&dateOnly(p.date)<=today);
    const finalP=coming.length?coming[coming.length-1]:loggedFinal?{date:dateOnly(loggedFinal.date),birds:Number(loggedFinal.birds)||0,planned:false}:null;
    const next=coming.length>1?coming[0]:null;
    const row=(k,v)=>`<div class="pair-row"><span>${k}</span><b>${v}</b></div>`;
    const closed=!!s.closed;
    return `<section class="mgr-card pair-shed pov-shed${closed?' is-closed':''}" id="pair-shed-${s.id}">
      <div class="pair-shed-head"><span class="mgr-title">Shed ${s.id}</span>${closed?csChipHtml(s.id):pairGrowthChip(s,today)}</div>
      ${typeof closeBannerHtml==='function'?closeBannerHtml(s):''}
      <div class="pov-big3">
        <div><span>Birds now</span><b>${live.toLocaleString('en-US')}</b><em>day ${age}</em></div>
        <div title="${mort.toLocaleString('en-US')} of ${placed.toLocaleString('en-US')} placed"><span>Mortality</span><b>${placed>0?(mort/placed*100).toFixed(1):'0.0'}%</b><em>${mort.toLocaleString('en-US')} birds</em></div>
        ${shedDensityTileHtml(s,today,live)}
        <div><span>${finalP&&finalP.planned?'Last pickup (plan)':'Last pickup'}</span><b>${finalP?escapeHtml(fmtShortNoYear(finalP.date).replace(/ \w+$/,'')):'—'}</b><em>${finalP?finalP.birds.toLocaleString('en-US')+' birds':'not planned yet'}</em></div>
      </div>
      ${pairInYardLine(s)}
      <details class="pov-more"><summary>Kill sheets, pickups and clean-out</summary><div class="pair-rows">
        ${row('Last kill sheet',last?`${(last.totalWeightKg/last.birds).toFixed(2)} kg · ${escapeHtml(fmtShortNoYear(last.date))}, day ${pickupAge(s,last)}`:'None yet')}
        ${row('Next pickup',next?`${escapeHtml(fmtShortNoYear(next.date))} · ${next.birds.toLocaleString('en-US')} birds`:'—')}
        ${row(finalP&&finalP.planned?'Final pickup (plan)':'Last pickup',finalP?`${escapeHtml(fmtShortNoYear(finalP.date))} · ${finalP.birds.toLocaleString('en-US')} birds`:'Not planned yet')}
        ${row('Clean-out',s.cleanoutDate?`${escapeHtml(fmtShortNoYear(s.cleanoutDate))} · day ${ageInDays(s,dateOnly(s.cleanoutDate))}`:'Not set')}
      </div></details>
    </section>`;
  };
  const gp=computeGroupPredictions(g);
  const result=gp&&gp.hasData?`<section class="mgr-card pov-result"><div class="pov-result-head"><span class="mgr-k">Where the pair will finish</span><b>${gp.cfcr.toFixed(3)}</b><span class="pov-unit">Cfcr2.45</span></div>
      <div class="pov-result-rest"><span>FCR <b>${gp.fcr.toFixed(3)}</b></span><span>Weight <b>${gp.avgWeight.toFixed(2)} kg</b></span><span>Livability <b>${gp.livability.toFixed(1)}%</b></span><span>PIF <b>${Math.round(gp.pif)}</b></span></div></section>`:'';
  return `<div class="pair-overview pov">${typeof pairLeftoverBannerHtml==='function'?pairLeftoverBannerHtml(g):''}${needsHtml}<div class="mgr-row2">${sheds.map(card).join('')}</div>${result}</div>`;
}
document.addEventListener('click',e=>{const f=e.target.closest('[data-mgr-feed]');if(f){const g=Number(f.dataset.mgrFeed);
  // Home's Test a delivery opens Compare feed with that pair selected (tablet and desktop); a phone gets the pair's feed plan
  if(f.dataset.mgrCompare&&typeof isCompareAvailable==='function'&&isCompareAvailable()){openCompareModal([g]);return;}
  activeTab='g'+g;shedViewByGroup[g]='planner';saveShedViews();render();}});

// Predictions now live on each pair's page: anything that used to open the
// Predictions page opens the matching tab instead.
function gotoPair(g,view,shedId){
  g=Math.max(1,Math.min(4,Number(g)||1));
  activeTab='g'+g;shedViewByGroup[g]=view||'overview';predState.predGroup=g;saveShedViews();
  if(feedCompareState.modalOpen)closeCompareModal();
  render();
  if(shedId){requestAnimationFrame(()=>{const el=document.getElementById('pred-shed-card-'+shedId);if(el)el.scrollIntoView({behavior:'auto',block:'start'});});}
}

// ── Sidebar rail (collapsed icon bar) and tools as pages (2026-10) ─────
const SB_RAIL_KEY='prodwise_sb_rail_v1';
function setSidebarRail(on){document.body.classList.toggle('sb-rail',!!on);try{localStorage.setItem(SB_RAIL_KEY,on?'1':'0');}catch(e){}
  const b=document.getElementById('sbRailBtn');if(b){const t=on?'Expand sidebar':'Collapse sidebar';b.setAttribute('aria-label',t);b.title=t;}}
// Feed loads, Silo readings, Pickups and Compare feed open as pages in the main area, not windows on top
const TOOL_PAGES={
  loadsModal:{btn:'loadsBtn',close:()=>closeLoadsModal(),title:'Feed loads',sub:'All sheds · plan and log deliveries'},
  pickupsModal:{btn:'pickupsBtn',close:()=>closePickupsModal(),title:'Pickups',sub:'Every pickup, all sheds'},
  mortModal:{btn:'mortBtn',close:()=>closeMortModal(),title:'Mortality',sub:'Total morts per shed'},
  compareFeedModal:{btn:'toolsCompareBtn',close:()=>closeCompareModal(),title:'Compare feed',sub:'Feed balance for every pair, side by side'},
};
let toolPageOpen=null,toolPageKey=null;
function syncToolPages(changed){
  const open=Object.keys(TOOL_PAGES).filter(id=>document.getElementById(id)?.classList.contains('open'));
  // Only one tool page at a time: the newest one stays
  if(open.length>1){const keep=changed&&open.includes(changed)?changed:open[open.length-1];open.filter(id=>id!==keep).forEach(id=>{try{TOOL_PAGES[id].close();}catch(e){}});toolPageOpen=keep;}
  else toolPageOpen=open[0]||null;
  // remember which page was showing, so going to any other page closes the tool
  if(toolPageOpen&&changed)toolPageKey=typeof currentPageKey==='function'?currentPageKey():null;
  if(!toolPageOpen)toolPageKey=null;
  document.body.classList.toggle('tool-open',!!toolPageOpen);
  if(toolPageOpen&&changed){const m=document.getElementById(toolPageOpen);const b=m&&m.querySelector('.compare-modal-body');if(b)b.scrollTop=0;}
  // the page sits under the app header, which shows the tool's name
  const ph=document.getElementById('pageHeader');if(ph)document.body.style.setProperty('--ph-h',ph.offsetHeight+'px');
  if(typeof updatePageHeader==='function')updatePageHeader();
  Object.entries(TOOL_PAGES).forEach(([id,t])=>{const b=document.getElementById(t.btn);if(b)b.classList.toggle('active',id===toolPageOpen);});
  renderPwBatchPanel();syncPwRail();
}
// ── Icon rail + side panel, like CluckWise (2026-10-11, mockup QW7BBs25AAbiLRddm8s14L) ─────
// Desktop: a slim rail that never collapses. Sheds and Tools open the side panel; clicking the lit one again hides it.
const PW_PANEL_KEY='prodwise_pw_panel_v1';
let pwPanel='sheds';try{const v=localStorage.getItem(PW_PANEL_KEY);if(['batch','sheds','tools','none'].includes(v))pwPanel=v;}catch(e){}
const PW_PANEL_TITLES={batch:'Batch Details',sheds:'Sheds Details',tools:'Tools'};
const PW_SHED_PAGES=['predictions','g1','g2','g3','g4'];
function setPwPanel(p,animate){
  // smooth like CluckWise: the panel slides open/shut and its content fades in (only after a click)
  if(animate&&window.matchMedia('(min-width:769px)').matches){document.body.classList.add('sb-anim');clearTimeout(window.__sbAnimT);window.__sbAnimT=setTimeout(()=>document.body.classList.remove('sb-anim'),360);}
  if(p!=='none'){const pane=document.querySelector('.sidebar');if(pane&&animate){pane.classList.remove('pw-fade');void pane.offsetWidth;pane.classList.add('pw-fade');}}
  pwPanel=p;['batch','sheds','tools','none'].forEach(k=>document.body.classList.toggle('pwp-'+k,p===k));
  try{localStorage.setItem(PW_PANEL_KEY,p);}catch(e){}
  const t=document.getElementById('sbPanelTitle');if(t&&PW_PANEL_TITLES[p])t.textContent=PW_PANEL_TITLES[p];
  renderPwBatchPanel();syncPwRail();
}
// Batch Details panel: the current batch card, then Result detail and batch details
function renderPwBatchPanel(){
  const el=document.getElementById('sbBatchPanel');if(!el)return;
  if(!farmData){el.innerHTML='<p class="pwb-empty">No batch yet — import the sheds file or start a new batch.</p>';return;}
  const sheds=mgrPlaced(),today=mgrToday();
  const batch=predState.batchNumber||farmData.batchNumber||'';
  let card='';
  if(sheds.length){
    const first=sheds.map(s=>dateOnly(s.placementDate)).reduce((a,b)=>b<a?b:a);
    const day=Math.max(0,mgrDays(first,today));
    const cleans=sheds.map(s=>s.cleanoutDate?dateOnly(s.cleanoutDate):null).filter(Boolean).sort((a,b)=>a-b);
    const cyc=cleans.length?Math.max(1,mgrDays(first,cleans[cleans.length-1])):null;
    const left=cleans.length?mgrDays(today,cleans[0]):null;
    card=`<button type="button" class="pwb-card" data-batch-info title="Batch details"><span class="pwb-k">Current batch</span><b>${batch?'Batch '+escapeHtml(String(batch)):'This batch'}</b><span class="pwb-day">Day ${day}${cyc?` of ${cyc}`:''}</span>${cyc?`<span class="pwb-bar"><i style="width:${Math.min(100,Math.round(day/cyc*100))}%"></i></span>`:''}<span class="pwb-sub">${cleans.length?(left>0?`First clean-out in ${left} day${left===1?'':'s'} · ${escapeHtml(fmtShortNoYear(cleans[0]))}`:`Clean-out ${escapeHtml(fmtShortNoYear(cleans[0]))}`):'No clean-out date yet'}</span></button>`;
  }
  const on=activeTab==='dashboard'&&!toolPageOpen;
  const runCards=typeof pwRunningCardsHtml==='function'?pwRunningCardsHtml():'';if(runCards)card=runCards;
  const onHome=activeTab==='home'&&!toolPageOpen;
  el.innerHTML=card+`<div class="pwb-links">
    <button type="button" class="sb-link${onHome?' active':''}" data-tab="home">${navIcon('home')}<span class="sb-link-label">Home</span></button>
    <button type="button" class="sb-link${on?' active':''}" data-tab="dashboard">${navIcon('grid')}<span class="sb-link-label">Result detail</span></button>
    <button type="button" class="sb-link${activeTab==='shedsetup'?' active':''}" data-tab="shedsetup">${navIcon('shed')}<span class="sb-link-label">Set up sheds</span></button></div>
    <button type="button" class="pwb-new" data-pwb-newbatch>${navIcon('refresh')}<span>New batch</span></button>`;
}
function buildPwRail(){
  const lay=document.querySelector('.app-layout');if(!lay||document.getElementById('pwRail'))return;
  // the logo, with its gradient ids renamed so the copy never depends on the panel being shown
  const ic=document.querySelector('.sb-brand-icon');
  const logo=ic?ic.outerHTML.replace(/id="([\w-]+)"/g,'id="pwr-$1"').replace(/url\(#([\w-]+)\)/g,'url(#pwr-$1)'):'';
  const b=(attrs,icon,label,extra)=>`<button type="button" class="pwr-btn" ${attrs} title="${label}">${extra||''}${navIcon(icon)}<span>${label}</span></button>`;
  const nav=document.createElement('nav');nav.className='pw-rail';nav.id='pwRail';nav.setAttribute('aria-label','ProdWise');
  // No Home button: the logo goes home (Home is still the start page)
  // One menu (2026-10-29, option C of mockup U7zGDYEtmcCRhrP5jc5agf): on a wide computer the Tasks pages sit on this rail
  // under a thin line, Theme takes Sync's place and sync shows as a dot + time under the logo; no ⇄ switch
  const tsvg=d=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const tb=(k,icon,label,title,badge)=>`<button type="button" class="pwr-btn pwr-t" data-pwt="${k}" title="${title}">${badge||''}${tsvg(icon)}<span>${label}</span></button>`;
  nav.innerHTML=`<button type="button" class="pwr-logo" data-tab="home" title="Home" aria-label="Home">${logo}</button>`
    +`<button type="button" class="pwr-synct" data-pwr-sync title="Sync"><span class="pwr-sdot" id="pwrSyncDot2"></span><span id="pwrSyncTime">Sync</span></button>`
    +b('data-pw-panel="batch"','grid','Batch')
    +b('data-pw-panel="sheds"','shed','Sheds','<span class="pwr-badge" id="pwrShedBadge" hidden></span>')
    +b('data-pw-panel="tools"','loads','Tools')
    +b('data-tab="history"','history','History')
    +'<span class="pwr-sep" aria-hidden="true"></span>'
    +tb('tasks','<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="11" rx="1.5"/><rect x="17" y="4" width="4" height="7" rx="1.5"/>','Planner','Planner: calendar, list and board')
    +tb('batch','<path d="M12 2l10 5-10 5L2 7z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>','Audits','Batches and audits')
    +tb('maint','<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>','Maintenance','Maintenance: problems reported on the farm','<span class="pwr-badge" id="pwrMaintBadge" hidden></span>')
    +tb('routine','<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>','Routine','Routine Tracker: recurring farm jobs')
    +tb('prep','<path d="M19 3l-8.5 8.5"/><path d="M10 12c-3 0-5 2-5 5v4h4c3 0 5-2 5-5z"/>','Prep','Shed preparation checklists','<span class="pwr-badge prep" id="pwrPrepBadge" hidden></span>')
    +tb('guide','<path d="M2 5a2 2 0 0 1 2-2h6v18H4a2 2 0 0 1-2-2z"/><path d="M22 5a2 2 0 0 0-2-2h-6v18h6a2 2 0 0 0 2-2z"/>','Guide','Farm guide: targets for the batch age')
    +'<span class="pwr-gap"></span>'
    +`<button type="button" class="pwr-btn pwr-theme" data-pwr-theme title="Light or dark mode">${tsvg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>')}<span>Theme</span></button>`
    // Production / Tasks switch on the rail, above Sync (2026-10-28, option B of mockup VGSsMoqwzwtL1ZTGJojqZk with the swap arrows); the floating pill is gone on computers
    +`<button type="button" class="pwr-btn pwr-ws" data-ws="tasks" title="Switch to Tasks: planner, maintenance, routine and guide"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4 3 8l4 4"/><path d="M3 8h14"/><path d="m17 20 4-4-4-4"/><path d="M21 16H7"/></svg><span>Tasks</span></button>`
    +`<button type="button" class="pwr-btn pwr-sync" data-pwr-sync title="Sync"><span class="pwr-sdot" id="pwrSyncDot"></span>${navIcon('cloud')}<span id="pwrSyncLbl">Sync</span></button>`
    +`<button type="button" class="pwr-btn pwr-farm" data-pwr-farm title="Account" aria-haspopup="menu" aria-expanded="false"><span class="pwr-badge" id="pwrFarmBadge" hidden></span><span class="pwr-av" id="pwrFarmAv">–</span><span id="pwrFarmLbl">Account</span></button>`;
  lay.insertBefore(nav,lay.firstChild);
  const nv=document.getElementById('sidebarNav');if(nv)new MutationObserver(syncPwRail).observe(nv,{childList:true});
}
// One menu: which Tasks page is open, and its Prep / Maintenance counts, read from the Tasks frame
function pwOneRailSync(r){
  const inT=typeof pwSection!=='undefined'&&pwSection==='tasks';
  let cur='',prep='',maint='';
  try{const d=cwFrame&&cwFrame.contentDocument;if(d){const a=d.querySelector('#appRail .ar-btn.active');cur=a?a.dataset.ar:'';
    const pb=d.querySelector('#appRail .ar-btn[data-ar="prep"] .ar-badge');if(pb&&!pb.hidden)prep=pb.textContent.trim();
    const mb=d.getElementById('arMaintBadge');if(mb&&!mb.hidden)maint=mb.textContent.trim();}}catch(e){}
  r.querySelectorAll('.pwr-t').forEach(b=>b.classList.toggle('on',inT&&b.dataset.pwt===cur));
  if(inT)r.querySelectorAll('[data-tab],[data-pw-panel],[data-pwr-farm]').forEach(b=>b.classList.remove('on','cur'));
  const set=(id,v)=>{const e=document.getElementById(id);if(e){e.hidden=!v||v==='0';e.textContent=v;}};set('pwrPrepBadge',prep);set('pwrMaintBadge',maint);
}
function syncPwRail(){
  const r=document.getElementById('pwRail');if(!r)return;
  // One lit button: the section of the page you are on (the open panel shows itself)
  const sec=toolPageOpen?'tools':PW_SHED_PAGES.includes(activeTab)?'sheds':(activeTab==='dashboard'||activeTab==='home')?'batch':activeTab;
  r.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('on',x.dataset.tab===sec));
  const fbtn=r.querySelector('[data-pwr-farm]');if(fbtn)fbtn.classList.toggle('on',sec==='farmsettings'||sec==='account');
  // Like CluckWise: the button of the open panel is lit; with the panel shut, the section you are in gets a softer mark
  r.querySelectorAll('[data-pw-panel]').forEach(x=>{const k=x.dataset.pwPanel;x.classList.toggle('on',k===pwPanel);x.classList.toggle('cur',k===sec&&k!==pwPanel);});
  // Sync and farm stay on the rail when the panel is hidden
  const sd=document.getElementById('pwrSyncDot'),sl=document.getElementById('pwrSyncLbl');
  if(sd&&typeof syncFarmName!=='undefined'){
    const busy=syncState==='pulling'||syncState==='pushing';
    const cls=!syncFarmName?'off':syncState==='error'?'err':busy?'busy':syncConnectedAt?'ok':'busy';
    sd.className='pwr-sdot '+cls;
    const sd2=document.getElementById('pwrSyncDot2'),st=document.getElementById('pwrSyncTime');
    if(sd2)sd2.className='pwr-sdot '+cls;
    if(st)st.textContent=!syncFarmName?'Offline':syncState==='error'?'Error':busy?'Syncing':syncLastSyncAt?new Date(syncLastSyncAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}).replace(/\s?[AP]M$/i,''):'Synced';
    const s2=r.querySelector('.pwr-synct');if(s2)s2.title=!syncFarmName?'Not connected — tap to connect':busy?'Syncing…':syncState==='error'?'Sync error — tap to retry':'Synced'+(syncLastSyncAt?' at '+new Date(syncLastSyncAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'')+' — tap to sync now';
    sl.textContent=!syncFarmName?'Offline':syncState==='error'?'Error':busy?'Syncing':'Synced';
    const sb=r.querySelector('.pwr-sync');if(sb)sb.title=!syncFarmName?'Not connected — tap to connect':busy?'Syncing…':syncState==='error'?'Sync error — tap to retry':'Synced'+(syncLastSyncAt?' · '+fmtRelativeTime(syncLastSyncAt):'')+' — tap to sync now';
  }
  const av=document.getElementById('pwrFarmAv'),fl=document.getElementById('pwrFarmLbl');
  if(av&&typeof displayFarmName==='function'){
    const shown=String(displayFarmName()||'').trim();
    av.textContent=syncFarmName?(shown.split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase()||'F'):'–';
    fl.textContent='Account';
    const fb=r.querySelector('[data-pwr-farm]');if(fb)fb.title='Account · '+(shown||'This device')+(syncFarmName?' · cloud sync on':' · not synced');
  }
  let n=0;document.querySelectorAll('#sidebarNav .sb-link[data-tab^="g"] .sb-count').forEach(c=>n+=Number(c.textContent)||0);
  const sb=document.getElementById('pwrShedBadge');if(sb){sb.hidden=!n;sb.textContent=n>99?'99+':String(n);sb.title=n+' open alert'+(n===1?'':'s');}
  pwOneRailSync(r);
  const fc=document.querySelector('#sidebarNav .sb-link[data-tab="farmsettings"] .sb-count');const fb=document.getElementById('pwrFarmBadge');if(fb){fb.hidden=!fc;fb.textContent=fc?fc.textContent:'';}
}
document.addEventListener('click',e=>{
  const pb=e.target.closest('[data-pw-panel]');
  if(pb){const k=pb.dataset.pwPanel;
    if(pwPanel===k&&!document.body.classList.contains('pw-on-settings')){setPwPanel('none',true);return;}
    setPwPanel(k,true);
    // and goes to the first page of that section: Batch → Home, Sheds → Sheds 1–2, Tools → Feed loads
    if(k==='tools'){if(toolPageOpen!=='loadsModal'&&typeof openLoadsModal==='function')openLoadsModal();return;}
    if(toolPageOpen)closeToolPages();
    if(k==='batch'){activeTab='home';render();}
    else if(k==='sheds'){if(typeof gotoPair==='function')gotoPair(1,'overview');else{activeTab='g1';render();}}
    return;}
  const gs=e.target.closest('[data-pw-goset]');if(gs){goSettings(gs.dataset.pwGoset);return;}
  if(e.target.closest('[data-pwb-newbatch]')){if(typeof openNewBatchModal==='function')openNewBatchModal();return;}
  if(e.target.closest('[data-pwr-sync]')){(document.getElementById('sbSyncNowBtn')||document.getElementById('sbConnectBtn'))?.click();return;}
  if(e.target.closest('[data-pwr-farm]')){pwMenuToggle();return;}
  const st=e.target.closest('[data-set-tab]');if(st&&SET_TASKS_PAGES.includes(st.dataset.setTab)&&st.closest('.st2')){setOpenInTasks(st.dataset.setTab);return;}
  if(st){setTab=st.dataset.setTab;setListOpen=false;render();window.scrollTo(0,0);if((setTab==='profile'||setTab==='security')&&typeof accLoad==='function')accLoad();return;}
  if(e.target.closest('[data-set-back]')){setListOpen=true;render();window.scrollTo(0,0);return;}
  const sp=e.target.closest('[data-set-pair]');if(sp){setPair=Number(sp.dataset.setPair)||1;renderSettingsTabBody(true);return;}
  const sd=e.target.closest('[data-set-std]');if(sd){sdSet('std',sd.dataset.setStd);return;}
  const ss=e.target.closest('[data-set-scale-sug]');if(ss){sdSetShed('scale',ss.dataset.setScaleSug,Number(ss.dataset.pct));return;}
  if(e.target.closest('[data-set-use-history]')){const p=historyDensityPrior();if(p){const dg={...(predState.densityGlobal||DEFAULT_DENSITY_GLOBAL)};dg.triggerDensity=p.trig;dg.targetDensity=p.tgt;dg.maxDensity=Math.max(28,p.max);if(p.tp)dg.targetPickups=Math.max(MIN_PICKUPS_PER_SHED,Math.min(MAX_PICKUPS_PER_SHED,p.tp));predState.densityGlobal=dg;savePredState();schedulePush();render();showToast('Pickup planning set from your last batches.');}return;}
  const og=e.target.closest('[data-pw-organize]');if(og){organiseCloudFiles(og);return;}
  if(e.target.closest('[data-set-profile]')){if(typeof openFarmProfile==='function')openFarmProfile();return;}
  const ap=e.target.closest('[data-adj-pair]');
  if(ap){const g=Number(ap.dataset.adjPair);if(g&&g!==predState.predGroup){if(typeof adjIsDirty==='function'&&adjIsDirty()&&!confirm('Discard your unapplied changes?'))return;predState.predGroup=g;adjDraft=null;adjDraftBase='';const root=document.getElementById('adjModalRoot');if(root)root.dataset.g='';render();}return;}
});
// ── One Settings page (2026-10-11, canvas 9JEedo4bftZcokHZu3PAP9) ─────
// Farm settings, the Settings drawer, the farm profile and the farm-wide half of Adjust were four places
// for overlapping things; now one page with tabs. The old drawer calls land here.
let setTab='predictions',setPair=1;
const SET_TABS=[['predictions','Predictions'],['pairs','Per pair & shed'],['farm','Farm & sync'],['alerts','Alerts'],['app','App & data']];
function goSettings(tab){
  if(tab&&SET_ALIAS[tab])tab=SET_ALIAS[tab];
  if(tab&&SET_TASKS_PAGES.includes(tab)){setOpenInTasks(tab);return;}
  if(tab)setTab=tab;
  // phone: a named page opens straight away; plain Settings opens on the list of pages
  setListOpen=!tab&&window.matchMedia('(max-width:768px)').matches;
  if(typeof toolPageOpen!=='undefined'&&toolPageOpen)closeToolPages();
  if(adjModalOpen){adjModalOpen=false;adjDraft=null;}
  activeTab='farmsettings';render();window.scrollTo(0,0);
}
function settingsPairsHtml(){
  if(!farmData)return '<p class="fs-allnormal">Load a batch to set things per shed.</p>';
  const g=setPair,sheds=shedsForGroup(g),farmPct=Math.round(currentBiasFactor()*1000)/10;
  const rows=sheds.map(sh=>{
    const sid=escapeAttr(String(sh.id));
    const ov=sdScale(sh);
    const own=suggestScaleCorrection([sh]);const sugPct=own?Math.round(own.value*1000)/10:null;
    const cur=ov==null?farmPct:ov;
    const scale=`<div class="set-scale"><label class="set-chk"><input type="checkbox" data-set-useglobal="${sid}" ${ov==null?'checked':''} /> Farm-wide${ov==null?` <b>${farmPct.toFixed(1)}%</b>`:''}</label>${ov==null?'':`<label class="set-mort"><input type="number" class="set-num" data-set-scale="${sid}" min="${MIN_BIAS_FACTOR*100}" max="${MAX_BIAS_FACTOR*100}" step="0.5" value="${ov}" aria-label="Scale correction for Shed ${sid}" /> %</label>`}</div>`;
    const kill=own?`<span>${sugPct.toFixed(1)}% <span class="set-muted">· ${own.n} weighing${own.n===1?'':'s'}</span></span>${Math.abs(sugPct-cur)>=0.1?` <button type="button" class="set-mini" data-set-scale-sug="${sid}" data-pct="${sugPct}">Use ${sugPct.toFixed(1)}%</button>`:' <span class="set-chip own">in use</span>'}`:'<span class="set-muted">No plant weighing yet</span>';
    return `<tr><td><b>Shed ${escapeHtml(String(sh.id))}</b></td><td>${scale}</td><td>${kill}</td><td><label class="set-mort"><input type="number" class="set-num" data-set-mortrate="${sid}" min="0" max="${MAX_MORT_RATE_PCT}" step="0.01" value="${sdMort(sh).toFixed(2)}" aria-label="Daily morts for Shed ${sid}" /> % / day</label></td></tr>`;}).join('');
  return `<div class="set-pairs">${[1,2,3,4].map(x=>`<button type="button" class="adj-pair${x===g?' active':''}" data-set-pair="${x}" style="--pc:var(--pair${x})">${escapeHtml(pairLabel(x))}</button>`).join('')}</div>
    <section class="fs-group"><span class="fs-sec-label">Per shed · ${escapeHtml(pairLabel(g))}</span>
      <div class="set-card"><table class="set-table"><thead><tr><th>Shed</th><th title="In-yard (shed-scale) readings only — plant weights are never scaled">Scale correction</th><th>From the kill sheets</th><th title="Expected daily mortality used for the forecast (normal ${DEFAULT_MORT_RATE_PCT.toFixed(2)}%)">Daily morts</th></tr></thead><tbody>${rows}</tbody></table></div></section>
    <p class="set-muted">Changes wait for <b>Apply</b> at the bottom, then update the forecast. Farm-wide numbers (scale, target weight, pickup planning, no-pickup days) are in <button type="button" class="set-link" data-set-tab="feed">Feed &amp; silos</button>, <button type="button" class="set-link" data-set-tab="weights">Weights &amp; result</button> and <button type="button" class="set-link" data-set-tab="pickups">Pickup planning</button>.</p>`;
}
// Growth standard: what "vs std", the days-behind alerts, shed colours and the growth chart compare against
function settingsGrowthStdHtml(){
  const fr=sdStd()==='freerange',X=sdFrCage();
  const days=[7,14,21,28,35,42,49,56];
  // the table previews the day you typed (before Apply)
  const keep=predState.frCage;predState.frCage=X;
  const rows=days.map(d=>{const w=freeRangeWeightKg(d),r=rossWeightKg(d);return `<td><b>${Math.round(w*1000).toLocaleString()} g</b><small>${Math.round(w/r*100)}%</small></td>`;}).join('');
  predState.frCage=keep;
  return `<section class="fs-group set-wide"><span class="fs-sec-label">Growth standard</span>
    <div class="set-card set-pad set-std">
      <div class="set-std-top">
        <div class="set-seg" role="group" aria-label="Growth standard"><button type="button" class="${fr?'on':''}" data-set-std="freerange">Free range</button><button type="button" class="${fr?'':'on'}" data-set-std="ross">Ross 308</button></div>
        <label class="set-mort${fr?'':' set-dim'}">Free range reaches 2.45 kg at day <input type="number" class="set-num" data-set-frcage min="25" max="60" step="0.5" value="${X}" ${fr?'':'disabled'} aria-label="Age the free-range birds reach 2.45 kg"></label>
      </div>
      <p class="set-muted">${fr?`Ross 308 shape from a 44 g chick: the same as Ross to day 14, then slower so 2.45 kg lands on day ${X} — your Cage2.45 target. Used by the vs std badges, the days-behind alerts, shed colours and the growth chart (Ross 308 is still drawn for reference).`:'Everything compares against the Ross 308 performance objectives.'}</p>
      ${fr?`<div class="co-scroll"><table class="set-table set-std-tbl"><thead><tr><th>Day</th>${days.map(d=>`<th>${d}</th>`).join('')}</tr></thead><tbody><tr><th>Free range</th>${rows}</tr><tr><th>Ross 308</th>${days.map(d=>`<td>${Math.round(rossWeightKg(d)*1000).toLocaleString()} g</td>`).join('')}</tr></tbody></table></div>`:''}
    </div></section>`;
}
// Farm-wide pickup tools under Predictions: no-pickup days, last batches' pattern, and the planner actions
function settingsPickupExtrasHtml(){
  if(!farmData)return '';
  const p=historyDensityPrior(),dg=predState.densityGlobal||DEFAULT_DENSITY_GLOBAL;
  const same=p&&Number(dg.triggerDensity)===p.trig&&Number(dg.targetDensity)===p.tgt&&Number(dg.maxDensity)===p.max&&(!p.tp||Number(dg.targetPickups)===p.tp);
  const hist=p?`<div class="set-card set-pad set-hist"><div><b>From your last batch${p.n>1?'es':''}</b><span class="set-muted"> ${escapeHtml(p.batches.slice(0,3).join(', '))}: thin at ${p.trig} · down to ${p.tgt} · max ${p.max} kg/m²${p.tp?` · ${p.tp} pickups`:''}</span></div><button type="button" class="set-btn" data-set-use-history ${same?'disabled':''}>${same?'In use':'Use these'}</button></div>`
    :`<p class="set-muted">Finished batches in Farm history will suggest pickup planning numbers here.</p>`;
  let blocked=0;farmData.sheds.forEach(s=>{blocked+=countPredictedPickupsOnBlockedDays(s);});
  return `<section class="fs-group set-wide"><span class="fs-sec-label">Pickups · farm-wide</span>
    <div class="set-npd">${renderNoPickupDaysRow(setDraft&&setDraft.npd)}</div>
    ${hist}
    <div class="set-actions"><button type="button" class="set-btn primary" data-global-autofill="1">Auto-fill all sheds</button><button type="button" class="set-btn" data-global-clear-pickups="1">Clear all planned pickups</button>${blocked?`<button type="button" class="set-btn" data-replan-blocked="1">Re-plan ${blocked} on blocked days</button>`:''}<span class="set-muted">Planned pickups only — recorded pickups never change.</span></div>
  </section>`;
}
function settingsSectionHtml(t){
  if(t==='predictions')return renderFarmSettingsView(true)+settingsGrowthStdHtml()+settingsPickupExtrasHtml();
  if(t==='pairs')return settingsPairsHtml();
  if(t==='farm')return `<div class="set-cards">
      ${settingsCloudFolderHtml()}${renderSettingsSyncCard()}${renderSettingsBatchHistoryCard()}${renderSettingsFarmHistoryCard()}</div>`;
  if(t==='alerts')return `<div class="set-cards">${renderSettingsNotificationsCard()}</div>`;
  return `<div class="set-cards">${renderSettingsUnitsCard()}${renderSettingsDataCard()}${renderSettingsReportsCard()}
    <div class="settings-foot settings-credit">Made by Von Mangaron · Personal use only · Not for commercial use</div></div>`;
}
// Cloud folder: where this farm's files live, and the one-tap move into it (both apps' files)
function settingsCloudFolderHtml(){
  if(!syncFarmName)return '';
  const f=sanitizeUserFarmName(syncFarmName);
  return `<div class="settings-section"><div class="settings-section-head"><span class="settings-icon">${settingsIcon('archive')}</span><div class="settings-section-title-wrap"><h4 class="settings-section-title">Cloud folder</h4></div></div>
    <p class="settings-section-desc">All of this farm's files live in one cloud folder: <b>${escapeHtml(f)}/prodwise</b> (batches, Excel copies, Farm history) and <b>${escapeHtml(f)}/cluckwise</b> (tasks, reports, workers, restore points). Files saved before the folders existed are moved in with one tap — same content, nothing changes for the apps or phones.</p>
    <button type="button" class="set-btn" data-pw-organize>Organise cloud files</button></div>`;
}
async function organiseCloudFiles(btn){
  if(!syncFarmName){showToast('Connect to a farm first.',true);return;}
  if(!navigator.onLine){showToast('You are offline — try again when connected.',true);return;}
  if(btn){btn.disabled=true;btn.textContent='Organising…';}
  let r=null;try{r=window.FarmKey?await FarmKey.action('manage',{farm:syncFarmName,op:'organize'}):null;}catch(e){}
  if(btn){btn.disabled=false;btn.textContent='Organise cloud files';}
  if(!(r&&r.j&&r.j.ok)){showToast((r&&r.j&&r.j.error)||'Could not organise. Check your connection.',true);return;}
  const n=r.j.moved||0;
  showToast(n?`${n} file${n===1?'':'s'} moved into ${sanitizeUserFarmName(syncFarmName)}/ in the cloud.`:'Already organised — every file is in the farm folder.');
}
// ── Settings (2026-10-18, mockup LnK1BcQbq1kWjDnzbab8s4): one page with a grouped side menu.
// Account (profile, security) lives here too: the Account buttons open Settings › Account.
// Works without a batch loaded (Account, Sync, App pages); production pages then say so.
const SET_GROUPS=[
  ['Account',[['profile','Profile','Your farm’s name, its manager and the silo numbers. Shared by Production, Tasks and the Crew app.'],['security','Security','Passwords keep your farm’s data to you and your crew.']]],
  ['Production',[['feed','Feed & silos','How the feed forecast plans deliveries. Changes wait for Apply.'],['weights','Weights & result','Target weights and how shed weights turn into plant weights.'],['pickups','Pickup planning','When sheds are thinned and how many pickups to plan.'],['pairs','Per pair & shed','Scale corrections and normal daily mortality, shed by shed.']]],
  ['Tasks',[['calendar','Calendar','What opens first.'],['weather','Weather','The forecast on the calendar, board and list.']]],
  ['Crew',[['workers','Workers','Who uses the Crew app on your farm.'],['notify','Notifications','Phone notifications for you and the crew: quiet hours, schedule and recipients.']]],
  ['Farm',[['sync','Sync & cloud','Where this farm’s files live and how this device syncs.'],['batches','Batches & history','Past batches and the farm’s results over time.']]],
  ['App',[['alerts','Alerts','What ProdWise tells you about, in Production and in Tasks.'],['backup','Backup & reports','Copies and reports for both sections in one place.'],['appearance','Display','Theme, text size and units on this device. Production and Tasks use the same.'],['about','About','Version and credits.']]]
];
// One Settings for Production and Tasks (2026-10-18, mockup 92VKxtw5Nx3ATsHzDrygn5): Tasks has the same menu.
// These pages belong to Tasks: picking one opens the Tasks section on that page.
const SET_TASKS_PAGES=['appearance','calendar','weather','workers','alerts','backup'];
const SET_ALIAS={predictions:'feed',farm:'sync',app:'appearance',data:'backup',display:'appearance'};
function setOpenInTasks(k){
  if(typeof openTasksSection!=='function')return;
  openTasksSection();
  const send=()=>{try{cwFrame.contentWindow.postMessage({cwOpenSettings:k},location.origin);}catch(e){}};
  // the first time, Tasks is still loading: send once it has started
  if(cwFrame&&cwFrame.contentWindow&&cwFrame.contentWindow.__csShow)send();
  else if(cwFrame)cwFrame.addEventListener('load',()=>setTimeout(send,300),{once:true});
}
// For Tasks' copy of the menu and its Alerts / Backup pages
function pwSettingsBadges(){return {feed:setOffCount('feed'),security:!!(typeof accInfo!=='undefined'&&accInfo&&accInfo.setup)};}
function pwGetNotif(k){return !!notifPrefs[k];}
function pwSetNotif(k,v){pwActivity('settings',`${k==='feedBalance'?'Silos running low':k==='emptyShed'?'Empty shed':'Shed behind the standard'} alerts ${v?'on':'off'}`);notifPrefs[k]=!!v;saveNotifPrefs();if(typeof updateAlertsBell==='function')updateAlertsBell();if(typeof render==='function'&&pwSection==='production')render();}
function pwBatchLabel(){if(!farmData)return '';const b=predState.batchNumber||farmData.batchNumber;return b?'Batch '+b:'This batch';}
const SET_SEC={feed:'Silos and feed',weights:'Weights and result',pickups:'Pickup planning'};
const SET_NEEDS_BATCH=['feed','weights','pickups','pairs','batches'];
let setSearch='',setListOpen=false;
function setPageInfo(k){for(const [g,items] of SET_GROUPS){const it=items.find(x=>x[0]===k);if(it)return {group:g,key:k,label:it[1],sub:it[2]};}return null;}
function setOffCount(k){if(!farmData||!SET_SEC[k])return 0;const keys=new Set(FS_ITEMS.filter(i=>i.sec===SET_SEC[k]).map(i=>i.key));return farmSettingsNotNormal().filter(o=>keys.has(o.key)).length;}
// words each page answers to in the search box (its name, its group and the settings on it)
function setKeywords(k){const p=setPageInfo(k);let w=[p.label,p.group,p.sub];if(SET_SEC[k])w=w.concat(FS_ITEMS.filter(i=>i.sec===SET_SEC[k]).map(i=>i.label+' '+(i.hint||'')));
  const extra={notify:'notifications push phone quiet hours your day reminder crew alerts test',appearance:'display theme dark light text size font units kg tonnes feed batch labels icons',calendar:'opening view month day agenda board',weather:'weather location units forecast',workers:'crew farm password joined invite',backup:'backup restore export import excel pdf csv checklist report download',profile:'farm name manager silo numbers',security:'password lock unlock devices sign out crew',pairs:'scale mortality morts shed',sync:'cloud folder disconnect switch farm sync now download excel',batches:'farm history past batch results',alerts:'notifications reminders overdue reports silos shed performance empty shed close',about:'version credits'}[k]||'';
  return (w.join(' ')+' '+extra).toLowerCase();}
function setPageBody(k){
  if(!farmData&&SET_NEEDS_BATCH.includes(k))return `<div class="st2-empty">Load or start a batch to see these settings.</div>`;
  if(k==='profile')return `<div id="accBody">${accProfileHtml()}</div>`;
  if(k==='security')return `<div id="accBody">${accSecurityHtml()}</div>`;
  if(SET_SEC[k])return renderFarmSettingsView(true,SET_SEC[k])+(k==='weights'?settingsGrowthStdHtml():'')+(k==='pickups'?settingsPickupExtrasHtml():'');
  if(k==='pairs')return settingsPairsHtml();
  if(k==='sync')return `<div class="set-cards">${settingsCloudFolderHtml()}${renderSettingsSyncCard()}</div>`;
  if(k==='batches')return `<div class="set-cards">${setBatchListHtml()}${renderSettingsFarmHistoryCard()}</div>`;
  if(k==='alerts')return `<div class="set-cards">${renderSettingsNotificationsCard()}</div>`;
  if(k==='notify')return pnHtml();
  if(k==='display')return `<div class="set-cards">${renderSettingsUnitsCard()}</div>`;
  if(k==='data')return `<div class="set-cards">${renderSettingsDataCard()}${renderSettingsReportsCard()}</div>`;
  return `<div class="st2-about"><b>ProdWise.VM</b><span>Production · Tasks · Crew</span><span id="st2Ver">App version …</span><span class="settings-credit">Made by Von Mangaron · Personal use only · Not for commercial use</span></div>`;
}
function setNavHtml(){
  const q=setSearch.trim().toLowerCase();
  const mgr=(typeof fpManagerNow==='function'&&fpManagerNow())||'';
  const ini=(mgr||displayFarmName()||'?').split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase();
  let wn=0;try{wn=(cwFrame&&cwFrame.contentWindow&&cwFrame.contentWindow.__cwWorkersCount)||0;}catch(e){}
  const groups=SET_GROUPS.map(([g,items])=>{const vis=items.filter(([k])=>!q||setKeywords(k).includes(q));if(!vis.length)return '';
    return `<div class="st2-grp"><span class="st2-k">${escapeHtml(g)}</span>${vis.map(([k,l])=>{const off=setOffCount(k),sec=k==='security'&&typeof accInfo!=='undefined'&&accInfo&&accInfo.setup,bd=off||(k==='workers'?wn:0);
      return `<button type="button" class="st2-it${k===setTab?' on':''}" data-set-tab="${k}"${k===setTab?' aria-current="page"':''}><span>${escapeHtml(l)}</span>${bd?`<span class="st2-bd"${off?` title="${off} not at normal"`:''}>${bd}</span>`:sec?'<span class="st2-dot" title="Passwords on"></span>':''}</button>`;}).join('')}</div>`;}).join('');
  return `<div class="st2-who"><span class="st2-av">${escapeHtml(ini)}</span><div><b>${escapeHtml(mgr||'Manager')}</b><span>${escapeHtml(syncFarmName?'Manager · '+syncFarmName:'Not connected')}</span></div></div>
    ${groups||`<p class="st2-none">No setting matches “${escapeHtml(setSearch)}”.</p>`}`;
}
function renderSettingsPage(){
  if(SET_ALIAS[setTab])setTab=SET_ALIAS[setTab];
  if(!setPageInfo(setTab)||SET_TASKS_PAGES.includes(setTab))setTab='profile';
  const p=setPageInfo(setTab),off=setOffCount(setTab);
  const search=cls=>`<label class="st2-search ${cls}"><span aria-hidden="true">⌕</span><input type="search" placeholder="Search settings" value="${escapeAttr(setSearch)}" data-set-search aria-label="Search settings"><kbd>/</kbd></label>`;
  return `<div class="st2${setListOpen?' st2-list':''}">
    <div class="st2-hdr"><b>Settings</b>${search('st2-search-top')}</div>
    <aside class="st2-nav" aria-label="Settings menu">${search('st2-search-m')}<div class="st2-navlist">${setNavHtml()}</div></aside>
    <section class="st2-main">
      <button type="button" class="st2-back" data-set-back>‹ Settings</button>
      <div class="st2-top"><div class="st2-topt"><span class="st2-crumb">${escapeHtml(p.group)}</span>
      <h2 class="st2-title">${escapeHtml(p.label)}${off?`<span class="st2-nn">${off} not at normal</span>`:''}</h2>
      <p class="st2-sub">${escapeHtml(p.sub)}</p></div></div>
      ${setApplyBarHtml()}<div class="set-body st2-body set-${setTab}" id="setBody">${setPageBody(setTab)}</div>
    </section></div>`;
}
// The old drawer re-render calls (sync state, farm history, units…) refresh this page's tab instead
function renderSettingsTabBody(force){
  const b=document.getElementById('setBody');if(!b||activeTab!=='farmsettings')return;
  const ae=document.activeElement;
  if(!force&&ae&&b.contains(ae)&&/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName))return;
  b.innerHTML=setPageBody(setTab);afterSettingsRender();
}
function setShedScale(id,pct){
  const sh=farmData&&farmData.sheds.find(x=>String(x.id)===String(id));if(!sh)return;
  sh.scaleOverride=pct==null?null:Math.max(MIN_BIAS_FACTOR,Math.min(MAX_BIAS_FACTOR,Number(pct)/100));
  saveState();schedulePush();render();
  showToast(`Shed ${id}: scale correction ${pct==null?'back to farm-wide':Math.round(sh.scaleOverride*1000)/10+'%'} — forecast updated`);
}
document.addEventListener('change',e=>{
  const fc=e.target.closest&&e.target.closest('[data-set-frcage]');
  if(fc){const v=Number(fc.value);if(Number.isFinite(v)&&v>=25&&v<=60)sdSet('frCage',Math.round(v*2)/2);else renderSettingsTabBody(true);return;}
  const ug=e.target.closest&&e.target.closest('[data-set-useglobal]');
  if(ug){sdSetShed('scale',ug.dataset.setUseglobal,ug.checked?null:Math.round(currentBiasFactor()*1000)/10);return;}
  const sc=e.target.closest&&e.target.closest('[data-set-scale]');
  if(sc){const v=Number(sc.value);if(Number.isFinite(v)&&v>0)sdSetShed('scale',sc.dataset.setScale,Math.max(MIN_BIAS_FACTOR*100,Math.min(MAX_BIAS_FACTOR*100,v)));else renderSettingsTabBody(true);return;}
  const m=e.target.closest&&e.target.closest('[data-set-mortrate]');if(!m)return;
  const v=Number(m.value);if(!Number.isFinite(v)||v<0){renderSettingsTabBody(true);return;}
  sdSetShed('mort',m.dataset.setMortrate,Math.min(MAX_MORT_RATE_PCT,v));
});
function afterSettingsRender(){
  const v=document.getElementById('st2Ver');
  if(v&&!v.dataset.done&&'caches' in window)caches.keys().then(k=>{const n=k.find(x=>/^prodwise-v/.test(x));if(n){v.textContent='App version '+n.replace('prodwise-','');v.dataset.done='1';}}).catch(()=>{});
}
document.addEventListener('input',e=>{const t=e.target.closest&&e.target.closest('[data-set-search]');if(!t)return;setSearch=t.value;const l=document.querySelector('.st2-navlist');if(l)l.innerHTML=setNavHtml();});
document.addEventListener('keydown',e=>{
  if(activeTab!=='farmsettings')return;
  const t=e.target;
  if(e.key==='/'&&!/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)){const s=[...document.querySelectorAll('[data-set-search]')].find(x=>x.offsetParent);if(s){e.preventDefault();s.focus();}return;}
  if(e.key==='Enter'&&t.matches&&t.matches('[data-set-search]')){const first=document.querySelector('.st2-navlist [data-set-tab]');if(first)first.click();}
});
renderSettingsDrawerBody=function(){renderSettingsTabBody(false);};
toggleAdjCollapse=function(){const gm=/^g([1-4])$/.exec(activeTab);setPair=gm?Number(gm[1]):(predState.predGroup||setPair||1);adjModalOpen=false;adjDraft=null;goSettings('pairs');};
openSettingsDrawer=function(){goSettings(syncFarmName?null:'farm');};
function closeToolPages(){Object.keys(TOOL_PAGES).forEach(id=>{if(document.getElementById(id)?.classList.contains('open')){try{TOOL_PAGES[id].close();}catch(e){}}});}
document.addEventListener('DOMContentLoaded',()=>{
  setSidebarRail(false);   // the old collapse is replaced by the icon rail + panel
  buildPwRail();setPwPanel(pwPanel);
  const obs=new MutationObserver(muts=>{let changed=null;muts.forEach(m=>{if(m.target&&m.target.id&&TOOL_PAGES[m.target.id]&&m.target.classList.contains('open'))changed=m.target.id;});syncToolPages(changed);});
  // Each tool is a real section of the main area (after #app), shown in place of the page — not a window on top
  const app=document.getElementById('app');
  Object.keys(TOOL_PAGES).forEach(id=>{const m=document.getElementById(id);if(m){m.classList.add('tool-page');if(app&&app.parentElement)app.parentElement.insertBefore(m,app.nextSibling);obs.observe(m,{attributes:true,attributeFilter:['class']});}});
  const nav=document.getElementById('sidebarNav');if(nav)new MutationObserver(()=>syncToolPages(null)).observe(nav,{childList:true});
});
// Going anywhere else closes the tool page
document.addEventListener('click',e=>{
  if(e.target.closest('#sbRailBtn')){document.body.classList.add('sb-anim');setSidebarRail(!document.body.classList.contains('sb-rail'));clearTimeout(window.__sbAnimT);window.__sbAnimT=setTimeout(()=>document.body.classList.remove('sb-anim'),360);return;}
  if(!toolPageOpen)return;
  const nav=e.target.closest('[data-tab],#moreBtnMob,[data-batch-info],[data-alert-shed],[data-alert-feed],[data-mgr-feed]:not([data-mgr-compare]),[data-goto-shedgroup]');
  if(nav&&!e.target.closest('.compare-modal'))closeToolPages();
},true);

// ── Settings wait for Apply ──
// Every change on the Settings page is a draft until Apply (Discard puts it back). Pickup entries
// and target pickup numbers still save as you type. The Predictions numbers have their own Save.
let setDraft=null;   // {std, frCage, npd:[days], scale:{shed:pct|null}, mort:{shed:pct}, notif:{key:bool}, unit}
function sdStd(){return setDraft&&setDraft.std!=null?setDraft.std:growthStd();}
function sdFrCage(){return setDraft&&setDraft.frCage!=null?setDraft.frCage:frCageTarget();}
function sdScaleNow(sh){return (sh.scaleOverride!=null&&Number(sh.scaleOverride)>0)?Math.round(Number(sh.scaleOverride)*1000)/10:null;}
function sdScale(sh){const k=String(sh.id);return setDraft&&setDraft.scale&&k in setDraft.scale?setDraft.scale[k]:sdScaleNow(sh);}
function sdMort(sh){const k=String(sh.id);return setDraft&&setDraft.mort&&k in setDraft.mort?setDraft.mort[k]:shedMortRate(sh);}
function sdNotif(k){return setDraft&&setDraft.notif&&k in setDraft.notif?setDraft.notif[k]:!!notifPrefs[k];}
function sdUnit(){return setDraft&&setDraft.unit?setDraft.unit:feedUnit();}
function sdTouch(){if(!setDraft)setDraft={scale:{},mort:{},notif:{}};return setDraft;}
// What's different from what's saved, as short lines for the bar
function sdChanges(){
  const d=setDraft;if(!d)return [];const out=[];
  if(d.std!=null&&d.std!==growthStd())out.push(d.std==='ross'?'Growth standard: Ross 308':'Growth standard: free range');
  if(d.frCage!=null&&d.frCage!==frCageTarget())out.push(`Free range 2.45 kg at day ${d.frCage}`);
  if(d.npd){const a=[...d.npd].sort().join(),b=[...(predState.noPickupDays||[])].sort().join();if(a!==b)out.push('No-pickup days');}
  if(farmData){
    Object.keys(d.scale||{}).forEach(id=>{const sh=farmData.sheds.find(s=>String(s.id)===id);if(sh&&d.scale[id]!==sdScaleNow(sh))out.push(`Shed ${id} scale ${d.scale[id]==null?'farm-wide':d.scale[id]+'%'}`);});
    Object.keys(d.mort||{}).forEach(id=>{const sh=farmData.sheds.find(s=>String(s.id)===id);if(sh&&Math.abs(d.mort[id]-shedMortRate(sh))>1e-9)out.push(`Shed ${id} daily morts ${d.mort[id].toFixed(2)}%`);});
  }
  Object.keys(d.notif||{}).forEach(k=>{if(d.notif[k]!==!!notifPrefs[k])out.push(`${k==='feedBalance'?'Feed balance':k==='emptyShed'?'Empty shed':'Shed performance'} alerts ${d.notif[k]?'on':'off'}`);});
  if(d.unit&&d.unit!==feedUnit())out.push(`Feed in ${d.unit==='t'?'tonnes':'kg'}`);
  return out;
}
function setApplyBarHtml(){
  const ch=sdChanges();if(!ch.length)return '<div class="set-apply" id="setApply" hidden></div>';
  return `<div class="set-apply" id="setApply" role="region" aria-label="Unapplied changes"><div class="set-apply-txt"><b>${ch.length} change${ch.length===1?'':'s'} not applied</b><span>${escapeHtml(ch.join(' · '))}</span></div><button type="button" class="set-btn" data-set-discard>Discard</button><button type="button" class="set-btn primary" data-set-apply>Apply</button></div>`;
}
function sdRefresh(){renderSettingsTabBody(true);const bar=document.getElementById('setApply');if(bar)bar.outerHTML=setApplyBarHtml();}
function sdSet(k,v){sdTouch()[k]=v;sdRefresh();}
function sdSetShed(kind,id,v){sdTouch()[kind][String(id)]=v;sdRefresh();}
function sdApply(){
  const d=setDraft;if(!d)return;const chList=sdChanges(),n=chList.length;
  if(d.std!=null)predState.growthStd=d.std;
  if(d.frCage!=null)predState.frCage=d.frCage;
  if(d.npd)predState.noPickupDays=[...d.npd].sort((a,b)=>a-b);
  if(farmData){
    Object.keys(d.scale||{}).forEach(id=>{const sh=farmData.sheds.find(s=>String(s.id)===id);if(sh)sh.scaleOverride=d.scale[id]==null?null:Math.max(MIN_BIAS_FACTOR,Math.min(MAX_BIAS_FACTOR,Number(d.scale[id])/100));});
    Object.keys(d.mort||{}).forEach(id=>setShedMortRate(Number(id),d.mort[id]));
  }
  Object.keys(d.notif||{}).forEach(k=>setNotifPref(k,d.notif[k]));
  const unitChanged=d.unit&&d.unit!==feedUnit();if(unitChanged)setFeedUnit(d.unit);
  if(n)pwActivity('settings',chList.join(' · '));
  setDraft=null;gompertzCache=new Map();
  savePredState();saveState();schedulePush();render();if(unitChanged)refreshLoadsViews();
  showToast(n?`${n} change${n===1?'':'s'} applied — forecast updated.`:'Nothing to apply.');
}
function sdDiscard(){setDraft=null;render();showToast('Changes discarded.');}
// Leaving Settings with changes not applied: ask first
function sdLeaving(){
  if(!sdChanges().length){setDraft=null;return true;}
  if(confirm('You have settings changes that aren\'t applied yet.\n\nOK = discard them and leave. Cancel = stay and Apply.')){setDraft=null;return true;}
  return false;
}
// Runs before the app's own click handlers (capture), so Settings controls go to the draft
document.addEventListener('click',e=>{
  if(activeTab!=='farmsettings')return;
  const t=e.target;
  if(t.closest('[data-set-apply]')){e.stopPropagation();sdApply();return;}
  if(t.closest('[data-set-discard]')){e.stopPropagation();sdDiscard();return;}
  const inBody=t.closest('#setBody');
  if(inBody){
    const npd=t.closest('[data-npd]');
    if(npd){e.stopPropagation();const x=Number(npd.dataset.npd);const cur=(setDraft&&setDraft.npd)||[...(predState.noPickupDays||[])];sdSet('npd',cur.includes(x)?cur.filter(y=>y!==x):[...cur,x]);return;}
    const u=t.closest('[data-feed-unit]');
    if(u){e.stopPropagation();sdSet('unit',u.dataset.feedUnit);return;}
    return;
  }
  // anything that leaves the Settings page
  const nav=t.closest('[data-tab],[data-pw-panel],[data-pwm]:not([data-pwm="theme"]),.mob-nav-btn,.sb-link,.more-row,[data-goto-shedgroup],#sbFarm,.pwr-logo,[data-pw-goset]');
  if(nav&&sdChanges().length&&!nav.closest('.set-tabs')){
    // the Settings button, or the open panel's own button (that only closes the panel), don't leave
    if(nav.matches('[data-pwm="settings"]')||(nav.matches('[data-pw-panel]')&&nav.dataset.pwPanel===pwPanel))return;
    if(!sdLeaving()){e.stopPropagation();e.preventDefault();}
  }else if(nav)setDraft=null;
},true);
document.addEventListener('change',e=>{
  if(activeTab!=='farmsettings'||!e.target.closest||!e.target.closest('#setBody'))return;
  const id=e.target.id;
  if(id==='notifShedPerf'||id==='notifFeedBalance'){e.stopPropagation();sdTouch().notif[id==='notifShedPerf'?'shedPerformance':'feedBalance']=e.target.checked;sdRefresh();}
},true);
window.addEventListener('beforeunload',e=>{if(activeTab==='farmsettings'&&sdChanges().length){e.preventDefault();e.returnValue='';}});

// ── Account menu (2026-10-18): the avatar at the bottom of the rail opens a short menu, like Claude's —
// Profile, Settings, Theme (one theme for Production and Tasks), Batch, then Switch farm.
function pwMenuHtml(){
  const mgr=(typeof fpManagerNow==='function'&&fpManagerNow())||'';
  const name=String(displayFarmName()||'').trim()||'This device';
  const ini=(name.split(/\s+/).map(w=>w[0]).join('').slice(0,2)||'F').toUpperCase();
  const dark=document.body.classList.contains('theme-dark');
  const off=typeof farmSettingsNotNormal==='function'&&farmData?farmSettingsNotNormal().length:0;
  return `<div class="pwm-head"><span class="pwm-av">${escapeHtml(ini)}</span><div><b>${escapeHtml(name)}</b><span>${escapeHtml(syncFarmName?(mgr?mgr+' · ':'')+syncFarmName:'Not connected')}</span></div></div>
    <button type="button" role="menuitem" data-pwm="profile">Profile</button>
    <button type="button" role="menuitem" data-pwm="settings">Settings${off?`<span class="pwm-bd" title="${off} not at normal">${off}</span>`:''}</button>
    <div class="pwm-theme" data-pwm="theme"><span>Theme</span><span class="pwm-seg" role="group" aria-label="Theme"><button type="button" data-pwm-th="light" aria-pressed="${!dark}" class="${dark?'':'on'}">Light</button><button type="button" data-pwm-th="dark" aria-pressed="${dark}" class="${dark?'on':''}">Dark</button></span></div>
    <button type="button" role="menuitem" data-pwm="batch">Batch list</button>
    ${document.body.classList.contains('pw-onerail')?'<button type="button" role="menuitem" data-pwm="tasksettings">Tasks settings</button>':''}
    <hr>
    <button type="button" role="menuitem" data-pwm="switch">${syncFarmName?'Switch farm':'Connect farm'}</button>`;
}
function pwMenuToggle(force){
  let m=document.getElementById('pwMenu');
  const open=force!=null?force:!(m&&!m.hidden);
  if(!m){m=document.createElement('div');m.id='pwMenu';m.className='pwm';m.setAttribute('role','menu');m.hidden=true;document.body.appendChild(m);}
  if(open)m.innerHTML=pwMenuHtml();
  m.hidden=!open;
  // like Claude: the menu opens just above the account button, lined up with the rail's edge
  const ab=document.querySelector('[data-pwr-farm]');
  if(open&&ab){const r=ab.getBoundingClientRect();m.style.left=Math.max(8,r.left)+'px';m.style.bottom=Math.max(8,window.innerHeight-r.top+6)+'px';}
  const b=document.querySelector('[data-pwr-farm]');if(b)b.setAttribute('aria-expanded',String(open));
  if(open){const f=m.querySelector('[data-pwm]');if(f&&f.focus)f.focus({preventScroll:true});}
}
// a click inside the Tasks frame never reaches this page, but it takes focus away — close the menu then
window.addEventListener('blur',()=>{const m=document.getElementById('pwMenu');if(m&&!m.hidden&&document.activeElement&&document.activeElement.id==='cwFrame')pwMenuToggle(false);});
document.addEventListener('click',e=>{
  const m=document.getElementById('pwMenu');if(!m||m.hidden)return;
  const th=e.target.closest('[data-pwm-th]');
  if(th){setTheme(th.dataset.pwmTh);m.innerHTML=pwMenuHtml();syncPwRail();return;}
  const it=e.target.closest('[data-pwm]');
  if(it&&it.dataset.pwm!=='theme'){
    pwMenuToggle(false);const k=it.dataset.pwm;
    if(k==='tasksettings'){pwTasksGo('settings');return;}
    if(typeof openProductionSection==='function')openProductionSection();
    if(k==='profile')goAccount('profile');
    else if(k==='settings')goSettings(setTab&&setTab!=='profile'&&setTab!=='security'?setTab:'feed');
    else if(k==='batch')goSettings('batches');
    else if(k==='switch'){openSyncModal();if(syncFarmName)showConnectForm('Enter the farm name to switch to.');}
    return;}
  if(!e.target.closest('#pwMenu')&&!e.target.closest('[data-pwr-farm]'))pwMenuToggle(false);
});
document.addEventListener('keydown',e=>{const m=document.getElementById('pwMenu');if(e.key==='Escape'&&m&&!m.hidden){pwMenuToggle(false);const b=document.querySelector('[data-pwr-farm]');if(b)b.focus();}});
// Side panels act like menus (2026-10-19): picking a page in Batch, Sheds or Tools opens it and folds
// the panel back to the icon rail, and so does a click anywhere on the page. Rows that only expand a
// list (Predictions), the panel's own empty space and the icon rail keep it open.
document.addEventListener('click',e=>{
  if(pwPanel==='none'||!window.matchMedia('(min-width:769px)').matches||!e.target.closest)return;
  if(e.target.closest('#pwRail'))return;
  if(e.target.closest('#sidebar')){
    const it=e.target.closest('#sidebar button,#sidebar a[href],#sidebar [role="button"]');
    if(!it||it.matches('[data-sb-pred]')||it.closest('.sb-foot'))return;
  }
  setTimeout(()=>{if(pwPanel!=='none')setPwPanel('none',true);},0);
});

// ── Batches & history: every batch of this farm as a list, 5 a page (2026-10-19) ──
let setBatchList=null,setBatchListFarm='',setBatchListPage=0,setBatchListErr='',setBatchListBusy=false;
async function loadSetBatchList(force){
  if(!syncFarmName||setBatchListBusy)return;
  if(!force&&setBatchList&&setBatchListFarm===syncFarmName)return;
  setBatchListBusy=true;setBatchListErr='';
  try{
    const res=await fetch(buildListingUrl(syncFarmName));
    if(!res.ok)throw new Error('The server said '+res.status+'.');
    const j=await res.json();const out=[];
    for(const f of (j&&Array.isArray(j.files)?j.files:[])){const info=parseBatchFileInfo(syncFarmName,f.name);if(info)out.push({...info,size:f.size});}
    // newest first; the original (unnumbered) file last
    out.sort((a,b)=>a.isLegacy!==b.isLegacy?(a.isLegacy?1:-1):compareBatchKeys(a.batchKey,b.batchKey));
    setBatchList=out;setBatchListFarm=syncFarmName;setBatchListPage=0;
  }catch(e){setBatchListErr=navigator.onLine?'Could not load the batches. Check your connection and try again.':'You are offline — the list loads when you are back online.';}
  setBatchListBusy=false;
  const el=document.getElementById('stBatchList');if(el)el.outerHTML=setBatchListHtml();
}
function setBatchListHtml(){
  const head=`<div class="st2-sec" id="stBatchList"><span class="st2-seck">Batches${setBatchList&&setBatchListFarm===syncFarmName?` · ${setBatchList.length}`:''}</span>`;
  if(!syncFarmName)return head+`<div class="st2-box"><div class="st2-row"><div class="st2-rt"><b>Not connected</b><span>Connect to a farm to see its batches.</span></div><div class="st2-ctl"><button type="button" class="set-btn" data-pf-switch>Connect farm</button></div></div></div></div>`;
  if(!setBatchList||setBatchListFarm!==syncFarmName){
    if(!setBatchListBusy&&!setBatchListErr)setTimeout(()=>loadSetBatchList(false),0);
    return head+`<div class="st2-box"><div class="st2-row"><div class="st2-rt"><b>${setBatchListErr?'Batches not loaded':'Loading batches…'}</b><span>${escapeHtml(setBatchListErr||'From the cloud for '+syncFarmName)}</span></div>${setBatchListErr?'<div class="st2-ctl"><button type="button" class="set-btn" data-bl-reload>Try again</button></div>':''}</div></div></div>`;
  }
  const all=setBatchList,per=BATCHES_PER_PAGE,pages=Math.max(1,Math.ceil(all.length/per));
  setBatchListPage=Math.max(0,Math.min(pages-1,setBatchListPage));
  if(!all.length)return head+`<div class="st2-box"><div class="st2-row"><div class="st2-rt"><b>No batches yet</b><span>Batches appear here once they are saved to the cloud.</span></div></div></div></div>`;
  const cur=currentBatchKey();
  const isOpenB=p=>p.batchKey===cur||(p.isLegacy&&!cur);
  all.sort((a,b)=>(isOpenB(b)?1:0)-(isOpenB(a)?1:0));
  const rows=all.slice(setBatchListPage*per,setBatchListPage*per+per).map(p=>{
    const isCur=p.batchKey===cur||(p.isLegacy&&!cur);
    const meta=[p.isLegacy?'Original file':'',typeof fmtBytes==='function'?fmtBytes(p.size):''].filter(Boolean).join(' · ');
    return `<div class="st2-row${isCur?' st2-bl-cur':''}"><div class="st2-rt"><b>${escapeHtml(p.label)}${isCur?' <span class="st2-chip ok st2-active">Active</span>':''}</b><span>${escapeHtml(meta||'Saved in the cloud')}</span></div><div class="st2-ctl">${isCur?'':`<button type="button" class="set-btn" data-bl-open="${escapeAttr(p.batchKey)}" title="Saves your current work first, then opens this batch">Open</button>`}</div></div>`;}).join('');
  const nums=[];for(let i=0;i<pages;i++)nums.push(`<button type="button" class="st2-pg${i===setBatchListPage?' on':''}" data-bl-page="${i}"${i===setBatchListPage?' aria-current="page"':''} aria-label="Page ${i+1}">${i+1}</button>`);
  const pager=pages>1?`<nav class="st2-pager" aria-label="Batch pages"><button type="button" class="st2-pg" data-bl-page="${setBatchListPage-1}" ${setBatchListPage===0?'disabled':''} aria-label="Previous page">‹</button>${nums.join('')}<button type="button" class="st2-pg" data-bl-page="${setBatchListPage+1}" ${setBatchListPage>=pages-1?'disabled':''} aria-label="Next page">›</button></nav>`:'';
  return head+`<div class="st2-box">${rows}</div>${pager}<p class="st2-muted">Opening a batch saves your current work first. <button type="button" class="set-link" data-bl-reload>Refresh the list</button></p></div>`;
}
document.addEventListener('click',e=>{
  const pg=e.target.closest('[data-bl-page]');if(pg&&!pg.disabled){setBatchListPage=Number(pg.dataset.blPage)||0;const el=document.getElementById('stBatchList');if(el)el.outerHTML=setBatchListHtml();return;}
  const op=e.target.closest('[data-bl-open]');if(op){openPastBatch(op.dataset.blOpen);return;}
  if(e.target.closest('[data-bl-reload]')){setBatchListErr='';loadSetBatchList(true);const el=document.getElementById('stBatchList');if(el)el.outerHTML=setBatchListHtml();}
});

// Text size (2026-10-19): one setting for Production and Tasks (Settings › Display), saved on this device
const PW_TEXT_KEY='prodwise_text_size_v1';
function pwApplyTextSize(v){if(!/^(small|medium|large)$/.test(v||''))v='medium';['small','large'].forEach(k=>document.body.classList.toggle('pw-text-'+k,v===k));}
document.addEventListener('DOMContentLoaded',()=>{try{pwApplyTextSize(localStorage.getItem(PW_TEXT_KEY));}catch(e){}});
window.addEventListener('storage',e=>{if(e.key===PW_TEXT_KEY)pwApplyTextSize(e.newValue);});
// One backup with Tasks (2026-10-19): Tasks' Backup & reports page asks for Production's half and restores it here
function pwBackupPayload(){if(!farmData)return null;const p=buildCloudPayload();p.exportedAt=new Date().toISOString();p.exportedBy='ProdWise.VM';return p;}
async function pwRestorePayload(payload,name){
  if(!payload||typeof payload!=='object'||!payload.farmData||!Array.isArray(payload.farmData.sheds))return false;
  if(payload.app&&payload.app!==SYNC_APP_TAG)return false;
  try{await historyAutoSnapshot('auto-import','Before restoring '+(name||'a backup'));}catch(e){}
  if(!applyCloudPayload(payload,{isFirstPull:true}))return false;
  saveState();saveSiloData();saveFarmLoads();savePredState();saveShedViews();schedulePush();render();
  return true;
}
// Production's own changes for History (settings applied here), kept on this device per farm
function pwActivityKey(){return 'pw-activity-'+(syncFarmName?sanitizeUserFarmName(syncFarmName):'local');}
function pwActivityList(){try{const v=JSON.parse(localStorage.getItem(pwActivityKey())||'[]');return Array.isArray(v)?v:[];}catch(e){return [];}}
function pwActivity(kind,text){if(!text)return;try{const l=pwActivityList();l.unshift({ts:Date.now(),kind,text});localStorage.setItem(pwActivityKey(),JSON.stringify(l.slice(0,300)));}catch(e){}}


// ── Morning briefing facts (2026-10-25, mockup LMSt4FmdcpzDnTEmqcjB4W). The Home card was removed the same day —
// the facts now feed the AI morning greeting and ✨ Ask (js/ask.js). Originally: a few lines on Home that put the day together —
// Today · Watch · Feed · Changeover & prep. Fixed rules on numbers both apps already work out: no AI, no cost,
// works offline. Tasks, shed prep and weather come from the Tasks app (window.__cwBrief in the Tasks frame).
// Dots: r act today · a keep an eye on · b just so you know · g fine. Tap a line to open its page.
let mgrBriefFold=false;try{mgrBriefFold=localStorage.getItem('pw-brief-fold')==='1';}catch(e){}
let mgrBriefAsked=false;
// Closed shed whose prep Tasks signed off (Mark ready): show it as ready for chicks, not just closed (2026-10-29)
function pwPrepReady(id){const cw=mgrBriefCw();return !!(cw&&Array.isArray(cw.prepReady)&&cw.prepReady.includes(String(id)));}
function csChipHtml(id){return pwPrepReady(id)?'<span class="cs-chip rdy" title="Shed prep signed off in Tasks">✓ Ready for chicks</span>':'<span class="cs-chip">Closed</span>';}
function mgrBriefCw(){try{const w=cwFrame&&cwFrame.contentWindow;return w&&typeof w.__cwBrief==='function'?w.__cwBrief():null;}catch(e){return null;}}
function mgrBriefData(){
  const today=mgrToday(),days=mgrWeekDays(),cw=mgrBriefCw();
  if(!cw&&!mgrBriefAsked&&syncFarmName&&typeof pwEnsureTasksFrame==='function'){mgrBriefAsked=true;pwEnsureTasksFrame(()=>mgrBriefRefresh());}
  // job: something the manager can do today (feed, tasks, records, prep) — only these go on Cluck's Today's plan;
  // growth, mortality % and weather are watch items: shown, never a job (2026-10-29)
  const L=(tone,html,act,job)=>({tone,html,act:act||'',job:!!job});
  const G={today:[],watch:[],feed:[],co:[]};
  // Feed off before the catch (js/feedoff.js): first thing today, a heads-up the day before
  if(typeof foToday==='function'){const fo=foToday(),ft=foTomorrow();
    if(fo&&!fo.done)G.today.push(L('r',`<b>Feed off today · ${escapeHtml(foLabel(fo.sheds))}</b> · catch tonight, kill sheet ${escapeHtml(foDay(fo.kill))}`,'',true));
    else if(fo&&fo.done)G.today.push(L('g',`Feed off · ${escapeHtml(foLabel(fo.sheds))} · done`));
    if(ft&&!ft.done)G.today.push(L('a',`<b>Feed off tomorrow morning · ${escapeHtml(foLabel(ft.sheds))}</b> · kill sheet ${escapeHtml(foDay(ft.kill))}`,'',true));}
  // Today
  const d0=days[0];
  d0.pick.forEach(p=>G.today.push(L('r',p.final?`<b>Final pickup · Shed ${p.shed}</b> · clean-out`:`<b>Pickup Shed ${p.shed}</b> · about ${p.birds.toLocaleString('en-US')} birds${p.planned?' (planned)':''}`,'data-mgr-pickups')));
  if(d0.loads.length){const kg=d0.loads.reduce((n,l)=>n+(l.actualKg!=null?Number(l.actualKg)||0:Number(l.plannedKg)||0),0);
    G.today.push(L('b',`<b>Feed ${d0.loads.length>1?d0.loads.length+' loads':'load'}</b> arriving today · ${mgrT(kg)}`,'data-mgr-loads'));}
  if(cw){
    if(cw.overdue.length)G.today.push(L('r',`<b>${cw.overdue.length} task${cw.overdue.length===1?'':'s'} overdue</b> · ${escapeHtml(cw.overdue.slice(0,2).join(', '))}${cw.overdue.length>2?' …':''}`,'data-brief-cw="overdue"',true));
    if(cw.today)G.today.push(L(cw.done===cw.today?'g':'b',`${cw.today} task${cw.today===1?'':'s'} today · ${cw.done===cw.today?'all done':cw.done+' done'}`,'data-brief-cw="today"'));
  }
  // Records the manager has to keep up
  const lateM=mgrPlaced().filter(s=>{if(s.closed)return false;const c=s.cleanoutDate?dateOnly(s.cleanoutDate):null;if(c&&c<today)return false;if(dateOnly(s.placementDate)>today)return false;const u=s.mortalityUpdatedAt?dateOnly(s.mortalityUpdatedAt):null;return !u||mgrDays(u,today)>=2;});
  if(lateM.length){const dd=lateM.map(s=>s.mortalityUpdatedAt?mgrDays(dateOnly(s.mortalityUpdatedAt),today):null),mx=dd.some(x=>x==null)?null:Math.max(...dd);
    G.today.push(L(mx==null||mx>=3?'r':'a',`<b>Mortality not entered</b> · Shed${lateM.length===1?'':'s'} ${lateM.map(s=>s.id).join(', ')}${mx!=null?' · last '+mx+' days ago':''}`,'data-mgr-mort',true));}
  const est=mgrPlaced().reduce((n,s)=>n+(s.pickups||[]).filter(p=>p.date&&dateOnly(p.date)<today&&p.weightEstimated).length,0);
  if(est)G.today.push(L('a',`<b>${est} kill sheet${est===1?'':'s'}</b> still to enter · pickup weights are estimates`,'data-mgr-pickups',true));
  // Watch: growth, mortality, weather
  const live=mgrPlaced().filter(s=>!s.closed&&!(s.cleanoutDate&&dateOnly(s.cleanoutDate)<today));
  live.forEach(s=>{const age=ageInDays(s,today);if(age<=0)return;let f=null;try{f=typeof currentShedWeightEstimate==='function'?currentShedWeightEstimate(s,today):null;}catch(e){}
    if(!f||f.kg==null)return;const dv=daysVsTarget(age,f.kg);if(dv==null)return;
    if(daysBehindSeverity(dv)==='bad')G.watch.push(L('a',`<b>Shed ${s.id}</b> is ${(-dv).toFixed(1)} days behind target weight`,`data-brief-pair="${Math.ceil(s.id/2)}:${s.id}"`));});
  const placed=mgrPlaced().reduce((n,s)=>n+(Number(s.initialPopulation)||0),0),mortAll=mgrPlaced().reduce((n,s)=>n+Math.max(0,Number(s.mortality)||0),0);
  const avg=placed?mortAll/placed*100:0;
  live.forEach(s=>{const pop=Number(s.initialPopulation)||0;if(!pop)return;const pc=Math.max(0,Number(s.mortality)||0)/pop*100;
    if(avg>0&&pc>avg*1.4&&pc-avg>=0.3)G.watch.push(L('a',`<b>Shed ${s.id}</b> mortality ${pc.toFixed(1)}% — above the farm average (${avg.toFixed(1)}%)`,'data-mgr-mort'));});
  if(cw&&cw.wx){const w=cw.wx,hot=w.max!=null&&w.max>=(w.f?90:32);
    w.alerts.forEach(a=>G.watch.push(L('a',`<b>${escapeHtml(a)}</b> today · ${escapeHtml(w.maxT)} / ${escapeHtml(w.minT)}${/heat/i.test(a)?' — check ventilation and water':''}`)));
    if(hot&&!w.alerts.some(a=>/heat/i.test(a)))G.watch.push(L('a',`<b>Hot day</b> · ${escapeHtml(w.maxT)} — check ventilation and water`));}
  // Feed
  let silos=[];try{silos=mgrSiloOutlook();}catch(e){}
  if(typeof pairAllClosed==='function')silos=silos.filter(x=>!pairAllClosed(x.g));
  silos.filter(x=>x.dep&&x.days<=7).forEach(x=>{const when=`${x.days<=1?mgrWhen(x.dep).toLowerCase():mgrWhen(x.dep)}${x.days>1?' (in '+x.days+' days)':''}`;
    if(!x.feeding.length)G.feed.push(L('b',`<b>${escapeHtml(pairLabel(x.g))}</b> silos run down ${when} · birds out for clean-out, no load needed`,`data-tab="g${x.g}"`));
    else G.feed.push(L(x.days<=3?'r':'a',`<b>${escapeHtml(pairLabel(x.g))}</b> silos run low ${when} · book a load for ${escapeHtml(mgrFeedingLabel(x))}${x.feeding.length<shedsForGroup(x.g).filter(s=>s.placementDate&&!s.closed).length?' (the other shed cleans out first)':''}`,`data-tab="g${x.g}"`,true));});
  silos.filter(x=>!x.reading||x.readAge>=(typeof FEED_READING_STALE_DAYS!=='undefined'?FEED_READING_STALE_DAYS:3)).forEach(x=>G.feed.push(L('a',`<b>Read the silos · ${escapeHtml(pairLabel(x.g))}</b> · ${x.reading?'last reading '+x.readAge+' days ago':'no reading this batch'}`,'data-mgr-silo',true)));
  let sum=null;try{sum=farmLoadsSummary();}catch(e){}
  if(sum&&sum.needsActual>0)G.feed.push(L('a',`<b>${sum.needsActual} load${sum.needsActual===1?'':'s'}</b> still need${sum.needsActual===1?'s':''} the docket weight`,'data-mgr-loads',true));
  if(!G.feed.length&&silos.length){const nx=silos.filter(x=>x.dep).sort((a,b)=>a.dep-b.dep)[0];
    G.feed.push(L('g',nx?`Every silo covered to ${fmtShortNoYear(nx.dep)}`:'Every silo covered for the next 60 days','data-mgr-loads'));}
  // Changeover & prep
  mgrPlaced().forEach(s=>{if(s.closed||!s.cleanoutDate)return;const n=mgrDays(today,dateOnly(s.cleanoutDate));
    if(n===0||n===1)G.co.push(L('b',`<b>Shed ${s.id}</b> cleans out ${n===0?'today':'tomorrow'}`,`data-brief-pair="${Math.ceil(s.id/2)}:${s.id}"`));});
  try{const rl=typeof pwRunningList==='function'?pwRunningList():[];if(rl.length>1){const nu=rl[rl.length-1];
    (nu.rows||[]).forEach(r=>{if(!r.place)return;const n=mgrDays(today,dateOnly(r.place));if(n>=0&&n<=3)G.co.push(L('b',`<b>Shed ${r.id}</b> chicks arrive ${n===0?'today':n===1?'tomorrow':fmtShortNoYear(r.place)} (${escapeHtml(nu.key)})`));});}}catch(e){}
  // Shed prep not marked ready a day after the chicks went in (2026-10-29)
  (cw&&cw.prepLate||[]).forEach(x=>{const dd=mgrDays(dateOnly(new Date(x.placed+'T00:00:00')),today);
    G.co.push(L('r',`<b>Shed ${escapeHtml(x.shed)} prep not marked ready</b> · chicks${x.batch?' for '+escapeHtml(String(x.batch)):''} in since ${fmtShortNoYear(new Date(x.placed+'T00:00:00'))}${dd>0?' ('+dd+' day'+(dd===1?'':'s')+')':''} · ${x.left} job${x.left===1?'':'s'} still open — finish them or mark it ready`,'data-brief-cw="prep"',true));});
  // Next batch's Starter (2026-10-29): starter silo must be empty for it, and the Starter must be on order
  try{const nb=(typeof pwRunOthers!=='undefined'&&Array.isArray(pwRunOthers)?pwRunOthers:[]).find(o=>o&&o.newest&&String(o.key).toLowerCase()!==String(currentBatchKey()||'').toLowerCase());
    [1,2,3,4].forEach(g=>{if(typeof starterSiloStatus!=='function')return;const st=starterSiloStatus(g);if(!st)return;const P=pairLabel(g),co=fmtShortNoYear(st.co);
      const sn=st.silo?siloNumber(g,st.silo):null;
      if(st.inWin&&st.state==='pick')G.co.push(L('a',`<b>${P}</b> · choose the starter silo for the next batch (clean-out ${co})`,`data-tab="g${g}"`,true));
      else if(st.inWin&&st.state==='action')G.co.push(L(st.late?'r':'a',`<b>${P}</b> · starter silo ${sn} still holds ${(st.kg/1000).toFixed(1)} t — ${st.late?'open it now':'open it by '+fmtShortNoYear(st.openBy)} so it is empty by clean-out (${co})`,`data-tab="g${g}"`,true));
      (st.inWin?st.wrong||[]:[]).forEach(l=>G.co.push(L('a',`<b>${P}</b> · move the ${fmtShortNoYear(l.date)} ${escapeHtml(feedTypeLabel(l.feedType))} load out of starter silo ${sn} — keep it for the next batch`,`data-tab="g${g}"`,true)));
      if(nb&&st.daysToCo<=21&&!(nb.starter||[]).some(l=>Number(l.splitKg&&l.splitKg[g])>0))
        G.co.push(L(st.daysToCo<=7?'r':'a',`<b>${P}</b> · no Starter ordered yet for batch ${escapeHtml(String(nb.key))} — clean-out ${co}`,'data-mgr-loads',true));});}catch(e){}
  if(cw&&cw.prep){const p=cw.prep,left=p.total-p.done,dn=p.chicks?mgrDays(today,dateOnly(p.chicks)):null;
    const sh=p.sheds.length>2&&p.sheds.every((x,i)=>i===0||Number(x)===Number(p.sheds[i-1])+1)?`Sheds ${p.sheds[0]}–${p.sheds[p.sheds.length-1]}`:`Shed${p.sheds.length===1?'':'s'} ${p.sheds.join(', ')}`;
    const pace=left&&dn!=null&&dn>0?left/dn:null,behind=left>0&&(dn!=null&&dn<=0||pace!=null&&pace>1);
    G.co.push(L(!left?'g':behind?(dn!=null&&dn<=3?'r':'a'):'b',`<b>${sh} prep</b> · ${p.done} of ${p.total} jobs done${dn!=null?' · chicks '+(dn<=0?'today':dn===1?'tomorrow':'in '+dn+' days'):''}${left?behind?` · behind${pace?', needs about '+Math.ceil(pace)+' jobs a day':''}`:' · on track':''}`,'data-brief-cw="prep"',left>0));}
  return {G,cw,today};
}
function mgrBriefInner(){
  if(!farmData)return '';
  const {G,cw}=mgrBriefData(),now=new Date(),h=now.getHours();
  const who=String((typeof cachedManager==='function'&&cachedManager())||'').trim().split(/\s+/)[0];
  const all=[...G.today,...G.watch,...G.feed,...G.co],nr=all.filter(x=>x.tone==='r').length,na=all.filter(x=>x.tone==='a').length,ng=all.filter(x=>x.tone==='g').length;
  const wx=cw&&cw.wx?` · ${escapeHtml(cw.wx.maxT)} / ${escapeHtml(cw.wx.minT)}${cw.wx.label?', '+escapeHtml(cw.wx.label.toLowerCase()):''}`:'';
  const icon=cw&&cw.wx&&cw.wx.icon?cw.wx.icon:(h<18?'☀️':'🌙');
  const pills=nr||na?[nr?`<span class="bf-pill r">${nr} today</span>`:'',na?`<span class="bf-pill a">${na} to watch</span>`:'',ng?`<span class="bf-pill g">${ng} fine</span>`:''].join(''):'<span class="bf-pill g">All good</span>';
  const ln=x=>x.act?`<button type="button" class="bf-ln" ${x.act}><i class="bf-dot ${x.tone}"></i><span>${x.html}</span><em aria-hidden="true">›</em></button>`:`<div class="bf-ln"><i class="bf-dot ${x.tone}"></i><span>${x.html}</span></div>`;
  const grp=(ic,title,arr,ok)=>`<div class="bf-grp"><div class="bf-gh"><i aria-hidden="true">${ic}</i>${title}</div>${arr.length?arr.map(ln).join(''):`<div class="bf-ok">✓ ${ok}</div>`}</div>`;
  return `<div class="bf-h"><span class="bf-sun" aria-hidden="true">${icon}</span>
      <div class="bf-t"><b>Good ${h<12?'morning':h<18?'afternoon':'evening'}${who?', '+escapeHtml(who):''}</b><span>${escapeHtml(now.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'}))}${wx}</span></div>
      <div class="bf-sum">${pills}</div>
      <button type="button" class="bf-fold" data-brief-fold aria-expanded="${!mgrBriefFold}" title="${mgrBriefFold?'Show the briefing':'Fold the briefing'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg></button></div>
    ${mgrBriefFold?'':`<div class="bf-grid">
      ${grp('📋','Today',G.today,cw?'Nothing booked today':'Nothing booked today in Production')}
      ${grp('👀','Watch',G.watch,'All good — every shed on target')}
      ${grp('🌾','Feed',G.feed,'All good')}
      ${grp('🔁','Changeover &amp; prep',G.co,'Nothing this week')}
    </div>
    <div class="bf-foot"><span>Made from today's numbers · updated ${now.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}${cw?'':' · tasks and weather appear once Tasks has loaded'}</span><span>Tap a line to open it</span></div>`}`;
}
function mgrBriefHtml(){if(!farmData)return '';return `<section class="mgr-card bf-card${mgrBriefFold?' folded':''}" id="mgrBrief" aria-label="Morning briefing">${mgrBriefInner()}</section>`;}
function mgrBriefRefresh(){const el=document.getElementById('mgrBrief');if(!el)return;el.classList.toggle('folded',mgrBriefFold);el.innerHTML=mgrBriefInner();}
setInterval(()=>{if(document.visibilityState==='visible')mgrBriefRefresh();},60000);   // tasks ticked in Tasks show up within a minute
document.addEventListener('click',e=>{
  const t=e.target.closest&&e.target.closest('[data-brief-fold],[data-brief-cw],[data-brief-pair]');if(!t)return;
  if(t.hasAttribute('data-brief-fold')){mgrBriefFold=!mgrBriefFold;try{localStorage.setItem('pw-brief-fold',mgrBriefFold?'1':'0');}catch(er){}mgrBriefRefresh();return;}
  if(t.dataset.briefPair){const [g,sh]=t.dataset.briefPair.split(':').map(Number);gotoPair(g,'overview',sh);return;}
  if(t.dataset.briefCw){const what=t.dataset.briefCw;openTasksSection();
    const go=()=>{try{cwFrame.contentWindow.__cwOpen(what);}catch(er){}};
    let ok=false;try{ok=!!cwFrame.contentWindow.__cwOpen;}catch(er){}
    if(ok)go();else cwFrame.addEventListener('load',()=>setTimeout(go,500),{once:true});}
});
