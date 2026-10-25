// ── Ross — the farm's AI and its morning report (2026-10-25, mockup G9Akjz37VWHJTHyL9g2MTL) ────────────────
// Named after the Ross 308. One detailed report covering Production and Tasks pops up once a day from 7:00 and
// reopens from the Ross button in the header (and in Tasks). The numbers, lists, week strip and "since yesterday"
// come straight from the apps; Ross (free AI on the farm's Cloudflare account, workers/prodwise-ai.js) writes the
// overview, the ranked plan with reasons, a note per shed, the crew note, warnings and weather advice — two AI
// requests a morning, saved for the day. With no AI (offline, not set up, allowance used) every section still
// shows its facts; only Ross's sentences are missing. Replaces the Daily report and the per-page Summarise.
const AI_WORKER_URL='https://prodwise-ai.vonrmangaron.workers.dev';
const ROSS_SVG='<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M10 9c0-2 1.5-3.5 3-3.5.6-1.4 2-2 3.2-1.4 1-.9 2.6-.7 3.3.5 1.4 0 2.3 1.3 1.9 2.6" fill="#D6453B"/><path d="M8 14c0-4 3.3-6.8 7.4-6.8 4.4 0 7.6 3.3 7.6 7.6 0 1.6-.4 3-1.2 4.2L24 24c.6 1.6-.5 3-2.2 3H12c-2.7 0-4.7-2.4-4.3-5l.6-3.4C8.1 17.5 8 15.8 8 14z" fill="#F4EFE6" stroke="#2A2F33" stroke-width="1.3"/><path d="M8.2 13.6 4.6 15l3.6 1.2z" fill="#E7A33A" stroke="#2A2F33" stroke-width="1"/><circle cx="12.2" cy="12.6" r="1.25" fill="#2A2F33"/><path d="M9.4 17.2c.8 1.9.4 3.3-.6 4" stroke="#D6453B" stroke-width="2" stroke-linecap="round" fill="none"/></svg>';
let aiLeft=null;
function aiFarm(){return String(syncFarmName||'').trim();}
function aiSlug(){return aiFarm().toLowerCase().replace(/[^a-z0-9-]/g,'-');}
function aiDay(){return iso(mgrToday());}
function aiName(){return String((typeof cachedManager==='function'&&cachedManager())||'').trim().split(/\s+/)[0];}
async function aiCall(body){
  const r=await fetch(AI_WORKER_URL+'/ai/'+encodeURIComponent(aiSlug()),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({today:aiDay()},body))});
  let j=null;try{j=await r.json();}catch(e){}
  if(!r.ok){const err=new Error((j&&j.error)||('AI '+r.status));err.limit=!!(j&&j.limit)||r.status===429;err.setup=!!(j&&j.setup);err.status=r.status;throw err;}
  j=j||{};if(j.left!=null)aiLeft=j.left;
  if(j.text!=null&&typeof j.text!=='string')j.text=JSON.stringify(j.text);
  return j;
}
function aiJson(t){t=String(t||'');const a=t.indexOf('{'),z=t.lastIndexOf('}');if(a<0||z<=a)return null;try{return JSON.parse(t.slice(a,z+1));}catch(e){return null;}}
function aiResetTime(){const n=new Date(),u=new Date(Date.UTC(n.getUTCFullYear(),n.getUTCMonth(),n.getUTCDate()+1));return u.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});}
function aiErrText(e){
  if(!navigator.onLine)return 'Ross is offline — the AI needs the internet.';
  if(e&&e.limit)return `Ross is resting until ${aiResetTime()} (free AI allowance used up).`;
  if(e&&(e.setup||e.status===404||e.status===undefined))return 'Ross isn\'t set up on Cloudflare yet (prodwise-ai worker).';
  if(e&&e.status===403)return 'Only the manager can use Ross on this farm.';
  return 'Ross didn\'t answer just now.';
}
function rsColor(n){const P=['#5E7A3A','#2F7D6E','#7A5C9E','#B0603A','#3E6FB0','#9E4F6E'];let h=0;for(const ch of String(n))h=(h*31+ch.charCodeAt(0))>>>0;return P[h%P.length];}
const rsInl=x=>escapeHtml(String(x||'')).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>');

