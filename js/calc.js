function isCompareAvailable(){try{return window.matchMedia(`(min-width: ${COMPARE_MIN_WIDTH}px)`).matches;}catch(e){return true;}}
function effectiveCompareLayout(){if(feedCompareState.layoutMode==='stacked')return 'stacked';if(feedCompareState.layoutMode==='grid')return 'grid';return 'grid';}
function getDefaultSelectedGroups(currentGroup){const partner=[1,2,3,4].find(g=>g!==currentGroup)||currentGroup;const set=new Set([currentGroup,partner]);return [1,2,3,4].filter(g=>set.has(g));}
function toggleCompareGroup(g){const cur=feedCompareState.selectedGroups.slice();const idx=cur.indexOf(g);if(idx>=0)cur.splice(idx,1);else{cur.push(g);cur.sort((a,b)=>a-b);}feedCompareState.selectedGroups=cur;renderCompareModalBody();}
function toggleCompareColumn(col){if(col==='date')return;const cols={...feedCompareState.visibleColumns};cols[col]=!cols[col];feedCompareState.visibleColumns=cols;renderCompareModalBody();}
function updateStickyHeaderHeight(){const header=document.querySelector('.sticky-header');if(!header)return;const h=header.offsetHeight;if(h>0)document.documentElement.style.setProperty('--sticky-header-h',h+'px');}

function dateOnly(d){const x=new Date(d);x.setHours(0,0,0,0);return x;}
function iso(d){if(!d)return '';const x=dateOnly(d);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;}
function addDays(d,n){const x=new Date(dateOnly(d));x.setDate(x.getDate()+n);return dateOnly(x);}
function daysBetween(a,b){return Math.round((dateOnly(b)-dateOnly(a))/86400000);}
function isWeekend(d){const day=dateOnly(d).getDay();return day===0||day===6;}
function isMilestoneDay(age){return Number.isFinite(age)&&age>0&&age%7===0;}
const WD=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],MO=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtShort(d){if(!d)return '—';const x=dateOnly(d);return `${WD[x.getDay()]} ${String(x.getDate()).padStart(2,'0')} ${MO[x.getMonth()]} ${x.getFullYear()}`;}
function fmtShortNoYear(d){if(!d)return '—';const x=dateOnly(d);return `${WD[x.getDay()]} ${String(x.getDate()).padStart(2,'0')} ${MO[x.getMonth()]}`;}
function todayIso(){return iso(new Date());}
function fmtRelativeTime(ts){if(!ts)return '—';const diff=Date.now()-ts;if(diff<60000)return 'just now';const mins=Math.floor(diff/60000);if(mins<60)return `${mins} min${mins===1?'':'s'} ago`;const hrs=Math.floor(mins/60);if(hrs<24)return `${hrs} hr${hrs===1?'':'s'} ago`;const days=Math.floor(hrs/24);return `${days} day${days===1?'':'s'} ago`;}
function fmtBytes(n){if(!Number.isFinite(n)||n<=0)return '';if(n<1024)return `${n} B`;if(n<1024*1024)return `${(n/1024).toFixed(1)} KB`;return `${(n/1024/1024).toFixed(2)} MB`;}
function uid(prefix){return (prefix||'id')+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);}
function fmtBlocks(n){if(!Number.isFinite(n)||n===0)return '0';const s=n.toFixed(2);return s.replace(/\.?0+$/,'');}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function escapeAttr(s){return escapeHtml(s);}

function parseExcelDate(v){
  if(v==null||v==='')return null;
  if(v instanceof Date&&!isNaN(v.getTime()))return dateOnly(v);
  if(typeof v==='number'&&isFinite(v)){if(v<=0)return null;const ms=Math.round((v-25569)*86400*1000);const utc=new Date(ms);return dateOnly(new Date(utc.getUTCFullYear(),utc.getUTCMonth(),utc.getUTCDate()));}
  let s=String(v).trim();if(!s)return null;s=s.split(' ')[0].trim();
  let m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(m){const d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));return isNaN(d.getTime())?null:dateOnly(d);}
  s=s.replace(/[-.]/g,'/');
  m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(m){const d=new Date(Number(m[3]),Number(m[2])-1,Number(m[1]));return isNaN(d.getTime())?null:dateOnly(d);}
  m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);if(m){const yy2=Number(m[3]);const yy=yy2<=79?2000+yy2:1900+yy2;const d=new Date(yy,Number(m[2])-1,Number(m[1]));return isNaN(d.getTime())?null:dateOnly(d);}
  return null;
}
function isInvalidCleanout(v){if(v==null||v==='')return true;if(typeof v==='number'&&v===0)return true;const s=String(v).trim();if(!s||s==='0/1/1900'||s==='1/1/1900'||s==='1900-01-01')return true;return parseExcelDate(v)===null;}
function parseBool(v){const s=String(v??'').trim().toLowerCase();return s==='true'||s==='yes'||s==='y'||s==='1';}
function getVal(row,keys){for(const k of keys){if(row[k]!==undefined&&row[k]!==null&&String(row[k]).trim()!=='')return row[k];}return '';}

