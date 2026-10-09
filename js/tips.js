// Tooltips everywhere: hover shows the title; tapping a coloured marker (dot, pill,
// badge) shows the same text as a toast, so it also works on a phone.
// Rules run on every render (MutationObserver); a title set in the markup always wins.
const TIP_RULES=[
  // Sidebar / sync
  ['#sbConnectBtn','Connect this device to the farm cloud so your data syncs'],
  ['.sb-sync-dot',e=>e.classList.contains('ok')?'Green: connected and synced':e.classList.contains('error')?'Red: the last sync failed — tap Sync now':'Grey: not connected to the cloud'],
  // Manager home
  ['.mgr-dot',e=>e.classList.contains('bad')?'Red: these silos run out within 3 days':e.classList.contains('warn')?'Orange: these silos run out within 10 days':'Green: more than 10 days of feed in the silos'],
  ['.mgr-need',e=>(e.classList.contains('bad')?'Red: urgent':'Orange: needs attention soon')+' — tap to open'],
  ['.mgr-batch','Batch details: age, first pickup and clean-out'],
  ['.mgr-link','Open Result detail'],
  // Result detail
  ['.dash-gs-tile','Open this pair'],
  ['.fk-how-toggle','Show or hide how the FCR is calculated'],
  ['.fkt-more','Show or hide dockets and leftover feed'],
  ['#siloFromDash','Open Silo readings'],
  ['#dcoSetAllBtn','Use the same value for all 8 sheds'],
  // Pair page
  ['.pair-tab',e=>'Open the '+e.textContent.trim()+' tab'],
  ['.group-view-head .pills > span:not(.feed-pill)','Birds alive now in this pair'],
  ['.feed-pill','Feed the birds in this pair eat today (forecast)'],
  ['.planner-card-toggle','Show or hide the feed loads for this pair'],
  ['.silo-set-link','Silo settings are changed in Farm settings'],
  ['.ring-off','Mark this silo as off (not in use) — it is left out of the stock'],
  ['.off-badge','This silo is off (not in use) and left out of the stock'],
  ['.silo-starter-tag','Starter silo for this pair'],
  ['.delivery-pill.test','Test delivery — a what-if only, not a real load'],
  ['.delivery-pill','Feed delivered to this pair on this day (from a feed load)'],
  ['.feed-tag',e=>{const t=['starter','grower','finisher','withdrawal'].find(c=>e.classList.contains(c));return t?t[0].toUpperCase()+t.slice(1)+' feed':'Feed type';}],
  ['.weekend-pill','Falls on a Saturday or Sunday'],
  ['.fpill','Show this range of days'],
  ['#siloCustomStart,#compareCustomStart','From day (0 = today)'],
  ['#siloCustomEnd,#compareCustomEnd','To day (days from today)'],
  ['.pdrb-apply','Show the days you typed'],
  ['[data-pred-cycle="start"]','From bird age (day of the batch)'],
  ['[data-pred-cycle="end"]','To bird age (day of the batch)'],
  ['.tag',e=>{const t=e.textContent.trim();return /^Age/i.test(t)?'Bird age today, in days':/^Live/i.test(t)?'Birds alive now':'';}],
  ['.pp-count-badge','Pickups planned (done + predicted) out of the number of pickups you aim for'],
  ['.pp-badge.auto','Planned automatically by the app'],
  ['.pp-badge.final','Last pickup — the shed is emptied (clean-out)'],
  ['.btn-pp-add','Add a pickup you expect, to see how the forecast changes'],
  ['.w-pill.standard,.pill.standard','Ross standard curve — no weight readings yet'],
  ['.w-pill.gompertz,.pill.gompertz','AI growth curve fitted to your weight readings'],
  ['.pill.target','Based on a single weight reading'],
  ['.ptc-status','Which growth curve the weight forecast is using'],
  ['[id^="setPlace_"]','Placement date — when the chicks arrived'],
  ['[id^="setPop_"]','Number of chicks placed'],
  ['[id^="setChick_"]','Chick weight at placement, in grams'],
  ['[id^="setClean_"]','Clean-out date — the last pickup day'],
  ['[id^="mortRateSlider_"],[id^="mortRateNum_"]','Expected daily mortality (% of birds per day) used for the forecast'],
  // Tools
  ['.loads-chip',e=>({all:'Show every load',upcoming:'Loads dated today or later',needs:'Past loads still missing their docket actual',past:'Loads before today'})[e.dataset.loadsFilter]||''],
  ['[data-loads-view="table"]','Table: enter docket actuals straight in the list'],
  ['[data-loads-view="oneline"]','One-line: one row per load, for checking against dockets'],
  ['#loadsAddBtn','Add a feed load (one truck, one docket)'],
  ['.sms-status',e=>e.classList.contains('done')?'All 3 silos read today':e.classList.contains('partial')?'Some silos read today, the rest carried from an earlier reading':e.classList.contains('stale')?'Last reading was before today — read the silos':'No silo reading yet for this pair'],
  ['.sms-next-btn','Save and go to the next pair'],
  ['#siloModalDone','Save and close Silo readings'],
  ['.pk-add','Add a pickup for this shed'],
  ['.cmp-group-card','Show or hide this pair in the comparison'],
  ['.dash-status-dot',e=>{const c=e.style.background||'';return c.includes('danger')?'Red: well behind the Ross weight':c.includes('primary')?'Orange: a little behind the Ross weight':c.includes('success')?'Green: on or ahead of the Ross weight':'Grey: no weight yet';}],
  ['.loads-dot,.sb-link-meta .badge,.sb-badge','Things that need your attention here'],
  ['#historySaveBtn','Save a copy of the app as it is now, to go back to later'],
];
// Coloured markers that are not buttons: tap shows the tip as a toast
const TIP_MARK_SEL='.sb-sync-dot,.mgr-dot,.dash-status-dot,.off-badge,.silo-starter-tag,.delivery-pill,.feed-tag,.weekend-pill,.tag,.pp-count-badge,.pp-badge,.w-pill,.pill,.ptc-status,.sms-status,.feed-pill,.group-view-head .pills > span,.loads-dot,.sb-badge';
function tipLabelFor(el){
  // inputs: their label text; buttons: their own words
  if(el.matches('input,select,textarea')){
    let lab=(el.id&&document.querySelector(`label[for="${CSS.escape(el.id)}"]`))||el.closest('label');
    // label sitting next to the box (no for=): same wrapper, or the wrapper's heading
    for(let w=el.parentElement,i=0;!lab&&w&&i<3;w=w.parentElement,i++)lab=w.querySelector(':scope > label, :scope > .lbl, :scope > .lm-label, :scope > .field-label');
    const t=lab?lab.textContent:(el.placeholder||'');
    return t.trim().replace(/\s+/g,' ').slice(0,80);
  }
  const t=(el.textContent||'').trim().replace(/\s+/g,' ');
  return t.length>80?t.slice(0,77)+'…':t;
}
function applyTips(root){
  const scope=root&&root.querySelectorAll?root:document;
  TIP_RULES.forEach(([sel,txt])=>{
    let list;try{list=scope.querySelectorAll(sel);}catch(e){return;}
    list.forEach(el=>{
      if(el.hasAttribute('title')&&!el.dataset.autoTip)return;
      const t=typeof txt==='function'?txt(el):txt;
      if(!t)return;
      if(el.getAttribute('title')!==t){el.setAttribute('title',t);el.dataset.autoTip='1';}
    });
  });
  // Anything else you can click or type in gets its own words as a tooltip
  scope.querySelectorAll('button,[role="button"],a[href],select,input:not([type="hidden"]),textarea').forEach(el=>{
    if(el.hasAttribute('title'))return;
    const t=el.getAttribute('aria-label')||tipLabelFor(el);
    if(t){el.setAttribute('title',t);el.dataset.autoTip='1';}
  });
}
let tipsQueued=false;
function queueTips(){if(tipsQueued)return;tipsQueued=true;requestAnimationFrame(()=>{tipsQueued=false;try{applyTips(document);}catch(e){console.warn('Tips failed',e);}});}
function initTips(){
  queueTips();
  new MutationObserver(queueTips).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('click',e=>{
    const m=e.target.closest&&e.target.closest(TIP_MARK_SEL);
    if(!m||m.closest('button,a,[role="button"],input,select,label'))return;
    const t=m.getAttribute('title');if(t&&typeof showToast==='function')showToast(t);
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initTips);else initTips();
