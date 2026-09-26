function showToast(msg,isError){const el=document.getElementById('toast');if(!el)return;el.textContent=msg;el.classList.toggle('error',!!isError);el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3200);}
function renderDeliveriesSummary(group){
  const summary=groupLoadSummary(group);const totalOrders=summary.loadCount;
  if(totalOrders===0)return `<span class="count">No loads affecting this group</span>`;
  const orderWord=totalOrders===1?'load':'loads';
  const activeTypes=['starter','grower','finisher','withdrawal','unspecified'].map(k=>({id:k,label:summary.buckets[k].label,loads:summary.buckets[k].loads,blocks:summary.buckets[k].blocks})).filter(x=>x.loads>0);
  const chips=activeTypes.map(t=>`<span class="chip ${t.id}">${t.label} <span class="num">${fmtBlocks(t.blocks)}</span></span>`).join('');
  return `<span class="count">${totalOrders} ${orderWord}</span><span class="delivery-type-chips">${chips}</span>`;
}
/* === END PART 1 — Part 2 continues with openSettingsDrawer through DOMContentLoaded === */
function openSettingsDrawer(){
  settingsDrawerOpen=true;renderSettingsDrawerBody();
  const drawer=document.getElementById('settingsDrawer');const scrim=document.getElementById('settingsScrim');
  if(drawer)drawer.classList.add('open');if(scrim)scrim.classList.add('open');
  if(drawer)drawer.setAttribute('aria-hidden','false');
}
function closeSettingsDrawer(){
  settingsDrawerOpen=false;
  const drawer=document.getElementById('settingsDrawer');const scrim=document.getElementById('settingsScrim');
  if(drawer)drawer.classList.remove('open');if(scrim)scrim.classList.remove('open');
  if(drawer)drawer.setAttribute('aria-hidden','true');
}
function settingsIcon(name){
  const icons={
    import:'<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
    cloud:'<path d="M17.5 19H7a5 5 0 1 1 1.3-9.8 6 6 0 0 1 11.4 2.4A4 4 0 0 1 17.5 19z"/>',
    archive:'<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    document:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/>',
    sync:'<path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5M3 21v-5h5"/>',
    swap:'<path d="M8 3 4 7l4 4"/><path d="M4 7h11a5 5 0 0 1 5 5v1"/><path d="m16 21 4-4-4-4"/><path d="M20 17H9a5 5 0 0 1-5-5v-1"/>',
    unplug:'<path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>',
    bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||''}</svg>`;
}
function renderSettingsDrawerBody(){
  const body=document.getElementById('settingsDrawerBody');if(!body)return;
  const sections=[renderSettingsDataCard(),renderSettingsSyncCard(),renderSettingsBatchHistoryCard(),renderSettingsNotificationsCard(),renderSettingsReportsCard()];
  body.innerHTML=sections.join('<div class="settings-divider"></div>')+'<div class="settings-foot">Backed up to <strong>'+escapeHtml(SYNC_REPO)+'</strong> on GitHub</div>';
  // Bind notification checkboxes directly — belt-and-braces alongside the
  // document-level delegated change handler.
  if(typeof bindNotifCheckboxes==='function')bindNotifCheckboxes();
}
function renderSettingsNotificationsCard(){
  return `<div class="settings-section">
    <div class="settings-section-head"><span class="settings-icon">${settingsIcon('bell')}</span><div class="settings-section-title-wrap"><h4 class="settings-section-title">Notifications</h4></div></div>
    <p class="settings-section-desc">Choose which alerts appear in the bell icon at the top of the app.</p>
    <label class="settings-toggle-row">
      <input type="checkbox" id="notifShedPerf" ${notifPrefs.shedPerformance?'checked':''} />
      <span class="settings-toggle-text"><strong>Shed performance</strong><br><span class="settings-toggle-sub">Warns when a shed falls significantly behind the Ross 308 growth standard.</span></span>
    </label>
    <label class="settings-toggle-row">
      <input type="checkbox" id="notifFeedBalance" ${notifPrefs.feedBalance?'checked':''} />
      <span class="settings-toggle-text"><strong>Feed balance</strong><br><span class="settings-toggle-sub">Warns when a group has under 3 days of feed left, or when feed will run out on a weekend.</span></span>
    </label>
  </div>`;
}
function renderSettingsReportsCard(){
  const hasData=!!farmData;
  const batchLabel=(predState.batchNumber||(farmData&&farmData.batchNumber)||'').trim();
  const placedCount=farmData?farmData.sheds.filter(s=>s.placementDate).length:0;
  let noteHtml='';
  if(!hasData) noteHtml=`<p class="settings-section-note">Import Excel first.</p>`;
  else if(batchLabel) noteHtml=`<p class="settings-section-note">Batch <strong>${escapeHtml(batchLabel)}</strong> · ${placedCount} shed${placedCount===1?'':'s'} placed</p>`;
  else noteHtml=`<p class="settings-section-note">No batch number set — the report will still generate.</p>`;
  return `<div class="settings-section">
    <div class="settings-section-head"><span class="settings-icon">${settingsIcon('document')}</span><div class="settings-section-title-wrap"><h4 class="settings-section-title">Reports</h4></div></div>
    <p class="settings-section-desc">Generate a print-ready batch report with every detail — shed performance, pickups, feed loads, silo status, and estimates. Opens your browser's print dialog — choose "Save as PDF" to download.</p>
    ${noteHtml}
    <div class="settings-actions"><button class="settings-btn settings-btn-primary" id="settingsReportBtn" type="button" ${hasData?'':'disabled'}>${settingsIcon('document')}Generate batch report</button></div>
  </div>`;
}
function renderSettingsDataCard(){
  return `<div class="settings-section">
    <div class="settings-section-head"><span class="settings-icon">${settingsIcon('import')}</span><div class="settings-section-title-wrap"><h4 class="settings-section-title">Import data</h4></div></div>
    <p class="settings-section-desc">Import the sheds Excel file to fill in shed data for the current batch. In-yard readings, extra reading days, mortality rates, chick weights, and target-pickup settings are preserved across re-imports.</p>
    <div class="settings-actions"><button class="settings-btn settings-btn-primary" id="settingsImportBtn" type="button">${settingsIcon('import')}Import Excel</button></div>
  </div>`;
}
function renderSettingsSyncCard(){
  if(!syncFarmName){
    return `<div class="settings-section">
      <div class="settings-section-head"><span class="settings-icon">${settingsIcon('cloud')}</span><div class="settings-section-title-wrap"><h4 class="settings-section-title">Cloud sync</h4></div></div>
      <p class="settings-section-desc">Not connected yet. Enter a farm name to sync your data across devices. If the farm doesn't exist, you'll be asked to confirm creating it.</p>
      <span class="settings-field-label">Farm name</span>
      <input type="text" class="settings-input" id="settingsFarmInput" placeholder="e.g. kiripark1" autocomplete="off" spellcheck="false" maxlength="40" />
      <div class="settings-actions"><button class="settings-btn settings-btn-primary" id="settingsConnectBtn" type="button">${settingsIcon('cloud')}Connect</button></div>
      <p class="settings-section-note">Backed up to <strong>${escapeHtml(SYNC_REPO)}</strong> on GitHub.</p>
    </div>`;
  }
  const batch=currentBatchKey();
  const fileName=batch?`${sanitizeUserFarmName(syncFarmName)}${SYNC_SUFFIX}-${batch}.json`:`${sanitizeUserFarmName(syncFarmName)}${SYNC_SUFFIX}.json`;
  const isError=syncState==='error';
  const statusRows=`<div class="settings-status-row"><span class="lbl">Batch</span><span class="val">${escapeHtml(batch||'—')}</span></div>
    <div class="settings-status-row"><span class="lbl">Backed up as</span><span class="val mono">${escapeHtml(fileName)}</span></div>
    <div class="settings-status-row"><span class="lbl">Last sync</span><span class="val">${syncLastSyncAt?fmtRelativeTime(syncLastSyncAt):'never'}</span></div>
    ${syncExcelMeta?`<div class="settings-status-row"><span class="lbl">Stored Excel</span><span class="val mono">${escapeHtml(syncExcelMeta.name||'sheds.xlsx')}${syncExcelMeta.uploadedAt?' · '+fmtRelativeTime(new Date(syncExcelMeta.uploadedAt).getTime()):''}</span></div>`:''}
    ${isError?`<div class="settings-status-row"><span class="lbl">Status</span><span class="val err">Last attempt failed</span></div>`:''}`;
  return `<div class="settings-section">
    <div class="settings-section-head">
      <span class="settings-icon">${settingsIcon('cloud')}</span>
      <div class="settings-section-title-wrap">
        <h4 class="settings-section-title">Cloud sync</h4>
        <span class="settings-status-pill"><span class="settings-status-dot${isError?' error':''}"></span>${escapeHtml(syncFarmName)}</span>
      </div>
    </div>
    <div class="settings-status-block">${statusRows}</div>
    <div class="settings-btn-row">
      <button class="settings-btn" id="settingsSyncNowBtn" type="button">${settingsIcon('sync')}Sync now</button>
      <button class="settings-btn" id="settingsChangeFarmBtn" type="button">${settingsIcon('swap')}Change farm</button>
      ${syncExcelMeta?`<button class="settings-btn" id="settingsDlExcelBtn" type="button">${settingsIcon('import')}Download Excel</button>`:''}
      <button class="settings-btn" id="settingsDlBatchBtn" type="button">${settingsIcon('import')}Download JSON</button>
    </div>
    <div class="settings-actions"><button class="settings-btn settings-btn-danger" id="settingsDisconnectBtn" type="button">${settingsIcon('unplug')}Disconnect</button></div>
  </div>`;
}
function renderSettingsBatchHistoryCard(){
  const connected=!!syncFarmName;
  return `<div class="settings-section">
    <div class="settings-section-head"><span class="settings-icon">${settingsIcon('archive')}</span><div class="settings-section-title-wrap"><h4 class="settings-section-title">Batch history</h4></div></div>
    <p class="settings-section-desc">Browse past batches stored in the cloud${connected?` for <strong>${escapeHtml(syncFarmName)}</strong>`:''}. Opening a past batch saves your current work first, then loads the chosen batch.</p>
    ${!connected?`<p class="settings-section-note">Connect to a farm first.</p>`:''}
    <div class="settings-actions"><button class="settings-btn" id="settingsBatchHistoryBtn" type="button" ${connected?'':'disabled'}>${settingsIcon('archive')}View past batches</button></div>
  </div>`;
}
function openSyncModal(){
  closeSettingsDrawer();
  const modal=document.getElementById('syncModal');const scrim=document.getElementById('syncScrim');const body=document.getElementById('syncModalBody');
  if(syncFarmName){
    const batch=currentBatchKey();
    const fileName=batch?`${sanitizeUserFarmName(syncFarmName)}${SYNC_SUFFIX}-${batch}.json`:`${sanitizeUserFarmName(syncFarmName)}${SYNC_SUFFIX}.json`;
    body.innerHTML=`<div class="sync-status-card"><div class="sync-status-row"><span class="lbl">Farm</span><span class="val ok">${escapeHtml(syncFarmName)}</span></div>${batch?`<div class="sync-status-row"><span class="lbl">Batch</span><span class="val ok">${escapeHtml(batch)}</span></div>`:''}<div class="sync-status-row"><span class="lbl">Backed up as</span><span class="val">${escapeHtml(fileName)}</span></div><div class="sync-status-row"><span class="lbl">Last sync</span><span class="val">${syncLastSyncAt?fmtRelativeTime(syncLastSyncAt):'never'}</span></div>${syncExcelMeta?`<div class="sync-status-row"><span class="lbl">Stored Excel</span><span class="val">📄 ${escapeHtml(syncExcelMeta.name||'sheds.xlsx')}</span></div>`:''}</div><div class="sync-actions"><div class="sync-btn-row"><button class="btn-sync-primary" id="syncNowBtn">🔄 Sync now</button><button class="btn-sync-primary ghost" id="syncChangeBtn">Change farm</button></div>${syncExcelMeta?`<button class="btn-sync-primary ghost" id="syncDownloadExcelBtn">📄 Download stored Excel</button>`:''}<button class="btn-sync-primary ghost" id="syncDownloadBatchBtn">📥 Download current batch (JSON)</button><button class="btn-sync-primary danger" id="syncDisconnectBtn">Disconnect</button></div><div class="sync-hint">Data is stored in <strong>${escapeHtml(SYNC_REPO)}</strong> on GitHub. Each batch has its own file — enter the same farm + batch to sync the same data on another device.</div>`;
    document.getElementById('syncNowBtn').addEventListener('click',async()=>{await pullFromCloud(false);});
    document.getElementById('syncChangeBtn').addEventListener('click',()=>{showConnectForm('Enter a new farm name to switch to. Your current data stays where it is.');});
    document.getElementById('syncDisconnectBtn').addEventListener('click',disconnectSync);
    const dl=document.getElementById('syncDownloadExcelBtn');if(dl)dl.addEventListener('click',async()=>{await downloadExcelFromCloud();});
    const dlb=document.getElementById('syncDownloadBatchBtn');if(dlb)dlb.addEventListener('click',()=>{downloadCurrentBatchAsJson();});
  }else{showConnectForm();}
  modal.classList.add('open');scrim.classList.add('open');
}
function showConnectForm(hint){
  const body=document.getElementById('syncModalBody');
  body.innerHTML=`<label for="syncFarmInput">Farm name</label><input id="syncFarmInput" type="text" placeholder="e.g. kiripark1" autocomplete="off" spellcheck="false" maxlength="40" /><div class="sync-hint">${hint?escapeHtml(hint):'Use the same name on every device to sync the same data.'}${hint?'<br><br>':''}Backed up to <strong>${escapeHtml(SYNC_REPO)}</strong> on GitHub. File will be saved as <strong>&lt;farm&gt;${SYNC_SUFFIX}.json</strong>.</div><button class="btn-sync-primary" id="syncConnectBtn">Connect</button><button class="btn-sync-primary ghost" id="syncCancelBtn">Cancel</button>`;
  const input=document.getElementById('syncFarmInput');setTimeout(()=>input&&input.focus(),100);
  const submit=()=>{const v=input.value.trim();if(!v){showToast('Enter a farm name.',true);return;}handleConnectFarm(v);};
  document.getElementById('syncConnectBtn').addEventListener('click',submit);
  input.addEventListener('keydown',e=>{if(e.key==='Enter')submit();});
  document.getElementById('syncCancelBtn').addEventListener('click',()=>{if(!syncFarmName)closeSyncModal();else openSyncModal();});
}
function closeSyncModal(){document.getElementById('syncModal').classList.remove('open');updateScrimVisibility();}
function closeFarmFoundModal(){const m=document.getElementById('farmFoundModal');if(m)m.classList.remove('open');updateScrimVisibility();}
function updateScrimVisibility(){const scrim=document.getElementById('syncScrim');if(!scrim)return;const anyOpen=document.querySelector('.sync-modal.open');scrim.classList.toggle('open',!!anyOpen);}
function disconnectSync(){
  if(!syncFarmName)return;
  if(!confirm('Disconnect cloud sync?\n\nYour data stays on this device and in the cloud. You can reconnect with the same farm name any time.'))return;
  syncFarmName=null;syncSha=null;syncExcelSha=null;syncExcelMeta=null;syncConnectedAt=null;syncLastSyncAt=null;
  saveSyncState();closeSyncModal();renderSettingsDrawerBody();render();
  showToast('Disconnected.');
}
async function handleConnectFarm(farmName){
  const clean=sanitizeUserFarmName(farmName);if(!clean){showToast('Enter a farm name.',true);return;}
  const btn=document.getElementById('settingsConnectBtn');const oldBtnHTML=btn?btn.innerHTML:null;
  if(btn){btn.disabled=true;btn.innerHTML='⏳ Connecting…';}
  try{
    const isSwitch=!!syncFarmName&&syncFarmName!==clean;
    if(isSwitch&&syncConnectedAt&&pushPending){try{await runScheduledPush();}catch(e){}}
    const listing=await listFarmBatches(clean);
    if(!listing.ok){showToast(listing.reason==='timeout'?'⏱️ Cloud did not respond — check your connection and try again.':'Could not reach the cloud — check your connection.',true);return;}
    if(listing.files.length===0){
      if(!confirm(`Farm "${clean}" not found in the cloud.\n\nCreate a new farm?`))return;
      syncFarmName=clean;syncSha=null;syncExcelSha=null;syncExcelMeta=null;syncConnectedAt=Date.now();syncLastSyncAt=null;
      predState.batchNumber='';savePredState();farmData=null;saveState();saveSyncState();
      closeSyncModal();closeSettingsDrawer();openNewBatchModal('batchNumber');
      return;
    }
    if(listing.files.length===1){await loadFarmBatchFromCloud(clean,listing.files[0].batchKey);return;}
    syncFarmName=clean;closeSettingsDrawer();openFarmBatchPickerModal(clean,listing.files);
  }finally{if(btn&&oldBtnHTML!==null){btn.disabled=false;btn.innerHTML=oldBtnHTML;}}
}
async function loadFarmBatchFromCloud(farmName,batchKey){
  resetAllToDefaults(batchKey);
  syncFarmName=farmName;syncSha=null;syncExcelSha=null;syncExcelMeta=null;syncConnectedAt=Date.now();syncLastSyncAt=null;
  closeFarmBatchPickerModal();closeSyncModal();closeSettingsDrawer();
  syncState='pulling';renderSettingsDrawerBody();
  let payload=null,sha=null;
  try{const res=await fetch(buildBatchUrl(farmName,batchKey));if(res.ok){const result=await res.json();if(!result.notFound&&result.data){payload=result.data;sha=result.sha||null;}}}catch(e){}
  if(payload){applyCloudPayload(payload,{isFirstPull:true});syncSha=sha;syncLastSyncAt=Date.now();showToast(`✅ Loaded ${batchKey?'batch '+batchKey:'legacy batch'}.`);}
  else showToast('No data found — starting with default sheds.');
  saveSyncState();syncState='idle';renderSettingsDrawerBody();render();
}
function openFarmBatchPickerModal(farmName,files){
  const modal=document.getElementById('farmBatchPickerModal');const scrim=document.getElementById('syncScrim');
  renderFarmBatchPickerBody(farmName,files);modal.classList.add('open');scrim.classList.add('open');
}
function closeFarmBatchPickerModal(){document.getElementById('farmBatchPickerModal').classList.remove('open');updateScrimVisibility();}
function renderFarmBatchPickerBody(farmName,files){
  const body=document.getElementById('farmBatchPickerBody');if(!body)return;
  const rows=files.map(p=>{
    const sizeStr=fmtBytes(p.size);const metaBits=[];if(sizeStr)metaBits.push(sizeStr);if(p.isLegacy)metaBits.push('original file');
    const meta=metaBits.join(' · ');
    return `<div class="batch-row" data-pick-batch="${escapeAttr(p.batchKey)}"><div class="batch-row-info"><div class="batch-row-title"><span>${escapeHtml(p.label)}</span></div>${meta?`<div class="batch-row-meta">${escapeHtml(meta)}</div>`:''}</div><div class="batch-row-actions"><button class="batch-open-btn" type="button" data-pick-batch-open="${escapeAttr(p.batchKey)}">Load</button></div></div>`;
  }).join('');
  body.innerHTML=`<div class="sync-status-card"><div class="sync-status-row"><span class="lbl">Farm</span><span class="val ok">${escapeHtml(farmName)}</span></div><div class="sync-status-row"><span class="lbl">Batches found</span><span class="val">${files.length}</span></div></div><div class="nb-question">Choose a batch to load:</div><div class="batch-list">${rows}</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;"><button class="btn-sync-primary success" id="fbpCreateNewBtn" type="button">➕ Create new batch</button><button class="btn-sync-primary ghost" id="fbpCancelBtn" type="button">Cancel</button></div>`;
  body.querySelectorAll('[data-pick-batch-open]').forEach(btn=>{btn.addEventListener('click',()=>{loadFarmBatchFromCloud(farmName,btn.dataset.pickBatchOpen||'');});});
  const createBtn=document.getElementById('fbpCreateNewBtn');if(createBtn)createBtn.addEventListener('click',()=>{closeFarmBatchPickerModal();openNewBatchModal('batchNumber');});
  const cancelBtn=document.getElementById('fbpCancelBtn');if(cancelBtn)cancelBtn.addEventListener('click',()=>{closeFarmBatchPickerModal();if(!syncConnectedAt){syncFarmName=null;saveSyncState();renderSettingsDrawerBody();}});
}
function openNewBatchModal(initialPhase){
  closeSettingsDrawer();newBatchModalPhase=initialPhase||'choice';
  const modal=document.getElementById('newBatchModal');const scrim=document.getElementById('syncScrim');
  renderNewBatchModalBody();modal.classList.add('open');scrim.classList.add('open');
}
function closeNewBatchModal(){document.getElementById('newBatchModal').classList.remove('open');updateScrimVisibility();}
function renderNewBatchModalBody(){
  const body=document.getElementById('newBatchModalBody');if(!body)return;
  const isConnected=!!(syncFarmName&&syncConnectedAt);
  if(newBatchModalPhase==='batchNumber'&&syncFarmName){renderNewBatchNumberPhase(body);return;}
  if(!isConnected){
    body.innerHTML=`<div class="farm-found-icon">🔌</div><div class="farm-found-title">Not connected</div><div class="farm-found-sub">Connect to a farm first, then come back here to start a new batch.</div><div class="sync-actions"><button class="btn-sync-primary" id="nbGoConnectBtn" type="button">☁️ Go to Cloud Sync</button><button class="btn-sync-primary ghost" id="nbCancelBtn" type="button">Cancel</button></div>`;
    document.getElementById('nbGoConnectBtn').addEventListener('click',()=>{closeNewBatchModal();setTimeout(()=>{openSettingsDrawer();openSyncModal();},150);});
    document.getElementById('nbCancelBtn').addEventListener('click',closeNewBatchModal);
    return;
  }
  if(newBatchModalPhase==='choice')renderNewBatchFarmChoicePhase(body);
  else if(newBatchModalPhase==='batchNumber')renderNewBatchNumberPhase(body);
  else if(newBatchModalPhase==='proceed')renderNewBatchProceedPhase(body);
  else renderNewBatchNumberPhase(body);
}
function renderNewBatchFarmChoicePhase(body){
  const farmName=syncFarmName||'';
  const currentBatch=(predState.batchNumber||(farmData&&farmData.batchNumber)||'').trim();
  body.innerHTML=`<div class="sync-status-card"><div class="sync-status-row"><span class="lbl">Currently connected to</span><span class="val ok">${escapeHtml(farmName)}</span></div>${currentBatch?`<div class="sync-status-row"><span class="lbl">Current batch</span><span class="val">${escapeHtml(currentBatch)}</span></div>`:''}</div><div class="nb-question">Where should this new batch live?</div><div class="ff-choices"><button class="ff-choice primary" id="nbSameFarmBtn" type="button"><span class="ff-icon">🏠</span><div><div class="ff-choice-title">Continue on ${escapeHtml(farmName)}</div><div class="ff-choice-sub">Start a new batch cycle on the same farm — keeps the cloud connection</div></div></button><button class="ff-choice secondary" id="nbNewFarmBtn" type="button"><span class="ff-icon">🌾</span><div><div class="ff-choice-title">Switch to a different farm</div><div class="ff-choice-sub">Disconnect from ${escapeHtml(farmName)} and connect to another farm</div></div></button></div><button class="ff-cancel" id="nbCancelBtn" type="button">Cancel</button>`;
  document.getElementById('nbSameFarmBtn').addEventListener('click',()=>{newBatchModalPhase='batchNumber';renderNewBatchModalBody();});
  document.getElementById('nbNewFarmBtn').addEventListener('click',()=>{
    const batchLabel=currentBatch?` (batch ${currentBatch})`:'';
    if(!confirm(`Switch to a different farm?\n\nYour current data on "${farmName}"${batchLabel} stays safe in the cloud.\n\nYou'll be asked to enter a new farm name next.`))return;
    flushPendingPush();
    syncFarmName=null;syncSha=null;syncExcelSha=null;syncExcelMeta=null;syncConnectedAt=null;syncLastSyncAt=null;
    saveSyncState();closeNewBatchModal();renderSettingsDrawerBody();render();
    setTimeout(()=>{openSettingsDrawer();openSyncModal();},200);
  });
  document.getElementById('nbCancelBtn').addEventListener('click',closeNewBatchModal);
}
function renderNewBatchNumberPhase(body){
  const farmName=syncFarmName||'';
  const currentBatch=(predState.batchNumber||(farmData&&farmData.batchNumber)||'').trim()||'Unnamed';
  const shedCount=farmData?farmData.sheds.filter(s=>s.initialPopulation>0).length:0;
  const totalPlaced=farmData?farmData.sheds.reduce((s,x)=>s+(x.initialPopulation||0),0):0;
  body.innerHTML=`<div class="sync-status-card"><div class="sync-status-row"><span class="lbl">Farm</span><span class="val ok">${escapeHtml(farmName||'(new)')}</span></div><div class="sync-status-row"><span class="lbl">Current batch</span><span class="val">${escapeHtml(currentBatch)}</span></div><div class="sync-status-row"><span class="lbl">Sheds placed</span><span class="val">${shedCount} of 8 · ${totalPlaced.toLocaleString()} birds</span></div></div><label for="newBatchNumberInput">New batch number</label><input id="newBatchNumberInput" type="text" placeholder="e.g. B12 or 2025-03" maxlength="32" autocomplete="off" spellcheck="false" /><div class="sync-hint">Your current batch's data <strong>stays safe</strong> in the cloud under its own file. A fresh cloud file will be created for the new batch and the app will reconnect automatically. All shed fields will reset to default (52,000 birds placed per shed, empty dates).</div><label class="new-batch-checkbox-label"><input type="checkbox" id="downloadBackupCheckbox" checked /><span>Download current batch as a JSON backup before starting</span></label><div class="sync-actions"><button class="btn-sync-primary danger" id="newBatchNextBtn" type="button">Next →</button><button class="btn-sync-primary ghost" id="backToFarmChoiceBtn" type="button">← Back</button></div>`;
  const inp=document.getElementById('newBatchNumberInput');setTimeout(()=>{if(inp)inp.focus();},100);
  document.getElementById('newBatchNextBtn').addEventListener('click',()=>{
    const raw=inp?inp.value.trim():'';
    const clean=sanitizeBatchNumber(raw);
    if(!clean){showToast('Enter a batch number (letters, numbers, dashes).',true);if(inp)inp.focus();return;}
    const currentClean=sanitizeBatchNumber(predState.batchNumber||(farmData&&farmData.batchNumber)||'');
    if(clean===currentClean){showToast('That is already the current batch number.',true);if(inp)inp.focus();return;}
    pendingNewBatchClean=clean;pendingNewBatchDownload=!!(document.getElementById('downloadBackupCheckbox')||{}).checked;
    newBatchModalPhase='proceed';renderNewBatchModalBody();
  });
  const backBtn=document.getElementById('backToFarmChoiceBtn');
  if(backBtn)backBtn.addEventListener('click',()=>{if(syncConnectedAt){newBatchModalPhase='choice';renderNewBatchModalBody();}else closeNewBatchModal();});
  if(inp){inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();document.getElementById('newBatchNextBtn').click();}if(e.key==='Escape'){e.preventDefault();closeNewBatchModal();}});}
}
function renderNewBatchProceedPhase(body){
  const clean=pendingNewBatchClean||'';
  const downloadBackup=pendingNewBatchDownload;
  body.innerHTML=`<div class="farm-found-icon">✅</div><div class="farm-found-title">Batch <strong>${escapeHtml(clean)}</strong> ready</div><div class="farm-found-sub">All shed fields will be reset to defaults: <strong>52,000 birds placed</strong> per shed, 0 mortality, 0.044 kg chick weight, empty placement &amp; cleanout dates.</div><div class="nb-question">How would you like to proceed?</div><div class="ff-choices"><button class="ff-choice primary" id="nbProceedUploadBtn" type="button"><span class="ff-icon">📥</span><div><div class="ff-choice-title">Upload Excel now</div><div class="ff-choice-sub">Replace the defaults with real shed data from your Excel file</div></div></button><button class="ff-choice secondary" id="nbProceedDefaultsBtn" type="button"><span class="ff-icon">▶️</span><div><div class="ff-choice-title">Continue with defaults</div><div class="ff-choice-sub">Start the batch with 8 default sheds — you can plan by hand and import later</div></div></button></div><button class="ff-cancel" id="nbProceedCancelBtn" type="button">← Back</button>`;
  document.getElementById('nbProceedUploadBtn').addEventListener('click',async()=>{await startNewBatch(clean,{downloadBackup,openFilePicker:true});});
  document.getElementById('nbProceedDefaultsBtn').addEventListener('click',async()=>{await startNewBatch(clean,{downloadBackup,openFilePicker:false});});
  document.getElementById('nbProceedCancelBtn').addEventListener('click',()=>{newBatchModalPhase='batchNumber';renderNewBatchModalBody();});
}
function downloadCurrentBatchAsJson(){
  const batchRaw=(predState.batchNumber||(farmData&&farmData.batchNumber)||'').trim();
  const batchLabel=sanitizeBatchNumber(batchRaw)||'current';
  const farmLabel=sanitizeUserFarmName(syncFarmName||'farm');
  const payload=buildCloudPayload();
  payload.exportedAt=new Date().toISOString();payload.exportedBy='ProdWise.VM';
  const json=JSON.stringify(payload,null,2);
  const blob=new Blob([json],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=`${farmLabel}-feed-${batchLabel}-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  showToast('📥 Batch backup downloaded.');
}
async function startNewBatch(cleanBatchNumber,opts){
  opts=opts||{};
  const clean=sanitizeBatchNumber(cleanBatchNumber);
  if(!clean){showToast('Enter a batch number.',true);return;}
  if(opts.downloadBackup!==false){try{downloadCurrentBatchAsJson();}catch(e){console.error(e);}}
  clearTimeout(pushDebounceTimer);pushDebounceTimer=null;clearTimeout(pushMaxWaitTimer);pushMaxWaitTimer=null;pushPending=false;
  const farmToKeep=syncFarmName;
  // Auto-snapshot current state before wiping — this is the safety net
  // against a glitched batch creation overwriting good data.
  try { await historyAutoSnapshot('auto-newbatch', `Before batch "${clean}"`); } catch(e) { console.warn('Snapshot before new batch failed', e); }
  syncSha=null;syncExcelSha=null;syncExcelMeta=null;syncConnectedAt=null;syncLastSyncAt=null;
  saveSyncState();resetAllToDefaults(clean);
  if(farmToKeep){
    syncFarmName=farmToKeep;syncConnectedAt=Date.now();syncLastSyncAt=null;saveSyncState();
    closeNewBatchModal();renderSettingsDrawerBody();render();
    await pushToCloud();
  }else{closeNewBatchModal();renderSettingsDrawerBody();render();}
  if(opts.openFilePicker){showToast(`✅ Batch "${clean}" started — pick the Excel file now.`);setTimeout(()=>triggerImport(),220);}
  else showToast(`✅ Batch "${clean}" started with default sheds.`);
}
function openBatchHistoryModal(){
  closeSettingsDrawer();batchHistoryPage=0;batchHistoryCache=null;
  const modal=document.getElementById('batchHistoryModal');const scrim=document.getElementById('syncScrim');
  modal.classList.add('open');scrim.classList.add('open');renderBatchHistoryModalBody();
}
function closeBatchHistoryModal(){document.getElementById('batchHistoryModal').classList.remove('open');batchHistoryPage=0;batchHistoryCache=null;updateScrimVisibility();}
async function renderBatchHistoryModalBody(){
  const body=document.getElementById('batchHistoryModalBody');if(!body)return;
  if(!syncFarmName){
    body.innerHTML=`<div class="farm-found-icon">🔌</div><div class="farm-found-title">Not connected</div><div class="farm-found-sub">Connect to a farm first to browse its past batches.</div><div class="sync-actions"><button class="btn-sync-primary" id="bhGoConnectBtn" type="button">☁️ Go to Cloud Sync</button><button class="btn-sync-primary ghost" id="bhCancelBtn" type="button">Cancel</button></div>`;
    document.getElementById('bhGoConnectBtn').addEventListener('click',()=>{closeBatchHistoryModal();setTimeout(()=>{openSettingsDrawer();openSyncModal();},150);});
    document.getElementById('bhCancelBtn').addEventListener('click',closeBatchHistoryModal);
    return;
  }
  const farmName=syncFarmName;const currentKey=currentBatchKey();
  body.innerHTML=`<div class="sync-status-card"><div class="sync-status-row"><span class="lbl">Farm</span><span class="val ok">${escapeHtml(farmName)}</span></div><div class="sync-status-row"><span class="lbl">Currently open</span><span class="val">${escapeHtml(currentKey||'Legacy (no batch)')}</span></div></div><div class="batch-list-status" id="batchListStatus">Loading batches…</div><div class="batch-list" id="batchListContainer"></div><div id="batchPaginationContainer"></div><div class="sync-hint">Opening a past batch switches the app to that batch's data. The current batch stays safe in the cloud. Files ending in <strong>-file.json</strong> (stored Excel) are hidden here.</div>`;
  try{
    const res=await fetch(buildListingUrl(farmName));
    if(!res.ok){showBatchListError('Could not list batches (server returned '+res.status+').');return;}
    const result=await res.json();
    const rawFiles=(result&&Array.isArray(result.files))?result.files:[];
    const parsed=[];
    for(const f of rawFiles){const info=parseBatchFileInfo(farmName,f.name);if(!info)continue;parsed.push({...info,size:f.size,sha:f.sha,fileName:f.name});}
    if(parsed.length===0){document.getElementById('batchListStatus').innerHTML='No batches found for this farm yet.';return;}
    parsed.sort((a,b)=>{if(a.isLegacy&&!b.isLegacy)return 1;if(b.isLegacy&&!a.isLegacy)return -1;return compareBatchKeys(a.batchKey,b.batchKey);});
    batchHistoryCache={farmName,files:parsed};batchHistoryPage=0;renderBatchListPage();
  }catch(e){console.error(e);showBatchListError('Could not reach the server. Check your connection.');}
}
function renderBatchListPage(){
  if(!batchHistoryCache)return;
  const {files}=batchHistoryCache;
  const totalCount=files.length;
  const totalPages=Math.max(1,Math.ceil(totalCount/BATCHES_PER_PAGE));
  if(batchHistoryPage>=totalPages)batchHistoryPage=totalPages-1;
  if(batchHistoryPage<0)batchHistoryPage=0;
  const start=batchHistoryPage*BATCHES_PER_PAGE;
  const end=Math.min(start+BATCHES_PER_PAGE,totalCount);
  const pageItems=files.slice(start,end);
  const currentKey=currentBatchKey();
  const rows=pageItems.map(p=>{
    const isCurrent=(p.batchKey===currentKey)||(p.isLegacy&&!currentKey);
    const sizeStr=fmtBytes(p.size);
    const metaBits=[];if(sizeStr)metaBits.push(sizeStr);if(p.isLegacy)metaBits.push('original file');
    const meta=metaBits.join(' · ');
    return `<div class="batch-row ${isCurrent?'current':''}" data-batch-key="${escapeAttr(p.batchKey)}"><div class="batch-row-info"><div class="batch-row-title"><span>${escapeHtml(p.label)}</span>${isCurrent?'<span class="batch-current-badge">Current</span>':''}</div>${meta?`<div class="batch-row-meta">${escapeHtml(meta)}</div>`:''}</div><div class="batch-row-actions">${!isCurrent?`<button class="batch-open-btn" data-batch-open="${escapeAttr(p.batchKey)}" type="button">Open</button>`:''}</div></div>`;
  }).join('');
  const statusEl=document.getElementById('batchListStatus');
  const listEl=document.getElementById('batchListContainer');
  const pagEl=document.getElementById('batchPaginationContainer');
  if(statusEl){statusEl.innerHTML=`${totalCount} batch${totalCount===1?'':'es'} found`;statusEl.classList.remove('error');}
  if(listEl)listEl.innerHTML=rows;
  if(pagEl){
    if(totalPages>1){pagEl.innerHTML=`<div class="batch-pagination" style="display:flex;gap:8px;justify-content:center;align-items:center;margin-top:12px;"><button class="batch-open-btn" data-batch-page="prev" type="button" ${batchHistoryPage===0?'disabled':''} style="background:var(--surface-soft);color:var(--ink);border:1px solid var(--line);">← Prev</button><span style="font-size:12px;color:var(--muted);">Page ${batchHistoryPage+1} of ${totalPages}</span><button class="batch-open-btn" data-batch-page="next" type="button" ${batchHistoryPage===totalPages-1?'disabled':''} style="background:var(--surface-soft);color:var(--ink);border:1px solid var(--line);">Next →</button></div>`;}
    else pagEl.innerHTML='';
  }
  const body=document.getElementById('batchHistoryModalBody');if(!body)return;
  body.querySelectorAll('[data-batch-open]').forEach(btn=>{btn.addEventListener('click',()=>{openPastBatch(btn.dataset.batchOpen);});});
  body.querySelectorAll('[data-batch-page]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const dir=btn.dataset.batchPage;
      const totalPages2=Math.max(1,Math.ceil(batchHistoryCache.files.length/BATCHES_PER_PAGE));
      if(dir==='prev'&&batchHistoryPage>0)batchHistoryPage--;
      else if(dir==='next'&&batchHistoryPage<totalPages2-1)batchHistoryPage++;
      renderBatchListPage();
    });
  });
}
function showBatchListError(msg){const el=document.getElementById('batchListStatus');if(el){el.textContent=msg;el.classList.add('error');}}
async function openPastBatch(targetBatchKey){
  if(!syncFarmName)return;
  const targetLabel=targetBatchKey?`Batch ${targetBatchKey}`:'the Legacy batch';
  const currentLabel=currentBatchKey()||'the Legacy batch';
  if(!confirm(`Switch to ${targetLabel}?\n\nYour current work on ${currentLabel} will be saved to the cloud first, then the app will load ${targetLabel}.`))return;
  if(syncFarmName&&syncConnectedAt&&syncSha){
    clearTimeout(pushDebounceTimer);pushDebounceTimer=null;clearTimeout(pushMaxWaitTimer);pushMaxWaitTimer=null;pushPending=false;
    const ok=await pushToCloud();
    if(!ok){showToast('Could not save current batch — check your connection.',true);return;}
  }
  closeBatchHistoryModal();await loadFarmBatchFromCloud(syncFarmName,targetBatchKey);
}

