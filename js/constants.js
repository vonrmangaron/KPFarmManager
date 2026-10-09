const STORAGE_KEY='prodwise_vm_phase2_v1',VIEW_KEY='prodwise_vm_shedview_v1',THEME_KEY='prodwise_vm_theme_v1',SILO_KEY_V2='prodwise_vm_silo_v2',SILO_KEY='prodwise_vm_silo_v3',SESSION_KEY='prodwise_session_init_v1',SYNC_FARMNAME_KEY='prodwise_sync_farmname_v1',PRED_KEY='prodwise_predictions_v1',LOADS_KEY='prodwise_loads_v1',LOADS_VIEW_KEY='prodwise_loads_view_v1',NOTIF_PREFS_KEY='prodwise_notif_prefs_v1';
const SHED_COUNT=8,FEED_BLOCK_T=60,FIXED_FLOOR_AREA_M2=3162,MAX_PICKUPS_PER_SHED=5,MIN_PICKUPS_PER_SHED=4,MAX_PREDICTED_PICKUPS=6,DEFAULT_MORT_RATE_PCT=0.1,MAX_MORT_RATE_PCT=5;
const DEFAULT_CHICK_WEIGHT_KG=0.044,MIN_CHICK_WEIGHT_KG=0.030,MAX_CHICK_WEIGHT_KG=0.080,DEFAULT_BIAS_FACTOR=0.90,MIN_BIAS_FACTOR=0.70,MAX_BIAS_FACTOR=1.10;
const GOMPERTZ_K_MIN=0.02,GOMPERTZ_K_MAX=0.12,GOMPERTZ_A_MAX=30,MAX_UNCERTAINTY=0.35,DEFAULT_SHED_POPULATION=52000;
const DEFAULT_DENSITY_GLOBAL={maxDensity:32,triggerDensity:31,targetDensity:25.5,targetPickups:5};
const CLUCKWISE_URL='./cluckwise/',SYNC_WORKER_URL='https://prodplan-sync.vonrmangaron.workers.dev',SYNC_REPO='vonrmangaron/farmdata',SYNC_SUFFIX='-feed',SYNC_APP_TAG='prodwise',SYNC_SCHEMA_VERSION=13,MAX_EXCEL_WARN_BYTES=2*1024*1024;
const DEFAULT_VIEWS={1:'overview',2:'overview',3:'overview',4:'overview'},CONE_KG=10000,RING_KG=8000,MAX_RINGS=5,COMPARE_MIN_WIDTH=768;
const ROSS_308_WEIGHTS_KG={0:0.044,7:0.2135,14:0.533,21:1.012,28:1.6165,35:2.2955,42:2.998,49:3.6815,56:4.318};
const TARGET_DAYS=[7,14,21,28];
function ringsToKg(r){if(r===null||r===undefined||r===''||isNaN(r))return 0;const n=Number(r);if(n<0)return 0;if(n===0)return CONE_KG;return CONE_KG+RING_KG*Math.min(MAX_RINGS,Math.floor(n));}
const FEED_TYPES=[{id:'starter',label:'Starter'},{id:'grower',label:'Grower'},{id:'finisher',label:'Finisher'},{id:'withdrawal',label:'Withdrawal'}];
function feedTypeLabel(id){const f=FEED_TYPES.find(x=>x.id===id);return f?f.label:'Unspecified';}
function feedTypeTagHtml(id){const cls=id&&FEED_TYPES.some(f=>f.id===id)?id:'unspecified';return `<span class="feed-tag ${cls}">${feedTypeLabel(id)}</span>`;}
const ROSS_308_FEED_INTAKE={1:11,2:15,3:19,4:24,5:28,6:33,7:37,8:42,9:47,10:51,11:56,12:60,13:65,14:69,15:74,16:78,17:83,18:88,19:92,20:97,21:101,22:106,23:110,24:115,25:119,26:124,27:129,28:133,29:138,30:142,31:147,32:151,33:156,34:160,35:165,36:170,37:174,38:179,39:183,40:188,41:192,42:197,43:201,44:206,45:211,46:215,47:220,48:223,49:225,50:227,51:229,52:230,53:231,54:233,55:233,56:234,57:234,58:234,59:234,60:234};
const KEYS={shedId:['Shed','shed','ShedId','Shed ID','ShedID','Shed#','Shed No','ShedNo'],batch:['BatchNumber','Batch Number','Batch','Batch#'],placement:['PlacementDate','Placement Date','Placement','Placement_Dt'],cleanout:['CleanoutDate','Cleanout Date','Cleanout','Cleanout_Dt'],population:['InitialPopulation','Initial Population','Population','InitPop','InitialPop'],mortality:['Mortality','MortalityCount','Mortality Count','TotalMortality'],customFeed:['CustomFeedKg','Custom Feed Kg','CustomFeed','Custom Feed']};
let farmData=null,activeTab='home',shedRange={start:0,end:0},siloRange={start:0,end:14},shedViewByGroup={...DEFAULT_VIEWS};
let siloData={1:{readings:[],deliveries:[]},2:{readings:[],deliveries:[]},3:{readings:[],deliveries:[]},4:{readings:[],deliveries:[]}};
let testDeliveries={1:[],2:[],3:[],4:[]},farmLoads=[],inlineDeliveryState=null;
// Projections follow the Ross 308 standard (intake by age; growth fitted
// to your actual weighings). When true, they would also learn intake from
// silo readings and thinning / last-pickup timing from this farm's data.
const FARM_LEARNING=false;
// Projection model version — bump with a note whenever the maths behind the
// projected result changes, so a jump in the numbers is never a mystery.
const MODEL_VERSION='2026-10-02b';
const MODEL_NOTES={'2026-10-02':'Feed already eaten is measured (dockets + carry-over − silo stock), Ross 308 intake after','2026-10-02b':'Final pickups predicted heavier than the growth curve (Adjust → Final pickup weight vs thins)'};
// Final birds weigh more than thinned birds (relative to Ross): thins take
// lighter birds and the rest grow on with more room. Default from Farm 1's
// past batches (2606/2607: +8–10%); 0 = pure growth curve.
const DEFAULT_FINAL_UPLIFT_PCT=8;
// Feed plan: integrator quota per bird placed (kg) for each feed type —
// withdrawal has none (fed until clean-out). Trucks are always 60 t,
// split between pairs; 'simple' = 60 · 30/30 · 15/15/15/15.
const DEFAULT_FEED_QUOTA={starter:0.3,grower:1.0,finisher:2.0},TRUCK_KG=60000,SPLIT_STEP_KG=15000;
let predState={feedQuota:{...DEFAULT_FEED_QUOTA},truckSplitMode:'simple',finalUpliftPct:DEFAULT_FINAL_UPLIFT_PCT,projectionLog:[],siloConfidencePct:100,safetyDays:1,deliveryTiming:'early',starterSilo:{1:null,2:null,3:null,4:null},starterBufferDays:21,siloStart:null,farmHistory:[],carryoverFarmKg:0,carryoverKg:{1:0,2:0,3:0,4:0},beta:0.27,targetHarvestWeightKg:{1:2.65,2:2.65,3:2.65,4:2.65},predGroup:1,predView:'both',farmFeedOverride:null,farmLeftoverKg:null,deliveriesOpen:true,batchNumber:'',adjOpen:false,densityGlobal:{...DEFAULT_DENSITY_GLOBAL},noPickupDays:[]};
const DEFAULT_DAILY_RANGE={mode:'today',start:0,end:7};
let dailyRangeState={...DEFAULT_DAILY_RANGE};
let feedCompareState={modalOpen:false,selectedGroups:[],layoutMode:'auto',visibleColumns:{date:true,age:true,liveBirds:true,dailyFeed:true,delivery:true,endBalance:true}};
let loadsModalState={open:false,filter:'all',view:'table'},loadModalState=null,newBatchModalPhase='choice',batchHistoryCache=null,batchHistoryPage=0;
let siloModalOpenGroups={1:true,2:false,3:false,4:false};
const BATCHES_PER_PAGE=4;
let renderTimer=null,syncFarmName=null,syncSha=null,syncExcelSha=null,syncExcelMeta=null,syncConnectedAt=null,syncLastSyncAt=null,syncState='idle';
let pushDebounceTimer=null,pushMaxWaitTimer=null,pushPending=false,pushInFlight=false;
let manualPickupState=null,sampleState=null,predictedPickupState=null,pendingImport=null,reviewChoices={};
let gompertzCache=new Map(),settingsDrawerOpen=false,pendingNewBatchClean='',pendingNewBatchDownload=true;
let siloLevelSel={};
let notifPrefs={shedPerformance:true,feedBalance:true};

