import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await page.locator('#nav [data-route="facturacion"]').click();
 await page.locator('[data-action="invoice-new"]').first().click();
 await page.locator('#ivCustomer').fill('Cliente ficticio limites');
 await page.locator('#ivDesc_0').fill('Documento simulado');
 await page.locator('#ivUnit_0').fill('100');
 for(const [id,value] of [['ivDisc_0','150'],['ivDisc_0','-1'],['ivDisc_0','9'.repeat(400)],['ivVat_0','-21']]){
  await page.locator('#ivDisc_0').fill('0');await page.locator('#ivVat_0').fill('21');
  await page.locator('#'+id).fill(value);
  await page.locator('[data-action="invoice-save"]').click();
  assert.equal(await page.evaluate(()=>window.__mockDb.ops_sales_invoices.length),0,'Invalid numbers must not be clamped or saved');
  assert.match(await page.locator('#toastHost').innerText(),/campo/);
 }
 await page.locator('#ivVat_0').fill('21');await page.locator('#ivDisc_0').fill('10');
 await page.locator('[data-action="invoice-save"]').click();
 await page.waitForFunction(()=>window.__mockDb.ops_sales_invoices.length===1);
 assert.equal(await page.evaluate(()=>window.__mockDb.ops_sales_invoice_lines[0].discount_pct),10);
 assert.equal(await page.evaluate(()=>window.__mockDb.ops_sales_invoices[0].total_amount),108.9);
 await page.locator('#nav [data-route="gastos"]').click();
 await page.locator('[data-action="expense-new"]').click();
 await page.locator('#exLineBase_0').fill('pendiente de completar');
 // The same supplier dialog can open over an unfinished record; its save must validate only its fields.
 await page.evaluate(()=>{const b=document.createElement('button');b.dataset.action='expense-supplier-new';b.id='qaSupplier';document.querySelector('#content').appendChild(b)});
 await page.locator('#qaSupplier').click();
 await page.locator('#esName').fill('Proveedor ficticio limites');
 await page.locator('[data-action="expense-supplier-save"]').click();
 await page.waitForFunction(()=>window.__mockDb.ops_suppliers.some(x=>x.name==='Proveedor ficticio limites'));
 assert.equal(await page.locator('#exLineBase_0').inputValue(),'pendiente de completar','Parent draft remains unchanged');
 assert.deepEqual(errors,[]);
 console.log('FORM BOUNDARIES BROWSER QA: invalid discounts/VAT/overflow rejected before writes; valid totals and independent modal saves verified');
}finally{await browser.close()}
