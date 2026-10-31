import {clickModuleLink} from './ui-navigation.mjs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await clickModuleLink(page,page.locator('#nav [data-route="informes"]'));
 await page.locator('#informesFrom').fill('2026-10-01');await page.locator('#informesTo').fill('2026-10-31');
 await page.locator('[data-action="informes-apply"]').click();
 const id=await page.evaluate(()=>{
  const db=window.__mockDb,id=crypto.randomUUID();
  db.ops_daily_closings.push({id,store_id:db.ops_stores[0].id,business_date:'2026-10-02',status:'cerrado',entry_mode:'manual',cash_sales:100,card_sales:200,cash_withdrawals:80,opening_cash:50,actual_cash:70,include_in_income:true});
  return id;
 });
 await page.locator('[data-action="informes-apply"]').click();
 await page.getByRole('heading',{name:'De dónde salen los ingresos',exact:true}).waitFor();
 const breakdown=page.locator('section').filter({has:page.getByRole('heading',{name:'De dónde salen los ingresos',exact:true})});
 assert((await breakdown.innerText()).includes('300,00'),'Apply must fetch the closing created after page load');
 assert.equal(await page.locator('#informesFrom').inputValue(),'2026-10-01');
 await page.evaluate(id=>window.__mockDb.ops_daily_closings.find(c=>c.id===id).card_sales=250,id);
 await page.locator('#informesQuery').press('Enter');
 await page.waitForFunction(()=>[...document.querySelectorAll('section')].some(s=>s.querySelector('h2')?.textContent==='De dónde salen los ingresos'&&s.textContent.includes('350,00')));
 await clickModuleLink(page,page.locator('#nav [data-route="fiscalidad"]'));
 await page.evaluate(id=>window.__mockDb.ops_daily_closings.find(c=>c.id===id).card_sales=275,id);
 await page.locator('[data-action="fiscal-quarter"][data-quarter="4"]').click();
 await page.waitForFunction(()=>[...document.querySelectorAll('section')].some(s=>s.querySelector('h2')?.textContent==='De dónde salen los ingresos'&&s.textContent.includes('375,00')));
 console.log('LIVE REFRESH QA: Apply, Enter and quarter shortcuts fetch new server data and preserve selected dates.');
}finally{await browser.close()}
