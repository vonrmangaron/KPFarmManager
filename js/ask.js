// ── Plumo — the farm's AI and its morning report (2026-10-25, mockup G9Akjz37VWHJTHyL9g2MTL) ────────────────
// Called Ross until 2026-10-29, Cluck until 2026-10-31, now Plumo. One detailed report covering Production and Tasks pops up once a day from 7:00 and
// reopens from the Plumo button in the header (and in Tasks). The numbers, lists, week strip and "since yesterday"
// come straight from the apps; Plumo (free AI on the farm's Cloudflare account, workers/prodwise-ai.js) writes the
// overview, the ranked plan with reasons, a note per shed, the crew note, warnings and weather advice — two AI
// requests a morning, saved for the day. With no AI (offline, not set up, allowance used) every section still
// shows its facts; only Plumo's sentences are missing. Replaces the Daily report and the per-page Summarise.
const AI_WORKER_URL='https://prodwise-ai.vonrmangaron.workers.dev';
const ROSS_SVG='<svg viewBox="0 0 140 156" aria-hidden="true"> <ellipse class="rz-shadow" cx="70" cy="148" rx="36" ry="6" fill="#000"/> <g class="rz-float"> <g class="rz-comb"> <path d="M44 34C36 18 48 4 66 6c-4-6 4-8 10-4 10-4 24 2 30 12 8-2 16 4 16 12-8-4-16-2-22 4-8-6-20-8-30-4-10-4-20 0-26 8z" fill="#E8392F" stroke="#1D2240" stroke-width="3.4" stroke-linejoin="round"/> <path d="M58 16c8-6 22-6 30 0M92 12c8 0 14 4 18 10" stroke="#FF8478" stroke-width="3.4" fill="none" stroke-linecap="round"/></g> <path d="M20 74c0-32 22-50 50-50s50 18 50 50c0 30-22 54-50 54S20 104 20 74z" fill="#FFFFFF" stroke="#1D2240" stroke-width="3.8"/> <path d="M32 100c9 15 22 23 38 23s30-8 38-23" stroke="#DCE8F5" stroke-width="7" fill="none" stroke-linecap="round"/> <path d="M104 44c6 6 10 14 11 24" stroke="#E8F0FA" stroke-width="5" fill="none" stroke-linecap="round"/> <path class="rz-visor" d="M8 54c0-4 3-7 7-7l116-6c5 0 8 4 7 8l-7 26c-1 5-5 8-10 8l-98 2c-6 0-10-4-11-9z" fill="#22284F" stroke="#1D2240" stroke-width="3.6" stroke-linejoin="round"/> <path class="rz-vglow" d="M14 56c0-3 2-5 5-5l108-5c3 0 5 2 4 5l-5 20c-1 3-3 5-6 5l-92 2c-3 0-6-2-7-5z" fill="#4FD1FF" opacity=".16"/> <path d="M28 51l16-1-12 32-10 0zM50 50l7 0-12 31-7 0z" fill="#fff" opacity=".13"/> <g class="rz-e rz-eCalm"><g class="rz-look"><rect class="rz-eye" x="36" y="56" width="18" height="17" rx="8.5" fill="#7FE3FF"/><rect class="rz-eye" x="88" y="54" width="18" height="17" rx="8.5" fill="#7FE3FF"/> <circle cx="41.5" cy="60.5" r="3" fill="#fff"/><circle cx="93.5" cy="58.5" r="3" fill="#fff"/></g></g> <g class="rz-e rz-eHappy" fill="none" stroke="#5CF0B5" stroke-width="5" stroke-linecap="round"><path d="M36 70q9-13 18 0"/><path d="M88 68q9-13 18 0"/></g> <g class="rz-e rz-eWorry" fill="#FF8A95"><path d="M34 58l21 6v9H34z"/><path d="M108 56l-21 6v9h21z"/></g> <g class="rz-e rz-eSleep" stroke="#5E6A8C" stroke-width="5" stroke-linecap="round"><path d="M36 65h18M88 63h18"/></g> <g class="rz-load"><rect x="52" y="76" width="38" height="3.5" rx="1.75" fill="#2C3566"/><rect class="rz-bar" x="63" y="76" width="16" height="3.5" rx="1.75" fill="#7FE3FF"/></g> <path d="M58 82c5-5 19-5 24 0l-12 14z" fill="#FF9A2E" stroke="#1D2240" stroke-width="3.2" stroke-linejoin="round"/> <path class="rz-bLow" d="M62 93h16l-8 8z" fill="#E77A16" stroke="#1D2240" stroke-width="2.8" stroke-linejoin="round"/> <path d="M61 99c-5 11-2 22 7 24 2-6 2-10 2-13 0 3 0 7 2 13 9-2 12-13 7-24z" fill="#E8392F" stroke="#1D2240" stroke-width="3.2" stroke-linejoin="round"/> <g class="rz-zz"><text x="118" y="34" style="font:800 15px Sora,sans-serif;fill:#C9D2E3">z</text><text x="130" y="18" style="font:800 12px Sora,sans-serif;fill:#C9D2E3">z</text></g> </g></svg>';   // the robot-chicken face (mockup 1siPonVecvHoJadyWNYaTM); moods are classes on .rossR
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
function aiResetTime(){const n=new Date(),u=new Date(Date.UTC(n.getUTCFullYear(),n.getUTCMonth(),n.getUTCDate()+1));return fmtClock(u);}
function aiErrText(e){
  if(!navigator.onLine)return 'Plumo is offline — the AI needs the internet.';
  if(e&&e.limit)return `Plumo is resting until ${aiResetTime()} (free AI allowance used up).`;
  if(e&&(e.setup||e.status===404||e.status===undefined))return 'Plumo isn\'t set up on Cloudflare yet (prodwise-ai worker).';
  if(e&&e.status===403)return 'Only the manager can use Plumo on this farm.';
  return 'Plumo didn\'t answer just now.';
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
// Wait (up to ms) until Tasks has its farm data in, so Plumo never writes the day's report without the tasks
function rsTasksReady(){try{const w=cwFrame&&cwFrame.contentWindow;return !!(w&&w.__cwRoss&&w.__cwReady);}catch(e){return false;}}
function rsWaitTasks(ms){return new Promise(res=>{const t0=Date.now();const tick=()=>{if(rsTasksReady()||Date.now()-t0>ms)res(rsTasksReady());else setTimeout(tick,250);};tick();});}
function rsCw(){try{const w=cwFrame&&cwFrame.contentWindow;return w&&typeof w.__cwRoss==='function'?w.__cwRoss():null;}catch(e){return null;}}

// ---------- the facts (straight from the apps) ----------
function rsGo(act){
  const a=String(act||'');
  if(/data-mgr-loads/.test(a))return 'Feed loads';if(/data-mgr-silo/.test(a))return 'Silo reading';if(/data-mgr-pickups/.test(a))return 'Pickups';if(/data-mgr-mort/.test(a))return 'Mortality';
  if(/data-brief-cw="prep"/.test(a))return 'Shed prep';if(/data-brief-cw/.test(a))return 'Tasks';
  let m=a.match(/data-brief-pair="\d+:(\d+)"/);if(m)return 'Shed '+m[1];
  m=a.match(/data-tab="g(\d)"/);if(m)return pairLabel(Number(m[1]));return '';
}
function rsData(){
  const today=mgrToday(),T=iso(today),cw=rsCw();
  const b=typeof mgrBriefData==='function'?mgrBriefData():{G:{today:[],watch:[],feed:[],co:[]},cw:null};
  const facts=[];let n=0;
  [['Today',b.G.today],['Watch',b.G.watch],['Feed',b.G.feed],['Changeover & prep',b.G.co]].forEach(([g,a])=>a.forEach(x=>facts.push({id:'F'+(++n),grp:g,tone:x.tone,html:x.html,act:x.act,job:!!x.job,text:x.html.replace(/<[^>]+>/g,'').replace(/&amp;/g,'&')})));
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
      return {id,tone:'b',pct:pr&&pr.total?pr.done/pr.total:0,head:pr?`Empty · prep ${pr.done} of ${pr.total}`:'Empty',fact:pr?`Empty, prep ${pr.done} of ${pr.total} jobs${dn!=null?', chicks in '+dn+' days':''}${pr.left.length?', left: '+pr.left.join(', '):''}`:'Empty'};}
    const age=ageInDays(s,today),pop=Number(s.initialPopulation)||0,m=Math.max(0,Number(s.mortality)||0),pc=pop?m/pop*100:0;
    let dv=null;try{const f=currentShedWeightEstimate(s,today);if(f&&f.kg!=null)dv=daysVsTarget(age,f.kg);}catch(e){}
    const dvt=dv==null?'':Math.abs(dv)<0.5?'on target':dv>0?`${dv.toFixed(1)} d ahead`:`${(-dv).toFixed(1)} d behind`;
    const out1=clean?mgrDays(today,clean):null,nx=mgrComingPickups(s)[0],sev=dv==null?'ok':daysBehindSeverity(dv);
    const mDay=yd&&yd.mort[id]!=null?m-yd.mort[id]:null;
    const tone=pickToday.has(id)?'r':sev==='bad'?'a':out1!=null&&out1<=1?'b':'g';
    const head=`Day ${age}${dvt?' · '+dvt:''}${pickToday.has(id)?' · pickup today':out1===0?' · clean-out today':out1===1?' · out tomorrow':''}`;
    const span=clean?mgrDays(placedD,clean):0;
    return {id,tone,head,pct:span>0?Math.min(1,age/span):0,fact:`Day ${age}, ${dvt||'no weight yet'}, mortality ${pc.toFixed(2)}%${mDay!=null?' ('+(mDay>=0?'+':'')+mDay+' since yesterday)':''}${pickToday.has(id)?', pickup today':''}${nx&&!pickToday.has(id)?', next pickup '+fmtShortNoYear(nx.date)+' '+nx.birds.toLocaleString('en-US')+' birds':''}${clean?', clean-out '+fmtShortNoYear(clean):''}`};
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
  // trends (Plumo words them into warnings; shown as they are without AI)
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
// Everything Plumo reads besides the alert lines (2026-10-29): batches, feed and silos per pair, next batch's Starter,
// loads, clean-outs and placements, mortality and performance per shed. Plain text, kept short (the worker clips at 16k).
function rsFarmSheet(d){
  const today=mgrToday(),L=[],t1=kg=>((Number(kg)||0)/1000).toFixed(1)+' t',D=x=>x?fmtShortNoYear(x):'—',safe=f=>{try{f();}catch(e){}};
  const cur=String(currentBatchKey()||''),list=typeof pwRunningList==='function'?pwRunningList():[];
  const nb=(typeof pwRunOthers!=='undefined'&&Array.isArray(pwRunOthers)?pwRunOthers:[]).find(o=>o&&o.newest&&String(o.key).toLowerCase()!==cur.toLowerCase());
  safe(()=>{L.push('BATCHES:');list.forEach(b=>L.push(`- ${b.key}${b.key===cur?' (open in the app)':''}: ${b.placedNow} of ${b.planned} sheds placed${b.firstPlace?', placements '+D(b.firstPlace)+(b.lastPlace&&+b.lastPlace!==+b.firstPlace?'–'+D(b.lastPlace):''):''}${b.firstOut?', clean-outs '+D(b.firstOut)+(b.lastOut&&+b.lastOut!==+b.firstOut?'–'+D(b.lastOut):''):''}${b.day!=null?', day '+b.day:''}`));
    if(!list.length)L.push('- '+(cur||'current batch'));if(!nb)L.push('- Next batch file: not found in the cloud yet (Starter orders for it cannot be checked)');});
  // Feed per pair
  safe(()=>{L.push('FEED AND SILOS (per pair of sheds, 3 silos each):');
    [1,2,3,4].forEach(g=>{const sh=shedsForGroup(g).filter(s=>s.placementDate);if(!sh.length)return;
      if(typeof pairAllClosed==='function'&&pairAllClosed(g)){L.push(`- ${pairLabel(g)}: both sheds closed, batch finished here`);return;}
      const r=latestReading(g),out=[];
      if(r){let now=null;safe(()=>{const pl=siloLevelPlan(g,{until:addDays(today,1)});now=pl?siloPlanOn(pl,today)||pl.start:null;});
        const kg=now?now.kg:[r.silo1Rings,r.silo2Rings,r.silo3Rings].map(ringsToKg),op=now&&now.open||[];
        out.push(`read ${D(dateOnly(r.date))} ${readingIsMorning(r)?'am':'pm'}; now about `+[0,1,2].map(i=>`Silo ${siloNumber(g,i+1)} ${t1(kg[i])}${op.includes(i+1)?' (open)':''}${starterSiloOf(g)===i+1?' (starter silo)':''}`).join(', ')+` = ${t1(kg[0]+kg[1]+kg[2])}`);}
      else out.push('no silo reading this batch');
      out.push(`eating ${t1(groupDailyFeedOn(sh,today))}/day`);
      const o=mgrSiloOutlook().find(x=>x.g===g);
      if(o&&o.dep)out.push(`runs low ${D(o.dep)} (in ${o.days} d) with the loads booked; still feeding then: ${o.feeding.length?o.feeding.map(i=>'Shed '+i).join(', '):'none — birds out for clean-out'}`);else out.push('covered for 60+ days');
      const f=typeof feedToOrderForGroup==='function'?feedToOrderForGroup(g):null;if(f)out.push(`to clean-out ${D(f.end)}: need ${t1(f.needExp)}, have ${t1(f.stock)} + booked ${t1(f.booked)} → ${f.expected>0?'order '+t1(f.expected)+' more':'left over '+t1(f.leftoverExp)}`);
      const st=typeof starterSiloStatus==='function'?starterSiloStatus(g):null;
      if(st)out.push(`starter silo: ${st.silo?'Silo '+siloNumber(g,st.silo):'not chosen'} — ${({pick:'not chosen yet',ready:'empty and ready',ontrack:'on track to be empty '+D(st.emptyOn),action:(st.late?'too full, open it now':'open it by '+D(st.openBy))+' ('+t1(st.kg)+' in it)',noreading:'no reading to check',watch:'empty but other feed is booked into it'})[st.state]||st.state}${st.inWin?'':' (checked from '+D(st.win)+')'}`);
      const nbs=nb?(nb.starter||[]).filter(l=>Number(l.splitKg&&l.splitKg[g])>0):[];
      if(nb)out.push(nbs.length?`next batch ${nb.key} Starter ordered: `+nbs.map(l=>`${D(dateOnly(l.date))} ${t1(l.splitKg[g])}`).join(', '):`next batch ${nb.key} Starter: NOT ordered yet`);
      L.push(`- ${pairLabel(g)}: `+out.join('; '));});});
  // Loads
  safe(()=>{const up=farmLoads.filter(l=>l.date&&dateOnly(l.date)>=today&&dateOnly(l.date)<=addDays(today,21)).sort((a,b)=>dateOnly(a.date)-dateOnly(b.date));
    L.push('FEED LOADS BOOKED (next 3 weeks):',...(up.length?up.map(l=>`- ${D(dateOnly(l.date))}: ${feedTypeLabel(l.feedType)} ${t1(l.actualKg!=null?l.actualKg:l.plannedKg)} → `+[1,2,3,4].filter(g=>Number(l.splitKg&&l.splitKg[g])>0).map(g=>`${pairLabel(g)} ${t1(l.splitKg[g])}${loadSilosFor(l,g).length?' into '+loadSilosFor(l,g).map(n=>'Silo '+siloNumber(g,n)).join('+'):''}`).join(', ')):['- none']));
    const sm=farmLoadsSummary();L.push(`- this batch so far: ${sm.total} loads, ${t1(sm.deliveryKg)}; ${sm.needsActual} past load(s) without docket weight`);
    const fo=farmFeedToOrder();if(fo)L.push(`- farm feed still to order to the last clean-out: ${t1(fo.expected)} (safe: ${t1(fo.safe)})`);});
  // Sheds
  safe(()=>{const hist=rsHist(),ks=Object.keys(hist).filter(k=>k<d.T).sort();
    L.push('SHEDS IN DETAIL (age, birds, mortality, weight vs the standard, feed conversion, pickups, clean-out, next placement):');
    const nrow=id=>{const n=list.length>1?list[list.length-1]:null;return n&&n.key!==cur?(n.rows||[]).find(r=>r.id===id):null;};
    (farmData.sheds||[]).forEach(s=>{const p=[],g=Math.ceil(s.id/2);
      if(!s.placementDate){p.push('not placed');}
      else{const age=ageInDays(s,today),pop=Number(s.initialPopulation)||0,m=Math.max(0,Number(s.mortality)||0),out=typeof shedOutDate==='function'?shedOutDate(s):null;
        if(s.closed)p.push(`closed (out ${D(out)})`);
        else if(dateOnly(s.placementDate)>today)p.push(`placement ${D(dateOnly(s.placementDate))}, ${pop.toLocaleString('en-US')} birds`);
        else{let pr=null;safe(()=>{pr=computePredictions(s,g);});
          p.push(`day ${age}, placed ${pop.toLocaleString('en-US')} on ${D(dateOnly(s.placementDate))}`);
          if(pr)p.push(`${Math.round(pr.liveNow).toLocaleString('en-US')} birds in now`);
          const daily=ks.slice(-6).map((k,i,a)=>{const nx=i<a.length-1?hist[a[i+1]].mort[s.id]:m;const v=hist[k].mort[s.id];return v==null||nx==null?null:nx-v;}).filter(x=>x!=null);
          p.push(`mortality ${m.toLocaleString('en-US')} (${pop?(m/pop*100).toFixed(2):'0'}%)${daily.length?', daily last days: '+daily.join(', '):''}${s.mortalityUpdatedAt?', entered '+D(dateOnly(s.mortalityUpdatedAt)):''}`);
          safe(()=>{const f=currentShedWeightEstimate(s,today);if(f&&f.kg!=null){const dv=daysVsTarget(age,f.kg);p.push(`weight ${f.kg.toFixed(2)} kg vs ${stdName()} ${stdWeightKg(age).toFixed(2)} kg${dv!=null?' ('+(Math.abs(dv)<0.5?'on target':dv>0?dv.toFixed(1)+' d ahead':(-dv).toFixed(1)+' d behind')+')':''}${f.isEstimate?f.basis==='curve'?' (estimated from the growth curve)':' (projected from the last pickup weighing)':' (weighed today)'}`);}});
          if(pr&&pr.fcr)p.push(`FCR ${Number(pr.fcr).toFixed(3)}, cFCR ${Number(pr.cfcr).toFixed(3)}, finish about day ${Math.round(pr.finalAge||0)} at ${Number(pr.estFinalALW||0).toFixed(2)} kg`);
          const done=(s.pickups||[]).filter(x=>x.date&&dateOnly(x.date)<=today&&Number(x.birds)>0);if(done.length)p.push(`${done.length} pickup(s) done, ${done.reduce((a,x)=>a+Number(x.birds),0).toLocaleString('en-US')} birds`);
          const nx=mgrComingPickups(s);if(nx.length)p.push('coming pickups '+nx.slice(0,3).map(x=>`${D(x.date)} ${x.birds.toLocaleString('en-US')}${x.planned?' (planned)':''}`).join(', '));
          if(out)p.push(`last birds out ${D(out)}${s.cleanoutDate?', clean-out '+D(dateOnly(s.cleanoutDate)):''}`);}}
      const n=nrow(s.id);if(n&&n.place){const out=s.placementDate&&typeof shedOutDate==='function'?shedOutDate(s):null;p.push(`next batch placement ${D(n.place)}${out?' ('+mgrDays(out,n.place)+' days after birds out)':''}`);}
      const pr=(d.cw&&d.cw.prep||[]).find(x=>String(x.shed)===String(s.id));if(pr)p.push(`shed prep ${pr.done} of ${pr.total} jobs${pr.left&&pr.left.length?' (left: '+pr.left.slice(0,4).join(', ')+')':''}`);
      L.push(`- Shed ${s.id}: `+p.join('; '));});});
  // Farm performance
  safe(()=>{const t=computeFarmTotals();if(!t||!t.hasData)return;
    L.push('FARM PERFORMANCE (this batch, projected to finish):',`- average weight ${Number(t.avgWeight).toFixed(2)} kg at day ${Number(t.weightedAge).toFixed(1)}, FCR ${Number(t.fcr).toFixed(3)}, cFCR2.45 ${Number(t.cfcr).toFixed(3)}, livability ${Number(t.livability).toFixed(1)}%, PEF ${Math.round(t.pif)}`);
    const lr=typeof lastHistoryRec==='function'?lastHistoryRec():null,lk=lr&&typeof historyKpis==='function'?historyKpis(lr):null;
    if(lk)L.push(`- last batch ${lr.batch||''}: average weight ${Number(lk.alw).toFixed(2)} kg, FCR ${Number(lk.fcr).toFixed(3)}, cFCR2.45 ${Number(lk.cfcr).toFixed(3)}, livability ${Number(lk.livability).toFixed(1)}%`);});
  return L.join('\n');
}
function rsContext(d){
  const L=[];
  L.push('YOUR NAME: you are Plumo, the farm AI (not Cluck, not Ross — Ross 308 is only the breed standard). Never call yourself Cluck or Ross.');
  L.push('PLAN TITLES: say plainly what to do about that FACT, naming the same shed numbers it names (a pair stays "Sheds 5–6" unless the fact names one shed). Never invent a different job such as "review the feeding plan". Never book feed for a shed that cleans out before its silos run low. Use FARM DATA for the numbers in each "why": feed, silos, the next batch Starter and starter silo, clean-outs, placements, mortality and performance.');
  L.push('FACTS (red = urgent, amber = soon, blue = info, green = fine). ONLY facts marked JOB can be plan items: feed ordering, the next batch Starter, tasks, records to enter (mortality, silo readings, dockets, kill sheets), shed prep, feed off. Growth vs target, mortality % and weather are never plan items — mention them in warnings or the overview only:',...d.facts.map(f=>`${f.id} [${{r:'red',a:'amber',b:'blue',g:'green'}[f.tone]}${f.job?', JOB':''}] ${f.grp}: ${f.text}`));
  const sheet=rsFarmSheet(d);if(sheet)L.push('FARM DATA (check every plan item against this before you write it):',sheet);
  L.push('KEY NUMBERS:',...d.kpi.map(k=>`- ${k.k}: ${String(k.v).replace(/<[^>]+>/g,'')} (${String(k.s).replace(/<[^>]+>/g,'')})`));
  L.push('SHEDS:',...d.sheds.map(s=>`- Shed ${s.id}: ${s.fact}`));
  if(d.crew.length)L.push('CREW TODAY:',...d.crew.map(c=>`- ${c.who||'Not assigned'}: ${c.list.map(x=>x.name+(x.od?' (overdue)':'')+(x.done?' (done)':'')).join(', ')}`));
  if(d.since.length)L.push('SINCE YESTERDAY:',...d.since.map(x=>'- '+x.html.replace(/<[^>]+>/g,'')));
  if(d.trends.length)L.push('TRENDS:',...d.trends.map(t=>'- '+t.text));
  L.push('WEEK AHEAD:',...d.week.map(w=>`- ${fmtShortNoYear(w.date)}: ${w.ev.map(e=>e.t).join(', ')||'nothing booked'}`));
  if(d.wx.length)L.push('WEATHER:',...d.wx.map(w=>`- ${fmtShortNoYear(new Date(w.date+'T00:00:00'))}: ${w.maxT} / ${w.minT}, ${w.label}${w.rain!=null?', rain '+Math.round(w.rain)+'%':''}${w.wind!=null?', wind '+Math.round(w.wind)+' km/h':''}${w.alerts.length?' — '+w.alerts.join(', '):''}`));
  return L.join('\n');
}

// ---------- the report (interactive, mockup V6iLPtGMo1DzNn2DiFgVkT) ----------
const RS_TABS=[['ov','Overview'],['plan',"Today's plan"],['sheds','Sheds'],['crew','Crew'],['since','Since yesterday'],['warn','Warnings'],['week','Week ahead'],['wx','Weather']];
const RS_WD=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function rsFace(mood,cls){return `<span class="rossR ${mood||'calm'}${cls?' '+cls:''}">${ROSS_SVG}</span>`;}
function rsFirst(t){t=String(t||'').trim();const m=t.match(/^.*?[.!?](\s|$)/);return (m?m[0]:t).trim();}
function rsTicksKey(){return 'pw-ross-ticks-'+aiSlug()+'-'+aiDay();}
function rsTicks(){try{return new Set(JSON.parse(localStorage.getItem(rsTicksKey())||'[]'));}catch(e){return new Set();}}
function rsSaveTicks(t){try{localStorage.setItem(rsTicksKey(),JSON.stringify([...t]));}catch(e){}}
// The report as data the UI and the walk-through both use
function rsModel(st,d){
  const M=st.main,S=st.sheds&&st.sheds.sheds?st.sheds.sheds:{};
  const byId=Object.fromEntries(d.facts.map(f=>[f.id,f]));
  // Today's plan: only job facts (feed ordering, starter, tasks, records, shed prep, feed off — 2026-10-29) become items;
  // growth, mortality % and weather stay watch items. One item per fact, red first, red/amber jobs the AI skipped are added back.
  const doable=f=>f&&f.job;
  const fixedTitle=f=>{const m=/^Feed off today · (.+?) · /.exec(f.text);return m?'Turn the feed off · '+m[1]:'';};
  const seenF=new Set();
  let plan=(M&&Array.isArray(M.plan)?M.plan:[]).map(p=>({f:byId[String(p.fact||'').trim().toUpperCase()]||null,title:String(p.title||'').trim(),why:String(p.why||'').trim()}))
    .filter(p=>p.title&&doable(p.f)&&!seenF.has(p.f.id)&&seenF.add(p.f.id))
    .map(p=>({...p,title:fixedTitle(p.f)||p.title}));
  d.facts.filter(f=>f.job&&(f.tone==='r'||f.tone==='a')&&!seenF.has(f.id)).forEach(f=>plan.push({f,title:fixedTitle(f)||f.text,why:''}));
  plan=plan.map((p,i)=>({p,i})).sort((a,b)=>(({r:0,a:1}[a.p.f.tone]??2)-({r:0,a:1}[b.p.f.tone]??2))||a.i-b.i).map(x=>x.p).slice(0,5);
  const aiPlan=plan.some(p=>p.why);
  if(!plan.length)plan=d.facts.filter(f=>f.job).slice(0,5).map(f=>({f,title:f.text,why:''}));
  const warns=M&&Array.isArray(M.warnings)&&M.warnings.length?M.warnings.slice(0,4).map(t=>({tone:'a',html:rsInl(t),text:String(t)})):d.trends.map(t=>({tone:t.tone,html:escapeHtml(t.text),text:t.text}));
  const red=d.facts.some(f=>f.tone==='r'),amber=d.facts.some(f=>f.tone==='a');
  const ticks=rsTicks(),allDone=plan.length>0&&plan.every((p,i)=>ticks.has(i));
  const mood=st.busy?'thinking':allDone?'happy':red?'alert':(!M&&st.err)?'rest':amber?'calm':'happy';
  const busiest=d.week.slice().sort((x,y)=>y.ev.length-x.ev.length)[0];
  const sheds=d.sheds.map(s=>({...s,note:S[String(s.id)]||''}));
  const nTone=t=>sheds.filter(s=>s.tone===t);
  const hot=d.wx.filter(w=>w.alerts.length);
  const lines={
    ov:M&&M.overview?rsFirst(M.overview.replace(/^Morning[^.]*\.\s*/,''))||rsFirst(M.overview):plan[0]?`Top of the list: ${plan[0].title}.`:'Nothing urgent this morning.',
    plan:plan.length?`${plan.length} thing${plan.length===1?'':'s'} for today, most urgent first. Tick them off as you go.`:'Nothing urgent today — every shed, silo and task is on track.',
    sheds:`${nTone('g').length} shed${nTone('g').length===1?' is':'s are'} fine${nTone('a').length?`; Shed ${nTone('a').map(s=>s.id).join(', ')} need${nTone('a').length===1?'s':''} a look`:''}${nTone('r').length?`; Shed ${nTone('r').map(s=>s.id).join(', ')} ${nTone('r').length===1?'has':'have'} a pickup today`:''}${nTone('b').length?`; ${nTone('b').length} empty or nearly out`:''}.`,
    crew:M&&M.crew?String(M.crew):d.cw?`${d.crew.filter(c=>c.who).length} people on today${d.crew.some(c=>!c.who)?`, ${d.crew.find(c=>!c.who).list.length} job(s) with nobody on them`:''}.`:'Tasks hasn\'t loaded yet.',
    since:d.since.length?d.since[0].html.replace(/<[^>]+>/g,'')+'.':'From tomorrow I\'ll show what changed since today.',
    warn:warns.length?`${warns.length} thing${warns.length===1?'':'s'} building up. ${warns[0].text}`:'No risks building up.',
    week:busiest&&busiest.ev.length?`${RS_WD[busiest.date.getDay()]} is the busiest day: ${busiest.ev.map(e=>e.t).join(', ')}.`:'A quiet week ahead.',
    wx:M&&M.weather?rsFirst(M.weather):hot.length?`${hot.map(w=>RS_WD[new Date(w.date+'T00:00:00').getDay()]+': '+w.alerts.join(', ')).join(' · ')}.`:d.wx.length?'No weather warnings this week.':'No weather location set yet.'};
  const tone={plan:plan.some(p=>p.f&&p.f.tone==='r')?'r':plan.length?'a':'',sheds:nTone('a').length||nTone('r').length?'a':'',warn:warns.some(w=>w.tone==='r')?'r':warns.length?'a':'',wx:hot.length?'a':''};
  const stepMood={ov:mood==='happy'?'happy':red?'alert':'calm',plan:'thinking',sheds:nTone('a').length?'alert':'calm',crew:'thinking',since:'calm',warn:warns.length?'alert':'happy',week:'calm',wx:hot.length?'alert':'calm'};
  const say=M&&M.overview?rsFirst(M.overview)+(rsFirst(M.overview)!==M.overview.trim()?' '+rsFirst(M.overview.slice(rsFirst(M.overview).length)):''):lines.ov;
  return {M,plan,aiPlan,warns,mood,sheds,lines,tone,stepMood,ticks,say,hot};
}
// Detail bar under a plan item (2026-10-29): the farm fact it comes from, then Plumo's reason — always shown, no Why? tap
function rsDetHtml(p){const f=p.f&&p.f.text&&p.f.text!==p.title?p.f.text:'';if(!f&&!p.why)return '';
  return `<span class="rs-det">${f?`<span class="rs-det-f"><i>Farm</i>${escapeHtml(f)}</span>`:''}${p.why?`<span class="rs-det-w"><i>Plumo</i>${rsInl(p.why)}</span>`:''}</span>`;}
function rsHtml(st,d,R){
  const now=new Date(),who=aiName(),w0=d.wx[0],tm=fmtClock(st.at||Date.now());
  let bd='';try{const pl=mgrPlaced();if(pl.length){const first=pl.map(s=>dateOnly(s.placementDate)).reduce((a,b)=>b<a?b:a);bd=`Batch ${escapeHtml(String(predState.batchNumber||farmData.batchNumber||''))} · day ${Math.max(0,mgrDays(first,mgrToday()))}`;}}catch(e){}
  const meta=[bd,w0?`${escapeHtml(w0.maxT)} / ${escapeHtml(w0.minT)}`:'',`prepared${who?' for '+escapeHtml(who):''} at ${tm}`].filter(Boolean).join(' · ');
  const tag='<span class="rs-tag">Plumo</span>',loading='<div class="rs-load"><i></i><i></i><i></i></div>';
  const M=R.M;
  const ov=M&&M.overview?`<p class="rs-ovp">${rsInl(M.overview)}</p>`:st.busy?loading:`<p class="rs-muted">${escapeHtml(st.err||'Plumo isn\'t available right now.')} The numbers and lists below are all from your apps.</p>`;
  const planHtml=R.plan.length?R.plan.map((p,i)=>{const tone=p.f?p.f.tone:'r',go=p.f?rsGo(p.f.act):'',dn=R.ticks.has(i);
    return `<div class="rs-act${dn?' done':''}" data-rs-i="${i}"><button type="button" class="rs-tick" data-rs-tick="${i}" aria-pressed="${dn}" aria-label="${dn?'Not done':'Done'}" title="Tick it off (just for you, today)">✓</button><span class="rs-n ${tone==='a'?'a':tone==='b'||tone==='g'?'b':''}">${i+1}</span><span class="rs-at"><b>${rsInl(p.title)}</b>${rsDetHtml(p)}</span>${go&&p.f.act?`<button type="button" class="rs-go" data-rs-go ${p.f.act}>${escapeHtml(go)} ›</button>`:'<span></span>'}</div>`;}).join(''):'<p class="rs-muted">Nothing urgent today — every shed, silo and task is on track.</p>';
  const C={r:'#C8443A',a:'#E2A13A',g:'#13806D',b:'#2F6BD8'};
  const shedHtml=R.sheds.map(s=>`<button type="button" class="rs-sh ${s.tone}" data-rs-shed="${s.id}"><span class="rs-sht"><span class="rs-no">${s.id}</span><b>${escapeHtml(s.head)}</b></span><span class="rs-bar"><i style="width:${Math.round((s.pct||0)*100)}%;background:${C[s.tone]}"></i></span><small>${s.note?'tap for Plumo\'s note':'tap for details'}</small></button>`).join('');
  const crewHtml=d.cw?(d.crew.length?`<div class="rs-crew">${d.crew.map(c=>{const n=c.list.length,dn=c.list.filter(x=>x.done).length,heavy=c.open>=6;
      return `<div class="rs-cw${c.who?'':' none'}"><div class="rs-who">${c.who?`<i style="background:${rsColor(c.who)}">${escapeHtml(c.who.slice(0,1).toUpperCase())}</i>`:''}<b>${c.who?escapeHtml(c.who):'Not assigned'}</b>${c.who?`<span class="rs-blocks" title="${dn} done · ${c.open} open">${Array.from({length:Math.min(n,8)},(_,k)=>`<span class="${k<dn?'f':heavy?'h':'o'}"></span>`).join('')}</span>`:`<em>${n} job${n===1?'':'s'}</em>`}</div><ul>${c.list.slice(0,6).map(x=>`<li class="${x.done?'done':''}">${escapeHtml(x.name)}${x.od?' <span class="rs-od">overdue</span>':''}</li>`).join('')}${n>6?`<li class="rs-muted">+${n-6} more</li>`:''}</ul></div>`;}).join('')}</div>`:'<p class="rs-muted">No tasks on today.</p>')+(M&&M.crew?`<p class="rs-note">${rsFace('thinking','rs-nf')}<span>${rsInl(M.crew)}</span></p>`:''):'<p class="rs-muted">Tasks hasn\'t loaded yet.</p>';
  const li=(x)=>`<div class="rs-li"><span class="rs-d ${x.tone}"></span><span>${x.html}</span></div>`;
  const sinceHtml=d.since.length?d.since.map(li).join(''):'<p class="rs-muted">Plumo compares from tomorrow — today\'s figures are saved on this device.</p>';
  const warnHtml=R.warns.length?R.warns.map(li).join(''):'<p class="rs-muted">No risks building up.</p>';
  const weekHtml=`<div class="rs-week">${d.week.map(w=>`<div class="rs-wd${w.busy?' busy':''}"><b>${RS_WD[w.date.getDay()]} ${w.date.getDate()}</b>${w.ev.map(e=>`<div class="rs-ev ${e.k}">${escapeHtml(e.t)}</div>`).join('')||'<div class="rs-ev">—</div>'}</div>`).join('')}</div>`;
  const wxHtml=(M&&M.weather?`<p class="rs-ovp" style="font-size:13.5px">${rsInl(M.weather)}</p>`:'')+(d.wx.length?`<div class="rs-wxrow">${d.wx.map(w=>`<span class="${w.alerts.length?'al':''}" title="${escapeAttr(w.label+(w.alerts.length?' — '+w.alerts.join(', '):''))}"><b>${RS_WD[new Date(w.date+'T00:00:00').getDay()]}</b>${escapeHtml(w.icon)}<i>${escapeHtml(w.maxT)}</i></span>`).join('')}</div>`:'<p class="rs-muted">No weather location set (Tasks › Settings › Weather).</p>');
  const sec=(id,title,ai,body,extra)=>`<section class="rs-sec" id="rs-${id}"><h3>${title}${ai?tag:''}${extra||''}</h3>${body}</section>`;
  const nDone=R.plan.filter((p,i)=>R.ticks.has(i)).length;
  return `<div class="rs-h"><div class="rs-ht"><div class="rs-face" id="rsFace" role="button" tabindex="0" title="Tap Plumo for today's top job" aria-label="Plumo">${rsFace(R.mood)}</div>
        <div class="rs-t"><small>Plumo · morning report</small><h2 id="rsTitle">${escapeHtml(now.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'}))}</h2><div class="rs-m">${meta}</div><div class="rs-say" id="rsSay">${st.busy?'<span class="rs-muted2">Plumo is reading the farm…</span>':escapeHtml(R.say)}</div></div>
        <div class="rs-hb"><button type="button" class="rs-bev" data-bev-open title="Birds Eye View: the batch result now and at clean-out"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>Birds Eye View</button><button type="button" class="rs-x rs-redo" data-rs-redo aria-label="Refresh the report with the latest farm data" title="Refresh: Plumo reads the farm again"${st.busy?' disabled':''}>↻</button><button type="button" class="rs-x" data-rs-close aria-label="Close" title="Close">✕</button></div></div>
      <nav class="rs-nav" aria-label="Sections">${RS_TABS.map(([k,l],i)=>`<button type="button" data-rs-tab="${k}" class="${i===0?'on':''}">${l}${R.tone[k]?`<i class="${R.tone[k]}"></i>`:''}</button>`).join('')}</nav></div>
    <div class="rs-scroll" id="rsScroll">
      <div class="rs-kpi">${d.kpi.map(k=>`<div><span>${escapeHtml(k.k)}</span><b>${k.v}</b><em class="${k.tone||''}">${k.s}</em></div>`).join('')}</div>
      <div class="rs-b">
        ${sec('ov','Overview',!!(M&&M.overview),ov)}
        ${sec('plan',"Today's plan",R.aiPlan,planHtml,R.plan.length?` <span class="rs-prog" id="rsProg">${nDone} of ${R.plan.length} done</span>`:'')}
        ${sec('sheds','Sheds',!!st.sheds,`<div class="rs-sheds">${shedHtml}</div>`)}
        ${sec('crew','Crew today',!!(M&&M.crew),crewHtml)}
        <div class="rs-two">${sec('since','Since yesterday',false,sinceHtml)}${sec('warn','Warnings',!!(M&&M.warnings&&M.warnings.length),warnHtml)}</div>
        ${sec('week','Week ahead',false,weekHtml)}
        ${sec('wx','Weather',!!(M&&M.weather),wxHtml)}
        <div class="rs-endnote"><span>Numbers from ProdWise${d.cw?' and Tasks':''} at ${tm} · Plumo is AI — check before acting${aiLeft!=null?' · '+aiLeft+' AI requests left today':''}</span><label class="rs-on"><input type="checkbox" data-rs-on ${rsOn()?'checked':''}> Show at 7:00</label></div>
      </div></div>
    <div class="rs-dock"><span class="rs-dface" id="rsDockFace">${rsFace(R.mood)}</span><div class="rs-msg" id="rsMsg" aria-live="polite"><b>Plumo:</b> ${st.busy?'One moment — I\'m reading the sheds and the jobs…':'Want me to walk you through this morning?'}</div>
      <span class="rs-dots" id="rsDots">${RS_TABS.map(()=>'<i></i>').join('')}</span><button type="button" class="rs-db" id="rsPrev" aria-label="Previous section">‹</button><button type="button" class="rs-db p" id="rsNext">Walk me through it</button></div>`;
}
let rsTabLock=0,rsStep=-1,rsCur=null;   // walk-through step; the model the open report shows
function rsSetMood(m){document.querySelectorAll('#rsModal .rossR').forEach(el=>{if(el.closest('.rs-nf'))return;el.classList.remove('calm','thinking','happy','alert','rest');el.classList.add(m);});}
function rsTell(html,mood,ms){const el=document.getElementById('rsMsg');if(el)el.innerHTML='<b>Plumo:</b> '+html;if(mood){rsSetMood(mood);if(ms)setTimeout(()=>rsSetMood(rsStep>=0&&rsCur?rsCur.R.stepMood[RS_TABS[rsStep][0]]:rsCur?rsCur.R.mood:'calm'),ms);}}
function rsScrollTo(k){const sc=document.getElementById('rsScroll'),el=document.getElementById('rs-'+k);if(!sc||!el)return;rsTabLock=Date.now();
  document.querySelectorAll('#rsModal [data-rs-tab]').forEach(b=>b.classList.toggle('on',b.dataset.rsTab===k));
  sc.scrollTo({top:sc.scrollTop+el.getBoundingClientRect().top-sc.getBoundingClientRect().top-8,behavior:'smooth'});}
function rsGoStep(i){if(!rsCur)return;rsStep=Math.max(0,Math.min(RS_TABS.length-1,i));const k=RS_TABS[rsStep][0];
  document.querySelectorAll('#rsModal .rs-sec').forEach(x=>x.classList.toggle('focus',x.id==='rs-'+k));
  rsScrollTo(k);rsTell(escapeHtml(rsCur.R.lines[k]),rsCur.R.stepMood[k]);
  document.querySelectorAll('#rsDots i').forEach((dt,j)=>dt.classList.toggle('on',j===rsStep));
  const n=document.getElementById('rsNext');if(n)n.textContent=rsStep===RS_TABS.length-1?'Done':'Next ›';}
function rsEndWalk(){rsStep=-1;document.querySelectorAll('#rsModal .rs-sec').forEach(x=>x.classList.remove('focus'));document.querySelectorAll('#rsDots i').forEach(dt=>dt.classList.remove('on'));
  const n=document.getElementById('rsNext');if(n)n.textContent='Walk me through it';rsTell('That\'s everything for this morning. Tap me any time for the top job.',rsCur?rsCur.R.mood:'calm');}
function rsTypeSay(text){const el=document.getElementById('rsSay');if(!el||matchMedia('(prefers-reduced-motion: reduce)').matches){if(el)el.textContent=text;return;}
  let k=0;const t=String(text||'');(function step(){if(!document.getElementById('rsSay'))return;el.innerHTML=escapeHtml(t.slice(0,k))+'<span class="rs-cur"></span>';if(k++<t.length)setTimeout(step,22);else setTimeout(()=>{const c=el.querySelector('.rs-cur');if(c)c.remove();},1400);})();}
function rsEnsureDom(){
  if(document.getElementById('rsModal'))return;
  document.body.insertAdjacentHTML('beforeend',`<div class="rs-scrim" id="rsModal" aria-hidden="true"><div class="rs" role="dialog" aria-modal="true" aria-labelledby="rsTitle"><div id="rsInner"></div></div></div>`);
  const m=document.getElementById('rsModal');
  m.addEventListener('click',e=>{
    if(e.target===m||e.target.closest('[data-rs-close]')){rsClose();return;}
    // ↻ (2026-10-26): Plumo reads the farm again — after a change, the report shouldn't wait until tomorrow
    const redo=e.target.closest('[data-rs-redo]');if(redo){if(redo.disabled)return;const st=rsLoad();delete st.main;delete st.err;delete st.sheds;rsSave(st);rsOpen();return;}
    const t=e.target.closest('[data-rs-tab]');if(t){const i=RS_TABS.findIndex(x=>x[0]===t.dataset.rsTab);if(rsStep>=0)rsGoStep(i);else rsScrollTo(t.dataset.rsTab);return;}
    if(e.target.closest('#rsNext')){if(rsStep===RS_TABS.length-1)rsEndWalk();else rsGoStep(rsStep+1);return;}
    if(e.target.closest('#rsPrev')){rsGoStep(rsStep<=0?0:rsStep-1);return;}
    const tk=e.target.closest('[data-rs-tick]');if(tk&&rsCur){const i=+tk.dataset.rsTick,T=rsTicks();T.has(i)?T.delete(i):T.add(i);rsSaveTicks(T);rsCur.R.ticks=T;
      const row=tk.closest('.rs-act');row.classList.toggle('done',T.has(i));tk.setAttribute('aria-pressed',String(T.has(i)));
      const P=rsCur.R.plan,n=P.filter((p,j)=>T.has(j)).length,pr=document.getElementById('rsProg');if(pr)pr.textContent=`${n} of ${P.length} done`;
      if(n===P.length){rsCur.R.mood='happy';rsTell('That\'s the plan cleared — nice work.','happy');}
      else if(T.has(i)){const nx=P.find((p,j)=>!T.has(j));rsTell(`Good — ${n} of ${P.length} done.${nx?' Next: '+rsInl(nx.title)+'.':''}`,'happy',1600);}
      else rsTell('Back on the list.','calm',900);
      return;}
    const w=e.target.closest('[data-rs-why]');if(w&&rsCur){const p=rsCur.R.plan[+w.dataset.rsWhy];rsTell(rsInl(p.why||p.title),'thinking',1800);return;}
    const sh=e.target.closest('[data-rs-shed]');if(sh&&rsCur){const s=rsCur.R.sheds.find(x=>String(x.id)===sh.dataset.rsShed);document.querySelectorAll('#rsModal .rs-sh').forEach(x=>x.classList.toggle('sel',x===sh));
      if(s)rsTell(`<b>Shed ${s.id}</b> — ${s.note?rsInl(s.note):escapeHtml(s.fact)}`,s.tone==='r'||s.tone==='a'?'alert':'calm');return;}
    if(e.target.closest('#rsFace')){const f=document.querySelector('#rsFace .rossR');if(f){f.classList.add('crow');setTimeout(()=>f.classList.remove('crow'),950);}
      if(rsCur)rsTell(rsCur.R.plan[0]?`Top job: ${rsInl(rsCur.R.plan[0].title)}.`:'Nothing urgent today.');return;}
    if(e.target.closest('[data-rs-go]'))rsClose();
  });
  m.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.id==='rsFace'){e.preventDefault();e.target.click();}});
  m.addEventListener('change',e=>{if(e.target.matches('[data-rs-on]')){try{localStorage.setItem('pw-greet-on',e.target.checked?'1':'0');}catch(er){}}});
  m.addEventListener('scroll',e=>{const sc=e.target;if(sc.id!=='rsScroll'||Date.now()-rsTabLock<900)return;const top=sc.getBoundingClientRect().top;let cur=RS_TABS[0][0];
    RS_TABS.forEach(([k])=>{const el=document.getElementById('rs-'+k);if(el&&el.getBoundingClientRect().top-top<=60)cur=k;});
    if(sc.scrollTop+sc.clientHeight>=sc.scrollHeight-4)cur=RS_TABS[RS_TABS.length-1][0];
    m.querySelectorAll('[data-rs-tab]').forEach(b=>b.classList.toggle('on',b.dataset.rsTab===cur));},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&m.classList.contains('open'))rsClose();});
}
function rsPaint(st,d,type){const inner=document.getElementById('rsInner');if(!inner)return;const sc=document.getElementById('rsScroll'),top=sc?sc.scrollTop:0;
  const R=rsModel(st,d);rsCur={st,d,R};rsStep=-1;inner.innerHTML=rsHtml(st,d,R);const s2=document.getElementById('rsScroll');if(s2)s2.scrollTop=top;
  if(type&&!st.busy)rsTypeSay(R.say);rsBtnMood(R.mood);}