/* ---------- Manual pickup modal ---------- */
function openManualPickupModal(shedId,editDateIso){
  if(!farmData)return;
  const shed=farmData.sheds[shedId-1];if(!shed)return;
  const pickups=shed.pickups||[];
  if(editDateIso){
    const p=pickups.find(x=>iso(x.date)===editDateIso);if(!p)return;
    const avg=(p.totalWeightKg&&p.birds)?(p.totalWeightKg/p.birds):null;
    manualPickupState={shedId,mode:'edit',originalDateIso:editDateIso,dateIso:iso(p.date),ageValue:pickupAge(shed,p),ageTouched:(p.ageOverride!=null),birds:p.birds||'',avgWeight:avg!=null?Number(avg.toFixed(3)):'',totalWeight:p.totalWeightKg!=null?Number(p.totalWeightKg.toFixed(2)):'',lastEdited:'avg',isFinal:!!p.isFinal};
  }else{
    if(pickups.length>=MAX_PICKUPS_PER_SHED){showToast(`This shed already has ${MAX_PICKUPS_PER_SHED} pickups (maximum).`,true);return;}
    const today=todayIso();
    const computedAge=shed.placementDate?Math.max(0,daysBetween(shed.placementDate,dateOnly(today))):0;
    manualPickupState={shedId,mode:'add',originalDateIso:null,dateIso:today,ageValue:computedAge,ageTouched:false,birds:'',avgWeight:'',totalWeight:'',lastEdited:'avg',isFinal:false};
  }
  renderManualPickupModal();
  const modal=document.getElementById('manualPickupModal');const scrim=document.getElementById('syncScrim');
  modal.classList.add('open');scrim.classList.add('open');
}
function closeManualPickupModal(){document.getElementById('manualPickupModal').classList.remove('open');manualPickupState=null;updateScrimVisibility();}
function renderManualPickupModal(){
  const body=document.getElementById('manualPickupModalBody');const titleEl=document.getElementById('manualPickupModalTitle');
  const s=manualPickupState;if(!s||!body)return;
  const shed=farmData.sheds[s.shedId-1];
  if(titleEl)titleEl.innerHTML=s.mode==='add'?`<span>📝</span> Add Pickup — Shed ${s.shedId}`:`<span>✎</span> Edit Pickup — Shed ${s.shedId}`;
  const pickupCount=(shed.pickups||[]).length;
  const canSave=s.mode==='edit'||pickupCount<MAX_PICKUPS_PER_SHED;
  body.innerHTML=`<div class="sync-status-card"><div class="sync-status-row"><span class="lbl">Shed</span><span class="val">Shed ${s.shedId}</span></div><div class="sync-status-row"><span class="lbl">Placement</span><span class="val">${shed.placementDate?fmtShort(shed.placementDate):'—'}</span></div><div class="sync-status-row"><span class="lbl">Pickups</span><span class="val">${pickupCount} of ${MAX_PICKUPS_PER_SHED}</span></div></div><div class="mp-field"><label>Date</label><input type="date" id="mpDate" value="${s.dateIso}" /></div><div class="mp-field"><label>Age (days) <span class="auto-chip" id="mpAgeChip" style="${s.ageTouched?'display:none;':''}">auto</span></label><input type="number" id="mpAge" min="0" step="1" value="${s.ageValue}" /></div><div class="mp-field"><label>No. of Birds</label><input type="number" id="mpBirds" min="1" step="1" value="${s.birds}" placeholder="e.g. 5000" /></div><div class="mp-field"><label>Average Weight (kg/bird) <span class="auto-chip" id="mpAvgChip" style="display:none;">auto</span></label><input type="number" id="mpAvg" step="0.001" min="0" value="${s.avgWeight}" placeholder="kg per bird" /></div><div class="mp-field"><label>Total Weight (kg) <span class="auto-chip" id="mpTotalChip" style="display:none;">auto</span></label><input type="number" id="mpTotal" step="1" min="0" value="${s.totalWeight}" placeholder="kg total" /></div><label class="mp-checkbox-row"><input type="checkbox" id="mpFinal" ${s.isFinal?'checked':''} /><span>This is the final pickup (sets cleanout date &amp; mortality)</span></label><div class="mp-hint">Enter <strong>Birds + Average</strong> to auto-calc Total, or <strong>Birds + Total</strong> to auto-calc Average.</div><div class="sync-actions"><button class="btn-sync-primary" id="mpSaveBtn" ${canSave?'':'disabled'}>${s.mode==='add'?'＋ Add Pickup':'✓ Save Changes'}</button><button class="btn-sync-primary ghost" id="mpCancelBtn">Cancel</button></div>`;
  const dateEl=document.getElementById('mpDate');const ageEl=document.getElementById('mpAge');const birdsEl=document.getElementById('mpBirds');const avgEl=document.getElementById('mpAvg');const totalEl=document.getElementById('mpTotal');const ageChipEl=document.getElementById('mpAgeChip');
  const onDateChange=()=>{s.dateIso=dateEl.value;if(s.ageTouched)return;const d=parseExcelDate(dateEl.value);if(!d)return;const a=shed.placementDate?Math.max(0,daysBetween(shed.placementDate,d)):0;ageEl.value=a;s.ageValue=a;if(ageChipEl)ageChipEl.style.display='';};
  const onAgeChange=()=>{s.ageTouched=true;if(ageChipEl)ageChipEl.style.display='none';const a=Number(ageEl.value);if(Number.isFinite(a)&&a>=0)s.ageValue=Math.floor(a);};
  dateEl.addEventListener('input',onDateChange);dateEl.addEventListener('change',onDateChange);
  ageEl.addEventListener('input',onAgeChange);
  birdsEl.addEventListener('input',()=>refreshManualPickupCalc());
  avgEl.addEventListener('input',()=>{s.lastEdited='avg';refreshManualPickupCalc();});
  totalEl.addEventListener('input',()=>{s.lastEdited='total';refreshManualPickupCalc();});
  refreshManualPickupCalc();
  document.getElementById('mpSaveBtn').addEventListener('click',saveManualPickup);
  document.getElementById('mpCancelBtn').addEventListener('click',closeManualPickupModal);
  setTimeout(()=>{birdsEl&&birdsEl.focus();},80);
}
function refreshManualPickupCalc(){
  const s=manualPickupState;if(!s)return;
  const avgEl=document.getElementById('mpAvg');const totalEl=document.getElementById('mpTotal');const birdsEl=document.getElementById('mpBirds');
  const avgChip=document.getElementById('mpAvgChip');const totalChip=document.getElementById('mpTotalChip');
  if(!avgEl||!totalEl||!birdsEl)return;
  const birds=Number(birdsEl.value);const avgVal=avgEl.value===''?null:Number(avgEl.value);const totalVal=totalEl.value===''?null:Number(totalEl.value);
  const birdsOK=Number.isFinite(birds)&&birds>0;
  const avgOK=avgVal!=null&&Number.isFinite(avgVal)&&avgVal>0;
  const totalOK=totalVal!=null&&Number.isFinite(totalVal)&&totalVal>0;
  avgEl.classList.remove('auto-calc');totalEl.classList.remove('auto-calc');
  if(avgChip)avgChip.style.display='none';if(totalChip)totalChip.style.display='none';
  if(s.lastEdited==='avg'&&birdsOK&&avgOK){const computed=birds*avgVal;totalEl.value=computed.toFixed(2);totalEl.classList.add('auto-calc');if(totalChip)totalChip.style.display='';s.totalWeight=computed;s.avgWeight=avgVal;}
  else if(s.lastEdited==='total'&&birdsOK&&totalOK){const computed=totalVal/birds;avgEl.value=computed.toFixed(3);avgEl.classList.add('auto-calc');if(avgChip)avgChip.style.display='';s.avgWeight=computed;s.totalWeight=totalVal;}
}
function saveManualPickup(){
  const s=manualPickupState;if(!s)return;
  const shed=farmData.sheds[s.shedId-1];if(!shed)return;
  const dateStr=document.getElementById('mpDate').value;
  const ageVal=Number(document.getElementById('mpAge').value);
  const birdsVal=Number(document.getElementById('mpBirds').value);
  const avgVal=Number(document.getElementById('mpAvg').value);
  const totalVal=Number(document.getElementById('mpTotal').value);
  const isFinal=document.getElementById('mpFinal').checked;
  const dateObj=parseExcelDate(dateStr);
  if(!dateObj){showToast('Pick a valid date.',true);return;}
  if(!Number.isFinite(birdsVal)||birdsVal<=0){showToast('Enter a valid number of birds.',true);return;}
  let avg=null,total=null;
  if(s.lastEdited==='avg'){if(!Number.isFinite(avgVal)||avgVal<=0){showToast('Enter an average weight or a total weight.',true);return;}avg=avgVal;total=birdsVal*avg;}
  else{if(!Number.isFinite(totalVal)||totalVal<=0){showToast('Enter a total weight or an average weight.',true);return;}total=totalVal;avg=total/birdsVal;}
  const age=(Number.isFinite(ageVal)&&ageVal>=0)?Math.floor(ageVal):0;
  const ageOverride=s.ageTouched?age:null;
  const newPickup={date:dateObj,birds:Math.floor(birdsVal),isFinal,variance:null,totalWeightKg:total,totalWeightKgFromExcel:null,totalWeightKgManual:true,source:'manual',ageOverride};
  if(!shed.pickups)shed.pickups=[];
  if(s.mode==='add'){
    if(shed.pickups.length>=MAX_PICKUPS_PER_SHED){showToast(`This shed already has ${MAX_PICKUPS_PER_SHED} pickups.`,true);return;}
    const dup=shed.pickups.find(p=>iso(p.date)===iso(dateObj));
    if(dup&&!confirm('A pickup already exists for this date. Add another anyway?'))return;
    shed.pickups.push(newPickup);
  }else{
    const idx=shed.pickups.findIndex(p=>iso(p.date)===s.originalDateIso);
    if(idx<0){showToast('Pickup not found.',true);return;}
    const original=shed.pickups[idx];
    newPickup.source=original.source||'excel';
    newPickup.totalWeightKgFromExcel=original.totalWeightKgFromExcel;
    if(newPickup.source==='manual')newPickup.totalWeightKgManual=true;
    else newPickup.totalWeightKgManual=(original.totalWeightKgFromExcel==null)?true:(Math.abs(Number(total)-Number(original.totalWeightKgFromExcel))>0.01);
    shed.pickups[idx]=newPickup;
  }
  reflowShedPickups(shed);reconcilePredictedPickups(shed);
  saveState();schedulePush();
  closeManualPickupModal();render();
  showToast(s.mode==='add'?'✅ Pickup added.':'✅ Pickup updated.');
}
function reflowShedPickups(shed){
  if(!shed||!Array.isArray(shed.pickups))return;
  shed.pickups.sort((a,b)=>dateOnly(a.date)-dateOnly(b.date));
  let finalSeen=false;
  for(const p of shed.pickups){if(p.isFinal&&!finalSeen)finalSeen=true;else if(p.isFinal&&finalSeen)p.isFinal=false;}
  const fp=shed.pickups.find(p=>p.isFinal);
  if(fp){shed.cleanoutDate=dateOnly(fp.date);const totalPicked=shed.pickups.reduce((sum,p)=>sum+(Number(p.birds)||0),0);shed.mortality=Math.max(0,(shed.initialPopulation||0)-totalPicked);shed.mortalityUpdatedAt=dateOnly(new Date());}
}
function deleteManualPickup(shedId,dateIso){
  if(!farmData)return;
  const shed=farmData.sheds[shedId-1];if(!shed)return;
  const p=(shed.pickups||[]).find(x=>iso(x.date)===dateIso);if(!p)return;
  const label=p.source==='manual'?'manually-entered':'Excel-imported';
  if(!confirm(`Delete this ${label} pickup from ${fmtShort(p.date)}?`))return;
  shed.pickups=(shed.pickups||[]).filter(x=>iso(x.date)!==dateIso);
  reflowShedPickups(shed);reconcilePredictedPickups(shed);
  saveState();schedulePush();render();
  showToast('Pickup deleted.');
}