// Farm name shown in the app. A view-only label: the cloud farm ID
// (syncFarmName) used for sync/storage never changes. Per device.
const FARM_DISPLAY_KEY='prodwise_farm_display_name_v1';
let farmDisplayName=(()=>{try{return localStorage.getItem(FARM_DISPLAY_KEY)||'';}catch(e){return '';}})();
function displayFarmName(){return (farmDisplayName||'').trim()||(typeof syncFarmName!=='undefined'&&syncFarmName)||'';}
function setFarmDisplayName(v){
  farmDisplayName=String(v||'').slice(0,40);
  try{if(farmDisplayName.trim())localStorage.setItem(FARM_DISPLAY_KEY,farmDisplayName);else localStorage.removeItem(FARM_DISPLAY_KEY);}catch(e){}
  // Update names in place — no full render, so typing isn't interrupted.
  if(typeof renderSyncPill==='function')renderSyncPill();
  if(typeof updatePageHeader==='function')updatePageHeader();
  const t=document.getElementById('farmResultTitle');if(t&&typeof farmResultTitle==='function')t.innerHTML=farmResultTitle();
}

// Display name for a group (a pair of sheds sharing one silo bank).
// Groups are named by their sheds: group 2 → "Sheds 3–4".
function pairShort(g){return `${2*g-1}–${2*g}`;}
function pairLabel(g){return `Sheds ${pairShort(g)}`;}
// Feed carried over from the last batch: ONE farm-wide amount (kg), no
// date, not a load, not in feed-type counts. Added to the batch's total feed
// when that total comes from your dockets (manual override). Older per-pair
// values (carryoverKg) are folded into the total.
function carryoverTotalKg(){
  const v=Number(predState.carryoverFarmKg);if(Number.isFinite(v)&&v>0)return v;
  const c=predState.carryoverKg||{};return [1,2,3,4].reduce((s,g)=>{const x=Number(c[g]);return s+(Number.isFinite(x)&&x>0?x:0);},0);
}
function carryoverKg(){return 0;} // per-pair carry-over retired (one farm-wide field)
function setCarryoverTotal(tonnes){const n=Number(tonnes);predState.carryoverFarmKg=(Number.isFinite(n)&&n>0)?Math.round(n*1000):0;predState.carryoverKg={1:0,2:0,3:0,4:0};savePredState();schedulePush();}
// Silo reading time of day: 'am' = morning (start-of-day stock) or 'pm' =
// evening (end-of-day stock), stamped on each reading. Auto from the clock
// (before noon = morning); tapping Morning/Evening overrides it for today only.
const SILO_TIME_KEY='prodwise_silo_read_time_v2',SILO_AUTO_NOON=12;
function siloReadTimeOverride(){try{const v=JSON.parse(localStorage.getItem(SILO_TIME_KEY)||'null');return v&&v.date===iso(new Date())&&(v.t==='am'||v.t==='pm')?v.t:null;}catch(e){return null;}}
function siloReadTimeAuto(){return new Date().getHours()<SILO_AUTO_NOON?'am':'pm';}
function siloReadTime(){return siloReadTimeOverride()||siloReadTimeAuto();}
function siloReadTimeLabel(t){return t==='am'?'Morning':'Evening';}
// Changing it also re-tags TODAY's readings (the ones being entered now)
function setSiloReadTime(t){
  t=t==='am'?'am':'pm';try{localStorage.setItem(SILO_TIME_KEY,JSON.stringify({t,date:iso(new Date())}));}catch(e){}
  const todayIso=iso(new Date());let changed=false;
  [1,2,3,4].forEach(g=>{const r=(siloData[g]&&siloData[g].readings||[]).find(x=>x.date===todayIso);if(r&&r.time!==t){r.time=t;changed=true;}const lg=(siloData[g]&&siloData[g].log)||[];const le=lg.filter(e=>e.date===todayIso).pop();if(le)le.time=t;});
  if(changed){saveSiloData();schedulePush();}
}
// Morning / Evening switch (Silo sheet + Current Silo Stock card)
function readTimeToggleHtml(){
  const t=siloReadTime();
  return `<span class="rt-toggle" role="group" aria-label="Reading time"><button type="button" data-read-time="am" aria-pressed="${t==='am'}" class="${t==='am'?'active':''}" title="Start-of-day stock — before feeding and before today's delivery">🌅 Morning</button><button type="button" data-read-time="pm" aria-pressed="${t==='pm'}" class="${t==='pm'?'active':''}" title="End-of-day stock — after today's delivery">🌇 Evening</button><span class="rt-auto" title="${siloReadTimeOverride()?'You picked this for today — back to automatic tomorrow.':'Set from the clock: before noon = Morning, from noon = Evening. Tap to change it for today.'}">${siloReadTimeOverride()?'set for today':'auto'}</span></span>`;
}
// Farm-wide silo numbering: 12 silos, 3 per pair — pair 2's silos are 4, 5, 6
// Silo number as painted on the farm (Farm profile): set a range like 1–12 and
// pair 1 shows 1·2·3, pair 2 shows 4·5·6… Not set: every pair shows 1–3.
function siloStart(){const v=Number(predState.siloStart);return Number.isInteger(v)&&v>=1&&v<=990?v:null;}
function siloNumber(g,n){const s=siloStart();return s!=null?s+(g-1)*3+n-1:n;}
// Silo reading log: every reading session with its time (stored, synced)
function readingAtField(r){const a=r&&r.at;return (typeof a==='string'&&!isNaN(Date.parse(a)))?{at:a}:{};}
function normReadingLog(list){if(!Array.isArray(list))return [];return list.map(e=>{if(!e||!/^\d{4}-\d{2}-\d{2}$/.test(String(e.date))||isNaN(Date.parse(e.at)))return null;const ring=v=>(v===null||v===undefined||v==='')?null:Math.max(0,Math.min(MAX_RINGS,Math.floor(Number(v))||0));return {id:String(e.id||('rd'+Date.parse(e.at))),at:String(e.at),date:String(e.date),time:e.time==='am'?'am':'pm',silo1Rings:ring(e.silo1Rings),silo2Rings:ring(e.silo2Rings),silo3Rings:ring(e.silo3Rings)};}).filter(Boolean).sort((a,b)=>a.at.localeCompare(b.at)).slice(-400);}
// Which silos were open at a reading (1–3 within the pair; one or two)
function readingOpenField(r){const a=Array.isArray(r&&r.open)?[...new Set(r.open.map(Number).filter(n=>n>=1&&n<=3))].sort():[];return a.length?{open:a}:{};}
// Starter silo per pair (1–3) and how many days before clean-out to plan it
function applyStarterPrefs(v){if(!v)return;if(v.starterSilo&&typeof v.starterSilo==='object'){const o={1:null,2:null,3:null,4:null};[1,2,3,4].forEach(g=>{const n=Number(v.starterSilo[g]);if(n>=1&&n<=3)o[g]=n;});predState.starterSilo=o;}const b=Number(v.starterBufferDays);if(b===14||b===21)predState.starterBufferDays=b;if('siloStart' in v){const s=Number(v.siloStart);predState.siloStart=Number.isInteger(s)&&s>=1&&s<=990?s:null;}}
// A load's silo per pair: {g: 1–3}
function normSiloFor(v){const o={};if(v&&typeof v==='object')[1,2,3,4].forEach(g=>{const a=[...new Set((Array.isArray(v[g])?v[g]:[v[g]]).map(Number).filter(n=>n===1||n===2||n===3))].slice(0,2);if(a.length)o[g]=a.length===1?a[0]:a;});return o;}

