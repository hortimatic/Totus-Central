import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:950}});
 page.on('dialog',dialog=>dialog.accept());
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await page.locator('#nav [data-route="cajas"]').click();
 await page.locator('[data-action="closing-new"]').click();
 const ids=await page.locator('.drawer-entry').evaluateAll(es=>es.map(e=>e.dataset.drawerId));
 assert.equal(ids.length,2,'Hortimatic retains its two separate drawers');
 for(const id of ids){
  for(const field of ['Open','Close','Card','Bizum','Online','Other','Withdraw','CashExpense','ExtraIn','ExtraOut'])await page.locator('#dr'+field+'_'+id).fill(field==='Open'?'10':field==='Close'?'20':field==='Card'?'30':'0');
 }
 await page.locator('#clReported').fill('80');
 await page.locator('#clNotes').fill('Observación manual conservada');
 await page.locator('#clSaveStatus').selectOption('borrador');
 await page.locator('[data-action="closing-save-close"]').click();
 await page.getByText('Borrador guardado.',{exact:true}).waitFor();
 const saved=await page.evaluate(async()=>{
  const row=window.__mockDb.ops_daily_closings[0];
  window.__mockDb.ops_daily_closing_drawers.filter(d=>d.closing_id===row.id).forEach(d=>d.notes='Nota de caja conservada');
  await(await import('../src/api.js')).loadCore();return row;
 });
 assert.equal(saved.status,'borrador');
 await page.locator('[data-action="closing-back"]').click();
 await page.locator('[data-action="closing-edit"][data-id="'+saved.id+'"]').click();
 assert.equal(await page.locator('#clSaveStatus').inputValue(),'cerrado');
 await page.locator('#clReported').fill('79');
 await page.locator('[data-action="closing-save-close"]').click();
 await page.getByText(/El cierre no cuadra:/).waitFor();
 assert.equal(await page.evaluate(id=>window.__mockDb.ops_daily_closings.find(x=>x.id===id).status,saved.id),'borrador');
 await page.locator('#clReported').fill('80');
 await page.locator('[data-action="closing-save-close"]').click();
 await page.getByText('Cierre cerrado y cuadrado.',{exact:true}).waitFor();
 assert(await page.locator('#drOpen_'+ids[0]).isDisabled());
 await page.locator('[data-action="closing-back"]').click();
 const row=page.locator('tr').filter({has:page.locator('[data-action="closing-edit"][data-id="'+saved.id+'"]')});
 assert((await row.innerText()).includes('Conciliado y aceptado'));
 await row.getByRole('button',{name:'Ver detalle',exact:true}).click();
 await page.locator('[data-action="closing-reopen"]').click();
 await page.getByText('Cierre reabierto.',{exact:true}).waitFor();
 const after=await page.evaluate(id=>({row:window.__mockDb.ops_daily_closings.find(x=>x.id===id),drawers:window.__mockDb.ops_daily_closing_drawers.filter(x=>x.closing_id===id)}),saved.id);
 assert.equal(after.row.status,'borrador');assert.equal(after.row.card_sales,60);assert.equal(after.row.cash_sales,20);
 assert.equal(after.row.notes,'Observación manual conservada');assert(after.drawers.every(x=>x.notes==='Nota de caja conservada'));
 console.log('CLOSING WORKFLOW BROWSER QA: two drawers, selected draft, balanced close, mismatch refusal, common detail action, safe reopen and all notes retained.');
}finally{await browser.close()}