/* ---------- Sample modal ---------- */
function openSampleModal(shedId,editIdx){
  if(!farmData)return;
  const shed=farmData.sheds[shedId-1];if(!shed)return;
  if(!shed.inYardSamples)shed.inYardSamples=[];
  const samples=shed.inYardSamples;
  if(editIdx!=null&&samples[editIdx]){
    const x=samples[editIdx];
    sampleState={shedId,mode:'edit',editIdx,dateIso:iso(x.date),ageValue:sampleAge(shed,x),ageTouched:(x.ageOverride!=null),avgWeight:x.avgWeightKg!=null?Number(x.avgWeightKg.toFixed(3)):'',isOfficial:!!x.isOfficial};
  }else{
    const today=todayIso();
    const computedAge=shed.placementDate?Math.max(0,daysBetween(shed.placementDate,today)):0;
    sampleState={shedId,mode:'add',editIdx:null,dateIso:today,ageValue:computedAge,ageTouched:false,avgWeight:'',isOfficial:false};
  }
  renderSampleModal();
  const modal=document.getElementById('sampleModal');const scrim=document.getElementById('syncScrim');
  modal.classList.add('open');scrim.classList.add('open');
}
function closeSampleModal(){document.getElementById('sampleModal').classList.remove('open');sampleState=null;updateScrimVisibility();}
function renderSampleModal(){
  const body=document.getElementById('sampleModalBody');const titleEl=document.getElementById('sampleModalTitle');
  const s=sampleState;if(!s||!body)return;
  const shed=farmData.sheds[s.shedId-1];
  if(titleEl)titleEl.innerHTML=s.mode==='add'?`<span>📏</span> Extra Reading Day — Shed ${s.shedId}`:`<span>✎</span> Edit Extra Reading — Shed ${s.shedId}`;
  const count=(shed.inYardSamples||[]).length;
  body.innerHTML=`<div class="sync-status-card"><div class="sync-status-row"><span class="lbl">Shed</span><span class="val">Shed ${s.shedId}</span></div><div class="sync-status-row"><span class="lbl">Placement</span><span class="val">${shed.placementDate?fmtShort(shed.placementDate):'—'}</span></div><div class="sync-status-row"><span class="lbl">Extra readings</span><span class="val">${count}</span></div></div><div class="mp-field"><label>Date</label><input type="date" id="smDate" value="${s.dateIso}" /></div><div class="mp-field"><label>Age (days) <span class="auto-chip" id="smAgeChip" style="${s.ageTouched?'display:none;':''}">auto</span></label><input type="number" id="smAge" min="0" step="1" value="${s.ageValue}" /></div><div class="mp-field"><label>Average weight (kg/bird)</label><input type="number" id="smAvg" step="0.001" min="0" value="${s.avgWeight}" placeholder="e.g. 0.485" /></div><label class="mp-checkbox-row"><input type="checkbox" id="smOfficial" ${s.isOfficial?'checked':''} /><span>This number came from the plant or company (not your shed scale)</span></label><div class="mp-hint">Use this for weigh-ins that don't land on Day 7, 14, 21, or 28. Shed scale readings are adjusted ×${(currentBiasFactor()*100).toFixed(0)}% to match plant weights.</div><div class="sync-actions"><button class="btn-sync-primary" id="smSaveBtn">${s.mode==='add'?'＋ Add Extra Reading':'✓ Save Changes'}</button><button class="btn-sync-primary ghost" id="smCancelBtn">Cancel</button></div>`;
  const dateEl=document.getElementById('smDate');const ageEl=document.getElementById('smAge');const avgEl=document.getElementById('smAvg');const ageChipEl=document.getElementById('smAgeChip');
  const onDateChange=()=>{s.dateIso=dateEl.value;if(s.ageTouched)return;const d=parseExcelDate(dateEl.value);if(!d)return;const a=shed.placementDate?Math.max(0,daysBetween(shed.placementDate,d)):0;ageEl.value=a;s.ageValue=a;if(ageChipEl)ageChipEl.style.display='';};
  const onAgeChange=()=>{s.ageTouched=true;if(ageChipEl)ageChipEl.style.display='none';const a=Number(ageEl.value);if(Number.isFinite(a)&&a>=0)s.ageValue=Math.floor(a);};
  dateEl.addEventListener('input',onDateChange);dateEl.addEventListener('change',onDateChange);ageEl.addEventListener('input',onAgeChange);
  document.getElementById('smSaveBtn').addEventListener('click',saveSample);
  document.getElementById('smCancelBtn').addEventListener('click',closeSampleModal);
  setTimeout(()=>{avgEl&&avgEl.focus();},80);
}
function saveSample(){
  const s=sampleState;if(!s)return;
  const shed=farmData.sheds[s.shedId-1];if(!shed)return;
  const dateStr=document.getElementById('smDate').value;
  const ageVal=Number(document.getElementById('smAge').value);
  const avgVal=Number(document.getElementById('smAvg').value);
  const isOfficial=document.getElementById('smOfficial').checked;
  const dateObj=parseExcelDate(dateStr);
  if(!dateObj){showToast('Pick a valid date.',true);return;}
  if(!Number.isFinite(avgVal)||avgVal<=0){showToast('Enter a valid average weight.',true);return;}
  const age=(Number.isFinite(ageVal)&&ageVal>=0)?Math.floor(ageVal):0;
  const ageOverride=s.ageTouched?age:null;
  const sampleObj={date:dateObj,ageOverride,birds:0,avgWeightKg:avgVal,isOfficial};
  if(!shed.inYardSamples)shed.inYardSamples=[];
  if(s.mode==='add')shed.inYardSamples.push(sampleObj);
  else shed.inYardSamples[s.editIdx]=sampleObj;
  shed.inYardSamples.sort((a,b)=>dateOnly(a.date)-dateOnly(b.date));
  saveState();schedulePush();closeSampleModal();render();
  showToast(s.mode==='add'?'✅ Extra reading day added.':'✅ Extra reading day updated.');
}
function deleteSample(shedId,idx){
  if(!farmData)return;
  const shed=farmData.sheds[shedId-1];
  if(!shed||!shed.inYardSamples||!shed.inYardSamples[idx])return;
  const x=shed.inYardSamples[idx];
  if(!confirm(`Delete this extra reading from ${fmtShort(x.date)}?`))return;
  shed.inYardSamples.splice(idx,1);saveState();schedulePush();render();
  showToast('Extra reading day deleted.');
}

