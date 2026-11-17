import assert from 'node:assert/strict';import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';import {startLocalServer} from '../local-static-server.mjs';
/** The browser uses the real adapter and handler, isolated SQL and loopback
 * PrestaShop. Authentication and endpoint routing are explicit local fixtures. */
export async function exerciseNativeBudgetBrowser({handle,actor,fixture,preferences,selection,paths,call,inspectCommercialCart}){
 const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:950}});
 const errors=[],saves=[],submits=[];let loseSave=true,loseSubmit=true,saved;
 const posts=()=>paths.filter(row=>row.method==='POST').length;
 page.setDefaultTimeout(60000);page.on('pageerror',error=>errors.push(error.message));
 const initialize=async()=>page.evaluate(async actor=>{
  fixture.workspace.dispose();const {createTpvWorkspace}=await import('/src/totustpv/workspace.js'),{createCentralTpvAdapter}=await import('/src/totustpv/central-adapter.js');
  window.nativeBudgetWorkspace=createTpvWorkspace({actor:()=>({id:actor,active:true}),can:()=>true,autoOpen:true,confirm:async()=>true,
   workspacePreferences:async(drawer,value)=>(await fetch('/__budget_preferences',{method:'POST',body:JSON.stringify({drawer,value})})).json(),
   createLiveAdapter:()=>createCentralTpvAdapter({actorId:actor,storage:localStorage,invoke:async payload=>{
    const response=await fetch('/__budget_fixture',{method:'POST',body:JSON.stringify(payload)}),data=await response.json();if(!response.ok||data.error){const error=Error(data.error);error.code=data.error;throw error;}return data;
   }})});nativeBudgetWorkspace.mount(document.querySelector('#tpv'));
 },actor);
 try{
  await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4173'?route.continue():route.abort('blockedbyclient'));
  await page.route('**/__budget_preferences',async route=>{const {drawer,value}=JSON.parse(route.request().postData());return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(await preferences(drawer,value))});});
  await page.route('**/__budget_fixture',async route=>{
   const payload=JSON.parse(route.request().postData()),response=await handle(new Request('https://central.local/tpv',{method:'POST',headers:{Authorization:'Bearer synthetic-auth-fixture','Content-Type':'application/json'},body:JSON.stringify(payload)})),body=await response.text();
   if(payload.action==='budget-create'){saves.push(payload);if(response.status===200){saved=JSON.parse(body);if(loseSave){loseSave=false;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'TPV_STORAGE_UNAVAILABLE'})});}}}
   if(payload.action==='submit'){submits.push(payload);if(response.status===200&&loseSubmit){loseSubmit=false;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'TPV_STORAGE_UNAVAILABLE'})});}}
   return route.fulfill({status:response.status,contentType:'application/json',body});
  });
  const stockBefore=inspectCommercialCart(fixture.productId,0).stock;
  await page.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');await initialize();await page.locator('[data-tpv-search]').fill(fixture.reference);
  await page.locator(`[data-tpv-add="${fixture.productId}:0"]`).click();await page.locator('.tpv-ticket-options>summary').click();await page.locator('[name=note]').fill('Nota privada del presupuesto de navegador');
  await page.getByRole('button',{name:'Guardar presupuesto',exact:true}).click();const form=page.locator('[data-tpv-form=budget]');await form.getByLabel('Título',{exact:true}).fill('Oferta del recorrido real');await form.getByLabel('Texto para el cliente').fill('Recogida acordada con el cliente');await form.getByRole('button',{name:'Calcular y guardar presupuesto'}).click();
  await page.getByRole('button',{name:'Recuperar presupuesto pendiente',exact:true}).waitFor();const writesAfterSave=posts();assert.ok(saved?.id);assert.equal(submits.length,0);
  await page.reload();await initialize();await page.locator('.tpv-actions>summary').click();await page.getByRole('button',{name:'Presupuestos',exact:true}).click();await page.getByRole('button',{name:'Recuperar presupuesto pendiente',exact:true}).click();
  await page.getByRole('article',{name:'Documento del presupuesto'}).waitFor();assert.equal(posts(),writesAfterSave);assert.equal(saves.length,2);assert.equal(saves[0].operationId,saves[1].operationId);
  assert.equal((await page.locator('.tpv-budget-document').innerText()).includes('Nota privada del presupuesto de navegador'),false);
  await mkdir('artifacts/totustpv-budgets',{recursive:true});for(const width of [1440,390]){await page.setViewportSize({width,height:950});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);await page.screenshot({path:`artifacts/totustpv-budgets/native-budget-${width}.png`,fullPage:true});}
  await page.getByRole('button',{name:'Abrir como ticket',exact:true}).click();await page.getByRole('button',{name:'Ver ticket',exact:true}).click();await page.getByRole('button',{name:'Calcular y cobrar',exact:true}).click();
  const pay=page.locator('[data-tpv-form=pay]');await pay.waitFor();await pay.locator('[name=method]').selectOption('cash');await pay.locator('[name=received]').fill((saved.totalCents/100).toFixed(2).replace('.',','));await pay.getByRole('button',{name:'Confirmar cobro y crear pedido',exact:true}).click();
  await page.getByRole('heading',{name:'Respuesta pendiente de recuperar',exact:true}).waitFor();const writesAfterSale=posts();await page.getByRole('button',{name:'Recuperar resultado',exact:true}).click();await page.getByRole('heading',{name:'Pedido verificado en PrestaShop',exact:true}).waitFor();assert.equal(posts(),writesAfterSale);assert.equal(submits.length,1);
  const orderId=Number((await page.locator('.tpv-receipt').innerText()).match(/Pedido #(\d+)/)[1]);const linked=await call({action:'budget-get',selection,operationId:saved.id});assert.equal(linked.status,'sold');assert.equal(linked.orderId,orderId);assert.equal(inspectCommercialCart(fixture.productId,0).stock,stockBefore-1);
  await page.getByRole('button',{name:'Pedidos y devoluciones',exact:true}).click();await page.locator('.tpv-history article').filter({hasText:new RegExp('Pedido #'+orderId+'(?![0-9])')}).getByRole('button',{name:'Devolver',exact:true}).click();
  const refund=page.locator('[data-tpv-form=refund]');await refund.locator('input[type=number]').fill('1');await refund.locator('[name=reason]').fill('Devolución del recorrido de presupuesto');await refund.locator('input[type=checkbox]').check();await page.getByRole('button',{name:'Calcular devolución',exact:true}).click();await page.getByRole('heading',{name:/Confirmar devolución/}).waitFor();await page.getByRole('button',{name:'Confirmo el reintegro al cliente',exact:true}).click();await page.getByText('Devolución verificada:',{exact:false}).waitFor();
  assert.equal(inspectCommercialCart(fixture.productId,0).stock,stockBefore);assert.deepEqual(errors,[]);
  console.log('PASS native budget browser: real UI/adapter/SQL/native save, lost-reply recovery across reload without another native POST, private-note exclusion, desktop/mobile, explicit conversion, cash order, lost-sale recovery, linked budget and refund/restock. Loopback only.');return {budgetId:saved.id,orderId};
 }finally{await page.close();await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
}
