import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{
 for(const mode of ['saved','absent','error']){
  const page=await browser.newPage();let release;
  const gate=new Promise(resolve=>release=resolve);
  await page.route('**/tests/mock-supabase.js',async route=>{
   const response=await route.fetch();let text=await response.text();
   const result=mode==='saved'?'return {data:{session},error:null}':mode==='absent'?'return {data:{session:null},error:null}':"throw new Error('Conexión de ensayo no disponible')";
   text=text.replace('getSession:async()=>({data:{session},error:null})','getSession:async()=>{await window.__qaSessionGate();'+result+'}');
   await route.fulfill({response,body:text});
  });
  await page.exposeFunction('__qaSessionGate',()=>gate);
  await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('#loginEmail').isVisible(),false,'Must not ask for credentials while checking a saved session');
  assert.match(await page.locator('#loginMessage').innerText(),/Comprobando tu acceso/);
  release();
  if(mode==='saved')await page.locator('#userCard').waitFor({state:'visible'});
  else{
   await page.locator('#loginEmail').waitFor({state:'visible'});
   assert.equal(await page.locator('#app').isVisible(),false);
   if(mode==='error')assert.match(await page.locator('#loginMessage').innerText(),/Conexión de ensayo/);
  }
  await page.close();
 }
 console.log('SESSION STARTUP BROWSER QA: delayed saved session, signed-out session and connection failure resolve to the right screen');
}finally{await browser.close()}
