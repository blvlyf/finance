/* audio.js: a private music player. Songs, voice notes, artists, albums, playlists, queue, shuffle, repeat,
   covers and names read from each file, resume, lock-screen controls.
   IndexedDB keys: 'aulib' (tracks), 'aupl' (playlists), 'aart' (covers), 'aust' (last played), 'au:<id>' (audio data).
   Everything is encrypted with the data key when a PIN is set. */
const AMAX=120*1024*1024,AEXT=/\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|webm|mp4)$/i,AMT={mp3:'audio/mpeg',m4a:'audio/mp4',aac:'audio/aac',wav:'audio/wav',ogg:'audio/ogg',oga:'audio/ogg',opus:'audio/ogg',flac:'audio/flac',webm:'audio/webm',mp4:'audio/mp4'};
let AL=null,APL=[],AART={},AARU={},aErr=0,aLd=null,aCur=null,aTok=0,aURL='',aSpd=1,aSlp=0,aSlpT=0,aDrag=0,aRec=null,aQ=Promise.resolve(),aUnl=0,aImp=null,aAt=0,aQu=[],aQo=[],aQi=-1,aShuf=0,aRep=0,auT='songs',auD=null,aq='',aAX=[],aNpK='',aStT=0,aNoArt=0,aEM='',aPr=1,aPm=0;
const AUV='audio 7';
const A=new Audio();A.preload='auto';
const SIL=URL.createObjectURL(new Blob([Uint8Array.from(atob('UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA='),c=>c.charCodeAt(0))],{type:'audio/wav'}));
const sv=(w,p,x)=>`<svg viewBox="0 0 24 24" width="${w}" height="${w}" ${p?'fill="currentColor"':'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"'} aria-hidden="true">${x}</svg>`;
const aico={
 play:sv(22,1,'<path d="M8 5.5v13L19 12z"/>'),pause:sv(22,1,'<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/>'),
 prev:sv(26,1,'<path d="M6 5h2v14H6zM20 5.5v13L9.5 12z"/>'),next:sv(26,1,'<path d="M16 5h2v14h-2zM4 5.5v13L14.5 12z"/>'),
 back:sv(26,0,'<path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v4.5h4.5"/><text x="12" y="15.2" text-anchor="middle" font-size="7.5" fill="currentColor" stroke="none" font-family="system-ui" font-weight="600">15</text>'),
 fwd:sv(26,0,'<path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v4.5h-4.5"/><text x="12" y="15.2" text-anchor="middle" font-size="7.5" fill="currentColor" stroke="none" font-family="system-ui" font-weight="600">15</text>'),
 down:sv(26,0,'<path d="M6 9l6 6 6-6"/>'),mic:sv(18,0,'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>'),add:sv(20,0,'<path d="M12 5v14M5 12h14"/>'),
 note:sv(20,0,'<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>'),
 shuf:sv(22,0,'<path d="M3 7h3c4 0 5.5 10 9.5 10H20M3 17h3c1.5 0 2.6-1.3 3.5-3M14 9.5C14.9 8.2 16 7 17.5 7H20M17.5 4.5 20 7l-2.5 2.5M17.5 14.5 20 17l-2.5 2.5"/>'),
 rep:sv(22,0,'<path d="M4 11V9.5A3.5 3.5 0 0 1 7.5 6H19M16 3l3 3-3 3M20 13v1.5a3.5 3.5 0 0 1-3.5 3.5H5M8 21l-3-3 3-3"/>'),
 que:sv(22,0,'<path d="M4 7h11M4 12h11M4 17h6M17 14v6l4.5-3z"/>'),
 heart:f=>sv(24,0,`<path d="M12 20s-7.5-4.6-9-9.3C2 7.6 4 5 7 5c2 0 3.6 1.2 5 3 1.4-1.8 3-3 5-3 3 0 5 2.6 4 5.7C19.5 15.4 12 20 12 20z"${f?' fill="currentColor"':''}/>`),
 stack:sv(20,0,'<path d="M4 7h16M4 12h16M4 17h8"/>'),user:sv(20,0,'<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.8-4 3.5-6 7-6s6.2 2 7 6"/>')};
const tfmt=s=>{s=Math.max(0,Math.round(+s||0));const h=Math.floor(s/3600),m=Math.floor(s%3600/60);return(h?h+':'+pad(m):m)+':'+pad(s%60)};
const dfmt=c=>new Date(c).toLocaleDateString('en-US',{month:'short',day:'numeric'});
const smb=b=>b>=1e9?(b/1e9).toFixed(1)+' GB':Math.max(1,Math.round(b/1e6))+' MB';
const dtx=m=>m.dur?' · '+tfmt(m.dur):'';
const nsong=n=>n+(n===1?' song':' songs');

/* ---- storage ---- */
const aOpen=async v=>{if(v&&v.iv){if(!DK)throw 0;return JSON.parse(D8.decode(await aesDec(DK,v)))}return v};
const aSeal=v=>DK?seal(DK,v):v;
function auLoad(){if(AL||aErr)return aLd||Promise.resolve();
 return aLd=aLd||(async()=>{const wt=setTimeout(()=>{if(!AL&&!aErr){aErr=2;aEM='Opening your library is taking too long.';aLd=null;auRefresh()}},12000);
  try{const g=k=>wd(kget(k),10000).then(v=>v===null?Promise.reject(new Error('storage did not respond')):v),[l,p,ar,s]=await Promise.all(['aulib','aupl','aart','aust'].map(g));
   if(((l&&l.iv)||(p&&p.iv)||(ar&&ar.iv))&&!DK){aErr=3;aEM='Your audio is locked. Unlock the app, then try again.';return}
   const L=await aOpen(l),sf=async(v,d)=>{try{const x=await aOpen(v);return x||d}catch(e){return d}},P=await sf(p,[]),R=await sf(ar,{});
   AL=Array.isArray(L)?L:[];APL=Array.isArray(P)?P:[];AART=R&&typeof R==='object'&&!Array.isArray(R)?R:{};
   if(s&&!aCur){const m=AL.find(x=>x.id===s.id);if(m){aCur=m;aAt=s.t||0}}}
  catch(e){aErr=1;aEM='Could not read your library: '+(e&&e.message||e)}finally{clearTimeout(wt);aLd=null;auRefresh();auUI()}})()}
