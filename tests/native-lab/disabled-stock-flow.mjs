import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
export async function exerciseDisabledStock({call,handle,selection,fixture,paths,inspect}){
 const sample=fixture.disabledStockSetup,posts=()=>paths.filter(row=>row.method==='POST').length;
 const catalogue=values=>call({action:'catalogue',selection,operationId:randomUUID(),...values});
 const before=posts();assert.equal((await catalogue({search:sample.prefix})).total_count,0);
 const inventory=await catalogue({search:sample.prefix,inventoryOnly:true});assert.equal(inventory.inventory_only,true);assert.equal(inventory.total_count,3);
 assert.ok(inventory.items.every(row=>row.enabled_for_sale===false));
 const variants=await catalogue({productId:sample.variantProductId,inventoryOnly:true});assert.equal(variants.total_count,2);assert.ok(variants.items.every(row=>row.enabled_for_sale===false));
 const price=await catalogue({search:sample.prefix,inventoryOnly:true,sortField:'price'});assert.equal(price.inventory_only,true);assert.equal(price.total_count,3);
 assert.equal((await catalogue({search:sample.prefix,sortField:'price'})).total_count,0,'Sales price index must not reuse inventory results');
 assert.equal(posts(),before,'Catalogue reads must not write native data');
 for(const item of Object.values(sample.items)){
  const response=await handle(new Request('https://central.local/tpv',{method:'POST',headers:{Authorization:'Bearer synthetic-auth-fixture','Content-Type':'application/json'},body:JSON.stringify({action:'prepare',selection,operationId:randomUUID(),lines:[{productId:item.id,attributeId:0,qty:1}]})}));
  assert.ok(response.status>=400,'Inactive/not-for-sale articles must not be prepared for sale');
  assert.equal(paths.filter(row=>row.path==='/api/totus_tpv_sales').length,0,'Rejected preparation cannot dispatch a sale');
  const original=inspect(item.id,0),operationId=randomUUID(),request={action:'stock-receive',selection,operationId,productId:item.id,attributeId:0,quantity:3,reason:'Reposición QA de artículo deshabilitado'};
  const received=await call(request);assert.equal(received.status,'verified');const written=posts();
  assert.equal((await call(request)).status,'verified');assert.equal(posts(),written,'Recovery must not repeat the stock write');
  assert.deepEqual(inspect(item.id,0),{...original,stock:original.stock+3});
 }
 const variant=variants.items[0],original=inspect(variant.product_id,variant.attribute_id),operationId=randomUUID();
 assert.equal((await call({action:'stock-receive',selection,operationId,productId:variant.product_id,attributeId:variant.attribute_id,quantity:2,reason:'Reposición QA de variante deshabilitada'})).status,'verified');
 assert.deepEqual(inspect(variant.product_id,variant.attribute_id),{...original,stock:original.stock+2});
 assert.equal((await catalogue({search:sample.prefix})).total_count,0);assert.equal(paths.filter(row=>row.path==='/api/totus_tpv_sales').length,0);
 console.log('PASS disabled inventory: normal sale search excludes inactive/not-for-sale products and variants; inventory search and price sorting include them, native replenishment changes only stock, recovery never repeats writes and no sale is prepared or posted. Local native runtime only.');
}
