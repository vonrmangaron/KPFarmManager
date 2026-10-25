// ── Daily report + Summarise (2026-10-25, mockup ERt6X8yqonhZLd2qXAnKGu) ──────────────────────────────────
// Replaces the ✨ Ask chat. Two things use the free AI on the farm's Cloudflare account (workers/prodwise-ai.js):
//  • the Daily report: pops up once a day from 7:00 and opens from 📋 in the header. Its numbers, priorities,
//    watch list and schedule come straight from the app (mgrBriefData); only the short summary is AI.
//  • Summarise: a button by the page title on the pages that benefit. Nothing is sent until it's tapped; the
//    result is kept for the day (tapping again is free), ↻ writes a fresh one. Tasks (CluckWise) uses the same
//    store through window.pwSum, so its Planner, Maintenance and Shed prep pages work the same way.
// No AI (offline, not set up, or the day's allowance used up): the report shows without its summary box, and
// Summarise says when the AI is back.
const AI_WORKER_URL='https://prodwise-ai.vonrmangaron.workers.dev';
let aiLeft=null;
function aiFarm(){return String(syncFarmName||'').trim();}
function aiSlug(){return aiFarm().toLowerCase().replace(/[^a-z0-9-]/g,'-');}
function aiDay(){return iso(mgrToday());}
function aiName(){return String((typeof cachedManager==='function'&&cachedManager())||'').trim().split(/\s+/)[0];}
async function aiCall(body){
  const r=await fetch(AI_WORKER_URL+'/ai/'+encodeURIComponent(aiSlug()),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({today:aiDay()},body))});
  let j=null;try{j=await r.json();}catch(e){}
  if(!r.ok){const err=new Error((j&&j.error)||('AI '+r.status));err.limit=!!(j&&j.limit)||r.status===429;err.setup=!!(j&&j.setup);err.status=r.status;throw err;}
  j=j||{};if(j.left!=null)aiLeft=j.left;
  if(j.text!=null&&typeof j.text!=='string')j.text=JSON.stringify(j.text);
  return j;
}
function aiResetTime(){const n=new Date(),u=new Date(Date.UTC(n.getUTCFullYear(),n.getUTCMonth(),n.getUTCDate()+1));return u.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});}
function aiErrText(e){
  if(!navigator.onLine)return 'Offline — the AI needs the internet.';
  if(e&&e.limit)return `The free AI allowance is used up for today. It's back at ${aiResetTime()}.`;
  if(e&&(e.setup||e.status===404||e.status===undefined))return 'The AI isn\'t set up on Cloudflare yet (prodwise-ai worker).';
  if(e&&e.status===403)return 'Only the manager can use the AI on this farm.';
  return 'The AI didn\'t answer just now. Try again in a moment.';
}
function aiLeftText(){return aiLeft!=null?` · ${aiLeft} left today`:'';}

