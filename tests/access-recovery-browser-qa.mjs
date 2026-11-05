import assert from 'node:assert/strict';
import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer();
const {chromium}=await import(process.env.TOTUS_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.TOTUS_BROWSER_CHANNEL?{channel:process.env.TOTUS_BROWSER_CHANNEL}:{})});
try{
 for(const width of [390,1440])for(const phase of ['session','member']){
  const page=await browser.newPage({viewport:{width,height:900}});
  let stalled=true;
  await page.addInitScript(()=>{const native=setTimeout;window.setTimeout=(fn,ms,...args)=>native(fn,ms===12000?150:ms,...args);localStorage.setItem('qa-preserved-session','keep');});
  await page.route('**/tests/mock-supabase.js',async route=>{
   const response=await route.fetch();let body=await response.text();
   if(stalled&&phase==='session')body=body.replace('getSession:async()=>({data:{session},error:null})','getSession:async()=>new Promise(()=>{})');
   if(stalled&&phase==='member')body=body.replace('then(ok,fail){','then(ok,fail){if(this.table==="team_members")return new Promise(()=>{});');
   await route.fulfill({response,body});
  });
  await page.goto('http://127.0.0.1:4173/tests/app-mock.html');
  await page.getByRole('button',{name:'Volver a intentar',exact:true}).waitFor();
  assert(await page.locator('#loginEmail').isVisible());
  assert.equal(await page.locator('#app').isVisible(),false);
  assert.match(await page.locator('#loginMessage').innerText(),/servicio de datos/i);
  assert.equal(await page.evaluate(()=>localStorage.getItem('qa-preserved-session')),'keep');
  stalled=false;
  await Promise.all([page.waitForNavigation(),page.getByRole('button',{name:'Volver a intentar',exact:true}).click()]);
  await page.locator('[data-account-open]').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>localStorage.getItem('qa-preserved-session')),'keep');
  await page.close();
 }
 console.log('ACCESS RECOVERY: stalled session/member checks restore the form, preserve storage and retry successfully at 390/1440');
}finally{await browser.close();await server?.close();}
