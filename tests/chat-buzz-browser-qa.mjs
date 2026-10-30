import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {chatAction} from './chat-menu-helper.mjs';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}});
try{
 await page.goto('http://127.0.0.1:4173/tests/chat-harness.html');
 await page.evaluate(async()=>{
  const {createTeamChat}=await import('../src/team-chat-ui.js');const q=window.buzzQA={messages:[],layout:{},calls:[],denied:false};
  q.c=createTeamChat({actor:()=> 'me@qa.invalid',can:a=>a!=='create'||!q.denied,confirm:async()=>true,rpc:async(name,p)=>{
   q.calls.push({name,p});if(name==='totus_chat_context')return {channels:[{id:'a',name:'Prueba',member_role:'member',last_read_seq:99}],messages:p.p_channel?q.messages:[],members:[],layout:q.layout};
   if(name==='totus_chat_buzz'){q.messages.push({id:'buzz',seq:1,body:'🔔 Zumbido',author_email:'me@qa.invalid',created_at:new Date().toISOString()});return q.messages[0];}
   if(name==='totus_chat_save_layout'){q.layout=p.p_layout;return q.layout;}if(name==='totus_chat_command'&&p.p_action==='read')return {};
   throw Error('Unexpected '+name);
  }});await q.c.mount(document.querySelector('#chatHarness'));
 });
 await page.locator('[data-chat=open][data-id=a]').click();await page.locator('#chatBody').fill('Mensaje sin enviar');await page.locator('[data-chat=buzz]').click();
 await page.getByText('Zumbido enviado.',{exact:false}).waitFor();assert.equal(await page.locator('#chatBody').inputValue(),'Mensaje sin enviar','Buzz preserves the pending draft');
 assert.equal(await page.evaluate(()=>buzzQA.calls.filter(c=>c.name==='totus_chat_buzz').length),1);
 await chatAction(page,'alerts');await page.locator('[name=chat_background]').selectOption('color');await page.locator('[name=chat_background_color]').fill('#112233');await page.locator('dialog [type=submit]').click();assert.equal(await page.locator('.chat-messages').evaluate(el=>el.style.backgroundColor),'rgb(17, 34, 51)');assert.equal(await page.locator('.chat-messages').evaluate(el=>getComputedStyle(el).backgroundImage),'none','The default gradient must not cover the selected color');
 await page.evaluate(()=>{buzzQA.denied=true;});await page.locator('[data-chat=buzz]').click();await page.getByRole('alert').getByText(/No puedes enviar/).waitFor();assert.equal(await page.evaluate(()=>buzzQA.calls.filter(c=>c.name==='totus_chat_buzz').length),1);
 await page.evaluate(()=>buzzQA.c.reset());console.log('Chat buzz browser QA: explicit button, correct RPC, retained draft, background save and permission guard OK');
}finally{await browser.close();}
