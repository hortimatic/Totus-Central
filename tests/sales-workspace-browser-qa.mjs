import assert from 'node:assert/strict';
import {startLocalServer} from './local-static-server.mjs';
const {chromium}=await import(process.env.TOTUS_PLAYWRIGHT_MODULE||'playwright');
const server=await startLocalServer(),browser=await chromium.launch({headless:true,channel:process.env.TOTUS_BROWSER_CHANNEL||(process.platform==='win32'?'msedge':undefined)});
try{for(const width of [390,768,1017,1440,1920]){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/tests/prestashop-harness.html');
 await page.evaluate(async()=>{const {createPrestashopUI,prestashopWorkspacePage}=await import('../src/prestashop-ui.js');document.querySelector('#chatHarness').innerHTML=prestashopWorkspacePage();const q=window.salesQA={calls:[],resources:[]};q.ui=createPrestashopUI({salesOnly:true,autoload:false,actor:()=> 'sales-owner',allowed:()=>true,rpc:async name=>{q.calls.push(name);return {connections:[{id:'11111111-1111-4111-8111-111111111111',name:'PrestaShop · Hortimatic',protocol:'prestashop',configured:true,enabled:true,revision:1,verified_revision:1,real_data_authorized:true}]};},invoke:async body=>{q.resources.push(body.resource);return {ok:true,store:body.store,resource:body.resource,page:body.page,rows:[],possibly_more:false};}});await q.ui.mount(document.querySelector('#prestashopRoot'));});
 assert(await page.evaluate(()=>salesQA.calls.includes('totus_sales_context')));
 assert.equal(await page.locator('.ps-tabs button').count(),4);
 assert.equal(await page.locator('.ps-catalog-alerts').count(),0);
 await page.getByRole('button',{name:'Pedidos y ventas',exact:true}).click();
 await page.getByRole('button',{name:'Consultar periodo',exact:true}).click();
 assert(await page.evaluate(()=>salesQA.resources.includes('orders')));
 await page.getByRole('button',{name:'Consultas',exact:true}).click();
 assert.equal(await page.locator('[data-prestashop-action=recipe][data-recipe=duplicate_ean]').count(),0);
 assert.equal(await page.locator('[data-prestashop-action=recipe][data-recipe=sales_window]').count(),1);
 await page.evaluate(()=>salesQA.ui.selectTab('catalog'));assert.equal(await page.locator('.ps-tabs [aria-pressed=true]').innerText(),'Consultas');
 assert.deepEqual(errors,[]);await page.close();
}console.log('SALES WORKSPACE: own context, four functional tabs, order query, sales-only recipes and five widths passed.');}
finally{await browser.close();await new Promise(resolve=>server?server.close(resolve):resolve());}
