import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {startLocalServer} from '../local-static-server.mjs';
export async function exerciseNativeCatalogueFilterBrowser({handle,actor,fixture,preferences,nativeWriteCount}){
 const sample=fixture.catalogueFilterSetup,before=nativeWriteCount(),server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[];
 page.setDefaultTimeout(60000);page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4173'?route.continue():route.abort('blockedbyclient'));
  await page.route('**/__filter_preferences',async route=>{const {drawer,value}=JSON.parse(route.request().postData());return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(await preferences(drawer,value))});});
  await page.route('**/__filter_fixture',async route=>{const response=await handle(new Request('https://central.local/tpv',{method:'POST',headers:{Authorization:'Bearer synthetic-auth-fixture','Content-Type':'application/json'},body:route.request().postData()}));return route.fulfill({status:response.status,contentType:'application/json',body:await response.text()});});
  await page.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');
  await page.evaluate(async actor=>{fixture.workspace.dispose();const {createTpvWorkspace}=await import('/src/totustpv/workspace.js'),{createCentralTpvAdapter}=await import('/src/totustpv/central-adapter.js');
   window.filterWorkspace=createTpvWorkspace({actor:()=>({id:actor,active:true}),can:()=>true,canStock:()=>true,confirm:async()=>true,autoOpen:true,
    workspacePreferences:async(drawer,value)=>(await fetch('/__filter_preferences',{method:'POST',body:JSON.stringify({drawer,value})})).json(),
    createLiveAdapter:()=>createCentralTpvAdapter({actorId:actor,storage:localStorage,invoke:async payload=>{const response=await fetch('/__filter_fixture',{method:'POST',body:JSON.stringify(payload)}),result=await response.json();if(!response.ok||result.error){const error=Error(result.error);error.code=result.error;throw error;}return result;}})});filterWorkspace.mount(document.querySelector('#tpv'));
  },actor);
  const search=page.locator('[data-tpv-search]');await search.waitFor();await search.fill(sample.prefix);
  const available=page.locator(`[data-tpv-add="${sample.ids.available}:0"]`);await page.waitForFunction(()=>document.querySelectorAll('.tpv-product').length===4);await available.click();assert.equal(await page.locator('.tpv-product').count(),4);
  await page.getByText('Más acciones',{exact:true}).click();await page.getByRole('button',{name:'Configuración',exact:true}).click();
  await page.locator('[name=hideUnavailable]').check();await page.locator('[name=extraDetails]').check();
  await page.locator('[name=variantOrder]').selectOption('stock:desc');
  await page.locator('[name=excludedCategories]').selectOption(String(sample.parentId));await page.locator('[name=initialCategoryId]').selectOption(String(sample.childId));
  await page.getByRole('button',{name:'Guardar mostrador',exact:true}).click();await page.getByRole('alert').filter({hasText:'categoría inicial está oculta'}).waitFor();
  await page.locator('[name=initialCategoryId]').selectOption('0');await page.getByRole('button',{name:'Guardar mostrador',exact:true}).click();await page.getByText('Mostrador guardado en tu cuenta.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Venta',exact:true}).click();await page.getByText('No hay artículos con esa búsqueda.',{exact:true}).waitFor();
  assert.equal(await page.locator(`[data-tpv-category] option[value="${sample.parentId}"],[data-tpv-category] option[value="${sample.childId}"]`).count(),0);
  await page.getByText('Más acciones',{exact:true}).click();await page.getByRole('button',{name:'Entrada de stock',exact:true}).click();
  await page.locator(`[data-tpv-stock="${sample.ids.zero}:0"]`).waitFor();assert.equal(await page.locator('.tpv-product').count(),4,'Stock receipt ignores sale-only visibility filters');
  await page.getByRole('button',{name:'Venta',exact:true}).click();await page.getByText('No hay artículos con esa búsqueda.',{exact:true}).waitFor();
  await page.getByText('Más acciones',{exact:true}).click();await page.getByRole('button',{name:'Configuración',exact:true}).click();
  assert.equal(await page.locator('[name=hideUnavailable]').isChecked(),true);assert.deepEqual(await page.locator('[name=excludedCategories]').evaluate(el=>[...el.selectedOptions].map(row=>row.value)),[String(sample.parentId)]);
  assert.equal(await page.locator('[name=variantOrder]').inputValue(),'stock:desc');
  await page.locator('[name=excludedCategories]').selectOption([]);await page.getByRole('button',{name:'Guardar mostrador',exact:true}).click();await page.getByText('Mostrador guardado en tu cuenta.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Venta',exact:true}).click();await available.waitFor();assert.equal(await page.locator('.tpv-product').count(),2);
  assert.equal(await page.locator(`[data-tpv-add="${sample.ids.zero}:0"],[data-tpv-add="${sample.ids.negative}:0"]`).count(),0);
  assert.match(await available.locator('.tpv-product-details').innerText(),new RegExp(sample.brand));assert.match(await available.innerText(),new RegExp(sample.supplier));
  await mkdir('artifacts/totustpv-catalogue-filters',{recursive:true});
  for(const width of [1440,390]){await page.setViewportSize({width,height:950});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);await page.screenshot({path:`artifacts/totustpv-catalogue-filters/native-${width}.png`,fullPage:true});}
  const parent=page.locator(`[data-tpv-add^="${sample.ids.variants}:"]`);assert.equal(await parent.isEnabled(),true);assert.match(await parent.innerText(),/Existencias por variante/);assert.doesNotMatch(await parent.innerText(),/0 disponibles/);await parent.click();
  await page.getByRole('button',{name:'Volver a productos',exact:true}).waitFor();
  const dialog=page.locator('.tpv-variant-dialog');await dialog.waitFor();assert.equal(await dialog.evaluate(el=>el.matches(':modal')),true);
  await page.waitForFunction(()=>document.querySelector('[data-tpv-variant-group]')&&!document.querySelector('[data-tpv-variant-group]').disabled);
  assert.equal(await dialog.locator('[data-tpv-variant-order]').inputValue(),'stock:desc','The native selector opens with the account/workstation order read back from SQL');
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(await page.locator('.tpv-ticket-line').count(),1);
  await parent.click();await dialog.waitFor();
  assert.equal(await dialog.locator('[data-tpv-view]').inputValue(),'grid','The initial phone selector uses readable cards');
  await dialog.locator('[data-tpv-view]').selectOption('table');
  const group=dialog.locator('[data-tpv-variant-group]');await group.locator('option').nth(1).waitFor({state:'attached'});const groupId=await group.locator('option').nth(1).getAttribute('value');
  await group.selectOption(groupId);await page.waitForFunction(id=>document.querySelector('[data-tpv-variant-group]')?.value===id&&!document.querySelector('[data-tpv-variant-group]')?.disabled,groupId);
  const variant=dialog.locator(`[data-tpv-add="${sample.ids.variants}:${fixture.variant.variants[1].attributeId}"]`);await variant.waitFor();assert.equal(await dialog.locator('tbody tr').count(),1);
  assert.match(await variant.locator('xpath=ancestor::tr').locator('.tpv-variant-details').innerText(),/: /);
  await mkdir('artifacts/totustpv-variants',{recursive:true});
  for(const width of [1440,390]){await page.setViewportSize({width,height:950});await dialog.locator('[data-tpv-view]').selectOption(width===390?'grid':'table');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);await page.screenshot({path:`artifacts/totustpv-variants/attributes-${width}.png`,fullPage:true});}
  await variant.click();await dialog.waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Ver ticket',exact:true}).click();assert.equal(await page.locator('.tpv-ticket-line').count(),2,'The original ticket and selected available variant survive visibility changes');
  assert.equal(nativeWriteCount(),before);assert.deepEqual(errors,[]);
  console.log('PASS native catalogue filter browser: real SQL preferences, hidden initial category validation, exclusions/descendants, stock receipt retains all products, sale re-read, zero-parent available variant, brand/supplier details, preserved ticket and desktop/mobile. No native writes.');
 }finally{await page.close();await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
}
