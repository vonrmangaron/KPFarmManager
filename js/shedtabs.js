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

// ── Growth: a status line, a small chart (this shed vs the standard), the in-yard weights for
// day 7–28 (still typed here), extra readings, and the daily table opening in place.
const growthDaily={};   // per pair: {open, shed}
function growthChartSvg(shed){
  const today=dateOnly(new Date());if(!shed.placementDate)return '';
  const place=dateOnly(shed.placementDate),ageNow=ageInDays(shed,today);
  const end=Math.max(ageNow,shed.cleanoutDate?ageInDays(shed,dateOnly(shed.cleanoutDate)):ageNow+7,14);
  const W=320,H=130,L=30,R=8,T=8,B=20;
  const std=[],own=[];let top=0;
  for(let d=0;d<=end;d++){const s=stdWeightKg(d);std.push(s);let k=null;try{const f=forecastWeightModeAware(shed,addDays(place,d));k=f&&f.kg!=null?f.kg:null;}catch(e){}own.push(k);top=Math.max(top,s||0,k||0);}
  top=Math.ceil(top*1.08*2)/2||1;
  const x=d=>L+(W-L-R)*d/end,y=k=>T+(H-T-B)*(1-k/top);
  const path=(arr,from,to)=>{let p='';for(let d=from;d<=to;d++){if(arr[d]==null)continue;p+=(p?'L':'M')+x(d).toFixed(1)+','+y(arr[d]).toFixed(1);}return p;};
  const pts=[];
  TARGET_DAYS.forEach(d=>{const v=Number(shed.targetCurve&&shed.targetCurve[d]);if(v>0)pts.push({d,k:v*shedBiasFactor(shed),c:'#0F8A75'});});
  (shed.pickups||[]).forEach(p=>{const a=pickupAvgKg(p);if(a&&!p.weightEstimated)pts.push({d:pickupAge(shed,p),k:a,c:'#2F6BD8'});});
  const ticks=[0,top/2,top].map(v=>`<line x1="${L}" x2="${W-R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="var(--line)"/><text x="${L-4}" y="${(y(v)+3).toFixed(1)}" text-anchor="end" font-size="9" fill="var(--muted)">${v.toFixed(v>=10?0:1)}</text>`).join('');
  const xt=[0,Math.round(end/2),end].map(d=>`<text x="${x(d).toFixed(1)}" y="${H-6}" text-anchor="middle" font-size="9" fill="var(--muted)">d${d}</text>`).join('');
  return `<svg class="gr2-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Shed ${shed.id} weight against ${escapeAttr(stdName())}">${ticks}${xt}
    <path d="${path(std,0,end)}" fill="none" stroke="var(--muted)" stroke-width="1.6" stroke-dasharray="4 4"/>
    <path d="${path(own,0,Math.min(ageNow,end))}" fill="none" stroke="var(--primary)" stroke-width="2.6"/>
    <path d="${path(own,Math.min(ageNow,end),end)}" fill="none" stroke="var(--primary)" stroke-width="2" stroke-dasharray="2 3" opacity=".8"/>
    ${pts.map(p=>`<circle cx="${x(p.d).toFixed(1)}" cy="${y(p.k).toFixed(1)}" r="3.4" fill="${p.c}"/>`).join('')}
    ${ageNow<=end&&own[ageNow]!=null?`<circle cx="${x(ageNow).toFixed(1)}" cy="${y(own[ageNow]).toFixed(1)}" r="4.5" fill="var(--primary)" stroke="var(--surface)" stroke-width="1.5"/>`:''}
  </svg><div class="gr2-key"><span><i style="background:var(--primary)"></i>This shed</span><span><i class="dash"></i>${escapeHtml(stdName())}</span><span><i style="background:#0F8A75;border-radius:50%"></i>In-yard</span><span><i style="background:#2F6BD8;border-radius:50%"></i>Kill sheet</span></div>`;
}
function growthTabCardHtml(shed,g){
  const today=dateOnly(new Date());
  const head=`<div class="pk2-head"><b>Shed ${shed.id}</b>${shed.closed?'<span class="cs-chip">Closed</span>':pairGrowthChip(shed,today)}</div>`;
  if(!shed.placementDate)return `<article class="pred-shed-card gr2-card" id="pred-shed-card-${shed.id}">${head}<p class="pk2-empty">Not placed yet.</p></article>`;
  const age=ageInDays(shed,today);
  let now=null;try{const f=forecastWeightModeAware(shed,today);now=f&&f.kg!=null?f.kg:null;}catch(e){}
  let out=null;if(shed.cleanoutDate){try{const f=forecastWeightModeAware(shed,dateOnly(shed.cleanoutDate));out=f&&f.kg!=null?f.kg:null;}catch(e){}}
  const status=`<div class="gr2-stat"><b>${now!=null?now.toFixed(2)+' kg':'—'}</b><span>at day ${age} · standard ${stdWeightKg(age).toFixed(2)} kg${out!=null?`<br>Clean-out weight about <strong>${out.toFixed(2)} kg</strong> on ${escapeHtml(fmtShortNoYear(shed.cleanoutDate))}`:''}</span></div>`;
  const tc=shed.targetCurve||{},bias=shedBiasFactor(shed);
  const boxes=TARGET_DAYS.map(d=>{
    // the standard on the shed scale (plant weight ÷ the scale correction), so the numbers line up
    const v=Number(tc[d]),filled=v>0,sd=stdWeightKg(d)/bias;
    const dv=filled?daysVsTarget(d,v*bias):null;
    const chip=dv==null?'':`<span class="pair-chip ${daysBehindSeverity(dv)}">${Math.abs(dv)<0.5?'on std':(dv>0?'+':'−')+Math.abs(dv).toFixed(1)+' d'}</span>`;
    const due=!filled&&age>=d;
    return `<label class="gr2-day${filled?' filled':''}${due?' due':''}"><span class="gr2-dh">Day ${d}</span><span class="gr2-in"><input type="number" step="0.001" min="0" inputmode="decimal" placeholder="${sd.toFixed(3)}" value="${filled?v.toFixed(3):''}" data-target-shed="${shed.id}" data-target-day="${d}" aria-label="Shed ${shed.id} in-yard weight day ${d}" title="Shed-scale weight on day ${d}"><u>kg</u></span><span class="gr2-std">std ${sd.toFixed(2)} ${chip}</span></label>`;}).join('');
  const samples=shed.inYardSamples||[];
  const extra=samples.length?`<div class="gr2-extra">${samples.map((x,i)=>`<span class="gr2-x"><b>Day ${sampleAge(shed,x)}</b> ${x.avgWeightKg.toFixed(3)} kg${x.isOfficial?' <em>plant</em>':''}<button type="button" data-sample-edit="${shed.id}|${i}" title="Edit this reading" aria-label="Edit">✎</button><button type="button" data-sample-delete="${shed.id}|${i}" title="Delete this reading" aria-label="Delete">✕</button></span>`).join('')}</div>`:'';
  const open=growthDaily[g]&&growthDaily[g].open&&String(growthDaily[g].shed)===String(shed.id);
  return `<article class="pred-shed-card gr2-card" id="pred-shed-card-${shed.id}">${head}${status}${growthChartSvg(shed)}
    <div class="gr2-iyh"><span class="mgr-k">In-yard weights · day 7–28</span><button type="button" class="mgr-link" data-sample-add="${shed.id}" title="Add a reading for a day other than 7, 14, 21 or 28">+ Extra reading day</button></div>
    <div class="gr2-days">${boxes}</div>${extra}
    <p class="gr2-note">Shed-scale readings. "std" is the standard on the shed scale (×${Math.round(bias*100)}% gives plant weight).</p>
    <button type="button" class="fs2-more" data-gd-open="${g}|${shed.id}">${open?'Hide daily table':'Daily table ›'}</button>
  </article>`;
}
function growthDailyHtml(g,sheds){
  const st=growthDaily[g];if(!st||!st.open)return '';
  const shed=sheds.find(s=>String(s.id)===String(st.shed))||sheds[0];if(!shed)return '';
  return `<section class="planner-card gr2-daily" id="gr2Daily-${g}"><div class="gr2-dhead"><span class="mgr-k">Daily table</span>
      <span class="gr2-seg">${sheds.map(s=>`<button type="button" class="${s.id===shed.id?'on':''}" data-gd-shed="${g}|${s.id}">Shed ${s.id}</button>`).join('')}</span>
      <button type="button" class="gr2-close" data-gd-close="${g}" aria-label="Close the daily table" title="Close">✕</button></div>
    ${forecastDayBarHtml()}${renderDailyPerformance(shed)}</section>`;
}
document.addEventListener('click',e=>{
  const o=e.target.closest('[data-gd-open]');
  if(o){const [g,id]=o.dataset.gdOpen.split('|');const st=growthDaily[g];const same=st&&st.open&&String(st.shed)===id;growthDaily[g]={open:!same,shed:id};render();
    if(!same)requestAnimationFrame(()=>document.getElementById('gr2Daily-'+g)?.scrollIntoView({block:'start',behavior:'smooth'}));return;}
  const s=e.target.closest('[data-gd-shed]');if(s){const [g,id]=s.dataset.gdShed.split('|');growthDaily[g]={open:true,shed:id};render();return;}
  const c=e.target.closest('[data-gd-close]');if(c){const g=c.dataset.gdClose;if(growthDaily[g])growthDaily[g].open=false;render();}
});

