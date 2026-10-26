import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true}),page=await browser.newPage();
try{
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await page.locator('#nav [data-route="gastos"]').click();await page.locator('[data-action="expense-new"]').click();
 await page.locator('#exSupplier').fill('Proveedor de céntimos QA');await page.locator('#exInvoice').fill('CENTIMOS-QA');
 await page.locator('#exLineDesc_0').fill('Primera línea');await page.locator('#exLineBase_0').fill('0.03');await page.locator('#exLineVat_0').fill('21');
 const add=page.locator('[data-action="expense-line-add"]');await add.click();
 await page.locator('#exLineDesc_1').fill('Segunda línea');await page.locator('#exLineBase_1').fill('0.03');await page.locator('#exLineVat_1').fill('21');
 assert.match(await page.locator('#exSumVat').innerText(),/0,02/);
 assert.match(await page.locator('#exSumTotal').innerText(),/0,08/);
 await page.locator('[data-action="expense-save"]').first().click();await page.getByText('Gasto guardado.',{exact:true}).waitFor();
 const saved=await page.evaluate(()=>window.__mockDb.ops_expenses[0]);
 assert.equal(saved.gross_expense,.08);assert.equal(saved.amount_paid,.08);
 assert.match(await page.locator('#exSumTotal').innerText(),/0,08/);
 await page.locator('#exLineBase_0').fill('100');await page.locator('#exLineWh_0').fill('19');await page.locator('#exLineBase_1').fill('0');
 assert.match(await page.locator('#exSumTotal').innerText(),/102,00/);
 // Updating a fully paid invoice requires updating its paid amount explicitly.
 await page.locator('#exPaidAmount').fill('102');
 await page.locator('[data-action="expense-save"]').first().click();
 await page.waitForFunction(()=>window.__mockDb.ops_expenses[0].amount_paid===102);
 const rental=await page.evaluate(()=>window.__mockDb.ops_expenses[0]);
 assert.equal(rental.gross_expense,121);assert.equal(rental.withholding_amount,19);assert.equal(rental.amount_paid,102);
 assert.match(await page.locator('#exSumTotal').innerText(),/102,00/);
 console.log('EXPENSE ROUNDING BROWSER QA: per-line cents, saved payment, withholding and reopened summary agree');
}finally{await browser.close()}
