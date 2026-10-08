// ProdWise smoke tests — run before every push:  node tests/smoke.js
// Made-up data only (this repo is public). Loads every script into one
// context (catches duplicate/missing globals), runs the main calculations
// and renders the main cards, and fails on errors, NaN or "undefined".
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
let failed=0,passed=0;
const ok=(cond,msg)=>{if(cond)passed++;else{failed++;console.log('  ✗',msg);}};
const near=(a,b,tol)=>Math.abs(a-b)<=tol;
const stub=new Proxy(function(){},{get:(t,k)=>k===Symbol.toPrimitive?()=>'':stub,apply:()=>stub,set:()=>true});
const store={};
const ctx={console,Math,JSON,Intl,Date,localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v);},removeItem:k=>{delete store[k];}},
  document:stub,navigator:{onLine:false},setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},fetch:()=>Promise.reject(new Error('offline')),
  performance:{now:()=>Date.now()},location:{search:'',hash:''},matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){},requestAnimationFrame:()=>0,CSS:{escape:s=>s}};
ctx.window=ctx;vm.createContext(ctx);
const ORDER=['constants','calc','loads','storage','sync','data','ui','history','render'];
console.log('1. Scripts load together');
for(const f of ORDER){try{vm.runInContext(fs.readFileSync(path.join(ROOT,'js',f+'.js'),'utf8'),ctx,{filename:f+'.js'});passed++;}catch(e){failed++;console.log('  ✗',f+'.js:',e.message);}}
try{new Function(fs.readFileSync(path.join(ROOT,'js','app.js'),'utf8'));passed++;}catch(e){failed++;console.log('  ✗ app.js syntax:',e.message);}
const run=(label,code)=>{try{return vm.runInContext(code,ctx);}catch(e){failed++;console.log('  ✗',label+':',e.message);return null;}};

console.log('2. Required functions exist');
['batchKpis','computeFarmTotals','computeGroupPredictions','computePredictions','computeSiloForecast','computeFarmAlerts','measuredFeedToDate','feedEatenMeasured',
 'readingEndOfDayKg','balanceOnEndOfDay','shedFeedOn','shedFeedOnRaw','resultPlanEndDate','autoPlanForShed','farmTotalsEarly','renderFarmKpiCard','renderFeedPlanner','batchInfoHtml','batchInfoForProdwise','openBatchInfoModal','biBirdStats',
 'siloSettingsBarHtml','renderSettingsFarmHistoryCard','fhRowHtml','summarizeBatchData','mergeCloudFarmHistory','siloReadTime','siloConfidence','siloSafetyDays',
 'fmtFeed','feedIn','feedOut','pairSwitchHtml','historyKpis','farmFeedToOrder','recordProjectionSnapshot','mergeProjectionLog','projectionLogHtml','finalUpliftFactor','feedPlan','packTrucks','feedPlanHtml','nextFeedTypeDue','readingIncludesDayDelivery','deliveryInQuestionHtml','refreshLoadsViews','leftoverNoteText','projLeftoverText']
 .forEach(n=>ok(run('typeof '+n,`typeof ${n}`)==='function','missing function: '+n));

console.log('3. Formulas (batchKpis)');
const k=run('batchKpis',`batchKpis({feedKg:1700000,liveWeightKg:1000000,birds:400000,ageBirdSum:400000*44,placed:420000,mortality:20000,targetKg:2.45})`);
if(k){ok(near(k.fcr,1.7,1e-9),'FCR = feed ÷ live weight');ok(near(k.alw,2.5,1e-9),'ALW = live weight ÷ birds');ok(near(k.avgAge,44,1e-9),'avg age');
  ok(near(k.livability,100-20000/420000*100,1e-9),'livability = 100 − mortality %');ok(near(k.cfcr,1.7-(2.5-2.45)*0.27,1e-9),'cFCR Baiada');
  ok(near(k.cfcrInd,1.7-(2.5-2.45)/3.2,1e-9),'cFCR Industry');ok(near(k.pif,k.livability*2.5/(44*1.7)*100,1e-9),'PIF');}

console.log('4. Made-up farm: projection, silos, alerts, history');
run('setup',`
schedulePush=function(){};scheduleHistoryPush=function(){};saveState=function(){};saveSiloData=function(){};savePredState=function(){};
var T=dateOnly(new Date());
farmData=buildDefaultFarmData('T1');predState.batchNumber='T1';
farmData.sheds.forEach((s,i)=>{s.placementDate=addDays(T,-32);s.cleanoutDate=addDays(T,20);s.initialPopulation=50000;s.mortality=1200;s.mortalityUpdatedAt=addDays(T,-2);
  s.targetCurve={7:0.18,14:0.47,21:0.98,28:1.58};});
[0,1,2].forEach(i=>{farmData.sheds[i].pickups=[{date:addDays(T,-1),birds:8000,isFinal:false,totalWeightKg:8000*1.85,totalWeightKgFromExcel:8000*1.85,source:'excel'}];});
farmLoads=[];
[-30,-24,-18,-12,-6,-1].forEach((d,i)=>{saveLoad({date:addDays(T,d),feedType:'grower',plannedKg:120000,splitKg:{1:30000,2:30000,3:30000,4:30000},note:'',actualKg:120000+i*100});});
saveLoad({date:addDays(T,3),feedType:'finisher',plannedKg:60000,splitKg:{1:30000,2:30000,3:0,4:0},note:'',actualKg:null});
const rd=(d,a,b)=>({date:iso(addDays(T,d)),silo1Rings:a,silo2Rings:b,silo3Rings:null,time:'pm'});
[1,2,3,4].forEach(g=>{siloData[g]={readings:[rd(-20,4,4),rd(-14,3,3),rd(-8,4,3),rd(-2,3,2)],deliveries:[]};});
predState.carryoverFarmKg=20000;predState.siloConfidencePct=90;predState.safetyDays=1;
predState.farmHistory=[];addFarmHistoryRec({batch:'T0',endDate:iso(addDays(T,-80)),source:'auto',placed:400000,picked:380000,liveWeightKg:1050000,feedKg:1800000,avgAge:44});
autoPlanCache=new Map();gompertzCache=new Map();`);
const t=run('computeFarmTotals','computeFarmTotals()');
if(t){const fin=['totalFeed','totalLiveWeight','fcr','cfcr','cfcrInd','pif','avgWeight','livability','weightedAge'].every(x=>Number.isFinite(t[x]));
  ok(t.hasData,'projection has data');ok(fin,'projection numbers are all finite');ok(t.fcr>0.8&&t.fcr<3,'FCR in a sane range ('+(t.fcr&&t.fcr.toFixed(3))+')');
  ok(!!t.feedMeasured,'measured feed-to-date is used when every pair has readings');
  ok(near(t.fcr,t.totalFeed/t.totalLiveWeight,1e-9),'projection FCR = feed ÷ live weight');}
