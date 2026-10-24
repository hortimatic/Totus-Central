import {chatText,chatChannelInput,chatDateRange,chatGroups,chatTaskPrompt,CHAT_REACTIONS,CHAT_TASK_STATES} from './team-chat-core.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(label,action,attrs='',kind='secondary')=>'<button type="button" class="btn '+kind+'" data-chat="'+action+'" '+attrs+'>'+esc(label)+'</button>';
const date=value=>new Date(value).toLocaleString('es-ES',{timeZone:'Europe/Madrid',dateStyle:'short',timeStyle:'short'});
const initial=()=>({channels:[],messages:[],members:[],channel:null,parent:null,loaded:false,error:'',query:'',from:'',to:'',mode:'all',archived:false,more:false});
/** Isolated controller. No accounting writes, credentials, local storage or AI calls. */
export function createTeamChat({rpc,actor,onError=()=>{},confirm=async()=>false}){
 let host=null,data=initial(),busy=false,timer=null,generation=0,owner='',drafts=new Map(),pending=new Map(),dialog=null;
 const current=()=>data.channels.find(c=>c.id===data.channel);
 const manager=()=>current()?.member_role==='manager';
 const draftKey=()=>data.channel+':'+(data.parent||'main');
 const remember=()=>{const input=host?.querySelector('#chatBody');if(input)drafts.set(draftKey(),input.value);};
 const hasDraft=()=>{remember();return [...drafts.values()].some(v=>v.trim())||!!dialog?.querySelector('[data-dirty="true"]');};
 const unlock=()=>{busy=false;const submit=host?.querySelector('.chat-compose [type="submit"]');if(submit)submit.disabled=false;};
 const showError=error=>{data.error=error.message||String(error);onError(data.error);const box=host?.querySelector('[data-chat-error]');if(box){box.hidden=false;box.textContent=data.error;}};
 const ask=async message=>{const held=dialog;held?.close();try{return await confirm(message);}finally{if(held&&dialog===held&&held.isConnected)held.showModal();}};
 const command=(action,values={})=>rpc('totus_chat_command',{p_action:action,p_data:{channel_id:data.channel,...values}});
 function messageHtml(m){
  const mine=m.author_email===owner,deleted=!!m.deleted_at,id='data-id="'+esc(m.id)+'"';
  const reactions=CHAT_REACTIONS.map(emoji=>{const all=(m.reactions||[]).filter(r=>r.emoji===emoji);return button(emoji+(all.length?' '+all.length:''),'reaction',id+' data-emoji="'+emoji+'" aria-label="'+esc('Reaccionar '+emoji)+'" aria-pressed="'+all.some(r=>r.email===owner)+'"','secondary chat-reaction');}).join('');
  return '<article class="chat-message '+(mine?'chat-mine':'')+'" data-message="'+esc(m.id)+'"><header><b>'+esc(m.author_email)+'</b><time datetime="'+esc(m.created_at)+'">'+esc(date(m.created_at))+'</time>'+(m.edited_at?'<small>Editado</small>':'')+(m.pinned?'<span class="badge info">Fijado</span>':'')+'</header><div class="chat-body">'+esc(m.body)+'</div>'+
   (m.task_state?'<div class="chat-task"><span class="badge '+(m.task_state==='done'?'good':'warn')+'">'+esc(CHAT_TASK_STATES[m.task_state])+'</span>'+(m.task_result?'<p>'+esc(m.task_result)+'</p>':'')+'</div>':'')+
   (deleted?'':'<footer><div class="chat-reactions">'+reactions+'</div><div class="chat-message-actions">'+
   (!data.parent?button(m.replies?m.replies+' respuestas':'Responder','thread',id):'')+
   (mine?button('Editar','edit',id)+button('Eliminar','message-delete',id,'danger'):'')+
   (manager()?button(m.pinned?'Desfijar':'Fijar','pin',id):'')+
   (mine||manager()?button(m.task_state?'Gestionar tarea':'Crear tarea','task',id):'')+
   (m.task_state?button('Preparar para ChatGPT','prompt',id):'')+'</div></footer>')+'</article>';
 }
 function paint(){
  if(!host)return;
  remember();
  const focus=document.activeElement,focusId=host.contains(focus)?focus.id:null,start=focus?.selectionStart,end=focus?.selectionEnd;
  const old=host.querySelector('.chat-messages'),scroll=old?.scrollTop||0,atEnd=!old||old.scrollHeight-old.clientHeight-old.scrollTop<80;
  const c=current(),joined=!!c?.member_role,editable=c&&!c.archived&&joined;
  const list=data.channels.filter(c=>data.archived?c.archived:!c.archived);
  host.innerHTML='<div class="team-chat"><aside class="card chat-sidebar"><div class="chat-sidebar-head"><h2>Equipo</h2>'+button('+ Canal','new','','primary')+'</div><label class="chat-archive"><input type="checkbox" data-chat-input="archived" '+(data.archived?'checked':'')+'>Ver archivados</label>'+chatGroups(list).map(g=>'<section><h3>'+esc(g.name)+'</h3>'+g.channels.map(ch=>'<button class="chat-channel '+(ch.id===data.channel?'active':'')+'" type="button" data-chat="open" data-id="'+esc(ch.id)+'"><span>'+(ch.is_private?'🔒 ':'# ')+esc(ch.name)+'</span>'+(Number(ch.unread)&&ch.member_role?'<b>'+Number(ch.unread)+'</b>':'')+'</button>').join('')+'</section>').join('')+(data.loaded&&!list.length?'<p class="muted">No hay canales. Crea el primero para empezar.</p>':'')+'</aside><section class="card chat-conversation" aria-label="Conversación del equipo"><div class="chat-banner">Chat del equipo · los mensajes no registran gastos ni cierres. ChatGPT trabaja desde vuestra cuenta cuando se lo pedís.</div><div class="note warn" data-chat-error role="alert" '+(data.error?'':'hidden')+'>'+esc(data.error)+'</div>'+
   (!c?'<div class="empty"><strong>'+(data.loaded?'Elige un canal':'Cargando canales…')+'</strong><span>Organiza conversaciones y tareas por tienda.</span></div>':
   '<header class="chat-heading"><div><h2>'+esc(c.name)+'</h2><p>'+esc(c.description||c.group_name)+(c.is_private?' · Solo miembros':' · Canal abierto al equipo')+(c.archived?' · Archivado':'')+'</p></div><div class="inline-actions">'+button('Actualizar','refresh')+(joined?button('Miembros','members')+button('Marcar leído','read')+button(c.muted?'Activar avisos':'Silenciar','mute'):'')+(manager()?button('Configurar','settings'):'')+'</div></header>'+
   (!joined?'<div class="empty"><strong>Únete para leer y participar</strong>'+button('Unirme al canal','join','','primary')+'</div>':
   '<div class="chat-search"><label>Buscar<input id="chatQuery" maxlength="200" value="'+esc(data.query)+'" placeholder="Mensaje o persona"></label><label>Desde<input id="chatFrom" type="date" value="'+esc(data.from)+'"></label><label>Hasta<input id="chatTo" type="date" value="'+esc(data.to)+'"></label><label>Mostrar<select id="chatMode"><option value="all">Todos</option><option value="pinned" '+(data.mode==='pinned'?'selected':'')+'>Fijados</option><option value="tasks" '+(data.mode==='tasks'?'selected':'')+'>Tareas</option></select></label>'+button('Buscar','search','','primary')+button('Limpiar','clear')+'</div>'+
   (data.parent?'<div class="chat-thread-bar">'+button('← Conversación principal','thread-back')+'<b>Respuestas al mensaje</b></div>':'')+
   '<div class="chat-messages" role="log" aria-label="Mensajes" aria-live="polite" aria-relevant="additions">'+(data.more?button('Cargar anteriores','older'):'')+data.messages.map(messageHtml).join('')+(!data.messages.length?'<div class="empty"><strong>Sin mensajes</strong><span>'+(data.query||data.from||data.to||data.mode!=='all'?'Prueba otros filtros.':'Escribe el primer mensaje del canal.')+'</span></div>':'')+'</div>'+
   (editable?'<form class="chat-compose"><label for="chatBody">'+(data.parent?'Responder en esta conversación':'Mensaje para '+esc(c.name))+'</label><textarea id="chatBody" rows="3" maxlength="12000" placeholder="Escribe aquí. Enter añade una línea; Ctrl+Enter envía.">'+esc(drafts.get(draftKey())||'')+'</textarea><div><small>Los documentos y las operaciones contables se siguen gestionando en sus módulos.</small><button class="btn primary" type="submit" '+(busy?'disabled':'')+'>Enviar</button></div></form>':'<p class="chat-banner">Canal archivado: disponible para consulta.</p>')))+
   '</section></div>';
  if(focusId){const next=host.querySelector('#'+focusId);if(next){next.focus({preventScroll:true});if(typeof start==='number'&&next.setSelectionRange&&next.type!=='date')next.setSelectionRange(start,end);}}
  const pane=host.querySelector('.chat-messages');if(pane)pane.scrollTop=atEnd?pane.scrollHeight:scroll;
 }
 async function refresh({older=false}={}){
  const token=++generation,channel=data.channel,parent=data.parent;
  const before=older&&data.messages.length?Math.min(...data.messages.map(m=>m.seq)):null;
  const result=await rpc('totus_chat_context',{p_channel:current()?.member_role?channel:null,p_parent:parent,p_before:before,p_query:data.query,p_from:data.from||null,p_to:data.to||null,p_mode:data.mode});
  if(token!==generation||!host||owner!==actor())return;
  const batch=result.messages||[],more=batch.length>50,rows=more?batch.slice(1):batch;
  data.channels=result.channels||[];data.members=result.members||[];data.loaded=true;data.error='';
  if(channel){data.more=more;data.messages=older?[...new Map([...rows,...data.messages].map(m=>[m.id,m])).values()].sort((a,b)=>a.seq-b.seq):rows;}
  paint();
 }
 async function open(id){
  remember();data.channel=id;data.parent=null;data.messages=[];data.more=false;data.query='';data.from='';data.to='';data.mode='all';paint();await refresh();
 }
 function closeDialog(){dialog?.close();dialog?.remove();dialog=null;}
 function modal(title,body,save){
  closeDialog();
  dialog=document.createElement('dialog');dialog.className='chat-dialog';
  dialog.innerHTML='<form><header><h2>'+esc(title)+'</h2><button type="button" class="btn secondary" data-chat-close aria-label="Cerrar">×</button></header><div class="chat-dialog-body">'+body+'</div><p role="alert" data-dialog-error hidden></p><footer>'+button('Cancelar','dialog-cancel')+'<button class="btn primary" type="submit">'+esc(save?.label||'Guardar')+'</button></footer></form>';
  host.append(dialog);dialog.querySelector('[data-chat-close]').onclick=closeDialog;
  dialog.querySelector('[data-chat="dialog-cancel"]').onclick=closeDialog;
  dialog.addEventListener('input',event=>event.target.dataset.dirty='true');
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
  remember();const key=draftKey(),body=chatText(drafts.get(key)),channel=data.channel,parent=data.parent;
  const previous=pending.get(key),client_id=previous?.body===body?previous.client_id:crypto.randomUUID();
  pending.set(key,{body,client_id});busy=true;paint();
  try{await command('send',{channel_id:channel,parent_id:parent,body,client_id});drafts.delete(key);pending.delete(key);const area=host.querySelector('#chatBody');if(area)area.value='';await refresh();}
  catch(error){showError(error);}
  finally{busy=false;const submit=host?.querySelector('.chat-compose [type="submit"]');if(submit)submit.disabled=false;}
 }
 async function handle(event){
  if(event.target.closest('dialog'))return;
  const el=event.target.closest('[data-chat]');if(!el)return;const action=el.dataset.chat,id=el.dataset.id;
  if(busy)return;
  try{
   const m=data.messages.find(m=>m.id===id);
   if(action==='new'){modal('Nuevo canal',channelForm(),{label:'Crear canal',run:async v=>{const c=await command('create_channel',chatChannelInput({...v,is_private:v.is_private==='true'}));data.channel=c.id;data.parent=null;}});return;}
   if(action==='settings'){
    const c=current();modal('Configurar canal',channelForm(c)+'<hr><p>Eliminar retira el canal del uso diario. Conserva documentos y registros contables.</p>'+button('Eliminar canal','retire','','danger'),{run:v=>command('channel_update',{...chatChannelInput({...v,is_private:v.is_private==='true'}),archived:v.archived==='true'})});
    dialog.querySelector('[data-chat="retire"]').onclick=async()=>{if(await ask('¿Retirar este canal? Sus mensajes quedarán conservados para recuperación.')){try{await command('channel_delete');closeDialog();data.channel=null;data.messages=[];await refresh();}catch(e){showError(e);}}};return;
   }
   if(action==='members'){
    const list=data.members.map(m=>'<li><span>'+esc(m.email)+'</span><small>'+esc(m.member_role==='manager'?'Responsable':'Miembro')+'</small></li>').join('');
    if(!manager()){modal('Miembros','<ul class="chat-members">'+list+'</ul>',{label:'Cerrar',run:async()=>{}});return;}
    modal('Miembros del canal','<ul class="chat-members">'+list+'</ul><label>Correo del usuario del equipo<input name="email" type="email" required></label><label>Acción<select name="member_role"><option value="member">Añadir como miembro</option><option value="manager">Añadir como responsable</option><option value="remove">Retirar del canal</option></select></label>',{label:'Aplicar',run:async v=>{if(v.member_role==='remove'&&!await ask('¿Retirar a '+v.email+' del canal?'))return;await command(v.member_role==='remove'?'member_remove':'member_save',v);}});return;
   }
   if(action==='edit'){modal('Editar mensaje','<label>Mensaje<textarea name="body" required maxlength="12000" rows="5">'+esc(m.body)+'</textarea></label>',{run:v=>command('edit',{message_id:id,body:chatText(v.body),expected_edited_at:m.edited_at})});return;}
   if(action==='task'){modal('Gestionar tarea','<p>Marcar una tarea no registra una operación contable.</p><label>Estado<select name="task_state">'+Object.entries(CHAT_TASK_STATES).map(([key,name])=>'<option value="'+key+'" '+(m.task_state===key?'selected':'')+'>'+name+'</option>').join('')+'</select></label><label>Resultado y referencias<textarea name="task_result" maxlength="12000" rows="5">'+esc(m.task_result)+'</textarea></label>',{run:v=>command('task',{message_id:id,...v})});return;}
   if(action==='prompt'){modal('Instrucción para vuestra cuenta de ChatGPT','<p>Copia esta instrucción en ChatGPT. No se envía automáticamente ni contrata una API.</p><label>Instrucción<textarea rows="12" readonly>'+esc(chatTaskPrompt(current(),m))+'</textarea></label>',{label:'Cerrar',run:async()=>{}});return;}
   busy=true;
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
 const onChange=e=>{if(e.target.dataset.chatInput==='archived'){data.archived=e.target.checked;paint();}};
 const onKey=e=>{if(e.target.id==='chatBody'&&e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();send(e).catch(showError);}if(e.target.closest('.chat-search')&&e.key==='Enter'){e.preventDefault();host.querySelector('[data-chat="search"]').click();}};
 const beforeUnload=e=>{if(hasDraft()){e.preventDefault();e.returnValue='';}};
 async function tick(){
  if(!host||busy||dialog||document.visibilityState!=='visible'||data.messages.length>50)return;
  try{await refresh();}catch(error){showError(error);}
 }
 function dispose(){
  remember();generation++;clearInterval(timer);timer=null;closeDialog();
  if(host){host.removeEventListener('click',handle);host.removeEventListener('submit',onSubmit);host.removeEventListener('input',onInput);host.removeEventListener('change',onChange);host.removeEventListener('keydown',onKey);}
  window.removeEventListener('beforeunload',beforeUnload);host=null;
 }
 return {hasDraft,dispose,reset(){dispose();data=initial();drafts.clear();pending.clear();owner='';},async mount(element){
  dispose();if(owner!==actor()){owner=actor();data=initial();drafts.clear();pending.clear();}
  host=element;host.addEventListener('click',handle);host.addEventListener('submit',onSubmit);host.addEventListener('input',onInput);host.addEventListener('change',onChange);host.addEventListener('keydown',onKey);
  window.addEventListener('beforeunload',beforeUnload);paint();await refresh();timer=setInterval(tick,15000);
 }};
}
