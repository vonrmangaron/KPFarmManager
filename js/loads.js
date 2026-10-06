function totalPicked(shed){return (shed.pickups||[]).reduce((s,p)=>s+(Number(p.birds)||0),0);}
function mortalityRate(shed){if(!shed.initialPopulation)return 0;return (Number(shed.mortality||0)/shed.initialPopulation)*100;}
function finalPickupOf(shed){return (shed.pickups||[]).find(p=>p.isFinal);}
function shedsForGroup(g){if(!farmData)return [];const a=farmData.sheds[(g-1)*2];const b=farmData.sheds[(g-1)*2+1];return [a,b].filter(Boolean);}
// Daily feed per bird: Ross 308 intake for the age × the shed's intake %
// (feedAdjustPct, default 100). A flat kg/bird override is no longer used —
// it applied one number to every age (day 1 to clean-out).
function shedFeedPct(shed){migrateCustomFeed(shed);const p=Number(shed.feedAdjustPct);return Number.isFinite(p)&&p>0?Math.max(50,Math.min(150,p)):100;}
function feedPerBirdKg(shed,ageDays){if(ageDays<=0)return 0;const age=Math.min(60,Math.max(1,Math.floor(ageDays)));return (ROSS_308_FEED_INTAKE[age]||234)/1000*shedFeedPct(shed)/100;}
// Old 'Custom feed (kg/bird)' → % of Ross at the shed's current age
function migrateCustomFeed(shed){
  if(!shed||shed.customFeedKg==null||!(Number(shed.customFeedKg)>0))return;
  const a=ageInDays(shed,new Date());
  if(a>0){const ross=(ROSS_308_FEED_INTAKE[Math.min(60,Math.floor(a))]||234)/1000;
    shed.feedAdjustPct=Math.round(Math.max(50,Math.min(150,Number(shed.customFeedKg)/ross*100)));}
  shed.customFeedKg=null;
}
// Silo is switched off at 7am the day before clean-out (birds leave that
// night, kill sheet is the clean-out date), so that day is 7/24 of a feed day.
const FINAL_DAY_FEED_FRACTION=7/24;
function shedFeedOn(shed,D){
  const kg=shedFeedOnRaw(shed,D);if(!FARM_LEARNING||!(kg>0)||hasManualFeedPct(shed))return kg;
  const cal=intakeCalibration();const cut=cal.cutoff&&cal.cutoff[Math.ceil(shed.id/2)];
  if(cal.pastScale!=null&&cut&&dateOnly(D)<=cut)return kg*cal.pastScale;
  return kg*cal.factor;
}
function shedFeedOnRaw(shed,D){const age=ageInDays(shed,D);const live=liveAtStartOfDay(shed,D);if(age<=0||live<=0)return 0;const kg=live*feedPerBirdKg(shed,age);const fin=finalPickupDate(shed);if(fin&&daysBetween(dateOnly(D),fin)===1)return kg*FINAL_DAY_FEED_FRACTION;return kg;}
// Day the last birds leave (kill-sheet date): a final pickup (logged, planned
// or auto in projections), else the clean-out date. Silo goes off at 7am the day before.
function finalPickupDate(shed){const f=computeEffectivePickups(shed).find(p=>p.isFinal&&p.date);if(f)return dateOnly(f.date);return shed.cleanoutDate?dateOnly(shed.cleanoutDate):null;}
function hasManualFeedPct(shed){const p=Number(shed&&shed.feedAdjustPct);return Number.isFinite(p)&&p>0;}
// ── Learned intake ──
// Feed eaten is measured at every date all pairs have a silo reading:
// carry-over + loads delivered up to the reading − silo stock. Fitting
// eaten = fixed + rate × (Ross-table intake) across those dates gives:
//  • rate  — how these birds really eat per day vs the Ross table. A fixed
//            amount (feed in lines/pans, carry-over or ring-reading bias)
//            cancels out, so it can't masquerade as "eating more".
//  • past  — feed up to the latest reading scaled to exactly what was measured.
// Days after a pair's latest reading use the rate; days up to it the past
// scale. Rate bounded 85–115%; needs ≥ 3 reading dates over ≥ 6 days and
// ≥ 100 t of intake between them, else the farm's history, else 100%.
const INTAKE_CAL_MIN=0.85,INTAKE_CAL_MAX=1.15,INTAKE_CAL_MIN_KG=20000;
let intakeCalCache=null;
function intakeCalibration(){
  if(intakeCalCache)return intakeCalCache;
  intakeCalCache={factor:1,ok:false,pastScale:null,cutoff:{},reason:'Not enough silo readings yet'};
  try{
    if(!farmData||typeof feedEatenMeasured!=='function')return intakeCalCache;
    const groups=[1,2,3,4].filter(g=>shedsForGroup(g).some(s=>s.placementDate));if(!groups.length)return intakeCalCache;
    // Raw (Ross-table) intake per shed per day, cached for this pass
    const rawCum=new Map();
    const rawTo=(s,end)=>{let m=rawCum.get(s.id);if(!m){m=[];rawCum.set(s.id,m);}const k=iso(end);if(m[k]!=null)return m[k];let sum=0;for(let d=dateOnly(s.placementDate);d<=end;d=addDays(d,1))sum+=shedFeedOnRaw(s,d);m[k]=sum;return sum;};
    // One point per date where every placed pair has a reading
    const byDate={};groups.forEach(g=>readingsSorted(g).forEach(r=>{(byDate[r.date]=byDate[r.date]||{})[g]=r;}));
    const pts=[];const carry=carryoverTotalKg();
    Object.keys(byDate).sort().forEach(ds=>{
      const rs=byDate[ds];if(groups.some(g=>!rs[g]))return;
      let eaten=carry,manual=0,auto=0;
      groups.forEach(g=>{const r=rs[g],D=dateOnly(r.date),morning=readingIsMorning(r),end=morning?addDays(D,-1):D;
        farmLoads.forEach(l=>{if(!l.date)return;const ld=dateOnly(l.date);if(!loadBeforeReading(r,ld))return;eaten+=loadKgToPairBefore(l,g);});
        eaten-=readingTotalKg(r);
        shedsForGroup(g).filter(s=>s.placementDate).forEach(s=>{const v=rawTo(s,end);if(hasManualFeedPct(s))manual+=v;else auto+=v;});});
      pts.push({date:ds,x:auto,y:eaten-manual});
    });
    // Past: the latest reading per pair (feedEatenMeasured), scaled to measured
    const m=feedEatenMeasured();
    const cutoff={};m.pairs.forEach(p=>{cutoff[p.g]=p.morning?addDays(p.date,-1):p.date;});
    let pastScale=null,model=0,manualPast=0;
    if(!m.missing.length&&m.pairs.length){
      m.pairs.forEach(p=>p.sheds.forEach(s=>{const v=rawTo(s,cutoff[p.g]);if(hasManualFeedPct(s))manualPast+=v;else model+=v;}));
      if(model>=INTAKE_CAL_MIN_KG&&m.eaten>manualPast)pastScale=(m.eaten-manualPast)/model;
      // A wildly different total means a reading or docket is wrong — don't trust it
      if(pastScale!=null&&(pastScale<0.7||pastScale>1.3))pastScale=null;
    }
    // Rate: least-squares slope across the reading dates
    let rate=null,fixed=null;
    const span=pts.length>=2?daysBetween(dateOnly(pts[0].date),dateOnly(pts[pts.length-1].date)):0;
    if(pts.length>=3&&span>=6&&pts[pts.length-1].x-pts[0].x>=100000){
      const n=pts.length,mx=pts.reduce((a,p)=>a+p.x,0)/n,my=pts.reduce((a,p)=>a+p.y,0)/n;
      const sxx=pts.reduce((a,p)=>a+(p.x-mx)**2,0),sxy=pts.reduce((a,p)=>a+(p.x-mx)*(p.y-my),0);
      if(sxx>0){rate=sxy/sxx;fixed=my-rate*mx;}
    }
    if(rate==null){const h=typeof historyIntakePrior==='function'?historyIntakePrior():null;
      intakeCalCache={factor:h?clampIntake(h.factor):1,ok:!!h,fromHistory:h?h.n:0,raw:h?h.factor:null,pastScale,cutoff,points:pts.length,reason:pts.length?`Needs 3 reading dates over 6+ days (has ${pts.length})`:'Not enough silo readings yet',measured:m.eaten,model:model+manualPast};
      return intakeCalCache;}
    const factor=clampIntake(rate);
    intakeCalCache={factor,ok:true,raw:rate,fixed,points:pts.length,span,pastScale,cutoff,measured:m.eaten,model:model+manualPast,capped:Math.abs(rate-factor)>0.0005};
  }catch(e){intakeCalCache={factor:1,ok:false,pastScale:null,cutoff:{},reason:'Could not calculate'};}
  return intakeCalCache;
}
function clampIntake(v){return Math.round(Math.max(INTAKE_CAL_MIN,Math.min(INTAKE_CAL_MAX,v))*1000)/1000;}
function groupDailyFeedOn(sheds,D){return sheds.reduce((sum,s)=>sum+shedFeedOn(s,D),0);}
function groupFeedToday(sheds,today=new Date()){return groupDailyFeedOn(sheds,today);}
// ── Feed unit (Settings → Units): every feed amount shown or typed uses
// kg or t. Stored values are always kg. Per device; default kg.
const FEED_UNIT_KEY='prodwise_feed_unit_v1';
let feedUnitPref=(()=>{try{return localStorage.getItem(FEED_UNIT_KEY)==='t'?'t':'kg';}catch(e){return 'kg';}})();
function feedUnit(){return feedUnitPref;}
function setFeedUnit(u){feedUnitPref=u==='t'?'t':'kg';try{localStorage.setItem(FEED_UNIT_KEY,feedUnitPref);}catch(e){}}
function feedUnitWord(){return feedUnitPref==='t'?'tonnes':'kg';}
// Number only, in the chosen unit (dp = decimals when in tonnes)
function fmtFeedNum(kg,dp){const v=Number.isFinite(kg)?kg:0;if(feedUnitPref==='t'){const d=dp==null?2:dp;return (v/1000).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});}return Math.round(v).toLocaleString('en-US');}
function fmtFeed(kg,dp){return fmtFeedNum(kg,dp)+(feedUnitPref==='t'?' t':' kg');}
// The same amount in the other unit (for a secondary "(…)" note)
function fmtFeedAlt(kg){const v=Number.isFinite(kg)?kg:0;return feedUnitPref==='t'?Math.round(v).toLocaleString('en-US')+' kg':(v/1000).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+' t';}
// Tight labels (silo ring scale): "6t" or "6k"
function fmtFeedCompact(kg){const t=Math.round(kg/1000);return feedUnitPref==='t'?t+'t':t+'k';}
// Input value in the chosen unit, and back to kg (null = empty, NaN = bad)
function feedIn(kg,dp){if(kg==null||kg===''||!Number.isFinite(Number(kg)))return '';const v=Number(kg);return feedUnitPref==='t'?(v/1000).toFixed(dp==null?2:dp):String(Math.round(v));}
function feedOut(raw){const s=String(raw??'').trim();if(s==='')return null;const n=Number(s);if(!Number.isFinite(n))return NaN;return feedUnitPref==='t'?n*1000:n;}
function feedStep(big){return feedUnitPref==='t'?(big?'0.1':'0.01'):(big?'100':'1');}
// Feed totals (names kept from when these were tonnes-only)
function fmtTonnesAlways(kg){return fmtFeed(kg);}
function fmtTonnes(t){return fmtFeed((Number(t)||0)*1000);}
// Non-feed mass (live weight): kg below 1 t, tonnes above
function fmtMass(kg){if(!Number.isFinite(kg)||kg===0)return '0 kg';const abs=Math.abs(kg);if(abs>=1000)return (kg/1000).toFixed(2)+' t';return Math.round(kg).toLocaleString()+' kg';}
function fmtKgAlways(kg){if(!Number.isFinite(kg)||kg===0)return '0 kg';return Math.round(kg).toLocaleString()+' kg';}

