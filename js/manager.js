// ── Manager home + Farm settings (2026-10) ─────────────────────────────
// Home answers what a manager checks every day: where the batch will finish,
// birds, feed (to order, booked, in silos, when silos run low), what needs
// doing and the next 7 days. Farm settings holds every setting that changes
// the projection or the feed forecast, with the ones not at normal first.
// Nothing here calculates anything new: it only shows the app's own figures.

function mgrToday(){return dateOnly(new Date());}
function mgrDays(a,b){return Math.round((dateOnly(b)-dateOnly(a))/864e5);}
function mgrWhen(d){const n=mgrDays(mgrToday(),d);return n===0?'Today':n===1?'Tomorrow':fmtShortNoYear(d);}
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
  const out=[],today=mgrToday(),hour=new Date().getHours();
  silos.filter(x=>x.dep&&x.days<=10).forEach(x=>out.push({tone:x.days<=3?'bad':'warn',title:`Book a load for ${pairLabel(x.g)}`,sub:`Silos run low ${mgrWhen(x.dep)}${x.days>1?`, in ${x.days} days`:''}`,act:`data-tab="g${x.g}"`}));
  // Mortality not entered since before yesterday (sheds that still have birds)
  const late=mgrPlaced().filter(s=>{const c=s.cleanoutDate?dateOnly(s.cleanoutDate):null;if(c&&c<today)return false;const u=s.mortalityUpdatedAt?dateOnly(s.mortalityUpdatedAt):null;return !u||mgrDays(u,today)>=2;});
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
  const fo=farmFeedToOrder();
  const silos=mgrSiloOutlook();
  const inSilos=silos.reduce((n,x)=>n+(x.stock||0),0),allRead=silos.length&&silos.every(x=>x.reading&&x.readAge===0);
  let perDay=0;sheds.forEach(s=>{perDay+=shedFeedOn(s,today)||0;});
  const needs=mgrNeeds(silos);
  const week=mgrWeek();
  const off=farmSettingsNotNormal();
  const firstLow=silos.find(x=>x.dep)||silos[0];

  const finish=`<section class="mgr-card mgr-finish">
      <span class="mgr-k">Where we'll finish</span>
      <div class="mgr-finish-row">
        <div class="mgr-big"><span class="mgr-lbl">cFCR</span><b>${span(ec&&ec.cfcr,t.cfcr,3)}</b></div>
        <div class="mgr-mid"><span class="mgr-lbl">FCR</span><b>${span(ec&&ec.fcr,t.fcr,3)}</b></div>
      </div>
      <div class="mgr-meta">${lk?`<span class="mgr-chip">Last batch ${escapeHtml(String(lr.batch||''))}: ${lk.cfcr.toFixed(3)}</span>`:''}${ec&&Math.abs(ec.cfcr-t.cfcr)>=0.0005?`<span>Low end if the last birds go ${PROJ_EARLY_DAYS} days early</span>`:''}</div>
      <button type="button" class="mgr-link" data-tab="dashboard">Result detail: PIF, ALW, dockets &amp; leftover ›</button>
    </section>`;
  const birds=`<section class="mgr-card mgr-birds">
      <span class="mgr-k">Birds</span>
      <div class="mgr-trio">
        <div><span class="mgr-lbl">On hand</span><b>${live.toLocaleString('en-US')}</b></div>
        <div><span class="mgr-lbl">Picked up</span><b>${picked.toLocaleString('en-US')}</b></div>
        <div><span class="mgr-lbl">Mortality</span><b>${placed?(mort/placed*100).toFixed(1):'0.0'}%</b></div>
      </div>
      <span class="mgr-sub">${mort.toLocaleString('en-US')} birds recorded · ${placed.toLocaleString('en-US')} placed</span>
      <div class="mgr-actions"><button type="button" class="mgr-btn primary" data-mgr-mort title="Enter the total morts for every shed on one page">Enter mortality</button></div>
    </section>`;
  const needsHtml=`<section class="mgr-card mgr-needs${needs.some(n=>n.tone==='bad')?' bad':needs.length?' warn':''}">
      <span class="mgr-k">Needs you</span>
      ${needs.length?needs.map(n=>`<button type="button" class="mgr-need ${n.tone}" ${n.act}><span class="mgr-need-bar"></span><span class="mgr-need-text"><b>${escapeHtml(n.title)}</b><span>${escapeHtml(n.sub)}</span></span></button>`).join(''):`<p class="mgr-none">Nothing needs you right now.</p>`}
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
        <button type="button" class="mgr-btn" data-mgr-feed="${firstLow?firstLow.g:1}" title="Opens the pair's feed plan: tap a day to add a test delivery">Test a delivery${firstLow?` · ${escapeHtml(pairLabel(firstLow.g))}`:''}</button>
      </div>
    </section>`;
  const weekHtml=`<section class="mgr-card mgr-week">
      <span class="mgr-k">Next 7 days</span>
      ${week.length?week.map(w=>`<div class="mgr-week-row"><span class="mgr-week-day">${escapeHtml(mgrWhen(w.date))}</span><span>${escapeHtml(w.text)}</span></div>`).join(''):'<p class="mgr-none">No loads or pickups in the next 7 days.</p>'}
    </section>`;
  const shedRows=sheds.map(s=>{const nx=mgrComingPickups(s)[0];return `<tr><td><b>${s.id}</b></td><td>${ageInDays(s,today)} d</td><td class="num">${Math.max(0,liveAtStartOfDay(s,today)).toLocaleString('en-US')}</td><td>${nx?`${escapeHtml(fmtShortNoYear(nx.date))} · ${nx.birds.toLocaleString('en-US')}${nx.planned?' <span class="mgr-plan">plan</span>':''}`:'—'}</td><td>${s.cleanoutDate?escapeHtml(fmtShortNoYear(s.cleanoutDate)):'—'}</td></tr>`;}).join('');
  const shedsHtml=`<section class="mgr-card mgr-sheds">
      <span class="mgr-k">Sheds</span>
      <div class="mgr-table-wrap"><table class="mgr-table"><thead><tr><th>Shed</th><th>Age</th><th class="num">Birds</th><th>Next pickup</th><th>Clean-out</th></tr></thead><tbody>${shedRows}</tbody></table></div>
    </section>`;
  const offHtml=off.length?`<button type="button" class="mgr-off" data-tab="farmsettings"><span><b>${off.length} farm setting${off.length===1?'':'s'} not at normal</b> and changing these numbers: ${escapeHtml(off.map(o=>o.short).join(', '))}</span><span class="mgr-off-go">Review ›</span></button>`:'';
  return `<div class="mgr-home">
    <div class="mgr-head"><button type="button" class="mgr-batch" data-batch-info><b>Batch ${escapeHtml(String(predState.batchNumber||farmData.batchNumber||''))} · Day ${day}</b><span>${escapeHtml(fmtShortNoYear(today))}${cleans.length?` · first clean-out ${escapeHtml(fmtShortNoYear(cleans[0]))}${cleans.length>1&&iso(cleans[cleans.length-1])!==iso(cleans[0])?`, last ${escapeHtml(fmtShortNoYear(cleans[cleans.length-1]))}`:''}`:''}</span></button></div>
    <div class="mgr-row3">${finish}${birds}${needsHtml}</div>
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
    fmt:()=>[1,2,3,4].map(g=>pairTargetKg(g).toFixed(2)).join(' · '),get:()=>[1,2,3,4].map(g=>pairTargetKg(g)),set:v=>{[1,2,3,4].forEach((g,i)=>{const n=Number(v[i]);if(Number.isFinite(n)&&n>0)predState.targetHarvestWeightKg[g]=Math.max(0.5,Math.min(5,n));});},changes:['cFCR (Industry)'],not:'FCR or cFCR (Baiada)'},
  {key:'bias',sec:'Weights and result',label:'Shed weight to plant weight',hint:'Shed weighings × this = plant weight; set from your kill sheets',kind:'step',min:Math.round(MIN_BIAS_FACTOR*100),max:Math.round(MAX_BIAS_FACTOR*100),step:0.5,fmt:v=>`${v}%`,normal:null,
    get:()=>Math.round(currentBiasFactor()*1000)/10,set:v=>{if(farmData){farmData.biasFactor=Math.max(MIN_BIAS_FACTOR,Math.min(MAX_BIAS_FACTOR,v/100));saveState();}},changes:['Projected weights and the result'],not:'Your recorded weighings'},
  {key:'uplift',sec:'Weights and result',label:'Last pickup heavier',hint:'Final birds vs thinning birds at the same age',kind:'step',min:0,max:15,step:1,fmt:v=>`+${v}%`,normal:DEFAULT_FINAL_UPLIFT_PCT,
    get:()=>Number.isFinite(Number(predState.finalUpliftPct))?Number(predState.finalUpliftPct):DEFAULT_FINAL_UPLIFT_PCT,set:v=>{predState.finalUpliftPct=v;},changes:['Projected weight of the last pickups','The result'],not:'Kill sheets you have entered'},
  {key:'trig',sec:'Pickup planning',label:'Thin when density reaches',hint:'',kind:'step',min:15,max:45,step:0.5,fmt:v=>`${v} kg/m²`,normal:null,get:()=>Number(fsDens().triggerDensity),set:v=>fsSetDens('triggerDensity',v),changes:['Auto-planned pickups in the projection']},
  {key:'tgt',sec:'Pickup planning',label:'Thin down to',hint:'',kind:'step',min:10,max:40,step:0.5,fmt:v=>`${v} kg/m²`,normal:null,get:()=>Number(fsDens().targetDensity),set:v=>fsSetDens('targetDensity',v),changes:['Auto-planned pickups in the projection']},
  {key:'max',sec:'Pickup planning',label:'Never above',hint:'',kind:'step',min:15,max:50,step:0.5,fmt:v=>`${v} kg/m²`,normal:null,get:()=>Number(fsDens().maxDensity),set:v=>fsSetDens('maxDensity',v),changes:['Auto-planned pickups in the projection']},
  {key:'tp',sec:'Pickup planning',label:'Pickups per shed',hint:'',kind:'step',min:1,max:10,step:1,fmt:v=>String(v),normal:null,get:()=>Number(fsDens().targetPickups),set:v=>fsSetDens('targetPickups',v),changes:['Auto-planned pickups in the projection']},
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

function renderFarmSettingsView(){
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
      <section class="fs-group"><span class="fs-sec-label">Per pair and per shed</span><div class="fs-list"><button type="button" class="fs-row" data-toggle-adjustments="1"><span class="fs-row-text"><b>More adjustments</b><span>Scale correction per shed, mortality rate, no-pickup days</span></span>${chev}</button></div></section>
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
  return `<div class="silo-set-line">Reading accuracy <b>${conf}%</b> · safety stock <b>${safety} day${safety===1?'':'s'}</b> · trucks <b>${deliveryTimingEarly()?'early morning':'during the day'}</b><button type="button" class="silo-set-link" data-open-farmsettings>Change in Farm settings ›</button></div>`;
}

// ── One page per pair (Sheds + Predictions combined, 2026-10) ──────────
// Tabs by job: Overview · Feed & silo · Pickups · Growth · Setup. Feed & silo
// is the existing planner; Pickups, Growth and Setup reuse the prediction
// card's own pieces, so every edit works exactly as before.
const PAIR_TABS=[['overview','Overview'],['planner','Feed & silo'],['pickups','Pickups'],['growth','Growth'],['setup','Setup']];
function pairTabsHtml(g,view){
  return `<nav class="pair-tabs" aria-label="${escapeAttr(pairLabel(g))} sections">${PAIR_TABS.map(([v,l])=>`<button type="button" class="pair-tab${v===view?' active':''}" data-shedview="${v}" data-group="${g}" aria-pressed="${v===view}">${escapeHtml(l)}</button>`).join('')}</nav>`;
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
  return `<span class="pair-chip ${sev}" title="Growth vs the Ross 308 standard">${txt}</span>`;
}
function pairOverviewHtml(g){
  const today=mgrToday(),sheds=shedsForGroup(g).filter(s=>s.placementDate);
  if(!sheds.length)return `<div class="empty-card">${pairLabel(g)} has no birds yet.</div>`;
  const gp=computeGroupPredictions(g);
  const result=gp&&gp.hasData?`<section class="mgr-card pair-result"><div class="pair-result-k"><span class="mgr-k">Pair result</span><span class="mgr-sub">projected at clean-out</span></div>
      <div><span class="mgr-lbl">cFCR</span><b class="pr-big">${gp.cfcr.toFixed(3)}</b></div>
      <div><span class="mgr-lbl">FCR</span><b>${gp.fcr.toFixed(3)}</b></div>
      <div><span class="mgr-lbl">Average weight</span><b>${gp.avgWeight.toFixed(2)} kg</b></div>
      <div><span class="mgr-lbl">Livability</span><b>${gp.livability.toFixed(1)}%</b></div>
      <div><span class="mgr-lbl">PIF</span><b>${Math.round(gp.pif)}</b></div></section>`:'';
  const card=s=>{
    const idx=s.id-1,age=ageInDays(s,today),live=Math.max(0,liveAtStartOfDay(s,today));
    const done=(s.pickups||[]).filter(p=>p.date&&dateOnly(p.date)<=today&&!p.weightEstimated&&Number(p.birds)>0&&Number(p.totalWeightKg)>0).sort((a,b)=>dateOnly(a.date)-dateOnly(b.date));
    const last=done[done.length-1];
    const coming=mgrComingPickups(s);
    const finalP=coming.length?coming[coming.length-1]:null;
    const next=coming.length>1?coming[0]:null;
    const row=(k,v)=>`<div class="pair-row"><span>${k}</span><b>${v}</b></div>`;
    return `<section class="mgr-card pair-shed">
      <div class="pair-shed-head"><span class="mgr-title">Shed ${s.id}</span>${pairGrowthChip(s,today)}</div>
      <div class="pair-trio">
        <div class="pair-tile"><span>Age</span><b>${age} d</b></div>
        <div class="pair-tile"><span>Birds now</span><b>${live.toLocaleString('en-US')}</b></div>
        <label class="pair-tile" for="ovMort_${idx}"><span>Mortality</span><input id="ovMort_${idx}" type="number" min="0" inputmode="numeric" value="${Number(s.mortality)||0}" data-shed="${idx}" data-field="mortality" aria-label="Shed ${s.id} mortality"></label>
      </div>
      <div class="pair-rows">
        ${row('Last kill sheet',last?`${(last.totalWeightKg/last.birds).toFixed(2)} kg · ${escapeHtml(fmtShortNoYear(last.date))}, day ${pickupAge(s,last)}`:'None yet')}
        ${row('Next pickup',next?`${escapeHtml(fmtShortNoYear(next.date))} · ${next.birds.toLocaleString('en-US')} birds`:'—')}
        ${row(finalP&&finalP.planned?'Final pickup (plan)':'Last pickup',finalP?`${escapeHtml(fmtShortNoYear(finalP.date))} · ${finalP.birds.toLocaleString('en-US')} birds`:'Not planned yet')}
        ${row('Clean-out',s.cleanoutDate?`${escapeHtml(fmtShortNoYear(s.cleanoutDate))} · day ${ageInDays(s,dateOnly(s.cleanoutDate))}`:'Not set')}
      </div>
    </section>`;
  };
  const silo=mgrSiloOutlook().find(x=>x.g===g);
  const nextLoad=farmLoads.filter(l=>l.date&&dateOnly(l.date)>=today&&Number(l.splitKg&&l.splitKg[g])>0).sort((a,b)=>dateOnly(a.date)-dateOnly(b.date))[0];
  const low=silo&&silo.dep&&silo.days<=10;
  const feed=`<section class="mgr-card mgr-feed pair-feed">
      <div class="mgr-feed-head"><span class="mgr-title">Feed for ${escapeHtml(pairLabel(g))}</span><button type="button" class="mgr-link" data-shedview="planner" data-group="${g}">Feed &amp; silo ›</button></div>
      <div class="mgr-tiles">
        <div class="mgr-tile"><span>In silos</span><b>${silo&&silo.stock!=null?mgrT(silo.stock):'—'}</b><em>${silo&&silo.reading?(silo.readAge===0?'read today':`read ${escapeHtml(fmtShortNoYear(silo.reading.date))}`):'no reading yet'}</em></div>
        <div class="mgr-tile${low?' low':''}"><span>Runs low</span><b>${silo&&silo.dep?escapeHtml(mgrWhen(silo.dep)):'After clean-out'}</b>${silo&&silo.dep?`<em>${silo.days>1?`in ${silo.days} days`:''}</em>`:''}</div>
        <div class="mgr-tile"><span>Next load</span><b>${nextLoad?escapeHtml(mgrWhen(dateOnly(nextLoad.date))):'None booked'}</b>${nextLoad?`<em>${mgrT(nextLoad.splitKg[g])}${nextLoad.feedType?' '+escapeHtml(nextLoad.feedType):''}</em>`:''}</div>
      </div>
      <div class="mgr-actions"><button type="button" class="mgr-btn primary" data-mgr-silo>Record silo reading</button><button type="button" class="mgr-btn" data-shedview="planner" data-group="${g}">Test a delivery</button></div>
    </section>`;
  // This week for the pair: its loads and its sheds' pickups
  const end=addDays(today,6),days=new Map();const day=d=>{const k=iso(d);if(!days.has(k))days.set(k,{date:d,parts:[]});return days.get(k);};
  farmLoads.forEach(l=>{if(!l.date)return;const d=dateOnly(l.date),kg=Number(l.splitKg&&l.splitKg[g])||0;if(d<today||d>end||!kg)return;day(d).parts.push(`Feed ${mgrT(kg)}${l.feedType?' '+l.feedType:''}`);});
  sheds.forEach(s=>(s.pickups||[]).concat(s.predictedPickups||[]).forEach(p=>{if(!p.date)return;const d=dateOnly(p.date);if(d<today||d>end)return;day(d).parts.push(`Pickup Shed ${s.id} · ${(Number(p.birds)||0).toLocaleString('en-US')}`);}));
  const week=[...days.values()].sort((a,b)=>a.date-b.date);
  const weekHtml=`<section class="mgr-card mgr-week"><span class="mgr-k">This week · ${escapeHtml(pairLabel(g))}</span>${week.length?week.map(w=>`<div class="mgr-week-row"><span class="mgr-week-day">${escapeHtml(mgrWhen(w.date))}</span><span>${escapeHtml([...new Set(w.parts)].join(' · '))}</span></div>`).join(''):'<p class="mgr-none">No loads or pickups this week.</p>'}</section>`;
  return `<div class="pair-overview">${result}<div class="mgr-row2">${sheds.map(card).join('')}</div><div class="mgr-row2">${feed}${weekHtml}</div></div>`;
}
document.addEventListener('click',e=>{const f=e.target.closest('[data-mgr-feed]');if(f){const g=Number(f.dataset.mgrFeed);activeTab='g'+g;shedViewByGroup[g]='planner';saveShedViews();render();}});

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
const TOOL_PAGES={loadsModal:{btn:'loadsBtn',close:()=>closeLoadsModal()},siloModal:{btn:'siloBtn',close:()=>closeSiloModal()},pickupsModal:{btn:'pickupsBtn',close:()=>closePickupsModal()},mortModal:{btn:'mortBtn',close:()=>closeMortModal()},compareFeedModal:{btn:'toolsCompareBtn',close:()=>closeCompareModal()}};
let toolPageOpen=null;
function syncToolPages(changed){
  const open=Object.keys(TOOL_PAGES).filter(id=>document.getElementById(id)?.classList.contains('open'));
  // Only one tool page at a time: the newest one stays
  if(open.length>1){const keep=changed&&open.includes(changed)?changed:open[open.length-1];open.filter(id=>id!==keep).forEach(id=>{try{TOOL_PAGES[id].close();}catch(e){}});toolPageOpen=keep;}
  else toolPageOpen=open[0]||null;
  document.body.classList.toggle('tool-open',!!toolPageOpen);
  Object.entries(TOOL_PAGES).forEach(([id,t])=>{const b=document.getElementById(t.btn);if(b)b.classList.toggle('active',id===toolPageOpen);});
}
function closeToolPages(){Object.keys(TOOL_PAGES).forEach(id=>{if(document.getElementById(id)?.classList.contains('open')){try{TOOL_PAGES[id].close();}catch(e){}}});}
document.addEventListener('DOMContentLoaded',()=>{
  let rail=false;try{rail=localStorage.getItem(SB_RAIL_KEY)==='1';}catch(e){}setSidebarRail(rail);
  const obs=new MutationObserver(muts=>{let changed=null;muts.forEach(m=>{if(m.target&&m.target.id&&TOOL_PAGES[m.target.id]&&m.target.classList.contains('open'))changed=m.target.id;});syncToolPages(changed);});
  Object.keys(TOOL_PAGES).forEach(id=>{const m=document.getElementById(id);if(m){m.classList.add('tool-page');obs.observe(m,{attributes:true,attributeFilter:['class']});}});
  const nav=document.getElementById('sidebarNav');if(nav)new MutationObserver(()=>syncToolPages(null)).observe(nav,{childList:true});
});
// Going anywhere else closes the tool page
document.addEventListener('click',e=>{
  if(e.target.closest('#sbRailBtn')){setSidebarRail(!document.body.classList.contains('sb-rail'));return;}
  if(!toolPageOpen)return;
  const nav=e.target.closest('[data-tab],#moreBtnMob,[data-batch-info]');
  if(nav&&!e.target.closest('.compare-modal'))closeToolPages();
},true);
