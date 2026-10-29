import {chatAction,revealChatSearch,chatClick,revealChatFilters} from './chat-menu-helper.mjs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto('http://127.0.0.1:4173/tests/chat-harness.html');
 await page.evaluate(async()=>{
  const {createTeamChat}=await import('../src/team-chat-ui.js');
  const q=window.usabilityQA={owner:'admin@qa.invalid',layout:{},denied:[],confirmAllowed:true,calls:[],stores:[{id:'store1',name:'Hortimatic',active:true},{id:'store2',name:'NewOldSmok',active:true}],channels:[{id:'a',name:'Café almacén',group_name:'Hortimatic',member_role:'manager',unread:2,last_seq:80,favourite:true,channel_kind:'channel'},{id:'b',name:'Cierre tienda',group_name:'NewOldSmok',member_role:'manager',unread:0,channel_kind:'channel'},{id:'d',name:'Compañero',group_name:'Mensajes directos',member_role:'member',channel_kind:'direct',unread:0}],messages:[]};
  for(let i=1;i<=80;i++)q.messages.push({id:'m'+i,channel_id:'a',seq:i,body:'Historial '+i+' '+('texto de prueba '.repeat(5)),author_email:'other@qa.invalid',created_at:'2026-10-28T10:00:00Z',reactions:[]});
  q.controller=createTeamChat({actor:()=>q.owner,can:action=>!q.denied.includes(action),stores:()=>q.stores,confirm:async()=>q.confirmAllowed,subscribe:(_id,fn)=>{q.notify=fn;return()=>{};},rpc:async(name,p)=>{
   q.calls.push({name,p:structuredClone(p)});
   if(name==='totus_chat_context'){
    let rows=q.messages.filter(m=>m.channel_id===p.p_channel);
    if(p.p_query)rows=rows.filter(m=>m.body.includes(p.p_query));
    if(p.p_before)rows=rows.filter(m=>m.seq<p.p_before);
    return structuredClone({channels:q.channels,messages:rows.slice(-51),members:[{email:q.owner,member_role:'manager'}],directory:[{email:q.owner,name:'Administración'},{email:'other@qa.invalid',name:'Compañero'}],layout:q.layout});
   }
   if(name==='totus_chat_save_layout'){q.layout=structuredClone(p.p_layout);return q.layout;}
   if(name==='totus_chat_inbox')return [];
   if(name!=='totus_chat_command')throw Error('Unexpected non-chat write');
   const d=p.p_data,c=q.channels.find(c=>c.id===d.channel_id);
   if(p.p_action==='read'){if(q.delayRead)await new Promise(resolve=>q.releaseRead=resolve);if(c){c.last_read_seq=d.seq;c.unread=0;}return {};}
   if(p.p_action==='create_channel'){const next={...d,id:crypto.randomUUID(),member_role:'manager',channel_kind:'channel',unread:0};q.channels.push(next);return structuredClone(next);}
   if(p.p_action==='channel_update'){Object.assign(c,d);return structuredClone(c);}
   throw Error('Unexpected command '+p.p_action);
  }});
  await q.controller.mount(document.querySelector('#chatHarness'));
 });
 const click=action=>chatAction(page,action);
 // Sidebar filters are navigation only; they cannot change membership or data.
 await page.locator('#chatChannelQuery').fill('cafe');assert.equal(await page.locator('.chat-channel').count(),1);
 await page.locator('#chatChannelQuery').fill('');await page.locator('[data-chat=view][data-view=favourites]').click();assert.equal(await page.locator('.chat-channel').count(),1);
 await page.locator('[data-chat=view][data-view=direct]').click();assert.equal(await page.locator('.chat-channel').count(),1);assert.equal(await page.locator('.chat-channel-name').innerText(),'Compañero');
 await page.locator('[data-chat=view][data-view=unread]').click();assert.equal(await page.locator('.chat-channel').count(),1);
 await page.locator('[data-chat=view][data-view=all]').click();
 await page.locator('[data-chat="open"][data-id="a"]').click();await page.locator('#chatBody').waitFor();await page.screenshot({path:'artifacts/ui_chat_usabilidad_pc.png',fullPage:true});
 // Unapplied text must survive a realtime refresh after moving focus away.
 await revealChatSearch(page);await page.locator('#chatQuery').fill('pendiente de aplicar');await page.locator('.chat-heading h2').click();
 const before=await page.evaluate(()=>usabilityQA.calls.length);await page.evaluate(()=>usabilityQA.notify());await page.waitForFunction(n=>usabilityQA.calls.length>n,before);
 assert.equal(await page.locator('#chatQuery').inputValue(),'pendiente de aplicar');assert.equal(await page.evaluate(()=>usabilityQA.calls.filter(c=>c.name==='totus_chat_context').at(-1).p.p_query),'');
 await click('clear');
 // A delayed read acknowledgement cannot discard older history loaded meanwhile.
 await page.evaluate(()=>{usabilityQA.channels[0].last_read_seq=0;usabilityQA.delayRead=true;});await click('refresh');
 await page.waitForFunction(()=>typeof usabilityQA.releaseRead==='function');await click('scroll-top');await click('older');
 const beforeAck=await page.evaluate(()=>usabilityQA.calls.filter(c=>c.name==='totus_chat_context').length);
 await page.evaluate(()=>{usabilityQA.delayRead=false;usabilityQA.releaseRead();});
 await page.waitForFunction(n=>usabilityQA.calls.filter(c=>c.name==='totus_chat_context').length>n,beforeAck);
 assert.equal(await page.locator('.chat-message').count(),80,'Read acknowledgement must preserve loaded history');
 await click('refresh');
 // Older history stays anchored while a new message arrives.
 await click('scroll-top');await click('older');const count=await page.locator('.chat-message').count();assert.equal(count,80);
 await page.locator('.chat-messages').evaluate(el=>el.scrollTop=0);
 await page.evaluate(()=>{usabilityQA.messages.push({id:'new81',seq:81,channel_id:'a',body:'Mensaje nuevo recibido',author_email:'other@qa.invalid',created_at:'2026-10-28T10:01:00Z'});usabilityQA.channels[0].last_seq=81;usabilityQA.notify();});
 await page.getByRole('button',{name:'Mensajes nuevos · Ver al final',exact:true}).waitFor();
 assert.equal(await page.locator('.chat-message').count(),80);assert(await page.locator('.chat-messages').evaluate(el=>el.scrollTop<3));
 await page.getByRole('button',{name:'Mensajes nuevos · Ver al final',exact:true}).click();await page.getByText('Mensaje nuevo recibido',{exact:true}).waitFor();assert.equal(await page.locator('.chat-message').count(),50);
 await page.evaluate(()=>usabilityQA.controller.openMessage('a','new81'));
 assert.equal(await page.locator('.chat-thread-bar').count(),0,'An inbox root message opens in its channel, not a forced thread');
 assert.equal(await page.locator('.chat-message-selected').getAttribute('data-message'),'new81');
 // Creation form stores attribution and edition actually changes it.
 await click('new');await page.locator('dialog [name="name"]').fill('Canal por tienda');await page.locator('dialog [name="store_id"]').selectOption('store1');await page.locator('dialog [type="submit"]').click();
 await page.waitForFunction(()=>usabilityQA.channels.some(c=>c.name==='Canal por tienda'));
 assert.equal(await page.evaluate(()=>usabilityQA.channels.find(c=>c.name==='Canal por tienda').store_id),'store1');
 await click('settings');await page.locator('dialog [name="store_id"]').selectOption('store2');await page.locator('dialog [type="submit"]').click();assert.equal(await page.evaluate(()=>usabilityQA.channels.find(c=>c.name==='Canal por tienda').store_id),'store2');
 // Deletion denied by module permissions must not break the settings dialog.
 await page.evaluate(()=>usabilityQA.denied=['delete']);await click('settings');assert.equal(await page.locator('dialog [data-chat="retire"]').count(),0);await page.locator('dialog [data-chat-close]').click();await page.evaluate(()=>usabilityQA.denied=[]);
 // An accidental close can be rejected without losing typed content.
 await click('new');await page.locator('dialog [name="name"]').fill('Borrador protegido');await page.evaluate(()=>usabilityQA.confirmAllowed=false);await page.keyboard.press('Escape');await page.waitForTimeout(50);assert.equal(await page.locator('dialog [name="name"]').inputValue(),'Borrador protegido');
 await page.evaluate(()=>usabilityQA.confirmAllowed=true);await page.locator('dialog [data-chat-close]').click();await page.locator('dialog').waitFor({state:'detached'});
 // Empty personal sections can be removed without deleting a conversation.
 const channelsBefore=await page.evaluate(()=>JSON.stringify(usabilityQA.channels));await click('section-new');await page.locator('dialog [name="name"]').fill('Sección de ensayo');await page.locator('dialog [type="submit"]').click();
 await page.locator('[data-chat="group-menu"][data-group="Sección de ensayo"]').click();await page.locator('[data-section-action="remove"]').click();await page.waitForFunction(()=>!usabilityQA.layout.extra_groups.includes('Sección de ensayo'));
 assert.equal(await page.evaluate(()=>JSON.stringify(usabilityQA.channels)),channelsBefore);
 await click('section-new');await page.locator('dialog [name="name"]').fill('hortimatic');await page.locator('dialog [type="submit"]').click();await page.locator('dialog [data-dialog-error]').filter({hasText:'Ya existe'}).waitFor();await page.locator('dialog [data-chat-close]').click();
 // Read-only dialogs have a single footer close button.
 await click('inbox');assert.equal(await page.locator('dialog footer button').count(),1);await page.locator('dialog [data-chat-close]').click();
 // Deep forms stay within the mobile viewport, not only the main empty screen.
 for(const width of [320,390,768,1024,1440,1920]){
  await page.setViewportSize({width,height:900});if(width<=700&&await page.locator('[data-chat=mobile-channels]').isVisible())await click('mobile-channels');await click('new');
  if(width===390)await page.screenshot({path:'artifacts/ui_chat_usabilidad_formulario_movil.png',fullPage:true});
  const box=await page.locator('dialog').boundingBox();assert(box.x>=0&&box.x+box.width<=width+1,'Creation dialog overflow '+width);
  assert(await page.locator('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Creation form horizontal overflow '+width);
  await page.locator('dialog [data-chat-close]').click();
 }
 assert.deepEqual(errors,[]);assert(await page.evaluate(()=>usabilityQA.calls.every(c=>c.name.startsWith('totus_chat_'))));await page.evaluate(()=>usabilityQA.controller.dispose());
 console.log('CHAT USABILITY QA: sidebar filters, accent search, unapplied filters, live history, stores, restricted settings, protected drafts, duplicate/empty sections, inbox and six responsive form sizes OK');
}finally{await browser.close();}
