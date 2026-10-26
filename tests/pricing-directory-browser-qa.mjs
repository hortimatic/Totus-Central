import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 const click=async(action,id)=>page.locator(action==='close-modal'?'#modalHost .close-btn':'[data-action="'+action+'"]'+(id?'[data-id="'+id+'"]':'')).first().click();
 const read=table=>page.evaluate(table=>structuredClone(window.__mockDb[table]),table);
 const saved=async message=>{await page.getByText(message,{exact:true}).waitFor();await page.evaluate(()=>document.getElementById('toastHost').replaceChildren());};
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await page.locator('#nav [data-route="pricing"]').click();
 await click('families-manage');await click('brand-new');
 await page.locator('#brName').fill('Marca QA');await click('brand-save');await saved('Marca guardada.');
 const brand=(await read('brands'))[0];assert.equal(brand.name,'Marca QA');
 await click('families-manage');await click('family-new');
 await page.locator('#fmName').fill('Familia QA');await page.locator('#fmCategory').fill('Cartuchos');await page.locator('#fmMargin').fill('42,5');
 await click('family-save');await saved('Familia guardada.');
 const family=(await read('families'))[0];assert.equal(family.brand_id,brand.id);assert.equal(family.default_margin,42.5);
 await click('families-manage');await click('brand-delete',brand.id);
 await page.getByText('No se puede eliminar: la marca tiene 1 familias vinculadas.',{exact:true}).waitFor();assert.equal((await read('brands')).length,1);
 await click('close-modal');
 await click('providers-manage');await click('provider-new');await page.locator('#pvName').fill('Distribuidor QA');await click('provider-save');await saved('Proveedor guardado.');
 const provider=(await read('providers'))[0];
 await click('providers-manage');await click('provider-edit',provider.id);await page.locator('#pvName').fill('Distribuidor QA editado');await click('provider-save');await saved('Proveedor guardado.');
 assert.equal((await read('providers'))[0].name,'Distribuidor QA editado');
 // Seed only a fictional product; the directory operations above use their UI.
 const product=await page.evaluate(async family=>{
  const id=crypto.randomUUID();window.__mockDb.products.push({id,name:'Producto QA directorios',sku:'QA-DIRECTORIOS',family_id:family.id,product_type:'simple',pvp:10,status:'pendiente',active:true});
  await (await import('../src/api.js')).loadCore();document.querySelector('#nav [data-route="pricing"]').click();return id;
 },family);
 await click('product-edit',product);await click('provider-price-new');
 await page.locator('#ppNet').fill('4');await page.locator('#ppDiscount').fill('10');await page.locator('#ppShipping').fill('0,5');await page.locator('#ppSelected').check();
 await click('provider-price-save');await saved('Coste de proveedor guardado.');
 const price=(await read('product_provider_prices'))[0];assert.equal(price.net_cost,4);assert.equal(price.provider_discount,10);assert.equal(price.shipping_unit,.5);assert.equal(price.selected,true);assert.equal(price.product_id,product);
 await click('provider-price-edit',price.id);await page.locator('#ppNet').fill('5');await click('provider-price-save');await saved('Coste de proveedor guardado.');
 assert.equal((await read('product_provider_prices'))[0].net_cost,5);
 await click('competitor-new');await page.locator('#cpName').fill('Competidor QA');await page.locator('#cpPrice').fill('12');await page.locator('#cpDiscount').fill('5');await page.locator('#cpShipping').fill('1');
 await click('competitor-save');await saved('Competencia guardada.');
 const competitor=(await read('product_competitor_prices'))[0];assert.equal(competitor.price,12);assert.equal(competitor.discount,5);assert.equal(competitor.shipping,1);
 await click('competitor-edit',competitor.id);await page.locator('#cpPrice').fill('11');await click('competitor-save');await saved('Competencia guardada.');assert.equal((await read('product_competitor_prices'))[0].price,11);
 await click('competitor-delete',competitor.id);await saved('Competencia eliminada.');assert.equal((await read('product_competitor_prices')).length,0);
 await click('provider-price-delete',price.id);await saved('Coste eliminado.');assert.equal((await read('product_provider_prices')).length,0);
 await click('product-back');
 await click('providers-manage');await click('provider-delete',provider.id);await saved('Proveedor eliminado.');assert.equal((await read('providers')).length,0);
 await click('families-manage');await click('family-delete',family.id);await page.getByText('No se puede eliminar: la familia tiene 1 productos vinculados.',{exact:true}).waitFor();assert.equal((await read('families')).length,1);
 assert.deepEqual(errors,[]);
 console.log('PRICING DIRECTORY QA: brands/families, linked deletion guards, supplier costs and competitor create/edit/delete preserve their saved values');
}finally{await browser.close()}
