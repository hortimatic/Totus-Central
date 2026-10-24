import {PDFDocument} from 'pdf-lib';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const pdf=await PDFDocument.create();pdf.addPage([300,300]).drawText('Totus Central - prueba de adjunto');const pdfBytes=await pdf.save();
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
await mkdir('artifacts',{recursive:true});
try{
 await page.goto('http://127.0.0.1:4173/tests/chat-harness.html');
 await page.evaluate(async()=>{
  const {createTeamChat}=await import('../src/team-chat-ui.js');
  const {chatFileMetadata}=await import('../src/chat-files.js');
  window.qaChat={channels:[{id:'h',name:'Cajas · Hortimatic',group_name:'Hortimatic',description:'Vape y Head',member_role:'manager',is_private:true,unread:2,last_seq:2},{id:'n',name:'Cajas · NewOldSmok',group_name:'NewOldSmok',member_role:'manager',last_seq:0}],
   messages:[{id:'m1',seq:1,channel_id:'h',author_email:'tienda@example.invalid',body:'Vape 139,36 · Head 161,97\nTarjeta 347,75 · Salida 150,00',created_at:'2026-10-24T12:07:00Z',replies:0,reactions:[]},{id:'m2',seq:2,channel_id:'h',author_email:'admin@example.invalid',body:'<script>window.qaUnsafe=true</script> Revisión de cajas',created_at:'2026-10-24T12:08:00Z',replies:0,reactions:[]}],members:[{email:'admin@example.invalid',member_role:'manager'}],calls:[],owner:'admin@example.invalid',seq:2,failInitial:true};
  const q=window.qaChat;q.directory=[{email:'admin@example.invalid',name:'Administración'},{email:'companero@example.invalid',name:'Compañero'},{email:'tienda@example.invalid',name:'Equipo de tienda'}];q.files=[];
  const rpc=async(name,p)=>{
   q.calls.push({name,p:structuredClone(p)});
   if(name==='totus_chat_context'){
    if(q.failInitial){q.failInitial=false;throw Error('Sin conexión inicial. Reintenta.');}
    let rows=q.messages.filter(m=>m.channel_id===p.p_channel);
    if(p.p_parent)rows=rows.filter(m=>m.id===p.p_parent||m.parent_id===p.p_parent);
    else if(!p.p_query&&p.p_mode==='all')rows=rows.filter(m=>!m.parent_id);
    if(p.p_query)rows=rows.filter(m=>m.body.toLowerCase().includes(p.p_query.toLowerCase()));
    if(p.p_from)rows=rows.filter(m=>m.created_at.slice(0,10)>=p.p_from);
    if(p.p_to)rows=rows.filter(m=>m.created_at.slice(0,10)<=p.p_to);
    if(p.p_mode==='pinned')rows=rows.filter(m=>m.pinned);
    if(p.p_mode==='tasks')rows=rows.filter(m=>m.task_state);
    if(p.p_before)rows=rows.filter(m=>m.seq<p.p_before);
    return structuredClone({channels:q.channels,messages:rows.slice(-51),members:q.members,directory:q.directory,layout:q.layout||{}});
   }
   if(name==='totus_chat_save_layout'){q.layout=structuredClone(p.p_layout);return q.layout;}
   if(name==='totus_chat_inbox')return structuredClone(q.messages.filter(m=>m.author_email!==q.owner&&!m.deleted_at&&m.seq>(q.channels.find(c=>c.id===m.channel_id)?.last_read_seq||0)&&!q.channels.find(c=>c.id===m.channel_id)?.muted).map(m=>({...m,channel_name:q.channels.find(c=>c.id===m.channel_id).name,desktop_enabled:true})));
   if(name==='totus_chat_file_remove'){q.files.find(f=>f.id===p.p_id).deleted_at=new Date().toISOString();q.messages.forEach(m=>m.files=(m.files||[]).filter(f=>f.id!==p.p_id));return {};}
   if(name!=='totus_chat_command')throw Error('Unexpected accounting operation '+name);
   const d=p.p_data,c=q.channels.find(c=>c.id===d.channel_id),m=q.messages.find(m=>m.id===d.message_id);
   if(p.p_action==='create_direct'||p.p_action==='create_assistant'){
    const next={id:crypto.randomUUID(),name:p.p_action==='create_assistant'?'Asistente de Totus':q.directory.find(p=>p.email===d.email).name,group_name:'Mensajes directos',channel_kind:p.p_action==='create_assistant'?'assistant':'direct',member_role:'member',is_private:true};
    q.channels.push(next);return structuredClone(next);
   }
   if(p.p_action==='create_channel'){const next={...d,id:crypto.randomUUID(),member_role:'manager'};q.channels.push(next);return structuredClone(next);}
   if(p.p_action==='send'){
    let next=q.messages.find(m=>m.client_id===d.client_id);
    if(!next){next={...d,id:crypto.randomUUID(),author_email:q.owner,created_at:new Date().toISOString(),seq:++q.seq,reactions:[],replies:0};q.messages.push(next);c.last_seq=next.seq;if(c.channel_kind==='assistant')next.agent_request={id:crypto.randomUUID(),status:'pending'};if(d.parent_id)q.messages.find(m=>m.id===d.parent_id).replies++;}
    if(q.failAfterCommit){q.failAfterCommit=false;throw Error('Conexión interrumpida; el mensaje puede haberse guardado.');}
    return structuredClone(next);
   }
   if(p.p_action==='edit'){m.body=d.body;m.edited_at=new Date().toISOString();}
   if(p.p_action==='message_delete'){m.body='Mensaje eliminado';m.deleted_at=new Date().toISOString();}
   if(p.p_action==='pin')m.pinned=d.pinned;
   if(p.p_action==='task')Object.assign(m,{task_state:d.task_state,task_result:d.task_result});
   if(p.p_action==='reaction'){const i=m.reactions.findIndex(r=>r.email===q.owner&&r.emoji===d.emoji);if(i<0)m.reactions.push({email:q.owner,emoji:d.emoji});else m.reactions.splice(i,1);}
   if(p.p_action==='channel_update')Object.assign(c,d);
   if(p.p_action==='channel_delete')q.channels=q.channels.filter(c=>c.id!==d.channel_id);
   if(p.p_action==='member_save')q.members.push({email:d.email,member_role:d.member_role});
   if(p.p_action==='member_remove')q.members=q.members.filter(m=>m.email!==d.email);
   if(p.p_action==='mute')c.muted=d.muted;
   if(p.p_action==='member_preferences')Object.assign(c,d,{muted:d.notify_level==='none'});
   if(p.p_action==='agent_request')m.agent_request={id:crypto.randomUUID(),status:'pending'};
   if(p.p_action==='agent_cancel')m.agent_request.status='cancelled';
   if(p.p_action==='read'){c.unread=0;c.last_read_seq=d.seq;}
   return structuredClone(m||c||{});
  };
  q.rpc=rpc;
  window.fetch=async(address,options={})=>{
   if(!String(address).startsWith('https://upload.1drv.com/'))throw Error('Unexpected request '+address);
   const file=q.files.find(f=>String(address).endsWith(f.id));
   assertNoCredentials(options.headers);
   file.data=new Uint8Array(await options.body.arrayBuffer());return new Response(JSON.stringify({id:file.id}),{status:201});
  };
  function assertNoCredentials(headers){if(headers?.Authorization||headers?.apikey)throw Error('Credentials forwarded to Microsoft');}
  const requestFile=async(action,v)=>{
   if(action==='chat-file-prepare'){
    let f=q.files.find(f=>f.client_id===v.client_id&&f.message_id===v.message_id);
    if(!f){f={id:crypto.randomUUID(),client_id:v.client_id,message_id:v.message_id,original_name:v.name,size_bytes:v.size,sha256:v.sha256,mime_type:chatFileMetadata({name:v.name,size:v.size}).mime_type,status:'uploading'};q.files.push(f);const m=q.messages.find(m=>m.id===v.message_id);(m.files||=[]).push(f);}
    if(f.data&&f.data.length===f.size_bytes){f.status='ready';return {complete:true,file:structuredClone(f)};}
    return {file:structuredClone(f),upload_url:'https://upload.1drv.com/'+f.id};
   }
   const f=q.files.find(f=>f.id===v.file_id);
   if(action==='chat-file-complete'){if(q.failFileFinalize){q.failFileFinalize=false;throw Error('Verificación interrumpida.');}f.status='ready';return {file:structuredClone(f)};}
   if(action==='chat-file-content')return new Blob([f.data],{type:f.mime_type});
   throw Error('Unsupported file operation');
  };
  window.chatController=createTeamChat({rpc,actor:()=>q.owner,confirm:async()=>true,requestFile});
  await window.chatController.mount(document.querySelector('#chatHarness'));
 });
 const click=a=>page.locator('[data-chat="'+a+'"]').click();
 await page.getByRole('button',{name:'Reintentar',exact:true}).waitFor();
 await click('refresh');
 await page.locator('[data-chat="open"][data-id="h"]').click();
 await page.getByLabel('Mensaje para Cajas · Hortimatic').waitFor();
 assert.equal(await page.evaluate(()=>window.qaUnsafe),undefined,'Messages must be escaped');
 await page.locator('[data-message="m2"] [data-chat="edit"]').click();
 await page.locator('dialog textarea[name="body"]').fill('Mensaje corregido');
 await page.locator('dialog button[type="submit"]').click();
 await page.getByText('Mensaje corregido',{exact:true}).waitFor();
 await page.locator('[data-message="m2"] [data-chat="pin"]').click();
 await page.locator('#chatMode').selectOption('pinned');await click('search');
 assert.equal(await page.locator('.chat-message').count(),1);
 await click('clear');
 await page.locator('[data-message="m2"] [data-chat="task"]').click();
 await page.locator('dialog [name="task_state"]').selectOption('done');await page.locator('dialog [name="task_result"]').fill('Comprobado, sin modificar contabilidad.');
 await page.locator('dialog [type="submit"]').click();
 await page.getByText('Comprobado, sin modificar contabilidad.',{exact:true}).waitFor();
 await page.locator('[data-message="m2"] [data-chat="prompt"]').click();
 assert((await page.locator('dialog textarea').inputValue()).includes('No hay un asistente automático activo'));
 await page.locator('dialog [data-chat-close]').click();
 await page.locator('[data-message="m1"] [data-chat="thread"]').click();
 await page.locator('#chatBody').fill('Comprobación del cierre');
 await page.locator('.chat-compose [type="submit"]').click();
 await page.getByText('Comprobación del cierre',{exact:true}).waitFor();await click('thread-back');
 await page.locator('#chatBody').fill('Borrador sin perder');
 await page.locator('[data-chat="open"][data-id="n"]').click();
 await page.locator('[data-chat="open"][data-id="h"]').click();
 assert.equal(await page.locator('#chatBody').inputValue(),'Borrador sin perder');
 await page.locator('#chatBody').fill('Envío con corte de conexión');
 await page.evaluate(()=>window.qaChat.failAfterCommit=true);
 await page.locator('.chat-compose [type="submit"]').click();
 await page.getByRole('alert').filter({hasText:'Conexión interrumpida'}).waitFor();
 await page.locator('.chat-compose [type="submit"]').click();
 await page.getByText('Envío con corte de conexión',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>qaChat.messages.filter(m=>m.body==='Envío con corte de conexión').length),1,'Retry duplicated message');
 await page.locator('#chatQuery').fill('Tarjeta');await click('search');assert.equal(await page.locator('.chat-message').count(),1);await click('clear');
 await page.locator('#chatFrom').fill('2026-11-01');await page.locator('#chatTo').fill('2026-10-01');await click('search');
 await page.getByRole('alert').filter({hasText:'fecha inicial'}).waitFor();await click('clear');
 await page.locator('[data-message="m1"] [data-chat="reaction"]').first().click();
 assert.equal(await page.locator('[data-message="m1"] [data-chat="reaction"]').first().getAttribute('aria-pressed'),'true');
 await click('read');await click('mute');await page.getByRole('button',{name:'Activar avisos',exact:true}).waitFor();
 await click('members');await page.locator('dialog [name="email"]').fill('companero@example.invalid');await page.locator('dialog [type="submit"]').click();
 assert.equal(await page.evaluate(()=>qaChat.members.length),2);
 await click('new');await page.keyboard.press('Escape');assert.equal(await page.locator('dialog').count(),0,'Escape must clean up the dialog');
 await click('new');await page.locator('dialog [name="name"]').fill('Pedidos de clientes');await page.locator('dialog [name="group_name"]').fill('Hortimatic');await page.locator('dialog [name="is_private"]').selectOption('true');await page.locator('dialog [type="submit"]').click();
 await page.getByRole('heading',{name:'Pedidos de clientes',exact:true}).waitFor();
 await click('settings');await page.locator('dialog [name="archived"]').selectOption('true');await page.locator('dialog [type="submit"]').click();
 assert.equal(await page.locator('.chat-compose').count(),0);
 assert.equal(await page.locator('.chat-message [data-chat="edit"],.chat-message [data-chat="reaction"]').count(),0,'Archived channels must show read-only actions');
 await click('settings');await page.locator('dialog [name="archived"]').selectOption('false');await page.locator('dialog [type="submit"]').click();
 await page.locator('#chatBody').waitFor();
 await click('settings');await page.locator('dialog [data-chat="retire"]').click();
 await page.getByText('Elige un canal',{exact:true}).waitFor();
 await page.locator('[data-chat="open"][data-id="h"]').click();
 await click('direct');await page.locator('dialog [name="email"]').selectOption('companero@example.invalid');await page.locator('dialog [type="submit"]').click();
 await page.getByRole('heading',{name:'Compañero',exact:true}).waitFor();
 assert.equal(await page.locator('[data-chat="settings"]').count(),0,'Direct messages cannot invite extra people');
 await click('assistant');await page.getByRole('heading',{name:'Asistente de Totus',exact:true}).waitFor();
 await page.locator('#chatBody').fill('Solicitud de prueba sin operaciones contables');await page.locator('.chat-compose [type="submit"]').click();
 await page.getByText('Esperando a ChatGPT',{exact:true}).waitFor();
 await page.locator('[data-chat="open"][data-id="h"]').click();
 await page.locator('#chatMention').selectOption('companero@example.invalid');assert((await page.locator('#chatBody').inputValue()).includes('@{companero@example.invalid}'));
 await page.locator('#chatBody').fill('Adjunto de prueba');
 await page.locator('#chatFiles').setInputFiles({name:'Factura de prueba.pdf',mimeType:'application/pdf',buffer:Buffer.from(pdfBytes)});
 await page.evaluate(()=>qaChat.failFileFinalize=true);
 await page.locator('.chat-compose [type="submit"]').click();
 await page.getByRole('alert').filter({hasText:'Verificación interrumpida'}).waitFor();
 await click('uploads-retry');await page.getByText('Guardado en OneDrive',{exact:false}).waitFor();
 assert.equal(await page.evaluate(()=>qaChat.files.length),1,'Attachment retry created duplicate originals');
 await page.locator('[data-chat="file-preview"]').first().click();await page.locator('dialog iframe').waitFor();await page.locator('dialog [data-chat-close]').click();
 await click('preferences');await page.locator('dialog [name="sort_order"]').fill('-10');await page.locator('dialog [name="favourite"]').selectOption('true');await page.locator('dialog [type="submit"]').click();
 assert.equal(await page.evaluate(()=>qaChat.channels.find(c=>c.id==='h').favourite),true,'Preferences not persisted');
 await click('inbox');await page.getByRole('heading',{name:'Mensajes sin leer',exact:true}).waitFor();await page.locator('dialog [data-chat-close]').click();
 await page.evaluate(async()=>{
  window.supabase={createClient:()=>({})};
  const {createChatNotifier}=await import('../src/chat-api.js');window.qaNotifications=[];
  class FakeNotification{static permission='granted';constructor(title,options){qaNotifications.push({title,options});}close(){}}
  const notice=createChatNotifier({rpc:qaChat.rpc,actor:()=>qaChat.owner,onCount:count=>{window.qaUnread=count;},onOpen:()=>{},NotificationClass:FakeNotification});
  await notice.check();
  qaChat.channels.find(c=>c.id==='h').muted=false;
  qaChat.messages.push({id:'incoming-notice',seq:++qaChat.seq,channel_id:'h',author_email:'tienda@example.invalid',body:'Aviso nuevo',created_at:new Date().toISOString(),reactions:[]});
  await notice.check();notice.stop();
 });
 assert.equal(await page.evaluate(()=>qaNotifications.length),1,'Desktop notification not delivered once');
 assert.equal(await page.evaluate(()=>qaNotifications[0].options.body),'Tienes un mensaje nuevo.','Notifications should not expose financial detail');

 // Personal organization survives remounting without changing channel names.
 await page.locator('[data-chat="group-toggle"][data-group="Hortimatic"]').click();
 assert.equal(await page.locator('[data-chat="open"][data-id="h"]').count(),0);
 await page.evaluate(async()=>{chatController.dispose();await chatController.mount(document.querySelector('#chatHarness'));});
 assert.equal(await page.locator('[data-chat="open"][data-id="h"]').count(),0,'Collapsed section not restored');
 await page.locator('[data-chat="group-toggle"][data-group="Hortimatic"]').click();
 await page.locator('[data-chat="group-menu"][data-group="Hortimatic"]').click();
 await page.locator('dialog [data-section-action="rename"]').click();
 await page.locator('dialog [name="label"]').fill('Mi tienda');await page.locator('dialog [type="submit"]').click();
 await page.getByRole('button',{name:'▾ Mi tienda',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>qaChat.channels.find(c=>c.id==='h').group_name),'Hortimatic','A personal label must not rename channels for everybody');
 await page.locator('[data-chat="group-menu"][data-group="Hortimatic"]').click();await page.locator('dialog [data-section-action="recent"]').click();
 assert.equal(await page.evaluate(()=>qaChat.layout.group_sort.Hortimatic),'recent');
 await page.locator('#chatChannelQuery').fill('newold');assert.equal(await page.locator('[data-chat="open"][data-id="h"]').count(),0);await page.locator('#chatChannelQuery').fill('');
 await click('sidebar-toggle');assert.equal(await page.locator('.chat-sidebar-collapsed').count(),1);await click('sidebar-toggle');
 // Use a long, realistic history to exercise scroll anchoring and keyboard controls.
 await page.evaluate(()=>{for(let i=0;i<120;i++)qaChat.messages.push({id:'scroll-'+i,seq:++qaChat.seq,channel_id:'h',author_email:'tienda@example.invalid',body:'Mensaje de historial '+i+' — '+('Texto largo de prueba. '.repeat(4)),created_at:new Date().toISOString(),reactions:[],replies:0});});
 await page.locator('[data-chat="open"][data-id="h"]').click();
 await click('scroll-top');
 const anchor=await page.locator('.chat-message').first().getAttribute('data-message');
 const beforeAnchor=await page.locator('[data-message="'+anchor+'"]').evaluate(el=>el.getBoundingClientRect().top-el.closest('.chat-messages').getBoundingClientRect().top);
 await click('older');
 const afterAnchor=await page.locator('[data-message="'+anchor+'"]').evaluate(el=>el.getBoundingClientRect().top-el.closest('.chat-messages').getBoundingClientRect().top);
 assert(Math.abs(afterAnchor-beforeAnchor)<=3,'Loading older history jumped away from the visible message');
 await click('scroll-bottom');
 assert(await page.locator('.chat-messages').evaluate(el=>el.scrollHeight-el.clientHeight-el.scrollTop<3),'Latest messages are not reachable');
 await click('scroll-top');await page.locator('.chat-messages').press('PageDown');await page.waitForFunction(()=>document.querySelector('.chat-messages').scrollTop>0);assert(await page.locator('.chat-messages').evaluate(el=>el.scrollTop>0),'Keyboard scrolling failed');
 await page.locator('#chatHarness').evaluate(el=>{el.style.marginLeft='245px';el.style.marginTop='82px';});
 for(const size of [{width:1440,height:900},{width:1280,height:720},{width:1920,height:1080}]){
  await page.setViewportSize(size);
  const screen=await page.evaluate(()=>({page:document.documentElement.scrollHeight,viewport:innerHeight,compose:document.querySelector('.chat-compose').getBoundingClientRect().bottom,messages:document.querySelector('.chat-messages').clientHeight}));
  assert(screen.compose<=screen.viewport+1,'Composer below viewport '+JSON.stringify({size,screen}));
  assert(screen.messages>=115,'History too small '+JSON.stringify({size,screen}));
 }
 await page.locator('#chatHarness').evaluate(el=>{el.style.marginLeft='';el.style.marginTop='';});
 const geometry=[];
 for(const width of [1920,1440,1280,1024,900,768,700,390,320]){
  await page.setViewportSize({width,height:1000});
  const dimensions=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,buttons:[...document.querySelectorAll('.team-chat button')].filter(b=>b.getBoundingClientRect().width&&b.scrollWidth>b.clientWidth+2).map(b=>b.textContent)}));
  assert(dimensions.scroll<=width+1,'Page overflow at '+width+': '+JSON.stringify(dimensions));
  assert.deepEqual(dimensions.buttons,[],'Button clipping at '+width);
  geometry.push(dimensions);await page.screenshot({path:'artifacts/ui_chat_'+width+'.png',fullPage:true});
 }
 assert.equal(await page.evaluate(()=>qaChat.calls.some(c=>!c.name.startsWith('totus_chat_'))),false,'Must never call accounting functions');
 await page.evaluate(()=>chatController.dispose());assert.deepEqual(errors,[]);
 console.log('TEAM CHAT BROWSER QA: create/edit/archive/retire, thread, member, drafts, search/dates, pins, tasks, reactions, retries, nine sizes and accounting isolation OK',JSON.stringify(geometry));
}finally{await browser.close();}