const e=run('farmTotalsEarly','farmTotalsEarly()');
if(e&&t)ok(e.totalFeed<=t.totalFeed,'early-finish range uses no more feed than the clean-out date');
const fc=run('computeSiloForecast',`[1,2,3,4].map(g=>computeSiloForecast(g,{start:0,end:14},{realOnly:true}))`);
if(fc)ok(fc.every(f=>f.rows.length===15&&f.rows.every(r=>r.safety>=0)),'silo forecast rows + safety stock');
const al=run('computeFarmAlerts','computeFarmAlerts()');
if(al)ok(Array.isArray(al)&&al.every(a=>!/NaN|undefined|Infinity/.test(a.msg)),'alerts are clean ('+al.length+')');
run('readings confidence',`(()=>{const r=siloData[1].readings[siloData[1].readings.length-1];return readingEndOfDayKg(1,r,deliveriesKgOn);})()`);

console.log('5. Rendered cards have no NaN / undefined');
const html={kpi:'renderFarmKpiCard()',planner:'renderFeedPlanner(1,shedsForGroup(1),T)',siloBar:'siloSettingsBarHtml()',history:'renderSettingsFarmHistoryCard()',
  batchInfo:'batchInfoHtml(Object.assign(batchInfoForProdwise(),{events:[{name:"Audit",date:iso(addDays(T,5)),color:"#f90"}]}))',
  pairSwitch:'pairSwitchHtml(1,"pred")',feedPlan:'feedPlanHtml()',fhRow:'fhRowHtml(predState.farmHistory[0])'};
for(const [n,c] of Object.entries(html)){const h=run('render '+n,c);if(h!=null){const txt=String(h).replace(/<[^>]+>/g,' ');ok(!/\bNaN\b|\bundefined\b|Infinity/.test(txt),n+' renders without NaN/undefined');}}

console.log('5b. Final pickup uplift');
const up=run('uplift',`(()=>{predState.finalUpliftPct=0;autoPlanCache=new Map();const a=computeFarmTotals();predState.finalUpliftPct=8;autoPlanCache=new Map();const b=computeFarmTotals();return [a.totalLiveWeight,b.totalLiveWeight,a.totalFeed,b.totalFeed,b.cfcr<a.cfcr];})()`);
if(up){ok(up[1]>up[0],'+8% raises projected live weight');ok(near(up[2],up[3],1),'uplift does not change feed');ok(up[4],'uplift lowers cFCR');}

console.log('5c. Auto plan respects logged (kill-sheet) pickups');
const ap=run('auto plan',`(()=>{const s=farmData.sheds[3];s.pickups=[{date:addDays(T,2),birds:6000,isFinal:false,totalWeightKg:6000*2,weightEstimated:true,source:'manual'},{date:addDays(T,4),birds:7000,isFinal:false,totalWeightKg:7000*2.1,weightEstimated:true,source:'manual'}];
  autoPlanCache=new Map();const plan=autoPlanForShed(s);const last=addDays(T,4);
  const regs=plan.filter(x=>!x.isFinal).map(x=>dateOnly(x.date)).sort((a,b)=>a-b);
  return [plan.every(x=>dateOnly(x.date)>last),regs.every((d,i)=>!i||daysBetween(regs[i-1],d)>=3),Math.round(Number(fhRowHtml&&1))];})()`);
if(ap){ok(ap[0],'auto plan starts after the last logged pickup');ok(ap[1],'auto pickups are at least 3 days apart');}

console.log('5c2. Leftover only comes off the docket total');
const lo=run('leftover',`(()=>{predState.farmLeftoverKg=null;predState.farmFeedOverride=null;const a=computeFarmTotals().totalFeed;predState.farmLeftoverKg=30000;const b=computeFarmTotals().totalFeed;
  predState.farmFeedOverride=1500000;const c=computeFarmTotals().totalFeed;predState.farmLeftoverKg=null;predState.farmFeedOverride=null;return [a,b,c];})()`);
if(lo){ok(near(lo[0],lo[1],1),'auto estimate ignores the leftover');ok(near(lo[2],1500000+20000-30000,1),'docket total = docket + carry-over − leftover');}

