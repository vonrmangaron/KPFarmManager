// ── Mortality tool: every shed's total morts on one page ──
// Managers keep a running total per shed, so each box is the shed's total dead
// so far this batch (pre-filled). The row shows what that adds since the last update.
let mortOpen=false,mortDate=null,mortDraft={};
function openMortModal(){
  if(!farmData){showToast('Load a batch first.',true);return;}
  mortOpen=true;mortDate=dateOnly(new Date());mortDraft={};
  const m=document.getElementById('mortModal');if(m){m.classList.add('open');m.setAttribute('aria-hidden','false');}
  renderMortBody();
  setTimeout(()=>{const f=document.querySelector('#mortBody .mort-input:not([disabled])');if(f&&window.matchMedia('(min-width:769px)').matches){f.focus();f.select();}},60);
}
function closeMortModal(){
  mortOpen=false;mortDraft={};
  const m=document.getElementById('mortModal');if(m){m.classList.remove('open');m.setAttribute('aria-hidden','true');}
}
function mortShedState(shed){
  const d=mortDate;
  const placed=shed.placementDate?dateOnly(shed.placementDate):null;
  const clean=shed.cleanoutDate?dateOnly(shed.cleanoutDate):null;
  const inBatch=!!placed&&d>=placed&&(!clean||d<=clean)&&(Number(shed.initialPopulation)||0)>0;
  const upd=shed.mortalityUpdatedAt?dateOnly(shed.mortalityUpdatedAt):null;
  return {inBatch,later:!!upd&&upd>d,upd,age:placed?mgrDays(placed,d):null,total:Math.max(0,Number(shed.mortality)||0),placedN:Number(shed.initialPopulation)||0};
}
// What the typed total means for the shed
function mortResult(st,raw){
  const s=String(raw??'').trim();
  if(raw==null||s==='')return {n:st.total,changed:false,delta:0};
  const n=Number(s);
  if(!Number.isFinite(n)||n<0||Math.floor(n)!==n)return {bad:'Whole birds only'};
  if(n>st.placedN)return {bad:'More than the birds placed'};
  return {n,changed:n!==st.total,delta:n-st.total};
}
function mortPct(n,placed){return placed>0?(n/placed*100).toFixed(2)+'%':'—';}
function mortWhen(d){return d?(mgrDays(d,dateOnly(new Date()))===0?'today':fmtShortNoYear(d)):'';}
function mortRowOut(st,raw){
  const r=mortResult(st,raw);
  if(r.bad)return `<span class="mort-bad">${r.bad}</span>`;
  const since=st.upd?` since ${mortWhen(st.upd)}`:'';
  const chip=r.changed?(r.delta>0?`<span class="mort-delta" title="Birds added${since}">+${r.delta.toLocaleString('en-US')}${since}</span>`:`<span class="mort-delta down" title="Lower than the last total — only if you are correcting it">${r.delta.toLocaleString('en-US')} · correction</span>`):'';
  return `<span class="mort-pct" title="Mortality: share of the birds placed">${mortPct(r.n,st.placedN)}</span>${chip}`;
}
function mortHint(st){
  if(!st.inBatch)return 'Not in this batch on this date';
  if(st.later)return `Updated on ${fmtShortNoYear(st.upd)} (${st.total.toLocaleString('en-US')}) — pick that day or later`;
  return st.upd?`Last total ${st.total.toLocaleString('en-US')} · ${mortWhen(st.upd)}`:'No total entered yet';
}
function mortFootHtml(){
  let farmTotal=0,farmPlaced=0,pending=0,bad=0,added=0;
  (farmData.sheds||[]).forEach(s=>{const st=mortShedState(s);farmPlaced+=st.placedN;const r=st.inBatch&&!st.later?mortResult(st,mortDraft[s.id]):{n:st.total,changed:false,delta:0};if(r.bad){bad++;farmTotal+=st.total;return;}if(r.changed){pending++;added+=r.delta;}farmTotal+=r.n;});
  return {pending,bad,html:`<div class="mort-sum"><span>Farm <b>${farmTotal.toLocaleString('en-US')}</b> dead · ${mortPct(farmTotal,farmPlaced)}</span>${pending&&added>0?`<span><b>+${added.toLocaleString('en-US')}</b> since last totals</span>`:''}</div>`};
}
function mortSaveBtnHtml(f){
  return `<button type="button" class="mort-save" id="mortSaveBtn" ${f.pending&&!f.bad?'':'disabled'} title="${f.bad?'Fix the red boxes first':f.pending?'Save every shed you changed':'Nothing changed yet'}">${f.pending?`Save ${f.pending} shed${f.pending===1?'':'s'}`:'Saved'}</button>`;
}
function renderMortBody(){
  const body=document.getElementById('mortBody');if(!body||!mortOpen)return;
  if(!farmData){body.innerHTML='<div class="bi-note">Load a batch first.</div>';return;}
  const keep=body.scrollTop;
  const today=dateOnly(new Date()),k=iso(mortDate);
  const firstPlaced=(farmData.sheds||[]).map(s=>s.placementDate?dateOnly(s.placementDate):null).filter(Boolean).sort((a,b)=>a-b)[0];
  const cards=[1,2,3,4].flatMap(g=>shedsForGroup(g).map(shed=>{
    const st=mortShedState(shed),raw=mortDraft[shed.id],r=mortResult(st,raw);
    const open=st.inBatch&&!st.later;
    return `<div class="mort-card${open?'':' off'}${r.bad?' is-bad':''}" style="--pc:var(--pair${g})" data-mort-row="${shed.id}">
        <div class="mort-card-head"><b>Shed ${shed.id}</b><span class="mort-card-pair" title="${escapeAttr(pairLabel(g))}">${escapeHtml(pairLabel(g))}</span></div>
        <span class="mort-card-sub">${st.age!=null&&st.inBatch?`Day ${st.age} · `:''}${st.placedN.toLocaleString('en-US')} placed</span>
        <label class="mort-in"><span class="mort-in-lbl">Total morts</span>
          <input class="mort-input" type="number" min="0" step="1" inputmode="numeric" enterkeyhint="next" data-mort-shed="${shed.id}" value="${escapeAttr(String(raw!=null?raw:st.total))}" ${open?'':'disabled'} aria-label="Shed ${shed.id}: total dead so far this batch" title="Total birds dead in this shed so far this batch"></label>
        <div class="mort-out" data-mort-out="${shed.id}">${mortRowOut(st,raw)}</div>
        <span class="mort-hint">${escapeHtml(mortHint(st))}</span>
      </div>`;
  })).join('');
  const isToday=mortDate.getTime()===today.getTime();
  const f=mortFootHtml();
  body.innerHTML=`<div class="mort-top">
      <div class="mort-date"><button type="button" class="mort-step" data-mort-day="-1" title="Day before" aria-label="Day before">‹</button>
        <input type="date" id="mortDateInput" value="${k}" max="${iso(today)}" ${firstPlaced?`min="${iso(firstPlaced)}"`:''} title="Totals as of this day" aria-label="Totals as of this day">
        <button type="button" class="mort-step" data-mort-day="1" ${isToday?'disabled':''} title="Next day" aria-label="Next day">›</button>
        ${isToday?'<span class="mort-today">Today</span>':`<button type="button" class="mort-today-btn" data-mort-today title="Back to today">Today</button>`}</div>
      <span class="mort-note">Type each shed's total morts so far this batch</span>
    </div>
    <div class="mort-cards">${cards}</div>
    <div class="mort-foot">${f.html}${mortSaveBtnHtml(f)}</div>`;
  body.scrollTop=keep;
}
function mortRefreshRow(id){
  const shed=(farmData.sheds||[]).find(s=>String(s.id)===String(id));if(!shed)return;
  const st=mortShedState(shed);
  const out=document.querySelector(`[data-mort-out="${id}"]`);if(out)out.innerHTML=mortRowOut(st,mortDraft[id]);
  const row=document.querySelector(`[data-mort-row="${id}"]`);if(row)row.classList.toggle('is-bad',!!mortResult(st,mortDraft[id]).bad);
  const foot=document.querySelector('#mortBody .mort-foot');if(foot){const f=mortFootHtml();foot.innerHTML=f.html+mortSaveBtnHtml(f);}
}
function saveMortality(){
  if(!farmData)return;
  let n=0;
  for(const shed of farmData.sheds||[]){
    const st=mortShedState(shed);if(!st.inBatch||st.later)continue;
    const r=mortResult(st,mortDraft[shed.id]);
    if(r.bad){showToast(`Shed ${shed.id}: ${r.bad.toLowerCase()}.`,true);return;}
    if(!r.changed)continue;
    shed.mortality=r.n;shed.mortalityUpdatedAt=mortDate;n++;
  }
  if(!n){showToast('Nothing to save.');return;}
  mortDraft={};
  saveState();schedulePush();autoPlanCache=new Map();farmRangeCache=null;
  renderMortBody();scheduleRender(60);
  showToast(`Mortality saved for ${n} shed${n===1?'':'s'}.`);
}
function mortSetDate(d){
  const today=dateOnly(new Date());
  if(!d||d>today)d=today;
  if(Object.keys(mortDraft).length){mortDraft={};showToast('Unsaved numbers cleared for the new day.');}
  mortDate=dateOnly(d);renderMortBody();
}
document.addEventListener('click',e=>{
  if(e.target.closest('#mortBtn,[data-mgr-mort]')){openMortModal();return;}
  if(!mortOpen)return;
  if(e.target.closest('#mortClose')||e.target.id==='mortModal'){closeMortModal();return;}
  const st=e.target.closest('[data-mort-day]');if(st){mortSetDate(addDays(mortDate,Number(st.dataset.mortDay)));return;}
  if(e.target.closest('[data-mort-today]')){mortSetDate(new Date());return;}
  if(e.target.closest('#mortSaveBtn')){saveMortality();return;}
});
document.addEventListener('input',e=>{
  const inp=e.target.closest&&e.target.closest('[data-mort-shed]');if(!inp||!mortOpen)return;
  mortDraft[inp.dataset.mortShed]=inp.value;mortRefreshRow(inp.dataset.mortShed);
});
document.addEventListener('change',e=>{
  if(e.target.id==='mortDateInput'&&mortOpen){const d=e.target.value?parseExcelDate(e.target.value):null;if(d)mortSetDate(d);}
});
document.addEventListener('keydown',e=>{
  if(!mortOpen)return;
  const inp=e.target.closest&&e.target.closest('[data-mort-shed]');
  if(inp&&e.key==='Enter'){
    e.preventDefault();
    const all=[...document.querySelectorAll('#mortBody .mort-input:not([disabled])')];
    const next=all[all.indexOf(inp)+1];
    if(next){next.focus();next.select();}else{inp.blur();const b=document.getElementById('mortSaveBtn');if(b&&!b.disabled)b.focus();}
    return;
  }
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeMortModal();}
},true);
