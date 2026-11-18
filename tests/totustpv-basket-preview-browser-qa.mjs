import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');
 await page.evaluate(async()=>{
  fixture.workspace.dispose();const {createTpvWorkspace}=await import('/src/totustpv/workspace.js');
  const session={id:'session',status:'open',storeId:'store',drawerId:'drawer'};
  window.priceRequests=[];
  const adapter={mode:'qa',context:async()=>({stores:[{id:'store',name:'Local'}],drawers:[{id:'drawer',storeId:'store',name:'Caja',canSell:true}],sessions:[session]}),selectSession:async()=>session,searchProducts:async()=>[{id:'1:0',name:'Artículo',priceCents:101,stock:100}],localBasketPrices:({lines})=>new Promise(resolve=>priceRequests.push(()=>resolve({lines:lines.map(l=>({...l,unitTaxInclMicros:1005000})),pricingContext:{roundMode:2,roundType:2,computingPrecision:2},validUntil:Date.now()+5000})))};
  window.testWorkspace=createTpvWorkspace({actor:()=>({id:'actor',active:true}),can:()=>true,createLiveAdapter:()=>adapter,autoOpen:true});testWorkspace.mount(document.querySelector('#tpv'));
 });
 await page.locator('[data-tpv-add="1:0"]').click();
 await page.evaluate(()=>priceRequests.shift()());
 await page.waitForFunction(()=>document.querySelector('.tpv-ticket-line > b')?.textContent.includes('1,01'));
 const qty=page.locator('[data-tpv-quantity]');await qty.fill('2');
 assert.equal(await page.locator('.tpv-ticket-line > b').innerText(),'—');
 await qty.fill('3');await page.evaluate(()=>priceRequests.shift()());
 assert.equal(await page.locator('.tpv-ticket-line > b').innerText(),'—');
 await page.evaluate(()=>priceRequests.shift()());
 await page.waitForFunction(()=>document.querySelector('.tpv-ticket-line > b')?.textContent.includes('3,02'));
 assert.equal(await qty.evaluate(e=>document.activeElement===e),true);
 await page.locator('.tpv-ticket-options summary').click();
 await page.locator('[name="coupon"]').fill('PROMO');
 assert.equal(await page.locator('.tpv-ticket-total strong').innerText(),'Por calcular');
 await page.locator('[name="coupon"]').fill('');
 assert.match(await page.locator('.tpv-ticket-total strong').innerText(),/3,02/);
 await page.locator('[data-tpv-line-kind]').selectOption('percent');
 assert.equal(await page.locator('.tpv-ticket-line > b').innerText(),'—');
 await page.locator('[data-tpv-line-kind]').selectOption('');
 await page.waitForFunction(()=>priceRequests.length>0);await page.evaluate(()=>priceRequests.shift()());
 await page.waitForFunction(()=>document.querySelector('.tpv-ticket-line > b')?.textContent.includes('3,02'));
 await page.waitForFunction(()=>document.querySelector('.tpv-ticket-line > b')?.textContent==='—');
 assert.deepEqual(errors,[]);console.log('PASS: quantity tiers preview, exact line rounding, stale response ignored, expiry, focus retained');
} finally {await browser.close();await server.close();}