console.log('5d. Feed plan + 60 t trucks');
const pk=run('packTrucks',`(()=>{const sum=tr=>{const per={};tr.forEach(t=>Object.entries(t).forEach(([g,v])=>per[g]=(per[g]||0)+v));return per;};
  const st=packTrucks({1:31281,2:31139,3:31410,4:30970},'simple'),gr=packTrucks({1:104270,2:103795,3:104700,4:103232},'simple'),fi=packTrucks({1:0,2:0,3:0,4:56000},'simple'),an=packTrucks({1:40000,2:20000,3:0,4:70000},'any15');
  const all60=[st,gr,fi,an].every(L=>L.every(t=>Object.values(t).reduce((a,v)=>a+v,0)===60000));
  return [st.length,JSON.stringify(sum(st)),gr.length,JSON.stringify(sum(gr)),fi.length,all60,Object.entries(sum(an)).every(([g,v])=>v>={1:40000,2:20000,3:0,4:70000}[g])];})()`);
if(pk){ok(pk[0]===3&&pk[1]==='{"1":45000,"2":45000,"3":45000,"4":45000}','starter: 3 trucks, 45 t per pair');ok(pk[2]===7&&pk[3]==='{"1":105000,"2":105000,"3":105000,"4":105000}','grower: 7 trucks, 105 t per pair');
  ok(pk[4]===1,'one finisher truck for one pair');ok(pk[5],'every truck is exactly 60 t');ok(pk[6],'never below what each pair needs');}
const fp=run('feedPlan',`(()=>{const p=feedPlan();return p&&FEED_PLAN_TYPES.every(t=>p.pairs.every(g=>Number.isFinite(p.rows[g][t].ordered)&&Number.isFinite(p.rows[g][t].still)));})()`);
ok(fp===true,'feed plan numbers are finite');
const fc2=run('carry',`(()=>{const p=feedPlan();return p.farm.withdrawal.ordered-p.pairs.reduce((s,g)=>s+p.rows[g].withdrawal.ordered,0);})()`);
ok(fc2===20000,'carry-over counts as withdrawal in the farm total');

console.log('6. Projection log');
const pl=run('projection log',`(()=>{predState.projectionLog=[{d:'2026-01-01',feed:1,fcr:1.7,cfcr:1.6,alw:2.7,age:44,liv:95,m:'old',at:1}];
  recordProjectionSnapshot(computeFarmTotals());const n1=predState.projectionLog.length;recordProjectionSnapshot(computeFarmTotals());const n2=predState.projectionLog.length;
  mergeProjectionLog([{d:'2026-01-01',feed:2,fcr:1.8,cfcr:1.7,alw:2.7,age:44,liv:95,m:'old',at:5}]);const merged=predState.projectionLog[0].feed;
  return [n1,n2,merged,String(projectionLogHtml()).replace(/<[^>]+>/g,' ')];})()`);
if(pl){ok(pl[0]===2,'snapshot added for today');ok(pl[1]===2,'one snapshot per day');ok(pl[2]===2,'newer snapshot wins on merge');ok(/model updated/.test(pl[3])&&!/NaN|undefined/.test(pl[3]),'log shows model change, no NaN');}

console.log('7. Farm history merge');
const m=run('merge',`(()=>{const R=(id,b,s)=>({id,batch:b,placed:100,picked:90,liveWeightKg:250,feedKg:400,avgAge:44,savedAt:s});
  predState.farmHistory=[R('a','A',1)];predState.farmHistoryDeleted=[];mergeCloudFarmHistory({farmHistory:[R('b','B',1)]});const u=predState.farmHistory.length;
  predState.farmHistory=[R('a','A-old',1)];mergeCloudFarmHistory({farmHistory:[R('a','A-new',5)]});const nw=predState.farmHistory[0].batch;
  predState.farmHistory=[R('a','A',1),R('b','B',1)];predState.farmHistoryDeleted=[];deleteFarmHistoryRec('b');mergeCloudFarmHistory({farmHistory:[R('a','A',1),R('b','B',1)]});
  return [u,nw,predState.farmHistory.length];})()`);
if(m){ok(m[0]===2,'union of two devices');ok(m[1]==='A-new','newer edit wins');ok(m[2]===1,'deletions stick');}

console.log('8. Early-morning delivery vs morning reading');
const dt=run('delivery timing',`(()=>{
  const g=1,today=dateOnly(new Date()),ti=iso(today);
  farmLoads=farmLoads.filter(l=>iso(l.date)!==ti);
  saveLoad({date:today,feedType:'finisher',plannedKg:60000,splitKg:{1:30000,2:30000,3:0,4:0},note:'',actualKg:60000});
  const r={date:ti,silo1Rings:4,silo2Rings:4,silo3Rings:4,time:'am'};
  siloData[g].readings=siloData[g].readings.filter(x=>x.date!==ti).concat([r]);
  const base=readingTotalKg(r)*siloConfidence(),eat=groupDailyFeedOn(shedsForGroup(g),today);
  predState.deliveryTiming='early';const early=readingEndOfDayKg(g,r,deliveriesKgOn);const eatenEarly=feedEatenMeasured().pairs.find(p=>p.g===g).delivered;
  predState.deliveryTiming='day';const day=readingEndOfDayKg(g,r,deliveriesKgOn);const eatenDay=feedEatenMeasured().pairs.find(p=>p.g===g).delivered;
  r.deliveryIn=true;const override=readingEndOfDayKg(g,r,deliveriesKgOn);
  r.time='pm';delete r.deliveryIn;const evening=readingEndOfDayKg(g,r,deliveriesKgOn);
  predState.deliveryTiming='early';
  return {early:early-(base-eat),day:day-(base+deliveriesKgOn(g,today)-eat),override:override-(base-eat),evening:evening-base,diffDelivered:eatenEarly-eatenDay,load:deliveriesKgOn(g,today)};
})()`);
if(dt){ok(near(dt.early,0,1),'early delivery: morning reading is not topped up again');ok(near(dt.day,0,1),'daytime delivery: morning reading adds that day\'s load');
  ok(near(dt.override,0,1),'per-reading "already in" answer wins over the setting');ok(near(dt.evening,0,1),'evening reading unaffected');
  ok(near(dt.diffDelivered,dt.load,1),'eaten-so-far counts the early load as delivered before the reading');}

