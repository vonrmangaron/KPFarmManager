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
    return {g,dep,days:dep?mgrDays(mgrToday(),dep):null,reading:r,stock:r?readingTotalKg(r):null,readAge:r?mgrDays(dateOnly(r.date),mgrToday()):null};
  }).sort((a,b)=>(a.dep?a.dep.getTime():Infinity)-(b.dep?b.dep.getTime():Infinity));
}
// Up to 4 things to do now; growth notes stay in the bell
function mgrNeeds(silos){
  const out=typeof closeNeeds==='function'?closeNeeds():[],today=mgrToday(),hour=new Date().getHours();
  if(typeof pairAllClosed==='function')silos=silos.filter(x=>!pairAllClosed(x.g));   // finished pairs: no silo reminders
  // Sheds with no placement date or no birds yet: one row to the Set up sheds page
  const unset=farmData?farmData.sheds.filter(s=>!s.placementDate||!(Number(s.initialPopulation)>0)):[];
  if(unset.length)out.push({tone:'warn',title:`Set up ${unset.length===farmData.sheds.length?'the sheds':unset.length+' shed'+(unset.length===1?'':'s')}`,sub:'Placement date and birds placed still missing',act:'data-tab="shedsetup"'});
  silos.filter(x=>x.dep&&x.days<=10).forEach(x=>out.push({tone:x.days<=3?'bad':'warn',title:`Book a load for ${pairLabel(x.g)}`,sub:`Silos run low ${/^(today|tomorrow)$/i.test(mgrWhen(x.dep))?mgrWhen(x.dep).toLowerCase():mgrWhen(x.dep)}${x.days>1?`, in ${x.days} days`:''}`,act:`data-tab="g${x.g}"`}));
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
function mgrWeek(){
  const today=mgrToday(),end=addDays(today,6),days=new Map();
  const day=d=>{const k=iso(d);if(!days.has(k))days.set(k,{date:d,loads:[],pick:[]});return days.get(k);};
  farmLoads.forEach(l=>{if(!l.date)return;const d=dateOnly(l.date);if(d<today||d>end)return;day(d).loads.push(l);});
  mgrPlaced().forEach(s=>(s.pickups||[]).concat((s.predictedPickups||[]).map(p=>({...p,planned:true}))).forEach(p=>{if(!p.date)return;const d=dateOnly(p.date);if(d<today||d>end)return;const x=day(d);if(!x.pick.some(q=>q.shed===s.id&&iso(q.date)===iso(d)))x.pick.push({shed:s.id,birds:Number(p.birds)||0,date:d});}));
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
  const mortPct=placed?mort/placed*100:0;
  const kpis=`<div class="mk-strip">
      <div class="mk-tile hero" title="Projected Cfcr2.45 at clean-out (FCR corrected to 2.45 kg)"><span class="mgr-k">Cfcr2.45 · finish</span><b class="mk-v">${tv(rc)}</b>${rangeBar}
        <span class="mk-s">${lkC!=null?`last batch ${escapeHtml(String(lr.batch||''))} · ${lkC.toFixed(3)} ${verdict}`:'FCR corrected to 2.45 kg'}</span>${ec&&Math.abs(ec.cfcr-t.cfcr)>=0.0005?`<span class="mk-s faint">Low end if the last birds go ${PROJ_EARLY_DAYS} days early</span>`:''}</div>
      <div class="mk-tile" title="Projected FCR at clean-out"><span class="mgr-k">FCR · finish</span><b class="mk-v">${tv(rf)}</b><span class="mk-s">feed ÷ live weight</span></div>
      <div class="mk-tile"><span class="mgr-k">Birds on hand</span><b class="mk-v">${live.toLocaleString('en-US')}</b><span class="mk-s">of ${placed.toLocaleString('en-US')} placed · ${picked.toLocaleString('en-US')} picked up</span></div>
      <div class="mk-tile"><span class="mgr-k">Mortality</span><b class="mk-v">${mortPct.toFixed(1)}%</b><span class="mk-s">${mort.toLocaleString('en-US')} birds</span><span class="mgr-verdict ${mortPct>4?'bad':'good'}" title="Livability target ≥ 96%">${mortPct>4?'above 4% target':'within 4% target'}</span></div>
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
    <div class="mgr-head"><button type="button" class="mgr-batch" data-batch-info title="Batch details"><b>Batch ${escapeHtml(String(predState.batchNumber||farmData.batchNumber||''))} · ${first>today?'starts '+escapeHtml(fmtShortNoYear(first)):'Day '+day}</b><span>${escapeHtml(fmtShortNoYear(today))}${cleans.length?` · first clean-out ${escapeHtml(fmtShortNoYear(cleans[0]))}${cleans.length>1&&iso(cleans[cleans.length-1])!==iso(cleans[0])?`, last ${escapeHtml(fmtShortNoYear(cleans[cleans.length-1]))}`:''}`:''}</span></button></div>
    ${typeof changeoverHtml==='function'?changeoverHtml():''}
    ${kpis}
    <div class="mk-row">${needsHtml}${flock}</div>
    ${feed}
    <div class="mgr-row2">${shedsHtml}${weekHtml}</div>
    ${offHtml}
  </div>`;
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
    get:()=>Math.round(carryoverTotalKg()/100)/10,set:v=>{predState.carryoverFarmKg=Math.round(v*1000);predState.carryoverKg={1:0,2:0,3:0,4:0};},changes:['Feed eaten, and FCR once the batch is finished','Silo stock'],typeIn:true},
  {key:'target',sec:'Weights and result',label:'Target weight',hint:'Per pair, used for cFCR (Industry)',kind:'pairs',normal:null,
    fmt:()=>[1,2,3,4].map(g=>pairTargetKg(g).toFixed(2)).join(' · '),get:()=>[1,2,3,4].map(g=>pairTargetKg(g)),set:v=>{[1,2,3,4].forEach((g,i)=>{const n=Number(v[i]);if(Number.isFinite(n)&&n>0)predState.targetHarvestWeightKg[g]=Math.max(0.5,Math.min(5,n));});},changes:['cFCR (Industry)'],not:'FCR or Cfcr2.45'},
  {key:'bias',sec:'Weights and result',label:'Shed weight to plant weight',hint:'Shed weighings × this = plant weight; set from your kill sheets',kind:'step',min:Math.round(MIN_BIAS_FACTOR*100),max:Math.round(MAX_BIAS_FACTOR*100),step:0.5,fmt:v=>`${v}%`,normal:null,
    get:()=>Math.round(currentBiasFactor()*1000)/10,set:v=>{if(farmData){farmData.biasFactor=Math.max(MIN_BIAS_FACTOR,Math.min(MAX_BIAS_FACTOR,v/100));saveState();}},changes:['Projected weights and the result'],not:'Your recorded weighings'},
  {key:'uplift',sec:'Weights and result',label:'Last pickup heavier',hint:'Final birds vs thinning birds at the same age',kind:'step',min:0,max:15,step:1,fmt:v=>`+${v}%`,normal:DEFAULT_FINAL_UPLIFT_PCT,
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
function fsAfterChange(label){savePredState();if(farmData)saveState();schedulePush();autoPlanCache=new Map();farmRangeCache=null;
  if(document.getElementById('siloModal')?.classList.contains('open'))renderSiloModalBody();
  if(feedCompareState.modalOpen)renderCompareModalBody();
  render();if(label)showToast(label);}
function fsReset(key){
  if(key==='target'){const c=fsMostCommon([1,2,3,4].map(pairTargetKg));[1,2,3,4].forEach(g=>{predState.targetHarvestWeightKg[g]=c;});fsAfterChange(`Target weight: every pair ${c.toFixed(2)} kg.`);return;}
  if(key.startsWith('feed:')){const s=farmData&&farmData.sheds[Number(key.slice(5))-1];if(s){s.feedAdjustPct=null;fsAfterChange(`Shed ${s.id} feed back to 100% of Ross.`);}return;}
  const i=fsItem(key);if(!i||i.normal==null)return;i.set(i.normal);fsAfterChange(`${i.label}: back to ${i.fmt(i.normal)}.`);
}
function fsResetAll(){const keys=farmSettingsNotNormal().map(o=>o.key);keys.forEach(k=>{if(k==='target'){const c=fsMostCommon([1,2,3,4].map(pairTargetKg));[1,2,3,4].forEach(g=>{predState.targetHarvestWeightKg[g]=c;});}else if(k.startsWith('feed:')){const s=farmData&&farmData.sheds[Number(k.slice(5))-1];if(s)s.feedAdjustPct=null;}else{const i=fsItem(k);if(i&&i.normal!=null)i.set(i.normal);}});fsAfterChange('All settings back to normal.');}

function renderFarmSettingsView(embedded){
  const off=farmSettingsNotNormal();
  const secs=[...new Set(FS_ITEMS.map(i=>i.sec))];
  const chev='<svg class="fs-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
  const offHtml=off.length?`<section class="fs-group fs-off">
      <div class="fs-off-head"><span class="fs-sec-title">Not at normal</span><span class="fs-off-sub">these change your numbers</span>${off.length>1?'<button type="button" class="fs-reset" data-fs-reset-all>Reset all</button>':''}</div>
      <div class="fs-list">${off.map(o=>`<div class="fs-row fs-off-row"><span class="fs-row-text"><b>${escapeHtml(o.label)}</b><span><strong>${escapeHtml(o.value)}</strong> · normal ${escapeHtml(o.normal)}</span></span><button type="button" class="fs-reset" data-fs-reset="${escapeAttr(o.key)}">Reset</button></div>`).join('')}</div>
    </section>`:`<p class="fs-allnormal">Every setting is at normal.</p>`;
  const offKeys=new Set(off.map(o=>o.key));
  const secHtml=secs.map(sec=>`<section class="fs-group"><span class="fs-sec-label">${escapeHtml(sec)}</span><div class="fs-list">
      ${FS_ITEMS.filter(i=>i.sec===sec).map(i=>`<button type="button" class="fs-row" data-fs-edit="${i.key}"><span class="fs-row-text"><b>${escapeHtml(i.label)}</b>${i.hint?`<span>${escapeHtml(i.hint)}</span>`:''}</span><span class="fs-val${offKeys.has(i.key)?' off':''}">${escapeHtml(i.fmt(i.get()))}</span>${chev}</button>`).join('')}
    </div></section>`).join('');
  return `<div class="fs-page">
    <div class="fs-intro">These only change how ProdWise projects and plans. Your recorded data never changes, and every change is kept in History.</div>
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
  let feedDot=false;try{feedDot=computeFarmAlerts().some(x=>x.feedGroup===g&&!/starter/i.test(x.msg));}catch(e){}
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
  if(silo&&silo.dep&&silo.days<=10){
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
      <div class="pair-shed-head"><span class="mgr-title">Shed ${s.id}</span>${closed?'<span class="cs-chip">Closed</span>':pairGrowthChip(s,today)}</div>
      ${typeof closeBannerHtml==='function'?closeBannerHtml(s):''}
      <div class="pov-big3">
        <div><span>Birds now</span><b>${live.toLocaleString('en-US')}</b><em>day ${age}</em></div>
        <div title="${mort.toLocaleString('en-US')} of ${placed.toLocaleString('en-US')} placed"><span>Mortality</span><b>${placed>0?(mort/placed*100).toFixed(1):'0.0'}%</b><em>${mort.toLocaleString('en-US')} birds</em></div>
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
  nav.innerHTML=`<button type="button" class="pwr-logo" data-tab="home" title="Home" aria-label="Home">${logo}</button>`
    +b('data-pw-panel="batch"','grid','Batch')
    +b('data-pw-panel="sheds"','shed','Sheds','<span class="pwr-badge" id="pwrShedBadge" hidden></span>')
    +b('data-pw-panel="tools"','loads','Tools')
    +b('data-tab="history"','history','History')
    +'<span class="pwr-gap"></span>'
    +b('data-pwr-theme','moon','Theme')
    +b('data-pwr-settings data-tab="farmsettings"','gear','Settings','<span class="pwr-badge" id="pwrFarmBadge" hidden></span>')
    +`<button type="button" class="pwr-btn pwr-sync" data-pwr-sync title="Sync"><span class="pwr-sdot" id="pwrSyncDot"></span>${navIcon('cloud')}<span id="pwrSyncLbl">Sync</span></button>`
    +`<button type="button" class="pwr-btn pwr-farm" data-pwr-farm data-tab="account" title="Account"><span class="pwr-av" id="pwrFarmAv">–</span><span id="pwrFarmLbl">Account</span></button>`;
  lay.insertBefore(nav,lay.firstChild);
  const nv=document.getElementById('sidebarNav');if(nv)new MutationObserver(syncPwRail).observe(nv,{childList:true});
}
function syncPwRail(){
  const r=document.getElementById('pwRail');if(!r)return;
  // One lit button: the section of the page you are on (the open panel shows itself)
  const sec=toolPageOpen?'tools':PW_SHED_PAGES.includes(activeTab)?'sheds':(activeTab==='dashboard'||activeTab==='home')?'batch':activeTab;
  r.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('on',x.dataset.tab===sec));
  // Like CluckWise: the button of the open panel is lit; with the panel shut, the section you are in gets a softer mark
  r.querySelectorAll('[data-pw-panel]').forEach(x=>{const k=x.dataset.pwPanel;x.classList.toggle('on',k===pwPanel);x.classList.toggle('cur',k===sec&&k!==pwPanel);});
  // Sync and farm stay on the rail when the panel is hidden
  const sd=document.getElementById('pwrSyncDot'),sl=document.getElementById('pwrSyncLbl');
  if(sd&&typeof syncFarmName!=='undefined'){
    const busy=syncState==='pulling'||syncState==='pushing';
    const cls=!syncFarmName?'off':syncState==='error'?'err':busy?'busy':syncConnectedAt?'ok':'busy';
    sd.className='pwr-sdot '+cls;
    sl.textContent=!syncFarmName?'Offline':syncState==='error'?'Error':busy?'Syncing':'Synced';
    const sb=r.querySelector('[data-pwr-sync]');if(sb)sb.title=!syncFarmName?'Not connected — tap to connect':busy?'Syncing…':syncState==='error'?'Sync error — tap to retry':'Synced'+(syncLastSyncAt?' · '+fmtRelativeTime(syncLastSyncAt):'')+' — tap to sync now';
  }
  const av=document.getElementById('pwrFarmAv'),fl=document.getElementById('pwrFarmLbl');
  if(av&&typeof displayFarmName==='function'){
    const shown=String(displayFarmName()||'').trim();
    av.textContent=syncFarmName?(shown.split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase()||'F'):'–';
    fl.textContent='Account';
    const fb=r.querySelector('[data-pwr-farm]');if(fb)fb.title='Account · '+(shown||'This device')+(syncFarmName?' · cloud sync on':' · not synced');
  }
  const th=r.querySelector('[data-pwr-theme]');if(th){const dark=document.body.classList.contains('theme-dark');th.innerHTML=navIcon(dark?'sun':'moon')+'<span>Theme</span>';th.title=dark?'Switch to light':'Switch to dark';}
  let n=0;document.querySelectorAll('#sidebarNav .sb-link[data-tab^="g"] .sb-count').forEach(c=>n+=Number(c.textContent)||0);
  const sb=document.getElementById('pwrShedBadge');if(sb){sb.hidden=!n;sb.textContent=n>99?'99+':String(n);sb.title=n+' open alert'+(n===1?'':'s');}
  const fc=document.querySelector('#sidebarNav .sb-link[data-tab="farmsettings"] .sb-count');const fb=document.getElementById('pwrFarmBadge');if(fb){fb.hidden=!fc;fb.textContent=fc?fc.textContent:'';}
}
document.addEventListener('click',e=>{
  const pb=e.target.closest('[data-pw-panel]');
  if(pb){const k=pb.dataset.pwPanel;
    if(pwPanel===k){setPwPanel('none',true);return;}
    setPwPanel(k,true);
    // and goes to the first page of that section: Batch → Home, Sheds → Sheds 1–2, Tools → Feed loads
    if(k==='tools'){if(toolPageOpen!=='loadsModal'&&typeof openLoadsModal==='function')openLoadsModal();return;}
    if(toolPageOpen)closeToolPages();
    if(k==='batch'){activeTab='home';render();}
    else if(k==='sheds'){if(typeof gotoPair==='function')gotoPair(1,'overview');else{activeTab='g1';render();}}
    return;}
  const gs=e.target.closest('[data-pw-goset]');if(gs){goSettings(gs.dataset.pwGoset);return;}
  if(e.target.closest('[data-pwb-newbatch]')){if(typeof openNewBatchModal==='function')openNewBatchModal();return;}
  if(e.target.closest('[data-pwr-theme]')){if(typeof toggleTheme==='function')toggleTheme();setTimeout(syncPwRail,0);return;}
  if(e.target.closest('[data-pwr-settings]')){goSettings('predictions');return;}
  if(e.target.closest('[data-pwr-sync]')){(document.getElementById('sbSyncNowBtn')||document.getElementById('sbConnectBtn'))?.click();return;}
  if(e.target.closest('[data-pwr-farm]')){goAccount('profile');return;}
  const st=e.target.closest('[data-set-tab]');if(st){setTab=st.dataset.setTab;render();return;}
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
  if(tab)setTab=tab;
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
    <p class="set-muted">Changes wait for <b>Apply</b> at the bottom, then update the forecast. Farm-wide numbers (scale, target weight, pickup planning, no-pickup days) are in <button type="button" class="set-link" data-set-tab="predictions">Predictions</button>.</p>`;
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
function renderSettingsPage(){
  const off=farmData?farmSettingsNotNormal().length:0;
  if(!SET_TABS.some(x=>x[0]===setTab))setTab='predictions';
  return `<div class="set-page"><nav class="set-tabs" aria-label="Settings sections">${SET_TABS.map(([k,l])=>`<button type="button" class="set-tab${k===setTab?' on':''}" data-set-tab="${k}"${k===setTab?' aria-current="page"':''}>${escapeHtml(l)}${k==='predictions'&&off?`<b>${off}</b>`:''}</button>`).join('')}</nav>
    <div class="set-body set-${setTab}" id="setBody">${settingsSectionHtml(setTab)}</div>${setApplyBarHtml()}</div>`;
}
// The old drawer re-render calls (sync state, farm history, units…) refresh this page's tab instead
function renderSettingsTabBody(force){
  const b=document.getElementById('setBody');if(!b||activeTab!=='farmsettings')return;
  const ae=document.activeElement;
  if(!force&&ae&&b.contains(ae)&&/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName))return;
  b.innerHTML=settingsSectionHtml(setTab);afterSettingsRender();
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
function afterSettingsRender(){}
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
  Object.keys(d.notif||{}).forEach(k=>{if(d.notif[k]!==!!notifPrefs[k])out.push(`${k==='feedBalance'?'Feed balance':'Shed performance'} alerts ${d.notif[k]?'on':'off'}`);});
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
  const d=setDraft;if(!d)return;const n=sdChanges().length;
  if(d.std!=null)predState.growthStd=d.std;
  if(d.frCage!=null)predState.frCage=d.frCage;
  if(d.npd)predState.noPickupDays=[...d.npd].sort((a,b)=>a-b);
  if(farmData){
    Object.keys(d.scale||{}).forEach(id=>{const sh=farmData.sheds.find(s=>String(s.id)===id);if(sh)sh.scaleOverride=d.scale[id]==null?null:Math.max(MIN_BIAS_FACTOR,Math.min(MAX_BIAS_FACTOR,Number(d.scale[id])/100));});
    Object.keys(d.mort||{}).forEach(id=>setShedMortRate(Number(id),d.mort[id]));
  }
  Object.keys(d.notif||{}).forEach(k=>setNotifPref(k,d.notif[k]));
  const unitChanged=d.unit&&d.unit!==feedUnit();if(unitChanged)setFeedUnit(d.unit);
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
  const nav=t.closest('[data-tab],[data-pw-panel],[data-pwr-farm],[data-pwr-settings],.mob-nav-btn,.sb-link,.more-row,[data-goto-shedgroup],#sbFarm,.pwr-logo,[data-pw-goset]');
  if(nav&&sdChanges().length&&!nav.closest('.set-tabs')){
    // the Settings button, or the open panel's own button (that only closes the panel), don't leave
    if(nav.matches('[data-pwr-settings]')||(nav.matches('[data-pw-panel]')&&nav.dataset.pwPanel===pwPanel))return;
    if(!sdLeaving()){e.stopPropagation();e.preventDefault();}
  }else if(nav)setDraft=null;
},true);
document.addEventListener('change',e=>{
  if(activeTab!=='farmsettings'||!e.target.closest||!e.target.closest('#setBody'))return;
  const id=e.target.id;
  if(id==='notifShedPerf'||id==='notifFeedBalance'){e.stopPropagation();sdTouch().notif[id==='notifShedPerf'?'shedPerformance':'feedBalance']=e.target.checked;sdRefresh();}
},true);
window.addEventListener('beforeunload',e=>{if(activeTab==='farmsettings'&&sdChanges().length){e.preventDefault();e.returnValue='';}});
