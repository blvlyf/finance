/* core.js: pure data + money logic. No DOM access, so it can be tested in Node. Uses the global state S. */
const SCHEMA=3;
const pad=n=>String(n).padStart(2,'0'),uid=()=>Math.random().toString(36).slice(2,10);
const dstr=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()),today=()=>dstr(new Date());
const ESC={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>ESC[c]);
const sum=(a,f=x=>x.amt)=>a.reduce((s,x)=>s+(+f(x)||0),0),pc=(a,b)=>b>0?Math.min(100,Math.round(a/b*100)):0;
const DEF=()=>({v:SCHEMA,set:{name:'',cur:'UGX',day:28,cash0:0,bk:'',hi:0},tx:[],up:[],todo:[],hab:[],jl:[],notes:[],goals:[],debts:[],bud:{},cats:[],acc:[],rules:{},split:{tithe:10,offer:5,save:40,give:15,live:30}});
const BASE=['Rent','Food','Transport','Utilities','Internet & data','Tithe','Offering','Family','Giving','Health','Education','Fun','Personal care','Other'],GV=['Tithe','Offering','Church & tithe','Family','Giving'],SRC=['Salary','Business','Freelance','Valuation','Graphic design','Music lessons','Gift','Loan','Other'],KN={exp:'Spent',inc:'Received',save:'Saved',debt:'Repaid'};
let S=DEF();
const num=n=>{const a=Math.round(Math.abs(n||0)*100)/100;return a.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:2})},fmt=n=>(n<0?'−':'')+S.set.cur+' '+num(n);
/* ---- schema versions and input sanitising (used on load, restore and snapshot restore) ---- */
const MIG={
 /* v1 -> v2: old journal object S.jr becomes the S.jl list */
 1:d=>{if(d.jr&&typeof d.jr==='object'){d.jl=d.jl||[];Object.keys(d.jr).forEach(k=>{const e=d.jr[k];if(e&&['txt','int','grat','win','ttl'].some(f=>String(e[f]||'').trim()))d.jl.push({id:uid(),d:k,c:new Date(k+'T12:00:00').getTime()||0,tm:'',ttl:e.ttl||'',txt:e.txt||'',mood:e.mood||0,int:e.int||'',grat:e.grat||'',win:e.win||''})});delete d.jr}return d},
 /* v2 -> v3: the PIN hash leaves the data (the PIN now protects an encryption key); add rules */
 2:d=>{d.rules=d.rules||{};return d}
};
const migrate=d=>{let v=+d.v||1;while(v<SCHEMA){if(MIG[v])d=MIG[v](d);v++}d.v=SCHEMA;return d};
const IDRE=/^[A-Za-z0-9_-]{1,32}$/,DRE=/^\d{4}-\d{2}-\d{2}$/,TRE=/^\d{2}:\d{2}$/,BAD=new Set(['__proto__','constructor','prototype']);
const st=(v,n=500)=>String(v??'').slice(0,n),nm=v=>Number.isFinite(+v)?+v:0,arr=v=>Array.isArray(v)?v:[],ob=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const sanitize=raw0=>{
 const raw=migrate(ob(raw0)),idm={},fix=id=>{id=st(id,64);if(!id)return uid();if(IDRE.test(id))return id;return idm[id]||(idm[id]=uid())},rf=v=>v?fix(v):'',dt=v=>DRE.test(v||'')?v:'',tm=v=>TRE.test(v||'')?v:'';
 const REPS=['','daily','weekly','monthly'],rep=v=>REPS.includes(v)?v:'';
 const o=DEF(),s=ob(raw.set);
 o.set={name:st(s.name,60),cur:st(s.cur||'UGX',6)||'UGX',day:Math.min(28,Math.max(1,Math.round(nm(s.day))||1)),cash0:nm(s.cash0),bk:st(s.bk,40),hi:s.hi?1:0};
 ['pal','mode'].forEach(k=>{if(s[k])o.set[k]=st(s[k],20)});
 if(!['burgundy','forest','ocean','sunrise','plum'].includes(o.set.pal))delete o.set.pal;
 if(!['auto','light','dark'].includes(o.set.mode))delete o.set.mode;
 ['splitAsk','remOn','remAsked','nag','jrOn','bgOn','autoOn'].forEach(k=>{if(k in s)o.set[k]=+s[k]?1:0});
 ['remB','snz','lockMin'].forEach(k=>{if(k in s)o.set[k]=Math.max(0,Math.min(1440,Math.round(nm(s[k]))))});
 ['jrTm'].forEach(k=>{if(tm(s[k]))o.set[k]=s[k]});['jrN','bkN','bkSnz','revAt','bkF'].forEach(k=>{if(s[k])o.set[k]=st(s[k],12)});
 o.tx=arr(raw.tx).map(t=>{t=ob(t);return{id:fix(t.id),k:['exp','inc','save','debt','xfer'].includes(t.k)?t.k:'exp',d:dt(t.d),amt:Math.max(0,nm(t.amt)),cat:st(t.cat,60),note:st(t.note,200),tgt:rf(t.tgt),acc:rf(t.acc),to:rf(t.to),xid:rf(t.xid),up:rf(t.up),auto:t.auto?1:0}}).filter(t=>t.d);
 o.tx.forEach(t=>{if(!t.xid)delete t.xid;if(!t.up)delete t.up;if(!t.auto)delete t.auto;if(!t.to)delete t.to});
 o.up=arr(raw.up).map(u=>{u=ob(u);return{id:fix(u.id),what:st(u.what,120),amt:Math.max(0,nm(u.amt)),d:dt(u.d),rep:rep(u.rep),done:u.done?1:0,rem:dt(u.rem)||null,auto:u.auto?1:0,cat:st(u.cat,60),acc:rf(u.acc)}}).filter(u=>u.d&&u.what);
 o.todo=arr(raw.todo).map(t=>{t=ob(t);return{id:fix(t.id),t:st(t.t,300),d:dt(t.d),tm:tm(t.tm),done:dt(t.done),pri:t.pri?1:0,rep:rep(t.rep),note:st(t.note,2000),sub:arr(t.sub).map(x=>({id:fix(ob(x).id),t:st(ob(x).t,300),done:ob(x).done?1:0})),fired:t.fired==null?null:nm(t.fired),nc:Math.min(9,Math.max(0,nm(t.nc))),snz:nm(t.snz),last:nm(t.last),spawned:t.spawned?1:0}}).filter(t=>t.t);
 o.hab=arr(raw.hab).map(h=>{h=ob(h);const log={};Object.keys(ob(h.log)).forEach(k=>{if(DRE.test(k)&&h.log[k])log[k]=1});return{id:fix(h.id),name:st(h.name,80),goal:Math.min(7,Math.max(1,Math.round(nm(h.goal))||7)),log}}).filter(h=>h.name);
 o.jl=arr(raw.jl).map(e=>{e=ob(e);return{id:fix(e.id),d:dt(e.d),c:nm(e.c),tm:tm(e.tm),ttl:st(e.ttl,200),txt:st(e.txt,20000),mood:Math.min(5,Math.max(0,Math.round(nm(e.mood)))),int:st(e.int,300),grat:st(e.grat,300),win:st(e.win,300)}}).filter(e=>e.d);
 o.notes=arr(raw.notes).map(n=>{n=ob(n);return{id:fix(n.id),t:st(n.t,200),b:st(n.b,50000),pin:n.pin?1:0,c:nm(n.c)||Date.now(),u:nm(n.u)||Date.now()}});
 o.goals=arr(raw.goals).map(g=>{g=ob(g);return{id:fix(g.id),name:st(g.name,80),target:nm(g.target),base:nm(g.base)}}).filter(g=>g.name);
 o.debts=arr(raw.debts).map(d=>{d=ob(d);return{id:fix(d.id),who:st(d.who,80),amt:Math.max(0,nm(d.amt)),due:dt(d.due)}}).filter(d=>d.who);
 o.acc=arr(raw.acc).map(a=>{a=ob(a);return{id:fix(a.id),name:st(a.name,60),base:nm(a.base)}}).filter(a=>a.name);
 Object.keys(ob(raw.bud)).forEach(k=>{if(!BAD.has(k)&&nm(raw.bud[k])>0)o.bud[st(k,60)]=nm(raw.bud[k])});
 o.cats=[...new Set(arr(raw.cats).map(c=>st(c,60)).filter(Boolean))];
 o.dis=arr(raw.dis).map(x=>st(x,200));
 Object.keys(ob(raw.rules)).slice(0,400).forEach(k=>{if(!BAD.has(k)&&typeof raw.rules[k]==='string')o.rules[st(k,200)]=st(raw.rules[k],60)});
 ['tithe','offer','save','give','live'].forEach(k=>{if(raw.split&&k in raw.split)o.split[k]=Math.max(0,Math.min(100,nm(raw.split[k])))});
 ['closed','carry'].forEach(k=>{const r=ob(raw[k]),x={};Object.keys(r).forEach(c=>{if(!/^-?\d{1,6}$/.test(c))return;if(k==='closed')x[c]={at:dt(ob(r[c]).at),inc:nm(ob(r[c]).inc),exp:nm(ob(r[c]).exp)};else{const m={};Object.keys(ob(r[c])).forEach(n=>{if(!BAD.has(n))m[st(n,60)]=nm(r[c][n])});x[c]=m}});o[k]=x});
 return o};