function aRetry(){aErr=0;aEM='';AL=null;aLd=null;render()}
const aSave=k=>aQ=aQ.then(async()=>{const m={aulib:AL,aupl:APL,aart:AART}[k];if(m)try{await kput(k,await aSeal(m))}catch(e){console.warn('audio save failed',e)}});
const aSt=()=>{if(aCur&&aURL)kput('aust',{id:aCur.id,t:A.currentTime||0}).catch(()=>{})};
async function auPut(id,buf,type){if(DK){const iv=crypto.getRandomValues(new Uint8Array(12));await kput('au:'+id,{enc:1,iv,ct:await crypto.subtle.encrypt({name:'AES-GCM',iv},DK,buf),type})}else await kput('au:'+id,{buf,type})}
async function auGet(id){const r=await kget('au:'+id);if(!r)return null;const buf=r.enc?await crypto.subtle.decrypt({name:'AES-GCM',iv:r.iv},DK,r.ct):r.buf;return new Blob([buf],{type:r.type})}
async function auStore(blob,m){const id=uid();try{await auPut(id,await blob.arrayBuffer(),blob.type)}catch(e){try{await kdel('au:'+id)}catch(x){}return 0}
 const r={id,kind:'file',dur:0,size:blob.size,c:Date.now(),type:blob.type,...m};AL.unshift(r);return r}
const aDur=(b,ms)=>new Promise(r=>{const t=new Audio(),u=URL.createObjectURL(b),d=v=>{URL.revokeObjectURL(u);r(isFinite(v)?v:0)};t.preload='metadata';t.onloadedmetadata=()=>d(t.duration);t.onerror=()=>d(0);setTimeout(()=>d(0),ms||3000);t.src=u});

