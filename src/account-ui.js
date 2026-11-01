import {taskToday,TASK_STATES} from './tasks-core.js';
import {esc,fmtDate} from './utils.js';
import {modal,closeModal,btn} from './components.js';
import {prepareChatBackground} from './chat-preferences.js';

export function accountValues(input={}){
 const photo=typeof input.photo==='string'&&input.photo.length<=350000&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(input.photo)?input.photo:'';
 return {display_name:String(input.display_name||'').trim().slice(0,90),phone:String(input.phone||'').trim().slice(0,40),photo,notes:Array.from(String(input.notes||'')).slice(0,10000).join('')};
}
const displayName=(values,user)=>values.display_name||user?.full_name||user?.email||'Mi cuenta';
function badge(values,name){
 return values.photo?'<img src="'+esc(values.photo)+'" alt="">':'<span aria-hidden="true">'+esc(name.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase())+'</span>';
}

/** All writes retain the signed-in actor. An administrator selects a target, never impersonates it. */
export function createAccountUI({user,profile,documents,can,rpc,accept,guard,navigate,notify,canManage=()=>false,accountTarget=()=>null,readDocuments=null,acceptDocuments=()=>{}}){
 let host=null,generation=0,busy=false;
 const owner=()=>user()?.id;
 const data=()=>profile()?.ui_preferences?.account||{revision:0,config:{}};
 const values=()=>accountValues(data().config);
 function tabs(managing=false){
  return [['perfil','Mi perfil'],['notas','Mis notas'],['documentos','Mis documentos'],['tareas','Mis tareas'],['informes','Informes'],['avisos','Mis avisos']]
   .filter(([key])=>(!managing||key!=='avisos')&&(key!=='documentos'||can('documentos'))&&(key!=='tareas'||can('tareas'))&&(key!=='informes'||can('informes')));
 }
 function paintButton(){
  if(!host)return;
  const v=values(),name=displayName(v,user());
  host.innerHTML='<button type="button" class="account-trigger" data-account-open aria-label="Abrir mi cuenta" aria-expanded="false" aria-controls="personalAccountMenu"><span class="account-avatar">'+badge(v,name)+'</span><span class="account-trigger-text"><b>'+esc(name)+'</b><small>Mi cuenta</small></span><span aria-hidden="true">⌄</span></button><div class="account-popover" id="personalAccountMenu" hidden><div class="account-popover-heading"><b>'+esc(name)+'</b><small>'+esc(user()?.email)+'</small></div>'+tabs().map(([key,label])=>'<button type="button" data-account-section="'+key+'">'+label+'</button>').join('')+'<div class="account-popover-divider"></div><button type="button" data-action="logout">Cerrar sesión</button></div>';
 }
 function closeMenu(focus=false){
  const menu=host?.querySelector('.account-popover'),trigger=host?.querySelector('[data-account-open]');
  if(menu)menu.hidden=true;trigger?.setAttribute('aria-expanded','false');if(focus)trigger?.focus();
 }
 const outside=event=>{if(host&&!host.contains(event.target))closeMenu();};
 const menuKeys=event=>{if(event.key==='Escape'&&host?.querySelector('.account-popover:not([hidden])')){event.preventDefault();closeMenu(true);}};
 async function accountClick(event){
  if(event.target.closest('[data-account-open]')){
   const menu=host.querySelector('.account-popover'),opened=menu.hidden;menu.hidden=!opened;host.querySelector('[data-account-open]').setAttribute('aria-expanded',String(opened));return;
  }
  const section=event.target.closest('[data-account-section]');if(section){closeMenu();await open(section.dataset.accountSection);return;}
  if(event.target.closest('[data-action="logout"]'))closeMenu();
 }
 async function open(section='perfil',targetId=null){
  if(busy||!owner()||!await guard())return;
  const managing=!!targetId&&targetId!==owner();if(managing&&!canManage())return;
  const target=managing?accountTarget(targetId):null;
  if(managing&&!target){notify('No se encontró el perfil. Actualiza la página.');return;}
  const stamp=++generation,who=owner(),u=target?.user||user(),targetOwner=managing?targetId:who;
  const record=managing?(target.profile?.ui_preferences?.account||{revision:0,config:{}}):data();
  const v=accountValues(record.config),revision=Number(record.revision||0),name=displayName(v,u),sections=tabs(managing);
  if(!sections.some(([key])=>key===section))section='perfil';
  const active=panel=>stamp===generation&&owner()===who&&panel?.isConnected&&(!managing||canManage());
  const shortcuts='<div class="account-shortcuts">'+(can('configuracion')?'<button type="button" class="btn secondary" data-account-route="configuracion">Personalizar mi interfaz</button>':'')+(can('equipo')?'<button type="button" class="btn secondary" data-account-route="equipo">Abrir Chat y sus avisos</button>':'')+'</div>';
  let body='';
  if(section==='perfil')body='<form data-account-form data-draft-form><div class="account-photo-field"><span class="account-avatar account-avatar-large" data-account-avatar>'+badge(v,name)+'</span><label class="btn secondary">Cambiar foto<input type="file" data-account-photo accept="image/jpeg,image/png,image/webp"></label><button class="btn secondary" type="button" data-account-remove>Quitar foto</button><input name="photo" type="text" hidden value="'+esc(v.photo)+'"></div><div class="form-grid"><label>Nombre visible<input name="display_name" maxlength="90" value="'+esc(v.display_name||u.full_name||'')+'" autocomplete="name"></label><label>Teléfono de contacto<input name="phone" maxlength="40" value="'+esc(v.phone||u.phone||'')+'" autocomplete="tel"></label><label>Correo de acceso<input type="email" value="'+esc(u.email)+'" readonly></label><label>Rol asignado<input value="'+esc(u.role||'usuario')+'" readonly></label></div><p class="small muted">La foto y el nombre personalizan el perfil. El acceso y los permisos se gestionan desde Usuarios.</p><div class="form-actions"><button class="btn primary" type="submit">Guardar perfil</button></div></form>';
  if(section==='notas')body='<form data-account-notes data-draft-form><label class="field">Notas de trabajo<textarea name="notes" maxlength="10000" rows="12" placeholder="Anotaciones de esta cuenta">'+esc(v.notes)+'</textarea></label><output data-notes-count>'+v.notes.length+' / 10000</output><p class="small muted">Se guardan en el perfil y en sus copias. Administración y Gerencia pueden consultarlas. No sustituyen un gasto ni una tarea.</p><div class="form-actions"><button class="btn primary" type="submit">Guardar notas</button></div></form>';
  if(section==='documentos')body='<p class="muted">Documentos subidos por esta cuenta y visibles con tus permisos actuales. Conservan su ubicación y sus vínculos con la contabilidad.</p><div data-account-documents role="status">Consultando documentos…</div><div class="account-shortcuts"><button type="button" class="btn secondary" data-account-route="documentos">Abrir Documentos</button></div>';
  if(section==='tareas')body='<div class="account-task-filter"><label>Mes de las tareas<input type="month" data-account-month value="'+taskToday().slice(0,7)+'" min="2020-01" max="2100-12"></label></div><div data-account-tasks role="status">Consultando tareas…</div>';
  if(section==='informes')body='<p class="muted">Los informes usan los datos actuales y tus permisos. Elige el mes, trimestre y tienda dentro de Informes; no se crean archivos duplicados en el perfil.</p><div class="account-shortcuts"><button type="button" class="btn primary" data-account-route="informes">Abrir informes y descargas</button></div>';
  if(section==='avisos')body='<div class="note">Los mensajes sin leer y las tareas pendientes se actualizan en la cabecera. Los sonidos, el volumen y los avisos del dispositivo se configuran en Chat. La autorización del navegador es independiente de tu cuenta.</div>'+shortcuts;
  modal(managing?'Perfil de usuario':'Mi cuenta','<section class="account-panel" data-account-panel><div class="account-identity"><span class="account-avatar">'+badge(v,name)+'</span><div><b>'+esc(name)+'</b><small>'+esc(u.email)+'</small></div></div>'+(managing?'<p class="note">Gestionas este perfil con tu cuenta de administrador. Cada cambio queda registrado con tu identidad.</p>':'')+'<nav class="tabs" aria-label="Secciones de la cuenta">'+sections.map(([key,label])=>'<button type="button" class="tab '+(key===section?'active':'')+'" data-account-tab="'+key+'" aria-current="'+(key===section?'page':'false')+'">'+label+'</button>').join('')+'</nav><div class="account-section">'+body+'</div><p data-account-status role="status"></p>'+(managing?'':'<div class="account-footer">'+btn('Cerrar sesión','logout','secondary')+'</div>')+'</section>');
  const panel=document.querySelector('[data-account-panel]'),status=panel.querySelector('[data-account-status]');
  panel.addEventListener('click',async event=>{
   const tab=event.target.closest('[data-account-tab]'),route=event.target.closest('[data-account-route]');
   if(tab){await open(tab.dataset.accountTab,managing?targetId:null);return;}
   if(route&&await guard()){closeModal();await navigate(route.dataset.accountRoute);}
  });
  function bindSave(form,readValues){
   form.onsubmit=async event=>{
    event.preventDefault();if(busy)return;busy=true;const submit=form.querySelector('button[type=submit]');submit.disabled=true;
    try{
     if(managing&&!canManage())throw Error('Ya no tienes permiso para gestionar este perfil.');
     const args={p_config:readValues(),p_expected_revision:revision};if(managing)args.p_user_id=targetOwner;
     const saved=await rpc(managing?'totus_admin_save_account':'totus_save_my_account',args);
     if(!active(panel))return;
     accept(saved,who,targetOwner);paintButton();closeModal();notify(managing?'Perfil del usuario guardado.':'Tu perfil se ha guardado.');
    }catch(error){if(active(panel))status.textContent=error.message;}
    finally{if(stamp===generation)busy=false;if(active(panel))submit.disabled=false;}
   };
  }
  if(section==='perfil'){
   const form=panel.querySelector('form'),photo=form.elements.photo;
   const showPhoto=()=>{panel.querySelector('[data-account-avatar]').innerHTML=badge(accountValues({photo:photo.value}),name);photo.dispatchEvent(new Event('input',{bubbles:true}));};
   panel.querySelector('[data-account-remove]').onclick=()=>{if(!busy){photo.value='';showPhoto();}};
   panel.querySelector('[data-account-photo]').onchange=async event=>{
    if(busy||!event.target.files[0])return;busy=true;form.querySelector('button[type=submit]').disabled=true;
    try{const image=await prepareChatBackground(event.target.files[0],{preserveAlpha:true});if(active(panel)){photo.value=image;showPhoto();}}
    catch(error){if(active(panel))status.textContent=error.message;}
    finally{if(stamp===generation)busy=false;if(active(panel))form.querySelector('button[type=submit]').disabled=false;}
   };
   bindSave(form,()=>accountValues({...v,...Object.fromEntries(new FormData(form))}));
  }
  if(section==='notas'){
   const form=panel.querySelector('[data-account-notes]');
   form.elements.notes.oninput=()=>{panel.querySelector('[data-notes-count]').textContent=Array.from(form.elements.notes.value).length+' / 10000';};
   bindSave(form,()=>accountValues({...v,notes:form.elements.notes.value}));
  }
  if(section==='documentos'){
   const box=panel.querySelector('[data-account-documents]');
   try{
    const rows=(readDocuments?await readDocuments(targetOwner):documents()).filter(d=>d.uploaded_by===targetOwner);
    if(!active(panel))return;acceptDocuments(rows,who);
    box.innerHTML=rows.length?'<div class="account-document-list">'+rows.map(d=>'<article><div><b>'+esc(d.original_name||'Documento')+'</b><small>'+esc(fmtDate(d.document_date||d.created_at))+'</small></div><div class="inline-actions">'+btn('Vista previa','document-preview','secondary','data-id="'+esc(d.id)+'"')+(can('documentos','export')?btn('Descargar','document-download','secondary','data-id="'+esc(d.id)+'"'):'')+'</div></article>').join('')+'</div>':'<div class="empty">No hay documentos subidos visibles para esta cuenta.</div>';
   }catch(error){if(active(panel))box.innerHTML='<p class="note warn">No se pudieron consultar los documentos. Vuelve a abrir esta sección para reintentar.</p>';}
  }
  if(section==='tareas'){
   let taskRequest=0;
   async function loadTasks(){
    const request=++taskRequest,monthValue=panel.querySelector('[data-account-month]').value,box=panel.querySelector('[data-account-tasks]');
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthValue)){box.textContent='Elige un mes válido.';return;}
    const [year,month]=monthValue.split('-').map(Number);if(year<2020||year>2100){box.textContent='Elige un año entre 2020 y 2100.';return;}
    box.textContent='Consultando tareas…';
    try{
     const result=await rpc('totus_tasks_context',{p_from:monthValue+'-01',p_to:new Date(Date.UTC(year,month,0)).toISOString().slice(0,10)});
     if(!active(panel)||request!==taskRequest)return;
     const rows=(result.rows||[]).filter(r=>String(r.assigned_email||'').toLowerCase()===String(u.email).toLowerCase());
     box.innerHTML=(rows.length?rows.map(r=>'<div class="summary-row"><span>'+esc(r.title)+'<small class="muted"> · '+esc(fmtDate(r.scheduled_on))+'</small></span><span>'+esc(TASK_STATES[r.state]||'Pendiente')+'</span></div>').join(''):'<div class="empty">Sin tareas asignadas durante este mes.</div>')+'<button type="button" class="btn secondary" data-account-route="tareas">Abrir calendario de tareas</button>';
    }catch(error){if(active(panel)&&request===taskRequest)box.textContent='No se pudieron consultar las tareas. Cambia el mes o vuelve a abrir esta sección para reintentar.';}
   }
   panel.querySelector('[data-account-month]').onchange=loadTasks;await loadTasks();
  }
 }
 return {
  openFor:targetId=>open('perfil',targetId),
  start(){if(!owner())return;if(!host){host=document.createElement('div');host.className='account-menu';document.querySelector('.topbar').append(host);host.onclick=accountClick;document.addEventListener('click',outside);document.addEventListener('keydown',menuKeys);}paintButton();},
  refresh:paintButton,
  stop(){generation++;busy=false;document.removeEventListener('click',outside);document.removeEventListener('keydown',menuKeys);host?.remove();host=null;}
 };
}