function rossWeightKg(ageDays){
  if(!Number.isFinite(ageDays))return ROSS_308_WEIGHTS_KG[0];
  if(ageDays<=0)return ROSS_308_WEIGHTS_KG[0];
  if(ageDays>=56)return ROSS_308_WEIGHTS_KG[56];
  const ages=Object.keys(ROSS_308_WEIGHTS_KG).map(Number).sort((a,b)=>a-b);
  for(let i=0;i<ages.length-1;i++){const a0=ages[i],a1=ages[i+1];if(ageDays>=a0&&ageDays<=a1){const t=(ageDays-a0)/(a1-a0);return ROSS_308_WEIGHTS_KG[a0]+t*(ROSS_308_WEIGHTS_KG[a1]-ROSS_308_WEIGHTS_KG[a0]);}}
  return ROSS_308_WEIGHTS_KG[56];
}
function findRossAgeForWeight(weightKg){
  const w=Number(weightKg);if(!Number.isFinite(w)||w<=ROSS_308_WEIGHTS_KG[0])return 0;if(w>=ROSS_308_WEIGHTS_KG[56])return 56;
  const ages=Object.keys(ROSS_308_WEIGHTS_KG).map(Number).sort((a,b)=>a-b);
  for(let i=0;i<ages.length-1;i++){const a0=ages[i],a1=ages[i+1];const w0=ROSS_308_WEIGHTS_KG[a0],w1=ROSS_308_WEIGHTS_KG[a1];if(w>=w0&&w<=w1){const t=(w-w0)/(w1-w0);return a0+t*(a1-a0);}}
  return 56;
}
function pickupAge(shed,pickup){if(pickup&&pickup.ageOverride!=null&&Number.isFinite(Number(pickup.ageOverride)))return Math.max(0,Math.floor(Number(pickup.ageOverride)));if(!shed||!shed.placementDate||!pickup||!pickup.date)return 0;return Math.max(0,daysBetween(shed.placementDate,pickup.date));}
function sampleAge(shed,sample){if(sample&&sample.ageOverride!=null&&Number.isFinite(Number(sample.ageOverride)))return Math.max(0,Math.floor(Number(sample.ageOverride)));if(!shed||!shed.placementDate||!sample||!sample.date)return 0;return Math.max(0,daysBetween(shed.placementDate,sample.date));}
function shedChickWeight(shed){if(!shed)return DEFAULT_CHICK_WEIGHT_KG;const v=Number(shed.chickWeightKg);if(!Number.isFinite(v)||v<=0)return DEFAULT_CHICK_WEIGHT_KG;return Math.max(MIN_CHICK_WEIGHT_KG,Math.min(MAX_CHICK_WEIGHT_KG,v));}
function currentBiasFactor(){if(farmData&&Number.isFinite(Number(farmData.biasFactor))){const v=Number(farmData.biasFactor);return Math.max(MIN_BIAS_FACTOR,Math.min(MAX_BIAS_FACTOR,v));}return DEFAULT_BIAS_FACTOR;}
function shedMortRate(shed){if(!shed)return DEFAULT_MORT_RATE_PCT;const v=Number(shed.mortalityRatePercent);if(!Number.isFinite(v)||v<0)return DEFAULT_MORT_RATE_PCT;return Math.max(0,Math.min(MAX_MORT_RATE_PCT,v));}
function estimateShedFinalMortality(shed,finalAge,currentAge){
  const initialPop=Number(shed.initialPopulation)||0;
  if(initialPop<=0)return {currentMortEffective:0,estFinalMort:0,estFinalLive:0,estLivability:0};
  const actualMort=Math.max(0,Number(shed.mortality)||0);const ratePercent=shedMortRate(shed);const dailyRate=ratePercent/100;
  let liveAtNow,mortAtNow;
  if(actualMort>0){liveAtNow=Math.max(0,initialPop-actualMort);mortAtNow=actualMort;}
  else{liveAtNow=initialPop;mortAtNow=0;const simDays=Math.max(0,Math.floor(currentAge));for(let d=0;d<simDays;d++){const loss=liveAtNow*dailyRate;liveAtNow=Math.max(0,liveAtNow-loss);mortAtNow+=loss;}mortAtNow=Math.round(mortAtNow);liveAtNow=Math.max(0,initialPop-mortAtNow);}
  let projectedLive=liveAtNow;let projectedMort=mortAtNow;const daysRemaining=Math.max(0,Math.floor(finalAge-currentAge));
  for(let d=0;d<daysRemaining;d++){const loss=projectedLive*dailyRate;projectedLive=Math.max(0,projectedLive-loss);projectedMort+=loss;}
  const estFinalMort=Math.min(initialPop,Math.round(projectedMort));
  const estFinalLive=Math.max(0,initialPop-estFinalMort);
  const estLivability=(estFinalLive/initialPop)*100;
  return {currentMortEffective:Math.round(mortAtNow),estFinalMort,estFinalLive,estLivability};
}
function getShedDensitySettings(shed){
  const g=predState.densityGlobal||{...DEFAULT_DENSITY_GLOBAL};const o=(shed&&shed.densitySettings)||{};const useGlobal=(o.useGlobal===false)?false:true;
  let targetPickups=DEFAULT_DENSITY_GLOBAL.targetPickups;
  if(shed&&shed.targetPickups!=null&&Number.isFinite(Number(shed.targetPickups)))targetPickups=Math.floor(Number(shed.targetPickups));
  else if(Number.isFinite(Number(g.targetPickups)))targetPickups=Math.floor(Number(g.targetPickups));
  else if(Number.isFinite(Number(g.minPickupsBeforeCleanout)))targetPickups=Math.floor(Number(g.minPickupsBeforeCleanout));
  targetPickups=Math.max(MIN_PICKUPS_PER_SHED,Math.min(MAX_PICKUPS_PER_SHED,targetPickups));
  if(useGlobal)return {maxDensity:Number.isFinite(Number(g.maxDensity))?Number(g.maxDensity):DEFAULT_DENSITY_GLOBAL.maxDensity,triggerDensity:Number.isFinite(Number(g.triggerDensity))?Number(g.triggerDensity):DEFAULT_DENSITY_GLOBAL.triggerDensity,targetDensity:Number.isFinite(Number(g.targetDensity))?Number(g.targetDensity):DEFAULT_DENSITY_GLOBAL.targetDensity,targetPickups,useGlobal:true};
  return {maxDensity:Number.isFinite(Number(o.maxDensity))?Number(o.maxDensity):g.maxDensity,triggerDensity:Number.isFinite(Number(o.triggerDensity))?Number(o.triggerDensity):g.triggerDensity,targetDensity:Number.isFinite(Number(o.targetDensity))?Number(o.targetDensity):g.targetDensity,targetPickups,useGlobal:false};
}
// Session-only "what if" pickups, keyed by shed id. Applied ONLY while the
// feed forecast is computing (includeTestPickups), so they never touch
// predictions, FCR, the dashboard or alerts.
// {id, date, birds, movedFromId} — movedFromId: a planned pickup this
// test replaces (a "move"); null for an extra pickup.
let testPickups={};
let includeTestPickups=false;
// ── Background RESULT PLAN (projection only) ─────────────────────────
// The projected batch result must predict the real end of the batch even
// when the user hasn't entered planned pickups (they often don't, because
// planned pickups also change the feed forecast they order against). So
// the projection uses: logged pickups + the user's planned pickups + an
// AUTO plan that fills the rest (same density rules as Auto-fill) up to
// clean-out. Never saved; recalculated each render. Feed forecast, current
// weights and alerts never see it (includeAutoPlan is only on inside
// projection calculations).
let includeAutoPlan=false;
let autoPlanCache=new Map();
// ── Learned thinning: the first pickup age and size (share of birds
// placed) from sheds already thinned this batch — median across them.
// Used by the auto plan for sheds not thinned yet.
// ── Learned last pickup: age (and weight, when known) of each shed's
// final pickup — this batch's finished sheds plus Farm history.
let finalPickupCache=null;
function learnedFinalPickup(){
  if(finalPickupCache!==null)return finalPickupCache||null;
  const ages=[],weights=[],src={batch:[],history:0};
  ((farmData&&farmData.sheds)||[]).forEach(s=>{
    if(!s.placementDate)return;
    const fin=(s.pickups||[]).find(p=>p.isFinal&&p.date);if(!fin)return;
    ages.push(pickupAge(s,fin));const avg=pickupAvgKg(fin);if(avg>0&&!fin.weightEstimated)weights.push(avg);src.batch.push(s.id);
  });
  (typeof farmHistory==='function'?farmHistory():[]).forEach(r=>{if(r.finalAge>0){ages.push(r.finalAge);src.history++;if(r.finalAvgKg>0)weights.push(r.finalAvgKg);}});
  if(!ages.length){finalPickupCache=false;return null;}
  finalPickupCache={age:Math.round(medianOf(ages)),min:Math.round(Math.min(...ages)),max:Math.round(Math.max(...ages)),weight:weights.length?medianOf(weights):null,n:ages.length,src};
  return finalPickupCache;
}
let thinPatternCache=null;
function learnedThinPattern(){
  if(!FARM_LEARNING)return {age:null,share:null,from:[]};
  if(thinPatternCache)return thinPatternCache;
  const ages=[],shares=[],from=[];
  ((farmData&&farmData.sheds)||[]).forEach(s=>{
    if(!s.placementDate)return;const pop=Number(s.initialPopulation)||0;if(pop<=0)return;
    const real=(s.pickups||[]).filter(p=>p.date&&(Number(p.birds)||0)>0).sort((a,b)=>dateOnly(a.date)-dateOnly(b.date));
    if(!real.length||real[0].isFinal)return;
    ages.push(pickupAge(s,real[0]));shares.push((Number(real[0].birds)||0)/pop);from.push(s.id);
  });
  const med=a=>{const x=a.slice().sort((p,q)=>p-q),n=x.length;return n%2?x[(n-1)/2]:(x[n/2-1]+x[n/2])/2;};
  if(ages.length)thinPatternCache={age:Math.round(med(ages)),share:med(shares),from};
  else{const h=typeof historyThinPrior==='function'?historyThinPrior():null;thinPatternCache=h?{age:h.age,share:h.share,from:[],fromHistory:h.n}:{age:null,share:null,from:[]};}
  return thinPatternCache;
}
// Projection end for a shed. The plant's clean-out date is only an
// estimate (it moves), so when the farm has last-pickup data (Farm history
// or sheds already finished this batch) the shed ends on the day its birds
// reach the farm's usual last-pickup weight — bigger birds go earlier —
// within the farm's range of last-pickup ages; with only ages known, at the
// typical age. Never later than the clean-out date.
function resultPlanEndDate(shed){
  const co=shed.cleanoutDate?dateOnly(shed.cleanoutDate):null;
  const lf=FARM_LEARNING&&typeof learnedFinalPickup==='function'?learnedFinalPickup():null;
  if(lf&&shed.placementDate){
    const place=dateOnly(shed.placementDate),tomorrow=addDays(dateOnly(new Date()),1);
    let age=lf.age;
    if(lf.weight){age=lf.max;for(let a=lf.min;a<=lf.max;a++){const w=forecastWeightModeAware(shed,addDays(place,a));if(w&&w.kg>=lf.weight){age=a;break;}}}
    let end=addDays(place,age);
    if(end<tomorrow)end=co&&co>=tomorrow?co:tomorrow;   // already past it and birds still in
    if(co&&co<end)end=co;
    return end;
  }
  if(co)return co;
  // No clean-out date: when birds reach the pair's target harvest weight
  const g=Math.ceil(shed.id/2);const target=Number(predState.targetHarvestWeightKg&&predState.targetHarvestWeightKg[g])||2.65;
  let d=addDays(dateOnly(new Date()),1);
  for(let i=0;i<80;i++){const w=forecastWeightModeAware(shed,d);if(w&&w.kg>=target)return d;d=addDays(d,1);}
  return addDays(dateOnly(shed.placementDate),52);
}
function autoPlanForShed(shed){
  if(!shed||!shed.placementDate)return [];
  if(autoPlanCache.has(shed.id))return autoPlanCache.get(shed.id);
  let plan=[];
  try{plan=autoFillPredictedPickups(shed,{keepPlanned:true,cleanout:resultPlanEndDate(shed)}).filter(p=>(Number(p.birds)||0)>0);}catch(e){plan=[];}
  autoPlanCache.set(shed.id,plan);return plan;
}
function withResultPlan(fn){const prev=includeAutoPlan;includeAutoPlan=true;try{return fn();}finally{includeAutoPlan=prev;}}
function testPickupsForShed(shedId){return testPickups[shedId]||[];}
function testPickupCountForGroup(g){return shedsForGroup(g).reduce((n,s)=>n+testPickupsForShed(s.id).length,0);}
function computeEffectivePickups(shed){
  if(!shed)return [];
  const real=(shed.pickups||[]).map(p=>({...p,__source:'real'}));
  const realDates=new Set(real.map(p=>iso(p.date)));
  let predicted=(shed.predictedPickups||[]).filter(pp=>!realDates.has(iso(pp.date))).map(pp=>({date:pp.date,birds:Number(pp.birds)||0,isFinal:!!pp.isFinal,variance:null,totalWeightKg:null,totalWeightKgFromExcel:null,totalWeightKgManual:false,source:'predicted',ageOverride:null,__source:'predicted',__id:pp.id}));
  const autos=includeAutoPlan?autoPlanForShed(shed).map(a=>({date:a.date,birds:Number(a.birds)||0,isFinal:!!a.isFinal,variance:null,totalWeightKg:null,totalWeightKgFromExcel:null,totalWeightKgManual:false,source:'auto',ageOverride:null,__source:'auto',__id:a.id})):[];
  let tests=[];
  if(includeTestPickups){
    const list=testPickupsForShed(shed.id);
    const moved=new Set(list.filter(t=>t.movedFromId).map(t=>t.movedFromId));
    if(moved.size)predicted=predicted.filter(p=>!moved.has(p.__id));
    tests=list.map(t=>({date:t.date,birds:Number(t.birds)||0,isFinal:false,variance:null,totalWeightKg:null,totalWeightKgFromExcel:null,totalWeightKgManual:false,source:'test',ageOverride:null,__source:'test',__id:t.id}));
  }
  return [...real,...predicted,...autos,...tests].sort((a,b)=>dateOnly(a.date)-dateOnly(b.date));
}
function densityOnDate(shed,D,extraPredicted,excludePredictedId){
  const d=dateOnly(D);if(!shed.placementDate)return {live:0,weight:0,density:0,age:0};
  const age=ageInDays(shed,d);const weight=(forecastWeightModeAware(shed,d).kg)||0;
  const real=(shed.pickups||[]);const realDates=new Set(real.map(p=>iso(p.date)));
  const predicted=(shed.predictedPickups||[]).filter(pp=>pp.id!==excludePredictedId).filter(pp=>!realDates.has(iso(pp.date))).map(pp=>({date:pp.date,birds:Number(pp.birds)||0}));
  const extra=(extraPredicted||[]).map(pp=>({date:pp.date,birds:Number(pp.birds)||0}));
  const allPickups=[...real,...predicted,...extra].sort((a,b)=>dateOnly(a.date)-dateOnly(b.date));
  const beforeD=allPickups.filter(p=>dateOnly(p.date)<d).reduce((s,p)=>s+(Number(p.birds)||0),0);
  const live=Math.max(0,(shed.initialPopulation||0)-Number(shed.mortality||0)-beforeD);
  const density=(live*weight)/FIXED_FLOOR_AREA_M2;
  return {live,weight,density,age};
}
function recommendPickupForDate(shed,dateIso,opts){
  opts=opts||{};const ds=getShedDensitySettings(shed);const d=parseExcelDate(dateIso);if(!d)return null;
  const info=densityOnDate(shed,d,opts.extraPredicted||null,opts.excludePredictedId);
  const targetBirds=Math.floor((ds.targetDensity*FIXED_FLOOR_AREA_M2)/Math.max(0.0001,info.weight));
  let remove=info.live-targetBirds;if(remove>0)remove=Math.floor(remove/50)*50;else remove=0;
  const afterBirds=Math.max(0,info.live-remove);const afterDensity=(afterBirds*info.weight)/FIXED_FLOOR_AREA_M2;
  return {age:info.age,live:info.live,weight:info.weight,densityBefore:info.density,targetDensity:ds.targetDensity,recommendedRemove:Math.max(0,remove),densityAfter:afterDensity,maxDensity:ds.maxDensity,triggerDensity:ds.triggerDensity};
}
// Recorded deaths are a running total as of the mortality update date.
// Before that date, spread them evenly from placement (they didn't all die
// on day 1) — otherwise past feed is undercounted.
function mortalityByDate(shed,d,anchor){
  const total=Number(shed.mortality||0);if(!(total>0)||!shed.placementDate)return total;
  const end=anchor||dateOnly(new Date());
  const span=daysBetween(shed.placementDate,end);if(span<=0)return total;
  const frac=Math.max(0,Math.min(1,daysBetween(shed.placementDate,d)/span));
  return Math.round(total*frac);
}
function liveAtStartOfDay(shed,D){
  const d=dateOnly(D);if(!shed.placementDate)return 0;if(d<dateOnly(shed.placementDate))return 0;if(shed.cleanoutDate&&d>dateOnly(shed.cleanoutDate))return 0;
  const effective=computeEffectivePickups(shed);
  const sumPickupsOnOrBefore=date=>{const target=dateOnly(date);let total=0;for(const p of effective){if(dateOnly(p.date)<=target)total+=Number(p.birds)||0;}return total;};
  const sumPickupsOn=date=>{const targetIso=iso(date);let total=0;for(const p of effective){if(iso(p.date)===targetIso)total+=Number(p.birds)||0;}return total;};
  const anchor=shed.mortalityUpdatedAt?dateOnly(shed.mortalityUpdatedAt):null;
  const recordedMort=Number(shed.mortality||0);const initPop=Number(shed.initialPopulation)||0;
  if(!anchor||d<=anchor)return Math.max(0,initPop-mortalityByDate(shed,d,anchor)-sumPickupsOnOrBefore(d));
  let live=Math.max(0,initPop-recordedMort-sumPickupsOnOrBefore(anchor));
  const rate=shedMortRate(shed)/100;let cursor=addDays(anchor,1);
  while(cursor<=d){live=live*(1-rate);live=Math.max(0,live-sumPickupsOn(cursor));live=Math.round(live);cursor=addDays(cursor,1);}
  return Math.max(0,live);
}
function computeLiveBirdsBefore(shed,dateObj,extraPredicted){
  const d=dateOnly(dateObj);if(!shed||!shed.placementDate)return 0;if(d<dateOnly(shed.placementDate))return 0;
  const realPickups=shed.pickups||[];const extras=extraPredicted||[];
  const sumPickupsBeforeExclusive=date=>{const target=dateOnly(date);let total=0;for(const p of realPickups){if(dateOnly(p.date)<target)total+=Number(p.birds)||0;}for(const p of extras){if(dateOnly(p.date)<target)total+=Number(p.birds)||0;}return total;};
  const sumPickupsOnOrBefore=date=>{const target=dateOnly(date);let total=0;for(const p of realPickups){if(dateOnly(p.date)<=target)total+=Number(p.birds)||0;}for(const p of extras){if(dateOnly(p.date)<=target)total+=Number(p.birds)||0;}return total;};
  const sumPickupsOn=date=>{const targetIso=iso(date);let total=0;for(const p of realPickups){if(iso(p.date)===targetIso)total+=Number(p.birds)||0;}for(const p of extras){if(iso(p.date)===targetIso)total+=Number(p.birds)||0;}return total;};
  const anchor=shed.mortalityUpdatedAt?dateOnly(shed.mortalityUpdatedAt):null;
  const recordedMort=Number(shed.mortality||0);const initPop=Number(shed.initialPopulation)||0;
  if(!anchor||d<=anchor)return Math.max(0,initPop-mortalityByDate(shed,d,anchor)-sumPickupsBeforeExclusive(d));
  let live=Math.max(0,initPop-recordedMort-sumPickupsOnOrBefore(anchor));
  const rate=shedMortRate(shed)/100;const lastWalkDay=addDays(d,-1);let cursor=addDays(anchor,1);
  while(cursor<=lastWalkDay){live=live*(1-rate);live=Math.max(0,live-sumPickupsOn(cursor));live=Math.round(live);cursor=addDays(cursor,1);}
  return Math.max(0,live);
}

