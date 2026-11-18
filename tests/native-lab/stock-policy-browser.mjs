import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {startLocalServer} from '../local-static-server.mjs';
export async function exerciseNativeStockPolicyBrowser({handle,actor,fixture,preferences,selection,salesCount}){
 const drawer={connectionId:selection.connectionId,shopId:selection.shopId,id:selection.drawerId};await preferences(drawer,{stockPolicy:{allowOutOfStock:false}});
 const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[],submits=[];let lose=true;
 page.setDefaultTimeout(60000);page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4173'?route.continue():route.abort('blockedbyclient'));
  await page.route('**/__stock_policy_preferences',async route=>{const {drawer,value}=JSON.parse(route.request().postData());return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(await preferences(drawer,value))});});
  await page.route('**/__stock_policy_fixture',async route=>{const payload=JSON.parse(route.request().postData()),response=await handle(new Request('https://central.local/tpv',{method:'POST',headers:{Authorization:'Bearer synthetic-auth-fixture','Content-Type':'application/json'},body:JSON.stringify(payload)})),body=await response.text();
   if(payload.action==='submit'){submits.push(payload);if(response.status===200&&lose){lose=false;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'TPV_STORAGE_UNAVAILABLE'})});}}
   return route.fulfill({status:response.status,contentType:'application/json',body});});
  await page.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');
  await page.evaluate(async actor=>{fixture.workspace.dispose();const {createTpvWorkspace}=await import('/src/totustpv/workspace.js'),{createCentralTpvAdapter}=await import('/src/totustpv/central-adapter.js');
   window.stockPolicyWorkspace=createTpvWorkspace({actor:()=>({id:actor,active:true}),can:()=>true,autoOpen:true,confirm:async()=>true,
    workspacePreferences:async(drawer,value)=>(await fetch('/__stock_policy_preferences',{method:'POST',body:JSON.stringify({drawer,value})})).json(),
    createLiveAdapter:()=>createCentralTpvAdapter({actorId:actor,storage:localStorage,invoke:async payload=>{const response=await fetch('/__stock_policy_fixture',{method:'POST',body:JSON.stringify(payload)}),data=await response.json();if(!response.ok||data?.error){const error=Error(data?.error);error.code=data?.error;throw error;}return data;}})});stockPolicyWorkspace.mount(document.querySelector('#tpv'));
  },actor);
  const sample=fixture.stockPolicySetup,allowed=page.locator(`[data-tpv-add="${sample.items.allowed.id}:0"]`),denied=page.locator(`[data-tpv-add="${sample.items.denied.id}:0"]`);
  await page.locator('[data-tpv-search]').waitFor();await page.locator('[data-tpv-search]').fill(sample.prefix);await page.waitForFunction(()=>document.querySelectorAll('.tpv-product').length===4);
  assert.equal(await allowed.isDisabled(),true);assert.equal(await denied.isDisabled(),true);
  const variable=page.locator(`[data-tpv-add^="${sample.items.variant.id}:"]`),dialog=page.locator('.tpv-variant-dialog');await variable.click();await dialog.locator('[data-tpv-add]').first().waitFor();assert.equal(await dialog.locator('[data-tpv-add]:enabled').count(),0);
  await dialog.getByRole('button',{name:'Volver a productos',exact:true}).click();await dialog.waitFor({state:'hidden'});await variable.waitFor();
  await page.getByText('Más acciones',{exact:true}).click();await page.getByRole('button',{name:'Configuración',exact:true}).click();
  await page.locator('[name=allowOutOfStock]').check();await page.locator('[name=requireQuantity]').check();await page.locator('[name=hideUnavailable]').check();await page.getByRole('button',{name:'Guardar mostrador',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'desactiva Ocultar'}).waitFor();assert.deepEqual((await preferences(drawer)).stockPolicy,{allowOutOfStock:false});
  await page.locator('[name=hideUnavailable]').uncheck();await page.getByRole('button',{name:'Guardar mostrador',exact:true}).click();await page.getByText('Mostrador guardado en tu cuenta.',{exact:true}).waitFor();
  assert.deepEqual((await preferences(drawer)).stockPolicy,{allowOutOfStock:true});await page.getByRole('button',{name:'Venta',exact:true}).click();await allowed.waitFor();
  assert.equal(await allowed.isEnabled(),true);assert.equal(await denied.isEnabled(),true);assert.match(await allowed.innerText(),/Venta sin existencias permitida/);
  await mkdir('artifacts/totustpv-stock-policy',{recursive:true});await variable.click();await dialog.locator('[data-tpv-add]').first().waitFor();assert.equal(await dialog.locator('[data-tpv-add]:enabled').count(),2);
  for(const width of [1440,390]){await page.setViewportSize({width,height:950});await dialog.locator('[data-tpv-view]').selectOption(width===390?'grid':'table');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);await page.screenshot({path:`artifacts/totustpv-stock-policy/variants-${width}.png`,fullPage:true});}
  await dialog.getByRole('button',{name:'Volver a productos',exact:true}).click();await dialog.waitFor({state:'hidden'});await allowed.waitFor();
  for(const width of [1440,390]){await page.setViewportSize({width,height:950});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);await page.screenshot({path:`artifacts/totustpv-stock-policy/catalogue-${width}.png`,fullPage:true});}
  await denied.click();const quantity=page.locator('.tpv-quantity-dialog');await quantity.waitFor();await quantity.locator('[name=quantity]').fill('2');await quantity.getByRole('button',{name:'Añadir al ticket',exact:true}).click();await quantity.waitFor({state:'hidden'});await page.getByRole('button',{name:'Ver ticket',exact:true}).click();const units=page.locator('[data-tpv-quantity]');assert.equal(await units.inputValue(),'2');assert.equal(await units.evaluate(el=>el.checkValidity()),true);
  await page.getByRole('button',{name:'Calcular y cobrar',exact:true}).click();const pay=page.locator('[data-tpv-form=pay]');await pay.waitFor();assert.match(await page.locator('.tpv-payment-amount').innerText(),/16,02/);
  await pay.locator('[name=method]').selectOption('cash');await pay.locator('[name=received]').fill('16,02');await pay.getByRole('button',{name:'Confirmar cobro y crear pedido',exact:true}).click();
  await page.getByRole('heading',{name:'Respuesta pendiente de recuperar',exact:true}).waitFor();const written=salesCount();await page.getByRole('button',{name:'Recuperar resultado',exact:true}).click();
  await page.getByRole('heading',{name:'Pedido verificado en PrestaShop',exact:true}).waitFor();assert.equal(salesCount(),written);assert.equal(submits.length,1);
  const orderId=Number((await page.locator('.tpv-receipt').innerText()).match(/Pedido #(\d+)/)[1]);
  await page.getByRole('button',{name:'Pedidos y devoluciones',exact:true}).click();await page.locator('.tpv-history article').filter({hasText:'Pedido #'+orderId}).getByRole('button',{name:'Devolver',exact:true}).click();
  const refund=page.locator('[data-tpv-form=refund]');await refund.locator('input[type=number]').fill('2');await refund.locator('[name=reason]').fill('Devolución del laboratorio de existencias');await refund.locator('input[type=checkbox]').check();
  await page.getByRole('button',{name:'Calcular devolución',exact:true}).click();await page.getByRole('heading',{name:/Confirmar devolución/}).waitFor();await page.getByRole('button',{name:'Confirmo el reintegro al cliente',exact:true}).click();await page.getByText('Devolución verificada:',{exact:false}).waitFor();
  assert.deepEqual(errors,[]);console.log('PASS native stock-policy browser: blocked defaults, incompatible visibility validation, authenticated save/readback, sealed native counter permission, zero-stock selection and quantity two, actual cash sale, lost-reply same-request recovery without resubmission, refund/restock and desktop/mobile.');
  return {operationId:submits[0].operationId,orderId};
 }finally{await page.close();await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
}
