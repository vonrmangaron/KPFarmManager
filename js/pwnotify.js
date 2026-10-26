// ProdWise › Settings › Notifications (2026-10-26, mockup PZkDNiKCzRoxzJhUkab9BQ).
// Phone notifications for the manager and the crew, sent by the farm-notify worker (see js/notify.js).
// Here: this device on/off, quiet hours, the "Your day" and reminder times, what each side is told about,
// who has them on (send a setup link / a test). Like every Settings page, changes wait for Apply.
// Also: opening the right page when a notification is tapped, and the feed/silo warnings.
let pnCfg=null,pnDraft=null,pnPhones=null,pnMembers=null,pnMine='off',pnErr='',pnBusy=false,pnLoadedFor='';
const PN_SW=[['urgentBreak'],['dayOn'],['remindOn'],['wNew'],['wMoved'],['mReports'],['mDone'],['mFeed'],['quietOn']];
function pnFarm(){return syncFarmName||'';}
function pnChanges(){if(!pnCfg||!pnDraft)return [];return Object.keys(pnDraft).filter(k=>pnDraft[k]!==pnCfg[k]);}
async function pnLoad(force){
  const farm=pnFarm();if(!farm||!window.FarmNotify)return;
  if(pnBusy||(!force&&pnLoadedFor===farm))return;
  pnBusy=true;pnErr='';
  try{
    pnMine=await FarmNotify.state();
    const [s,p]=await Promise.all([FarmNotify.settings(farm),FarmNotify.phones(farm)]);
    pnCfg=s.settings;pnDraft=Object.assign({},pnCfg);pnPhones=p.phones||[];
    try{const r=await fetch(accAccessUrl());const j=r.ok?await r.json():null;pnMembers=(j&&j.data&&Array.isArray(j.data.members))?j.data.members.map(m=>m&&m.name).filter(Boolean):[];}catch(e){pnMembers=[];}
    pnLoadedFor=farm;
  }catch(e){pnErr=e.setup?'setup':(e.status===403?'signin':(navigator.onLine?'server':'offline'));}
  finally{pnBusy=false;}
  pnRefresh();
}
function pnRefresh(){const b=document.getElementById('pnBody');if(b)b.innerHTML=pnInner();}
function pnSw(k,label){const on=!!(pnDraft&&pnDraft[k]);return `<button type="button" class="pn-sw${on?' on':''}" role="switch" aria-checked="${on}" aria-label="${escapeAttr(label)}" data-pn-sw="${k}"></button>`;}
function pnTime(k,label){return `<input type="time" class="st2-in pn-time" step="300" value="${escapeAttr((pnDraft&&pnDraft[k])||'')}" aria-label="${escapeAttr(label)}" data-pn-time="${k}">`;}
function pnFmt(t){const m=/^(\d{1,2}):(\d{2})$/.exec(t||'');if(!m)return t||'';const h=+m[1];return `${h%12||12}${m[2]==='00'?'':':'+m[2]} ${h<12?'am':'pm'}`;}
// The 24 h bar: the quiet part striped
function pnBar(){
  const toP=t=>{const m=/^(\d{1,2}):(\d{2})$/.exec(t||'0:0');return ((+m[1])*60+(+m[2]))/1440*100;};
  if(!pnDraft.quietOn)return '<div class="pn-bar off" aria-hidden="true"></div>';
  const a=toP(pnDraft.quietFrom),b=toP(pnDraft.quietTo);
  const seg=a<b?`<i style="left:${a}%;width:${b-a}%"></i>`:`<i style="left:0;width:${b}%"></i><i style="left:${a}%;width:${100-a}%"></i>`;
  return `<div class="pn-bar" aria-hidden="true">${seg}</div><div class="pn-ticks" aria-hidden="true"><span style="left:0">12 am</span><span style="left:25%">6 am</span><span style="left:50%">12 pm</span><span style="left:75%">6 pm</span></div>`;
}
function pnThisDevice(){
  const N=window.FarmNotify;
  let hint,ctl;
  if(pnMine==='on'){hint='This device gets your notifications.';ctl=`<span class="st2-chip ok">● On</span><button type="button" class="set-btn" data-pn-test>Send a test</button><button type="button" class="set-btn" data-pn-off>Turn off</button>`;}
  else if(pnMine==='install'){hint='On iPhone, add ProdWise to the Home Screen first (Share ⬆ › Add to Home Screen), then open it from there and come back here.';ctl='<span class="st2-chip">Home Screen first</span>';}
  else if(pnMine==='denied'){hint='Notifications are blocked for ProdWise in this phone’s settings. Allow them there, then come back.';ctl='<span class="st2-chip">Blocked</span>';}
  else if(pnMine==='unsupported'){hint='This browser can’t show notifications. Use Chrome on Android, or ProdWise from the Home Screen on iPhone.';ctl='<span class="st2-chip">Not available</span>';}
  else{hint=N&&N.isIOS()?'You’ll be asked to allow notifications.':'Problem reports, finished high-priority tasks and your own jobs.';ctl=`<button type="button" class="set-btn primary" data-pn-on>Turn on</button>`;}
  return stRow('Notifications on this device',hint,ctl);
}
function pnWho(){
  const phones=pnPhones||[],byName=new Map();
  phones.forEach(p=>{const k=String(p.name||'').trim().toLowerCase()||('#'+p.id);if(!byName.has(k))byName.set(k,{name:p.name||'Unnamed phone',role:p.role,devs:[]});byName.get(k).devs.push(p);});
  (pnMembers||[]).forEach(n=>{const k=String(n).trim().toLowerCase();if(!byName.has(k))byName.set(k,{name:n,role:'worker',devs:[]});});
  const me=String(cachedManager()||'').trim().toLowerCase();
  const rows=[...byName.values()].sort((a,b)=>(b.role==='manager')-(a.role==='manager')||String(a.name).localeCompare(b.name)).map(p=>{
    const you=p.role==='manager'&&(!me||String(p.name).trim().toLowerCase()===me);
    const dev=p.devs.length?[...new Set(p.devs.map(d=>d.device||'Phone'))].join(' · '):'—';
    const ctl=p.devs.length?`<span class="st2-chip">${escapeHtml(dev)}</span><span class="st2-chip ok">On</span><button type="button" class="set-btn" data-pn-test="${escapeAttr(p.devs[0].id)}">Send a test</button>`
      :`<span class="st2-chip">Not set up</span><button type="button" class="set-btn" data-pn-link="${escapeAttr(p.name)}">Send setup link</button>`;
    return stRow(`${you?'You ('+escapeHtml(p.name)+')':escapeHtml(p.name)}`,p.role==='manager'?'Manager':'Crew',ctl);
  }).join('');
  return rows||stRow('Nobody yet','Workers turn it on in the Crew app (a card at the top of Today). Send them the link.',`<button type="button" class="set-btn" data-pn-link="">Copy setup link</button>`);
}
function pnInner(){
  if(!pnFarm())return `<div class="st2-empty">Connect this device to a farm first.</div>`;
  if(!window.FarmNotify)return `<div class="st2-empty">Notifications aren’t available in this version.</div>`;
  if(pnErr==='setup')return `<div class="set-cards">${accCard('bell','Notifications server not set up yet','The free notification server (farm-notify) isn’t on your Cloudflare account yet. Once it is, this page fills in.',`<ol class="pn-steps"><li>Cloudflare › Workers &amp; Pages › Create › Worker, name it <b>farm-notify</b>, paste <code>workers/farm-notify.js</code>.</li><li>Add the secret <b>VAPID_PRIVATE</b>, the KV namespaces <b>NOTIFY</b> (new) and <b>KEYS</b> (the sync server’s), and the cron trigger <b>*/15 * * * *</b>.</li></ol><div class="set-actions"><button type="button" class="set-btn" data-pn-retry>Check again</button></div>`)}</div>`;
  if(pnErr)return `<div class="set-cards">${accCard('bell','Notifications',pnErr==='offline'?'You’re offline. Connect to change notifications.':pnErr==='signin'?'Sign in with the manager password first (Settings › Security).':'Couldn’t reach the notification server.',`<div class="set-actions"><button type="button" class="set-btn" data-pn-retry>Try again</button></div>`)}</div>`;
  if(!pnCfg)return `<p class="set-muted">Loading…</p>`;
  const ch=pnChanges();
  return `<div class="set-apply" id="pnApply" role="region" aria-label="Unapplied changes"${ch.length?'':' hidden'}><div class="set-apply-txt"><b>${ch.length} change${ch.length===1?'':'s'} not applied</b><span>Notifications</span></div><button type="button" class="set-btn" data-pn-discard>Discard</button><button type="button" class="set-btn primary" data-pn-apply>Apply</button></div>`
   +stSec('This device',pnThisDevice())
   +stSec('Quiet hours',
      stRow('Quiet hours','Nothing is sent in this time — it’s held back and sent when it ends.',pnSw('quietOn','Quiet hours'))
     +(pnDraft.quietOn?`<div class="st2-row pn-qrow"><div class="pn-q"><span>From</span>${pnTime('quietFrom','Quiet from')}<span>to</span>${pnTime('quietTo','Quiet until')}<span class="st2-chip">every day</span></div>${pnBar()}</div>`
       +stRow('Urgent problem reports break through','To you only, even in quiet hours.',pnSw('urgentBreak','Urgent reports break through')):''))
   +stSec('Times',
      stRow('“Your day”','Each person’s jobs for the day, in the morning.',`${pnDraft.dayOn?pnTime('dayTime','Your day time'):''}${pnSw('dayOn','Your day')}`)
     +stRow('Afternoon reminder','If someone’s task for today is still open.',`${pnDraft.remindOn?pnTime('remindTime','Reminder time'):''}${pnSw('remindOn','Afternoon reminder')}`))
   +stSec('Workers are told about',
      stRow('A new task for them','Several in a row come as one notification.',pnSw('wNew','New task'))
     +stRow('Their task moved or changed','',pnSw('wMoved','Task moved or changed')))
   +stSec('You’re told about',
      stRow('Problem reports','Urgent ones straight away.',pnSw('mReports','Problem reports'))
     +stRow('High-priority task finished','When a worker ticks off a 🔥 task.',pnSw('mDone','High-priority task finished'))
     +stRow('Feed and silo warnings','A pair’s silos run low within 3 days. Checked when ProdWise is open.',pnSw('mFeed','Feed and silo warnings')))
   +stSec('Who has notifications on',pnWho())
   +`<p class="set-muted pn-foot">Free · sent from your Cloudflare account. Times are the farm’s time (${escapeHtml(pnCfg.tz||'')}).</p>`;
}
function pnHtml(){setTimeout(()=>pnLoad(false),0);return `<div id="pnBody">${pnInner()}</div>`;}
function pnSetupLink(){return new URL('cluckwise/viewer.html?setup=notify',location.href.split('#')[0].replace(/[^/]*$/,'')).href;}
async function pnShareLink(name){
  const url=pnSetupLink(),text=`${name?name+', t':'T'}urn on notifications in the Crew app so you hear about new jobs: ${url}`;
  if(navigator.share){try{await navigator.share({title:'Crew app notifications',text});return;}catch(e){if(e&&e.name==='AbortError')return;}}
  try{await navigator.clipboard.writeText(text);showToast('Setup link copied — paste it in a message.');}catch(e){prompt('Copy this and send it:',text);}
}
document.addEventListener('click',async e=>{
  const t=e.target.closest&&e.target.closest('[data-pn-sw],[data-pn-apply],[data-pn-discard],[data-pn-on],[data-pn-off],[data-pn-test],[data-pn-link],[data-pn-retry]');
  if(!t||!document.getElementById('pnBody'))return;
  const farm=pnFarm();
  if(t.dataset.pnSw){pnDraft[t.dataset.pnSw]=!pnDraft[t.dataset.pnSw];pnRefresh();return;}
  if(t.hasAttribute('data-pn-discard')){pnDraft=Object.assign({},pnCfg);pnRefresh();return;}
  if(t.hasAttribute('data-pn-retry')){pnLoad(true);pnRefresh();return;}
  if(t.hasAttribute('data-pn-apply')){
    const set={};pnChanges().forEach(k=>{set[k]=pnDraft[k];});
    let tz='';try{tz=Intl.DateTimeFormat().resolvedOptions().timeZone||'';}catch(er){}
    if(tz&&tz!==pnCfg.tz)set.tz=tz;
    t.disabled=true;t.textContent='Applying…';
    try{const r=await FarmNotify.settings(farm,set);pnCfg=r.settings;pnDraft=Object.assign({},pnCfg);if(typeof pwActivity==='function')pwActivity('settings','Notification settings changed');showToast('Notifications applied.');}
    catch(er){showToast('Could not save. Check your connection.',true);}
    pnRefresh();return;
  }
  if(t.hasAttribute('data-pn-on')){
    t.disabled=true;t.textContent='Turning on…';
    try{await FarmNotify.enable({farm,name:cachedManager()||'',role:'manager'});showToast('Notifications are on for this device.');}
    catch(er){showToast(er.message||'Could not turn notifications on.',true);}
    pnLoad(true);return;
  }
  if(t.hasAttribute('data-pn-off')){await FarmNotify.disable({farm,role:'manager'});showToast('Notifications off on this device.');pnLoad(true);return;}
  if(t.hasAttribute('data-pn-test')){
    t.disabled=true;
    try{const r=await FarmNotify.test(farm,t.dataset.pnTest||'');showToast(r.ok?'Test sent — it should arrive in a few seconds.':'The phone didn’t take it. Ask them to turn notifications on again.',!r.ok);if(!r.ok)pnLoad(true);}
    catch(er){showToast(er.message||'Could not send the test.',true);}
    t.disabled=false;return;
  }
  if(t.hasAttribute('data-pn-link')){pnShareLink(t.dataset.pnLink);return;}
});
document.addEventListener('change',e=>{
  const t=e.target.closest&&e.target.closest('[data-pn-time]');if(!t||!pnDraft)return;
  if(/^\d{1,2}:\d{2}$/.test(t.value))pnDraft[t.dataset.pnTime]=t.value.slice(0,5);
  pnRefresh();
});