/* ---- covers ---- */
async function aThumb(b){try{const bm=await createImageBitmap(b),s=Math.min(1,320/Math.max(bm.width,bm.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(bm.width*s));c.height=Math.max(1,Math.round(bm.height*s));c.getContext('2d').drawImage(bm,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.74)}catch(e){return ''}}
const aBlob=d=>{const x=atob(d.split(',')[1]),u=new Uint8Array(x.length);for(let i=0;i<x.length;i++)u[i]=x.charCodeAt(i);return new Blob([u],{type:'image/jpeg'})};
const artU=m=>{if(aNoArt)return '';const k=m&&m.ak,d=k&&AART[k];if(!d)return '';try{return AARU[k]||(AARU[k]=URL.createObjectURL(aBlob(d)))}catch(e){return ''}};
const cvH=(m,c)=>{const u=artU(m);return `<span class="cv${c?' '+c:''}">${u?`<img src="${u}" alt="" loading=lazy decoding=async>`:aico.note}</span>`};

/* ---- reading tags: ID3 (mp3) and MP4 (m4a). Anything else falls back to the file name. ---- */
const rdb=(f,a,b)=>f.slice(a,b).arrayBuffer();
const aDec=(u,e)=>{try{let s=e===1?(u[0]===0xFE&&u[1]===0xFF?new TextDecoder('utf-16be').decode(u.subarray(2)):new TextDecoder('utf-16le').decode(u[0]===0xFF&&u[1]===0xFE?u.subarray(2):u)):e===2?new TextDecoder('utf-16be').decode(u):e===3?new TextDecoder('utf-8').decode(u):new TextDecoder('windows-1252').decode(u);return s.split('\0')[0].trim()}catch(x){return ''}};
async function aId3(f,h,o){const v=h[3],sz=((h[6]&127)<<21)|((h[7]&127)<<14)|((h[8]&127)<<7)|(h[9]&127),u=new Uint8Array(await rdb(f,10,10+Math.min(sz,16*1048576)));let p=0;
 if(h[5]&64&&u.length>4)p=v===4?(((u[0]&127)<<21)|((u[1]&127)<<14)|((u[2]&127)<<7)|(u[3]&127)):(((u[0]<<24)|(u[1]<<16)|(u[2]<<8)|u[3])+4);
 const il=v===2?3:4,hl=v===2?6:10;
 while(p+hl<=u.length){const id=String.fromCharCode(...u.subarray(p,p+il));if(!/^[A-Z0-9]{3,4}$/.test(id))break;
  const fs=v===2?(u[p+3]<<16)|(u[p+4]<<8)|u[p+5]:v===4?((u[p+4]&127)<<21)|((u[p+5]&127)<<14)|((u[p+6]&127)<<7)|(u[p+7]&127):(u[p+4]*16777216)+(u[p+5]<<16)+(u[p+6]<<8)+u[p+7];
  const d=u.subarray(p+hl,p+hl+fs);p+=hl+fs;if(!fs)continue;const tx=()=>aDec(d.subarray(1),d[0]);
  if(id==='TIT2'||id==='TT2')o.t=tx();else if(id==='TPE1'||id==='TP1')o.a=tx();else if(id==='TALB'||id==='TAL')o.l=tx();else if(id==='TPE2'||id==='TP2')o.aa=tx();else if(id==='TRCK'||id==='TRK')o.n=parseInt(tx())||0;
  else if((id==='APIC'||id==='PIC')&&!o.p){const e=d[0];let i;if(id==='PIC')i=5;else{let j=1;while(j<d.length&&d[j])j++;i=j+2}
   if(e===1||e===2){while(i+1<d.length&&!(d[i]===0&&d[i+1]===0))i+=2;i+=2}else{while(i<d.length&&d[i])i++;i++}
   if(i<d.length)o.p=new Blob([d.slice(i)])}}}
async function aMp4(f,o){let p=0;while(p+8<=f.size){const x=new DataView(await rdb(f,p,p+16));let s=x.getUint32(0),h=8;const t=String.fromCharCode(x.getUint8(4),x.getUint8(5),x.getUint8(6),x.getUint8(7));if(s===1&&x.byteLength>=16){s=Number(x.getBigUint64(8));h=16}
  if(s<8)break;if(t==='moov'){if(s>12*1048576)return;const u=new Uint8Array(await rdb(f,p+h,p+s)),dv=new DataView(u.buffer);
   const walk=(a,e,il)=>{let q=a;while(q+8<=e){const z=dv.getUint32(q),k=String.fromCharCode(u[q+4],u[q+5],u[q+6],u[q+7]);if(z<8||q+z>e)break;
    if(il){const ds=q+8;if(ds+16<=q+z&&String.fromCharCode(u[ds+4],u[ds+5],u[ds+6],u[ds+7])==='data'){const pl=u.subarray(ds+16,q+z),td=()=>new TextDecoder().decode(pl).trim();
     if(k==='\xA9nam')o.t=td();else if(k==='\xA9ART')o.a=td();else if(k==='\xA9alb')o.l=td();else if(k==='aART')o.aa=td();else if(k==='covr')o.p=new Blob([pl.slice()],{type:pl[0]===0x89?'image/png':'image/jpeg'});else if(k==='trkn'&&pl.length>=4)o.n=(pl[2]<<8)|pl[3]}}
    else if(k==='moov'||k==='udta')walk(q+8,q+z);else if(k==='meta')walk(q+12,q+z);else if(k==='ilst')walk(q+8,q+z,1);q+=z}};
   walk(0,u.length);return}p+=s}}
async function aTags(f){const o={};try{const h=new Uint8Array(await rdb(f,0,12));if(h[0]===0x49&&h[1]===0x44&&h[2]===0x33)await aId3(f,h,o);else if(String.fromCharCode(h[4],h[5],h[6],h[7])==='ftyp')await aMp4(f,o)}catch(e){}return o}

/* ---- adding music ---- */
async function auAdd(files){if(aImp)return;await auLoad();if(!AL){await say('Unlock the app first, then try again.');return}
 const L=files.filter(f=>AEXT.test(f.name)||(f.type||'').startsWith('audio/'));if(!L.length){await say('No audio files were found. Pick mp3, m4a, wav, ogg or flac files.');return}
 const ex=new Set(AL.map(x=>(x.fn||'')+'|'+x.size));let ok=0,dup=0,big=0,full=0,art=0;aPr=1;aPm=0;aImp={n:L.length,i:0,name:'',stop:0};try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}
 auRefresh();
 try{for(const f of L){if(aImp.stop)break;aImp.i++;const base=f.name.replace(/\.[^.]+$/,'').replace(/_/g,' ');aImp.name=base;const e=$('#aimp');if(e)e.outerHTML=aImpH();
  if(ex.has(f.name+'|'+f.size)){dup++;continue}if(f.size>AMAX){big++;continue}
  const ext=(f.name.split('.').pop()||'').toLowerCase(),type=f.type&&f.type.startsWith('audio/')?f.type:AMT[ext]||'audio/mpeg',b=new Blob([f],{type}),tg=(await wd(aTags(f),8000))||{},d0=aPr?await aDur(b,700):0;if(aPr){if(d0)aPm=0;else if(++aPm>=2)aPr=0}
  let title=tg.t||base.replace(/^\d{1,3}[\s.\-]+/,''),artist=tg.a||'';if(!tg.t){const m=title.match(/^(.+?)\s+-\s+(.+)$/);if(m){artist=artist||m[1].trim();title=m[2].trim()}}
  const id0=uid(),al=tg.l||'',ak=al?(al+'|'+(tg.aa||artist)).toLowerCase():'x'+id0;
  const r=await auStore(b,{name:title||base,ar:artist,al,ak,tr:tg.n||0,fn:f.name,dur:Math.round(d0),type});if(!r){full++;break}
  if(tg.p&&!AART[ak]){const d=await aThumb(tg.p);if(d){AART[ak]=d;art=1}}
  ex.add(f.name+'|'+f.size);ok++;if(ok%10===0){aSave('aulib');if(art){aSave('aart');art=0}auRefresh();aImpFix()}}}
 finally{aImp=null;aSave('aulib');aSave('aart');auRefresh()}
 if(full)await say('There is not enough free storage on this phone for the rest.');
 if(big)await say(big+(big===1?' file was':' files were')+' skipped because they are over 120 MB.');
 toast(ok?'Added '+nsong(ok)+(dup?'. '+dup+' already in your library.':'.'):dup?'Everything was already in your library.':'Nothing was added.')}
const wd=(p,ms)=>Promise.race([p,new Promise(r=>setTimeout(()=>r(null),ms))]);
const aImpH=()=>aImp?`<div class=aimp id=aimp><div class=aimt><span>Adding ${aImp.i} of ${aImp.n}</span><button class=ghs onclick="aImp.stop=1">Stop</button></div><div class=aimn>${esc(aImp.name)}</div><i class=aimb style="width:${aImp.n?aImp.i/aImp.n*100:0}%"></i></div>`:'';
const aImpFix=()=>{const e=$('#aimp');if(e&&aImp)e.outerHTML=aImpH()};
const auPickF=i=>{const f=[...i.files];i.value='';mclose();auAdd(f)};
const aBtns=()=>`<label class=btn>${aico.note}Songs<input type=file accept="audio/*,.m4a,.mp3,.aac,.wav,.ogg,.opus,.flac" multiple hidden onchange="auPickF(this)"></label><label class=btn>${aico.stack}A folder<input type=file webkitdirectory multiple hidden onchange="auPickF(this)"></label>`;
function auAddMenu(){M.innerHTML=`<div class=sheet role=dialog aria-label="Add audio"><h3>Add to your audio</h3><div class=aacts>${aBtns()}</div><button class=mi onclick="mclose();auRec()">Record a voice note</button><p class=sub style="margin-top:14px">Pick songs once and they are copied into the app, so they play offline. Choose more later and anything already added is skipped.</p></div>`;M.classList.add('on')}