// Auto-fill now produces EXACTLY (targetN − realCount) predicted pickups.
// The target is a hard contract — if the density model can't produce enough
// natural trigger days, the remaining slots are evenly spaced across the
// WHOLE planning window (placement → cleanout − 2), respecting blocked days.
// The final cleanout pickup is always emitted on the cleanout date.
// opts.keepPlanned: keep the user's planned pickups and only plan AFTER
// them ("fill the rest") — used for the background result plan.
// opts.cleanout: end date to plan to (defaults to the shed's clean-out).
const DEFAULT_FINAL_PICKUP_MAX=22000;
function finalPickupMaxBirds(){const v=Number(predState.densityGlobal&&predState.densityGlobal.finalPickupMax);return Number.isFinite(v)&&v>0?v:DEFAULT_FINAL_PICKUP_MAX;}
function autoFillPredictedPickups(shed,opts){
  opts=opts||{};
  if(!shed||!shed.placementDate)return [];
  const ds=getShedDensitySettings(shed);
  const trigger=ds.triggerDensity;
  const targetN=ds.targetPickups;
  const realPickups=shed.pickups||[];
  if(realPickups.some(p=>p.isFinal))return [];
  const realDates=new Set(realPickups.map(p=>iso(p.date)));
  const base=opts.keepPlanned?(shed.predictedPickups||[]).filter(pp=>pp.date&&!realDates.has(iso(pp.date))).map(pp=>({date:dateOnly(pp.date),birds:Number(pp.birds)||0,isFinal:!!pp.isFinal})):[];
  if(base.some(pp=>pp.isFinal))return [];
  const realCount=realPickups.length;
  const needed=targetN-realCount-base.length;
  if(needed<=0&&!opts.keepPlanned)return [];

  const regularNeeded=Math.max(0,needed-1);
  const result=[];
  const tempShed={...shed,predictedPickups:base};
  const today=dateOnly(new Date());
  const cleanout=opts.cleanout?dateOnly(opts.cleanout):(shed.cleanoutDate?dateOnly(shed.cleanoutDate):addDays(today,50));
  if(cleanout<=today)return [];
  const maxDay=addDays(cleanout,-2);
  // Planning starts after the last planned pickup when keeping the user's plan
  const lastBase=base.length?base.reduce((m,p)=>p.date>m?p.date:m,base[0].date):null;
  const planFrom=lastBase&&addDays(lastBase,3)>addDays(today,1)?addDays(lastBase,3):addDays(today,1);

  // ── Phase 0: first thin at the age/size learned from sheds already
  // thinned this batch (only for a shed with no pickups of its own yet)
  let learnedFirst=null;
  if(regularNeeded>0&&realCount===0&&base.length===0){
    const lp=learnedThinPattern();
    if(lp.age){
      let d=nextAllowedPickupDate(addDays(dateOnly(shed.placementDate),lp.age));
      if(d<planFrom)d=nextAllowedPickupDate(planFrom);
      if(d<=maxDay){
        const live=Math.floor(computeLiveBirdsBefore(shed,d,result));
        const birds=Math.max(0,Math.min(live,Math.round((Number(shed.initialPopulation)||0)*lp.share)));
        if(birds>0){learnedFirst={id:uid('pp'),date:d,birds,isFinal:false,learned:true};result.push(learnedFirst);}
      }
    }
  }

  // ── Phase 1: density-triggered regulars ──
  if(regularNeeded>0){
    let searchStart=learnedFirst?addDays(learnedFirst.date,3):planFrom;
    let safety=0;
    while(result.length<regularNeeded&&safety<40){
      safety++;
      let foundDate=null;
      let cursor=searchStart;
      while(cursor<=maxDay){
        const info=densityOnDate(tempShed,cursor,result);
        if(info.density>=trigger){
          const allowed=nextAllowedPickupDate(cursor);
          if(allowed>maxDay)break;
          foundDate=allowed;
          break;
        }
        cursor=addDays(cursor,1);
      }
      if(!foundDate)break;
      const rec=recommendPickupForDate(tempShed,iso(foundDate),{extraPredicted:result});
      const remove=(rec&&rec.recommendedRemove>0)?rec.recommendedRemove:0;
      result.push({id:uid('pp'),date:foundDate,birds:remove,isFinal:false});
      searchStart=addDays(foundDate,3);
    }

    // ── Phase 2: strict fill — fill remaining slots evenly across the
    // WHOLE planning window (not just after the last density pickup).
    // This guarantees we hit the target count whenever the window has
    // enough open (non-blocked) days.
    const remaining=regularNeeded-result.length;
    if(remaining>0){
      // After a learned first thin, the rest of the plan comes after it
      const floor=learnedFirst?addDays(learnedFirst.date,3):planFrom;
      let windowStart=addDays(shed.placementDate,5);
      if(windowStart<floor)windowStart=floor;
      if(windowStart>maxDay)windowStart=maxDay;

      // Collect every allowed day in the window
      const candidates=[];
      let cc=windowStart;
      while(cc<=maxDay){
        if(!isNoPickupDay(cc))candidates.push(dateOnly(cc));
        cc=addDays(cc,1);
      }

      // Exclude days already used by density pickups
      const used=new Set(result.map(x=>iso(x.date)));
      const free=candidates.filter(d=>!used.has(iso(d)));

      if(free.length>0){
        const n=Math.min(remaining,free.length);
        const step=free.length/n;
        for(let i=0;i<n;i++){
          const idx=Math.min(free.length-1,Math.floor((i+0.5)*step));
          const slot=free[idx];
          if(!slot||used.has(iso(slot)))continue;
          used.add(iso(slot));
          const rec=recommendPickupForDate(tempShed,iso(slot),{extraPredicted:result});
          const remove=(rec&&rec.recommendedRemove>0)?rec.recommendedRemove:0;
          result.push({id:uid('pp'),date:slot,birds:remove,isFinal:false});
        }
        result.sort((a,b)=>dateOnly(a.date)-dateOnly(b.date));
      }
    }
  }

  // ── Cap the final pickup (integrators leave ~18–25k for the last load):
  // spread the excess evenly over this plan's regular pickups.
  const cap=finalPickupMaxBirds();
  const regs=result.filter(x=>!x.isFinal);
  if(cap>0&&regs.length){
    const excess=Math.floor(computeLiveBirdsBefore(shed,cleanout,base.concat(result)))-cap;
    if(excess>0){const each=Math.ceil(excess/regs.length);regs.forEach(x=>{x.birds+=each;});}
  }

  // ── Phase 3: final cleanout — always emitted ──
  const finalBirds=computeLiveBirdsBefore(shed,cleanout,base.concat(result));
  result.push({id:uid('pp'),date:cleanout,birds:Math.max(0,Math.floor(finalBirds)),isFinal:true});
  return result;
}