async function rsOpen(){
  if(!farmData)return;
  rsEnsureDom();rsSnap();
  const m=document.getElementById('rsModal');
  let st=rsLoad();st.seen=true;if(!st.at)st.at=Date.now();rsSave(st);rsDot();
  let d=rsData();const need=!st.main&&!st.err;
  st.busy=need;rsPaint(st,d,true);m.classList.add('open');m.setAttribute('aria-hidden','false');
  if(!need)return;
  if(!rsTasksReady()){if(typeof pwEnsureTasksFrame==='function')pwEnsureTasksFrame(()=>{});await rsWaitTasks(12000);d=rsData();rsPaint(st,d);}
  const ctx=rsContext(d);
  const [a,b]=await Promise.all([
    aiCall({mode:'ross',part:'main',name:aiName(),context:ctx}).then(j=>({ok:aiJson(j.text)})).catch(e=>({err:aiErrText(e)})),
    aiCall({mode:'ross',part:'sheds',context:d.sheds.map(s=>`Shed ${s.id}: ${s.fact}`).join('\n')}).then(j=>({ok:aiJson(j.text)})).catch(e=>({err:aiErrText(e)}))]);
  st=rsLoad();st.busy=false;
  if(a.ok&&(a.ok.overview||a.ok.plan))st.main=a.ok;else st.err=a.err||'Plumo\'s notes didn\'t come through today';
  if(b.ok&&b.ok.sheds)st.sheds=b.ok;
  rsSave(st);
  if(m.classList.contains('open')){rsPaint(st,rsData(),true);const f=document.querySelector('#rsFace .rossR');if(f&&st.main){f.classList.add('crow');setTimeout(()=>f.classList.remove('crow'),950);}}
}
function rsClose(){const m=document.getElementById('rsModal');if(!m)return;m.classList.remove('open');m.setAttribute('aria-hidden','true');rsStep=-1;}
function rsDot(){const on=!!farmData&&new Date().getHours()>=7&&!rsLoad().seen;const d=document.getElementById('rossDot');if(d)d.hidden=!on;try{cwFrame&&cwFrame.contentWindow&&cwFrame.contentWindow.__cwRossDot&&cwFrame.contentWindow.__cwRossDot(on);}catch(e){}}
// The header Plumo wears today's mood: worried with a red item, sleepy with no AI, happy when the plan is cleared
function rsBtnMood(m){const f=document.querySelector('#rossBtn .rossR');if(f){f.classList.remove('calm','thinking','happy','alert','rest');f.classList.add(m);}}
function rsMoodNow(){try{if(!farmData)return 'calm';const st=rsLoad();if(st.main||st.err){const R=rsModel(st,rsData());return R.mood;}const b=mgrBriefData();return b.G.today.concat(b.G.watch,b.G.feed,b.G.co).some(x=>x.tone==='r')?'alert':'calm';}catch(e){return 'calm';}}
// Phones: Plumo floats at the bottom right above the bottom bar; computers: beside the bell (2026-10-26)
const RS_PHONE=window.matchMedia?matchMedia('(max-width:768px)'):{matches:false};
function rsDockBtn(){
  const b=document.getElementById('rossBtn');if(!b)return;
  if(RS_PHONE.matches){b.classList.add('ross-float');if(b.parentNode!==document.body)document.body.appendChild(b);return;}
  b.classList.remove('ross-float');
  const bell=document.querySelector('#pageHeader .alerts-bell-wrap');
  if(bell&&b.nextElementSibling!==bell)bell.before(b);
}
function rsPlaceButton(){
  if(document.getElementById('rossBtn')){rsDockBtn();return;}
  const bell=document.querySelector('#pageHeader .alerts-bell-wrap');if(!bell)return;
  bell.insertAdjacentHTML('beforebegin',`<button type="button" class="ross-btn" id="rossBtn" title="Plumo · morning report" aria-label="Plumo · morning report"><span class="ross-mk">${rsFace('calm')}</span><span class="ross-l">Plumo</span><span class="ross-dot" id="rossDot" hidden></span></button>`);
  document.getElementById('rossBtn').addEventListener('click',rsOpen);
  rsDockBtn();
}
if(RS_PHONE.addEventListener)RS_PHONE.addEventListener('change',rsDockBtn);
window.pwOpenRoss=()=>rsOpen();   // Tasks' Plumo button
let rsTried=false;
function rsMaybeShow(){
  if(rsTried||!farmData||!aiFarm()||!rsOn()||new Date().getHours()<7)return;
  if(rsLoad().seen)return;
  rsTried=true;
  const go=()=>{try{rsOpen();}catch(e){}};
  if(typeof pwEnsureTasksFrame==='function')pwEnsureTasksFrame(()=>{});
  rsWaitTasks(15000).then(go);   // the report waits for Tasks' data (or 15 s), then opens
}
document.addEventListener('DOMContentLoaded',()=>{rsPlaceButton();rsDot();setTimeout(rsMaybeShow,2500);setTimeout(()=>rsBtnMood(rsMoodNow()),4000);});
setInterval(()=>{if(document.visibilityState!=='visible')return;rsPlaceButton();rsDot();rsMaybeShow();rsBtnMood(rsMoodNow());},60000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){rsTried=false;setTimeout(rsMaybeShow,1500);}});