/* ---- voice notes ---- */
async function auRec(){if(aRec)return;
 if(!navigator.mediaDevices||!window.MediaRecorder){say('Recording is not supported in this browser.');return}
 await auLoad();if(!AL){say('Unlock the app first, then try again.');return}
 let st;try{st=await navigator.mediaDevices.getUserMedia({audio:true})}catch(e){say('Microphone access is blocked. Allow the microphone for this site in your browser settings, then try again.');return}
 if(aCur&&!A.paused)A.pause();
 const mt=['audio/mp4','audio/webm;codecs=opus','audio/webm'].find(t=>MediaRecorder.isTypeSupported(t))||'',rec=new MediaRecorder(st,mt?{mimeType:mt}:{}),ch=[],t0=Date.now();
 rec.ondataavailable=e=>{if(e.data&&e.data.size)ch.push(e.data)};aRec=1;
 M.innerHTML=`<div class=sheet role=dialog aria-label="Recording"><div class=rec><i class=rdot></i><div class=rt id=rt>0:00</div><p class=sub>Recording. Stays on this phone.</p></div><div class=acts><button class=btn data-x=drop>Discard</button><button class="btn pri" data-x=stop>Stop and save</button></div></div>`;M.classList.add('on');
 const tk=setInterval(()=>{const e=$('#rt');if(e)e.textContent=tfmt((Date.now()-t0)/1000)},250);
 M.onclick=async ev=>{const b=ev.target.closest('button');if(!b)return;M.onclick=null;clearInterval(tk);const save=b.dataset.x==='stop',dur=(Date.now()-t0)/1000;
  await new Promise(r=>{rec.onstop=r;rec.state!=='inactive'?rec.stop():r()});st.getTracks().forEach(x=>x.stop());aRec=null;mclose();
  if(!save||!ch.length)return;
  const blob=new Blob(ch,{type:rec.mimeType||mt||'audio/webm'}),def='Voice note · '+new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
  let nm=await prm('Name this recording',{val:def,ok:'Save',cancel:'Discard'});
  if(nm===null){if(await ask('Discard this recording?',{ok:'Discard',cancel:'Keep',danger:1}))return;nm=def}
  const r=await auStore(blob,{name:(nm||'').trim()||def,kind:'voice',dur:Math.round(dur),ak:'v'+uid()});
  if(r){await aSave('aulib');auT='voice';auD=null;toast('Voice note saved.');auRefresh()}else say('There is not enough free storage on this phone to save this.')};
 rec.start(1000)}

/* ---- queue ---- */
const aShA=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const byT=(a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:'base',numeric:true});
const songs=()=>(AL||[]).filter(x=>x.kind!=='voice');
function auSetQ(list,id){aQo=list.map(x=>x.id);const c=id||aQo[0];aQu=aShuf?[c,...aShA(aQo.filter(x=>x!==c))]:aQo.slice();aQi=aQu.indexOf(c)}
function aEnsureQ(){if(!aCur||aQu.includes(aCur.id))return;auSetQ(aCur.kind==='voice'?(AL||[]).filter(x=>x.kind==='voice'):songs().sort(byT),aCur.id)}
function auList(){let L;
 if(auT==='voice')return(AL||[]).filter(x=>x.kind==='voice');const S=songs();
 if(auD){if(auD.k==='artist')L=S.filter(x=>(x.ar||'Unknown artist')===auD.v).sort((a,b)=>(a.al||'').localeCompare(b.al||'')||(a.tr||0)-(b.tr||0)||byT(a,b));
  else if(auD.k==='album')L=S.filter(x=>x.ak===auD.v).sort((a,b)=>(a.tr||0)-(b.tr||0)||byT(a,b));
  else if(auD.v==='fav')L=S.filter(x=>x.fav).sort(byT);else{const p=APL.find(x=>x.id===auD.v);L=p?p.ids.map(i=>AL.find(x=>x.id===i)).filter(Boolean):[]}return L}
 L=S.slice().sort(byT);const q=aq.trim().toLowerCase();return q?L.filter(x=>(x.name+' '+(x.ar||'')+' '+(x.al||'')).toLowerCase().includes(q)):L}
function auPick(id){if(aCur&&aCur.id===id&&aURL)return auToggle();auSetQ(auList(),id);aLoad(id)}
function auPlayAll(sh){const L=auList();if(!L.length)return;aShuf=sh?1:0;const id=sh?L[Math.floor(Math.random()*L.length)].id:L[0].id;auSetQ(L,id);aLoad(id)}
function auNext(d,auto){if(!aCur)return;aEnsureQ();if(d<0&&(A.currentTime||0)>3){A.currentTime=0;return}
 let i=aQi+d;if(i>=aQu.length){if(aRep===1&&aQu.length)i=0;else{A.pause();A.currentTime=0;return}}if(i<0){if(aRep===1&&aQu.length)i=aQu.length-1;else{A.currentTime=0;return}}
 aQi=i;aLoad(aQu[i])}
const auShuf=()=>{aShuf=aShuf?0:1;if(aCur&&aQu.length){const c=aCur.id;if(aShuf)aQu=[...aQu.slice(0,aQi+1),...aShA(aQu.slice(aQi+1))];else{aQu=aQo.slice();aQi=Math.max(0,aQu.indexOf(c))}}auUI()};
const auRep=()=>{aRep=(aRep+1)%3;auUI()};
function auQAdd(id,next){if(!AL)return;aEnsureQ();if(!aQu.length){auSetQ(auList(),null);aQi=-1}const i=aQu.indexOf(id);if(i>=0&&i>aQi)aQu.splice(i,1);aQu.splice(next?aQi+1:aQu.length,0,id);toast(next?'Playing next.':'Added to the queue.');if(!aCur)aLoad(aQu[0])}
function auQueue(){const up=aQu.slice(aQi+1).map((id,k)=>({m:AL.find(x=>x.id===id),k:aQi+1+k})).filter(x=>x.m);
 M.innerHTML=`<div class=sheet role=dialog aria-label="Up next"><h3>Up next</h3>${up.length?up.slice(0,80).map(({m,k})=>`<div class=aur><button class=aum onclick="aQi=${k};mclose();aLoad('${m.id}')">${cvH(m)}<span class=aut><span class=aun>${esc(m.name)}</span><span class=aus>${esc(m.ar||'Unknown artist')}</span></span></button><button class=auk onclick="aQu.splice(${k},1);auQueue()" aria-label="Remove from queue">×</button></div>`).join(''):'<p class=sub>Nothing queued. Use Play next or Add to queue on any song.</p>'}</div>`;M.classList.add('on')}