console.log('9. Pickup birds edited inline');
const pb=run('pickup birds',`(()=>{
  const sh=farmData.sheds[0];const p=sh.pickups[0];const d=iso(p.date);
  p.weightEstimated=false;p.totalWeightKg=8000*1.85;p.birds=8000;
  setPickupBirds(1,d,'8100');const keptTotal=p.totalWeightKg,b1=p.birds;
  p.weightEstimated=true;setPickupBirds(1,d,'8200');const avgKept=p.totalWeightKg/p.birds;gompertzCache=new Map();const estAvg=estimatedPickupWeight(sh,dateOnly(p.date));
  setPickupBirds(1,d,'0');const unchanged=p.birds;
  pickupsModalOpen=true;let html='';try{refreshPickupsModal();}catch(e){html='ERR '+e.message;}pickupsModalOpen=false;
  return {keptTotal,b1,avgKept,estAvg,unchanged,html};
})()`);
if(pb){ok(pb.b1===8100,'birds saved');ok(near(pb.keptTotal,14800,0.01),'kill-sheet total kept when birds change');
  ok(near(pb.avgKept,pb.estAvg,1e-3),'estimated weight keeps the curve average');ok(pb.unchanged===8200,'0 birds rejected');ok(!pb.html,'Pickups tool renders');}

console.log('10. Clean-out shortcut + pair arrows');
const co=run('cleanout set all',`(()=>{
  const sh=farmData.sheds;const before=sh.map(s=>s.cleanoutDate&&iso(s.cleanoutDate));
  const fin=sh.find(s=>finalPickupOf(s));
  const n=setAllCleanoutDates('2026-12-01');
  const after=sh.filter(s=>s.placementDate&&!finalPickupOf(s)).every(s=>iso(s.cleanoutDate)==='2026-12-01');
  const html=renderCleanoutDashCard();
  const prev=pairStepHtml(1,'shed'),next=pairStepHtml(4,'pred',1);
  return {n,after,finKept:!fin||iso(fin.cleanoutDate)!=='2026-12-01'||iso(finalPickupOf(fin).date)==='2026-12-01',
    hasInputs:/data-field="cleanoutDate"/.test(html),hasSetAll:/dcoSetAllBtn/.test(html)||n<2,
    prevWrap:/data-tab="g4"/.test(prev),nextWrap:/data-predgroup="1"/.test(next)};
})()`);
if(co){ok(co.n>0&&co.after,'set all applies to open sheds');ok(co.finKept,'final pickup keeps its date');
  ok(co.hasInputs,'clean-out dates editable on dashboard');ok(co.hasSetAll,'set-all row shown');ok(co.prevWrap&&co.nextWrap,'pair arrows wrap 1↔4');}

console.log('11. Estimated pickup weight follows a later real weighing');
const ew=run('est follows real',`(()=>{
  const sh=farmData.sheds[1];const pl=dateOnly(sh.placementDate);
  sh.pickups=[{date:addDays(pl,31),birds:8000,isFinal:false,totalWeightKg:null,source:'manual'},
              {date:addDays(pl,35),birds:6000,isFinal:false,totalWeightKg:6000*2.4,source:'manual',weightEstimated:true}];
  gompertzCache=new Map();refreshEstimatedPickupWeights(sh);const before=sh.pickups[1].totalWeightKg/6000;
  sh.pickups[0].totalWeightKg=8000*2.05;sh.pickups[0].totalWeightKgManual=true;
  gompertzCache=new Map();const moved=refreshEstimatedPickupWeights(sh);const after=sh.pickups[1].totalWeightKg/6000;
  sh.pickups[0].totalWeightKg=8000*2.25;gompertzCache=new Map();refreshEstimatedPickupWeights(sh);const after2=sh.pickups[1].totalWeightKg/6000;
  gompertzCache=new Map();const again=refreshEstimatedPickupWeights(sh);
  return {before,after,after2,moved,again,birds:sh.pickups[1].birds,est:sh.pickups[1].weightEstimated};
})()`);
if(ew){ok(ew.moved&&Math.abs(ew.after-ew.before)>0.01,'est pickup re-projects when day-31 weight arrives');
  ok(ew.after2>ew.after,'heavier day-31 weight → heavier day-35 estimate');ok(ew.after>2.05,'day-35 estimate grows on from day-31 weight');
  ok(!ew.again,'refresh is stable (no change on repeat)');ok(ew.birds===6000&&ew.est,'birds and est flag kept');}

