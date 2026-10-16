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
  const n=Math.floor(Number(st.birds)),mort=Math.floor(Number(st.mort));
  const c=closeMath(s,n,mort);if(c.newMort<0||!st.final)return;
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
  saveState();schedulePush();closeCloseShedModal();render();if(typeof refreshPickupsModal==='function')refreshPickupsModal();
  const what=c.adjust===0?'birds balance exactly':c.adjust>0?`${c.adjust.toLocaleString('en-US')} unaccounted birds added to mortality`:`mortality lowered by ${(-c.adjust).toLocaleString('en-US')}`;
  showToast(`🏁 Shed ${s.id} closed — ${what}.`);
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
  return shedsNeedingClose().map(s=>{const d=shedOutDate(s);const today=dateOnly(d).getTime()===dateOnly(new Date()).getTime();
    return {kind:'error',msg:`<strong>Shed ${s.id}</strong> — clean-out ${today?'today':'was '+fmtShortNoYear(d)} · the shed is done and needs closing`,closeShed:s.id};});
}
function closeNeeds(){
  return shedsNeedingClose().map(s=>{const d=shedOutDate(s);const today=dateOnly(d).getTime()===dateOnly(new Date()).getTime();
    return {tone:'bad',title:`Close Shed ${s.id}`,sub:`Clean-out ${today?'today':'was '+fmtShortNoYear(d)} — enter the birds taken out`,act:`data-close-go="${s.id}"`};});
}
function announceClose(){
  const list=shedsNeedingClose();if(!list.length)return;
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
