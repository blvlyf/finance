/* audio.js: private audio library, voice notes, mini player, full player, lock-screen controls.
   Audio lives in IndexedDB under 'aulib' (list) and 'au:<id>' (data). Encrypted with the data key when a PIN is set. */
const AMAX=120*1024*1024,AMT={mp3:'audio/mpeg',m4a:'audio/mp4',aac:'audio/aac',wav:'audio/wav',ogg:'audio/ogg',opus:'audio/ogg',flac:'audio/flac',webm:'audio/webm',mp4:'audio/mp4'};
let AL=null,aErr=0,aCur=null,aTok=0,aURL='',aSpd=1,aSlp=0,aSlpT=0,aDrag=0,aRec=null,aQ=Promise.resolve(),aUnl=0;
const A=new Audio();A.preload='auto';
const SIL=URL.createObjectURL(new Blob([Uint8Array.from(atob('UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA='),c=>c.charCodeAt(0))],{type:'audio/wav'}));
const sv=(w,p,x)=>`<svg viewBox="0 0 24 24" width="${w}" height="${w}" ${p?'fill="currentColor"':'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"'} aria-hidden="true">${x}</svg>`;
const aico={
 play:sv(22,1,'<path d="M8 5.5v13L19 12z"/>'),pause:sv(22,1,'<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/>'),
 prev:sv(24,1,'<path d="M6 5h2v14H6zM20 5.5v13L9.5 12z"/>'),next:sv(24,1,'<path d="M16 5h2v14h-2zM4 5.5v13L14.5 12z"/>'),
 back:sv(32,0,'<path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v4.5h4.5"/><text x="12" y="15.2" text-anchor="middle" font-size="7.5" fill="currentColor" stroke="none" font-family="system-ui" font-weight="600">15</text>'),
 fwd:sv(32,0,'<path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v4.5h-4.5"/><text x="12" y="15.2" text-anchor="middle" font-size="7.5" fill="currentColor" stroke="none" font-family="system-ui" font-weight="600">15</text>'),
 down:sv(26,0,'<path d="M6 9l6 6 6-6"/>'),mic:sv(18,0,'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>'),add:sv(18,0,'<path d="M12 5v14M5 12h14"/>')};
const tfmt=s=>{s=Math.max(0,Math.round(+s||0));const h=Math.floor(s/3600),m=Math.floor(s%3600/60);return(h?h+':'+pad(m):m)+':'+pad(s%60)};
const dfmt=c=>new Date(c).toLocaleDateString('en-US',{month:'short',day:'numeric'});
const smb=b=>b>=1e9?(b/1e9).toFixed(1)+' GB':Math.max(1,Math.round(b/1e6))+' MB';

/* ---- storage ---- */
async function auLoad(){if(AL||aErr)return;let v=await kget('aulib');
 try{if(v&&v.iv){if(!DK)return;v=JSON.parse(D8.decode(await aesDec(DK,v)))}}catch(e){aErr=1;auRefresh();return}
 AL=Array.isArray(v)?v:[];auRefresh()}
const auSave=()=>aQ=aQ.then(async()=>{if(!AL)return;try{await kput('aulib',DK?await seal(DK,AL):AL)}catch(e){console.warn('audio save failed',e)}});
async function auPut(id,buf,type){if(DK){const iv=crypto.getRandomValues(new Uint8Array(12));await kput('au:'+id,{enc:1,iv,ct:await crypto.subtle.encrypt({name:'AES-GCM',iv},DK,buf),type})}else await kput('au:'+id,{buf,type})}
async function auGet(id){const r=await kget('au:'+id);if(!r)return null;const buf=r.enc?await crypto.subtle.decrypt({name:'AES-GCM',iv:r.iv},DK,r.ct):r.buf;return new Blob([buf],{type:r.type})}
async function auStore(blob,name,kind,dur){await auLoad();if(!AL){await say('Unlock the app first, then try again.');return false}
 const id=uid();try{await auPut(id,await blob.arrayBuffer(),blob.type);try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}}
 catch(e){await kdel('au:'+id);await say('There is not enough free storage on this phone to save this.');return false}
 AL.unshift({id,name,kind,dur:Math.round(dur)||0,size:blob.size,c:Date.now(),type:blob.type});await auSave();return true}