// Sidebar navigation definition — used by sidebarHtml() in render.js
const NAV_ITEMS = [
  { section: 'OVERVIEW' },
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'dashboard', label: 'Result detail', icon: 'grid' },
  { section: 'SHEDS' },
  { id: 'g1', label: pairLabel(1), icon: 'shed', badge: true },
  { id: 'g2', label: pairLabel(2), icon: 'shed', badge: true },
  { id: 'g3', label: pairLabel(3), icon: 'shed', badge: true },
  { id: 'g4', label: pairLabel(4), icon: 'shed', badge: true },
  { section: 'TOOLS' },
  { id: 'feedloads', label: 'Feed Loads', icon: 'loads', modalBtnId: 'loadsBtn' },
  { id: 'pickups', label: 'Pickups', icon: 'pickups', modalBtnId: 'pickupsBtn' },
  { id: 'mortality', label: 'Mortality', icon: 'mortality', modalBtnId: 'mortBtn' },
  { id: 'comparefeed', label: 'Compare Feed', icon: 'compare', modalBtnId: 'toolsCompareBtn' },
  { id: 'history', label: 'History', icon: 'history' },
  { id: 'farmsettings', label: 'Farm settings', icon: 'gear' },
  { section: 'APPS' },
  { id: 'cluckwise', label: 'CluckWise', icon: 'cluckwise', external: true },
];
