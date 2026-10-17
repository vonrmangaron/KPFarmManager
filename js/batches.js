// ── Overlapping batches (2026-10-14, mockup PMojjJL9h7Yf1t8jp1Qxaw) ─────────
// Every batch already has its own cloud file (<farm>-feed-<batch>). During a changeover
// two are running: the old one finishing shed by shed, the new one being placed.
// Here: find the other running batches, switch between them in one tap (the batch you
// leave is saved first), show the shed changeover, and keep Farm history honest — a batch
// is filed as finished only once its last shed is cleaned out.
const PW_RUN_KEY='pw_running_batches_v1',PW_TURNAROUND_DAYS=7;
let pwRunOthers=[],pwRunAt=0,pwRunBusy=false,pwRunFarm=null;
try{const c=JSON.parse(localStorage.getItem(PW_RUN_KEY)||'null');if(c&&Array.isArray(c.others)){pwRunOthers=c.others;pwRunAt=c.at||0;pwRunFarm=c.farm||null;}}catch(e){}

function pwDay(d){if(!d)return null;const x=d instanceof Date?d:new Date(d);return isNaN(x)?null:dateOnly(x);}
function pwFmt(d){return d?fmtShortNoYear(d):'—';}
// The picture of one batch from its sheds' dates (today decides finishing / starting)
function pwBatchSummary(key,sheds){
  const today=dateOnly(new Date());
  const rows=(sheds||[]).map(s=>({id:s.id,place:pwDay(s.placementDate),out:pwDay(s.cleanoutDate)})).filter(r=>r.id!=null);
  const planned=rows.filter(r=>r.place);
  const t=a=>a.map(d=>+d);
  const places=planned.map(r=>r.place),outs=rows.filter(r=>r.out).map(r=>r.out);
  const firstPlace=places.length?new Date(Math.min(...t(places))):null,lastPlace=places.length?new Date(Math.max(...t(places))):null;
  const firstOut=outs.length?new Date(Math.min(...t(outs))):null,lastOut=outs.length?new Date(Math.max(...t(outs))):null;
  const placedNow=planned.filter(r=>r.place<=today).length;
  const stillIn=planned.filter(r=>r.place<=today&&(!r.out||r.out>=today)).length;
  const finished=planned.length>0&&planned.every(r=>r.out&&r.out<today);
  const running=!finished&&planned.length>0;
  const day=firstPlace&&firstPlace<=today?daysBetween(firstPlace,today):null;
  return {key:String(key),rows,planned:planned.length,total:rows.length,placedNow,stillIn,firstPlace,lastPlace,firstOut,lastOut,finished,running,day};
}
function pwCurrentSummary(){return farmData?pwBatchSummary(currentBatchKey()||'',farmData.sheds||[]):null;}
// All running batches, oldest first: the current one plus the others found in the cloud
function pwRunningList(){
  const cur=pwCurrentSummary();const key=currentBatchKey();
  const others=(pwRunFarm===syncFarmName?pwRunOthers:[]).filter(o=>o.key!==key).map(o=>{const s=pwBatchSummary(o.key,o.sheds);if(!s.planned&&o.newest)s.running=true;return s;}).filter(s=>s.running);
  if(!others.length)return cur?[cur]:[];
  const list=others.concat(cur?[cur]:[]);
  list.sort((a,b)=>compareBatchKeys(b.key,a.key));   // compareBatchKeys sorts newest first; flip for oldest first
  return list;
}
function pwPhase(s,list){
  if(list.length<2)return '';
  return s.key===list[list.length-1].key?'starting':'finishing';
}
// Look in the cloud for the other batches that are still running (light: the newest three files)
async function refreshRunningBatches(force){
  if(!syncFarmName||pwRunBusy||!navigator.onLine)return;
  if(!force&&pwRunFarm===syncFarmName&&Date.now()-pwRunAt<10*60*1000){pwAfterRunning();return;}
  pwRunBusy=true;
  try{
    const res=await listFarmBatches(syncFarmName);if(!res.ok)return;
    const keys=res.files.filter(f=>!f.isLegacy).map(f=>f.batchKey);
    const newest=keys[0],cur=currentBatchKey();
    const others=[];
    for(const k of keys.filter(k=>k!==cur).slice(0,3)){
      try{
        const r=await fetch(buildBatchUrl(syncFarmName,k),{cache:'no-store'});if(!r.ok)continue;
        const j=await r.json();const p=j&&j.data;if(!p||!p.farmData||!Array.isArray(p.farmData.sheds))continue;
        others.push({key:k,newest:k===newest,sheds:p.farmData.sheds.map(s=>({id:s.id,placementDate:s.placementDate||null,cleanoutDate:s.cleanoutDate||null}))});
      }catch(e){}
    }
    pwRunOthers=others;pwRunAt=Date.now();pwRunFarm=syncFarmName;
    try{localStorage.setItem(PW_RUN_KEY,JSON.stringify({farm:pwRunFarm,at:pwRunAt,others}));}catch(e){}
  }finally{pwRunBusy=false;}
  pwAfterRunning();
}
function pwAfterRunning(){pwFixPrematureHistory();pwFinishIfDone();updateRunningUI();if(typeof renderPwBatchPanel==='function')renderPwBatchPanel();if(typeof render==='function')render();}

