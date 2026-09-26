function saveState(){if(!farmData){try{localStorage.removeItem(STORAGE_KEY);}catch(e){}return;}try{localStorage.setItem(STORAGE_KEY,JSON.stringify(farmData));}catch(e){}}
function loadState(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return null;
    const parsed=JSON.parse(raw);if(!parsed||!Array.isArray(parsed.sheds))return null;
    parsed.sheds.forEach(s=>{
      s.placementDate=s.placementDate?dateOnly(s.placementDate):null;
      s.cleanoutDate=s.cleanoutDate?dateOnly(s.cleanoutDate):null;
      s.mortalityUpdatedAt=s.mortalityUpdatedAt?dateOnly(s.mortalityUpdatedAt):null;
      s.pickups=(s.pickups||[]).map(p=>({date:dateOnly(p.date),birds:Number(p.birds)||0,isFinal:!!p.isFinal,variance:(p.variance!=null&&Number.isFinite(Number(p.variance)))?Number(p.variance):null,totalWeightKg:(p.totalWeightKg!=null&&Number.isFinite(Number(p.totalWeightKg)))?Number(p.totalWeightKg):null,totalWeightKgFromExcel:(p.totalWeightKgFromExcel!=null&&Number.isFinite(Number(p.totalWeightKgFromExcel)))?Number(p.totalWeightKgFromExcel):null,totalWeightKgManual:!!p.totalWeightKgManual,source:(p.source==='manual')?'manual':'excel',ageOverride:(p.ageOverride!=null&&Number.isFinite(Number(p.ageOverride)))?Number(p.ageOverride):null}));
      s.inYardSamples=(s.inYardSamples||[]).map(x=>({date:x.date?dateOnly(x.date):null,ageOverride:(x.ageOverride!=null&&Number.isFinite(Number(x.ageOverride)))?Math.floor(Number(x.ageOverride)):null,birds:Number(x.birds)||0,avgWeightKg:Number(x.avgWeightKg)||0,isOfficial:!!x.isOfficial})).filter(x=>x.date&&x.avgWeightKg>0);
      s.predictedPickups=(s.predictedPickups||[]).map(pp=>({id:pp.id||uid('pp'),date:pp.date?dateOnly(pp.date):null,birds:Number(pp.birds)||0,isFinal:!!pp.isFinal})).filter(pp=>pp.date&&pp.birds>=0);
      s.targetPickups=(s.targetPickups!=null&&Number.isFinite(Number(s.targetPickups)))?Math.max(MIN_PICKUPS_PER_SHED,Math.min(MAX_PICKUPS_PER_SHED,Math.floor(Number(s.targetPickups)))):null;
      s.densitySettings={useGlobal:(s.densitySettings&&s.densitySettings.useGlobal===false)?false:true,maxDensity:(s.densitySettings&&Number.isFinite(Number(s.densitySettings.maxDensity)))?Number(s.densitySettings.maxDensity):null,triggerDensity:(s.densitySettings&&Number.isFinite(Number(s.densitySettings.triggerDensity)))?Number(s.densitySettings.triggerDensity):null,targetDensity:(s.densitySettings&&Number.isFinite(Number(s.densitySettings.targetDensity)))?Number(s.densitySettings.targetDensity):null};
      const cw=Number(s.chickWeightKg);s.chickWeightKg=(Number.isFinite(cw)&&cw>0)?Math.max(MIN_CHICK_WEIGHT_KG,Math.min(MAX_CHICK_WEIGHT_KG,cw)):DEFAULT_CHICK_WEIGHT_KG;
      const tc=s.targetCurve||{};
      s.targetCurve={7:(tc[7]!=null&&Number.isFinite(Number(tc[7]))&&Number(tc[7])>0)?Number(tc[7]):null,14:(tc[14]!=null&&Number.isFinite(Number(tc[14]))&&Number(tc[14])>0)?Number(tc[14]):null,21:(tc[21]!=null&&Number.isFinite(Number(tc[21]))&&Number(tc[21])>0)?Number(tc[21]):null,28:(tc[28]!=null&&Number.isFinite(Number(tc[28]))&&Number(tc[28])>0)?Number(tc[28]):null};
      const mr=Number(s.mortalityRatePercent);s.mortalityRatePercent=(Number.isFinite(mr)&&mr>=0)?Math.max(0,Math.min(MAX_MORT_RATE_PCT,mr)):DEFAULT_MORT_RATE_PCT;
    });
    const bf=Number(parsed.biasFactor);parsed.biasFactor=(Number.isFinite(bf)&&bf>0)?Math.max(MIN_BIAS_FACTOR,Math.min(MAX_BIAS_FACTOR,bf)):DEFAULT_BIAS_FACTOR;
    return parsed;
  }catch(e){return null;}
}
function migrateMortalityAnchors(){
  if(!farmData||!Array.isArray(farmData.sheds))return false;
  const today=dateOnly(new Date());let changed=false;
  farmData.sheds.forEach(s=>{if(!s.mortalityUpdatedAt&&Number(s.mortality)>0){s.mortalityUpdatedAt=today;changed=true;}});
  if(changed)saveState();return changed;
}
function saveShedViews(){try{localStorage.setItem(VIEW_KEY,JSON.stringify(shedViewByGroup));}catch(e){}}
function loadShedViews(){try{const raw=localStorage.getItem(VIEW_KEY);if(!raw)return null;const v=JSON.parse(raw);if(!v||typeof v!=='object')return null;const out={...DEFAULT_VIEWS};[1,2,3,4].forEach(g=>{if(['shed1','shed2','both','planner'].includes(v[g]))out[g]=v[g];});return out;}catch(e){return null;}}
function isFreshSession(){try{return !sessionStorage.getItem(SESSION_KEY);}catch(e){return false;}}
function markSessionActive(){try{sessionStorage.setItem(SESSION_KEY,'1');}catch(e){}}
function initShedViews(){if(isFreshSession()){markSessionActive();shedViewByGroup={...DEFAULT_VIEWS};saveShedViews();return;}const saved=loadShedViews();shedViewByGroup=saved||{...DEFAULT_VIEWS};}
function normalizeRing(r){if(r===null||r===undefined||r==='')return null;const n=Number(r);if(!Number.isFinite(n)||n<0)return null;return Math.max(0,Math.min(MAX_RINGS,Math.floor(n)));}
function saveSiloData(){try{const serial={};[1,2,3,4].forEach(g=>{const s=siloData[g]||{readings:[],deliveries:[]};serial[g]={readings:(s.readings||[]).map(r=>({date:r.date,silo1Rings:r.silo1Rings,silo2Rings:r.silo2Rings,silo3Rings:r.silo3Rings})),deliveries:(s.deliveries||[]).map(d=>({id:d.id,date:d.date?iso(d.date):null,amountKg:Number(d.amountKg)||0,feedType:d.feedType||'',note:d.note||''}))};});localStorage.setItem(SILO_KEY,JSON.stringify(serial));}catch(e){}}
function loadSiloData(){
  try{
    const raw=localStorage.getItem(SILO_KEY);
    if(raw){const v=JSON.parse(raw);if(v&&typeof v==='object'){const out={};[1,2,3,4].forEach(g=>{const s=v[g]||{};out[g]={readings:Array.isArray(s.readings)?s.readings.map(r=>({date:String(r.date||''),silo1Rings:normalizeRing(r.silo1Rings),silo2Rings:normalizeRing(r.silo2Rings),silo3Rings:normalizeRing(r.silo3Rings)})).filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.date)).sort((a,b)=>a.date.localeCompare(b.date)):[],deliveries:Array.isArray(s.deliveries)?s.deliveries.map(d=>({id:d.id||String(Date.now())+Math.random().toString(16).slice(2),date:d.date?dateOnly(d.date):null,amountKg:Number(d.amountKg)||0,feedType:FEED_TYPES.some(f=>f.id===d.feedType)?d.feedType:'',note:d.note||''})).filter(d=>d.date&&d.amountKg>0):[]};});return out;}}
    const rawV2=localStorage.getItem(SILO_KEY_V2);
    if(rawV2){const v2=JSON.parse(rawV2);if(v2&&typeof v2==='object'){const out={};const todayIso=iso(new Date());[1,2,3,4].forEach(g=>{const s=v2[g]||{};const toRings=kg=>{const n=Number(kg);if(!Number.isFinite(n)||n<CONE_KG)return null;const r=Math.round((n-CONE_KG)/RING_KG);return Math.max(0,Math.min(MAX_RINGS,r));};const r1=toRings(s.silo1Kg);const r2=toRings(s.silo2Kg);const r3=toRings(s.silo3Kg);const hasAny=(r1!==null||r2!==null||r3!==null);out[g]={readings:hasAny?[{date:todayIso,silo1Rings:r1,silo2Rings:r2,silo3Rings:r3}]:[],deliveries:Array.isArray(s.deliveries)?s.deliveries.map(d=>({id:d.id||String(Date.now())+Math.random().toString(16).slice(2),date:d.date?dateOnly(d.date):null,amountKg:Number(d.amountKg)||0,feedType:'',note:d.note||''})).filter(d=>d.date&&d.amountKg>0):[]};});return out;}}
    return null;
  }catch(e){return null;}
}
function savePredState(){try{localStorage.setItem(PRED_KEY,JSON.stringify(predState));}catch(e){}}
function loadPredState(){
  try{
    const raw=localStorage.getItem(PRED_KEY);if(!raw)return;
    const v=JSON.parse(raw);if(!v||typeof v!=='object')return;
    if(Number.isFinite(v.beta))predState.beta=Math.max(0,Math.min(0.6,v.beta));
    if(v.targetHarvestWeightKg&&typeof v.targetHarvestWeightKg==='object'){[1,2,3,4].forEach(g=>{const n=Number(v.targetHarvestWeightKg[g]);if(Number.isFinite(n)&&n>0)predState.targetHarvestWeightKg[g]=n;});}
    if([1,2,3,4].includes(v.predGroup))predState.predGroup=v.predGroup;
    if(['shed1','shed2','both'].includes(v.predView))predState.predView=v.predView;
    if(v.farmFeedOverride!=null&&Number.isFinite(Number(v.farmFeedOverride))&&Number(v.farmFeedOverride)>0)predState.farmFeedOverride=Number(v.farmFeedOverride);
    if(v.farmLeftoverKg!=null&&Number.isFinite(Number(v.farmLeftoverKg))&&Number(v.farmLeftoverKg)>0)predState.farmLeftoverKg=Number(v.farmLeftoverKg);
    if(typeof v.deliveriesOpen==='boolean')predState.deliveriesOpen=v.deliveriesOpen;
    if(typeof v.batchNumber==='string')predState.batchNumber=v.batchNumber.trim();
    if(typeof v.adjOpen==='boolean')predState.adjOpen=v.adjOpen;
    if(v.densityGlobal&&typeof v.densityGlobal==='object'){const dg=v.densityGlobal;let tp=DEFAULT_DENSITY_GLOBAL.targetPickups;if(Number.isFinite(Number(dg.targetPickups)))tp=Number(dg.targetPickups);else if(Number.isFinite(Number(dg.minPickupsBeforeCleanout)))tp=Number(dg.minPickupsBeforeCleanout);tp=Math.max(MIN_PICKUPS_PER_SHED,Math.min(MAX_PICKUPS_PER_SHED,Math.floor(tp)));predState.densityGlobal={maxDensity:Number.isFinite(Number(dg.maxDensity))?Number(dg.maxDensity):DEFAULT_DENSITY_GLOBAL.maxDensity,triggerDensity:Number.isFinite(Number(dg.triggerDensity))?Number(dg.triggerDensity):DEFAULT_DENSITY_GLOBAL.triggerDensity,targetDensity:Number.isFinite(Number(dg.targetDensity))?Number(dg.targetDensity):DEFAULT_DENSITY_GLOBAL.targetDensity,targetPickups:tp};}
  }catch(e){}
}

