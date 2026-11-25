// Tasks inside ProdWise's own page — no frame (merging the apps, step 3, 25 Nov 2026).
// Tasks' page (cluckwise/index.html) is read and put in #cwRoot: its markup and its scripts (run here, once).
// Each app's styles are fenced to its own part of the page:
//   · Tasks' rules (its own and Bootstrap's) only reach inside #cwRoot: cluckwise/tasks-inline.css, made once per
//     release by tools/build-tasks-css.js (js/cwscope.js does the fencing). Its width rules ask #cwRoot's width
//     (container queries) and vh/vw are #cwRoot's size, so it lays out exactly as it did in the frame.
//   · ProdWise's rules never reach inside #cwRoot (fenced here, once, in the page's own style sheets).
// Both fences use :where(), which adds nothing to a rule's weight, so each app's own styles behave as before.
// ProdWise code that talked to the frame (cwFrame.contentWindow…) keeps working through a stand-in object.
// Speed: a few seconds after ProdWise opens, Tasks loads hidden in the background (tasks.js), so opening it is just a
// switch. Turned off (localStorage pw-tasks-inline = '0'), on a browser too old for the fences, or when Tasks' styles
// can't be loaded, Tasks opens in the frame as before.
const CW_INLINE_KEY='pw-tasks-inline',CW_INLINE_DEFAULT=true;
// Scripts both apps load: ProdWise has them already
const CW_SHARED_JS=/\/js\/(core|farmsync|taskstore|farmkey|notify|plumo-face)\.js(\?|$)/;
// Style sheets made by shared scripts: they belong to both apps
const CW_SHARED_CSS=['plumoFaceCss','plumoMovesCss','fkCss'];
let cwInline=null,cwInlineFailed=false;
function cwInlineSupported(){
  try{return !!(window.CSS&&CSS.supports('selector(:where(a))')&&CSS.supports('selector(:not(a b))')&&CSS.supports('container-type:size')&&window.DOMParser&&window.ResizeObserver&&window.CWScope);}catch(e){return false;}
}
function cwInlineWanted(){
  if(cwInlineFailed||!cwInlineSupported())return false;
  try{const v=localStorage.getItem(CW_INLINE_KEY);if(v==='0')return false;if(v==='1')return true;}catch(e){}
  return CW_INLINE_DEFAULT;
}
// ── ProdWise's own style sheets: never inside #cwRoot (the fence goes on the element a rule styles, before any ::pseudo-element) ──
const CW_PSEUDO_EL=/(::?(?:before|after|first-line|first-letter|placeholder|selection|marker|backdrop|file-selector-button|-webkit-[\w-]+|-moz-[\w-]+))+$/;
function cwFenceOne(sel){
  if(sel.includes('#cwRoot'))return sel;
  const m=sel.match(CW_PSEUDO_EL),base=m?sel.slice(0,m.index):sel,pe=m?m[0]:'';
  return (base||'*')+':where(:not(#cwRoot, #cwRoot *))'+pe;
}
const cwFenceSel=sel=>CWScope.splitSel(sel).map(cwFenceOne).join(', ');
function cwFenceRules(rules){for(const r of rules){if(r.selectorText!==undefined){try{r.selectorText=cwFenceSel(r.selectorText);}catch(e){}if(r.cssRules&&r.cssRules.length)cwFenceRules(r.cssRules);}else if(r.cssRules)cwFenceRules(r.cssRules);}}
function cwFenceProdWiseCss(){
  for(const sh of document.styleSheets){
    const n=sh.ownerNode;if(!n||n.dataset.cwFenced||(n.id&&(CW_SHARED_CSS.includes(n.id)||/^cw/.test(n.id))))continue;
    if(n.tagName==='LINK'&&!/prodwise\.css/.test(n.href||''))continue;
    try{cwFenceRules(sh.cssRules);n.dataset.cwFenced='1';}catch(e){}
  }
}
// Tasks' guide scripts add their own small <style>: fence it to #cwRoot too
function cwScopeStyleEl(st){if(!st||st.dataset.cwScoped)return;st.textContent=CWScope.scopeCss(st.textContent);st.dataset.cwScoped='1';}
// ── the stand-in for the old frame ──
function cwFrameStandIn(root){
  const doc={documentElement:document.documentElement,body:root,querySelector:s=>root.querySelector(s),querySelectorAll:s=>root.querySelectorAll(s),getElementById:id=>document.getElementById(id)};
  return {id:'cwFrame',title:'Tasks',dataset:{},src:'inline',inline:true,contentWindow:window,contentDocument:doc,
    addEventListener(t,fn){if(t!=='load')return;if(cwInline&&cwInline.ready)setTimeout(fn,0);else if(cwInline)cwInline.waiting.push(fn);},
    removeEventListener(){},focus(){try{root.focus({preventScroll:true});}catch(e){}}};
}
function cwLoadScript(src){return new Promise(res=>{const s=document.createElement('script');s.src=src;s.onload=()=>res(true);s.onerror=()=>res(false);document.head.appendChild(s);});}
function cwRunInline(code){const s=document.createElement('script');s.textContent=code;document.body.appendChild(s);}
function cwLoadCss(href,id){return new Promise(res=>{const l=document.createElement('link');l.rel='stylesheet';l.href=href;if(id)l.id=id;l.onload=()=>res(true);l.onerror=()=>{l.remove();res(false);};document.head.appendChild(l);});}
// Tasks into the page (once). Resolves true when its scripts have run, false when it couldn't (then the frame is used).
function cwMountInline(farm){
  if(cwInline)return cwInline.p;
  const root=document.createElement('div');root.id='cwRoot';root.className='cw-root';root.tabIndex=-1;
  document.body.appendChild(root);
  cwInline={root,farm,ready:false,waiting:[]};
  cwFrame=cwFrameStandIn(root);
  cwInline.p=(async()=>{
    const base=new URL(CLUCKWISE_URL,location.href);
    // Tasks' page and its ready-made styles, side by side
    const [html,cssOk]=await Promise.all([
      fetch(new URL('index.html',base),{cache:'no-cache'}).then(r=>r.ok?r.text():null).catch(()=>null),
      cwLoadCss(new URL('tasks-inline.css',base).href,'cwCss')]);
    if(!html||!cssOk)throw new Error(!html?'Tasks page unavailable':'Tasks styles unavailable');
    const doc=new DOMParser().parseFromString(html,'text/html');
    for(const l of doc.querySelectorAll('link[rel="stylesheet"]')){
      const href=new URL(l.getAttribute('href'),base).href;
      if(/fonts\.googleapis/.test(href)&&!document.querySelector(`link[href="${href}"]`))cwLoadCss(href);
    }
    cwFenceProdWiseCss();
    // markup (scripts run below, in order)
    const scripts=[...doc.querySelectorAll('script')];scripts.forEach(s=>s.remove());
    doc.body.querySelectorAll('[src],[href]').forEach(el=>{['src','href'].forEach(a=>{const v=el.getAttribute(a);if(v&&!/^(?:[a-z]+:|\/|#|data:)/i.test(v))el.setAttribute(a,new URL(v,base).href);});});
    root.className+=' '+(doc.body.className||'');
    for(const n of [...doc.body.childNodes])root.appendChild(document.adoptNode(n));
    window.__cwInline={farm:farm||''};
    for(const s of scripts){
      const src=s.getAttribute('src');
      if(src){const abs=new URL(src,base).href;if(CW_SHARED_JS.test(abs)||[...document.scripts].some(x=>x.src===abs))continue;await cwLoadScript(abs);continue;}
      const code=s.textContent;
      if(/serviceWorker/.test(code)||/cw-onerail/.test(code)&&code.length<600)continue;   // the frame's first-paint rail and Tasks' own service worker
      try{cwRunInline(code);}catch(e){console.error('Tasks script',e);}
    }
    ['cwGuide2Css','cwGuideMgrCss'].forEach(id=>cwScopeStyleEl(document.getElementById(id)));
    cwInline.ready=true;
    const w=cwInline.waiting.splice(0);w.forEach(fn=>setTimeout(fn,0));
    return true;
  })().catch(e=>{
    // couldn't come in (e.g. no signal and never opened before): use the frame this time
    console.warn('Tasks opens in the frame:',e.message);
    cwInlineFailed=true;
    try{root.remove();}catch(er){}
    const wasOpen=typeof pwSection!=='undefined'&&pwSection==='tasks',waiting=cwInline.waiting.splice(0);
    cwInline=null;cwFrame=null;
    if(wasOpen&&typeof openTasksSection==='function')openTasksSection({push:false});
    else if(waiting.length&&typeof pwEnsureTasksFrame==='function')pwEnsureTasksFrame();
    if(waiting.length&&cwFrame)waiting.forEach(fn=>cwFrame.addEventListener('load',()=>setTimeout(fn,400),{once:true}));
    return false;
  });
  return cwInline.p;
}
// where #cwRoot sits: where the frame sat. Hidden, it keeps its own size (Tasks measures it) but draws nothing inside.
(function(){
  const st=document.createElement('style');st.id='cwHostCss';
  st.textContent=`#cwRoot{position:fixed;left:0;right:0;top:env(safe-area-inset-top,0px);bottom:env(safe-area-inset-bottom,0px);z-index:5000;visibility:hidden;content-visibility:hidden;pointer-events:none;container:cwroot/size;contain:size layout style;overflow:auto;isolation:isolate;outline:none}
body.pw-in-tasks #cwRoot{visibility:visible;content-visibility:visible;pointer-events:auto}
@media (min-width:1109px){body.pw-in-tasks #cwRoot{left:84px}}`;
  document.head.appendChild(st);
})();
