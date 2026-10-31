import {clickModuleLink} from './ui-navigation.mjs';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await mkdir('artifacts',{recursive:true});
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await page.evaluate(async()=>{
  const db=window.__mockDb,day=new Date().toLocaleDateString('en-CA'),shop=db.ops_stores[0].id;
  for(const internal of [false,true])db.ops_expenses.push({id:internal?'internal-ui':'fiscal-ui',store_id:shop,expense_date:day,supplier_name:internal?'Proveedor interno':'Proveedor fiscal',invoice_number:'UI-1',description:'Concepto completo de prueba',gross_expense:100,base_amount:100,accounting_amount:100,amount_paid:100,paid_status:'pagado',management_only:internal,fiscal_reviewed:!internal});
  db.ops_tax_payments.push({id:'tax-ui',tax_type:'130',status:'pagado',payment_date:day,fiscal_year:2026,quarter:3,amount:50});
  await(await import('../src/api.js')).loadCore();
 });
 const nav=r=>clickModuleLink(page,page.locator('#nav [data-route="'+r+'"]'));
 await nav('gastos');
 const headers=await page.locator('.expense-register-card .data-table thead').allTextContents();assert.equal(headers.length,2);assert.equal(headers[0],headers[1],'Identical columns for fiscal and internal expenses');
 await page.locator('[data-action="expense-tax-edit"]').click();await page.locator('#exSupplier').waitFor();assert.equal(await page.locator('#exSupplier').inputValue(),'Agencia Tributaria');await page.getByRole('button',{name:'Cancelar',exact:true}).click();
 for(const route of ['gastos','informes','fiscalidad']){
  await nav(route);
  if(route==='fiscalidad'){
   const rows=page.locator('.fiscal-calculation .summary-row');assert.equal(await rows.count(),14);assert.equal(await rows.locator('details.field-help').count(),14,'Every calculation amount has a specific explanation');
   await page.getByLabel('Información sobre IRPF que ya te han retenido',{exact:true}).click();assert.match(await page.locator('.fiscal-calculation details[open]').innerText(),/tus clientes/);await page.getByLabel('Información sobre IRPF que ya te han retenido',{exact:true}).click();
  }
  for(const width of [1440,1024,768,390]){
   await page.setViewportSize({width,height:1000});
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false,route+' page overflow '+width);
   if(route==='informes'){
    const fields=await page.locator('.gestor-period-picker input,.gestor-period-picker select').evaluateAll(es=>es.map(e=>({height:e.getBoundingClientRect().height,width:e.getBoundingClientRect().width})));assert(fields.every(r=>r.height>=38&&r.width>=65),'Readable report period controls');
    assert.equal(await page.locator('.report-export-grid article').count(),3);
   }
   await page.screenshot({path:'artifacts/refined_'+route+'_'+width+'.png',fullPage:true});
  }
 }
 assert.deepEqual(errors,[]);console.log('INFORMATION LAYOUT QA: shared expense columns, tax edit, 14 fiscal explanations, report controls and 4 screen widths verified.');
}finally{await browser.close();}
