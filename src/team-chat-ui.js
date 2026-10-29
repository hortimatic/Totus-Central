import {prepareChatSound,playChatSound,requestChatDesktopPermission,chatDesktopStatus} from './chat-alerts.js';
import {uploadChatFile,chatFileMetadata,chatFileHash} from './chat-files.js';
import {CHAT_CHANNEL_ICONS,chatChannelIdentity,chatChannelMatches,chatSearchText,chatMoveChannel,chatText,chatChannelInput,chatDateRange,chatGroups,chatLayout,chatTaskPrompt,CHAT_REACTIONS,CHAT_TASK_STATES,CHAT_GROUPS} from './team-chat-core.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const chatButton=(label,action,attrs='',kind='secondary')=>'<button type="button" class="btn '+kind+'" data-chat="'+action+'" '+attrs+'>'+esc(label)+'</button>';
const messageDay=value=>new Date(value).toLocaleDateString('en-CA',{timeZone:'Europe/Madrid'});
const dayLabel=value=>new Date(value).toLocaleDateString('es-ES',{timeZone:'Europe/Madrid',weekday:'long',day:'numeric',month:'long',year:'numeric'});
const initials=name=>String(name||'?').trim().split(/\s+/).slice(0,2).map(word=>[...word][0]).join('').toLocaleUpperCase('es');
const date=value=>new Date(value).toLocaleString('es-ES',{timeZone:'Europe/Madrid',dateStyle:'short',timeStyle:'short'});
const initial=()=>({channels:[],messages:[],members:[],directory:[],channel:null,parent:null,loaded:false,error:'',query:'',from:'',to:'',mode:'all',archived:false,more:false,layout:{},channelQuery:'',channelView:'all',filterDraft:null,searchOpen:false,hasNew:false,loadingChannel:false,mobileNavigation:true});
/** Isolated controller. No accounting writes, credentials, local storage or AI calls. */
export function createTeamChat({rpc:rawRpc,actor,can=()=>true,onError=()=>{},confirm=async()=>false,requestFile=null,subscribe=()=>()=>{},onUnread=()=>{},onTask=null,stores=()=>[],onAlerts=()=>{}}){
 let host=null,data=initial(),opening=0,busy=false,timer=null,generation=0,lifecycle=0,owner='',composing=false,drafts=new Map(),pending=new Map(),dialog=null,unsubscribe=()=>{},realtimeTimer=null,picks=new Map(),outbox=[],readTimer=null,readFlight=null;
 const button=(label,action,attrs='',kind='secondary')=>{const permission=['new','direct','assistant','attach','uploads-retry','agent-request'].includes(action)?'create':['message-delete','file-remove','channel-delete','retire','files-cancel'].includes(action)?'delete':['edit','pin','task','settings','agent-cancel'].includes(action)?'edit':['file-download','download-preview'].includes(action)?'export':'view';return can(permission)?chatButton(label,action,attrs,kind):'';};
 const scope=()=>({host,owner,lifecycle});
 const active=s=>s.host===host&&!!host&&s.owner===owner&&owner===actor()&&s.lifecycle===lifecycle;
 const contextChanged=()=>Object.assign(new Error('La conversación ya no está activa.'),{contextChanged:true});
 const scoped=async run=>{const s=scope();if(!active(s))throw contextChanged();try{const result=await run();if(!active(s))throw contextChanged();return result;}catch(error){if(!active(s))throw contextChanged();throw error;}};
 const rpc=(name,args)=>scoped(()=>rawRpc(name,args));
 const current=()=>data.channels.find(c=>c.id===data.channel);
 const manager=()=>can('edit')&&current()?.member_role==='manager'&&(!current()?.channel_kind||current()?.channel_kind==='channel');
 const draftKey=()=>data.channel+':'+(data.parent||'main');
 const remember=()=>{const input=host?.querySelector('#chatBody');if(input)drafts.set(input.closest('.chat-compose')?.dataset.draftKey||draftKey(),input.value);};
 const hasDraft=()=>{remember();return [...drafts.values()].some(v=>v.trim())||[...picks.values()].some(files=>files.length)||outbox.length>0||!!dialog?.querySelector('[data-dirty="true"]');};
 const unlock=(stamp)=>{if(stamp!==lifecycle)return;busy=false;host?.querySelectorAll('.chat-compose [type="submit"]').forEach(submit=>submit.disabled=false);};
 const showError=error=>{if(error?.contextChanged)return;data.error=error.message||String(error);if(/No tienes acceso a este canal|Usuario de equipo no activo/i.test(data.error)){data.messages=[];data.members=[];data.channel=null;data.parent=null;data.channels=[];paint();drafts.clear();pending.clear();picks.clear();outbox=[];}onError(data.error);const box=host?.querySelector('[data-chat-error]');if(box){box.hidden=false;box.textContent=data.error;}};
 const ask=async message=>{const held=dialog;held?.close();try{return await confirm(message);}finally{if(held&&dialog===held&&held.isConnected)held.showModal();}};
 const command=(action,values={})=>{const permission=['read','mute','member_preferences','join'].includes(action)?'view':['create_direct','create_assistant','create_channel','send','agent_request'].includes(action)?'create':['channel_delete','member_remove','message_delete','files_cancel'].includes(action)?'delete':'edit';if(!can(permission))throw new Error('No tienes permiso para esta acción en el chat.');return rpc('totus_chat_command',{p_action:action,p_data:{channel_id:data.channel,...values}});};

 // Only acknowledge messages actually displayed, in the active visible conversation.
 function scheduleRead(){clearTimeout(readTimer);readTimer=setTimeout(markVisibleRead,350);}
 async function markVisibleRead(){
  const s=scope(),c=current(),pane=host?.querySelector('.chat-messages');
  if(!active(s)||composing||document.visibilityState!=='visible'||dialog||!c?.member_role||!pane||!pane.getClientRects().length||data.query||data.from||data.to||data.mode!=='all'||pane.scrollHeight-pane.clientHeight-pane.scrollTop>40)return;
  const channel=c.id,seq=Math.max(0,...data.messages.map(m=>Number(m.seq)||0));
  if(!seq||seq<=Number(c.last_read_seq||0)||readFlight)return;
  const flight={channel,seq};readFlight=flight;
  try{
   await rpc('totus_chat_command',{p_action:'read',p_data:{channel_id:channel,seq}});
   if(active(s)&&data.channel===channel)await refresh({preserveHistory:data.messages.length>50});
  }catch(error){if(!error?.contextChanged)onError('No se ha podido actualizar el estado de lectura. Se reintentará al actualizar la conversación.');}
  finally{if(readFlight===flight)readFlight=null;}
 }
 const onReadScroll=e=>{if(e.target.matches?.('.chat-messages'))scheduleRead();};
 const onVisible=()=>{if(document.visibilityState==='visible')scheduleRead();};
 const acceptFiles='.pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.docx,.csv,.txt,.md,.zip';
 const person=email=>email==='chatgpt@totuscentral.invalid'?'ChatGPT':data.directory.find(p=>p.email===email)?.name||data.members.find(p=>p.email===email)?.display_name||email;
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
  const s=scope();
  for(const item of [...outbox].filter(p=>!messageId||p.message_id===messageId)){
   if(!active(s))throw contextChanged();
   progress('Subiendo '+item.file.name+'…');
   await uploadChatFile(item.file,{messageId:item.message_id,clientId:item.client_id,request:(...args)=>{if(!active(s))return Promise.reject(contextChanged());return scoped(()=>requestFile(...args));},onProgress:percent=>{if(active(s))progress(item.file.name+' · '+percent+' %');}});
   if(!active(s))throw contextChanged();
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
  const blob=await scoped(()=>requestFile('chat-file-content',{file_id:f.id}));
  if(!(blob instanceof Blob)||blob.size!==Number(f.size_bytes)||await scoped(()=>chatFileHash(blob))!==f.sha256)throw new Error('El archivo recibido no coincide con el adjunto.');
  const url=URL.createObjectURL(blob);
  if(downloadOnly){const a=document.createElement('a');a.href=url;a.download=f.original_name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);return;}
  const previewable=['application/pdf','image/png','image/jpeg','image/webp','text/plain','text/csv'].includes(f.mime_type);
  modal(f.original_name,'<div class="chat-preview"></div>'+button('Descargar archivo','download-preview')+(previewable?'':'<p>Este formato se conserva completo. Descárgalo para abrirlo.</p>'),{label:'Cerrar',refresh:false,run:async()=>{}});
  const held=dialog;held.addEventListener('close',()=>URL.revokeObjectURL(url),{once:true});
  const downloadButton=dialog.querySelector('[data-chat="download-preview"]');if(downloadButton)downloadButton.onclick=()=>{const a=document.createElement('a');a.href=url;a.download=f.original_name;a.click();};
  const container=dialog.querySelector('.chat-preview');
  if(f.mime_type.startsWith('image/')){const img=document.createElement('img');img.src=url;img.alt=f.original_name;container.append(img);}
  else if(f.mime_type==='application/pdf'){const frame=document.createElement('iframe');frame.src=url;frame.title=f.original_name;container.append(frame);}
  else if(f.mime_type.startsWith('text/')){const text=await scoped(()=>blob.text());if(dialog!==held||!held.isConnected)return;const pre=document.createElement('pre');pre.textContent=text;container.append(pre);}

 }

 function messageHtml(m){
  const mine=m.author_email===owner,deleted=!!m.deleted_at,writable=!current()?.archived,id='data-id="'+esc(m.id)+'"';
  const reactions=(writable?CHAT_REACTIONS:[]).map(emoji=>{const all=(m.reactions||[]).filter(r=>r.emoji===emoji);return button(emoji+(all.length?' '+all.length:''),'reaction',id+' data-emoji="'+emoji+'" aria-label="'+esc('Reaccionar '+emoji)+'" aria-pressed="'+all.some(r=>r.email===owner)+'"','secondary chat-reaction'+(all.length?'':' chat-reaction-empty'));}).join('');
  return '<article class="chat-message '+(mine?'chat-mine':'')+'" data-message="'+esc(m.id)+'"><span class="chat-avatar" aria-hidden="true">'+esc(initials(m.author_kind==='assistant'?'ChatGPT':person(m.author_email)))+'</span><header><b>'+esc(m.author_kind==='assistant'?'ChatGPT':person(m.author_email))+'</b><time datetime="'+esc(m.created_at)+'" title="'+esc(date(m.created_at))+'" aria-label="'+esc(date(m.created_at))+'">'+esc(new Date(m.created_at).toLocaleTimeString('es-ES',{timeZone:'Europe/Madrid',hour:'2-digit',minute:'2-digit'}))+'</time>'+(m.edited_at?'<small>Editado</small>':'')+(m.pinned?'<span class="badge info">Fijado</span>':'')+'</header><div class="chat-body">'+esc(m.body).replace(/@\{([^}]+)\}/g,(_whole,email)=>'<span class="chat-mention">@'+esc(person(email))+'</span>')+'</div>'+
   (!deleted?'<div class="chat-files">'+(m.files||[]).map(f=>fileHtml(f,mine)).join('')+'</div>'+((m.expected_files||0)>(m.files||[]).filter(f=>f.status==='ready').length?'<p class="chat-pending-files">'+(m.expected_files-(m.files||[]).filter(f=>f.status==='ready').length)+' archivo(s) pendiente(s) de completar. '+(mine?button('Descartar subidas pendientes','files-cancel',id):'')+'</p>':''):'')+
   (m.agent_request?'<div class="chat-assistant-status"><span class="badge '+(m.agent_request.status==='completed'?'good':'warn')+'">'+esc(({pending:'Esperando a ChatGPT',working:'ChatGPT está trabajando',completed:'ChatGPT ha respondido',cancelled:'Solicitud cancelada'})[m.agent_request.status])+'</span><small>Respuesta desde vuestro ChatGPT · atención iniciada por vosotros</small></div>':'')+
   (m.task_state?'<div class="chat-task"><span class="badge '+(m.task_state==='done'?'good':'warn')+'">'+esc(CHAT_TASK_STATES[m.task_state])+'</span>'+(m.task_result?'<p>'+esc(m.task_result)+'</p>':'')+'</div>':'')+
   (deleted?'':'<footer><div class="chat-reactions">'+reactions+'</div><div class="chat-message-actions">'+
   (writable&&can('create')?button('Citar','quote',id):'')+
   (!data.parent?button(m.replies?m.replies+(Number(m.replies)===1?' respuesta':' respuestas'):writable?'Responder':'Ver conversación','thread',id):'')+
   (mine&&writable?button('Adjuntar','attach',id)+button('Editar','edit',id)+button('Eliminar','message-delete',id,'danger'):'')+
   (!mine&&manager()&&writable?button('Eliminar','message-delete',id,'danger'):'')+
   (manager()&&writable?button(m.pinned?'Desfijar':'Fijar','pin',id):'')+
   (writable&&(mine||manager())?button(m.task_state?'Gestionar tarea':'Crear tarea','task',id):'')+
   (writable&&(mine||manager())&&m.author_kind!=='assistant'&&(!m.agent_request||m.agent_request.status==='cancelled')?button('Pedir a ChatGPT','agent-request',id):'')+
   (writable&&(mine||manager())&&['pending','working'].includes(m.agent_request?.status)?button('Cancelar solicitud','agent-cancel',id):'')+
   (m.task_state||m.agent_request?button('Preparar para ChatGPT','prompt',id):'')+'</div></footer>')+'</article>';
 }
 function paint(){
  if(!host||composing)return;
  remember();
  const focus=document.activeElement,focusId=host.contains(focus)?focus.id:null,start=focus?.selectionStart,end=focus?.selectionEnd;
  const composer=host.querySelector('.chat-compose'),composerKey=composer?.dataset.draftKey;
  const old=host.querySelector('.chat-messages'),scroll=old?.scrollTop||0,atEnd=!old||old.scrollHeight-old.clientHeight-old.scrollTop<80;
  const c=current(),joined=!!c?.member_role,editable=c&&!c.archived&&joined&&can('create');
  const openMenus=[...host.querySelectorAll('details[data-chat-menu][open]')].map(el=>el.dataset.chatMenu);
  const menu=(key,label,body,icon='')=>'<details class="chat-menu" data-chat-menu="'+key+'"><summary id="chatMenu-'+key+'" aria-label="'+esc(label)+'" title="'+esc(label)+'">'+(icon?'<span aria-hidden="true">'+icon+'</span> ':'')+esc(label)+'</summary><div class="chat-menu-panel" aria-label="'+esc(label)+'">'+body+'</div></details>';
  const needle=chatSearchText(data.channelQuery.trim());
  const personalGroup=c=>data.layout.channel_groups?.[c.id]||c.group_name;
  const list=data.channels.filter(c=>c.channel_kind!=='assistant').filter(c=>data.archived?c.archived||c.hidden||(data.layout.hidden_groups||[]).includes(personalGroup(c)):!c.archived&&!c.hidden&&!(data.layout.hidden_groups||[]).includes(personalGroup(c))).filter(c=>chatChannelMatches(c,data.layout,needle,data.channelView));
  const unread=data.channels.filter(c=>c.channel_kind!=='assistant'&&c.member_role&&!c.muted&&!c.archived).reduce((n,c)=>n+Number(c.notify_level==='mentions'?c.mentions||0:c.unread||0),0);
  host.innerHTML='<div class="team-chat '+(data.layout.compact_sidebar?'chat-sidebar-collapsed ':'')+(data.mobileNavigation?'chat-show-channels':'chat-show-conversation')+'"><aside class="card chat-sidebar"><div class="chat-sidebar-head">'+button('☰','sidebar-toggle','aria-label="'+(data.layout.compact_sidebar?'Mostrar canales':'Ocultar canales')+'" title="'+(data.layout.compact_sidebar?'Mostrar canales':'Ocultar canales')+'"')+'<h2>Chat<small class="chat-unread-total" role="status">'+unread+' sin leer</small></h2></div><div class="chat-navigation-tools">'+menu('create','Nuevo',button('Canal','new')+button('Mensaje directo','direct')+button('Sección personal','section-new'),'＋')+menu('general','Ajustes de Chat',button('Sonido y avisos','alerts')+button('Atajos y ayuda','shortcuts'),'⚙')+'</div><div class="chat-inbox-access">'+button('Avisos'+(unread?' · '+unread:''),'inbox','aria-label="Abrir avisos'+(unread?' · '+unread+' mensajes sin leer':'')+'"')+'</div><div class="chat-channel-filters"><label class="chat-channel-search">Buscar canal o sección<input id="chatChannelQuery" value="'+esc(data.channelQuery)+'" placeholder="Nombre del canal o persona"></label><label class="chat-channel-view">Mostrar<select id="chatChannelView">'+[['all','Todas las conversaciones'],['unread','Sin leer'],['favourites','Favoritos'],['direct','Mensajes directos']].map(([value,label])=>'<option value="'+value+'" '+(data.channelView===value?'selected':'')+'>'+label+'</option>').join('')+'</select></label><label class="chat-archive"><input type="checkbox" data-chat-input="archived" '+(data.archived?'checked':'')+'>Ver ocultos y archivados</label></div>'+chatGroups(list,data.layout).filter(g=>g.channels.length||!needle&&data.channelView==='all').filter(g=>data.archived||(data.layout.hidden_groups||[]).includes(g.name)===false).map(g=>'<section><div class="chat-group-head"><button type="button" data-chat="group-toggle" data-group="'+esc(g.name)+'" aria-expanded="'+(!!needle||!(data.layout.collapsed_groups||[]).includes(g.name))+'"><span>'+(!needle&&(data.layout.collapsed_groups||[]).includes(g.name)?'▸ ':'▾ ')+esc(g.label)+' <small class="chat-group-count" aria-hidden="true">'+g.channels.length+'</small></span></button>'+button('⋯','group-menu','data-group="'+esc(g.name)+'" aria-label="Organizar sección '+esc(g.label)+'"')+'</div>'+(!needle&&(data.layout.collapsed_groups||[]).includes(g.name)?'':g.channels.map(ch=>'<button class="chat-channel '+(ch.id===data.channel?'active':'')+'" type="button" draggable="true" title="Arrastra para ordenar tus canales" data-chat="open" data-id="'+esc(ch.id)+'"><span>'+(ch.favourite?'★ ':ch.channel_kind==='assistant'?'✦ ':ch.channel_kind==='direct'?'↔ ':ch.is_private?'🔒 ':chatChannelIdentity(ch.name).icon?'':'# ')+esc(ch.name)+'</span>'+(Number(ch.unread)&&ch.member_role?'<b>'+Number(ch.unread)+'</b>':'')+'</button>').join(''))+'</section>').join('')+(data.loaded&&!list.length?'<div class="chat-sidebar-empty"><b>'+(needle||data.channelView!=='all'?'Sin coincidencias':'Sin conversaciones')+'</b><span>'+(needle||data.channelView!=='all'?'Prueba otro nombre o cambia el filtro.':'Crea un canal o inicia un mensaje directo.')+'</span></div>':'')+'</aside><section class="card chat-conversation" aria-label="Conversación del equipo"><div class="note warn" data-chat-error role="alert" '+(data.error?'':'hidden')+'>'+esc(data.error)+'</div>'+
   (!c?'<div class="empty"><strong>'+(data.error?'No se pudieron cargar los canales':data.loaded?'Elige un canal':'Cargando canales…')+'</strong><span>Organiza conversaciones y tareas por tienda.</span>'+(data.error?button('Reintentar','refresh'):'')+'</div>':
   '<header class="chat-heading"><div>'+button('← Canales','mobile-channels','','secondary chat-mobile-navigation')+'<h2>'+esc(c.name)+'</h2><p title="'+esc(c.description||c.group_name)+'">'+esc(c.description||c.group_name)+(c.is_private?' · Solo miembros':' · Canal abierto al equipo')+(c.archived?' · Archivado':'')+'</p></div><div class="inline-actions chat-channel-tools">'+button(data.query||data.from||data.to||data.mode!=='all'?'Buscar · filtros activos':'Buscar','search-toggle','id="chatSearchToggle" aria-expanded="'+data.searchOpen+'" aria-controls="chatSearchPanel"')+button('Actualizar','refresh','title="Actualizar conversación"')+menu('channel','Opciones del canal',(joined?button('Miembros','members')+button('Organizar y avisos','preferences')+button('Marcar leído','read')+button(c.muted?'Activar avisos':'Silenciar','mute'):'')+(manager()?button('Configurar canal','settings'):''),'⚙')+'</div></header>'+
   (!joined?'<div class="empty"><strong>Únete para leer y participar</strong>'+button('Unirme al canal','join','','primary')+'</div>':
   '<div class="chat-search" id="chatSearchPanel" '+(data.searchOpen?'':'hidden')+'><label>Buscar<input id="chatQuery" maxlength="200" value="'+esc(data.filterDraft?.query??data.query)+'" placeholder="Mensaje o persona"></label><label>Desde<input id="chatFrom" type="date" value="'+esc(data.filterDraft?.from??data.from)+'"></label><label>Hasta<input id="chatTo" type="date" value="'+esc(data.filterDraft?.to??data.to)+'"></label><label>Mostrar<select id="chatMode"><option value="all">Todos</option><option value="pinned" '+((data.filterDraft?.mode??data.mode)==='pinned'?'selected':'')+'>Fijados</option><option value="tasks" '+((data.filterDraft?.mode??data.mode)==='tasks'?'selected':'')+'>Tareas</option><option value="mentions" '+((data.filterDraft?.mode??data.mode)==='mentions'?'selected':'')+'>Menciones</option></select></label>'+button('Buscar','search','','primary')+button('Limpiar','clear')+'</div>'+
   (data.parent?'<div class="chat-thread-bar">'+button('← Conversación principal','thread-back')+'<b>Respuestas al mensaje</b></div>':'')+
   '<div class="chat-scroll-tools" aria-label="Recorrer mensajes">'+(data.hasNew?button('Mensajes nuevos · Ver al final','scroll-bottom','','primary'):'')+button('↑ Subir','scroll-top')+button('↓ Ir al final','scroll-bottom')+'</div><div class="chat-messages" tabindex="0" role="log" aria-label="Mensajes" aria-live="polite" aria-relevant="additions">'+(data.more?button('Cargar anteriores','older'):'')+data.messages.map((m,index)=>(index===0||messageDay(m.created_at)!==messageDay(data.messages[index-1].created_at)?'<div class="chat-day-divider"><span>'+esc(dayLabel(m.created_at))+'</span></div>':'')+messageHtml(m)).join('')+(!data.messages.length?'<div class="empty"><strong>'+(data.loadingChannel?'Cargando mensajes…':'Sin mensajes')+'</strong><span>'+(data.loadingChannel?'Un momento, estamos recuperando la conversación.':data.query||data.from||data.to||data.mode!=='all'?'Prueba otros filtros.':'Escribe el primer mensaje del canal.')+'</span></div>':'')+'</div>'+
   (editable?'<form class="chat-compose" data-draft-key="'+esc(draftKey())+'"><label for="chatBody">'+(data.parent?'Responder en esta conversación':'Mensaje para '+esc(c.name))+'</label><textarea id="chatBody" rows="3" maxlength="12000" placeholder="Escribe aquí. Enter añade una línea; Ctrl+Enter envía.">'+esc(drafts.get(draftKey())||'')+'</textarea><div class="chat-compose-tools">'+button('☺','emoji','aria-label="Insertar emoji" title="Insertar emoji"')+'<label class="chat-pick-btn">Adjuntar archivos<input type="file" id="chatFiles" multiple accept="'+acceptFiles+'"></label><label>Mencionar<select id="chatMention"><option value="">Elige una persona</option>'+data.members.map(member=>'<option value="'+esc(member.email)+'">'+esc(person(member.email))+'</option>').join('')+'</select></label></div><div class="chat-picked-list">'+pickedFilesHtml()+'</div><div data-chat-progress role="status" aria-live="polite"></div>'+
    (outbox.some(p=>p.channel_id===data.channel||!p.channel_id)?'<div class="note warn">Hay archivos pendientes de subir. '+button('Reintentar archivos pendientes','uploads-retry')+'</div>':'')+
    '<div><small>Hasta 10 archivos · 20 MB por archivo · arrastrar o pegar también funciona.</small><button class="btn primary" type="submit" '+(busy?'disabled':'')+'>Enviar</button><button class="btn secondary" type="submit" name="request_chatgpt" '+(busy?'disabled':'')+'>Enviar y pedir a ChatGPT</button></div></form>':'<p class="chat-banner">'+(c.archived?'Canal archivado: disponible para consulta.':'Tu permiso permite consultar esta conversación.')+'</p>')))+
   '</section></div>';
  for(const key of openMenus){const el=[...host.querySelectorAll('details[data-chat-menu]')].find(el=>el.dataset.chatMenu===key);if(el)el.open=true;}
  const replacement=host.querySelector('.chat-compose');
  if(composer&&replacement&&composerKey===draftKey()&&!busy){
   // Retain the editor node, selection and resize while refreshing dynamic controls.
   const editor=composer.querySelector('#chatBody');
   replacement.querySelector('#chatBody')?.replaceWith(editor);
  }
  if(focusId){const next=host.querySelector('#'+focusId);if(next){next.focus({preventScroll:true});if(typeof start==='number'&&next.setSelectionRange&&next.type!=='date')next.setSelectionRange(start,end);}}
  const pane=host.querySelector('.chat-messages');if(pane)pane.scrollTop=atEnd?pane.scrollHeight:scroll;
  scheduleRead();
 }
 async function refresh({older=false,preserveHistory=false}={}){
  const token=++generation,channel=data.channel,parent=data.parent;
  const previousPane=host?.querySelector('.chat-messages'),previousHeight=previousPane?.scrollHeight||0,previousTop=previousPane?.scrollTop||0;
  const before=older&&data.messages.length?Math.min(...data.messages.map(m=>m.seq)):null;
  const result=await rpc('totus_chat_context',{p_channel:current()?.member_role?channel:null,p_parent:parent,p_before:before,p_query:data.query,p_from:data.from||null,p_to:data.to||null,p_mode:data.mode});
  if(token!==generation||!host||owner!==actor())return;
  const previous=JSON.stringify([data.channels,data.messages,data.members,data.loaded,data.error,data.more,data.layout,data.hasNew]);
  const batch=result.messages||[],more=batch.length>50,rows=more?batch.slice(1):batch;
  data.channels=result.channels||[];data.members=result.members||[];data.directory=result.directory||data.directory;data.layout=chatLayout(result.layout);data.loaded=true;data.error='';onUnread(data.channels.filter(c=>c.channel_kind!=='assistant'));
  if(channel&&preserveHistory){const known=new Set(data.messages.map(m=>m.id)),latest=new Map(rows.map(m=>[m.id,m]));data.hasNew=data.hasNew||rows.some(m=>!known.has(m.id)&&Number(m.seq)>Math.max(0,...data.messages.map(m=>Number(m.seq))));data.messages=data.messages.map(m=>latest.get(m.id)||m);}
  else if(channel){data.hasNew=false;data.more=more;data.messages=older?[...new Map([...rows,...data.messages].map(m=>[m.id,m])).values()].sort((a,b)=>a.seq-b.seq):rows;}
  if(previous!==JSON.stringify([data.channels,data.messages,data.members,data.loaded,data.error,data.more,data.layout,data.hasNew]))paint();
  if(older){const pane=host?.querySelector('.chat-messages');if(pane)pane.scrollTop=previousTop+pane.scrollHeight-previousHeight;}
  scheduleRead();
 }
 async function open(id){
  const openingId=++opening,s=scope();
  remember();unsubscribe();unsubscribe=()=>{};clearTimeout(realtimeTimer);
  data.mobileNavigation=false;data.channel=id;data.parent=null;data.messages=[];data.more=false;data.query='';data.from='';data.to='';data.mode='all';data.filterDraft=null;data.hasNew=false;data.loadingChannel=true;paint();
  try{await refresh();}finally{if(active(s)&&openingId===opening){data.loadingChannel=false;paint();}}
  if(!active(s)||openingId!==opening||data.channel!==id)return;
  unsubscribe=subscribe(id,()=>{clearTimeout(realtimeTimer);realtimeTimer=setTimeout(tick,300);});
 }
 function closeDialog(){dialog?.close();dialog?.remove();dialog=null;}
 async function requestDialogClose(){const held=dialog;if(!held)return;if(held.querySelector('[data-dirty="true"]')&&!await ask('¿Descartar los cambios de esta ventana?'))return;if(dialog===held)closeDialog();}
 function modal(title,body,save){
  closeDialog();
  dialog=document.createElement('dialog');dialog.className='chat-dialog';
  dialog.innerHTML='<form><header><h2>'+esc(title)+'</h2><button type="button" class="btn secondary" data-chat-close aria-label="Cerrar">×</button></header><div class="chat-dialog-body">'+body+'</div><p role="alert" data-dialog-error hidden></p><footer>'+(save?.label==='Cerrar'?'':button('Cancelar','dialog-cancel'))+'<button class="btn primary" type="submit">'+esc(save?.label||'Guardar')+'</button></footer></form>';
  host.append(dialog);dialog.querySelector('[data-chat-close]').onclick=requestDialogClose;
  const cancel=dialog.querySelector('[data-chat="dialog-cancel"]');if(cancel)cancel.onclick=requestDialogClose;
  dialog.addEventListener('input',event=>event.target.dataset.dirty='true');
  dialog.addEventListener('cancel',event=>{event.preventDefault();requestDialogClose().catch(showError);});
  dialog.addEventListener('submit',async event=>{
   const stamp=lifecycle;
   event.preventDefault();if(busy)return;busy=true;
   const values=Object.fromEntries(new FormData(event.target));
   const controls=[...dialog.querySelectorAll('button,input,select,textarea')];controls.forEach(c=>c.disabled=true);
   try{await save.run(values);closeDialog();if(save.refresh!==false)await refresh();}
   catch(error){if(error?.contextChanged)return;const box=dialog?.querySelector('[data-dialog-error]');if(box){box.textContent=error.message;box.hidden=false;}else showError(error);}
   finally{unlock(stamp);controls.forEach(c=>c.disabled=false);}
  });
  dialog.showModal();
 }
 function channelForm(c={}){
  const identity=chatChannelIdentity(c.name||'');
  const storeList=[...(stores()||[])];if(c.store_id&&!storeList.some(store=>store.id===c.store_id))storeList.push({id:c.store_id,name:'Tienda vinculada'});
  const options=[...new Set([...CHAT_GROUPS.filter(g=>g!=='Mensajes directos'),...data.channels.map(ch=>ch.group_name),...(data.layout.extra_groups||[])])];
  return '<fieldset class="chat-form-section"><legend>Identificación</legend><label>Icono del canal<select name="icon">'+CHAT_CHANNEL_ICONS.map(([value,label])=>'<option value="'+value+'" '+(identity.icon===value?'selected':'')+'>'+esc((value?value+' ':'')+label)+'</option>').join('')+'</select></label><label>Nombre del canal<input name="name" required maxlength="80" value="'+esc(identity.name)+'" placeholder="Por ejemplo: Pedidos pendientes"></label><label>Descripción<textarea name="description" maxlength="500" rows="2" placeholder="Para qué se usa este canal">'+esc(c.description)+'</textarea></label></fieldset><fieldset class="chat-form-section"><legend>Organización y acceso</legend><label>Sección<input name="group_name" required maxlength="80" value="'+esc(c.group_name||'Equipo')+'" list="chatGroupOptions"><datalist id="chatGroupOptions">'+options.map(g=>'<option value="'+esc(g)+'">').join('')+'</datalist></label><label>Tienda<select name="store_id"><option value="">General · sin tienda concreta</option>'+storeList.filter(store=>store.active!==false||store.id===c.store_id).map(store=>'<option value="'+esc(store.id)+'" '+(store.id===c.store_id?'selected':'')+'>'+esc(store.name)+'</option>').join('')+'</select></label><label>Quién puede acceder<select name="is_private"><option value="false">Abierto · el equipo puede unirse</option><option value="true" '+(c.is_private?'selected':'')+'>Privado · solo las personas invitadas</option></select></label><p class="small muted">Los canales privados requieren invitación desde Miembros. Mover un canal en tu lista no cambia quién puede leerlo.</p>'+(c.id?'<label>Estado<select name="archived"><option value="false">Activo</option><option value="true" '+(c.archived?'selected':'')+'>Archivado · solo lectura</option></select></label>':'')+'</fieldset>';
 }
 async function send(event){
  const stamp=lifecycle;
  event.preventDefault();if(busy)return;
  const requestChatGPT=event.submitter?.name==='request_chatgpt';
  remember();const key=draftKey(),submittedDraft=drafts.get(key)||'',selected=[...(picks.get(key)||[])],body=chatText(submittedDraft.trim()||(selected.length?'Documentos adjuntos':'')),channel=data.channel,parent=data.parent,sendingOwner=owner;
  const previous=pending.get(key),client_id=previous?.body===body?previous.client_id:crypto.randomUUID();
  pending.set(key,{body,client_id});busy=true;paint();
  try{
   const saved=await command('send',{channel_id:channel,parent_id:parent,body,client_id,expected_files:selected.length});
   if(owner!==sendingOwner)return;
   // A slow acknowledgement owns only the draft and attachments it submitted.
   remember();
   if(drafts.get(key)===submittedDraft)drafts.delete(key);
   const remaining=(picks.get(key)||[]).filter(item=>!selected.some(sent=>sent.client_id===item.client_id));
   if(remaining.length)picks.set(key,remaining);else picks.delete(key);
   pending.delete(key);
   const area=host?.querySelector('#chatBody');if(area?.closest('.chat-compose')?.dataset.draftKey===key&&area.value===submittedDraft)area.value='';
   outbox.push(...selected.map(item=>({...item,channel_id:channel,message_id:saved.id})));
   if(selected.length)await uploadPending(saved.id);
   if(requestChatGPT){try{await requestAgent(saved.id,channel);}catch(error){throw new Error('El mensaje está guardado, pero la solicitud no se ha creado: '+error.message);}}
   await refresh();
  }catch(error){if(error?.contextChanged)return;try{await refresh();}catch{}showError(error);}
  finally{unlock(stamp);}
 }
 async function requestAgent(messageId,channelId=data.channel){
  const channel=data.channels.find(c=>c.id===channelId);
  if(channel?.is_private&&channelId===data.channel&&!data.members.some(m=>m.email==='chatgpt@totuscentral.invalid'))throw new Error('Invita a ChatGPT desde Miembros de este canal privado y vuelve a pulsar Pedir a ChatGPT.');
  return command('agent_request',{channel_id:channelId,message_id:messageId});
 }
 function selectCreated(c,role){
  remember();data.channelView='all';data.archived=false;data.query='';data.from='';data.to='';data.mode='all';data.filterDraft=null;data.more=false;
  data.mobileNavigation=false;data.channels=[...data.channels.filter(row=>row.id!==c.id),{...c,member_role:role}];data.channel=c.id;data.parent=null;data.messages=[];
  unsubscribe();unsubscribe=subscribe(c.id,()=>{clearTimeout(realtimeTimer);realtimeTimer=setTimeout(tick,300);});paint();
 }

 async function saveLayout(layout){
  const saved=await rpc('totus_chat_save_layout',{p_layout:layout});data.layout=chatLayout(saved);paint();
 }
 function groupMenu(name){
  const groups=chatGroups(data.channels,data.layout),at=groups.findIndex(g=>g.name===name),label=data.layout.group_labels?.[name]||name,hidden=(data.layout.hidden_groups||[]).includes(name);
  modal('Organizar '+label,'<p class="muted">Estas preferencias cambian tu organización personal y se guardan en tu cuenta.</p><div class="chat-section-actions">'+
   ['create','rename','alpha','recent','manual','up','down','hide',...((data.layout.extra_groups||[]).includes(name)&&!groups[at].channels.length?['remove']:[])].filter(action=>action!=='create'||can('create')).map(action=>'<button type="button" class="btn secondary" data-section-action="'+action+'" '+((action==='up'&&at===0||action==='down'&&at===groups.length-1)?'disabled':'')+'>'+esc({create:'Crear canal en esta sección',rename:'Cambiar nombre solo para mí',alpha:'Ordenar canales alfabéticamente',recent:'Ordenar por mensajes más recientes',manual:'Usar posición personal de cada canal',up:'Subir sección',down:'Bajar sección',hide:hidden?'Mostrar sección':'Ocultar sección',remove:'Eliminar sección vacía'}[action])+'</button>').join('')+'</div>',{label:'Cerrar',run:async()=>{}});
  dialog.querySelectorAll('[data-section-action]').forEach(el=>el.onclick=async()=>{
   const stamp=lifecycle;
   const action=el.dataset.sectionAction;
   if(action==='create'){modal('Nuevo canal',channelForm({group_name:name}),{label:'Crear canal',run:async v=>selectCreated(await command('create_channel',chatChannelInput({...v,is_private:v.is_private==='true'})),'manager')});return;}
   if(action==='rename'){modal('Nombre de la sección','<p class="muted">Solo cambia el nombre que tú ves. Los canales y los demás usuarios conservan su organización.</p><label>Nombre<input name="label" maxlength="80" required value="'+esc(label)+'"></label>',{refresh:false,run:async v=>saveLayout({...data.layout,group_labels:{...data.layout.group_labels,[name]:chatText(v.label,80)}})});return;}
   if(busy)return;busy=true;
   try{
    if(['alpha','recent','manual'].includes(action))await saveLayout({...data.layout,group_sort:{...data.layout.group_sort,[name]:action==='alpha'?'alphabetical':action}});
    if(action==='up'||action==='down'){
     const order=groups.map(g=>g.name),to=at+(action==='up'?-1:1);
     if(to>=0&&to<order.length){[order[at],order[to]]=[order[to],order[at]];await saveLayout({...data.layout,group_order:order});}
    }
    if(action==='remove'){if(groups[at].channels.length)throw Error('Mueve primero los canales a otra sección.');const next={...data.layout};for(const key of ['extra_groups','group_order','collapsed_groups','hidden_groups'])next[key]=(next[key]||[]).filter(value=>value!==name);for(const key of ['group_labels','group_sort']){next[key]={...next[key]};delete next[key][name];}await saveLayout(next);}
    if(action==='hide')await saveLayout({...data.layout,hidden_groups:hidden?(data.layout.hidden_groups||[]).filter(g=>g!==name):[...new Set([...(data.layout.hidden_groups||[]),name])]});
    closeDialog();
   }catch(error){showError(error);}finally{unlock(stamp);}
  });
 }
 async function openMessage(channelId,messageId,parentId=null){
  data.channelView='all';data.channelQuery='';
  await open(channelId);
  if(parentId||!data.messages.some(message=>message.id===messageId)){data.parent=parentId||messageId;data.messages=[];await refresh();}
  const selected=[...host.querySelectorAll('[data-message]')].find(node=>node.dataset.message===messageId);
  if(selected){selected.classList.add('chat-message-selected');selected.setAttribute('tabindex','-1');selected.scrollIntoView({block:'center'});selected.focus({preventScroll:true});}
 }
 async function handle(event){
  const stamp=lifecycle;
  if(event.target.closest('dialog'))return;
  const summary=event.target.closest('details[data-chat-menu]>summary');if(summary){host.querySelectorAll('details[data-chat-menu][open]').forEach(menu=>{if(menu!==summary.parentElement)menu.open=false;});return;}
  if(!event.target.closest('details[data-chat-menu]'))host.querySelectorAll('details[data-chat-menu][open]').forEach(menu=>menu.open=false);
  const el=event.target.closest('[data-chat]');if(!el)return;const action=el.dataset.chat,id=el.dataset.id;
  if(busy)return;
  el.closest('details[data-chat-menu]')?.removeAttribute('open');
  try{
   const m=data.messages.find(m=>m.id===id);
   if(action==='mobile-channels'){data.mobileNavigation=true;paint();host.querySelector('#chatChannelQuery')?.focus();return;}
   if(action==='shortcuts'){
    modal('Atajos y ayuda','<dl class="chat-shortcuts"><dt>Ctrl / ⌘ + Enter</dt><dd>Enviar el mensaje.</dd><dt>Shift + Enter o Enter</dt><dd>Añadir una línea.</dd><dt>Alt + /</dt><dd>Buscar en este canal.</dd><dt>Escape</dt><dd>Cerrar una ventana; se preguntará antes de descartar cambios.</dd></dl><p>Usa Citar para contestar en el canal sin abrir un hilo. «Enviar y pedir a ChatGPT» guarda primero el mensaje y sus archivos y después crea la solicitud. Avisa a vuestro ChatGPT habitual para que la atienda; no se activa automáticamente.</p>',{label:'Cerrar',refresh:false,run:async()=>{}});return;
   }
   if(action==='search-toggle'){data.searchOpen=!data.searchOpen;paint();host.querySelector(data.searchOpen?'#chatQuery':'#chatSearchToggle')?.focus();return;}
   if(action==='emoji'){
    modal('Insertar emoji','<div class="chat-emoji-grid">'+['😀','😊','👍','✅','👀','❤️','🎉','📦','🧾','💶','📌','⚠️','❓','🏪','📅','🙌'].map(emoji=>'<button type="button" class="btn secondary" data-emoji-insert="'+emoji+'" aria-label="Insertar '+emoji+'">'+emoji+'</button>').join('')+'</div>',{label:'Cerrar',refresh:false,run:async()=>{}});
    dialog.querySelectorAll('[data-emoji-insert]').forEach(btn=>btn.onclick=()=>{const area=host.querySelector('#chatBody');if(!area)return;if(area.value.length+btn.dataset.emojiInsert.length>12000)return;area.setRangeText(btn.dataset.emojiInsert,area.selectionStart,area.selectionEnd,'end');remember();closeDialog();area.focus();});return;
   }
   if(action==='quote'){
    const area=host.querySelector('#chatBody');if(!area||!m||m.deleted_at)return;
    const quote='> '+person(m.author_email)+': '+String(m.body).slice(0,2000).replace(/\n/g,'\n> ')+'\n\n';
    if(area.value.length-(area.selectionEnd-area.selectionStart)+quote.length>12000)throw new Error('La cita no cabe en el mensaje. Acorta el borrador antes de citar.');
    area.setRangeText(quote,area.selectionStart,area.selectionEnd,'end');remember();area.focus();return;
   }
   if(action==='sidebar-toggle'){busy=true;await saveLayout({...data.layout,compact_sidebar:!data.layout.compact_sidebar});return;}
   if(action==='group-toggle'){const name=el.dataset.group,closed=data.layout.collapsed_groups||[],wasClosed=!data.channelQuery&&closed.includes(name);data.channelQuery='';busy=true;await saveLayout({...data.layout,collapsed_groups:wasClosed?closed.filter(g=>g!==name):[...new Set([...closed,name])]});return;}
   if(action==='group-menu'){groupMenu(el.dataset.group);return;}
   if(action==='section-new'){modal('Nueva sección','<label>Nombre<input name="name" maxlength="80" required></label><p class="muted">Organiza tus canales sin cambiar datos o permisos.</p>',{label:'Crear sección',refresh:false,run:async v=>{const name=chatText(v.name,80);if(chatGroups(data.channels,data.layout).some(g=>chatSearchText(g.name)===chatSearchText(name)))throw Error('Ya existe una sección con ese nombre.');data.channelView='all';data.channelQuery='';data.archived=false;await saveLayout({...data.layout,extra_groups:[...new Set([...(data.layout.extra_groups||[]),name])]});}});return;}
   if(action==='new'){modal('Nuevo canal',channelForm(),{label:'Crear canal',run:async v=>{const c=await command('create_channel',chatChannelInput({...v,is_private:v.is_private==='true'}));selectCreated(c,'manager');}});return;}
   if(action==='direct'){
    modal('Nuevo mensaje directo','<label>Persona<select name="email" required><option value="">Elige una persona</option>'+data.directory.filter(p=>p.email!==owner).map(p=>'<option value="'+esc(p.email)+'">'+esc(p.name)+'</option>').join('')+'</select></label>',{label:'Abrir conversación',run:async v=>selectCreated(await command('create_direct',{email:v.email}),'member')});return;
   }
   if(action==='alerts'){
    modal('Sonido y avisos','<fieldset class="chat-form-section"><legend>Mis avisos de Chat</legend><label>Sonido<select name="sound_enabled"><option value="false">Desactivado</option><option value="true" '+(data.layout.sound_enabled?'selected':'')+'>Activado</option></select></label><label>Avisos de escritorio · Windows<select name="desktop_enabled"><option value="false">Desactivados</option><option value="true" '+(data.layout.desktop_enabled?'selected':'')+'>Activados</option></select></label><p>'+esc(chatDesktopStatus())+'</p><div class="inline-actions"><button type="button" class="btn secondary" data-test-sound>Probar sonido</button><button type="button" class="btn secondary" data-test-desktop>Probar aviso</button></div><p data-alert-test role="status"></p></fieldset><p class="small muted">Se guarda en tu cuenta. Cada ordenador necesita permitir las notificaciones y el sonido. Deja Totus abierto; con la ventana cerrada no llegan avisos. Windows puede silenciarlos con No molestar. Se respetan los canales silenciados y Solo menciones. No avisamos de mensajes antiguos ni de la conversación que estás leyendo al final.</p>',{refresh:false,run:async v=>{
     // Start permission/audio requests within the submit gesture, before network writes.
     const soundReady=v.sound_enabled==='true'?prepareChatSound():Promise.resolve();
     const desktopReady=v.desktop_enabled==='true'?requestChatDesktopPermission():Promise.resolve();
     await Promise.all([soundReady,desktopReady]);
     await saveLayout({...data.layout,sound_enabled:v.sound_enabled==='true',desktop_enabled:v.desktop_enabled==='true'});onAlerts(data.layout);
    }});
    const held=dialog,status=held.querySelector('[data-alert-test]');
    held.querySelector('[data-test-sound]').onclick=async()=>{try{await prepareChatSound();await playChatSound();status.textContent='Sonido de prueba emitido. Comprueba también el volumen del equipo.';}catch(e){status.textContent=e.message;}};
    held.querySelector('[data-test-desktop]').onclick=async()=>{try{await requestChatDesktopPermission();const note=new Notification('Totus Central · Prueba de aviso',{body:'Los avisos de Chat están permitidos en este navegador.',tag:'totus-chat-test',silent:true});note.onclick=()=>{window.focus();note.close();};status.textContent='Aviso enviado a Windows. Si no aparece, revisa No molestar y los permisos del navegador.';}catch(e){status.textContent=e.message;}};return;
   }
   if(action==='preferences'){
    const c=current();
    modal('Preferencias del canal','<label>Sección personal<select name="personal_group">'+chatGroups(data.channels,{...data.layout,extra_groups:[...new Set([...CHAT_GROUPS,...data.channels.map(c=>c.group_name),...(data.layout.extra_groups||[])])]}).map(g=>'<option value="'+esc(g.name)+'" '+((data.layout.channel_groups?.[c.id]||c.group_name)===g.name?'selected':'')+'>'+esc(g.label)+'</option>').join('')+'</select></label><label>Avisos<select name="notify_level"><option value="all">Todos los mensajes</option><option value="mentions" '+(c.notify_level==='mentions'?'selected':'')+'>Solo menciones</option><option value="none" '+(c.notify_level==='none'||c.muted?'selected':'')+'>Sin avisos</option></select></label><label>Favorito<select name="favourite"><option value="false">No</option><option value="true" '+(c.favourite?'selected':'')+'>Sí</option></select></label><label>Posición en su grupo<input name="sort_order" type="number" step="1" min="-100000" max="100000" value="'+Number(c.sort_order||0)+'"></label><label>Mostrar conversación<select name="hidden"><option value="false">Visible</option><option value="true" '+(c.hidden?'selected':'')+'>Oculta · disponible en archivados</option></select></label><label>Aviso del navegador<select name="desktop_enabled"><option value="false">Desactivado</option><option value="true" '+(c.desktop_enabled?'selected':'')+'>Activado con mi permiso</option></select></label><p class="small muted">Los avisos del navegador funcionan mientras Totus esté abierto. Cada equipo necesita su propio permiso. El ajuste general de Sonido y avisos tiene prioridad sobre este aviso adicional por canal. Los mensajes siempre se conservan aunque cierres la herramienta.</p>',{run:async v=>{
     if(v.desktop_enabled==='true'){
      if(!globalThis.Notification)throw new Error('Este navegador no admite esos avisos.');
      const permission=Notification.permission==='default'?await Notification.requestPermission():Notification.permission;
      if(permission!=='granted')throw new Error('El navegador no ha autorizado los avisos. Puedes guardar la preferencia desactivada.');
     }
     const groupIds=chatGroups(data.channels,data.layout).find(g=>g.name===(data.layout.channel_groups[c.id]||c.group_name))?.channels.map(ch=>ch.id)||[];
     await saveLayout({...data.layout,channel_order:Number(v.sort_order)!==Number(c.sort_order||0)?data.layout.channel_order.filter(id=>!groupIds.includes(id)):data.layout.channel_order,channel_groups:{...data.layout.channel_groups,[c.id]:chatText(v.personal_group,80)}});
     await command('member_preferences',{notify_level:v.notify_level,favourite:v.favourite==='true',hidden:v.hidden==='true',desktop_enabled:v.desktop_enabled==='true',sort_order:Number(v.sort_order)});
    }});return;
   }
   if(action==='inbox'){
    const inbox=(await rpc('totus_chat_inbox',{p_mentions:false})).filter(m=>m.channel_kind!=='assistant');
    modal('Mensajes sin leer',inbox.length?'<ul class="chat-inbox">'+inbox.map(item=>'<li><b>'+esc(item.channel_name)+'</b><small>'+esc(person(item.author_email))+' · '+esc(date(item.created_at))+'</small><p>'+esc(item.body.slice(0,180))+'</p>'+button('Abrir conversación','inbox-open','data-channel="'+esc(item.channel_id)+'" data-message="'+esc(item.id)+'" data-parent="'+esc(item.parent_id||'')+'"')+'</li>').join('')+'</ul>':'<p>No tienes mensajes pendientes de leer según tus preferencias.</p>',{label:'Cerrar',run:async()=>{}});
    dialog.querySelectorAll('[data-chat="inbox-open"]').forEach(btn=>btn.onclick=async()=>{const stamp=lifecycle,{channel,message,parent}=btn.dataset;closeDialog();busy=true;try{await openMessage(channel,message,parent);}catch(e){showError(e);}finally{unlock(stamp);}});return;
   }
   if(action==='attach'){fileDialog(null,id);return;}
   if(action==='file-retry'){const f=data.messages.flatMap(m=>m.files||[]).find(f=>f.id===el.dataset.file);fileDialog(f,f.message_id);return;}
   if(action==='settings'){
    const c=current();modal('Configurar canal',channelForm(c)+'<hr><p>Eliminar retira el canal del uso diario. Conserva documentos y registros contables.</p>'+button('Eliminar canal','retire','','danger'),{run:v=>command('channel_update',{...chatChannelInput({...v,is_private:v.is_private==='true'}),update_store:true,archived:v.archived==='true'})});
    const retireButton=dialog.querySelector('[data-chat="retire"]');if(retireButton)retireButton.onclick=async()=>{if(await ask('¿Retirar este canal? Sus mensajes quedarán conservados para recuperación.')){try{await command('channel_delete');closeDialog();data.channel=null;data.messages=[];await refresh();}catch(e){showError(e);}}};return;
   }
   if(action==='members'){
    const list=data.members.map(m=>'<li><span>'+esc(person(m.email))+'<small>'+esc(m.email)+'</small>'+'</span><small>'+esc(m.member_role==='manager'?'Responsable':'Miembro')+'</small></li>').join('');
    if(!manager()){modal('Miembros','<ul class="chat-members">'+list+'</ul>',{label:'Cerrar',run:async()=>{}});return;}
    modal('Miembros del canal','<ul class="chat-members">'+list+'</ul><label>Correo del usuario del equipo<input name="email" type="email" required list="chatTeamPeople"><datalist id="chatTeamPeople">'+data.directory.map(p=>'<option value="'+esc(p.email)+'">'+esc(p.name)+'</option>').join('')+'</datalist></label><label>Acción<select name="member_role"><option value="member">Añadir como miembro</option><option value="manager">Añadir como responsable</option><option value="remove">Retirar del canal</option></select></label>',{label:'Aplicar',run:async v=>{if(v.member_role==='remove'&&!await ask('¿Retirar a '+v.email+' del canal?'))return;await command(v.member_role==='remove'?'member_remove':'member_save',v);}});return;
   }
   if(action==='edit'){modal('Editar mensaje','<label>Mensaje<textarea name="body" required maxlength="12000" rows="5">'+esc(m.body)+'</textarea></label>',{run:v=>command('edit',{message_id:id,body:chatText(v.body),expected_edited_at:m.edited_at})});return;}
   if(action==='task'){if(onTask){await onTask(m,current());return;}modal('Gestionar tarea','<p>Marcar una tarea no registra una operación contable.</p><label>Estado<select name="task_state">'+Object.entries(CHAT_TASK_STATES).map(([key,name])=>'<option value="'+key+'" '+(m.task_state===key?'selected':'')+'>'+name+'</option>').join('')+'</select></label><label>Resultado y referencias<textarea name="task_result" maxlength="12000" rows="5">'+esc(m.task_result)+'</textarea></label>',{run:v=>command('task',{message_id:id,...v})});return;}
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
   if(action==='agent-request'||action==='agent-cancel'){if(action==='agent-request')await requestAgent(id);else await command('agent_cancel',{message_id:id});await refresh();return;}
   if(action==='open'){await open(id);return;}
   if(action==='thread'){remember();data.parent=id;data.messages=[];await refresh();return;}
   if(action==='thread-back'){remember();data.parent=null;data.messages=[];await refresh();return;}
   if(action==='join'){await command('join');await refresh();await refresh();return;}
   if(action==='search'){const range=chatDateRange(host.querySelector('#chatFrom').value,host.querySelector('#chatTo').value);data.query=host.querySelector('#chatQuery').value.trim();Object.assign(data,range,{mode:host.querySelector('#chatMode').value,filterDraft:null});await refresh();return;}
   if(action==='clear'){Object.assign(data,{query:'',from:'',to:'',mode:'all',filterDraft:null});await refresh();return;}
   if(action==='scroll-top'||action==='scroll-bottom'){if(action==='scroll-bottom'){const channel=data.channel;await refresh();if(data.channel!==channel)return;}const pane=host?.querySelector('.chat-messages');if(pane){pane.scrollTop=action==='scroll-top'?0:pane.scrollHeight;pane.focus({preventScroll:true});}return;}
   if(action==='older'){await refresh({older:true});return;}
   if(action==='read'){await command('read',{seq:current().last_seq||0});await refresh();return;}
   if(action==='mute'){await command('mute',{muted:!current().muted});await refresh();return;}
   if(action==='pin'){await command('pin',{message_id:id,pinned:!m.pinned});await refresh();return;}
   if(action==='reaction'){await command('reaction',{message_id:id,emoji:el.dataset.emoji});await refresh();return;}
   if(action==='message-delete'){if(await confirm('¿Eliminar este mensaje? No se eliminarán documentos ni operaciones contables.'))await command('message_delete',{message_id:id,expected_edited_at:m.edited_at});await refresh();return;}
   if(action==='refresh')await refresh();
  }catch(error){showError(error);}finally{unlock(stamp);}
 }
 const onSubmit=e=>{if(e.target.matches('.chat-compose'))send(e).catch(showError);};
 const rememberFilters=()=>{if(host?.querySelector('#chatQuery'))data.filterDraft={query:host.querySelector('#chatQuery').value,from:host.querySelector('#chatFrom').value,to:host.querySelector('#chatTo').value,mode:host.querySelector('#chatMode').value};};
 const onInput=e=>{if(e.target.closest('.chat-search'))rememberFilters();if(e.target.id==='chatBody')remember();if(e.target.id==='chatChannelQuery'){data.channelQuery=e.target.value;paint();}};
 const onChange=e=>{
  if(e.target.closest('.chat-search'))rememberFilters();
  if(e.target.id==='chatChannelView'){data.channelView=e.target.value;paint();}
  if(e.target.dataset.chatInput==='archived'){data.archived=e.target.checked;paint();}
  if(e.target.id==='chatFiles'){try{addFiles([...e.target.files]);}catch(error){showError(error);}}
  if(e.target.id==='chatMention'&&e.target.value){const area=host.querySelector('#chatBody');area.value+=(area.value?' ':'')+'@{'+e.target.value+'} ';remember();e.target.value='';area.focus();}
 };
 let draggedChannel=null;
 const onDragStart=e=>{const channel=e.target.closest('.chat-channel');if(!channel||busy)return;draggedChannel=channel.dataset.id;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/x-totus-channel',draggedChannel);};
 const onDragEnd=()=>{draggedChannel=null;};
 const onDrag=e=>{if(draggedChannel&&e.target.closest('.chat-channel')){e.preventDefault();e.dataTransfer.dropEffect='move';return;}if(e.target.closest('.chat-compose')&&e.dataTransfer?.types?.includes('Files')){e.preventDefault();}};
 const onDrop=async e=>{const target=e.target.closest('.chat-channel');if(draggedChannel&&target){e.preventDefault();const stamp=lifecycle,source=draggedChannel;onDragEnd();if(busy)return;busy=true;try{await saveLayout(chatMoveChannel(data.channels,data.layout,source,target.dataset.id));}catch(error){showError(error);}finally{unlock(stamp);}return;}if(e.target.closest('.chat-compose')&&e.dataTransfer?.files?.length){e.preventDefault();try{addFiles([...e.dataTransfer.files]);}catch(error){showError(error);}}};
 const onPaste=e=>{if(e.target.id==='chatBody'&&e.clipboardData?.files?.length){e.preventDefault();try{addFiles([...e.clipboardData.files]);}catch(error){showError(error);}}};
 const onKey=e=>{if(e.isComposing||e.keyCode===229)return;if(e.key==='Escape'&&!dialog){const menus=[...host.querySelectorAll('details[data-chat-menu][open]')];if(menus.length){e.preventDefault();menus.forEach(menu=>menu.open=false);menus.at(-1).querySelector('summary')?.focus();return;}}if(e.altKey&&e.key==='/'){e.preventDefault();data.searchOpen=true;paint();host.querySelector('#chatQuery')?.focus();return;}if(e.target.id==='chatBody'&&e.key==='Enter'&&(e.ctrlKey||e.metaKey)&&!e.shiftKey){e.preventDefault();send(e).catch(showError);}if(e.target.closest('.chat-search')&&e.key==='Enter'){e.preventDefault();host.querySelector('[data-chat="search"]').click();}};
 const onCompositionStart=()=>{composing=true;};
 const onCompositionEnd=()=>{composing=false;remember();paint();};
 const beforeUnload=e=>{if(hasDraft()){e.preventDefault();e.returnValue='';}};
 async function tick(){
  if(!host||busy||dialog||document.visibilityState!=='visible'||host.contains(document.activeElement)&&document.activeElement.id!=='chatBody'&&document.activeElement.matches('input,textarea,select'))return;
  const pane=host.querySelector('.chat-messages'),readingAbove=pane&&pane.scrollHeight-pane.clientHeight-pane.scrollTop>80;
  try{await refresh({preserveHistory:data.messages.length>50||readingAbove});}catch(error){showError(error);}
 }
 function dispose(){
  remember();opening++;generation++;lifecycle++;busy=false;composing=false;unsubscribe();unsubscribe=()=>{};clearTimeout(realtimeTimer);clearTimeout(readTimer);readFlight=null;clearInterval(timer);timer=null;closeDialog();
  if(host){host.removeEventListener('scroll',onReadScroll,true);host.removeEventListener('click',handle);host.removeEventListener('submit',onSubmit);host.removeEventListener('input',onInput);host.removeEventListener('change',onChange);host.removeEventListener('keydown',onKey);host.removeEventListener('compositionstart',onCompositionStart);host.removeEventListener('compositionend',onCompositionEnd);host.removeEventListener('dragstart',onDragStart);host.removeEventListener('dragend',onDragEnd);host.removeEventListener('dragover',onDrag);host.removeEventListener('drop',onDrop);host.removeEventListener('paste',onPaste);}
  window.removeEventListener('beforeunload',beforeUnload);window.removeEventListener('focus',onVisible);document.removeEventListener('visibilitychange',onVisible);host=null;
 }
 return {hasDraft,dispose,openMessage,isReading(message){const pane=host?.querySelector('.chat-messages');return !!pane&&pane.getClientRects().length>0&&document.visibilityState==='visible'&&document.hasFocus()&&data.channel===message.channel_id&&!data.query&&!data.from&&!data.to&&data.mode==='all'&&(!message.parent_id&&!data.parent||message.parent_id===data.parent)&&pane.scrollHeight-pane.clientHeight-pane.scrollTop<40&&!dialog;},reset(){dispose();data=initial();drafts.clear();pending.clear();picks.clear();outbox=[];owner='';},async mount(element){
  dispose();if(owner!==actor()){owner=actor();data=initial();drafts.clear();pending.clear();picks.clear();outbox=[];}
  host=element;host.addEventListener('scroll',onReadScroll,true);host.addEventListener('click',handle);host.addEventListener('submit',onSubmit);host.addEventListener('input',onInput);host.addEventListener('change',onChange);host.addEventListener('keydown',onKey);host.addEventListener('compositionstart',onCompositionStart);host.addEventListener('compositionend',onCompositionEnd);host.addEventListener('dragstart',onDragStart);host.addEventListener('dragend',onDragEnd);host.addEventListener('dragover',onDrag);host.addEventListener('drop',onDrop);host.addEventListener('paste',onPaste);
  window.addEventListener('beforeunload',beforeUnload);window.addEventListener('focus',onVisible);document.addEventListener('visibilitychange',onVisible);paint();try{await refresh();}catch(error){showError(error);paint();}if(host===element)timer=setInterval(tick,15000);
 }};
}
