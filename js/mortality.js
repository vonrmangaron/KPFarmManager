// ── Mortality tool: enter deaths for every shed on one page ──
// "Dead that day" adds to each shed's running total and remembers the day
// (shed.mortLog = {'yyyy-mm-dd': birds}), so typing the same day again
// replaces it instead of counting it twice. "Running total" sets the total directly.
let mortOpen=false,mortDate=null,mortDraft={};
let mortMode=(()=>{try{return localStorage.getItem('pw-mort-mode')==='total'?'total':'day';}catch(e){return 'day';}})();
function normMortLog(o){
  const out={};
  if(o&&typeof o==='object')Object.keys(o).forEach(k=>{const n=Math.floor(Number(o[k]));if(/^\d{4}-\d{2}-\d{2}$/.test(k)&&Number.isFinite(n)&&n>=0)out[k]=n;});
  return out;
}
function openMortModal(){
  if(!farmData){showToast('Load a batch first.',true);return;}
  mortOpen=true;mortDate=dateOnly(new Date());mortDraft={};
  const m=document.getElementById('mortModal');if(m){m.classList.add('open');m.setAttribute('aria-hidden','false');}
  renderMortBody();
  setTimeout(()=>{const f=document.querySelector('#mortBody .mort-input:not([disabled])');if(f&&window.matchMedia('(min-width:769px)').matches)f.focus();},60);
}
function closeMortModal(){
  mortOpen=false;mortDraft={};
  const m=document.getElementById('mortModal');if(m){m.classList.remove('open');m.setAttribute('aria-hidden','true');}
}
function mortShedState(shed){
  const d=mortDate,k=iso(d);
  const placed=shed.placementDate?dateOnly(shed.placementDate):null;
  const clean=shed.cleanoutDate?dateOnly(shed.cleanoutDate):null;
  const inBatch=!!placed&&d>=placed&&(!clean||d<=clean)&&(Number(shed.initialPopulation)||0)>0;
  const log=normMortLog(shed.mortLog);
  const total=Math.max(0,Number(shed.mortality)||0);
  return {k,inBatch,age:placed?mgrDays(placed,d):null,log,total,saved:log[k],placedN:Number(shed.initialPopulation)||0};
}
// What the shed's total becomes with the number typed in
function mortResult(shed,st,raw){
  const s=String(raw??'').trim();
  if(s==='')return {n:null,newTotal:st.total,changed:false};
  const n=Number(s);
  if(!Number.isFinite(n)||n<0||Math.floor(n)!==n)return {bad:'Whole birds only'};
  const newTotal=mortMode==='day'?Math.max(0,st.total-(st.saved||0)+n):n;
  if(newTotal>st.placedN)return {bad:'More than the birds placed'};
  return {n,newTotal,changed:mortMode==='day'?n!==st.saved:n!==st.total};
}
function mortPct(n,placed){return placed>0?(n/placed*100).toFixed(2)+'%':'—';}
function mortRowOut(shed,st){
  const raw=mortDraft[shed.id];
  const r=mortResult(shed,st,raw);
  if(r.bad)return `<span class="mort-bad">${r.bad}</span>`;
  const cls=r.changed?' mort-new':'';
  return `<span class="mort-total${cls}" title="Total dead this batch${r.changed?' after you save':''}">${r.newTotal.toLocaleString('en-US')}</span><span class="mort-pct" title="Mortality: share of the birds placed">${mortPct(r.newTotal,st.placedN)}</span>`;
}
function renderMortBody(){
  const body=document.getElementById('mortBody');if(!body||!mortOpen)return;
  if(!farmData){body.innerHTML='<div class="bi-note">Load a batch first.</div>';return;}
  const keep=body.scrollTop;
  const today=dateOnly(new Date()),k=iso(mortDate),yk=iso(addDays(mortDate,-1));
  const firstPlaced=(farmData.sheds||[]).map(s=>s.placementDate?dateOnly(s.placementDate):null).filter(Boolean).sort((a,b)=>a-b)[0];
  let dayDead=0,farmTotal=0,farmPlaced=0,pending=0,bad=0;
  const pairs=[1,2,3,4].map(g=>{
    const sheds=shedsForGroup(g);if(!sheds.length)return '';
    const rows=sheds.map(shed=>{
      const st=mortShedState(shed);
      const raw=mortDraft[shed.id];
      const r=mortResult(shed,st,raw);
      if(r.bad)bad++;else{if(r.changed)pending++;farmTotal+=r.newTotal;}
      farmPlaced+=st.placedN;
      if(mortMode==='day'){const v=raw!=null&&String(raw).trim()!==''&&!r.bad?r.n:st.saved;if(v)dayDead+=v;}
      const val=raw!=null?raw:(mortMode==='day'?(st.saved!=null?st.saved:''):st.total);
      const hint=!st.inBatch?'Not in this batch on this date'
        :mortMode==='day'?(st.saved!=null?`Saved for this day: ${st.saved} — typing replaces it`:(normMortLog(shed.mortLog)[yk]!=null?`Day before: ${normMortLog(shed.mortLog)[yk]}`:'Birds found dead or culled'))
        :`Last updated ${shed.mortalityUpdatedAt?mgrWhen(dateOnly(shed.mortalityUpdatedAt)).toLowerCase()==='today'?'today':fmtShortNoYear(shed.mortalityUpdatedAt):'—'}`;
      return `<div class="mort-row${st.inBatch?'':' off'}${r.bad?' is-bad':''}" data-mort-row="${shed.id}">
        <div class="mort-shed"><b>Shed ${shed.id}</b><span>${st.age!=null&&st.inBatch?`Day ${st.age} · `:''}${st.placedN.toLocaleString('en-US')} placed</span></div>
        <label class="mort-in"><span class="mort-in-lbl">${mortMode==='day'?'Dead':'Total dead'}</span>
          <input class="mort-input" type="number" min="0" step="1" inputmode="numeric" enterkeyhint="next" data-mort-shed="${shed.id}" value="${escapeAttr(String(val))}" placeholder="0" ${st.inBatch?'':'disabled'} aria-label="Shed ${shed.id}: ${mortMode==='day'?'birds dead on '+fmtShortNoYear(mortDate):'total dead this batch'}" title="${mortMode==='day'?'Birds found dead or culled in this shed on this day':'Total birds dead in this shed so far this batch'}">
          <span class="mort-hint">${escapeHtml(hint)}</span></label>
        <div class="mort-out" data-mort-out="${shed.id}">${mortRowOut(shed,st)}</div>
      </div>`;
    }).join('');
    return `<section class="mort-pair" style="--pc:var(--pair${g})"><div class="mort-pair-head"><span class="mort-pair-bar"></span><b>${escapeHtml(pairLabel(g))}</b></div>${rows}</section>`;
  }).join('');
  const isToday=mortDate.getTime()===today.getTime();
  body.innerHTML=`<div class="mort-top">
      <div class="mort-date"><button type="button" class="mort-step" data-mort-day="-1" title="Day before" aria-label="Day before">‹</button>
        <input type="date" id="mortDateInput" value="${k}" max="${iso(today)}" ${firstPlaced?`min="${iso(firstPlaced)}"`:''} title="Day the birds died" aria-label="Day the birds died">
        <button type="button" class="mort-step" data-mort-day="1" ${isToday?'disabled':''} title="Next day" aria-label="Next day">›</button>
        ${isToday?'<span class="mort-today">Today</span>':`<button type="button" class="mort-today-btn" data-mort-today title="Back to today">Today</button>`}</div>
      <span class="mort-seg" role="group" aria-label="How to enter">
        <button type="button" class="${mortMode==='day'?'on':''}" data-mort-mode="day" aria-pressed="${mortMode==='day'}" title="Type the birds that died on this day; they are added to each shed's total">Dead that day</button>
        <button type="button" class="${mortMode==='total'?'on':''}" data-mort-mode="total" aria-pressed="${mortMode==='total'}" title="Type each shed's total dead so far this batch">Running total</button>
      </span>
    </div>
    <div class="mort-pairs">${pairs}</div>
    <div class="mort-foot">
      <div class="mort-sum">${mortMode==='day'?`<span><b>${dayDead.toLocaleString('en-US')}</b> dead ${isToday?'today':'on '+escapeHtml(fmtShortNoYear(mortDate))}</span>`:''}<span>Farm <b>${farmTotal.toLocaleString('en-US')}</b> · ${mortPct(farmTotal,farmPlaced)}</span></div>
      <button type="button" class="mort-save" id="mortSaveBtn" ${pending&&!bad?'':'disabled'} title="${bad?'Fix the red boxes first':pending?'Save every shed you changed':'Nothing changed yet'}">${pending?`Save ${pending} shed${pending===1?'':'s'}`:'Saved'}</button>
    </div>`;
  body.scrollTop=keep;
}
function mortRefreshRow(id){
  const shed=(farmData.sheds||[]).find(s=>String(s.id)===String(id));if(!shed)return;
  const st=mortShedState(shed);
  const out=document.querySelector(`[data-mort-out="${id}"]`);if(out)out.innerHTML=mortRowOut(shed,st);
  const row=document.querySelector(`[data-mort-row="${id}"]`);if(row)row.classList.toggle('is-bad',!!mortResult(shed,st,mortDraft[id]).bad);
  // footer totals
  let dayDead=0,farmTotal=0,farmPlaced=0,pending=0,bad=0;
  (farmData.sheds||[]).forEach(s=>{const t=mortShedState(s);const r=mortResult(s,t,mortDraft[s.id]);farmPlaced+=t.placedN;if(r.bad){bad++;return;}if(r.changed)pending++;farmTotal+=r.newTotal;if(mortMode==='day'){const v=r.n!=null?r.n:t.saved;if(v)dayDead+=v;}});
  const isToday=mortDate.getTime()===dateOnly(new Date()).getTime();
  const sum=document.querySelector('#mortBody .mort-sum');
  if(sum)sum.innerHTML=`${mortMode==='day'?`<span><b>${dayDead.toLocaleString('en-US')}</b> dead ${isToday?'today':'on '+escapeHtml(fmtShortNoYear(mortDate))}</span>`:''}<span>Farm <b>${farmTotal.toLocaleString('en-US')}</b> · ${mortPct(farmTotal,farmPlaced)}</span>`;
  const btn=document.getElementById('mortSaveBtn');
  if(btn){btn.disabled=!(pending&&!bad);btn.textContent=pending?`Save ${pending} shed${pending===1?'':'s'}`:'Saved';btn.title=bad?'Fix the red boxes first':pending?'Save every shed you changed':'Nothing changed yet';}
}
function saveMortality(){
  if(!farmData)return;
  let n=0;const k=iso(mortDate);
  for(const shed of farmData.sheds||[]){
    const st=mortShedState(shed);if(!st.inBatch)continue;
    const r=mortResult(shed,st,mortDraft[shed.id]);
    if(r.bad){showToast(`Shed ${shed.id}: ${r.bad.toLowerCase()}.`,true);return;}
    if(!r.changed)continue;
    if(mortMode==='day'){const log=normMortLog(shed.mortLog);log[k]=r.n;shed.mortLog=log;}
    shed.mortality=r.newTotal;
    const prev=shed.mortalityUpdatedAt?dateOnly(shed.mortalityUpdatedAt):null;
    shed.mortalityUpdatedAt=mortMode==='total'||!prev||mortDate>prev?mortDate:prev;
    n++;
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
  const md=e.target.closest('[data-mort-mode]');
  if(md){if(md.dataset.mortMode!==mortMode){mortMode=md.dataset.mortMode;mortDraft={};try{localStorage.setItem('pw-mort-mode',mortMode);}catch(err){}renderMortBody();}return;}
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
