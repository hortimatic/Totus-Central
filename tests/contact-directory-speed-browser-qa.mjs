import assert from 'node:assert/strict';
import {startLocalServer} from './local-static-server.mjs';
const {chromium}=await import(process.env.TOTUS_PLAYWRIGHT_MODULE||'playwright');
const server=await startLocalServer(),browser=await chromium.launch({headless:true,channel:process.env.TOTUS_BROWSER_CHANNEL||(process.platform==='win32'?'msedge':undefined)});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 await page.goto('http://127.0.0.1:4173/tests/chat-harness.html');
 await page.evaluate(async()=>{
  const {createContactDirectoryUI,directoryPageHtml}=await import('../src/contact-directory-ui.js');
  const q=window.speedQA={addressStarted:0,addressRunning:0,peak:0,releases:[],languages:0,gateCustomers:false,releaseCustomers:null};
  document.querySelector('#chatHarness').innerHTML=directoryPageHtml('clientes','<p>Local</p>');
  q.ui=createContactDirectoryUI({actor:()=> 'owner',can:()=>true,rpc:async name=>name==='totus_directory_context'?{connections:[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'PrestaShop · Hortimatic',protocol:'prestashop',configured:true,enabled:true,revision:1,verified_revision:1,real_data_authorized:true}]}:null,invoke:async b=>{
   let rows=[];
   if(b.resource==='languages'){q.languages++;rows=[{id:'1',iso_code:'es',active:'1'}];}
   if(b.resource==='customers'){
    if(q.gateCustomers)await new Promise(resolve=>q.releaseCustomers=resolve);
    rows=Array.from({length:75},(_,i)=>({id:String(i+1),firstname:(q.gateCustomers?'Actualizado ':'Cliente ')+(i+1),lastname:'Prueba',active:'1'}));
   }
   if(b.resource==='addresses'){q.addressStarted++;q.addressRunning++;q.peak=Math.max(q.peak,q.addressRunning);await new Promise(resolve=>q.releases.push(resolve));q.addressRunning--;}
   return {...b,ok:true,rows,possibly_more:false};
  }});await q.ui.mount(document.querySelector('[data-directory-root]'));
 });
 await page.getByRole('button',{name:'Hortimatic',exact:true}).click();
 await page.waitForFunction(()=>speedQA.addressStarted===3);
 assert.equal(await page.locator('.directory-table tbody tr').count(),20,'Primary rows must appear before addresses return');
 assert.equal(await page.evaluate(()=>speedQA.peak),3,'Three independent batches overlap, no unbounded fan-out');
 await page.evaluate(()=>speedQA.releases.splice(0).forEach(resolve=>resolve()));
 await page.getByRole('status').filter({hasText:'75 registros · consulta completa'}).waitFor();
 await page.getByRole('button',{name:'Totus',exact:true}).click();
 await page.evaluate(()=>speedQA.gateCustomers=true);
 await page.getByRole('button',{name:'Hortimatic',exact:true}).click();
 await page.waitForFunction(()=>typeof speedQA.releaseCustomers==='function');
 assert.equal(await page.locator('.directory-table tbody tr').count(),20,'Cached rows visible while fresh server read is still blocked');
 assert.match(await page.locator('[data-directory-status]').innerText(),/Datos guardados/);
 assert.equal(await page.evaluate(()=>speedQA.languages),1,'Unchanged metadata is reused');
 await page.evaluate(()=>speedQA.releaseCustomers());
 await page.waitForFunction(()=>speedQA.addressStarted===6);
 await page.evaluate(()=>speedQA.releases.splice(0).forEach(resolve=>resolve()));
 await page.getByRole('status').filter({hasText:'75 registros · consulta completa'}).waitFor();
 assert(await page.getByText('Actualizado 1',{exact:true}).isVisible(),'Fresh data replaces the snapshot on every entry');
 console.log('DIRECTORY PERFORMANCE: first rows before addresses; 3 concurrent batches; instant scoped snapshot while revalidating; metadata reused; refreshed rows replace cache PASS');
}finally{await browser.close();await server?.close();}
