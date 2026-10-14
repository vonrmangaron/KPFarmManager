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
  const list=pwRunningList();if(list.length<2)return '';
  const old=list[0],nu=list[list.length-1],today=dateOnly(new Date());
  const ids=[...new Set(old.rows.map(r=>r.id).concat(nu.rows.map(r=>r.id)))].sort((a,b)=>Number(a)-Number(b));
  const rows=ids.map(id=>{
    const o=old.rows.find(r=>r.id===id)||{},n=nu.rows.find(r=>r.id===id)||{};
    const empty=o.out&&n.place?daysBetween(o.out,n.place):null;
    let now;
    if(n.place&&n.place<=today)now=`<span class="co-tag nu">${escapeHtml(nu.key)} · day ${daysBetween(n.place,today)}</span>`;
    else if(o.out&&o.out<today)now=`<span class="co-tag empty">Empty${n.place?' · in '+daysBetween(today,n.place)+' d':''}</span>`;
    else if(o.place&&o.place<=today)now=`<span class="co-tag old">${escapeHtml(old.key)} · day ${daysBetween(o.place,today)}</span>`;
    else now='<span class="co-tag empty">—</span>';
    return `<tr><td><b>Shed ${escapeHtml(String(id))}</b></td><td>${pwFmt(o.out)}</td><td class="num">${empty!=null?empty+' d':'—'}</td><td>${pwFmt(n.place)}</td><td>${now}</td></tr>`;}).join('');
  return `<section class="mgr-card co-card"><div class="co-head"><b>Shed changeover</b><span>${escapeHtml(old.key)} finishing · ${escapeHtml(nu.key)} starting — each shed belongs to one batch at a time</span></div>
    <div class="co-scroll"><table class="co-table"><thead><tr><th>Shed</th><th>${escapeHtml(old.key)} clean-out</th><th class="num">Empty</th><th>${escapeHtml(nu.key)} placement</th><th>Today</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}
document.addEventListener('click',e=>{
  const sw=e.target.closest('[data-switch-batch]');if(sw){e.preventDefault();switchToBatch(sw.dataset.switchBatch);}
});
document.addEventListener('DOMContentLoaded',()=>{setTimeout(()=>{updateRunningUI();refreshRunningBatches(false);},1500);});
window.addEventListener('online',()=>refreshRunningBatches(false));
