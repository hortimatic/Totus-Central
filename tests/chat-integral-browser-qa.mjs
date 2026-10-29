import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4173/tests/chat-harness.html');
 await page.evaluate(async()=>{
  const {createTeamChat}=await import('../src/team-chat-ui.js');
  const q=window.integral={owner:'admin@qa.invalid',calls:[],messages:[],members:[{email:'admin@qa.invalid',member_role:'manager'}],channels:[{id:'a',name:'Canal A',group_name:'Equipo',member_role:'manager',last_read_seq:9999},{id:'b',name:'Canal B',group_name:'Equipo',member_role:'manager',last_read_seq:9999}],layout:{}};
  for(let i=1;i<=30;i++)q.messages.push({id:'m'+i,seq:i,channel_id:'a',body:'Mensaje '+i+' '+('contenido '.repeat(25)),author_email:'other@qa.invalid',created_at:'2026-10-29T10:00:00Z'});
  q.c=createTeamChat({actor:()=>q.owner,confirm:async()=>true,subscribe:(_id,fn)=>{q.notify=fn;return()=>{};},rpc:async(name,p)=>{
   q.calls.push({name,p:structuredClone(p)});
   if(name==='totus_chat_context')return structuredClone({channels:q.channels,messages:q.messages.filter(m=>m.channel_id===p.p_channel),members:q.members,directory:[{email:q.owner,name:'Administración'},{email:'other@qa.invalid',name:'Compañero'}],layout:q.layout});
   if(name==='totus_chat_command'){
    const d=p.p_data;
    if(p.p_action==='send'){const m={...d,id:crypto.randomUUID(),seq:q.messages.length+1,author_email:q.owner,created_at:new Date().toISOString()};q.messages.push(m);return m;}
    if(p.p_action==='agent_request'){if(q.failRequest)throw Error('Ensayo de permiso denegado');const m=q.messages.find(m=>m.id===d.message_id);m.agent_request={id:'request',status:'pending'};return {};}
    if(p.p_action==='read')return {};
   }
   throw Error('Operación de ensayo inesperada: '+name);
  }});await q.c.mount(document.querySelector('#chatHarness'));
 });
 const open=async id=>{await page.locator('[data-chat="open"][data-id="'+id+'"]').click();await page.locator('#chatBody').waitFor();};
 await open('a');await page.locator('#chatBody').fill('Borrador exclusivo de A');
 await open('b');assert.equal(await page.locator('#chatBody').inputValue(),'','No draft may cross into another channel');
 await page.locator('#chatBody').fill('Borrador exclusivo de B');await open('a');assert.equal(await page.locator('#chatBody').inputValue(),'Borrador exclusivo de A');
 await page.evaluate(()=>{window.originalEditor=document.querySelector('#chatBody');integral.notify();});
 await page.waitForTimeout(450);assert(await page.evaluate(()=>window.originalEditor===document.querySelector('#chatBody')),'Editor identity must survive background changes');
 // Composition input cannot be destroyed, or its Enter key send prematurely.
 const imeReads=await page.evaluate(()=>{integral.channels[0].last_read_seq=0;return integral.calls.filter(c=>c.p?.p_action==='read').length;});
 await page.locator('#chatBody').dispatchEvent('compositionstart');
 await page.evaluate(()=>{integral.messages[0].body='Texto actualizado';integral.notify();});await page.waitForTimeout(850);
 assert.equal(await page.evaluate(()=>integral.calls.filter(c=>c.p?.p_action==='read').length),imeReads,'Composition defers painting, so unseen rows must not be acknowledged');
 await page.evaluate(()=>integral.channels[0].last_read_seq=9999);
 assert(await page.evaluate(()=>window.originalEditor===document.querySelector('#chatBody')));
 const sendsBefore=await page.evaluate(()=>integral.calls.filter(c=>c.p?.p_action==='send').length);
 await page.locator('#chatBody').dispatchEvent('keydown',{key:'Enter',ctrlKey:true,isComposing:true});assert.equal(await page.evaluate(()=>integral.calls.filter(c=>c.p?.p_action==='send').length),sendsBefore);
 await page.locator('#chatBody').dispatchEvent('compositionend');
 // Quotes remain in the main channel; selection and existing draft are retained.
 await page.locator('#chatBody').fill('Mi respuesta ');await page.locator('[data-chat="quote"][data-id="m1"]').click();assert((await page.locator('#chatBody').inputValue()).includes('> Compañero: Texto actualizado'));assert.equal(await page.locator('.chat-thread-bar').count(),0);
 // Less than fifty messages: reading above must not jump on a new arrival.
 await page.locator('.chat-messages').evaluate(el=>el.scrollTop=0);
 await page.evaluate(()=>{integral.messages.push({id:'m31',seq:31,channel_id:'a',author_email:'other@qa.invalid',body:'Llegada en segundo plano',created_at:new Date().toISOString()});integral.notify();});
 await page.locator('[data-chat="scroll-bottom"].primary').waitFor();assert(await page.locator('.chat-messages').evaluate(el=>el.scrollTop<3));
 await page.locator('[data-chat="scroll-bottom"].primary').click();await page.getByText('Llegada en segundo plano',{exact:true}).waitFor();
 // One user action saves the message before creating the request.
 await page.locator('#chatBody').fill('Solicitud ficticia');await page.getByRole('button',{name:'Enviar y pedir a ChatGPT',exact:true}).click();await page.getByText('Esperando a ChatGPT',{exact:true}).waitFor();
 const actions=await page.evaluate(()=>integral.calls.filter(c=>c.name==='totus_chat_command').map(c=>c.p.p_action));assert(actions.lastIndexOf('send')<actions.lastIndexOf('agent_request'));
 // Failed request must not pretend the message failed or duplicate it.
 await page.evaluate(()=>integral.failRequest=true);await page.locator('#chatBody').fill('Conservar mensaje si falla petición');await page.getByRole('button',{name:'Enviar y pedir a ChatGPT',exact:true}).click();await page.locator('[data-chat-error]').filter({hasText:'El mensaje está guardado'}).waitFor();assert.equal(await page.evaluate(()=>integral.messages.filter(m=>m.body==='Conservar mensaje si falla petición').length),1);
 // Private channel without invitation: no agent_request reaches the server.
 await page.evaluate(()=>{integral.failRequest=false;integral.channels[0].is_private=true;});await page.locator('[data-chat="refresh"]').click();
 const requestsBefore=await page.evaluate(()=>integral.calls.filter(c=>c.p?.p_action==='agent_request').length);
 await page.locator('#chatBody').fill('Petición privada sin invitación');await page.getByRole('button',{name:'Enviar y pedir a ChatGPT',exact:true}).click();await page.locator('[data-chat-error]').filter({hasText:'Invita a ChatGPT'}).waitFor();assert.equal(await page.evaluate(()=>integral.calls.filter(c=>c.p?.p_action==='agent_request').length),requestsBefore);
 // Atajos and responsive surfaces: no horizontal document overflow.
 await page.locator('[data-chat="shortcuts"]').click();await page.getByRole('heading',{name:'Atajos y ayuda'}).waitFor();await page.locator('dialog [data-chat-close]').click();
 for(const [width,height] of [[1920,1080],[1440,900],[1024,768],[768,1024],[390,844],[360,740]]){
  await page.setViewportSize({width,height});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Overflow at '+width);
  for(const selector of ['.chat-conversation','#chatBody','.chat-heading'])assert(await page.locator(selector).isVisible());
  await page.screenshot({path:'artifacts/chat_integral_'+width+'.png',fullPage:true});
 }
 const readsBefore=await page.evaluate(()=>{integral.channels[0].last_read_seq=0;return integral.calls.filter(c=>c.p?.p_action==='read').length;});
 await page.locator('[data-chat=mobile-channels]').click();await page.waitForTimeout(450);assert.equal(await page.evaluate(()=>integral.calls.filter(c=>c.p?.p_action==='read').length),readsBefore,'Hidden mobile conversation must not acknowledge unread messages');assert.equal(await page.evaluate(()=>integral.c.isReading({channel_id:'a'})),false,'Hidden conversation must not suppress notifications');await page.evaluate(()=>integral.channels[0].last_read_seq=9999);assert(await page.locator('.chat-sidebar').isVisible());assert.equal(await page.locator('.chat-conversation').isVisible(),false);await page.locator('[data-chat=open][data-id=a]').click();assert(await page.locator('.chat-conversation').isVisible());assert.equal(await page.locator('.chat-sidebar').isVisible(),false);
 // A desktop window may still give the module only 600px beside the app sidebar.
 await page.setViewportSize({width:1440,height:1000});await page.locator('#chatHarness').evaluate(el=>el.style.width='600px');
 assert(await page.locator('[data-chat=mobile-channels]').isVisible(),'Navigation must follow module width, not only viewport width');assert.equal(await page.locator('.chat-sidebar').isVisible(),false);
 await page.locator('[data-chat=mobile-channels]').click();assert(await page.locator('.chat-sidebar').isVisible());await page.locator('[data-chat=open][data-id=a]').click();assert(await page.locator('.chat-conversation').isVisible());
 await page.screenshot({path:'artifacts/chat_integral_panel_600.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('CHAT INTEGRAL QA: channel draft isolation, editor/IME, quotes, live reading <50 rows, single-action request, request failure, private invitation and six viewport sizes OK');
}finally{await browser.close();}
