import {chatAction} from './chat-menu-helper.mjs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4173/tests/chat-harness.html');
 await page.evaluate(async()=>{
  window.Notification=class{static permission='granted';static requestPermission(){return Promise.resolve('granted');}constructor(){window.desktopTests=(window.desktopTests||0)+1;}close(){}};
  const {createTeamChat}=await import('../src/team-chat-ui.js');
  const q=window.alertQA={layout:{},channels:[{id:'a',name:'Cajas',group_name:'Hortimatic',channel_kind:'channel',member_role:'manager',unread:0}],calls:[]};
  q.controller=createTeamChat({actor:()=> 'qa@qa.invalid',confirm:async()=>true,onAlerts:x=>q.updated=x,rpc:async(name,p)=>{
   q.calls.push({name,p});if(name==='totus_chat_context')return structuredClone({channels:q.channels,messages:[],members:[],layout:q.layout});
   if(name==='totus_chat_save_layout'){q.layout=structuredClone(p.p_layout);return q.layout;}
   if(name==='totus_chat_command'&&p.p_action==='channel_update'){Object.assign(q.channels[0],p.p_data);return q.channels[0];}
   throw Error('Unexpected call '+name);
  }});await q.controller.mount(document.querySelector('#chatHarness'));
 });
 const click=action=>chatAction(page,action);
 await click('alerts');await page.locator('[data-test-sound]').click();await page.getByText(/Sonido de prueba emitido/).waitFor();await page.locator('[data-test-desktop]').click();assert.equal(await page.evaluate(()=>window.desktopTests),1);
 await page.locator('[name="sound_enabled"]').selectOption('true');await page.locator('[name="desktop_enabled"]').selectOption('true');await page.locator('dialog [type="submit"]').click();await page.waitForFunction(()=>alertQA.updated?.sound_enabled===true&&alertQA.layout.desktop_enabled===true);
 await click('alerts');assert.equal(await page.locator('[name="sound_enabled"]').inputValue(),'true');await page.locator('[name="sound_enabled"]').selectOption('false');await page.locator('[name="desktop_enabled"]').selectOption('false');await page.locator('dialog [type="submit"]').click();await page.waitForFunction(()=>alertQA.layout.desktop_enabled===false&&alertQA.layout.sound_enabled===false);
 await page.locator('[data-chat="open"][data-id="a"]').click();await click('settings');await page.locator('[name="icon"]').selectOption('💶');await page.locator('dialog [type="submit"]').click();await page.waitForFunction(()=>alertQA.channels[0].name==='💶 Cajas');await page.getByRole('heading',{name:'💶 Cajas',exact:true}).waitFor();
 await click('settings');assert.equal(await page.locator('[name="icon"]').inputValue(),'💶');assert.equal(await page.locator('[name="name"]').inputValue(),'Cajas');await page.locator('[name="icon"]').selectOption('');await page.locator('dialog [type="submit"]').click();await page.waitForFunction(()=>alertQA.channels[0].name==='Cajas');
 // Denied permissions give an explanation and do not save false success.
 await page.evaluate(()=>Notification.permission='denied');await click('alerts');await page.locator('[data-test-desktop]').click();await page.getByText(/Avisos no autorizados/).waitFor();
 for(const width of [320,390,768,1024,1440,1920]){
  await page.setViewportSize({width,height:1000});assert(await page.locator('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+2));
  await page.screenshot({path:'artifacts/ui_chat_avisos_'+width+'.png',fullPage:true});
 }
 assert.deepEqual(errors,[]);await page.evaluate(()=>alertQA.controller.reset());
 console.log('CHAT ALERTS BROWSER QA: save opt-in/out, permission feedback, sound/desktop tests, shared icon edition and mobile forms OK');
}finally{await browser.close();}