// ── Farm history stays honest ──
// predState.farmHistoryPending: {batch:'pending'|'done'} — batches to file once they are finished
function pwPending(){if(!predState.farmHistoryPending||typeof predState.farmHistoryPending!=='object')predState.farmHistoryPending={};return predState.farmHistoryPending;}
function pwMarkPending(batch){if(!batch)return;const p=pwPending();if(p[batch]!=='done')p[batch]='pending';}
// A batch that is still running but was filed as finished by "New batch" goes back to running
function pwFixPrematureHistory(){
  const running=pwRunningList().filter(s=>s.running).map(s=>s.key);if(!running.length)return;
  const bad=farmHistory().filter(r=>r.source==='auto'&&running.includes(String(r.batch)));
  if(!bad.length)return;
  bad.forEach(r=>{deleteFarmHistoryRec(r.id);pwMarkPending(String(r.batch));});
  savePredState();if(typeof scheduleHistoryPush==='function')scheduleHistoryPush();
  showToast(`Batch ${bad.map(r=>r.batch).join(', ')} is still running — taken out of Farm history; it is saved again when its last shed is cleaned out.`);
}
// The open batch is filed once, when its last shed has been cleaned out
function pwFinishIfDone(){
  const key=currentBatchKey();if(!key||pwPending()[key]!=='pending')return;
  const s=pwCurrentSummary();if(!s||!s.finished)return;
  if(typeof allPairsFinished==='function'&&!allPairsFinished())return;   // wait for every pair's leftover feed
  if(farmHistory().some(r=>String(r.batch)===key)){pwPending()[key]='done';savePredState();return;}
  let rec=null;try{rec=summarizeCurrentBatch();}catch(e){}
  if(!rec)return;
  rec.source='auto';predState.farmHistory=farmHistory().concat([rec]);pwPending()[key]='done';
  savePredState();if(typeof scheduleHistoryPush==='function')scheduleHistoryPush();
  showToast(`📚 Batch ${key} finished — saved to Farm history.`);
}

// ── Switching: the batch you leave is saved first, then the other one opens ──
async function switchToBatch(key){
  if(!key||key===currentBatchKey())return;
  if(!navigator.onLine){showToast('You are offline — switching batches needs a connection so nothing is lost.',true);return;}
  await openPastBatch(key,{quiet:true});
  refreshRunningBatches(true);
}

