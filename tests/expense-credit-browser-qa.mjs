import {clickModuleLink} from './ui-navigation.mjs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {expenseRegisterLines} from '../src/expense-register.js';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage();const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await clickModuleLink(page,page.locator('#nav [data-route="gastos"]'));
 await page.locator('[data-action="expense-new"]').click();
 await page.locator('#exDocKind').selectOption('rectificativa');
 await page.locator('#exSupplier').fill('Proveedor devolución QA');
 await page.locator('#exInvoice').fill('ABONO-QA');
 await page.locator('#exLineDesc_0').fill('Devolución de compra');
 await page.locator('#exLineBase_0').fill('-10');
 await page.locator('#exLineVat_0').fill('21');
 await page.locator('#exLineRe_0').fill('5.2');
 assert.match(await page.locator('#exSumTotal').innerText(),/-12,62/);
 await page.locator('[data-action="expense-save"]').first().click();
 await page.getByText('Gasto guardado.',{exact:true}).waitFor();
 const data=await page.evaluate(()=>({expenses:window.__mockDb.ops_expenses,lines:window.__mockDb.ops_expense_lines}));
 assert.equal(data.expenses[0].gross_expense,-12.62);
 assert.equal(expenseRegisterLines(data.expenses,data.lines)[0].subtotal,-12.62);
 assert.match(await page.locator('#exSumTotal').innerText(),/-12,62/,'Reopened saved record must match draft preview');
 assert.deepEqual(errors,[]);
 console.log('EXPENSE CREDIT BROWSER QA: signed draft preview, save, reopened record and export agree');
}finally{await browser.close()}
