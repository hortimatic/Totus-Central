import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {startLocalServer} from '../local-static-server.mjs';
export async function exerciseNativeLinePriceBrowser({handle,actor,fixture,preferences,selection,salesCount}){
 const drawer={connectionId:selection.connectionId,shopId:selection.shopId,id:selection.drawerId};await preferences(drawer,{lineOptions:{allowPriceChanges:true}});
 const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[],submits=[];let lose=true;
 page.setDefaultTimeout(60000);page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4173'?route.continue():route.abort('blockedbyclient'));
  await page.route('**/__line_price_preferences',async route=>{const {drawer,value}=JSON.parse(route.request().postData());return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(await preferences(drawer,value))});});
  await page.route('**/__line_price_fixture',async route=>{const payload=JSON.parse(route.request().postData()),response=await handle(new Request('https://central.local/tpv',{method:'POST',headers:{Authorization:'Bearer synthetic-auth-fixture','Content-Type':'application/json'},body:JSON.stringify(payload)})),body=await response.text();
   if(payload.action==='submit'){submits.push(payload);if(response.status===200&&lose){lose=false;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'TPV_STORAGE_UNAVAILABLE'})});}}
   return route.fulfill({status:response.status,contentType:'application/json',body});});
  await page.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');
  await page.evaluate(async actor=>{fixture.workspace.dispose();const {createTpvWorkspace}=await import('/src/totustpv/workspace.js'),{createCentralTpvAdapter}=await import('/src/totustpv/central-adapter.js');
   window.linePriceWorkspace=createTpvWorkspace({actor:()=>({id:actor,active:true}),can:()=>true,autoOpen:true,confirm:async()=>true,
    workspacePreferences:async(drawer,value)=>(await fetch('/__line_price_preferences',{method:'POST',body:JSON.stringify({drawer,value})})).json(),createLiveAdapter:()=>createCentralTpvAdapter({actorId:actor,storage:localStorage,invoke:async payload=>{const response=await fetch('/__line_price_fixture',{method:'POST',body:JSON.stringify(payload)}),data=await response.json();if(!response.ok||data.error){const error=Error(data.error);error.code=data.error;throw error;}return data;}})});linePriceWorkspace.mount(document.querySelector('#tpv'));
  },actor);
  const sample=fixture.linePriceSetup,id=sample.items.normal.id;await page.locator('[data-tpv-search]').waitFor();await page.locator('[data-tpv-search]').fill(sample.prefix);const product=page.locator(`[data-tpv-add="${id}:0"]`);await product.waitFor();await product.click();
  await page.locator(`[data-tpv-line-kind="${id}:0"]`).selectOption('price');await page.locator(`[data-tpv-line-value="${id}:0"]`).fill('10,25');
  assert.match(await page.locator('.tpv-ticket-total strong').innerText(),/10,25/);assert.match(await page.locator('.tpv-ticket-line> b').innerText(),/10,25/);assert.equal(submits.length,0);
  await mkdir('artifacts/totustpv-line-price',{recursive:true});
  for(const width of [1440,390]){await page.setViewportSize({width,height:950});if(width===390)await page.getByRole('button',{name:'Ver ticket',exact:true}).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);await page.screenshot({path:`artifacts/totustpv-line-price/ticket-${width}.png`,fullPage:true});}
  await page.getByRole('button',{name:'Calcular y cobrar',exact:true}).click();const pay=page.locator('[data-tpv-form=pay]');await pay.waitFor();assert.match(await page.locator('.tpv-payment-amount').innerText(),/10,25/);await pay.locator('[name=method]').selectOption('cash');await pay.locator('[name=received]').fill('10,25');await pay.getByRole('button',{name:'Confirmar cobro y crear pedido',exact:true}).click();
  await page.getByRole('heading',{name:'Respuesta pendiente de recuperar',exact:true}).waitFor();const written=salesCount();await page.getByRole('button',{name:'Recuperar resultado',exact:true}).click();await page.getByRole('heading',{name:'Pedido verificado en PrestaShop',exact:true}).waitFor();assert.equal(salesCount(),written);assert.equal(submits.length,1);
  const orderId=Number((await page.locator('.tpv-receipt').innerText()).match(/Pedido #(\d+)/)[1]);await page.getByRole('button',{name:'Pedidos y devoluciones',exact:true}).click();await page.locator('.tpv-history article').filter({hasText:new RegExp('Pedido #'+orderId+'(?![0-9])')}).getByRole('button',{name:'Devolver',exact:true}).click();
  const refund=page.locator('[data-tpv-form=refund]');await refund.locator('input[type=number]').fill('1');await refund.locator('[name=reason]').fill('Devolución de la prueba de precio del ticket');await refund.locator('input[type=checkbox]').check();await page.getByRole('button',{name:'Calcular devolución',exact:true}).click();await page.getByRole('heading',{name:/Confirmar devolución/}).waitFor();await page.getByRole('button',{name:'Confirmo el reintegro al cliente',exact:true}).click();await page.getByText('Devolución verificada:',{exact:false}).waitFor();
  assert.deepEqual(errors,[]);console.log('PASS native unit-price UI: selected price updates ticket immediately, desktop/mobile, native cash order and invoice, lost-reply recovery without duplicate submission and refund/restock. Loopback only.');return {orderId,operationId:submits[0].operationId};
 }finally{await page.close();await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
}
