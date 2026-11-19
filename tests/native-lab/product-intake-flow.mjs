import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {deflateSync,crc32} from 'node:zlib';
function png(){const chunk=(name,data)=>{const result=Buffer.alloc(data.length+12);result.writeUInt32BE(data.length);result.write(name,4);data.copy(result,8);result.writeUInt32BE(crc32(result.subarray(4,8+data.length)),8+data.length);return result;};
 const header=Buffer.alloc(13);header.writeUInt32BE(2);header.writeUInt32BE(1,4);header[8]=8;header[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(Buffer.from([0,30,120,70,0,40,130,80,255]))),chunk('IEND',Buffer.alloc(0))]).toString('base64');}
export async function exerciseProductIntake({call,db,scope,fixture,paths,nativeRead,loseBaseReply,loseStageAck}){
 const categoryId=randomUUID(),categoryName='Familia QA '+categoryId.slice(0,8);
 const categoryPrepared=await call('product-category-prepare',{payload:{name:categoryName,parentId:fixture.categoryId}},categoryId);
 assert.equal(categoryPrepared.status,'ready');
 const categoryResult=await call('product-category-step',{},categoryId);assert.equal(categoryResult.status,'completed',JSON.stringify(categoryResult));
 assert.equal(paths.filter(row=>row.method==='POST'&&row.path==='/api/categories').length,1);
 assert.equal((await call('product-category-step',{},categoryId)).recordId,categoryResult.recordId);
 assert.equal(paths.filter(row=>row.method==='POST'&&row.path==='/api/categories').length,1);
 const categoryNative=await nativeRead('categories/'+categoryResult.recordId),createdCategory=categoryNative.category??categoryNative.categories?.[0];
 assert.equal(String(createdCategory.id_parent),fixture.categoryId);assert.equal(String(createdCategory.id_shop_default),String(scope.shopId));
 assert.equal((await call('product-categories',{},randomUUID())).some(row=>row.id===categoryId&&row.status==='completed'),true);
 const id=randomUUID(),draft={name:'Camiseta TPV QA '+id.slice(0,8),reference:'QA-INTAKE-'+id.slice(0,8),price:'12.500001',cost:'5.250001',
  categoryId:categoryResult.recordId,manufacturerId:fixture.manufacturerId,supplierId:fixture.supplierId,taxRulesGroupId:'0',quantity:0,visibility:'none',
  images:[{name:'camiseta.png',mime:'image/png',base64:png()}],variants:fixture.attributeValueIds.map((value,index)=>({attributeValueIds:[value],price:index?'14.750002':'9.500001',cost:index?'6.125001':'4.250001',quantity:index?7:3,supplierReference:'SUP-'+index,imageIndexes:[0]}))};
 const prepared=await call('product-intake-prepare',{payload:draft},id);assert.equal(prepared.status,'ready');
 assert.equal(paths.filter(row=>row.method==='POST'&&row.path==='/api/products').length,0,'Preparing does not create a native product');
 assert.equal(JSON.stringify(prepared).includes(draft.images[0].base64),false);
 loseBaseReply();let result=await call('product-intake-step',{},id);
 if(result.status==='attention'){assert.equal(result.currentStep,0);result=await call('product-intake-step',{},id);}
 assert.equal(result.currentStep,1);const productId=result.productId;
 assert.equal(paths.filter(row=>row.method==='POST'&&row.path==='/api/products').length,1,'Lost reply must not repeat native product creation');
 const original=await nativeRead('products/'+productId),initial=original.product??original.products?.[0];assert.ok(initial,JSON.stringify(original));assert.equal(String(initial.active),'0',JSON.stringify(original));assert.equal(String(initial.available_for_order),'0',JSON.stringify(original));
 // Image and first combination are verified by the official Webservice. Lose
 // only the coordinator ACK after the common stage journal has committed.
 result=await call('product-intake-step',{},id);assert.equal(result.currentStep,2);loseStageAck('variant-0');
 await assert.rejects(call('product-intake-step',{},id),/TPV_STORAGE_UNAVAILABLE/);
 const busy=await call('product-intake-step',{},id);assert.equal(busy.busy,true);
 await db.exec('reset role');await db.query("update private.totus_tpv_product_intakes set lease_until=clock_timestamp()-interval '1 second' where id=$1",[id]);
 result=await call('product-intake-step',{},id);assert.equal(result.currentStep,3);
 for(let count=0;count<12&&result.status!=='completed';count++){
  result=await call('product-intake-step',{},id);
  assert.notEqual(result.status,'attention','Native step requires recovery: '+JSON.stringify(result));
 }
 assert.equal(result.status,'completed',JSON.stringify(result));
 assert.equal(paths.filter(row=>row.method==='POST'&&row.path==='/api/combinations').length,2,'Recovered combination ACK must not repeat native POST');
 const writes=paths.filter(row=>['POST','PUT'].includes(row.method)).length;
 assert.equal((await call('product-intake-step',{},id)).status,'completed');
 assert.equal(paths.filter(row=>['POST','PUT'].includes(row.method)).length,writes,'Completed workflow is immutable');
 const final=await nativeRead('products/'+productId),product=final.product??final.products?.[0];
 assert.equal(String(product.active),'1');assert.equal(String(product.visibility),'none');assert.equal(String(product.id_manufacturer),fixture.manufacturerId);
 assert.equal(String(product.id_supplier),fixture.supplierId);assert.equal(product.associations.images.length,1);assert.equal(product.associations.combinations.length,2);
 const combinations=(await nativeRead('combinations?filter[id_product]=['+productId+']&display=full')).combinations;
 assert.deepEqual(combinations.map(row=>Number(row.price)).sort((a,b)=>a-b),[-3,2.250001]);
 const stock=(await nativeRead('stock_availables?filter[id_product]=['+productId+']&filter[id_shop]=[1]&display=full')).stock_availables;
 assert.deepEqual(stock.filter(row=>String(row.id_product_attribute)!=='0').map(row=>Number(row.quantity)).sort((a,b)=>a-b),[3,7]);
 const suppliers=(await nativeRead('product_suppliers?filter[id_product]=['+productId+']&display=full')).product_suppliers;
 assert.equal(suppliers.length,3);assert.deepEqual(suppliers.map(row=>Number(row.product_supplier_price_te)).sort((a,b)=>a-b),[4.250001,5.250001,6.125001]);
 assert.equal((await call('product-intake-get',{},id)).productId,productId);
 console.log('PASS native product intake: actual authenticated handler, migrated PostgreSQL journals and PrestaShop 8.2.8 Webservice; image, two combinations, exact price impacts, supplier costs, stock, final availability, lost product response and lost combination ACK without duplicate POSTs. Isolated loopback only.');
 return {id,productId,status:result.status,steps:result.currentStep,scope};
}
