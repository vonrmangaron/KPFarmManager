function buildDefaultShed(id){return {id,placementDate:null,initialPopulation:DEFAULT_SHED_POPULATION,cleanoutDate:null,mortality:0,mortalityUpdatedAt:null,customFeedKg:null,pickups:[],targetCurve:{7:null,14:null,21:null,28:null},mortalityRatePercent:DEFAULT_MORT_RATE_PCT,chickWeightKg:DEFAULT_CHICK_WEIGHT_KG,inYardSamples:[],predictedPickups:[],targetPickups:null,densitySettings:{useGlobal:true,maxDensity:null,triggerDensity:null,targetDensity:null}};}
function buildDefaultFarmData(batchNumber){return {batchNumber:batchNumber||'',importDate:new Date().toISOString(),fileName:null,biasFactor:DEFAULT_BIAS_FACTOR,sheds:Array.from({length:SHED_COUNT},(_,i)=>buildDefaultShed(i+1))};}
function resetAllToDefaults(batchNumber,opts){
  farmData=buildDefaultFarmData(batchNumber);
  // Farm history stays only for a new batch on the same farm
  if(!(opts&&opts.keepHistory)){predState.farmHistory=[];predState.farmHistoryDeleted=[];}
  predState.batchNumber=batchNumber||'';predState.carryoverFarmKg=0;predState.carryoverKg={1:0,2:0,3:0,4:0};predState.farmFeedOverride=null;predState.farmLeftoverKg=null;predState.predGroup=1;predState.predView='both';predState.beta=0.27;predState.targetHarvestWeightKg={1:2.65,2:2.65,3:2.65,4:2.65};predState.densityGlobal={...DEFAULT_DENSITY_GLOBAL};predState.deliveriesOpen=true;predState.adjOpen=false;
  siloData={1:{readings:[],deliveries:[]},2:{readings:[],deliveries:[]},3:{readings:[],deliveries:[]},4:{readings:[],deliveries:[]}};
  testDeliveries={1:[],2:[],3:[],4:[]};testPickups={};inlinePickupState=null;farmLoads=[];
  shedViewByGroup={...DEFAULT_VIEWS};shedRange={start:0,end:0};siloRange={start:0,end:14};inlineDeliveryState=null;activeTab='g1';dailyRangeState={...DEFAULT_DAILY_RANGE};
  feedCompareState={modalOpen:false,selectedGroups:[],layoutMode:'auto',visibleColumns:{date:true,age:true,liveBirds:true,dailyFeed:true,delivery:true,endBalance:true}};
  loadsModalState={open:false,filter:'all',view:'table'};loadModalState=null;
  const cm=document.getElementById('compareFeedModal');if(cm)cm.classList.remove('open');
  const lm=document.getElementById('loadsModal');if(lm)lm.classList.remove('open');
  const lom=document.getElementById('loadModal');if(lom)lom.classList.remove('open');
  saveState();saveSiloData();saveFarmLoads();savePredState();saveShedViews();
}

function applyTheme(theme){
  const isDark=theme==='dark';
  document.body.classList.toggle('theme-dark',isDark);
  document.querySelectorAll('.sb-theme-opt').forEach(btn=>{
    const active=btn.dataset.themeValue===theme;
    btn.classList.toggle('active',active);
    btn.setAttribute('aria-pressed',active?'true':'false');
  });
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.setAttribute('content',isDark?'#1A2438':'#E0A339');
}
function loadTheme(){try{const t=localStorage.getItem(THEME_KEY);return (t==='dark'||t==='light')?t:'light';}catch(e){return 'light';}}
function saveTheme(t){try{localStorage.setItem(THEME_KEY,t);}catch(e){}}
function setTheme(theme){if(theme!=='dark'&&theme!=='light')return;applyTheme(theme);saveTheme(theme);schedulePush();}
function toggleTheme(){const cur=document.body.classList.contains('theme-dark')?'dark':'light';setTheme(cur==='dark'?'light':'dark');}

function loadNotifPrefs(){
  try{
    const raw=localStorage.getItem(NOTIF_PREFS_KEY);if(!raw)return;
    const v=JSON.parse(raw);if(!v||typeof v!=='object')return;
    if(typeof v.shedPerformance==='boolean')notifPrefs.shedPerformance=v.shedPerformance;
    if(typeof v.feedBalance==='boolean')notifPrefs.feedBalance=v.feedBalance;
  }catch(e){}
}
function saveNotifPrefs(){try{localStorage.setItem(NOTIF_PREFS_KEY,JSON.stringify(notifPrefs));}catch(e){}}
function setNotifPref(key,value){
  if(!(key in notifPrefs))return;
  notifPrefs[key]=!!value;saveNotifPrefs();
  updateAlertsBell();
}
function bindNotifCheckboxes(){
  const s=document.getElementById('notifShedPerf');
  const f=document.getElementById('notifFeedBalance');
  if(s&&!s.__notifBound){
    s.__notifBound=true;
    // Set initial visual state from the loaded prefs — guards against any
    // render-order edge case where the HTML checked attribute is stale.
    s.checked=!!notifPrefs.shedPerformance;
    s.addEventListener('change',()=>{setNotifPref('shedPerformance',s.checked);});
  }
  if(f&&!f.__notifBound){
    f.__notifBound=true;
    f.checked=!!notifPrefs.feedBalance;
    f.addEventListener('change',()=>{setNotifPref('feedBalance',f.checked);});
  }
}

