// Cluck: feed off the morning of the catch (2026-10-26, mockup XTdGwJQUBDg5fo6Mg67tFL). Farm manager only.
// The kill sheet date is the pickup date; birds are caught the evening before, so the feed comes off at 7:00 that
// morning. Every coming pickup (logged ahead or planned — not the auto-filled forecast) gives one feed-off day per date.
//  • the day before: Cluck's heads-up (morning report, amber line on top of Production)
//  • the day: a red Cluck banner on top of every Production page and item 1 in his report, until "Feed is off"
//  • phones: the farm-notify worker sends it at 7:00 (and 11:00 if nobody tapped Feed is off), even in quiet hours
// "Feed is off" is kept in the farm file (farmData.feedOffDone), so every manager device sees it.
// no-break spaces keep "Sheds 5 & 6" on one line
function foLabel(sheds){const s=sheds.slice().sort((a,b)=>a-b),N='\u00a0';return s.length===1?'Shed'+N+s[0]:'Sheds'+N+s.slice(0,-1).join(', ')+N+'&'+N+s[s.length-1];}
function foDay(d){return dateOnly(d).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});}
function foDoneMap(){return (farmData&&farmData.feedOffDone&&typeof farmData.feedOffDone==='object')?farmData.feedOffDone:{};}
// [{date:'YYYY-MM-DD' (feed off), kill, sheds:[ids], birds, done}] from today on, up to `days` ahead
function foEvents(days){
  if(!farmData)return [];
  const today=mgrToday(),by={},done=foDoneMap();
  mgrPlaced().filter(s=>!s.closed).forEach(s=>mgrComingPickups(s).forEach(p=>{
    const off=addDays(p.date,-1),k=iso(off);
    if(dateOnly(off)<today||mgrDays(today,off)>(days||14))return;
    const e=by[k]=by[k]||{date:k,kill:iso(p.date),sheds:[],birds:0};
    if(!e.sheds.includes(Number(s.id)))e.sheds.push(Number(s.id));
    e.birds+=Number(p.birds)||0;
  }));
  return Object.values(by).sort((a,b)=>a.date<b.date?-1:1).map(e=>Object.assign(e,{sheds:e.sheds.sort((a,b)=>a-b),done:!!done[e.date]}));
}
function foToday(){const k=iso(mgrToday());return foEvents(2).find(e=>e.date===k)||null;}
function foTomorrow(){const k=iso(addDays(mgrToday(),1));return foEvents(2).find(e=>e.date===k)||null;}
function foSnoozeKey(){return 'pw-fo-later-'+(syncFarmName||'local')+'-'+iso(mgrToday());}
function foSnoozed(){try{const t=Number(localStorage.getItem(foSnoozeKey()))||0;return Date.now()<t;}catch(e){return false;}}
function foRemindAt(){const t=(typeof pnCfg!=='undefined'&&pnCfg&&pnCfg.foRemindTime)||'11:00';const [h,m]=t.split(':').map(Number);const d=new Date();d.setHours(h||11,m||0,0,0);return d;}
// "Later": until the reminder time, or an hour when that has passed
function foLaterAt(){const r=foRemindAt();return r.getTime()>Date.now()+5*60e3?r:new Date(Date.now()+60*60e3);}
function foLaterLabel(){const r=foRemindAt();return r.getTime()>Date.now()+5*60e3?'Later · '+fmtClock(r):'Later · 1 hour';}