/* ---------- Predicted pickup modal ---------- */
function openPredictedPickupModal(shedId,editId){
  if(!farmData)return;
  const shed=farmData.sheds[shedId-1];if(!shed)return;
  const ds=getShedDensitySettings(shed);
  const cleanout=shed.cleanoutDate?dateOnly(shed.cleanoutDate):null;
  if(editId){
    const pp=(shed.predictedPickups||[]).find(x=>x.id===editId);if(!pp)return;
    predictedPickupState={shedId,mode:'edit',editId,dateIso:iso(pp.date),birds:pp.birds,isFinal:!!pp.isFinal,userEditedBirds:true};
  }else{
    // Strict target enforcement — real + predicted must not exceed target.
    const realCount=(shed.pickups||[]).length;
    const predictedCount=(shed.predictedPickups||[]).length;
    const targetN=ds.targetPickups;
    if(realCount+predictedCount>=targetN){
      showToast(`This shed already has its target of ${targetN} pickups (${realCount} real + ${predictedCount} planned).`,true);
      return;
    }
    let defaultDate=addDays(new Date(),7);
    if(shed.placementDate){
      let cursor=addDays(new Date(),1);
      const maxDate=cleanout||addDays(new Date(),40);
      while(cursor<=maxDate){
        const info=densityOnDate(shed,cursor);
        if(info.density>=ds.triggerDensity){defaultDate=cursor;break;}
        cursor=addDays(cursor,1);
      }
      // If the found date lands on a blocked day, push forward
      defaultDate=nextAllowedPickupDate(defaultDate);
    }
    predictedPickupState={shedId,mode:'add',editId:null,dateIso:iso(defaultDate),birds:null,isFinal:false,userEditedBirds:false};
  }
  renderPredictedPickupModal();
  const modal=document.getElementById('predictedPickupModal');const scrim=document.getElementById('syncScrim');
  modal.classList.add('open');scrim.classList.add('open');
}
function closePredictedPickupModal(){document.getElementById('predictedPickupModal').classList.remove('open');predictedPickupState=null;updateScrimVisibility();}
function renderPredictedPickupModal(){
  const body=document.getElementById('predictedPickupModalBody');const titleEl=document.getElementById('predictedPickupModalTitle');
  const s=predictedPickupState;if(!s||!body)return;
  const shed=farmData.sheds[s.shedId-1];const ds=getShedDensitySettings(shed);
  const cleanout=shed.cleanoutDate?dateOnly(shed.cleanoutDate):null;
  if(titleEl)titleEl.innerHTML=s.mode==='add'?`<span>🎯</span> New Predicted Pickup — Shed ${s.shedId}`:`<span>✎</span> Edit Predicted Pickup — Shed ${s.shedId}`;
  const dateLocked=!!s.isFinal&&!!cleanout;const dateValue=dateLocked?iso(cleanout):s.dateIso;
  body.innerHTML=`<div class="sync-status-card"><div class="sync-status-row"><span class="lbl">Shed</span><span class="val">Shed ${s.shedId}</span></div><div class="sync-status-row"><span class="lbl">Floor area</span><span class="val">${FIXED_FLOOR_AREA_M2.toLocaleString()} m²</span></div><div class="sync-status-row"><span class="lbl">Trigger / Target</span><span class="val">${ds.triggerDensity} / ${ds.targetDensity} kg/m²</span></div>${cleanout?`<div class="sync-status-row"><span class="lbl">Cleanout date</span><span class="val">${fmtShort(cleanout)}</span></div>`:''}</div><label class="mp-checkbox-row ${s.isFinal?'emphasis':''}" id="ppFinalLabel"><input type="checkbox" id="ppFinal" ${s.isFinal?'checked':''} /><span>This is the final <strong>cleanout</strong> pickup — removes all remaining birds on the cleanout date</span></label><div class="mp-field"><label>Pickup date ${dateLocked?'<span style="color:var(--primary-dark);text-transform:none;font-weight:600;">· 🔒 locked to cleanout</span>':''}</label><input type="date" id="ppDate" value="${dateValue}" ${dateLocked?'disabled':''} /></div><div class="pp-density-preview" id="ppPreview"></div><div class="mp-field"><label>Birds to remove</label><input type="number" id="ppBirds" min="0" step="50" value="${s.birds==null?'':s.birds}" placeholder="auto-suggested" /></div><div class="mp-hint" id="ppHint"></div><div class="sync-actions"><button class="btn-sync-primary" id="ppSaveBtn">${s.mode==='add'?'＋ Save Predicted Pickup':'✓ Save Changes'}</button><button class="btn-sync-primary ghost" id="ppCancelBtn">Cancel</button></div>`;
  const dateEl=document.getElementById('ppDate');const birdsEl=document.getElementById('ppBirds');const finalEl=document.getElementById('ppFinal');const hintEl=document.getElementById('ppHint');const labelEl=document.getElementById('ppFinalLabel');
  const refreshHint=()=>{
    if(hintEl)hintEl.innerHTML=s.isFinal?`The <strong>cleanout pickup</strong> removes every remaining bird on the shed's cleanout date (${cleanout?fmtShort(cleanout):'not set'}).`:`The recommendation brings density back to <strong>${ds.targetDensity} kg/m²</strong>. The <strong>Birds to remove</strong> input mirrors the recommendation — edit it any time to override.`;
    if(labelEl)labelEl.classList.toggle('emphasis',s.isFinal);
  };
  const autoFillBirds=()=>{
    if(s.isFinal){
      if(!cleanout)return;
      const priorPredicted=(shed.predictedPickups||[]).filter(x=>x.id!==s.editId);
      const liveAtCleanout=computeLiveBirdsBefore(shed,cleanout,priorPredicted.map(pp=>({date:pp.date,birds:pp.birds})));
      s.birds=Math.floor(liveAtCleanout/50)*50;if(birdsEl)birdsEl.value=s.birds;
    }else{
      const rec=recommendPickupForDate(shed,s.dateIso,{excludePredictedId:s.editId});
      if(rec){s.birds=rec.recommendedRemove;if(birdsEl)birdsEl.value=rec.recommendedRemove;}
    }
  };
  const onDateChange=()=>{s.dateIso=dateEl.value;if(!s.userEditedBirds)autoFillBirds();refreshPredictedPickupPreview();};
  const onBirdsChange=()=>{const v=birdsEl.value;if(v===''){s.birds=null;s.userEditedBirds=false;autoFillBirds();}else{s.birds=Number(v);s.userEditedBirds=true;}refreshPredictedPickupPreview();};
  const onFinalToggle=()=>{
    s.isFinal=!!finalEl.checked;s.userEditedBirds=false;
    if(s.isFinal&&cleanout){s.dateIso=iso(cleanout);if(dateEl)dateEl.value=s.dateIso;if(dateEl)dateEl.disabled=true;}
    else if(dateEl)dateEl.disabled=false;
    autoFillBirds();refreshHint();refreshPredictedPickupPreview();
  };
  dateEl.addEventListener('input',onDateChange);dateEl.addEventListener('change',onDateChange);
  birdsEl.addEventListener('input',onBirdsChange);
  if(finalEl)finalEl.addEventListener('change',onFinalToggle);
  if(s.mode==='add'&&(s.birds==null||s.birds===''))autoFillBirds();
  refreshHint();refreshPredictedPickupPreview();
  document.getElementById('ppSaveBtn').addEventListener('click',savePredictedPickup);
  document.getElementById('ppCancelBtn').addEventListener('click',closePredictedPickupModal);
}
function refreshPredictedPickupPreview(){
  const s=predictedPickupState;if(!s)return;
  const shed=farmData.sheds[s.shedId-1];if(!shed)return;
  const el=document.getElementById('ppPreview');if(!el)return;
  const ds=getShedDensitySettings(shed);
  const cleanout=shed.cleanoutDate?dateOnly(shed.cleanoutDate):null;
  const effectiveDate=s.isFinal&&cleanout?cleanout:parseExcelDate(s.dateIso);
  if(!effectiveDate){el.innerHTML='<div style="color:var(--danger);font-weight:600;">Pick a valid date.</div>';return;}
  const info=densityOnDate(shed,effectiveDate,null,s.editId);
  const age=info.age;const weight=info.weight;const liveBefore=info.live;const densityBefore=info.density;
  const rec=s.isFinal?null:recommendPickupForDate(shed,s.dateIso,{excludePredictedId:s.editId});
  const birdsToRemove=(s.birds==null||s.birds==='')?(rec?rec.recommendedRemove:0):Math.max(0,Math.floor(Number(s.birds)));
  const liveAfter=Math.max(0,liveBefore-birdsToRemove);
  const densityAfter=(liveAfter*weight)/FIXED_FLOOR_AREA_M2;
  const colorFor=d=>{if(d>ds.maxDensity)return 'danger';if(d>ds.triggerDensity)return 'warn';return 'safe';};
  const recStr=s.isFinal?`All ${liveBefore.toLocaleString()} remaining birds`:(rec?rec.recommendedRemove.toLocaleString()+' birds':'—');
  const note=(!s.isFinal&&densityBefore<ds.targetDensity)?'<div style="margin-top:6px;font-size:11.5px;color:var(--muted);line-height:1.4;">ℹ️ Density is already under target on this date — a pickup is not strictly needed.</div>':(s.isFinal&&!cleanout)?'<div style="margin-top:6px;font-size:11.5px;color:var(--danger);line-height:1.4;">⚠️ This shed has no cleanout date set.</div>':'';
  el.innerHTML=`<div class="pp-density-row"><span class="lbl">Age at pickup</span><span class="val">Day ${age}</span></div><div class="pp-density-row"><span class="lbl">Forecast weight</span><span class="val">${weight.toFixed(3)} kg</span></div><div class="pp-density-row"><span class="lbl">Live birds before</span><span class="val">${liveBefore.toLocaleString()}</span></div><div class="pp-density-row"><span class="lbl">Density before</span><span class="val ${colorFor(densityBefore)}">${densityBefore.toFixed(1)} kg/m²</span></div><div class="pp-density-row"><span class="lbl">${s.isFinal?'Cleanout removal':'Recommended removal'}</span><span class="val">${recStr}</span></div><div class="pp-density-row"><span class="lbl">Live birds after</span><span class="val">${liveAfter.toLocaleString()}</span></div><div class="pp-density-row"><span class="lbl">Density after</span><span class="val ${colorFor(densityAfter)}">${densityAfter.toFixed(1)} kg/m²</span></div>${note}`;
}
function savePredictedPickup(){
  const s=predictedPickupState;if(!s)return;
  const shed=farmData.sheds[s.shedId-1];if(!shed)return;
  const dateStr=document.getElementById('ppDate').value;
  const birdsStr=document.getElementById('ppBirds').value;
  let dateObj;
  if(s.isFinal){if(!shed.cleanoutDate){showToast("Set the shed's cleanout date first.",true);return;}dateObj=dateOnly(shed.cleanoutDate);}
  else dateObj=parseExcelDate(dateStr);
  if(!dateObj){showToast('Pick a valid date.',true);return;}
  let birds=Number(birdsStr);if(!Number.isFinite(birds)||birds<0)birds=0;
  const realMatch=(shed.pickups||[]).some(rp=>iso(rp.date)===iso(dateObj));
  if(realMatch){showToast('A real pickup already exists on this date — predicted pickup not saved.',true);return;}
  if(!shed.predictedPickups)shed.predictedPickups=[];
  let editedId=null;
  if(s.mode==='add'){
    editedId=uid('pp');
    shed.predictedPickups.push({id:editedId,date:dateObj,birds:Math.floor(birds),isFinal:!!s.isFinal});
    showToast(s.isFinal?'✅ Cleanout predicted pickup added.':'✅ Predicted pickup added.');
  }else{
    const idx=shed.predictedPickups.findIndex(x=>x.id===s.editId);
    if(idx<0){showToast('Predicted pickup not found.',true);return;}
    editedId=s.editId;
    shed.predictedPickups[idx]={...shed.predictedPickups[idx],date:dateObj,birds:Math.floor(birds),isFinal:!!s.isFinal};
    showToast('✅ Predicted pickup updated.');
  }
  shed.predictedPickups.sort((a,b)=>dateOnly(a.date)-dateOnly(b.date));
  // Cascade: resize everything after the edited pickup to hit target density,
  // then resize the final cleanout to absorb the remainder.
  if(!s.isFinal&&editedId)cascadePredictedPickups(shed,editedId);
  saveState();schedulePush();closePredictedPickupModal();render();
}
function deletePredictedPickup(shedId,ppId){
  if(!farmData)return;
  const shed=farmData.sheds[shedId-1];if(!shed)return;
  const pp=(shed.predictedPickups||[]).find(x=>x.id===ppId);if(!pp)return;
  const label=pp.isFinal?'cleanout predicted pickup':'predicted pickup';
  if(!confirm(`Delete the ${label} on ${fmtShort(pp.date)}?`))return;
  shed.predictedPickups=shed.predictedPickups.filter(x=>x.id!==ppId);
  // Cascade: find the latest regular pickup before the deleted one and
  // resize everything after it.
  if(!pp.isFinal){
    const sorted=shed.predictedPickups.slice().sort((a,b)=>dateOnly(a.date)-dateOnly(b.date));
    const before=sorted.filter(x=>!x.isFinal&&dateOnly(x.date)<dateOnly(pp.date));
    if(before.length>0)cascadePredictedPickups(shed,before[before.length-1].id);
    else recalcFinalPredictedBirds(shed);
  }
  saveState();schedulePush();render();
  showToast('Predicted pickup removed.');
}
function autoFillPredictedPickupsForShed(shedId){
  if(!farmData)return;
  const shed=farmData.sheds[shedId-1];
  if(!shed||!shed.placementDate){showToast('Set a placement date first.',true);return;}
  const realFinal=(shed.pickups||[]).some(p=>p.isFinal);
  if(realFinal){showToast('Target reached — a cleanout pickup is already recorded for this shed.',true);return;}
  if((shed.predictedPickups||[]).length>0){if(!confirm('This will replace your existing predicted pickups with an auto-generated plan. Continue?'))return;}
  const generated=autoFillPredictedPickups(shed);
  if(generated.length===0){showToast('Could not auto-generate a plan — check placement/cleanout dates and target pickups.',true);return;}
  shed.predictedPickups=generated;saveState();schedulePush();render();
  const finals=generated.filter(g=>g.isFinal).length;
  const regulars=generated.length-finals;
  showToast(`✨ Auto-filled ${regulars} regular + ${finals} cleanout pickup${generated.length===1?'':'s'}.`);
}
function autoFillAllSheds(){
  if(!farmData){showToast('Import Excel first.',true);return;}
  const placed=farmData.sheds.filter(s=>s.placementDate&&s.initialPopulation>0);
  if(placed.length===0){showToast('No sheds are placed yet.',true);return;}
  const eligible=placed.filter(s=>!(s.pickups||[]).some(p=>p.isFinal));
  const skipped=placed.length-eligible.length;
  if(eligible.length===0){showToast('All sheds already have their cleanout pickup recorded.',true);return;}
  if(!confirm(`Auto-fill predicted pickups for ${eligible.length} placed shed${eligible.length===1?'':'s'}?\n\nExisting predicted pickups will be replaced.${skipped>0?`\n\n(${skipped} shed${skipped===1?'':'s'} skipped — cleanout already recorded.)`:''}`))return;
  let totalRegular=0,totalFinal=0,shedsTouched=0;
  for(const shed of eligible){const generated=autoFillPredictedPickups(shed);shed.predictedPickups=generated;totalRegular+=generated.filter(g=>!g.isFinal).length;totalFinal+=generated.filter(g=>g.isFinal).length;if(generated.length>0)shedsTouched++;}
  saveState();schedulePush();render();
  const total=totalRegular+totalFinal;
  if(total===0)showToast('Auto-fill produced no pickups — check placement dates and density settings.',true);
  else showToast(`✨ Auto-filled ${totalRegular} regular + ${totalFinal} cleanout pickup${total===1?'':'s'} across ${shedsTouched} shed${shedsTouched===1?'':'s'}.`);
}
function clearAllPredictedPickups(){
  if(!farmData){showToast('Nothing to clear.',true);return;}
  const withAny=farmData.sheds.filter(s=>(s.predictedPickups||[]).length>0);
  if(withAny.length===0){showToast('No predicted pickups to clear.',true);return;}
  let total=0;for(const shed of withAny)total+=(shed.predictedPickups||[]).length;
  if(!confirm(`Clear all predicted pickups?\n\nThis will remove ${total} predicted pickup${total===1?'':'s'} across ${withAny.length} shed${withAny.length===1?'':'s'}.\n\nActual pickups are not affected.`))return;
  for(const shed of withAny)shed.predictedPickups=[];
  saveState();schedulePush();render();
  showToast(`🗑️ Cleared ${total} predicted pickup${total===1?'':'s'}.`);
}
function clearPredictedPickupsForShed(shedId){
  if(!farmData)return;
  const shed=farmData.sheds[shedId-1];if(!shed)return;
  const count=(shed.predictedPickups||[]).length;
  if(count===0){showToast('No predicted pickups to clear.',true);return;}
  if(!confirm(`Clear all ${count} predicted pickup${count===1?'':'s'} from Shed ${shedId}?`))return;
  shed.predictedPickups=[];saveState();schedulePush();render();
  showToast(`🗑️ Cleared ${count} predicted pickup${count===1?'':'s'} from Shed ${shedId}.`);
}