function parseShedsFromWorkbook(workbook){
  const sheetName=workbook.SheetNames.find(n=>String(n).toLowerCase()==='sheds')||workbook.SheetNames[0];
  if(!sheetName)throw new Error('No worksheet found in the file.');
  const ws=workbook.Sheets[sheetName];if(!ws)throw new Error('The worksheet appears to be empty.');
  const rows=XLSX.utils.sheet_to_json(ws,{defval:'',raw:false,dateNF:'dd/mm/yyyy'});
  if(!rows.length)throw new Error('No data rows found in the file.');
  const sheds=Array.from({length:SHED_COUNT},(_,i)=>({id:i+1,placementDate:null,initialPopulation:0,cleanoutDate:null,mortality:0,mortalityUpdatedAt:null,customFeedKg:null,pickups:[],targetCurve:{7:null,14:null,21:null,28:null},mortalityRatePercent:DEFAULT_MORT_RATE_PCT,chickWeightKg:DEFAULT_CHICK_WEIGHT_KG,inYardSamples:[],predictedPickups:[],targetPickups:null,densitySettings:{useGlobal:true,maxDensity:null,triggerDensity:null,targetDensity:null}}));
  let batchNumber='',matched=0,skipped=0;
  for(const row of rows){
    const shedId=Number(getVal(row,KEYS.shedId));
    if(!Number.isFinite(shedId)||shedId<1||shedId>SHED_COUNT){skipped++;continue;}
    const idx=shedId-1;
    const bn=String(getVal(row,KEYS.batch)||'').trim();if(!batchNumber&&bn)batchNumber=bn;
    const placement=parseExcelDate(getVal(row,KEYS.placement));
    const population=Number(getVal(row,KEYS.population));
    const mortality=Number(getVal(row,KEYS.mortality));
    const customFeed=Number(getVal(row,KEYS.customFeed));
    const cleanoutRaw=getVal(row,KEYS.cleanout);
    if(placement)sheds[idx].placementDate=placement;
    if(Number.isFinite(population)&&population>0)sheds[idx].initialPopulation=Math.floor(population);
    if(Number.isFinite(mortality))sheds[idx].mortality=Math.floor(mortality);
    if(Number.isFinite(customFeed)&&customFeed>0)sheds[idx].customFeedKg=customFeed;
    let cleanout=parseExcelDate(cleanoutRaw);
    if(isInvalidCleanout(cleanoutRaw)&&placement)cleanout=addDays(placement,52);
    sheds[idx].cleanoutDate=cleanout;
    const pickups=[];
    for(let p=1;p<=5;p++){
      const dRaw=getVal(row,[`Pickup${p}Date`,`Pickup ${p} Date`,`P${p}Date`,`P${p} Date`]);
      const bRaw=getVal(row,[`Pickup${p}Birds`,`Pickup ${p} Birds`,`P${p}Birds`,`P${p} Birds`]);
      const fRaw=getVal(row,[`Pickup${p}Final`,`Pickup ${p} Final`,`P${p}Final`]);
      const vRaw=getVal(row,[`Pickup${p}Variance`,`Pickup ${p} Variance`,`P${p}Variance`]);
      const wRaw=getVal(row,[`Pickup${p}Weight`,`Pickup ${p} Weight`,`Pickup${p}TotalWeight`,`Pickup ${p} Total Weight`,`Pickup${p}TotalWt`,`Pickup ${p} Total Wt`,`P${p}Weight`,`P${p} Weight`]);
      const d=parseExcelDate(dRaw);const b=Number(bRaw);const w=Number(wRaw);
      if(d&&Number.isFinite(b)&&b>0){const totalWeight=(Number.isFinite(w)&&w>0)?w:null;pickups.push({date:d,birds:Math.floor(b),isFinal:parseBool(fRaw),variance:Number.isFinite(Number(vRaw))?Number(vRaw):null,totalWeightKg:totalWeight,totalWeightKgFromExcel:totalWeight,totalWeightKgManual:false,source:'excel',ageOverride:null});}
    }
    pickups.sort((a,b)=>dateOnly(a.date)-dateOnly(b.date));
    let finalSeen=false;
    for(const p of pickups){if(p.isFinal&&!finalSeen)finalSeen=true;else if(p.isFinal&&finalSeen)p.isFinal=false;}
    if(pickups.length===5&&!pickups.some(p=>p.isFinal))pickups[4].isFinal=true;
    const fp=pickups.find(p=>p.isFinal);
    if(fp){sheds[idx].cleanoutDate=dateOnly(fp.date);const totalPicked=pickups.reduce((s,p)=>s+p.birds,0);sheds[idx].mortality=Math.max(0,sheds[idx].initialPopulation-totalPicked);}
    sheds[idx].pickups=pickups;matched++;
  }
  if(matched===0)throw new Error("No shed rows found. Make sure the 'Shed' column contains numbers 1 through 8.");
  return {sheds,batchNumber,matched,skipped,sheetName};
}

