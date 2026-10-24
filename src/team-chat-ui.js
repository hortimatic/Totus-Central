import {uploadChatFile,chatFileMetadata,chatFileHash} from './chat-files.js';
import {chatText,chatChannelInput,chatDateRange,chatGroups,chatTaskPrompt,CHAT_REACTIONS,CHAT_TASK_STATES} from './team-chat-core.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(label,action,attrs='',kind='secondary')=>'<button type="button" class="btn '+kind+'" data-chat="'+action+'" '+attrs+'>'+esc(label)+'</button>';
const date=value=>new Date(value).toLocaleString('es-ES',{timeZone:'Europe/Madrid',dateStyle:'short',timeStyle:'short'});
const initial=()=>({channels:[],messages:[],members:[],directory:[],channel:null,parent:null,loaded:false,error:'',query:'',from:'',to:'',mode:'all',archived:false,more:false});
/** Isolated controller. No accounting writes, credentials, local storage or AI calls. */
export function createTeamChat({rpc,actor,onError=()=>{},confirm=async()=>false,requestFile=null,subscribe=()=>()=>{},onUnread=()=>{}}){
 let host=null,data=initial(),busy=false,timer=null,generation=0,owner='',drafts=new Map(),pending=new Map(),dialog=null,unsubscribe=()=>{},realtimeTimer=null,picks=new Map(),outbox=[];
 const current=()=>data.channels.find(c=>c.id===data.channel);
 const manager=()=>current()?.member_role==='manager'&&(!current()?.channel_kind||current()?.channel_kind==='channel');
 const draftKey=()=>data.channel+':'+(data.parent||'main');
 const remember=()=>{const input=host?.querySelector('#chatBody');if(input)drafts.set(draftKey(),input.value);};
 const hasDraft=()=>{remember();return [...drafts.values()].some(v=>v.trim())||[...picks.values()].some(files=>files.length)||outbox.length>0||!!dialog?.querySelector('[data-dirty="true"]');};
 const unlock=()=>{busy=false;const submit=host?.querySelector('.chat-compose [type="submit"]');if(submit)submit.disabled=false;};
 const showError=error=>{data.error=error.message||String(error);if(/No tienes acceso a este canal|Usuario de equipo no activo/i.test(data.error)){data.messages=[];data.members=[];data.channel=null;data.parent=null;data.channels=[];paint();drafts.clear();pending.clear();picks.clear();outbox=[];}onError(data.error);const box=host?.querySelector('[data-chat-error]');if(box){box.hidden=false;box.textContent=data.error;}};
 const ask=async message=>{const held=dialog;held?.close();try{return await confirm(message);}finally{if(held&&dialog===held&&held.isConnected)held.showModal();}};
 const command=(action,values={})=>rpc('totus_chat_command',{p_action:action,p_data:{channel_id:data.channel,...values}});

 const acceptFiles='.pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.docx,.csv,.txt,.md,.zip';
 const person=email=>data.directory.find(p=>p.email===email)?.name||data.members.find(p=>p.email===email)?.display_name||email;
 const fileSize=value=>Number(value)<1048576?Math.ceil(Number(value)/1024)+' KB':(Number(value)/1048576).toFixed(1).replace('.',',')+' MB';
 function fileHtml(f,mine){
  const id='data-file="'+esc(f.id)+'"';
  return '<div class="chat-file"><div><b>'+esc(f.original_name)+'</b><small>'+fileSize(f.size_bytes)+' · '+(f.status==='ready'?'Guardado en OneDrive':'Subida pendiente')+'</small></div><div class="inline-actions">'+
  (f.status==='ready'?button('Ver','file-preview',id)+button('Descargar','file-download',id):mine&&!current()?.archived?button('Completar subida','file-retry',id):'')+
  (!current()?.archived&&(mine||manager())?button('Retirar','file-remove',id,'danger'):'')+'</div></div>';
 }
 function pickedFilesHtml(){
  return (picks.get(draftKey())||[]).map((p,i)=>'<div class="chat-picked"><span>'+esc(p.file.name)+' · '+fileSize(p.file.size)+'</span>'+button('Quitar','pick-remove','data-index="'+i+'"')+'</div>').join('');
 }
 function addFiles(files){
  const existing=picks.get(draftKey())||[],next=[...existing];
  for(const file of files){chatFileMetadata(file);if(!next.some(p=>p.file.name===file.name&&p.file.size===file.size&&p.file.lastModified===file.lastModified))next.push({file,client_id:crypto.randomUUID()});}
  if(next.length>10)throw new Error('Puedes enviar hasta 10 archivos por mensaje.');
  picks.set(draftKey(),next);paint();
 }
 function progress(text){const el=host?.querySelector('[data-chat-progress]');if(el)el.textContent=text;}
 async function uploadPending(messageId=null){
  if(!requestFile)throw new Error('No está disponible la conexión de archivos.');
  for(const item of [...outbox].filter(p=>!messageId||p.message_id===messageId)){
   progress('Subiendo '+item.file.name+'…');
   await uploadChatFile(item.file,{messageId:item.message_id,clientId:item.client_id,request:requestFile,onProgress:percent=>progress(item.file.name+' · '+percent+' %')});
   outbox=outbox.filter(p=>p!==item);
  }
  progress('Archivos comprobados y guardados en OneDrive.');
 }
 function chosenFile(){return dialog?.querySelector('input[type="file"]')?.files?.[0];}
 function fileDialog(f,messageId){
  const uploadClient=f?.client_id||crypto.randomUUID();
  modal(f?'Completar subida':'Añadir documento','<p>El archivo se guarda de forma privada en OneDrive. No crea un gasto.</p><label>Selecciona '+(f?'el mismo original':'un archivo')+'<input name="attachment" type="file" accept="'+acceptFiles+'" required></label>',{label:'Subir y comprobar',run:async()=>{
   const file=chosenFile();if(!file)throw new Error('Selecciona un archivo.');chatFileMetadata(file);
   outbox=outbox.filter(p=>!(p.client_id===uploadClient&&p.message_id===messageId));outbox.push({file,client_id:uploadClient,message_id:messageId,channel_id:data.channel});
   await uploadPending(messageId);
  }});
 }
 async function previewFile(f,downloadOnly=false){
  const readingOwner=owner,blob=await requestFile('chat-file-content',{file_id:f.id});if(!host||owner!==readingOwner)return;
  if(!(blob instanceof Blob)||blob.size!==Number(f.size_bytes)||await chatFileHash(blob)!==f.sha256)throw new Error('El archivo recibido no coincide con el adjunto.');
  const url=URL.createObjectURL(blob);
  if(downloadOnly){const a=document.createElement('a');a.href=url;a.download=f.original_name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);return;}
  const previewable=['application/pdf','image/png','image/jpeg','image/webp','text/plain','text/csv'].includes(f.mime_type);
  modal(f.original_name,'<div class="chat-preview"></div>'+button('Descargar archivo','download-preview')+(previewable?'':'<p>Este formato se conserva completo. Descárgalo para abrirlo.</p>'),{label:'Cerrar',run:async()=>{}});
  dialog.querySelector('[data-chat="download-preview"]').onclick=()=>{const a=document.createElement('a');a.href=url;a.download=f.original_name;a.click();};
  const container=dialog.querySelector('.chat-preview');
  if(f.mime_type.startsWith('image/')){const img=document.createElement('img');img.src=url;img.alt=f.original_name;container.append(img);}
  else if(f.mime_type==='application/pdf'){const frame=document.createElement('iframe');frame.src=url;frame.title=f.original_name;container.append(frame);}
  else if(f.mime_type.startsWith('text/')){const pre=document.createElement('pre');pre.textContent=await blob.text();container.append(pre);}
  const held=dialog;held.addEventListener('close',()=>URL.revokeObjectURL(url),{once:true});

 }

 function messageHtml(m){
  const mine=m.author_email===owner,deleted=!!m.deleted_at,writable=!current()?.archived,id='data-id="'+esc(m.id)+'"';
  const reactions=(writable?CHAT_REACTIONS:[]).map(emoji=>{const all=(m.reactions||[]).filter(r=>r.emoji===emoji);return button(emoji+(all.length?' '+all.length:''),'reaction',id+' data-emoji="'+emoji+'" aria-label="'+esc('Reaccionar '+emoji)+'" aria-pressed="'+all.some(r=>r.email===owner)+'"','secondary chat-reaction');}).join('');
  return '<article class="chat-message '+(mine?'chat-mine':'')+'" data-message="'+esc(m.id)+'"><header><b>'+esc(m.author_kind==='assistant'?'Asistente de Totus · ChatGPT':person(m.author_email))+'</b><time datetime="'+esc(m.created_at)+'">'+esc(date(m.created_at))+'</time>'+(m.edited_at?'<small>Editado</small>':'')+(m.pinned?'<span class="badge info">Fijado</span>':'')+'</header><div class="chat-body">'+esc(m.body).replace(/@\{([^}]+)\}/g,(_whole,email)=>'<span class="chat-mention">@'+esc(person(email))+'</span>')+'</div>'+
   (!deleted?'<div class="chat-files">'+(m.files||[]).map(f=>fileHtml(f,mine)).join('')+'</div>'+((m.expected_files||0)>(m.files||[]).filter(f=>f.status==='ready').length?'<p class="chat-pending-files">'+(m.expected_files-(m.files||[]).filter(f=>f.status==='ready').length)+' archivo(s) pendiente(s) de completar. '+(mine?button('Descartar subidas pendientes','files-cancel',id):'')+'</p>':''):'')+
   (m.agent_request?'<div class="chat-assistant-status"><span class="badge '+(m.agent_request.status==='completed'?'good':'warn')+'">'+esc(({pending:'Esperando a ChatGPT',working:'ChatGPT está trabajando',completed:'ChatGPT ha respondido',cancelled:'Solicitud cancelada'})[m.agent_request.status])+'</span><small>Conexión por vuestra cuenta · sin respuesta automática contratada</small></div>':'')+
   (m.task_state?'<div class="chat-task"><span class="badge '+(m.task_state==='done'?'good':'warn')+'">'+esc(CHAT_TASK_STATES[m.task_state])+'</span>'+(m.task_result?'<p>'+esc(m.task_result)+'</p>':'')+'</div>':'')+
   (deleted?'':'<footer><div class="chat-reactions">'+reactions+'</div><div class="chat-message-actions">'+
   (!data.parent?button(m.replies?m.replies+' respuestas':writable?'Responder':'Ver conversación','thread',id):'')+
   (mine&&writable?button('Adjuntar','attach',id)+button('Editar','edit',id)+button('Eliminar','message-delete',id,'danger'):'')+
   (manager()&&writable?button(m.pinned?'Desfijar':'Fijar','pin',id):'')+
   (writable&&(mine||manager())?button(m.task_state?'Gestionar tarea':'Crear tarea','task',id):'')+
   (writable&&(mine||manager())&&m.author_kind!=='assistant'&&!m.agent_request?button('Pedir a ChatGPT','agent-request',id):'')+
   (writable&&(mine||manager())&&['pending','working'].includes(m.agent_request?.status)?button('Cancelar solicitud','agent-cancel',id):'')+
   (m.task_state||m.agent_request?button('Preparar para ChatGPT','prompt',id):'')+'</div></footer>')+'</article>';
 }
 function paint(){
  if(!host)return;
  remember();
  const focus=document.activeElement,focusId=host.contains(focus)?focus.id:null,start=focus?.selectionStart,end=focus?.selectionEnd;
  const old=host.querySelector('.chat-messages'),scroll=old?.scrollTop||0,atEnd=!old||old.scrollHeight-old.clientHeight-old.scrollTop<80;
  const c=current(),joined=!!c?.member_role,editable=c&&!c.archived&&joined;
  const list=data.channels.filter(c=>data.archived?c.archived||c.hidden:!c.archived&&!c.hidden);
  const unread=data.channels.filter(c=>c.member_role&&!c.muted&&!c.archived).reduce((n,c)=>n+Number(c.notify_level==='mentions'?c.mentions||0:c.unread||0),0);
  host.innerHTML='<div class="team-chat"><aside class="card chat-sidebar"><div class="chat-sidebar-head"><h2>Equipo<small class="chat-unread-total" role="status">'+unread+' sin leer</small></h2>'+button('+ Canal','new','','primary')+'</div><div class="chat-sidebar-tools">'+button('Mensaje directo','direct')+button('Asistente de Totus','assistant')+button('Avisos','inbox')+'</div><label class="chat-archive"><input type="checkbox" data-chat-input="archived" '+(data.archived?'checked':'')+'>Ver archivados</label>'+chatGroups(list).map(g=>'<section><h3>'+esc(g.name)+'</h3>'+g.channels.map(ch=>'<button class="chat-channel '+(ch.id===data.channel?'active':'')+'" type="button" data-chat="open" data-id="'+esc(ch.id)+'"><span>'+(ch.favourite?'★ ':ch.channel_kind==='assistant'?'✦ ':ch.channel_kind==='direct'?'↔ ':ch.is_private?'🔒 ':'# ')+esc(ch.name)+'</span>'+(Number(ch.unread)&&ch.member_role?'<b>'+Number(ch.unread)+'</b>':'')+'</button>').join('')+'</section>').join('')+(data.loaded&&!list.length?'<p class="muted">No hay canales. Crea el primero para empezar.</p>':'')+'</aside><section class="card chat-conversation" aria-label="Conversación del equipo"><div class="chat-banner">Chat del equipo · los mensajes no registran gastos ni cierres. Las solicitudes a ChatGPT se atienden desde vuestra cuenta; no hay un bot automático activado.</div><div class="note warn" data-chat-error role="alert" '+(data.error?'':'hidden')+'>'+esc(data.error)+'</div>'+
   (!c?'<div class="empty"><strong>'+(data.error?'No se pudieron cargar los canales':data.loaded?'Elige un canal':'Cargando canales…')+'</strong><span>Organiza conversaciones y tareas por tienda.</span>'+(data.error?button('Reintentar','refresh'):'')+'</div>':
   '<header class="chat-heading"><div><h2>'+esc(c.name)+'</h2><p>'+esc(c.description||c.group_name)+(c.is_private?' · Solo miembros':' · Canal abierto al equipo')+(c.archived?' · Archivado':'')+'</p></div><div class="inline-actions">'+button('Actualizar','refresh')+(joined?button('Miembros','members')+button('Preferencias','preferences')+button('Marcar leído','read')+button(c.muted?'Activar avisos':'Silenciar','mute'):'')+(manager()?button('Configurar','settings'):'')+'</div></header>'+
   (!joined?'<div class="empty"><strong>Únete para leer y participar</strong>'+button('Unirme al canal','join','','primary')+'</div>':
   '<div class="chat-search"><label>Buscar<input id="chatQuery" maxlength="200" value="'+esc(data.query)+'" placeholder="Mensaje o persona"></label><label>Desde<input id="chatFrom" type="date" value="'+esc(data.from)+'"></label><label>Hasta<input id="chatTo" type="date" value="'+esc(data.to)+'"></label><label>Mostrar<select id="chatMode"><option value="all">Todos</option><option value="pinned" '+(data.mode==='pinned'?'selected':'')+'>Fijados</option><option value="tasks" '+(data.mode==='tasks'?'selected':'')+'>Tareas</option><option value="mentions" '+(data.mode==='mentions'?'selected':'')+'>Menciones</option></select></label>'+button('Buscar','search','','primary')+button('Limpiar','clear')+'</div>'+
   (data.parent?'<div class="chat-thread-bar">'+button('← Conversación principal','thread-back')+'<b>Respuestas al mensaje</b></div>':'')+
   '<div class="chat-messages" role="log" aria-label="Mensajes" aria-live="polite" aria-relevant="additions">'+(data.more?button('Cargar anteriores','older'):'')+data.messages.map(messageHtml).join('')+(!data.messages.length?'<div class="empty"><strong>Sin mensajes</strong><span>'+(data.query||data.from||data.to||data.mode!=='all'?'Prueba otros filtros.':'Escribe el primer mensaje del canal.')+'</span></div>':'')+'</div>'+
   (editable?'<form class="chat-compose"><label for="chatBody">'+(data.parent?'Responder en esta conversación':'Mensaje para '+esc(c.name))+'</label><textarea id="chatBody" rows="3" maxlength="12000" placeholder="Escribe aquí. Enter añade una línea; Ctrl+Enter envía.">'+esc(drafts.get(draftKey())||'')+'</textarea><div class="chat-compose-tools"><label class="chat-pick-btn">Adjuntar archivos<input type="file" id="chatFiles" multiple accept="'+acceptFiles+'"></label><label>Mencionar<select id="chatMention"><option value="">Elige una persona</option>'+data.members.map(member=>'<option value="'+esc(member.email)+'">'+esc(person(member.email))+'</option>').join('')+'</select></label></div><div class="chat-picked-list">'+pickedFilesHtml()+'</div><div data-chat-progress role="status" aria-live="polite"></div>'+
    (outbox.some(p=>p.channel_id===data.channel||!p.channel_id)?'<div class="note warn">Hay archivos pendientes de subir. '+button('Reintentar archivos pendientes','uploads-retry')+'</div>':'')+
    '<div><small>Hasta 10 archivos · 20 MB por archivo · arrastrar o pegar también funciona.</small><button class="btn primary" type="submit" '+(busy?'disabled':'')+'>Enviar</button></div></form>':'<p class="chat-banner">Canal archivado: disponible para consulta.</p>')))+
   '</section></div>';
  if(focusId){const next=host.querySelector('#'+focusId);if(next){next.focus({preventScroll:true});if(typeof start==='number'&&next.setSelectionRange&&next.type!=='date')next.setSelectionRange(start,end);}}
  const pane=host.querySelector('.chat-messages');if(pane)pane.scrollTop=atEnd?pane.scrollHeight:scroll;
 }
 async function refresh({older=false}={}){
  const token=++generation,channel=data.channel,parent=data.parent;
  const before=older&&data.messages.length?Math.min(...data.messages.map(m=>m.seq)):null;
  const result=await rpc('totus_chat_context',{p_channel:current()?.member_role?channel:null,p_parent:parent,p_before:before,p_query:data.query,p_from:data.from||null,p_to:data.to||null,p_mode:data.mode});
  if(token!==generation||!host||owner!==actor())return;
  const previous=JSON.stringify([data.channels,data.messages,data.members,data.loaded,data.error,data.more]);
  const batch=result.messages||[],more=batch.length>50,rows=more?batch.slice(1):batch;
  data.channels=result.channels||[];data.members=result.members||[];data.directory=result.directory||data.directory;data.loaded=true;data.error='';onUnread(data.channels);
  if(channel){data.more=more;data.messages=older?[...new Map([...rows,...data.messages].map(m=>[m.id,m])).values()].sort((a,b)=>a.seq-b.seq):rows;}
  if(previous!==JSON.stringify([data.channels,data.messages,data.members,data.loaded,data.error,data.more]))paint();
 }
 async function open(id){
  remember();data.channel=id;data.parent=null;data.messages=[];data.more=false;data.query='';data.from='';data.to='';data.mode='all';paint();await refresh();unsubscribe();unsubscribe=subscribe(id,()=>{clearTimeout(realtimeTimer);realtimeTimer=setTimeout(tick,300);});
 }
 function closeDialog(){dialog?.close();dialog?.remove();dialog=null;}
 function modal(title,body,save){
  closeDialog();
  dialog=document.createElement('dialog');dialog.className='chat-dialog';
  dialog.innerHTML='<form><header><h2>'+esc(title)+'</h2><button type="button" class="btn secondary" data-chat-close aria-label="Cerrar">×</button></header><div class="chat-dialog-body">'+body+'</div><p role="alert" data-dialog-error hidden></p><footer>'+button('Cancelar','dialog-cancel')+'<button class="btn primary" type="submit">'+esc(save?.label||'Guardar')+'</button></footer></form>';
  host.append(dialog);dialog.querySelector('[data-chat-close]').onclick=closeDialog;
  dialog.querySelector('[data-chat="dialog-cancel"]').onclick=closeDialog;
  dialog.addEventListener('input',event=>event.target.dataset.dirty='true');
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeDialog();});
  dialog.addEventListener('submit',async event=>{
   event.preventDefault();if(busy)return;busy=true;
   const values=Object.fromEntries(new FormData(event.target));
   const controls=[...dialog.querySelectorAll('button,input,select,textarea')];controls.forEach(c=>c.disabled=true);
   try{await save.run(values);closeDialog();await refresh();}
   catch(error){const box=dialog?.querySelector('[data-dialog-error]');if(box){box.textContent=error.message;box.hidden=false;}else showError(error);}
   finally{unlock();controls.forEach(c=>c.disabled=false);}
  });
  dialog.showModal();
 }
 function channelForm(c={}){
  return '<label>Nombre<input name="name" required maxlength="80" value="'+esc(c.name)+'"></label><label>Grupo<input name="group_name" required maxlength="80" value="'+esc(c.group_name||'Equipo')+'" list="chatGroupOptions"><datalist id="chatGroupOptions">'+['Equipo','Hortimatic','NewOldSmok','Totuscode'].map(g=>'<option value="'+g+'">').join('')+'</datalist></label><label>Descripción<textarea name="description" maxlength="500">'+esc(c.description)+'</textarea></label><label>Acceso<select name="is_private"><option value="false">Abierto · el equipo puede unirse</option><option value="true" '+(c.is_private?'selected':'')+'>Privado · solo invitados</option></select></label>'+(c.id?'<label>Estado<select name="archived"><option value="false">Activo</option><option value="true" '+(c.archived?'selected':'')+'>Archivado · solo lectura</option></select></label>':'');
 }
 async function send(event){
  event.preventDefault();if(busy)return;
  remember();const key=draftKey(),selected=[...(picks.get(key)||[])],body=chatText(drafts.get(key)?.trim()||(selected.length?'Documentos adjuntos':'')),channel=data.channel,parent=data.parent,sendingOwner=owner;
  const previous=pending.get(key),client_id=previous?.body===body?previous.client_id:crypto.randomUUID();
  pending.set(key,{body,client_id});busy=true;paint();
  try{
   const saved=await command('send',{channel_id:channel,parent_id:parent,body,client_id,expected_files:selected.length});
   if(owner!==sendingOwner)return;
   drafts.delete(key);picks.delete(key);pending.delete(key);
   const area=host?.querySelector('#chatBody');if(area)area.value='';
   outbox.push(...selected.map(item=>({...item,channel_id:channel,message_id:saved.id})));
   if(selected.length)await uploadPending(saved.id);
   await refresh();
  }catch(error){showError(error);try{await refresh();}catch{}}
  finally{unlock();}
 }
 function selectCreated(c,role){
  data.channels=[...data.channels.filter(row=>row.id!==c.id),{...c,member_role:role}];data.channel=c.id;data.parent=null;data.messages=[];
  unsubscribe();unsubscribe=subscribe(c.id,()=>{clearTimeout(realtimeTimer);realtimeTimer=setTimeout(tick,300);});
 }
 async function openMessage(channelId,messageId,parentId=null){
  await open(channelId);data.parent=parentId||messageId;data.messages=[];await refresh();
 }
 async function handle(event){
  if(event.target.closest('dialog'))return;
  const el=event.target.closest('[data-chat]');if(!el)return;const action=el.dataset.chat,id=el.dataset.id;
  if(busy)return;
  try{
   const m=data.messages.find(m=>m.id===id);
   if(action==='new'){modal('Nuevo canal',channelForm(),{label:'Crear canal',run:async v=>{const c=await command('create_channel',chatChannelInput({...v,is_private:v.is_private==='true'}));selectCreated(c,'manager');}});return;}
   if(action==='direct'){
    modal('Nuevo mensaje directo','<label>Persona<select name="email" required><option value="">Elige una persona</option>'+data.directory.filter(p=>p.email!==owner).map(p=>'<option value="'+esc(p.email)+'">'+esc(p.name)+'</option>').join('')+'</select></label>',{label:'Abrir conversación',run:async v=>selectCreated(await command('create_direct',{email:v.email}),'member')});return;
   }
   if(action==='assistant'){busy=true;selectCreated(await command('create_assistant'),'member');await refresh();return;}
   if(action==='preferences'){
    const c=current();
    modal('Preferencias del canal','<label>Avisos<select name="notify_level"><option value="all">Todos los mensajes</option><option value="mentions" '+(c.notify_level==='mentions'?'selected':'')+'>Solo menciones</option><option value="none" '+(c.notify_level==='none'||c.muted?'selected':'')+'>Sin avisos</option></select></label><label>Favorito<select name="favourite"><option value="false">No</option><option value="true" '+(c.favourite?'selected':'')+'>Sí</option></select></label><label>Posición en su grupo<input name="sort_order" type="number" step="1" min="-100000" max="100000" value="'+Number(c.sort_order||0)+'"></label><label>Mostrar conversación<select name="hidden"><option value="false">Visible</option><option value="true" '+(c.hidden?'selected':'')+'>Oculta · disponible en archivados</option></select></label><label>Aviso del navegador<select name="desktop_enabled"><option value="false">Desactivado</option><option value="true" '+(c.desktop_enabled?'selected':'')+'>Activado con mi permiso</option></select></label><p class="small muted">Los avisos del navegador funcionan mientras Totus esté abierto. Cada equipo necesita su propio permiso. Los mensajes siempre se conservan aunque cierres la herramienta.</p>',{run:async v=>{
     if(v.desktop_enabled==='true'){
      if(!globalThis.Notification)throw new Error('Este navegador no admite esos avisos.');
      const permission=Notification.permission==='default'?await Notification.requestPermission():Notification.permission;
      if(permission!=='granted')throw new Error('El navegador no ha autorizado los avisos. Puedes guardar la preferencia desactivada.');
     }
     await command('member_preferences',{notify_level:v.notify_level,favourite:v.favourite==='true',hidden:v.hidden==='true',desktop_enabled:v.desktop_enabled==='true',sort_order:Number(v.sort_order)});
    }});return;
   }
   if(action==='inbox'){
    const inbox=await rpc('totus_chat_inbox',{p_mentions:false});
    modal('Mensajes sin leer',inbox.length?'<ul class="chat-inbox">'+inbox.map(item=>'<li><b>'+esc(item.channel_name)+'</b><p>'+esc(item.body.slice(0,180))+'</p>'+button('Abrir conversación','inbox-open','data-channel="'+esc(item.channel_id)+'" data-message="'+esc(item.id)+'" data-parent="'+esc(item.parent_id||'')+'"')+'</li>').join('')+'</ul>':'<p>No tienes mensajes pendientes de leer según tus preferencias.</p>',{label:'Cerrar',run:async()=>{}});
    dialog.querySelectorAll('[data-chat="inbox-open"]').forEach(btn=>btn.onclick=async()=>{const {channel,message,parent}=btn.dataset;closeDialog();busy=true;try{await openMessage(channel,message,parent);}catch(e){showError(e);}finally{unlock();}});return;
   }
   if(action==='attach'){fileDialog(null,id);return;}
   if(action==='file-retry'){const f=data.messages.flatMap(m=>m.files||[]).find(f=>f.id===el.dataset.file);fileDialog(f,f.message_id);return;}
   if(action==='settings'){
    const c=current();modal('Configurar canal',channelForm(c)+'<hr><p>Eliminar retira el canal del uso diario. Conserva documentos y registros contables.</p>'+button('Eliminar canal','retire','','danger'),{run:v=>command('channel_update',{...chatChannelInput({...v,is_private:v.is_private==='true'}),archived:v.archived==='true'})});
    dialog.querySelector('[data-chat="retire"]').onclick=async()=>{if(await ask('¿Retirar este canal? Sus mensajes quedarán conservados para recuperación.')){try{await command('channel_delete');closeDialog();data.channel=null;data.messages=[];await refresh();}catch(e){showError(e);}}};return;
   }
   if(action==='members'){
    const list=data.members.map(m=>'<li><span>'+esc(person(m.email))+'<small>'+esc(m.email)+'</small>'+'</span><small>'+esc(m.member_role==='manager'?'Responsable':'Miembro')+'</small></li>').join('');
    if(!manager()){modal('Miembros','<ul class="chat-members">'+list+'</ul>',{label:'Cerrar',run:async()=>{}});return;}
    modal('Miembros del canal','<ul class="chat-members">'+list+'</ul><label>Correo del usuario del equipo<input name="email" type="email" required list="chatTeamPeople"><datalist id="chatTeamPeople">'+data.directory.map(p=>'<option value="'+esc(p.email)+'">'+esc(p.name)+'</option>').join('')+'</datalist></label><label>Acción<select name="member_role"><option value="member">Añadir como miembro</option><option value="manager">Añadir como responsable</option><option value="remove">Retirar del canal</option></select></label>',{label:'Aplicar',run:async v=>{if(v.member_role==='remove'&&!await ask('¿Retirar a '+v.email+' del canal?'))return;await command(v.member_role==='remove'?'member_remove':'member_save',v);}});return;
   }
   if(action==='edit'){modal('Editar mensaje','<label>Mensaje<textarea name="body" required maxlength="12000" rows="5">'+esc(m.body)+'</textarea></label>',{run:v=>command('edit',{message_id:id,body:chatText(v.body),expected_edited_at:m.edited_at})});return;}
   if(action==='task'){modal('Gestionar tarea','<p>Marcar una tarea no registra una operación contable.</p><label>Estado<select name="task_state">'+Object.entries(CHAT_TASK_STATES).map(([key,name])=>'<option value="'+key+'" '+(m.task_state===key?'selected':'')+'>'+name+'</option>').join('')+'</select></label><label>Resultado y referencias<textarea name="task_result" maxlength="12000" rows="5">'+esc(m.task_result)+'</textarea></label>',{run:v=>command('task',{message_id:id,...v})});return;}
   if(action==='prompt'){modal('Instrucción para vuestra cuenta de ChatGPT','<p>Copia esta instrucción en ChatGPT. No se envía automáticamente ni contrata una API.</p><label>Instrucción<textarea rows="12" readonly>'+esc(chatTaskPrompt(current(),m))+'</textarea></label>',{label:'Cerrar',run:async()=>{}});return;}
   busy=true;
   if(action==='file-preview'||action==='file-download'){
    const f=data.messages.flatMap(m=>m.files||[]).find(f=>f.id===el.dataset.file);if(!f)throw new Error('Actualiza para localizar el adjunto.');
    await previewFile(f,action==='file-download');return;
   }
   if(action==='file-remove'){
    const f=data.messages.flatMap(m=>m.files||[]).find(f=>f.id===el.dataset.file);
    if(await confirm('¿Retirar este adjunto de la conversación? El original verificado seguirá incluido en las copias.'))await rpc('totus_chat_file_remove',{p_id:f.id});
    await refresh();return;
   }
   if(action==='files-cancel'){if(await confirm('¿Descartar las subidas pendientes de este mensaje? Los archivos ya verificados se conservan.')){await command('files_cancel',{message_id:id});outbox=outbox.filter(p=>p.message_id!==id);}await refresh();return;}
   if(action==='uploads-retry'){await uploadPending();await refresh();return;}
   if(action==='pick-remove'){const chosen=picks.get(draftKey())||[];chosen.splice(Number(el.dataset.index),1);picks.set(draftKey(),chosen);paint();return;}
   if(action==='agent-request'||action==='agent-cancel'){await command(action==='agent-request'?'agent_request':'agent_cancel',{message_id:id});await refresh();return;}
   if(action==='open'){await open(id);return;}
   if(action==='thread'){remember();data.parent=id;data.messages=[];await refresh();return;}
   if(action==='thread-back'){remember();data.parent=null;data.messages=[];await refresh();return;}
   if(action==='join'){await command('join');await refresh();await refresh();return;}
   if(action==='search'){const range=chatDateRange(host.querySelector('#chatFrom').value,host.querySelector('#chatTo').value);data.query=host.querySelector('#chatQuery').value.trim();Object.assign(data,range,{mode:host.querySelector('#chatMode').value});await refresh();return;}
   if(action==='clear'){Object.assign(data,{query:'',from:'',to:'',mode:'all'});await refresh();return;}
   if(action==='older'){await refresh({older:true});return;}
   if(action==='read'){await command('read',{seq:current().last_seq||0});await refresh();return;}
   if(action==='mute'){await command('mute',{muted:!current().muted});await refresh();return;}
   if(action==='pin'){await command('pin',{message_id:id,pinned:!m.pinned});await refresh();return;}
   if(action==='reaction'){await command('reaction',{message_id:id,emoji:el.dataset.emoji});await refresh();return;}
   if(action==='message-delete'){if(await confirm('¿Eliminar tu mensaje? No se eliminarán documentos ni operaciones contables.'))await command('message_delete',{message_id:id,expected_edited_at:m.edited_at});await refresh();return;}
   if(action==='refresh')await refresh();
  }catch(error){showError(error);}finally{unlock();}
 }
 const onSubmit=e=>{if(e.target.matches('.chat-compose'))send(e).catch(showError);};
 const onInput=e=>{if(e.target.id==='chatBody')remember();};
 const onChange=e=>{
  if(e.target.dataset.chatInput==='archived'){data.archived=e.target.checked;paint();}
  if(e.target.id==='chatFiles'){try{addFiles([...e.target.files]);}catch(error){showError(error);}}
  if(e.target.id==='chatMention'&&e.target.value){const area=host.querySelector('#chatBody');area.value+=(area.value?' ':'')+'@{'+e.target.value+'} ';remember();e.target.value='';area.focus();}
 };
 const onDrag=e=>{if(e.target.closest('.chat-compose')&&e.dataTransfer?.types?.includes('Files')){e.preventDefault();}};
 const onDrop=e=>{if(e.target.closest('.chat-compose')&&e.dataTransfer?.files?.length){e.preventDefault();try{addFiles([...e.dataTransfer.files]);}catch(error){showError(error);}}};
 const onPaste=e=>{if(e.target.id==='chatBody'&&e.clipboardData?.files?.length){e.preventDefault();try{addFiles([...e.clipboardData.files]);}catch(error){showError(error);}}};
 const onKey=e=>{if(e.target.id==='chatBody'&&e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();send(e).catch(showError);}if(e.target.closest('.chat-search')&&e.key==='Enter'){e.preventDefault();host.querySelector('[data-chat="search"]').click();}};
 const beforeUnload=e=>{if(hasDraft()){e.preventDefault();e.returnValue='';}};
 async function tick(){
  if(!host||busy||dialog||document.visibilityState!=='visible'||data.messages.length>50||host.contains(document.activeElement)&&document.activeElement.matches('input,textarea,select'))return;
  try{await refresh();}catch(error){showError(error);}
 }
 function dispose(){
  remember();generation++;unsubscribe();unsubscribe=()=>{};clearTimeout(realtimeTimer);clearInterval(timer);timer=null;closeDialog();
  if(host){host.removeEventListener('click',handle);host.removeEventListener('submit',onSubmit);host.removeEventListener('input',onInput);host.removeEventListener('change',onChange);host.removeEventListener('keydown',onKey);host.removeEventListener('dragover',onDrag);host.removeEventListener('drop',onDrop);host.removeEventListener('paste',onPaste);}
  window.removeEventListener('beforeunload',beforeUnload);host=null;
 }
 return {hasDraft,dispose,openMessage,reset(){dispose();data=initial();drafts.clear();pending.clear();picks.clear();outbox=[];owner='';},async mount(element){
  dispose();if(owner!==actor()){owner=actor();data=initial();drafts.clear();pending.clear();picks.clear();outbox=[];}
  host=element;host.addEventListener('click',handle);host.addEventListener('submit',onSubmit);host.addEventListener('input',onInput);host.addEventListener('change',onChange);host.addEventListener('keydown',onKey);host.addEventListener('dragover',onDrag);host.addEventListener('drop',onDrop);host.addEventListener('paste',onPaste);
  window.addEventListener('beforeunload',beforeUnload);paint();try{await refresh();}catch(error){showError(error);paint();}if(host===element)timer=setInterval(tick,15000);
 }};
}
