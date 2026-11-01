import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import {chatAction} from './chat-menu-helper.mjs';
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto('http://127.0.0.1:4173/tests/chat-harness.html');
 await page.evaluate(async()=>{
  const {createTeamChat}=await import('../src/team-chat-ui.js');
  const q=window.navigationQA={calls:[],layout:{},notify:()=>{}};
  q.chat=createTeamChat({actor:()=> 'admin@qa.invalid',subscribe:(_id,fn)=>{q.notify=fn;return()=>{};},rpc:async(name,p)=>{
   q.calls.push({name,p});
   if(name==='totus_chat_context')return {channels:[{id:'a',name:'📦 Pedidos clientes',group_name:'Hortimatic',member_role:'manager',last_read_seq:100}],members:[],directory:[],messages:[],layout:q.layout};
   if(name==='totus_chat_save_layout'){q.layout=p.p_layout;return q.layout;}
   throw Error('Unexpected write '+name);
  }});await q.chat.mount(document.querySelector('#chatHarness'));
 });
 await page.locator('#chatMenu-create').click();assert(await page.locator('[data-chat=new]').isVisible());
 await page.keyboard.press('Escape');assert.equal(await page.locator('[data-chat=new]').isVisible(),false);
 await page.locator('#chatMenu-create').click();await page.locator('#chatMenu-general').click();assert.equal(await page.locator('details[data-chat-menu][open]').count(),1);
 await chatAction(page,'shortcuts');assert.equal(await page.locator('details[data-chat-menu][open]').count(),0);await page.locator('dialog [data-chat-close]').click();
 await page.locator('[data-chat=open]').click();assert.equal(await page.locator('#chatQuery').isVisible(),false);
 await chatAction(page,'search-toggle');await page.locator('#chatQuery').fill('pedido');
 await chatAction(page,'search-toggle');await page.keyboard.press('Alt+/');assert.equal(await page.locator('#chatQuery').inputValue(),'pedido');assert(await page.locator('#chatQuery').evaluate(el=>el===document.activeElement));
 await chatAction(page,'search-toggle');
 await page.locator('#chatBody').fill('Hola ');await chatAction(page,'emoji');await page.locator('[data-emoji-insert="👍"]').click();assert.equal(await page.locator('#chatBody').inputValue(),'Hola 👍');
 await chatAction(page,'emoji');await page.locator('dialog').press('Alt+/');assert(await page.locator('dialog').isVisible(),'Search shortcut must not discard an open dialog');await page.locator('dialog [data-chat-close]').click();
 await page.locator('#chatMenu-channel').click();const before=await page.evaluate(()=>navigationQA.calls.length);await page.evaluate(()=>navigationQA.notify());await page.waitForFunction(n=>navigationQA.calls.length>n,before);
 assert(await page.locator('[data-chat=members]').isVisible(),'A refresh preserves the open menu');
 await page.keyboard.press('Escape');assert.equal(await page.locator('[data-chat=members]').isVisible(),false);assert.equal(await page.locator('#chatBody').inputValue(),'Hola 👍');
 assert.equal(await page.evaluate(()=>navigationQA.calls.some(c=>c.name==='totus_chat_command')),false,'Navigation and emoji do not save or send messages');
 for(const width of [320,390,700,768,900,1180,1440,1920]){
  await page.setViewportSize({width,height:900});await page.locator('#chatMenu-channel').click();
  const box=await page.locator('[data-chat-menu=channel] .chat-menu-panel').boundingBox();assert(box.x>=0&&box.x+box.width<=width+1,'Channel menu stays inside viewport '+JSON.stringify({width,box}));
  assert(await page.locator('[data-chat=settings]').isVisible());
  await page.keyboard.press('Escape');assert(await page.locator('#chatBody').isVisible());
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:'artifacts/chat_navegacion_'+width+'.png',fullPage:true});
 }
 const draftBeforeResize=await page.locator('#chatBody').inputValue();
 for(const height of [844,420]){
  await page.setViewportSize({width:390,height});
  const channel=page.locator('[data-chat=open]');if(await channel.isVisible())await channel.click();
  await page.waitForFunction(()=>{const root=document.querySelector('.team-chat'),v=visualViewport;return root&&parseFloat(root.style.getPropertyValue('--chat-visible-height'))===Math.max(180,Math.floor((v?.offsetTop||0)+(v?.height||innerHeight)-Math.max(root.getBoundingClientRect().top,v?.offsetTop||0)-12));});
  const geometry=await page.locator('.chat-conversation').evaluate(el=>({height:el.getBoundingClientRect().height,available:parseFloat(el.closest('.team-chat').style.getPropertyValue('--chat-visible-height'))}));
  assert(geometry.height<=geometry.available+2,'Mobile conversation fits available screen: '+JSON.stringify(geometry));
  assert.equal(await page.locator('#chatBody').inputValue(),draftBeforeResize,'Resizing must preserve the draft');
 }
 await page.evaluate(()=>navigationQA.chat.reset());assert.deepEqual(errors,[]);
 console.log('CHAT NAVIGATION QA: menus, keyboard, search, emoji, refresh, drafts, no writes and eight responsive sizes OK');
}finally{await browser.close();}