function reconcilePredictedPickups(shed){
  if(!shed)return;const real=shed.pickups||[];
  if(real.some(p=>p.isFinal)){shed.predictedPickups=[];return;}
  const realDates=new Set(real.map(p=>iso(p.date)));
  shed.predictedPickups=(shed.predictedPickups||[]).filter(pp=>!realDates.has(iso(pp.date)));
  if(shed.cleanoutDate){(shed.predictedPickups||[]).forEach(pp=>{if(pp.isFinal)pp.date=dateOnly(shed.cleanoutDate);});shed.predictedPickups.sort((a,b)=>dateOnly(a.date)-dateOnly(b.date));}
}

/* ── No-pickup days (e.g. Fri/Sat/Sun when the plant doesn't run) ── */
function isNoPickupDay(date){
  const list=predState.noPickupDays||[];
  if(!list.length)return false;
  return list.includes(dateOnly(date).getDay());
}
function nextAllowedPickupDate(date){
  let d=dateOnly(date);let guard=0;
  while(isNoPickupDay(d)&&guard<14){d=addDays(d,1);guard++;}
  return d;
}
function countPredictedPickupsOnBlockedDays(shed){
  if(!shed||!Array.isArray(shed.predictedPickups))return 0;
  if(!(predState.noPickupDays||[]).length)return 0;
  return shed.predictedPickups.filter(pp=>isNoPickupDay(pp.date)).length;
}

