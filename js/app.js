document.addEventListener('DOMContentLoaded',()=>{
  applyTheme(loadTheme());
  loadNotifPrefs();
  loadSyncState();
  loadPredState();
  const saved=loadState();if(saved)farmData=saved;
  migrateMortalityAnchors();
  initShedViews();
  const savedSilo=loadSiloData();if(savedSilo)siloData=savedSilo;
  const savedLoads=loadFarmLoads();if(savedLoads)farmLoads=savedLoads;
  // Save + sync any docket weights repaired from kg-in-tonnes entries
  if(loadUnitRepairs>0){saveFarmLoads();setTimeout(()=>{schedulePush();showToast(`Fixed ${loadUnitRepairs} docket weight${loadUnitRepairs===1?'':'s'} that were entered in kg.`);loadUnitRepairs=0;},1500);}
  migrateDeliveriesToLoads();
  loadLoadsView();
  render();
  installFarmKey();
  if(syncFarmName&&syncConnectedAt){if(syncLastSyncAt)pullFromCloud(true).catch(()=>{});else pushToCloud().catch(()=>{});}
  setTimeout(farmKeyCheck,2500);
  if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('sw.js').catch(()=>{});});}

  document.addEventListener('click',e=>{
    if(e.target.closest('[data-fh-add]')){fhFormOpen=true;fhEditId=null;renderSettingsDrawerBody();return;}
    const fkTog=e.target.closest('[data-fk-toggle]');
    if(fkTog){if(fkTog.dataset.fkToggle==='how')fkHowOpen=!fkHowOpen;else fkFeedOpen=!fkFeedOpen;render();return;}
    const dinBtn=e.target.closest('[data-delin]');if(dinBtn){setDeliveryIn(Number(dinBtn.dataset.delin),dinBtn.dataset.val==='1');return;}
    const ssBtn=e.target.closest('[data-silo-set]');
    if(ssBtn){changeSiloSetting(ssBtn.dataset.siloSet,Number(ssBtn.dataset.step));return;}
    const fhTog=e.target.closest('[data-fh-toggle]');
    if(fhTog){const id=fhTog.dataset.fhToggle;fhOpenId=fhOpenId===id?null:id;renderSettingsDrawerBody();return;}
    const fhEdit=e.target.closest('[data-fh-edit]');
    if(fhEdit){fhFormOpen=true;fhEditId=fhEdit.dataset.fhEdit;renderSettingsDrawerBody();const fm=document.querySelector('.fh-form');if(fm)fm.scrollIntoView({block:'nearest'});return;}
    if(e.target.closest('[data-fh-cancel]')){fhFormOpen=false;fhEditId=null;renderSettingsDrawerBody();return;}
    if(e.target.closest('[data-fh-save]')){saveFarmHistoryForm();return;}
    if(e.target.closest('[data-fh-save-loaded]')){saveLoadedBatchToHistory();return;}
    const fhAddCloud=e.target.closest('[data-fh-add-cloud]');
    if(fhAddCloud){addCloudBatchToHistory(fhAddCloud.dataset.fhAddCloud);return;}
    if(e.target.closest('[data-fh-find]')){fhCloud.farm='';findCloudBatchesForHistory();return;}
    const fhDel=e.target.closest('[data-fh-del]');
    if(fhDel){const r=farmHistory().find(x=>x.id===fhDel.dataset.fhDel);if(r&&confirm(`Delete ${r.batch||'this batch'} from Farm history?`)){deleteFarmHistoryRec(r.id);renderSettingsDrawerBody();render();}return;}
    const unitBtn=e.target.closest('[data-feed-unit]');
    if(unitBtn){const u=unitBtn.dataset.feedUnit;if(u!==feedUnit()){setFeedUnit(u);renderSettingsDrawerBody();render();refreshLoadsViews();showToast(`Feed amounts now in ${feedUnitWord()}.`);}return;}
    // Bulk select: checkboxes are handled on 'change'; buttons here
    if(e.target.closest('.bulk-cb,[data-bulk-all],.bulk-all'))return;
    // Adjustments modal (draft — nothing applies until 'Apply changes')
    if(e.target.closest('[data-adj-apply]')){applyAdjDraft();return;}
    if(e.target.closest('[data-adj-use-history]')){const p=historyDensityPrior();if(p&&adjDraft){adjDraft.trig=p.trig;adjDraft.tgt=p.tgt;adjDraft.max=Math.max(28,p.max);if(p.tp)adjDraft.tp=Math.max(MIN_PICKUPS_PER_SHED,Math.min(MAX_PICKUPS_PER_SHED,p.tp));refreshAdjModal(true);showToast('Filled in from your last batches — press Apply changes to use them.');}return;}
    if(e.target.closest('[data-adj-cancel]')){closeAdjModal(false);return;}
    const adjNpd=e.target.closest('[data-adj-npd]');
    if(adjNpd&&adjDraft){const d=Number(adjNpd.dataset.adjNpd);adjDraft.npd=adjDraft.npd.includes(d)?adjDraft.npd.filter(v=>v!==d):[...adjDraft.npd,d].sort((a,b)=>a-b);refreshAdjModal(true);return;}
    const adjSugG=e.target.closest('[data-adj-suggest-global]');
    if(adjSugG&&adjDraft){adjDraft.scale=Number(adjSugG.dataset.adjSuggestGlobal);refreshAdjModal(true);return;}
    const adjSugS=e.target.closest('[data-adj-suggest-shed]');
    if(adjSugS&&adjDraft){adjDraft.ovr[Number(adjSugS.dataset.adjSuggestShed)]=Number(adjSugS.dataset.pct);refreshAdjModal(true);return;}
    // Silo reading time: Morning / Evening
    const rtBtn=e.target.closest('[data-read-time]');
    if(rtBtn){setSiloReadTime(rtBtn.dataset.readTime);if(document.getElementById('siloModal')?.classList.contains('open'))renderSiloModalBody();render();showToast(`Today's readings: ${siloReadTimeLabel(siloReadTime()).toLowerCase()} stock — automatic again tomorrow.`);return;}
    const bulkStartBtn=e.target.closest('[data-bulk-start]');if(bulkStartBtn){bulkStart(bulkStartBtn.dataset.bulkStart);return;}
    if(e.target.closest('[data-bulk-cancel]')){bulkCancel();return;}
    if(e.target.closest('[data-bulk-delete]')){bulkDelete();return;}
    // Alerts bell popover — checked first so any click outside it always closes it
    const alertsPop=document.getElementById('alertsPopover');
    if(alertsPop&&alertsPop.classList.contains('open')&&!e.target.closest('.alerts-bell-wrap')){alertsPop.classList.remove('open');}
    const bellBtn=e.target.closest('#alertsBellBtn');
    if(bellBtn){
      const isOpen=alertsPop.classList.contains('open');
      if(isOpen){alertsPop.classList.remove('open');}
      else{alertsPop.innerHTML=renderAlertsPopoverBody();alertsPop.classList.add('open');}
      return;
    }
    const alertItem=e.target.closest('.alerts-popover [data-tab]');
    if(alertItem){alertsPop.classList.remove('open');}
    const shedAlert=e.target.closest('.alerts-popover [data-alert-shed]');
    if(shedAlert){alertsPop.classList.remove('open');openShedPerformance(Number(shedAlert.dataset.alertShed));return;}
    const feedAlert=e.target.closest('.alerts-popover [data-alert-feed]');
    if(feedAlert){alertsPop.classList.remove('open');openFeedForecast(Number(feedAlert.dataset.alertFeed));return;}
    // Sidebar sync pill buttons
    if(e.target.closest('#sbConnectBtn')){openSyncModal();return;}
    if(e.target.closest('#sbSyncNowBtn')){pullFromCloud(false);return;}
    // Dashboard card shortcut buttons (data-tab handled by tab handler below)
    if(e.target.closest('#siloFromDash')){openSiloModal();return;}
    // Mobile nav extras
    if(e.target.closest('#siloBtnMob')){openSiloModal();return;}
    if(e.target.closest('#feedBtnMob')){openLoadsModal();return;}
    if(e.target.closest('#moreBtnMob')){openMoreSheet();return;}
    if(e.target.closest('[data-more-close]')){closeMoreSheet();return;}
    if(e.target.closest('#moreSheet')){
      const id=e.target.closest('button')?.id;
      const actions={morePickups:openPickupsModal,moreHome:()=>{activeTab='dashboard';render();},moreBatch:openBatchInfoModal,moreLoads:openLoadsModal,moreSilo:openSiloModal,moreHistory:()=>{activeTab='history';render();},moreCluckwise:()=>window.open(CLUCKWISE_URL,'_blank','noopener'),moreNewBatch:openNewBatchModal,moreImport:triggerImport,moreSync:()=>{syncFarmName?pullFromCloud(false):openSyncModal();},moreSettings:openSettingsDrawer,moreProfile:openFarmProfile,morePredict:()=>{activeTab='predictions';render();},moreFarmSettings:()=>{activeTab='farmsettings';render();}};
      if(actions[id]){closeMoreSheet();actions[id]();return;}
    }
    if(e.target.closest('[data-sb-pred]')){toggleSidebarPredictions();return;}
    // CluckWise — can come from sidebar data-tab="cluckwise"
    if(e.target.closest('[data-tab="cluckwise"]')){window.open(CLUCKWISE_URL,'_blank','noopener');return;}
    if(e.target.closest('#cluckwiseBtn')){window.open(CLUCKWISE_URL,'_blank','noopener');return;}
    const themeOpt=e.target.closest('.sb-theme-opt');
    if(themeOpt){setTheme(themeOpt.dataset.themeValue);return;}
    if(e.target.closest('#themeToggle')){toggleTheme();return;}
    if(e.target.closest('#historySaveBtn')){historySaveManual();return;}
    if(e.target.closest('#settingsBtn')){openSettingsDrawer();return;}
    if(e.target.closest('#settingsDrawerClose')){closeSettingsDrawer();return;}
    if(e.target.closest('#settingsScrim')){closeSettingsDrawer();return;}
    if(e.target.closest('#newBatchBtn')){openNewBatchModal();return;}
    if(e.target.closest('#newBatchClose')){closeNewBatchModal();return;}
    if(e.target.closest('#batchHistoryClose')){closeBatchHistoryModal();return;}
    if(e.target.closest('#farmBatchPickerClose')){closeFarmBatchPickerModal();if(!syncConnectedAt){syncFarmName=null;saveSyncState();renderSettingsDrawerBody();render();}return;}
    if(e.target.closest('#syncModalClose')){closeSyncModal();return;}
    if(e.target.closest('#farmFoundClose')){closeFarmFoundModal();return;}
    if(e.target.closest('#manualPickupClose')){closeManualPickupModal();return;}
    if(e.target.closest('#sampleClose')){closeSampleModal();return;}
    if(e.target.closest('#predictedPickupClose')){closePredictedPickupModal();return;}
    if(e.target.closest('#importConflictClose')){closeImportConflictModal();pendingImport=null;return;}
    if(e.target.closest('#importReviewClose')){closeImportReviewModal();return;}
    if(e.target.closest('#importBtn')||e.target.closest('#emptyImportBtn')||e.target.closest('#settingsImportBtn')){triggerImport();return;}
    if(e.target.closest('#emptyConnectBtn')){openSyncModal();return;}

    if(e.target.closest('#settingsConnectBtn')){const inp=document.getElementById('settingsFarmInput');const v=inp?inp.value.trim():'';if(!v){showToast('Enter a farm name.',true);return;}handleConnectFarm(v);return;}
    if(e.target.closest('#settingsSyncNowBtn')){pullFromCloud(false);return;}
    if(e.target.closest('#settingsChangeFarmBtn')){openSettingsChangeFarm();return;}
    if(e.target.closest('#settingsSwitchFarmBtn')){submitSettingsChangeFarm();return;}
    if(e.target.closest('#settingsChangeFarmCancel')){cancelSettingsChangeFarm();return;}
    if(e.target.closest('#settingsDlExcelBtn')){downloadExcelFromCloud();return;}
    if(e.target.closest('#settingsDlBatchBtn')){downloadCurrentBatchAsJson();return;}
    if(e.target.closest('#settingsDisconnectBtn')){disconnectSync();return;}
    if(e.target.closest('#settingsBatchHistoryBtn')){openBatchHistoryModal();return;}
    if(e.target.closest('#settingsReportBtn')){generateBatchReport();return;}

    if(e.target.closest('#pickupsBtn')){openPickupsModal();return;}
    if(e.target.closest('#pickupsClose')||(pickupsModalOpen&&e.target.id==='pickupsModal')){closePickupsModal();return;}
    if(e.target.closest('#loadsBtn')){openLoadsModal();return;}
    if(e.target.closest('[data-batch-info]')){openBatchInfoModal();return;}
    if(e.target.closest('#batchInfoClose')||(batchInfoOpen&&e.target.id==='batchInfoModal')){closeBatchInfoModal();return;}
    if(e.target.closest('#farmProfileClose')||e.target.closest('#fpCancel')||(farmProfileOpen&&e.target.id==='farmProfileModal')){closeFarmProfile();return;}
    if(e.target.closest('#fpSave')){saveFarmProfile();return;}
    if(e.target.closest('#sbFarm')){openFarmProfile();return;}
    if(e.target.closest('#fpSiloClear')){fpSetStart('');return;}
    if(e.target.closest('#loadsClose')){closeLoadsModal();return;}
    if(loadsModalState.open&&e.target.id==='loadsModal'){closeLoadsModal();return;}
        if(e.target.closest('[data-open-loads-modal]')){openLoadsModal();return;}
    if(e.target.closest('#loadModalClose')){closeLoadModal();return;}

    if(e.target.closest('#siloBtn')){openSiloModal();return;}
    if(e.target.closest('#siloClose')){closeSiloModal();return;}
    if(e.target.id==='siloModal'&&document.getElementById('siloModal').classList.contains('open')){closeSiloModal();return;}

    if(feedCompareState.modalOpen&&e.target.id==='compareFeedModal'){closeCompareModal();return;}
    if(e.target.closest('#compareFeedClose')){closeCompareModal();return;}
    if(e.target.closest('#toolsCompareBtn')){openCompareModal();return;}
    const groupCard=e.target.closest('[data-compare-group]');
    if(groupCard){const g=Number(groupCard.dataset.compareGroup);if(Number.isFinite(g)&&g>=1&&g<=4)toggleCompareGroup(g);return;}
    const layoutBtn=e.target.closest('[data-compare-layout]');
    if(layoutBtn){const mode=layoutBtn.dataset.compareLayout;if(['stacked','grid'].includes(mode)){feedCompareState.layoutMode=mode;renderCompareModalBody();}return;}

    const editDelBtn=e.target.closest('[data-edit-delivery]');
    if(editDelBtn){e.stopPropagation();const parts=editDelBtn.dataset.editDelivery.split('|');openLoadModal(parts[1],null);return;}
    const loadEditBtn=e.target.closest('[data-load-edit]');
    if(loadEditBtn){e.stopPropagation();openLoadModal(loadEditBtn.dataset.loadEdit,null);return;}

    if(e.target.closest('[data-toggle-adjustments]')){toggleAdjCollapse();return;}
    if(e.target.closest('[data-global-autofill]')){autoFillAllSheds();return;}
    if(e.target.closest('[data-global-clear-pickups]')){clearAllPredictedPickups();return;}

    const npdBtn=e.target.closest('[data-npd]');
    if(npdBtn){
      const d=Number(npdBtn.dataset.npd);
      if(Number.isInteger(d)&&d>=0&&d<=6){
        const cur=predState.noPickupDays||[];
        if(cur.includes(d))predState.noPickupDays=cur.filter(x=>x!==d);
        else predState.noPickupDays=[...cur,d].sort((a,b)=>a-b);
        savePredState();schedulePush();render();
      }
      return;
    }

    if(e.target.closest('[data-replan-blocked]')){
      if(!farmData){showToast('Import Excel first.',true);return;}
      if(!confirm('Delete all predicted pickups and re-run auto-fill respecting the blocked days?\n\nYour actual pickups are not affected.'))return;
      let regularTotal=0,finalTotal=0,shedsTouched=0;
      farmData.sheds.forEach(s=>{
        if(!s.placementDate)return;
        const generated=autoFillPredictedPickups(s);
        s.predictedPickups=generated;
        regularTotal+=generated.filter(g=>!g.isFinal).length;
        finalTotal+=generated.filter(g=>g.isFinal).length;
        if(generated.length>0)shedsTouched++;
      });
      saveState();schedulePush();render();
      showToast(`✨ Re-planned: ${regularTotal} regular + ${finalTotal} cleanout pickup${(regularTotal+finalTotal)===1?'':'s'} across ${shedsTouched} shed${shedsTouched===1?'':'s'}.`);
      return;
    }

    const delSess=e.target.closest('[data-delete-session]');if(delSess){e.stopPropagation();const [g,id]=delSess.dataset.deleteSession.split('|');deleteReadingSession(Number(g),id);return;}
    const deleteReadingBtn=e.target.closest('[data-delete-reading]');
    if(deleteReadingBtn){e.stopPropagation();const parts=deleteReadingBtn.dataset.deleteReading.split('|');deleteSiloReading(Number(parts[0]),parts[1]);return;}

    const inlineTestBtn=e.target.closest('[data-inline-test]');
    if(inlineTestBtn){e.stopPropagation();const parts=inlineTestBtn.dataset.inlineTest.split('|');const g=Number(parts[0]);const dIso=parts[1];const inlineInput=inlineTestBtn.closest('.inline-del')?.querySelector('.inline-del-input');const amtKg=inlineInput?feedOut(inlineInput.value):NaN;const amt=amtKg/1000;if(!Number.isFinite(amt)||amt<=0){showToast(`Enter a positive amount in ${feedUnitWord()}.`,true);inlineInput&&inlineInput.focus();return;}const ok=addTestDelivery(g,dIso,amt);if(ok){inlineDeliveryState=null;render();}return;}
    const inlineActualBtn=e.target.closest('[data-inline-actual]');
    if(inlineActualBtn){e.stopPropagation();const parts=inlineActualBtn.dataset.inlineActual.split('|');const g=Number(parts[0]);const dIso=parts[1];const inlineInput=inlineActualBtn.closest('.inline-del')?.querySelector('.inline-del-input');const amtKg=inlineInput?feedOut(inlineInput.value):NaN;const amt=amtKg/1000;if(!Number.isFinite(amt)||amt<=0){showToast(`Enter a positive amount in ${feedUnitWord()}.`,true);inlineInput&&inlineInput.focus();return;}// Open Add Load pre-filled (date, tonnes for this pair, last feed type used here) to confirm feed type/split/note
const lastType=nextFeedTypeDue(g)||(loadsAffectingGroup(g).filter(l=>l.feedType).sort((a,b)=>dateOnly(b.date)-dateOnly(a.date))[0]||{}).feedType||'';inlineDeliveryState=null;render();openLoadModal(null,{date:dIso,feedType:lastType,plannedT:amt,splitT:{[g]:amt}});return;}
    const inlineCancelBtn=e.target.closest('[data-inline-cancel]');
    if(inlineCancelBtn){e.stopPropagation();inlineDeliveryState=null;render();return;}

    const removeTestBtn=e.target.closest('[data-remove-test]');
    if(removeTestBtn){e.stopPropagation();const parts=removeTestBtn.dataset.removeTest.split('|');removeTestDelivery(Number(parts[0]),parts[1]);return;}
    const clearTestsBtn=e.target.closest('[data-clear-tests]');
    if(clearTestsBtn){clearTestDeliveries(Number(clearTestsBtn.dataset.clearTests));return;}

    // Test pickups (Live birds cell) — handled before the row's load form
    const tpCommit=e.target.closest('[data-tp-commit]');
    if(tpCommit){e.stopPropagation();const [sid,id]=tpCommit.dataset.tpCommit.split('|');commitTestPickup(Number(sid),id);return;}
    const tpRemove=e.target.closest('[data-tp-remove]');
    if(tpRemove){e.stopPropagation();const [sid,id]=tpRemove.dataset.tpRemove.split('|');removeTestPickup(Number(sid),id);return;}
    const tpClear=e.target.closest('[data-tp-clear]');
    if(tpClear){clearTestPickups(Number(tpClear.dataset.tpClear));return;}
    const tpShed=e.target.closest('[data-tp-shed]');
    if(tpShed){if(inlinePickupState){inlinePickupState.shedId=Number(tpShed.dataset.tpShed);inlinePickupState.userEdited=false;inlinePickupState.birdsDraft='';render();}return;}
    const tpAdd=e.target.closest('[data-tp-add]');
    if(tpAdd){submitInlinePickup(tpAdd.dataset.tpAdd);return;}
    if(e.target.closest('[data-tp-cancel]')){inlinePickupState=null;render();return;}
    if(e.target.closest('.tp-form'))return;
    const tpCell=e.target.closest('[data-tp-cell]');
    if(tpCell){e.stopPropagation();const [g,dIso]=tpCell.dataset.tpCell.split('|');toggleInlinePickup(Number(g),dIso);return;}

    const forecastRow=e.target.closest('[data-forecast-date]');
    if(forecastRow&&!e.target.closest('.inline-del')){
      const g=Number(forecastRow.dataset.forecastGroup);
      const dIso=forecastRow.dataset.forecastDate;
      if(Number.isFinite(g)&&dIso){
        inlinePickupState=null;
        if(inlineDeliveryState&&inlineDeliveryState.group===g&&inlineDeliveryState.dateIso===dIso)inlineDeliveryState=null;
        else inlineDeliveryState={group:g,dateIso:dIso};
        render();
      }
      return;
    }

    const gotoCardBtn=e.target.closest('[data-goto-predcard]');
    if(gotoCardBtn){const shedId=Number(gotoCardBtn.dataset.gotoPredcard);if(!Number.isFinite(shedId))return;const group=Math.floor((shedId-1)/2)+1;const isFirstOfGroup=(shedId%2===1);activeTab='predictions';predState.predGroup=group;predState.predView=isFirstOfGroup?'shed1':'shed2';savePredState();closeCompareModal();render();const card=document.getElementById(`pred-shed-card-${shedId}`);if(card)card.scrollIntoView({behavior:'auto',block:'start'});return;}
    const ppAddBtn=e.target.closest('[data-pp-add]');if(ppAddBtn){openPredictedPickupModal(Number(ppAddBtn.dataset.ppAdd));return;}
    const ppAutofillBtn=e.target.closest('[data-pp-autofill]');if(ppAutofillBtn){autoFillPredictedPickupsForShed(Number(ppAutofillBtn.dataset.ppAutofill));return;}
    const ppClearBtn=e.target.closest('[data-pp-clear]');if(ppClearBtn){clearPredictedPickupsForShed(Number(ppClearBtn.dataset.ppClear));return;}
    const ppEditBtn=e.target.closest('[data-pp-edit]');if(ppEditBtn){const parts=ppEditBtn.dataset.ppEdit.split('|');openPredictedPickupModal(Number(parts[0]),parts[1]);return;}
    const adoptBtn=e.target.closest('[data-pp-adopt-auto]');if(adoptBtn){adoptAutoPlan(Number(adoptBtn.dataset.ppAdoptAuto));return;}
    const ppDeleteBtn=e.target.closest('[data-pp-delete]');if(ppDeleteBtn){const parts=ppDeleteBtn.dataset.ppDelete.split('|');deletePredictedPickup(Number(parts[0]),parts[1]);return;}

    const cycleApply=e.target.closest('[data-pred-cycle-apply]');
    if(cycleApply){const bar=cycleApply.closest('.pred-daily-range-bar');if(bar){const sEl=bar.querySelector('[data-pred-cycle="start"]');const eEl=bar.querySelector('[data-pred-cycle="end"]');if(sEl&&eEl)setPredDailyCycle(sEl.value,eEl.value);}return;}
    const gotoBtn=e.target.closest('[data-goto-predpickup]');
    if(gotoBtn){const shedId=Number(gotoBtn.dataset.gotoPredpickup);if(!Number.isFinite(shedId))return;const group=Math.floor((shedId-1)/2)+1;const isFirstOfGroup=(shedId%2===1);activeTab='predictions';predState.predGroup=group;predState.predView=isFirstOfGroup?'shed1':'shed2';savePredState();closeCompareModal();render();const card=document.getElementById(`pred-shed-card-${shedId}`);if(card)card.scrollIntoView({behavior:'auto',block:'start'});openManualPickupModal(shedId);return;}
    const sampleAddBtn=e.target.closest('[data-sample-add]');if(sampleAddBtn){openSampleModal(Number(sampleAddBtn.dataset.sampleAdd));return;}
    const sampleEditBtn=e.target.closest('[data-sample-edit]');if(sampleEditBtn){const parts=sampleEditBtn.dataset.sampleEdit.split('|');openSampleModal(Number(parts[0]),Number(parts[1]));return;}
    const sampleDelBtn=e.target.closest('[data-sample-delete]');if(sampleDelBtn){const parts=sampleDelBtn.dataset.sampleDelete.split('|');deleteSample(Number(parts[0]),Number(parts[1]));return;}
    const pkv=e.target.closest('[data-pk-view]');if(pkv){pkView=pkv.dataset.pkView;try{localStorage.setItem('pw-pk-view',pkView);}catch(_){}pkAddDate=null;refreshPickupsModal();return;}
    const pkm=e.target.closest('[data-pkc-month]');if(pkm){const n=Number(pkm.dataset.pkcMonth);const t=dateOnly(new Date());pkMonth=n===0?new Date(t.getFullYear(),t.getMonth(),1):new Date(pkMonth.getFullYear(),pkMonth.getMonth()+n,1);pkAddDate=null;refreshPickupsModal();return;}
    const pka=e.target.closest('[data-pkc-add]');if(pka){pkAddDate=pka.dataset.pkcAdd||null;refreshPickupsModal();return;}
    const pks=e.target.closest('[data-pkc-shed]');if(pks){const [sh,d]=pks.dataset.pkcShed.split('|');pkAddDate=null;openManualPickupModal(Number(sh),null,d);refreshPickupsModal();return;}
    const addPickupBtn=e.target.closest('[data-pickup-add]');if(addPickupBtn){openManualPickupModal(Number(addPickupBtn.dataset.pickupAdd));return;}
    const actionsBtn=e.target.closest('[data-pickup-actions-btn]');
    if(actionsBtn){e.stopPropagation();const wrap=actionsBtn.closest('.pickup-actions');const wasOpen=wrap.classList.contains('open');closeAllPickupActionsMenus();if(!wasOpen)openPickupActionsMenu(wrap);return;}
    const editBtn=e.target.closest('[data-pickup-edit]');if(editBtn){closeAllPickupActionsMenus();const parts=editBtn.dataset.pickupEdit.split('|');openManualPickupModal(Number(parts[0]),parts[1]);return;}
    const revertBtn=e.target.closest('[data-pickup-revert]');if(revertBtn){closeAllPickupActionsMenus();const parts=revertBtn.dataset.pickupRevert.split('|');revertPickupTotalWeight(Number(parts[0]),parts[1]);return;}
    const deleteBtn=e.target.closest('[data-pickup-delete]');if(deleteBtn){closeAllPickupActionsMenus();const parts=deleteBtn.dataset.pickupDelete.split('|');deleteManualPickup(Number(parts[0]),parts[1]);return;}
    closeAllPickupActionsMenus();

    const pg=e.target.closest('[data-predgroup]');if(pg){if(pg.closest('.sidebar')){activeTab='predictions';sbPredOpen=true;}setPredGroup(Number(pg.dataset.predgroup));return;}
    const gsg=e.target.closest('[data-goto-shedgroup]');if(gsg){const g=Number(gsg.dataset.gotoShedgroup);const v=['shed1','shed2','both'].includes(predState.predView)?predState.predView:'shed1';shedViewByGroup[g]=v;saveShedViews();activeTab='g'+g;render();window.scrollTo(0,0);return;}
    if(e.target.closest('#dcoSetAllBtn')){const inp=document.getElementById('dcoSetAllDate');if(!inp||!inp.value){showToast('Pick a date first.',true);if(inp)inp.focus();return;}setAllCleanoutDates(inp.value);return;}
    const sld=e.target.closest('[data-sl-day]');if(sld){const [g,d]=sld.dataset.slDay.split('|');siloLevelSel[g]=d;render();return;}
    const sts=e.target.closest('[data-starter-silo]');if(sts){const [g,n]=sts.dataset.starterSilo.split('|').map(Number);predState.starterSilo={...(predState.starterSilo||{}),[g]:predState.starterSilo&&predState.starterSilo[g]===n?null:n};savePredState();schedulePush();render();showToast(predState.starterSilo[g]?`Silo ${siloNumber(g,n)} kept for next batch's Starter.`:'Starter silo cleared.');return;}
    const sbf=e.target.closest('[data-starter-buf]');if(sbf){predState.starterBufferDays=Number(sbf.dataset.starterBuf);savePredState();schedulePush();render();return;}
    const sos=e.target.closest('[data-silo-open-set]');if(sos){const [g,n,v]=sos.dataset.siloOpenSet.split('|').map(Number);setSiloOpen(g,n,v===1);return;}
    const gpg=e.target.closest('[data-goto-predgroup]');if(gpg){activeTab='predictions';setPredGroup(Number(gpg.dataset.gotoPredgroup));window.scrollTo(0,0);return;}
    if(e.target.closest('#vdockToggle')){viewDockOpen=!viewDockOpen;groupDockOpen=false;const d=document.getElementById('vdock');if(d)d.classList.toggle('open',viewDockOpen);const g=document.getElementById('gdock');if(g)g.classList.remove('open');return;}
    if(viewDockOpen&&(!e.target.closest('#vdock')||e.target.closest('[data-vdock-close]'))){viewDockOpen=false;const d=document.getElementById('vdock');if(d)d.classList.remove('open');}
    if(e.target.closest('.vdock-item')){viewDockOpen=false;const d=document.getElementById('vdock');if(d)d.classList.remove('open');}
    if(e.target.closest('#gdockToggle')){viewDockOpen=false;const vd=document.getElementById('vdock');if(vd)vd.classList.remove('open');groupDockOpen=!groupDockOpen;const d=document.getElementById('gdock');if(d)d.classList.toggle('open',groupDockOpen);e.target.closest('#gdockToggle').setAttribute('aria-expanded',String(groupDockOpen));return;}
    if(groupDockOpen&&(!e.target.closest('#gdock')||e.target.closest('[data-gdock-close]'))){groupDockOpen=false;const d=document.getElementById('gdock');if(d)d.classList.remove('open');}
    if(e.target.closest('.gdock-item')){groupDockOpen=false;}
    const pv=e.target.closest('[data-predview]');if(pv){setPredView(pv.dataset.predview);return;}
    const toggleDel=e.target.closest('[data-toggle-deliveries]');
    if(toggleDel){predState.deliveriesOpen=!(predState.deliveriesOpen!==false);savePredState();schedulePush();render();return;}

    const ringBtn=e.target.closest('.ring-btn, .ring-off');
    if(ringBtn){
      const g=Number(ringBtn.dataset.siloGroup);const n=Number(ringBtn.dataset.siloNum);const raw=ringBtn.dataset.siloRing;
      if(Number.isFinite(g)&&Number.isFinite(n)){
        if(raw==='off')setSiloRingsForToday(g,n,null);
        else{const r=Number(raw);const latest=latestReading(g);const current=latest?latest[`silo${n}Rings`]:null;if(current===r)setSiloRingsForToday(g,n,null);else setSiloRingsForToday(g,n,r);}
      }
      return;
    }
    const stab=e.target.closest('[data-shedview][data-group]');
    if(stab){const g=Number(stab.dataset.group);const view=stab.dataset.shedview;if(g&&view)setShedView(g,view);return;}

    const pill=e.target.closest('.fpill');
    if(pill){
      const shedVal=pill.dataset.days;const siloVal=pill.dataset.silodays;const predVal=pill.dataset.preddays;
      if(shedVal){const[s,en]=shedVal.split(',').map(Number);if(Number.isFinite(s)&&Number.isFinite(en)){shedRange={start:s,end:en};schedulePush();render();}}
      else if(siloVal){const[s,en]=siloVal.split(',').map(Number);if(Number.isFinite(s)&&Number.isFinite(en)){siloRange={start:s,end:en};schedulePush();render();}}
      else if(predVal){const[s,en]=predVal.split(',').map(Number);if(Number.isFinite(s)&&Number.isFinite(en))setPredDailyPreset(s,en);}
      return;
    }
    const tabBtn=e.target.closest('[data-tab]');
    if(tabBtn){const t=tabBtn.dataset.tab;if(t&&t!=='cluckwise'){activeTab=t;inlineDeliveryState=null;inlinePickupState=null;bulkSel=null;if(feedCompareState.modalOpen)closeCompareModal();render();}return;}
  });

  document.addEventListener('keydown',e=>{
        if(e.key==='Escape'){
      if(farmProfileOpen){closeFarmProfile();return;}
      if(bulkSel){bulkCancel();return;}
      if(inlinePickupState){inlinePickupState=null;render();return;}
      if(inlineDeliveryState){inlineDeliveryState=null;render();return;}
      if(adjModalOpen){toggleAdjCollapse();return;}
      if(moreSheetOpen){closeMoreSheet();return;}
      if(document.getElementById('siloModal').classList.contains('open')){closeSiloModal();return;}
      if(batchInfoOpen){closeBatchInfoModal();return;}
      if(pickupsModalOpen){closePickupsModal();return;}
      if(loadsModalState.open){closeLoadsModal();return;}
      if(feedCompareState.modalOpen){closeCompareModal();return;}
      if(settingsDrawerOpen){closeSettingsDrawer();return;}
    }
    if(e.key==='Enter'&&e.target.id==='settingsSwitchFarmInput'){e.preventDefault();submitSettingsChangeFarm();return;}
    // Enter in the test-pickup field = the form's primary action
    if(e.key==='Enter'&&e.target.classList&&e.target.classList.contains('tp-input')){e.preventDefault();const p=e.target.closest('.tp-form')?.querySelector('.tp-btn.primary');if(p)p.click();return;}
    if(e.key==='Enter'&&e.target.classList&&e.target.classList.contains('inline-del-input')){
      e.preventDefault();
      const form=e.target.closest('.inline-del');
      if(form){const testBtn=form.querySelector('[data-inline-test]');if(testBtn)testBtn.click();}
    }
  });

  document.getElementById('excelFile').addEventListener('change',e=>{const f=e.target.files&&e.target.files[0];if(f)handleFile(f);});
  document.getElementById('batchNumber').addEventListener('change',e=>{setBatchNumber(e.target.value);});
  document.getElementById('batchNumber').addEventListener('blur',e=>{const want=predState.batchNumber||(farmData?farmData.batchNumber:'')||'';e.target.value=want;});
  document.getElementById('syncScrim').addEventListener('click',()=>{
    closeSyncModal();closeFarmFoundModal();closeNewBatchModal();closeBatchHistoryModal();closeFarmBatchPickerModal();
    closeManualPickupModal();closeSampleModal();closePredictedPickupModal();closeImportConflictModal();closeImportReviewModal();closeLoadModal();
  });

  document.addEventListener('change',e=>{
    const t=e.target;
    // Adjustments modal: per-shed 'Use global' switch (draft)
    if(t.dataset&&t.dataset.adjUseglobal&&adjDraft){const id=Number(t.dataset.adjUseglobal);if(t.checked)adjDraft.ovr[id]=null;else{const own=suggestScaleCorrection([farmData.sheds[id-1]]);adjDraft.ovr[id]=own?Math.round(own.value*1000)/10:adjDraft.scale;}refreshAdjModal(true);return;}
    // Carry-over from last batch (Feed Loads)
    if(t.dataset&&t.dataset.carryoverTotal){setCarryoverTotal((feedOut(t.value)||0)/1000);refreshLoadsViews();render();showToast(`↩ Carried over from last batch: ${fmtFeed(carryoverTotalKg())}.`);return;}
    // Bulk select checkboxes
    if(t.classList&&t.classList.contains('bulk-cb')){bulkToggle(t.dataset.bulkId,t.checked);return;}
    if(t.dataset&&t.dataset.bulkAll){bulkToggleAll((t.dataset.bulkIds||'').split('\u001f').filter(Boolean),t.checked);return;}
    if(t.dataset&&t.dataset.compareCol){toggleCompareColumn(t.dataset.compareCol);return;}
    if(t.dataset&&t.dataset.predCycle){const bar=t.closest('.pred-daily-range-bar');if(bar){const sEl=bar.querySelector('[data-pred-cycle="start"]');const eEl=bar.querySelector('[data-pred-cycle="end"]');if(sEl&&eEl)setPredDailyCycle(sEl.value,eEl.value);}return;}
    if(t.dataset&&t.dataset.mortrateShed!==undefined){const sid=Number(t.dataset.mortrateShed);const val=Number(t.value);if(Number.isFinite(sid)&&sid>=1&&sid<=SHED_COUNT&&Number.isFinite(val))setShedMortRate(sid,val);return;}
    if(t.dataset&&t.dataset.shedTargetPickups){setShedTargetPickups(Number(t.dataset.shedTargetPickups),t.value);return;}
    if(t.dataset&&t.dataset.densityUseGlobal){setShedDensityOverride(Number(t.dataset.densityUseGlobal),'useGlobal',t.checked);return;}
    if(t.dataset&&t.dataset.densityOverride){const parts=t.dataset.densityOverride.split('|');setShedDensityOverride(Number(parts[0]),parts[1],t.value);return;}
    if(t.id==='densityTrigger'){setDensityGlobal('triggerDensity',t.value);return;}
    if(t.id==='densityTarget'){setDensityGlobal('targetDensity',t.value);return;}
    if(t.id==='densityMax'){setDensityGlobal('maxDensity',t.value);return;}
    if(t.id==='targetPickupsGlobal'){setDensityGlobal('targetPickups',t.value);return;}
    if(t.dataset&&t.dataset.targetShed!==undefined&&t.dataset.targetDay!==undefined){setTargetCurveValue(Number(t.dataset.targetShed),Number(t.dataset.targetDay),t.value);return;}
    if(t.dataset&&t.dataset.pickupShed!==undefined&&t.dataset.pickupDate){if(t.dataset.pickupField==='birds')setPickupBirds(Number(t.dataset.pickupShed),t.dataset.pickupDate,t.value);else if(t.dataset.pickupField==='avg'){setPickupAvgWeight(Number(t.dataset.pickupShed),t.dataset.pickupDate,t.value);refreshPickupsModal();}else{setPickupTotalWeight(Number(t.dataset.pickupShed),t.dataset.pickupDate,t.value);refreshPickupsModal();}return;}
    if(t.id&&t.id.startsWith('predTargetWeight_')){const g=Number(t.id.replace('predTargetWeight_',''));setTargetHarvestWeight(g,t.value);return;}
    if(t.id==='predBetaSlider'){setPredBeta(t.value);scheduleRender(60);return;}
    if(t.id==='predBetaNumber'){setPredBeta(t.value);scheduleRender(60);return;}
    if(t.id==='biasSlider'||t.id==='biasNumber'){scheduleRender(60);return;}
    if(t.dataset&&t.dataset.customrangeCtx&&t.dataset.customrangeBound){
      const ctx=t.dataset.customrangeCtx;const bound=t.dataset.customrangeBound;
      const val=Number(t.value);if(!Number.isFinite(val))return;
      const clamped=Math.max(-90,Math.min(90,Math.floor(val)));
      const range=ctx==='shed'?{...shedRange}:{...siloRange};
      range[bound]=clamped;
      if(range.start>range.end)return;
      if(ctx==='shed')shedRange=range;else siloRange=range;
      schedulePush();render();
      return;
    }
    if(t.id==='fpSiloFrom'){fpSetStart(t.value);return;}
    if(t.id==='fpSiloTo'){const v=String(t.value).trim();fpSetStart(v===''?'':Number(v)-11);return;}
    if(t.id==='notifShedPerf'){setNotifPref('shedPerformance',t.checked);return;}
    if(t.id==='notifFeedBalance'){setNotifPref('feedBalance',t.checked);return;}
    if(t instanceof HTMLInputElement&&t.dataset&&t.dataset.shed!==undefined&&t.dataset.field){updateShedField(Number(t.dataset.shed),t.dataset.field,t.value);}
  });

  document.addEventListener('input',e=>{
    if(e.target&&e.target.id==='settingsDisplayName'){setFarmDisplayName(e.target.value);return;}
    if(e.target&&e.target.id==='fpFarmName'){fpSetName(e.target.value);return;}
    // Adjustments modal fields update the draft only (no render → no re-pop)
    if(e.target&&e.target.dataset&&e.target.dataset.adj&&adjDraft){
      const f=e.target.dataset.adj;const v=Number(e.target.value);if(!Number.isFinite(v))return;
      adjDraft[f]=v;
      document.querySelectorAll(`#adjModalRoot [data-adj="${f}"]`).forEach(el=>{if(el!==e.target)el.value=f==='beta'?v.toFixed(3):v;});
      if(f==='scale')document.querySelectorAll('#adjModalRoot .adj-shed-val.muted').forEach(el=>el.textContent=v.toFixed(1)+'%');
      refreshAdjModal(false);return;
    }
    if(e.target&&e.target.dataset&&e.target.dataset.adjOverride&&adjDraft){const v=Number(e.target.value);if(Number.isFinite(v)&&v>0){adjDraft.ovr[Number(e.target.dataset.adjOverride)]=v;refreshAdjModal(false);}return;}
    if(e.target&&e.target.id==='settingsSwitchFarmInput'){settingsChangeFarmDraft=e.target.value;return;}
    // Typing a bird count overrides the density recommendation (empty = back to auto)
    if(e.target&&e.target.classList&&e.target.classList.contains('tp-input')&&inlinePickupState){const v=e.target.value.trim();inlinePickupState.userEdited=v!=='';inlinePickupState.birdsDraft=v;e.target.closest('.tp-form')?.querySelectorAll('.tp-btn-n').forEach(n=>n.hidden=inlinePickupState.userEdited);return;}
    const t=e.target;
    if(t.dataset&&t.dataset.mortrateShed!==undefined){const sid=t.dataset.mortrateShed;const slider=document.getElementById(`mortRateSlider_${sid}`);const num=document.getElementById(`mortRateNum_${sid}`);if(t===slider&&num)num.value=t.value;else if(t===num&&slider)slider.value=t.value;return;}
    if(t.id==='predBetaSlider'){const num=document.getElementById('predBetaNumber');if(num)num.value=Number(t.value).toFixed(3);setPredBeta(t.value);const chip=document.getElementById('adjChipBeta');if(chip)chip.innerHTML=`cFCR β <strong>${Number(t.value).toFixed(3)}</strong>`;return;}
    if(t.id==='predBetaNumber'){const slider=document.getElementById('predBetaSlider');if(slider)slider.value=t.value;setPredBeta(t.value);const chip=document.getElementById('adjChipBeta');if(chip)chip.innerHTML=`cFCR β <strong>${Number(t.value).toFixed(3)}</strong>`;return;}
    if(t.id==='farmFeedOverride'){setFarmFeedOverride(t.value);t.classList.toggle('manual',predState.farmFeedOverride!=null);updateFarmKpiValues();return;}
    if(t.id==='farmLeftoverInput'){setFarmLeftover(t.value);t.classList.toggle('manual',predState.farmLeftoverKg!=null&&predState.farmLeftoverKg>0);updateFarmKpiValues();return;}
    if(t.id==='biasSlider'){const num=document.getElementById('biasNumber');if(num)num.value=t.value;const v=Number(t.value);if(Number.isFinite(v))setBiasFactor(v/100);const chip=document.getElementById('adjChipScale');if(chip)chip.innerHTML=`Scale <strong>${t.value}%</strong>`;return;}
    if(t.id==='biasNumber'){const slider=document.getElementById('biasSlider');if(slider)slider.value=t.value;const v=Number(t.value);if(Number.isFinite(v))setBiasFactor(v/100);const chip=document.getElementById('adjChipScale');if(chip)chip.innerHTML=`Scale <strong>${t.value}%</strong>`;return;}
    if(t.id==='densityTrigger'||t.id==='densityTarget'){const chip=document.getElementById('adjChipDensity');if(chip){const dg=predState.densityGlobal||{...DEFAULT_DENSITY_GLOBAL};const trig=t.id==='densityTrigger'?t.value:dg.triggerDensity;const targ=t.id==='densityTarget'?t.value:dg.targetDensity;chip.innerHTML=`Density <strong>${trig}/${targ}</strong>`;}return;}
    if(t.id==='targetPickupsGlobal'){const chip=document.getElementById('adjChipPickups');if(chip)chip.innerHTML=`Pickups <strong>${t.value}</strong>`;return;}
    if(t.dataset&&t.dataset.shed!==undefined&&t.dataset.field==='mortality'){liveUpdateShedMortality(Number(t.dataset.shed),t.value);return;}
  });

  document.addEventListener('scroll',()=>{closeAllPickupActionsMenus();},{capture:true,passive:true});
  window.addEventListener('resize',()=>{closeAllPickupActionsMenus();});

  document.addEventListener('visibilitychange',async()=>{
    if(document.visibilityState==='hidden'){flushPendingPush();}
    else if(document.visibilityState==='visible'){
      if(syncFarmName&&syncConnectedAt){
        if(syncLastSyncAt){await pullFromCloud(true).catch(()=>{});if(pushPending)runScheduledPush();}
        else{await pushToCloud().catch(()=>{});}
      }
    }
  });
  window.addEventListener('pagehide',flushPendingPush);
  window.addEventListener('beforeunload',flushPendingPush);
});

