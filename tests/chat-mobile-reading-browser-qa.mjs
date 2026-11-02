import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('artifacts/mobile-audit',{recursive:true});
const browser=await chromium.launch({headless:true}),results=[];
try{
 for(const [width,height] of [[320,640],[390,844],[430,932],[700,900],[390,360],[844,390]]){
 const page=await browser.newPage({viewport:{width,height}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/tests/chat-harness.html');
 for(const css of ['interface-design','appearance','stitch-design'])await page.addStyleTag({url:'http://127.0.0.1:4173/src/'+css+'.css'});
  await page.evaluate(async()=>{
  const {createTeamChat}=await import('../src/team-chat-ui.js');
  const q=window.integral={owner:'admin@qa.invalid',calls:[],messages:[],members:[{email:'admin@qa.invalid',member_role:'manager'}],channels:[{id:'a',name:'Canal A',group_name:'Equipo',member_role:'manager',last_read_seq:9999},{id:'b',name:'Canal B',group_name:'Equipo',member_role:'manager',last_read_seq:9999}],layout:{}};
  for(let i=1;i<=30;i++)q.messages.push({id:'m'+i,seq:i,channel_id:'a',body:'Mensaje '+i+' '+('contenido '.repeat(25)),author_email:'other@qa.invalid',created_at:'2026-10-29T10:00:00Z'});
  q.c=createTeamChat({actor:()=>q.owner,confirm:async()=>true,subscribe:(_id,fn)=>{q.notify=fn;return()=>{};},rpc:async(name,p)=>{
   q.calls.push({name,p:structuredClone(p)});
   if(name==='totus_chat_context')return structuredClone({channels:q.channels,messages:q.messages.filter(m=>m.channel_id===p.p_channel),members:q.members,directory:[{email:q.owner,name:'Administración'},{email:'other@qa.invalid',name:'Compañero'}],layout:q.layout});
   if(name==='totus_chat_command'){
    const d=p.p_data;
    if(p.p_action==='send'){if(q.holdSend)await new Promise(resolve=>q.releaseSend=resolve);const m={...d,id:crypto.randomUUID(),seq:q.messages.length+1,author_email:q.owner,created_at:new Date().toISOString()};q.messages.push(m);return m;}
    if(p.p_action==='agent_request'){if(q.failRequest)throw Error('Ensayo de permiso denegado');const m=q.messages.find(m=>m.id===d.message_id);m.agent_request={id:'request',status:'pending'};return {};}
    if(p.p_action==='read')return {};
   }
   throw Error('Operación de ensayo inesperada: '+name);
  }});await q.c.mount(document.querySelector('#chatHarness'));
 });

 await page.locator('[data-chat="open"][data-id="a"]').click();
 await page.locator('#chatBody').waitFor();
 await page.addStyleTag({content:'body{padding:8px;max-width:650px;margin:auto}'});
 const metric=()=>page.evaluate(()=>{const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height,width:r.width}};return {messages:box('.chat-messages'),header:box('.chat-heading'),compose:box('.chat-compose'),root:box('.team-chat'),width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth};});
 await page.waitForTimeout(80);
 let m=await metric();results.push({width,height,...m});console.log(JSON.stringify(results.at(-1)));await page.screenshot({path:"artifacts/mobile-audit/chat-"+width+"x"+height+".png"});
 assert(m.messages.height>=(height<500?90:300),'Reading space collapsed '+JSON.stringify(m));
 assert(m.compose.bottom<=height+1,'Editor outside viewport');assert(m.scroll<=width+2,'Horizontal page overflow');
 await page.locator('#chatBody').fill('Borrador móvil ficticio');
 if(width<=700&&height>500){
 await page.locator('[data-chat="compose-tools"]').click();
 assert.equal(await page.locator('#chatBody').inputValue(),'Borrador móvil ficticio');
 for(const selector of ['#chatFiles','#chatMention','[data-chat="buzz"]','[name="request_chatgpt"]','[name="request_totus_ai"]'])assert(await page.locator(selector).isVisible(),selector+' inaccessible');
 await page.locator('[data-chat="compose-tools"]').click();
 await page.locator('[data-chat="message-tools"][data-id="m30"]').click();
 assert(await page.locator('[data-chat="quote"][data-id="m30"]').isVisible());
 await page.locator('[data-chat="message-tools"][data-id="m30"]').click();
 }
 await page.locator('[data-chat=mobile-channels]').click();await page.locator('[data-chat=open][data-id=a]').click();assert.equal(await page.locator('#chatBody').inputValue(),'Borrador móvil ficticio');
 await page.screenshot({path:'artifacts/mobile-audit/chat-'+width+'x'+height+'.png'});
 assert.deepEqual(errors,[]);await page.close();
 }
 await writeFile('artifacts/mobile-audit/reading.json',JSON.stringify(results,null,2));
 console.log('CHAT MOBILE: six sizes, reading space, editor, draft, assistant sends, attachments and message actions verified');
}finally{await browser.close();}