const aDur=b=>new Promise(r=>{const t=new Audio(),u=URL.createObjectURL(b),d=v=>{URL.revokeObjectURL(u);r(isFinite(v)?v:0)};t.preload='metadata';t.onloadedmetadata=()=>d(t.duration);t.onerror=()=>d(0);setTimeout(()=>d(0),5000);t.src=u});

/* ---- add files ---- */
async function auAdd(files){let ok=0,bad=0;const n=files.length;
 for(let i=0;i<n;i++){const f=files[i],ext=(f.name.split('.').pop()||'').toLowerCase(),type=f.type&&f.type.startsWith('audio/')?f.type:AMT[ext];
  if(!type||f.size>AMAX){bad++;continue}
  if(n>1)toast('Adding '+(i+1)+' of '+n+'…',null,1800);
  const b=new Blob([f],{type});if(await auStore(b,f.name.replace(/\.[^.]+$/,''),'file',await aDur(b)))ok++;else break}
 if(bad)await say(bad+(bad===1?' file was':' files were')+' skipped. Use audio files under 120 MB (mp3, m4a, wav, ogg, flac).');
 if(ok)toast(ok===1?'Added to your audio.':ok+' tracks added.');auRefresh()}

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
  if(await auStore(blob,(nm||'').trim()||def,'voice',dur)){toast('Voice note saved.');auRefresh()}};
 rec.start(1000)}

/* ---- playback ---- */
async function auPlay(id){if(aCur&&aCur.id===id)return auToggle();
 if(!aUnl){aUnl=1;A.src=SIL;A.play().catch(()=>{})}   /* unlocks the element inside the tap, so iPhone allows playback after the async load */
 const m=(AL||[]).find(x=>x.id===id);if(!m)return;const tok=++aTok;let b=null;try{b=await auGet(id)}catch(e){}
 if(tok!==aTok)return;if(!b){say('This audio could not be opened. Make sure the app is unlocked and try again.');return}
 if(aURL)URL.revokeObjectURL(aURL);aURL=URL.createObjectURL(b);A.src=aURL;A.playbackRate=aSpd;aCur=m;
 try{await A.play()}catch(e){if(tok===aTok){aCur=null;A.removeAttribute('src');say('This file type cannot be played on this phone.')}}
 auUI();auRefresh()}
const auToggle=()=>{if(!aCur)return;A.paused?A.play().catch(()=>{}):A.pause()};
const auSeek=d=>{if(!aCur)return;const m=isFinite(A.duration)?A.duration:1e9;A.currentTime=Math.max(0,Math.min(m,(A.currentTime||0)+d));auPS()};
function auNext(d){if(!aCur||!AL)return;const i=AL.findIndex(x=>x.id===aCur.id),j=i+d;
 if(d<0&&A.currentTime>3){A.currentTime=0;return}
 if(j>=0&&j<AL.length)auPlay(AL[j].id);else if(d>0){A.pause();A.currentTime=0}else A.currentTime=0}
function auStop(){aTok++;A.pause();A.removeAttribute('src');if(aURL)URL.revokeObjectURL(aURL);aURL='';aCur=null;clearTimeout(aSlpT);aSlp=0;auUI();auRefresh()}
const auSpd=()=>{const L=[1,1.25,1.5,2,.75];aSpd=L[(L.indexOf(aSpd)+1)%L.length];A.playbackRate=aSpd;auUI()};
const auSlp=()=>{const L=[0,15,30,60];aSlp=L[(L.indexOf(aSlp)+1)%L.length];clearTimeout(aSlpT);if(aSlp)aSlpT=setTimeout(()=>{let v=1;const iv=setInterval(()=>{v-=.1;if(v<=.05){clearInterval(iv);A.pause();A.volume=1;aSlp=0;auUI()}else A.volume=v},300)},aSlp*6e4);auUI()};

/* ---- lock-screen controls ---- */
function auMS(){if(!('mediaSession' in navigator))return;const ms=navigator.mediaSession;
 if(!aCur){try{ms.metadata=null}catch(e){}ms.playbackState='none';return}
 try{ms.metadata=new MediaMetadata({title:aCur.name,artist:aCur.kind==='voice'?'Voice note':'The V Fi',album:'The V Fi',artwork:[{src:'icon-512.png',sizes:'512x512',type:'image/png'}]})}catch(e){}
 ms.playbackState=A.paused?'paused':'playing'}
