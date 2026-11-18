import assert from 'node:assert/strict';import {mkdir} from 'node:fs/promises';import {chromium} from 'playwright';import {startLocalServer} from '../local-static-server.mjs';
export async function exerciseDisabledStockBrowser({handle,actor,fixture,selection,preferences,inspect,paths}){
 const drawer={connectionId:selection.connectionId,shopId:selection.shopId,id:selection.drawerId};await preferences(drawer,{search:{includeDisabledStock:true}});
 const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true});
 try{await mkdir('qa-artifacts',{recursive:true});for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:950}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4173'?route.continue():route.abort('blockedbyclient'));
  await page.route('**/__disabled_stock_preferences',async route=>{const {drawer,value}=route.request().postDataJSON();return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(await preferences(drawer,value))});});
  await page.route('**/__disabled_stock_handler',async route=>{const response=await handle(new Request('https://central.local/tpv',{method:'POST',headers:{Authorization:'Bearer synthetic-auth-fixture','Content-Type':'application/json'},body:route.request().postData()}));return route.fulfill({status:response.status,contentType:'application/json',body:await response.text()});});
  await page.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');
  await page.evaluate(async actor=>{fixture.workspace.dispose();const {createTpvWorkspace}=await import('/src/totustpv/workspace.js'),{createCentralTpvAdapter}=await import('/src/totustpv/central-adapter.js');
   window.disabledStockWorkspace=createTpvWorkspace({actor:()=>({id:actor,active:true}),can:()=>true,canStock:()=>true,autoOpen:true,confirm:async()=>true,
    workspacePreferences:async(drawer,value)=>(await fetch('/__disabled_stock_preferences',{method:'POST',body:JSON.stringify({drawer,value})})).json(),
    createLiveAdapter:()=>createCentralTpvAdapter({actorId:actor,storage:localStorage,invoke:async payload=>{const response=await fetch('/__disabled_stock_handler',{method:'POST',body:JSON.stringify(payload)}),data=await response.json();if(!response.ok||data?.error)throw Error(data?.error);return data;}})});disabledStockWorkspace.mount(document.querySelector('#tpv'));
  },actor);
  const sample=fixture.disabledStockSetup,item=sample.items.inactive;await page.locator('[data-tpv-search]').waitFor();await page.locator('[data-tpv-search]').fill(sample.prefix);
  await page.locator('.tpv-product-list .tpv-empty').waitFor();assert.equal(await page.locator('[data-tpv-add]').count(),0);
  await page.getByText('Más acciones',{exact:true}).click();await page.getByRole('button',{name:'Entrada de stock',exact:true}).click();
  const checkbox=page.locator('[data-tpv-disabled-stock]'),product=page.locator(`[data-tpv-stock="${item.id}:0"]`);
  await product.waitFor();assert.equal(await checkbox.isChecked(),true,'Saved account/desk preference must be restored');
  await checkbox.uncheck();await product.waitFor({state:'detached'});await checkbox.check();await product.waitFor();
  assert.ok((await product.innerText()).includes('Solo para reposición'));
  const before=inspect(item.id,0);await product.click();await page.locator(`[data-tpv-stock-quantity="${item.id}:0"]`).fill('2');
  await page.locator('[data-tpv-stock-reason]').fill('Albarán QA deshabilitados '+width);await page.getByRole('button',{name:'Guardar entrada para revisar',exact:true}).click();
  await page.getByRole('button',{name:'Confirmar y registrar mercancía',exact:true}).waitFor();assert.deepEqual(inspect(item.id,0),before,'Saved manifest alone must not receive stock');
  await page.getByRole('button',{name:'Confirmar y registrar mercancía',exact:true}).click();await page.getByText('Entrada de mercancía verificada.',{exact:true}).waitFor();
  assert.deepEqual(inspect(item.id,0),{...before,stock:before.stock+2});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);await page.screenshot({path:`qa-artifacts/disabled-stock-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:'Venta',exact:true}).click();await page.locator('.tpv-product-list .tpv-empty').waitFor();assert.equal(await page.locator('[data-tpv-add]').count(),0);
  assert.deepEqual(errors,[]);await page.evaluate(()=>disabledStockWorkspace.dispose());await page.close();
 }assert.equal(paths.filter(row=>row.path==='/api/totus_tpv_sales').length,0);console.log('PASS disabled-stock desktop/mobile: real UI/adapter/handler/SQL/native catalogue, saved preference, temporary filter, durable manifest before stock confirmation, additive replenishment without activation and return to sale excludes disabled articles. No financial POST.');
 }finally{await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
}