/* ---- dates and months (a month starts on the payday you choose, default the 1st) ---- */
const D=()=>Math.min(28,Math.max(1,+S.set.day||1));
const cyc=d=>{let[y,m,dd]=d.split('-').map(Number);if(dd<D()){m--;if(m<1){m=12;y--}}return y*12+m-1};
const cl=c=>{const k=D()>1?c+1:c;return new Date(Math.floor(k/12),k%12,1).toLocaleString('en',{month:'long',year:'numeric'})};
const ad=(d,n)=>{const x=new Date(d+'T12:00:00');x.setDate(x.getDate()+n);return dstr(x)},dd2=(a,b)=>Math.round((new Date(b+'T12:00:00')-new Date(a+'T12:00:00'))/864e5);
const cSt=c=>dstr(new Date(Math.floor(c/12),c%12,D())),cEn=c=>ad(cSt(c+1),-1);
const nextD=(d,r)=>{if(r==='daily')return ad(d,1);if(r==='weekly')return ad(d,7);const[y,m,dd]=d.split('-').map(Number),n=new Date(y,m,1),L=new Date(n.getFullYear(),n.getMonth()+1,0).getDate();return dstr(new Date(n.getFullYear(),n.getMonth(),Math.min(dd,L)))};
/* ---- money ---- */
const T=(k,c)=>S.tx.filter(t=>t.k===k&&(c==null||cyc(t.d)===c));
const cash=()=>+S.set.cash0+sum(T('inc'))-sum(T('exp'))-sum(T('save'))-sum(T('debt'));
const gS=g=>(+g.base||0)+sum(T('save').filter(x=>x.tgt===g.id)),saved=()=>sum(S.goals,g=>g.base)+sum(T('save'));
const dBal=d=>Math.max(0,d.amt-sum(T('debt').filter(x=>x.tgt===d.id))),owed=()=>sum(S.debts,dBal);
const BK=[['tithe','Tithe'],['offer','Offerings'],['save','Savings'],['give','Giving'],['live','Wants & needs']];
const bkOf=t=>t.k==='save'?'save':t.k==='debt'?'live':t.k!=='exp'?'':['Tithe','Church & tithe'].includes(t.cat)?'tithe':t.cat==='Offering'?'offer':['Giving','Family'].includes(t.cat)?'give':'live';
const incSplit=c=>sum(T('inc',c).filter(t=>t.cat!=='Loan')),bk=(c,id)=>{const al=incSplit(c)*(+S.split[id]||0)/100,used=sum(S.tx.filter(t=>cyc(t.d)===c&&bkOf(t)===id));return{al,used,left:al-used}};
const spentIn=(c,n)=>sum(T('exp',c).filter(t=>t.cat===n));
const accFlow=(a,L)=>(+a.base||0)+sum(L,t=>(t.acc===a.id?(t.k==='inc'?+t.amt:-t.amt):0)+(t.k==='xfer'&&t.to===a.id?+t.amt:0)),aB=a=>accFlow(a,S.tx),tot=()=>sum(S.acc,aB);
const lim=(n,c)=>Math.max(0,(+S.bud[n]||0)+((((S.carry||{})[c])||{})[n]||0));
/* ---- upcoming bills ---- */
const UP=()=>S.up||(S.up=[]),pendUp=()=>UP().filter(u=>!u.done).sort((a,b)=>a.d<b.d?-1:1),when=u=>{const n=Math.round((new Date(u.d)-new Date(today()))/864e5);return n<0?-n+'d overdue':n===0?'today':n===1?'tomorrow':'in '+n+' days'};
/* money an upcoming item will take up to and including `end` (repeating ones count every occurrence) */
const dueBy=(u,end)=>{let n=0,d=u.d,tot=0;while(d<=end&&n++<62){tot+=+u.amt||0;if(!u.rep)break;d=nextD(d,u.rep)}return tot};
/* Safe to spend: what you can spend each remaining day of this month after bills and debts that fall due before it ends */
const safeSpend=(t0=today())=>{const end=cEn(cyc(t0)),days=Math.max(1,dd2(t0,end)+1),money=S.acc.length?tot():cash(),bills=sum(pendUp(),u=>dueBy(u,end)),debts=sum(S.debts.filter(d=>d.due&&d.due<=end),dBal),spent=sum(T('exp').filter(t=>t.d===t0)),avail=money-bills-debts,day=Math.max(0,(avail+spent)/days);return{money,bills,debts,avail,days,day,spent,left:day-spent,end,short:avail<0}};
/* Record repeating bills marked "record automatically" once their date arrives. Skips (and reports) any the balance cannot cover. */
const runAuto=(t0=today())=>{const made=[],skip=[];UP().filter(u=>u.auto&&!u.done).forEach(u=>{let n=0;while(u.d<=t0&&n++<24){const A=S.acc.length?(S.acc.find(a=>a.id===u.acc)||S.acc[0]):null,bal=A?accFlow(A,S.tx):cash();if(Math.round(u.amt*100)>Math.round(bal*100)){skip.push(u);break}S.tx.push({id:uid(),k:'exp',d:u.d,amt:+u.amt,cat:u.cat||'Other',note:u.what,tgt:'',acc:A?A.id:'',auto:1});made.push(u);if(u.rep){u.d=nextD(u.d,u.rep);u.rem=null}else{u.done=1;break}}});return{made,skip}};
/* ---- learning categories ---- */
const rkey=(k,note)=>k+'|'+String(note||'').trim().toLowerCase().replace(/\s+/g,' ');
const learn=t=>{if(!(t.k==='exp'||t.k==='inc')||!t.cat||t.cat==='Loan'||!String(t.note||'').trim())return;const R=S.rules=S.rules||{};R[rkey(t.k,t.note)]=t.cat;const ks=Object.keys(R);if(ks.length>400)delete R[ks[0]]};
const guess=(k,note)=>{const n=rkey(k,note).slice(k.length+1);if(n.length<2)return '';const R=S.rules||{};if(R[k+'|'+n])return R[k+'|'+n];let best='',bl=0;Object.keys(R).forEach(key=>{if(key.indexOf(k+'|')!==0)return;const w=key.slice(k.length+1);if(w.length>=3&&w.length>bl&&(n.includes(w)||(n.length>=3&&w.includes(n)))){best=R[key];bl=w.length}});return best};
/* ---- trends ---- */
const trend=(n=6,c0=cyc(today()))=>{const o=[];for(let c=c0-n+1;c<=c0;c++){const inc=sum(T('inc',c).filter(t=>t.cat!=='Loan')),exp=sum(T('exp',c));o.push({c,label:cl(c).slice(0,3),inc,exp,kept:inc-exp})}return o};
/* ---- habits ---- */
const mon=d=>{const x=new Date(d+'T12:00:00');return ad(d,-((x.getDay()+6)%7))};
const wc=(h,ws)=>{let n=0;for(let i=0;i<7;i++)if(h.log[ad(ws,i)])n++;return n};
const hg=h=>Math.min(7,Math.max(1,+h.goal||7));
/* ---- time typed into text ("Call mum at 3pm") ---- */
const pTime=s=>{const re=/(^|\s)((?:@|at)\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?=$|\s|[.,!?])/gi;let m;while((m=re.exec(s))){const pre=m[2],mi=m[4]?+m[4]:0,ap=(m[5]||'').toLowerCase();const atEnd=/^[\s.,!?]*$/.test(s.slice(m.index+m[0].length));if(!(pre||m[4]||ap||atEnd)||mi>59)continue;let h=+m[3];if(ap){if(h<1||h>12)continue;h=h%12+(ap==='pm'?12:0)}else{if(h>23)continue;if(h>=1&&h<=6&&!(m[3].length===2&&m[3][0]==='0'))h+=12}const txt=(s.slice(0,m.index)+' '+s.slice(m.index+m[0].length)).replace(/\s+/g,' ').trim();return{tm:pad(h)+':'+pad(mi),txt:txt||s.trim()}}return{tm:'',txt:s.trim()}};
const fT=tm=>{if(!tm)return'';const[h,m]=tm.split(':').map(Number);return(h%12||12)+':'+pad(m)+' '+(h<12?'AM':'PM')};
