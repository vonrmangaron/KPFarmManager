// ── Birds Eye View (2026-10-31, mockup NsXcKJBe1rqoMRvy3zSwXP): Plumo's batch-result page ──
// Only the result: Current (from the farm's records — kill sheets, dockets, silo readings, mortality)
// next to the Estimated final (the same forecast as the Batch page). Pills compare the estimate
// with the last batch in Farm history. No jobs, no AI text: everything here is the app's own maths.

// Age the growth standard reaches w kg (Ross 308, or free range: same to day 14, then slower)
function bevStdAgeFor(w){
  const a=findRossAgeForWeight(w);
  if(growthStd()==='ross'||a<=FR_BROOD_DAYS)return a;
  const k=frSlow();return k>0?FR_BROOD_DAYS+(a-FR_BROOD_DAYS)/k:a;
}
function bevData(){
  if(!farmData)return null;
  const t=computeFarmTotals();if(!t||!t.hasData)return null;
  const today=dateOnly(new Date()),placed=(farmData.sheds||[]).filter(s=>s.placementDate);
  const m=batchMeasured(today),k=m.kpi,ps=pickupSummaryData();
  const lo=t.leftoverKg>0?t.leftoverKg:(t.autoLeftover>0?t.autoLeftover:0);
  const inSilos=(m.pairs||[]).filter(p=>!p.finished).reduce((s,p)=>s+(Number(p.stock)||0),0);
  const delivered=farmLoads.reduce((s,l)=>s+(l.date&&dateOnly(l.date)<=today?(l.actualKg!=null?Number(l.actualKg)||0:Number(l.plannedKg)||0):0),0);
  const curAlw=ps.todate.birds>0?ps.todate.kg/ps.todate.birds:null;
  const cur={fcr:k?k.fcr:null,cfcr:k?k.cfcr:null,pif:k?k.pif:null,cage:t.cage||null,alw:curAlw,lwKg:ps.todate.kg,outBirds:ps.all.birds,weighedBirds:ps.todate.birds,
    feed:m.eaten>0?m.eaten:null,ordered:feedOrderedKg(),inSilos:m.missing&&m.missing.length?null:inSilos,mort:t.totalCurrentMortality,mortRate:t.currentMortRate,
    age:ps.all.age,pickups:ps.all.n,wAge:ps.todate.age,missing:(m.missing||[]).slice(),noWeight:(m.noWeight||[]).slice()};
  cur.std=cur.alw&&cur.wAge?bevStdAgeFor(cur.alw)-cur.wAge:null;   // + ahead of the standard, − behind
  const est={fcr:t.fcr,cfcr:t.cfcr,pif:t.pif,cage:t.cage||null,alw:t.avgWeight,lwKg:t.totalLiveWeight,birds:t.birdsAtHarvest,feed:t.totalFeed,ordered:t.totalFeed+lo,leftover:lo,
    mort:t.mortality,mortRate:t.estMortRate,age:t.weightedAge};
  est.std=est.alw&&est.age?bevStdAgeFor(est.alw)-est.age:null;
  const lr=lastHistoryRec(),lk=lr?historyKpis(lr):null;
  // How solid the estimate is: the more of the batch is on record, the less is forecast
  let conf=0,cn=0;[1,2,3,4].forEach(g=>{const p=computeGroupPredictions(g);if(p.hasData){conf+=p.confidence*p.shedsWithData;cn+=p.shedsWithData;}});
  const weighedN=(farmData.sheds||[]).reduce((s,sh)=>s+(sh.pickups||[]).filter(p=>pkWeighed(p)&&dateOnly(p.date)<=today).length,0);
  const prog={out:est.birds>0?ps.all.birds/est.birds:0,weighed:weighedN,pickups:ps.all.n,fed:est.ordered>0?delivered/est.ordered:0,delivered,conf:cn?conf/cn:null};
  const sheds=placed.map(sh=>{
    const g=Math.floor((sh.id-1)/2)+1,pr=computePredictions(sh,g),pop=Number(sh.initialPopulation)||0;
    const gone=(sh.pickups||[]).filter(p=>p.date&&dateOnly(p.date)<=today&&Number(p.birds)>0);
    const w=gone.filter(pkWeighed),wb=w.reduce((s,p)=>s+Number(p.birds),0),wkg=w.reduce((s,p)=>s+Number(p.totalWeightKg),0);
    const alw=wb>0?wkg/wb:null,age=wb>0?w.reduce((s,p)=>s+pickupAge(sh,p)*Number(p.birds),0)/wb:null;
    return {id:sh.id,out:gone.reduce((s,p)=>s+Number(p.birds),0),alw,std:alw&&age?bevStdAgeFor(alw)-age:null,mort:pop>0?Math.max(0,Number(sh.mortality)||0)/pop*100:null,
      fcr:pr.fcr,cfcr:pr.cfcr,kg:pr.totalWeightKg};
  });
  const first=placed.map(s=>iso(dateOnly(s.placementDate))).sort()[0]||'';
  const trend=(Array.isArray(predState.projectionLog)?predState.projectionLog:[]).filter(x=>x&&x.d>=first&&Number.isFinite(x.cfcr));
  const hist=farmHistorySorted().slice(0,3).map(r=>({batch:r.batch,k:historyKpis(r)}));
  const age=placed.length?Math.max(...placed.map(s=>daysBetween(s.placementDate,today))):0;
  return {t,cur,est,lr,lk,prog,sheds,trend,hist,age,placedBirds:t.placed,batch:String(predState.batchNumber||farmData.batchNumber||'')};
}

