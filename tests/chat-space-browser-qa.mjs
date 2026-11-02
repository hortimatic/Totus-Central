import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import {clickModuleLink} from './ui-navigation.mjs';
const browser=await chromium.launch({headless:true}),page=await browser.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await mkdir('artifacts/chat-space',{recursive:true});
 await page.setViewportSize({width:1337,height:660});
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await page.locator('#nav [data-route=equipo]').waitFor();
 await page.evaluate(async()=>{
  const {sb}=await import('../src/api.js'),{applyInterfaceAppearance}=await import('../src/appearance-ui.js');
  applyInterfaceAppearance({fontSize:16,sidebarWidth:300,topbarHeight:56,borderWidth:3,cardGlow:12});
  const original=sb.rpc.bind(sb),channels=Array.from({length:16},(_,i)=>({id:'space-'+i,name:'Conversación de prueba '+i,group_name:i<8?'Hortimatic':'NewOldSmok',member_role:'manager'}));
  sb.rpc=async(name,args)=>name==='totus_chat_ai_accounts'?{data:[],error:null}:['totus_chat_context','totus_chat_personalized_context','totus_chat_notification_context'].includes(name)?{data:{channels,messages:[{id:'space-message',channel_id:args?.p_channel,seq:1,author_email:'qa@example.com',body:'Mensaje ficticio para verificar espacio de lectura.',created_at:new Date().toISOString(),files:[],reactions:[]}],members:[{email:'qa@example.com',member_role:'manager'}],directory:[],layout:{}},error:null}:name==='totus_chat_command'?{data:{},error:null}:original(name,args);
 });
 await clickModuleLink(page,page.locator('#nav [data-route=equipo]'));
 await page.locator('[data-chat=open][data-id=space-0]').click();await page.locator('#chatBody').waitFor();
 await page.evaluate(async()=>{const {applyInterfaceAppearance}=await import('../src/appearance-ui.js');applyInterfaceAppearance({fontSize:16,sidebarWidth:300,topbarHeight:56,borderWidth:3,cardGlow:12});});
 for(const width of [1337,1017,934,390]){
  await page.setViewportSize({width,height:660});await page.waitForTimeout(80);
  const box=await page.evaluate(()=>{const rect=s=>{const e=document.querySelector(s),r=e.getBoundingClientRect();return {height:r.height,bottom:r.bottom,width:r.width,visible:getComputedStyle(e).display!=='none'};};return {list:rect('.chat-channel-list'),reading:rect('.chat-messages'),header:rect('.chat-heading'),compose:rect('.chat-compose'),controls:rect('.chat-sidebar-controls'),send:rect('.chat-send-actions .primary'),scroll:document.documentElement.scrollWidth};});
  assert.equal(await page.locator('.module-heading').isVisible(),false,'no duplicate page heading');
  assert(box.header.height<90,'single compact conversation header');assert(box.reading.height>=260,'reading pane retains priority '+JSON.stringify({width,...box}));assert(box.send.bottom<=661,'send stays visible');assert(box.scroll<=width+1,'no page overflow');
  if(width>=1017){assert(await page.locator('.chat-sidebar').isVisible(),'channels stay beside reading at '+width);assert(box.list.height>=350,'channels retain majority of height');assert(box.controls.height<=160,'compact channel controls');}
  await page.screenshot({path:'artifacts/chat-space/'+width+'.png'});
 }
 assert.deepEqual(errors,[]);console.log('CHAT SPACE: 1337/1017/934/390 x 660; no duplicate heading, compact controls, channels and reading retain priority, Send visible.');
}finally{await browser.close();}