console.log('12. Silo levels: one open at a time, silo per load, starter silo');
const sl=run('silo plan',`(()=>{
  const T=dateOnly(new Date());const g=1;
  siloData[g]={readings:[{date:iso(addDays(T,-1)),silo1Rings:3,silo2Rings:2,silo3Rings:0,time:'pm',open:[3]}],deliveries:[]};
  const keepLoads=farmLoads;
  farmLoads=[normalizeLoad({id:'L1',date:iso(addDays(T,2)),feedType:'finisher',plannedKg:24000,splitKg:{1:24000,2:0,3:0,4:0},siloFor:{1:2}})];
  const persisted=JSON.parse(JSON.stringify(serializeFarmLoads()))[0].siloFor;
  const ser=JSON.parse(JSON.stringify(serializeSiloDataForCloud()))[1].readings[0].open;
  const keepConf=predState.siloConfidencePct;predState.siloConfidencePct=100;   // picture = rings as read; forecast equal at 100%
  const plan=siloLevelPlan(g,{until:addDays(T,8)});
  const d0=plan.days[0];const s3First=d0.kg[2]<plan.start.kg[2];const s1Same=d0.kg[0]===plan.start.kg[0]||d0.kg[2]>0;
  const delRow=plan.days.find(r=>r.del.length);
  const totalsMatch=plan.days.every(r=>Math.abs(r.total-Math.max(0,balanceOnEndOfDay(g,r.date,true)))<2||r.short>0);
  predState.siloConfidencePct=keepConf;
  predState.starterSilo={1:3,2:null,3:null,4:null};
  const st=starterSiloStatus(g);
  predState.starterSilo={1:null,2:null,3:null,4:null};
  const pick=starterSiloStatus(g);
  farmLoads=keepLoads;
  return {persisted,ser,s3First,s1Same,delSilo:delRow&&delRow.del[0].silo,totalsMatch,stState:st&&st.state,pickState:pick&&pick.state,openStart:plan.start.open};
})()`);
if(sl){ok(sl.persisted&&sl.persisted[1]===2,'load keeps its silo');ok(Array.isArray(sl.ser)&&sl.ser[0]===3,'reading keeps open silo');
  ok(sl.openStart.join()==='3','marked open silo used');ok(sl.s3First,'open silo empties first');ok(sl.delSilo===2,'load goes into its silo');
  ok(sl.totalsMatch,'silo totals match the feed forecast');ok(['ready','ontrack','action','watch'].includes(sl.stState),'starter status computed ('+sl.stState+')');ok(sl.pickState==='pick','no starter silo → pick');}

console.log('13. Silo picture never changes the feed calculations');
const nc=run('silo fields are display-only',`(()=>{
  const T=dateOnly(new Date());
  const fp=()=>JSON.stringify([1,2,3,4].map(g=>{const f=computeSiloForecast(g,{start:0,end:21},{realOnly:true});return [f.rows.map(r=>Math.round(r.balance)),f.depletedDate&&iso(f.depletedDate),Math.round(readingEndOfDayKg(g,latestReading(g))||0),Math.round(deliveriesSinceLatestReading(g))];}).concat([Math.round(feedEatenMeasured().eaten)]));
  [1,2,3,4].forEach(g=>{siloData[g]={readings:[{date:iso(addDays(T,-1)),silo1Rings:3,silo2Rings:2,silo3Rings:0,time:'pm'}],deliveries:[]};});
  const keep=farmLoads;farmLoads=[normalizeLoad({id:'n1',date:iso(addDays(T,2)),feedType:'finisher',plannedKg:60000,splitKg:{1:30000,2:30000,3:0,4:0}})];
  const before=fp();
  [1,2,3,4].forEach(g=>{siloData[g].readings[0].open=[1,3];});farmLoads[0].siloFor={1:3,2:1};predState.starterSilo={1:3,2:1,3:2,4:null};
  const after=fp();
  predState.starterSilo={1:null,2:null,3:null,4:null};farmLoads=keep;
  return before===after;
})()`);
ok(nc===true,'open silos, silo per load and starter silo leave every feed number unchanged');

console.log('14. Split load into two silos (Silo 3+1)');
const sp2=run('silo 3+1',`(()=>{
  const T=dateOnly(new Date());const g=1;
  siloData[g]={readings:[{date:iso(addDays(T,-1)),silo1Rings:0,silo2Rings:3,silo3Rings:3,time:'pm',open:[2]}],deliveries:[]};
  const keep=farmLoads;
  farmLoads=[normalizeLoad({id:'S1',date:iso(addDays(T,1)),feedType:'finisher',plannedKg:30000,splitKg:{1:30000,2:0,3:0,4:0},siloFor:{1:[3,1]}})];
  const ser=JSON.parse(JSON.stringify(serializeFarmLoads()))[0].siloFor[1];
  const plan=siloLevelPlan(g,{until:addDays(T,2)});const row=plan.days.find(r=>r.del.length);
  const lbl=siloListLabel(loadSilosFor(farmLoads[0],g));
  farmLoads=keep;
  return {ser,dels:row.del.map(d=>[d.silo,Math.round(d.kg)]),over:row.overflow.length,lbl};
})()`);
if(sp2){ok(Array.isArray(sp2.ser)&&sp2.ser.join()==='3,1','split saved as [3,1]');ok(sp2.lbl==='Silo 3+1','label Silo 3+1');
  ok(sp2.dels[0][0]===3&&sp2.dels[1]&&sp2.dels[1][0]===1,'fills Silo 3 first, rest into Silo 1');ok(sp2.dels.reduce((a,d)=>a+d[1],0)===30000,'whole load placed');ok(sp2.over===0,'no overflow');}

console.log('15. Farm profile silo numbers');
const fpn=run('silo numbers',`(()=>{
  const a=[1,2,3,4].map(g=>[1,2,3].map(n=>siloNumber(g,n)).join(''));
  predState.siloStart=1;const b=[1,2,3,4].map(g=>[1,2,3].map(n=>siloNumber(g,n)).join(','));const lbl=siloListLabel([3,1],2);
  predState.siloStart=13;const c=siloNumber(4,3);
  predState.siloStart=null;
  return {a:a.join('|'),b:b.join('|'),lbl,c};
})()`);
if(fpn){ok(fpn.a==='123|123|123|123','not set: every pair 1–3');ok(fpn.b==='1,2,3|4,5,6|7,8,9|10,11,12','1–12: pairs get 1-3, 4-6, 7-9, 10-12');
  ok(fpn.lbl==='Silo 6+4','split label uses farm numbers');ok(fpn.c===24,'13–24 range');}

