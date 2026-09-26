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
function computeEffectivePickups(shed){
  if(!shed)return [];
  const real=(shed.pickups||[]).map(p=>({...p,__source:'real'}));
  const realDates=new Set(real.map(p=>iso(p.date)));
  const predicted=(shed.predictedPickups||[]).filter(pp=>!realDates.has(iso(pp.date))).map(pp=>({date:pp.date,birds:Number(pp.birds)||0,isFinal:!!pp.isFinal,variance:null,totalWeightKg:null,totalWeightKgFromExcel:null,totalWeightKgManual:false,source:'predicted',ageOverride:null,__source:'predicted',__id:pp.id}));
  return [...real,...predicted].sort((a,b)=>dateOnly(a.date)-dateOnly(b.date));
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
function liveAtStartOfDay(shed,D){
  const d=dateOnly(D);if(!shed.placementDate)return 0;if(d<dateOnly(shed.placementDate))return 0;if(shed.cleanoutDate&&d>dateOnly(shed.cleanoutDate))return 0;
  const effective=computeEffectivePickups(shed);
  const sumPickupsOnOrBefore=date=>{const target=dateOnly(date);let total=0;for(const p of effective){if(dateOnly(p.date)<=target)total+=Number(p.birds)||0;}return total;};
  const sumPickupsOn=date=>{const targetIso=iso(date);let total=0;for(const p of effective){if(iso(p.date)===targetIso)total+=Number(p.birds)||0;}return total;};
  const anchor=shed.mortalityUpdatedAt?dateOnly(shed.mortalityUpdatedAt):null;
  const recordedMort=Number(shed.mortality||0);const initPop=Number(shed.initialPopulation)||0;
  if(!anchor||d<=anchor)return Math.max(0,initPop-recordedMort-sumPickupsOnOrBefore(d));
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
  if(!anchor||d<=anchor)return Math.max(0,initPop-recordedMort-sumPickupsBeforeExclusive(d));
  let live=Math.max(0,initPop-recordedMort-sumPickupsOnOrBefore(anchor));
  const rate=shedMortRate(shed)/100;const lastWalkDay=addDays(d,-1);let cursor=addDays(anchor,1);
  while(cursor<=lastWalkDay){live=live*(1-rate);live=Math.max(0,live-sumPickupsOn(cursor));live=Math.round(live);cursor=addDays(cursor,1);}
  return Math.max(0,live);
}
function autoFillPredictedPickups(shed){
  if(!shed||!shed.placementDate)return [];
  const ds=getShedDensitySettings(shed);const trigger=ds.triggerDensity;const targetN=ds.targetPickups;
  const realPickups=shed.pickups||[];const hasRealFinal=realPickups.some(p=>p.isFinal);if(hasRealFinal)return [];
  const realCount=realPickups.length;const needed=targetN-realCount;if(needed<=0)return [];
  const regularNeeded=Math.max(0,needed-1);
  const result=[];const tempShed={...shed,predictedPickups:[]};const today=dateOnly(new Date());
  const cleanout=shed.cleanoutDate?dateOnly(shed.cleanoutDate):addDays(today,50);
  if(cleanout<=today)return [];
  if(regularNeeded>0){
    let searchStart=addDays(today,1);let safety=0;const maxDay=addDays(cleanout,-2);
    while(result.length<regularNeeded&&safety<30){
      safety++;
      let foundDate=null;
      let cursor=searchStart;
      while(cursor<=maxDay){
        const info=densityOnDate(tempShed,cursor,result);
        if(info.density>=trigger){
          // Trigger date hit — but if it lands on a blocked day, push forward
          // to the next allowed pickup day.
          const allowed=nextAllowedPickupDate(cursor);
          if(allowed>maxDay)break;
          foundDate=allowed;
          break;
        }
        cursor=addDays(cursor,1);
      }
      if(!foundDate)break;
      const rec=recommendPickupForDate(tempShed,iso(foundDate),{extraPredicted:result});
      if(!rec||rec.recommendedRemove<500)break;
      result.push({id:uid('pp'),date:foundDate,birds:rec.recommendedRemove,isFinal:false});
      searchStart=addDays(foundDate,3);
    }
  }
  const finalBirds=computeLiveBirdsBefore(shed,cleanout,result);
  if(finalBirds>0)result.push({id:uid('pp'),date:cleanout,birds:finalBirds,isFinal:true});
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
function collectShedWeightAnchors(shed){
  const anchors=[];const bias=currentBiasFactor();const chickW=shedChickWeight(shed);
  anchors.push({t:0,w:chickW,wgt:1.0,source:'day-old'});
  const tc=shed.targetCurve||{};const gridDays=new Set();
  TARGET_DAYS.forEach(day=>{const v=Number(tc[day]);if(Number.isFinite(v)&&v>0){anchors.push({t:day,w:v*bias,wgt:0.65,source:'in-yard-grid'});gridDays.add(day);}});
  (shed.inYardSamples||[]).forEach(s=>{if(!s.date||!(s.avgWeightKg>0))return;const age=sampleAge(shed,s);if(age<=0)return;if(gridDays.has(age))return;const scaled=s.isOfficial?s.avgWeightKg:(s.avgWeightKg*bias);const wgt=s.isOfficial?1.0:0.55;anchors.push({t:age,w:scaled,wgt,source:s.isOfficial?'official-sample':'in-yard-custom'});});
  (shed.pickups||[]).forEach(p=>{const avg=pickupAvgKg(p);if(!avg||avg<=0)return;const age=pickupAge(shed,p);if(age<=0)return;anchors.push({t:age,w:avg,wgt:1.0,source:'pickup'});});
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
function computeShedGompertzFit(shed){
  if(!shed||!shed.placementDate)return null;
  const anchors=collectShedWeightAnchors(shed);if(anchors.length<3)return null;
  let lastT=0;for(const a of anchors){if(a.t>lastT)lastT=a.t;}
  const fit=fitGompertz(anchors);if(!fit)return null;
  fit.lastT=lastT;fit.anchorCount=anchors.length;
  fit.pickupCount=anchors.filter(a=>a.source==='pickup').length;
  fit.sampleCount=anchors.filter(a=>a.source==='in-yard-grid'||a.source==='in-yard-custom'||a.source==='official-sample').length;
  return fit;
}
function getShedGompertzFit(shed){
  if(!shed)return null;
  if(gompertzCache.has(shed.id))return gompertzCache.get(shed.id);
  const fit=computeShedGompertzFit(shed);gompertzCache.set(shed.id,fit);return fit;
}
function gompertzWeightAt(fit,age){if(!fit)return null;if(!Number.isFinite(age)||age<0)return null;const val=fit.A*Math.exp(-fit.b*Math.exp(-fit.k*age));return (Number.isFinite(val)&&val>0)?val:null;}
function gompertzBandFraction(fit,age){if(!fit)return MAX_UNCERTAINTY;const sigmaBase=Math.max(0.018,fit.sigma||0);const daysBeyond=Math.max(0,age-(fit.lastT||0));const extrap=0.004*daysBeyond;const total=Math.sqrt(sigmaBase*sigmaBase+extrap*extrap);return Math.min(MAX_UNCERTAINTY,total);}
function pickupAvgKg(p){if(!p||!p.totalWeightKg||!p.birds)return null;return p.totalWeightKg/p.birds;}
function weightedPickups(shed){return (shed.pickups||[]).filter(p=>p.totalWeightKg&&p.totalWeightKg>0&&p.birds>0).slice().sort((a,b)=>dateOnly(a.date)-dateOnly(b.date));}
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