/* ---- playback ---- */
async function aLoad(id,at){if(!aUnl){aUnl=1;A.src=SIL;A.play().catch(()=>{})}   /* unlocks the element inside the tap so iPhone allows playback after the async load */
 const m=(AL||[]).find(x=>x.id===id);if(!m)return;const tok=++aTok;let b=null;try{b=await auGet(id)}catch(e){}
 if(tok!==aTok)return;if(!b){say('This audio could not be opened. Make sure the app is unlocked and try again.');return}
 if(aURL)URL.revokeObjectURL(aURL);aURL=URL.createObjectURL(b);aAt=at||0;A.src=aURL;A.playbackRate=aSpd;aCur=m;
 try{await A.play()}catch(e){if(tok===aTok){aCur=null;aURL='';A.removeAttribute('src');say('This file type cannot be played on this phone.')}}
 auUI();auRefresh()}
const auToggle=()=>{if(!aCur)return;if(!aURL||A.src!==aURL){aEnsureQ();aLoad(aCur.id,aAt);return}A.paused?A.play().catch(()=>{}):A.pause()};
const auSeek=d=>{if(!aCur)return;const m=isFinite(A.duration)?A.duration:1e9;A.currentTime=Math.max(0,Math.min(m,(A.currentTime||0)+d));auPS()};
function auStop(){aTok++;A.pause();A.removeAttribute('src');if(aURL)URL.revokeObjectURL(aURL);aURL='';aCur=null;clearTimeout(aSlpT);aSlp=0;auUI();auRefresh()}
const auSpd=()=>{const L=[1,1.25,1.5,2,.75];aSpd=L[(L.indexOf(aSpd)+1)%L.length];A.playbackRate=aSpd;auUI()};
const auSlp=()=>{const L=[0,15,30,60];aSlp=L[(L.indexOf(aSlp)+1)%L.length];clearTimeout(aSlpT);if(aSlp)aSlpT=setTimeout(()=>{let v=1;const iv=setInterval(()=>{v-=.1;if(v<=.05){clearInterval(iv);A.pause();A.volume=1;aSlp=0;auUI()}else A.volume=v},300)},aSlp*6e4);auUI()};

/* ---- lock-screen controls ---- */
function auMS(){if(!('mediaSession' in navigator))return;const ms=navigator.mediaSession;
 if(!aCur){try{ms.metadata=null}catch(e){}ms.playbackState='none';return}
 const u=artU(aCur);try{ms.metadata=new MediaMetadata({title:aCur.name,artist:aCur.ar||(aCur.kind==='voice'?'Voice note':'The V Fi'),album:aCur.al||'The V Fi',artwork:u?[{src:u,sizes:'320x320',type:'image/jpeg'}]:[{src:'icon-512.png',sizes:'512x512',type:'image/png'}]})}catch(e){}
 ms.playbackState=A.paused?'paused':'playing'}
function auPS(){try{if(aCur&&isFinite(A.duration)&&A.duration>0)navigator.mediaSession.setPositionState({duration:A.duration,position:Math.min(A.currentTime,A.duration),playbackRate:A.playbackRate||1})}catch(e){}}
if('mediaSession' in navigator)[['play',()=>auToggle()],['pause',()=>A.pause()],['seekbackward',()=>auSeek(-15)],['seekforward',()=>auSeek(15)],['previoustrack',()=>auNext(-1)],['nexttrack',()=>auNext(1)],['seekto',d=>{A.currentTime=d.seekTime;auPS()}]].forEach(([k,f])=>{try{navigator.mediaSession.setActionHandler(k,f)}catch(e){}});

