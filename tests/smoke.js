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
 'fmtFeed','feedIn','feedOut','pairSwitchHtml','historyKpis','farmFeedToOrder','recordProjectionSnapshot','mergeProjectionLog','projectionLogHtml','finalUpliftFactor','feedPlan','packTrucks','feedPlanHtml','nextFeedTypeDue','refreshLoadsViews','leftoverNoteText','projLeftoverText']
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

console.log(`\n${failed?'FAILED':'PASSED'}: ${passed} passed, ${failed} failed`);
process.exit(failed?1:0);
