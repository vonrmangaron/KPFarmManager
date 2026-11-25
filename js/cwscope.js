// Fences Tasks' styles to #cwRoot (merging the apps, step 3). Works on the CSS text itself, so nothing a browser
// doesn't know is lost (Safari's -webkit- properties survive), and runs the same in Node (tools/build-tasks-css.js,
// which writes cluckwise/tasks-inline.css once per release) and in the page (the guides' small style blocks).
//   · every rule only reaches inside #cwRoot: `.x` → `:where(#cwRoot) .x`; the page body is #cwRoot (body → div keeps
//     a rule's weight); html stays the page's html; :root (the colour tokens) → #cwRoot
//   · width @media → @container cwroot (#cwRoot's width is what the frame's was); rules for #cwRoot itself keep the
//     screen question, since a container can't ask about its own width
//   · vh / vw → #cwRoot's size (cqh / cqw); the phone's safe-area insets → 0 (ProdWise keeps #cwRoot clear of them)
// :where() adds nothing to a rule's weight, so Tasks' own rules win and lose against each other exactly as before.
(function(root){
  function splitSel(sel){const out=[];let d=0,cur='',q=null;for(const ch of sel){if(q){cur+=ch;if(ch===q)q=null;continue;}if(ch==='"'||ch==="'"){q=ch;cur+=ch;continue;}if(ch==='('||ch==='[')d++;else if(ch===')'||ch===']')d--;if(ch===','&&!d){out.push(cur.trim());cur='';}else cur+=ch;}if(cur.trim())out.push(cur.trim());return out;}
  function compoundEnd(s,i){let d=0;for(;i<s.length;i++){const c=s[i];if(c==='('||c==='[')d++;else if(c===')'||c===']')d--;else if(!d&&/[\s>+~]/.test(c))return i;}return i;}
  function scopeOne(sel){
    let s=sel.trim(),pre='';
    if(/^(html|:root)(?![\w-])/.test(s)){
      const e=compoundEnd(s,0),c=s.slice(0,e),rest=s.slice(e).trim();
      if(c.startsWith(':root')){const tail=c.slice(5);if(!rest)return '.cw-root:where(#cwRoot)'+tail;pre=':root'+tail+' ';s=rest;}
      else{if(!rest)return c==='html'?'div:where(#cwRoot)':c+' :where(#cwRoot)';pre=c+' ';s=rest;}
      if(s.startsWith('>'))s=s.slice(1).trim();
    }
    if(/^body(?![\w-])/.test(s)){const e=compoundEnd(s,0);return pre+'div:where(#cwRoot)'+s.slice(4,e)+s.slice(e);}
    return pre+':where(#cwRoot) '+s;
  }
  const scopeSel=sel=>splitSel(sel).map(scopeOne);
  const isRootSel=s=>!s.includes(':where(#cwRoot) ');
  function fixDecl(t){
    return t.replace(/env\(\s*safe-area-inset-[a-z]+\s*(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)/g,(_,fb)=>fb?fb.trim():'0px')
      .replace(/(-?\d*\.?\d+)(?:d|s|l)?vh\b/g,'$1cqh').replace(/(-?\d*\.?\d+)(?:d|s|l)?vw\b/g,'$1cqw');
  }
  function media(cond,inner,rootInner){
    const plain='@media '+cond+'{'+inner+rootInner+'}';
    if(/,/.test(cond)||/\bnot\b|\bonly\b/.test(cond))return plain;
    const parts=cond.split(/\s+and\s+/i).map(x=>x.trim()).filter(x=>x&&!/^(all|screen)$/i.test(x));
    const w=parts.filter(x=>/^\(\s*(min|max)-width\s*:/i.test(x)),o=parts.filter(x=>!w.includes(x));
    if(!w.length)return plain;
    const cq=inner?'@container cwroot '+w.join(' and ')+'{'+inner+'}':'';
    return (o.length&&cq?'@media '+o.join(' and ')+'{'+cq+'}':cq)+(rootInner?'@media '+cond+'{'+rootInner+'}':'');
  }
  // ── a small reader for CSS text: rules and at-rules with their blocks (strings and comments respected) ──
  function stripComments(t){let out='',i=0,q=null;while(i<t.length){const c=t[i];if(q){out+=c;if(c==='\\'){out+=t[i+1]||'';i+=2;continue;}if(c===q)q=null;i++;continue;}if(c==='"'||c==="'"){q=c;out+=c;i++;continue;}if(c==='/'&&t[i+1]==='*'){const e=t.indexOf('*/',i+2);i=e<0?t.length:e+2;continue;}out+=c;i++;}return out;}
  // from i, read up to (not including) the first top-level char in stops
  function readUntil(t,i,stops){let d=0,q=null,s=i;for(;i<t.length;i++){const c=t[i];if(q){if(c==='\\'){i++;continue;}if(c===q)q=null;continue;}if(c==='"'||c==="'"){q=c;continue;}if(c==='('||c==='[')d++;else if(c===')'||c===']')d--;else if(!d&&stops.includes(c))break;}return [t.slice(s,i),i];}
  // t[i] === '{' → [inner text, index after the matching '}']
  function readBlock(t,i){let d=0,q=null,s=i+1;for(;i<t.length;i++){const c=t[i];if(q){if(c==='\\'){i++;continue;}if(c===q)q=null;continue;}if(c==='"'||c==="'"){q=c;continue;}if(c==='{')d++;else if(c==='}'){d--;if(!d)return [t.slice(s,i),i+1];}}return [t.slice(s),t.length];}
  function walk(t,rootOut){
    let out='',i=0;
    while(i<t.length){
      while(i<t.length&&/\s/.test(t[i]))i++;
      if(i>=t.length)break;
      if(t[i]==='}'){i++;continue;}
      const [pre,j]=readUntil(t,i,t[i]==='@'?'{;':'{');
      const prelude=pre.trim();
      if(j>=t.length||t[j]===';'){if(prelude)out+=prelude+';';i=j+1;continue;}
      const [inner,k]=readBlock(t,j);i=k;
      if(prelude[0]==='@'){
        const name=(prelude.match(/^@([\w-]+)/)||[])[1]||'',cond=prelude.slice(name.length+1).trim();
        if(name==='media'){const ro={text:''};const rest=walk(inner,ro);out+=media(cond,rest,ro.text);}
        else if(/^(supports|layer|container|document|-moz-document|scope|starting-style)$/.test(name))out+=prelude+'{'+walk(inner,null)+'}';
        else out+=prelude+'{'+inner+'}';   // @keyframes, @font-face, @page…: as they are
        continue;
      }
      const parts=scopeSel(prelude),body='{'+(inner.includes('{')?inner:fixDecl(inner))+'}';
      const rootP=rootOut?parts.filter(isRootSel):[],rest=parts.filter(x=>!rootP.includes(x));
      if(rest.length)out+=rest.join(',')+body;
      if(rootP.length)rootOut.text+=rootP.join(',')+body;
    }
    return out;
  }
  const scopeCss=text=>walk(stripComments(String(text||'')),null);
  const api={scopeCss,scopeSel:s=>scopeSel(s).join(', '),splitSel};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.CWScope=api;
})(typeof window!=='undefined'?window:this);
