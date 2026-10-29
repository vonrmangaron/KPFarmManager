// One app (2026-10-17, mockup NEZeifRccwQXod4adNMARP): Tasks — the CluckWise app — opens inside
// ProdWise. It loads once in a frame over the page and stays alive, so switching back and forth is
// instant and Tasks opens where you left it. A Production / Tasks switch floats bottom-right on a
// computer and sits at the top of the page on a phone; CluckWise shows the same switch on its side and
// asks for Production through postMessage. Same site, so both share the manager sign-in key.
// Tasks always opens on ProdWise's farm (?farm= in the frame's address).
// The phone's back button returns to Production. The old CluckWise link still works on its own.
let pwSection='production',cwFrame=null,pwTasksPushed=false;
const PW_SW_ICON={production:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/></svg>',
  tasks:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>'};
// kind 'dock' (floating, bottom-right on a computer) or 'pill' (phone header)
function pwSwitchHtml(kind){
  const b=(k,label)=>`<button type="button" data-ws="${k}" aria-pressed="${pwSection===k}" class="${pwSection===k?'on':''}" title="${k==='tasks'?'Tasks: planner, maintenance, routine and guide':'Production: sheds, feed and pickups'}">${PW_SW_ICON[k]}<span>${label}</span></button>`;
  return `<div class="${kind==='dock'?'ws-dock':'ws-pill'}" role="group" aria-label="Section">${b('production','Production')}${b('tasks','Tasks')}</div>`;
}
function pwSyncSwitch(){document.querySelectorAll('[data-ws]').forEach(x=>{const on=x.dataset.ws===pwSection;x.classList.toggle('on',on);x.setAttribute('aria-pressed',String(on));});}
function pwPlaceSwitches(){
  // computer: floating pill bottom-right (shown from 769px by the CSS); phone: pill at the top of the page
  if(!document.getElementById('pwDock'))document.body.insertAdjacentHTML('beforeend',pwSwitchHtml('dock').replace('class="ws-dock"','class="ws-dock" id="pwDock"'));
  const hl=document.querySelector('#pageHeader .page-header-left');
  if(hl&&!hl.querySelector('.ws-pill'))hl.insertAdjacentHTML('afterbegin',pwSwitchHtml('pill'));
  pwSyncSwitch();
}
// Tasks loaded in the background (History reads its change log) without switching to it
function pwEnsureTasksFrame(onReady){
  const farm=syncFarmName||'';
  if(!cwFrame){cwFrame=document.createElement('iframe');cwFrame.id='cwFrame';cwFrame.title='Tasks';document.body.appendChild(cwFrame);}
  if(cwFrame.dataset.farm!==farm||!cwFrame.src){cwFrame.dataset.farm=farm;cwFrame.src=CLUCKWISE_URL+'index.html?embed=1'+(farm?'&farm='+encodeURIComponent(farm):'');cwFrame.addEventListener('load',()=>{if(typeof pwOneRailApply==='function')pwOneRailApply();},{once:true});}
  let ready=false;try{ready=!!(cwFrame.contentWindow&&cwFrame.contentWindow.__cwHistory);}catch(e){}
  if(ready){if(onReady)onReady();}else if(onReady)cwFrame.addEventListener('load',()=>setTimeout(onReady,400),{once:true});
}
function openTasksSection(opts){
  opts=opts||{};
  // Tasks opens on ProdWise's farm (sent in the address); connecting or changing farm here reloads it
  const farm=syncFarmName||'';
  if(!cwFrame){
    cwFrame=document.createElement('iframe');cwFrame.id='cwFrame';cwFrame.title='Tasks';
    document.body.appendChild(cwFrame);
  }
  if(cwFrame.dataset.farm!==farm||!cwFrame.src){cwFrame.dataset.farm=farm;cwFrame.src=CLUCKWISE_URL+'index.html?embed=1'+(farm?'&farm='+encodeURIComponent(farm):'');}
  pwSection='tasks';document.body.classList.add('pw-in-tasks');
  if(opts.push!==false&&location.hash!=='#tasks'){history.pushState({pwSection:'tasks'},'','#tasks');pwTasksPushed=true;}
  pwSyncSwitch();
  try{cwFrame.contentWindow.__wsSlide&&cwFrame.contentWindow.__wsSlide('tasks');}catch(e){}
  pwTasksTopColour();cwFrame.addEventListener('load',pwTasksTopColour,{once:true});
  pwOneRailApply();cwFrame.addEventListener('load',pwOneRailApply,{once:true});
  try{cwFrame.focus();}catch(e){}
}
// The status-bar strip above the frame takes the colour of Tasks' header (light or dark theme)
function pwTasksTopColour(){
  try{const d=cwFrame&&cwFrame.contentDocument;const tb=d&&d.querySelector('.topbar');if(!tb)return;
    let c=getComputedStyle(tb).backgroundColor;const a=c.match(/rgba\([^)]*,\s*([\d.]+)\)/);
    if(!c||c==='transparent'||(a&&+a[1]<0.5))c=d.body.classList.contains('theme-dark')?'#111827':'#FFF8EC';
    document.documentElement.style.setProperty('--cw-top',c);}catch(e){}
}
setInterval(()=>{if(pwSection==='tasks')pwTasksTopColour();},2000);
setInterval(()=>{if(cwFrame&&typeof syncPwRail==='function')syncPwRail();},1500);   // Tasks page lit + Prep/Maintenance counts on the one menu   // follows a theme change made inside Tasks
function openProductionSection(opts){
  opts=opts||{};
  if(pwSection!=='tasks')return;
  pwSection='production';document.body.classList.remove('pw-in-tasks');
  if(!opts.fromPop&&location.hash==='#tasks'){
    if(pwTasksPushed){pwTasksPushed=false;history.back();}           // the entry we added: step back over it
    else history.replaceState(null,'',location.pathname+location.search);   // opened straight at #tasks
  }
  pwSyncSwitch();pwSlide('production');if(typeof syncPwRail==='function')syncPwRail();
  if(typeof render==='function')render();
}
// the switch slides its highlight across to the section that just opened
function pwSlide(to){const d=document.getElementById('pwDock');if(!d)return;d.classList.add(to==='tasks'?'ws-from-production':'ws-from-tasks');void d.offsetWidth;requestAnimationFrame(()=>d.classList.remove('ws-from-production','ws-from-tasks'));}
// The floating pill slides out of the way while a page scrolls down, and comes back on the way up or when it stops.
// Only the user's own scrolling counts (2026-10-26): a redraw after a sync check moves the scroll for a moment,
// and that used to send the pill down and back up while the app sat idle.
(function(){const last=new WeakMap();let t=null,userAt=0;
  ['wheel','touchstart','touchmove','keydown','pointerdown'].forEach(ev=>window.addEventListener(ev,()=>{userAt=Date.now();},{passive:true,capture:true}));
  document.addEventListener('scroll',e=>{const el=e.target===document?document.scrollingElement:e.target;const d=document.getElementById('pwDock');if(!d||!el||typeof el.scrollTop!=='number')return;
    const y=el.scrollTop,prev=last.has(el)?last.get(el):0;last.set(el,y);
    if(Date.now()-userAt>1200)return;   // not the user scrolling: the app redrew or restored a position
    if(y>prev+4&&y>80)d.classList.add('away');else if(y<prev-4)d.classList.remove('away');
    clearTimeout(t);t=setTimeout(()=>d.classList.remove('away'),2000);},true);})();