/* ---- players ---- */
document.body.insertAdjacentHTML('beforeend',`<div id=mp hidden><span class=mpa></span><button class=mpm onclick="auOpen()" aria-label="Open player"><span class=mpt></span><span class=mps></span></button><button class=mpb onclick="auToggle()"></button><i class=mpl></i></div>
<div id=np hidden role=dialog aria-modal=true aria-label="Now playing"><div class=npw><div class=npt><button class=npx onclick="auClose()" aria-label="Close player">${aico.down}</button><button class=npx onclick="auQueue()" aria-label="Up next">${aico.que}</button></div>
<div class=npa id=npa></div>
<div class=nph><div class=npi><h2 class=npn id=npn></h2><p class=sub id=nps></p></div><button class=hrt id=nphb onclick="auFavT(aCur&&aCur.id)"></button></div>
<input type=range id=npr min=0 max=1000 value=0 step=1 aria-label="Seek"><div class=npc><button onclick="auSeek(-15)" aria-label="Back 15 seconds">${aico.back}</button><span id=npe>0:00</span><span class=sp></span><span id=npd>0:00</span><button onclick="auSeek(15)" aria-label="Forward 15 seconds">${aico.fwd}</button></div>
<div class=ctl><button class=tg id=npsh onclick="auShuf()" aria-label="Shuffle">${aico.shuf}</button><button onclick="auNext(-1)" aria-label="Previous">${aico.prev}</button><button class=big2 id=npb onclick="auToggle()"></button><button onclick="auNext(1)" aria-label="Next">${aico.next}</button><button class=tg id=nprp onclick="auRep()" aria-label="Repeat">${aico.rep}</button></div>
<div class=npf><button class=chip id=npsp onclick="auSpd()"></button><button class=chip id=npsl onclick="auSlp()"></button><button class=chip onclick="aCur&&auMenu(aCur.id)">More</button></div></div></div>`);
const mp=$('#mp'),np=$('#np'),mpt=$('.mpt'),mps=$('.mps'),mpb=$('.mpb'),mpa=$('.mpa'),npr=$('#npr'),npe=$('#npe'),npd=$('#npd');
function auUI(){const on=!!aCur&&!locked;mp.hidden=!on;document.body.classList.toggle('hasmp',on);
 if(!aCur){if(!np.hidden)auClose();return}
 const pl=!A.paused,u=artU(aCur);mpt.textContent=aCur.name;mpb.innerHTML=pl?aico.pause:aico.play;mpb.setAttribute('aria-label',pl?'Pause':'Play');mpa.innerHTML=u?`<img src="${u}" alt="">`:aico.note;
 const k=aCur.id+u;if(k!==aNpK){aNpK=k;$('#npa').innerHTML=u?`<img class=cov src="${u}" alt="">`:'<svg viewBox="0 0 200 200" aria-hidden="true"><circle class=rg style="--i:0" cx=100 cy=100 r=92 opacity=.25 /><circle class=rg style="--i:1" cx=100 cy=100 r=74 opacity=.4 /><circle class=rg style="--i:2" cx=100 cy=100 r=56 opacity=.6 /><circle class=rg style="--i:3" cx=100 cy=100 r=38 opacity=.85 /><circle cx=100 cy=100 r=12 fill=currentColor /></svg>'}
 $('#npn').textContent=aCur.name;$('#nps').textContent=aCur.kind==='voice'?'Voice note · '+dfmt(aCur.c):(aCur.ar||'Unknown artist')+(aCur.al?' · '+aCur.al:'');
 $('#npb').innerHTML=pl?aico.pause:aico.play;$('#npb').setAttribute('aria-label',pl?'Pause':'Play');$('#npa').classList.toggle('on',pl);
 $('#nphb').innerHTML=aico.heart(aCur.fav);$('#nphb').setAttribute('aria-label',aCur.fav?'Remove from favorites':'Add to favorites');$('#nphb').classList.toggle('on',!!aCur.fav);$('#nphb').hidden=aCur.kind==='voice';
 $('#npsh').classList.toggle('on',!!aShuf);$('#npsh').setAttribute('aria-pressed',!!aShuf);$('#nprp').classList.toggle('on',aRep>0);$('#nprp').innerHTML=aRep===2?aico.rep.replace('</svg>','<text x="12" y="15" text-anchor="middle" font-size="7" fill="currentColor" stroke="none" font-weight="700" font-family="system-ui">1</text></svg>'):aico.rep;$('#nprp').setAttribute('aria-label',['Repeat off','Repeat all','Repeat one'][aRep]);
 $('#npsp').textContent=aSpd+'×';$('#npsp').setAttribute('aria-label','Speed '+aSpd+' times');$('#npsl').textContent=aSlp?'Sleep in '+aSlp+' min':'Sleep timer off';
 auMS();auPS();auTick()}
function auTick(){if(!aCur)return;const d=isFinite(A.duration)&&A.duration>0?A.duration:(aCur.dur||0),t=A.currentTime||0;
 mp.style.setProperty('--p',(d?Math.min(100,t/d*100):0)+'%');mps.textContent=(aCur.ar?aCur.ar+' · ':'')+tfmt(t)+' / '+tfmt(d);
 if(!np.hidden){npe.textContent=tfmt(t);npd.textContent=tfmt(d);if(!aDrag)npr.value=d?Math.round(Math.min(1,t/d)*1000):0;npr.style.setProperty('--p',npr.value/10+'%')}}
const auOpen=()=>{if(!aCur)return;np.hidden=false;document.body.classList.add('npopen');auUI();$('.npx').focus()},auClose=()=>{np.hidden=true;document.body.classList.remove('npopen');try{mpb.focus()}catch(e){}};
const auRefresh=()=>{if(!locked&&tab==='jrnv'&&jsub==='au')render()};
npr.addEventListener('input',()=>{aDrag=1;if(aCur&&isFinite(A.duration))A.currentTime=npr.value/1000*A.duration;auTick()});
npr.addEventListener('change',()=>{aDrag=0;auPS()});
A.addEventListener('play',()=>{auUI();auRefresh();clearInterval(aStT);aStT=setInterval(aSt,5000)});A.addEventListener('pause',()=>{auUI();auRefresh();clearInterval(aStT);aSt()});
A.addEventListener('timeupdate',auTick);A.addEventListener('ratechange',auPS);
A.addEventListener('loadedmetadata',()=>{if(aAt&&A.src===aURL){try{A.currentTime=aAt}catch(e){}aAt=0}if(aCur&&A.src===aURL&&!aCur.dur&&isFinite(A.duration)&&A.duration>0){aCur.dur=Math.round(A.duration);aSave('aulib');auRefresh()}auTick();auPS()});
A.addEventListener('ended',()=>{if(!aCur||A.src!==aURL)return;if(aRep===2){A.currentTime=0;A.play().catch(()=>{});return}auNext(1,1)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!e.defaultPrevented&&!np.hidden&&!DL.classList.contains('on'))auClose()});

/* ---- locking: voice notes stop, the library is dropped from memory, players hide until unlock ---- */
const _lockNow=window.lockNow;
window.lockNow=async function(...a){if(typeof META!=='undefined'&&META&&!locked){if(aCur&&aCur.kind==='voice')auStop();AL=null;APL=[];AART={};Object.values(AARU).forEach(u=>URL.revokeObjectURL(u));AARU={};aErr=0;aLd=null}const r=await _lockNow.apply(this,a);auUI();return r};
new MutationObserver(()=>{auUI();if(!$('#lock').classList.contains('on')&&!AL){aErr=0;aEM='';auLoad()}}).observe($('#lock'),{attributes:true,attributeFilter:['class']});

