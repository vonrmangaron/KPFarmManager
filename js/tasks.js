// One app (2026-10-17, mockup NEZeifRccwQXod4adNMARP): Tasks — the CluckWise app — opens inside
// ProdWise. It loads once in a frame over the page and stays alive, so switching back and forth is
// instant and Tasks opens where you left it. A Production / Tasks switch sits under the logo on the
// rail (computer) and at the top of the page (phone); CluckWise shows the same switch on its side and
// asks for Production through postMessage. Same site, so both share the manager sign-in key.
// The phone's back button returns to Production. The old CluckWise link still works on its own.
let pwSection='production',cwFrame=null,pwTasksPushed=false;
const PW_SW_ICON={production:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/></svg>',
  tasks:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>'};
// kind 'rail' (stacked, under the logo) or 'pill' (phone header)
function pwSwitchHtml(kind){
  const b=(k,label)=>`<button type="button" data-ws="${k}" aria-pressed="${pwSection===k}" class="${pwSection===k?'on':''}" title="${k==='tasks'?'Tasks: planner, maintenance, routine and guide':'Production: sheds, feed and pickups'}">${PW_SW_ICON[k]}<span>${label}</span></button>`;
  return `<div class="${kind==='rail'?'ws-sw':'ws-pill'}" role="group" aria-label="Section">${b('production','Production')}${b('tasks','Tasks')}</div>`;
}
function pwSyncSwitch(){document.querySelectorAll('[data-ws]').forEach(x=>{const on=x.dataset.ws===pwSection;x.classList.toggle('on',on);x.setAttribute('aria-pressed',String(on));});}
function pwPlaceSwitches(){
  const rail=document.getElementById('pwRail');
  if(rail&&!rail.querySelector('.ws-sw')){const lg=rail.querySelector('.pwr-logo');if(lg)lg.insertAdjacentHTML('afterend',pwSwitchHtml('rail'));}
  const hl=document.querySelector('#pageHeader .page-header-left');
  if(hl&&!hl.querySelector('.ws-pill'))hl.insertAdjacentHTML('afterbegin',pwSwitchHtml('pill'));
  pwSyncSwitch();
}
function openTasksSection(opts){
  opts=opts||{};
  if(!cwFrame){
    cwFrame=document.createElement('iframe');cwFrame.id='cwFrame';cwFrame.title='Tasks';
    cwFrame.src=CLUCKWISE_URL+'index.html?embed=1';
    document.body.appendChild(cwFrame);
  }
  pwSection='tasks';document.body.classList.add('pw-in-tasks');
  if(opts.push!==false&&location.hash!=='#tasks'){history.pushState({pwSection:'tasks'},'','#tasks');pwTasksPushed=true;}
  pwSyncSwitch();
  pwTasksTopColour();cwFrame.addEventListener('load',pwTasksTopColour,{once:true});
  try{cwFrame.focus();}catch(e){}
}
// The status-bar strip above the frame takes the colour of Tasks' header (light or dark theme)
function pwTasksTopColour(){
  try{const d=cwFrame&&cwFrame.contentDocument;const tb=d&&d.querySelector('.topbar');if(!tb)return;
    let c=getComputedStyle(tb).backgroundColor;const a=c.match(/rgba\([^)]*,\s*([\d.]+)\)/);
    if(!c||c==='transparent'||(a&&+a[1]<0.5))c=d.body.classList.contains('theme-dark')?'#111827':'#FFF8EC';
    document.documentElement.style.setProperty('--cw-top',c);}catch(e){}
}
setInterval(()=>{if(pwSection==='tasks')pwTasksTopColour();},2000);   // follows a theme change made inside Tasks
function openProductionSection(opts){
  opts=opts||{};
  if(pwSection!=='tasks')return;
  pwSection='production';document.body.classList.remove('pw-in-tasks');
  if(!opts.fromPop&&location.hash==='#tasks'){
    if(pwTasksPushed){pwTasksPushed=false;history.back();}           // the entry we added: step back over it
    else history.replaceState(null,'',location.pathname+location.search);   // opened straight at #tasks
  }
  pwSyncSwitch();
  if(typeof render==='function')render();
}
window.addEventListener('popstate',()=>{if(location.hash==='#tasks')openTasksSection({push:false});else{pwTasksPushed=false;openProductionSection({fromPop:true});}});
window.addEventListener('message',e=>{
  if(e.origin!==location.origin||!e.data)return;
  if(e.data.pwSection==='production')openProductionSection();
  if(e.data.pwSection==='tasks')openTasksSection();
});
document.addEventListener('click',e=>{
  const w=e.target.closest('[data-ws]');
  if(w){e.preventDefault();w.dataset.ws==='tasks'?openTasksSection():openProductionSection();return;}
});
document.addEventListener('DOMContentLoaded',()=>{
  // the rail is built a moment after start; the page header re-renders — keep the switches in place
  setTimeout(pwPlaceSwitches,0);
  const hdr=document.getElementById('pageHeader');if(hdr)new MutationObserver(()=>{if(!hdr.querySelector('.ws-pill'))pwPlaceSwitches();}).observe(hdr,{childList:true,subtree:true});
  if(location.hash==='#tasks')setTimeout(()=>openTasksSection({push:false}),300);
});
