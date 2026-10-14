// ── Account: the farm profile and Security (the farm's two passwords) ──
// Manager password: ProdWise and CluckWise, every file of the farm. Farm password: workers in
// the Viewer, tasks and reports only. Both are set here; the sync server checks them (js/farmkey.js).
// (Farms turned on with one shared password are asked to set a manager password of their own.)
// Without password storage on the server, the password only guards joining the Viewer
// (kept in <farm>-access, the same way the old CluckWise Workers screen did).
let accTab='profile',accInfo=null,accStatus=null,accAccess=null,accLoaded=false,accBusy=false;
const ACC_TABS=[['profile','Farm profile'],['security','Security']];
function goAccount(tab){
  if(tab)accTab=tab;
  if(typeof toolPageOpen!=='undefined'&&toolPageOpen)closeToolPages();
  activeTab='account';render();window.scrollTo(0,0);
  accLoad();
}
// ── Manager name: one per farm, kept in CluckWise's farm file (settings.manager) so both apps
// and the Viewer use the same one. Set here (Farm profile) and when a new farm is created.
function farmFileUrl(slug){return `${SYNC_WORKER_URL}/?farm=${encodeURIComponent(slug)}&repo=${encodeURIComponent(SYNC_REPO)}`;}
function cachedManager(){try{return localStorage.getItem('pw-manager-'+accSlug())||'';}catch(e){return '';}}
function cacheManager(slug,name){try{localStorage.setItem('pw-manager-'+slug,name);}catch(e){}}
function managerNameShown(){return cachedManager();}   // per farm, so switching farms never shows the old one
async function loadManagerName(){
  if(!syncFarmName||!navigator.onLine)return;
  try{const r=await fetch(farmFileUrl(accSlug()));
    if(r.status===404)cacheManager(accSlug(),'');
    else if(r.ok){const j=await r.json();cacheManager(accSlug(),String((j.data&&j.data.settings&&j.data.settings.manager)||'').trim());}
  }catch(e){}
}
// Writes the name into the farm file (creating it for a new farm). True when saved.
async function saveManagerName(name,slug){
  slug=slug||accSlug();name=String(name||'').trim().replace(/\s+/g,' ').slice(0,40);
  for(let i=0;i<4;i++){
    let r;try{r=await fetch(farmFileUrl(slug));}catch(e){return false;}
    let sha=null,d={};
    if(r.ok){const j=await r.json();sha=j.sha||null;d=j.data&&typeof j.data==='object'?j.data:{};}
    else if(r.status!==404)return false;
    const old=String((d.settings&&d.settings.manager)||'').trim();
    if(old===name){cacheManager(slug,name);return true;}
    d.settings=Object.assign({},d.settings,{manager:name});
    ['tasks','history','batches','events','frequentTemplates','maintenance'].forEach(k=>{if(!Array.isArray(d[k]))d[k]=[];});
    d.history.unshift({id:'pw-'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),ts:Date.now(),action:'Settings',detail:old?`Manager changed from ${old} to ${name} (ProdWise)`:`Manager set to ${name} (ProdWise)`});
    let p;try{p=await fetch(farmFileUrl(slug),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({sha,data:d})});}catch(e){return false;}
    if(p.status===409)continue;
    if(!p.ok)return false;
    cacheManager(slug,name);
    return true;
  }
  return false;
}
function accSignedIn(){return !!(window.FarmKey&&syncFarmName&&accInfo&&accInfo.setup&&FarmKey.get(syncFarmName,'manager'));}
function accSlug(){return sanitizeUserFarmName(syncFarmName||'');}
function accAccessUrl(){return `${SYNC_WORKER_URL}/?farm=${encodeURIComponent(accSlug()+'-access')}&repo=${encodeURIComponent(SYNC_REPO)}`;}
// What the server knows about this farm's password, the signed-in devices, and the Viewer's join password
async function accLoad(){
  if(!syncFarmName||!window.FarmKey||accBusy)return;
  accBusy=true;
  try{
    accInfo=navigator.onLine?await FarmKey.info(syncFarmName):null;
    pwFarmKeyInfo=accInfo;
    accStatus=null;accAccess=null;
    if(accSignedIn()){const r=await FarmKey.action('manage',{farm:syncFarmName,op:'status'});accStatus=r.j&&r.j.ok?r.j:null;}
    await loadManagerName();
    if(!accInfo&&navigator.onLine){try{const r=await fetch(accAccessUrl());const j=r.ok?await r.json():null;accAccess=j&&j.data&&typeof j.data==='object'?j.data:{};}catch(e){accAccess=null;}}
  }finally{accBusy=false;accLoaded=true;}
  accRefresh();
}
function accRefresh(){const b=document.getElementById('accBody');if(b&&activeTab==='account')b.innerHTML=accSectionHtml(accTab);}
function accIcon(n){return settingsIcon(n);}
function accCard(icon,title,desc,body,extra=''){
  return `<div class="settings-section acc-card${extra}"><div class="settings-section-head"><span class="settings-icon">${accIcon(icon)}</span><div class="settings-section-title-wrap"><h4 class="settings-section-title">${title}</h4></div></div>${desc?`<p class="settings-section-desc">${desc}</p>`:''}${body}</div>`;
}
function accPwInput(id,ph,auto='new-password'){return `<input type="password" class="settings-input acc-pw" id="${id}" placeholder="${escapeAttr(ph)}" autocomplete="${auto}" />`;}
function accProfileHtml(){
  const st=siloStart(),name=displayFarmName()||'This farm';
  const silos=st!=null?`Silo ${st} to ${st+11}`:'Silo 1 · 2 · 3 per pair';
  const sec=!syncFarmName?'Connect to a farm to set a password':!accLoaded?'Open Security to check':accInfo&&accInfo.setup?(accInfo.locked?'Passwords on · locked':'Passwords on · not locked'):accInfo?'Passwords off':accAccess&&accAccess.password?'Farm password set (Viewer only)':'Farm password off';
  return `<div class="set-cards">
    ${accCard('farm',escapeHtml(name),'',`<dl class="acc-dl">
        <div><dt>Manager</dt><dd>${syncFarmName?(managerNameShown()?escapeHtml(managerNameShown()):'<span class="set-muted">Not set</span>'):'<span class="set-muted">Connect to a farm</span>'}</dd></div>
        <div><dt>Farm name</dt><dd>${escapeHtml(farmDisplayName||'—')}${farmDisplayName?'':' <span class="set-muted">uses the cloud farm ID</span>'}</dd></div>
        <div><dt>Cloud farm ID</dt><dd>${syncFarmName?escapeHtml(syncFarmName):'<span class="set-muted">Not connected</span>'}</dd></div>
        <div><dt>Silo numbers</dt><dd>${escapeHtml(silos)}</dd></div>
      </dl><div class="set-actions"><button type="button" class="set-btn" data-set-profile>Edit farm profile</button></div>`)}
    ${accCard('shield','Security',escapeHtml(sec)+'.',`<div class="set-actions"><button type="button" class="set-btn" data-acc-tab="security">Open Security</button></div>`)}
  </div>`;
}
function accSecurityHtml(){
  if(!syncFarmName)return `<div class="set-cards">${accCard('shield','Farm password','Connect this device to a farm first. The password protects that farm’s cloud files.',`<div class="set-actions"><button type="button" class="set-btn primary" data-pw-goset="farm">Go to Farm &amp; sync</button></div>`)}</div>`;
  if(!accLoaded||accBusy&&!accInfo&&!accAccess)return `<div class="set-cards">${accCard('shield','Farm password','',`<p class="set-muted">Checking the sync server…</p>`)}</div>`;
  const how=`<ul class="acc-how"><li><b>Manager password</b> — only you. ProdWise and CluckWise: every file of this farm, and this page.</li><li><b>Farm password</b> — your workers, once in the Viewer: tasks and reports only. It doesn’t open ProdWise or CluckWise.</li></ul>`;
  // The server has no password storage yet (or no signal): the password only guards joining the Viewer
  if(!accInfo){
    if(!navigator.onLine)return `<div class="set-cards">${accCard('shield','Farm password','You are offline. Connect to manage the farm password.','')}</div>`;
    const has=!!(accAccess&&accAccess.password);
    return `<div class="set-cards">
      ${accCard('shield','Farm password',`Workers type this once to join the Viewer.${has?' Workers already joined stay connected when it changes.':''}`,
        `<div class="acc-state"><span class="acc-chip ${has?'on':''}">${has?'Set':'Not set'}</span>${has&&accAccess.password.setAt?`<span class="set-muted">Changed ${escapeHtml(fmtRelativeTime(accAccess.password.setAt))}</span>`:''}</div>
        <div class="acc-fields">${accPwInput('accLegacyPw',has?'New farm password':'At least 4 characters')}<button type="button" class="set-btn primary" data-acc-legacy>${has?'Change':'Set password'}</button></div>`)}
      ${accCard('cloud','Server protection','Not available yet. The sync server needs its password storage (a KV namespace bound as <b>KEYS</b>) connected in Cloudflare. Once it is, this page offers to turn protection on: the server then checks the farm password on every read and write, so nobody can open your farm with its name alone.','',' acc-note')}
    </div>`;
  }
  // Ready on the server, not turned on yet
  if(!accInfo.setup){
    return `<div class="set-cards">${accCard('shield','Turn on passwords','The sync server checks them on every read and write, so nobody can open your farm’s files with its name alone.',
      `${how}<div class="acc-form">
        ${accInfo.oldPassword?`<label class="acc-lbl" for="accCur">Current Viewer password</label>${accPwInput('accCur','The one workers use now','current-password')}<span class="set-muted">Set earlier in CluckWise › Workers. It proves you’re the manager.</span>`:''}
        <label class="acc-lbl" for="accNew">Manager password</label>${accPwInput('accNew','At least 6 characters — only you')}
        <label class="acc-lbl" for="accNew2">Type it again</label>${accPwInput('accNew2','Same password')}
        <label class="acc-lbl" for="accFarm">Farm password (workers)</label>${accPwInput('accFarm',accInfo.oldPassword?'Can be the same as the Viewer password now':'At least 4 characters')}
        <div class="set-actions"><button type="button" class="set-btn primary" data-acc-setup>Turn on</button></div>
      </div>
      <p class="set-muted">Nothing is locked yet: devices that haven’t signed in keep syncing until you lock the farm.</p>`)}</div>`;
  }
  // On, but this device has no key yet
  if(!FarmKey.get(syncFarmName,'manager')){
    return `<div class="set-cards">${accCard('shield','Passwords','This farm uses passwords. Sign in once on this device with the manager password to manage them.',
      `<div class="acc-state"><span class="acc-chip on">On</span>${accInfo.locked?'<span class="acc-chip lock">Locked</span>':'<span class="acc-chip">Not locked</span>'}</div><div class="set-actions"><button type="button" class="set-btn primary" data-acc-signin>Sign in</button></div>`)}</div>`;
  }
  const st=accStatus,locked=!!(st?st.locked:accInfo.locked);
  const me=(FarmKey.get(syncFarmName,'manager')||{}).deviceId;
  const devs=st?st.devices.filter(d=>d.current).sort((a,b)=>(a.deviceId===me?-1:b.deviceId===me?1:0)||(a.role===b.role?0:a.role==='manager'?-1:1)||(b.seen||0)-(a.seen||0)):[];
  const rows=devs.map(d=>{
    const nm=d.name||(d.role==='manager'?'Manager':'Worker');
    const sub=[d.device,d.deviceId===me?'This device':d.seen?'Last used '+fmtRelativeTime(d.seen):''].filter(Boolean).join(' · ');
    return `<div class="acc-dev"><span class="acc-av">${escapeHtml(nm.split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase())}</span><span class="acc-dev-t"><b>${escapeHtml(nm)} <span class="acc-role${d.role==='manager'?' m':''}">${d.role==='manager'?'Manager':'Worker'}</span></b><small>${escapeHtml(sub)}</small></span>${d.deviceId===me?'':`<button type="button" class="set-btn acc-mini" data-acc-revoke="${escapeAttr(d.deviceId)}">Sign out</button>`}</div>`;}).join('');
  // Turned on with one shared password (both set at the same moment): workers could open the main apps
  const shared=!!(st&&accInfo.single&&st.mgrPwAt===st.farmPwAt);
  const mgrCard=accCard('key','Manager password',shared?'<b>Workers and managers share one password right now</b>, so a worker who knows it could open ProdWise or CluckWise. Set a manager password only you know: your other manager devices sign in again with it, workers stay connected with the password they have.':'Only you. ProdWise and CluckWise, every file of this farm. Your other manager devices sign in again with the new one.',
    `<div class="acc-form">${accPwInput('accChg','New manager password')}${accPwInput('accChg2','Type it again')}<div class="set-actions"><button type="button" class="set-btn primary" data-acc-change>${shared?'Set manager password':'Change manager password'}</button>${st&&st.mgrPwAt&&!shared?`<span class="set-muted">Changed ${escapeHtml(fmtRelativeTime(st.mgrPwAt))}</span>`:''}</div></div>`,shared?' acc-warn':'');
  const farmCard=accCard('key','Farm password (workers)','Workers type it once in the Viewer: tasks and reports only. Workers already signed in stay connected when it changes.',
    `<div class="acc-fields">${accPwInput('accFarmChg','New farm password')}<button type="button" class="set-btn primary" data-acc-farmchange>Change</button></div>${st&&st.farmPwAt&&!shared?`<span class="set-muted">Changed ${escapeHtml(fmtRelativeTime(st.farmPwAt))}</span>`:''}`);
  return `<div class="set-cards">
    ${shared?mgrCard:''}
    ${accCard('shield','Passwords',locked?'Only signed-in devices can sync.':'Devices that haven’t signed in can still sync. Lock the farm once every device below has signed in.',
      `<div class="acc-state"><span class="acc-chip on">On</span>${locked?'<span class="acc-chip lock">Locked</span>':'<span class="acc-chip">Not locked</span>'}</div>
      <div class="set-actions"><button type="button" class="set-btn ${locked?'':'primary'}" data-acc-lock="${locked?'0':'1'}">${locked?'Unlock farm':'Lock farm'}</button></div>`)}
    ${accCard('user',`Signed-in devices <span class="acc-count">${devs.length||''}</span>`,'Sign out a lost phone or someone who left. They need a password to come back. A Manager device you don’t know? Sign it out and change the manager password.',
      `<div class="acc-devs">${rows||'<p class="set-muted">Loading…</p>'}</div>${devs.length>1?'<div class="set-actions"><button type="button" class="set-btn" data-acc-signoutall>Sign out all other devices</button></div>':''}`)}
    ${shared?'':mgrCard}
    ${farmCard}
  </div>`;
}
function accSectionHtml(t){return t==='security'?accSecurityHtml():accProfileHtml();}
function renderAccountPage(){
  if(!ACC_TABS.some(x=>x[0]===accTab))accTab='profile';
  return `<div class="set-page acc-page"><nav class="set-tabs" aria-label="Account sections">${ACC_TABS.map(([k,l])=>`<button type="button" class="set-tab${k===accTab?' on':''}" data-acc-tab="${k}"${k===accTab?' aria-current="page"':''}>${escapeHtml(l)}</button>`).join('')}</nav>
    <div class="set-body" id="accBody">${accSectionHtml(accTab)}</div></div>`;
}
// Tap once to arm, again to do it
function accArm(btn,label,fn){
  if(btn.dataset.armed!=='1'){btn.dataset.armed='1';btn.dataset.label=btn.textContent;btn.textContent=label;clearTimeout(btn._t);btn._t=setTimeout(()=>{btn.dataset.armed='';btn.textContent=btn.dataset.label;},3500);return;}
  clearTimeout(btn._t);btn.dataset.armed='';fn();
}
async function accManage(body,okMsg){
  const r=await FarmKey.action('manage',Object.assign({farm:syncFarmName},body));
  if(!(r.j&&r.j.ok)){showToast((r.j&&r.j.error)||'Could not save. Check your connection.',true);return false;}
  showToast(okMsg);accLoad();return true;
}
function accVal(id){const e=document.getElementById(id);return e?e.value:'';}
async function accSetup(btn){
  const pw=accVal('accNew'),pw2=accVal('accNew2'),fp=accVal('accFarm'),cur=accVal('accCur');
  if(pw.length<6){showToast('Manager password: at least 6 characters.',true);document.getElementById('accNew')?.focus();return;}
  if(pw!==pw2){showToast('The two manager passwords don’t match.',true);document.getElementById('accNew2')?.focus();return;}
  if(fp.length<4){showToast('Farm password: at least 4 characters.',true);document.getElementById('accFarm')?.focus();return;}
  if(fp===pw){showToast('Use a different manager password from the farm password.',true);document.getElementById('accNew')?.focus();return;}
  btn.disabled=true;
  const r=await FarmKey.action('setup',{farm:syncFarmName,managerPassword:pw,farmPassword:fp,current:cur,deviceId:FarmKey.newDeviceId('manager'),name:'ProdWise',device:FarmKey.deviceLabel()});
  btn.disabled=false;
  if(!(r.j&&r.j.key)){showToast((r.j&&r.j.error)||'Could not turn on the farm password. Check your connection.',true);return;}
  FarmKey.set(syncFarmName,'manager',{key:r.j.key,deviceId:r.j.deviceId,role:'manager',at:Date.now()});
  showToast('Passwords on. Sign in once in CluckWise with the manager password.');
  accLoad();
}
async function accChange(){
  const pw=accVal('accChg'),pw2=accVal('accChg2');
  if(pw.length<6){showToast('Manager password: at least 6 characters.',true);document.getElementById('accChg')?.focus();return;}
  if(pw!==pw2){showToast('The two passwords don’t match.',true);document.getElementById('accChg2')?.focus();return;}
  await accManage({op:'passwords',managerPassword:pw},'Manager password set. Your other manager devices sign in again with it; workers stay connected.');
}
async function accFarmChange(){
  const pw=accVal('accFarmChg');
  if(pw.length<4){showToast('Farm password: at least 4 characters.',true);document.getElementById('accFarmChg')?.focus();return;}
  await accManage({op:'passwords',farmPassword:pw},'Farm password changed. Workers already signed in stay connected.');
}
// No password storage on the server: the Viewer's join password, in <farm>-access (same hash as CluckWise used)
async function accSetLegacy(btn){
  const pw=accVal('accLegacyPw');
  if(pw.length<4){showToast('Use at least 4 characters.',true);document.getElementById('accLegacyPw')?.focus();return;}
  btn.disabled=true;
  try{
    const salt=[...crypto.getRandomValues(new Uint8Array(16))].map(b=>b.toString(16).padStart(2,'0')).join('');
    const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${salt}|${String(syncFarmName).trim().toLowerCase()}|${pw}`));
    const hash=[...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
    let done=false;
    for(let i=0;i<4&&!done;i++){
      const g=await fetch(accAccessUrl());const j=g.ok?await g.json():(g.status===404?{sha:null,data:{}}:null);
      if(!j)throw new Error('read');
      const d=j.data&&typeof j.data==='object'?j.data:{};if(!Array.isArray(d.members))d.members=[];
      const had=!!d.password;d.password={salt,hash,setAt:Date.now()};
      const p=await fetch(accAccessUrl(),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({sha:j.sha||null,data:d})});
      if(p.status===409)continue;
      if(!p.ok)throw new Error('write');
      done=true;showToast(had?'Farm password changed. Workers already joined stay connected.':'Farm password set. Workers type it once to join the Viewer.');
    }
    if(!done)throw new Error('conflict');
  }catch(e){showToast('Could not save the password. Check your connection.',true);}
  btn.disabled=false;accLoad();
}
document.addEventListener('click',e=>{
  const at=e.target.closest('[data-acc-tab]');if(at){goAccount(at.dataset.accTab);return;}
  const b=e.target.closest('[data-acc-setup],[data-acc-signin],[data-acc-change],[data-acc-farmchange],[data-acc-lock],[data-acc-signoutall],[data-acc-revoke],[data-acc-legacy]');
  if(!b)return;
  if(b.matches('[data-acc-setup]'))accSetup(b);
  else if(b.matches('[data-acc-signin]'))farmKeyPrompt(null);
  else if(b.matches('[data-acc-change]'))accChange();
  else if(b.matches('[data-acc-farmchange]'))accFarmChange();
  else if(b.matches('[data-acc-legacy]'))accSetLegacy(b);
  else if(b.matches('[data-acc-lock]')){const lock=b.dataset.accLock==='1';accArm(b,lock?'Tap again to lock':'Tap again to unlock',()=>accManage({op:'lock',locked:lock},lock?'Farm locked. Only signed-in devices can sync.':'Farm unlocked.'));}
  else if(b.matches('[data-acc-signoutall]'))accArm(b,'Tap again: all others sign in again',()=>accManage({op:'signoutAll'},'All other devices signed out.'));
  else if(b.matches('[data-acc-revoke]'))accArm(b,'Confirm',()=>accManage({op:'revoke',deviceIds:[b.dataset.accRevoke]},'Device signed out.'));
});
document.addEventListener('keydown',e=>{
  if(e.key!=='Enter'||!e.target.classList||!e.target.classList.contains('acc-pw'))return;
  const btn=e.target.closest('.acc-form,.acc-fields')?.querySelector('.set-btn.primary');if(btn){e.preventDefault();btn.click();}
});
