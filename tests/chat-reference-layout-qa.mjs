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
  window.referenceLayout={};
  window.referenceChat=createTeamChat({actor:()=> 'admin@qa.invalid',rpc:async(name,p)=>{
   if(name==='totus_chat_save_layout'){window.referenceLayout=structuredClone(p.p_layout);return window.referenceLayout;}
   if(name==='totus_chat_command')return {};
   if(name!=='totus_chat_context')throw Error('Unexpected write');
   return {channels:[{id:'c',name:'📦 Pedidos clientes',group_name:'Hortimatic',member_role:'manager',last_read_seq:3}],members:[],directory:[{email:'store@qa.invalid',name:'Equipo de tienda'},{email:'admin@qa.invalid',name:'Administración'}],messages:[
    {id:'one',seq:1,author_email:'store@qa.invalid',body:'Pedido preparado para recoger en tienda.',created_at:'2026-10-27T22:50:00Z',reactions:[{emoji:'✅',email:'admin@qa.invalid'}]},
    {id:'two',seq:2,author_email:'admin@qa.invalid',body:'Confirmado. Avisamos al cliente cuando llegue el resto.',created_at:'2026-10-27T23:05:00Z',reactions:[]},
    {id:'three',seq:3,author_email:'store@qa.invalid',body:'Referencia: '+('producto-muy-largo-'.repeat(35))+'\nEl justificante se conserva en el mismo mensaje.',created_at:'2026-10-27T23:15:00Z',reactions:[],files:[{id:'f',original_name:'Documento de prueba.pdf',size_bytes:1024,status:'ready',mime_type:'application/pdf'}]}
   ],layout:window.referenceLayout};
  }});await referenceChat.mount(document.querySelector('#chatHarness'));
 });
 await page.locator('[data-chat=open][data-id=c]').click();
 assert.equal(await page.locator('.chat-day-divider').count(),2,'Days follow Madrid midnight, not UTC');
 assert.equal(await page.locator('.chat-avatar').first().innerText(),'ED');
 assert.equal(await page.locator('.chat-message').count(),3);assert.equal(await page.locator('.chat-file').count(),1);
 await page.locator('.chat-heading h2').hover();assert.equal(await page.locator('[data-message=two] .chat-message-actions').evaluate(el=>getComputedStyle(el).opacity),'0');
 await page.locator('[data-message=two] .chat-body').hover();await page.waitForFunction(()=>getComputedStyle(document.querySelector('[data-message=two] .chat-message-actions')).opacity==='1');
 assert.equal(await page.locator('[data-message=two] summary').count(),0,'All message actions are direct, without More');await page.locator('[data-message=two] [data-chat=edit]').focus();assert.equal(await page.locator('[data-message=two] [data-chat=edit]').isVisible(),true);
 await page.locator('.chat-heading h2').click();
 for(const width of [320,390,700,768,900,1024,1440,1920]){
  await page.setViewportSize({width,height:1000});
  const geometry=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:innerWidth,pane:document.querySelector('.chat-messages').scrollWidth,client:document.querySelector('.chat-messages').clientWidth}));
  assert(geometry.page<=geometry.viewport+2);assert(geometry.pane<=geometry.client+2,'Long messages cannot widen the pane');
  await page.screenshot({path:'artifacts/chat_limpio_'+width+'.png',fullPage:true});
 }
 await page.setViewportSize({width:900,height:1000});await page.locator('[data-chat=sidebar-toggle]').click();await page.waitForFunction(()=>getComputedStyle(document.querySelector('.team-chat')).gridTemplateColumns.startsWith('48px'));
 await page.locator('[data-chat=sidebar-toggle]').click();await page.waitForFunction(()=>!document.querySelector('.team-chat').classList.contains('chat-sidebar-collapsed'));
 await page.setViewportSize({width:390,height:1000});await page.locator('[data-chat=mobile-channels]').click();await page.locator('[data-chat=sidebar-toggle]').click();assert.equal(await page.locator('.chat-sidebar').evaluate(el=>Math.round(el.getBoundingClientRect().height)),48);
 await page.locator('[data-chat=sidebar-toggle]').click();
 assert.deepEqual(errors,[]);await page.evaluate(()=>referenceChat.reset());
 console.log('CHAT REFERENCE LAYOUT QA: Madrid day grouping, avatars, preserved files, hover/keyboard actions and long messages at eight widths OK');
}finally{await browser.close();}