function auPS(){try{if(aCur&&isFinite(A.duration)&&A.duration>0)navigator.mediaSession.setPositionState({duration:A.duration,position:Math.min(A.currentTime,A.duration),playbackRate:A.playbackRate||1})}catch(e){}}
if('mediaSession' in navigator)[['play',()=>A.play()],['pause',()=>A.pause()],['seekbackward',()=>auSeek(-15)],['seekforward',()=>auSeek(15)],['previoustrack',()=>auNext(-1)],['nexttrack',()=>auNext(1)],['seekto',d=>{A.currentTime=d.seekTime;auPS()}]].forEach(([k,f])=>{try{navigator.mediaSession.setActionHandler(k,f)}catch(e){}});

/* ---- players (mini bar above the nav, full screen on tap) ---- */
document.body.insertAdjacentHTML('beforeend',`<div id=mp hidden><button class=mpm onclick="auOpen()" aria-label="Open player"><span class=mpt></span><span class=mps></span></button><button class=mpb onclick="auToggle()"></button><i class=mpl></i></div>
<div id=np hidden role=dialog aria-modal=true aria-label="Now playing"><div class=npw><div class=npt><button class=npx onclick="auClose()" aria-label="Close player">${aico.down}</button><button class=chip id=npsp onclick="auSpd()"></button></div>
<div class=npa id=npa><svg viewBox="0 0 200 200" aria-hidden="true"><circle class=rg style="--i:0" cx=100 cy=100 r=92 opacity=.25 /><circle class=rg style="--i:1" cx=100 cy=100 r=74 opacity=.4 /><circle class=rg style="--i:2" cx=100 cy=100 r=56 opacity=.6 /><circle class=rg style="--i:3" cx=100 cy=100 r=38 opacity=.85 /><circle cx=100 cy=100 r=12 fill=currentColor /></svg></div>
<h2 class=npn id=npn></h2><p class=sub id=nps></p><input type=range id=npr min=0 max=1000 value=0 step=1 aria-label="Seek"><div class=npc><span id=npe>0:00</span><span id=npd>0:00</span></div>
<div class=ctl><button onclick="auNext(-1)" aria-label="Previous">${aico.prev}</button><button onclick="auSeek(-15)" aria-label="Back 15 seconds">${aico.back}</button><button class=big2 id=npb onclick="auToggle()"></button><button onclick="auSeek(15)" aria-label="Forward 15 seconds">${aico.fwd}</button><button onclick="auNext(1)" aria-label="Next">${aico.next}</button></div>
<div class=npf><button class=chip id=npsl onclick="auSlp()"></button></div></div></div>`);
const mp=$('#mp'),np=$('#np'),mpt=$('.mpt'),mps=$('.mps'),mpb=$('.mpb'),npr=$('#npr'),npe=$('#npe'),npd=$('#npd');
function auUI(){const on=!!aCur&&!locked;mp.hidden=!on;document.body.classList.toggle('hasmp',on);
 if(!aCur){if(!np.hidden)auClose();return}
 const pl=!A.paused;mpt.textContent=aCur.name;mpb.innerHTML=pl?aico.pause:aico.play;mpb.setAttribute('aria-label',pl?'Pause':'Play');
 $('#npn').textContent=aCur.name;$('#nps').textContent=(aCur.kind==='voice'?'Voice note':'Audio')+' · '+dfmt(aCur.c);$('#npb').innerHTML=pl?aico.pause:aico.play;$('#npb').setAttribute('aria-label',pl?'Pause':'Play');
 $('#npa').classList.toggle('on',pl);$('#npsp').textContent=aSpd+'×';$('#npsp').setAttribute('aria-label','Speed '+aSpd+' times');$('#npsl').textContent=aSlp?'Sleep in '+aSlp+' min':'Sleep timer off';
 auMS();auPS();auTick()}
function auTick(){if(!aCur)return;const d=isFinite(A.duration)&&A.duration>0?A.duration:(aCur.dur||0),t=A.currentTime||0;
 mp.style.setProperty('--p',(d?Math.min(100,t/d*100):0)+'%');mps.textContent=tfmt(t)+' / '+tfmt(d);
 if(!np.hidden){npe.textContent=tfmt(t);npd.textContent=tfmt(d);if(!aDrag)npr.value=d?Math.round(Math.min(1,t/d)*1000):0;npr.style.setProperty('--p',npr.value/10+'%')}}
