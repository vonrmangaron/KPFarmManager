function totalPicked(shed){return (shed.pickups||[]).reduce((s,p)=>s+(Number(p.birds)||0),0);}
function mortalityRate(shed){if(!shed.initialPopulation)return 0;return (Number(shed.mortality||0)/shed.initialPopulation)*100;}
function finalPickupOf(shed){return (shed.pickups||[]).find(p=>p.isFinal);}
function shedsForGroup(g){if(!farmData)return [];const a=farmData.sheds[(g-1)*2];const b=farmData.sheds[(g-1)*2+1];return [a,b].filter(Boolean);}
function feedPerBirdKg(shed,ageDays){if(shed.customFeedKg!=null&&shed.customFeedKg>0)return shed.customFeedKg;if(ageDays<=0)return 0;const age=Math.min(60,Math.max(1,Math.floor(ageDays)));return (ROSS_308_FEED_INTAKE[age]||234)/1000;}
function shedFeedOn(shed,D){const age=ageInDays(shed,D);const live=liveAtStartOfDay(shed,D);if(age<=0||live<=0)return 0;return live*feedPerBirdKg(shed,age);}
function groupDailyFeedOn(sheds,D){return sheds.reduce((sum,s)=>sum+shedFeedOn(s,D),0);}
function groupFeedToday(sheds,today=new Date()){return groupDailyFeedOn(sheds,today);}
function fmtFeed(kg){if(!Number.isFinite(kg)||kg===0)return '0 kg';const abs=Math.abs(kg);if(abs>=1000)return (kg/1000).toFixed(2)+' t';return Math.round(kg).toLocaleString()+' kg';}
function fmtKgAlways(kg){if(!Number.isFinite(kg)||kg===0)return '0 kg';return Math.round(kg).toLocaleString()+' kg';}
function fmtTonnesAlways(kg){if(!Number.isFinite(kg)||kg===0)return '0.00 t';const t=kg/1000;return t.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+' t';}
function fmtTonnes(t){if(!Number.isFinite(t)||t===0)return '0.00 t';return t.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+' t';}

function normalizeLoad(load){
  if(!load||typeof load!=='object')return null;
  const dateObj=load.date?parseExcelDate(load.date):null;if(!dateObj)return null;
  const plannedKg=Number(load.plannedKg)||0;if(plannedKg<=0)return null;
  const sr=load.splitKg||{};
  const splitKg={1:Math.max(0,Number(sr[1])||0),2:Math.max(0,Number(sr[2])||0),3:Math.max(0,Number(sr[3])||0),4:Math.max(0,Number(sr[4])||0)};
  const rawActual=load.actualKg;
  const actualKg=(rawActual!=null&&Number.isFinite(Number(rawActual))&&Number(rawActual)>0)?Number(rawActual):null;
  return {id:String(load.id||uid('load')),date:dateObj,feedType:FEED_TYPES.some(f=>f.id===load.feedType)?load.feedType:'',plannedKg,splitKg,actualKg,note:String(load.note||'').slice(0,60),migrated:!!load.migrated,createdAt:String(load.createdAt||new Date().toISOString())};
}
function serializeFarmLoads(){
  return farmLoads.map(l=>({id:l.id,date:l.date?iso(l.date):null,feedType:l.feedType||'',plannedKg:Number(l.plannedKg)||0,splitKg:{...l.splitKg},actualKg:(l.actualKg!=null&&Number.isFinite(Number(l.actualKg)))?Number(l.actualKg):null,note:l.note||'',migrated:!!l.migrated,createdAt:l.createdAt||new Date().toISOString()}));
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
  return {total,plannedKg,withActual,actualKg,needsActual,upcoming,past};
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
  const payload={id,date:dateObj,feedType:FEED_TYPES.some(f=>f.id===data.feedType)?data.feedType:'',plannedKg,splitKg,actualKg:(data.actualKg!=null&&Number.isFinite(Number(data.actualKg))&&Number(data.actualKg)>0)?Number(data.actualKg):null,note:String(data.note||'').slice(0,60),migrated:!!data.migrated,createdAt:data.createdAt||new Date().toISOString()};
  const idx=farmLoads.findIndex(l=>l.id===id);
  if(idx>=0)farmLoads[idx]=payload;else farmLoads.push(payload);
  saveFarmLoads();schedulePush();
  return payload;
}
function deleteLoad(id){const idx=farmLoads.findIndex(l=>l.id===id);if(idx<0)return false;farmLoads.splice(idx,1);saveFarmLoads();schedulePush();return true;}
function updateLoadActual(id,rawValue){const load=farmLoads.find(l=>l.id===id);if(!load)return false;const s=String(rawValue??'').trim();if(s===''){load.actualKg=null;}else{const n=Number(s);if(!Number.isFinite(n)||n<=0)return false;load.actualKg=n;}saveFarmLoads();schedulePush();return true;}
function createSingleGroupLoadFromInline(group,dateIso,amountT){const amt=Number(amountT);if(!Number.isFinite(amt)||amt<=0)return {__error:'bad-amount'};const plannedKg=Math.round(amt*1000);return saveLoad({date:dateIso,feedType:'',plannedKg,splitKg:{1:0,2:0,3:0,4:0,[group]:plannedKg},actualKg:plannedKg,migrated:false});}