/* ---------- Excel import ---------- */
function detectPickupCollisions(currentFarmData,incomingSheds){
  const result={hasAny:false,byShed:{}};
  if(!currentFarmData||!Array.isArray(currentFarmData.sheds))return result;
  for(const inc of incomingSheds){
    const cur=currentFarmData.sheds[inc.id-1];
    if(!cur||!cur.pickups||cur.pickups.length===0)continue;
    const curDates=new Map();cur.pickups.forEach(p=>curDates.set(iso(p.date),p));
    const incPickups=inc.pickups||[];const incDates=new Set(incPickups.map(p=>iso(p.date)));
    const conflicts=[],newOnly=[],existingOnly=[];
    for(const ip of incPickups){const k=iso(ip.date);if(curDates.has(k))conflicts.push({dateIso:k,existing:curDates.get(k),imported:ip});else newOnly.push(ip);}
    for(const cp of cur.pickups){const k=iso(cp.date);if(!incDates.has(k))existingOnly.push(cp);}
    if(conflicts.length>0){result.hasAny=true;result.byShed[inc.id]={shedId:inc.id,conflicts,newOnly,existingOnly};}
  }
  return result;
}
function openImportConflictModal(){
  const body=document.getElementById('importConflictBody');if(!body||!pendingImport)return;
  const c=pendingImport.collisions;
  let totalConflicts=0,shedCount=0;
  Object.values(c.byShed).forEach(x=>{totalConflicts+=x.conflicts.length;shedCount++;});
  body.innerHTML=`<div class="farm-found-icon">⚠️</div><div class="farm-found-title">Existing pickup data found</div><div class="farm-found-sub">${totalConflicts} conflicting record${totalConflicts===1?'':'s'} across ${shedCount} shed${shedCount===1?'':'s'}. Choose how to proceed.</div><div class="ff-choices"><button class="ff-choice primary" id="impReviewBtn" type="button"><span class="ff-icon">🔀</span><div><div class="ff-choice-title">Review and choose</div><div class="ff-choice-sub">Compare each conflict and pick record by record</div></div></button><button class="ff-choice danger" id="impReplaceAllBtn" type="button"><span class="ff-icon">♻️</span><div><div class="ff-choice-title">Replace all with Excel</div><div class="ff-choice-sub">Use the imported file verbatim — manual edits will be discarded</div></div></button><button class="ff-choice secondary" id="impCancelBtn" type="button"><span class="ff-icon">🛡️</span><div><div class="ff-choice-title">Keep existing pickups</div><div class="ff-choice-sub">Imported shed metadata will still be applied</div></div></button></div><button class="ff-cancel" id="impFullCancelBtn" type="button">Cancel entire import</button>`;
  document.getElementById('impReviewBtn').addEventListener('click',()=>{closeImportConflictModal();openImportReviewModal();});
  document.getElementById('impReplaceAllBtn').addEventListener('click',()=>{closeImportConflictModal();finalizeImport('replace');});
  document.getElementById('impCancelBtn').addEventListener('click',()=>{closeImportConflictModal();finalizeImport('skip');});
  document.getElementById('impFullCancelBtn').addEventListener('click',()=>{closeImportConflictModal();pendingImport=null;showToast('Import cancelled.');});
  const modal=document.getElementById('importConflictModal');const scrim=document.getElementById('syncScrim');
  modal.classList.add('open');scrim.classList.add('open');
}
function closeImportConflictModal(){document.getElementById('importConflictModal').classList.remove('open');updateScrimVisibility();}
function openImportReviewModal(){
  if(!pendingImport)return;
  reviewChoices={};
  Object.values(pendingImport.collisions.byShed).forEach(shed=>{shed.conflicts.forEach(c=>{reviewChoices[`${shed.shedId}|${c.dateIso}`]='existing';});});
  renderImportReviewBody();
  const modal=document.getElementById('importReviewModal');const scrim=document.getElementById('syncScrim');
  modal.classList.add('open');scrim.classList.add('open');
}
function closeImportReviewModal(){document.getElementById('importReviewModal').classList.remove('open');updateScrimVisibility();}
function renderImportReviewBody(){
  const body=document.getElementById('importReviewBody');if(!body||!pendingImport)return;
  const c=pendingImport.collisions;
  const shedIds=Object.keys(c.byShed).map(Number).sort((a,b)=>a-b);
  let totalConflicts=0,totalNew=0,totalExistingOnly=0;
  shedIds.forEach(sid=>{totalConflicts+=c.byShed[sid].conflicts.length;totalNew+=c.byShed[sid].newOnly.length;totalExistingOnly+=c.byShed[sid].existingOnly.length;});
  const shedSections=shedIds.map(sid=>{
    const s=c.byShed[sid];
    const conflictRows=s.conflicts.map(cf=>{
      const key=`${sid}|${cf.dateIso}`;
      const cur=cf.existing,imp=cf.imported;
      const curBirds=cur.birds||0,impBirds=imp.birds||0;
      const curAvg=(cur.totalWeightKg&&cur.birds)?(cur.totalWeightKg/cur.birds):null;
      const impAvg=(imp.totalWeightKg&&imp.birds)?(imp.totalWeightKg/imp.birds):null;
      const curSrc=cur.source==='manual'?'Manual':'Excel';
      const impSrc=imp.source==='manual'?'Manual':'Excel';
      const fmtNum=n=>(n==null)?'—':Math.round(n).toLocaleString();
      const fmtW=n=>(n==null)?'—':Number(n).toFixed(3)+' kg';
      const fmtT=n=>(n==null)?'—':Math.round(Number(n)).toLocaleString()+' kg';
      const isChecked=v=>reviewChoices[key]===v?'checked':'';
      return `<div class="conflict-row"><div class="conflict-row-info"><div class="conflict-row-date">${fmtShort(cf.existing.date)}</div><div class="side existing"><span class="lbl">Existing (${curSrc})</span><span class="val">${fmtNum(curBirds)} birds · ${fmtW(curAvg)} · ${fmtT(cur.totalWeightKg)} total</span></div><div class="side imported"><span class="lbl">Imported (${impSrc})</span><span class="val">${fmtNum(impBirds)} birds · ${fmtW(impAvg)} · ${fmtT(imp.totalWeightKg)} total</span></div></div><div class="conflict-radio"><label><input type="radio" name="c-${sid}-${cf.dateIso}" value="existing" ${isChecked('existing')} /> Keep</label><label><input type="radio" name="c-${sid}-${cf.dateIso}" value="imported" ${isChecked('imported')} /> Use Imported</label></div></div>`;
    }).join('');
    const newLines=s.newOnly.length?`<div class="conflict-new">＋ ${s.newOnly.length} new imported record${s.newOnly.length===1?'':'s'} will be added</div>`:'';
    const existingOnlyLines=s.existingOnly.length?`<div class="conflict-existing-only">🛡️ ${s.existingOnly.length} existing-only record${s.existingOnly.length===1?'':'s'} will be kept</div>`:'';
    return `<div class="conflict-shed"><div class="conflict-shed-title"><span>Shed ${sid}</span><span class="count">${s.conflicts.length} conflict${s.conflicts.length===1?'':'s'}</span></div>${conflictRows}${newLines}${existingOnlyLines}</div>`;
  }).join('');
  body.innerHTML=`<div class="sync-hint">Choose per conflict whether to <strong>keep your existing record</strong> or <strong>use the imported Excel record</strong>. Nothing is written until you press Apply.</div><div class="conflict-bulk"><button type="button" data-bulk="all-existing">All: keep existing</button><button type="button" data-bulk="all-imported">All: use imported</button></div>${shedSections}<div class="sync-actions"><button class="btn-sync-primary" id="impReviewApplyBtn">✓ Apply (${totalConflicts} conflict${totalConflicts===1?'':'s'}, ${totalNew} new, ${totalExistingOnly} kept)</button><button class="btn-sync-primary ghost" id="impReviewBackBtn">← Back</button></div>`;
  body.querySelectorAll('input[type="radio"]').forEach(r=>{r.addEventListener('change',e=>{const parts=e.target.name.split('-');const sid=parts[1];const dateIso=parts.slice(2).join('-');reviewChoices[`${sid}|${dateIso}`]=e.target.value;});});
  body.querySelectorAll('[data-bulk]').forEach(btn=>{btn.addEventListener('click',()=>{const val=btn.dataset.bulk==='all-existing'?'existing':'imported';body.querySelectorAll('input[type="radio"]').forEach(r=>{const parts=r.name.split('-');const sid=parts[1];const dateIso=parts.slice(2).join('-');if(r.value===val){r.checked=true;reviewChoices[`${sid}|${dateIso}`]=val;}});});});
  document.getElementById('impReviewApplyBtn').addEventListener('click',()=>{closeImportReviewModal();finalizeImport('review');});
  document.getElementById('impReviewBackBtn').addEventListener('click',()=>{closeImportReviewModal();openImportConflictModal();});
}
function finalizeImport(mode){
  if(!pendingImport)return;
  const {file,result,manualTargets,shedRates,shedSamples,shedChickWeights,shedPredictedPickups,shedTargetPickups}=pendingImport;
  const reviewMap=mode==='review'?{...reviewChoices}:null;
  pendingImport=null;reviewChoices={};
  let removedPredictedCount=0;
  const finalSheds=result.sheds.map(inc=>{
    const cur=farmData?farmData.sheds[inc.id-1]:null;
    const curPickups=(cur&&cur.pickups)?cur.pickups:[];
    const incPickups=inc.pickups||[];
    let finalPickups;
    if(!cur||curPickups.length===0){finalPickups=incPickups.map(p=>({...p}));}
    else if(mode==='replace'){finalPickups=incPickups.map(p=>({...p}));}
    else if(mode==='skip'){finalPickups=curPickups.map(p=>({...p}));}
    else{
      const incMap=new Map();incPickups.forEach(p=>incMap.set(iso(p.date),p));
      const curMap=new Map();curPickups.forEach(p=>curMap.set(iso(p.date),p));
      const allDates=new Set([...incMap.keys(),...curMap.keys()]);
      finalPickups=[];
      for(const dk of allDates){const cc=curMap.get(dk);const i=incMap.get(dk);if(cc&&i){const key=`${inc.id}|${dk}`;const choice=reviewMap[key]||'existing';finalPickups.push(choice==='imported'?{...i}:{...cc});}else if(i)finalPickups.push({...i});else if(cc)finalPickups.push({...cc});}
    }
    finalPickups.sort((a,b)=>dateOnly(a.date)-dateOnly(b.date));
    let finalSeen=false;
    for(const p of finalPickups){if(p.isFinal&&!finalSeen)finalSeen=true;else if(p.isFinal&&finalSeen)p.isFinal=false;}
    if(finalPickups.length===5&&!finalPickups.some(p=>p.isFinal))finalPickups[4].isFinal=true;
    const tc=manualTargets[inc.id]?{...manualTargets[inc.id]}:inc.targetCurve;
    const rate=(shedRates&&shedRates[inc.id]!=null)?shedRates[inc.id]:(inc.mortalityRatePercent!=null?inc.mortalityRatePercent:DEFAULT_MORT_RATE_PCT);
    const cw=(shedChickWeights&&shedChickWeights[inc.id]!=null)?shedChickWeights[inc.id]:(inc.chickWeightKg!=null?inc.chickWeightKg:DEFAULT_CHICK_WEIGHT_KG);
    const samples=(shedSamples&&shedSamples[inc.id])?shedSamples[inc.id]:[];
    const tpPrev=(cur&&cur.targetPickups!=null)?cur.targetPickups:(shedTargetPickups&&shedTargetPickups[inc.id]!=null)?shedTargetPickups[inc.id]:null;
    const tp=(tpPrev!=null&&Number.isFinite(Number(tpPrev)))?Math.max(MIN_PICKUPS_PER_SHED,Math.min(MAX_PICKUPS_PER_SHED,Math.floor(Number(tpPrev)))):null;
    let predicted=(shedPredictedPickups&&shedPredictedPickups[inc.id])?shedPredictedPickups[inc.id].map(x=>({...x})):((cur&&cur.predictedPickups)?cur.predictedPickups.map(x=>({...x})):[]);
    let cleanoutDate=inc.cleanoutDate;let mortality=inc.mortality;
    const fp=finalPickups.find(p=>p.isFinal);
    if(fp){cleanoutDate=dateOnly(fp.date);const totalPicked=finalPickups.reduce((sum,p)=>sum+(Number(p.birds)||0),0);mortality=Math.max(0,(inc.initialPopulation||0)-totalPicked);}
    const realDates=new Set(finalPickups.map(p=>iso(p.date)));
    const hasRealFinal=finalPickups.some(p=>p.isFinal);
    if(hasRealFinal){removedPredictedCount+=predicted.length;predicted=[];}
    else{const before=predicted.length;predicted=predicted.filter(pp=>!realDates.has(iso(pp.date)));removedPredictedCount+=(before-predicted.length);if(cleanoutDate){predicted.forEach(pp=>{if(pp.isFinal)pp.date=dateOnly(cleanoutDate);});predicted.sort((a,b)=>dateOnly(a.date)-dateOnly(b.date));}}
    const densitySettings=(cur&&cur.densitySettings)?{...cur.densitySettings}:{useGlobal:true,maxDensity:null,triggerDensity:null,targetDensity:null};
    let mortalityUpdatedAt=(cur&&cur.mortalityUpdatedAt)?cur.mortalityUpdatedAt:null;
    if(mortality>0)mortalityUpdatedAt=dateOnly(new Date());
    return {...inc,pickups:finalPickups,predictedPickups:predicted,targetPickups:tp,densitySettings,targetCurve:tc,cleanoutDate,mortality,mortalityUpdatedAt,mortalityRatePercent:rate,chickWeightKg:cw,inYardSamples:samples};
  });
  if(!predState.batchNumber&&result.batchNumber){predState.batchNumber=sanitizeBatchNumber(result.batchNumber);savePredState();}
  farmData={batchNumber:predState.batchNumber||result.batchNumber||'',importDate:new Date().toISOString(),fileName:file.name,biasFactor:(farmData&&farmData.biasFactor)?farmData.biasFactor:DEFAULT_BIAS_FACTOR,sheds:finalSheds};
  activeTab='g1';saveState();
  (async()=>{
    if(syncFarmName&&syncConnectedAt){await uploadExcelToCloud(file);}else{schedulePush();}
    render();
    const manualTargetCount=Object.keys(manualTargets).length;
    const modeLabel=mode==='replace'?'replaced':(mode==='skip'?'kept existing':'merged');
    showToast(`✅ Imported ${result.matched} shed${result.matched===1?'':'s'}${result.skipped?` · ${result.skipped} row(s) skipped`:''} · pickups ${modeLabel}${manualTargetCount>0?` · kept ${manualTargetCount} in-yard curve${manualTargetCount===1?'':'s'}`:''}${removedPredictedCount>0?` · removed ${removedPredictedCount} predicted pickup${removedPredictedCount===1?'':'s'}`:''}${farmData.batchNumber?` · Batch ${farmData.batchNumber}`:''}`);
  })();
}
function triggerImport(){const input=document.getElementById('excelFile');input.value='';input.click();}
async function handleFile(file){
  if(!file)return;
  // ProdWise JSON backup — routed through history.js for import.
  if(/\.json$/i.test(file.name||'')){
    const ok = await tryImportProdwiseJson(file);
    if(!ok) showToast('This JSON file is not a ProdWise backup.', true);
    return;
  }
  if(typeof XLSX==='undefined'){showToast('Excel reader not available. Check your internet connection.',true);return;}
  if(file.size>MAX_EXCEL_WARN_BYTES){const mb=(file.size/(1024*1024)).toFixed(1);if(!confirm(`This file is ${mb} MB — larger than usual.\n\nLoading and cloud upload may take a few seconds.\n\nContinue?`))return;}
  // Auto-snapshot before the import replaces farmData.
  try { await historyAutoSnapshot('auto-import', 'Before Excel import: ' + (file.name||'file')); } catch(e) { console.warn('Snapshot before import failed', e); }
  try{
    const manualTargets={},shedRates={},shedSamples={},shedChickWeights={},shedPredictedPickups={},shedTargetPickups={};
    if(farmData&&Array.isArray(farmData.sheds)){
      farmData.sheds.forEach(s=>{
        const tc=s.targetCurve||{};
        if(tc[7]||tc[14]||tc[21]||tc[28])manualTargets[s.id]={...tc};
        if(s.mortalityRatePercent!=null&&Number.isFinite(Number(s.mortalityRatePercent)))shedRates[s.id]=Number(s.mortalityRatePercent);
        if(s.chickWeightKg!=null&&Number.isFinite(Number(s.chickWeightKg))&&s.chickWeightKg>0)shedChickWeights[s.id]=Number(s.chickWeightKg);
        if(Array.isArray(s.inYardSamples)&&s.inYardSamples.length>0)shedSamples[s.id]=s.inYardSamples.map(x=>({...x}));
        if(Array.isArray(s.predictedPickups)&&s.predictedPickups.length>0)shedPredictedPickups[s.id]=s.predictedPickups.map(x=>({...x}));
        if(s.targetPickups!=null&&Number.isFinite(Number(s.targetPickups)))shedTargetPickups[s.id]=Number(s.targetPickups);
      });
    }
    const buf=await file.arrayBuffer();
    const wb=XLSX.read(buf,{type:'array',cellDates:true});
    const result=parseShedsFromWorkbook(wb);
    const collisions=detectPickupCollisions(farmData,result.sheds);
    if(collisions.hasAny){pendingImport={file,result,manualTargets,shedRates,shedSamples,shedChickWeights,shedPredictedPickups,shedTargetPickups,collisions};openImportConflictModal();return;}
    pendingImport={file,result,manualTargets,shedRates,shedSamples,shedChickWeights,shedPredictedPickups,shedTargetPickups,collisions:{hasAny:false,byShed:{}}};
    finalizeImport('replace');
  }catch(err){console.error(err);showToast('Import failed: '+(err&&err.message?err.message:'Unknown error.'),true);}
}

/* ---------- Field editors ---------- */
function updateShedField(shedIdx,key,rawValue){
  if(!farmData)return;
  const shed=farmData.sheds[shedIdx];if(!shed)return;
  if(key==='placementDate'||key==='cleanoutDate'){
    shed[key]=rawValue?parseExcelDate(rawValue):null;
    if(key==='cleanoutDate'){const fp=finalPickupOf(shed);if(fp)shed.cleanoutDate=dateOnly(fp.date);reconcilePredictedPickups(shed);}
  }else if(key==='initialPopulation'){const n=Number(rawValue);shed.initialPopulation=Number.isFinite(n)&&n>=0?Math.floor(n):0;}
  else if(key==='mortality'){const n=Number(rawValue);shed.mortality=Number.isFinite(n)&&n>=0?Math.floor(n):0;shed.mortalityUpdatedAt=dateOnly(new Date());}
  else if(key==='customFeedKg'){const s=String(rawValue??'').trim();if(s==='')shed.customFeedKg=null;else{const n=Number(s);shed.customFeedKg=(Number.isFinite(n)&&n>0)?n:null;}}
  else if(key==='mortalityRatePercent'){const n=Number(rawValue);if(Number.isFinite(n)&&n>=0)shed.mortalityRatePercent=Math.max(0,Math.min(MAX_MORT_RATE_PCT,n));}
  else if(key==='chickWeightGrams'){const n=Number(rawValue);if(Number.isFinite(n)&&n>0){const kg=n/1000;if(kg>=MIN_CHICK_WEIGHT_KG&&kg<=MAX_CHICK_WEIGHT_KG)shed.chickWeightKg=kg;}}
  saveState();schedulePush();scheduleRender(60);
}
function setBatchNumber(v){
  const s=String(v??'').trim();
  if(!s){if(predState.batchNumber)return;predState.batchNumber='';if(farmData)farmData.batchNumber='';savePredState();saveState();schedulePush();return;}
  if(predState.batchNumber)return;
  predState.batchNumber=s;if(farmData)farmData.batchNumber=s;
  savePredState();saveState();schedulePush();
}
function setShedView(group,view){if(!['shed1','shed2','both','planner'].includes(view))return;shedViewByGroup[group]=view;inlineDeliveryState=null;saveShedViews();schedulePush();render();}
function setShedTargetPickups(shedId,value){
  if(!farmData)return;
  const shed=farmData.sheds[shedId-1];if(!shed)return;
  const n=Math.floor(Number(value));
  if(!Number.isFinite(n))shed.targetPickups=null;
  else shed.targetPickups=Math.max(MIN_PICKUPS_PER_SHED,Math.min(MAX_PICKUPS_PER_SHED,n));
  saveState();schedulePush();render();
}
function setPickupTotalWeight(shedId,pickupDateIso,value){
  if(!farmData)return;
  const shed=farmData.sheds[shedId-1];if(!shed)return;
  const pickup=(shed.pickups||[]).find(p=>iso(p.date)===pickupDateIso);if(!pickup)return;
  const v=String(value).trim();
  if(v===''){pickup.totalWeightKg=null;pickup.totalWeightKgManual=false;}
  else{const n=Number(v);if(!Number.isFinite(n)||n<=0)return;pickup.totalWeightKg=n;pickup.totalWeightKgManual=true;if(pickup.totalWeightKgFromExcel==null)pickup.totalWeightKgFromExcel=n;}
  saveState();schedulePush();render();
}
function setPickupAvgWeight(shedId,pickupDateIso,value){
  if(!farmData)return;
  const shed=farmData.sheds[shedId-1];if(!shed)return;
  const pickup=(shed.pickups||[]).find(p=>iso(p.date)===pickupDateIso);if(!pickup)return;
  const v=String(value).trim();
  if(v===''){pickup.totalWeightKg=null;pickup.totalWeightKgManual=false;}
  else{const n=Number(v);if(!Number.isFinite(n)||n<=0)return;const birds=Number(pickup.birds)||0;if(birds<=0)return;const total=n*birds;pickup.totalWeightKg=total;pickup.totalWeightKgManual=true;if(pickup.totalWeightKgFromExcel==null)pickup.totalWeightKgFromExcel=total;}
  saveState();schedulePush();render();
}
function revertPickupTotalWeight(shedId,pickupDateIso){
  if(!farmData)return;
  const shed=farmData.sheds[shedId-1];if(!shed)return;
  const pickup=(shed.pickups||[]).find(p=>iso(p.date)===pickupDateIso);if(!pickup)return;
  pickup.totalWeightKg=pickup.totalWeightKgFromExcel||null;pickup.totalWeightKgManual=false;
  saveState();schedulePush();render();
  showToast('↺ Weight reverted to Excel value.');
}
function setTargetCurveValue(shedId,day,value){
  if(!farmData)return;
  const shed=farmData.sheds[shedId-1];if(!shed)return;
  if(!shed.targetCurve)shed.targetCurve={7:null,14:null,21:null,28:null};
  const v=String(value).trim();
  if(v==='')shed.targetCurve[day]=null;
  else{const n=Number(v);shed.targetCurve[day]=(Number.isFinite(n)&&n>0)?n:null;}
  saveState();schedulePush();render();
}
function setPredBeta(v){let n=Number(v);if(!Number.isFinite(n))n=0.27;n=Math.max(0,Math.min(0.6,n));predState.beta=n;savePredState();schedulePush();}
function setTargetHarvestWeight(group,v){let n=Number(v);if(!Number.isFinite(n)||n<=0)n=2.65;n=Math.max(0.5,Math.min(5,n));predState.targetHarvestWeightKg[group]=n;savePredState();schedulePush();render();}
function setPredGroup(g){predState.predGroup=g;savePredState();render();}
function setPredView(v){if(!['shed1','shed2','both'].includes(v))return;predState.predView=v;savePredState();render();}
function setPredDailyPreset(start,end){dailyRangeState={mode:'today',start,end};render();}
function setPredDailyCycle(start,end){
  let s=Number(start),e=Number(end);
  if(!Number.isFinite(s))s=1;if(!Number.isFinite(e))e=21;
  s=Math.max(0,Math.min(200,Math.floor(s)));e=Math.max(0,Math.min(200,Math.floor(e)));
  if(e<s)e=s;
  dailyRangeState={mode:'cycle',start:s,end:e};render();
}
function setFarmFeedOverride(rawVal){const s=String(rawVal??'').trim();if(s==='')predState.farmFeedOverride=null;else{const n=Number(s);predState.farmFeedOverride=(Number.isFinite(n)&&n>0)?n:null;}savePredState();schedulePush();}
function setFarmLeftover(rawVal){const s=String(rawVal??'').trim();if(s==='')predState.farmLeftoverKg=null;else{const n=Number(s);predState.farmLeftoverKg=(Number.isFinite(n)&&n>0)?n:null;}savePredState();schedulePush();}
function setBiasFactor(value){if(!farmData)return;const n=Number(value);if(!Number.isFinite(n)||n<=0)return;const v=Math.max(MIN_BIAS_FACTOR,Math.min(MAX_BIAS_FACTOR,n));farmData.biasFactor=v;saveState();schedulePush();}
function setShedMortRate(shedId,value){if(!farmData)return;const shed=farmData.sheds[shedId-1];if(!shed)return;const n=Number(value);if(!Number.isFinite(n)||n<0)return;shed.mortalityRatePercent=Math.max(0,Math.min(MAX_MORT_RATE_PCT,n));saveState();schedulePush();scheduleRender(30);}
function liveUpdateShedMortality(shedIdx,rawValue){
  if(!farmData)return;
  const shed=farmData.sheds[shedIdx];if(!shed)return;
  const n=Number(rawValue);
  shed.mortality=(Number.isFinite(n)&&n>=0)?Math.floor(n):0;
  shed.mortalityUpdatedAt=dateOnly(new Date());
  saveState();schedulePush();
  if(activeTab==='predictions')updateFarmKpiValues();
}
function toggleAdjCollapse(){predState.adjOpen=!(predState.adjOpen===true);savePredState();render();}
function setDensityGlobal(field,value){
  const dg=predState.densityGlobal||{...DEFAULT_DENSITY_GLOBAL};
  const n=Number(value);if(!Number.isFinite(n))return;
  if(field==='maxDensity')dg.maxDensity=Math.max(28,Math.min(45,n));
  else if(field==='triggerDensity')dg.triggerDensity=Math.max(20,Math.min(45,n));
  else if(field==='targetDensity')dg.targetDensity=Math.max(15,Math.min(35,n));
  else if(field==='targetPickups')dg.targetPickups=Math.max(MIN_PICKUPS_PER_SHED,Math.min(MAX_PICKUPS_PER_SHED,Math.floor(n)));
  predState.densityGlobal=dg;savePredState();schedulePush();
}
function setShedDensityOverride(shedId,field,value){
  if(!farmData)return;
  const shed=farmData.sheds[shedId-1];if(!shed)return;
  if(!shed.densitySettings)shed.densitySettings={useGlobal:true,maxDensity:null,triggerDensity:null,targetDensity:null};
  if(field==='useGlobal')shed.densitySettings.useGlobal=!!value;
  else{const n=Number(value);if(Number.isFinite(n))shed.densitySettings[field]=n;}
  saveState();schedulePush();render();
}