const bevN=v=>Math.round(v).toLocaleString('en-US');
const bevT=kg=>(kg/1000).toLocaleString('en-US',{minimumFractionDigits:1,maximumFractionDigits:1})+' t';
const bevKg=v=>v.toFixed(3)+' kg';
const bevD=v=>v.toFixed(1)+' d';
function bevStdTxt(v,short){if(v==null)return '—';const a=Math.abs(v);if(a<0.05)return short?'on std':'On standard';return (short?(v>0?'+':'−')+a.toFixed(1)+' d':a.toFixed(1)+(a===1?' day ':' days ')+(v>0?'ahead':'behind'));}
function bevStdTone(v){return v==null?'n':v>=-0.05?'g':v>-3?'a':'r';}
// Pill: the estimate against the last batch. lower = smaller is better.
function bevPill(est,last,fmt,lower){
  if(!(Number.isFinite(est)&&Number.isFinite(last)&&last>0))return '';
  const d=est-last;if(!/[1-9]/.test(String(fmt(Math.abs(d)))))return '<span class="bev-pill n">same as last</span>';
  const better=lower==null?null:(lower?d<0:d>0);
  return `<span class="bev-pill ${better==null?'n':better?'g':'a'}" title="Estimated final against batch ${escapeHtml(String(bevCur&&bevCur.lr&&bevCur.lr.batch||'last'))}">${d<0?'▼':'▲'} ${fmt(Math.abs(d))}${better==null?'':better?' · better':' · worse'}</span>`;
}
let bevCur=null;
function bevCard(col,label,pill,cur,est,wide){
  const box=(cap,x)=>`<div><small>${cap}</small><b${x.cls?` class="${x.cls}"`:''}>${x.v}</b>${x.s?`<em>${x.s}</em>`:''}</div>`;
  return `<div class="bev-k ${col}"${wide?' style="grid-column:span 2"':''}><div class="bev-kh"><span>${label}</span>${pill||''}</div><div class="bev-kv">${box('Current',cur)}${box('Est. final',est)}</div></div>`;
}
function bevSec(col,icon,title,note,span){
  return `<div class="bev-sh ${col}"${span?` style="grid-column:span ${span}"`:''}><span class="bev-ic">${icon}</span><b>${title}</b><span class="bev-ln"></span>${note?`<em>${note}</em>`:''}</div>`;
}
const BEV_IC={
  perf:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>',
  wt:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12l2 13H4z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>',
  feed:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v11l-6 5-6-5z"/><path d="M6 9h12"/></svg>',
  birds:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/></svg>',
  eye:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>'};
function bevTrendSvg(tr,last){
  if(tr.length<2)return '<p class="bev-muted">The line builds up over the batch — one point is saved each day the forecast runs.</p>';
  const W=420,H=150,L=36,R=412,T=16,B=120;
  const vals=tr.map(x=>x.cfcr).concat(Number.isFinite(last)?[last]:[]);let lo=Math.min(...vals),hi=Math.max(...vals);const pad=Math.max(0.005,(hi-lo)*0.15);lo-=pad;hi+=pad;
  const d0=dateOnly(tr[0].d),d1=dateOnly(tr[tr.length-1].d),span=Math.max(1,daysBetween(d0,d1));
  const X=d=>L+(R-L)*daysBetween(d0,dateOnly(d))/span,Y=v=>B-(B-T)*(v-lo)/(hi-lo);
  const pts=tr.map(x=>[X(x.d),Y(x.cfcr)]),line=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join('');
  const ticks=[hi-pad,(hi+lo)/2,lo+pad].map(v=>`<text x="${L-6}" y="${(Y(v)+3).toFixed(1)}" text-anchor="end">${v.toFixed(2)}</text><path d="M${L} ${Y(v).toFixed(1)}H${R}" class="bev-gl"/>`).join('');
  const lab=[tr[0],tr[Math.floor(tr.length/2)],tr[tr.length-1]].map(x=>`<text x="${X(x.d).toFixed(1)}" y="${H-12}" text-anchor="middle">${escapeHtml(fmtShortNoYear(dateOnly(x.d)))}</text>`).join('');
  const ref=Number.isFinite(last)?`<path d="M${L} ${Y(last).toFixed(1)}H${R}" class="bev-ref"/><text x="${R}" y="${(Y(last)-5).toFixed(1)}" text-anchor="end" class="bev-reft">${escapeHtml(String(bevCur.lr.batch||'last'))} · ${last.toFixed(2)}</text>`:'';
  const lp=pts[pts.length-1];
  return `<svg viewBox="0 0 ${W} ${H}" class="bev-chart" role="img" aria-label="Estimated final cFCR2.45 from ${tr[0].cfcr.toFixed(2)} to ${tr[tr.length-1].cfcr.toFixed(2)}">
    <g class="bev-ax">${ticks}${lab}</g>${ref}
    <path d="${line}L${lp[0].toFixed(1)} ${B}L${pts[0][0].toFixed(1)} ${B}Z" class="bev-area"/><path d="${line}" class="bev-line"/>
    <circle cx="${lp[0].toFixed(1)}" cy="${lp[1].toFixed(1)}" r="5" class="bev-dot"/></svg>`;
}
function bevHtml(D){
  const {cur,est,lk,prog}=D,f2=v=>v.toFixed(2),na={v:'—',s:''},bad=v=>!(Number.isFinite(v)&&v>0);
  const curNote=cur.missing.length?`silo reading missing for Sheds ${cur.missing.map(g=>(g*2-1)+'–'+g*2).join(', ')}`:cur.noWeight.length?`no weight yet for Shed ${cur.noWeight.join(', ')}`:'';
  const perfCur=v=>bad(v)?{v:'—',s:curNote}:null;
  const stdC=bevStdTone(cur.std),stdE=bevStdTone(est.std);
  const meter=(v,txt,col,w)=>`<div class="bev-mt"><span><b>${v}</b>${txt}</span><span class="bev-mb"><i style="width:${Math.round(Math.max(0,Math.min(1,w))*100)}%;background:${col}"></i></span></div>`;
  const nm=escapeHtml(stdName());
  const cards=
    bevSec('blue',BEV_IC.perf,'Performance',lk?`pills compare the estimate with batch ${escapeHtml(String(D.lr.batch||''))}`:'')+
    bevCard('blue','FCR',lk?bevPill(est.fcr,lk.fcr,f2,true):'',perfCur(cur.fcr)||{v:f2(cur.fcr)},bad(est.fcr)?na:{v:f2(est.fcr)})+
    bevCard('blue','cFCR2.45',lk?bevPill(est.cfcr,lk.cfcr,f2,true):'',perfCur(cur.cfcr)||{v:f2(cur.cfcr)},bad(est.cfcr)?na:{v:f2(est.cfcr)})+
    bevCard('blue','CAge2.45',`<span class="bev-pill a" title="Your Cage2.45 target">target ${frCageTarget().toFixed(1)}</span>`,bad(cur.cage)?{v:'—',s:'no shed at 2.45 kg yet'}:{v:bevD(cur.cage),s:'from the growth curves'},bad(est.cage)?na:{v:bevD(est.cage)})+
    bevCard('blue','PIF',lk?bevPill(est.pif,lk.pif,v=>Math.round(v),false):'',perfCur(cur.pif)||{v:Math.round(cur.pif)},bad(est.pif)?na:{v:Math.round(est.pif)})+
    bevSec('green',BEV_IC.wt,'Weight','current from kill sheets')+
    bevCard('green','Average weight',lk?bevPill(est.alw,lk.alw,v=>v.toFixed(2)+' kg',false):'',bad(cur.alw)?{v:'—',s:'no kill-sheet weights yet'}:{v:bevKg(cur.alw),s:bevN(cur.weighedBirds)+' birds weighed'},bad(est.alw)?na:{v:bevKg(est.alw),s:'all birds'})+
    bevCard('green','Total live weight',D.lr&&D.lr.liveWeightKg>0?bevPill(est.lwKg,D.lr.liveWeightKg,v=>Math.round(v/1000)+' t',false):'',{v:bevT(cur.lwKg),s:'picked up so far'},bad(est.lwKg)?na:{v:bevT(est.lwKg),s:bevN(est.birds)+' birds'})+
    bevCard('green',`Farm weight vs ${nm}`,`<span class="bev-pill ${stdE}">${est.std==null?'—':est.std>=-0.05?'On or ahead':'Behind standard'}</span>`,
      cur.std==null?{v:'—',s:'no kill-sheet weights yet'}:{v:bevStdTxt(cur.std),cls:'t-'+stdC,s:`${bevKg(cur.alw)} at avg day ${cur.wAge.toFixed(1)} · ${nm} reaches it on day ${bevStdAgeFor(cur.alw).toFixed(1)}`},
      est.std==null?na:{v:bevStdTxt(est.std),cls:'t-'+stdE,s:`${bevKg(est.alw)} at avg day ${est.age.toFixed(1)} · ${nm} reaches it on day ${bevStdAgeFor(est.alw).toFixed(1)}`},true)+
    bevSec('amber',BEV_IC.feed,'Feed','dockets + silo readings',2)+bevSec('purple',BEV_IC.birds,'Birds','mortality records + pickups',2)+
    bevCard('amber','Feed consumption',D.lr&&D.lr.feedKg>0?bevPill(est.feed,D.lr.feedKg,v=>Math.round(v/1000)+' t',null):'',cur.feed==null?{v:'—',s:curNote||'needs a silo reading'}:{v:bevT(cur.feed),s:'eaten so far'},{v:bevT(est.feed),s:'to clean-out'})+
    bevCard('amber','Total feed ordered',est.leftover>0?`<span class="bev-pill n">${bevT(est.leftover)} leftover</span>`:'',{v:bevT(cur.ordered),s:cur.inSilos!=null?bevT(cur.inSilos)+' in silos':'loads booked + delivered'},{v:bevT(est.ordered),s:'incl. leftover'})+
    bevCard('purple','Mortality',lk?bevPill(est.mortRate,100-lk.livability,v=>v.toFixed(2)+'%',true):'',{v:bevN(cur.mort),s:cur.mortRate.toFixed(2)+'%'},{v:bevN(est.mort),s:est.mortRate.toFixed(2)+'%'})+
    bevCard('purple','Avg age at pickup',lk?bevPill(est.age,lk.avgAge,v=>v.toFixed(1)+' d',null):'',cur.age==null?{v:'—',s:'no pickups yet'}:{v:bevD(cur.age),s:cur.pickups+' pickup'+(cur.pickups===1?'':'s')},bad(est.age)?na:{v:bevD(est.age),s:'all pickups'});
  // shed table: green = best value, red = worst (only when sheds differ)
  const S=D.sheds,ext=(key,lower)=>{const v=S.map(s=>s[key]).filter(Number.isFinite);if(v.length<2)return {};const mn=Math.min(...v),mx=Math.max(...v);if(mn===mx)return {};return lower?{best:mn,worst:mx}:{best:mx,worst:mn};};
  const ex={cfcr:ext('cfcr',true),fcr:ext('fcr',true),alw:ext('alw',false),mort:ext('mort',true),std:ext('std',false)};
  const cell=(key,v,txt)=>{const e=ex[key]||{};return `<td${v===e.best?' class="bev-best"':v===e.worst?' class="bev-worst"':''}>${txt}</td>`;};
  const rows=S.map(s=>`<tr${s.std!=null&&s.std===ex.std.worst&&s.std<-0.5?' class="bev-wrow"':''}><td>${s.id}</td><td>${s.out?bevN(s.out):'—'}</td>${cell('alw',s.alw,s.alw?bevKg(s.alw):'—')}<td>${s.std==null?'—':`<span class="bev-tag ${bevStdTone(s.std)}">${bevStdTxt(s.std,true)}</span>`}</td>${cell('mort',s.mort,s.mort!=null?s.mort.toFixed(1)+'%':'—')}${cell('fcr',s.fcr,s.fcr>0?f2(s.fcr):'—')}${cell('cfcr',s.cfcr,s.cfcr>0?f2(s.cfcr):'—')}<td class="bev-xc">${s.kg>0?bevT(s.kg):'—'}</td></tr>`).join('');
  const hist=D.hist.length?`<table class="bev-st"><thead><tr><th>Batch</th><th>FCR</th><th>cFCR2.45</th><th>PIF</th><th>Avg wt</th><th>Avg age</th></tr></thead><tbody>
      <tr class="bev-now"><td>${escapeHtml(D.batch||'This')} <span class="bev-tag a">est.</span></td><td>${f2(est.fcr)}</td><td>${f2(est.cfcr)}</td><td>${Math.round(est.pif)}</td><td>${est.alw.toFixed(2)}</td><td>${est.age.toFixed(1)}</td></tr>
      ${D.hist.map(h=>`<tr><td>${escapeHtml(String(h.batch||'—'))}</td><td>${f2(h.k.fcr)}</td><td>${f2(h.k.cfcr)}</td><td>${Math.round(h.k.pif)}</td><td>${h.k.alw.toFixed(2)}</td><td>${h.k.avgAge.toFixed(1)}</td></tr>`).join('')}</tbody></table>`
    :'<p class="bev-muted">No past batches in Farm history yet — they appear here once a batch is finished and saved.</p>';
  const tr=D.trend,moved=tr.length>=2?tr[tr.length-1].cfcr-tr[0].cfcr:null;
  return `<div class="bev-hd"><div class="bev-top"><span class="bev-logo">${BEV_IC.eye}</span>
      <div class="bev-tt"><small>Plumo · Birds Eye View</small><h2 id="bevTitle">Batch ${escapeHtml(D.batch||'—')} <span>· day ${D.age}</span> <span class="bev-meta">· ${S.length} sheds · ${bevN(D.placedBirds)} placed</span></h2></div>
      <span class="bev-leg"><i class="c">Current · your records</i><i class="e">Est. final · at clean-out</i></span>
      <button type="button" class="bev-x" data-bev-close aria-label="Close" title="Close">✕</button></div>
    <div class="bev-meters">${meter(Math.round(prog.out*100)+'%','of birds picked up','#5B8DEF',prog.out)}${meter(prog.weighed+' / '+prog.pickups,'pickups weighed','#5B8DEF',prog.pickups?prog.weighed/prog.pickups:0)}${meter(Math.round(prog.fed*100)+'%','of feed delivered','#F0A21A',prog.fed)}${prog.conf!=null?meter(Math.round(prog.conf)+'%','forecast confidence','#2BB673',prog.conf/100):''}</div></div>
    <div class="bev-body"><div class="bev-grid">${cards}</div>
      <div class="bev-lower">
        <section class="bev-panel"><div class="bev-ph"><b>Shed by shed</b><em>birds out, weight and mortality from records · FCR, cFCR and total are the estimated final</em></div>
          <div class="bev-tw"><table class="bev-st"><thead><tr><th>Shed</th><th>Birds out</th><th>Avg weight</th><th>vs ${growthStd()==='ross'?'Ross 308':'std'}</th><th>Mort.</th><th>Est. FCR</th><th>Est. cFCR</th><th class="bev-xc">Est. final</th></tr></thead><tbody>${rows}</tbody></table></div>
          <span class="bev-key"><span class="bev-best">Green</span> best shed · <span class="bev-worst">Red</span> furthest behind</span></section>
        <div class="bev-side">
          <section class="bev-panel"><div class="bev-ph"><b>How the estimate moved</b><em>est. final cFCR2.45</em></div>${bevTrendSvg(tr,lk?lk.cfcr:NaN)}
            ${moved!=null?`<span class="bev-mv ${moved<=0?'g':'a'}">${moved<=0?'Improved':'Up'} ${Math.abs(moved).toFixed(2)} since ${escapeHtml(fmtShortNoYear(dateOnly(tr[0].d)))}${lk?` · ${est.cfcr<=lk.cfcr?(lk.cfcr-est.cfcr).toFixed(2)+' better':(est.cfcr-lk.cfcr).toFixed(2)+' worse'} than ${escapeHtml(String(D.lr.batch||'last batch'))}`:''} · lower is better</span>`:''}</section>
          <section class="bev-panel"><div class="bev-ph"><b>Last batches</b><em>final results</em></div><div class="bev-tw">${hist}</div></section>
        </div></div></div>`;
}
function bevOpen(){
  let m=document.getElementById('bevModal');
  if(!m){m=document.createElement('div');m.id='bevModal';m.className='bev-ov';m.hidden=true;m.innerHTML='<div class="bev-dlg" role="dialog" aria-modal="true" aria-labelledby="bevTitle" tabindex="-1"></div>';document.body.appendChild(m);}
  const dlg=m.querySelector('.bev-dlg');
  try{bevCur=bevData();}catch(e){console.warn('Birds Eye View failed',e);bevCur=null;}
  dlg.innerHTML=bevCur?bevHtml(bevCur):`<div class="bev-hd"><div class="bev-top"><span class="bev-logo">${BEV_IC.eye}</span><div class="bev-tt"><small>Plumo · Birds Eye View</small><h2 id="bevTitle">No batch running</h2></div><button type="button" class="bev-x" data-bev-close aria-label="Close" title="Close">✕</button></div></div><div class="bev-body"><p class="bev-muted">Place a batch to see its result here.</p></div>`;
  m.hidden=false;document.body.classList.add('bev-open');dlg.focus({preventScroll:true});
}
function bevClose(){const m=document.getElementById('bevModal');if(!m||m.hidden)return;m.hidden=true;document.body.classList.remove('bev-open');}
document.addEventListener('click',e=>{
  if(e.target.closest('[data-bev-open]')){e.preventDefault();bevOpen();return;}
  const m=document.getElementById('bevModal');if(!m||m.hidden)return;
  if(e.target.closest('[data-bev-close]')||e.target===m)bevClose();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){const m=document.getElementById('bevModal');if(m&&!m.hidden){e.stopPropagation();bevClose();}}},true);
