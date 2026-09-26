const STORAGE_KEY='prodwise_vm_phase2_v1',VIEW_KEY='prodwise_vm_shedview_v1',THEME_KEY='prodwise_vm_theme_v1',SILO_KEY_V2='prodwise_vm_silo_v2',SILO_KEY='prodwise_vm_silo_v3',SESSION_KEY='prodwise_session_init_v1',SYNC_FARMNAME_KEY='prodwise_sync_farmname_v1',PRED_KEY='prodwise_predictions_v1',LOADS_KEY='prodwise_loads_v1',LOADS_VIEW_KEY='prodwise_loads_view_v1',NOTIF_PREFS_KEY='prodwise_notif_prefs_v1';
const SHED_COUNT=8,FEED_BLOCK_T=60,FIXED_FLOOR_AREA_M2=3162,MAX_PICKUPS_PER_SHED=5,MIN_PICKUPS_PER_SHED=4,MAX_PREDICTED_PICKUPS=6,DEFAULT_MORT_RATE_PCT=0.1,MAX_MORT_RATE_PCT=5;
const DEFAULT_CHICK_WEIGHT_KG=0.044,MIN_CHICK_WEIGHT_KG=0.030,MAX_CHICK_WEIGHT_KG=0.080,DEFAULT_BIAS_FACTOR=0.90,MIN_BIAS_FACTOR=0.70,MAX_BIAS_FACTOR=1.10;
const GOMPERTZ_K_MIN=0.02,GOMPERTZ_K_MAX=0.12,GOMPERTZ_A_MAX=30,MAX_UNCERTAINTY=0.35,DEFAULT_SHED_POPULATION=52000;
const DEFAULT_DENSITY_GLOBAL={maxDensity:32,triggerDensity:31,targetDensity:25.5,targetPickups:5};
const CLUCKWISE_URL='./cluckwise/',SYNC_WORKER_URL='https://prodplan-sync.vonrmangaron.workers.dev',SYNC_REPO='vonrmangaron/farmdata',SYNC_SUFFIX='-feed',SYNC_APP_TAG='prodwise',SYNC_SCHEMA_VERSION=13,MAX_EXCEL_WARN_BYTES=2*1024*1024;
const DEFAULT_VIEWS={1:'planner',2:'planner',3:'planner',4:'planner'},CONE_KG=10000,RING_KG=8000,MAX_RINGS=5,COMPARE_MIN_WIDTH=768;
const ROSS_308_WEIGHTS_KG={0:0.044,7:0.2135,14:0.533,21:1.012,28:1.6165,35:2.2955,42:2.998,49:3.6815,56:4.318};
const TARGET_DAYS=[7,14,21,28];
function ringsToKg(r){if(r===null||r===undefined||r===''||isNaN(r))return 0;const n=Number(r);if(n<0)return 0;if(n===0)return CONE_KG;return CONE_KG+RING_KG*Math.min(MAX_RINGS,Math.floor(n));}
const FEED_TYPES=[{id:'starter',label:'Starter'},{id:'grower',label:'Grower'},{id:'finisher',label:'Finisher'},{id:'withdrawal',label:'Withdrawal'}];
function feedTypeLabel(id){const f=FEED_TYPES.find(x=>x.id===id);return f?f.label:'Unspecified';}
function feedTypeTagHtml(id){const cls=id&&FEED_TYPES.some(f=>f.id===id)?id:'unspecified';return `<span class="feed-tag ${cls}">${feedTypeLabel(id)}</span>`;}
const ROSS_308_FEED_INTAKE={1:19,2:15,3:19,4:24,5:28,6:33,7:37,8:42,9:47,10:51,11:56,12:60,13:65,14:69,15:74,16:78,17:83,18:88,19:92,20:97,21:101,22:106,23:110,24:115,25:119,26:124,27:129,28:133,29:138,30:142,31:147,32:151,33:156,34:160,35:165,36:170,37:174,38:179,39:183,40:188,41:192,42:197,43:201,44:206,45:211,46:215,47:220,48:223,49:225,50:227,51:229,52:230,53:231,54:233,55:233,56:234,57:234,58:234,59:234,60:234};
const KEYS={shedId:['Shed','shed','ShedId','Shed ID','ShedID','Shed#','Shed No','ShedNo'],batch:['BatchNumber','Batch Number','Batch','Batch#'],placement:['PlacementDate','Placement Date','Placement','Placement_Dt'],cleanout:['CleanoutDate','Cleanout Date','Cleanout','Cleanout_Dt'],population:['InitialPopulation','Initial Population','Population','InitPop','InitialPop'],mortality:['Mortality','MortalityCount','Mortality Count','TotalMortality'],customFeed:['CustomFeedKg','Custom Feed Kg','CustomFeed','Custom Feed']};
let farmData=null,activeTab='dashboard',shedRange={start:0,end:0},siloRange={start:0,end:14},shedViewByGroup={...DEFAULT_VIEWS};
let siloData={1:{readings:[],deliveries:[]},2:{readings:[],deliveries:[]},3:{readings:[],deliveries:[]},4:{readings:[],deliveries:[]}};
let testDeliveries={1:[],2:[],3:[],4:[]},farmLoads=[],inlineDeliveryState=null;
let predState={beta:0.27,targetHarvestWeightKg:{1:2.65,2:2.65,3:2.65,4:2.65},predGroup:1,predView:'both',farmFeedOverride:null,farmLeftoverKg:null,deliveriesOpen:true,batchNumber:'',adjOpen:false,densityGlobal:{...DEFAULT_DENSITY_GLOBAL},noPickupDays:[]};
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
let notifPrefs={shedPerformance:true,feedBalance:true};

// Sidebar navigation definition — used by sidebarHtml() in render.js
const NAV_ITEMS = [
  { section: 'OVERVIEW' },
  { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
  { section: 'GROUPS' },
  { id: 'g1', label: 'Group 1', icon: 'home', badge: true },
  { id: 'g2', label: 'Group 2', icon: 'home', badge: true },
  { id: 'g3', label: 'Group 3', icon: 'home', badge: true },
  { id: 'g4', label: 'Group 4', icon: 'home', badge: true },
  { section: 'REPORTS' },
  { id: 'predictions', label: 'Predictions', icon: 'chart' },
  { section: 'TOOLS' },
  { id: 'feedloads', label: 'Feed Loads', icon: 'loads', modalBtnId: 'loadsBtn' },
  { id: 'siloreadings', label: 'Silo Readings', icon: 'silo', modalBtnId: 'siloBtn' },
  { id: 'comparefeed', label: 'Compare Feed', icon: 'compare', modalBtnId: 'toolsCompareBtn' },
  { id: 'history', label: 'History', icon: 'history' },
  { section: 'APPS' },
  { id: 'cluckwise', label: 'CluckWise', icon: 'cluckwise', external: true },
];
