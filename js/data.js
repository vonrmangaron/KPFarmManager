function buildDefaultShed(id){return {id,placementDate:null,initialPopulation:DEFAULT_SHED_POPULATION,cleanoutDate:null,mortality:0,mortalityUpdatedAt:null,customFeedKg:null,pickups:[],targetCurve:{7:null,14:null,21:null,28:null},mortalityRatePercent:DEFAULT_MORT_RATE_PCT,chickWeightKg:DEFAULT_CHICK_WEIGHT_KG,inYardSamples:[],predictedPickups:[],targetPickups:null,densitySettings:{useGlobal:true,maxDensity:null,triggerDensity:null,targetDensity:null}};}
function buildDefaultFarmData(batchNumber){return {batchNumber:batchNumber||'',importDate:new Date().toISOString(),fileName:null,biasFactor:DEFAULT_BIAS_FACTOR,sheds:Array.from({length:SHED_COUNT},(_,i)=>buildDefaultShed(i+1))};}
function resetAllToDefaults(batchNumber){
  farmData=buildDefaultFarmData(batchNumber);
  predState.batchNumber=batchNumber||'';predState.farmFeedOverride=null;predState.farmLeftoverKg=null;predState.predGroup=1;predState.predView='both';predState.beta=0.27;predState.targetHarvestWeightKg={1:2.65,2:2.65,3:2.65,4:2.65};predState.densityGlobal={...DEFAULT_DENSITY_GLOBAL};predState.deliveriesOpen=true;predState.adjOpen=false;
  siloData={1:{readings:[],deliveries:[]},2:{readings:[],deliveries:[]},3:{readings:[],deliveries:[]},4:{readings:[],deliveries:[]}};
  testDeliveries={1:[],2:[],3:[],4:[]};farmLoads=[];
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
function deliveriesKgOnAll(group,D){return loadsKgOnAll(group,D);}
function balanceOnEndOfDay(group,D){
  const latest=latestReading(group);if(!latest)return null;
  const latestDate=dateOnly(latest.date);const targetD=dateOnly(D);const sheds=shedsForGroup(group);
  if(targetD.getTime()===latestDate.getTime())return readingTotalKg(latest);
  if(targetD>latestDate){let bal=readingTotalKg(latest);for(let d=addDays(latestDate,1);d<=targetD;d=addDays(d,1)){bal=bal+deliveriesKgOnAll(group,d)-groupDailyFeedOn(sheds,d);}return bal;}
  let bal=readingTotalKg(latest);for(let d=latestDate;d>targetD;d=addDays(d,-1)){bal=bal-deliveriesKgOnAll(group,d)+groupDailyFeedOn(sheds,d);}return bal;
}
function currentBalanceKg(group){return balanceOnEndOfDay(group,new Date());}
function consumptionSinceLatestReading(group){
  const latest=latestReading(group);if(!latest)return 0;
  const latestDate=dateOnly(latest.date);const today=dateOnly(new Date());if(latestDate>=today)return 0;
  const sheds=shedsForGroup(group);let c=0;
  for(let d=addDays(latestDate,1);d<=today;d=addDays(d,1))c+=groupDailyFeedOn(sheds,d);
  return c;
}
function deliveriesSinceLatestReading(group){
  const latest=latestReading(group);if(!latest)return 0;
  const latestDate=dateOnly(latest.date);const today=dateOnly(new Date());if(latestDate>=today)return 0;
  let d=0;for(let x=addDays(latestDate,1);x<=today;x=addDays(x,1))d+=deliveriesKgOn(group,x);
  return d;
}
function computeSiloForecast(group,range){
  const sheds=shedsForGroup(group);const today=dateOnly(new Date());const rows=[];
  let totalConsumption=0,totalDelivered=0;
  const realPickupsByDay={};const predictedPickupsByDay={};
  sheds.forEach(s=>{const eff=computeEffectivePickups(s);eff.forEach(p=>{const k=iso(p.date);if(p.__source==='predicted')predictedPickupsByDay[k]=(predictedPickupsByDay[k]||0)+(Number(p.birds)||0);else realPickupsByDay[k]=(realPickupsByDay[k]||0)+(Number(p.birds)||0);});});
  for(let off=range.start;off<=range.end;off++){
    const d=addDays(today,off);const isPast=off<0;const isToday=off===0;
    const cons=groupDailyFeedOn(sheds,d);const del=deliveriesKgOnAll(group,d);
    const deliveriesOnDay=allDeliveriesForGroup(group).filter(x=>iso(x.date)===iso(d));
    const bal=balanceOnEndOfDay(group,d);
    const liveBirds=sheds.reduce((sum,s)=>sum+liveAtStartOfDay(s,d),0);
    const key=iso(d);
    const realPickups=realPickupsByDay[key]||0;const predPickups=predictedPickupsByDay[key]||0;
    const pickupsBirds=realPickups+predPickups;const hasPredicted=predPickups>0;
    totalConsumption+=cons;totalDelivered+=del;
    rows.push({date:d,consumption:cons,delivery:del,deliveries:deliveriesOnDay,balance:bal,liveBirds,pickupsBirds,hasPredicted,isToday,isPast,isFuture:!isPast&&!isToday,isWeekend:isWeekend(d)});
  }
  let depletedDate=null;
  for(const r of rows){if(r.balance!==null&&r.balance<=0&&r.consumption>0&&!r.isPast){depletedDate=r.date;break;}}
  const endBalance=rows.length?rows[rows.length-1].balance:null;
  const totalStock=balanceOnEndOfDay(group,today);
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
function projectedLeftoverForGroup(group){
  const sheds=shedsForGroup(group);
  const cleanouts=sheds.map(s=>s.cleanoutDate).filter(Boolean);
  if(cleanouts.length===0)return null;
  const latest=cleanouts.reduce((a,b)=>a>b?a:b);
  const bal=balanceOnEndOfDay(group,latest);
  return {date:latest,balance:bal};
}
function totalFarmLeftover(){let sum=0;let any=false;[1,2,3,4].forEach(g=>{const lo=projectedLeftoverForGroup(g);if(lo&&lo.balance!==null){sum+=lo.balance;any=true;}});return any?sum:null;}
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
function removeTestDelivery(group,id){if(!testDeliveries[group])return;const before=testDeliveries[group].length;testDeliveries[group]=testDeliveries[group].filter(t=>t.id!==id);if(testDeliveries[group].length!==before){render();showToast('Test delivery removed.');}}
function clearTestDeliveries(group){
  const count=(testDeliveries[group]||[]).length;if(count===0)return;
  if(!confirm(`Clear all ${count} test deliver${count===1?'y':'ies'} from this group?\n\nReal loads are not affected.`))return;
  testDeliveries[group]=[];inlineDeliveryState=null;render();
  showToast(`🧹 Cleared ${count} test deliver${count===1?'y':'ies'}.`);
}
let toastTimer=null;