function readingsSorted(group){const s=siloData[group]||{readings:[]};return (s.readings||[]).slice().sort((a,b)=>a.date.localeCompare(b.date));}
function latestReading(group){const arr=readingsSorted(group);return arr.length?arr[arr.length-1]:null;}
function readingTotalKg(reading){if(!reading)return 0;return ringsToKg(reading.silo1Rings)+ringsToKg(reading.silo2Rings)+ringsToKg(reading.silo3Rings);}
function readingOnDate(group,dateIso){const arr=readingsSorted(group);return arr.find(r=>r.date===dateIso)||null;}
function allDeliveriesForGroup(group){
  const arr=loadsAffectingGroup(group).map(l=>({id:l.id,loadId:l.id,date:l.date,amountKg:Number(l.splitKg[group])||0,feedType:l.feedType||'',note:l.note||'',actualKg:l.actualKg,isTest:false,isMigrated:!!l.migrated}));
  const tests=(testDeliveries[group]||[]).map(t=>({id:t.id,loadId:null,date:t.date,amountKg:Number(t.amountKg)||0,feedType:'',note:'',actualKg:null,isTest:true,isMigrated:false}));
  return arr.concat(tests).sort((a,b)=>{const t=dateOnly(a.date)-dateOnly(b.date);if(t!==0)return t;return String(a.id||'').localeCompare(String(b.id||''));});
}
function deliveriesForGroup(group){return allDeliveriesForGroup(group).filter(d=>!d.isTest);}
function deliveriesKgOn(group,D){return loadsKgOn(group,D);}
// Real loads + session-only test loads — the forecast's "what if" view.
// (Real-only totals use deliveriesKgOn.)
function testKgOn(group,D){const t=iso(D);return (testDeliveries[group]||[]).reduce((s,x)=>s+(iso(x.date)===t?(Number(x.amountKg)||0):0),0);}
function deliveriesKgOnAll(group,D){return loadsKgOnAll(group,D)+testKgOn(group,D);}
// realOnly: ignore session-only test loads (used by alerts, so a
// hypothetical load can never hide a real shortage).
// A reading is either EVENING (end-of-day stock, after that day's feeding
// and deliveries) or MORNING (start-of-day stock, before them). Everything
// is anchored on the reading day's END balance:
//   evening: end = reading
//   morning: end = reading + that day's deliveries − that day's feed
function readingIsMorning(r){return !!r&&r.time==='am';}
function readingEndOfDayKg(group,reading,kgOn){
  const base=readingTotalKg(reading);
  if(!readingIsMorning(reading))return base;
  const d=dateOnly(reading.date);
  return base+(kgOn||deliveriesKgOnAll)(group,d)-groupDailyFeedOn(shedsForGroup(group),d);
}
function balanceOnEndOfDay(group,D,realOnly){
  const latest=latestReading(group);if(!latest)return null;
  const kgOn=realOnly?deliveriesKgOn:deliveriesKgOnAll;
  const latestDate=dateOnly(latest.date);const targetD=dateOnly(D);const sheds=shedsForGroup(group);
  const anchor=readingEndOfDayKg(group,latest,kgOn);
  if(targetD.getTime()===latestDate.getTime())return anchor;
  if(targetD>latestDate){let bal=anchor;for(let d=addDays(latestDate,1);d<=targetD;d=addDays(d,1)){bal=bal+kgOn(group,d)-groupDailyFeedOn(sheds,d);}return bal;}
  let bal=anchor;for(let d=latestDate;d>targetD;d=addDays(d,-1)){bal=bal-kgOn(group,d)+groupDailyFeedOn(sheds,d);}return bal;
}
// ── Feed actually eaten — measured, no intake model ──
// carry-over + loads delivered up to each pair's latest silo reading
// − feed in its silos at that reading. A docket actual scales that
// load's planned split. Morning reading: that day's loads not in yet.
function feedOrderedKg(){return farmLoads.reduce((s,l)=>s+(l.actualKg!=null?Number(l.actualKg)||0:Number(l.plannedKg)||0),0);}
function loadKgToPairBefore(l,g){const sk=Number(l.splitKg&&l.splitKg[g])||0;if(sk<=0)return 0;const pk=Number(l.plannedKg)||0;return (l.actualKg!=null&&pk>0)?sk*Number(l.actualKg)/pk:sk;}
function feedEatenMeasured(){
  const carry=carryoverTotalKg();const pairs=[],missing=[];let eaten=carry;
  [1,2,3,4].forEach(g=>{
    const sheds=shedsForGroup(g).filter(s=>s.placementDate);if(!sheds.length)return;
    const r=latestReading(g);if(!r){missing.push(g);return;}
    const D=dateOnly(r.date),morning=readingIsMorning(r);
    let delivered=0;
    farmLoads.forEach(l=>{if(!l.date)return;const ld=dateOnly(l.date);if(morning?ld>=D:ld>D)return;delivered+=loadKgToPairBefore(l,g);});
    const stock=readingTotalKg(r);
    pairs.push({g,date:D,morning,delivered,stock,sheds});eaten+=delivered-stock;
  });
  return {eaten,carry,pairs,missing};
}
// ── Farm history: each finished batch's results, kept with the farm
// across batches (saved at New batch, or entered by hand). The app learns
// from it: first-thin timing and intake % when the current batch has no
// data of its own yet, and a "vs last batch" comparison.
function num0(v){const n=Number(v);return Number.isFinite(n)?n:0;}
function numOrNull(v){if(v==null||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;}
function normalizeHistoryRec(r){
  if(!r||typeof r!=='object')return null;
  const rec={id:String(r.id||uid('bh')),batch:String(r.batch||'').slice(0,32),endDate:r.endDate?String(r.endDate).slice(0,10):'',source:r.source==='auto'?'auto':'manual',
    placed:Math.round(num0(r.placed)),picked:Math.round(num0(r.picked)),liveWeightKg:num0(r.liveWeightKg),feedKg:num0(r.feedKg),avgAge:num0(r.avgAge),
    firstThinAge:numOrNull(r.firstThinAge),firstThinShare:numOrNull(r.firstThinShare),finalShare:numOrNull(r.finalShare),finalAge:numOrNull(r.finalAge),finalAvgKg:numOrNull(r.finalAvgKg),densTrigger:numOrNull(r.densTrigger),densTarget:numOrNull(r.densTarget),densMax:numOrNull(r.densMax),pickupsPerShed:numOrNull(r.pickupsPerShed),intakePct:numOrNull(r.intakePct),savedAt:num0(r.savedAt)||Date.now()};
  return rec.placed>0&&rec.picked>0&&rec.picked<=rec.placed?rec:null;
}
// Combine Farm history from the cloud with this device's: union by id,
// newer edit wins, deleted ids (from either side) stay deleted.
function mergeCloudFarmHistory(p){
  if(!p||typeof p!=='object')return;
  const del=new Set([...(predState.farmHistoryDeleted||[]),...(Array.isArray(p.farmHistoryDeleted)?p.farmHistoryDeleted:[])].map(String));
  const byId=new Map();
  [...farmHistory(),...(Array.isArray(p.farmHistory)?p.farmHistory:[])].forEach(raw=>{const r=normalizeHistoryRec(raw);if(!r||del.has(r.id))return;const cur=byId.get(r.id);if(!cur||r.savedAt>cur.savedAt)byId.set(r.id,r);});
  predState.farmHistory=[...byId.values()];predState.farmHistoryDeleted=[...del].slice(-200);
}
function farmHistory(){return Array.isArray(predState.farmHistory)?predState.farmHistory:[];}
function farmHistorySorted(){return farmHistory().slice().sort((a,b)=>(b.endDate||'').localeCompare(a.endDate||'')||b.savedAt-a.savedAt);}
function historyKpis(r){return batchKpis({feedKg:r.feedKg,liveWeightKg:r.liveWeightKg,birds:r.picked,ageBirdSum:r.avgAge*r.picked,placed:r.placed,mortality:r.placed-r.picked,targetKg:CFCR_REF_KG});}
function lastHistoryRec(){return farmHistorySorted()[0]||null;}
function addFarmHistoryRec(raw){const rec=normalizeHistoryRec(raw);if(!rec)return null;predState.farmHistory=farmHistory().concat([rec]);savePredState();if(typeof schedulePush==='function')schedulePush();if(typeof scheduleHistoryPush==='function')scheduleHistoryPush();return rec;}
function deleteFarmHistoryRec(id){predState.farmHistory=farmHistory().filter(r=>r.id!==id);predState.farmHistoryDeleted=(predState.farmHistoryDeleted||[]).filter(x=>x!==id).concat([id]).slice(-200);savePredState();if(typeof schedulePush==='function')schedulePush();if(typeof scheduleHistoryPush==='function')scheduleHistoryPush();}
// Priors from history (only records that carry the value)
function historyThinPrior(){const r=farmHistory().filter(x=>x.firstThinAge>0&&x.firstThinShare>0);return r.length?{age:Math.round(medianOf(r.map(x=>x.firstThinAge))),share:medianOf(r.map(x=>x.firstThinShare)),n:r.length}:null;}
// Pickup-planning suggestion from past batches (median across them)
function historyDensityPrior(){
  const r=farmHistorySorted().filter(x=>x.densTrigger>0&&x.densTarget>0&&x.densMax>0);if(!r.length)return null;
  const h=v=>Math.round(v*2)/2;
  return {trig:h(medianOf(r.map(x=>x.densTrigger))),tgt:h(medianOf(r.map(x=>x.densTarget))),max:h(medianOf(r.map(x=>x.densMax))),
    tp:Math.round(medianOf(r.filter(x=>x.pickupsPerShed>0).map(x=>x.pickupsPerShed))||0)||null,n:r.length,batches:r.map(x=>x.batch).filter(Boolean)};
}
function historyIntakePrior(){const r=farmHistory().filter(x=>x.intakePct>0);return r.length?{factor:r.reduce((s,x)=>s+x.intakePct,0)/r.length/100,n:r.length}:null;}
// Summarise the batch on screen (called at New batch, before the reset)
function summarizeCurrentBatch(){
  if(!farmData)return null;
  const cal=typeof intakeCalibration==='function'?intakeCalibration():{ok:false};
  return summarizeBatchData({sheds:farmData.sheds||[],batch:predState.batchNumber||farmData.batchNumber||'',docketKg:num0(predState.farmFeedOverride)>0?num0(predState.farmFeedOverride):feedOrderedKg(),
    carryKg:carryoverTotalKg(),leftoverKg:num0(predState.farmLeftoverKg),intakePct:cal.ok&&!cal.fromHistory?Math.round(cal.factor*1000)/10:null});
}
// Summarise a batch file from the cloud without loading it
function summarizeBatchPayload(payload){
  if(!payload||!payload.farmData||!Array.isArray(payload.farmData.sheds))return null;
  const pr=payload.predictions||{};
  const loads=Array.isArray(payload.farmLoads)?payload.farmLoads:[];
  const loadsKg=loads.reduce((s,l)=>s+(l&&l.actualKg!=null?num0(l.actualKg):num0(l&&l.plannedKg)),0);
  const carry=num0(pr.carryoverFarmKg)>0?num0(pr.carryoverFarmKg):Object.values(pr.carryoverKg||{}).reduce((s,v)=>s+num0(v),0);
  return summarizeBatchData({sheds:payload.farmData.sheds,batch:String(payload.batchNumber||payload.farmData.batchNumber||''),docketKg:num0(pr.farmFeedOverride)>0?num0(pr.farmFeedOverride):loadsKg,carryKg:carry,leftoverKg:num0(pr.farmLeftoverKg),intakePct:null});
}
function summarizeBatchData(o){
  const sheds=(o.sheds||[]).filter(s=>s&&s.placementDate&&num0(s.initialPopulation)>0);if(!sheds.length)return null;
  let placed=0,picked=0,ageBirds=0,lw=0,lwBirds=0,last=null;const fa=[],fs=[],fin=[],finAge=[],finKg=[],dBefore=[],dAfter=[],dAll=[],perShed=[];
  sheds.forEach(s=>{
    const pop=num0(s.initialPopulation);placed+=pop;
    const real=(s.pickups||[]).filter(p=>p.date&&num0(p.birds)>0).sort((a,b)=>dateOnly(a.date)-dateOnly(b.date));
    // Thinning pattern: density (plant weight × birds ÷ floor) just before and after each pickup
    if(real.length)perShed.push(real.length);
    real.forEach((p,i)=>{const kg=pickupAvgKg(p);if(!(kg>0))return;const after=liveAtStartOfDay(s,dateOnly(p.date)),before=after+num0(p.birds);const db=before*kg/FIXED_FLOOR_AREA_M2,da=after*kg/FIXED_FLOOR_AREA_M2;dAll.push(db);if(!p.isFinal&&i<real.length-1){dBefore.push(db);dAfter.push(da);}});
    real.forEach(p=>{const b=num0(p.birds);picked+=b;ageBirds+=pickupAge(s,p)*b;const avg=pickupAvgKg(p);if(avg>0){lw+=avg*b;lwBirds+=b;}const d=dateOnly(p.date);if(!last||d>last)last=d;});
    if(real.length&&!real[0].isFinal){fa.push(pickupAge(s,real[0]));fs.push(num0(real[0].birds)/pop);}
    if(real.length){const lp=real[real.length-1];fin.push(num0(lp.birds)/pop);finAge.push(pickupAge(s,lp));const a=pickupAvgKg(lp);if(a>0&&!lp.weightEstimated)finKg.push(a);}
  });
  // Only a batch that has largely finished (≥ half the birds out) is worth learning from
  if(picked<=0||lwBirds<=0||picked<placed*0.5)return null;
  return normalizeHistoryRec({batch:o.batch||'',endDate:last?iso(last):'',source:'auto',placed,picked,
    liveWeightKg:lw*picked/lwBirds,feedKg:Math.max(0,num0(o.docketKg)+num0(o.carryKg)-num0(o.leftoverKg)),avgAge:ageBirds/picked,
    firstThinAge:medianOf(fa),firstThinShare:medianOf(fs),finalShare:medianOf(fin),finalAge:medianOf(finAge),finalAvgKg:medianOf(finKg),intakePct:o.intakePct,
    densTrigger:dBefore.length?medianOf(dBefore):null,densTarget:dAfter.length?medianOf(dAfter):null,densMax:dAll.length?Math.max(...dAll):null,pickupsPerShed:perShed.length?medianOf(perShed):null});
}
function currentBalanceKg(group){return balanceOnEndOfDay(group,new Date());}
// "Since the reading": a morning reading hasn't seen its own day yet,
// so the reading day itself is included.
function consumptionSinceLatestReading(group){
  const latest=latestReading(group);if(!latest)return 0;
  const latestDate=dateOnly(latest.date);const today=dateOnly(new Date());
  const start=readingIsMorning(latest)?latestDate:addDays(latestDate,1);if(start>today)return 0;
  const sheds=shedsForGroup(group);let c=0;
  for(let d=start;d<=today;d=addDays(d,1))c+=groupDailyFeedOn(sheds,d);
  return c;
}
function deliveriesSinceLatestReading(group){
  const latest=latestReading(group);if(!latest)return 0;
  const latestDate=dateOnly(latest.date);const today=dateOnly(new Date());
  const start=readingIsMorning(latest)?latestDate:addDays(latestDate,1);if(start>today)return 0;
  let d=0;for(let x=start;x<=today;x=addDays(x,1))d+=deliveriesKgOn(group,x);
  return d;
}
function computeSiloForecast(group,range,opts){
  const realOnly=!!(opts&&opts.realOnly);
  // Test pickups count only in the what-if forecast (never with realOnly).
  const prevInclude=includeTestPickups;includeTestPickups=!realOnly;
  try{return computeSiloForecastInner(group,range,realOnly);}finally{includeTestPickups=prevInclude;}
}
function computeSiloForecastInner(group,range,realOnly){
  const sheds=shedsForGroup(group);const today=dateOnly(new Date());const rows=[];
  let totalConsumption=0,totalDelivered=0;
  const realPickupsByDay={};const predictedPickupsByDay={};const testPickupsByDay={};const movedAwayByDay={};
  sheds.forEach(s=>{
    const eff=computeEffectivePickups(s);
    eff.forEach(p=>{const k=iso(p.date);
      if(p.__source==='test'){(testPickupsByDay[k]=testPickupsByDay[k]||[]).push({shedId:s.id,id:p.__id,birds:Number(p.birds)||0,movedFrom:(testPickupsForShed(s.id).find(t=>t.id===p.__id)||{}).movedFromId?true:false});}
      else if(p.__source==='predicted')predictedPickupsByDay[k]=(predictedPickupsByDay[k]||0)+(Number(p.birds)||0);
      else realPickupsByDay[k]=(realPickupsByDay[k]||0)+(Number(p.birds)||0);});
    if(!realOnly){
      // Planned pickups a test has moved away — shown on their original day
      testPickupsForShed(s.id).filter(t=>t.movedFromId).forEach(t=>{
        const pp=(s.predictedPickups||[]).find(x=>x.id===t.movedFromId);
        if(pp){const k=iso(dateOnly(pp.date));(movedAwayByDay[k]=movedAwayByDay[k]||[]).push({shedId:s.id,birds:Number(pp.birds)||0,to:t.date});}
      });
    }
  });
  for(let off=range.start;off<=range.end;off++){
    const d=addDays(today,off);const isPast=off<0;const isToday=off===0;
    const cons=groupDailyFeedOn(sheds,d);const del=realOnly?deliveriesKgOn(group,d):deliveriesKgOnAll(group,d);
    const deliveriesOnDay=allDeliveriesForGroup(group).filter(x=>iso(x.date)===iso(d)&&!(realOnly&&x.isTest));
    const bal=balanceOnEndOfDay(group,d,realOnly);
    const liveBirds=sheds.reduce((sum,s)=>sum+liveAtStartOfDay(s,d),0);
    const key=iso(d);
    const realPickups=realPickupsByDay[key]||0;const predPickups=predictedPickupsByDay[key]||0;
    const pickupsBirds=realPickups+predPickups;const hasPredicted=predPickups>0;
    totalConsumption+=cons;totalDelivered+=del;
    rows.push({date:d,consumption:cons,delivery:del,deliveries:deliveriesOnDay,balance:bal,liveBirds,pickupsBirds,hasPredicted,testPickups:testPickupsByDay[key]||[],movedAway:movedAwayByDay[key]||[],isToday,isPast,isFuture:!isPast&&!isToday,isWeekend:isWeekend(d)});
  }
  let depletedDate=null;
  for(const r of rows){if(r.balance!==null&&r.balance<=0&&r.consumption>0&&!r.isPast){depletedDate=r.date;break;}}
  const endBalance=rows.length?rows[rows.length-1].balance:null;
  const totalStock=balanceOnEndOfDay(group,today,realOnly);
  const shortfall=Math.max(0,totalConsumption-(totalStock||0)-totalDelivered);
  return {rows,totalStock,totalConsumption,totalDelivered,depletedDate,endBalance,shortfall};
}
function shedAgesAtDateForGroup(group,date){
  const sheds=shedsForGroup(group);
  return sheds.map(s=>{if(!s.placementDate)return null;const d=dateOnly(date);const p=dateOnly(s.placementDate);if(d<p)return null;return daysBetween(s.placementDate,d);});
}
function formatAgesPair(ages){
  const valid=ages.filter(a=>a!==null);
  if(valid.length===0)return '—';
  if(valid.every(a=>a===valid[0]))return valid[0]+'d';
  return ages.map(a=>a===null?'—':a+'d').join(' / ');
}
// Feed still to order up to clean-out, two ways:
//  safe     = your plan only (no future pickups unless you entered them) — the
//             conservative figure the feed forecast uses
//  expected = with the background auto pickup plan — the realistic figure
// need − stock now − loads already booked; leftover = stock + booked − need.
function pairEndDate(g){const ds=shedsForGroup(g).filter(s=>s.placementDate).map(s=>resultPlanEndDate(s)).filter(Boolean);return ds.length?ds.reduce((m,x)=>x>m?x:m,ds[0]):null;}
function feedToOrderForGroup(g){
  const sheds=shedsForGroup(g).filter(s=>s.placementDate);if(!sheds.length)return null;
  const end=pairEndDate(g);const today=dateOnly(new Date());
  if(!end||end<=today)return null;
  let needSafe=0,needExp=0,booked=0;
  for(let d=addDays(today,1);d<=end;d=addDays(d,1)){
    needSafe+=groupDailyFeedOn(sheds,d);
    needExp+=withResultPlan(()=>groupDailyFeedOn(sheds,d));
    booked+=deliveriesKgOn(g,d);
  }
  const bal=balanceOnEndOfDay(g,today,true);const stock=bal==null?0:bal;
  return {group:g,end,needSafe,needExp,stock,booked,hasReading:bal!=null,
    safe:Math.max(0,needSafe-stock-booked),expected:Math.max(0,needExp-stock-booked),
    leftoverSafe:stock+booked-needSafe,leftoverExp:stock+booked-needExp};
}
function farmFeedToOrder(){
  const per=[1,2,3,4].map(feedToOrderForGroup).filter(Boolean);if(!per.length)return null;
  const sum=k=>per.reduce((s,x)=>s+x[k],0);
  return {per,safe:sum('safe'),expected:sum('expected'),stock:sum('stock'),booked:sum('booked'),needSafe:sum('needSafe'),needExp:sum('needExp'),leftoverExp:sum('leftoverExp')};
}
// Leftover at clean-out WITH expected pickups (negative = short). Replaces
// the old no-pickup balance that showed nonsense like −1,212,470 kg.
function projectedLeftoverForGroup(group){
  const f=feedToOrderForGroup(group);if(!f)return null;
  return {date:f.end,balance:f.leftoverExp,short:f.expected,safeShort:f.safe};
}
function totalFarmLeftover(){const f=farmFeedToOrder();return f?f.leftoverExp:null;}
function groupStatusSummary(g){
  const latest=latestReading(g);if(!latest)return {hasReading:false,balance:null,daysUntil:null};
  const bal=balanceOnEndOfDay(g,new Date());
  const forecast=computeSiloForecast(g,siloRange);
  const depletedDate=forecast.depletedDate;
  const daysUntil=depletedDate?Math.max(0,daysBetween(new Date(),depletedDate)):null;
  return {hasReading:true,balance:bal,daysUntil};
}
function computeFeedSummary(group){return groupLoadSummary(group);}

function setSiloRingsForToday(group,siloNum,rings){
  if(!siloData[group])siloData[group]={readings:[],deliveries:[]};
  const s=siloData[group];const todayIso=iso(new Date());
  let reading=s.readings.find(r=>r.date===todayIso);
  if(!reading){const prev=s.readings.length?s.readings[s.readings.length-1]:null;reading={date:todayIso,silo1Rings:prev?prev.silo1Rings:null,silo2Rings:prev?prev.silo2Rings:null,silo3Rings:prev?prev.silo3Rings:null};s.readings.push(reading);s.readings.sort((a,b)=>a.date.localeCompare(b.date));}
  const key=`silo${siloNum}Rings`;
  reading[key]=(rings===null)?null:normalizeRing(rings);
  reading.time=siloReadTime();
  saveSiloData();schedulePush();render();
}
function deleteSiloReading(group,dateIso){
  const s=siloData[group];if(!s||!Array.isArray(s.readings))return;
  const idx=s.readings.findIndex(r=>r.date===dateIso);if(idx<0)return;
  const d=parseExcelDate(dateIso);
  if(!confirm(`Delete the silo reading from ${fmtShort(d)}?\n\nThe balance projection for this group will change if this was the most recent reading.`))return;
  s.readings.splice(idx,1);saveSiloData();schedulePush();render();
  const newLatest=s.readings.length?s.readings[s.readings.length-1]:null;
  if(newLatest)showToast(`🗑️ Reading deleted — balance now anchored on ${fmtShort(dateOnly(newLatest.date))}.`);
  else showToast('🗑️ Reading deleted — no silo readings left. Tap ring levels to record a new one.');
}
function addTestDelivery(group,dateStr,amountT){
  const d=parseExcelDate(dateStr);if(!d){showToast('Pick a valid date.',true);return false;}
  const amountKg=Number(amountT)*1000;if(!Number.isFinite(amountKg)||amountKg<=0){showToast('Enter a positive amount in tonnes.',true);return false;}
  if(!testDeliveries[group])testDeliveries[group]=[];
  testDeliveries[group].push({id:'test_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),date:d,amountKg,feedType:'',note:''});
  testDeliveries[group].sort((a,b)=>dateOnly(a.date)-dateOnly(b.date));
  render();showToast(`🚜 Test delivery of ${amountT} t added — remember to clear it when done.`);
  return true;
}
// ── Test pickups (session-only what-if, feed forecast only) ──
// Open inline form: {group, dateIso, shedId}
let inlinePickupState=null;
// Suggestion for a shed on a date. Bird counts use the SAME density
// recommendation as Predictions → New Predicted Pickup
// (recommendPickupForDate: remove birds down to the target density):
//  - move: as if the nearest remaining planned pickup happened here instead
//  - add:  an extra pickup with the existing plan left as is
function suggestTestPickup(shedId,dateIso){
  const shed=(farmData&&farmData.sheds||[]).find(s=>s.id===shedId);if(!shed)return {planned:null,recMove:null,recAdd:null,live:0};
  const today=dateOnly(new Date());const target=dateOnly(dateIso);
  const moved=new Set(testPickupsForShed(shedId).filter(t=>t.movedFromId).map(t=>t.movedFromId));
  const cands=(shed.predictedPickups||[]).filter(pp=>pp.date&&dateOnly(pp.date)>=today&&!moved.has(pp.id)&&(Number(pp.birds)||0)>0);
  cands.sort((a,b)=>Math.abs(dateOnly(a.date)-target)-Math.abs(dateOnly(b.date)-target)||dateOnly(a.date)-dateOnly(b.date));
  const planned=cands[0]||null;
  const recAdd=recommendPickupForDate(shed,dateIso);
  const recMove=planned&&iso(dateOnly(planned.date))!==iso(target)?recommendPickupForDate(shed,dateIso,{excludePredictedId:planned.id}):null;
  return {planned,recMove,recAdd,live:recAdd?recAdd.live:0};
}
function defaultShedForTestPickup(group,dateIso){
  const sheds=shedsForGroup(group);const target=dateOnly(dateIso);const today=dateOnly(new Date());
  let best=null,bestGap=Infinity;
  sheds.forEach(s=>(s.predictedPickups||[]).forEach(pp=>{if(!pp.date||dateOnly(pp.date)<today)return;const gap=Math.abs(dateOnly(pp.date)-target);if(gap<bestGap){bestGap=gap;best=s.id;}}));
  return best||(sheds[0]&&sheds[0].id)||null;
}
function toggleInlinePickup(group,dateIso){
  if(inlinePickupState&&inlinePickupState.group===group&&inlinePickupState.dateIso===dateIso){inlinePickupState=null;}
  else{inlineDeliveryState=null;inlinePickupState={group,dateIso,shedId:defaultShedForTestPickup(group,dateIso)};}
  render();
}
function submitInlinePickup(mode){
  const st=inlinePickupState;if(!st)return;
  const input=document.querySelector('.tp-input');
  const sug=suggestTestPickup(st.shedId,st.dateIso);
  const rec=mode==='move'?sug.recMove:sug.recAdd;
  // Untouched field → use the density recommendation for the chosen action
  const birds=st.userEdited?Math.round(Number(input&&input.value)):(rec?rec.recommendedRemove:NaN);
  const max=rec?rec.live:sug.live;
  if(!st.userEdited&&rec&&rec.recommendedRemove<=0){showToast(`Density is already at or below ${rec.targetDensity} kg/m² that day — type a number to add a pickup anyway.`,true);input&&input.focus();return;}
  if(!Number.isFinite(birds)||birds<=0){showToast('Enter how many birds to pick up.',true);input&&input.focus();return;}
  if(birds>max){showToast(`Only ${max.toLocaleString()} birds would be in Shed ${st.shedId} that day.`,true);input&&input.focus();return;}
  const movedFromId=mode==='move'&&sug.planned?sug.planned.id:null;
  (testPickups[st.shedId]=testPickups[st.shedId]||[]).push({id:'tp_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),date:dateOnly(st.dateIso),birds,movedFromId});
  inlinePickupState=null;render();
  showToast(`🐔 Test pickup: ${birds.toLocaleString()} birds from Shed ${st.shedId} on ${fmtShort(dateOnly(st.dateIso))}${movedFromId?` (moved from ${fmtShort(dateOnly(sug.planned.date))})`:''} — session only.`);
}
// Turn a test pickup into a real planned (predicted) pickup.
// A "move" updates the planned pickup it replaced; an extra pickup is
// added, within MAX_PREDICTED_PICKUPS. Saves and syncs.
function commitTestPickup(shedId,id){
  const shed=(farmData&&farmData.sheds||[]).find(s=>s.id===shedId);
  const t=testPickupsForShed(shedId).find(x=>x.id===id);
  if(!shed||!t)return;
  const dIso=iso(dateOnly(t.date));const when=fmtShort(dateOnly(t.date));
  shed.predictedPickups=shed.predictedPickups||[];
  if((shed.pickups||[]).some(p=>iso(dateOnly(p.date))===dIso)){showToast(`Shed ${shedId} already has a logged pickup on ${when}.`,true);return;}
  const moved=t.movedFromId?shed.predictedPickups.find(p=>p.id===t.movedFromId):null;
  const clash=shed.predictedPickups.find(p=>p!==moved&&p.date&&iso(dateOnly(p.date))===dIso);
  if(clash){showToast(`Shed ${shedId} already has a planned pickup on ${when} — edit it in Predictions.`,true);return;}
  // Same limit as Predictions → New Predicted Pickup: real + planned ≤ target
  const targetN=getShedDensitySettings(shed).targetPickups;const realN=(shed.pickups||[]).length;const planN=shed.predictedPickups.length;
  if(!moved&&realN+planN>=targetN){showToast(`Shed ${shedId} already has its target of ${targetN} pickups (${realN} real + ${planN} planned). Move one instead, or change the target in Predictions → Adjust.`,true);return;}
  const birds=Math.round(Number(t.birds)||0);if(birds<=0)return;
  const dayBlocked=(predState.noPickupDays||[]).includes(dateOnly(t.date).getDay());
  const what=moved
    ?`Move Shed ${shedId}'s planned pickup from ${fmtShort(dateOnly(moved.date))} to ${when} (${birds.toLocaleString()} birds).`
    :`Add a planned pickup of ${birds.toLocaleString()} birds to Shed ${shedId} on ${when}.`;
  if(!confirm(`${what}${dayBlocked?`\n\n⚠ ${when} is one of your no-pickup days.`:''}\n\nThis updates Predictions, the dashboard and alerts, and syncs to the cloud.`))return;
  if(moved){moved.date=dateOnly(t.date);moved.birds=birds;}
  else shed.predictedPickups.push({id:uid('pp'),date:dateOnly(t.date),birds,isFinal:false});
  shed.predictedPickups.sort((a,b)=>dateOnly(a.date)-dateOnly(b.date));
  testPickups[shedId]=testPickupsForShed(shedId).filter(x=>x.id!==id);
  saveState();schedulePush();render();
  showToast(`✓ Planned pickup ${moved?'moved to':'added on'} ${when} — ${birds.toLocaleString()} birds, Shed ${shedId}.`);
}
function removeTestPickup(shedId,id){testPickups[shedId]=testPickupsForShed(shedId).filter(t=>t.id!==id);render();showToast('Test pickup removed.');}
function clearTestPickups(group){
  const n=testPickupCountForGroup(group);if(!n)return;
  shedsForGroup(group).forEach(s=>{testPickups[s.id]=[];});inlinePickupState=null;render();
  showToast(`🧹 Cleared ${n} test pickup${n===1?'':'s'}.`);
}
function removeTestDelivery(group,id){if(!testDeliveries[group])return;const before=testDeliveries[group].length;testDeliveries[group]=testDeliveries[group].filter(t=>t.id!==id);if(testDeliveries[group].length!==before){render();showToast('Test delivery removed.');}}
function clearTestDeliveries(group){
  const count=(testDeliveries[group]||[]).length;if(count===0)return;
  if(!confirm(`Clear all ${count} test deliver${count===1?'y':'ies'} from this group?\n\nReal loads are not affected.`))return;
  testDeliveries[group]=[];inlineDeliveryState=null;render();
  showToast(`🧹 Cleared ${count} test deliver${count===1?'y':'ies'}.`);
}
let toastTimer=null;
