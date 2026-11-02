import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
try{
 for(const [width,height] of [[831,740],[1440,800],[1440,600],[390,844],[390,600]]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/tests/app-mock.html?module=inicio',{waitUntil:'networkidle'});
  await page.locator('[data-account-open]').waitFor();
  await page.evaluate(async()=>{
   const {renderers}=await import('../src/pages/main.js');const {createTeamChat}=await import('../src/team-chat-ui.js');document.querySelector('#pageTitle').textContent='Chat';document.querySelector('#content').innerHTML=renderers.equipo();
   const channels=[{id:'fit-channel',name:'Canal de ensayo',group_name:'Equipo',member_role:'manager',last_read_seq:100}],messages=Array.from({length:30},(_,i)=>({id:'message-'+i,seq:i+1,channel_id:'fit-channel',body:'Mensaje ficticio '+i+' '+('Contenido '.repeat(20)),author_email:'qa@example.com',created_at:'2026-11-02T10:00:00Z'}));
   window.fitController=createTeamChat({actor:()=> 'qa@example.com',rpc:async(name,p)=>{if(name==='totus_chat_context')return {channels,messages:p.p_channel?messages:[],members:[{email:'qa@example.com',member_role:'manager'}],directory:[{email:'qa@example.com',name:'Administración QA'}],layout:{}};if(name==='totus_chat_command')return {};throw Error(name);}});await window.fitController.mount(document.querySelector('#teamChatRoot'));
  });
  await page.locator('[data-chat=open][data-id=fit-channel]').click();await page.locator('#chatBody').waitFor();
  const metrics=()=>page.evaluate(()=>{const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height}};return {scroll:scrollY,height:innerHeight,root:box('.team-chat'),compose:box('.chat-compose'),messages:box('.chat-messages')}});
  await page.waitForTimeout(150);let m=await metrics();assert.equal(m.scroll,0,'Page must start without needing document scroll '+JSON.stringify(m));assert(m.compose.bottom<=height+1,'Composer must fit the full application shell '+JSON.stringify(m));assert(m.messages.height>=50,'Messages retain a readable area '+JSON.stringify(m));
  await page.locator('#chatBody').fill('Borrador sin enviar');await page.waitForTimeout(80);m=await metrics();assert(m.compose.bottom<=height+1,JSON.stringify(m));
  await page.evaluate(()=>window.scrollTo(0,200));await page.waitForTimeout(150);m=await metrics();assert(m.root.bottom<=height+1,'Scroll must not grow the workspace '+JSON.stringify(m));assert(m.scroll<=2,'Chat must not create a second document scrollbar '+JSON.stringify(m));
  if(width<1100){await page.locator('[data-chat=mobile-channels]').click();assert.equal(await page.locator('.chat-conversation').isVisible(),false,'Channel list must remain separate on narrow screens');await page.locator('[data-chat=open][data-id=fit-channel]').click();assert.equal(await page.locator('#chatBody').inputValue(),'Borrador sin enviar');}
  await mkdir('artifacts/chat-fit',{recursive:true});await page.screenshot({path:'artifacts/chat-fit/'+width+'x'+height+'.png'});assert.deepEqual(errors,[]);await page.close();
 }
 console.log('CHAT SHELL FIT QA: actual app header, desktop and mobile, draft, focus and document scroll.');
}finally{await browser.close();}
