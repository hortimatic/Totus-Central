import assert from 'node:assert/strict';
import {startLocalServer} from './local-static-server.mjs';
const {chromium}=await import(process.env.TOTUS_PLAYWRIGHT_MODULE||'playwright');
const server=await startLocalServer(),browser=await chromium.launch({headless:true,channel:process.env.TOTUS_BROWSER_CHANNEL||(process.platform==='win32'?'msedge':undefined)});
try{
 for(const kind of ['proveedores','marcas']){
  const page=await browser.newPage({viewport:{width:1337,height:900}});
  await page.route('https://**/img/**',route=>route.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><rect width="60" height="60" fill="blue"/></svg>'}));
  await page.goto('http://127.0.0.1:4173/tests/prestashop-harness.html');
  await page.addStyleTag({url:'http://127.0.0.1:4173/src/contact-directory.css'});
  await page.evaluate(async kind=>{
   const {createContactDirectoryUI,directoryPageHtml}=await import('../src/contact-directory-ui.js');
   document.querySelector('#chatHarness').innerHTML=directoryPageHtml(kind,'');
   window.logoUI=createContactDirectoryUI({actor:()=> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',can:()=>true,rpc:async name=>name==='totus_directory_context'?{connections:['Hortimatic','NewOldSmok'].map((shop,i)=>({id:i?'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb':'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'PrestaShop · '+shop,protocol:'prestashop',enabled:true,configured:true,revision:1,verified_revision:1,real_data_authorized:true}))}:null,invoke:async b=>({...b,ok:true,rows:b.resource==='languages'?[{id:'1',iso_code:'es',active:'1'}]:['suppliers','manufacturers'].includes(b.resource)?[{id:'7',name:'Entidad QA',active:'1'}]:[],possibly_more:false})});
   await window.logoUI.mount(document.querySelector('[data-directory-root]'));
  },kind);
  for(const shop of ['Hortimatic','NewOldSmok']){
   await page.getByRole('button',{name:shop,exact:true}).click();
   const img=page.locator('.directory-logo img');await img.waitFor();
   assert.equal(await img.getAttribute('src'),'https://'+(shop==='Hortimatic'?'hortimatic.com':'newoldsmok.com')+'/img/'+(kind==='marcas'?'m':'su')+'/7.jpg');
   assert.equal(await img.getAttribute('alt'),'Logo de Entidad QA');
  }
  await page.close();
 }
 const page=await browser.newPage({viewport:{width:1337,height:900}});
 await page.goto('http://127.0.0.1:4173/tests/prestashop-harness.html');
 await page.addStyleTag({url:'http://127.0.0.1:4173/src/interface-design.css'});
 await page.evaluate(()=>{document.documentElement.classList.add('navigation-compact');document.querySelector('#chatHarness').innerHTML='<aside class="sidebar" style="width:72px"><nav id="nav"><details class="nav-personal-group" open><summary title="Inicio y equipo">Inicio y equipo</summary><a class="nav-btn" href="#" aria-label="Inicio"><span class="nav-icon">⌂</span></a></details></nav></aside>';});
 const metrics=await page.locator('summary').evaluate(el=>({font:getComputedStyle(el).fontSize,height:el.getBoundingClientRect().height,scroll:document.querySelector('#nav').scrollWidth,width:document.querySelector('#nav').clientWidth}));
 assert.equal(metrics.font,'0px');assert(metrics.height<=36);assert(metrics.scroll<=metrics.width);
 await page.close();console.log('PASS: native supplier /img/su/ and manufacturer /img/m/ identity paths in both stores; compact navigation does not wrap section names. API and pictures simulated.');
}finally{await browser.close();await server?.close();}
