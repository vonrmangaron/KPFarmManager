function sanitizeUserFarmName(name){let s=String(name||'').trim().toLowerCase();s=s.replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');s=s.replace(/-feed$/i,'');return s;}
function sanitizeBatchNumber(bn){let s=String(bn||'').trim().toLowerCase();s=s.replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');return s;}
function currentBatchKey(){const candidates=[predState.batchNumber,farmData&&farmData.batchNumber];for(const c of candidates){const s=sanitizeBatchNumber(c);if(s)return s;}return '';}
function buildFileKey(farmName){const base=sanitizeUserFarmName(farmName)+SYNC_SUFFIX;const batch=currentBatchKey();return batch?`${base}-${batch}`:base;}
function buildSyncUrl(farmName){const fileKey=buildFileKey(farmName);return `${SYNC_WORKER_URL}/?farm=${encodeURIComponent(fileKey)}&repo=${encodeURIComponent(SYNC_REPO)}`;}
function buildExcelWrapperUrl(farmName){const batch=currentBatchKey();const fileKey=sanitizeUserFarmName(farmName)+SYNC_SUFFIX+(batch?'-'+batch:'')+'-file';return `${SYNC_WORKER_URL}/?farm=${encodeURIComponent(fileKey)}&repo=${encodeURIComponent(SYNC_REPO)}`;}
function buildBatchUrl(farmName,batchKey){const base=sanitizeUserFarmName(farmName)+SYNC_SUFFIX;const fileKey=batchKey?`${base}-${batchKey}`:base;return `${SYNC_WORKER_URL}/?farm=${encodeURIComponent(fileKey)}&repo=${encodeURIComponent(SYNC_REPO)}`;}
function buildListingUrl(farmName){const prefix=sanitizeUserFarmName(farmName)+SYNC_SUFFIX;return `${SYNC_WORKER_URL}/?repo=${encodeURIComponent(SYNC_REPO)}&prefix=${encodeURIComponent(prefix)}`;}
function loadSyncState(){try{const raw=localStorage.getItem(SYNC_FARMNAME_KEY);if(!raw)return;const v=JSON.parse(raw);if(v&&typeof v.farmName==='string'&&v.farmName){syncFarmName=v.farmName;syncLastSyncAt=v.lastSyncAt||null;syncConnectedAt=v.connectedAt||null;syncExcelMeta=v.excelMeta||null;}}catch(e){}}
function saveSyncState(){try{if(!syncFarmName){localStorage.removeItem(SYNC_FARMNAME_KEY);return;}localStorage.setItem(SYNC_FARMNAME_KEY,JSON.stringify({farmName:syncFarmName,lastSyncAt:syncLastSyncAt,connectedAt:syncConnectedAt,excelMeta:syncExcelMeta}));}catch(e){}}
function arrayBufferToBase64(buf){const bytes=new Uint8Array(buf);let binary='';const chunk=8192;for(let i=0;i<bytes.length;i+=chunk){binary+=String.fromCharCode.apply(null,bytes.subarray(i,i+chunk));}return btoa(binary);}
function base64ToBlob(base64,mime){const binary=atob(base64);const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return new Blob([bytes],{type:mime});}
function serializeSiloDataForCloud(){const out={};[1,2,3,4].forEach(g=>{const s=siloData[g]||{readings:[],deliveries:[]};out[g]={readings:(s.readings||[]).map(r=>({date:r.date,silo1Rings:r.silo1Rings,silo2Rings:r.silo2Rings,silo3Rings:r.silo3Rings,time:r.time==='am'?'am':'pm',...(typeof r.deliveryIn==='boolean'?{deliveryIn:r.deliveryIn}:{}),...readingOpenField(r),...readingAtField(r)})),deliveries:(s.deliveries||[]).map(d=>({id:d.id,date:d.date?iso(d.date):null,amountKg:Number(d.amountKg)||0,feedType:d.feedType||'',note:d.note||''})),log:normReadingLog(s.log)};});return out;}

function buildCloudPayload(){
  return {
    app:SYNC_APP_TAG,
    schemaVersion:SYNC_SCHEMA_VERSION,
    lastUpdated:new Date().toISOString(),
    farmName:syncFarmName,
    batchNumber:predState.batchNumber||(farmData&&farmData.batchNumber)||'',
    farmData,
    siloData:serializeSiloDataForCloud(),
    farmLoads:serializeFarmLoads(),
    excelMetadata:syncExcelMeta,
    predictions:{
      beta:predState.beta,
      targetHarvestWeightKg:predState.targetHarvestWeightKg,
      farmFeedOverride:predState.farmFeedOverride,
      farmLeftoverKg:predState.farmLeftoverKg,
      carryoverKg:predState.carryoverKg||{1:0,2:0,3:0,4:0},
      carryoverFarmKg:Number(predState.carryoverFarmKg)||0,
      densityGlobal:predState.densityGlobal,
      noPickupDays:predState.noPickupDays||[],
      projectionLog:predState.projectionLog||[],
      finalUpliftPct:predState.finalUpliftPct,
      feedQuota:predState.feedQuota,
      truckSplitMode:predState.truckSplitMode,
      siloConfidencePct:predState.siloConfidencePct,
      deliveryTiming:predState.deliveryTiming,
      starterSilo:{...predState.starterSilo},
      starterBufferDays:predState.starterBufferDays,
      siloStart:predState.siloStart,
      safetyDays:predState.safetyDays,
      farmHistory:predState.farmHistory||[],
      farmHistoryDeleted:predState.farmHistoryDeleted||[]
    },
    preferences:{
      shedViewByGroup,
      shedRange,
      siloRange,
      theme:loadTheme(),
      deliveriesOpen:predState.deliveriesOpen,
      notifPrefs:{
        shedPerformance:!!notifPrefs.shedPerformance,
        feedBalance:!!notifPrefs.feedBalance
      }
    }
  };
}

function applyCloudPayload(payload,options){
  options=options||{};if(!payload||typeof payload!=='object')return false;
  if(payload.app&&payload.app!==SYNC_APP_TAG)return false;
  if(typeof payload.batchNumber==='string'&&payload.batchNumber.trim()){if(!predState.batchNumber){predState.batchNumber=sanitizeBatchNumber(payload.batchNumber);savePredState();}}
  const oldExcelUploadedAt=syncExcelMeta&&syncExcelMeta.uploadedAt;const newExcelMeta=payload.excelMetadata||null;
  if(payload.farmData&&Array.isArray(payload.farmData.sheds)){
    const bf=Number(payload.farmData.biasFactor);
    farmData={batchNumber:String(payload.farmData.batchNumber||predState.batchNumber||''),importDate:payload.farmData.importDate||new Date().toISOString(),fileName:payload.farmData.fileName||'(from cloud)',biasFactor:(Number.isFinite(bf)&&bf>0)?Math.max(MIN_BIAS_FACTOR,Math.min(MAX_BIAS_FACTOR,bf)):DEFAULT_BIAS_FACTOR,sheds:payload.farmData.sheds.map(s=>{const tc=s.targetCurve||{};const mr=Number(s.mortalityRatePercent);const cw=Number(s.chickWeightKg);const dSettings=s.densitySettings||{};const tp=(s.targetPickups!=null&&Number.isFinite(Number(s.targetPickups)))?Math.max(MIN_PICKUPS_PER_SHED,Math.min(MAX_PICKUPS_PER_SHED,Math.floor(Number(s.targetPickups)))):null;return {id:Number(s.id)||0,placementDate:s.placementDate?dateOnly(s.placementDate):null,initialPopulation:Number(s.initialPopulation)||0,cleanoutDate:s.cleanoutDate?dateOnly(s.cleanoutDate):null,mortality:Number(s.mortality)||0,mortalityUpdatedAt:s.mortalityUpdatedAt?dateOnly(s.mortalityUpdatedAt):null,customFeedKg:(s.customFeedKg!=null&&Number(s.customFeedKg)>0)?Number(s.customFeedKg):null,mortalityRatePercent:(Number.isFinite(mr)&&mr>=0)?Math.max(0,Math.min(MAX_MORT_RATE_PCT,mr)):DEFAULT_MORT_RATE_PCT,chickWeightKg:(Number.isFinite(cw)&&cw>0)?Math.max(MIN_CHICK_WEIGHT_KG,Math.min(MAX_CHICK_WEIGHT_KG,cw)):DEFAULT_CHICK_WEIGHT_KG,inYardSamples:(s.inYardSamples||[]).map(x=>({date:x.date?dateOnly(x.date):null,ageOverride:(x.ageOverride!=null&&Number.isFinite(Number(x.ageOverride)))?Math.floor(Number(x.ageOverride)):null,birds:Number(x.birds)||0,avgWeightKg:Number(x.avgWeightKg)||0,isOfficial:!!x.isOfficial})).filter(x=>x.date&&x.avgWeightKg>0),pickups:(s.pickups||[]).map(p=>({date:p.date?dateOnly(p.date):null,birds:Number(p.birds)||0,isFinal:!!p.isFinal,variance:(p.variance!=null&&Number.isFinite(Number(p.variance)))?Number(p.variance):null,totalWeightKg:(p.totalWeightKg!=null&&Number.isFinite(Number(p.totalWeightKg)))?Number(p.totalWeightKg):null,totalWeightKgFromExcel:(p.totalWeightKgFromExcel!=null&&Number.isFinite(Number(p.totalWeightKgFromExcel)))?Number(p.totalWeightKgFromExcel):null,totalWeightKgManual:!!p.totalWeightKgManual,source:(p.source==='manual')?'manual':'excel',ageOverride:(p.ageOverride!=null&&Number.isFinite(Number(p.ageOverride)))?Number(p.ageOverride):null,weightEstimated:!!p.weightEstimated})).filter(p=>p.date),predictedPickups:(s.predictedPickups||[]).map(pp=>({id:pp.id||uid('pp'),date:pp.date?dateOnly(pp.date):null,birds:Number(pp.birds)||0,isFinal:!!pp.isFinal})).filter(pp=>pp.date&&pp.birds>=0),targetPickups:tp,feedAdjustPct:(s.feedAdjustPct!=null&&Number.isFinite(Number(s.feedAdjustPct))&&Number(s.feedAdjustPct)>0)?Number(s.feedAdjustPct):null,scaleOverride:(s.scaleOverride!=null&&Number.isFinite(Number(s.scaleOverride))&&Number(s.scaleOverride)>0)?Math.max(MIN_BIAS_FACTOR,Math.min(MAX_BIAS_FACTOR,Number(s.scaleOverride))):null,densitySettings:{useGlobal:dSettings.useGlobal===false?false:true,maxDensity:Number.isFinite(Number(dSettings.maxDensity))?Number(dSettings.maxDensity):null,triggerDensity:Number.isFinite(Number(dSettings.triggerDensity))?Number(dSettings.triggerDensity):null,targetDensity:Number.isFinite(Number(dSettings.targetDensity))?Number(dSettings.targetDensity):null},targetCurve:{7:(tc[7]!=null&&Number.isFinite(Number(tc[7]))&&Number(tc[7])>0)?Number(tc[7]):null,14:(tc[14]!=null&&Number.isFinite(Number(tc[14]))&&Number(tc[14])>0)?Number(tc[14]):null,21:(tc[21]!=null&&Number.isFinite(Number(tc[21]))&&Number(tc[21])>0)?Number(tc[21]):null,28:(tc[28]!=null&&Number.isFinite(Number(tc[28]))&&Number(tc[28])>0)?Number(tc[28]):null}};})};
    saveState();migrateMortalityAnchors();
    if(!predState.batchNumber&&farmData.batchNumber){predState.batchNumber=sanitizeBatchNumber(farmData.batchNumber);savePredState();}
  }
  if(payload.siloData&&typeof payload.siloData==='object'){const incoming={};[1,2,3,4].forEach(g=>{const s=payload.siloData[g]||{};incoming[g]={readings:Array.isArray(s.readings)?s.readings.map(r=>({date:String(r.date||''),silo1Rings:normalizeRing(r.silo1Rings),silo2Rings:normalizeRing(r.silo2Rings),silo3Rings:normalizeRing(r.silo3Rings),time:r.time==='am'?'am':'pm',...(typeof r.deliveryIn==='boolean'?{deliveryIn:r.deliveryIn}:{}),...readingOpenField(r),...readingAtField(r)})).filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.date)).sort((a,b)=>a.date.localeCompare(b.date)):[],deliveries:Array.isArray(s.deliveries)?s.deliveries.map(d=>({id:d.id||String(Date.now())+Math.random().toString(16).slice(2),date:d.date?dateOnly(d.date):null,amountKg:Number(d.amountKg)||0,feedType:FEED_TYPES.some(f=>f.id===d.feedType)?d.feedType:'',note:d.note||''})).filter(d=>d.date&&d.amountKg>0):[],log:normReadingLog(s.log)};});siloData=incoming;saveSiloData();}
  if(Array.isArray(payload.farmLoads)){loadUnitRepairs=0;farmLoads=payload.farmLoads.map(normalizeLoad).filter(Boolean);saveFarmLoads();if(loadUnitRepairs>0){const n=loadUnitRepairs;loadUnitRepairs=0;setTimeout(()=>{schedulePush();showToast(`Fixed ${n} docket weight${n===1?'':'s'} that were entered in kg.`);},800);}}
  if(payload.predictions&&typeof payload.predictions==='object'){
    const p=payload.predictions;
    if(Number.isFinite(p.beta))predState.beta=Math.max(0,Math.min(0.6,p.beta));
    if(p.targetHarvestWeightKg&&typeof p.targetHarvestWeightKg==='object'){[1,2,3,4].forEach(g=>{const n=Number(p.targetHarvestWeightKg[g]);if(Number.isFinite(n)&&n>0)predState.targetHarvestWeightKg[g]=n;});}
    if(p.farmFeedOverride!=null&&Number.isFinite(Number(p.farmFeedOverride))&&Number(p.farmFeedOverride)>0)predState.farmFeedOverride=Number(p.farmFeedOverride);
    else if(p.farmFeedOverride===null)predState.farmFeedOverride=null;
    {const v=Number(p.carryoverFarmKg);predState.carryoverFarmKg=Number.isFinite(v)&&v>0?v:0;}
    if(p.carryoverKg&&typeof p.carryoverKg==='object'){const c={};[1,2,3,4].forEach(g=>{const v=Number(p.carryoverKg[g]);c[g]=Number.isFinite(v)&&v>0?v:0;});predState.carryoverKg=c;}
    if(p.farmLeftoverKg!=null&&Number.isFinite(Number(p.farmLeftoverKg))&&Number(p.farmLeftoverKg)>0)predState.farmLeftoverKg=Number(p.farmLeftoverKg);
    else if(p.farmLeftoverKg===null)predState.farmLeftoverKg=null;
    if(p.densityGlobal&&typeof p.densityGlobal==='object'){const dg=p.densityGlobal;let tp=DEFAULT_DENSITY_GLOBAL.targetPickups;if(Number.isFinite(Number(dg.targetPickups)))tp=Number(dg.targetPickups);else if(Number.isFinite(Number(dg.minPickupsBeforeCleanout)))tp=Number(dg.minPickupsBeforeCleanout);tp=Math.max(MIN_PICKUPS_PER_SHED,Math.min(MAX_PICKUPS_PER_SHED,Math.floor(tp)));predState.densityGlobal={maxDensity:Number.isFinite(Number(dg.maxDensity))?Number(dg.maxDensity):DEFAULT_DENSITY_GLOBAL.maxDensity,triggerDensity:Number.isFinite(Number(dg.triggerDensity))?Number(dg.triggerDensity):DEFAULT_DENSITY_GLOBAL.triggerDensity,targetDensity:Number.isFinite(Number(dg.targetDensity))?Number(dg.targetDensity):DEFAULT_DENSITY_GLOBAL.targetDensity,targetPickups:tp};}
    if(Array.isArray(p.noPickupDays))predState.noPickupDays=p.noPickupDays.filter(d=>Number.isInteger(d)&&d>=0&&d<=6);
    // The farm's history travels with every batch file. Merged, never replaced:
    // a device that hadn't synced a new record can't wipe it out.
    {if(p.deliveryTiming==='early'||p.deliveryTiming==='day')predState.deliveryTiming=p.deliveryTiming;applyStarterPrefs(p);const c=Number(p.siloConfidencePct);if(Number.isFinite(c)&&c>=50&&c<=100)predState.siloConfidencePct=c;const sd=Number(p.safetyDays);if(Number.isFinite(sd)&&sd>=0&&sd<=3)predState.safetyDays=sd;}
    mergeCloudFarmHistory(p);
    mergeProjectionLog(p.projectionLog);
    if(p.feedQuota&&typeof p.feedQuota==='object'){const q={};Object.keys(DEFAULT_FEED_QUOTA).forEach(k=>{const n=Number(p.feedQuota[k]);q[k]=Number.isFinite(n)&&n>=0&&n<=10?n:DEFAULT_FEED_QUOTA[k];});predState.feedQuota=q;}
    if(p.truckSplitMode==='any15'||p.truckSplitMode==='simple')predState.truckSplitMode=p.truckSplitMode;
    {const u=Number(p.finalUpliftPct);if(Number.isFinite(u)&&u>=0&&u<=20)predState.finalUpliftPct=u;}
    savePredState();
  }
  const prefs=payload.preferences||{};
  if(prefs.shedViewByGroup&&typeof prefs.shedViewByGroup==='object'){const next={...DEFAULT_VIEWS};[1,2,3,4].forEach(g=>{if(['shed1','shed2','both','planner'].includes(prefs.shedViewByGroup[g]))next[g]=prefs.shedViewByGroup[g];});shedViewByGroup=next;saveShedViews();}
  if(prefs.shedRange&&typeof prefs.shedRange==='object'){const s=Number(prefs.shedRange.start),e=Number(prefs.shedRange.end);if(Number.isFinite(s)&&Number.isFinite(e)&&s<=e){shedRange={start:s,end:e};}}
  if(prefs.siloRange&&typeof prefs.siloRange==='object'){const s=Number(prefs.siloRange.start),e=Number(prefs.siloRange.end);if(Number.isFinite(s)&&Number.isFinite(e)&&s<=e){siloRange={start:s,end:e};}}
  if(prefs.theme==='dark'||prefs.theme==='light'){applyTheme(prefs.theme);saveTheme(prefs.theme);}
  if(typeof prefs.deliveriesOpen==='boolean')predState.deliveriesOpen=prefs.deliveriesOpen;
  if(prefs.notifPrefs&&typeof prefs.notifPrefs==='object'){
    if(typeof prefs.notifPrefs.shedPerformance==='boolean')notifPrefs.shedPerformance=prefs.notifPrefs.shedPerformance;
    if(typeof prefs.notifPrefs.feedBalance==='boolean')notifPrefs.feedBalance=prefs.notifPrefs.feedBalance;
    saveNotifPrefs();
  }
  syncExcelMeta=newExcelMeta;
  const newUploadedAt=newExcelMeta&&newExcelMeta.uploadedAt;
  if(!options.isFirstPull&&oldExcelUploadedAt&&newUploadedAt&&oldExcelUploadedAt!==newUploadedAt){showToast('📄 Excel updated on another device — re-import to load it.',true);}
  migrateDeliveriesToLoads();
  return true;
}
async function fetchFromCloud(){
  if(!syncFarmName)return {ok:false,reason:'no-farm'};
  try{const res=await fetch(buildSyncUrl(syncFarmName));if(res.status===404)return {ok:true,notFound:true};if(!res.ok)return {ok:false,reason:'http-'+res.status};const result=await res.json();if(result.notFound)return {ok:true,notFound:true};return {ok:true,data:result.data,sha:result.sha};}catch(e){return {ok:false,reason:e.message||'network-error'};}
}
// ── Farm history: its own cloud file per farm (not inside a batch file),
// so New batch, switching batches and other devices can't lose it.
// Always merged with this device's copy (mergeCloudFarmHistory), never replaced.
let historySha=null,historyPushTimer=null;
function buildHistoryUrl(farmName){return `${SYNC_WORKER_URL}/?farm=${encodeURIComponent(sanitizeUserFarmName(farmName)+'-prodwise-history')}&repo=${encodeURIComponent(SYNC_REPO)}`;}
function historyKey(){return JSON.stringify([(predState.farmHistory||[]).map(r=>r.id+':'+r.savedAt).sort(),(predState.farmHistoryDeleted||[]).slice().sort()]);}
async function pullFarmHistory(){
  if(!syncFarmName)return;
  try{
    const res=await fetch(buildHistoryUrl(syncFarmName),{cache:'no-store'});
    if(res.status===404){historySha=null;if(farmHistory().length)scheduleHistoryPush();return;}
    if(!res.ok)return;
    const j=await res.json();
    if(j.notFound||!j.data){historySha=null;if(farmHistory().length)scheduleHistoryPush();return;}
    historySha=j.sha||null;
    const before=historyKey();mergeCloudFarmHistory(j.data);
    const remote=JSON.stringify([((j.data.farmHistory)||[]).map(r=>r.id+':'+r.savedAt).sort(),((j.data.farmHistoryDeleted)||[]).slice().sort()]);
    if(historyKey()!==before){savePredState();render();if(settingsDrawerOpen)renderSettingsDrawerBody();}
    if(historyKey()!==remote)scheduleHistoryPush();   // this device had records the cloud didn't
  }catch(e){}
}
async function pushFarmHistory(){
  if(!syncFarmName)return;
  const put=()=>fetch(buildHistoryUrl(syncFarmName),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({sha:historySha,data:{app:SYNC_APP_TAG,kind:'farm-history',farmName:syncFarmName,updatedAt:new Date().toISOString(),farmHistory:predState.farmHistory||[],farmHistoryDeleted:predState.farmHistoryDeleted||[]}})});
  try{
    let res=await put();
    if(res.status===409){const fresh=await fetch(buildHistoryUrl(syncFarmName),{cache:'no-store'}).then(r=>r.json()).catch(()=>null);if(fresh){historySha=fresh.sha||null;if(fresh.data){mergeCloudFarmHistory(fresh.data);savePredState();}}res=await put();}
    if(res.ok){const j=await res.json().catch(()=>null);if(j&&j.sha)historySha=j.sha;}
  }catch(e){console.warn('Farm history push failed',e);}
}
function scheduleHistoryPush(){if(!syncFarmName)return;clearTimeout(historyPushTimer);historyPushTimer=setTimeout(pushFarmHistory,800);}
// ── Three-way sync merge ──
// Each device keeps the version it last synced (the base). When the cloud has
// moved on, both sides' changes since that base are combined: lists merge item
// by item (loads/sheds by id, readings/pickups by date), a field changed on one
// side only takes that side, and a field changed on both takes this device's
// edit. A stale device can no longer overwrite newer work wholesale.
const SYNC_BASE_KEY='prodwise_sync_base_v1';
let syncBase=null;
function syncNorm(p){if(!p)return null;const c=JSON.parse(JSON.stringify(p));delete c.lastUpdated;return c;}
function syncEq(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function loadSyncBase(){try{const v=JSON.parse(localStorage.getItem(SYNC_BASE_KEY)||'null');syncBase=v&&v.key===buildFileKey(syncFarmName||'')?v.data:null;}catch(e){syncBase=null;}return syncBase;}
function saveSyncBase(data){syncBase=data;try{localStorage.setItem(SYNC_BASE_KEY,JSON.stringify({key:buildFileKey(syncFarmName||''),data}));}catch(e){}}
// Current local state as the cloud would store it (the shape every device writes)
function localSyncPayload(){return syncNorm(buildCloudPayload());}
function syncIsObj(v){return v!==null&&typeof v==='object'&&!Array.isArray(v);}
function syncArrKey(list){for(const k of ['id','date','d']){if(list.length&&list.every(x=>syncIsObj(x)&&x[k]!=null&&x[k]!==''))return k;}return null;}
function syncMerge(base,ours,theirs){
  if(syncEq(ours,theirs))return theirs;
  if(base!==undefined&&base!==null){if(syncEq(ours,base))return theirs;if(syncEq(theirs,base))return ours;}
  if(Array.isArray(ours)&&Array.isArray(theirs)){
    const b=Array.isArray(base)?base:[];const key=syncArrKey([...ours,...theirs,...b]);
    if(!key)return ours;
    const kv=x=>String(x[key]);const bm=new Map(b.map(x=>[kv(x),x])),om=new Map(ours.map(x=>[kv(x),x])),tm=new Map(theirs.map(x=>[kv(x),x]));
    const order=[...theirs.map(kv),...ours.map(kv).filter(k=>!tm.has(k))];const out=[];
    order.forEach(k=>{const bb=bm.get(k),o=om.get(k),t=tm.get(k);
      if(o&&t){out.push(syncMerge(bb,o,t));return;}
      if(o){if(bb&&syncEq(o,bb))return;out.push(o);return;}       // they deleted it (we hadn't changed it)
      if(t){if(bb&&syncEq(t,bb))return;out.push(t);}               // we deleted it (they hadn't changed it)
    });
    if(key!=='id')out.sort((x,y)=>String(x[key]).localeCompare(String(y[key])));
    return out;
  }
  if(syncIsObj(ours)&&syncIsObj(theirs)){
    const b=syncIsObj(base)?base:{};const out={};
    new Set([...Object.keys(ours),...Object.keys(theirs)]).forEach(k=>{
      const inO=k in ours,inT=k in theirs;
      if(inO&&inT){out[k]=syncMerge(b[k],ours[k],theirs[k]);return;}
      if(inO){if(k in b&&syncEq(ours[k],b[k]))return;out[k]=ours[k];return;}
      if(k in b&&syncEq(theirs[k],b[k]))return;out[k]=theirs[k];
    });
    return out;
  }
  return ours;   // same value changed on both devices: this device's edit wins
}
async function pullFromCloud(silent){
  if(!syncFarmName)return false;
  syncState='pulling';renderSettingsDrawerBody();
  const r=await fetchFromCloud();
  if(!r.ok){syncState='error';renderSettingsDrawerBody();if(!silent)showToast('Could not sync — check your connection.',true);return false;}
  if(r.notFound){syncState='idle';renderSettingsDrawerBody();await pushToCloud();if(!silent)showToast('Connected — created a new file for this farm.');return true;}
  syncSha=r.sha||null;
  if(r.data&&r.data.app&&r.data.app!==SYNC_APP_TAG){syncState='error';renderSettingsDrawerBody();if(!silent)showToast('Cloud file is not a ProdWise backup.',true);return false;}
  // Local changes not yet in the cloud? Merge them in rather than lose them.
  const base=syncBase||loadSyncBase();const ours=farmData?localSyncPayload():null;const theirs=syncNorm(r.data);
  const localEdits=!!ours&&(base?!syncEq(ours,base):pushPending);
  let toApply=r.data,needPush=false;
  if(localEdits&&!syncEq(ours,theirs)){
    try{await historyAutoSnapshot('auto-sync','Before cloud sync merge');}catch(e){}
    toApply=syncMerge(base||undefined,ours,theirs);needPush=!syncEq(toApply,theirs);
  }
  const ok=applyCloudPayload(toApply);
  if(!ok){syncState='error';renderSettingsDrawerBody();if(!silent)showToast('Cloud file is not a ProdWise backup.',true);return false;}
  saveSyncBase(needPush?theirs:localSyncPayload());
  if(needPush){pushPending=true;}
  syncLastSyncAt=Date.now();saveSyncState();
  syncState='idle';renderSettingsDrawerBody();render();
  pullFarmHistory();
  if(needPush)runScheduledPush();
  if(!silent)showToast('Synced ✓');
  return true;
}
async function pushToCloud(){
  if(!syncFarmName)return false;
  syncState='pushing';renderSettingsDrawerBody();
  try{
    const put=(sha,data)=>fetch(buildSyncUrl(syncFarmName),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({sha,data:{...data,lastUpdated:new Date().toISOString()}})});
    let data=localSyncPayload();
    let res=await put(syncSha,data);
    for(let tries=0;res.status===409&&tries<3;tries++){
      // The cloud changed since this device last synced (another device saved):
      // merge both sides' changes, show them here, then save the merge.
      const fresh=await fetch(buildSyncUrl(syncFarmName),{cache:'no-store'}).then(r=>r.json()).catch(()=>null);
      if(!fresh||!fresh.sha)throw new Error('Sync conflict: could not read the cloud');
      syncSha=fresh.sha;const theirs=syncNorm(fresh.data);
      const base=syncBase||loadSyncBase();
      try{await historyAutoSnapshot('auto-sync','Before cloud sync merge');}catch(e){}
      const merged=syncMerge(base||undefined,localSyncPayload(),theirs);
      applyCloudPayload(merged);data=localSyncPayload();
      try{render();}catch(e){}
      res=await put(syncSha,data);
    }
    if(!res.ok)throw new Error('Sync server responded '+res.status);
    const result=await res.json().catch(()=>null);if(result&&result.sha)syncSha=result.sha;
    saveSyncBase(data);
    syncLastSyncAt=Date.now();saveSyncState();
    syncState='idle';renderSettingsDrawerBody();
    return true;
  }catch(e){console.error('Push failed',e);syncState='error';renderSettingsDrawerBody();return false;}
}
function schedulePush(){if(!syncFarmName||!syncConnectedAt)return;pushPending=true;clearTimeout(pushDebounceTimer);pushDebounceTimer=setTimeout(runScheduledPush,2000);if(!pushMaxWaitTimer)pushMaxWaitTimer=setTimeout(runScheduledPush,30000);}
async function runScheduledPush(){clearTimeout(pushDebounceTimer);pushDebounceTimer=null;clearTimeout(pushMaxWaitTimer);pushMaxWaitTimer=null;if(!pushPending)return;if(pushInFlight){pushDebounceTimer=setTimeout(runScheduledPush,2000);return;}pushPending=false;pushInFlight=true;try{await pushToCloud();}finally{pushInFlight=false;}}
function flushPendingPush(){if(!pushPending)return;clearTimeout(pushDebounceTimer);pushDebounceTimer=null;clearTimeout(pushMaxWaitTimer);pushMaxWaitTimer=null;pushPending=false;pushToCloud();}
async function uploadExcelToCloud(file){
  if(!syncFarmName)return false;
  syncState='pushing';renderSettingsDrawerBody();
  try{
    const buf=await file.arrayBuffer();const base64=arrayBufferToBase64(buf);const uploadedAt=new Date().toISOString();
    const wrapperData={name:file.name||'sheds.xlsx',size:file.size||buf.byteLength,uploadedAt,base64};
    let res=await fetch(buildExcelWrapperUrl(syncFarmName),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({sha:syncExcelSha,data:wrapperData})});
    if(res.status===409){const fresh=await fetch(buildExcelWrapperUrl(syncFarmName)).then(r=>r.json()).catch(()=>null);if(fresh&&fresh.sha){syncExcelSha=fresh.sha;res=await fetch(buildExcelWrapperUrl(syncFarmName),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({sha:syncExcelSha,data:wrapperData})});}}
    if(!res.ok)throw new Error('Excel upload failed: '+res.status);
    const result=await res.json().catch(()=>null);if(result&&result.sha)syncExcelSha=result.sha;
    syncExcelMeta={name:wrapperData.name,size:wrapperData.size,uploadedAt};saveSyncState();
    await pushToCloud();syncState='idle';renderSettingsDrawerBody();
    return true;
  }catch(e){console.error('Excel upload failed',e);syncState='error';renderSettingsDrawerBody();showToast('Excel saved locally, but cloud upload failed.',true);return false;}
}
async function downloadExcelFromCloud(){
  if(!syncFarmName)return;
  try{
    const res=await fetch(buildExcelWrapperUrl(syncFarmName));
    if(!res.ok){showToast('Could not fetch the stored Excel.',true);return;}
    const result=await res.json();const wrapper=result&&result.data;
    if(!wrapper||!wrapper.base64){showToast('No stored Excel found.',true);return;}
    const blob=base64ToBlob(wrapper.base64,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const url=URL.createObjectURL(blob);const a=document.createElement('a');
    a.href=url;a.download=wrapper.name||'sheds.xlsx';
    document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
    showToast('Stored Excel downloaded.');
  }catch(e){console.error(e);showToast('Download failed.',true);}
}
async function listFarmBatches(farmName){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),10000);
  try{
    const res=await fetch(buildListingUrl(farmName),{signal:controller.signal});clearTimeout(timer);
    if(!res.ok)return {ok:false,reason:'http-'+res.status,files:[]};
    const result=await res.json();const rawFiles=(result&&Array.isArray(result.files))?result.files:[];
    const parsed=[];
    for(const f of rawFiles){const info=parseBatchFileInfo(farmName,f.name);if(!info)continue;parsed.push({...info,size:f.size,sha:f.sha,fileName:f.name});}
    parsed.sort((a,b)=>{if(a.isLegacy&&!b.isLegacy)return 1;if(b.isLegacy&&!a.isLegacy)return -1;return compareBatchKeys(a.batchKey,b.batchKey);});
    return {ok:true,files:parsed};
  }catch(e){clearTimeout(timer);return {ok:false,reason:(e&&e.name==='AbortError')?'timeout':((e&&e.message)||'network-error'),files:[]};}
}
function parseBatchFileInfo(farmName,fileName){
  const farm=sanitizeUserFarmName(farmName);const base=`${farm}${SYNC_SUFFIX}`;
  if(!fileName.startsWith(base))return null;
  if(!fileName.endsWith('.json'))return null;
  if(fileName.endsWith('-file.json'))return null;
  const middle=fileName.slice(base.length,-'.json'.length);
  if(middle==='')return {batchKey:'',label:'Legacy',isLegacy:true};
  if(!middle.startsWith('-'))return null;
  const key=middle.slice(1);
  return {batchKey:key,label:`Batch ${key}`,isLegacy:false};
}
function compareBatchKeys(a,b){const na=parseFloat(String(a).replace(/[^0-9.]/g,''));const nb=parseFloat(String(b).replace(/[^0-9.]/g,''));if(Number.isFinite(na)&&Number.isFinite(nb)&&na!==nb)return nb-na;return String(b).localeCompare(String(a));}