/* ---------- Loads modal ---------- */
function openLoadsModal(){
  closeSettingsDrawer();loadsModalState.open=true;
  const m=document.getElementById('loadsModal');
  if(m){m.classList.add('open');m.setAttribute('aria-hidden','false');}
  renderLoadsModalBody();
}
function closeLoadsModal(){
  loadsModalState.open=false;
  const m=document.getElementById('loadsModal');
  if(m){m.classList.remove('open');m.setAttribute('aria-hidden','true');}
}
function setLoadsFilter(f){loadsModalState.filter=f;renderLoadsModalBody();}
function setLoadsView(v){
  if(v!=='table'&&v!=='oneline')return;
  loadsModalState.view=v;
  try{localStorage.setItem(LOADS_VIEW_KEY,v);}catch(e){}
  renderLoadsModalBody();
}
function loadLoadsView(){
  try{const v=localStorage.getItem(LOADS_VIEW_KEY);if(v==='table'||v==='oneline')loadsModalState.view=v;}catch(e){}
}
function updateLoadsDot(){
  const dot=document.getElementById('loadsDot');if(!dot)return;
  const summary=farmLoadsSummary();
  if(summary.needsActual>0){dot.textContent=String(summary.needsActual);dot.classList.add('show');}
  else{dot.textContent='';dot.classList.remove('show');}
  const btn=document.getElementById('loadsBtn');
  if(btn)btn.title=summary.needsActual>0?`Feed loads — ${summary.needsActual} need an actual`:'Feed loads';
}
function renderLoadsModalBody(){
  const body=document.getElementById('loadsBody');if(!body)return;
  const prevScroll=body.scrollTop;
  const summary=farmLoadsSummary();
  const today=dateOnly(new Date());
  const all=farmLoads.slice().sort((a,b)=>{const t=dateOnly(a.date)-dateOnly(b.date);if(t!==0)return t;return String(a.createdAt||'').localeCompare(String(b.createdAt||''));});
  const loadNumberMap=new Map();
  all.forEach((l,i)=>loadNumberMap.set(l.id,i+1));
  const filter=loadsModalState.filter||'all';
  let filtered=all;
  if(filter==='upcoming')filtered=all.filter(l=>dateOnly(l.date)>=today);
  else if(filter==='needs')filtered=all.filter(l=>!l.migrated&&l.actualKg==null&&dateOnly(l.date)<today);
  else if(filter==='past')filtered=all.filter(l=>dateOnly(l.date)<today);
  const dateCounts={};
  all.forEach(l=>{const k=iso(l.date);dateCounts[k]=(dateCounts[k]||0)+1;});

  const feedTypeCounts=farmLoadsByFeedType();
  const feedTypeChipList=['starter','grower','finisher','withdrawal','unspecified']
    .map(k=>feedTypeCounts[k])
    .filter(b=>b.loads>0)
    .map(b=>`<span class="chip ${b.id}">${b.label} <span class="num">${b.loads} ${b.loads===1?'load':'loads'}</span></span>`)
    .join('');
  const feedTypeRowHtml=feedTypeChipList
    ? `<div class="loads-feedtype-row"><span class="lbl">By feed type</span><div class="delivery-type-chips">${feedTypeChipList}</div><span class="total-chip">Total <strong>${summary.total} load${summary.total===1?'':'s'}</strong></span></div>`
    : '';

  const sumHtml=`<div class="loads-summary">
    <div class="loads-summary-grid">
      <div class="loads-summary-item"><div class="lbl">Total loads</div><div class="val">${summary.total}</div><div class="sub">${summary.upcoming} upcoming · ${summary.past} past</div></div>
      <div class="loads-summary-item"><div class="lbl">With actual</div><div class="val ok">${summary.withActual}</div><div class="sub">${summary.needsActual>0?`${summary.needsActual} still need one`:'all caught up'}</div></div>
      <div class="loads-summary-item"><div class="lbl">Planned</div><div class="val">${fmtTonnesAlways(summary.plannedKg)}</div><div class="sub">${summary.total} docket${summary.total===1?'':'s'}</div></div>
      <div class="loads-summary-item"><div class="lbl">Actual so far</div><div class="val ${summary.needsActual>0?'warn':'ok'}">${summary.actualKg>0?fmtTonnesAlways(summary.actualKg):'—'}</div><div class="sub">${summary.withActual} of ${summary.total} docket${summary.total===1?'':'s'} recorded</div></div>
    </div>
    ${feedTypeRowHtml}
    <div class="loads-summary-actions">
      <button class="btn-load-add" id="loadsAddBtn" type="button">＋ Add Load</button>
      <div class="loads-view-toggle">
        <button type="button" class="${loadsModalState.view==='table'?'active':''}" data-loads-view="table">☰ Table</button>
        <button type="button" class="${loadsModalState.view==='oneline'?'active':''}" data-loads-view="oneline">📋 One-line</button>
      </div>
    </div>
  </div>`;

  const chipsHtml=`<div class="loads-filter-chips">
    <button type="button" class="loads-chip ${filter==='all'?'active':''}" data-loads-filter="all">All loads <span class="count">${summary.total}</span></button>
    <button type="button" class="loads-chip ${filter==='upcoming'?'active':''}" data-loads-filter="upcoming">Upcoming <span class="count">${summary.upcoming}</span></button>
    <button type="button" class="loads-chip ${filter==='needs'?'active':''}" data-loads-filter="needs">Needs actual <span class="count">${summary.needsActual}</span></button>
    <button type="button" class="loads-chip ${filter==='past'?'active':''}" data-loads-filter="past">Past <span class="count">${summary.past}</span></button>
  </div>`;

  if(filtered.length===0){
    let emptyIcon='🚛',emptyTitle='No feed loads planned yet',emptySub='Add your first load to start planning deliveries. One load = one truckload = one docket.';
    if(filter==='needs'&&summary.total>0){emptyIcon='✅';emptyTitle='Nothing needs an actual right now';emptySub='Every past load has its docket number recorded.';}
    else if(filter==='upcoming'){emptyIcon='📅';emptyTitle='No upcoming loads';emptySub='All loads are in the past.';}
    else if(filter==='past'){emptyIcon='📜';emptyTitle='No past loads';emptySub='All loads are in the future.';}
    const emptyHtml=`<div class="loads-empty"><div class="emoji">${emptyIcon}</div><div class="title">${emptyTitle}</div><div class="sub">${emptySub}</div>${filter==='all'?'<button class="btn-load-add" type="button" id="loadsEmptyAddBtn">＋ Add first load</button>':''}</div>`;
    body.innerHTML=sumHtml+chipsHtml+emptyHtml;
    const ab1=document.getElementById('loadsAddBtn');if(ab1)ab1.addEventListener('click',()=>openLoadModal(null,null));
    const ab2=document.getElementById('loadsEmptyAddBtn');if(ab2)ab2.addEventListener('click',()=>openLoadModal(null,null));
    body.querySelectorAll('[data-loads-filter]').forEach(b=>b.addEventListener('click',()=>setLoadsFilter(b.dataset.loadsFilter)));
    body.querySelectorAll('[data-loads-view]').forEach(b=>b.addEventListener('click',()=>setLoadsView(b.dataset.loadsView)));
    requestAnimationFrame(()=>{body.scrollTop=prevScroll;});
    return;
  }

  const rowBase=l=>{
    const isWeekendRow=isWeekend(l.date);
    const isPast=dateOnly(l.date)<today;
    const dc=dateCounts[iso(l.date)]||0;
    const badge=dc>1?`<span class="loads-count-badge">${dc} loads</span>`:'';
    const loadNum=loadNumberMap.get(l.id)||0;
    const needsActual=!l.migrated&&l.actualKg==null&&isPast;
    const rowCls=[
      isWeekendRow?'is-weekend':'',
      isPast?'is-past':'',
      needsActual?'load-needs-actual':'',
      (!isPast&&!isWeekendRow)?'load-upcoming':''
    ].filter(Boolean).join(' ');
    return {isWeekendRow,isPast,dc,badge,loadNum,needsActual,rowCls};
  };
  const view=loadsModalState.view||'table';
  let bodyHtml='';
  if(view==='oneline'){
    const rows=filtered.map(l=>{
      const r=rowBase(l);
      const splitParts=[1,2,3,4].map(g=>{const v=Number(l.splitKg[g])||0;return v>0?`G${g} ${(v/1000).toFixed(1)}`:`G${g} —`;}).join(' · ');
      let actualCell='';
      if(l.actualKg!=null&&Number.isFinite(Number(l.actualKg))){
        actualCell=`<span class="lon-actual filled">${(l.actualKg/1000).toFixed(2)} t ✓</span>`;
      } else if(r.needsActual){
        actualCell=`<span class="lon-actual needs">missing docket</span>`;
      } else {
        actualCell=`<span class="lon-actual pending">—</span>`;
      }
      const hasNote=!!(l.note&&l.note.trim());
      const noteStr=hasNote?escapeHtml(l.note):'no note';
      const noteCls=hasNote?'':'empty';
      return `<tr class="${r.rowCls}" data-load-row="${escapeAttr(l.id)}">
        <td class="lon-num-cell"><span class="load-num-badge">#${r.loadNum}</span></td>
        <td class="lon-date">${fmtShort(l.date)}${r.badge}</td>
        <td>${feedTypeTagHtml(l.feedType)}</td>
        <td class="num lon-planned">${(l.plannedKg/1000).toFixed(2)} t</td>
        <td class="lon-split">${splitParts}</td>
        <td class="num">${actualCell}</td>
        <td class="lon-note-cell ${noteCls}">${noteStr}</td>
        <td class="lon-actions-cell">
          <button type="button" class="edit" data-load-edit="${escapeAttr(l.id)}" title="Edit load">✎</button>
          <button type="button" class="del" data-load-delete="${escapeAttr(l.id)}" title="Delete load">✕</button>
        </td>
      </tr>`;
    }).join('');
    bodyHtml=`<div class="loads-table-wrap"><table class="loads-table loads-oneline-table">
      <thead><tr>
        <th class="lon-num-cell">#</th>
        <th>Date</th>
        <th>Type</th>
        <th class="num">Planned</th>
        <th>Split</th>
        <th class="num">Actual Delivery</th>
        <th>Note</th>
        <th class="lon-actions-cell"></th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <div class="loads-hint">💡 <strong>Audit view</strong> — one row per load, aligned columns for comparing physical dockets. Red rows are past loads <strong>missing their actual</strong>. Switch to <strong>☰ Table</strong> to enter or edit actuals inline.</div>`;
  } else {
    const rows=filtered.map(l=>{
      const r=rowBase(l);
      const splitCell=g=>{const v=Number(l.splitKg[g])||0;if(v<=0)return `<td class="split-cell zero">—</td>`;return `<td class="split-cell on">${(v/1000).toFixed(1)}</td>`;};
      const actualStr=(l.actualKg!=null&&Number.isFinite(Number(l.actualKg)))?(l.actualKg/1000).toFixed(2):'';
      const actualCls=(l.actualKg!=null)?'filled':'';
      const actualNeedsCls=r.needsActual?'needs':'';
      const actualPlaceholder=r.needsActual?'enter actual':'—';
      return `<tr class="${r.rowCls}" data-load-row="${escapeAttr(l.id)}">
        <td class="loads-date"><span class="load-num-badge">#${r.loadNum}</span>${fmtShort(l.date)}${r.badge}</td>
        <td>${feedTypeTagHtml(l.feedType)}</td>
        <td class="num loads-planned">${(l.plannedKg/1000).toFixed(2)} t</td>
        ${splitCell(1)}${splitCell(2)}${splitCell(3)}${splitCell(4)}
        <td class="loads-actual-cell"><input type="number" class="loads-actual-input ${actualCls} ${actualNeedsCls}" step="0.01" min="0" data-load-actual="${escapeAttr(l.id)}" placeholder="${actualPlaceholder}" value="${actualStr}" /></td>
        <td><div class="loads-actions"><button type="button" class="edit" data-load-edit="${escapeAttr(l.id)}" title="Edit load">✎</button><button type="button" class="del" data-load-delete="${escapeAttr(l.id)}" title="Delete load">✕</button></div></td>
      </tr>`;
    }).join('');
    bodyHtml=`<div class="loads-table-wrap"><table class="loads-table">
      <thead><tr>
        <th>Date</th><th>Type</th><th class="num">Planned</th>
        <th class="split-cell" style="text-align:center;">G1</th>
        <th class="split-cell" style="text-align:center;">G2</th>
        <th class="split-cell" style="text-align:center;">G3</th>
        <th class="split-cell" style="text-align:center;">G4</th>
        <th>Actual Delivery</th>
        <th style="width:80px;text-align:right;">Actions</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <div class="loads-hint">💡 Type the docket total straight into the Actual column. One number per load — the app tracks it for every group. <strong>Actual is record-only</strong> and does not affect the balance forecast.</div>`;
  }

  body.innerHTML=sumHtml+chipsHtml+bodyHtml;
  document.getElementById('loadsAddBtn').addEventListener('click',()=>openLoadModal(null,null));
  body.querySelectorAll('[data-loads-filter]').forEach(b=>b.addEventListener('click',()=>setLoadsFilter(b.dataset.loadsFilter)));
  body.querySelectorAll('[data-loads-view]').forEach(b=>b.addEventListener('click',()=>setLoadsView(b.dataset.loadsView)));
  body.querySelectorAll('[data-load-edit]').forEach(b=>b.addEventListener('click',()=>openLoadModal(b.dataset.loadEdit,null)));
  body.querySelectorAll('[data-load-delete]').forEach(b=>b.addEventListener('click',()=>confirmDeleteLoad(b.dataset.loadDelete)));
  body.querySelectorAll('[data-load-actual]').forEach(inp=>{
    inp.addEventListener('blur',()=>handleLoadActualBlur(inp));
    inp.addEventListener('keydown',e=>{
      if(e.key==='Enter'){e.preventDefault();inp.blur();}
      if(e.key==='Escape'){e.preventDefault();const load=farmLoads.find(l=>l.id===inp.dataset.loadActual);if(load)inp.value=(load.actualKg!=null)?(load.actualKg/1000).toFixed(2):'';inp.classList.remove('invalid');inp.blur();}
    });
  });
  requestAnimationFrame(()=>{body.scrollTop=prevScroll;});
}
function handleLoadActualBlur(inp){
  const id=inp.dataset.loadActual;
  const load=farmLoads.find(l=>l.id===id);if(!load)return;
  const raw=inp.value.trim();
  const currentVal=(load.actualKg!=null)?(load.actualKg/1000).toFixed(2):'';
  if(raw===currentVal)return;
  const tr=inp.closest('tr');
  if(raw===''){
    load.actualKg=null;
    saveFarmLoads();schedulePush();
    inp.value='';
    inp.classList.remove('filled','invalid');
    inp.classList.add('needs');
    inp.placeholder='enter actual';
    if(tr)tr.classList.add('load-needs-actual');
    updateLoadsDot();
    updateLoadsSummaryInline();
    return;
  }
  const n=Number(raw);
  if(!Number.isFinite(n)||n<=0){
    showToast('Enter a positive number for the actual.',true);
    inp.classList.add('invalid');
    setTimeout(()=>{inp.classList.remove('invalid');inp.value=currentVal;},900);
    return;
  }
  load.actualKg=n*1000;
  saveFarmLoads();schedulePush();
  inp.value=(load.actualKg/1000).toFixed(2);
  inp.classList.remove('invalid','needs');
  inp.classList.add('filled');
  if(tr)tr.classList.remove('load-needs-actual');
  updateLoadsDot();
  updateLoadsSummaryInline();
}
function updateLoadsSummaryInline(){
  const summary=farmLoadsSummary();
  const body=document.getElementById('loadsBody');if(!body)return;
  const tiles=body.querySelectorAll('.loads-summary-item');
  if(tiles[1]){
    const valEl=tiles[1].querySelector('.val');
    const subEl=tiles[1].querySelector('.sub');
    if(valEl)valEl.textContent=String(summary.withActual);
    if(subEl)subEl.textContent=summary.needsActual>0?`${summary.needsActual} still need one`:'all caught up';
  }
  if(tiles[3]){
    const valEl=tiles[3].querySelector('.val');
    const subEl=tiles[3].querySelector('.sub');
    if(valEl){
      valEl.textContent=summary.actualKg>0?fmtTonnesAlways(summary.actualKg):'—';
      valEl.classList.toggle('warn',summary.needsActual>0);
      valEl.classList.toggle('ok',summary.needsActual===0);
    }
    if(subEl)subEl.textContent=`${summary.withActual} of ${summary.total} docket${summary.total===1?'':'s'} recorded`;
  }
  body.querySelectorAll('[data-loads-filter]').forEach(chip=>{
    const countEl=chip.querySelector('.count');
    if(!countEl)return;
    const f=chip.dataset.loadsFilter;
    if(f==='all')countEl.textContent=String(summary.total);
    else if(f==='upcoming')countEl.textContent=String(summary.upcoming);
    else if(f==='needs')countEl.textContent=String(summary.needsActual);
    else if(f==='past')countEl.textContent=String(summary.past);
  });
}
function confirmDeleteLoad(id){
  const load=farmLoads.find(l=>l.id===id);if(!load)return;
  const label=`${fmtShort(load.date)}${load.feedType?' · '+feedTypeLabel(load.feedType):''} · ${(load.plannedKg/1000).toFixed(2)} t`;
  if(!confirm(`Delete this load?\n\n${label}\n\nThis affects the feed balance forecast for the groups it was routed to.`))return;
  deleteLoad(id);updateLoadsDot();renderLoadsModalBody();render();
  showToast('🗑️ Load deleted.');
}
function openLoadModal(editId,preset){
  if(editId){
    const load=farmLoads.find(l=>l.id===editId);if(!load){showToast('Load not found.',true);return;}
    loadModalState={mode:'edit',editId,date:iso(load.date),feedType:load.feedType||'',plannedT:(load.plannedKg/1000).toFixed(2),splitT:{1:((Number(load.splitKg[1])||0)/1000).toFixed(2),2:((Number(load.splitKg[2])||0)/1000).toFixed(2),3:((Number(load.splitKg[3])||0)/1000).toFixed(2),4:((Number(load.splitKg[4])||0)/1000).toFixed(2)},note:load.note||''};
  }else{
    loadModalState={mode:'add',editId:null,date:(preset&&preset.date)||todayIso(),feedType:(preset&&preset.feedType)||'',plannedT:'60.00',splitT:{1:'0.00',2:'0.00',3:'0.00',4:'0.00'},note:''};
  }
  renderLoadModal();
  const modal=document.getElementById('loadModal');const scrim=document.getElementById('syncScrim');
  modal.classList.add('open');scrim.classList.add('open');
}
function closeLoadModal(){document.getElementById('loadModal').classList.remove('open');loadModalState=null;updateScrimVisibility();}
function renderLoadModal(){
  const body=document.getElementById('loadModalBody');const titleEl=document.getElementById('loadModalTitle');
  const s=loadModalState;if(!s||!body)return;
  if(titleEl)titleEl.innerHTML=s.mode==='add'?'<span>🚛</span> Add Load':'<span>✎</span> Edit Load';
  const siloNotes=[1,2,3,4].map(g=>{const bal=currentBalanceKg(g);return bal!=null?`G${g}: ${fmtFeed(bal)}`:`G${g}: no reading`;});
  body.innerHTML=`<div class="mp-field"><label>Date</label><input type="date" id="lmDate" value="${s.date}" /></div>
    <div class="mp-field"><label>Feed type</label><select id="lmType"><option value="" ${s.feedType===''?'selected':''}>— Unspecified —</option>${FEED_TYPES.map(f=>`<option value="${f.id}" ${s.feedType===f.id?'selected':''}>${f.label}</option>`).join('')}</select></div>
    <div class="mp-field"><label>Planned total (t)</label><input type="number" id="lmPlanned" step="0.1" min="0.1" value="${s.plannedT}" /></div>
    <div class="load-form-section"><div class="load-form-section-title"><span>Split across groups</span><button type="button" class="btn-split-evenly" id="lmSplitEven">⚖ Split evenly</button></div>
      <div class="split-grid">${[1,2,3,4].map(g=>`<div class="split-input-group"><label>Group ${g}</label><input type="number" min="0" step="0.1" data-lm-split="${g}" value="${s.splitT[g]}" /><span class="silo-note">${escapeHtml(siloNotes[g-1])}</span></div>`).join('')}</div>
      <div class="split-sum" id="lmSum"></div>
    </div>
    <div class="mp-field"><label>Note (optional)</label><input type="text" id="lmNote" maxlength="60" value="${escapeAttr(s.note)}" placeholder="e.g. Order #1234 — Barlow's truck" /></div>
    <div class="mp-hint">One load = one truck = one docket. The <strong>planned split</strong> drives the feed balance forecast for each group. The <strong>actual</strong> docket total is entered separately in the Loads table.</div>
    <div class="load-modal-actions">
      <button type="button" class="primary grow" id="lmSaveBtn">${s.mode==='add'?'💾 Save load':'✓ Save changes'}</button>
      ${s.mode==='add'?`<button type="button" class="ghost" id="lmSaveAnotherBtn">＋ Save &amp; add another</button>`:''}
      ${s.mode==='edit'?`<button type="button" class="danger" id="lmDeleteBtn">🗑 Delete load</button>`:''}
      <button type="button" class="ghost" id="lmCancelBtn">Cancel</button>
    </div>`;
  const dateEl=document.getElementById('lmDate');const typeEl=document.getElementById('lmType');const plannedEl=document.getElementById('lmPlanned');const noteEl=document.getElementById('lmNote');
  const splitInputs=[1,2,3,4].map(g=>body.querySelector(`[data-lm-split="${g}"]`));
  const sumEl=document.getElementById('lmSum');
  const refreshSum=()=>{
    const planned=Number(plannedEl.value)||0;
    const sum=splitInputs.reduce((s,inp)=>s+(Number(inp.value)||0),0);
    const diff=sum-planned;const ok=Math.abs(diff)<0.005;
    sumEl.className='split-sum '+(ok?'ok':'warn');
    if(ok)sumEl.textContent=`Sum: ${sum.toFixed(2)} / ${planned.toFixed(2)} t ✓`;
    else if(diff<0)sumEl.textContent=`Sum: ${sum.toFixed(2)} / ${planned.toFixed(2)} t ⚠ ${Math.abs(diff).toFixed(2)} t short`;
    else sumEl.textContent=`Sum: ${sum.toFixed(2)} / ${planned.toFixed(2)} t ⚠ ${diff.toFixed(2)} t over`;
  };
  const splitEvenly=()=>{
    const planned=Number(plannedEl.value)||0;if(planned<=0)return;
    let nonZero=splitInputs.filter(inp=>(Number(inp.value)||0)>0);
    if(nonZero.length===0)nonZero=splitInputs;
    const n=nonZero.length;const each=planned/n;
    nonZero.forEach((inp,i)=>{const v=(i===n-1)?(planned-each*(n-1)):each;inp.value=v.toFixed(2);});
    refreshSum();
  };
  plannedEl.addEventListener('input',refreshSum);
  splitInputs.forEach(inp=>inp.addEventListener('input',refreshSum));
  document.getElementById('lmSplitEven').addEventListener('click',splitEvenly);
  refreshSum();
  const doSave=thenAnother=>{
    const plannedT=Number(plannedEl.value);
    if(!Number.isFinite(plannedT)||plannedT<=0){showToast('Enter a positive planned total.',true);return;}
    const plannedKg=Math.round(plannedT*1000);
    const splitKg={1:Math.round((Number(splitInputs[0].value)||0)*1000),2:Math.round((Number(splitInputs[1].value)||0)*1000),3:Math.round((Number(splitInputs[2].value)||0)*1000),4:Math.round((Number(splitInputs[3].value)||0)*1000)};
    const sumKg=splitKg[1]+splitKg[2]+splitKg[3]+splitKg[4];
    if(sumKg!==plannedKg){showToast('Splits must add up to the planned total.',true);return;}
    const dateObj=parseExcelDate(dateEl.value);
    if(!dateObj){showToast('Pick a valid date.',true);return;}
    const payload={id:s.mode==='edit'?s.editId:undefined,date:dateObj,feedType:typeEl.value,plannedKg,splitKg,note:String(noteEl.value||'').trim(),actualKg:s.mode==='edit'?(farmLoads.find(l=>l.id===s.editId)||{}).actualKg:null};
    const result=saveLoad(payload);
    if(!result||result.__error){showToast('Could not save load.',true);return;}
    updateLoadsDot();
    if(thenAnother){
      const d=iso(dateObj);showToast('✅ Load saved — add another.');
      closeLoadModal();renderLoadsModalBody();
      setTimeout(()=>openLoadModal(null,{date:d,feedType:typeEl.value}),80);
    }else{
      closeLoadModal();if(loadsModalState.open)renderLoadsModalBody();render();
      showToast(s.mode==='add'?'✅ Load added.':'✅ Load updated.');
    }
  };
  document.getElementById('lmSaveBtn').addEventListener('click',()=>doSave(false));
  const sa=document.getElementById('lmSaveAnotherBtn');if(sa)sa.addEventListener('click',()=>doSave(true));
  const del=document.getElementById('lmDeleteBtn');if(del)del.addEventListener('click',()=>{
    if(!confirm('Delete this load permanently?'))return;
    deleteLoad(s.editId);updateLoadsDot();closeLoadModal();if(loadsModalState.open)renderLoadsModalBody();render();showToast('🗑️ Load deleted.');
  });
  document.getElementById('lmCancelBtn').addEventListener('click',closeLoadModal);
  setTimeout(()=>plannedEl.focus(),80);
}

