import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {startLocalServer} from './local-static-server.mjs';
const localServer=await startLocalServer();
const {chromium}=await import(process.env.TOTUS_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.TOTUS_BROWSER_CHANNEL?{channel:process.env.TOTUS_BROWSER_CHANNEL}:{})});
await mkdir('artifacts/prestashop',{recursive:true});
try{
 for(const width of [390,768,1017,1440]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4173/tests/prestashop-harness.html');
  await page.evaluate(async()=>{
   const {createPrestashopUI,prestashopWorkspacePage}=await import('../src/prestashop-ui.js');
   const {applyInterfaceAppearance}=await import('../src/appearance-ui.js');applyInterfaceAppearance({primary:'#006591',borderColor:'#0970f6',borderWidth:2,radius:16});
   document.querySelector('#chatHarness').innerHTML=prestashopWorkspacePage();
   const q=window.prestaQA={actor:'owner-1',calls:[],shouldFail:false,billing:[],delay:null};
   q.connections=[{id:'11111111-1111-4111-8111-111111111111',name:'PrestaShop · Hortimatic',protocol:'prestashop',configured:true,enabled:true,revision:1,verified_revision:1,real_data_authorized:true}];
   q.panel=createPrestashopUI({actor:()=>q.actor,allowed:()=>true,onBilling:source=>q.billing.push(source),rpc:async()=>({connections:structuredClone(q.connections)}),invoke:async body=>{
    q.calls.push(structuredClone(body));if(q.delay)await q.delay;if(q.shouldFail)throw Error('Error simulado HTTP 503');
    const rows=body.resource==='currencies'?[{id:body.record_id,iso_code:'EUR'}]:body.resource==='customers'?[{id:body.record_id,firstname:'Cliente',lastname:'Ficticio',email:'demo@example.invalid'}]:body.resource==='addresses'?[{id:body.record_id,address1:'Dirección ficticia',city:'Prueba'}]:body.resource==='orders'?[{id:String(100-body.page),reference:'PEDIDO-'+body.page,date_add:'2026-11-04 12:10:00',payment:'Tarjeta',total_paid_tax_incl:'21.30',valid:'1',id_currency:'1',current_state:'2',id_customer:'44',id_address_invoice:'55',id_address_delivery:'55',invoice_number:'0'}]:body.resource==='order_details'?[{id:'501',id_order:body.order_id,product_id:'42',product_attribute_id:'3',product_name:'Producto de prueba <script>',product_reference:'REF-42',product_quantity:'2',total_price_tax_incl:'21.30'}]:body.resource==='products'?[{id:'42',name:'Producto catálogo',reference:'REF-42',ean13:'',weight:'0'}]:[{id:'8',id_product:'42',quantity:'7'}];
    return {ok:true,store:body.store,resource:body.resource,page:body.page,rows,possibly_more:body.resource==='orders'&&body.page===0};
   }});await q.panel.mount(document.querySelector('#prestashopRoot'));
  });
  await page.getByRole('button',{name:'Pedidos y ventas',exact:true}).click();await page.getByRole('button',{name:'Consultar periodo',exact:true}).click();
  await page.locator('.ps-order>summary').filter({hasText:'PEDIDO-0'}).waitFor();
  assert.equal(await page.evaluate(()=>prestaQA.calls[0].sort),'newest');
  assert.match(await page.evaluate(()=>prestaQA.calls[0].from),/00:00:00$/);
  assert.equal(await page.getByText(/Consulta parcial/).count(),1);
  await page.locator('[data-ps-order="100"]>summary').click();await page.getByRole('button',{name:'Leer productos del pedido',exact:true}).click();
  await page.getByText('Producto de prueba <script>',{exact:true}).waitFor();await page.getByText('Cliente Ficticio',{exact:false}).waitFor();assert.equal(await page.locator('.ps-order-detail script').count(),0);
  await page.getByRole('button',{name:'Referencia para Facturación',exact:true}).click();assert.equal(await page.evaluate(()=>prestaQA.billing[0].reference),'prestashop:hortimatic:order:100');
  await page.getByRole('button',{name:'Cargar siguiente página',exact:true}).click();await page.locator('.ps-order>summary').filter({hasText:'PEDIDO-1'}).waitFor();assert.equal(await page.locator('.ps-order').count(),2);
  await page.getByText('Vista',{exact:true}).click();await page.locator('[data-ps-column=payment]').uncheck();assert.equal(await page.locator('.ps-order-payment').count(),0);
  await page.locator('[data-ps-filter=query]').fill('PEDIDO-1');await page.getByRole('button',{name:'Aplicar búsqueda',exact:true}).click();assert.equal(await page.locator('.ps-order').count(),1);
  await page.getByRole('button',{name:'Resumen',exact:true}).click();await page.getByText('Sin verificar',{exact:true}).waitFor();assert.equal(await page.locator('.ps-kpi').getByText('42,60 €',{exact:true}).count(),1);
  await page.getByRole('button',{name:'Catálogo',exact:true}).click();await page.getByRole('button',{name:'Consultar productos',exact:true}).click();await page.getByText('Peso no positivo',{exact:true}).waitFor();
  await page.getByRole('button',{name:/NewOldSmok/}).click();assert.equal(await page.getByRole('button',{name:'Consultar productos',exact:true}).isDisabled(),true);assert.equal(await page.getByText('Producto catálogo',{exact:true}).count(),0);
  await page.getByRole('button',{name:/Hortimatic/}).click();await page.evaluate(()=>prestaQA.shouldFail=true);await page.getByRole('button',{name:'Consultar productos',exact:true}).click();await page.getByText('Error simulado HTTP 503',{exact:true}).waitFor();assert.equal(await page.getByText('Producto catálogo',{exact:true}).count(),1);
  await page.evaluate(()=>prestaQA.shouldFail=false);await page.getByRole('button',{name:'Consultar productos',exact:true}).click();await page.getByText('Lectura real completada',{exact:false}).waitFor();
  await page.getByRole('button',{name:'Pedidos y ventas',exact:true}).click();await page.locator('[data-ps-filter=query]').fill('');await page.getByRole('button',{name:'Aplicar búsqueda',exact:true}).click();if(!await page.locator('[data-ps-order="100"]').evaluate(el=>el.open))await page.locator('[data-ps-order="100"]>summary').click();await page.screenshot({path:'artifacts/prestashop/orders-'+width+'.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'No viewport overflow at '+width);
  await page.evaluate(async()=>{prestaQA.actor='owner-2';await prestaQA.panel.mount(document.querySelector('#prestashopRoot'));});assert.equal(await page.getByText('PEDIDO-1',{exact:true}).count(),0);
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PrestaShop workspace: 390/768/1017/1440, actual request contract, expand, escape, paging, filters, views, errors/retry, account/store isolation passed');
}finally{await browser.close();if(localServer)await new Promise(r=>localServer.close(r));}
