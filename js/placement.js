// ── Placement docket + Placement report (2026-11-05, mockup 6i7BTLJJeL5LD67eHTbKwZ) ─────────
// Each shed's chick delivery docket is entered on its pair's Setup tab: docket no., breed (Ross 308
// unless changed), DOAs and one row per donor (breeder) flock with its age, DOC weight and birds.
// It waits for Apply like the rest of Setup (draft key "<shed>|docket", a JSON string).
// The shed's DOC weight is the average weighted by birds: Σ(donor g × donor birds) ÷ total birds
// (Shed 1 of 2702: 37.3 g, where a plain average of the donors would say 36.8). Flock age the same way.
// On Apply that weighted DOC becomes the shed's chick weight (day 0 of its growth curve).
// The report (tab "placement") prints every shed on one A4 landscape page, cards or one table.
const PR_BREED='Ross 308';
const PR_SIZES={S:12,M:13.5,L:15,XL:17};
let prSize=(()=>{try{const v=localStorage.getItem('pw-pr-size');return PR_SIZES[v]?v:'L';}catch(e){return 'L';}})();
let prLayout=(()=>{try{return localStorage.getItem('pw-pr-layout')==='table'?'table':'cards';}catch(e){return 'cards';}})();
const prNum=v=>{if(v===''||v==null)return null;const n=Number(String(v).replace(/,/g,''));return Number.isFinite(n)?n:null;};
const prInt=n=>Math.round(n).toLocaleString('en-US');
// A docket in one fixed shape (the draft compares JSON strings, so key order matters)
function dkNorm(d){
  d=d&&typeof d==='object'?d:{};
  const donors=(Array.isArray(d.donors)?d.donors:[]).map(x=>({id:String(x&&x.id||'dn'+Math.random().toString(36).slice(2,9)),
    flock:String(x&&x.flock||'').trim().slice(0,20),ageWk:prNum(x&&x.ageWk),docG:prNum(x&&x.docG),birds:prNum(x&&x.birds)}));
  return {no:String(d.no||'').trim().slice(0,20),breed:String(d.breed==null?PR_BREED:d.breed).slice(0,30),doa:prNum(d.doa),donors};
}
const dkBlank=x=>!x.flock&&x.ageWk==null&&x.docG==null&&x.birds==null;
// Totals and the bird-weighted averages; a donor without birds counts for nothing
function dkStats(d){
  const rows=dkNorm(d).donors.filter(x=>(x.birds||0)>0);
  const birds=rows.reduce((a,x)=>a+x.birds,0);
  const wavg=f=>{const r=rows.filter(x=>x[f]!=null&&x[f]>0),n=r.reduce((a,x)=>a+x.birds,0);return n?r.reduce((a,x)=>a+x[f]*x.birds,0)/n:null;};
  return {birds,doc:wavg('docG'),age:wavg('ageWk'),n:rows.length};
}
// The docket as Setup shows it: the draft if there is one, else what is saved
function dkView(g,s){const raw=suVal(g,s,'docket',null);if(raw==null)return dkNorm(s.docket);try{return dkNorm(JSON.parse(raw));}catch(e){return dkNorm(s.docket);}}
function dkSet(g,id,fn){
  const s=farmData&&farmData.sheds.find(x=>String(x.id)===String(id));if(!s)return;
  const d=dkView(g,s);fn(d);const dr=setupDraft[g]||(setupDraft[g]={});dr[s.id+'|docket']=JSON.stringify(dkNorm(d));
  // Birds placed follows the docket: the donors' birds added up (2026-11-10)
  const st=dkStats(d);if(st.birds>0){dr[s.id+'|initialPopulation']=String(st.birds);
    document.querySelectorAll(`[data-su="${g}|${s.id}|initialPopulation"]`).forEach(x=>{x.value=st.birds;x.readOnly=true;x.classList.add('su-auto');});}
}
// Setup's Birds placed box: read-only while the docket has donor birds
function dkBirdsLocked(g,s){return dkStats(dkView(g,s)).birds>0;}
// Apply: blank donor rows are dropped; the weighted DOC becomes the shed's chick weight
function dkApply(id,raw){
  const s=farmData&&farmData.sheds.find(x=>String(x.id)===String(id));if(!s)return;
  let d;try{d=dkNorm(JSON.parse(raw));}catch(e){return;}
  d.donors=d.donors.filter(x=>!dkBlank(x));
  s.docket=d;
  const st=dkStats(d);
  if(st.birds>0&&Number(s.initialPopulation)!==st.birds)updateShedField(Number(s.id)-1,'initialPopulation',String(st.birds));
  if(st.doc!=null){const kg=st.doc/1000;if(kg>=MIN_CHICK_WEIGHT_KG&&kg<=MAX_CHICK_WEIGHT_KG)s.chickWeightKg=Math.round(kg*100000)/100000;}
}
function dkTotalsHtml(g,s,d){
  const st=dkStats(d);if(!st.n)return `<p class="dk-sum muted">Add the donor flocks from the docket. The shed's DOC weight is then worked out from them, weighted by birds.</p>`;
  const plain=st.n>1?d.donors.filter(x=>(x.birds||0)>0&&x.docG>0):[];
  return `<div class="dk-sum"><span><small>Birds</small><b>${prInt(st.birds)}</b></span><span><small>Avg DOC</small><b>${st.doc!=null?st.doc.toFixed(1)+' g':'—'}</b></span><span><small>Avg flock age</small><b>${st.age!=null?st.age.toFixed(1)+' wk':'—'}</b></span></div>
    <p class="dk-note">${st.doc!=null?`Weighted by birds${plain.length>1?` (a plain average would be ${(plain.reduce((a,x)=>a+x.docG,0)/plain.length).toFixed(1)} g)`:''}. On Apply, Shed ${s.id}'s chick weight becomes ${st.doc.toFixed(1)} g.`:'Enter each donor\'s DOC weight to get the shed average.'}${st.birds>0?` Birds placed = ${prInt(st.birds)}, the donors added up.`:''}</p>`;
}
function dkShedHtml(g,s){
  const d=dkView(g,s),k=`${g}|${s.id}`;
  const rows=(d.donors.length?d.donors:[]).map((x,i)=>`<div class="dk-row">
      <input type="text" maxlength="20" value="${escapeAttr(x.flock)}" placeholder="e.g. CR2" data-dk="${k}|${i}|flock" aria-label="Shed ${s.id} donor ${i+1} flock" title="Donor (breeder) flock, as on the docket">
      <input type="number" min="0" max="80" step="1" inputmode="numeric" value="${x.ageWk??''}" placeholder="wk" data-dk="${k}|${i}|ageWk" aria-label="Shed ${s.id} donor ${i+1} flock age in weeks" title="Donor flock age (weeks)">
      <input type="number" min="20" max="80" step="0.1" inputmode="decimal" value="${x.docG??''}" placeholder="g" data-dk="${k}|${i}|docG" aria-label="Shed ${s.id} donor ${i+1} DOC weight in grams" title="Day-old chick weight (g)">
      <input type="number" min="0" step="1" inputmode="numeric" value="${x.birds??''}" placeholder="birds" data-dk="${k}|${i}|birds" aria-label="Shed ${s.id} donor ${i+1} birds" title="Birds from this donor">
      <button type="button" class="dk-x" data-dk-del="${k}|${i}" aria-label="Remove donor ${i+1}" title="Remove this donor">✕</button></div>`).join('');
  return `<div class="dk-shed" data-dk-shed="${s.id}"><div class="dk-h"><b>Shed ${s.id}</b><span>${s.placementDate?'Placed '+escapeHtml(fmtShortNoYear(s.placementDate)):'Not placed yet'}</span></div>
    <div class="dk-top">
      <label>Docket no.<input type="text" maxlength="20" value="${escapeAttr(d.no)}" placeholder="e.g. 40592" data-dk="${k}|no" title="The delivery docket number"></label>
      <label>Breed<input type="text" maxlength="30" value="${escapeAttr(d.breed)}" data-dk="${k}|breed" title="Ross 308 unless the docket says another breed"></label>
      <label>DOAs<input type="number" min="0" step="1" inputmode="numeric" value="${d.doa??''}" placeholder="0" data-dk="${k}|doa" title="Dead on arrival, from the docket"></label></div>
    <div class="dk-donors">${d.donors.length?`<div class="dk-row dk-hd"><span>Donor flock</span><span>Age wk</span><span>DOC g</span><span>Birds</span><span></span></div>`:''}${rows}
      <button type="button" class="dk-add" data-dk-add="${k}" title="Add a donor flock row from the docket">+ Add donor</button></div>
    <div class="dk-tot">${dkTotalsHtml(g,s,d)}</div></div>`;
}
// The Setup tab's docket section (both sheds of the pair)
function dkSetupHtml(g,sheds){
  return `<div class="dk-sec"><div class="dk-sec-h"><span class="mgr-k">Placement docket</span><button type="button" class="mgr-link" data-tab="placement" title="Open the printable Placement report">Placement report ›</button></div>
    <div class="dk-sheds">${sheds.map(s=>dkShedHtml(g,s)).join('')}</div></div>`;
}
document.addEventListener('input',e=>{
  const t=e.target.closest&&e.target.closest('[data-dk]');if(!t)return;
  const p=t.dataset.dk.split('|'),g=p[0],id=p[1];
  dkSet(g,id,d=>{if(p.length===3)d[p[2]]=t.value;else{const r=d.donors[Number(p[2])];if(r)r[p[3]]=t.value;}});   // g|shed|field or g|shed|row|field
  suRefreshBar(g);
  const box=document.querySelector(`[data-dk-shed="${id}"] .dk-tot`),s=farmData.sheds.find(x=>String(x.id)===String(id));
  if(box&&s)box.innerHTML=dkTotalsHtml(g,s,dkView(g,s));
});
document.addEventListener('change',e=>{if(e.target.closest&&e.target.closest('[data-dk]'))e.stopPropagation();},true);
document.addEventListener('click',e=>{
  const a=e.target.closest('[data-dk-add]');
  if(a){const [g,id]=a.dataset.dkAdd.split('|');dkSet(g,id,d=>d.donors.push({id:'dn'+Date.now().toString(36)}));render();
    requestAnimationFrame(()=>{const r=document.querySelectorAll(`[data-dk-shed="${id}"] .dk-row:not(.dk-hd)`);const last=r[r.length-1];if(last)last.querySelector('input').focus();});return;}
  const x=e.target.closest('[data-dk-del]');
  if(x){const [g,id,i]=x.dataset.dkDel.split('|');dkSet(g,id,d=>d.donors.splice(Number(i),1));render();}
});

// ── The report ──
function prShedData(s){
  const d=dkNorm(s.docket),st=dkStats(d),has=st.n>0;
  const birds=has?st.birds:(Number(s.initialPopulation)||0);
  const doc=has&&st.doc!=null?st.doc:(s.placementDate?shedChickWeight(s)*1000:null);
  return {s,d,st,has,birds,doc,age:has?st.age:null};
}
function prFarm(list){
  const b=list.filter(x=>x.birds>0),n=b.reduce((a,x)=>a+x.birds,0);
  const w=f=>{const r=b.filter(x=>x[f]!=null),m=r.reduce((a,x)=>a+x.birds,0);return m?r.reduce((a,x)=>a+x[f]*x.birds,0)/m:null;};
  const doas=list.filter(x=>x.d.doa!=null);
  return {birds:n,doc:w('doc'),age:w('age'),doa:doas.length?doas.reduce((a,x)=>a+x.d.doa,0):null};
}
const prG=v=>v!=null?v.toFixed(1)+' g':'—',prW=v=>v!=null?v.toFixed(1)+' wk':'—';
function prCardHtml(x){
  const s=x.s,rows=x.has?x.d.donors.filter(r=>(r.birds||0)>0):[];
  const body=x.has?`<table class="pr-t"><thead><tr><th>Donor</th><th>Age wk</th><th>DOC g</th><th>Birds</th></tr></thead><tbody>
      ${rows.map(r=>`<tr><td>${escapeHtml(r.flock||'—')}</td><td>${r.ageWk??'—'}</td><td>${r.docG!=null?r.docG.toFixed(1):'—'}</td><td>${prInt(r.birds)}</td></tr>`).join('')}
      <tr class="tot"><td>Total</td><td></td><td></td><td>${prInt(x.birds)}</td></tr></tbody></table>`
    :`<p class="pr-none">Docket not entered${x.birds?` · ${prInt(x.birds)} birds placed`:''}</p>`;
  const meta=[x.d.doa!=null?'DOAs '+prInt(x.d.doa):'',x.d.no?'Docket #'+escapeHtml(x.d.no):'',x.has&&x.d.breed&&x.d.breed!==PR_BREED?escapeHtml(x.d.breed):''].filter(Boolean);
  return `<div class="pr-c"><div class="pr-h"><b>Shed ${s.id}</b><span>${s.placementDate?'Placed '+escapeHtml(fmtShortNoYear(s.placementDate)):'Not placed'}</span></div>${body}
    <div class="pr-f"><div><small>Avg DOC</small><strong>${prG(x.doc)}</strong></div><div><small>Avg age</small><strong>${prW(x.age)}</strong></div></div>
    ${meta.length?`<div class="pr-m">${meta.map(m=>`<span>${m}</span>`).join('')}</div>`:''}</div>`;
}
function prTableHtml(list,f){
  const body=list.map(x=>{const rows=x.has?x.d.donors.filter(r=>(r.birds||0)>0):[],n=rows.length+1;
    const lead=`<td class="l s" rowspan="${n}">${x.s.id}</td><td class="l p" rowspan="${n}">${x.s.placementDate?escapeHtml(fmtShortNoYear(x.s.placementDate)):'—'}</td>`;
    const tail=`<td class="p" rowspan="${n}">${x.d.doa!=null?prInt(x.d.doa):'—'}</td><td class="p" rowspan="${n}">${escapeHtml(x.d.no||'—')}</td>`;
    const tot=`<td class="l">${x.has?'Shed avg · total':'Docket not entered'}</td><td>${x.age!=null?x.age.toFixed(1):'—'}</td><td>${x.doc!=null?x.doc.toFixed(1):'—'}</td><td>${x.birds?prInt(x.birds):'—'}</td>`;
    if(!rows.length)return `<tr class="tot">${lead}${tot}${tail}</tr>`;
    return rows.map((r,i)=>`<tr>${i?'':lead}<td class="l d">${escapeHtml(r.flock||'—')}</td><td>${r.ageWk??'—'}</td><td>${r.docG!=null?r.docG.toFixed(1):'—'}</td><td>${prInt(r.birds)}</td>${i?'':tail}</tr>`).join('')+`<tr class="tot">${tot}</tr>`;}).join('');
  return `<table class="pr-tb"><thead><tr><th class="l">Shed</th><th class="l">Placed</th><th class="l">Donor</th><th>Flock age wk</th><th>DOC g</th><th>Birds</th><th>DOAs</th><th>Docket</th></tr></thead>
    <tbody>${body}<tr class="farm"><td class="l" colspan="3">Farm</td><td>${f.age!=null?f.age.toFixed(1):'—'}</td><td>${f.doc!=null?f.doc.toFixed(1):'—'}</td><td>${prInt(f.birds)}</td><td>${f.doa!=null?prInt(f.doa):'—'}</td><td></td></tr></tbody></table>`;
}
function prSheetHtml(){
  const list=farmData.sheds.map(prShedData),f=prFarm(list);
  const breeds=[...new Set(list.filter(x=>x.has).map(x=>x.d.breed||PR_BREED))];
  const now=new Date(),farm=displayFarmName(),batch=predState.batchNumber||farmData.batchNumber||'';
  const stat=(k,v)=>`<div class="pr-st"><span>${k}</span><b>${v}</b></div>`;
  return `<div class="pr-sheet pr-${prLayout}" style="--pr-f:${PR_SIZES[prSize]}px">
    <div class="pr-top"><div class="pr-tt"><span>${escapeHtml([farm,breeds.length?breeds.join(', '):PR_BREED].filter(Boolean).join(' · '))}</span><b>Placement report${batch?' · Batch '+escapeHtml(batch):''}</b></div>
      <div class="pr-sts">${stat('Birds placed',prInt(f.birds))}${stat('Avg DOC weight',prG(f.doc))}${stat('Avg flock age',prW(f.age))}${f.doa!=null?stat('DOAs',prInt(f.doa)):''}</div></div>
    ${prLayout==='table'?prTableHtml(list,f):`<div class="pr-grid">${list.map(prCardHtml).join('')}</div>`}
    <div class="pr-foot"><span>Avg DOC weight and flock age are weighted by birds from each donor.</span><span>Printed ${escapeHtml(fmtShortNoYear(now))} ${now.getFullYear()}, ${escapeHtml(fmtClock(now))} · ProdWise</span></div></div>`;
}
function renderPlacementPage(){
  if(!farmData||!farmData.sheds.length)return '<div class="empty-card">No sheds yet.</div>';
  const seg=(attr,cur,opts)=>`<div class="pr-seg">${opts.map(([v,l,t])=>`<button type="button" class="${v===cur?'on':''}" ${attr}="${v}" title="${t}">${l}</button>`).join('')}</div>`;
  const missing=farmData.sheds.filter(s=>!dkStats(s.docket).n).length;
  return `<div class="pr-page">
    <div class="pr-bar"><div class="pr-bt"><span class="mgr-k">Production · Batch ${escapeHtml(predState.batchNumber||farmData.batchNumber||'')}</span><b>Placement report</b></div>
      <span class="pr-ctl"><span class="mgr-k">Text size</span>${seg('data-pr-size',prSize,[['S','S','Small text'],['M','M','Medium text'],['L','L','Large text (default)'],['XL','XL','Extra large text']])}</span>
      <span class="pr-ctl"><span class="mgr-k">Layout</span>${seg('data-pr-layout',prLayout,[['cards','Cards','One card per shed'],['table','Table','One table for all sheds']])}</span>
      <button type="button" class="mgr-btn" data-pr-edit title="Dockets are entered on each pair's Setup tab">Edit dockets</button>
      <button type="button" class="mgr-btn primary pr-print" data-pr-print title="Print on one A4 page, landscape">Print</button></div>
    ${missing?`<p class="pr-miss">${missing} shed${missing===1?' has':'s have'} no docket yet — enter them on each pair's Setup tab.</p>`:''}
    <div class="pr-paper">${prSheetHtml()}</div></div>`;
}
// Print keeps everything on one A4 landscape page: laid out at the page's printable size (297 × 210 mm less
// 7 mm margins), the text steps down from the chosen size only as far as it must (not below 10 px).
// If even that is too tall it carries on to a second page — nothing is ever cut off.
function prFitPage(el){
  const mm=96/25.4,W=283*mm,H=194*mm,sh=el.querySelector('.pr-sheet');if(!sh)return;
  el.classList.add('pr-measure');el.style.width=W+'px';
  let f=PR_SIZES[prSize];sh.style.setProperty('--pr-f',f+'px');
  while(f>10&&sh.scrollHeight>H){f-=0.5;sh.style.setProperty('--pr-f',f+'px');}
  el.classList.remove('pr-measure');el.style.width='';
}
function prPrint(){
  let el=document.getElementById('placementPrint');
  if(!el){el=document.createElement('div');el.id='placementPrint';document.body.appendChild(el);}
  el.innerHTML=prSheetHtml();
  prFitPage(el);
  let pg=document.getElementById('prPageStyle');
  if(!pg){pg=document.createElement('style');pg.id='prPageStyle';document.head.appendChild(pg);}
  pg.textContent='@media print{@page{size:A4 landscape;margin:7mm;}}';
  document.body.classList.add('pr-printing');
  const done=()=>{document.body.classList.remove('pr-printing');pg.textContent='';window.removeEventListener('afterprint',done);};
  window.addEventListener('afterprint',done);
  window.print();
}
document.addEventListener('click',e=>{
  const z=e.target.closest('[data-pr-size]');if(z){prSize=z.dataset.prSize;try{localStorage.setItem('pw-pr-size',prSize);}catch(_){}render();return;}
  const l=e.target.closest('[data-pr-layout]');if(l){prLayout=l.dataset.prLayout;try{localStorage.setItem('pw-pr-layout',prLayout);}catch(_){}render();return;}
  if(e.target.closest('[data-pr-edit]')){activeTab='g1';setShedView(1,'setup');return;}
  if(e.target.closest('[data-pr-print]'))prPrint();
});