// ── Farm passwords: ProdWise signs in once with the manager password (see js/farmkey.js) ──
let pwFarmKeyInfo=null;
function installFarmKey(){
  if(!window.FarmKey)return;
  FarmKey.install({server:SYNC_WORKER_URL,urls:()=>[SYNC_WORKER_URL],farm:()=>syncFarmName,role:'manager',
    text:k=>({wrong:'That password is not right.',wait:'Too many tries. Wait 15 minutes and try again.',noSetup:'This farm has no passwords yet.',offline:'No connection. Try again when you have signal.'})[k],
    onRefused:j=>farmKeyPrompt(j)});
}
function farmKeyPrompt(j){
  if(!syncFarmName||!window.FarmKey)return;
  FarmKey.prompt({title:`Sign in to ${syncFarmName}`,
    text:j&&j.needKey?'This farm is locked. Enter the manager password once on this device to keep syncing.':j&&j.signedOut?'This device was signed out of the farm. Enter the manager password to sync again.':'This farm now uses passwords. Enter the manager password once on this device.',
    label:'Manager password',button:'Sign in',later:j?null:'Later',
    onSubmit:async pw=>{const e=await FarmKey.signIn(syncFarmName,pw,'ProdWise');if(e)return e;showToast('Signed in. Syncing…');try{renderSettingsDrawerBody();}catch(x){}pullFromCloud(true).catch(()=>{});return null;}});
}
// Once a day: if the farm uses passwords and this device isn't signed in yet, ask (with "Later").
async function farmKeyCheck(){
  if(!window.FarmKey||!syncFarmName||!syncConnectedAt||!navigator.onLine)return;
  pwFarmKeyInfo=await FarmKey.info(syncFarmName);
  try{renderSettingsDrawerBody();}catch(e){}
  if(!pwFarmKeyInfo||!pwFarmKeyInfo.setup||FarmKey.get(syncFarmName,'manager'))return;
  const k='pw-farmkey-asked-'+FarmKey.slug(syncFarmName),today=new Date().toISOString().slice(0,10);
  try{if(localStorage.getItem(k)===today)return;localStorage.setItem(k,today);}catch(e){}
  farmKeyPrompt(null);
}
