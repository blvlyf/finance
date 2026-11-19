/* ui.js: DOM helpers, in-app dialogs (replace prompt/confirm/alert), modal accessibility */
const $=s=>document.querySelector(s);
const M=$('#modal'),DL=$('#dlg');
const syncInert=()=>{const m=M.classList.contains('on'),d=DL.classList.contains('on');[$('#app'),$('#nav')].forEach(x=>{if(x)x.inert=m||d});M.inert=d};
function dlg({title='',msg='',input=0,type='text',val='',ok='OK',cancel='Cancel',danger=0,hideCancel=0}={}){return new Promise(res=>{
 const prev=document.activeElement;
 DL.innerHTML=`<div class=dbox role=alertdialog aria-modal=true aria-labelledby=dtl aria-describedby=dmg><h3 id=dtl${title?'':' hidden'}>${esc(title)}</h3><p id=dmg>${esc(msg).replace(/\n/g,'<br>')}</p>${input?`<input id=dinp type=${type} value="${esc(val)}" autocomplete=off aria-label="${esc(msg)}">`:''}<div class=acts>${hideCancel?'':`<button class=btn data-r=0>${esc(cancel)}</button>`}<button class="btn ${danger?'red':'pri'}" data-r=1>${esc(ok)}</button></div></div>`;
 DL.classList.add('on');syncInert();
 const done=v=>{DL.classList.remove('on');DL.innerHTML='';DL.onclick=DL.onkeydown=null;syncInert();try{prev&&prev.isConnected&&prev.focus()}catch(e){}res(v)};
 DL.onclick=e=>{const b=e.target.closest('button');if(b)done(b.dataset.r==='1'?(input?$('#dinp').value:true):(input?null:false))};
 DL.onkeydown=e=>{if(e.key==='Escape'){e.stopPropagation();done(input?null:false)}else if(e.key==='Enter'&&input&&e.target.id==='dinp'){e.preventDefault();done($('#dinp').value)}};
 setTimeout(()=>($('#dinp')||DL.querySelector('.btn.pri,.btn.red')||DL.querySelector('button')).focus(),30)})}
const ask=(msg,o={})=>dlg({msg,...o}),say=(msg,title)=>dlg({msg,title,hideCancel:1}),prm=(msg,o={})=>dlg({msg,input:1,...o});
/* modal: focus moves in, Tab stays inside, Escape closes, focus returns to where it was */
let opener=null;
new MutationObserver(()=>{const on=M.classList.contains('on'),sh=M.querySelector('.sheet');syncInert();if(sh){sh.setAttribute('aria-modal','true');sh.tabIndex=-1}
 if(on&&!M._on){M._on=1;opener=document.activeElement;if(sh)sh.focus({preventScroll:true})}else if(!on&&M._on){M._on=0;try{opener&&opener.isConnected&&opener.focus()}catch(e){}}}).observe(M,{attributes:true,attributeFilter:['class'],childList:true});
document.addEventListener('keydown',e=>{const d=DL.classList.contains('on'),m=M.classList.contains('on');
 if(e.key==='Escape'&&m&&!d){e.preventDefault();M.click();return}
 if(e.key==='Tab'&&(d||m)){const root=d?DL:(M.querySelector('.sheet')||M),f=[...root.querySelectorAll('button,input,select,textarea,summary')].filter(x=>!x.disabled&&x.type!=='hidden'&&x.offsetParent!==null);if(!f.length)return;const i=f.indexOf(document.activeElement);
  if(e.shiftKey&&i<=0){e.preventDefault();f[f.length-1].focus()}else if(!e.shiftKey&&(i<0||i===f.length-1)){e.preventDefault();f[0].focus()}}});
