import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await page.evaluate(async()=>{
  const db=window.__mockDb,day=new Date().toLocaleDateString('en-CA');
  for(let i=0;i<3;i++)db.ops_expenses.push({id:'layout-'+i,store_id:db.ops_stores[0].id,expense_date:day,supplier_name:'Proveedor con razón social completa',invoice_number:'QA-'+i,description:'Concepto que conserva toda la información del gasto',gross_expense:100,accounting_amount:100,amount_paid:0,paid_status:'pendiente',fiscal_reviewed:false,management_only:false});
  await(await import('../src/api.js')).loadCore();
 });
 await page.locator('#nav [data-route="gastos"]').click();
 for(const width of [1440,900,390]){
  await page.setViewportSize({width,height:1000});
  const metrics=await page.locator('.expense-row-actions .btn').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {text:e.textContent,width:r.width,height:r.height,clipped:e.scrollWidth>e.clientWidth+1}}));
  assert(metrics.length>=6);assert(metrics.every(r=>r.width<=120&&r.height<=40&&!r.clipped),'Compact buttons must retain their complete labels at '+width+': '+JSON.stringify(metrics));
  const cells=await page.locator('.expense-register-card .data-table tbody tr').first().locator('td').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right}}));
  for(let i=1;i<cells.length;i++)assert(cells[i].left>=cells[i-1].right-1,'Cells cannot overlap');
 }
 await page.setViewportSize({width:1440,height:1000});
 await page.locator('[data-action="expense-edit"][data-id="layout-0"]').click();
 await page.locator('#exSupplier').waitFor();
 assert.equal(await page.locator('#exSupplier').inputValue(),'Proveedor con razón social completa');
 console.log('EXPENSE LAYOUT QA: readable compact action labels, no overlap at desktop/tablet/mobile, edit action remains functional.');
}finally{await browser.close()}
