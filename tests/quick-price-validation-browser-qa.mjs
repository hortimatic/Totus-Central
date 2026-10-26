import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await page.locator('#userCard').waitFor({state:'visible'});
 await page.locator('#homePriceQuery').fill('Consulta ficticia QA');
 await page.locator('#homePricePvp').fill('20');
 const count=()=>page.evaluate(()=>window.__mockDb.consultations.length);
 for(const value of ['12abc','abc','-10']){
  await page.locator('#homePriceCost').fill(value);
  assert.equal(await page.locator('#homePriceMargin').innerText(),'—');
  assert(await page.locator('#homePriceError').isVisible());
  await page.locator('[data-action="home-price-save"]').click();
  assert.equal(await count(),0,'Invalid inputs must never persist');
 }
 await page.locator('#homePriceCost').fill('10');
 await page.locator('#homePriceDiscount').fill('101');
 await page.locator('[data-action="home-price-save"]').click();
 assert.equal(await count(),0,'Out-of-range discount must not be clamped and saved');
 await page.locator('#homePriceDiscount').fill('10');
 assert.equal(await page.locator('#homePriceError').isVisible(),false);
 assert.notEqual(await page.locator('#homePriceMargin').innerText(),'—');
 await page.locator('[data-action="home-price-save"]').click();
 await page.waitForFunction(()=>window.__mockDb.consultations.length===1);
 const row=await page.evaluate(()=>window.__mockDb.consultations[0]);
 assert.equal(row.cost_net,10);assert.equal(row.pvp,20);assert.equal(row.discount,10);
 await page.locator('#nav [data-route="pricing"]').click();
 await page.locator('#pqQuery').fill('Consulta Pricing QA');
 await page.locator('#pqCost').fill('-10');await page.locator('#pqPvp').fill('20');
 assert.equal(await page.locator('#pqMargin').innerText(),'—');
 assert(await page.locator('#pqError').isVisible());
 await page.locator('[data-action="consultation-save"]').click();
 assert.equal(await count(),1);
 await page.locator('#pqCost').fill('12,50');
 assert.equal(await page.locator('#pqError').isVisible(),false);
 await page.locator('[data-action="consultation-save"]').click();
 await page.waitForFunction(()=>window.__mockDb.consultations.length===2);
 assert.equal(await page.evaluate(()=>window.__mockDb.consultations[1].cost_net),12.5);
 assert.deepEqual(errors,[],'Invalid typing should not throw uncaught preview errors');
 console.log('QUICK PRICE BROWSER QA: Inicio and Pricing reject malformed/negative/out-of-range inputs, show inline errors, clear stale metrics and persist only valid values');
}finally{await browser.close()}
