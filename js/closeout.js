// ── Closing a shed after clean-out ──
// A final pickup only sets the clean-out date. On that day the shed shows up in the bell and on
// Home ("needs closing"); its card gets a Close shed button. Closing asks for the birds actually
// taken out and the final mortality, then balances the shed to zero birds:
//   expected in the shed = placed − mortality − earlier pickups
//   more came out than expected → mortality was over-counted, it goes down by the extra
//   fewer came out              → the missing birds are added to mortality
// The recorded mortality and the difference are kept in shed.closed, so the card can show both
// and Undo puts everything back.

function shedIsClosed(s){return !!(s&&s.closed);}
// The day the last birds leave: the final pickup's date, else the clean-out date
function shedOutDate(s){const fp=finalPickupOf(s);return fp&&fp.date?dateOnly(fp.date):s&&s.cleanoutDate?dateOnly(s.cleanoutDate):null;}
function shedNeedsClosing(s,today){
  if(!s||!s.placementDate||shedIsClosed(s))return false;
  const d=shedOutDate(s);return !!d&&d<=dateOnly(today||new Date());
}
function shedsNeedingClose(){return farmData?(farmData.sheds||[]).filter(s=>shedNeedsClosing(s)):[];}
// Settings › Alerts › Empty shed: off = no bell, Home or pop-up alerts about sheds still to close
function emptyShedAlertsOn(){return notifPrefs.emptyShed!==false;}
function shedsToAlertClose(){return emptyShedAlertsOn()?shedsNeedingClose():[];}
function earlierPickupBirds(s){return (s.pickups||[]).filter(p=>!p.isFinal).reduce((n,p)=>n+(Number(p.birds)||0),0);}
// The balance for a count: what mortality becomes
function closeMath(s,birdsOut,mort){
  const placed=Number(s.initialPopulation)||0,earlier=earlierPickupBirds(s);
  const expected=placed-mort-earlier;
  const diff=birdsOut-expected;                 // + more came out, − fewer
  const newMort=placed-earlier-birdsOut;        // = mort − diff
  return {placed,earlier,expected,diff,newMort,adjust:newMort-mort};
}