// ── A notification was tapped: open what it's about ──
function pnOpen(nt){
  nt=String(nt||'');if(!nt)return;
  const [kind,id]=[nt.split(':')[0],nt.slice(nt.indexOf(':')+1)];
  if(kind==='feed'){if(pwSection!=='production'&&typeof openProductionSection==='function')openProductionSection();activeTab='home';render();return;}
  if(typeof openTasksSection!=='function')return;
  openTasksSection();
  const what=kind==='report'||kind==='task'?nt:'today';
  const go=()=>{try{cwFrame.contentWindow.__cwOpen(what);}catch(er){}};
  // Tasks may still be loading: wait until its data is in
  let n=0;const wait=()=>{let ready=false;try{ready=!!(cwFrame.contentWindow.__cwOpen&&cwFrame.contentWindow.__cwReady);}catch(er){}
    if(ready)go();else if(++n<40)setTimeout(wait,500);};
  wait();
}
(function(){
  try{const u=new URL(location.href),nt=u.searchParams.get('nt');
    if(nt){u.searchParams.delete('nt');history.replaceState(history.state,'',u.pathname+(u.search||'')+u.hash);window.addEventListener('load',()=>setTimeout(()=>pnOpen(nt),400));}}catch(e){}
  if('serviceWorker' in navigator)navigator.serviceWorker.addEventListener('message',e=>{if(e.data&&e.data.type==='farm-notify-open')pnOpen(e.data.nt);});
  // Keep this device's name with the server when the manager's name changes
  window.addEventListener('load',()=>setTimeout(()=>{if(window.FarmNotify&&pnFarm())FarmNotify.refresh({farm:pnFarm(),name:cachedManager()||'',role:'manager'});},4000));
})();

