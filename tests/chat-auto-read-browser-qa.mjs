import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/tests/chat-harness.html');
 await page.evaluate(async()=>{
  const {createTeamChat}=await import('../src/team-chat-ui.js');
  const q=window.readQA={calls:[],fail:false,hidden:false,channels:[{id:'a',name:'Canal A',group_name:'Equipo',member_role:'member',last_read_seq:0,last_seq:1,unread:1},{id:'b',name:'Canal B',group_name:'Equipo',member_role:'member',last_read_seq:0,last_seq:0,unread:0}],messages:[{id:'one',channel_id:'a',seq:1,body:'Mensaje visible',author_email:'other@qa.invalid',created_at:'2026-10-27T10:00:00Z'}]};
  Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>q.hidden?'hidden':'visible'});
  q.controller=createTeamChat({actor:()=> 'reader@qa.invalid',rpc:async(name,p)=>{
   if(name==='totus_chat_context')return structuredClone({channels:q.channels,messages:q.messages.filter(m=>m.channel_id===p.p_channel),members:[]});
   assertRead(name,p);
   q.calls.push(structuredClone(p));if(q.fail)throw Error('Ensayo de desconexión');
   const c=q.channels.find(c=>c.id===p.p_data.channel_id);c.last_read_seq=p.p_data.seq;c.unread=0;return {};
  }});
  function assertRead(name,p){if(name!=='totus_chat_command'||p.p_action!=='read')throw Error('Operación inesperada');}
  await q.controller.mount(document.querySelector('#chatHarness'));
 });
 const open=id=>page.locator('[data-chat="open"][data-id="'+id+'"]').click();
 await open('a');await page.waitForFunction(()=>readQA.channels[0].last_read_seq===1);
 assert.equal(await page.locator('.chat-unread-total').innerText(),'0 sin leer');
 // Background tabs cannot acknowledge incoming messages.
 await page.evaluate(()=>{readQA.hidden=true;readQA.messages.push({...readQA.messages[0],id:'two',seq:2});readQA.channels[0].last_seq=2;readQA.channels[0].unread=1;});
 await page.locator('[data-chat="refresh"]').click();await page.waitForTimeout(500);
 assert.equal(await page.evaluate(()=>readQA.channels[0].last_read_seq),1);
 await page.evaluate(()=>{readQA.hidden=false;document.dispatchEvent(new Event('visibilitychange'));});
 await page.waitForFunction(()=>readQA.channels[0].last_read_seq===2);
 // Filters don't mark a whole channel as read; clearing does.
 await page.locator('#chatQuery').fill('visible');await page.locator('[data-chat="search"]').click();
 await page.evaluate(()=>{readQA.messages.push({...readQA.messages[0],id:'three',seq:3});readQA.channels[0].last_seq=3;});
 await page.locator('[data-chat="refresh"]').click();await page.waitForTimeout(500);
 assert.equal(await page.evaluate(()=>readQA.channels[0].last_read_seq),2);
 await page.locator('[data-chat="clear"]').click();await page.waitForFunction(()=>readQA.channels[0].last_read_seq===3);
 // A failed write must not claim success or lose the composer.
 await page.evaluate(()=>{readQA.fail=true;readQA.messages.push({...readQA.messages[0],id:'four',seq:4});readQA.channels[0].last_seq=4;});
 await page.locator('#chatBody').fill('Borrador sin enviar');await page.locator('[data-chat="refresh"]').click();await page.waitForTimeout(500);
 assert.equal(await page.evaluate(()=>readQA.channels[0].last_read_seq),3);assert.equal(await page.locator('#chatBody').inputValue(),'Borrador sin enviar');
 await page.evaluate(()=>{readQA.fail=false;document.dispatchEvent(new Event('visibilitychange'));});await page.waitForFunction(()=>readQA.channels[0].last_read_seq===4);
 // Do not acknowledge messages while reading the older end of a long history.
 await page.evaluate(()=>{for(let i=5;i<=80;i++)readQA.messages.push({...readQA.messages[0],id:'m'+i,seq:i,body:'Historial '+i+' '+('Texto '.repeat(20))});readQA.channels[0].last_read_seq=80;readQA.channels[0].last_seq=80;});
 await page.locator('[data-chat="refresh"]').click();await page.locator('[data-chat="scroll-top"]').click();
 await page.evaluate(()=>{readQA.messages.push({...readQA.messages[0],id:'latest',seq:81});readQA.channels[0].last_seq=81;});
 await page.locator('[data-chat="refresh"]').click();await page.waitForTimeout(500);
 assert.equal(await page.evaluate(()=>readQA.channels[0].last_read_seq),80);
 await page.locator('[data-chat="scroll-bottom"]').click();await page.waitForFunction(()=>readQA.channels[0].last_read_seq===81);
 // Switching channel before the debounce must not acknowledge the abandoned channel.
 await page.evaluate(()=>{readQA.messages.push({...readQA.messages[0],id:'not-seen',seq:82});readQA.channels[0].last_seq=82;});
 await page.locator('[data-chat="refresh"]').click();await open('b');await page.waitForTimeout(500);
 assert.equal(await page.evaluate(()=>readQA.channels[0].last_read_seq),81);
 await page.evaluate(()=>readQA.controller.dispose());assert.deepEqual(errors,[]);
 console.log('CHAT AUTO READ QA: visible, hidden, filters, retry, draft, scroll and channel isolation verified.');
}finally{await browser.close();}
