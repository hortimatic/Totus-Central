import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {chromium} from 'playwright';import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true});
try{await fs.mkdir('qa-artifacts',{recursive:true});for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:950},acceptDownloads:true}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:4173/tests/totustpv-billing.html');
 await page.evaluate(async()=>{
  const {createTpvBillingUI}=await import('/src/totustpv/billing-ui.js');window.fixture={actor:'account',calls:[],wait:false};const f=fixture;
  const row={id:'sale',orderId:420,createdAt:'2026-11-17T23:00:00Z',totalCents:1210,currency:'EUR',drawerName:'Mostrador',operatorName:'Vendedor de pruebas',refundCents:100,refunds:[{id:'refund',totalCents:100}]};
  f.ui=createTpvBillingUI({actor:()=>f.actor,client:()=>async body=>{
   f.calls.push(body);if(f.wait){await new Promise(resolve=>f.resolve=resolve);f.wait=false;}
   if(body.action==='billing-context')return {sources:[{connectionId:'connection',shopId:1,storeName:'Establecimiento de pruebas'}]};
   if(body.action==='billing-list')return {items:[{...row,orderId:body.query.cursor?421:420}],hasMore:!body.query.cursor,cursor:{id:'cursor',createdAt:row.createdAt}};
   if(body.kind==='billing')return {sale:row,document:{formatted_number:'LAB-000420',order_id:420,order_reference:'REFERENCIA',issued_at:'2026-11-18 00:00:00',total_cents:1210,currency:'EUR',total_tax_excl:'10.000000',
    lines:[{name:'Artículo <img src=x onerror=alert(1)>',quantity:2,unit_tax_incl:'6.050000',line_tax_incl:'12.100000'}]}};
   return {orderId:420,mime:'application/pdf',base64:btoa('%PDF-1.4\nfixture')};
  }});await f.ui.mount(document.querySelector('#billing'));
 });
 await page.getByRole('button',{name:'Ver factura',exact:true}).waitFor();
 await page.screenshot({path:`qa-artifacts/tpv-billing-list-${width}.png`,fullPage:true});
 await page.getByRole('button',{name:'Siguiente',exact:true}).click();await page.getByText('Pedido #421',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Anterior',exact:true}).click();await page.getByText('Pedido #420',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Ver factura',exact:true}).click();await page.getByRole('heading',{name:'LAB-000420'}).waitFor();
 assert.equal(await page.locator('#billing img').count(),0);await page.getByText('Artículo <img src=x onerror=alert(1)>',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:`qa-artifacts/tpv-billing-detail-${width}.png`,fullPage:true});
 for(const name of ['Descargar factura','Abono 1 · 1,00 €']){
  const download=page.waitForEvent('download');await page.getByRole('button',{name,exact:true}).click();assert.match((await download).suggestedFilename(),/^(Factura|Abono)-pedido-420\.pdf$/);
  await page.getByText('Documento preparado para descargar.',{exact:true}).waitFor();
 }
 await page.getByRole('button',{name:'← Volver a las ventas',exact:true}).click();
 await page.evaluate(()=>{fixture.wait=true;});await page.getByRole('button',{name:'Ver factura',exact:true}).click();
 await page.evaluate(()=>{fixture.actor='other-account';fixture.resolve();});
 assert.equal(await page.getByRole('heading',{name:'LAB-000420'}).count(),0);
 assert.ok((await page.evaluate(()=>fixture.calls)).every(row=>['billing-context','billing-list','billing-document'].includes(row.action)));
 await page.evaluate(async()=>{
  fixture.ui.dispose();const {createTpvWorkspace}=await import('/src/totustpv/workspace.js');window.linkFixture={opened:[]};
  const adapter={mode:'qa',context:async()=>({stores:[{id:'store',name:'Pruebas'}],drawers:[{id:'drawer',storeId:'store',name:'Mostrador',connectionId:'connection',shopId:1,canSell:true,canOpen:true,canReconcile:true}],sessions:[{id:'session',drawerId:'drawer',storeId:'store',status:'open'}]}),
   selectSession:async()=>{},categories:async()=>[],searchProducts:async()=>[{id:'50:0',nativeProductId:50,name:'Artículo de enlace',priceCents:605,stock:6}],
   history:async()=>[{id:'sale',reference:'Pedido #420',status:'confirmed',totalCents:1210,refunds:[]}]};
  linkFixture.workspace=createTpvWorkspace({actor:()=>({id:'account',active:true}),can:()=>true,canBilling:()=>true,
   onBilling:async value=>linkFixture.opened.push(value),autoOpen:true,createLiveAdapter:()=>adapter});linkFixture.workspace.mount(document.querySelector('#billing'));
 });
 await page.locator('[data-tpv-action="history"]').first().click();await page.getByText('Pedido #420',{exact:true}).waitFor();
 await page.locator('.tpv-document-actions summary').click();await page.getByRole('button',{name:'Ver en Facturación',exact:true}).click();
 assert.deepEqual(await page.evaluate(()=>linkFixture.opened),[{saleId:'sale',connectionId:'connection',shopId:1}]);
 await page.locator('[data-tpv-action="sale"]').first().click();await page.getByRole('button',{name:/Artículo de enlace/}).click();
 await page.locator('[data-tpv-action="history"]').first().click();await page.locator('.tpv-document-actions summary').click();
 await page.getByRole('button',{name:'Ver en Facturación',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Aparca o termina el ticket'}).waitFor();assert.equal(await page.evaluate(()=>linkFixture.opened.length),1);
 assert.deepEqual(errors,[]);await page.evaluate(()=>linkFixture.workspace.dispose());await page.close();
}console.log('PASS billing desktop/mobile: list/search controls, stable pagination, existing invoice detail, escaped names, invoice/credit downloads, no page overflow and late account-switch rejection. Browser service fixture; no fiscal writes.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