console.log('16. Estimated-weight reminder and kill-sheet weight in the daily table');
const kr=run('kill sheet display',`(()=>{
  const T=dateOnly(new Date());const sh=farmData.sheds[2];const keep=sh.pickups;const pl=dateOnly(sh.placementDate);
  sh.pickups=[{date:T,birds:4000,isFinal:false,totalWeightKg:4000*1.811,source:'manual'},{date:addDays(T,-1),birds:5000,isFinal:false,totalWeightKg:5000*2.0,source:'manual',weightEstimated:true},{date:addDays(T,2),birds:6000,isFinal:false,totalWeightKg:6000*2.2,source:'manual',weightEstimated:true}];
  gompertzCache=new Map();
  const al=computeFarmAlerts().filter(a=>/estimated weight/.test(a.msg)&&/Shed 3</.test(a.msg)).length;
  const html=renderDailyPerformance(sh);
  sh.pickups=keep;gompertzCache=new Map();
  return {al,kill:/Kill sheet/.test(html)&&/1\.811/.test(html),est:/>Est</.test(html)};
})()`);
if(kr){ok(kr.al===1,'reminder only for the past pickup still on est. weight');ok(kr.kill,'pickup day shows the kill-sheet weight');ok(kr.est,'estimated pickup shows Est');}

console.log('17. Sync merge: a stale device never overwrites newer work');
const mg=run('sync merge',`(()=>{
  const base={farmData:{sheds:[{id:1,pickups:[{date:'2026-10-02',birds:4230}]}]},siloData:{1:{readings:[{date:'2026-10-06',silo1Rings:3}]}},farmLoads:[{id:'L1',plannedKg:60000},{id:'L3',plannedKg:30000}],predictions:{starterSilo:{1:null,2:null},siloConfidencePct:90,projectionLog:[{d:'2026-10-06',feed:1}]}};
  const theirs=JSON.parse(JSON.stringify(base));   // laptop last night
  theirs.siloData[1].readings[0].open=[2];theirs.predictions.starterSilo={1:2,2:3};theirs.farmLoads[0].siloFor={1:[3,1]};theirs.farmLoads.push({id:'L2',plannedKg:60000});theirs.predictions.siloConfidencePct=95;
  const ours=JSON.parse(JSON.stringify(base));     // office tab left open since yesterday
  ours.predictions.projectionLog.push({d:'2026-10-07',feed:2});ours.farmData.sheds[0].pickups.push({date:'2026-10-08',birds:7000,weightEstimated:true});ours.farmLoads=ours.farmLoads.filter(l=>l.id!=='L3');ours.predictions.siloConfidencePct=85;
  const m=syncMerge(base,ours,theirs);
  const noBase=syncMerge(undefined,ours,theirs);
  return {open:m.siloData[1].readings[0].open,starter:m.predictions.starterSilo,siloFor:m.farmLoads.find(l=>l.id==='L1').siloFor,l2:!!m.farmLoads.find(l=>l.id==='L2'),l3:!!m.farmLoads.find(l=>l.id==='L3'),
    log:m.predictions.projectionLog.map(x=>x.d).join(','),pick:m.farmData.sheds[0].pickups.length,conf:m.predictions.siloConfidencePct,
    nbOpen:noBase.siloData[1].readings[0].open,nbL2:!!noBase.farmLoads.find(l=>l.id==='L2'),same:syncEq(syncMerge(base,base,theirs),theirs)};
})()`);
if(mg){ok(mg.open&&mg.open[0]===2,'laptop open-silo marks kept');ok(mg.starter[1]===2&&mg.starter[2]===3,'laptop starter silos kept');ok(mg.siloFor&&mg.siloFor[1]&&mg.siloFor[1][0]===3,'laptop silo-per-load kept');
  ok(mg.l2,'laptop new load kept');ok(!mg.l3,'office deletion kept');ok(mg.log==='2026-10-06,2026-10-07','office projection log kept');ok(mg.pick===2,'office new pickup kept');
  ok(mg.conf===85,'same field on both: this device wins');ok(mg.nbOpen&&mg.nbL2,'no saved base: union, nothing lost');ok(mg.same,'no local edits: cloud taken as is');}

console.log('20. Silo reading times: every session logged, latest drives the day, delete reverts');
const rt=run('reading log',`(()=>{
  const g=4;const T=iso(new Date());siloData[g]={readings:[],deliveries:[]};
  setSiloRingsForToday(g,1,3);setSiloRingsForToday(g,2,2);            // one session (same sitting)
  const s=siloData[g];const n1=s.log.length;
  s.log[0].at=new Date(Date.now()-3*3600e3).toISOString();           // pretend it was 3 h ago
  setSiloRingsForToday(g,1,1);                                        // new session
  const n2=s.log.length;const day=s.readings.find(r=>r.date===T);const after2=day.silo1Rings;const hasAt=!!day.at;
  const ser=JSON.parse(JSON.stringify(serializeSiloDataForCloud()))[g];
  window.confirm=()=>true;const keepUndo=showUndoToast;showUndoToast=function(){};
  deleteReadingSession(g,s.log[1].id);
  const back=s.readings.find(r=>r.date===T).silo1Rings;
  deleteReadingSession(g,s.log[0].id);
  const gone=!s.readings.find(r=>r.date===T);
  showUndoToast=keepUndo;siloData[g]={readings:[],deliveries:[]};
  return {n1,n2,after2,hasAt,serLog:ser.log.length,serAt:!!ser.readings[0].at,back,gone};
})()`);
if(rt){ok(rt.n1===1,'taps in one sitting = one session');ok(rt.n2===2,'later reading = new session');ok(rt.after2===1&&rt.hasAt,"day's reading = latest session, with its time");
  ok(rt.serLog===2&&rt.serAt,'sessions and time are synced');ok(rt.back===3,'deleting the latest goes back to the earlier one');ok(rt.gone,'deleting the last one removes the day');}

