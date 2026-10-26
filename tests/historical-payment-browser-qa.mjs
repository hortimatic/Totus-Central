import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true}),page=await browser.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await page.evaluate(async()=>{
  const db=window.__mockDb;
  db.ops_expenses.push({id:'qa-historical-payment',store_id:db.ops_stores[0].id,expense_date:'2026-09-10',supplier_name:'QA pago histórico',description:'Compra QA',invoice_number:'QA-SEP',base_amount:100,vat_amount:21,re_amount:0,withholding_amount:0,gross_expense:121,accounting_amount:121,amount_paid:0,paid_status:'pendiente',management_only:false,fiscal_reviewed:true,document_kind:'factura'});
  db.ops_business_settings[0].closed_through='2026-09-30';
  await (await import('../src/api.js')).loadCore();
 });
 await page.locator('#nav [data-route="gastos"]').click();
 await page.locator('#gastosFrom').fill('2026-09-01');await page.locator('#gastosTo').fill('2026-09-30');
 await page.locator('[data-action="gastos-apply"]').click();
 await page.locator('[data-action="expense-section"][data-section="facturas"]').click();
 const open=()=>page.locator('[data-action="expense-payment-open"][data-id="qa-historical-payment"]').click();
 await open();
 await page.locator('#expensePaymentStatus').selectOption('pagado');
 await page.locator('#expensePaymentAmount').fill('999');await page.locator('#expensePaymentDate').fill('2026-10-01');
 await page.locator('[data-action="expense-payment-save"]').click();
 assert.equal(await page.evaluate(()=>window.__mockDb.ops_expenses[0].amount_paid),0,'Invalid overpayment must not reach persistence');
 assert(await page.locator('#expensePaymentAmount').isVisible(),'Validation must retain the form');
 await page.locator('#expensePaymentStatus').selectOption('parcial');await page.locator('#expensePaymentAmount').fill('50');
 await page.locator('[data-action="expense-payment-save"]').click();
 await page.getByText('Pago registrado sin modificar el gasto.',{exact:true}).last().waitFor();
 let saved=await page.evaluate(()=>window.__mockDb.ops_expenses[0]);
 assert.equal(saved.amount_paid,50);assert.equal(saved.base_amount,100);assert.equal(saved.vat_amount,21);
 await open();await page.locator('#expensePaymentStatus').selectOption('pagado');await page.locator('#expensePaymentAmount').fill('121');
 await page.locator('[data-action="expense-payment-save"]').click();
 await page.getByText('Pago registrado sin modificar el gasto.',{exact:true}).last().waitFor();
 saved=await page.evaluate(()=>window.__mockDb.ops_expenses[0]);assert.equal(saved.paid_status,'pagado');assert.equal(saved.amount_paid,121);
 assert.equal(await page.evaluate(()=>window.__mockDb.ops_expenses.length),1);
 assert.equal(await page.evaluate(()=>window.__mockDb.ops_audit_log.filter(e=>e.action==='pago_registrado').length),2);
 assert.deepEqual(errors,[]);
 console.log('HISTORICAL PAYMENT UI: overpayment rejected, partial/final payments persisted without duplicate or altered tax amounts; audit entries verified');
}finally{await browser.close()}
