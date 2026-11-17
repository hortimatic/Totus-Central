import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {startLocalServer} from '../local-static-server.mjs';
export async function exerciseNativeSearchBrowser({handle,actor,fixture,preferences}){
 const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[];
 page.setDefaultTimeout(60000);page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4173'?route.continue():route.abort('blockedbyclient'));
  await page.route('**/__search_preferences',async route=>{const {drawer,value}=JSON.parse(route.request().postData());return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(await preferences(drawer,value))});});
  await page.route('**/__search_fixture',async route=>{const response=await handle(new Request('https://central.local/tpv',{method:'POST',headers:{Authorization:'Bearer synthetic-auth-fixture','Content-Type':'application/json'},body:route.request().postData()}));return route.fulfill({status:response.status,contentType:'application/json',body:await response.text()});});
  await page.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');
  await page.evaluate(async actor=>{fixture.workspace.dispose();const {createTpvWorkspace}=await import('/src/totustpv/workspace.js'),{createCentralTpvAdapter}=await import('/src/totustpv/central-adapter.js');
   window.searchWorkspace=createTpvWorkspace({actor:()=>({id:actor,active:true}),can:()=>true,confirm:async()=>true,autoOpen:true,
    workspacePreferences:async(drawer,value)=>(await fetch('/__search_preferences',{method:'POST',body:JSON.stringify({drawer,value})})).json(),
    createLiveAdapter:()=>createCentralTpvAdapter({actorId:actor,storage:localStorage,invoke:async payload=>{const response=await fetch('/__search_fixture',{method:'POST',body:JSON.stringify(payload)}),result=await response.json();if(!response.ok||result.error){const error=Error(result.error);error.code=result.error;throw error;}return result;}})});searchWorkspace.mount(document.querySelector('#tpv'));
  },actor);
  const search=page.locator('[data-tpv-search]');await search.waitFor();await search.fill(fixture.reference);const product=page.locator(`[data-tpv-add="${fixture.productId}:0"]`);await product.click();
  await page.getByText('Más acciones',{exact:true}).click();await page.getByRole('button',{name:'Configuración',exact:true}).click();
  for(const checkbox of await page.locator('[name=searchFields]').all())await checkbox.uncheck();
  await page.getByRole('button',{name:'Guardar mostrador',exact:true}).click();await page.getByRole('alert').filter({hasText:'al menos un criterio'}).waitFor();
  assert.equal(await page.locator('[name=searchFields]:checked').count(),0,'Validation retains an empty selection');
  await page.locator('[name=searchFields][value=isbn]').check();await page.locator('[name=numericKeyboard]').check();
  await mkdir('artifacts/totustpv-search',{recursive:true});
  for(const width of [1440,390]){await page.setViewportSize({width,height:950});await page.screenshot({path:`artifacts/totustpv-search/native-settings-${width}.png`,fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);}
  await page.getByRole('button',{name:'Guardar mostrador',exact:true}).click();await page.getByText('Mostrador guardado en tu cuenta.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Venta',exact:true}).click();assert.equal(await search.getAttribute('inputmode'),'numeric');
  await page.getByText('No hay artículos con esa búsqueda.',{exact:true}).waitFor();await search.fill(fixture.searchCodes.product.isbn);await product.waitFor();
  assert.equal(await page.locator('.tpv-ticket-line').count(),1,'The ticket survives changing search criteria');
  await search.press('Enter');await page.waitForFunction(id=>document.querySelector('[data-tpv-quantity="'+id+':0"]')?.value==='2',fixture.productId);
  for(const width of [1440,390]){await page.setViewportSize({width,height:950});await page.screenshot({path:`artifacts/totustpv-search/native-results-${width}.png`,fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);}
  await search.fill(fixture.searchCodes.product.ean13);await page.getByText('No hay artículos con esa búsqueda.',{exact:true}).waitFor();await search.press('Enter');
  await page.getByText('No hay artículos con ese código.',{exact:true}).waitFor();assert.equal(await page.locator(`[data-tpv-quantity="${fixture.productId}:0"]`).inputValue(),'2');assert.deepEqual(errors,[]);
  console.log('PASS native search browser: real SQL preferences, empty criteria correction, ISBN-only lookup, excluded EAN/reference, numeric input mode, preserved ticket and 1440/390. Physical mobile keyboard and scanner are not certified.');
 }finally{await page.close();await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
}
