function buildDefaultShed(id){return {id,placementDate:null,initialPopulation:DEFAULT_SHED_POPULATION,cleanoutDate:null,mortality:0,mortalityUpdatedAt:null,customFeedKg:null,pickups:[],targetCurve:{7:null,14:null,21:null,28:null},mortalityRatePercent:DEFAULT_MORT_RATE_PCT,chickWeightKg:DEFAULT_CHICK_WEIGHT_KG,inYardSamples:[],predictedPickups:[],targetPickups:null,densitySettings:{useGlobal:true,maxDensity:null,triggerDensity:null,targetDensity:null}};}
function buildDefaultFarmData(batchNumber){return {batchNumber:batchNumber||'',importDate:new Date().toISOString(),fileName:null,biasFactor:DEFAULT_BIAS_FACTOR,sheds:Array.from({length:SHED_COUNT},(_,i)=>buildDefaultShed(i+1))};}
function resetAllToDefaults(batchNumber,opts){
  farmData=buildDefaultFarmData(batchNumber);
  // Farm history stays only for a new batch on the same farm
  if(!(opts&&opts.keepHistory)){predState.farmHistory=[];predState.farmHistoryDeleted=[];}
  predState.projectionLog=[];
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
// Is that day's delivery already in the silo when the reading was taken?
// Evening readings: yes. Morning readings: the per-reading answer, else the farm
// setting (deliveries usually arrive early morning, e.g. 5 am, before readings).
function deliveryTimingEarly(){return predState.deliveryTiming!=='day';}
function readingIncludesDayDelivery(r){if(!readingIsMorning(r))return true;if(r.deliveryIn===true||r.deliveryIn===false)return r.deliveryIn;return deliveryTimingEarly();}
// Loads counted into a reading's stock: everything before its day, plus its own day when already in the silo
function loadBeforeReading(r,ld){const D=dateOnly(r.date);return readingIncludesDayDelivery(r)?ld<=D:ld<D;}
// How true are my readings (Adjust): plan as if the silos hold this share of
// what was read. Measured feed (FCR, projection) always uses the raw reading.
function siloConfidence(){const v=Number(predState.siloConfidencePct);return Number.isFinite(v)&&v>=50&&v<=100?v/100:1;}
function siloSafetyDays(){const v=Number(predState.safetyDays);return Number.isFinite(v)&&v>=0&&v<=3?v:1;}
function readingEndOfDayKg(group,reading,kgOn){
  const base=readingTotalKg(reading)*siloConfidence();
  if(!readingIsMorning(reading))return base;
  const d=dateOnly(reading.date);
  const add=readingIncludesDayDelivery(reading)?0:(kgOn||deliveriesKgOnAll)(group,d);
  return base+add-groupDailyFeedOn(shedsForGroup(group),d);
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
    farmLoads.forEach(l=>{if(!l.date)return;const ld=dateOnly(l.date);if(!loadBeforeReading(r,ld))return;delivered+=loadKgToPairBefore(l,g);});
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
// ── Projection log: one snapshot of the projected result per day ──
// Saved locally and sent with the next normal sync (viewing never pushes);
// merged by day across devices.
function normalizeSnap(x){if(!x||typeof x!=='object'||!/^\d{4}-\d{2}-\d{2}$/.test(String(x.d)))return null;
  const n=v=>Number.isFinite(Number(v))?Number(v):null;
  return {d:String(x.d),feed:n(x.feed),fcr:n(x.fcr),cfcr:n(x.cfcr),alw:n(x.alw),age:n(x.age),liv:n(x.liv),m:String(x.m||''),at:n(x.at)||0};}
function recordProjectionSnapshot(t){
  if(!t||!t.hasData||!Number.isFinite(t.cfcr))return;
  const d=iso(new Date());const log=Array.isArray(predState.projectionLog)?predState.projectionLog:[];
  const snap={d,feed:Math.round(t.totalFeed),fcr:+t.fcr.toFixed(4),cfcr:+t.cfcr.toFixed(4),alw:+t.avgWeight.toFixed(4),age:+t.weightedAge.toFixed(2),liv:+t.livability.toFixed(2),m:MODEL_VERSION,at:Date.now()};
  const i=log.findIndex(x=>x.d===d);const prev=i>=0?log[i]:null;
  if(prev&&prev.m===snap.m&&prev.feed===snap.feed&&prev.cfcr===snap.cfcr&&prev.alw===snap.alw)return;
  if(i>=0)log[i]=snap;else log.push(snap);
  log.sort((a,b)=>a.d.localeCompare(b.d));predState.projectionLog=log.slice(-120);savePredState();
}
function mergeProjectionLog(remote){
  if(!Array.isArray(remote))return;const by={};
  [...(predState.projectionLog||[]),...remote].map(normalizeSnap).filter(Boolean).forEach(x=>{if(!by[x.d]||x.at>by[x.d].at)by[x.d]=x;});
  predState.projectionLog=Object.values(by).sort((a,b)=>a.d.localeCompare(b.d)).slice(-120);
}
// ── Feed plan (per pair × feed type) ──
// Quota = birds placed × kg/bird (starter, grower, finisher; a minimum —
// orders round UP to whole 60 t trucks). Withdrawal = what the birds still
// need until clean-out (from the projection) once the other quotas are met.
const FEED_PLAN_TYPES=['starter','grower','finisher','withdrawal'];
function feedQuotaPerBird(type){const q=predState.feedQuota||{};const v=Number(q[type]);return Number.isFinite(v)&&v>=0?v:(DEFAULT_FEED_QUOTA[type]||0);}
function pairPlacedBirds(g){return shedsForGroup(g).filter(s=>s.placementDate).reduce((n,s)=>n+(Number(s.initialPopulation)||0),0);}
function orderedByPairType(){
  const out={};[1,2,3,4].forEach(g=>{out[g]={};FEED_PLAN_TYPES.concat(['']).forEach(t=>out[g][t]=0);});
  farmLoads.forEach(l=>{const t=FEED_PLAN_TYPES.includes(l.feedType)?l.feedType:'';[1,2,3,4].forEach(g=>{out[g][t]+=loadKgToPairBefore(l,g);});});
  return out;
}
function feedPlan(){
  if(!farmData)return null;
  const ord=orderedByPairType();const pairs=[1,2,3,4].filter(g=>pairPlacedBirds(g)>0);if(!pairs.length)return null;
  const rows={};
  pairs.forEach(g=>{
    const placed=pairPlacedBirds(g);rows[g]={placed,unspecified:ord[g]['']};
    let fixedStill=0;
    ['starter','grower','finisher'].forEach(t=>{const quota=placed*feedQuotaPerBird(t);const still=Math.max(0,quota-ord[g][t]);fixedStill+=still;rows[g][t]={quota,ordered:ord[g][t],still};});
    // Withdrawal: the rest of what the birds need to clean-out
    const f=typeof feedToOrderForGroup==='function'?feedToOrderForGroup(g):null;
    const need=f?Math.max(0,f.expected-fixedStill):0;
    rows[g].withdrawal={quota:null,ordered:ord[g].withdrawal,still:need};
  });
  const trucks={};FEED_PLAN_TYPES.forEach(t=>{const need={};pairs.forEach(g=>need[g]=rows[g][t].still);trucks[t]=packTrucks(need,predState.truckSplitMode);});
  // Farm totals per type; the carry-over from last batch is always withdrawal feed
  const carry=carryoverTotalKg();const farm={};
  FEED_PLAN_TYPES.forEach(t=>{farm[t]={ordered:pairs.reduce((s,g)=>s+rows[g][t].ordered,0)+(t==='withdrawal'?carry:0),quota:t==='withdrawal'?null:pairs.reduce((s,g)=>s+rows[g][t].quota,0),still:pairs.reduce((s,g)=>s+rows[g][t].still,0)};});
  // Next type due per pair: the first one with something still to order
  const next={};pairs.forEach(g=>{next[g]=FEED_PLAN_TYPES.find(t=>rows[g][t].still>=SPLIT_STEP_KG/2)||'withdrawal';});
  return {pairs,rows,trucks,next,farm,carry};
}
// Pack per-pair needs (kg) into whole 60 t trucks; never below the need.
// simple: full 60 to one pair, then 30/30, then one 15/15/15/15.
// any15: any 15 t steps, filling trucks in turn. Spare room goes to the pair
// with the most still to come.
function packTrucks(need,mode){
  const S=SPLIT_STEP_KG,T=TRUCK_KG;const pairs=Object.keys(need).map(Number);
  const a={};pairs.forEach(g=>{a[g]=Math.ceil(Math.max(0,need[g]||0)/S-1e-9)*S;});
  const trucks=[];const add=sp=>trucks.push(sp);
  if(mode==='any15'){
    let cur={},room=T;
    pairs.slice().sort((x,y)=>a[y]-a[x]).forEach(g=>{let left=a[g];while(left>0){const take=Math.min(left,room);cur[g]=(cur[g]||0)+take;left-=take;room-=take;if(room===0){add(cur);cur={};room=T;}}});
    if(room<T){const g=pairs.slice().sort((x,y)=>(need[y]||0)-(need[x]||0))[0];cur[g]=(cur[g]||0)+room;add(cur);}
    return trucks;
  }
  pairs.forEach(g=>{while(a[g]>=T){add({[g]:T});a[g]-=T;}});
  // what's left per pair is 0/15/30/45: halves (30) and a quarter (15)
  const halves=[],quarters=[];
  pairs.forEach(g=>{if(a[g]>=30000){halves.push(g);a[g]-=30000;}if(a[g]>=S){quarters.push(g);a[g]-=S;}});
  // 30/30 trucks; an odd half pairs with the neediest other pair
  halves.sort((x,y)=>x-y);   // neighbours share a truck: 1–2 with 3–4, 5–6 with 7–8
  while(halves.length>=2){const g1=halves.shift(),g2=halves.shift();add({[g1]:30000,[g2]:30000});}
  if(halves.length===1){
    const g1=halves[0];
    if(quarters.length>=2&&quarters.filter(g=>g!==g1).length>=2){const q=quarters.filter(g=>g!==g1).slice(0,2);add({[g1]:30000,[q[0]]:S,[q[1]]:S});q.forEach(g=>quarters.splice(quarters.indexOf(g),1));}
    else{const other=pairs.filter(g=>g!==g1&&(need[g]||0)>0).sort((x,y)=>(need[y]||0)-(need[x]||0))[0];add(other!=null?{[g1]:30000,[other]:30000}:{[g1]:T});}
  }
  // quarters: one 15/15/15/15 truck covers every pair
  if(quarters.length){const sp={};pairs.forEach(g=>sp[g]=S);if(pairs.length<4){const g=pairs.slice().sort((x,y)=>(need[y]||0)-(need[x]||0))[0];sp[g]+=T-S*pairs.length;}add(sp);}
  return trucks;
}
function nextFeedTypeDue(g){try{const p=feedPlan();return p&&p.next[g]?p.next[g]:'';}catch(e){return '';}}
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
// Feed eaten so far, smoothed over every date all pairs were read: fit
// eaten = fixed + rate × (Ross model) and take the fitted value at the
// latest such date, so one odd reading can't swing the total. Fewer than
// 3 dates: the raw figure at the latest one. Pair cut-offs come with it.
function measuredFeedToDate(){
  if(!farmData)return null;
  const groups=[1,2,3,4].filter(g=>shedsForGroup(g).some(s=>s.placementDate));if(!groups.length)return null;
  const byDate={};groups.forEach(g=>readingsSorted(g).forEach(r=>{(byDate[r.date]=byDate[r.date]||{})[g]=r;}));
  const carry=carryoverTotalKg();const pts=[];
  Object.keys(byDate).sort().forEach(ds=>{
    const rs=byDate[ds];if(groups.some(g=>!rs[g]))return;
    let eaten=carry,model=0;const cut={};
    groups.forEach(g=>{const r=rs[g],D=dateOnly(r.date),morning=readingIsMorning(r),end=morning?addDays(D,-1):D;cut[g]=end;
      farmLoads.forEach(l=>{if(!l.date)return;const ld=dateOnly(l.date);if(!loadBeforeReading(r,ld))return;eaten+=loadKgToPairBefore(l,g);});
      eaten-=readingTotalKg(r);
      shedsForGroup(g).filter(s=>s.placementDate).forEach(s=>{for(let d=dateOnly(s.placementDate);d<=end;d=addDays(d,1))model+=shedFeedOnRaw(s,d);});});
    pts.push({date:dateOnly(ds),x:model,y:eaten,cut});
  });
  if(!pts.length)return null;
  const last=pts[pts.length-1];let eaten=last.y,fitted=false;
  if(pts.length>=3){const n=pts.length,mx=pts.reduce((a,p)=>a+p.x,0)/n,my=pts.reduce((a,p)=>a+p.y,0)/n;
    const sxx=pts.reduce((a,p)=>a+(p.x-mx)**2,0),sxy=pts.reduce((a,p)=>a+(p.x-mx)*(p.y-my),0);
    if(sxx>0){const k=sxy/sxx;eaten=(my-k*mx)+k*last.x;fitted=true;}}
  if(!(eaten>0))return null;
  return {asOf:last.date,eaten,raw:last.y,modelAtDate:last.x,cut:last.cut,points:pts.length,fitted};
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
  const start=readingIncludesDayDelivery(latest)?addDays(latestDate,1):latestDate;if(start>today)return 0;
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
  // "Runs out" = stock drops below the safety stock (Adjust: days of feed)
  const safeDays=siloSafetyDays();
  rows.forEach((r,i)=>{const next=rows[i+1];r.safety=safeDays*(next?next.consumption:r.consumption);});
  let depletedDate=null;
  for(const r of rows){if(r.balance!==null&&r.consumption>0&&!r.isPast&&r.balance<=r.safety){depletedDate=r.date;break;}}
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

// ── Per-silo levels ──
// One silo per pair is open at a time (two when a delivery came just as one
// emptied). The latest reading says which are open (else: the emptiest one).
// Birds eat from the open silo(s); when they run out, the silo with the
// oldest feed opens next. Each load goes into the silo picked on the order
// (else the open silo, or the emptiest with room). Pair totals stay the same
// as the feed forecast; this only places the feed in the three silos.
const SILO_CAP_KG=CONE_KG+RING_KG*MAX_RINGS;
function starterSiloOf(g){const n=Number(predState.starterSilo&&predState.starterSilo[g]);return n>=1&&n<=3?n:null;}
function starterBufferDays(){const b=Number(predState.starterBufferDays);return b===14||b===21?b:21;}
// A load's silo(s) for a pair: [first] or [first, then] ("Silo 3+1": fill 3, the rest into 1)
function loadSilosFor(l,g){const v=l&&l.siloFor&&l.siloFor[g];return (Array.isArray(v)?v:[v]).map(Number).filter(n=>n>=1&&n<=3);}
function loadSiloFor(l,g){return loadSilosFor(l,g)[0]||null;}
function siloListLabel(a,g){const l=(Array.isArray(a)?a:a?[a]:[]);return l.length?'Silo '+l.map(n=>g?siloNumber(g,n):n).join('+'):'';}
// Day the pair's last birds leave (feed stops after it)
function pairCleanoutDate(g){let d=null;shedsForGroup(g).forEach(s=>{if(!s.placementDate)return;const f=finalPickupDate(s);if(f&&(!d||f>d))d=f;});return d;}
// From here the starter silo only takes Starter for the next batch: N days
// before clean-out, or the pair's first Finisher load if that is earlier
function starterWindowStart(g){
  const co=pairCleanoutDate(g);let s=co?addDays(co,-starterBufferDays()):null;
  farmLoads.forEach(l=>{if(l.feedType==='finisher'&&Number(l.splitKg&&l.splitKg[g])>0){const d=dateOnly(l.date);if(!s||d<s)s=d;}});
  return s;
}
function isNextBatchStarter(l,g,win){return l.feedType==='starter'&&win&&dateOnly(l.date)>=win;}
// opts: {until: Date, excludeLoadId}
function siloLevelPlan(g,opts){
  const o=opts||{};const r=latestReading(g);if(!r)return null;
  const conf=siloConfidence();const sheds=shedsForGroup(g);const D0=dateOnly(r.date);
  const kg=[r.silo1Rings,r.silo2Rings,r.silo3Rings].map(x=>ringsToKg(x)*conf);
  const starter=starterSiloOf(g);const win=starterWindowStart(g);
  const loads=farmLoads.filter(l=>l.date&&l.id!==o.excludeLoadId&&Number(l.splitKg&&l.splitKg[g])>0);
  const lastFill=[0,0,0];
  loads.forEach(l=>{const d=dateOnly(l.date);if(loadBeforeReading(r,d))loadSilosFor(l,g).forEach(n=>{lastFill[n-1]=Math.max(lastFill[n-1],d.getTime());});});
  const marked=readingOpenField(r).open;
  let open=marked?marked.map(n=>n-1).filter(i=>kg[i]>0):[];
  if(!open.length){const c=[0,1,2].filter(i=>kg[i]>0).sort((a,b)=>((a===starter-1)-(b===starter-1))||(kg[a]-kg[b]));if(c.length)open=[c[0]];}
  const locked=new Set();// starter silo holding next batch's starter: never drawn
  let queue=[0,1,2].filter(i=>kg[i]>0&&!open.includes(i)).sort((a,b)=>(lastFill[a]-lastFill[b])||(a-b));
  const pickTarget=(n,amt)=>{
    if(n)return n-1;
    if(open.length&&SILO_CAP_KG-kg[open[0]]>=amt)return open[0];
    return [0,1,2].filter(i=>i!==starter-1&&!locked.has(i)).sort((a,b)=>kg[a]-kg[b])[0];
  };
  const step=(D,withDel,eatOn)=>{
    const row={date:D,del:[],overflow:[],sw:[],eat:0,short:0};
    if(withDel)loads.filter(l=>iso(l.date)===iso(D)).forEach(l=>{
      const amt=Number(l.splitKg[g])||0;const list=loadSilosFor(l,g);
      const targets=list.length?list.map(n=>n-1):[pickTarget(null,amt)];
      let left=amt;const nb=isNextBatchStarter(l,g,win);
      targets.forEach(i=>{if(left<=0.5||i==null)return;const room=Math.max(0,SILO_CAP_KG-kg[i]);const put=Math.min(room,left);kg[i]+=put;left-=put;
        row.del.push({silo:i+1,kg:put,feedType:l.feedType,loadId:l.id,set:!!list.length});
        if(i===starter-1&&nb){locked.add(i);open=open.filter(x=>x!==i);queue=queue.filter(x=>x!==i);}
        else if(!open.includes(i)&&!queue.includes(i)&&!locked.has(i))queue.push(i);});
      if(left>0.5){const last=targets[targets.length-1];row.overflow.push({silo:last+1,kg:left});
        const j=[0,1,2].filter(x=>!targets.includes(x)&&x!==starter-1).sort((a,b)=>kg[a]-kg[b])[0];
        if(j!=null){const put=Math.min(left,Math.max(0,SILO_CAP_KG-kg[j]));kg[j]+=put;row.del.push({silo:j+1,kg:put,feedType:l.feedType,loadId:l.id,set:false,spill:true});if(!open.includes(j)&&!queue.includes(j))queue.push(j);}}
    });
    let rem=eatOn?groupDailyFeedOn(sheds,D):0;row.eat=rem;
    let guard=0;
    while(rem>0.5&&guard++<12){
      if(!open.length){if(!queue.length)break;open=[queue.shift()];row.sw.push(open[0]+1);}
      const per=rem/open.length;
      open.forEach(i=>{const t=Math.min(kg[i],per);kg[i]-=t;rem-=t;});
      open=open.filter(i=>kg[i]>0.5);[0,1,2].forEach(i=>{if(kg[i]<=0.5)kg[i]=0;});
    }
    row.short=Math.max(0,rem);row.kg=kg.slice();row.open=open.map(i=>i+1);row.next=queue.length?queue[0]+1:null;row.locked=[...locked].map(i=>i+1);
    row.total=kg[0]+kg[1]+kg[2];return row;
  };
  const days=[];
  const start={date:D0,kg:kg.slice(),open:open.map(i=>i+1),marked:!!marked,next:queue.length?queue[0]+1:null,total:kg[0]+kg[1]+kg[2]};
  if(readingIsMorning(r)){
    // morning reading: today's delivery (if not in yet) and today's feed still to come
    const inc=readingIncludesDayDelivery(r);const row=step(D0,!inc,true);days.push(row);
  }
  const until=dateOnly(o.until||addDays(new Date(),14));
  for(let D=addDays(D0,1);D<=until;D=addDays(D,1))days.push(step(D,true,true));
  return {g,start,days,starter,win,reading:r};
}
function siloPlanOn(plan,D){if(!plan)return null;const t=iso(D);for(let i=plan.days.length-1;i>=0;i--)if(iso(plan.days[i].date)<=t)return plan.days[i];return iso(plan.start.date)<=t?plan.start:null;}
// Is the starter silo empty in time for the next batch?
// state: none | pick | ready | ontrack | action ; plus loads of other feed planned into it
function starterSiloStatus(g){
  if(!shedsForGroup(g).some(s=>s.placementDate))return null;
  const co=pairCleanoutDate(g);if(!co)return null;
  const today=dateOnly(new Date());const win=starterWindowStart(g);const inWin=!!win&&today>=win;
  const n=starterSiloOf(g);
  const base={g,co,win,inWin,silo:n,daysToCo:daysBetween(today,co)};
  if(!n)return {...base,state:'pick'};
  const plan=siloLevelPlan(g,{until:addDays(co,1)});
  const wrong=farmLoads.filter(l=>l.date&&loadSilosFor(l,g).includes(n)&&Number(l.splitKg[g])>0&&win&&dateOnly(l.date)>=win&&!isNextBatchStarter(l,g,win)&&dateOnly(l.date)<=co);
  if(!plan)return {...base,state:'noreading',wrong};
  const nowRow=siloPlanOn(plan,today)||plan.start;const nowKg=nowRow.kg[n-1];
  // first day it is empty and stays empty until clean-out (ignoring next batch's starter)
  let emptyOn=null;
  const rows=[plan.start,...plan.days].filter(r=>r.date<=co);
  rows.forEach(r=>{const k=r.kg[n-1];const lockedNow=r.locked&&r.locked.includes(n);if(k<=0.5||lockedNow){if(!emptyOn)emptyOn=r.date;}else emptyOn=null;});
  const isOpen=(nowRow.open||[]).includes(n);
  if(nowKg<=0.5&&emptyOn)return {...base,state:wrong.length?'watch':'ready',kg:0,emptyOn,wrong,isOpen};
  if(emptyOn)return {...base,state:'ontrack',kg:nowKg,emptyOn,wrong,isOpen};
  const avg=Math.max(1,groupDailyFeedOn(shedsForGroup(g),today));
  const daysNeeded=Math.ceil(nowKg/avg);
  const openBy=addDays(co,-daysNeeded-1);
  return {...base,state:'action',kg:nowKg,openBy:openBy<today?today:openBy,late:openBy<today,wrong,isOpen};
}
