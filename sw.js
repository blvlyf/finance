/* sw.js: offline cache, update flow, background reminders. Bump V on every release so users get the update prompt. */
const V='vfi-v4',ASSETS=['./','index.html','style.css','core.js','store.js','ui.js','features.js','app.js','manifest.json','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('message',e=>{if(e.data==='skip')self.skipWaiting()});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
 e.respondWith(caches.open(V).then(async c=>{const hit=await c.match(r,{ignoreSearch:true});if(hit)return hit;try{const res=await fetch(r);if(res.ok)c.put(r,res.clone());return res}catch(x){return(r.mode==='navigate'&&await c.match('index.html'))||Response.error()}}))});
const idb=()=>new Promise((ok,no)=>{const r=indexedDB.open('vfi',1);r.onupgradeneeded=()=>r.result.createObjectStore('k');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
const kget=async k=>{const d=await idb();return new Promise(r=>{const q=d.transaction('k').objectStore('k').get(k);q.onsuccess=()=>r(q.result);q.onerror=()=>r()})};
const kput=async(k,v)=>{const d=await idb();return new Promise(ok=>{const t=d.transaction('k','readwrite');t.objectStore('k').put(v,k);t.oncomplete=ok;t.onerror=ok})};
async function remind(){const cs=await self.clients.matchAll({type:'window'});if(cs.some(c=>c.visibilityState==='visible'))return;
 const q=(await kget('rem'))||[],fired=(await kget('remfired'))||[],now=Date.now();let ch=false;
 for(const x of q){if(x.ts<=now&&x.ts>now-12*36e5&&!fired.includes(x.id)){await self.registration.showNotification(x.title,{body:x.body,tag:x.id,icon:'icon-192.png',badge:'icon-192.png'});fired.push(x.id);ch=true}}
 if(ch)await kput('remfired',fired.slice(-200))}
self.addEventListener('periodicsync',e=>{if(e.tag==='vfi-remind')e.waitUntil(remind())});
/* ready for a push server later: it only needs to send {title, body} */
self.addEventListener('push',e=>{let d={};try{d=e.data.json()}catch(x){}e.waitUntil(self.registration.showNotification(d.title||'The V Fi',{body:d.body||'',icon:'icon-192.png'}))});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>cs.length?cs[0].focus():self.clients.openWindow('./')))});