// ── The Close shed window ──
let closeShedState=null;
function openCloseShedModal(id){
  const s=farmData&&farmData.sheds.find(x=>String(x.id)===String(id));if(!s)return;
  const fp=finalPickupOf(s);
  closeShedState={id:s.id,birds:fp?Number(fp.birds)||'':'',mort:Number(s.mortality)||0,final:false,checked:false};
  let m=document.getElementById('closeShedModal');
  if(!m){m=document.createElement('div');m.className='sync-modal';m.id='closeShedModal';
    m.innerHTML='<div class="sync-modal-head"><h3 id="closeShedTitle"></h3><button type="button" data-cs-cancel aria-label="Close">✕</button></div><div class="sync-modal-body" id="closeShedBody"></div>';
    document.body.appendChild(m);}
  document.getElementById('closeShedTitle').innerHTML=`<span>🏁</span> Close Shed ${s.id}`;
  renderCloseShedBody();
  m.classList.add('open');const sc=document.getElementById('syncScrim');if(sc)sc.classList.add('open');
  setTimeout(()=>document.getElementById('csBirds')?.focus(),80);
}
function closeCloseShedModal(){const m=document.getElementById('closeShedModal');if(m)m.classList.remove('open');closeShedState=null;if(typeof updateScrimVisibility==='function')updateScrimVisibility();}
function closeResultHtml(){
  const st=closeShedState,s=farmData.sheds.find(x=>x.id===st.id);
  const n=(Number(st.birds)>0?Number(st.birds):null),mort=Number(st.mort);
  const c=n!=null&&Number.isFinite(mort)&&mort>=0?closeMath(s,n,mort):null;
  const big=c&&Math.abs(c.adjust)>c.placed*0.01;
  const bad=c&&c.newMort<0;
  const fmt=x=>Math.round(x).toLocaleString('en-US');
  let result='';
  if(c){
    const line=c.diff===0?'Matches the shed exactly — mortality stays the same.'
      :c.diff>0?`<b>${fmt(c.diff)}</b> more than expected — mortality was over-counted, it goes down by ${fmt(c.diff)}.`
      :`<b>${fmt(-c.diff)}</b> fewer than expected — the missing birds are added to mortality.`;
    result=`<div class="cs-result${bad?' bad':big?' warn':''}">
      <div class="cs-row"><span>Expected in the shed</span><b>${fmt(c.expected)}</b></div>
      <div class="cs-row"><span>Counted out</span><b>${fmt(n)}</b></div>
      <p class="cs-line">${line}</p>
      ${bad?`<p class="cs-line"><b>That's more birds than were placed after the earlier pickups.</b> Check the placement number (${fmt(c.placed)}) and the earlier pickups before closing.</p>`
        :`<div class="cs-row cs-total"><span>Final mortality</span><b>${fmt(c.newMort)}${c.adjust?` <small>(${fmt(mort)} recorded ${c.adjust>0?'+':'−'} ${fmt(Math.abs(c.adjust))} ${c.adjust>0?'unaccounted':'over-counted'})</small>`:''}</b></div>
          <div class="cs-row"><span>Livability</span><b>${(c.placed>0?(1-c.newMort/c.placed)*100:0).toFixed(2)}%</b></div>`}
      ${big&&!bad?`<label class="mp-checkbox-row"><input type="checkbox" id="csChecked" ${st.checked?'checked':''}><span>The difference is over 1% of the birds placed. I've checked the kill sheet and the mortality.</span></label>`:''}
    </div>`;
  }
  const ready=!!(c&&!bad&&st.final&&(!big||st.checked));
  return {html:result+(!st.final&&c?'<div class="mp-hint">Tick that the mortality is final to close the shed.</div>':''),ready};
}
function refreshCloseResult(){
  const r=closeResultHtml(),box=document.getElementById('csResult'),btn=document.getElementById('csClose');
  if(box)box.innerHTML=r.html;if(btn)btn.disabled=!r.ready;
}
function renderCloseShedBody(){
  const st=closeShedState,b=document.getElementById('closeShedBody');if(!st||!b)return;
  const s=farmData.sheds.find(x=>x.id===st.id),fp=finalPickupOf(s),out=shedOutDate(s);
  const fmt=x=>Math.round(x).toLocaleString('en-US');
  b.innerHTML=`<div class="sync-status-card">
      <div class="sync-status-row"><span class="lbl">Placed</span><span class="val">${fmt(Number(s.initialPopulation)||0)}</span></div>
      <div class="sync-status-row"><span class="lbl">Earlier pickups</span><span class="val">${fmt(earlierPickupBirds(s))} birds · ${(s.pickups||[]).filter(p=>!p.isFinal).length}</span></div>
      <div class="sync-status-row"><span class="lbl">Clean-out</span><span class="val">${out?escapeHtml(fmtShort(out)):'—'}${fp?'':' (no final pickup logged)'}</span></div>
    </div>
    <div class="mp-field"><label for="csBirds">Birds taken out at clean-out (actual, from the kill sheet)</label><input type="number" id="csBirds" min="0" step="1" inputmode="numeric" value="${st.birds}" placeholder="e.g. 17950"></div>
    <div class="mp-field"><label for="csMort">Total mortality to clean-out</label><input type="number" id="csMort" min="0" step="1" inputmode="numeric" value="${st.mort}"></div>
    <label class="mp-checkbox-row"><input type="checkbox" id="csFinal" ${st.final?'checked':''}><span>This mortality is final — every dead bird up to clean-out is in it.</span></label>
    <div id="csResult"></div>
    <div class="sync-actions"><button class="btn-sync-primary" id="csClose" data-cs-close disabled>Close Shed ${s.id}</button><button class="btn-sync-primary ghost" data-cs-cancel>Cancel</button></div>`;
  refreshCloseResult();
}
function closeShedNow(){
  const st=closeShedState;if(!st)return;
  const s=farmData.sheds.find(x=>x.id===st.id);if(!s)return;
  if(!st.final)return;
  const c=closeShedCore(s,Math.floor(Number(st.birds)),Math.floor(Number(st.mort)));if(!c)return;
  saveState();schedulePush();closeCloseShedModal();render();if(typeof refreshPickupsModal==='function')refreshPickupsModal();
  const what=c.adjust===0?'birds balance exactly':c.adjust>0?`${c.adjust.toLocaleString('en-US')} unaccounted birds added to mortality`:`mortality lowered by ${(-c.adjust).toLocaleString('en-US')}`;
  showToast(`🏁 Shed ${s.id} closed — ${what}.`);
}
// Balances one shed and marks it closed (no save, no render). Null when the count can't be right.
function closeShedCore(s,n,mort){
  const c=closeMath(s,n,mort);if(c.newMort<0)return null;
  const out=shedOutDate(s)||dateOnly(new Date());
  let fp=finalPickupOf(s);const created=!fp;
  const rec={date:iso(out),at:Date.now(),birdsOut:n,expected:c.expected,mortRecorded:mort,adjust:c.adjust,mortBefore:Number(s.mortality)||0,
    mortUpdatedBefore:s.mortalityUpdatedAt?iso(s.mortalityUpdatedAt):null,finalBirdsBefore:fp?Number(fp.birds)||0:null,createdFinal:created};
  if(!fp){
    const est=typeof estimatedPickupWeight==='function'?estimatedPickupWeight(s,out):null;
    fp={date:out,birds:n,isFinal:true,variance:null,totalWeightKg:est?n*est:null,totalWeightKgFromExcel:null,totalWeightKgManual:true,source:'manual',ageOverride:null,weightEstimated:!!est};
    s.pickups=(s.pickups||[]).concat([fp]).sort((a,b)=>dateOnly(a.date)-dateOnly(b.date));
  }else fp.birds=n;
  s.mortality=c.newMort;s.mortalityUpdatedAt=out;s.cleanoutDate=out;s.cleanoutAuto=false;s.closed=rec;
  if(typeof reconcilePredictedPickups==='function')reconcilePredictedPickups(s);
  return c;
}
function undoCloseShed(id){
  const s=farmData&&farmData.sheds.find(x=>String(x.id)===String(id));if(!s||!s.closed)return;
  if(!confirm(`Undo closing Shed ${s.id}?\n\nMortality goes back to ${Number(s.closed.mortBefore).toLocaleString('en-US')} and the final pickup to what it was.`))return;
  const r=s.closed,fp=finalPickupOf(s);
  if(r.createdFinal&&fp)s.pickups=s.pickups.filter(p=>p!==fp);
  else if(fp&&r.finalBirdsBefore!=null)fp.birds=r.finalBirdsBefore;
  s.mortality=r.mortBefore;s.mortalityUpdatedAt=r.mortUpdatedBefore?dateOnly(r.mortUpdatedBefore):null;
  delete s.closed;
  saveState();schedulePush();render();if(typeof refreshPickupsModal==='function')refreshPickupsModal();
  showToast(`Shed ${s.id} is open again.`);
}
// Takes you to the shed (its pair's overview) with a short glow; the Close shed button is on its card
function goToShedForClose(id){
  const g=[1,2,3,4].find(x=>shedsForGroup(x).some(s=>String(s.id)===String(id)));if(!g)return;
  if(typeof closeToolPages==='function')closeToolPages();
  gotoPair(g,'overview',id);
  requestAnimationFrame(()=>{const c=document.getElementById('pair-shed-'+id);if(c){c.scrollIntoView({block:'center'});c.classList.add('pk-flash');setTimeout(()=>c.classList.remove('pk-flash'),1800);}});
}

// Card pieces for the pair overview
function closeBannerHtml(s){
  const fmt=x=>Math.round(Number(x)||0).toLocaleString('en-US');
  if(shedIsClosed(s)){const r=s.closed;
    return `<div class="cs-banner closed"><span class="cs-ic">✓</span><span class="cs-txt"><b>Closed · ${escapeHtml(fmtShortNoYear(dateOnly(r.date)))}</b><span>${fmt(r.birdsOut)} birds out · mortality ${fmt(s.mortality)}${r.adjust?` (${fmt(r.mortRecorded)} recorded ${r.adjust>0?'+':'−'} ${fmt(Math.abs(r.adjust))} ${r.adjust>0?'unaccounted':'over-counted'})`:''}</span></span><button type="button" class="cs-undo" data-cs-undo="${s.id}" title="Open Shed ${s.id} again and put the mortality back">Undo</button></div>`;}
  if(shedNeedsClosing(s)){const d=shedOutDate(s);
    return `<div class="cs-banner due"><span class="cs-ic">🏁</span><span class="cs-txt"><b>Clean-out ${dateOnly(d).getTime()===dateOnly(new Date()).getTime()?'today':'done '+escapeHtml(fmtShortNoYear(d))}</b><span>Enter the birds taken out to balance the shed.</span></span><button type="button" class="cs-go" data-cs-open="${s.id}" title="Enter the birds taken out and the final mortality for Shed ${s.id}">Close shed</button></div>`;}
  return '';
}

// Bell, Home and a once-a-day reminder
function closeAlerts(){
  return shedsToAlertClose().map(s=>{const d=shedOutDate(s);const today=dateOnly(d).getTime()===dateOnly(new Date()).getTime();
    return {kind:'error',msg:`<strong>Shed ${s.id}</strong> — clean-out ${today?'today':'was '+fmtShortNoYear(d)} · the shed is done and needs closing`,closeShed:s.id};}).concat(leftoverAlerts());
}
function closeNeeds(){
  // pairs waiting for their leftover first, then sheds to close, then the carry-over offer
  const lo=leftoverNeeds(),pairs=lo.filter(n=>n.tone==='bad'),rest=lo.filter(n=>n.tone!=='bad');
  const many=shedsToAlertClose();
  if(many.length>=2)return pairs.concat([{tone:'bad',title:`Close ${many.length} sheds`,sub:`Clean-outs done (Shed ${many.map(s=>s.id).join(', ')}) — confirm the birds out and close them together`,act:'data-close-all'}]).concat(rest);
  return pairs.concat(shedsToAlertClose().map(s=>{const d=shedOutDate(s);const today=dateOnly(d).getTime()===dateOnly(new Date()).getTime();
    return {tone:'bad',title:`Close Shed ${s.id}`,sub:`Clean-out ${today?'today':'was '+fmtShortNoYear(d)} — enter the birds taken out`,act:`data-close-go="${s.id}"`};})).concat(rest);
}
function announceClose(){
  const list=shedsToAlertClose();if(!list.length)return;
  const k='pw-close-told-'+iso(new Date());let told=[];
  try{told=JSON.parse(localStorage.getItem(k)||'[]');}catch(e){}
  const fresh=list.filter(s=>!told.includes(s.id));if(!fresh.length)return;
  try{localStorage.setItem(k,JSON.stringify(told.concat(fresh.map(s=>s.id))));}catch(e){}
  setTimeout(()=>showToast(`🏁 Shed${fresh.length>1?'s':''} ${fresh.map(s=>s.id).join(', ')} ${fresh.length>1?'are':'is'} cleaned out and need${fresh.length>1?'':'s'} closing — see the bell.`),600);
}
(function(){const prev=updateAlertsBell;updateAlertsBell=function(){prev();try{announceClose();}catch(e){}};})();

document.addEventListener('click',e=>{
  const t=e.target;
  const ac=t.closest('.alerts-popover [data-alert-close]');
  if(ac){const pop=document.getElementById('alertsPopover');if(pop)pop.classList.remove('open');goToShedForClose(ac.dataset.alertClose);return;}
  const go=t.closest('[data-close-go]');if(go){goToShedForClose(go.dataset.closeGo);return;}
  const op=t.closest('[data-cs-open]');if(op){openCloseShedModal(op.dataset.csOpen);return;}
  const un=t.closest('[data-cs-undo]');if(un){undoCloseShed(un.dataset.csUndo);return;}
  if(t.closest('[data-cs-cancel]')){closeCloseShedModal();return;}
  if(t.closest('[data-cs-close]')){closeShedNow();return;}
});
document.addEventListener('input',e=>{
  if(!closeShedState)return;const id=e.target.id;
  if(id==='csBirds'||id==='csMort'){closeShedState[id==='csBirds'?'birds':'mort']=e.target.value;closeShedState.checked=false;refreshCloseResult();}
});
document.addEventListener('change',e=>{
  if(!closeShedState)return;
  if(e.target.id==='csFinal'){closeShedState.final=e.target.checked;refreshCloseResult();}
  if(e.target.id==='csChecked'){closeShedState.checked=e.target.checked;refreshCloseResult();}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&closeShedState)closeCloseShedModal();});

// ── Finishing a pair: the feed left in its silos ──
// When both sheds of a pair are closed, the bell, Home and the pair page ask for the feed left in
// the pair's three silos. Once every pair with birds has its leftover, the total becomes the farm
// leftover (Result detail), which comes off the delivered feed: feed = dockets + carry-over − leftover.
// Kept apart from the silo readings, so the feed forecast and the intake calibration never see it.
const LO_OPTS=[['e','Empty',0],['0','Cone only',ringsToKg(0)],['1','1 ring',ringsToKg(1)],['2','2 rings',ringsToKg(2)],['3','3 rings',ringsToKg(3)],['4','4 rings',ringsToKg(4)],['5','5 rings',ringsToKg(5)]];
function loKg(v){const o=LO_OPTS.find(x=>x[0]===String(v));return o?o[2]:null;}
function pairLeftovers(){if(!predState.pairLeftover||typeof predState.pairLeftover!=='object')predState.pairLeftover={};return predState.pairLeftover;}
function pairPlaced(g){return shedsForGroup(g).filter(s=>s.placementDate);}
function pairAllClosed(g){const p=pairPlaced(g);return p.length>0&&p.every(shedIsClosed);}
function pairFinished(g){return !!pairLeftovers()[g];}
// not asked when the farm's leftover was already typed in Result detail (e.g. an older batch)
function farmLeftoverTyped(){return Number(predState.farmLeftoverKg)>0&&!predState.farmLeftoverFromPairs;}
function pairNeedsLeftover(g){return pairAllClosed(g)&&!pairFinished(g)&&!farmLeftoverTyped();}
function activePairs(){return [1,2,3,4].filter(g=>pairPlaced(g).length);}
function allPairsFinished(){const a=activePairs();return a.length>0&&a.every(pairFinished);}
function pairMissingDockets(g){return (farmLoads||[]).filter(l=>Number(l.splitKg&&l.splitKg[g])>0&&l.actualKg==null);}
function pairsLeftoverKg(){return activePairs().reduce((n,g)=>n+(Number((pairLeftovers()[g]||{}).kg)||0),0);}
// The farm leftover follows the pairs: set when the last pair is in, cleared again if one is undone
function applyFarmLeftoverFromPairs(){
  if(allPairsFinished()){const kg=pairsLeftoverKg();predState.farmLeftoverKg=kg>0?kg:null;predState.farmLeftoverFromPairs=true;}
  else if(predState.farmLeftoverFromPairs){predState.farmLeftoverKg=null;predState.farmLeftoverFromPairs=false;}
}

let leftoverState=null;
function openLeftoverModal(g){
  g=Number(g);if(!pairPlaced(g).length)return;
  const prev=pairLeftovers()[g];
  leftoverState={g,silos:prev?prev.silos.slice():[null,null,null],weighed:prev&&prev.weighed?prev.kg:''};
  let m=document.getElementById('leftoverModal');
  if(!m){m=document.createElement('div');m.className='sync-modal';m.id='leftoverModal';
    m.innerHTML='<div class="sync-modal-head"><h3 id="leftoverTitle"></h3><button type="button" data-lo-cancel aria-label="Close">✕</button></div><div class="sync-modal-body" id="leftoverBody"></div>';
    document.body.appendChild(m);}
  document.getElementById('leftoverTitle').innerHTML=`<span>🧺</span> Leftover feed · ${escapeHtml(pairLabel(g))}`;
  renderLeftoverBody();
  m.classList.add('open');const sc=document.getElementById('syncScrim');if(sc)sc.classList.add('open');
}
function closeLeftoverModal(){const m=document.getElementById('leftoverModal');if(m)m.classList.remove('open');leftoverState=null;if(typeof updateScrimVisibility==='function')updateScrimVisibility();}
function leftoverTotals(){
  const st=leftoverState,done=st.silos.every(v=>v!=null&&v!=='');
  const fromRings=st.silos.reduce((n,v)=>n+(loKg(v)||0),0);
  const w=Number(st.weighed),weighed=String(st.weighed).trim()!==''&&Number.isFinite(w)&&w>=0;
  return {done,fromRings,weighed,kg:weighed?Math.round(w):fromRings};
}
function renderLeftoverBody(){
  const st=leftoverState,b=document.getElementById('leftoverBody');if(!st||!b)return;
  const g=st.g,miss=pairMissingDockets(g);
  const sel=(i)=>`<label class="lo-silo"><span>Silo ${siloNumber(g,i+1)}</span><select id="loSilo${i}" data-lo-silo="${i}"><option value="" ${st.silos[i]==null||st.silos[i]===''?'selected':''} disabled>Choose…</option>${LO_OPTS.map(o=>`<option value="${o[0]}" ${String(st.silos[i])===o[0]?'selected':''}>${o[1]}${o[2]?' · '+fmtFeed(o[2],0):''}</option>`).join('')}</select></label>`;
  b.innerHTML=`<p class="lo-intro">Both sheds are closed. How much feed is still in the pair's silos? It comes off the delivered feed once every pair is done.</p>
    <div class="lo-silos">${[0,1,2].map(sel).join('')}</div>
    <div class="mp-field"><label for="loWeighed">Weighed total (${escapeHtml(feedUnit())}) — optional, e.g. the mill's withdrawal docket</label><input type="number" id="loWeighed" min="0" step="${feedStep()}" inputmode="decimal" value="${st.weighed!==''?escapeAttr(String(feedIn(Number(st.weighed)))):''}" placeholder="Uses the rings when empty"></div>
    <div id="loResult"></div>
    ${miss.length?`<div class="lo-warn"><b>${miss.length} load${miss.length===1?'':'s'} for ${escapeHtml(pairLabel(g))} still on the planned weight.</b> Enter the docket weights in Feed loads — the leftover only comes off the feed once every load has its docket weight.</div>`:''}
    <div class="sync-actions"><button class="btn-sync-primary" id="loSave" data-lo-save disabled>Save leftover</button><button class="btn-sync-primary ghost" data-lo-cancel>Cancel</button></div>`;
  refreshLeftoverResult();
}
function refreshLeftoverResult(){
  const st=leftoverState;if(!st)return;const t=leftoverTotals();
  const box=document.getElementById('loResult'),btn=document.getElementById('loSave');
  if(box)box.innerHTML=t.done||t.weighed?`<div class="cs-result"><div class="cs-row cs-total"><span>Leftover in ${escapeHtml(pairLabel(st.g))}</span><b>${fmtFeed(t.kg,1)}</b></div>${t.weighed&&t.done&&Math.abs(t.kg-t.fromRings)>0?`<div class="cs-row"><span>From the rings</span><b>${fmtFeed(t.fromRings,1)}</b></div>`:''}${t.weighed?'<p class="cs-line">Using the weighed total.</p>':''}</div>`:'<div class="mp-hint">Choose each silo (or type a weighed total).</div>';
  if(btn)btn.disabled=!(t.done||t.weighed);
}
function saveLeftover(){
  const st=leftoverState;if(!st)return;const t=leftoverTotals();if(!(t.done||t.weighed))return;
  const g=st.g;pairLeftovers()[g]={kg:t.kg,silos:st.silos.slice(),weighed:t.weighed,at:Date.now()};
  applyFarmLeftoverFromPairs();
  savePredState();schedulePush();closeLeftoverModal();render();
  if(allPairsFinished()){
    if(typeof pwFinishIfDone==='function')pwFinishIfDone();
    showToast(`🧺 Every pair is done — ${fmtFeed(pairsLeftoverKg(),1)} leftover comes off the delivered feed.`);
  }else showToast(`🧺 ${pairLabel(g)} finished — ${fmtFeed(t.kg,1)} left in the silos.`);
}
function undoPairFinish(g){
  g=Number(g);if(!pairFinished(g))return;
  if(!confirm(`Undo finishing ${pairLabel(g)}?\n\nIts leftover feed is removed${allPairsFinished()?' and the farm leftover is cleared until every pair is done again':''}.`))return;
  delete pairLeftovers()[g];
  applyFarmLeftoverFromPairs();
  // A Farm history record saved automatically when the last pair finished is taken back
  const key=typeof currentBatchKey==='function'?currentBatchKey():'';
  if(key&&Array.isArray(predState.farmHistory)){const i=predState.farmHistory.findIndex(r=>String(r.batch).trim().toLowerCase()===String(key).toLowerCase()&&r.source==='auto');
    if(i>=0){predState.farmHistory.splice(i,1);if(typeof pwPending==='function'&&pwPending()[key]==='done')pwPending()[key]='pending';if(typeof scheduleHistoryPush==='function')scheduleHistoryPush();}}
  savePredState();schedulePush();render();showToast(`${pairLabel(g)} is open again.`);
}
function pairLeftoverBannerHtml(g){
  if(pairFinished(g)){const r=pairLeftovers()[g];
    return `<div class="cs-banner closed lo-banner"><span class="cs-ic">✓</span><span class="cs-txt"><b>${escapeHtml(pairLabel(g))} finished</b><span>${fmtFeed(Number(r.kg)||0,1)} left in the silos${r.weighed?' (weighed)':''}${allPairsFinished()?' · counted in the farm leftover':' · comes off the feed when every pair is done'}</span></span><button type="button" class="cs-undo" data-lo-edit="${g}" title="Change the leftover for ${escapeAttr(pairLabel(g))}">Edit</button><button type="button" class="cs-undo" data-lo-undo="${g}" title="Open ${escapeAttr(pairLabel(g))} again and remove its leftover">Undo</button></div>`;}
  if(pairNeedsLeftover(g)){const miss=pairMissingDockets(g).length;
    return `<div class="cs-banner due lo-banner"><span class="cs-ic">🧺</span><span class="cs-txt"><b>Both sheds closed — enter the leftover feed</b><span>How much is still in the pair's 3 silos${miss?` · ${miss} load${miss===1?'':'s'} still need${miss===1?'s':''} a docket weight`:''}.</span></span><button type="button" class="cs-go" data-lo-open="${g}" title="Enter the feed left in the silos for ${escapeAttr(pairLabel(g))}">Enter leftover</button></div>`;}
  return '';
}
function goToPairForLeftover(g){
  if(typeof closeToolPages==='function')closeToolPages();
  gotoPair(Number(g),'overview');
  requestAnimationFrame(()=>{const c=document.querySelector('.lo-banner');if(c){c.scrollIntoView({block:'center'});c.classList.add('pk-flash');setTimeout(()=>c.classList.remove('pk-flash'),1800);}});
}
function leftoverAlerts(){return [1,2,3,4].filter(pairNeedsLeftover).map(g=>({kind:'error',msg:`<strong>${pairLabel(g)}</strong> — both sheds closed · enter the leftover feed in the silos`,pairLeftover:g}));}
function leftoverNeeds(){
  const out=[1,2,3,4].filter(pairNeedsLeftover).map(g=>({tone:'bad',title:`Enter leftover feed for ${pairLabel(g)}`,sub:'Both sheds are closed — what is still in the silos?',act:`data-lo-go="${g}"`}));
  const pl=predState.prevLeftover;
  if(pl&&Number(pl.kg)>0&&carryoverTotalKg()===0)out.push({tone:'warn',title:`Carry-over: ${fmtFeed(Number(pl.kg),1)} left from ${pl.batch||'the last batch'}`,sub:'Tap to use it as this batch\'s carried-over feed',act:'data-carry-use'});
  return out;
}
document.addEventListener('click',e=>{
  const t=e.target;
  const al=t.closest('.alerts-popover [data-alert-leftover]');
  if(al){const pop=document.getElementById('alertsPopover');if(pop)pop.classList.remove('open');goToPairForLeftover(al.dataset.alertLeftover);return;}
  const go=t.closest('[data-lo-go]');if(go){goToPairForLeftover(go.dataset.loGo);return;}
  const op=t.closest('[data-lo-open],[data-lo-edit]');if(op){openLeftoverModal(op.dataset.loOpen||op.dataset.loEdit);return;}
  const un=t.closest('[data-lo-undo]');if(un){undoPairFinish(un.dataset.loUndo);return;}
  if(t.closest('[data-lo-cancel]')){closeLeftoverModal();return;}
  if(t.closest('[data-lo-save]')){saveLeftover();return;}
  if(t.closest('[data-carry-use]')){const pl=predState.prevLeftover;if(!pl)return;
    if(confirm(`Use the ${fmtFeed(Number(pl.kg),1)} left in the silos from ${pl.batch||'the last batch'} as this batch's carried-over feed?\n\nOK = use it. Cancel = don't ask again.`)){setCarryoverTotal(Number(pl.kg)/1000);showToast(`Carry-over set to ${fmtFeed(Number(pl.kg),1)}.`);}
    predState.prevLeftover=null;savePredState();schedulePush();render();return;}
});
document.addEventListener('change',e=>{
  if(!leftoverState)return;const s=e.target.closest&&e.target.closest('[data-lo-silo]');
  if(s){leftoverState.silos[Number(s.dataset.loSilo)]=s.value;refreshLeftoverResult();}
});
document.addEventListener('input',e=>{
  if(!leftoverState||e.target.id!=='loWeighed')return;
  const v=e.target.value;leftoverState.weighed=String(v).trim()===''?'':feedOut(v);refreshLeftoverResult();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&leftoverState)closeLeftoverModal();});