// ── Setup: both sheds in one table; changes wait for Apply (like Settings) ──
const setupDraft={};   // per pair: {"shedId|field": value}
function suVal(g,shed,field,cur){const d=setupDraft[g];const k=shed.id+'|'+field;return d&&k in d?d[k]:cur;}
function suChanges(g){
  const d=setupDraft[g];if(!d)return [];
  const out=[];Object.keys(d).forEach(k=>{const [id,f]=k.split('|');const s=farmData.sheds.find(x=>String(x.id)===id);if(!s)return;
    const cur=suCurrent(s,f);if(String(d[k])!==String(cur))out.push({id,f,v:d[k]});});
  return out;
}
function suCurrent(s,f){
  if(f==='placementDate')return s.placementDate?iso(s.placementDate):'';
  if(f==='cleanoutDate')return s.cleanoutDate?iso(s.cleanoutDate):'';
  if(f==='initialPopulation')return String(s.initialPopulation||0);
  if(f==='chickWeightGrams')return String(Math.round(shedChickWeight(s)*10000)/10);
  if(f==='feedAdjustPct')return s.feedAdjustPct!=null?String(s.feedAdjustPct):'';
  if(f==='mort')return shedMortRate(s).toFixed(2);
  return '';
}
const SU_LABEL={placementDate:'placement',initialPopulation:'birds placed',cleanoutDate:'clean-out',mort:'daily morts',chickWeightGrams:'chick weight',feedAdjustPct:'feed intake'};
function setupTabHtml(g,sheds){
  if(!sheds.length)return '<div class="empty-card">No sheds in this pair.</div>';
  const cell=(s,f,html)=>`<td>${html}</td>`;
  const row=(label,hint,fn)=>`<tr><th scope="row">${label}${hint?`<small>${hint}</small>`:''}</th>${sheds.map(s=>`<td data-label="Shed ${s.id}">${fn(s)}</td>`).join('')}</tr>`;
  const v=(s,f)=>escapeAttr(suVal(g,s,f,suCurrent(s,f)));
  const rows=row('Placement date','',s=>`<input type="date" value="${v(s,'placementDate')}" data-su="${g}|${s.id}|placementDate" aria-label="Shed ${s.id} placement date">`)
    +row('Birds placed','',s=>`<input type="number" min="0" step="1" inputmode="numeric" value="${v(s,'initialPopulation')}" data-su="${g}|${s.id}|initialPopulation" aria-label="Shed ${s.id} birds placed">`)
    +row('Clean-out date','',s=>`<input type="date" value="${v(s,'cleanoutDate')}" data-su="${g}|${s.id}|cleanoutDate" aria-label="Shed ${s.id} clean-out date"${finalPickupOf(s)?' title="Set from the final pickup"':''}>`)
    +row('Daily morts',`normal ${DEFAULT_MORT_RATE_PCT.toFixed(2)}%`,s=>{const m=Number(suVal(g,s,'mort',suCurrent(s,'mort')));
      return `<div class="su-mort"><input type="range" min="0" max="1" step="0.01" value="${Math.min(1,m)}" data-su="${g}|${s.id}|mort" data-su-range aria-label="Shed ${s.id} daily morts"><input type="number" min="0" max="${MAX_MORT_RATE_PCT}" step="0.01" value="${m.toFixed(2)}" data-su="${g}|${s.id}|mort" aria-label="Shed ${s.id} daily morts, % per day"><span>% / day</span></div>`;});
  const more=row('Chick weight','grams',s=>`<input type="number" min="30" max="80" step="0.1" value="${v(s,'chickWeightGrams')}" data-su="${g}|${s.id}|chickWeightGrams" aria-label="Shed ${s.id} chick weight in grams">`)
    +row('Feed intake','% of Ross · empty = 100',s=>`<input type="number" min="50" max="150" step="1" value="${v(s,'feedAdjustPct')}" placeholder="100" data-su="${g}|${s.id}|feedAdjustPct" aria-label="Shed ${s.id} feed intake, % of Ross">`);
  const ch=suChanges(g);
  return `<section class="planner-card su-card">
    <div class="su-scroll"><table class="su-tbl"><thead><tr><th></th>${sheds.map(s=>`<th scope="col">Shed ${s.id}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>
    <details class="su-more"${ch.some(c=>c.f==='chickWeightGrams'||c.f==='feedAdjustPct')?' open':''}><summary>Chick weight and feed intake</summary><div class="su-scroll"><table class="su-tbl"><tbody>${more}</tbody></table></div></details>
    <div class="su-apply"><span>${ch.length?`<b>${ch.length} change${ch.length===1?'':'s'} not applied</b> · ${escapeHtml(ch.map(c=>`Shed ${c.id} ${SU_LABEL[c.f]||c.f}`).join(', '))}`:'No changes'}</span><button type="button" class="mgr-btn" data-su-discard="${g}" ${ch.length?'':'disabled'}>Discard</button><button type="button" class="mgr-btn primary" data-su-apply="${g}" ${ch.length?'':'disabled'}>Apply</button></div>
  </section>`;
}
function suRefreshBar(g){const card=document.querySelector('.su-card');if(!card)return;const ch=suChanges(g);const bar=card.querySelector('.su-apply');if(!bar)return;
  bar.querySelector('span').innerHTML=ch.length?`<b>${ch.length} change${ch.length===1?'':'s'} not applied</b> · ${escapeHtml(ch.map(c=>`Shed ${c.id} ${SU_LABEL[c.f]||c.f}`).join(', '))}`:'No changes';
  bar.querySelectorAll('button').forEach(b=>b.disabled=!ch.length);}
function suApply(g){
  const ch=suChanges(g);if(!ch.length)return;
  // placement first (it moves an automatic clean-out), then the rest, then a typed clean-out
  const order=['placementDate','initialPopulation','chickWeightGrams','feedAdjustPct','cleanoutDate','mort'];
  ch.sort((a,b)=>order.indexOf(a.f)-order.indexOf(b.f)).forEach(c=>{
    const idx=Number(c.id)-1;
    if(c.f==='mort')setShedMortRate(Number(c.id),Math.min(MAX_MORT_RATE_PCT,Math.max(0,Number(c.v)||0)));
    else updateShedField(idx,c.f,c.v);
  });
  delete setupDraft[g];saveState();schedulePush();render();
  showToast(`${ch.length} change${ch.length===1?'':'s'} applied — forecast updated.`);
}
document.addEventListener('input',e=>{
  const t=e.target.closest&&e.target.closest('[data-su]');if(!t)return;
  const [g,id,f]=t.dataset.su.split('|');(setupDraft[g]||(setupDraft[g]={}))[id+'|'+f]=f==='mort'?Number(t.value).toFixed(2):t.value;
  if(f==='mort'){document.querySelectorAll(`[data-su="${g}|${id}|mort"]`).forEach(x=>{if(x!==t)x.value=x.type==='range'?Math.min(1,Number(t.value)):Number(t.value).toFixed(2);});}
  suRefreshBar(g);
});
document.addEventListener('change',e=>{const t=e.target.closest&&e.target.closest('[data-su]');if(t)e.stopPropagation();},true);
document.addEventListener('click',e=>{
  const a=e.target.closest('[data-su-apply]');if(a){suApply(a.dataset.suApply);return;}
  const d=e.target.closest('[data-su-discard]');if(d){delete setupDraft[d.dataset.suDiscard];render();showToast('Changes discarded.');return;}
});
// Leaving Setup with changes not applied: ask first
document.addEventListener('click',e=>{
  const open=Object.keys(setupDraft).filter(g=>suChanges(g).length);if(!open.length)return;
  if(e.target.closest('.su-card'))return;
  const nav=e.target.closest('[data-shedview],[data-tab],[data-pw-panel],[data-pwm]:not([data-pwm="theme"]),.mob-nav-btn,.sb-link,.more-row,[data-goto-shedgroup],[data-predgroup]');
  if(!nav)return;
  if(confirm('You have Setup changes that aren\'t applied yet.\n\nOK = discard them and leave. Cancel = stay and Apply.')){open.forEach(g=>delete setupDraft[g]);}
  else{e.stopPropagation();e.preventDefault();}
},true);
window.addEventListener('beforeunload',e=>{if(Object.keys(setupDraft).some(g=>suChanges(g).length)){e.preventDefault();e.returnValue='';}});
