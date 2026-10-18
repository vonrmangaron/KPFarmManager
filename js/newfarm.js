// ── New farm: a guided setup (2026-10-18, mockup TfifMNFZqHk23aJCyEwgz2) ─────────────────────
// Opens when Connect finds no farm by that name. Five steps: farm (name + manager) → sheds & silos
// (the fixed 8 sheds / 4 pairs / 12 silos, and the silo numbers painted on site) → first batch (all
// 8 sheds filled at once, like Set up sheds) → passwords (like Account › Security) → ready (next jobs).
// Nothing reaches the cloud before step 1's Continue; every later step can be skipped.
let nf=null;
const NF_STEPS=[['Farm','Name and manager'],['Sheds & silos','8 sheds · 12 silos'],['First batch','Placement and birds'],['Protect','Passwords'],['Ready','']];
function openNewFarmWizard(clean){
  nf={step:1,farm:clean,display:'',manager:'',siloFrom:'1',batch:'',first:'',birds:'',doc:'',stagger:'2',mgrPw:'',mgrPw2:'',farmPw:'',created:false,batchDone:false,pwDone:false,busy:false};
  try{closeSyncModal();closeSettingsDrawer();}catch(e){}
  let el=document.getElementById('nfRoot');if(!el){el=document.createElement('div');el.id='nfRoot';document.body.appendChild(el);}
  nfRender();
}
function nfClose(){const el=document.getElementById('nfRoot');if(el)el.innerHTML='';document.body.classList.remove('nf-open');nf=null;}
function nfSummary(){
  const first=nf.first?parseExcelDate(nf.first):null,step=Number(nf.stagger)||0,birds=Math.max(0,Math.floor(Number(String(nf.birds).replace(/[^0-9.]/g,''))||0));
  if(!first)return birds?`8 sheds · ${(birds*8).toLocaleString('en-US')} birds`:'Enter the first placement date and birds per shed.';
  const last=addDays(first,3*step),f=d=>fmtShortNoYear(d);
  return `8 sheds · ${birds?(birds*8).toLocaleString('en-US')+' birds · ':''}placements ${step?`${f(first)} → ${f(last)}`:f(first)} · clean-outs ${step?`${f(addDays(first,DEFAULT_CLEANOUT_DAYS))} → ${f(addDays(last,DEFAULT_CLEANOUT_DAYS))}`:f(addDays(first,DEFAULT_CLEANOUT_DAYS))}`;
}
function nfSiloPicture(){
  const s=Math.max(1,Math.floor(Number(nf.siloFrom))||1);
  return `<div class="nf-farm">${[1,2,3,4].map(g=>`<div class="nf-pr"><span class="nf-pt">${escapeHtml(pairLabel(g))}</span><div class="nf-sh"><span>${g*2-1}</span><span>${g*2}</span></div><div class="nf-si">${[0,1,2].map(k=>`<span>${s+(g-1)*3+k}</span>`).join('')}</div></div>`).join('')}</div>`;
}
function nfVal(k){return escapeAttr(nf[k]||'');}
function nfBody(){
  const st=nf.step;
  if(st===1)return {k:'Step 1 of 5',h:'Your farm',p:'This name isn’t in the cloud yet, so let’s set it up.',b:`
    <label class="nf-fld">Farm name<input type="text" data-nf="display" maxlength="40" value="${nfVal('display')}" placeholder="${escapeAttr(nf.farm)}" autocomplete="organization"><small>Shown at the top of every page. Cloud ID: <b>${escapeHtml(nf.farm)}</b></small></label>
    <label class="nf-fld">Manager<input type="text" data-nf="manager" maxlength="40" value="${nfVal('manager')}" placeholder="e.g. Von" autocomplete="name"><small>Tasks assigned to the manager stay off workers’ phones.</small></label>`,
    f:`<span class="nf-sp"></span><button type="button" class="nf-btn" data-nf-act="cancel">Cancel</button><button type="button" class="nf-btn pri" data-nf-act="next">Continue</button>`};
  if(st===2){const s=Math.max(1,Math.floor(Number(nf.siloFrom))||1);return {k:'Step 2 of 5',h:'Sheds and silos',p:'Every farm has 4 pairs of sheds, each pair sharing a bank of 3 silos. Match the silo numbers painted on your farm.',b:`
    <div class="nf-chips"><span>8 sheds</span><span>4 pairs</span><span>12 silos · 3 per pair</span></div>
    <div data-nf-pic>${nfSiloPicture()}</div>
    <label class="nf-fld">Silo numbers painted on your farm<span class="nf-num"><input type="number" min="1" max="990" step="1" inputmode="numeric" data-nf="siloFrom" value="${nfVal('siloFrom')}"><span>to <b data-nf-siloto>${s+11}</b></span></span><small>Start at a different number (e.g. 13) and the picture renumbers. Also in Account › Farm profile.</small></label>`,
    f:`<button type="button" class="nf-btn lk" data-nf-act="back">Back</button><span class="nf-sp"></span><button type="button" class="nf-btn pri" data-nf-act="next">Continue</button>`};}
  if(st===3)return {k:'Step 3 of 5',h:'Start the first batch',p:`The essentials for all 8 sheds. Clean-out is placement + ${DEFAULT_CLEANOUT_DAYS} days; fine-tune each shed later on Set up sheds.`,b:`
    <div class="nf-two"><label class="nf-fld">Batch number<input type="text" data-nf="batch" maxlength="32" value="${nfVal('batch')}" placeholder="e.g. 2801"></label><label class="nf-fld">First placement<input type="date" data-nf="first" value="${nfVal('first')}"></label></div>
    <div class="nf-two"><label class="nf-fld">Birds per shed<input type="number" min="0" step="1" inputmode="numeric" data-nf="birds" value="${nfVal('birds')}" placeholder="e.g. 52000"></label><label class="nf-fld">DOC weight (g)<input type="number" min="30" max="80" step="0.1" inputmode="decimal" data-nf="doc" value="${nfVal('doc')}" placeholder="e.g. 42"></label></div>
    <label class="nf-fld">Placement order<select data-nf="stagger">${[['0','All sheds the same day'],['1','Each pair +1 day'],['2','Each pair +2 days'],['3','Each pair +3 days']].map(([v,l])=>`<option value="${v}"${nf.stagger===v?' selected':''}>${l}</option>`).join('')}</select></label>
    <div class="nf-note" data-nf-sum>${escapeHtml(nfSummary())}</div>`,
    f:`<button type="button" class="nf-btn lk" data-nf-act="back">Back</button><span class="nf-sp"></span><button type="button" class="nf-btn" data-nf-act="skip">Skip, set up later</button><button type="button" class="nf-btn pri" data-nf-act="next">${nf.busy?'Starting…':'Start batch'}</button>`};
  if(st===4)return {k:'Step 4 of 5',h:'Protect your farm',p:'Two passwords: one for you, one to share with your workers.',b:`
    <div class="nf-two nf-pw"><div class="nf-pwc"><b>Manager password</b><span>Only you. Production and Tasks, on every device.</span><input type="password" data-nf="mgrPw" autocomplete="new-password" placeholder="At least 6 characters" value="${nfVal('mgrPw')}"><input type="password" data-nf="mgrPw2" autocomplete="new-password" placeholder="Type it again" value="${nfVal('mgrPw2')}"></div>
    <div class="nf-pwc"><b>Farm password</b><span>For workers, once, in the Crew app. Tasks and reports only.</span><input type="text" data-nf="farmPw" autocomplete="off" placeholder="At least 4 characters" value="${nfVal('farmPw')}"></div></div>
    <p class="nf-small">After 5 wrong tries a phone waits 10 minutes. Change them any time in Account › Security.</p>`,
    f:`<button type="button" class="nf-btn lk" data-nf-act="back">Back</button><span class="nf-sp"></span><button type="button" class="nf-btn" data-nf-act="skip">Skip for now</button><button type="button" class="nf-btn pri" data-nf-act="next">${nf.busy?'Turning on…':'Turn on passwords'}</button>`};
  const name=nf.display.trim()||nf.farm;
  const ok=[nf.batchDone?`Batch ${escapeHtml(predState.batchNumber||nf.batch)} · 8 sheds${Number(nf.birds)>0?' · '+(Number(nf.birds)*8).toLocaleString('en-US')+' birds':''}`:'No batch yet',nf.pwDone?'passwords on':'no passwords yet','synced to the cloud'].join(' · ');
  const card=(t,s,act,lbl)=>`<div class="nf-nx"><b>${t}</b><span>${s}</span><button type="button" class="nf-lnk" data-nf-go="${act}">${lbl}</button></div>`;
  return {k:'All set',h:`${escapeHtml(name)} is ready`,p:'Here’s what to do next.',b:`
    <div class="nf-ok"><i>✓</i><div><b>${escapeHtml(name)}</b><span>${ok}</span></div></div>
    <div class="nf-two">${card('Invite your workers','Send them the Crew app link'+(nf.pwDone?' and the farm password.':'. Set a farm password first in Account › Security.'),'invite','Copy Crew invite')}
    ${nf.batchDone?card('Check each shed','Set up sheds: exact placements, birds and DOC weight.','setup','Open Set up sheds'):card('Start the first batch','New batch, then Set up sheds.','newbatch','Start a batch')}
    ${card('Book the first feed','Feed loads: starter deliveries before placement.','loads','Open Feed loads')}
    ${card('Plan the work','Tasks: the batch checklist and audits.','tasks','Open Tasks')}</div>`,
    f:`<span class="nf-sp"></span><button type="button" class="nf-btn amb" data-nf-act="home">Go to Home</button>`};
}
function nfRender(){
  const el=document.getElementById('nfRoot');if(!el||!nf)return;
  const x=nfBody(),st=nf.step;
  document.body.classList.add('nf-open');
  el.innerHTML=`<div class="nf-scrim"></div><div class="nf-win" role="dialog" aria-modal="true" aria-label="New farm setup">
    <aside class="nf-side"><div class="nf-brand"><span class="nf-logo"></span>ProdWise</div>
      <ol class="nf-list">${NF_STEPS.map(([t,s],i)=>{const n=i+1,cls=n<st?'done':n===st?'on':'';return `<li class="${cls}"><b>${n<st?'✓':n}</b><span>${escapeHtml(t)}${s?`<small>${escapeHtml(s)}</small>`:''}</span></li>`;}).join('')}</ol>
      <p class="nf-help">About 3 minutes. Everything can be changed later in Account and Settings.</p></aside>
    <div class="nf-main"><div class="nf-bar">${NF_STEPS.map((_,i)=>`<span class="${i<st?'on':''}"></span>`).join('')}</div>
      <div class="nf-head"><span class="nf-k">${x.k}</span><h2>${x.h}</h2><p>${x.p}</p></div>
      <div class="nf-body">${x.b}</div>
      <div class="nf-foot">${x.f}</div></div></div>`;
  const first=el.querySelector('.nf-body input,.nf-body select');if(first&&st<5)setTimeout(()=>first.focus(),40);
}
async function nfNext(){
  if(!nf||nf.busy)return;const st=nf.step;
  if(st===1){
    const mgr=nf.manager.trim().replace(/\s+/g,' ');if(!mgr){showToast('Enter the manager’s name.',true);return;}
    nf.busy=true;const ok=await saveManagerName(mgr,nf.farm);nf.busy=false;
    if(!ok){showToast('Could not reach the cloud — check your connection.',true);return;}
    if(nf.display.trim())setFarmDisplayName(nf.display.trim());
    createNewFarm(nf.farm,{quiet:true});nf.created=true;nf.step=2;nfRender();return;
  }
  if(st===2){const n=Math.floor(Number(nf.siloFrom));setSiloStart(n>1?n:'');nf.step=3;nfRender();return;}
  if(st===3){
    const batch=sanitizeBatchNumber(nf.batch),birds=Math.floor(Number(nf.birds)),doc=String(nf.doc||'').trim();
    if(!batch){showToast('Enter a batch number.',true);return;}
    if(!nf.first){showToast('Enter the first placement date.',true);return;}
    if(!(birds>0)){showToast('Enter the birds per shed.',true);return;}
    nf.busy=true;nfRender();
    try{
      await startNewBatch(batch,{downloadBackup:false,openFilePicker:false,quiet:true});
      if(farmData){const first=parseExcelDate(nf.first),step=Number(nf.stagger)||0;
        farmData.sheds.forEach((s,i)=>{updateShedField(i,'placementDate',iso(addDays(first,Math.floor(i/2)*step)));updateShedField(i,'initialPopulation',String(birds));if(doc)updateShedField(i,'chickWeightGrams',doc);});
        saveState();schedulePush();nf.batchDone=true;}
    }finally{nf.busy=false;}
    if(!nf.batchDone){showToast('The batch couldn’t be started — try again, or skip and use New batch later.',true);nfRender();return;}
    nf.step=4;nfRender();return;
  }
  if(st===4){
    const pw=nf.mgrPw,pw2=nf.mgrPw2,fp=nf.farmPw;
    if(pw.length<6){showToast('Manager password: at least 6 characters.',true);return;}
    if(pw!==pw2){showToast('The two manager passwords don’t match.',true);return;}
    if(fp.length<4){showToast('Farm password: at least 4 characters.',true);return;}
    if(fp===pw){showToast('Use a different manager password from the farm password.',true);return;}
    nf.busy=true;nfRender();
    const r=await FarmKey.action('setup',{farm:syncFarmName,managerPassword:pw,farmPassword:fp,current:'',deviceId:FarmKey.newDeviceId('manager'),name:'ProdWise',device:FarmKey.deviceLabel()});
    nf.busy=false;
    if(!(r.j&&r.j.key)){showToast((r.j&&r.j.error)||'Could not turn on the passwords. Check your connection, or skip and do it in Account › Security.',true);nfRender();return;}
    FarmKey.set(syncFarmName,'manager',{key:r.j.key,deviceId:r.j.deviceId,role:'manager',at:Date.now()});
    nf.pwDone=true;nf.step=5;nfRender();return;
  }
}
function nfFinish(then){
  nfClose();activeTab='home';render();
  if(then)then();
}
function nfInviteText(){
  const link=new URL('cluckwise/viewer.html',location.href.replace(/#.*$/,'')).href;
  return `Join ${displayFarmName()||syncFarmName} on ProdWise Crew:\n${link}\nFarm name: ${syncFarmName}${nf&&nf.pwDone&&nf.farmPw?`\nFarm password: ${nf.farmPw}`:''}`;
}
document.addEventListener('input',e=>{
  const t=e.target.closest&&e.target.closest('#nfRoot [data-nf]');if(!t||!nf)return;
  nf[t.dataset.nf]=t.value;
  if(t.dataset.nf==='siloFrom'){const p=document.querySelector('[data-nf-pic]');if(p)p.innerHTML=nfSiloPicture();const to=document.querySelector('[data-nf-siloto]');if(to)to.textContent=Math.max(1,Math.floor(Number(nf.siloFrom))||1)+11;}
  const sm=document.querySelector('[data-nf-sum]');if(sm)sm.textContent=nfSummary();
});
document.addEventListener('change',e=>{const t=e.target.closest&&e.target.closest('#nfRoot select[data-nf]');if(t&&nf){nf[t.dataset.nf]=t.value;const sm=document.querySelector('[data-nf-sum]');if(sm)sm.textContent=nfSummary();}});
document.addEventListener('keydown',e=>{if(!nf||!document.getElementById('nfRoot')?.firstChild)return;if(e.key==='Enter'&&e.target.closest&&e.target.closest('#nfRoot input')){e.preventDefault();nfNext();}});
document.addEventListener('click',async e=>{
  const a=e.target.closest('#nfRoot [data-nf-act]');
  if(a&&nf){const act=a.dataset.nfAct;
    if(act==='next')nfNext();
    else if(act==='back'&&nf.step>1){nf.step--;nfRender();}
    else if(act==='skip'){nf.step++;nfRender();}
    else if(act==='cancel'){nfClose();try{showConnectForm();openSyncModal();}catch(x){}}
    else if(act==='home')nfFinish();
    return;}
  const g=e.target.closest('#nfRoot [data-nf-go]');
  if(g&&nf){const go=g.dataset.nfGo;
    if(go==='invite'){const txt=nfInviteText();try{await navigator.clipboard.writeText(txt);showToast('Crew invite copied — paste it in a message to your workers.');}catch(x){prompt('Copy this invite:',txt);}return;}
    if(go==='setup')nfFinish(()=>{activeTab='shedsetup';render();});
    else if(go==='newbatch')nfFinish(()=>openNewBatchModal());
    else if(go==='loads')nfFinish(()=>openLoadsModal());
    else if(go==='tasks')nfFinish(()=>openTasksSection());
  }
});