/* ---------- Compare modal ---------- */
function openCompareModal(){
  if(!isCompareAvailable()){showToast('📱 Comparison is only available on tablet and desktop screens.',true);return;}
  closeSettingsDrawer();inlineDeliveryState=null;feedCompareState.modalOpen=true;
  // Always open with nothing selected — the user picks which groups to compare.
  feedCompareState.selectedGroups=[];
  feedCompareState.layoutMode='auto';
  feedCompareState.visibleColumns={date:true,age:true,liveBirds:true,dailyFeed:true,delivery:true,endBalance:true};
  const m=document.getElementById('compareFeedModal');
  if(m){m.classList.add('open');m.setAttribute('aria-hidden','false');}
  renderCompareModalBody();
}
function closeCompareModal(){
  feedCompareState.modalOpen=false;inlineDeliveryState=null;
  const m=document.getElementById('compareFeedModal');
  if(m){m.classList.remove('open');m.setAttribute('aria-hidden','true');}
}
function renderCompareGroupPicker(currentGroup){
  const groups=[1,2,3,4];
  const cards=groups.map(g=>{
    const isSelected=feedCompareState.selectedGroups.includes(g);const isCurrent=g===currentGroup;
    const info=groupStatusSummary(g);
    let balText='—',statusText='',statusEmoji='';
    if(info.hasReading){
      balText=fmtFeed(info.balance);
      if(info.daysUntil!=null){statusEmoji=info.daysUntil<=2?'🔴':(info.daysUntil<=7?'🟡':'🟢');statusText=`Runs out in ${info.daysUntil}d`;}
      else{statusEmoji='🟢';statusText=`Lasts > ${siloRange.end}d`;}
    }else{balText='No reading';statusEmoji='⚪';statusText='Tap rings to record';}
    const cls='cmp-group-card'+(isSelected?' selected':'');
    return `<button type="button" class="${cls}" data-compare-group="${g}" aria-pressed="${isSelected?'true':'false'}"><div class="cmp-group-top"><span class="cmp-group-name">Group ${g}</span>${isCurrent?'<span class="cmp-group-current">Current</span>':''}${isSelected?'<span class="cmp-group-check">✓</span>':''}</div><div class="cmp-group-bal">${escapeHtml(balText)}</div><div class="cmp-group-status">${statusEmoji} ${escapeHtml(statusText)}</div></button>`;
  }).join('');
  const count=feedCompareState.selectedGroups.length;const total=groups.length;
  return `<div class="compare-picker"><span class="compare-picker-label">Groups shown · click to toggle · ${count} of ${total} shown</span><div class="compare-picker-cards">${cards}</div></div>`;
}
function renderCompareColumnPicker(){
  const cols=feedCompareState.visibleColumns;
  const items=[{id:'date',label:'Date',locked:true},{id:'age',label:'Age'},{id:'liveBirds',label:'Live birds'},{id:'dailyFeed',label:'Daily Feed'},{id:'delivery',label:'Delivery'},{id:'endBalance',label:'End Balance'}];
  const list=items.map(item=>{const checked=cols[item.id]?'checked':'';const disabled=item.locked?'disabled':'';const cls='cmp-col-toggle'+(item.locked?' locked':'');return `<label class="${cls}"><input type="checkbox" data-compare-col="${item.id}" ${checked} ${disabled} /><span>${item.label}</span></label>`;}).join('');
  return `<div class="compare-col-picker"><span class="compare-picker-label">Columns:</span><div class="cmp-col-list">${list}</div></div>`;
}
function renderCompareModalBody(){
  const body=document.getElementById('compareFeedBody');if(!body)return;
  // Determine the "current" group for highlighting — null when we're not
  // on a group page, so nothing gets wrongly tagged as "Current".
  // (Previously this read activeTab.replace('g','') which became NaN on
  // Dashboard/Predictions and silently closed the modal.)
  const groupMatch=/^g([1-4])$/.exec(activeTab);
  const currentGroup=groupMatch?Number(groupMatch[1]):null;
  let selected=(feedCompareState.selectedGroups||[]).filter(g=>[1,2,3,4].includes(g));
  selected=[...new Set(selected)].sort((a,b)=>a-b);feedCompareState.selectedGroups=selected;
  const cols=feedCompareState.visibleColumns||{date:true,age:true,liveBirds:true,dailyFeed:true,delivery:true,endBalance:true};
  cols.date=true;feedCompareState.visibleColumns=cols;
  const layout=effectiveCompareLayout();
  const tablesHtml=selected.length===0
    ? `<div class="compare-empty-state">Pick one or more groups above to compare their feed balance side by side.</div>`
    : selected.map(g=>{
        const forecast=computeSiloForecast(g,siloRange);const isCurrent=g===currentGroup;const info=groupStatusSummary(g);
        let statusChip='';
        if(info.hasReading){const emoji=info.daysUntil!=null?(info.daysUntil<=2?'🔴':(info.daysUntil<=7?'🟡':'🟢')):'🟢';const daysStr=info.daysUntil!=null?`runs out in ${info.daysUntil}d`:`lasts > ${siloRange.end}d`;statusChip=`${emoji} ${fmtFeed(info.balance)} · ${daysStr}`;}
        else statusChip='⚪ No reading';
        return `<div class="compare-col"><div class="compare-col-head ${isCurrent?'current':''}"><span class="cch-name">Group ${g}${isCurrent?' <span class="cth-tag">Current</span>':''}</span><span class="cch-status">${escapeHtml(statusChip)}</span><div class="cch-deliveries">${renderDeliveriesSummary(g)}</div></div>${renderSiloForecastTable(forecast,g,{inModal:true,columns:cols})}</div>`;
      }).join('');
  body.innerHTML=`${rangeBarHtml(siloRange,'compare')}${renderCompareGroupPicker(currentGroup)}${renderCompareColumnPicker()}<div class="compare-layout-toggle"><span class="clt-label">Layout:</span><button type="button" data-compare-layout="stacked" class="${layout==='stacked'?'active':''}">☰ Stacked</button><button type="button" data-compare-layout="grid" class="${layout==='grid'?'active':''}">▦ Grid</button></div><div class="compare-tables ${layout}">${tablesHtml}</div><div style="font-size:11px;color:var(--muted);margin-top:4px;line-height:1.5;">💡 Click any future weekday row in <strong>any</strong> table to plan a load for that group. Rows with a load already scheduled show a small <strong>✎</strong> button to edit it.</div>`;
  if(inlineDeliveryState){const inp=body.querySelector('.inline-del-input');if(inp)requestAnimationFrame(()=>{try{inp.focus();}catch(e){}});}
}

