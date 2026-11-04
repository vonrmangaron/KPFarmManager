// ── Finish batch (2026-11-04, mockup Ugj2J3wHjrgRuQVkN2ou1g, option B: three steps) ──
// Ready when every placed shed's final pickup has gone and the last one out has its kill-sheet weight.
// Home shows a Plumo banner and the pop-up opens once a day until it's done:
//   1 Check   — birds out, last pickup weighed, every shed closed (mortality balanced), dockets
//   2 Leftover feed — what YOU entered per pair (silo by silo), never an estimate; Edit opens the usual window
//   3 Results & finish — the final numbers and Plumo's verdict; Finish files it in Farm history,
//     and the leftover carries over to the next batch (applyAutoCarry takes it from the filed record)
let finState=null;   // {step:0|1|2}

function finPlaced(){return farmData?(farmData.sheds||[]).filter(s=>s.placementDate&&Number(s.initialPopulation)>0):[];}
function finReady(){
  const sheds=finPlaced(),today=dateOnly(new Date());if(!sheds.length)return {ready:false,sheds};
  const out=sheds.map(s=>({s,fp:finalPickupOf(s)}));
  const stillIn=out.filter(x=>!(x.fp&&x.fp.date&&dateOnly(x.fp.date)<=today)).map(x=>x.s);
  const gone=out.filter(x=>x.fp&&x.fp.date&&dateOnly(x.fp.date)<=today).sort((a,b)=>dateOnly(b.fp.date)-dateOnly(a.fp.date)||Number(b.s.id)-Number(a.s.id));
  const last=stillIn.length?null:gone[0]||null;
  const weighed=!!(last&&pkWeighed(last.fp));
  return {ready:!stillIn.length&&weighed,sheds,stillIn,last,weighed};
}
function finDone(){return !!(predState.batchFinal&&predState.batchFinal.at);}
function finKey(){return String(currentBatchKey()||predState.batchNumber||(farmData&&farmData.batchNumber)||'');}
// the batch that takes the leftover: the running batch that starts after this one
function finNextBatch(){
  try{const list=pwRunningList(),i=list.findIndex(s=>s.key===currentBatchKey());return i>=0&&list[i+1]?list[i+1].key:'';}catch(e){return '';}
}
function finChecks(){
  const r=finReady(),today=dateOnly(new Date());
  const open=r.sheds.filter(s=>!shedIsClosed(s));
  const dockets=(farmLoads||[]).filter(l=>l.date&&dateOnly(l.date)<=today&&l.actualKg==null&&Number(l.plannedKg)>0);
  const fmtD=d=>fmtShortNoYear(dateOnly(d));
  const L=[];
  L.push(r.stillIn.length?{ok:false,need:true,t:`Birds still in ${r.stillIn.length} shed${r.stillIn.length===1?'':'s'}`,s:r.stillIn.map(s=>{const fp=finalPickupOf(s);return `Shed ${s.id}${fp&&fp.date?' · final pickup '+fmtD(fp.date):' · no final pickup yet'}`;}).join(' · ')}
    :{ok:true,t:'All birds are out',s:`Last pickup Shed ${r.last.s.id}, ${fmtD(r.last.fp.date)}`});
  if(!r.stillIn.length)L.push(r.weighed?{ok:true,t:'Last pickup is weighed',s:`Shed ${r.last.s.id} kill sheet · ${Number(r.last.fp.birds).toLocaleString('en-US')} birds · ${(Number(r.last.fp.totalWeightKg)/Number(r.last.fp.birds)).toFixed(2)} kg`}
    :{ok:false,need:true,t:`Shed ${r.last.s.id}'s last pickup has no weight yet`,s:'Enter the kill-sheet weight in Pickups'});
  L.push(open.length?{ok:false,need:true,t:`${open.length} shed${open.length===1?'':'s'} still to close`,s:'Closing balances the mortality to the birds taken out',close:open.map(s=>s.id)}
    :{ok:true,t:`${r.sheds.length} of ${r.sheds.length} sheds closed`,s:'Mortality balanced in every shed'});
  L.push(dockets.length?{ok:false,warn:true,t:`${dockets.length} feed docket${dockets.length===1?'':'s'} missing`,s:dockets.slice(0,3).map(l=>`${fmtD(l.date)} · ${fmtFeed(Number(l.plannedKg)||0,1)} booked`).join(' · ')+' — the booked weight is used until the docket is in. You can still finish.'}
    :{ok:true,t:'Every feed docket is in',s:'Feed delivered is from the dockets'});
  return {list:L,canNext:!L.some(x=>x.need)};
}
function finPairs(){return activePairs().map(g=>({g,r:pairLeftovers()[g]||null,sheds:pairPlaced(g).map(s=>s.id)}));}
function finResults(){
  const rec=summarizeCurrentBatch();if(!rec)return null;
  const k=historyKpis(rec),key=finKey().toLowerCase();
  const prev=farmHistorySorted().find(r=>String(r.batch||'').trim().toLowerCase()!==key)||null,pk=prev?historyKpis(prev):null;
  let t=null;try{t=computeFarmTotals();}catch(e){}
  let sheds=[];try{const D=bevData();sheds=D?D.sheds:[];}catch(e){}
  const dockets=(farmLoads||[]).filter(l=>l.date&&l.actualKg==null&&Number(l.plannedKg)>0).length;
  return {rec,k,prev,pk,cage:t&&t.cage>0?t.cage:null,std:k.alw>0&&k.avgAge>0?bevStdAgeFor(k.alw)-k.avgAge:null,
    delivered:feedOrderedKg(),carry:carryoverTotalKg(),leftover:pairsLeftoverKg(),mort:Math.max(0,rec.placed-rec.picked),sheds,dockets};
}
// Plumo's verdict: the app's own numbers, no AI call
function finVerdict(R){
  const {k,pk,prev,sheds}=R,f3=v=>v.toFixed(3);let mood='calm',head='',parts=[];
  if(pk&&pk.cfcr>0){const d=k.cfcr-pk.cfcr;
    if(d<=-0.005){mood='happy';head=`cFCR ${f3(k.cfcr)} — ${f3(-d)} better than ${prev.batch||'last batch'}.`;}
    else if(d>=0.005){mood='thinking';head=`cFCR ${f3(k.cfcr)} — ${f3(d)} higher than ${prev.batch||'last batch'}.`;}
    else head=`cFCR ${f3(k.cfcr)} — about the same as ${prev.batch||'last batch'}.`;
    const dp=Math.round(k.pif-pk.pif);if(dp)parts.push(`PIF ${Math.round(k.pif)}, ${dp>0?'up':'down'} ${Math.abs(dp)}.`);
  }else{mood='happy';head=`cFCR ${f3(k.cfcr)} and PIF ${Math.round(k.pif)} — the first batch in Farm history to compare with.`;}
  const S=sheds.filter(s=>s.cfcr>0);
  if(S.length>1){const best=S.slice().sort((a,b)=>a.cfcr-b.cfcr)[0],worst=S.slice().sort((a,b)=>b.cfcr-a.cfcr)[0];
    if(best.id!==worst.id){parts.push(`Shed ${best.id} led the farm (cFCR ${best.cfcr.toFixed(2)}).`);
      const why=[];if(worst.std!=null&&worst.std<-0.5)why.push(`${Math.abs(worst.std).toFixed(1)} days behind ${stdName()}`);
      const mm=sheds.filter(s=>s.mort!=null).sort((a,b)=>b.mort-a.mort)[0];if(mm&&mm.id===worst.id)why.push('the most birds lost');
      parts.push(`Shed ${worst.id} was furthest behind (cFCR ${worst.cfcr.toFixed(2)}${why.length?', '+why.join(' and '):''}) — worth a look before the next batch goes in.`);}}
  if(R.dockets)parts.push(`${R.dockets} feed docket${R.dockets===1?' is':'s are'} still missing — the booked weight is used for now.`);
  return {mood,head,text:parts.join(' ')};
}