// ── Feed and silo warnings: once a day per pair, when ProdWise is open ──
function pnFeedCheck(){
  if(!window.FarmNotify||!pnFarm()||!farmData||typeof mgrSiloOutlook!=='function')return;
  let silos=[];try{silos=mgrSiloOutlook();}catch(e){return;}
  if(typeof pairAllClosed==='function')silos=silos.filter(x=>!pairAllClosed(x.g));
  const day=iso(mgrToday()),k='pw-notify-feed-'+pnFarm();
  let sent={};try{sent=JSON.parse(localStorage.getItem(k)||'{}')||{};}catch(e){}
  if(sent.day!==day)sent={day,ids:[]};
  const ev=[];
  silos.filter(x=>x.dep&&x.days<=3).forEach(x=>{const id='g'+x.g;if(sent.ids.includes(id))return;sent.ids.push(id);
    ev.push({type:'feed',id:id+'-'+day,title:`Feed: ${pairLabel(x.g)} run low ${x.days<=1?mgrWhen(x.dep).toLowerCase():mgrWhen(x.dep)}`,body:x.days<=1?'Book a load today.':`In ${x.days} days. Book a load.`});});
  if(!ev.length)return;
  try{localStorage.setItem(k,JSON.stringify(sent));}catch(e){}
  FarmNotify.send(pnFarm(),'manager',ev,'');
}
setInterval(()=>{if(document.visibilityState==='visible')pnFeedCheck();},15*60e3);
window.addEventListener('load',()=>setTimeout(pnFeedCheck,20e3));