/* ---------- Main render ---------- */
/* ---------- Batch Report (print-to-PDF) ---------- */
function ensureReportContainer(){
  let rpt=document.getElementById('reportPrint');
  if(!rpt){rpt=document.createElement('div');rpt.id='reportPrint';document.body.appendChild(rpt);}
  return rpt;
}
function buildBatchReportHTML(){
  if(!farmData)return '';
  const now=new Date();
  const batchLabel=(predState.batchNumber||(farmData&&farmData.batchNumber)||'').trim()||'—';
  const farmLabel=syncFarmName||'—';
  const dateStr=fmtShort(now)+' · '+String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  let html=`<div class="rpt-header">
    <div class="rpt-brand">ProdWise.VM — Batch Report</div>
    <div class="rpt-meta">Batch ${escapeHtml(batchLabel)} · Farm ${escapeHtml(farmLabel)}</div>
    <div class="rpt-meta">Generated ${escapeHtml(dateStr)}</div>
    ${(()=>{const n=predState.noPickupDays||[];if(!n.length)return '';const dn=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];return `<div class="rpt-meta">No-pickup days: ${n.map(d=>dn[d]).join(', ')}</div>`;})()}
  </div>`;

  /* Whole Farm KPIs */
  const t=computeFarmTotals();
  if(t.hasData){
    html+=`<section><h2>Whole Farm KPIs</h2><table class="rpt-kv">
      <tr><th>Est. Total Live Weight</th><td class="num">${fmtKgAlways(t.totalLiveWeight)}</td></tr>
      <tr><th>Est. Total Feed Consumption</th><td class="num">${fmtTonnesAlways(t.totalFeed)}</td></tr>
      <tr><th>Est. FCR</th><td class="num">${t.fcr.toFixed(3)}</td></tr>
      <tr><th>Est. cFCR</th><td class="num">${t.cfcr.toFixed(3)}</td></tr>
      <tr><th>Est. PIF</th><td class="num">${t.pif.toFixed(2)}</td></tr>
      <tr><th>Est. Total Average Weight</th><td class="num">${t.avgWeight.toFixed(3)} kg</td></tr>
      <tr><th>Est. Livability</th><td class="num">${t.livability.toFixed(2)}%</td></tr>
      <tr><th>Est. Total Mortality</th><td class="num">${t.mortality.toLocaleString()}</td></tr>
    </table>`;
    if(t.usingManualFeed||t.leftoverApplied){
      html+=`<div style="font-size:9pt;margin-top:4px;">`;
      if(t.usingManualFeed)html+=`Note: Feed consumption uses a manual override (${Number(t.totalFeed).toLocaleString()} kg). `;
      if(t.leftoverApplied)html+=`Leftover at cleanout applied: ${Math.round(t.leftoverKg).toLocaleString()} kg.`;
      html+=`</div>`;
    }
    html+=`</section>`;
  } else {
    html+=`<section><h2>Whole Farm KPIs</h2><div class="rpt-notplaced">No sheds placed this batch.</div></section>`;
  }

  /* Feed Deliveries */
  const sortedLoads=farmLoads.slice().sort((a,b)=>{const d=dateOnly(a.date)-dateOnly(b.date);if(d!==0)return d;return String(a.createdAt||'').localeCompare(String(b.createdAt||''));});
  if(sortedLoads.length>0){
    html+=`<section><h2>Feed Deliveries</h2><table>
      <thead><tr><th>#</th><th>Date</th><th>Type</th><th class="num">Planned</th>
        <th class="num">G1</th><th class="num">G2</th><th class="num">G3</th><th class="num">G4</th>
        <th class="num">Actual Delivery</th><th>Note</th></tr></thead><tbody>`;
    sortedLoads.forEach((l,i)=>{
      const splitCell=g=>{const v=Number(l.splitKg[g])||0;return v>0?(v/1000).toFixed(1):'—';};
      const actualStr=l.actualKg!=null?(l.actualKg/1000).toFixed(2)+' t':'—';
      html+=`<tr>
        <td class="num">#${i+1}</td>
        <td>${fmtShort(l.date)}</td>
        <td>${escapeHtml(feedTypeLabel(l.feedType))}</td>
        <td class="num">${(l.plannedKg/1000).toFixed(2)} t</td>
        <td class="num">${splitCell(1)}</td>
        <td class="num">${splitCell(2)}</td>
        <td class="num">${splitCell(3)}</td>
        <td class="num">${splitCell(4)}</td>
        <td class="num">${escapeHtml(actualStr)}</td>
        <td>${escapeHtml(l.note||'')}</td>
      </tr>`;
    });
    const sumPlanned=farmLoads.reduce((s,l)=>s+(Number(l.plannedKg)||0),0);
    const sumActual=farmLoads.reduce((s,l)=>s+(Number(l.actualKg)||0),0);
    const missing=farmLoads.filter(l=>!l.migrated&&l.actualKg==null&&dateOnly(l.date)<dateOnly(now)).length;
    html+=`<tr class="total-row">
      <td colspan="3">Totals</td>
      <td class="num">${fmtTonnesAlways(sumPlanned)}</td>
      <td colspan="4" class="num" style="font-weight:normal;font-family:Georgia,serif;">${missing>0?`${missing} missing actual${missing===1?'':'s'}`:'All actuals recorded'}</td>
      <td class="num">${sumActual>0?fmtTonnesAlways(sumActual):'—'}</td>
      <td></td>
    </tr></tbody></table></section>`;
  } else {
    html+=`<section><h2>Feed Deliveries</h2><div class="rpt-notplaced">No loads recorded this batch.</div></section>`;
  }

  /* Feed Summary */
  if(farmLoads.length>0){
    const buckets={starter:{label:'Starter',tonnes:0,loads:0},grower:{label:'Grower',tonnes:0,loads:0},finisher:{label:'Finisher',tonnes:0,loads:0},withdrawal:{label:'Withdrawal',tonnes:0,loads:0},unspecified:{label:'Unspecified',tonnes:0,loads:0}};
    farmLoads.forEach(l=>{
      const tt=(Number(l.plannedKg)||0)/1000;
      const key=FEED_TYPES.some(f=>f.id===l.feedType)?l.feedType:'unspecified';
      buckets[key].tonnes+=tt;buckets[key].loads+=1;
    });
    const active=Object.entries(buckets).filter(([k,v])=>v.loads>0);
    if(active.length>0){
      html+=`<section><h2>Feed Summary</h2><table>
        <thead><tr><th>Type</th><th class="num">Total</th><th class="num">Loads</th><th class="num">60 T blocks</th></tr></thead><tbody>`;
      let tT=0,tL=0,tB=0;
      active.forEach(([k,v])=>{
        const blocks=v.tonnes/FEED_BLOCK_T;
        tT+=v.tonnes;tL+=v.loads;tB+=blocks;
        html+=`<tr><td>${escapeHtml(v.label)}</td><td class="num">${v.tonnes.toFixed(2)} t</td><td class="num">${v.loads}</td><td class="num">${fmtBlocks(blocks)}</td></tr>`;
      });
      html+=`<tr class="total-row"><td>Total</td><td class="num">${tT.toFixed(2)} t</td><td class="num">${tL}</td><td class="num">${fmtBlocks(tB)}</td></tr></tbody></table></section>`;
    }
  }

  /* Silo Status */
  html+=`<section><h2>Silo Status</h2><div class="rpt-silo-grid">`;
  [1,2,3,4].forEach(g=>{
    const latest=latestReading(g);
    const bal=currentBalanceKg(g);
    const lo=projectedLeftoverForGroup(g);
    html+=`<div class="rpt-silo-block"><div class="rpt-silo-title">Group ${g}</div>`;
    if(latest){
      const s1=latest.silo1Rings==null?'off':latest.silo1Rings+'r';
      const s2=latest.silo2Rings==null?'off':latest.silo2Rings+'r';
      const s3=latest.silo3Rings==null?'off':latest.silo3Rings+'r';
      html+=`<div class="rpt-shed-line">Last reading: ${fmtShort(dateOnly(latest.date))}</div>
        <div class="rpt-shed-line">Rings: S1 ${s1} · S2 ${s2} · S3 ${s3}</div>
        <div class="rpt-shed-line">Reading total: ${(readingTotalKg(latest)/1000).toFixed(2)} t</div>
        <div class="rpt-shed-line">Projected today: ${bal!=null?fmtFeed(bal):'—'}</div>
        <div class="rpt-shed-line">Leftover at cleanout: ${lo&&lo.balance!=null?fmtFeed(lo.balance):'—'}</div>`;
    } else {
      html+=`<div class="rpt-shed-line" style="font-style:italic;">No silo reading recorded.</div>`;
    }
    html+=`</div>`;
  });
  html+=`</div></section>`;

  /* Per-Shed Detail */
  html+=`<section><h2>Per-Shed Detail</h2>`;
  farmData.sheds.forEach(shed=>{
    const grp=Math.floor((shed.id-1)/2)+1;
    const pred=computePredictions(shed,grp);
    if(!shed.placementDate){
      html+=`<div class="rpt-shed"><div class="rpt-shed-title">Shed ${shed.id}</div><div class="rpt-notplaced">Not placed this batch.</div></div>`;
      return;
    }
    const age=ageInDays(shed,now);
    const live=liveAtStartOfDay(shed,now);
    const mortPct=shed.initialPopulation>0?(Number(shed.mortality||0)/shed.initialPopulation)*100:0;
    const livPct=100-mortPct;
    const chickG=Math.round(shedChickWeight(shed)*1000);
    const customFeedStr=(shed.customFeedKg!=null&&shed.customFeedKg>0)?shed.customFeedKg.toFixed(3)+' kg/bird':'— (standard)';
    html+=`<div class="rpt-shed">
      <div class="rpt-shed-title">Shed ${shed.id}</div>
      <div class="rpt-shed-line">Placed: <strong>${shed.initialPopulation.toLocaleString()}</strong> birds · Placement: ${fmtShort(shed.placementDate)} · Age ${age}d</div>
      <div class="rpt-shed-line">Live: <strong>${live.toLocaleString()}</strong> · Mortality: ${Number(shed.mortality||0).toLocaleString()} (${mortPct.toFixed(2)}%) · Livability: ${livPct.toFixed(2)}%</div>
      <div class="rpt-shed-line">Chick weight: ${chickG} g · Custom feed: ${escapeHtml(customFeedStr)}</div>`;
    const hasGrid=TARGET_DAYS.some(d=>shed.targetCurve&&shed.targetCurve[d]>0);
    const hasSamples=(shed.inYardSamples||[]).length>0;
    if(hasGrid||hasSamples){
      html+=`<div class="rpt-shed-sub">In-Yard Readings</div><table class="rpt-shed-table">
        <thead><tr><th>Day</th><th class="num">Weight</th><th>Source</th></tr></thead><tbody>`;
      TARGET_DAYS.forEach(day=>{
        const v=shed.targetCurve&&shed.targetCurve[day];
        if(v!=null&&Number(v)>0)html+=`<tr><td>Day ${day}</td><td class="num">${Number(v).toFixed(3)} kg</td><td>Shed scale</td></tr>`;
      });
      (shed.inYardSamples||[]).forEach(x=>{
        const a=sampleAge(shed,x);
        html+=`<tr><td>Day ${a}</td><td class="num">${x.avgWeightKg.toFixed(3)} kg</td><td>${x.isOfficial?'Plant weight':'Shed scale'} (extra reading)</td></tr>`;
      });
      html+=`</tbody></table>`;
    }
    const fit=getShedGompertzFit(shed);
    if(fit){
      const nGrid=TARGET_DAYS.filter(d=>shed.targetCurve&&shed.targetCurve[d]>0).length;
      const nCustom=(shed.inYardSamples||[]).length;
      html+=`<div class="rpt-shed-line" style="margin-top:5px;"><strong>AI Growth Curve:</strong> Active — based on chick weight + ${nGrid} check-day reading${nGrid===1?'':'s'}${nCustom>0?' + '+nCustom+' extra reading'+(nCustom===1?'':'s'):''}.</div>`;
    } else if(hasGrid||hasSamples){
      html+=`<div class="rpt-shed-line" style="margin-top:5px;"><strong>Growth Curve:</strong> Adjusted standard (not enough readings for AI fit).</div>`;
    } else {
      html+=`<div class="rpt-shed-line" style="margin-top:5px;"><strong>Growth Curve:</strong> Standard Ross 308 (no shed readings).</div>`;
    }
    const pickups=computeEffectivePickups(shed);
    if(pickups.length>0){
      html+=`<div class="rpt-shed-sub">Pickups</div><table class="rpt-shed-table">
        <thead><tr><th>#</th><th>Date</th><th class="num">Age</th><th class="num">Birds</th><th class="num">Avg wt</th><th class="num">Total wt</th><th>Type</th></tr></thead><tbody>`;
      pickups.forEach((p,i)=>{
        const a=pickupAge(shed,p);
        const isPred=p.__source==='predicted';
        const avg=pickupAvgKg(p);
        const avgStr=avg!=null?avg.toFixed(3)+' kg':(isPred?'—':'est. '+(p.avgWeightKg||0).toFixed(3)+' kg');
        const totalKg=Number(p.birds)*(avg!=null?avg:(p.avgWeightKg||0));
        const totalStr=totalKg>0?Math.round(totalKg).toLocaleString()+' kg':'—';
        const typeStr=isPred?(p.isFinal?'FINAL (predicted)':'Predicted'):'Actual';
        html+=`<tr><td>#${i+1}</td><td>${fmtShort(p.date)}</td><td class="num">Day ${a}</td><td class="num">${Number(p.birds||0).toLocaleString()}</td><td class="num">${avgStr}</td><td class="num">${totalStr}</td><td>${typeStr}</td></tr>`;
      });
      html+=`</tbody></table>`;
    } else {
      html+=`<div class="rpt-shed-line" style="margin-top:5px;font-style:italic;">No pickups recorded.</div>`;
    }
    html+=`<div class="rpt-shed-sub">Estimates</div>
      <div class="rpt-shed-line">Final avg weight: <strong>${pred.estFinalALW.toFixed(3)} kg</strong> · FCR: <strong>${pred.fcr.toFixed(3)}</strong> · cFCR: <strong>${pred.cfcr.toFixed(3)}</strong> · PIF: <strong>${pred.pif.toFixed(2)}</strong></div>
      <div class="rpt-shed-line">Confidence: ${pred.confidence}% ${confidenceLabel(pred.confidence).label}</div>
    </div>`;
  });
  html+=`</section>`;

  /* Signature + Disclaimer */
  html+=`<div class="rpt-signature">
    <div class="rpt-sig">Grower signature</div>
    <div class="rpt-sig">Date</div>
  </div>
  <div class="rpt-disclaimer">
    Prepared by <strong>Von Mangaron</strong>.<br>
    This report was generated by ProdWise.VM — a personal tool.<br>
    Not an official production record.
  </div>`;

  return html;
}
function generateBatchReport(){
  if(!farmData){showToast('Import Excel first.',true);return;}
  const rpt=ensureReportContainer();
  rpt.innerHTML=buildBatchReportHTML();
  const origTitle=document.title;
  const batchLabel=(predState.batchNumber||(farmData&&farmData.batchNumber)||'').trim();
  const safeBatch=batchLabel?batchLabel.replace(/[^a-z0-9\-]/gi,'-'):'batch';
  const dateStr=new Date().toISOString().slice(0,10);
  document.title=`ProdWise-${safeBatch}-${dateStr}`;
  const restore=()=>{document.title=origTitle;window.removeEventListener('afterprint',restore);};
  window.addEventListener('afterprint',restore);
  setTimeout(()=>{window.print();},150);
  setTimeout(restore,60000);
}

function openSiloModal(){
  closeSettingsDrawer();
  siloModalOpenGroups={1:true,2:false,3:false,4:false};
  const m=document.getElementById('siloModal');
  if(m){m.classList.add('open');m.setAttribute('aria-hidden','false');}
  renderSiloModalBody();
}
function closeSiloModal(){
  const m=document.getElementById('siloModal');
  if(m){m.classList.remove('open');m.setAttribute('aria-hidden','true');}
  render();
}
const SILO_GROUP_SHEDS={1:[1,2],2:[3,4],3:[5,6],4:[7,8]};
const SILO_GROUP_COLORS={
  1:'linear-gradient(135deg,#E0A339,#A8721F)',
  2:'linear-gradient(135deg,#B08463,#5E2E22)',
  3:'linear-gradient(135deg,#C9774A,#8F4A28)',
  4:'linear-gradient(135deg,#A89055,#6E5A32)'
};
function renderSiloModalBody(){
  const body=document.getElementById('siloBody');if(!body)return;
  let grandTotalKg=0;
  const groupsHtml=[1,2,3,4].map(g=>{
    const latest=latestReading(g);
    const totalKg=latest?readingTotalKg(latest):0;
    grandTotalKg+=totalKg;
    const shedIds=SILO_GROUP_SHEDS[g];
    const shedsLabel=`Sheds ${shedIds.join(' & ')}`;
    const isOpen=siloModalOpenGroups[g]===true;
    const silosHtml=[1,2,3].map(n=>{
      const rings=latest?latest[`silo${n}Rings`]:null;
      const isOff=(rings===null||rings===undefined||rings==='');
      const kg=ringsToKg(rings);
      const totalStr=isOff?'Off':(kg/1000).toFixed(2)+' t';
      const ringBtns=[0,1,2,3,4,5].map(r=>
        `<button type="button" class="sms-ring-btn${r===rings?' active':''}" data-sms-group="${g}" data-sms-silo="${n}" data-sms-ring="${r}" aria-label="Silo ${n} at ${r} rings, ${(ringsToKg(r)/1000).toFixed(0)} tonnes">${r}</button>`
      ).join('');
      return `<div class="sms-silo-row">
        <div class="sms-silo-head"><span class="sms-silo-name">Silo ${n}</span><span class="sms-silo-total${isOff?' off':''}" id="smsTotal-${g}-${n}">${totalStr}</span></div>
        <div class="sms-ring-group" id="smsRings-${g}-${n}">
          <button type="button" class="sms-ring-btn sms-ring-off${isOff?' active':''}" data-sms-group="${g}" data-sms-silo="${n}" data-sms-ring="off" aria-label="Silo ${n} off">Off</button>
          ${ringBtns}
        </div>
      </div>`;
    }).join('');
    return `<div class="sms-group-section${isOpen?' open':''}" data-sms-section="${g}">
      <div class="sms-group-head" style="background:${SILO_GROUP_COLORS[g]}" data-sms-toggle="${g}" role="button" tabindex="0" aria-expanded="${isOpen?'true':'false'}" aria-label="Toggle Group ${g}">
        <span class="sms-group-caret" aria-hidden="true">▶</span>
        <span class="sms-group-name">Group ${g}</span>
        <span class="sms-group-sub">${shedsLabel}</span>
        <span class="sms-group-total" id="smsGroupTotal-${g}">${(totalKg/1000).toFixed(2)} t</span>
      </div>
      <div class="sms-group-body">${silosHtml}</div>
    </div>`;
  }).join('');
  body.innerHTML=`<div class="sms-date-bar">
      <div class="sms-date-main"><span class="sms-date-label">Recording for</span><span class="sms-date-value">${fmtShort(new Date())}</span></div>
      <span class="sms-date-hint">Tap a group to expand · tap a ring to save</span>
    </div>
    ${groupsHtml}
    <div class="sms-grand-total"><span class="sms-gt-label">Grand total across all groups</span><span class="sms-gt-value" id="smsGrandTotal">${(grandTotalKg/1000).toFixed(2)} t</span></div>
    <div class="sms-actions"><button type="button" class="sms-done-btn" id="siloModalDone">✓ Done</button></div>`;
  body.querySelectorAll('[data-sms-ring]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const g=Number(btn.dataset.smsGroup);
      const n=Number(btn.dataset.smsSilo);
      const raw=btn.dataset.smsRing;
      if(raw==='off')setSiloRingFromModal(g,n,null);
      else{
        const r=Number(raw);
        const latest=latestReading(g);
        const current=latest?latest[`silo${n}Rings`]:null;
        if(current===r)setSiloRingFromModal(g,n,null);
        else setSiloRingFromModal(g,n,r);
      }
    });
  });
  body.querySelectorAll('[data-sms-toggle]').forEach(el=>{
    const toggle=()=>{
      const g=Number(el.dataset.smsToggle);
      if(!Number.isFinite(g))return;
      siloModalOpenGroups[g]=!siloModalOpenGroups[g];
      const section=body.querySelector(`[data-sms-section="${g}"]`);
      if(section)section.classList.toggle('open',siloModalOpenGroups[g]);
      el.setAttribute('aria-expanded',siloModalOpenGroups[g]?'true':'false');
    };
    el.addEventListener('click',toggle);
    el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();}});
  });
  const doneBtn=document.getElementById('siloModalDone');
  if(doneBtn)doneBtn.addEventListener('click',closeSiloModal);
}
function setSiloRingFromModal(group,siloNum,rings){
  if(!siloData[group])siloData[group]={readings:[],deliveries:[]};
  const s=siloData[group];
  const todayIso=iso(new Date());
  let reading=s.readings.find(r=>r.date===todayIso);
  if(!reading){
    const prev=s.readings.length?s.readings[s.readings.length-1]:null;
    reading={date:todayIso,silo1Rings:prev?prev.silo1Rings:null,silo2Rings:prev?prev.silo2Rings:null,silo3Rings:prev?prev.silo3Rings:null};
    s.readings.push(reading);
    s.readings.sort((a,b)=>a.date.localeCompare(b.date));
  }
  const normalized=(rings===null)?null:normalizeRing(rings);
  reading[`silo${siloNum}Rings`]=normalized;
  saveSiloData();schedulePush();
  const ringGroup=document.getElementById(`smsRings-${group}-${siloNum}`);
  if(ringGroup){
    ringGroup.querySelectorAll('.sms-ring-btn').forEach(btn=>{
      const raw=btn.dataset.smsRing;
      if(raw==='off')btn.classList.toggle('active',normalized===null);
      else btn.classList.toggle('active',Number(raw)===normalized);
    });
  }
  const totalEl=document.getElementById(`smsTotal-${group}-${siloNum}`);
  if(totalEl){
    if(normalized===null){totalEl.textContent='Off';totalEl.classList.add('off');}
    else{totalEl.textContent=(ringsToKg(normalized)/1000).toFixed(2)+' t';totalEl.classList.remove('off');}
  }
  const gTotalEl=document.getElementById(`smsGroupTotal-${group}`);
  if(gTotalEl){
    const latest=latestReading(group);
    gTotalEl.textContent=latest?((readingTotalKg(latest)/1000).toFixed(2)+' t'):'0.00 t';
  }
  let totalKg=0;
  [1,2,3,4].forEach(g=>{const latest=latestReading(g);if(latest)totalKg+=readingTotalKg(latest);});
  const gtEl=document.getElementById('smsGrandTotal');
  if(gtEl)gtEl.textContent=(totalKg/1000).toFixed(2)+' t';
}

/* ---------- Main render ---------- */