const FIN_IC={flag:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 22V4h13l-2 4 2 4H4"/></svg>',
  ok:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
  warn:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>',
  x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  silo:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4h12v11l-6 5-6-5z"/><path d="M6 9h12"/></svg>'};
const finFace=(mood,cls)=>window.PlumoFace?PlumoFace.html(mood,'fin-face'+(cls?' '+cls:'')):'';
function finSay(mood,html){return `<div class="fin-plumo">${finFace(mood)}<div class="fin-say">${html}</div></div>`;}

function finStep1(){
  const C=finChecks();
  const rows=C.list.map(c=>`<div class="fin-chk ${c.ok?'ok':c.warn?'w':'no'}"><span class="fin-d">${c.ok?FIN_IC.ok:c.warn?FIN_IC.warn:FIN_IC.x}</span><span class="fin-ct"><b>${escapeHtml(c.t)}</b><small>${escapeHtml(c.s)}</small>${c.close?`<span class="fin-acts">${c.close.map(id=>`<button type="button" class="fin-b" data-fin-close="${escapeAttr(String(id))}">Close Shed ${escapeHtml(String(id))}</button>`).join('')}</span>`:''}</span></div>`).join('');
  const need=C.list.filter(x=>x.need).length,warn=C.list.filter(x=>x.warn).length;
  const say=need?`${need===1?'One thing':need+' things'} to sort out before the batch can be finished.`:warn?`Nearly there — ${C.list.find(x=>x.warn).t.toLowerCase()}. You can finish now and add ${warn===1?'it':'them'} later.`:'Everything is in. Next, the leftover feed.';
  return {body:finSay(need?'thinking':'calm',escapeHtml(say))+`<div class="bev-panel fin-chks">${rows}</div>`,
    foot:`<span class="fin-sp"></span><span class="fin-note">${C.canNext?'':'Next opens once the red rows are done.'}</span><button type="button" class="fin-btn dk" data-fin-go="1"${C.canNext?'':' disabled'}>Next: leftover feed ›</button>`};
}
function finStep2(){
  const P=finPairs(),miss=P.filter(p=>!p.r),total=pairsLeftoverKg(),nx=finNextBatch();
  const optL=v=>{const o=LO_OPTS.find(x=>x[0]===String(v));return o?o[1]:'—';};
  const rows=P.map(({g,r,sheds})=>{
    const silos=r&&Array.isArray(r.silos)?r.silos.map((v,i)=>{const part=Number((r.parts||[])[i])||0;return `<span class="fin-silo"><small>Silo ${siloNumber(g,i+1)}</small><b>${escapeHtml(optL(v))}${part?' + '+escapeHtml(fmtFeed(part,1)):''}</b><em>${escapeHtml(fmtFeed((loKg(v)||0)+part,1))}</em></span>`;}).join(''):'';
    const when=r&&r.at?`entered ${fmtShortNoYear(dateOnly(new Date(r.at)))}`:'';
    return `<div class="fin-lo${r?'':' miss'}"><span class="fin-lo-h"><b>${escapeHtml(pairLabel(g))}</b><small>Silos ${siloNumber(g,1)}–${siloNumber(g,3)}</small></span>
      <span class="fin-lo-s">${r?(r.weighed?'<span class="fin-silo"><small>Weighed</small><b>All silos</b></span>':silos):'<span class="fin-lo-none">Not entered yet</span>'}<small class="fin-lo-src">${r?'Your entry · '+escapeHtml(when):'Enter what is still in this pair\'s silos'}</small></span>
      <span class="fin-lo-t">${r?`<b>${escapeHtml(fmtFeed(Number(r.kg)||0,1))}</b><button type="button" class="fin-b" data-fin-lo="${g}">Edit</button>`:`<button type="button" class="fin-b pri" data-fin-lo="${g}">Enter leftover</button>`}</span></div>`;}).join('');
  const say=miss.length?`I only use the leftover you entered. ${miss.map(p=>escapeHtml(pairLabel(p.g))).join(' and ')} ${miss.length===1?'has':'have'} none yet — enter ${miss.length===1?'it':'them'} to go on.`
    :`These are the leftovers you entered, silo by silo. Change any that the silos don't match — the total carries over to ${nx?'Batch '+escapeHtml(nx):'the next batch'}.`;
  const carry=`<div class="fin-carry"><span class="fin-ci">${FIN_IC.silo}</span><span><small>Carries over to ${nx?'Batch '+escapeHtml(nx):'the next batch'}</small><b>${miss.length?'—':escapeHtml(fmtFeed(total,1))}</b><em>${nx?`Its feed forecast takes this off the next loads (unless you typed a carry-over there yourself).`:'The next batch takes it as its carried-over feed when it starts.'}</em></span></div>`;
  return {body:finSay(miss.length?'thinking':'calm',say)+`<div class="bev-panel fin-los">${rows}</div>`+carry,
    foot:`<button type="button" class="fin-btn gh" data-fin-go="0">‹ Back</button><span class="fin-sp"></span><span class="fin-note">Step 3 shows the final results before anything is saved.</span><button type="button" class="fin-btn dk" data-fin-go="2"${miss.length?' disabled':''}>Next: results ›</button>`};
}
function finStep3(){
  const R=finResults();
  if(!R)return {body:finSay('thinking','I can\'t work out the results yet — fewer than half the birds have pickups with weights.'),foot:`<button type="button" class="fin-btn gh" data-fin-go="1">‹ Back</button>`};
  const {k,pk,rec}=R,V=finVerdict(R),f2=v=>v.toFixed(2),f3=v=>v.toFixed(3),N=v=>Math.round(v).toLocaleString('en-US');
  const pill=(cur,last,fmt,lower)=>{if(!(pk&&Number.isFinite(cur)&&Number.isFinite(last)&&last>0))return '';const d=cur-last;if(!/[1-9]/.test(fmt(Math.abs(d))))return '<span class="bev-pill n">same as last</span>';
    const better=lower==null?null:(lower?d<0:d>0);return `<span class="bev-pill ${better==null?'n':better?'g':'a'}">${d<0?'▼':'▲'} ${fmt(Math.abs(d))}${better==null?'':better?' better':' worse'}</span>`;};
  const card=(col,label,v,u,p,sub)=>`<div class="bev-k ${col} fin-k"><div class="bev-kh"><span>${label}</span></div><b class="fin-v">${v}${u?`<i>${u}</i>`:''}</b>${p||''}${sub?`<em class="fin-ks">${sub}</em>`:''}</div>`;
  const mortPct=rec.placed>0?R.mort/rec.placed*100:0,pMort=pk?100-pk.livability:null;
  const stdT=R.std==null?'—':(Math.abs(R.std)<0.05?'on':(R.std>0?'+':'−')+Math.abs(R.std).toFixed(1));
  const cards=card('blue','FCR',f3(k.fcr),'',pill(k.fcr,pk&&pk.fcr,f3,true))+card('blue','cFCR2.45',f3(k.cfcr),'',pill(k.cfcr,pk&&pk.cfcr,f3,true))
    +card('blue','CAge2.45',R.cage?R.cage.toFixed(1):'—',R.cage?'d':'',R.cage?`<span class="bev-pill ${R.cage<=frCageTarget()?'g':'a'}">target ${frCageTarget().toFixed(1)}${R.cage<=frCageTarget()?' · met':''}</span>`:'')
    +card('blue','PIF',String(Math.round(k.pif)),'',pill(k.pif,pk&&pk.pif,v=>String(Math.round(v)),false))
    +card('green','Average weight',k.alw.toFixed(3),'kg',pill(k.alw,pk&&pk.alw,v=>v.toFixed(3)+' kg',false))
    +card('green','Total live weight',N(rec.liveWeightKg/1000),'t','',N(rec.picked)+' birds out')
    +card('green','Avg age at pickup',k.avgAge.toFixed(1),'d',pill(k.avgAge,pk&&pk.avgAge,v=>v.toFixed(1)+' d',null))
    +card('green',`Weight vs ${escapeHtml(stdName())}`,stdT,R.std==null||Math.abs(R.std)<0.05?'':'d','',R.std==null?'':R.std>=-0.05?'ahead of standard':'behind standard')
    +card('amber','Feed eaten',escapeHtml(fmtFeed(rec.feedKg,1)),'',pill(rec.feedKg,R.prev&&R.prev.feedKg>0?R.prev.feedKg:NaN,v=>fmtFeed(v,0),null))
    +card('amber','Feed delivered',escapeHtml(fmtFeed(R.delivered,1)),'','',R.carry>0?'+ '+escapeHtml(fmtFeed(R.carry,1))+' carried in':'')
    +card('purple','Mortality',mortPct.toFixed(2),'%',pill(mortPct,pMort,v=>v.toFixed(2)+'%',true),N(R.mort)+' birds')
    +card('amber','Leftover feed',escapeHtml(fmtFeed(R.leftover,1)),'','',finNextBatch()?'carries over to Batch '+escapeHtml(finNextBatch()):'carries over to the next batch');
  const S=R.sheds,ext=(key,lower)=>{const v=S.map(s=>s[key]).filter(Number.isFinite);if(v.length<2)return {};const mn=Math.min(...v),mx=Math.max(...v);if(mn===mx)return {};return lower?{best:mn,worst:mx}:{best:mx,worst:mn};};
  const ex={alw:ext('alw',false),cfcr:ext('cfcr',true)},cl=(key,v)=>{const e=ex[key]||{};return v===e.best?' class="bev-best"':v===e.worst?' class="bev-worst"':'';};
  const table=S.length?`<div class="bev-panel"><div class="bev-ph"><b>Shed by shed</b><em>final · green best, red behind</em></div><div class="bev-tw"><table class="bev-st"><thead><tr><th>Shed</th><th>Birds out</th><th>Avg wt</th><th>vs ${growthStd()==='ross'?'Ross 308':'std'}</th><th>Mort.</th><th>FCR</th><th>cFCR</th><th>Live wt</th></tr></thead><tbody>${S.map(s=>`<tr><td>${s.id}</td><td>${s.out?N(s.out):'—'}</td><td${cl('alw',s.alw)}>${s.alw?s.alw.toFixed(3):'—'}</td><td>${s.std==null?'—':`<span class="bev-tag ${bevStdTone(s.std)}">${bevStdTxt(s.std,true)}</span>`}</td><td>${s.mort!=null?s.mort.toFixed(1)+'%':'—'}</td><td>${s.fcr>0?f2(s.fcr):'—'}</td><td${cl('cfcr',s.cfcr)}>${s.cfcr>0?f2(s.cfcr):'—'}</td><td>${s.kg>0?N(s.kg/1000)+' t':'—'}</td></tr>`).join('')}</tbody></table></div></div>`:'';
  const done=finDone();
  return {body:finSay(V.mood,`<b>${escapeHtml(V.head)}</b> ${escapeHtml(V.text)}`)+`<div class="bev-sh blue"><span class="bev-ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg></span><b>Final results</b><span class="bev-ln"></span>${R.prev?`<em>pills compare with batch ${escapeHtml(String(R.prev.batch||''))}</em>`:''}</div><div class="bev-grid fin-grid">${cards}</div>${table}`,
    foot:`<button type="button" class="fin-btn gh" data-fin-go="1">‹ Back</button><span class="fin-sp"></span><span class="fin-note">${done?`Finished ${escapeHtml(fmtShortNoYear(dateOnly(new Date(predState.batchFinal.at))))} · saving again updates Farm history`:`Saves Batch ${escapeHtml(finKey())} to Farm history · ${escapeHtml(fmtFeed(R.leftover,1))} carries over`}</span><button type="button" class="fin-btn pri" data-fin-finish>${FIN_IC.flag}${done?'Save again':'Finish batch '+escapeHtml(finKey())}</button>`};
}
function finRender(){
  const m=document.getElementById('finModal');if(!m||m.hidden||!finState)return;
  const dlg=m.querySelector('.fin-dlg'),keep=dlg.querySelector('.fin-body');const top=keep?keep.scrollTop:0;
  const step=finState.step,S=[finStep1,finStep2,finStep3][step](),names=['Check','Leftover feed','Results & finish'];
  const steps=names.map((n,i)=>`${i?'<span class="fin-sl"></span>':''}<span class="fin-st${i===step?' on':i<step?' dn':''}"><i>${i<step?FIN_IC.ok:i+1}</i><span>${n}</span></span>`).join('');
  dlg.innerHTML=`<div class="bev-hd fin-hd"><div class="bev-top"><span class="bev-tt"><small>Plumo · Finish batch ${escapeHtml(finKey())}</small><h2 id="finTitle">${names[step]} <span>· step ${step+1} of 3</span></h2></span><button type="button" class="bev-x" data-fin-x aria-label="Close" title="Close">✕</button></div><div class="fin-steps">${steps}</div></div>
    <div class="fin-body">${S.body}</div><div class="fin-foot">${S.foot}</div>`;
  const b=dlg.querySelector('.fin-body');if(b&&finState.keepScroll)b.scrollTop=top;finState.keepScroll=false;
}
function finOpen(step){
  let m=document.getElementById('finModal');
  if(!m){m=document.createElement('div');m.id='finModal';m.className='fin-ov';m.hidden=true;m.innerHTML='<div class="bev-dlg fin-dlg" role="dialog" aria-modal="true" aria-labelledby="finTitle" tabindex="-1"></div>';document.body.appendChild(m);}
  finState={step:step!=null?step:(finDone()?2:0)};
  m.hidden=false;document.body.classList.add('fin-open');finRender();m.querySelector('.fin-dlg').focus({preventScroll:true});
}
function finClose(){const m=document.getElementById('finModal');if(m)m.hidden=true;finState=null;document.body.classList.remove('fin-open');}
function finFinish(){
  if(!allPairsFinished()){finState.step=1;finRender();return;}
  applyFarmLeftoverFromPairs();
  let rec=null;try{rec=summarizeCurrentBatch();}catch(e){}
  if(!rec){showToast('Could not work out the results — check the pickups have weights.',true);return;}
  const key=finKey(),lk=key.toLowerCase(),hist=farmHistory();
  const i=hist.findIndex(r=>String(r.batch||'').trim().toLowerCase()===lk&&(r.source==='auto'||r.finished));
  rec.source='auto';rec.finished=true;rec.savedAt=Date.now();
  if(i>=0){rec.id=hist[i].id;hist[i]=rec;predState.farmHistory=hist;}else predState.farmHistory=hist.concat([rec]);
  pwPending()[key]='done';
  const first=!finDone();
  predState.batchFinal={at:first?Date.now():predState.batchFinal.at,updatedAt:Date.now(),leftoverKg:pairsLeftoverKg(),next:finNextBatch()||null};
  savePredState();schedulePush();if(typeof scheduleHistoryPush==='function')scheduleHistoryPush();
  if(typeof flushBeforeLeavingBatch==='function')flushBeforeLeavingBatch();   // to the cloud now, so a refresh can't bring the button back
  finClose();render();
  const nx=finNextBatch();
  showToast(first?`📚 Batch ${key} finished — saved to Farm history. ${fmtFeed(pairsLeftoverKg(),1)} carries over to ${nx?'Batch '+nx:'the next batch'}.`:`Batch ${key} saved again in Farm history.`);
  // the batch is closed: move on to the batch that's starting — this one is saved to the cloud first (2026-11-04)
  if(first&&nx&&typeof switchToBatch==='function')setTimeout(()=>{Promise.resolve(switchToBatch(nx)).then(()=>{if(String(currentBatchKey()).toLowerCase()===String(nx).toLowerCase())showToast(`Now on Batch ${nx}. Batch ${key} is closed and in Farm history.`);});},900);
}
// Home: Plumo's banner while the batch is ready, a slim line once it's finished
function finBannerHtml(){
  if(!farmData)return '';
  if(finDone()){const f=predState.batchFinal;
    return `<div class="fin-done-line"><span class="fin-d ok">${FIN_IC.ok}</span><span><b>Batch ${escapeHtml(finKey())} finished</b> ${escapeHtml(fmtShortNoYear(dateOnly(new Date(f.at))))} · saved to Farm history · ${escapeHtml(fmtFeed(Number(f.leftoverKg)||0,1))} leftover → ${f.next?'Batch '+escapeHtml(f.next):'next batch'}</span><button type="button" class="fin-b" data-fin-open="2">See results</button>${f.next?`<button type="button" class="fin-b pri" data-switch-batch="${escapeAttr(f.next)}">Go to Batch ${escapeHtml(f.next)}</button>`:`<button type="button" class="fin-b pri" data-fin-newbatch>Start the next batch</button>`}</div>`;}
  const r=finReady();if(!r.ready)return '';
  return `<section class="fin-banner">${finFace('happy')}<span class="fin-bt"><small>Plumo · Batch ${escapeHtml(finKey())}</small><b>All birds are out — Batch ${escapeHtml(finKey())} is ready to finish</b><span>Shed ${escapeHtml(String(r.last.s.id))}'s last pickup is weighed. Check the leftover feed and save the final results.</span></span>
    <span class="fin-bb"><button type="button" class="fin-btn pri" data-fin-open="0">${FIN_IC.flag}Finish batch ${escapeHtml(finKey())}</button></span></section>`;
}
// The pop-up opens by itself once a day while the batch is ready and not finished
function finMaybeAsk(){
  if(!farmData||finDone()||document.getElementById('finModal')&&!document.getElementById('finModal').hidden)return;
  if(document.querySelector('.sync-modal.open,.bev-ov:not([hidden]),.rs-scrim,.nf-win'))return;
  if(!finReady().ready)return;
  const k='pw-fin-asked-'+(syncFarmName||'')+'-'+finKey();let d='';try{d=localStorage.getItem(k)||'';}catch(e){}
  const today=iso(dateOnly(new Date()));if(d===today)return;
  try{localStorage.setItem(k,today);}catch(e){}
  setTimeout(()=>{if(!finDone()&&finReady().ready)finOpen(0);},600);
}
(function(){const prev=render;render=function(){const out=prev.apply(this,arguments);try{if(finState)finRender();else finMaybeAsk();}catch(e){console.warn('Finish batch',e);}return out;};})();
document.addEventListener('click',e=>{
  const t=e.target;if(!t.closest)return;
  if(t.closest('[data-fin-newbatch]')){if(typeof openNewBatchModal==='function')openNewBatchModal();return;}
  const o=t.closest('[data-fin-open]');if(o){e.preventDefault();finOpen(Number(o.dataset.finOpen)||0);return;}
  const m=document.getElementById('finModal');if(!m||m.hidden)return;
  if(t.closest('[data-fin-x]')){finClose();return;}
  const g=t.closest('[data-fin-go]');if(g&&!g.disabled){finState.step=Number(g.dataset.finGo)||0;finRender();const b=m.querySelector('.fin-body');if(b)b.scrollTop=0;return;}
  const c=t.closest('[data-fin-close]');if(c){finState.keepScroll=true;openCloseShedModal(c.dataset.finClose);return;}
  const l=t.closest('[data-fin-lo]');if(l){finState.keepScroll=true;openLeftoverModal(l.dataset.finLo);return;}
  if(t.closest('[data-fin-finish]')){finFinish();return;}
});
document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;const m=document.getElementById('finModal');if(!m||m.hidden)return;
  if(document.querySelector('.sync-modal.open'))return;   // Esc closes the window on top first
  e.stopPropagation();finClose();},true);