console.log('21. Batch window: birds after this week; Farm profile Save/Cancel; Pickups calendar');
const b21=run('batch week + profile + calendar',`(()=>{
  const t=new Date();const k=d=>{const x=new Date(t);x.setDate(x.getDate()+d);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');};
  const sheds=[{initialPopulation:50000,mortality:1000,pickups:[{date:k(-2),birds:5000},{date:k(3),birds:7000,weightEstimated:true},{date:k(9),birds:9000}],predictedPickups:[{date:k(4),birds:8000}]}];
  const st=biBirdStats(sheds,k(0));
  // profile: draft does nothing until saved
  const keepStart=predState.siloStart;fpDraft={name:farmDisplayName||'',start:siloStart()};fpSetStart(13);const before=siloStart();
  fpDraft.start=13;saveFarmProfile();const after=siloStart();predState.siloStart=keepStart;
  // calendar
  pkView='cal';pkMonth=null;const cal=pkCalendarHtml();pkView='list';
  return {now:st.now,week:st.weekPick,after:st.afterWeek,days:st.weekDays.length,before,after2:after,cal:/pkc-grid/.test(cal)&&/data-pkc-month/.test(cal)};
})()`);
const ps=run('per-shed',`(()=>{const t=new Date();const k=d=>{const x=new Date(t);x.setDate(x.getDate()+d);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');};const st=biBirdStats([{id:3,initialPopulation:50000,mortality:1000,pickups:[{date:k(-2),birds:5000},{date:k(3),birds:7000}]},{id:4,initialPopulation:40000,mortality:0,pickups:[]}],k(0));const html=batchInfoHtml({number:'1',start:k(-30),end:k(20),today:k(0),sheds:[{name:'3',placement:k(-30),cleanout:k(20)}],birds:st,events:[]});return {s3:st.perShed['3'],s4:st.perShed['4'],cell:/44,000/.test(html)&&/37,000/.test(html)&&/After this week/.test(html)};})()`);
if(ps){ok(ps.s3.now===44000&&ps.s3.week===7000&&ps.s3.after===37000,'per shed: now and after this week');ok(ps.s4.after===40000&&ps.s4.week===0,'shed with no pickup this week');ok(ps.cell,'shed table shows birds now and after');}
if(b21){ok(b21.now===44000&&b21.week===7000&&b21.after===37000&&b21.days===1,'after this week = now − kill-sheet pickups in the next 7 days (no predicted)');
  ok(b21.before===null||b21.before!==13,'farm profile change waits for Save');ok(b21.after2===13,'Save applies it');ok(b21.cal,'pickups calendar renders');}

console.log('22. Batch feed: carry-over counted once; a finished batch uses its delivery dockets');
const f22=run('docket + carry-over',`(()=>{
  const keep={o:predState.farmFeedOverride,c:predState.carryoverFarmKg,l:predState.farmLeftoverKg,loads:farmLoads};
  const a=docketIncludesCarry(1933080,1860080,73000),b=docketIncludesCarry(1860080,1860080,73000),c=docketIncludesCarry(1933080,1860080,0);
  farmLoads=[{id:'x',date:'2026-01-01',plannedKg:60000,actualKg:60000,splitKg:{1:15000,2:15000,3:15000,4:15000}}];predState.carryoverFarmKg=5000;predState.farmLeftoverKg=2000;
  predState.farmFeedOverride=65000;const t1=computeFarmTotals();   // typed total holds the carry-over
  predState.farmFeedOverride=60000;const t2=computeFarmTotals();   // dockets only
  predState.farmFeedOverride=keep.o;predState.carryoverFarmKg=keep.c;predState.farmLeftoverKg=keep.l;farmLoads=keep.loads;
  return {a,b,c,f1:t1.hasData?t1.totalFeed:null,f2:t2.hasData?t2.totalFeed:null,in1:t1.carryInDocket};
})()`);
if(f22){ok(f22.a&&!f22.b&&!f22.c,'docket total = deliveries + carry-over is recognised (and only then)');
  if(f22.f1!=null){ok(f22.f1===63000&&f22.in1,'typed total holding the carry-over: counted once (65 − 2 = 63 t)');ok(f22.f2===63000,'dockets-only total: carry-over added (60 + 5 − 2 = 63 t)');}}

