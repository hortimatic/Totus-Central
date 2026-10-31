import {clickModuleLink} from './ui-navigation.mjs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
try{
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html');
 await clickModuleLink(page,page.locator('#nav [data-route=cajas]'));
 await page.locator('[data-action=closing-new]').click();
 const ids=await page.locator('.drawer-entry').evaluateAll(es=>es.map(e=>e.dataset.drawerId));assert.equal(ids.length,2);
 for(const [index,id] of ids.entries()){
  for(const [suffix,value] of Object.entries({Open:index?'0':'100',Close:index?'20':'100',Card:index?'0':'30',Withdraw:index?'0':'20'}))await page.locator('#dr'+suffix+'_'+id).fill(value);
 }
 await page.locator('#drSales_'+ids[0]).fill('50,00');
 assert.equal(await page.locator('#clReported').inputValue(),'');assert.equal(await page.locator('#clReported').getAttribute('readonly'),'');
 await page.locator('[data-action=closing-save-close]').click();
 assert.equal(await page.evaluate(()=>__mockDb.ops_daily_closings.length),0,'Incomplete references must not save a closed record');
 await page.locator('#drSales_'+ids[1]).fill('20,00');assert.equal(await page.locator('#clReported').inputValue(),'70,00');
 assert.equal(await page.locator('#clCalcTotal').textContent(),new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(70));
 await page.locator('[data-action=closing-save-close]').click();await page.locator('[data-action=closing-reopen]').waitFor();
 const saved=await page.evaluate(()=>({total:__mockDb.ops_daily_closings[0].reported_total_sales,income:__mockDb.ops_daily_closings[0].cash_sales+__mockDb.ops_daily_closings[0].card_sales,drawers:__mockDb.ops_daily_closing_drawers.map(d=>d.reported_total_sales)}));
 assert.equal(saved.total,70);assert.equal(saved.income,70);assert.deepEqual(saved.drawers,[50,20]);
 assert.equal(await page.locator('#drSales_'+ids[0]).inputValue(),'50');
 await page.locator('[data-action=closing-reopen]').click();await page.locator('#drSales_'+ids[0]).waitFor({state:'visible'});
 await page.locator('#drSales_'+ids[0]).fill('60');await page.locator('#drSales_'+ids[1]).fill('10');
 assert.equal(await page.locator('#clReported').inputValue(),'70,00');
 await page.locator('[data-action=closing-save-close]').click();
 assert.equal(await page.evaluate(()=>__mockDb.ops_daily_closings[0].status),'borrador','Offsetting errors cannot close');
 assert((await page.locator('#drSalesDiff_'+ids[0]).textContent()).includes('-10'));
 await page.locator('#drSales_'+ids[0]).fill('50');await page.locator('#drSales_'+ids[1]).fill('20');
 await page.locator('.toast').last().waitFor({state:'detached'});
 await page.setViewportSize({width:390,height:844});await page.locator('.drawer-entry').first().evaluate(el=>el.scrollIntoView({block:'start'}));
 await fs.mkdir('artifacts/interface-design',{recursive:true});await page.screenshot({path:'artifacts/interface-design/ventas-por-caja-390.png'});
 assert.deepEqual(errors,[]);console.log('Ventas por caja: entrada independiente, suma, guardado, reapertura, no doble ingreso y errores compensados OK.');
}finally{await browser.close();}