// ---------- store: today's report (per farm) and a few days of history for "since yesterday" ----------
function rsKey(){return 'pw-ross-'+aiSlug();}
function rsLoad(){try{const j=JSON.parse(localStorage.getItem(rsKey())||'null');if(j&&j.day===aiDay())return j;}catch(e){}return {day:aiDay(),seen:false,main:null,sheds:null,err:null};}
function rsSave(x){try{localStorage.setItem(rsKey(),JSON.stringify(x));}catch(e){}}
function rsHistKey(){return 'pw-ross-hist-'+aiSlug();}
function rsHist(){try{const j=JSON.parse(localStorage.getItem(rsHistKey())||'{}');return j&&typeof j==='object'?j:{};}catch(e){return {};}}
function rsSnap(){   // today's figures, kept a week, so tomorrow can say what changed
  if(!farmData)return;const h=rsHist(),d=aiDay();if(h[d])return;
  h[d]={mort:Object.fromEntries((farmData.sheds||[]).map(s=>[s.id,Math.max(0,Number(s.mortality)||0)]))};
  Object.keys(h).sort().slice(0,-8).forEach(k=>delete h[k]);
  try{localStorage.setItem(rsHistKey(),JSON.stringify(h));}catch(e){}
}
function rsOn(){try{return localStorage.getItem('pw-greet-on')!=='0';}catch(e){return true;}}
// Wait (up to ms) until Tasks has its farm data in, so Ross never writes the day's report without the tasks
function rsTasksReady(){try{const w=cwFrame&&cwFrame.contentWindow;return !!(w&&w.__cwRoss&&w.__cwReady);}catch(e){return false;}}
function rsWaitTasks(ms){return new Promise(res=>{const t0=Date.now();const tick=()=>{if(rsTasksReady()||Date.now()-t0>ms)res(rsTasksReady());else setTimeout(tick,250);};tick();});}
function rsCw(){try{const w=cwFrame&&cwFrame.contentWindow;return w&&typeof w.__cwRoss==='function'?w.__cwRoss():null;}catch(e){return null;}}

