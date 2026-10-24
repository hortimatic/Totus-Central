import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await page.locator('#nav [data-route="administracion"]').click();
 await page.locator('[data-action="admin-section"][data-section="fiscal"]').click();
 const edit=page.locator('[data-action="expense-category-edit"]').first();
 const id=await edit.getAttribute('data-id');await edit.click();
 assert.equal(await page.locator('#ecReportGroup option').count(),6);
 assert.equal(await page.locator('#ecReportGroup').inputValue(),'');
 await page.locator('#ecReportGroup').selectOption('orders');
 await page.locator('[data-action="expense-category-save"]').click();
 await page.getByText('Categoría guardada.',{exact:true}).last().waitFor();
 assert.equal(await page.evaluate(id=>window.__mockDb.ops_expense_categories.find(c=>c.id===id).report_group,id),'orders');
 await page.locator('[data-action="expense-category-edit"][data-id="'+id+'"]').click();
 assert.equal(await page.locator('#ecReportGroup').inputValue(),'orders','Reopening retrieves saved preference');
 await page.screenshot({path:'artifacts/review_expense_color_selector.png',fullPage:true});
 await page.locator('#ecReportGroup').selectOption('');
 await page.locator('[data-action="expense-category-save"]').click();
 await page.getByText('Categoría guardada.',{exact:true}).last().waitFor();
 assert.equal(await page.evaluate(id=>window.__mockDb.ops_expense_categories.find(c=>c.id===id).report_group,id),null);
 assert.deepEqual(errors,[]);
 console.log('EXPENSE COLOR BROWSER: six choices, save/reopen and automatic reset verified in isolated mock.');
}finally{await browser.close()}
