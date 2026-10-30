import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import {chatAction,chatClick,revealChatFilters} from './chat-menu-helper.mjs';
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto('http://127.0.0.1:4173/tests/chat-harness.html');
 await page.evaluate(async()=>{
  const {createTeamChat}=await import('../src/team-chat-ui.js');
  const blob=new Blob(['Justificante de prueba ficticio'],{type:'text/plain'}),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(n=>n.toString(16).padStart(2,'0')).join('');
  const q=window.workspaceQA={owner:'admin@qa.invalid',denied:[],layout:{group_order:['NewOldSmok','Hortimatic']},calls:[],clipboard:null,files:0};
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{q.clipboard=text;}}});
  q.channels=Array.from({length:80},(_,i)=>({id:'c'+i,name:'Canal '+String(i).padStart(3,'0'),group_name:i<40?'NewOldSmok':'Hortimatic',member_role:'manager',channel_kind:'channel',last_read_seq:1000,notify_level:'mentions',muted:false,desktop_enabled:false,sort_order:i,favourite:false}));
  q.messages=[{id:'m1',seq:1,channel_id:'c79',author_email:'colleague@qa.invalid',body:'El pedido está preparado. Adjunto el justificante de prueba.',created_at:'2026-10-30T09:00:00Z',reactions:[],files:[{id:'f1',original_name:'Justificante de prueba.txt',size_bytes:blob.size,sha256:hash,status:'ready',mime_type:'text/plain'}]},
   {id:'m2',seq:2,channel_id:'c79',author_email:q.owner,body:'Gracias @{colleague@qa.invalid}. Lo revisamos hoy.',created_at:'2026-10-30T09:05:00Z',reactions:[]}];
  q.chat=createTeamChat({actor:()=>q.owner,can:a=>!q.denied.includes(a),subscribe:(_id,fn)=>{q.notify=fn;return()=>{};},requestFile:async action=>{if(action!=='chat-file-content')throw Error('Unexpected file write');q.files++;return blob;},rpc:async(name,p)=>{
   q.calls.push({name,p:structuredClone(p)});
   if(name==='totus_chat_context')return structuredClone({channels:q.channels,messages:q.messages.filter(m=>m.channel_id===p.p_channel),members:[{email:q.owner}],directory:[{email:q.owner,name:'Administración'},{email:'colleague@qa.invalid',name:'Equipo de tienda'}],layout:q.layout});
   if(name==='totus_chat_command'&&p.p_action==='member_preferences'){const c=q.channels.find(c=>c.id===p.p_data.channel_id);c.favourite=p.p_data.favourite;return {};}
   if(name==='totus_chat_save_layout'){q.layout=p.p_layout;return q.layout;}
   throw Error('Unexpected operation '+name+' '+p.p_action);
  }});await q.chat.mount(document.querySelector('#chatHarness'));
 });
 // Reproduce the reported defect with a long list, selecting a channel near its bottom.
 const before=await page.locator('.chat-channel-list').evaluate(el=>{el.scrollTop=el.scrollHeight;return el.scrollTop;});assert(before>500);
 await page.locator('[data-chat=open][data-id=c79]').click();await page.locator('#chatBody').waitFor();
 assert(Math.abs(await page.locator('.chat-channel-list').evaluate(el=>el.scrollTop)-before)<2,'Opening a bottom channel preserves navigation position');
 await chatAction(page,'refresh');assert(Math.abs(await page.locator('.chat-channel-list').evaluate(el=>el.scrollTop)-before)<2,'Refresh preserves navigation position');
 await chatAction(page,'favourite');await page.waitForFunction(()=>workspaceQA.channels[79].favourite);
 assert.equal(await page.evaluate(()=>workspaceQA.channels[79].notify_level),'mentions');
 assert.deepEqual(await page.evaluate(()=>workspaceQA.calls.find(c=>c.p?.p_action==='member_preferences').p.p_data),{channel_id:'c79',favourite:true},'Quick favourite cannot overwrite other preferences');
 await chatAction(page,'favourite');await page.waitForFunction(()=>!workspaceQA.channels[79].favourite);
 assert.equal(await page.locator('.chat-message-more').count(),0,'Message actions have no More dropdown');
 await page.locator('[data-chat=copy][data-id=m2]').hover();await page.waitForFunction(()=>getComputedStyle(document.querySelector('[data-chat=copy][data-id=m2]').closest('.chat-message-actions')).opacity==='1');
 await chatClick(page,page.locator('[data-chat=copy][data-id=m2]'));assert.equal(await page.evaluate(()=>workspaceQA.clipboard),'Gracias @Equipo de tienda. Lo revisamos hoy.');
 await chatAction(page,'channel-files');assert.equal(await page.locator('.chat-library-file').count(),1);
 await page.locator('[data-library-preview]').click();await page.getByText('Justificante de prueba ficticio',{exact:true}).waitFor();await page.locator('dialog [data-chat-close]').click();
 await page.evaluate(()=>workspaceQA.denied=['export']);await chatAction(page,'channel-files');assert.equal(await page.locator('[data-library-download]').count(),0);await page.locator('dialog [data-chat-close]').click();await page.evaluate(()=>workspaceQA.denied=[]);
 await page.locator('#chatBody').fill('Borrador que debe conservarse');
 // The shortcut works even when no chat input has focus.
 await page.locator('body').click({position:{x:2,y:2}});await page.keyboard.press('Control+k');await page.locator('#chatSwitchQuery').fill('Canal 078');await page.locator('#chatSwitchQuery').press('Enter');await page.getByRole('heading',{name:'Canal 078',exact:true}).waitFor();
 await chatAction(page,'switcher');await page.locator('#chatSwitchQuery').fill('Canal 079');await page.locator('#chatSwitchQuery').press('Enter');assert.equal(await page.locator('#chatBody').inputValue(),'Borrador que debe conservarse');await page.locator('#chatBody').fill('');
 await page.screenshot({path:'artifacts/ui_chat_workspace_pc.png',fullPage:true});
 for(const width of [320,390,700,768,900,1180,1440,1920]){
  await page.setViewportSize({width,height:900});
  if(width<=700){assert.equal(await page.locator('.chat-sidebar').isVisible(),false,'Mobile opens only the conversation');await chatAction(page,'mobile-channels');assert.equal(await page.locator('.chat-conversation').isVisible(),false);const pos=await page.locator('.chat-channel-list').evaluate(el=>{el.scrollTop=el.scrollHeight;return el.scrollTop;});await page.locator('[data-chat=open][data-id=c79]').click();await chatAction(page,'mobile-channels');assert(Math.abs(await page.locator('.chat-channel-list').evaluate(el=>el.scrollTop)-pos)<2,'Mobile back preserves list position');await page.locator('[data-chat=open][data-id=c79]').click();}
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal page overflow at '+width);
  assert(await page.locator('#chatBody').isVisible());
  if(width===390)await page.screenshot({path:'artifacts/ui_chat_workspace_movil.png',fullPage:true});
 }
 await page.setViewportSize({width:1440,height:1000});await revealChatFilters(page);assert(await page.locator('[data-chat-input=archived]').isVisible());
 // Presentation fixture only: all operations above used the full eighty-channel list.
 await page.evaluate(()=>{
  const q=workspaceQA,chosen=[q.channels[40],q.channels[41],q.channels[79],q.channels[42],q.channels[0],q.channels[1],q.channels[2],q.channels[78]];
  const labels=['💶 Cierre de cajas','🧾 Gastos y facturas','📦 Pedidos clientes','🚚 Recepciones','💶 Cierre de cajas','📦 Pedidos clientes','📋 Productos','Equipo de tienda'];
  chosen.forEach((c,i)=>{c.name=labels[i];c.group_name=i<4?'Hortimatic':i<7?'NewOldSmok':'Mensajes directos';c.channel_kind=i===7?'direct':'channel';});chosen[1].unread=3;
  q.channels=chosen;q.layout={group_order:['Hortimatic','NewOldSmok','Mensajes directos']};
 });
 await chatAction(page,'refresh');await page.locator('.chat-browser-options>summary').click();
 await page.screenshot({path:'artifacts/ui_chat_workspace_diseno_pc.png',fullPage:true});
 await page.evaluate(()=>workspaceQA.owner='other@qa.invalid');await page.locator('body').click({position:{x:2,y:2}});await page.keyboard.press('Control+k');assert.equal(await page.locator('dialog').count(),0,'A stale session cannot open the old channel directory');
 await page.evaluate(()=>workspaceQA.chat.reset());await page.keyboard.press('Control+k');assert.equal(await page.locator('dialog').count(),0,'Shortcut is removed on disposal');
 assert.deepEqual(errors,[]);console.log('CHAT WORKSPACE QA: long-list scroll, mobile back, filters, scoped favourites, copy, file integrity/permissions, global switcher, drafts and eight widths OK');
}finally{await browser.close();}