// ---------- the facts (straight from the apps) ----------
function rsGo(act){
  const a=String(act||'');
  if(/data-mgr-loads/.test(a))return 'Feed loads';if(/data-mgr-pickups/.test(a))return 'Pickups';if(/data-mgr-mort/.test(a))return 'Mortality';
  if(/data-brief-cw="prep"/.test(a))return 'Shed prep';if(/data-brief-cw/.test(a))return 'Tasks';
  let m=a.match(/data-brief-pair="\d+:(\d+)"/);if(m)return 'Shed '+m[1];
  m=a.match(/data-tab="g(\d)"/);if(m)return pairLabel(Number(m[1]));return '';
}
function rsData(){
  const today=mgrToday(),T=iso(today),cw=rsCw();
  const b=typeof mgrBriefData==='function'?mgrBriefData():{G:{today:[],watch:[],feed:[],co:[]},cw:null};
  const facts=[];let n=0;
  [['Today',b.G.today],['Watch',b.G.watch],['Feed',b.G.feed],['Changeover & prep',b.G.co]].forEach(([g,a])=>a.forEach(x=>facts.push({id:'F'+(++n),grp:g,tone:x.tone,html:x.html,act:x.act,text:x.html.replace(/<[^>]+>/g,'').replace(/&amp;/g,'&')})));
  // key numbers
  const sh=mgrPlaced(),placed=sh.reduce((s,x)=>s+(Number(x.initialPopulation)||0),0),live=sh.reduce((s,x)=>s+Math.max(0,liveAtStartOfDay(x,today)),0);
  const mort=sh.reduce((s,x)=>s+Math.max(0,Number(x.mortality)||0),0);
  const hist=rsHist(),ys=Object.keys(hist).filter(k=>k<T).sort().pop(),yd=ys?hist[ys]:null;
  const kpi=[];
  kpi.push({k:'Birds on hand',v:live.toLocaleString('en-US'),s:`of ${placed.toLocaleString('en-US')}`});
  let dM=null;if(yd){dM=0;sh.forEach(s=>{const was=yd.mort[s.id];if(was!=null)dM+=Math.max(0,Number(s.mortality)||0)-was;});}
  kpi.push({k:'Mortality',v:placed?(mort/placed*100).toFixed(2)+'%':'—',s:dM!=null&&placed?`${dM>=0?'+':'−'}${Math.abs(dM/placed*100).toFixed(2)} since ${ys===iso(addDays(today,-1))?'yesterday':fmtShortNoYear(new Date(ys+'T00:00:00'))}`:`${mort.toLocaleString('en-US')} birds`,tone:dM>0?'up':''});
  try{const t=computeFarmTotals(),lr=typeof lastHistoryRec==='function'?lastHistoryRec():null,lk=lr&&typeof historyKpis==='function'?historyKpis(lr):null;
    if(t&&t.hasData){const d=lk&&Number.isFinite(lk.cfcr)&&lk.cfcr>0?t.cfcr-lk.cfcr:null;kpi.push({k:'Cfcr2.45 finish',v:Number(t.cfcr).toFixed(3),s:d==null?'projected':`${d<=0?'−':'+'}${Math.abs(d).toFixed(3)} vs ${escapeHtml(String(lr.batch||'last'))}`,tone:d==null?'':d<=0?'ok':'up'});}}catch(e){}
  let silos=[];try{silos=mgrSiloOutlook().filter(x=>!(typeof pairAllClosed==='function'&&pairAllClosed(x.g)));}catch(e){}
  const lo=silos.filter(x=>x.dep).sort((a,c)=>a.dep-c.dep)[0];
  kpi.push(lo?{k:'Feed cover',v:`${lo.days} day${lo.days===1?'':'s'}`,s:pairLabel(lo.g),tone:lo.days<=3?'up':''}:{k:'Feed cover',v:'60+ days',s:'every pair',tone:'ok'});
  if(cw)kpi.push({k:'Tasks today',v:String(cw.today.length),s:cw.overdue.length?`${cw.overdue.length} overdue`:'none overdue',tone:cw.overdue.length?'up':'ok'});
  // sheds
  const days=mgrWeekDays(),pickToday=new Set(days[0].pick.map(p=>p.shed)),prepBy={};(cw&&cw.prep||[]).forEach(p=>prepBy[String(p.shed)]=p);
  const sheds=(farmData.sheds||[]).map(s=>{
    const id=s.id,pr=prepBy[String(id)],placedD=s.placementDate?dateOnly(s.placementDate):null,clean=s.cleanoutDate?dateOnly(s.cleanoutDate):null;
    const empty=s.closed||!placedD||placedD>today||(clean&&clean<today);
    if(empty){const dn=pr&&pr.chicks?mgrDays(today,dateOnly(new Date(pr.chicks+'T00:00:00'))):null;
      return {id,tone:'b',head:pr?`Empty · prep ${pr.done} of ${pr.total}`:'Empty',fact:pr?`Empty, prep ${pr.done} of ${pr.total} jobs${dn!=null?', chicks in '+dn+' days':''}${pr.left.length?', left: '+pr.left.join(', '):''}`:'Empty'};}
    const age=ageInDays(s,today),pop=Number(s.initialPopulation)||0,m=Math.max(0,Number(s.mortality)||0),pc=pop?m/pop*100:0;
    let dv=null;try{const f=forecastWeightModeAware(s,today);if(f&&f.kg!=null)dv=daysVsTarget(age,f.kg);}catch(e){}
    const dvt=dv==null?'':Math.abs(dv)<0.5?'on target':dv>0?`${dv.toFixed(1)} d ahead`:`${(-dv).toFixed(1)} d behind`;
    const out1=clean?mgrDays(today,clean):null,nx=mgrComingPickups(s)[0],sev=dv==null?'ok':daysBehindSeverity(dv);
    const mDay=yd&&yd.mort[id]!=null?m-yd.mort[id]:null;
    const tone=pickToday.has(id)?'r':sev==='bad'||(dv!=null&&dv<=-2)?'a':out1!=null&&out1<=1?'b':'g';
    const head=`Day ${age}${dvt?' · '+dvt:''}${pickToday.has(id)?' · pickup today':out1===0?' · clean-out today':out1===1?' · out tomorrow':''}`;
    return {id,tone,head,fact:`Day ${age}, ${dvt||'no weight yet'}, mortality ${pc.toFixed(2)}%${mDay!=null?' ('+(mDay>=0?'+':'')+mDay+' since yesterday)':''}${pickToday.has(id)?', pickup today':''}${nx&&!pickToday.has(id)?', next pickup '+fmtShortNoYear(nx.date)+' '+nx.birds.toLocaleString('en-US')+' birds':''}${clean?', clean-out '+fmtShortNoYear(clean):''}`};
  });
  // crew
  const crew=[];if(cw){const by={};const add=(t,od)=>{const who=t.who.length?t.who:[''];who.forEach(w=>{(by[w]=by[w]||[]).push({name:t.name,done:t.done,od});});};
    cw.today.forEach(t=>add(t,false));cw.overdue.forEach(t=>add(t,true));
    Object.entries(by).sort((a,c)=>(a[0]===''?1:c[0]===''?-1:c[1].length-a[1].length)).forEach(([w,list])=>crew.push({who:w,list,open:list.filter(x=>!x.done).length}));}
  // since yesterday
  const since=[];
  if(dM!=null){let worst=null;sh.forEach(s=>{const was=yd.mort[s.id];if(was==null)return;const d=Math.max(0,Number(s.mortality)||0)-was;if(!worst||d>worst.d)worst={id:s.id,d};});
    since.push({tone:dM>0?'a':'g',html:`Mortality <b>${dM>=0?'+':'−'}${Math.abs(dM).toLocaleString('en-US')} birds</b>${worst&&worst.d>0&&dM>0?` — ${worst.d.toLocaleString('en-US')} of them in Shed ${worst.id}`:''}`});}
  if(cw&&cw.yesterday.total)since.push({tone:cw.yesterday.done===cw.yesterday.total?'g':'a',html:`<b>${cw.yesterday.done} of ${cw.yesterday.total}</b> jobs done yesterday`});
  (cw&&cw.newReports||[]).slice(0,3).forEach(r=>since.push({tone:r.urgent?'r':'a',html:`New problem report: <b>${escapeHtml(r.label)}</b>${r.by?' ('+escapeHtml(r.by)+')':''}`}));
  farmLoads.filter(l=>l.date&&iso(dateOnly(l.date))===iso(addDays(today,-1))).forEach(l=>{const gs=[1,2,3,4].filter(g=>Number(l.splitKg&&l.splitKg[g])>0).map(g=>pairLabel(g)).join(', ');
    since.push({tone:'g',html:`Load ${mgrT(l.actualKg!=null?Number(l.actualKg):Number(l.plannedKg)||0)} delivered${gs?' → '+escapeHtml(gs):''}${l.actualKg==null?' (docket weight still to enter)':''}`});});
  // trends (Ross words them into warnings; shown as they are without AI)
  const trends=[];
  sh.forEach(s=>{const ks=Object.keys(hist).sort().slice(-4);if(ks.length<4)return;const v=ks.map(k=>hist[k].mort[s.id]).concat([Math.max(0,Number(s.mortality)||0)]);if(v.some(x=>x==null))return;
    const d=v.slice(1).map((x,i)=>x-v[i]);if(d.length>=3&&d.slice(-3).every((x,i,a)=>i===0||x>a[i-1]))trends.push({tone:'a',text:`Shed ${s.id} daily mortality up three days running`});});
  silos.filter(x=>x.dep&&x.days<=4).forEach(x=>trends.push({tone:x.days<=2?'r':'a',text:`${pairLabel(x.g)} feed runs low ${fmtShortNoYear(x.dep)} (${x.days} days of cover)`}));
  (cw&&cw.recurring||[]).slice(0,2).forEach(r=>trends.push({tone:'a',text:`${r.label} reported ${r.n} times this month`}));
  (cw&&cw.urgent||[]).filter(r=>r.days>=3).slice(0,2).forEach(r=>trends.push({tone:r.urgent?'r':'a',text:`${r.label} — ${r.status.toLowerCase()} for ${r.days} days`}));
  (cw&&cw.prep||[]).forEach(p=>{if(!p.chicks)return;const dn=mgrDays(today,dateOnly(new Date(p.chicks+'T00:00:00'))),left=p.total-p.done;if(left>0&&dn>0&&left/dn>1)trends.push({tone:'a',text:`Shed ${p.shed} prep needs about ${Math.ceil(left/dn)} jobs a day to be ready for chicks`});});
  // week ahead
  const week=days.map((x,i)=>{const ev=[];x.pick.forEach(p=>ev.push({k:'p',t:`${p.final?'Final ':''}Pickup S${p.shed}`}));
    x.loads.forEach(l=>ev.push({k:'f',t:`Load ${mgrT(l.actualKg!=null?Number(l.actualKg):Number(l.plannedKg)||0)}`}));
    (farmData.sheds||[]).forEach(s=>{if(!s.closed&&s.cleanoutDate&&iso(dateOnly(s.cleanoutDate))===iso(x.date))ev.push({k:'c',t:`S${s.id} clean-out`});});
    (cw&&cw.prep||[]).forEach(p=>{if(p.chicks===iso(x.date))ev.push({k:'p',t:`Chicks S${p.shed}`});});
    const nt=cw&&cw.perDay?cw.perDay[iso(x.date)]||0:0;if(nt)ev.push({k:'k',t:`${nt} task${nt===1?'':'s'}`});
    return {date:x.date,ev,busy:ev.length>=3||nt>=10};});
  return {T,cw,facts,kpi,sheds,crew,since,trends,week,wx:cw&&cw.wx||[]};
}
function rsContext(d){
  const L=[];
  L.push('FACTS (red = act today, amber = watch, blue = info, green = fine):',...d.facts.map(f=>`${f.id} [${{r:'red',a:'amber',b:'blue',g:'green'}[f.tone]}] ${f.grp}: ${f.text}`));
  L.push('KEY NUMBERS:',...d.kpi.map(k=>`- ${k.k}: ${String(k.v).replace(/<[^>]+>/g,'')} (${String(k.s).replace(/<[^>]+>/g,'')})`));
  L.push('SHEDS:',...d.sheds.map(s=>`- Shed ${s.id}: ${s.fact}`));
  if(d.crew.length)L.push('CREW TODAY:',...d.crew.map(c=>`- ${c.who||'Not assigned'}: ${c.list.map(x=>x.name+(x.od?' (overdue)':'')+(x.done?' (done)':'')).join(', ')}`));
  if(d.since.length)L.push('SINCE YESTERDAY:',...d.since.map(x=>'- '+x.html.replace(/<[^>]+>/g,'')));
  if(d.trends.length)L.push('TRENDS:',...d.trends.map(t=>'- '+t.text));
  L.push('WEEK AHEAD:',...d.week.map(w=>`- ${fmtShortNoYear(w.date)}: ${w.ev.map(e=>e.t).join(', ')||'nothing booked'}`));
  if(d.wx.length)L.push('WEATHER:',...d.wx.map(w=>`- ${fmtShortNoYear(new Date(w.date+'T00:00:00'))}: ${w.maxT} / ${w.minT}, ${w.label}${w.rain!=null?', rain '+Math.round(w.rain)+'%':''}${w.wind!=null?', wind '+Math.round(w.wind)+' km/h':''}${w.alerts.length?' — '+w.alerts.join(', '):''}`));
  return L.join('\n');
}