// ── Close several sheds at once (e.g. a finished batch opened from the cloud) ──
let closeAllState=null;
function openCloseAllModal(){
  const list=shedsNeedingClose();if(!list.length)return;
  closeAllState={final:false,checked:false,rows:list.map(s=>{const fp=finalPickupOf(s);return {id:s.id,birds:fp?String(Number(fp.birds)||''):'',mort:String(Number(s.mortality)||0)};})};
  let m=document.getElementById('closeAllModal');
  if(!m){m=document.createElement('div');m.className='sync-modal';m.id='closeAllModal';
    m.innerHTML='<div class="sync-modal-head"><h3><span>🏁</span> Close sheds</h3><button type="button" data-ca-cancel aria-label="Close">✕</button></div><div class="sync-modal-body" id="closeAllBody"></div>';
    document.body.appendChild(m);}
  renderCloseAllBody();m.classList.add('open');const sc=document.getElementById('syncScrim');if(sc)sc.classList.add('open');
}
function closeCloseAllModal(){const m=document.getElementById('closeAllModal');if(m)m.classList.remove('open');closeAllState=null;if(typeof updateScrimVisibility==='function')updateScrimVisibility();}
function caResult(){
  const st=closeAllState,fmt=x=>Math.round(x).toLocaleString('en-US');let bad=0,big=0,ready=0;
  const rows=st.rows.map(r=>{const s=farmData.sheds.find(x=>x.id===r.id);const n=Number(r.birds),mo=Number(r.mort);
    if(!(n>0)||!Number.isFinite(mo)||mo<0)return {r,txt:'<span class="set-muted">enter birds out</span>'};
    const c=closeMath(s,n,mo);if(c.newMort<0){bad++;return {r,txt:'<span class="ca-bad">more than placed — check</span>'};}
    if(Math.abs(c.adjust)>c.placed*0.01)big++;ready++;
    return {r,txt:c.adjust===0?`<b>${fmt(c.newMort)}</b> <span class="set-muted">balances</span>`:`<b>${fmt(c.newMort)}</b> <span class="${Math.abs(c.adjust)>c.placed*0.01?'ca-warn':'set-muted'}">(${c.adjust>0?'+':'−'}${fmt(Math.abs(c.adjust))})</span>`};});
  return {rows,bad,big,ok:ready===st.rows.length&&!bad&&st.final&&(!big||st.checked)};
}
function renderCloseAllBody(){
  const st=closeAllState,b=document.getElementById('closeAllBody');if(!st||!b)return;
  b.innerHTML=`<p class="lo-intro">Each shed's birds out come from its final pickup and its mortality from the latest count. Change any that differ, then close them together.</p>
    <div class="ca-scroll"><table class="ca-tbl"><thead><tr><th>Shed</th><th>Clean-out</th><th>Birds out</th><th>Mortality</th><th>Final mortality</th></tr></thead><tbody>${st.rows.map(r=>{const s=farmData.sheds.find(x=>x.id===r.id);const d=shedOutDate(s);
      return `<tr><td><b>${r.id}</b></td><td>${d?escapeHtml(fmtShortNoYear(d)):'—'}</td><td><input type="number" min="0" step="1" inputmode="numeric" value="${escapeAttr(r.birds)}" data-ca="${r.id}|birds" aria-label="Shed ${r.id} birds out"></td><td><input type="number" min="0" step="1" inputmode="numeric" value="${escapeAttr(r.mort)}" data-ca="${r.id}|mort" aria-label="Shed ${r.id} mortality"></td><td class="ca-res" id="caRes${r.id}"></td></tr>`;}).join('')}</tbody></table></div>
    <label class="mp-checkbox-row"><input type="checkbox" id="caFinal" ${st.final?'checked':''}><span>These mortality numbers are final.</span></label>
    <div id="caExtra"></div>
    <div class="sync-actions"><button class="btn-sync-primary" id="caGo" data-ca-go disabled>Close ${st.rows.length} sheds</button><button class="btn-sync-primary ghost" data-ca-cancel>Cancel</button></div>`;
  refreshCloseAll();
}
function refreshCloseAll(){
  const st=closeAllState;if(!st)return;const r=caResult();
  r.rows.forEach(x=>{const el=document.getElementById('caRes'+x.r.id);if(el)el.innerHTML=x.txt;});
  const ex=document.getElementById('caExtra');
  if(ex)ex.innerHTML=r.big&&!r.bad?`<label class="mp-checkbox-row"><input type="checkbox" id="caChecked" ${st.checked?'checked':''}><span>${r.big} shed${r.big===1?'':'s'} differ by more than 1% of the birds placed. I've checked the kill sheets and the mortality.</span></label>`:'';
  const go=document.getElementById('caGo');if(go)go.disabled=!r.ok;
}
function closeAllNow(){
  const st=closeAllState;if(!st||!caResult().ok)return;let n=0,adj=0;
  st.rows.forEach(r=>{const s=farmData.sheds.find(x=>x.id===r.id);const c=closeShedCore(s,Math.floor(Number(r.birds)),Math.floor(Number(r.mort)));if(c){n++;adj+=c.adjust;}});
  saveState();schedulePush();closeCloseAllModal();render();if(typeof refreshPickupsModal==='function')refreshPickupsModal();
  showToast(`🏁 ${n} sheds closed${adj?` — mortality ${adj>0?'+':'−'}${Math.abs(adj).toLocaleString('en-US')} in total`:' — every shed balances'}.`);
}
document.addEventListener('click',e=>{
  const t=e.target;
  if(t.closest('[data-close-all]')){openCloseAllModal();return;}
  if(t.closest('[data-ca-cancel]')){closeCloseAllModal();return;}
  if(t.closest('[data-ca-go]')){closeAllNow();return;}
});
document.addEventListener('input',e=>{
  if(!closeAllState)return;const a=e.target.closest&&e.target.closest('[data-ca]');if(!a)return;
  const [id,f]=a.dataset.ca.split('|');const r=closeAllState.rows.find(x=>String(x.id)===id);if(r){r[f]=a.value;closeAllState.checked=false;refreshCloseAll();}
});
document.addEventListener('change',e=>{
  if(!closeAllState)return;
  if(e.target.id==='caFinal'){closeAllState.final=e.target.checked;refreshCloseAll();}
  if(e.target.id==='caChecked'){closeAllState.checked=e.target.checked;refreshCloseAll();}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&closeAllState)closeCloseAllModal();});
