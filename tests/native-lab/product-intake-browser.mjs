import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {chromium} from 'playwright';
import {startLocalServer} from '../local-static-server.mjs';
export async function exerciseNativeProductBrowser({handle,actor,fixture,preferences}){
 const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[];
 page.setDefaultTimeout(60000);page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.route('**/*',async route=>{const url=new URL(route.request().url());
   if(url.origin==='http://127.0.0.1:4173')return route.continue();
   if(url.origin==='https://preproduccion.hortimatic.com'&&url.pathname.startsWith('/img/')){
    const response=await fetch('http://127.0.0.1:8772'+url.pathname,{redirect:'error'});
    return route.fulfill({status:response.status,body:Buffer.from(await response.arrayBuffer()),contentType:response.headers.get('content-type')||'image/jpeg'});
   }
   return route.abort('blockedbyclient');
  });
  await page.route('**/__product_fixture',async route=>{const response=await handle(new Request('https://central.local/tpv',{method:'POST',
   headers:{Authorization:'Bearer synthetic-auth-fixture','Content-Type':'application/json'},body:route.request().postData()}));
   return route.fulfill({status:response.status,contentType:'application/json',body:await response.text()});});
  await page.route('**/__product_preferences',async route=>{const {drawer,value}=JSON.parse(route.request().postData());
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(await preferences(drawer,value))});});
  await page.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');
  await page.evaluate(async actor=>{
   fixture.workspace.dispose();const {createTpvWorkspace}=await import('/src/totustpv/workspace.js'),{createCentralTpvAdapter}=await import('/src/totustpv/central-adapter.js');
   window.productWorkspace=createTpvWorkspace({actor:()=>({id:actor,active:true,full_name:'Cajero del laboratorio'}),can:()=>true,canReadCost:()=>true,canCreateProduct:()=>true,confirm:async()=>true,autoOpen:true,
    workspacePreferences:async(drawer,value)=>{const response=await fetch('/__product_preferences',{method:'POST',body:JSON.stringify({drawer,value})});return response.json();},
    createLiveAdapter:()=>createCentralTpvAdapter({actorId:actor,storage:localStorage,invoke:async payload=>{
     const response=await fetch('/__product_fixture',{method:'POST',body:JSON.stringify(payload)}),result=await response.json();
     if(!response.ok||result.error){const error=Error(result.error||'Native fixture error');error.code=result.error;throw error;}return result;
    }})});productWorkspace.mount(document.querySelector('#tpv'));
  },actor);
  const search=page.locator('[data-tpv-search]');await search.waitFor();await search.fill(fixture.reference);
  await page.locator(`[data-tpv-add="${fixture.productId}:0"]`).waitFor();
  await page.getByText('Más acciones',{exact:true}).click();await page.getByRole('button',{name:'Configuración',exact:true}).click();
  await page.locator('[name=priceMode]').selectOption('net');await page.getByRole('button',{name:'Guardar mostrador',exact:true}).click();
  await page.getByText('Mostrador guardado en tu cuenta.',{exact:true}).waitFor();await page.getByRole('button',{name:'Venta',exact:true}).click();
  assert.match(await page.locator(`[data-tpv-add="${fixture.productId}:0"] b`).innerText(),/6,62[^]*sin IVA/);
  await mkdir('artifacts/totustpv-product-intake',{recursive:true});
  for(const width of [1440,390]){await page.setViewportSize({width,height:950});await page.screenshot({path:`artifacts/totustpv-product-intake/native-net-prices-${width}.png`,fullPage:true});}
  await page.setViewportSize({width:1440,height:950});
  await page.locator(`[data-tpv-add="${fixture.productId}:0"]`).click();assert.equal(await page.locator('.tpv-ticket-line').count(),1);
  await page.getByText('Más acciones',{exact:true}).click();await page.getByRole('button',{name:'Nuevo producto',exact:true}).click();
  const dialog=page.locator('.tpv-product-dialog');await dialog.locator('[data-tpv-product-form],[role=alert]').first().waitFor();
  assert.equal(await dialog.getByRole('alert').count(),0,await dialog.innerText());
  const reference='QA-UI-'+randomUUID().slice(0,8);
  await dialog.getByLabel('Nombre del artículo',{exact:true}).fill('Artículo desde el mostrador');await dialog.getByLabel('Referencia',{exact:true}).fill(reference);
  await dialog.getByLabel('Precio de venta sin impuestos (€)',{exact:true}).fill('3,250001');await dialog.getByLabel('Precio de compra sin impuestos (€)',{exact:true}).fill('1,125001');
  await dialog.getByLabel('Categoría',{exact:true}).selectOption(fixture.productSetup.categoryId);await dialog.getByLabel('Proveedor',{exact:true}).selectOption(fixture.productSetup.supplierId);
  await dialog.getByRole('button',{name:'+ Crear categoría',exact:true}).click();
  await dialog.getByLabel('Nombre de la categoría',{exact:true}).fill('Familia desde el mostrador '+reference);
  await dialog.getByLabel('Dentro de',{exact:true}).selectOption(fixture.productSetup.categoryId);
  await dialog.getByRole('button',{name:'Revisar categoría',exact:true}).click();
  await dialog.getByRole('button',{name:'Confirmar y comprobar categoría',exact:true}).waitFor();
  for(const width of [1440,390]){await page.setViewportSize({width,height:950});await page.screenshot({path:`artifacts/totustpv-product-intake/native-category-${width}.png`,fullPage:true});assert.equal(await dialog.evaluate(el=>el.scrollWidth>el.clientWidth+2),false);}
  await dialog.getByRole('button',{name:'Confirmar y comprobar categoría',exact:true}).click();
  await dialog.getByRole('button',{name:'Usar en este producto',exact:true}).click();
  assert.equal(await dialog.getByLabel('Referencia',{exact:true}).inputValue(),reference);
  assert.notEqual(await dialog.getByLabel('Categoría',{exact:true}).inputValue(),fixture.productSetup.categoryId);
  await dialog.getByLabel('Unidades disponibles',{exact:true}).fill('2');
  await mkdir('artifacts/totustpv-product-intake',{recursive:true});
  for(const width of [1440,390]){await page.setViewportSize({width,height:950});await page.screenshot({path:`artifacts/totustpv-product-intake/native-form-${width}.png`,fullPage:true});assert.equal(await dialog.evaluate(el=>el.scrollWidth>el.clientWidth+2),false);}
  await dialog.getByRole('button',{name:'Guardar ficha para revisar',exact:true}).click();await dialog.getByRole('button',{name:'Confirmar y crear producto',exact:true}).waitFor();
  await dialog.getByRole('button',{name:'Confirmar y crear producto',exact:true}).click();
  await dialog.getByText('Alta terminada',{exact:true}).waitFor();assert.equal(await dialog.getByRole('alert').count(),0,await dialog.innerText());
  await page.screenshot({path:'artifacts/totustpv-product-intake/native-review-390.png',fullPage:true});
  await dialog.getByRole('button',{name:'Cerrar alta de producto',exact:true}).click();assert.equal(await page.locator('.tpv-ticket-line').count(),1);
  await search.fill(reference);const product=page.locator('[data-tpv-add]').filter({hasText:'Artículo desde el mostrador'});await product.waitFor();
  await product.click();await page.getByRole('button',{name:'Ver ticket',exact:true}).click();assert.equal(await page.locator('.tpv-ticket-line').count(),2);
  assert.deepEqual(errors,[]);console.log('PASS native browser product intake: real Central adapter/handler, PostgreSQL and PrestaShop; new simple article, supplier cost, two units, desktop/mobile, native catalogue re-read, add to existing ticket without a sale. Authentication and loopback delivery are fixtures.');
 }finally{await page.close();await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
}