// ---------- the report ----------
const RS_TABS=[['ov','Overview'],['plan',"Today's plan"],['sheds','Sheds'],['crew','Crew'],['since','Since yesterday'],['warn','Warnings'],['week','Week ahead'],['wx','Weather']];
function rsHtml(st,d){
  const now=new Date(),who=aiName(),w0=d.wx[0],tm=new Date(st.at||Date.now()).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});
  let bd='';try{const pl=mgrPlaced();if(pl.length){const first=pl.map(s=>dateOnly(s.placementDate)).reduce((a,b)=>b<a?b:a);bd=`Batch ${escapeHtml(String(predState.batchNumber||farmData.batchNumber||''))} · day ${Math.max(0,mgrDays(first,mgrToday()))}`;}}catch(e){}
  const meta=[bd,w0?`${escapeHtml(w0.maxT)} / ${escapeHtml(w0.minT)}${w0.label?', '+escapeHtml(w0.label.toLowerCase()):''}`:'',`prepared${who?' for '+escapeHtml(who):''} at ${tm}`].filter(Boolean).join(' · ');
  const M=st.main,S=st.sheds&&st.sheds.sheds?st.sheds.sheds:{},busy=st.busy,tag='<span class="rs-tag">Ross</span>';
  const rossBox=(inner)=>`<div class="rs-ross"><span class="rs-av">${ROSS_SVG}</span><div class="rs-bx">${inner}</div></div>`;
  const loading='<div class="rs-load"><i></i><i></i><i></i></div>';
  // overview
  let ov='';
  if(M&&M.overview)ov=rossBox(`<small>Ross <i>AI · check before acting</i></small><p>${rsInl(M.overview)}</p>`);
  else if(busy)ov=rossBox(`<small>Ross <i>writing…</i></small>${loading}`);
  else ov=rossBox(`<small>Ross <i>${escapeHtml(st.err||'not available')}</i></small><p class="rs-muted">Here are today's numbers and lists without Ross's notes.</p>`);
  // plan
  const byId=Object.fromEntries(d.facts.map(f=>[f.id,f]));
  let plan=(M&&Array.isArray(M.plan)?M.plan:[]).map(p=>({f:byId[String(p.fact||'')]||null,title:String(p.title||''),why:String(p.why||'')})).filter(p=>p.title).slice(0,5);
  const aiPlan=plan.length>0;
  if(!aiPlan)plan=d.facts.filter(f=>f.tone==='r').concat(d.facts.filter(f=>f.tone==='a')).slice(0,5).map(f=>({f,title:f.text,why:''}));
  const planHtml=plan.length?plan.map((p,i)=>{const tone=p.f?p.f.tone:'r',go=p.f?rsGo(p.f.act):'';const inner=`<span class="rs-n ${tone==='a'?'a':tone==='b'||tone==='g'?'b':''}">${i+1}</span><span><b>${rsInl(p.title)}</b>${p.why?`<span class="rs-why">${rsInl(p.why)}</span>`:''}</span><span class="rs-go">${go?escapeHtml(go)+' ›':''}</span>`;
    return p.f&&p.f.act?`<button type="button" class="rs-act" data-rs-go ${p.f.act}>${inner}</button>`:`<div class="rs-act">${inner}</div>`;}).join(''):'<p class="rs-muted">Nothing urgent today — every shed, silo and task is on track.</p>';
  // sheds
  const shedHtml=d.sheds.map(s=>`<div class="rs-sh ${s.tone}"><span class="rs-no">${s.id}</span><div><b>${escapeHtml(s.head)}</b><p>${S[String(s.id)]?rsInl(S[String(s.id)]):busy?'<span class="rs-muted">…</span>':escapeHtml(s.fact.replace(/^Day \d+, /,''))}</p></div></div>`).join('');
  // crew
  const crewHtml=d.cw?(d.crew.length?`<div class="rs-crew">${d.crew.map(c=>`<div class="rs-cw${c.who?'':' none'}"><div class="rs-who">${c.who?`<i style="background:${rsColor(c.who)}">${escapeHtml(c.who.slice(0,1).toUpperCase())}</i>`:''}<b>${c.who?escapeHtml(c.who):'Not assigned'}</b><em class="${c.open>=6?'hi':''}">${c.open} open</em></div><ul>${c.list.slice(0,6).map(x=>`<li class="${x.done?'done':''}">${escapeHtml(x.name)}${x.od?' <span class="rs-od">overdue</span>':''}</li>`).join('')}${c.list.length>6?`<li class="rs-muted">+${c.list.length-6} more</li>`:''}</ul></div>`).join('')}</div>`:'<p class="rs-muted">No tasks on today.</p>')+(M&&M.crew?rossBox(`<p>${rsInl(M.crew)}</p>`):''):'<p class="rs-muted">Tasks hasn\'t loaded yet.</p>';
  const li=(x)=>`<div class="rs-li"><span class="rs-d ${x.tone}"></span><span>${x.html}</span></div>`;
  const sinceHtml=d.since.length?d.since.map(li).join(''):'<p class="rs-muted">Ross compares from tomorrow — today\'s figures are saved on this device.</p>';
  const warns=M&&Array.isArray(M.warnings)&&M.warnings.length?M.warnings.slice(0,4).map(t=>({tone:'a',html:rsInl(t)})):d.trends.map(t=>({tone:t.tone,html:escapeHtml(t.text)}));
  const warnHtml=warns.length?warns.map(li).join(''):'<p class="rs-muted">No risks building up.</p>';
  const WD=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const weekHtml=`<div class="rs-week">${d.week.map(w=>`<div class="rs-wd${w.busy?' busy':''}"><b>${WD[w.date.getDay()]} ${w.date.getDate()}</b>${w.ev.map(e=>`<div class="rs-ev ${e.k}">${escapeHtml(e.t)}</div>`).join('')||'<div class="rs-ev">—</div>'}</div>`).join('')}</div>`;
  const hot=d.wx.filter(w=>w.alerts.length);
  const wxHtml=(M&&M.weather?`<div class="rs-wx"><span class="rs-wxi">${escapeHtml((hot[0]||d.wx[0]||{}).icon||'🌤')}</span><div>${hot.length?`<b>${escapeHtml(hot.map(w=>fmtShortNoYear(new Date(w.date+'T00:00:00'))+': '+w.alerts.join(', ')).join(' · '))}</b>`:''}<p>${rsInl(M.weather)}</p></div></div>`:'')
    +(d.wx.length?`<div class="rs-wxrow">${d.wx.map(w=>`<span class="${w.alerts.length?'al':''}" title="${escapeAttr(w.label+(w.alerts.length?' — '+w.alerts.join(', '):''))}"><b>${WD[new Date(w.date+'T00:00:00').getDay()]}</b>${escapeHtml(w.icon)}<i>${escapeHtml(w.maxT)}</i></span>`).join('')}</div>`:'<p class="rs-muted">No weather location set (Tasks › Settings › Weather).</p>');
  const sec=(id,title,ai,body)=>`<section class="rs-sec" id="rs-${id}"><h3>${title}${ai?tag:''}</h3>${body}</section>`;
  return `<div class="rs-h"><div class="rs-ht"><span class="rs-mark">${ROSS_SVG}</span><div class="rs-t"><small>Ross · morning report</small><h2 id="rsTitle">${escapeHtml(now.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'}))}</h2><div class="rs-m">${meta}</div></div><button type="button" class="rs-x" data-rs-close aria-label="Close" title="Close">✕</button></div>
      <nav class="rs-nav" aria-label="Sections">${RS_TABS.map(([k,l],i)=>`<button type="button" data-rs-tab="${k}" class="${i===0?'on':''}">${l}</button>`).join('')}</nav></div>
    <div class="rs-scroll" id="rsScroll">
      <div class="rs-kpi">${d.kpi.map(k=>`<div><span>${escapeHtml(k.k)}</span><b>${k.v}</b><em class="${k.tone||''}">${k.s}</em></div>`).join('')}</div>
      <div class="rs-b">
        <section class="rs-sec" id="rs-ov">${ov}</section>
        ${sec('plan',"Today's plan",aiPlan,planHtml)}
        ${sec('sheds','Sheds',!!st.sheds,`<div class="rs-sheds">${shedHtml}</div>`)}
        ${sec('crew','Crew today',!!(M&&M.crew),crewHtml)}
        <div class="rs-two">${sec('since','Since yesterday',false,sinceHtml)}${sec('warn','Warnings',!!(M&&M.warnings&&M.warnings.length),warnHtml)}</div>
        ${sec('week','Week ahead',false,weekHtml)}
        ${sec('wx','Weather',!!(M&&M.weather),wxHtml)}
      </div>
      <div class="rs-f"><span>Numbers from ProdWise${d.cw?' and Tasks':''} at ${tm} · Ross is AI — check before acting${aiLeft!=null?' · '+aiLeft+' AI requests left today':''}</span><label class="rs-on"><input type="checkbox" data-rs-on ${rsOn()?'checked':''}> Show at 7:00</label><button type="button" class="rs-done" data-rs-close>Done</button></div>
    </div>`;
}
let rsTabLock=0;   // a tapped tab stays lit while the report scrolls to it
function rsEnsureDom(){
  if(document.getElementById('rsModal'))return;
  document.body.insertAdjacentHTML('beforeend',`<div class="rs-scrim" id="rsModal" aria-hidden="true"><div class="rs" role="dialog" aria-modal="true" aria-labelledby="rsTitle"><div id="rsInner"></div></div></div>`);
  const m=document.getElementById('rsModal');
  m.addEventListener('click',e=>{
    if(e.target===m||e.target.closest('[data-rs-close]')){rsClose();return;}
    const t=e.target.closest('[data-rs-tab]');if(t){const sc=document.getElementById('rsScroll'),el=document.getElementById('rs-'+t.dataset.rsTab);if(sc&&el){rsTabLock=Date.now();m.querySelectorAll('[data-rs-tab]').forEach(b=>b.classList.toggle('on',b===t));sc.scrollTo({top:sc.scrollTop+el.getBoundingClientRect().top-sc.getBoundingClientRect().top-8,behavior:'smooth'});}return;}
    if(e.target.closest('[data-rs-go]'))rsClose();
  });
  m.addEventListener('change',e=>{if(e.target.matches('[data-rs-on]')){try{localStorage.setItem('pw-greet-on',e.target.checked?'1':'0');}catch(er){}}});
  m.addEventListener('scroll',e=>{const sc=e.target;if(sc.id!=='rsScroll'||Date.now()-rsTabLock<900)return;const top=sc.getBoundingClientRect().top;let cur=RS_TABS[0][0];
    RS_TABS.forEach(([k])=>{const el=document.getElementById('rs-'+k);if(el&&el.getBoundingClientRect().top-top<=60)cur=k;});
    if(sc.scrollTop+sc.clientHeight>=sc.scrollHeight-4)cur=RS_TABS[RS_TABS.length-1][0];   // at the bottom: the last section
    m.querySelectorAll('[data-rs-tab]').forEach(b=>b.classList.toggle('on',b.dataset.rsTab===cur));},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&m.classList.contains('open'))rsClose();});
}
function rsPaint(st,d){const inner=document.getElementById('rsInner');if(!inner)return;const sc=document.getElementById('rsScroll'),top=sc?sc.scrollTop:0;inner.innerHTML=rsHtml(st,d);const s2=document.getElementById('rsScroll');if(s2)s2.scrollTop=top;}
async function rsOpen(){
  if(!farmData)return;
  rsEnsureDom();rsSnap();
  const m=document.getElementById('rsModal');
  let st=rsLoad();st.seen=true;if(!st.at)st.at=Date.now();rsSave(st);rsDot();
  let d=rsData();const need=!st.main&&!st.err;
  st.busy=need;rsPaint(st,d);m.classList.add('open');m.setAttribute('aria-hidden','false');
  if(!need)return;
  if(!rsTasksReady()){if(typeof pwEnsureTasksFrame==='function')pwEnsureTasksFrame(()=>{});await rsWaitTasks(12000);d=rsData();rsPaint(st,d);}
  const ctx=rsContext(d);
  const [a,b]=await Promise.all([
    aiCall({mode:'ross',part:'main',name:aiName(),context:ctx}).then(j=>({ok:aiJson(j.text)})).catch(e=>({err:aiErrText(e)})),
    aiCall({mode:'ross',part:'sheds',context:d.sheds.map(s=>`Shed ${s.id}: ${s.fact}`).join('\n')}).then(j=>({ok:aiJson(j.text)})).catch(e=>({err:aiErrText(e)}))]);
  st=rsLoad();st.busy=false;
  if(a.ok&&(a.ok.overview||a.ok.plan))st.main=a.ok;else st.err=a.err||'Ross\'s notes didn\'t come through today';
  if(b.ok&&b.ok.sheds)st.sheds=b.ok;
  rsSave(st);
  if(m.classList.contains('open'))rsPaint(st,rsData());
}
function rsClose(){const m=document.getElementById('rsModal');if(!m)return;m.classList.remove('open');m.setAttribute('aria-hidden','true');}
function rsDot(){const on=!!farmData&&new Date().getHours()>=7&&!rsLoad().seen;const d=document.getElementById('rossDot');if(d)d.hidden=!on;try{cwFrame&&cwFrame.contentWindow&&cwFrame.contentWindow.__cwRossDot&&cwFrame.contentWindow.__cwRossDot(on);}catch(e){}}
function rsPlaceButton(){
  if(document.getElementById('rossBtn'))return;
  const bell=document.querySelector('#pageHeader .alerts-bell-wrap');if(!bell)return;
  bell.insertAdjacentHTML('beforebegin',`<button type="button" class="ross-btn" id="rossBtn" title="Ross · morning report" aria-label="Ross · morning report"><span class="ross-mk">${ROSS_SVG}</span><span class="ross-l">Ross</span><span class="ross-dot" id="rossDot" hidden></span></button>`);
  document.getElementById('rossBtn').addEventListener('click',rsOpen);
}
window.pwOpenRoss=()=>rsOpen();   // Tasks' Ross button
let rsTried=false;
function rsMaybeShow(){
  if(rsTried||!farmData||!aiFarm()||!rsOn()||new Date().getHours()<7)return;
  if(rsLoad().seen)return;
  rsTried=true;
  const go=()=>{try{rsOpen();}catch(e){}};
  if(typeof pwEnsureTasksFrame==='function')pwEnsureTasksFrame(()=>{});
  rsWaitTasks(15000).then(go);   // the report waits for Tasks' data (or 15 s), then opens
}
document.addEventListener('DOMContentLoaded',()=>{rsPlaceButton();rsDot();setTimeout(rsMaybeShow,2500);});
setInterval(()=>{if(document.visibilityState!=='visible')return;rsPlaceButton();rsDot();rsMaybeShow();},30000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){rsTried=false;setTimeout(rsMaybeShow,1500);}});
