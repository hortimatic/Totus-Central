import {clickModuleLink} from './ui-navigation.mjs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 const id=await page.evaluate(async()=>{
  const db=window.__mockDb,id=crypto.randomUUID(),date=new Date().toLocaleDateString('en-CA');
  db.ops_expenses.push({id,store_id:null,expense_date:date,supplier_name:'Proveedor ficticio concurrencia',document_kind:'factura',description:'Concepto QA',gross_expense:121,accounting_amount:121,amount_paid:0,paid_status:'pendiente',payment_method:'transferencia',notes:'Original',updated_at:'2026-10-26T10:00:00Z'});
  db.ops_expense_lines.push({id:crypto.randomUUID(),expense_id:id,description:'Concepto QA',base_amount:100,vat_rate:21,vat_amount:21,re_rate:0,withholding_rate:0,deductible_irpf:true,deductible_pct:100,sort_order:10});
  await(await import('../src/api.js')).loadCore();return id;
 });
 await clickModuleLink(page,page.locator('#nav [data-route="gastos"]'));
 await page.locator('[data-action="expense-edit"][data-id="'+id+'"]').click();
 await page.locator('#exNotes').fill('Mis cambios aún sin guardar');
 await page.evaluate(async id=>{
  const row=window.__mockDb.ops_expenses.find(x=>x.id===id);row.notes='Cambio guardado por otra sesión';row.updated_at='2026-10-26T11:00:00Z';
  // A background read must not update the version belonging to this old form.
  await(await import('../src/api.js')).loadCore();
 },id);
 await page.locator('[data-action="expense-save"]').click();
 await page.getByText('totus_save_expense: Este registro ha cambiado desde que abriste la ficha. Actualiza y revisa los cambios antes de guardar.',{exact:true}).waitFor();
 assert.equal(await page.locator('#exNotes').inputValue(),'Mis cambios aún sin guardar');
 assert.equal(await page.evaluate(id=>window.__mockDb.ops_expenses.find(x=>x.id===id).notes,id),'Cambio guardado por otra sesión');
 await page.locator('[data-action="expense-back"]').first().click();await page.locator('[data-confirm="cancel"]').click();
 await page.locator('[data-action="expense-save"]').click();
 assert.equal(await page.evaluate(id=>window.__mockDb.ops_expenses.find(x=>x.id===id).notes,id),'Cambio guardado por otra sesión');
 await page.locator('[data-action="expense-back"]').first().click();await page.locator('[data-confirm="accept"]').click();
 await page.locator('[data-action="expense-edit"][data-id="'+id+'"]').click();
 assert.equal(await page.locator('#exNotes').inputValue(),'Cambio guardado por otra sesión');
 await page.locator('#exNotes').fill('Corrección después de revisar la ficha actualizada');
 await page.locator('[data-action="expense-save"]').click();
 await page.getByText('Gasto guardado.',{exact:true}).waitFor();
 assert.equal(await page.evaluate(id=>window.__mockDb.ops_expenses.find(x=>x.id===id).notes,id),'Corrección después de revisar la ficha actualizada');
 assert.equal(await page.evaluate(()=>window.__mockDb.ops_expenses.length),1);
 console.log('STALE FORM BROWSER QA: background reads and cancelled navigation cannot silently replace the version of an unsaved form');
}finally{await browser.close()}