// Docket weights: the Actual box takes TONNES, but dockets are often in kg.
// No single load is over MAX_LOAD_T tonnes, so anything larger is read as kg.
const MAX_LOAD_T=500;
function docketToKg(n){return n>MAX_LOAD_T?n:n*1000;}
// Repair: actuals over MAX_LOAD_T tonnes were kg typed into the tonnes box
// (stored ×1000 too big) — divide back. Counted so the app can save/sync once.
let loadUnitRepairs=0;
function normalizeLoad(load){
  if(!load||typeof load!=='object')return null;
  const dateObj=load.date?parseExcelDate(load.date):null;if(!dateObj)return null;
  const plannedKg=Number(load.plannedKg)||0;if(plannedKg<=0)return null;
  const sr=load.splitKg||{};
  const splitKg={1:Math.max(0,Number(sr[1])||0),2:Math.max(0,Number(sr[2])||0),3:Math.max(0,Number(sr[3])||0),4:Math.max(0,Number(sr[4])||0)};
  const rawActual=load.actualKg;
  let actualKg=(rawActual!=null&&Number.isFinite(Number(rawActual))&&Number(rawActual)>0)?Number(rawActual):null;
  if(actualKg!=null&&actualKg>MAX_LOAD_T*1000){actualKg=actualKg/1000;loadUnitRepairs++;}
  return {id:String(load.id||uid('load')),date:dateObj,feedType:FEED_TYPES.some(f=>f.id===load.feedType)?load.feedType:'',plannedKg,splitKg,actualKg,note:String(load.note||'').slice(0,60),migrated:!!load.migrated,createdAt:String(load.createdAt||new Date().toISOString()),siloFor:normSiloFor(load.siloFor)};
}
function serializeFarmLoads(){
  return farmLoads.map(l=>({id:l.id,date:l.date?iso(l.date):null,feedType:l.feedType||'',plannedKg:Number(l.plannedKg)||0,splitKg:{...l.splitKg},actualKg:(l.actualKg!=null&&Number.isFinite(Number(l.actualKg)))?Number(l.actualKg):null,note:l.note||'',migrated:!!l.migrated,createdAt:l.createdAt||new Date().toISOString(),...(Object.keys(l.siloFor||{}).length?{siloFor:{...l.siloFor}}:{})}));
}
function saveFarmLoads(){try{localStorage.setItem(LOADS_KEY,JSON.stringify(serializeFarmLoads()));}catch(e){}}
function loadFarmLoads(){try{const raw=localStorage.getItem(LOADS_KEY);if(!raw)return null;const parsed=JSON.parse(raw);if(!Array.isArray(parsed))return null;return parsed.map(normalizeLoad).filter(Boolean);}catch(e){return null;}}
function migrateDeliveriesToLoads(){
  if(!siloData)return false;if(farmLoads&&farmLoads.length>0)return false;
  const newLoads=[];
  [1,2,3,4].forEach(g=>{const s=siloData[g];if(!s||!Array.isArray(s.deliveries))return;s.deliveries.forEach(d=>{const amountKg=Number(d.amountKg)||0;if(amountKg<=0||!d.date)return;newLoads.push({id:uid('load'),date:dateOnly(d.date),feedType:FEED_TYPES.some(f=>f.id===d.feedType)?d.feedType:'',plannedKg:amountKg,splitKg:{1:0,2:0,3:0,4:0,[g]:amountKg},actualKg:amountKg,note:String(d.note||'').slice(0,60),migrated:true,createdAt:new Date().toISOString()});});});
  if(newLoads.length===0)return false;
  newLoads.sort((a,b)=>dateOnly(a.date)-dateOnly(b.date));
  farmLoads=newLoads;saveFarmLoads();return true;
}
function loadsAffectingGroup(g){
  return farmLoads.filter(l=>Number(l.splitKg&&l.splitKg[g])>0).sort((a,b)=>{const t=dateOnly(a.date)-dateOnly(b.date);if(t!==0)return t;return (a.createdAt||'').localeCompare(b.createdAt||'');});
}
function loadsKgOn(group,D){const target=iso(D);return farmLoads.filter(l=>l.date&&iso(l.date)===target).reduce((s,l)=>s+(Number(l.splitKg[group])||0),0);}
function loadsKgOnAll(group,D){return loadsKgOn(group,D);}
function groupLoadSummary(group){
  const arr=loadsAffectingGroup(group);
  const buckets={starter:{id:'starter',label:'Starter',tonnes:0,loads:0,blocks:0},grower:{id:'grower',label:'Grower',tonnes:0,loads:0,blocks:0},finisher:{id:'finisher',label:'Finisher',tonnes:0,loads:0,blocks:0},withdrawal:{id:'withdrawal',label:'Withdrawal',tonnes:0,loads:0,blocks:0},unspecified:{id:'unspecified',label:'Unspecified',tonnes:0,loads:0,blocks:0}};
  arr.forEach(l=>{const share=Number(l.splitKg[group])||0;if(share<=0)return;const t=share/1000;const key=FEED_TYPES.some(f=>f.id===l.feedType)?l.feedType:'unspecified';buckets[key].tonnes+=t;buckets[key].loads+=1;});
  Object.values(buckets).forEach(b=>{b.blocks=b.tonnes/FEED_BLOCK_T;});
  const totalTonnes=Object.values(buckets).reduce((s,b)=>s+b.tonnes,0);
  const totalBlocks=Object.values(buckets).reduce((s,b)=>s+b.blocks,0);
  return {buckets,totalTonnes,totalBlocks,loadCount:arr.length};
}
function farmLoadsByFeedType(){
  const buckets={
    starter:{id:'starter',label:'Starter',loads:0},
    grower:{id:'grower',label:'Grower',loads:0},
    finisher:{id:'finisher',label:'Finisher',loads:0},
    withdrawal:{id:'withdrawal',label:'Withdrawal',loads:0},
    unspecified:{id:'unspecified',label:'Unspecified',loads:0}
  };
  farmLoads.forEach(l=>{
    const key=FEED_TYPES.some(f=>f.id===l.feedType)?l.feedType:'unspecified';
    buckets[key].loads+=1;
  });
  return buckets;
}
function farmLoadsSummary(){
  const total=farmLoads.length;
  const plannedKg=farmLoads.reduce((s,l)=>s+(Number(l.plannedKg)||0),0);
  const withActual=farmLoads.filter(l=>l.actualKg!=null).length;
  const actualKg=farmLoads.reduce((s,l)=>s+(Number(l.actualKg)||0),0);
  const today=dateOnly(new Date());
  const needsActual=farmLoads.filter(l=>!l.migrated&&l.actualKg==null&&dateOnly(l.date)<today).length;
  const upcoming=farmLoads.filter(l=>dateOnly(l.date)>=today).length;
  const past=farmLoads.filter(l=>dateOnly(l.date)<today).length;
  // Display only: each load counts its docket, else its planned amount as an estimate
  const estKg=farmLoads.reduce((s,l)=>s+(l.actualKg==null?Number(l.plannedKg)||0:0),0);
  const deliveryKg=actualKg+estKg;
  return {total,plannedKg,withActual,actualKg,needsActual,upcoming,past,estKg,deliveryKg};
}
function saveLoad(data){
  if(!data)return null;
  const plannedKg=Math.round(Number(data.plannedKg)||0);if(plannedKg<=0)return null;
  const splitKg={1:Math.round(Number(data.splitKg&&data.splitKg[1])||0),2:Math.round(Number(data.splitKg&&data.splitKg[2])||0),3:Math.round(Number(data.splitKg&&data.splitKg[3])||0),4:Math.round(Number(data.splitKg&&data.splitKg[4])||0)};
  const sum=splitKg[1]+splitKg[2]+splitKg[3]+splitKg[4];
  if(sum!==plannedKg)return {__error:'split-mismatch',plannedKg,sum};
  const dateObj=data.date instanceof Date?dateOnly(data.date):parseExcelDate(data.date);
  if(!dateObj)return {__error:'bad-date'};
  const id=data.id||uid('load');
  const payload={id,date:dateObj,feedType:FEED_TYPES.some(f=>f.id===data.feedType)?data.feedType:'',plannedKg,splitKg,actualKg:(data.actualKg!=null&&Number.isFinite(Number(data.actualKg))&&Number(data.actualKg)>0)?Number(data.actualKg):null,note:String(data.note||'').slice(0,60),migrated:!!data.migrated,createdAt:data.createdAt||new Date().toISOString(),siloFor:normSiloFor(data.siloFor)};
  const idx=farmLoads.findIndex(l=>l.id===id);
  if(idx>=0)farmLoads[idx]=payload;else farmLoads.push(payload);
  saveFarmLoads();schedulePush();
  return payload;
}
function deleteLoad(id){const idx=farmLoads.findIndex(l=>l.id===id);if(idx<0)return false;farmLoads.splice(idx,1);saveFarmLoads();schedulePush();return true;}
function updateLoadActual(id,rawValue){const load=farmLoads.find(l=>l.id===id);if(!load)return false;const s=String(rawValue??'').trim();if(s===''){load.actualKg=null;}else{const n=Number(s);if(!Number.isFinite(n)||n<=0)return false;load.actualKg=n;}saveFarmLoads();schedulePush();return true;}
function createSingleGroupLoadFromInline(group,dateIso,amountT){const amt=Number(amountT);if(!Number.isFinite(amt)||amt<=0)return {__error:'bad-amount'};const plannedKg=Math.round(amt*1000);return saveLoad({date:dateIso,feedType:'',plannedKg,splitKg:{1:0,2:0,3:0,4:0,[group]:plannedKg},actualKg:plannedKg,migrated:false});}

