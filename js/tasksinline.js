// Tasks inside ProdWise's own page — no frame (merging the apps, step 3, 25 Nov 2026).
// The first time Tasks opens, its page (cluckwise/index.html) is read and put in #cwRoot: its markup, its scripts
// (run here, once) and its styles. Each app's styles are fenced to its own part of the page:
//   · Tasks' rules (its own and Bootstrap's) only reach inside #cwRoot. Its width rules ask #cwRoot's width
//     (container queries) and vh/vw become #cwRoot's size, so it lays out exactly as it did in the frame.
//   · ProdWise's rules never reach inside #cwRoot.
// Both fences use :where(), which adds nothing to a rule's weight, so each app's own styles behave as before.
// ProdWise code that talked to the frame (cwFrame.contentWindow…) keeps working through a stand-in object.
// Turned off (localStorage pw-tasks-inline = '0'), or on a browser too old for the fences, Tasks opens in the frame
// as before.
const CW_INLINE_KEY='pw-tasks-inline',CW_INLINE_DEFAULT=true;
// Scripts both apps load: ProdWise has them already
const CW_SHARED_JS=/\/js\/(core|farmsync|taskstore|farmkey|notify|plumo-face)\.js(\?|$)/;
// Style sheets made by shared scripts: they belong to both apps
const CW_SHARED_CSS=['plumoFaceCss','plumoMovesCss','fkCss'];
let cwInline=null;
function cwInlineSupported(){
  try{return !!(window.CSS&&CSS.supports('selector(:where(a))')&&CSS.supports('selector(:not(a b))')&&CSS.supports('container-type:size')&&window.DOMParser&&window.ResizeObserver);}catch(e){return false;}
}
function cwInlineWanted(){
  if(!cwInlineSupported())return false;
  try{const v=localStorage.getItem(CW_INLINE_KEY);if(v==='0')return false;if(v==='1')return true;}catch(e){}
  return CW_INLINE_DEFAULT;
}
// ── selectors ──
function cwSplitSel(sel){const out=[];let d=0,cur='';for(const ch of sel){if(ch==='('||ch==='[')d++;else if(ch===')'||ch===']')d--;if(ch===','&&!d){out.push(cur.trim());cur='';}else cur+=ch;}if(cur.trim())out.push(cur.trim());return out;}
// where a compound selector ends (the next space or combinator outside brackets)
function cwCompoundEnd(s,i){let d=0;for(;i<s.length;i++){const c=s[i];if(c==='('||c==='[')d++;else if(c===')'||c===']')d--;else if(!d&&/[\s>+~]/.test(c))return i;}return i;}
// A Tasks selector → the same selector inside #cwRoot. Its page body is #cwRoot (a div, so body → div keeps the weight);
// html stays the page's html (its cw- classes are set there).
function cwScopeOne(sel){
  let s=sel.trim(),pre='';
  if(/^(html|:root)(?![\w-])/.test(s)){
    const e=cwCompoundEnd(s,0),c=s.slice(0,e),rest=s.slice(e).trim();
    if(c.startsWith(':root')){const tail=c.slice(5);if(!rest)return '.cw-root:where(#cwRoot)'+tail;pre=':root'+tail+' ';s=rest;}
    else{if(!rest)return c==='html'?'div:where(#cwRoot)':c+' :where(#cwRoot)';pre=c+' ';s=rest;}
    if(s.startsWith('>'))s=s.slice(1).trim();
  }
  if(/^body(?![\w-])/.test(s)){const e=cwCompoundEnd(s,0);return pre+'div:where(#cwRoot)'+s.slice(4,e)+s.slice(e);}
  return pre+':where(#cwRoot) '+s;
}
const cwScopeSel=sel=>cwSplitSel(sel).map(cwScopeOne).join(', ');
// A ProdWise selector → never inside #cwRoot (the fence goes on the element the rule styles, before any ::pseudo-element)
const CW_PSEUDO_EL=/(::?(?:before|after|first-line|first-letter|placeholder|selection|marker|backdrop|file-selector-button|-webkit-[\w-]+|-moz-[\w-]+))+$/;
function cwFenceOne(sel){
  if(sel.includes('#cwRoot'))return sel;
  const m=sel.match(CW_PSEUDO_EL),base=m?sel.slice(0,m.index):sel,pe=m?m[0]:'';
  return (base||'*')+':where(:not(#cwRoot, #cwRoot *))'+pe;
}
const cwFenceSel=sel=>cwSplitSel(sel).map(cwFenceOne).join(', ');
// ── declarations: the frame had no phone safe-area insets and its own vh/vw; relative links point into cluckwise/ ──
function cwFixDecl(t){
  return t.replace(/env\(\s*safe-area-inset-[a-z]+\s*(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)/g,(_,fb)=>fb?fb.trim():'0px')
    .replace(/(-?\d*\.?\d+)(?:d|s|l)?vh\b/g,'$1cqh').replace(/(-?\d*\.?\d+)(?:d|s|l)?vw\b/g,'$1cqw')
    .replace(/url\(\s*(['"]?)(?!data:|https?:|\/|#)([^'")]+)\1\s*\)/g,(_,q,u)=>`url(${q}${CLUCKWISE_URL}${u}${q})`);
}
// a media query on width → the same question about #cwRoot's width; other parts stay screen questions
// (#cwRoot can't ask about its own width: rules for the page body itself keep asking the screen, which on a phone
// is the same width, and on a computer only differs by the rail)
function cwMedia(cond,inner,rootInner){
  const plain='@media '+cond+'{'+inner+rootInner+'}';
  if(/,/.test(cond)||/\bnot\b|\bonly\b/.test(cond))return plain;
  const parts=cond.split(/\s+and\s+/i).map(x=>x.trim()).filter(x=>x&&!/^(all|screen)$/i.test(x));
  const w=parts.filter(x=>/^\(\s*(min|max)-width\s*:/i.test(x)),o=parts.filter(x=>!w.includes(x));
  if(!w.length)return plain;
  const cq=inner?'@container cwroot '+w.join(' and ')+'{'+inner+'}':'';
  return (o.length&&cq?'@media '+o.join(' and ')+'{'+cq+'}':cq)+(rootInner?'@media '+cond+'{'+rootInner+'}':'');
}
// a scoped selector that styles #cwRoot itself (not something inside it)
const cwIsRootSel=s=>!s.includes(':where(#cwRoot) ');
function cwRulesText(rules,fn,rootOut){
  let out='';
  for(const r of rules){
    if(r.type===1&&r.style){
      const nested=r.cssRules&&r.cssRules.length?[...r.cssRules].map(x=>x.cssText).join(''):'';
      const parts=cwSplitSel(fn.sel(r.selectorText)),body='{'+fn.decl(r.style.cssText)+nested+'}';
      const root=rootOut?parts.filter(cwIsRootSel):[],rest=parts.filter(x=>!root.includes(x));
      if(rest.length)out+=rest.join(', ')+body;
      if(root.length)rootOut.text+=root.join(', ')+body;
    }else if(r.media&&r.cssRules){const ro={text:''};const inner=cwRulesText(r.cssRules,fn,ro);out+=fn.media(r.conditionText||r.media.mediaText,inner,ro.text);}
    else if(r.conditionText!==undefined&&r.cssRules&&/^@supports/.test(r.cssText)){out+='@supports '+r.conditionText+'{'+cwRulesText(r.cssRules,fn)+'}';}
    else out+=r.cssText;
  }
  return out;
}
// parse CSS without applying it (media="not all"), then rewrite it
function cwParseCss(text){const st=document.createElement('style');st.media='not all';st.textContent=text;document.head.appendChild(st);const rules=st.sheet?[...st.sheet.cssRules]:[];st.remove();return rules;}
function cwScopeCss(text){return cwRulesText(cwParseCss(text),{sel:cwScopeSel,decl:cwFixDecl,media:cwMedia});}
// fence ProdWise's own style sheets in place (once)
function cwFenceRules(rules){for(const r of rules){if(r.selectorText!==undefined){try{r.selectorText=cwFenceSel(r.selectorText);}catch(e){}if(r.cssRules&&r.cssRules.length)cwFenceRules(r.cssRules);}else if(r.cssRules)cwFenceRules(r.cssRules);}}
function cwFenceProdWiseCss(){
  for(const sh of document.styleSheets){
    const n=sh.ownerNode;if(!n||n.dataset.cwFenced||(n.id&&(CW_SHARED_CSS.includes(n.id)||/^cw/.test(n.id))))continue;
    if(n.tagName==='LINK'&&!/prodwise\.css/.test(n.href||''))continue;
    try{cwFenceRules(sh.cssRules);n.dataset.cwFenced='1';}catch(e){}
  }
}
// Tasks' guide scripts add their own <style>: fence it to #cwRoot too
function cwScopeStyleEl(st){if(!st||st.dataset.cwScoped)return;st.textContent=cwScopeCss(st.textContent);st.dataset.cwScoped='1';}
// ── the stand-in for the old frame ──
function cwFrameStandIn(root){
  const doc={documentElement:document.documentElement,body:root,querySelector:s=>root.querySelector(s),querySelectorAll:s=>root.querySelectorAll(s),getElementById:id=>document.getElementById(id)};
  return {id:'cwFrame',title:'Tasks',dataset:{},src:'inline',inline:true,contentWindow:window,contentDocument:doc,
    addEventListener(t,fn){if(t!=='load')return;if(cwInline&&cwInline.ready)setTimeout(fn,0);else if(cwInline)cwInline.waiting.push(fn);},
    removeEventListener(){},focus(){try{root.focus({preventScroll:true});}catch(e){}}};
}
function cwLoadScript(src){return new Promise(res=>{const s=document.createElement('script');s.src=src;s.onload=()=>res(true);s.onerror=()=>res(false);document.head.appendChild(s);});}
function cwRunInline(code){const s=document.createElement('script');s.textContent=code;document.body.appendChild(s);}
// Tasks into the page (once). Resolves when its scripts have run.
function cwMountInline(farm){
  if(cwInline)return cwInline.p;
  const root=document.createElement('div');root.id='cwRoot';root.className='cw-root';root.tabIndex=-1;
  document.body.appendChild(root);
  cwInline={root,farm,ready:false,waiting:[]};
  cwFrame=cwFrameStandIn(root);
  cwInline.p=(async()=>{
    const base=new URL(CLUCKWISE_URL,location.href);
    const html=await fetch(new URL('index.html',base),{cache:'no-cache'}).then(r=>r.text());
    const doc=new DOMParser().parseFromString(html,'text/html');
    // styles: Bootstrap and Tasks' own, fenced to #cwRoot
    let css='';
    for(const l of doc.querySelectorAll('link[rel="stylesheet"]')){
      const href=new URL(l.getAttribute('href'),base).href;
      if(/fonts\.googleapis/.test(href)){if(!document.querySelector(`link[href="${href}"]`)){const x=document.createElement('link');x.rel='stylesheet';x.href=href;document.head.appendChild(x);}continue;}
      try{css+=await fetch(href).then(r=>r.ok?r.text():'')+'\n';}catch(e){}
    }
    doc.querySelectorAll('style').forEach(s=>{css+=s.textContent+'\n';});
    cwFenceProdWiseCss();
    const st=document.createElement('style');st.id='cwCss';st.textContent=cwScopeCss(css);document.head.appendChild(st);
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
  })().catch(e=>{console.error('Tasks could not open in the page',e);return false;});
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
