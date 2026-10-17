// ── Shed pages, calmer tabs (2026-10-17 redesign) ──
// Pickups: one timeline per shed (done ✓, planned 1·2·3, final ★), two buttons, the plan settings
// one tap away. Every action from the old tab is still here (edit, delete, select several,
// auto-fill, add, clear, target pickups, density rules).

function pk2Chip(shed){
  const real=shed.pickups||[],realDates=new Set(real.map(p=>iso(p.date)));
  const planned=(shed.predictedPickups||[]).filter(pp=>pp.date&&!realDates.has(iso(pp.date)));
  if(real.some(p=>p.isFinal))return `<span class="pair-chip ok">Done · ${real.length} pickup${real.length===1?'':'s'}</span>`;
  const target=getShedDensitySettings(shed).targetPickups,total=real.length+planned.length;
  if(planned.some(p=>p.isFinal)||real.some(p=>p.isFinal))return total>=target?`<span class="pair-chip ok">Plan complete · ${total} of ${target}</span>`:`<span class="pair-chip warn">${total} of ${target} · final booked</span>`;
  if(!total)return `<span class="pair-chip warn">No plan yet</span>`;
  return `<span class="pair-chip warn">${Math.max(0,target-total)} more to plan</span>`;
}
function pickupsTabCardHtml(shed,g){
  const today=dateOnly(new Date());
  const real=(shed.pickups||[]).slice().sort((a,b)=>dateOnly(a.date)-dateOnly(b.date));
  const realDates=new Set(real.map(p=>iso(p.date)));
  const planned=(shed.predictedPickups||[]).filter(pp=>pp.date&&!realDates.has(iso(pp.date))).sort((a,b)=>dateOnly(a.date)-dateOnly(b.date));
  const items=real.map(p=>({kind:'real',p,date:dateOnly(p.date)})).concat(planned.map(pp=>({kind:'plan',pp,date:dateOnly(pp.date)}))).sort((a,b)=>a.date-b.date);
  const bulkPk=bulkActive('pk:'+shed.id),bulkPp=bulkActive('pp:'+shed.id);
  let n=0;
  const rows=items.map(it=>{
    n++;
    const day=shed.placementDate?ageInDays(shed,it.date):null;
    const when=`${escapeHtml(fmtShortNoYear(it.date))}${day!=null?` · day ${it.kind==='real'?pickupAge(shed,it.p):day}`:''}`;
    if(it.kind==='real'){
      const p=it.p,id=`${shed.id}|${iso(p.date)}`,avg=pickupAvgKg(p);
      const sub=p.isFinal?'Final · clean-out':p.weightEstimated?`Weight to come${avg?` (est ${avg.toFixed(2)} kg)`:''}`:avg?`Kill sheet ${avg.toFixed(2)} kg`:'No weight yet';
      const mk=p.isFinal?'<span class="pk2-mk fin" aria-label="Final pickup">★</span>':'<span class="pk2-mk done" aria-label="Done">✓</span>';
      const cb=bulkPk?bulkCheckbox('pk:'+shed.id,iso(p.date),'pickup '+fmtShortNoYear(p.date)):'';
      return `<div class="pk2-row${p.weightEstimated&&it.date<=today?' needs':''}">${cb}${mk}<span class="pk2-w" data-pickup-edit="${id}" title="Edit this pickup"><b>${when}</b><span>${escapeHtml(sub)}</span></span><span class="pk2-n">${(Number(p.birds)||0).toLocaleString('en-US')}${p.isFinal?'<small>all left</small>':''}</span><span class="pk2-acts"><button type="button" class="pk2-ic" data-pickup-edit="${id}" title="Edit this pickup" aria-label="Edit pickup">✎</button><button type="button" class="pk2-ic del" data-pickup-delete="${id}" title="Delete this pickup" aria-label="Delete pickup">✕</button></span></div>`;
    }
    const pp=it.pp,id=`${shed.id}|${pp.id}`;
    const cb=bulkPp?bulkCheckbox('pp:'+shed.id,String(pp.id),'planned pickup '+fmtShortNoYear(pp.date)):'';
    const mk=pp.isFinal?'<span class="pk2-mk fin plan" aria-label="Final, planned">★</span>':`<span class="pk2-mk plan" aria-label="Planned">${n}</span>`;
    return `<div class="pk2-row plan">${cb}${mk}<span class="pk2-w" data-pp-edit="${id}" title="Edit this planned pickup"><b>${when}</b><span>${pp.isFinal?'Final · clean-out (planned)':'Planned'}</span></span><span class="pk2-n">${(Number(pp.birds)||0).toLocaleString('en-US')}${pp.isFinal?'<small>all left</small>':''}</span><span class="pk2-acts"><button type="button" class="pk2-ic" data-pp-edit="${id}" title="Edit this planned pickup" aria-label="Edit planned pickup">✎</button><button type="button" class="pk2-ic del" data-pp-delete="${id}" title="Remove this planned pickup" aria-label="Remove planned pickup">✕</button></span></div>`;
  }).join('');
  const hasFinal=real.some(p=>p.isFinal);
  const canAdd=real.length<MAX_PICKUPS_PER_SHED;
  const ds=getShedDensitySettings(shed),useGlobal=ds.useGlobal!==false,targetN=ds.targetPickups;
  const targetInputHtml=`<div class="pp-target-row"><span class="pp-target-label">Target pickups for this shed</span><input type="number" class="pp-target-input" min="${MIN_PICKUPS_PER_SHED}" max="${MAX_PICKUPS_PER_SHED}" step="1" value="${targetN}" data-shed-target-pickups="${shed.id}" title="Total pickups including the final cleanout" /><span class="pp-target-hint">${MIN_PICKUPS_PER_SHED} to ${MAX_PICKUPS_PER_SHED}, including the final clean-out</span></div>`;
  const densityHtml=`<div class="shed-density-override"><label><input type="checkbox" data-density-use-global="${shed.id}" ${useGlobal?'checked':''} /> Use the farm's density rules</label>${!useGlobal?`<span class="ovr-inputs"><span>Trigger</span><input type="number" min="20" max="45" step="0.5" value="${ds.triggerDensity}" data-density-override="${shed.id}|triggerDensity" /><span>Target</span><input type="number" min="15" max="35" step="0.5" value="${ds.targetDensity}" data-density-override="${shed.id}|targetDensity" /><span>Max</span><input type="number" min="28" max="45" step="0.5" value="${ds.maxDensity}" data-density-override="${shed.id}|maxDensity" /></span>`:''}</div>`;
  const bulkBar=bulkPk?bulkToolbar('pk:'+shed.id,real.map(p=>iso(p.date)),'logged'):bulkPp?bulkToolbar('pp:'+shed.id,planned.map(x=>String(x.id)),'planned'):'';
  const live=shed.placementDate?Math.max(0,liveAtStartOfDay(shed,today)):0;
  return `<article class="pred-shed-card pk2-card" id="pred-shed-card-${shed.id}">
    <div class="pk2-head"><b>Shed ${shed.id}</b>${pk2Chip(shed)}</div>
    ${bulkBar?`<div class="pk2-bulk">${bulkBar}</div>`:''}
    ${items.length?`<div class="pk2-tl">${rows}</div>`:`<p class="pk2-empty">No pickups yet.${hasFinal?'':' Auto-fill plans them from your density rules.'}</p>`}
    <div class="pk2-foot"><span class="pk2-live">${live.toLocaleString('en-US')} birds in the shed now</span></div>
    <div class="pk2-btns">
      <button type="button" class="mgr-btn primary" data-pickup-add="${shed.id}" ${canAdd?'':'disabled'} title="${canAdd?'Log a pickup from the kill sheet':`Maximum ${MAX_PICKUPS_PER_SHED} pickups reached`}">Log a pickup</button>
      ${hasFinal?'':`<details class="pk2-menu"><summary class="mgr-btn">Re-plan ▾</summary><div class="pk2-menu-list">
        <button type="button" data-pp-autofill="${shed.id}" title="Plan the rest of the pickups from the density rules">Auto-fill the plan</button>
        <button type="button" data-pp-add="${shed.id}">Add a planned pickup</button>
        ${planned.length?`<button type="button" data-pp-clear="${shed.id}">Clear planned pickups</button>`:''}
        ${planned.length?`<button type="button" data-bulk-start="pp:${shed.id}">Select planned pickups…</button>`:''}
        ${real.length?`<button type="button" data-bulk-start="pk:${shed.id}">Select logged pickups…</button>`:''}
      </div></details>`}
    </div>
    <details class="pk2-settings"><summary>Plan settings</summary>${targetInputHtml}${densityHtml}</details>
  </article>`;
}
// The menu closes after a choice
document.addEventListener('click',e=>{const m=e.target.closest('.pk2-menu-list button');if(m){const d=m.closest('details');if(d)d.open=false;}},true);
