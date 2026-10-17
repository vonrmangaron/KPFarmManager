// ── Set up sheds: every shed on one page (2026-10-18, mockup W6Mc6gUctANk3MGnAg1taF) ─────────
// Placement, birds placed, DOC weight and clean-out for all sheds in one table (cards on a phone).
// Clean-out follows placement + DEFAULT_CLEANOUT_DAYS ("auto") until a date is typed; clearing it
// goes back to auto (same rule as updateShedField). It uses the Setup tab's draft and Apply
// (setupDraft.all, suApply('all')), so changes wait for Apply and leaving with changes asks first.
// Daily morts and feed intake stay on each pair's Setup tab.
const SS_G='all';
let ssFill={first:'',birds:'',doc:'',stagger:'0'};
function ssDraftHas(s,f){const d=setupDraft[SS_G];return !!d&&(s.id+'|'+f) in d;}
// What a shed will look like once the draft is applied
function ssState(s){
  const place=suVal(SS_G,s,'placementDate',suCurrent(s,'placementDate'));
  const birds=suVal(SS_G,s,'initialPopulation',suCurrent(s,'initialPopulation'));
  const doc=suVal(SS_G,s,'chickWeightGrams',suCurrent(s,'chickWeightGrams'));
  const fp=finalPickupOf(s);
  const typed=ssDraftHas(s,'cleanoutDate')?setupDraft[SS_G][s.id+'|cleanoutDate']:null;
  let co='',mode='auto';
  if(fp){co=iso(fp.date);mode='final';}
  else if(typed){co=typed;mode='typed';}
  else if(typed===''||!s.cleanoutDate||s.cleanoutAuto){co=place?iso(addDays(parseExcelDate(place),DEFAULT_CLEANOUT_DAYS)):'';mode='auto';}
  else{co=iso(s.cleanoutDate);mode='typed';}
  return {place,birds:Number(birds)||0,doc,co,mode,ready:!!place&&Number(birds)>0};
}
function ssFmt(isoStr){return isoStr?fmtShortNoYear(parseExcelDate(isoStr)):'—';}
function ssTotals(){
  const st=farmData.sheds.map(ssState),ok=st.filter(x=>x.ready);
  const places=st.map(x=>x.place).filter(Boolean).sort(),cos=st.map(x=>x.co).filter(Boolean).sort();
  const docs=st.filter(x=>x.place).map(x=>Number(x.doc)).filter(n=>n>0);
  return {n:st.length,ready:ok.length,missing:st.length-ok.length,birds:st.reduce((a,x)=>a+x.birds,0),
    place:places.length?(places[0]===places[places.length-1]?ssFmt(places[0]):`${ssFmt(places[0])} → ${ssFmt(places[places.length-1])}`):'—',
    co:cos.length?(cos[0]===cos[cos.length-1]?ssFmt(cos[0]):`${ssFmt(cos[0])} → ${ssFmt(cos[cos.length-1])}`):'—',
    doc:docs.length?(docs.reduce((a,b)=>a+b,0)/docs.length).toFixed(1)+' g':'—'};
}
function ssCoCell(s,x){
  const tag=x.mode==='final'?'<span class="ss-tag fin">final pickup</span>':x.mode==='auto'?`<span class="ss-tag auto">auto</span>`:`<button type="button" class="ss-tag typed" data-ss-auto="${s.id}" title="Typed by you. Click to go back to automatic: placement + ${DEFAULT_CLEANOUT_DAYS} days">typed ↺</button>`;
  return `<div class="ss-co ${x.mode}"><input type="date" value="${escapeAttr(x.co)}" data-su="${SS_G}|${s.id}|cleanoutDate" aria-label="Shed ${s.id} clean-out date"${x.mode==='final'?' disabled title="Set from the final pickup"':''}>${tag}</div>`;
}
function ssStatus(x){return x.ready?'<span class="ss-st ok">✓ Ready</span>':`<span class="ss-st miss">${x.place?'Needs birds':'Needs placement'}</span>`;}
function ssChipsHtml(t){return `<span class="ss-chip ok">✓ ${t.ready} shed${t.ready===1?'':'s'} ready</span>${t.missing?`<span class="ss-chip wait">${t.missing} need${t.missing===1?'s':''} setting up</span>`:''}<span class="ss-chip">Clean-out auto: placement + ${DEFAULT_CLEANOUT_DAYS} days</span>`;}
function ssFootHtml(t){return `<td>${t.ready} of ${t.n}</td><td data-label="Placement">${escapeHtml(t.place)}</td><td data-label="Birds">${t.birds.toLocaleString('en-US')}</td><td data-label="DOC weight">${t.doc==='—'?'—':'avg '+t.doc}</td><td data-label="Clean-out">${escapeHtml(t.co)}</td><td></td>`;}
function renderShedSetupPage(){
  if(!farmData||!farmData.sheds.length)return '<div class="empty-card">No sheds yet.</div>';
  const t=ssTotals();
  const rows=farmData.sheds.map((s,i)=>{const x=ssState(s);const ch=f=>ssDraftHas(s,f)&&String(setupDraft[SS_G][s.id+'|'+f])!==String(suCurrent(s,f))?' changed':'';
    return `<tr data-ss-row="${s.id}"><td class="ss-sh"><b>Shed ${s.id}</b><small>${escapeHtml(pairLabel(Math.floor(i/2)+1))}</small></td>
      <td data-label="Placement"><input type="date" class="${ch('placementDate')}" value="${escapeAttr(x.place)}" data-su="${SS_G}|${s.id}|placementDate" aria-label="Shed ${s.id} placement date"></td>
      <td data-label="Birds placed"><input type="number" min="0" step="1" inputmode="numeric" class="${ch('initialPopulation')}" value="${x.birds||''}" placeholder="0" data-su="${SS_G}|${s.id}|initialPopulation" aria-label="Shed ${s.id} birds placed"></td>
      <td data-label="DOC weight"><span class="ss-unit"><input type="number" min="30" max="80" step="0.1" inputmode="decimal" class="${ch('chickWeightGrams')}" value="${escapeAttr(x.doc)}" data-su="${SS_G}|${s.id}|chickWeightGrams" aria-label="Shed ${s.id} DOC weight in grams"><span>g</span></span></td>
      <td data-label="Clean-out">${ssCoCell(s,x)}</td>
      <td class="ss-stc">${ssStatus(x)}</td></tr>`;}).join('');
  const ch=suChanges(SS_G);
  // Done sits outside .su-card, so leaving with changes not applied asks first (the Setup tab's guard)
  return `<div class="ss-page">
    <div class="ss-top"><div class="ss-chips">${ssChipsHtml(t)}</div><button type="button" class="mgr-btn" data-tab="home">Done</button></div>
    <div class="su-card">
    <section class="ss-fill" aria-label="Fill quickly">
      <span class="ss-k">Fill quickly</span>
      <label class="ss-f">First placement<input type="date" value="${escapeAttr(ssFill.first)}" data-ss-fillf="first"></label>
      <label class="ss-f">Birds per shed<input type="number" min="0" step="1" inputmode="numeric" placeholder="e.g. 52000" value="${escapeAttr(ssFill.birds)}" data-ss-fillf="birds"></label>
      <label class="ss-f">DOC weight (g)<input type="number" min="30" max="80" step="0.1" inputmode="decimal" placeholder="e.g. 42" value="${escapeAttr(ssFill.doc)}" data-ss-fillf="doc"></label>
      <label class="ss-f">Stagger<select data-ss-fillf="stagger">${[['0','Same day'],['1','Each pair +1 day'],['2','Each pair +2 days'],['3','Each pair +3 days']].map(([v,l])=>`<option value="${v}"${ssFill.stagger===v?' selected':''}>${l}</option>`).join('')}</select></label>
      <span class="ss-fbtns"><button type="button" class="mgr-btn primary" data-ss-fill="empty" title="Only sheds that are still empty; nothing you typed is changed">Fill empty sheds</button><button type="button" class="mgr-btn" data-ss-fill="all" title="Every shed, replacing what's there (still waits for Apply)">Fill all</button></span>
    </section>
    <div class="ss-tw"><table class="ss-tbl"><thead><tr><th>Shed</th><th>Placement</th><th>Birds placed</th><th>DOC weight</th><th>Clean-out</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody><tfoot><tr class="ss-foot">${ssFootHtml(t)}</tr></tfoot></table></div>
    <div class="su-apply ss-apply"${ch.length?'':' hidden'}><span>${ssApplyText(ch)}</span><button type="button" class="mgr-btn" data-su-discard="${SS_G}"${ch.length?'':' disabled'}>Discard</button><button type="button" class="mgr-btn primary" data-su-apply="${SS_G}"${ch.length?'':' disabled'}>Apply</button></div>
    <p class="ss-note">Daily morts and feed intake are on each pair's Setup tab.</p>
  </div></div>`;
}
// Apply bar: how many changes and which sheds (short, so it fits a phone)
function ssApplyText(ch){if(!ch.length)return 'No changes';const ids=[...new Set(ch.map(c=>c.id))].sort((a,b)=>a-b);
  return `<b>${ch.length} change${ch.length===1?'':'s'} not applied</b><em> · Shed${ids.length===1?'':'s'} ${escapeHtml(ids.join(', '))}</em>`;}