/* Recalculate the final cleanout pickup = "whatever's left at cleanout". */
function recalcFinalPredictedBirds(shed){
  if(!shed||!Array.isArray(shed.predictedPickups))return;
  if(!shed.cleanoutDate)return;
  const finalPp=shed.predictedPickups.find(pp=>pp.isFinal);
  if(!finalPp)return;
  const priorRegular=shed.predictedPickups.filter(pp=>!pp.isFinal).map(pp=>({date:pp.date,birds:Number(pp.birds)||0}));
  const remaining=computeLiveBirdsBefore(shed,shed.cleanoutDate,priorRegular);
  finalPp.birds=Math.max(0,Math.floor(remaining));
}

/* Cascade: after editing a regular predicted pickup, resize every regular
   pickup AFTER it to hit target density, then resize the final to absorb
   the remainder. Dates never move — only bird counts. */
function cascadePredictedPickups(shed,editedPpId){
  if(!shed||!Array.isArray(shed.predictedPickups))return;
  if(!shed.placementDate)return;
  const working=shed.predictedPickups.slice().sort((a,b)=>dateOnly(a.date)-dateOnly(b.date));
  const editIdx=working.findIndex(pp=>pp.id===editedPpId);
  if(editIdx<0)return;
  // Point shed at working so densityOnDate() sees the updated values mid-walk.
  shed.predictedPickups=working;
  for(let i=editIdx+1;i<working.length;i++){
    const pp=working[i];
    if(pp.isFinal)continue;
    const rec=recommendPickupForDate(shed,iso(pp.date),{excludePredictedId:pp.id});
    if(rec&&Number.isFinite(rec.recommendedRemove))pp.birds=rec.recommendedRemove;
  }
  recalcFinalPredictedBirds(shed);
}