// ---------- Daily report ----------
function rpKey(){return 'pw-report-'+aiSlug();}
function rpLoad(){try{const j=JSON.parse(localStorage.getItem(rpKey())||'null');if(j&&j.day===aiDay())return j;}catch(e){}return {day:aiDay(),seen:false,sum:null,err:null};}
function rpSave(x){try{localStorage.setItem(rpKey(),JSON.stringify(x));}catch(e){}}
function rpOn(){try{return localStorage.getItem('pw-greet-on')!=='0';}catch(e){return true;}}
function rpFacts(){
  if(!farmData||typeof mgrBriefData!=='function')return {G:{today:[],watch:[],feed:[],co:[]},cw:null,lines:[]};
  const d=mgrBriefData(),lines=[];
  [['Today',d.G.today],['Watch',d.G.watch],['Feed',d.G.feed],['Changeover & prep',d.G.co]].forEach(([g,a])=>a.forEach(x=>lines.push({grp:g,tone:x.tone,html:x.html,act:x.act,text:x.html.replace(/<[^>]+>/g,'').replace(/&amp;/g,'&')})));
  return {G:d.G,cw:d.cw,lines};
}
function rpFactsText(lines){const T={r:'red',a:'amber',b:'blue',g:'green'};return lines.map(l=>`[${T[l.tone]}] ${l.grp}: ${l.text}`).join('\n')||'Nothing special today.';}
function rpGo(act){
  const a=String(act||'');
  if(/data-mgr-loads/.test(a))return 'Feed loads';if(/data-mgr-pickups/.test(a))return 'Pickups';if(/data-mgr-mort/.test(a))return 'Mortality';
  if(/data-brief-cw="prep"/.test(a))return 'Shed prep';if(/data-brief-cw/.test(a))return 'Tasks';
  let m=a.match(/data-brief-pair="\d+:(\d+)"/);if(m)return 'Shed '+m[1];
  m=a.match(/data-tab="g(\d)"/);if(m)return pairLabel(Number(m[1]));return '';
}
function rpKpis(){
  const out=[],today=mgrToday();
  try{
    const sh=mgrPlaced(),placed=sh.reduce((n,s)=>n+(Number(s.initialPopulation)||0),0),live=sh.reduce((n,s)=>n+Math.max(0,liveAtStartOfDay(s,today)),0);
    const mort=sh.reduce((n,s)=>n+Math.max(0,Number(s.mortality)||0),0);
    out.push({k:'Birds on hand',v:live.toLocaleString('en-US'),s:`of ${placed.toLocaleString('en-US')}`});
    out.push({k:'Mortality',v:placed?(mort/placed*100).toFixed(2)+'%':'—',s:`${mort.toLocaleString('en-US')} birds`});
    const t=computeFarmTotals(),lr=typeof lastHistoryRec==='function'?lastHistoryRec():null,lk=lr&&typeof historyKpis==='function'?historyKpis(lr):null;
    if(t&&t.hasData){const d=lk&&Number.isFinite(lk.cfcr)&&lk.cfcr>0?t.cfcr-lk.cfcr:null;
      out.push({k:'Cfcr2.45 finish',v:Number(t.cfcr).toFixed(3),s:d==null?'projected':`${d<=0?'−':'+'}${Math.abs(d).toFixed(3)} vs ${escapeHtml(String(lr.batch||'last'))}`,tone:d==null?'':d<=0?'ok':'up'});}
    let sil=[];try{sil=mgrSiloOutlook().filter(x=>!(typeof pairAllClosed==='function'&&pairAllClosed(x.g)));}catch(e){}
    const lo=sil.filter(x=>x.dep).sort((a,b)=>a.dep-b.dep)[0];
    out.push(lo?{k:'Feed cover',v:`${lo.days} day${lo.days===1?'':'s'}`,s:`${pairLabel(lo.g)} lowest`,tone:lo.days<=3?'up':''}:{k:'Feed cover',v:'60+ days',s:'every pair',tone:'ok'});
  }catch(e){}
  return out;
}
function rpEnsureDom(){
  if(document.getElementById('rpModal'))return;
  document.body.insertAdjacentHTML('beforeend',`<div class="rp-scrim" id="rpModal" aria-hidden="true"><div class="rp" role="dialog" aria-modal="true" aria-labelledby="rpTitle"><div id="rpInner"></div></div></div>`);
  const m=document.getElementById('rpModal');
  m.addEventListener('click',e=>{if(e.target===m||e.target.closest('[data-rp-close]')){rpClose();return;}const go=e.target.closest('[data-rp-go]');if(go)rpClose();});
  m.addEventListener('change',e=>{if(e.target.matches('[data-rp-on]')){try{localStorage.setItem('pw-greet-on',e.target.checked?'1':'0');}catch(er){}}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&m.classList.contains('open'))rpClose();});
}
function rpHtml(st){
  const f=rpFacts(),now=new Date(),wx=f.cw&&f.cw.wx,who=aiName();
  let bd='';try{const pl=mgrPlaced();if(pl.length){const first=pl.map(s=>dateOnly(s.placementDate)).reduce((a,b)=>b<a?b:a);bd=`Batch ${escapeHtml(String(predState.batchNumber||farmData.batchNumber||''))} · day ${Math.max(0,mgrDays(first,mgrToday()))}`;}}catch(e){}
  const tm=now.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});
  const meta=[bd,wx?`${escapeHtml(wx.maxT)} / ${escapeHtml(wx.minT)}${wx.label?', '+escapeHtml(wx.label.toLowerCase()):''}`:'',`prepared${who?' for '+escapeHtml(who):''}, ${tm}`].filter(Boolean).join(' · ');
  const kp=rpKpis().map(k=>`<div><span>${escapeHtml(k.k)}</span><b>${k.v}</b><em class="${k.tone||''}">${k.s}</em></div>`).join('');
  const sum=st.sum?`<div class="rp-sum"><small>Summary <i>AI · check before acting</i></small><p>${escapeHtml(st.sum)}</p></div>`
    :st.err?'':`<div class="rp-sum loading"><small>Summary <i>writing…</i></small><div class="sm-load"><i></i><i></i><i></i></div></div>`;
  const row=(l,mark)=>{const go=rpGo(l.act);return l.act?`<button type="button" class="rp-it" data-rp-go ${l.act}><span class="rp-n ${l.tone}">${mark}</span><span>${l.html}</span><span class="rp-go">${go?escapeHtml(go)+' ›':''}</span></button>`:`<div class="rp-it"><span class="rp-n ${l.tone}">${mark}</span><span>${l.html}</span><span></span></div>`;};
  const pri=f.lines.filter(l=>l.tone==='r'),wat=f.lines.filter(l=>l.tone==='a'&&l.grp!=='Changeover & prep');
  const sec=(t,arr,mk)=>arr.length?`<div class="rp-sec"><h3>${t}</h3>${arr.map((l,i)=>row(l,mk(i))).join('')}</div>`:'';
  let sched='';try{sched=mgrWeekDays().slice(0,2).map((x,i)=>{const bits=[];
      x.pick.forEach(p=>bits.push(`${p.final?'Final pickup':'Pickup'} Shed ${p.shed}`));
      if(x.loads.length){const kg=x.loads.reduce((n,l)=>n+(l.actualKg!=null?Number(l.actualKg)||0:Number(l.plannedKg)||0),0);bits.push(`Feed ${x.loads.length>1?x.loads.length+' loads':'load'} ${mgrT(kg)}`);}
      mgrPlaced().forEach(s=>{if(!s.closed&&s.cleanoutDate&&iso(dateOnly(s.cleanoutDate))===iso(x.date))bits.push(`Shed ${s.id} clean-out`);});
      if(i===0&&f.cw&&f.cw.today)bits.push(`${f.cw.today} task${f.cw.today===1?'':'s'} (${f.cw.done} done)`);
      return `<div class="rp-day"><b>${i===0?'Today':'Tomorrow'}</b><div>${bits.length?escapeHtml(bits.join(' · ')):'Nothing booked'}</div></div>`;}).join('');}catch(e){}
  const prep=f.lines.filter(l=>l.grp==='Changeover & prep'&&/prep/i.test(l.text));
  const quiet=!pri.length&&!wat.length?'<div class="rp-sec"><h3>Priorities today</h3><p class="rp-quiet">Nothing urgent — every shed, silo and task is on track.</p></div>':'';
  return `<div class="rp-h"><div class="rp-ht"><small>Daily report${typeof farmDisplayName!=='undefined'&&farmDisplayName?' · '+escapeHtml(farmDisplayName):''}</small><h2 id="rpTitle">${escapeHtml(now.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'}))}</h2><div class="rp-m">${meta}</div></div><button type="button" class="rp-x" data-rp-close aria-label="Close" title="Close">✕</button></div>
    ${kp?`<div class="rp-kpi">${kp}</div>`:''}
    <div class="rp-b">${sum}${quiet}${sec('Priorities today',pri,i=>i+1)}${sec('Watch',wat,()=>'!')}
      ${sched?`<div class="rp-sec"><h3>Schedule</h3><div class="rp-sched">${sched}</div></div>`:''}
      ${sec('Shed prep',prep,()=>'✓')}</div>
    <div class="rp-f"><span>Numbers from ProdWise${f.cw?' and Tasks':''} at ${tm}${st.err?' · '+escapeHtml(st.err):''}</span><label class="rp-on"><input type="checkbox" data-rp-on ${rpOn()?'checked':''}> Show at 7:00</label><button type="button" class="rp-done" data-rp-close>Done</button></div>`;
}
async function rpOpen(){
  if(!farmData)return;
  rpEnsureDom();
  const m=document.getElementById('rpModal'),inner=document.getElementById('rpInner');
  const st=rpLoad();st.seen=true;rpSave(st);rpDot();
  inner.innerHTML=rpHtml(st);m.classList.add('open');m.setAttribute('aria-hidden','false');
  if(!st.sum&&!st.err){
    try{const j=await aiCall({mode:'greet',name:aiName(),facts:rpFactsText(rpFacts().lines)});st.sum=String(j.text||'').trim()||null;if(!st.sum)st.err='No summary today';}
    catch(e){st.err=aiErrText(e);}
    rpSave(st);
    if(m.classList.contains('open'))inner.innerHTML=rpHtml(st);
  }
}
function rpClose(){const m=document.getElementById('rpModal');if(!m)return;m.classList.remove('open');m.setAttribute('aria-hidden','true');}
function rpDot(){const st=rpLoad(),on=!!farmData&&new Date().getHours()>=7&&!st.seen;const d=document.getElementById('reportDot');if(d)d.hidden=!on;}
function rpPlaceButton(){
  if(document.getElementById('reportBtn'))return;
  const bell=document.querySelector('#pageHeader .alerts-bell-wrap');if(!bell)return;
  bell.insertAdjacentHTML('beforebegin',`<button type="button" class="report-btn" id="reportBtn" title="Daily report" aria-label="Daily report"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4h6l1 2h2a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h2z"/><path d="M9 11h6M9 15h4"/></svg><span class="report-dot" id="reportDot" hidden></span></button>`);
  document.getElementById('reportBtn').addEventListener('click',rpOpen);
}
let rpTried=false;
function rpMaybeShow(){
  if(rpTried||!farmData||!aiFarm()||!rpOn()||new Date().getHours()<7)return;
  if(rpLoad().seen)return;
  rpTried=true;
  const go=()=>{try{rpOpen();}catch(e){}};
  let ready=false;try{ready=!!(cwFrame&&cwFrame.contentWindow&&cwFrame.contentWindow.__cwBrief);}catch(e){}
  if(ready)go();else if(typeof pwEnsureTasksFrame==='function'){let done=false;const once=()=>{if(!done){done=true;go();}};pwEnsureTasksFrame(once);setTimeout(once,8000);}else go();
}