// The banner on top of Production
function foBannerHtml(){
  if(!farmData)return '';
  const ev=foToday();
  if(ev&&ev.done){const d=foDoneMap()[ev.date]||{};const at=d.at?fmtClock(d.at):'';
    return `<div class="fo-ok" id="foBanner"><span class="fo-okface">${typeof rsFace==='function'?rsFace('happy'):''}</span><span>Cluck: thanks — feed off ${escapeHtml(foLabel(ev.sheds))}${d.by?' by '+escapeHtml(d.by):''}${at?' at '+escapeHtml(at):''}.</span><button type="button" class="fo-undo" data-fo-undo="${ev.date}" title="Not done after all">Undo</button></div>`;}
  if(ev&&!foSnoozed()){
    const nm=typeof aiName==='function'?aiName():'';
    return `<section class="fo-ban" id="foBanner" role="alert" aria-live="assertive">
      <div class="fo-top"><span class="fo-face">${typeof rsFace==='function'?rsFace('alert'):''}</span><div><div class="fo-k">Cluck · today, before the catch</div><h3>Turn the feed off · ${escapeHtml(foLabel(ev.sheds))}</h3></div></div>
      <p class="fo-say">${nm?'Morning '+escapeHtml(nm)+'. ':''}${escapeHtml(foLabel(ev.sheds))} ${ev.sheds.length>1?'are':'is'} caught tonight for the ${escapeHtml(foDay(ev.kill))} kill sheet, so the feed needs to come off this morning.</p>
      <div class="fo-sheds">${ev.sheds.map(id=>{const s=farmData.sheds[id-1];const b=s?mgrComingPickups(s).filter(p=>iso(p.date)===ev.kill).reduce((n,p)=>n+p.birds,0):0;return `<span>Shed ${id}${b?' · '+b.toLocaleString('en-US')+' birds':''}</span>`;}).join('')}</div>
      <div class="fo-act"><button type="button" class="fo-done" data-fo-done="${ev.date}">✓ Feed is off</button><button type="button" class="fo-later" data-fo-later>${escapeHtml(foLaterLabel())}</button></div>
    </section>`;}
  const tm=foTomorrow();
  if(tm&&!tm.done)return `<div class="fo-pre" id="foBanner"><span class="fo-okface">${typeof rsFace==='function'?rsFace('calm'):''}</span><span><b>Feed off tomorrow morning · ${escapeHtml(foLabel(tm.sheds))}</b> — Cluck will remind you at ${escapeHtml(((typeof pnCfg!=='undefined'&&pnCfg&&pnCfg.foTime)||'07:00').replace(/^0/,''))}. Kill sheet ${escapeHtml(foDay(tm.kill))}.</span></div>`;
  return '';
}
function foInject(){
  const old=document.getElementById('foBanner');if(old)old.remove();
  if(typeof pwSection!=='undefined'&&pwSection!=='production')return;
  if(typeof activeTab!=='undefined'&&(activeTab==='farmsettings'||activeTab==='account'))return;
  const app=document.getElementById('app');if(!app)return;
  const h=foBannerHtml();if(h)app.insertAdjacentHTML('afterbegin',h);
}
// after every redraw of a Production page
if(typeof render==='function'){const foRender0=render;render=function(){const r=foRender0.apply(this,arguments);try{foInject();}catch(e){}return r;};}

function foSetDone(date,on){
  if(!farmData)return;
  farmData.feedOffDone=Object.assign({},foDoneMap());
  if(on)farmData.feedOffDone[date]={by:(typeof cachedManager==='function'&&cachedManager())||'Manager',at:Date.now()};
  else delete farmData.feedOffDone[date];
  // keep only the last month
  const cut=iso(addDays(mgrToday(),-31));Object.keys(farmData.feedOffDone).forEach(k=>{if(k<cut)delete farmData.feedOffDone[k];});
  saveState();schedulePush();render();foSync(true);
  if(on)foCloseNotes([date]);
  if(on&&typeof pwActivity==='function')pwActivity('feed','Feed off '+foLabel((foToday()||{sheds:[]}).sheds));
}
document.addEventListener('click',e=>{
  const d=e.target.closest&&e.target.closest('[data-fo-done]');if(d){foSetDone(d.dataset.foDone,true);showToast('Feed off — Cluck has it noted.');return;}
  const u=e.target.closest&&e.target.closest('[data-fo-undo]');if(u){foSetDone(u.dataset.foUndo,false);return;}
  if(e.target.closest&&e.target.closest('[data-fo-later]')){const at=foLaterAt();try{localStorage.setItem(foSnoozeKey(),String(at.getTime()));}catch(er){}foInject();showToast('Cluck will remind you at '+fmtClock(at)+'.');}
});
// Back on screen at the reminder time: show it again
setInterval(()=>{if(document.visibilityState==='visible'&&farmData&&(foToday()||foTomorrow()))foInject();},60e3);

// The sticky phone notification for a feed-off day that's done: close it on this device
function foCloseNotes(dates){
  if(!('serviceWorker' in navigator)||!dates.length)return;
  navigator.serviceWorker.getRegistration().then(r=>r&&r.getNotifications?Promise.all(dates.map(d=>r.getNotifications({tag:'feedoff-'+d}).then(ns=>ns.forEach(n=>n.close())))):null).catch(()=>{});
}
window.addEventListener('load',()=>setTimeout(()=>{try{foCloseNotes(Object.keys(foDoneMap()));}catch(e){}},2500));

// ── Tell the notification server (it sends the 7:00 and 11:00 alerts) ──
let foTimer=null;
function foSync(now){
  clearTimeout(foTimer);
  foTimer=setTimeout(()=>{
    if(!window.FarmNotify||!syncFarmName||!farmData||typeof FarmNotify.feedoff!=='function')return;
    const events=foEvents(14).map(e=>({date:e.date,kill:e.kill,sheds:e.sheds,birds:e.birds,done:e.done}));
    const s=JSON.stringify(events),k='pw-fo-sent-'+syncFarmName;
    let last=null;try{last=localStorage.getItem(k);}catch(er){}
    if(last===s)return;
    FarmNotify.feedoff(syncFarmName,events).then(()=>{try{localStorage.setItem(k,s);}catch(er){}}).catch(()=>{});
  },now?300:6000);
}
if(typeof saveState==='function'){const foSave0=saveState;saveState=function(){const r=foSave0.apply(this,arguments);foSync(false);return r;};}
window.addEventListener('load',()=>setTimeout(()=>foSync(true),3000));
setInterval(()=>{if(document.visibilityState==='visible')foSync(false);},15*60e3);
