/* store.js: storage, encryption, snapshots, backups, biometrics. Browser only. */
const idb=()=>new Promise((ok,no)=>{const r=indexedDB.open('vfi',1);r.onupgradeneeded=()=>r.result.createObjectStore('k');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
let _db;const db=()=>_db||(_db=idb());
const kget=async k=>{const d=await db();return new Promise(r=>{const q=d.transaction('k').objectStore('k').get(k);q.onsuccess=()=>r(q.result);q.onerror=()=>r()})};
const kput=async(k,v)=>{const d=await db();return new Promise((ok,no)=>{const t=d.transaction('k','readwrite');t.objectStore('k').put(v,k);t.oncomplete=ok;t.onerror=()=>no(t.error);t.onabort=()=>no(t.error)})};
const kdel=async k=>{const d=await db();return new Promise(ok=>{const t=d.transaction('k','readwrite');t.objectStore('k').delete(k);t.oncomplete=ok;t.onerror=ok})};
const kclear=async()=>{const d=await db();return new Promise(ok=>{const t=d.transaction('k','readwrite');t.objectStore('k').clear();t.oncomplete=ok;t.onerror=ok})};
/* ---- crypto: a random data key encrypts everything; the PIN only wraps that key (PBKDF2 -> AES-GCM) ---- */
const E8=new TextEncoder(),D8=new TextDecoder(),ITER=400000;
const b64=u=>{u=new Uint8Array(u);let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s)};
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const wrapKey=async(pin,salt,iter)=>{const m=await crypto.subtle.importKey('raw',E8.encode(pin),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:iter},m,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])};
const aesEnc=async(key,bytes)=>{const iv=crypto.getRandomValues(new Uint8Array(12));return{iv:b64(iv),ct:b64(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,bytes))}};
const aesDec=(key,o)=>crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(o.iv)},key,unb64(o.ct));
const seal=(key,obj)=>aesEnc(key,E8.encode(JSON.stringify(obj))),open=async(key,o)=>JSON.parse(D8.decode(await aesDec(key,o)));
const newDataKey=()=>crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt','decrypt']);
const wrapMeta=async(K,pin)=>{const salt=crypto.getRandomValues(new Uint8Array(16));return{salt:b64(salt),iter:ITER,len:pin.length,w:await aesEnc(await wrapKey(pin,salt,ITER),await crypto.subtle.exportKey('raw',K))}};
const unwrap=async(meta,pin)=>{try{const raw=await aesDec(await wrapKey(pin,unb64(meta.salt),meta.iter),meta.w);return await crypto.subtle.importKey('raw',raw,'AES-GCM',true,['encrypt','decrypt'])}catch(e){return null}};
const legacyHash=async p=>{try{return[...new Uint8Array(await crypto.subtle.digest('SHA-256',E8.encode('vfi'+p)))].map(b=>b.toString(16).padStart(2,'0')).join('')}catch{return p}};
let DK=null,META=null;   /* DK: data key in memory while unlocked. META: the PIN-wrapped copy on disk. */
const hasPin=()=>!!META;
const pack=async()=>DK?{enc:1,...await seal(DK,S)}:JSON.parse(JSON.stringify(S));
/* ---- saving: one write at a time, never while locked ---- */
let PQ=Promise.resolve(),onSaveError=()=>{};
const persist=()=>PQ=PQ.then(async()=>{if(typeof locked!=='undefined'&&locked)return;try{await kput('s',await pack());await snapMaybe();await folderMaybe();if(S.set.bgOn)await kput('rem',remQueue())}catch(e){console.warn('save failed',e);onSaveError(e)}});
/* ---- rolling snapshots (7 kept, at most one per 12 hours) ---- */
async function snapMaybe(force){if(!(S.tx.length||S.todo.length||S.jl.length||S.notes.length))return;const L=(await kget('snaps'))||[],last=L[L.length-1];if(!force&&last&&Date.now()-last.t<12*36e5)return;L.push({t:Date.now(),n:S.tx.length,rec:await pack()});while(L.length>7)L.shift();await kput('snaps',L);snapped=true}
let snapped=false;
const snapList=async()=>((await kget('snaps'))||[]).map((x,i)=>({i,t:x.t,n:x.n})).reverse();
async function snapRestore(i){const x=((await kget('snaps'))||[])[i];if(!x)throw 0;return sanitize(x.rec.enc?await open(DK,x.rec):x.rec)}
/* ---- backup files: PIN-protected when a PIN is set ---- */
async function backupBlob(){const b=META?{app:'vfi',v:SCHEMA,enc:{...META,...await seal(DK,S)}}:{app:'vfi',v:SCHEMA,data:S};return new Blob([JSON.stringify(b)],{type:'application/json'})}
async function readBackup(text,askPin){const d=JSON.parse(text);let o;if(d&&d.enc){const pin=await askPin();if(pin==null)return null;const K=await unwrap(d.enc,pin);if(!K)throw new Error('pin');o=await open(K,d.enc)}else o=d.data||d;if(!o||!Array.isArray(o.tx)||!o.set)throw new Error('bad');return sanitize(o)}
/* ---- optional auto-save to a folder (desktop Chromium) ---- */
const folderOK=()=>!!window.showDirectoryPicker;
async function folderPick(){const h=await showDirectoryPicker({mode:'readwrite',id:'vfi'});await kput('dir',h);await folderMaybe(true)}
async function folderState(){const h=await kget('dir');if(!h)return{on:0};let p='prompt';try{p=await h.queryPermission({mode:'readwrite'})}catch(e){}return{on:1,name:h.name,ok:p==='granted'}}
async function folderMaybe(force){if(!folderOK())return;const h=await kget('dir');if(!h)return;if(!force&&!snapped)return;snapped=false;try{if((await h.queryPermission({mode:'readwrite'}))!=='granted')return;const f=await h.getFileHandle('the-v-fi-auto-backup.json',{create:true}),w=await f.createWritable();await w.write(await backupBlob());await w.close();S.set.bkF=new Date().toISOString()}catch(e){console.warn('folder backup',e)}}
const folderAllow=async()=>{const h=await kget('dir');if(h&&await h.requestPermission({mode:'readwrite'})==='granted')await folderMaybe(true)};
/* ---- turning the PIN on, changing, removing ---- */
async function enablePin(pin){const K=await newDataKey();META=await wrapMeta(K,pin);await kput('meta',META);DK=K;await kdel('snaps');await kdel('bio');await persist()}
async function changePin(K,pin){META=await wrapMeta(K,pin);await kput('meta',META);DK=K}
async function removePin(){DK=null;META=null;await kdel('meta');await kdel('bio');await kdel('snaps');await persist()}
/* ---- biometric unlock: a local gate (WebAuthn) that releases a non-extractable copy of the data key ---- */
const bioOK=async()=>{try{return!!(window.PublicKeyCredential&&await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())}catch{return false}};
const bioOn=async()=>!!(await kget('bio'));
async function bioEnable(K){const c=await navigator.credentials.create({publicKey:{challenge:crypto.getRandomValues(new Uint8Array(32)),rp:{name:'The V Fi'},user:{id:crypto.getRandomValues(new Uint8Array(16)),name:'vfi',displayName:'The V Fi'},pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],authenticatorSelection:{authenticatorAttachment:'platform',userVerification:'required',residentKey:'discouraged'},timeout:60000,attestation:'none'}});const k=await crypto.subtle.importKey('raw',await crypto.subtle.exportKey('raw',K),'AES-GCM',false,['encrypt','decrypt']);await kput('bio',{id:new Uint8Array(c.rawId),key:k})}
async function bioUnlock(){const b=await kget('bio');if(!b)return null;await navigator.credentials.get({publicKey:{challenge:crypto.getRandomValues(new Uint8Array(32)),allowCredentials:[{type:'public-key',id:b.id}],userVerification:'required',timeout:60000}});return b.key}
/* ---- reminders for when the app is closed: the service worker reads this queue (titles only, no amounts) ---- */
function remQueue(){const B=(+S.set.remB||0)*6e4,now=Date.now(),q=[];(S.todo||[]).forEach(t=>{if(t.done||!t.d||!t.tm)return;const ts=new Date(t.d+'T'+t.tm).getTime()-B;if(ts>now-12*36e5&&ts<now+7*864e5)q.push({id:'t'+t.id+'@'+ts,title:t.t,body:'Task · '+fT(t.tm),ts})});(S.up||[]).forEach(u=>{if(u.done)return;const ts=new Date(u.d+'T08:00').getTime();if(ts>now-12*36e5&&ts<now+7*864e5)q.push({id:'u'+u.id+'@'+ts,title:'Due today: '+u.what,body:'Open The V Fi to record it',ts})});return q.slice(0,60)}