/* ---- track actions ---- */
const aFind=id=>(AL||[]).find(x=>x.id===id);
function auMenu(id){const m=aFind(id);if(!m)return;const inPl=auD&&auD.k==='list'&&auD.v!=='fav'&&auT==='lists',v=m.kind==='voice';
 M.innerHTML=`<div class=sheet role=dialog aria-label="Options"><h3>${esc(m.name)}</h3><p class=sub>${esc(m.ar||(v?'Voice note':'Unknown artist'))} ${dtx(m)} · ${smb(m.size||0)}</p>
 <button class=mi onclick="mclose();auQAdd('${id}',1)">Play next</button><button class=mi onclick="mclose();auQAdd('${id}',0)">Add to queue</button>
 ${v?'':`<button class=mi onclick="mclose();auFavT('${id}')">${m.fav?'Remove from favorites':'Add to favorites'}</button><button class=mi onclick="auPlPick('${id}')">Add to a playlist</button>`}
 ${inPl?`<button class=mi onclick="mclose();auPlRm('${id}')">Remove from this playlist</button>`:''}
 <button class=mi onclick="mclose();auRen('${id}')">Rename</button><button class="mi red" onclick="mclose();auDel('${id}')">Delete</button></div>`;M.classList.add('on')}
function auFavT(id){const m=aFind(id);if(!m||m.kind==='voice')return;m.fav=m.fav?0:1;aSave('aulib');auUI();auRefresh()}
async function auRen(id){const m=aFind(id);if(!m)return;const v=await prm('Rename',{val:m.name,ok:'Save'});if(v&&v.trim()){m.name=v.trim();aSave('aulib');auUI();auRefresh()}}
async function auDel(id){const m=aFind(id);if(!m||!(await ask('Delete "'+m.name+'"? This cannot be undone.',{ok:'Delete',danger:1})))return;
 if(aCur&&aCur.id===id)auStop();await kdel('au:'+id);AL=AL.filter(x=>x.id!==id);APL.forEach(p=>p.ids=p.ids.filter(x=>x!==id));
 const qx=aQu.indexOf(id);if(qx>=0){aQu.splice(qx,1);if(qx<=aQi)aQi--}if(m.ak&&AART[m.ak]&&!AL.some(x=>x.ak===m.ak)){delete AART[m.ak];if(AARU[m.ak]){URL.revokeObjectURL(AARU[m.ak]);delete AARU[m.ak]}aSave('aart')}
 aSave('aulib');aSave('aupl');auRefresh()}
function auPlPick(id){M.innerHTML=`<div class=sheet role=dialog aria-label="Add to a playlist"><h3>Add to a playlist</h3>${APL.map(p=>`<button class=mi onclick="mclose();auPlAdd('${p.id}','${id}')">${esc(p.name)}</button>`).join('')}<button class=mi onclick="mclose();auPlNew('${id}')">New playlist</button></div>`;M.classList.add('on')}
function auPlAdd(pid,id){const p=APL.find(x=>x.id===pid);if(!p)return;if(p.ids.includes(id)){toast('Already in '+p.name+'.');return}p.ids.push(id);aSave('aupl');toast('Added to '+p.name+'.');auRefresh()}
async function auPlNew(id){const v=await prm('Playlist name',{ok:'Create'});if(!v||!v.trim())return;APL.push({id:uid(),name:v.trim(),ids:id?[id]:[]});aSave('aupl');if(id)toast('Added to '+v.trim()+'.');auRefresh()}
function auPlRm(id){const p=APL.find(x=>auD&&x.id===auD.v);if(!p)return;p.ids=p.ids.filter(x=>x!==id);aSave('aupl');auRefresh()}
async function auPlRen(){const p=APL.find(x=>auD&&x.id===auD.v);if(!p)return;const v=await prm('Rename playlist',{val:p.name,ok:'Save'});if(v&&v.trim()){p.name=v.trim();aSave('aupl');auRefresh()}}
async function auPlDel(){const p=APL.find(x=>auD&&x.id===auD.v);if(!p||!(await ask('Delete the playlist "'+p.name+'"? Your songs stay in the library.',{ok:'Delete',danger:1})))return;APL=APL.filter(x=>x!==p);auD=null;aSave('aupl');auRefresh()}

/* ---- the Audio tab ---- */
const auTab=t=>{auT=t;auD=null;render()},auOpenD=i=>{auD=aAX[i];scrollTo(0,0);render()},auBack=()=>{auD=null;render()};
function auSearch(v){aq=v;const e=$('#aul');if(e)e.innerHTML=auRows(auList(),1)}
function auRow(m){const on=aCur&&aCur.id===m.id,pl=on&&!A.paused;
 return `<div class="aur${on?' on':''}"><button class=aum onclick="auPick('${m.id}')" aria-label="${pl?'Pause':'Play'} ${esc(m.name)}"><span class="cv${pl?' pl':''}">${(()=>{const u=artU(m);return(u?`<img src="${u}" alt="" loading=lazy decoding=async>`:aico.note)+(pl?'<i class=eq><b></b><b></b><b></b></i>':'')})()}</span><span class=aut><span class=aun>${esc(m.name)}</span><span class=aus>${esc(m.ar||(m.kind==='voice'?'Voice note':'Unknown artist'))}${dtx(m)}${m.kind==='voice'?' · '+dfmt(m.c):''}</span></span></button>${m.fav?`<span class=fv aria-label="Favorite">${aico.heart(1)}</span>`:''}<button class=auk onclick="auMenu('${m.id}')" aria-label="Options for ${esc(m.name)}">⋯</button></div>`}
