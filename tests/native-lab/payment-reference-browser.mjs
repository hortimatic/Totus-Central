import assert from 'node:assert/strict';import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';import {startLocalServer} from '../local-static-server.mjs';
export async function exercisePaymentReferenceBrowser({handle,actor,preferences,fixture,paths}){
 const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[];let loseReply=true,browserSaleId;
 const salePosts=()=>paths.filter(row=>row.method==='POST'&&row.path==='/api/totus_tpv_sales').length,before=salePosts();
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.route('**/*',async route=>new URL(route.request().url()).origin==='http://127.0.0.1:4173'?route.continue():route.abort('blockedbyclient'));
  await page.route('**/__reference_preferences',async route=>{const {drawer,value}=JSON.parse(route.request().postData());return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(await preferences(drawer,value))});});
  await page.route('**/__reference_fixture',async route=>{const payload=JSON.parse(route.request().postData()),response=await handle(new Request('https://central.local/tpv',{method:'POST',headers:{Authorization:'Bearer synthetic-auth-fixture','Content-Type':'application/json'},body:JSON.stringify(payload)})),body=await response.text();
   if(payload.action==='submit'&&response.status===200)browserSaleId=payload.operationId;
   if(payload.action==='submit'&&response.status===200&&loseReply){loseReply=false;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'TPV_STORAGE_UNAVAILABLE'})});}
   return route.fulfill({status:response.status,contentType:'application/json',body});
  });
  await page.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');
  await page.evaluate(async actor=>{
   fixture.workspace.dispose();const {createTpvWorkspace}=await import('/src/totustpv/workspace.js'),{createCentralTpvAdapter}=await import('/src/totustpv/central-adapter.js');
   window.referenceWorkspace=createTpvWorkspace({actor:()=>({id:actor,active:true,full_name:'Operador de pruebas'}),can:()=>true,canAssign:()=>true,confirm:async()=>true,autoOpen:true,
    workspacePreferences:async(drawer,value)=>{const response=await fetch('/__reference_preferences',{method:'POST',body:JSON.stringify({drawer,value})});return response.json();},
    createLiveAdapter:()=>createCentralTpvAdapter({actorId:actor,storage:localStorage,invoke:async payload=>{const response=await fetch('/__reference_fixture',{method:'POST',body:JSON.stringify(payload)}),result=await response.json();if(!response.ok||result.error)throw Error(result.error||'Fixture failed');return result;}})});referenceWorkspace.mount(document.querySelector('#tpv'));
  },actor);
  const settings=async()=>{await page.waitForFunction(()=>document.querySelector('[data-tpv-action="settings"]')?.disabled===false);await page.getByText('Más acciones',{exact:true}).click();await page.getByRole('button',{name:'Configuración',exact:true}).click();await page.locator('[data-tpv-form="payment-settings"]').waitFor();};
  await settings();await page.getByLabel('Referencia de la operación del cobro externo',{exact:true}).check();await page.locator('[name=receipt-showLogo]').uncheck();
  await page.getByRole('button',{name:'Guardar mostrador',exact:true}).click();await page.getByText('Mostrador guardado en tu cuenta.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Venta',exact:true}).click();await page.locator('[data-tpv-search]').fill(fixture.reference);await page.locator(`[data-tpv-add="${fixture.productId}:0"]`).click();
  await page.getByRole('button',{name:'Calcular y cobrar',exact:true}).click();let pay=page.locator('[data-tpv-form="pay"]');
  await pay.locator('[name=method]').selectOption('card');await pay.locator('[name=cardAccepted]').check();
  let reference=pay.locator('[name="reference:card"]');assert.equal(await reference.getAttribute('required'),'');assert.equal(await pay.locator('button[type=submit]').isDisabled(),true);
  await reference.fill('4111111111111111');assert.equal(await pay.locator('button[type=submit]').isDisabled(),true);assert.equal(salePosts(),before);
  const value='BROWSER-OP-0042';await reference.fill(value);assert.equal(await pay.locator('button[type=submit]').isEnabled(),true);
  await pay.locator('button[type=submit]').click();await page.getByText('Respuesta pendiente de recuperar',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Recuperar resultado',exact:true}).click();await page.getByText('Pedido verificado en PrestaShop',{exact:true}).waitFor();assert.equal(salePosts(),before+1);
  await page.getByText('Documentos',{exact:true}).click();await page.locator('[data-tpv-document="receipt"]').click();await page.locator('.tpv-document').waitFor();assert.match(await page.locator('.tpv-document').innerText(),/Operación: BROWSER-OP-0042/);
  await mkdir('artifacts/totustpv-payment-reference',{recursive:true});
  for(const width of [1440,390]){await page.setViewportSize({width,height:950});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);await page.locator('.tpv-document').screenshot({path:`artifacts/totustpv-payment-reference/receipt-${width}.png`});}
  const printed=await page.evaluate(async()=>{const {prepareTpvPrintHtml}=await import('/src/totustpv/documents.js');return prepareTpvPrintHtml(document.querySelector('.tpv-document').outerHTML,'Ticket con referencia de cobro');});
  const paper=await browser.newPage({viewport:{width:220,height:850}});
  try{
   await paper.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');await paper.setContent(printed);await paper.emulateMedia({media:'print'});
   const dimensions=await paper.evaluate(async()=>{const {fitTpvPrintPage}=await import('/src/totustpv/documents.js');return fitTpvPrintPage(document);});
   assert.equal(dimensions.paperMm,58);assert.ok(dimensions.heightMm<220);
   assert.equal(await paper.evaluate(()=>document.body.scrollWidth>document.body.clientWidth+1),false,'Payment reference must fit the printable width');
   assert.match(await paper.locator('body').innerText(),/Operación: BROWSER-OP-0042/);
   await paper.pdf({path:'artifacts/totustpv-payment-reference/receipt-58mm.pdf',preferCSSPageSize:true,printBackground:true});
   await paper.screenshot({path:'artifacts/totustpv-payment-reference/receipt-58mm.png',clip:{x:0,y:0,width:220,height:await paper.locator('body').evaluate(el=>Math.ceil(el.getBoundingClientRect().height))}});
  }finally{await paper.close();}
  await page.locator('[data-tpv-action="close-document"]').click();await page.getByText('Documentos',{exact:true}).click();await page.locator('[data-tpv-document="gift"]').click();assert.doesNotMatch(await page.locator('.tpv-document').innerText(),/BROWSER-OP-0042|€/);await page.locator('[data-tpv-action="close-document"]').click();
  await page.setViewportSize({width:1440,height:950});
  const nativeWritesBeforeLookup=paths.filter(row=>row.method==='POST').length;
  await page.getByRole('button',{name:'Pedidos y devoluciones',exact:true}).click();await page.locator('[data-tpv-return="'+browserSaleId+'"]').click();
  const originalReferences=page.getByRole('region',{name:'Referencias del cobro original',exact:true});await originalReferences.waitFor();assert.match(await originalReferences.innerText(),/Tarjeta · BROWSER-OP-0042/);
  for(const width of [1440,390]){await page.setViewportSize({width,height:950});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);await originalReferences.screenshot({path:'artifacts/totustpv-payment-reference/return-reference-'+width+'.png'});}
  assert.equal(paths.filter(row=>row.method==='POST').length,nativeWritesBeforeLookup,'Looking up an original payment must not create a native command');
  await page.locator('[data-tpv-form="refund"] input[name^="qty-"]').first().fill('1');await page.locator('[data-tpv-form="refund"] [name=reason]').fill('Comprobación de referencia original sin reintegro');await page.getByRole('button',{name:'Calcular devolución',exact:true}).click();
  await page.getByRole('button',{name:'Cancelar preparación',exact:true}).waitFor();assert.match(await originalReferences.innerText(),/BROWSER-OP-0042/);assert.equal(paths.filter(row=>row.method==='POST').length,nativeWritesBeforeLookup,'Preparing the return must not execute a native refund');
  await page.getByRole('button',{name:'Cancelar preparación',exact:true}).click();await page.setViewportSize({width:1440,height:950});await page.getByRole('button',{name:'Venta',exact:true}).click();await page.getByRole('button',{name:'Nuevo ticket',exact:true}).click();
  for(const mode of ['optional','hidden']){
   await settings();const form=page.locator('[data-tpv-form="payment-settings"]');await form.locator('[name="reference:card"]').selectOption(mode);await form.getByRole('button',{name:'Guardar medios de cobro'}).click();await page.getByText('Medios de cobro guardados para esta caja.',{exact:true}).waitFor();
   await page.getByRole('button',{name:'Venta',exact:true}).click();if(mode==='optional'){await page.locator('[data-tpv-search]').fill(fixture.reference);await page.locator(`[data-tpv-add="${fixture.productId}:0"]`).click();}
   await page.getByRole('button',{name:'Calcular y cobrar',exact:true}).click();pay=page.locator('[data-tpv-form="pay"]');await pay.locator('[name=method]').selectOption('card');await pay.locator('[name=cardAccepted]').check();
   reference=pay.locator('[name="reference:card"]');if(mode==='optional'){assert.equal(await reference.count(),1);assert.equal(await reference.getAttribute('required'),null);}else assert.equal(await reference.count(),0);
   assert.equal(await pay.locator('button[type=submit]').isEnabled(),true);await page.getByRole('button',{name:'Volver al ticket',exact:true}).click();
  }
  assert.equal(salePosts(),before+1);assert.deepEqual(errors,[]);console.log('PASS external reference browser: required/PAN refusal, lost-reply recovery without duplicate native sale, receipt opt-in and gift privacy, optional/hidden modes and desktop/mobile. Local fixtures only.');
 }finally{await page.close();await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
}
