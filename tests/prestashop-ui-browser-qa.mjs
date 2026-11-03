import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{
 for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:4173/tests/chat-harness.html');
  await page.evaluate(async()=>{
   const {connectionsHtml,mountConnectionsTabs}=await import('../src/connections-ui.js');
   const {createPrestashopUI}=await import('../src/prestashop-ui.js');
   const host=document.querySelector('#chatHarness');
   host.innerHTML='<div id="appearanceRoot">Apariencia existente</div>'+connectionsHtml();
   const q=window.prestaQA={actor:'owner-1',connections:[],calls:[],shouldFail:false};
   q.panel=createPrestashopUI({
    actor:()=>q.actor,allowed:()=>true,onManage:()=>host.querySelector('[data-config-section="connections"]').click(),
    rpc:async()=>({connections:structuredClone(q.connections)}),
    invoke:async body=>{
     q.calls.push(structuredClone(body));
     if(q.shouldFail)throw Error('Error simulado HTTP 503');
     return {ok:true,store:body.store,resource:body.resource,page:body.page,page_size:25,
       rows:body.resource==='orders'?[{id:'12',reference:'FACT-1',date_add:'2026-11-03 11:00:00',payment:'Tarjeta',total_paid_tax_incl:'21.30'}]:[{id:'8',id_product:'52',id_product_attribute:'0',id_shop:'1',quantity:'7'}],
       possibly_more:false};
    }
   });
   mountConnectionsTabs(host,{appearance:host.querySelector('#appearanceRoot'),connections:host.querySelector('#connectionsRoot'),prestashop:host.querySelector('#prestashopRoot'),
     guard:()=>true,disposeTest:()=>{},mountTest:()=>{},disposePrestashop:()=>q.panel.dispose(),mountPrestashop:()=>q.panel.mount(host.querySelector('#prestashopRoot'))});
  });
  assert.equal(await page.locator('[data-config-section]').count(),4,'old three sections and PrestaShop');
  await page.locator('[data-config-section=prestashop]').click();
  await page.getByText('Sin conexión vinculada en APIs.').first().waitFor();
  assert.equal(await page.locator('[data-prestashop-action=read]:not([disabled])').count(),0,'no read without connection');
  await page.evaluate(()=>{
   prestaQA.connections=[{id:'11111111-1111-4111-8111-111111111111',name:'PrestaShop · Hortimatic',protocol:'prestashop',
     configured:true,enabled:true,revision:1,verified_revision:1,real_data_authorized:true,verified_at:'2026-11-03'}];
  });
  await page.locator('[data-prestashop-action=refresh]').click();
  assert.equal(await page.locator('[data-prestashop-action=read]:not([disabled])').count(),2,'only Hortimatic resources are enabled');
  await page.locator('[data-prestashop-store=hortimatic] [data-resource=orders]').click();
  await page.getByText('FACT-1').waitFor();
  assert.equal(await page.evaluate(()=>prestaQA.calls.length),1);
  assert.equal(await page.evaluate(()=>prestaQA.calls[0].resource),'orders');
  assert.equal(await page.locator('[data-prestashop-store=newoldsmok] [data-prestashop-action=read]:not([disabled])').count(),0,'no cross-shop access');
  await page.evaluate(()=>prestaQA.shouldFail=true);
  await page.locator('[data-prestashop-store=hortimatic] [data-resource=stock_availables]').click();
  await page.getByText(/Error simulado HTTP 503/).first().waitFor();
  assert.equal(await page.getByText('FACT-1').count(),1,'a failed read does not replace verified prior results');
  await page.locator('[data-prestashop-action=open-apis]').click();
  assert.equal(await page.locator('#connectionsRoot').isVisible(),true);
  await page.locator('[data-config-section=login]').click();
  assert.equal(await page.locator('#appearanceRoot').isVisible(),true);
  await page.locator('[data-config-section=prestashop]').click();
  assert.equal(await page.locator('[data-prestashop-store]').count(),2,'both store cards are retained after tab switches');
  assert.equal(errors.length,0,'browser errors: '+errors.join('; '));
  await page.close();
 }
 console.log('PrestaShop browser: 390/1440px, tabs, permissions, read, error, store isolation passed');
}finally{await browser.close();}
