// ── Morning greeting + ✨ Ask (2026-10-25, mockup 9EcTR653QyiqCQs1WMXhXN) ──────────────────────────────
// From 7:00, the first time the app opens that day, a greeting pops up: a short paragraph written by a free AI
// model on the farm's Cloudflare account (workers/prodwise-ai.js) from today's facts, with the facts as chips.
// Closed, it stays away until tomorrow; ✨ Ask in the header (and in Tasks) opens one shared panel with this
// morning's greeting and a chat. One chat for Production and Tasks: the panel lives here and Tasks opens it
// through window.pwOpenAsk. Chats are kept on this device (localStorage, per farm).
// No AI (offline, not set up, or the free allowance used up for the day): the plain fact lines show instead.
const AI_WORKER_URL='https://prodwise-ai.vonrmangaron.workers.dev';
const ASK_MAX=80;
let askBusy=false,askLeft=null;
function askFarm(){return String(syncFarmName||'').trim();}
function askKey(){return 'pw-ask-'+(typeof accSlug==='function'?accSlug():askFarm().toLowerCase());}
function askDayKey(){return iso(mgrToday());}
function askLoad(){try{const j=JSON.parse(localStorage.getItem(askKey())||'null');if(j&&Array.isArray(j.msgs))return j;}catch(e){}return {msgs:[],greet:null};}
function askSave(st){st.msgs=st.msgs.slice(-ASK_MAX);try{localStorage.setItem(askKey(),JSON.stringify(st));}catch(e){}}
function askGreetOn(){try{return localStorage.getItem('pw-greet-on')!=='0';}catch(e){return true;}}
function askSetGreetOn(v){try{localStorage.setItem('pw-greet-on',v?'1':'0');}catch(e){}}
function askName(){return String((typeof cachedManager==='function'&&cachedManager())||'').trim().split(/\s+/)[0];}
// Today's facts as plain lines (the same rules the briefing used)
function askFacts(){
  if(!farmData||typeof mgrBriefData!=='function')return {lines:[],text:'',cw:null};
  const d=mgrBriefData(),lines=[];
  const add=(grp,arr)=>arr.forEach(x=>lines.push({grp,tone:x.tone,html:x.html,act:x.act,text:x.html.replace(/<[^>]+>/g,'').replace(/&amp;/g,'&')}));
  add('Today',d.G.today);add('Watch',d.G.watch);add('Feed',d.G.feed);add('Changeover & prep',d.G.co);
  const TN={r:'red',a:'amber',b:'blue',g:'green'};
  return {lines,cw:d.cw,text:lines.map(l=>`[${TN[l.tone]}] ${l.grp}: ${l.text}`).join('\n')||'Nothing special today.'};
}
// Production numbers as short text for the AI (plus Tasks' own summary)
function askContext(){
  const out=[],today=mgrToday();
  try{
    const t=computeFarmTotals(),placed=mgrPlaced();
    const first=placed.length?placed.map(s=>dateOnly(s.placementDate)).reduce((a,b)=>b<a?b:a):null;
    out.push(`BATCH: ${predState.batchNumber||farmData.batchNumber||'?'}${first?' · day '+Math.max(0,mgrDays(first,today)):''} · ${placed.length} sheds placed`);
    if(t&&t.hasData)out.push(`KPIs: projected FCR at finish ${Number(t.fcr).toFixed(3)} · projected Cfcr2.45 ${Number(t.cfcr).toFixed(3)}`);
    out.push('SHEDS:');
    placed.forEach(s=>{const age=ageInDays(s,today),live=Math.max(0,liveAtStartOfDay(s,today)),pop=Number(s.initialPopulation)||0,mort=Math.max(0,Number(s.mortality)||0);
      let g='';try{const f=forecastWeightModeAware(s,today);const dv=f&&f.kg!=null?daysVsTarget(age,f.kg):null;if(dv!=null)g=` · weight ${f.kg.toFixed(2)} kg, ${Math.abs(dv)<0.5?'on target':dv>0?dv.toFixed(1)+' days ahead':(-dv).toFixed(1)+' days behind'}`;}catch(e){}
      const nx=mgrComingPickups(s)[0];
      out.push(`- Shed ${s.id}: ${s.closed?'closed':'day '+age} · ${live.toLocaleString('en-US')} birds of ${pop.toLocaleString('en-US')} placed · mortality ${mort.toLocaleString('en-US')} (${pop?(mort/pop*100).toFixed(1):'0'}%)${g}${nx?' · next pickup '+fmtShortNoYear(nx.date)+' '+nx.birds.toLocaleString('en-US')+' birds'+(nx.planned?' (planned)':''):''}${s.cleanoutDate?' · clean-out '+fmtShortNoYear(s.cleanoutDate):''}`);});
    out.push('SILOS (run-out with booked loads):');
    mgrSiloOutlook().forEach(x=>out.push(`- ${pairLabel(x.g)}: ${x.dep?'run low '+fmtShortNoYear(x.dep)+' (in '+x.days+' days)':'no run-out in the next 60 days'}${x.stock!=null?' · '+mgrT(x.stock)+' in silos at the last reading':''}`));
    const wk=mgrWeek();out.push('FEED LOADS & PICKUPS · next 7 days:',...(wk.length?wk.map(w=>`- ${fmtShortNoYear(w.date)}: ${w.text}`):['- none booked']));
  }catch(e){out.push('(some production numbers could not be read)');}
  try{const w=cwFrame&&cwFrame.contentWindow;if(w&&typeof w.__cwAskContext==='function')out.push(w.__cwAskContext());}catch(e){}
  return out.join('\n');
}
async function askCall(body){
  const r=await fetch(AI_WORKER_URL+'/ai/'+encodeURIComponent(askFarm().toLowerCase().replace(/[^a-z0-9-]/g,'-')),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  let j=null;try{j=await r.json();}catch(e){}
  if(!r.ok){const err=new Error((j&&j.error)||('AI '+r.status));err.limit=!!(j&&j.limit)||r.status===429;err.setup=!!(j&&j.setup);err.status=r.status;throw err;}
  if(j&&j.left!=null)askLeft=j.left;
  return j||{};
}
function askResetTime(){const n=new Date(),u=new Date(Date.UTC(n.getUTCFullYear(),n.getUTCMonth(),n.getUTCDate()+1));return u.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});}
function askErrText(e){
  if(!navigator.onLine)return 'You\'re offline — the AI needs the internet.';
  if(e&&e.limit)return `The free AI allowance is used up for today. It comes back at ${askResetTime()}.`;
  if(e&&(e.setup||e.status===404||e.status===undefined||e.message==='Failed to fetch'))return 'The AI isn\'t set up yet on Cloudflare (the prodwise-ai worker).';
  if(e&&e.status===403)return 'Only the manager can use Ask on this farm.';
  return 'The AI didn\'t answer just now. Try again in a moment.';
}
// ---------- UI ----------
function askChipsHtml(lines){return lines.map(l=>`<button type="button" class="ak-chip ${l.tone}" ${l.act||''} data-ak-close title="${escapeAttr(l.text)}"><i></i>${escapeHtml(l.text.length>34?l.text.slice(0,32)+'…':l.text)}</button>`).join('');}
function askFactsHtml(lines){return lines.length?`<div class="ak-facts">${lines.map(l=>`<div class="ak-fact"><i class="bf-dot ${l.tone}"></i><span>${l.html}</span></div>`).join('')}</div>`:'<p class="ak-quiet">Nothing special today — every shed, silo and task is on track.</p>';}
function askEnsureDom(){
  if(document.getElementById('akGreet'))return;
  document.body.insertAdjacentHTML('beforeend',`
  <div class="ak-scrim" id="akGreet" aria-hidden="true"><div class="ak-greet" role="dialog" aria-modal="true" aria-labelledby="akGreetTitle">
    <div class="ak-gtop"><button type="button" class="ak-x" data-ak-close aria-label="Close" title="Close">✕</button><small id="akGreetDate"></small><h2 id="akGreetTitle"></h2><div class="ak-wx" id="akGreetWx"></div></div>
    <div class="ak-gbody"><div class="ak-ai"><span class="ak-av" aria-hidden="true">✨</span><div class="ak-p" id="akGreetText"></div></div>
      <div class="ak-chips" id="akGreetChips"></div>
      <form class="ak-in" data-ak-form><input type="text" maxlength="300" placeholder="Ask about the farm…" aria-label="Ask about the farm"><button type="submit" class="ak-send" aria-label="Ask" title="Ask">↑</button></form>
      <div class="ak-sugg" data-ak-sugg></div>
      <button type="button" class="ak-ok" data-ak-close>Thanks — let's go</button></div>
    <div class="ak-gfoot"><span id="akGreetFoot">✨ Written by AI from today's numbers — check before acting</span><span>Back anytime: ✨ Ask</span></div>
  </div></div>
  <div class="ak-pscrim" id="akPanelScrim"></div>
  <aside class="ak-panel" id="akPanel" role="dialog" aria-modal="true" aria-labelledby="akPanelTitle" aria-hidden="true">
    <div class="ak-ph"><span class="ak-pav" aria-hidden="true">✨</span><b id="akPanelTitle">Ask the farm</b>
      <button type="button" class="ak-ib" id="akMenuBtn" aria-label="Options" title="Morning greeting · clear chat">⋯</button>
      <button type="button" class="ak-ib" id="akPanelClose" aria-label="Close" title="Close">✕</button>
      <div class="ak-menu" id="akMenu" hidden><label class="ak-mi"><input type="checkbox" id="akGreetOn"> Morning greeting from 7:00 on this device</label><button type="button" class="ak-mi danger" id="akClear">Clear this chat</button></div></div>
    <div class="ak-msgs" id="akMsgs"></div>
    <div class="ak-pf"><div class="ak-sugg" data-ak-sugg></div><form class="ak-in" data-ak-form><input type="text" maxlength="300" placeholder="Ask about the farm…" aria-label="Ask about the farm"><button type="submit" class="ak-send" aria-label="Ask" title="Ask">↑</button></form><span class="ak-lim" id="akLim"></span></div>
  </aside>`);
  const SUG=['What should I do first today?','Which sheds need attention this week?','When do the silos run low?','What\'s still left in shed prep?'];
  document.querySelectorAll('[data-ak-sugg]').forEach(x=>x.innerHTML=SUG.map(q=>`<button type="button" class="ak-s" data-ak-q="${escapeAttr(q)}">${escapeHtml(q)}</button>`).join(''));
  const g=document.getElementById('akGreet');
  g.addEventListener('click',e=>{if(e.target===g||e.target.closest('[data-ak-close]'))askCloseGreet();});
  document.addEventListener('submit',e=>{const f=e.target.closest&&e.target.closest('[data-ak-form]');if(!f)return;e.preventDefault();const i=f.querySelector('input'),q=i.value.trim();if(!q)return;i.value='';askOpen();askSend(q);});
  document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-ak-q]');if(!b)return;askOpen();askSend(b.dataset.akQ);});
  document.getElementById('akPanelClose').addEventListener('click',askClosePanel);
  document.getElementById('akPanelScrim').addEventListener('click',askClosePanel);
  document.getElementById('akMenuBtn').addEventListener('click',()=>{const m=document.getElementById('akMenu');m.hidden=!m.hidden;document.getElementById('akGreetOn').checked=askGreetOn();});
  document.getElementById('akGreetOn').addEventListener('change',e=>{askSetGreetOn(e.target.checked);showToast(e.target.checked?'Morning greeting on for this device.':'Morning greeting off for this device — ✨ Ask still works.');});
  document.getElementById('akClear').addEventListener('click',()=>{const st=askLoad();st.msgs=[];askSave(st);document.getElementById('akMenu').hidden=true;askRender();});
  document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(document.getElementById('akGreet').classList.contains('open'))askCloseGreet();else if(document.getElementById('akPanel').classList.contains('open'))askClosePanel();});
}
function askSetDot(){   // amber dot: today's greeting not read yet (from 7:00)
  const st=askLoad(),on=!!farmData&&new Date().getHours()>=7&&!(st.greet&&st.greet.day===askDayKey()&&st.greet.seen);
  const d=document.getElementById('askDot');if(d)d.hidden=!on;
  try{cwFrame&&cwFrame.contentWindow&&cwFrame.contentWindow.__cwAskDot&&cwFrame.contentWindow.__cwAskDot(on);}catch(e){}
}
function askMarkSeen(){const st=askLoad();if(st.greet&&st.greet.day===askDayKey()){st.greet.seen=true;askSave(st);}askSetDot();}
// The greeting for today: AI words when available, otherwise the plain facts
async function askMakeGreeting(force){
  const st=askLoad(),day=askDayKey();
  if(!force&&st.greet&&st.greet.day===day&&st.greet.text)return st.greet;
  const f=askFacts();
  const g={day,facts:f.lines.map(l=>({tone:l.tone,html:l.html,act:l.act,text:l.text})),text:'',ai:false,seen:false,at:Date.now()};
  try{const j=await askCall({mode:'greet',name:askName(),facts:f.text,today:day});if(j.text){g.text=j.text;g.ai=true;}}catch(e){g.err=askErrText(e);}
  const s2=askLoad();s2.greet=g;
  if(g.ai){s2.msgs=s2.msgs.filter(m=>!(m.r==='greet'&&m.day===day));s2.msgs.push({r:'greet',t:g.text,day,at:Date.now()});}
  askSave(s2);return g;
}
function askGreetHead(){
  const now=new Date(),h=now.getHours(),who=askName(),f=askFacts(),w=f.cw&&f.cw.wx;
  document.getElementById('akGreetDate').textContent=now.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
  document.getElementById('akGreetTitle').textContent=`Good ${h<12?'morning':h<18?'afternoon':'evening'}${who?', '+who:''} ${w&&w.icon?w.icon:h<18?'☀️':'🌙'}`;
  let day='';try{const pl=mgrPlaced();if(pl.length){const first=pl.map(s=>dateOnly(s.placementDate)).reduce((a,b)=>b<a?b:a);day=`Day ${Math.max(0,mgrDays(first,mgrToday()))} of ${predState.batchNumber||farmData.batchNumber||'this batch'}`;}}catch(e){}
  document.getElementById('akGreetWx').textContent=[w?`${w.maxT} / ${w.minT}${w.label?' · '+w.label.toLowerCase():''}`:'',day].filter(Boolean).join(' · ');
  return f;
}
async function askShowGreeting(){
  askEnsureDom();
  const f=askGreetHead(),el=document.getElementById('akGreet'),tx=document.getElementById('akGreetText');
  document.getElementById('akGreetChips').innerHTML=askChipsHtml(f.lines);
  const st=askLoad(),cached=st.greet&&st.greet.day===askDayKey()&&st.greet.ai?st.greet:null;
  tx.innerHTML=cached?escapeHtml(cached.text):'<span class="ak-writing">Writing your morning greeting…</span>';
  document.getElementById('akGreetFoot').textContent='✨ Written by AI from today\'s numbers — check before acting';
  el.classList.add('open');el.setAttribute('aria-hidden','false');
  const g=cached||await askMakeGreeting();
  if(!el.classList.contains('open'))return;
  if(g.ai)tx.innerHTML=escapeHtml(g.text);
  else{tx.innerHTML=`<p class="ak-note">${escapeHtml(g.err||'The AI isn\'t available right now.')} Here are today's facts:</p>${askFactsHtml(f.lines)}`;document.getElementById('akGreetChips').innerHTML='';document.getElementById('akGreetFoot').textContent='Made from today\'s numbers (no AI)';}
  const s3=askLoad();if(s3.greet){s3.greet.seen=true;askSave(s3);}askSetDot();
}
function askCloseGreet(){const el=document.getElementById('akGreet');if(!el)return;el.classList.remove('open');el.setAttribute('aria-hidden','true');askMarkSeen();}
function askRender(){
  const box=document.getElementById('akMsgs');if(!box)return;
  const st=askLoad(),day=askDayKey(),g=st.greet&&st.greet.day===day?st.greet:null;
  let h='';
  if(g&&!g.ai)h+=`<div class="ak-m bot greet"><b>This morning</b>${askFactsHtml(g.facts||[])}</div>`;
  if(!g&&!st.msgs.length)h+=`<div class="ak-empty">Ask anything about the farm — sheds, feed, pickups, tasks, maintenance or shed prep. Answers come from today's numbers.</div>`;
  let lastDay='';
  st.msgs.forEach(m=>{const d=m.day||iso(new Date(m.at||Date.now()));
    if(d!==lastDay){lastDay=d;h+=`<div class="ak-day">${d===day?'Today':escapeHtml(fmtShortNoYear(new Date(d+'T00:00:00')))}</div>`;}
    if(m.r==='greet')h+=`<div class="ak-m bot greet"><b>${d===day?'This morning':'Morning greeting'}</b><br>${escapeHtml(m.t)}</div>`;
    else if(m.r==='me')h+=`<div class="ak-m me">${escapeHtml(m.t)}<small>${m.from==='tasks'?'asked in Tasks':''}</small></div>`;
    else h+=`<div class="ak-m bot${m.err?' err':''}">${escapeHtml(m.t).replace(/\n/g,'<br>')}${m.src?`<span class="ak-src">From: ${escapeHtml(m.src)}</span>`:''}</div>`;});
  if(askBusy)h+='<div class="ak-m bot typing"><i></i><i></i><i></i></div>';
  box.innerHTML=h;box.scrollTop=box.scrollHeight;
  const lim=document.getElementById('akLim');if(lim)lim.textContent=`Free AI on your Cloudflare account${askLeft!=null?' · '+askLeft+' question'+(askLeft===1?'':'s')+' left today':''} · chats kept on this device`;
}
async function askSend(q){
  if(askBusy)return;
  const st=askLoad(),day=askDayKey();
  const hist=st.msgs.filter(m=>m.r==='me'||m.r==='ai').slice(-6).map(m=>({role:m.r==='me'?'user':'assistant',content:m.t}));
  st.msgs.push({r:'me',t:q,day,at:Date.now(),from:typeof pwSection!=='undefined'&&pwSection==='tasks'?'tasks':'production'});askSave(st);
  askBusy=true;askRender();
  let msg;
  try{const f=askFacts();const j=await askCall({mode:'ask',question:q,history:hist,facts:f.text,context:askContext(),name:askName(),today:day});msg={r:'ai',t:j.text||'(no answer)',src:j.src||'',day,at:Date.now()};}
  catch(e){msg={r:'ai',t:askErrText(e),err:true,day,at:Date.now()};}
  const s2=askLoad();s2.msgs.push(msg);askSave(s2);askBusy=false;askRender();
}
function askOpen(){
  askEnsureDom();
  const g=document.getElementById('akGreet');if(g.classList.contains('open'))askCloseGreet();
  const p=document.getElementById('akPanel');p.classList.add('open');p.setAttribute('aria-hidden','false');document.getElementById('akPanelScrim').classList.add('open');
  document.getElementById('akMenu').hidden=true;askRender();
  const st=askLoad();if(!(st.greet&&st.greet.day===askDayKey())&&farmData){askMakeGreeting().then(()=>{askMarkSeen();askRender();});}else askMarkSeen();
  setTimeout(()=>{const i=p.querySelector('.ak-pf input');if(i&&matchMedia('(hover:hover)').matches)i.focus();},80);
}
function askClosePanel(){const p=document.getElementById('akPanel');if(!p)return;p.classList.remove('open');p.setAttribute('aria-hidden','true');document.getElementById('akPanelScrim').classList.remove('open');}
window.pwOpenAsk=askOpen;   // Tasks' ✨ Ask button
// Header button
function askPlaceButton(){
  if(document.getElementById('askBtn'))return;
  const bell=document.querySelector('#pageHeader .alerts-bell-wrap');if(!bell)return;
  bell.insertAdjacentHTML('beforebegin','<button type="button" class="ask-btn" id="askBtn" title="Ask about the farm, and this morning\'s greeting">✨ <span>Ask</span><span class="ask-dot" id="askDot" hidden></span></button>');
  document.getElementById('askBtn').addEventListener('click',askOpen);
}
// Once a day from 7:00, the first time the app opens (needs the farm's numbers; waits for Tasks for its part)
let askGreetTried=false;
function askMaybeGreet(){
  if(askGreetTried||!farmData||!askFarm()||!askGreetOn())return;
  if(new Date().getHours()<7)return;
  const st=askLoad();if(st.greet&&st.greet.day===askDayKey()&&st.greet.seen)return;
  askGreetTried=true;
  const go=()=>{try{askShowGreeting();}catch(e){}};
  let ready=false;try{ready=!!(cwFrame&&cwFrame.contentWindow&&cwFrame.contentWindow.__cwBrief);}catch(e){}
  if(ready)go();else if(typeof pwEnsureTasksFrame==='function'){let done=false;const once=()=>{if(!done){done=true;go();}};pwEnsureTasksFrame(once);setTimeout(once,8000);}else go();
}
document.addEventListener('DOMContentLoaded',()=>{askPlaceButton();askSetDot();setTimeout(askMaybeGreet,2500);});
setInterval(()=>{if(document.visibilityState!=='visible')return;askPlaceButton();askSetDot();askMaybeGreet();},30000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){askGreetTried=false;setTimeout(askMaybeGreet,1500);}});