// ---------- Summarise ----------
function smKey(){return 'pw-sum-'+aiSlug();}
function smLoad(){try{const j=JSON.parse(localStorage.getItem(smKey())||'null');if(j&&j.day===aiDay())return j;}catch(e){}return {day:aiDay(),items:{},hidden:{}};}
function smSave(x){try{localStorage.setItem(smKey(),JSON.stringify(x));}catch(e){}}
// Bullets "- [red] text" → [{tone,text}]
function smParse(text){
  return String(text||'').split(/\n/).map(l=>l.trim()).filter(l=>/^[-*•]\s+/.test(l)).map(l=>{l=l.replace(/^[-*•]\s+/,'');const m=l.match(/^\[(red|amber|green|blue)\]\s*/i);
    return {tone:m?{red:'r',amber:'a',green:'g',blue:'b'}[m[1].toLowerCase()]:'g',text:m?l.slice(m[0].length):l};}).filter(x=>x.text).slice(0,5);
}
const smInl=x=>escapeHtml(x).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>');
// The shared store and AI call — Tasks uses this too (window.pwSum)
const pwSum={
  get(key){const s=smLoad();return s.hidden[key]?null:s.items[key]||null;},
  cached(key){return smLoad().items[key]||null;},
  show(key){const s=smLoad();delete s.hidden[key];smSave(s);},
  hide(key){const s=smLoad();s.hidden[key]=true;smSave(s);},
  async run(key,page,context,sheds){
    pwSum.show(key);
    let item;
    try{const j=await aiCall({mode:'summary',page,context,sheds:sheds||null});
      if(sheds&&sheds.length){let o=null;const t=String(j.text||''),a=t.indexOf('{'),z=t.lastIndexOf('}');try{o=JSON.parse(t.slice(a,z+1));}catch(e){}
        item=o&&o.sheds&&typeof o.sheds==='object'?{pair:String(o.pair||''),sheds:o.sheds,at:Date.now()}:{lines:smParse(j.text),at:Date.now()};}
      else item={lines:smParse(j.text),at:Date.now()};
      if(!item.sheds&&!(item.lines||[]).length)item={lines:[{tone:'g',text:String(j.text||'').trim().slice(0,400)}],at:Date.now()};
      const s2=smLoad();s2.items[key]=item;smSave(s2);}
    catch(e){item={err:aiErrText(e),at:Date.now()};}
    return item;
  },
  card(item,title,key){return smCardHtml(item,title,key);},
};
window.pwSum=pwSum;
function smCardHtml(item,title,key){
  const t=new Date(item&&item.at||Date.now()).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});
  const head=`<div class="sm-h"><b>Summary · ${escapeHtml(title)}</b><small>${item&&item.busy?'writing…':item&&item.err?'':t}</small>${item&&!item.busy?`<button type="button" class="sm-ib" data-sm-again="${escapeAttr(key)}" title="Write it again (uses the free AI allowance)" aria-label="Write again">↻</button>`:''}<button type="button" class="sm-ib" data-sm-hide="${escapeAttr(key)}" title="Hide" aria-label="Hide">✕</button></div>`;
  let body='';
  if(!item||item.busy)body='<div class="sm-load"><i></i><i></i><i></i></div>';
  else if(item.err)body=`<p class="sm-err">${escapeHtml(item.err)}</p>`;
  else if(item.sheds)body=`<p>${smInl(item.pair||'A note for each shed is in its card below.')}</p>`;
  else body=`<ul>${(item.lines||[]).map(l=>`<li><span class="sm-d ${l.tone}"></span><span>${smInl(l.text)}</span></li>`).join('')}</ul>`;
  return `<section class="sm-card" data-sm-card="${escapeAttr(key)}">${head}${body}${item&&!item.busy&&!item.err?`<span class="sm-f">AI summary of this page · check before acting${aiLeftText()}</span>`:''}</section>`;
}
// Which page is showing, and what to send for it
function smPage(){
  if(!farmData)return null;
  const tool=typeof toolPageOpen!=='undefined'?toolPageOpen:null;
  if(tool==='loadsModal')return {key:'loads',title:'Feed loads',anchor:()=>document.getElementById('loadsBody')};
  if(tool==='pickupsModal')return {key:'pickups-all',title:'Pickups',anchor:()=>document.querySelector('#pickupsModal .compare-modal-body')};
  if(tool)return null;
  if(activeTab==='dashboard')return {key:'results',title:'Result detail',anchor:()=>document.getElementById('app')};
  const m=/^g([1-4])$/.exec(activeTab);if(!m)return null;
  const g=Number(m[1]),view=shedViewByGroup[g]||'overview';
  const T={overview:'Overview',planner:'Feed & silo',pickups:'Pickups',growth:'Growth'};if(!T[view])return null;
  return {key:`g${g}:${view}`,title:`${pairLabel(g)} · ${T[view]}`,g,view,sheds:view==='overview'?shedsForGroup(g).filter(s=>s.placementDate).map(s=>s.id):null,anchor:()=>document.getElementById('app')};
}
function smShedLine(s,today){
  const age=ageInDays(s,today),live=Math.max(0,liveAtStartOfDay(s,today)),pop=Number(s.initialPopulation)||0,mort=Math.max(0,Number(s.mortality)||0);
  let g='';try{const f=forecastWeightModeAware(s,today);const dv=f&&f.kg!=null?daysVsTarget(age,f.kg):null;if(dv!=null)g=` · weight ${f.kg.toFixed(2)} kg, ${Math.abs(dv)<0.5?'on target':dv>0?dv.toFixed(1)+' days ahead':(-dv).toFixed(1)+' days behind'}`;}catch(e){}
  const nx=mgrComingPickups(s);
  return `Shed ${s.id}: ${s.closed?'closed':'day '+age} · ${live.toLocaleString('en-US')} birds of ${pop.toLocaleString('en-US')} · mortality ${mort.toLocaleString('en-US')} (${pop?(mort/pop*100).toFixed(2):'0'}%)${s.mortalityUpdatedAt?', updated '+fmtShortNoYear(s.mortalityUpdatedAt):''}${g}${nx.length?' · pickups to come: '+nx.slice(0,4).map(p=>`${fmtShortNoYear(p.date)} ${p.birds.toLocaleString('en-US')}${p.planned?' (planned)':''}`).join(', '):''}${s.cleanoutDate?' · clean-out '+fmtShortNoYear(s.cleanoutDate):''}`;
}
function smContext(p){
  const today=mgrToday(),out=[];
  try{
    out.push(`BATCH ${predState.batchNumber||farmData.batchNumber||''} · today ${fmtShortNoYear(today)}`);
    if(p.key==='results'){
      const t=computeFarmTotals();if(t&&t.hasData)out.push(`Projected at finish: FCR ${Number(t.fcr).toFixed(3)}, Cfcr2.45 ${Number(t.cfcr).toFixed(3)}`);
      const lr=typeof lastHistoryRec==='function'?lastHistoryRec():null,lk=lr&&typeof historyKpis==='function'?historyKpis(lr):null;
      if(lk)out.push(`Last batch ${lr.batch||''}: ${Object.entries(lk).filter(([k,v])=>typeof v==='number'&&Number.isFinite(v)).slice(0,10).map(([k,v])=>`${k} ${Math.abs(v)<10?v.toFixed(3):Math.round(v)}`).join(', ')}`);
      out.push('SHEDS:',...mgrPlaced().map(s=>'- '+smShedLine(s,today)));
      return out.join('\n');
    }
    if(p.key==='loads'||p.key==='pickups-all'){
      out.push('SILOS (run-out with booked loads):');mgrSiloOutlook().forEach(x=>out.push(`- ${pairLabel(x.g)}: ${x.dep?'run low '+fmtShortNoYear(x.dep)+' (in '+x.days+' days)':'covered for 60+ days'}${x.stock!=null?' · '+mgrT(x.stock)+' in silos at last reading':''}${x.readAge!=null?' · read '+x.readAge+' days ago':''}`));
      const wk=mgrWeek();out.push('LOADS & PICKUPS · next 7 days:',...(wk.length?wk.map(w=>`- ${fmtShortNoYear(w.date)}: ${w.text}`):['- none']));
      let sum=null;try{sum=farmLoadsSummary();}catch(e){}if(sum&&sum.needsActual)out.push(`${sum.needsActual} delivered load(s) still need docket weights`);
      if(p.key==='pickups-all')out.push('SHEDS:',...mgrPlaced().map(s=>'- '+smShedLine(s,today)));
      return out.join('\n');
    }
    const sh=shedsForGroup(p.g).filter(s=>s.placementDate);
    out.push(`${pairLabel(p.g)}:`,...sh.map(s=>'- '+smShedLine(s,today)));
    const x=mgrSiloOutlook().find(y=>y.g===p.g);if(x)out.push(`Silos: ${x.dep?'run low '+fmtShortNoYear(x.dep)+' (in '+x.days+' days, with booked loads)':'covered for 60+ days'}${x.stock!=null?' · '+mgrT(x.stock)+' in silos at last reading':''}`);
    if(p.view==='planner'){let perDay=0;sh.forEach(s=>{perDay+=shedFeedOn(s,today)||0;});out.push(`Eating about ${mgrT(perDay)} a day now`);
      const ls=farmLoads.filter(l=>l.date&&dateOnly(l.date)>=today&&Number(l.splitKg&&l.splitKg[p.g])>0).slice(0,6);out.push('Booked loads for this pair:',...(ls.length?ls.map(l=>`- ${fmtShortNoYear(l.date)} ${mgrT(Number(l.splitKg[p.g]))}${l.feedType?' '+l.feedType:''}`):['- none']));}
    if(p.view==='growth'){sh.forEach(s=>{try{[7,14,21].forEach(k=>{const d=addDays(today,k),f=forecastWeightModeAware(s,d);if(f&&f.kg!=null)out.push(`Shed ${s.id} forecast ${fmtShortNoYear(d)} (day ${ageInDays(s,d)}): ${f.kg.toFixed(2)} kg`);});}catch(e){}});}
    if(typeof pairNeeds==='function'){try{const n=pairNeeds(p.g);if(n&&n.length)out.push('Flagged on this page:',...n.map(z=>`- ${String(z.title||'').replace(/<[^>]+>/g,'')}${z.sub?' — '+String(z.sub).replace(/<[^>]+>/g,''):''}`));}catch(e){}}
  }catch(e){out.push('(some numbers could not be read)');}
  return out.join('\n');
}
// Put the button and any saved summary on the page after each render
function smApply(){
  const p=smPage(),hdr=document.querySelector('#pageHeader .page-header-left');
  let btn=document.getElementById('smBtn');
  if(!p){if(btn)btn.hidden=true;return;}
  if(!btn&&hdr){hdr.insertAdjacentHTML('beforeend',`<button type="button" class="sm-btn" id="smBtn" title="Summarise this page with the free AI"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h7"/><path d="M18 14l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/></svg><span>Summarise</span></button>`);btn=document.getElementById('smBtn');btn.addEventListener('click',()=>smTap());}
  if(btn)btn.hidden=false;
  const it=pwSum.get(p.key);if(it)smShow(p,it);
}
function smShow(p,item){
  const anchor=p.anchor&&p.anchor();if(!anchor)return;
  const card=anchor.querySelector(':scope > [data-sm-card]');
  const html=smCardHtml(item,p.title,p.key);
  if(card)card.outerHTML=html;else anchor.insertAdjacentHTML('afterbegin',html);
  document.querySelectorAll('.sm-shed').forEach(x=>x.remove());
  if(item&&item.sheds)Object.entries(item.sheds).forEach(([id,txt])=>{const el=document.querySelector(`#pair-shed-${CSS.escape(String(id))} .pair-shed-head`);if(el&&txt)el.insertAdjacentHTML('afterend',`<div class="sm-shed"><small>Summary</small>${smInl(String(txt))}</div>`);});
}
let smBusy=false;
async function smTap(again){
  const p=smPage();if(!p||smBusy)return;
  const cached=pwSum.cached(p.key);
  if(cached&&!again&&!cached.err){pwSum.show(p.key);smShow(p,cached);return;}
  smBusy=true;smShow(p,{busy:true});
  const item=await pwSum.run(p.key,p.title,smContext(p),p.sheds);
  smBusy=false;const now=smPage();if(now&&now.key===p.key)smShow(p,item);
}
document.addEventListener('click',e=>{
  if(!e.target.closest)return;
  const a=e.target.closest('#app [data-sm-again], .compare-modal [data-sm-again]');if(a){smTap(true);return;}
  const h=e.target.closest('#app [data-sm-hide], .compare-modal [data-sm-hide]');if(h){pwSum.hide(h.dataset.smHide);const c=h.closest('[data-sm-card]');if(c)c.remove();document.querySelectorAll('.sm-shed').forEach(x=>x.remove());}
});

document.addEventListener('DOMContentLoaded',()=>{rpPlaceButton();rpDot();setTimeout(rpMaybeShow,2500);});
setInterval(()=>{if(document.visibilityState!=='visible')return;rpPlaceButton();rpDot();rpMaybeShow();},30000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){rpTried=false;setTimeout(rpMaybeShow,1500);}});
