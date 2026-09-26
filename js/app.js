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
  migrateDeliveriesToLoads();
  loadLoadsView();
  render();
  if(syncFarmName&&syncConnectedAt){if(syncLastSyncAt)pullFromCloud(true).catch(()=>{});else pushToCloud().catch(()=>{});}
  if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('sw.js').catch(()=>{});});}

  document.addEventListener('click',e=>{
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
    // Sidebar sync pill buttons
    if(e.target.closest('#sbConnectBtn')){openSyncModal();return;}
    if(e.target.closest('#sbSyncNowBtn')){pullFromCloud(false);return;}
    // Dashboard card shortcut buttons (data-tab handled by tab handler below)
    if(e.target.closest('#siloFromDash')){openSiloModal();return;}
    // Mobile nav extras
    if(e.target.closest('#loadsBtnMob')){openLoadsModal();return;}
    if(e.target.closest('#settingsBtnMob')){openSettingsDrawer();return;}
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
    if(e.target.closest('#settingsChangeFarmBtn')){openSyncModal();return;}
    if(e.target.closest('#settingsDlExcelBtn')){downloadExcelFromCloud();return;}
    if(e.target.closest('#settingsDlBatchBtn')){downloadCurrentBatchAsJson();return;}
    if(e.target.closest('#settingsDisconnectBtn')){disconnectSync();return;}
    if(e.target.closest('#settingsBatchHistoryBtn')){openBatchHistoryModal();return;}
    if(e.target.closest('#settingsReportBtn')){generateBatchReport();return;}

    if(e.target.closest('#loadsBtn')){openLoadsModal();return;}
    if(e.target.closest('#loadsClose')){closeLoadsModal();return;}
    if(loadsModalState.open&&e.target.id==='loadsModal'){closeLoadsModal();return;}
        if(e.target.closest('[data-open-loads-modal]')){openLoadsModal();return;}
    if(e.target.closest('#loadModalClose')){closeLoadModal();return;}

    if(e.target.closest('#siloBtn')){openSiloModal();return;}
    if(e.target.closest('#siloClose')){closeSiloModal();return;}
    if(e.target.id==='siloModal'&&document.getElementById('siloModal').classList.contains('open')){closeSiloModal();return;}

    if(feedCompareState.modalOpen&&e.target.id==='compareFeedModal'){closeCompareModal();return;}
    if(e.target.closest('#compareFeedClose')){closeCompareModal();return;}
    if(e.target.closest('#compareFeedBtn')){openCompareModal();return;}
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

    const deleteReadingBtn=e.target.closest('[data-delete-reading]');
    if(deleteReadingBtn){e.stopPropagation();const parts=deleteReadingBtn.dataset.deleteReading.split('|');deleteSiloReading(Number(parts[0]),parts[1]);return;}

    const inlineTestBtn=e.target.closest('[data-inline-test]');
    if(inlineTestBtn){e.stopPropagation();const parts=inlineTestBtn.dataset.inlineTest.split('|');const g=Number(parts[0]);const dIso=parts[1];const inlineInput=inlineTestBtn.closest('.inline-del')?.querySelector('.inline-del-input');const amt=inlineInput?Number(inlineInput.value):NaN;if(!Number.isFinite(amt)||amt<=0){showToast('Enter a positive amount in tonnes.',true);inlineInput&&inlineInput.focus();return;}const ok=addTestDelivery(g,dIso,amt);if(ok){inlineDeliveryState=null;render();}return;}
    const inlineActualBtn=e.target.closest('[data-inline-actual]');
    if(inlineActualBtn){e.stopPropagation();const parts=inlineActualBtn.dataset.inlineActual.split('|');const g=Number(parts[0]);const dIso=parts[1];const inlineInput=inlineActualBtn.closest('.inline-del')?.querySelector('.inline-del-input');const amt=inlineInput?Number(inlineInput.value):NaN;if(!Number.isFinite(amt)||amt<=0){showToast('Enter a positive amount in tonnes.',true);inlineInput&&inlineInput.focus();return;}const res=createSingleGroupLoadFromInline(g,dIso,amt);if(res&&res.__error){showToast('Could not save load.',true);return;}inlineDeliveryState=null;updateLoadsDot();render();showToast(`✅ Load of ${amt} t added for Group ${g}.`);return;}
    const inlineCancelBtn=e.target.closest('[data-inline-cancel]');
    if(inlineCancelBtn){e.stopPropagation();inlineDeliveryState=null;render();return;}

    const removeTestBtn=e.target.closest('[data-remove-test]');
    if(removeTestBtn){e.stopPropagation();const parts=removeTestBtn.dataset.removeTest.split('|');removeTestDelivery(Number(parts[0]),parts[1]);return;}
    const clearTestsBtn=e.target.closest('[data-clear-tests]');
    if(clearTestsBtn){clearTestDeliveries(Number(clearTestsBtn.dataset.clearTests));return;}

    const forecastRow=e.target.closest('[data-forecast-date]');
    if(forecastRow&&!e.target.closest('.inline-del')){
      const g=Number(forecastRow.dataset.forecastGroup);
      const dIso=forecastRow.dataset.forecastDate;
      if(Number.isFinite(g)&&dIso){
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
    const ppDeleteBtn=e.target.closest('[data-pp-delete]');if(ppDeleteBtn){const parts=ppDeleteBtn.dataset.ppDelete.split('|');deletePredictedPickup(Number(parts[0]),parts[1]);return;}

    const cycleApply=e.target.closest('[data-pred-cycle-apply]');
    if(cycleApply){const bar=cycleApply.closest('.pred-daily-range-bar');if(bar){const sEl=bar.querySelector('[data-pred-cycle="start"]');const eEl=bar.querySelector('[data-pred-cycle="end"]');if(sEl&&eEl)setPredDailyCycle(sEl.value,eEl.value);}return;}
    const gotoBtn=e.target.closest('[data-goto-predpickup]');
    if(gotoBtn){const shedId=Number(gotoBtn.dataset.gotoPredpickup);if(!Number.isFinite(shedId))return;const group=Math.floor((shedId-1)/2)+1;const isFirstOfGroup=(shedId%2===1);activeTab='predictions';predState.predGroup=group;predState.predView=isFirstOfGroup?'shed1':'shed2';savePredState();closeCompareModal();render();const card=document.getElementById(`pred-shed-card-${shedId}`);if(card)card.scrollIntoView({behavior:'auto',block:'start'});openManualPickupModal(shedId);return;}
    const sampleAddBtn=e.target.closest('[data-sample-add]');if(sampleAddBtn){openSampleModal(Number(sampleAddBtn.dataset.sampleAdd));return;}
    const sampleEditBtn=e.target.closest('[data-sample-edit]');if(sampleEditBtn){const parts=sampleEditBtn.dataset.sampleEdit.split('|');openSampleModal(Number(parts[0]),Number(parts[1]));return;}
    const sampleDelBtn=e.target.closest('[data-sample-delete]');if(sampleDelBtn){const parts=sampleDelBtn.dataset.sampleDelete.split('|');deleteSample(Number(parts[0]),Number(parts[1]));return;}
    const addPickupBtn=e.target.closest('[data-pickup-add]');if(addPickupBtn){openManualPickupModal(Number(addPickupBtn.dataset.pickupAdd));return;}
    const actionsBtn=e.target.closest('[data-pickup-actions-btn]');
    if(actionsBtn){e.stopPropagation();const wrap=actionsBtn.closest('.pickup-actions');const wasOpen=wrap.classList.contains('open');closeAllPickupActionsMenus();if(!wasOpen)openPickupActionsMenu(wrap);return;}
    const editBtn=e.target.closest('[data-pickup-edit]');if(editBtn){closeAllPickupActionsMenus();const parts=editBtn.dataset.pickupEdit.split('|');openManualPickupModal(Number(parts[0]),parts[1]);return;}
    const revertBtn=e.target.closest('[data-pickup-revert]');if(revertBtn){closeAllPickupActionsMenus();const parts=revertBtn.dataset.pickupRevert.split('|');revertPickupTotalWeight(Number(parts[0]),parts[1]);return;}
    const deleteBtn=e.target.closest('[data-pickup-delete]');if(deleteBtn){closeAllPickupActionsMenus();const parts=deleteBtn.dataset.pickupDelete.split('|');deleteManualPickup(Number(parts[0]),parts[1]);return;}
    closeAllPickupActionsMenus();

    const pg=e.target.closest('[data-predgroup]');if(pg){if(pg.closest('.sidebar')){activeTab='predictions';sbPredOpen=true;}setPredGroup(Number(pg.dataset.predgroup));return;}
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
    const stab=e.target.closest('.stab[data-shedview]');
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
    if(tabBtn){const t=tabBtn.dataset.tab;if(t&&t!=='cluckwise'){activeTab=t;inlineDeliveryState=null;if(feedCompareState.modalOpen)closeCompareModal();render();document.getElementById('app')?.scrollTo({top:0,behavior:'smooth'});}return;}
  });

  document.addEventListener('keydown',e=>{
        if(e.key==='Escape'){
      if(inlineDeliveryState){inlineDeliveryState=null;render();return;}
      if(document.getElementById('siloModal').classList.contains('open')){closeSiloModal();return;}
      if(loadsModalState.open){closeLoadsModal();return;}
      if(feedCompareState.modalOpen){closeCompareModal();return;}
      if(settingsDrawerOpen){closeSettingsDrawer();return;}
    }
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
    if(t.dataset&&t.dataset.pickupShed!==undefined&&t.dataset.pickupDate){if(t.dataset.pickupField==='avg')setPickupAvgWeight(Number(t.dataset.pickupShed),t.dataset.pickupDate,t.value);else setPickupTotalWeight(Number(t.dataset.pickupShed),t.dataset.pickupDate,t.value);return;}
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
    if(t.id==='notifShedPerf'){setNotifPref('shedPerformance',t.checked);return;}
    if(t.id==='notifFeedBalance'){setNotifPref('feedBalance',t.checked);return;}
    if(t instanceof HTMLInputElement&&t.dataset&&t.dataset.shed!==undefined&&t.dataset.field){updateShedField(Number(t.dataset.shed),t.dataset.field,t.value);}
  });

  document.addEventListener('input',e=>{
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
        if(syncLastSyncAt){if(pushPending)await runScheduledPush();pullFromCloud(true).catch(()=>{});}
        else{await pushToCloud().catch(()=>{});}
      }
    }
  });
  window.addEventListener('pagehide',flushPendingPush);
  window.addEventListener('beforeunload',flushPendingPush);
});