// ── UI ──
function pwRunningCardsHtml(){
  const list=pwRunningList();if(list.length<2)return '';
  const cur=currentBatchKey();
  const cards=list.map(s=>{
    const ph=pwPhase(s,list),viewing=s.key===cur;
    const pct=s.firstPlace&&s.lastOut?Math.max(2,Math.min(100,Math.round(daysBetween(s.firstPlace,dateOnly(new Date()))/Math.max(1,daysBetween(s.firstPlace,s.lastOut))*100))):(s.placedNow&&s.total?Math.round(s.placedNow/s.total*100):3);
    const line=ph==='finishing'?`${s.day!=null?'Day '+s.day+' · ':''}${s.stillIn} of ${s.total} sheds still in`
      :(s.placedNow?`${s.placedNow} of ${s.total} sheds placed${s.day!=null?' · day '+s.day:''}`:(s.firstPlace?`First placement ${pwFmt(s.firstPlace)} · 0 of ${s.total} placed`:'No placement dates yet'));
    const sub=ph==='finishing'?(s.firstOut?`Clean-outs ${pwFmt(s.firstOut)} → ${pwFmt(s.lastOut)}`:'No clean-out dates yet'):(s.firstPlace?`Placements ${pwFmt(s.firstPlace)} → ${pwFmt(s.lastPlace)}`:'Set placements in Batch details');
    return `<button type="button" class="pwr-card ${ph}${viewing?' viewing':''}" ${viewing?'data-batch-info title="Batch details"':`data-switch-batch="${escapeAttr(s.key)}" title="Switch to batch ${escapeAttr(s.key)} — this one is saved first"`}>
      <span class="pwr-top"><span class="pwr-ph">${ph==='finishing'?'Finishing':'Starting'}</span><span class="pwr-v">${viewing?'Viewing':'Tap to switch'}</span></span>
      <b>Batch ${escapeHtml(s.key)}</b><span class="pwr-line">${escapeHtml(line)}</span>
      <span class="pwr-bar"><i style="width:${pct}%"></i></span><span class="pwr-sub">${escapeHtml(sub)}</span></button>`;}).join('');
  return `<div class="pwr-run"><span class="pwr-k">Running batches · ${list.length}</span>${cards}</div>`;
}
// Header chip: which batch you are in, and the other one a tap away
function updateRunningUI(){
  const el=document.getElementById('batchSwitch');if(!el)return;
  const list=pwRunningList(),cur=currentBatchKey();
  document.body.classList.toggle('pw-two-batches',list.length>1);
  if(list.length<2){el.hidden=true;el.innerHTML='';return;}
  const me=list.find(s=>s.key===cur),other=list.find(s=>s.key!==cur);
  const ph=me?pwPhase(me,list):'';
  el.hidden=false;
  el.innerHTML=`<button type="button" class="bsw ${ph}" data-switch-batch="${escapeAttr(other.key)}" title="You are in batch ${escapeAttr(cur)}. Tap to switch to ${escapeAttr(other.key)} (this one is saved first).">
    <span class="bsw-dot"></span><b>Batch ${escapeHtml(cur)}</b><span class="bsw-to">⇄ ${escapeHtml(other.key)}</span></button>`;
}
// Home: each shed's changeover between the two running batches
function changeoverHtml(){
  // Timeline lanes (2026-10-17): each shed is a lane across the calendar — its run in the batch
  // that's finishing, the empty days, then the batch that's starting. Today is a red line.
  const list=pwRunningList();if(list.length<2)return '';
  const old=list[0],nu=list[list.length-1],today=dateOnly(new Date());
  const ids=[...new Set(old.rows.map(r=>r.id).concat(nu.rows.map(r=>r.id)))].sort((a,b)=>Number(a)-Number(b));
  const pairs=ids.map(id=>({id,o:old.rows.find(r=>r.id===id)||{},n:nu.rows.find(r=>r.id===id)||{}}));
  // the window: a few days back, to two weeks after the last date
  const dates=pairs.flatMap(x=>[x.o.out,x.n.place]).filter(Boolean);
  const start=addDays(today,-5);
  let end=addDays(dates.length?new Date(Math.max(...dates.map(d=>+d))):today,14);if(end<addDays(today,21))end=addDays(today,21);
  const span=Math.max(1,daysBetween(start,end));
  const pct=d=>Math.max(0,Math.min(100,daysBetween(start,dateOnly(d))/span*100));
  const fmt=d=>dateOnly(d).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
  let ticks='';for(let d=new Date(start);d<=end;d=addDays(d,1)){if(d.getDay()===1)ticks+=`<span class="co2-tk" style="left:${pct(d).toFixed(2)}%">${d.getDate()} ${d.toLocaleDateString('en-GB',{month:'short'})}</span>`;}
  const laneHtml=pairs.map(({id,o,n})=>{
    let seg='';
    if(o.place){const a=pct(o.place),b=o.out?pct(o.out):100,age=daysBetween(o.place,o.out&&o.out<today?o.out:today);
      seg+=`<div class="co2-seg old" style="left:${a.toFixed(2)}%;width:${Math.max(0,b-a).toFixed(2)}%" title="${escapeAttr(old.key)}: placed ${escapeAttr(fmt(o.place))}${o.out?', clean-out '+escapeAttr(fmt(o.out)):''}"><span>${escapeHtml(old.key)} · d${age}</span></div>`;}
    if(o.out&&n.place){const a=pct(o.out),b=pct(n.place);seg+=`<div class="co2-seg gap" style="left:${a.toFixed(2)}%;width:${Math.max(0,b-a).toFixed(2)}%" title="${daysBetween(o.out,n.place)} days empty"><span>${daysBetween(o.out,n.place)} d empty</span></div>`;}
    if(n.place){const a=pct(n.place);seg+=`<div class="co2-seg nu" style="left:${a.toFixed(2)}%;width:${(100-a).toFixed(2)}%" title="${escapeAttr(nu.key)}: placed ${escapeAttr(fmt(n.place))}"><span>${escapeHtml(nu.key)} from ${escapeHtml(fmt(n.place))}</span></div>`;}
    else if(o.out){const a=pct(o.out);seg+=`<div class="co2-seg ghost" style="left:${a.toFixed(2)}%;width:${Math.min(100-a,14/span*100).toFixed(2)}%"><span>${escapeHtml(nu.key)} not set</span></div>`;}
    if(o.out)seg+=`<i class="co2-pin" style="left:${pct(o.out).toFixed(2)}%"></i>`;
    let st='';
    if(n.place&&n.place<=today)st=`${escapeHtml(nu.key)} · day ${daysBetween(n.place,today)}`;
    else if(o.out&&o.out<today)st=n.place?`empty · in ${daysBetween(today,n.place)} d`:'empty';
    else if(o.out){const k=daysBetween(today,o.out);st=`${k===0?'out today':'out in '+k+' d'} · ${escapeHtml(fmt(o.out))}`;}
    return `<div class="co2-lane"><div class="co2-ln"><b>Shed ${escapeHtml(String(id))}</b><span>${st}</span></div><div class="co2-track">${seg}</div></div>`;});
  const firstIdx=(()=>{let i=pairs.findIndex(x=>x.o.out&&x.o.out>=today&&!(x.n.place&&x.n.place<=today));
    if(i<0)i=pairs.findIndex(x=>!x.n.place||x.n.place>today);return i<0?0:i;})();
  const allOpen=!!pwCoOpen;
  const lanes=allOpen?laneHtml.join(''):laneHtml[firstIdx];
  const outDone=pairs.filter(x=>x.o.out&&x.o.out<today).length,placed=pairs.filter(x=>x.n.place).length,total=pairs.length;
  const complete=outDone===total&&placed===total;
  const nextOut=pairs.map(x=>x.o.out).filter(d=>d&&d>=today).sort((a,b)=>a-b)[0];
  const onNew=currentBatchKey()===nu.key;
  const btn=onNew?`<button type="button" class="mgr-btn primary" data-pw-panel-go="setup">Set placements</button>`:`<button type="button" class="mgr-btn primary" data-switch-batch="${escapeAttr(nu.key)}" title="Opens ${escapeAttr(nu.key)} — set each shed's placement on its Setup tab">Set ${escapeHtml(nu.key)} placements</button>`;
  const tPct=pct(today);
  return `<section class="mgr-card co2-card">
    <div class="co2-head"><div><b>Batch Change Over <span class="co2-status${complete?' done':''}">${complete?'Complete':'In progress'}</span></b><span>${escapeHtml(old.key)} finishing → ${escapeHtml(nu.key)} starting</span></div>
      <div class="co2-legend"><span><i class="o"></i>${escapeHtml(old.key)}</span><span><i class="g"></i>Empty</span><span><i class="n"></i>${escapeHtml(nu.key)}</span></div></div>
    <div class="co2-sum"><div><b>${outDone} of ${total}</b><span>sheds cleaned out</span></div><div><b>${placed} of ${total}</b><span>placed for ${escapeHtml(nu.key)}</span></div><div><b>${nextOut?escapeHtml(fmt(nextOut)):'—'}</b><span>${nextOut?(daysBetween(today,nextOut)===0?'next clean-out · today':`next clean-out · in ${daysBetween(today,nextOut)} days`):'every shed is out'}</span></div><div class="co2-act">${btn}</div></div>
    <div class="co2-gantt"><div class="co2-inner">
      <div class="co2-axis"><div class="co2-axl"></div><div class="co2-axr">${ticks}<span class="co2-today" style="left:${tPct.toFixed(2)}%">Today</span></div></div>
      <div class="co2-lanes">${lanes}<div class="co2-tl"><i style="left:${tPct.toFixed(2)}%"></i></div></div>
    </div></div>
    ${total>1?`<button type="button" class="co2-more" data-co-more aria-expanded="${allOpen}">${allOpen?'Show less':`More · all ${total} sheds`}</button>`:''}
  </section>`;
}
document.addEventListener('click',e=>{
  const sw=e.target.closest('[data-switch-batch]');if(sw){e.preventDefault();switchToBatch(sw.dataset.switchBatch);}
});
document.addEventListener('DOMContentLoaded',()=>{setTimeout(()=>{updateRunningUI();refreshRunningBatches(false);},1500);});
window.addEventListener('online',()=>refreshRunningBatches(false));

let pwCoOpen=false;   // Batch Change Over: all sheds shown, or just the first one
document.addEventListener('click',e=>{if(e.target.closest('[data-pw-panel-go="setup"]')){gotoPair(1,'setup');return;}if(e.target.closest('[data-co-more]')){pwCoOpen=!pwCoOpen;render();}});