// Tasks can ask for a Production page: Set up sheds, or the New batch window
function pwOpenTab(t){
  if(t==='shedsetup'&&farmData){activeTab='shedsetup';render();}
  else if(t==='newbatch'&&typeof openNewBatchModal==='function')openNewBatchModal();
  else if((t==='account'||t==='security')&&typeof goAccount==='function')goAccount(t==='security'?'security':'profile');
  else if(t==='history'){if(typeof closeToolPages==='function')closeToolPages();activeTab='history';render();}
}
window.addEventListener('popstate',()=>{if(location.hash==='#tasks')openTasksSection({push:false});else{pwTasksPushed=false;openProductionSection({fromPop:true});}});
window.addEventListener('message',e=>{
  if(e.origin!==location.origin||!e.data)return;
  if(e.data.pwSection==='production'){openProductionSection();if(e.data.settingsPage&&typeof goSettings==='function')goSettings(e.data.settingsPage);else pwOpenTab(e.data.tab);}
  if(e.data.pwSection==='tasks')openTasksSection();
});
// ── One menu (2026-10-29): wide enough for Tasks' computer layout beside the 84 px rail → one rail for both apps ──
const PW_ONERAIL_MQ=window.matchMedia?window.matchMedia('(min-width:1109px)'):null;
function pwOneRailOn(){return !!(PW_ONERAIL_MQ&&PW_ONERAIL_MQ.matches);}
function pwOneRailApply(){
  const on=pwOneRailOn();document.body.classList.toggle('pw-onerail',on);
  try{const d=cwFrame&&cwFrame.contentDocument;if(d&&d.documentElement)d.documentElement.classList.toggle('cw-onerail',on);}catch(e){}
  if(typeof syncPwRail==='function')syncPwRail();
}
if(PW_ONERAIL_MQ)PW_ONERAIL_MQ.addEventListener('change',pwOneRailApply);
// open Tasks on one of its pages: the hidden Tasks rail button does the work, so Tasks behaves exactly as before
function pwTasksGo(k){
  const was=pwSection==='tasks';openTasksSection();
  const go=()=>{try{const d=cwFrame.contentDocument;d.documentElement.classList.toggle('cw-onerail',pwOneRailOn());
    const b=d.querySelector('#appRail .ar-btn[data-ar="'+k+'"]');if(!b)return false;
    // Planner / Audits: a second press of the open one hides Tasks' side panel; coming from Production it should just open
    if(!was&&(k==='tasks'||k==='batch')&&b.classList.contains('active')){if(typeof syncPwRail==='function')syncPwRail();return true;}
    b.click();if(typeof syncPwRail==='function')setTimeout(syncPwRail,60);return true;}catch(e){return false;}};
  if(!go())cwFrame.addEventListener('load',()=>setTimeout(go,300),{once:true});
}
document.addEventListener('click',e=>{
  const t=e.target.closest&&e.target.closest('[data-pwt]');if(t){e.preventDefault();pwTasksGo(t.dataset.pwt);return;}
  if(e.target.closest&&e.target.closest('[data-pwr-theme]')){e.preventDefault();if(typeof toggleTheme==='function')toggleTheme();if(typeof syncPwRail==='function')syncPwRail();return;}
});
// a Production button on the rail while Tasks is open: back to Production first, then the button does its usual job
document.addEventListener('click',e=>{
  if(pwSection!=='tasks'||!e.target.closest)return;
  const b=e.target.closest('#pwRail [data-tab],#pwRail [data-pw-panel]');if(b)openProductionSection();
},true);
document.addEventListener('click',e=>{
  const w=e.target.closest('[data-ws]');
  if(w){e.preventDefault();w.dataset.ws==='tasks'?openTasksSection():openProductionSection();return;}
});
document.addEventListener('DOMContentLoaded',()=>{
  // the rail is built a moment after start; the page header re-renders — keep the switches in place
  setTimeout(pwPlaceSwitches,0);setTimeout(pwOneRailApply,50);
  const hdr=document.getElementById('pageHeader');if(hdr)new MutationObserver(()=>{if(!hdr.querySelector('.ws-pill'))pwPlaceSwitches();}).observe(hdr,{childList:true,subtree:true});
  if(location.hash==='#tasks')setTimeout(()=>openTasksSection({push:false}),300);
  // Tasks on its own links here for Production's Settings pages: #settings-feed, #settings-profile…
  const sm=/^#settings-([a-z]+)$/.exec(location.hash);if(sm){history.replaceState(null,'',location.pathname+location.search);setTimeout(()=>goSettings(sm[1]),300);}
  if(location.hash==='#shedsetup'||location.hash==='#newbatch'||location.hash==='#account'||location.hash==='#security'){const t=location.hash.slice(1);history.replaceState(null,'',location.pathname+location.search);setTimeout(()=>pwOpenTab(t),300);}
});