console.log('23. Projected result follows the Ross intake standard; silo readings are a check only');
const f23=run('silo check only',`(()=>{
  const keepSilo=JSON.stringify(siloData),keepLoads=farmLoads;
  const t1=computeFarmTotals();
  // a load and a near-empty silo reading would say the birds ate far more than standard
  farmLoads=[{id:'s23',date:iso(addDays(dateOnly(new Date()),-3)),plannedKg:60000,actualKg:60000,splitKg:{1:60000,2:0,3:0,4:0}}];
  [1,2,3,4].forEach(g=>{siloData[g].readings=[{date:iso(dateOnly(new Date())),silo1Rings:0,silo2Rings:0,silo3Rings:0,time:'pm'}];});
  const t2=computeFarmTotals();
  siloData=JSON.parse(keepSilo);farmLoads=keepLoads;
  return {same:t1.hasData&&t2.hasData&&Math.abs(t1.totalFeed-t2.totalFeed)<1,has:!!t2.feedMeasured,basis:/Ross 308 intake/.test(learnedBasisHtml(t2))};
})()`);
if(f23){ok(f23.same,'silo readings do not change the projected feed');ok(f23.basis,'card says the feed follows the Ross 308 intake');}

// End-to-end: stale office tab pushes into a cloud the laptop has changed (fake cloud)
const pending=[];
pending.push((async()=>{
  const r=await vm.runInContext(`(async()=>{
    const realFetch=fetch;syncFarmName='testfarm';syncConnectedAt=1;
    const base=localSyncPayload();saveSyncBase(base);syncSha='sha-old';
    const theirs=JSON.parse(JSON.stringify(base));theirs.predictions.starterSilo={1:2,2:null,3:null,4:null};theirs.farmLoads=(theirs.farmLoads||[]).concat([{id:'LAPTOP',date:'2026-10-20',feedType:'finisher',plannedKg:60000,splitKg:{1:60000,2:0,3:0,4:0}}]);
    predState.siloConfidencePct=85;   // office's own edit
    let putBody=null;const calls=[];
    fetch=async(url,opt)=>{calls.push((opt&&opt.method)||'GET');
      if(opt&&opt.method==='PUT'){const b=JSON.parse(opt.body);if(b.sha==='sha-old')return {status:409,ok:false,json:async()=>({})};putBody=b;return {status:200,ok:true,json:async()=>({sha:'sha-3'})};}
      return {status:200,ok:true,json:async()=>({sha:'sha-new',data:theirs})};};
    const okPush=await pushToCloud();fetch=realFetch;
    const d=putBody&&putBody.data;
    const out={okPush,calls:calls.join(','),starter:d&&d.predictions.starterSilo[1],laptopLoad:!!(d&&d.farmLoads.find(l=>l.id==='LAPTOP')),conf:d&&d.predictions.siloConfidencePct,localSeesLaptop:!!farmLoads.find(l=>l.id==='LAPTOP'),sha:syncSha};
    farmLoads=farmLoads.filter(l=>l.id!=='LAPTOP');predState.starterSilo={1:null,2:null,3:null,4:null};syncFarmName=null;syncConnectedAt=null;
    return out;
  })()`,ctx);
  console.log('18. Stale tab pushes after another device saved (fake cloud)');
  ok(r.okPush&&r.calls==='PUT,GET,PUT','conflict detected, cloud re-read, merged save');
  ok(r.starter===2&&r.laptopLoad,"other device's starter silo and new load survive");ok(r.conf===85,"this device's own edit saved too");
  ok(r.localSeesLaptop,"this device now shows the other device's changes");ok(r.sha==='sha-3','new cloud version recorded');
})().catch(e=>{failed++;console.log('  ✗ sync end-to-end:',e.message);}));

pending.push(pending[0].then(async()=>{
  const r=await vm.runInContext(`(async()=>{
    const realFetch=fetch;syncFarmName='testfarm';syncConnectedAt=1;
    const base=localSyncPayload();saveSyncBase(base);
    const theirs=JSON.parse(JSON.stringify(base));theirs.predictions.starterSilo={1:3,2:null,3:null,4:null};
    predState.safetyDays=2;                      // edited here, not saved yet
    let pushed=null;
    fetch=async(url,opt)=>{if(opt&&opt.method==='PUT'){pushed=JSON.parse(opt.body).data;return {status:200,ok:true,json:async()=>({sha:'s2'})};}return {status:200,ok:true,json:async()=>({sha:'s1',data:theirs})};};
    await pullFromCloud(true);for(let i=0;i<50;i++)await Promise.resolve();
    const a={starter:predState.starterSilo[1],safety:predState.safetyDays,pushedBoth:!!pushed&&pushed.predictions.starterSilo[1]===3&&pushed.predictions.safetyDays===2};
    // no local edits: plain pull, nothing pushed
    pushed=null;const theirs2=JSON.parse(JSON.stringify(localSyncPayload()));theirs2.predictions.starterSilo={1:1,2:null,3:null,4:null};
    fetch=async(url,opt)=>{if(opt&&opt.method==='PUT'){pushed=JSON.parse(opt.body).data;return {status:200,ok:true,json:async()=>({sha:'s4'})};}return {status:200,ok:true,json:async()=>({sha:'s3',data:theirs2})};};
    await pullFromCloud(true);
    a.plain=predState.starterSilo[1]===1&&!pushed;
    fetch=realFetch;predState.starterSilo={1:null,2:null,3:null,4:null};predState.safetyDays=1;syncFarmName=null;syncConnectedAt=null;
    return a;
  })()`,ctx);
  console.log('19. Pull keeps unsaved local edits and takes the rest from the cloud');
  ok(r.starter===3,'cloud change applied');ok(r.safety===2,'unsaved local edit kept');ok(r.pushedBoth,'merged result saved back to the cloud');ok(r.plain,'no local edits: cloud taken, nothing pushed');
}).catch(e=>{failed++;console.log('  ✗ sync pull:',e.message);}));

Promise.all(pending).then(()=>{
console.log(`\n${failed?'FAILED':'PASSED'}: ${passed} passed, ${failed} failed`);
process.exit(failed?1:0);
});