// Live preview while typing: the row's automatic clean-out, its status and the totals (no re-render, focus stays)
function ssRefreshRow(id){
  const s=farmData&&farmData.sheds.find(x=>String(x.id)===String(id));const tr=document.querySelector(`.ss-page [data-ss-row="${id}"]`);if(!s||!tr)return;
  const x=ssState(s);
  const co=tr.querySelector('.ss-co');if(co&&document.activeElement!==co.querySelector('input'))co.outerHTML=ssCoCell(s,x);
  tr.querySelector('.ss-stc').innerHTML=ssStatus(x);
  tr.querySelectorAll('[data-su]').forEach(inp=>{const f=inp.dataset.su.split('|')[2];inp.classList.toggle('changed',ssDraftHas(s,f)&&String(setupDraft[SS_G][s.id+'|'+f])!==String(suCurrent(s,f)));});
  const t=ssTotals();const ft=document.querySelector('.ss-page .ss-foot');if(ft)ft.innerHTML=ssFootHtml(t);
  const cp=document.querySelector('.ss-page .ss-chips');if(cp)cp.innerHTML=ssChipsHtml(t);
  // the Apply bar only shows while there's something to apply (it would cover the last sheds)
  const bar=document.querySelector('.ss-page .ss-apply');if(bar){const ch=suChanges(SS_G);bar.hidden=!ch.length;bar.querySelector('span').innerHTML=ssApplyText(ch);}
}
document.addEventListener('input',e=>{
  const t=e.target.closest&&e.target.closest('.ss-page [data-su]');if(t){ssRefreshRow(t.dataset.su.split('|')[1]);return;}
  const f=e.target.closest&&e.target.closest('[data-ss-fillf]');if(f)ssFill[f.dataset.ssFillf]=f.value;
});
document.addEventListener('change',e=>{const f=e.target.closest&&e.target.closest('[data-ss-fillf]');if(f)ssFill[f.dataset.ssFillf]=f.value;});
document.addEventListener('click',e=>{
  const a=e.target.closest('[data-ss-auto]');
  if(a){const id=a.dataset.ssAuto;(setupDraft[SS_G]||(setupDraft[SS_G]={}))[id+'|cleanoutDate']='';suRefreshBar(SS_G);ssRefreshRow(id);return;}
  const b=e.target.closest('[data-ss-fill]');if(!b||!farmData)return;
  const all=b.dataset.ssFill==='all',d=setupDraft[SS_G]||(setupDraft[SS_G]={});
  const first=ssFill.first?parseExcelDate(ssFill.first):null,step=Number(ssFill.stagger)||0,birds=String(ssFill.birds||'').trim(),doc=String(ssFill.doc||'').trim();
  if(!first&&!birds&&!doc){showToast('Enter a first placement, birds per shed or DOC weight to fill.',true);return;}
  let n=0;
  farmData.sheds.forEach((s,i)=>{
    const x=ssState(s);
    if(first&&(all||!x.place)){d[s.id+'|placementDate']=iso(addDays(first,Math.floor(i/2)*step));n++;}
    if(birds&&(all||!x.birds)){d[s.id+'|initialPopulation']=String(Math.max(0,Math.floor(Number(birds))||0));n++;}
    if(doc&&(all||!s.chickWeightKg)){d[s.id+'|chickWeightGrams']=doc;n++;}
  });
  render();
  showToast(n?`Filled ${n} field${n===1?'':'s'} — check them, then Apply.`:'Nothing to fill: every shed already has those values. Use Fill all to replace them.');
});
