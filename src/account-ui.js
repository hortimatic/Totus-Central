import {taskToday,TASK_STATES} from './tasks-core.js';
import {esc,fmtDate} from './utils.js';
import {modal,closeModal,btn} from './components.js';
import {prepareChatBackground} from './chat-preferences.js';

export function accountValues(input={}){
 const image=typeof input.photo==='string'&&input.photo.length<=350000&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(input.photo)?input.photo:'';
 return {display_name:String(input.display_name||'').trim().slice(0,90),phone:String(input.phone||'').trim().slice(0,40),photo:image};
}

/** Personal profile only: authorization remains in team_members and normal RPC/RLS. */
export function createAccountUI({user,profile,documents,can,rpc,accept,guard,navigate,notify}){
 let host=null,generation=0,busy=false;
 const owner=()=>user()?.id;
 const data=()=>profile()?.ui_preferences?.account||{revision:0,config:{}};
 const values=()=>accountValues(data().config);
 const name=()=>values().display_name||user()?.full_name||user()?.email||'Mi cuenta';
 const avatar=()=>values().photo?'<img src="'+esc(values().photo)+'" alt="">':'<span aria-hidden="true">'+esc(name().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase())+'</span>';
 function paintButton(){
  if(!host)return;
  host.innerHTML='<button type="button" class="account-trigger" data-account-open aria-label="Abrir mi cuenta" aria-expanded="false" aria-controls="personalAccountMenu"><span class="account-avatar">'+avatar()+'</span><span class="account-trigger-text"><b>'+esc(name())+'</b><small>Mi cuenta</small></span><span aria-hidden="true">⌄</span></button><div class="account-popover" id="personalAccountMenu" hidden><div class="account-popover-heading"><b>'+esc(name())+'</b><small>'+esc(user()?.email)+'</small></div><button type="button" data-account-section="perfil">Mi perfil</button>'+(can('documentos')?'<button type="button" data-account-section="documentos">Mis documentos</button>':'')+(can('tareas')?'<button type="button" data-account-section="tareas">Mis tareas</button>':'')+'<button type="button" data-account-section="avisos">Mis avisos</button><div class="account-popover-divider"></div><button type="button" data-action="logout">Cerrar sesión</button></div>';
 }
 function closeMenu(focus=false){const menu=host?.querySelector('.account-popover'),trigger=host?.querySelector('[data-account-open]');if(menu)menu.hidden=true;trigger?.setAttribute('aria-expanded','false');if(focus)trigger?.focus();}
 function outside(event){if(host&&!host.contains(event.target))closeMenu();}
 function menuKeys(event){if(event.key==='Escape'&&host?.querySelector('.account-popover:not([hidden])')){event.preventDefault();closeMenu(true);}}
 async function accountClick(event){
  if(event.target.closest('[data-account-open]')){const menu=host.querySelector('.account-popover'),opened=menu.hidden;menu.hidden=!opened;host.querySelector('[data-account-open]').setAttribute('aria-expanded',String(opened));return;}
  const section=event.target.closest('[data-account-section]');if(section){closeMenu();await open(section.dataset.accountSection);return;}
  if(event.target.closest('[data-action="logout"]'))closeMenu();
 }
 function valid(stamp,who,panel){return stamp===generation&&owner()===who&&panel?.isConnected;}
 async function open(section='perfil'){
  if(busy||!owner()||!await guard())return;
  const stamp=++generation,who=owner(),u=user(),v=values(),revision=Number(data().revision||0);
  const tabs=[['perfil','Mi perfil'],['documentos','Mis documentos'],['tareas','Mis tareas'],['avisos','Mis avisos']].filter(([key])=>key!=='documentos'||can('documentos'));
  const links='<div class="account-shortcuts">'+(can('configuracion')?'<button type="button" class="btn secondary" data-account-route="configuracion">Personalizar mi interfaz</button>':'')+(can('equipo')?'<button type="button" class="btn secondary" data-account-route="equipo">Abrir Chat y sus avisos</button>':'')+'</div>';
  let body='';
  if(section==='perfil')body='<form data-account-form data-draft-form><div class="account-photo-field"><span class="account-avatar account-avatar-large" data-account-avatar>'+avatar()+'</span><label class="btn secondary">Cambiar foto<input type="file" data-account-photo accept="image/jpeg,image/png,image/webp"></label><button class="btn secondary" type="button" data-account-remove>Quitar foto</button><input name="photo" type="text" hidden value="'+esc(v.photo)+'"></div><div class="form-grid"><label>Nombre visible<input name="display_name" maxlength="90" value="'+esc(v.display_name||u.full_name||'')+'" autocomplete="name"></label><label>Teléfono de contacto<input name="phone" maxlength="40" value="'+esc(v.phone||u.phone||'')+'" autocomplete="tel"></label><label>Correo de acceso<input type="email" value="'+esc(u.email)+'" readonly></label><label>Rol asignado<input value="'+esc(u.role||'usuario')+'" readonly></label></div><p class="small muted">Tu nombre visible y tu foto personalizan tu cuenta. El correo, el rol y los permisos los gestiona administración.</p><div class="form-actions"><button class="btn primary" type="submit">Guardar mi perfil</button></div></form>';
  if(section==='documentos'){
   const rows=documents().filter(d=>d.uploaded_by===who);
   body='<p class="muted">Documentos que has subido y que puedes consultar con tus permisos actuales. Conservan su ubicación y sus vínculos con la contabilidad.</p>'+(rows.length?'<div class="account-document-list">'+rows.map(d=>'<article><div><b>'+esc(d.original_name||'Documento')+'</b><small>'+esc(fmtDate(d.document_date||d.created_at))+'</small></div><div class="inline-actions">'+btn('Vista previa','document-preview','secondary','data-id="'+esc(d.id)+'"')+(can('documentos','export')?btn('Descargar','document-download','secondary','data-id="'+esc(d.id)+'"'):'')+'</div></article>').join('')+'</div>':'<div class="empty">No tienes documentos subidos visibles.</div>');
  }
  if(section==='tareas')body=can('tareas')?'<div data-account-tasks role="status">Consultando tus tareas de este mes…</div>':'<p>No tienes acceso al módulo Tareas.</p>';
  if(section==='avisos')body='<div class="note">Los mensajes sin leer y las tareas pendientes se actualizan en la cabecera. Los sonidos, el volumen y los avisos del dispositivo se configuran en Chat. La autorización del navegador es independiente de tu cuenta.</div>'+links;
  modal('Mi cuenta','<section class="account-panel" data-account-panel><div class="account-identity"><span class="account-avatar">'+avatar()+'</span><div><b>'+esc(name())+'</b><small>'+esc(u.email)+'</small></div></div><nav class="tabs" aria-label="Secciones de mi cuenta">'+tabs.map(([key,label])=>'<button type="button" class="tab '+(key===section?'active':'')+'" data-account-tab="'+key+'" aria-current="'+(key===section?'page':'false')+'">'+label+'</button>').join('')+'</nav><div class="account-section">'+body+'</div><p data-account-status role="status"></p><div class="account-footer">'+btn('Cerrar sesión','logout','secondary')+'</div></section>');
  const panel=document.querySelector('[data-account-panel]'),status=panel.querySelector('[data-account-status]');
  panel.addEventListener('click',async event=>{
   const tab=event.target.closest('[data-account-tab]'),route=event.target.closest('[data-account-route]');
   if(tab){await open(tab.dataset.accountTab);return;}
   if(route&&await guard()){closeModal();await navigate(route.dataset.accountRoute);}
  });
  if(section==='perfil'){
   const form=panel.querySelector('form'),photo=form.elements.photo;
   const showPhoto=()=>{const image=accountValues({photo:photo.value}).photo;panel.querySelector('[data-account-avatar]').innerHTML=image?'<img src="'+esc(image)+'" alt="Foto preparada">':'<span aria-hidden="true">'+esc(name()[0])+'</span>';photo.dispatchEvent(new Event('input',{bubbles:true}));};
   panel.querySelector('[data-account-remove]').onclick=()=>{if(!busy){photo.value='';showPhoto();}};
   panel.querySelector('[data-account-photo]').onchange=async event=>{
    if(busy||!event.target.files[0])return;busy=true;form.querySelector('button[type=submit]').disabled=true;
    try{const image=await prepareChatBackground(event.target.files[0],{preserveAlpha:true});if(valid(stamp,who,panel)){photo.value=image;showPhoto();}}
    catch(error){if(valid(stamp,who,panel))status.textContent=error.message;}
    finally{if(stamp===generation)busy=false;if(valid(stamp,who,panel))form.querySelector('button[type=submit]').disabled=false;}
   };
   form.onsubmit=async event=>{
    event.preventDefault();if(busy)return;busy=true;form.querySelector('button[type=submit]').disabled=true;
    try{const saved=await rpc('totus_save_my_account',{p_config:accountValues(Object.fromEntries(new FormData(form))),p_expected_revision:revision});if(!valid(stamp,who,panel))return;accept(saved,who);paintButton();closeModal();notify('Tu perfil se ha guardado.');}
    catch(error){if(valid(stamp,who,panel))status.textContent=error.message;}
    finally{if(stamp===generation)busy=false;if(valid(stamp,who,panel))form.querySelector('button[type=submit]').disabled=false;}
   };
  }
  if(section==='tareas'&&can('tareas')){
   const today=taskToday(),from=today.slice(0,7)+'-01',[year,month]=today.split('-').map(Number),to=new Date(Date.UTC(year,month,0)).toISOString().slice(0,10);
   try{const result=await rpc('totus_tasks_context',{p_from:from,p_to:to});if(!valid(stamp,who,panel))return;const rows=(result.rows||[]).filter(r=>String(r.assigned_email||'').toLowerCase()===String(u.email).toLowerCase());panel.querySelector('[data-account-tasks]').innerHTML='<p class="small muted">Tareas asignadas a ti durante este mes, incluidas las terminadas.</p>'+(rows.length?rows.map(r=>'<div class="summary-row"><span>'+esc(r.title)+'<small class="muted"> · '+esc(fmtDate(r.scheduled_on))+'</small></span><span>'+esc(TASK_STATES[r.state]||'Pendiente')+'</span></div>').join(''):'<div class="empty">Sin tareas asignadas este mes.</div>')+'<button type="button" class="btn secondary" data-account-route="tareas">Abrir calendario de tareas</button>';}
   catch{if(valid(stamp,who,panel))panel.querySelector('[data-account-tasks]').textContent='No se pudieron consultar tus tareas. Cierra y vuelve a abrir esta sección para reintentar.';}
  }
 }
 return {start(){if(!owner())return;if(!host){host=document.createElement('div');host.className='account-menu';document.querySelector('.topbar').append(host);host.onclick=accountClick;document.addEventListener('click',outside);document.addEventListener('keydown',menuKeys);}paintButton();},refresh:paintButton,stop(){generation++;busy=false;document.removeEventListener('click',outside);document.removeEventListener('keydown',menuKeys);host?.remove();host=null;}};
}
