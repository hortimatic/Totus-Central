import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {startLocalServer} from './local-static-server.mjs';
import {clickModuleLink} from './ui-navigation.mjs';
const server=await startLocalServer(),{chromium}=await import(process.env.TOTUS_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.TOTUS_BROWSER_CHANNEL?{channel:process.env.TOTUS_BROWSER_CHANNEL}:{})});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 let mock=await readFile(new URL('./mock-supabase.js',import.meta.url),'utf8');
 mock=mock.replace('connections:[],actors:',"connections:[{id:'11111111-1111-4111-8111-111111111111',name:'PrestaShop · Hortimatic',protocol:'prestashop',configured:true,enabled:true,revision:1,verified_revision:1,real_data_authorized:true}],actors:");
 mock=mock.replace('functions:{invoke:async (name,options)=>{',`functions:{invoke:async (name,options)=>{
  if(name==='totus-connections'){
   const b=options.body,rows=b.resource==='currencies'?[{id:'1',iso_code:'EUR'}]:b.resource==='orders'?[{id:'17',reference:'QA-ORIGEN',date_add:'2026-11-04 12:10:00',payment:'Tarjeta',valid:'1',id_currency:'1',id_customer:'3',id_address_invoice:'4',id_address_delivery:'4',total_paid_tax_incl:'12.10',total_shipping_tax_incl:'0',total_shipping_tax_excl:'0',total_discounts_tax_incl:'0',total_discounts_tax_excl:'0',invoice_number:'15'}]:b.resource==='order_details'?[{id:'55',id_order:'17',product_id:'7',product_name:'Producto QA origen',product_quantity:'2',total_price_tax_excl:'10.00',total_price_tax_incl:'12.10'}]:b.resource==='products'?[{id:'7',name:'Producto QA origen',id_default_image:'0'}]:b.resource==='customers'?[{id:'3',firstname:'Cliente',lastname:'TPV'}]:[{id:'4',dni:'00000000'}];
   return {data:{ok:true,store:b.store,resource:b.resource,page:b.page,possibly_more:false,rows},error:null};
  }`);
 await page.route('**/tests/mock-supabase.js',route=>route.fulfill({contentType:'application/javascript',body:mock}));
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html?module=prestashop');
 await page.getByRole('button',{name:'Pedidos y ventas',exact:true}).click();await page.locator('[data-ps-order="17"]>summary').waitFor();
 async function prepare(){await page.locator('[data-ps-order="17"]>summary').click();await page.getByRole('button',{name:'Referencia para Facturación',exact:true}).click();await page.getByRole('button',{name:'Preparar borrador en Facturación',exact:true}).click();await page.locator('#ivPO').waitFor();}
 await prepare();
 assert.equal(await page.locator('#ivPO').inputValue(),'prestashop:hortimatic:order:17');assert(await page.locator('#ivPO').isDisabled());assert.equal(await page.locator('#ivIncludeIncome').isChecked(),false);assert.equal(await page.locator('#ivCustomer').inputValue(),'');assert.equal(await page.locator('#ivDesc_0').inputValue(),'Producto QA origen');assert.equal(await page.locator('#ivQty_0').inputValue(),'2');assert.equal(await page.locator('#ivUnit_0').inputValue(),'5');assert.equal(await page.locator('#ivVat_0').inputValue(),'21');
 await page.locator('#ivCustomer').fill('Cliente ficticio de prueba');await page.locator('#ivTax').fill('12345678Z');await page.locator('[data-action="invoice-save"]').click();await page.getByText('Documento guardado.',{exact:true}).waitFor();
 const saved=await page.evaluate(()=>__mockDb.ops_sales_invoices.filter(r=>r.purchase_order_ref==='prestashop:hortimatic:order:17'));assert.equal(saved.length,1);assert.equal(saved[0].status,'borrador');assert.equal(saved[0].include_in_income,false);assert.equal(Number(saved[0].total_amount),12.1);assert(!saved[0].display_number);
 await clickModuleLink(page,page.locator('#nav [data-route="prestashop"]'));await page.getByRole('button',{name:'Pedidos y ventas',exact:true}).click();if(await page.locator('[data-ps-order="17"]').evaluate(e=>e.open))await page.locator('[data-ps-order="17"]>summary').click();await prepare();assert.equal(await page.evaluate(()=>__mockDb.ops_sales_invoices.filter(r=>r.purchase_order_ref==='prestashop:hortimatic:order:17').length),1);assert.equal(await page.locator('#ivCustomer').inputValue(),'Cliente ficticio de prueba');assert.deepEqual(errors,[]);
 console.log('PrestaShop invoice journey: real application navigation, verified source lines, draft save, no extra income, no numbering and reopen without duplicate passed');
}finally{await browser.close();if(server)await new Promise(r=>server.close(r));}