const auOpen=()=>{if(!aCur)return;np.hidden=false;auUI();$('.npx').focus()},auClose=()=>{np.hidden=true;try{mpb.focus()}catch(e){}};
const auRefresh=()=>{if(!locked&&tab==='jrnv'&&jsub==='au')render()};
npr.addEventListener('input',()=>{aDrag=1;if(aCur&&isFinite(A.duration))A.currentTime=npr.value/1000*A.duration;auTick()});
npr.addEventListener('change',()=>{aDrag=0;auPS()});
A.addEventListener('play',()=>{auUI();auRefresh()});A.addEventListener('pause',()=>{auUI();auRefresh()});
A.addEventListener('timeupdate',auTick);A.addEventListener('loadedmetadata',()=>{auTick();auPS()});A.addEventListener('ratechange',auPS);
A.addEventListener('ended',()=>{if(!aCur||A.src!==aURL)return;const i=AL?AL.findIndex(x=>x.id===aCur.id):-1;if(i>=0&&i<AL.length-1)auPlay(AL[i+1].id);else{A.currentTime=0;A.pause()}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!np.hidden&&!DL.classList.contains('on'))auClose()});

/* ---- locking: voice notes stop, the library is forgotten from memory, players hide until unlock ---- */
const _lockNow=window.lockNow;
window.lockNow=async function(...a){if(typeof META!=='undefined'&&META&&!locked){if(aCur&&aCur.kind==='voice')auStop();AL=null;aErr=0}const r=await _lockNow.apply(this,a);auUI();return r};
new MutationObserver(()=>{auUI();if(!$('#lock').classList.contains('on')&&!AL)auLoad()}).observe($('#lock'),{attributes:true,attributeFilter:['class']});

/* ---- the Audio tab ---- */
function auMenu(id){const m=(AL||[]).find(x=>x.id===id);if(!m)return;
 M.innerHTML=`<div class=sheet role=dialog aria-label="Audio options"><h3>${esc(m.name)}</h3><p class=sub>${m.kind==='voice'?'Voice note':'Audio'} · ${tfmt(m.dur)} · ${smb(m.size||0)}</p><div class=acts><button class=btn data-x=ren>Rename</button><button class="btn red" data-x=del>Delete</button></div></div>`;M.classList.add('on');
 M.onclick=async ev=>{if(ev.target===M)return mclose();const b=ev.target.closest('button');if(!b)return;const x=b.dataset.x;mclose();
  if(x==='ren'){const v=await prm('Rename',{val:m.name,ok:'Save'});if(v&&v.trim()){m.name=v.trim();await auSave();if(aCur&&aCur.id===id)auUI();auRefresh()}}
  else if(x==='del'&&await ask('Delete "'+m.name+'"? This cannot be undone.',{ok:'Delete',danger:1})){if(aCur&&aCur.id===id)auStop();await kdel('au:'+id);AL=AL.filter(z=>z.id!==id);await auSave();auRefresh()}}}
function auV(){auLoad();
 if(!AL)return `<p class=sub style="margin-top:30px">${aErr?'Your audio library could not be opened.':'Loading…'}</p>`;
 const tot=AL.reduce((s,x)=>s+(x.size||0),0),
 rows=AL.map(m=>{const on=aCur&&aCur.id===m.id,pl=on&&!A.paused;
  return `<div class="aur${on?' on':''}"><button class=aum onclick="auPlay('${m.id}')" aria-label="${pl?'Pause':'Play'} ${esc(m.name)}"><span class=aug>${pl?'<i class=eq><b></b><b></b><b></b></i>':aico.play}</span><span class=aut><span class=aun>${esc(m.name)}</span><span class=aus>${m.kind==='voice'?'Voice note':'Audio'} · ${tfmt(m.dur)} · ${dfmt(m.c)}</span></span></button><button class=auk onclick="auMenu('${m.id}')" aria-label="Options for ${esc(m.name)}">⋯</button></div>`}).join('');
 return `<h2 class=hi>Audio</h2><p class=sub>${AL.length?AL.length+(AL.length===1?' track · ':' tracks · ')+smb(tot)+' on this phone':'Private. Kept on this phone only.'}</p>
<div class=aacts><button class=btn onclick="auRec()">${aico.mic}Record</button><label class=btn>${aico.add}Add audio<input type=file accept="audio/*,.m4a,.mp3,.aac,.wav,.ogg,.opus,.flac" multiple hidden onchange="auAdd([...this.files]);this.value=''"></label></div>`+
 (AL.length?`<div class=aul>${rows}</div>`:`<div class=empty><b>Nothing here yet</b>Record a voice note or add audio from your phone.</div>`)}