function auRows(L,div){if(!L.length)return `<p class=sub style="margin:22px 0">${aq&&!auD?'No songs match your search.':'Nothing here yet.'}</p>`;let h='',lt='';for(const m of L){if(div){const c=(m.name[0]||'#').toUpperCase(),k=/[A-Z]/.test(c)?c:'#';if(k!==lt){lt=k;h+=`<div class=alt>${k}</div>`}}h+=auRow(m)}return h}
const auPlayBar=n=>n?`<div class=aacts><button class="btn pri" onclick="auPlayAll(0)">${aico.play}Play</button><button class=btn onclick="auPlayAll(1)">${aico.shuf}Shuffle</button></div>`:'';
function auV(){try{return aV()}catch(e){if(!aNoArt){aNoArt=1;try{return aV()}catch(x){e=x}}aEM='Could not show your library: '+(e&&e.message||e);return aPanel()}}
const aPanel=()=>`<h2 class=hi>Audio</h2><p class=sub style="margin-top:6px">${esc(aEM||'Loading your library…')}</p><div class=aacts><button class=btn onclick="aRetry()">Try again</button></div><p class=sub style="font-size:12px;margin-top:18px">${AUV}</p>`;
function aV(){auLoad();aAX=[];
 if(!AL)return aErr?aPanel():`<p class=sub style="margin-top:30px">Loading your library…</p>`;
 const S=songs(),V=AL.filter(x=>x.kind==='voice'),tot=AL.reduce((s,x)=>s+(x.size||0),0);
 if(!AL.length&&!aImp)return `<h2 class=hi>Audio</h2><p class=sub>Your music, kept private on this phone.</p><div class=empty><b>Bring your music</b>Pick your songs once. They are copied into the app and play offline, with names and covers read from each file.</div><div class=aacts>${aBtns()}</div><div class=aacts><button class=btn onclick="auRec()">${aico.mic}Record a voice note</button></div>`;
 const head=`<div class=auh><div><h2 class=hi>Audio</h2><p class=sub>${nsong(S.length)}${V.length?' · '+V.length+(V.length===1?' voice note':' voice notes'):''} · ${smb(tot)}</p></div><button class=plusg onclick="auAddMenu()" aria-label="Add audio">${aico.add}</button></div>${aImpH()}`;
 const tabs=`<div class=autabs role=tablist>${[['songs','Songs'],['artists','Artists'],['albums','Albums'],['lists','Playlists'],['voice','Voice']].map(([k,l])=>`<button role=tab aria-selected="${auT===k}" class="${auT===k?'on':''}" onclick="auTab('${k}')">${l}</button>`).join('')}</div>`;
 let body='';
 if(auD){const L=auList(),pl=auD.k==='list'&&auD.v!=='fav'?APL.find(x=>x.id===auD.v):null,al=auD.k==='album'?L[0]:null,
  tt=auD.k==='artist'?auD.v:auD.k==='album'?(al?al.al:'Album'):auD.v==='fav'?'Favorites':pl?pl.name:'Playlist',st=nsong(L.length)+(auD.k==='album'&&al&&al.ar?' · '+al.ar:'');
  body=`<button class=bk onclick="auBack()">${aico.down.replace('<path d="M6 9l6 6 6-6"/>','<path d="M15 6l-6 6 6 6"/>')}Back</button><div class=dh>${auD.k==='album'&&al?cvH(al,'lg'):''}<div><h3 class=dt>${esc(tt)}</h3><p class=sub>${st}</p></div></div>${pl?`<div class=pm><button class=ghs onclick="auPlRen()">Rename</button><button class="ghs red" onclick="auPlDel()">Delete</button></div>`:''}${auPlayBar(L.length)}<div class=aul id=aul>${auRows(L,0)}</div>`}
 else if(auT==='songs')body=`<input id=aqi type=search placeholder="Search songs, artists, albums" value="${esc(aq)}" oninput="auSearch(this.value)" aria-label="Search">${auPlayBar(S.length)}<div class=aul id=aul>${auRows(auList(),1)}</div>`;
 else if(auT==='artists'){const g={};S.forEach(m=>{const a=m.ar||'Unknown artist';(g[a]=g[a]||{n:0,m}).n++});
  body=`<div class=aul>${Object.keys(g).sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base'})).map(a=>{aAX.push({k:'artist',v:a});const x=g[a];return `<div class=aur><button class=aum onclick="auOpenD(${aAX.length-1})">${artU(x.m)?cvH(x.m,'rd'):`<span class="cv rd">${aico.user}</span>`}<span class=aut><span class=aun>${esc(a)}</span><span class=aus>${nsong(x.n)}</span></span></button></div>`}).join('')||'<p class=sub style="margin:22px 0">No artists yet.</p>'}</div>`}
 else if(auT==='albums'){const g={};S.filter(m=>m.al).forEach(m=>{(g[m.ak]=g[m.ak]||{n:0,m}).n++});const ks=Object.keys(g).sort((a,b)=>g[a].m.al.localeCompare(g[b].m.al,undefined,{sensitivity:'base'}));
  body=ks.length?`<div class=alg>${ks.map(k=>{aAX.push({k:'album',v:k});const x=g[k];return `<button class=alb onclick="auOpenD(${aAX.length-1})">${cvH(x.m,'sq')}<span class=aun>${esc(x.m.al)}</span><span class=aus>${esc(x.m.ar||'Unknown artist')}</span></button>`}).join('')}</div>`:'<p class=sub style="margin:22px 0">Albums appear when your songs have album names.</p>';}
 else if(auT==='lists'){aAX.push({k:'list',v:'fav'});const fv=S.filter(x=>x.fav).length;
  body=`<div class=aul><div class=aur><button class=aum onclick="auOpenD(0)"><span class="cv">${aico.heart(1)}</span><span class=aut><span class=aun>Favorites</span><span class=aus>${nsong(fv)}</span></button></div>${APL.map(p=>{aAX.push({k:'list',v:p.id});return `<div class=aur><button class=aum onclick="auOpenD(${aAX.length-1})"><span class=cv>${aico.stack}</span><span class=aut><span class=aun>${esc(p.name)}</span><span class=aus>${nsong(p.ids.filter(i=>aFind(i)).length)}</span></span></button></div>`}).join('')}</div><div class=aacts><button class=btn onclick="auPlNew()">${aico.add}New playlist</button></div>`}
 else body=`<div class=aacts><button class=btn onclick="auRec()">${aico.mic}Record a voice note</button></div><div class=aul id=aul>${V.length?auRows(V,0):'<p class=sub style="margin:22px 0">Voice notes you record show up here.</p>'}</div>`;
 return head+(auD?'':tabs)+body}