// Scale correction for a shed: its own override if set, else the global.
// Applies ONLY to in-yard (shed-scale) readings — never to plant weights.
function shedBiasFactor(shed){
  const o=shed?shed.scaleOverride:null;
  if(o!=null&&Number.isFinite(Number(o))&&Number(o)>0)return Math.max(MIN_BIAS_FACTOR,Math.min(MAX_BIAS_FACTOR,Number(o)));
  return currentBiasFactor();
}
// Scale-correction evidence from official plant weights: fit a curve to the
// shed's in-yard readings AS ENTERED (100%), read it at each weighed
// pickup's age, and compare: plant weight ÷ in-yard curve = the shed scale's
// error at that pickup. Only pickups within 7 days of the last in-yard
// reading count (further out would measure curve stretch, not the scale);
// estimated (kill-sheet) weights never count.
function plantScaleRatios(shed){
  if(!shed||!shed.placementDate)return [];
  const anchors=[{t:0,w:shedChickWeight(shed),wgt:1.0}];
  const tc=shed.targetCurve||{};const gridDays=new Set();
  TARGET_DAYS.forEach(day=>{const v=Number(tc[day]);if(Number.isFinite(v)&&v>0){anchors.push({t:day,w:v,wgt:0.65});gridDays.add(day);}});
  (shed.inYardSamples||[]).forEach(s=>{if(!s.date||!(s.avgWeightKg>0)||s.isOfficial)return;const age=sampleAge(shed,s);if(age<=0||gridDays.has(age))return;anchors.push({t:age,w:s.avgWeightKg,wgt:0.55});});
  if(anchors.length<3)return [];
  const lastT=anchors.reduce((m,a)=>Math.max(m,a.t),0);
  const fit=fitGompertz(anchors);if(!fit)return [];
  return (shed.pickups||[]).filter(p=>!p.weightEstimated&&pickupAvgKg(p)>0).map(p=>{
    const age=pickupAge(shed,p);if(age<=0||age>lastT+7)return null;
    const w=gompertzWeightAt(fit,age);if(!(w>0))return null;
    return {shedId:shed.id,age,ratio:pickupAvgKg(p)/w,date:p.date};
  }).filter(Boolean);
}
function medianOf(arr){const a=arr.slice().sort((x,y)=>x-y);const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;}
// Suggested correction from a set of sheds (median — robust to one odd pickup)
function suggestScaleCorrection(sheds){
  const ratios=[];(sheds||[]).forEach(s=>plantScaleRatios(s).forEach(r=>ratios.push(r.ratio)));
  if(!ratios.length)return null;
  const clamp=v=>Math.max(MIN_BIAS_FACTOR,Math.min(MAX_BIAS_FACTOR,v));
  return {value:clamp(medianOf(ratios)),n:ratios.length,min:clamp(Math.min(...ratios)),max:clamp(Math.max(...ratios))};
}
function collectShedWeightAnchors(shed){
  const anchors=[];const bias=shedBiasFactor(shed);const chickW=shedChickWeight(shed);
  anchors.push({t:0,w:chickW,wgt:1.0,source:'day-old'});
  const tc=shed.targetCurve||{};const gridDays=new Set();
  TARGET_DAYS.forEach(day=>{const v=Number(tc[day]);if(Number.isFinite(v)&&v>0){anchors.push({t:day,w:v*bias,wgt:0.65,source:'in-yard-grid'});gridDays.add(day);}});
  (shed.inYardSamples||[]).forEach(s=>{if(!s.date||!(s.avgWeightKg>0))return;const age=sampleAge(shed,s);if(age<=0)return;if(gridDays.has(age))return;const scaled=s.isOfficial?s.avgWeightKg:(s.avgWeightKg*bias);const wgt=s.isOfficial?1.0:0.55;anchors.push({t:age,w:scaled,wgt,source:s.isOfficial?'official-sample':'in-yard-custom'});});
  // Estimated (kill-sheet, not yet weighed) weights are NOT measurements — never fit to them
  (shed.pickups||[]).forEach(p=>{if(p.weightEstimated)return;const avg=pickupAvgKg(p);if(!avg||avg<=0)return;const age=pickupAge(shed,p);if(age<=0)return;anchors.push({t:age,w:avg,wgt:1.0,source:'pickup'});});
  return anchors;
}
function fitLinearGompertz(anchors,k){
  let sW=0,sWz=0,sWy=0,sWzz=0,sWzy=0;
  for(const a of anchors){if(!(a.w>0))continue;const z=Math.exp(-k*a.t);const y=Math.log(a.w);sW+=a.wgt;sWz+=a.wgt*z;sWy+=a.wgt*y;sWzz+=a.wgt*z*z;sWzy+=a.wgt*z*y;}
  const denom=sW*sWzz-sWz*sWz;if(Math.abs(denom)<1e-12)return null;
  const c=(sWy*sWzz-sWz*sWzy)/denom;const m=(sW*sWzy-sWz*sWy)/denom;const lnA=c;const b=-m;
  if(!isFinite(lnA)||!isFinite(b))return null;if(b<=0)return null;
  const A=Math.exp(lnA);if(!isFinite(A)||A<=0||A>GOMPERTZ_A_MAX)return null;
  let err=0,totW=0;
  for(const a of anchors){if(!(a.w>0))continue;const pred=A*Math.exp(-b*Math.exp(-k*a.t));if(!(pred>0))return null;const e=Math.log(pred)-Math.log(a.w);err+=a.wgt*e*e;totW+=a.wgt;}
  const sigma=totW>0?Math.sqrt(err/totW):0;
  return {A,b,k,err,sigma};
}
function fitGompertz(anchors){
  if(!anchors||anchors.length<3)return null;let best=null;
  for(let k=GOMPERTZ_K_MIN;k<=GOMPERTZ_K_MAX;k+=0.002){const fit=fitLinearGompertz(anchors,k);if(fit&&(!best||fit.err<best.err))best=fit;}
  if(!best)return null;
  const k0=best.k;const kLo=Math.max(GOMPERTZ_K_MIN,k0-0.005);const kHi=Math.min(GOMPERTZ_K_MAX,k0+0.005);
  for(let k=kLo;k<=kHi;k+=0.0002){const fit=fitLinearGompertz(anchors,k);if(fit&&fit.err<best.err)best=fit;}
  return best;
}
// Ross 308 guide points for the weeks AFTER the last real reading.
// With only early readings (before growth peaks) the S-curve can't tell
// where birds level off and extrapolates wildly (e.g. 6+ kg at day 57).
// Light points on the Ross 308 shape — scaled by how THIS shed tracks
// Ross at its latest reading — keep the outlook realistic. Weight 0.15
// (~¼ of a shed-scale reading), and only past the last reading, so real
// readings and weighed pickups always win.
const GUIDE_DAYS=[35,42,49,56],GUIDE_WEIGHT=0.15;
function rossGuideAnchors(anchors){
  const real=anchors.filter(a=>a.t>0&&a.w>0);if(!real.length)return [];
  const last=real.reduce((m,a)=>a.t>m.t?a:m,real[0]);
  const rossLast=rossWeightKg(last.t);if(!(rossLast>0))return [];
  const ratio=last.w/rossLast;
  return GUIDE_DAYS.filter(d=>d>last.t+6).map(d=>({t:d,w:rossWeightKg(d)*ratio,wgt:GUIDE_WEIGHT,source:'guide'}));
}
function computeShedGompertzFit(shed){
  if(!shed||!shed.placementDate)return null;
  const anchors=collectShedWeightAnchors(shed);if(anchors.length<3)return null;
  // lastT = last REAL reading, so the ± band still widens beyond real data
  let lastT=0;for(const a of anchors){if(a.t>lastT)lastT=a.t;}
  const guides=rossGuideAnchors(anchors);
  const fit=fitGompertz(anchors.concat(guides));if(!fit)return null;
  fit.guideCount=guides.length;
  fit.lastT=lastT;fit.anchorCount=anchors.length;
  fit.pickupCount=anchors.filter(a=>a.source==='pickup').length;
  fit.sampleCount=anchors.filter(a=>a.source==='in-yard-grid'||a.source==='in-yard-custom'||a.source==='official-sample').length;
  return fit;
}
// ── Batch KPIs: the ONE place FCR / cFCR / PIF are calculated ──
// FCR = total feed ÷ total live weight
// ALW = total live weight ÷ total birds picked up
// Avg age = Σ(age × birds) ÷ total birds picked up
// Livability = 100 − mortality %
// cFCR (Baiada) = FCR − (ALW − 2.45) × β (0.27)
// cFCR (Industry) = FCR − (ALW − target) ÷ 3.2 (target from Adjust)
// PIF = livability × ALW ÷ (avg age × FCR) × 100
const CFCR_REF_KG=2.45,CFCR_BAIADA_BETA=0.27,CFCR_INDUSTRY_DIV=3.2,CAGE_FCR=2.45;
function batchKpis(o){
  const feed=Number(o.feedKg)||0,lw=Number(o.liveWeightKg)||0,birds=Number(o.birds)||0,placed=Number(o.placed)||0;
  const fcr=lw>0?feed/lw:0;
  const alw=birds>0?lw/birds:0;
  const avgAge=birds>0?(Number(o.ageBirdSum)||0)/birds:0;
  const livability=placed>0?100-(Math.max(0,Number(o.mortality)||0)/placed*100):0;
  const beta=CFCR_BAIADA_BETA;
  const target=Number(o.targetKg)>0?Number(o.targetKg):CFCR_REF_KG;
  const cfcr=fcr>0?fcr-(alw-CFCR_REF_KG)*beta:0;
  const cfcrInd=fcr>0?fcr-(alw-target)/CFCR_INDUSTRY_DIV:0;
  const pif=(avgAge>0&&fcr>0)?(livability*alw)/(avgAge*fcr)*100:0;
  return {fcr,alw,avgAge,livability,cfcr,cfcrInd,pif,beta,target};
}
function pairTargetKg(g){return Number(predState.targetHarvestWeightKg&&predState.targetHarvestWeightKg[g])||2.65;}
// CAge2.45: age (days) when a bird's cumulative FCR reaches 2.45 — its
// cumulative intake ÷ its weight, along the shed's growth curve. Beyond
// day 60 intake stays at the table's last value. null = not within 100 d.
function shedCAge245(shed){
  if(!shed||!shed.placementDate)return null;
  const fit=getShedGompertzFit(shed);
  let cum=0;
  for(let a=1;a<=100;a++){
    cum+=feedPerBirdKg(shed,a);
    if(a<14)continue;
    const w=(fit&&gompertzWeightAt(fit,a))||rossWeightKg(a);
    if(w>0&&cum/w>=CAGE_FCR)return a;
  }
  return null;
}
function cAge245ForSheds(sheds){
  let sum=0,n=0;
  sheds.forEach(s=>{const a=shedCAge245(s);const b=Number(s.initialPopulation)||0;if(a&&b>0){sum+=a*b;n+=b;}});
  return n>0?sum/n:null;
}
function getShedGompertzFit(shed){
  if(!shed)return null;
  if(gompertzCache.has(shed.id))return gompertzCache.get(shed.id);
  const fit=computeShedGompertzFit(shed);gompertzCache.set(shed.id,fit);return fit;
}
function gompertzWeightAt(fit,age){if(!fit)return null;if(!Number.isFinite(age)||age<0)return null;const val=fit.A*Math.exp(-fit.b*Math.exp(-fit.k*age));return (Number.isFinite(val)&&val>0)?val:null;}
function gompertzBandFraction(fit,age){if(!fit)return MAX_UNCERTAINTY;const sigmaBase=Math.max(0.018,fit.sigma||0);const daysBeyond=Math.max(0,age-(fit.lastT||0));const extrap=0.004*daysBeyond;const total=Math.sqrt(sigmaBase*sigmaBase+extrap*extrap);return Math.min(MAX_UNCERTAINTY,total);}
function pickupAvgKg(p){if(!p||!p.totalWeightKg||!p.birds)return null;return p.totalWeightKg/p.birds;}
// Pickups with a REAL weighing (estimated kill-sheet weights excluded)
function weightedPickups(shed){return (shed.pickups||[]).filter(p=>p.totalWeightKg&&p.totalWeightKg>0&&p.birds>0&&!p.weightEstimated).slice().sort((a,b)=>dateOnly(a.date)-dateOnly(b.date));}
function lastWeightedPickup(shed){const arr=weightedPickups(shed);return arr.length?arr[arr.length-1]:null;}
function observedDailyGain(shed){
  const arr=weightedPickups(shed);if(arr.length===0)return null;
  if(arr.length===1){const p=arr[0];const age=pickupAge(shed,p);const avg=pickupAvgKg(p);if(age<=0||avg==null)return null;return (avg-ROSS_308_WEIGHTS_KG[0])/age;}
  const first=arr[0];const last=arr[arr.length-1];
  const a0=pickupAge(shed,first);const a1=pickupAge(shed,last);const w0=pickupAvgKg(first);const w1=pickupAvgKg(last);
  if(a1<=a0||w0==null||w1==null)return null;
  return (w1-w0)/(a1-a0);
}
function forecastFromPickups(shed,date){
  const last=lastWeightedPickup(shed);if(!last)return null;
  const lastAge=pickupAge(shed,last);const lastW=pickupAvgKg(last);const targetAge=ageInDays(shed,date);
  if(targetAge<=lastAge)return lastW;
  const g=observedDailyGain(shed)||0;return lastW+(targetAge-lastAge)*g;
}
function getTargetCurve(shed){
  const t=shed.targetCurve||{};const pts=[];
  TARGET_DAYS.forEach(day=>{const v=Number(t[day]);if(Number.isFinite(v)&&v>0)pts.push({day,kg:v});});
  return pts.sort((a,b)=>a.day-b.day);
}
function hasTargetCurve(shed){return getTargetCurve(shed).length>0;}
function forecastFromTargetCurve(shed,date){
  const pts=getTargetCurve(shed);if(pts.length===0)return null;
  const age=ageInDays(shed,date);if(age<=0)return ROSS_308_WEIGHTS_KG[0];
  const anchors=[{day:0,kg:ROSS_308_WEIGHTS_KG[0]},...pts];
  if(age<=anchors[0].day)return anchors[0].kg;
  if(age>=anchors[anchors.length-1].day){const last=anchors[anchors.length-1];const prev=anchors[anchors.length-2]||{day:0,kg:ROSS_308_WEIGHTS_KG[0]};const slope=(last.kg-prev.kg)/(last.day-prev.day);return Math.max(0,last.kg+(age-last.day)*slope);}
  for(let i=0;i<anchors.length-1;i++){const a0=anchors[i],a1=anchors[i+1];if(age>=a0.day&&age<=a1.day){const t=(age-a0.day)/(a1.day-a0.day);return a0.kg+t*(a1.kg-a0.kg);}}
  return null;
}
function forecastWeightModeAware(shed,date){
  const age=ageInDays(shed,date);const fit=getShedGompertzFit(shed);
  if(fit){const kg=gompertzWeightAt(fit,age);if(kg!=null){const band=gompertzBandFraction(fit,age);return {kg,mode:'gompertz',band,fit};}}
  const anchors=collectShedWeightAnchors(shed);
  if(anchors.length===2){const last=anchors[1];const rossAtLast=rossWeightKg(last.t);if(rossAtLast>0){const ratio=last.w/rossAtLast;const kg=rossWeightKg(age)*ratio;return {kg,mode:'ross-scaled',band:0.10};}}
  const last=lastWeightedPickup(shed);
  if(last)return {kg:forecastFromPickups(shed,date),mode:'ai-pickup',band:0.10};
  if(hasTargetCurve(shed)){const kg=forecastFromTargetCurve(shed,date);if(kg!=null)return {kg,mode:'ai-target',band:0.12};}
  return {kg:rossWeightKg(age),mode:'standard',band:0.15};
}
function daysVsTarget(currentAge,currentWeightKg){if(!Number.isFinite(currentAge)||!Number.isFinite(currentWeightKg)||currentWeightKg<=0)return null;const rossAge=findRossAgeForWeight(currentWeightKg);return rossAge-currentAge;}
function ageInDays(shed,onDate=new Date()){if(!shed.placementDate)return 0;return Math.max(0,daysBetween(shed.placementDate,onDate));}
