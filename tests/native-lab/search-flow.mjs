import assert from 'node:assert/strict';
export async function exerciseNativeSearch({call,fixture,nativeWriteCount}){
 const before=nativeWriteCount();
 for(const kind of ['product','variant'])for(const field of ['reference','ean13','upc','isbn']){
  const result=await call({search:fixture.searchCodes[kind][field],searchFields:[field]});assert.deepEqual(result.search_fields,[field]);
  const found=result.items.filter(row=>String(row.product_id)===String(kind==='product'?fixture.productId:fixture.variant.productId));
  assert.equal(found.length,1,kind+' '+field);assert.equal(found[0].choose_variant,false);
  if(kind==='variant')assert.equal(found[0].attribute_id,fixture.variant.variants[0].attributeId);
  const nameOnly=await call({search:fixture.searchCodes[kind][field],searchFields:['name']});assert.equal(nameOnly.items.length,0,'Disabled field must not match '+kind+' '+field);
 }
 const byName=await call({search:fixture.searchCodes.product.name,searchFields:['name']});assert.ok(byName.items.some(row=>row.product_id===fixture.productId));
 for(const search of ['%','_','!',"' OR 1=1 --"]){const result=await call({search,searchFields:['name']});assert.equal(result.items.length,0,'Search metacharacters remain literal');}
 const priceResult=await call({search:fixture.reference,searchFields:['reference'],sortField:'price'});assert.deepEqual(priceResult.search_fields,['reference']);
 const emptyPrice=await call({search:fixture.reference,searchFields:['isbn'],sortField:'price'});assert.equal(emptyPrice.items.length,0,'Another search field cannot reuse a price index result');
 assert.equal(nativeWriteCount(),before,'Search does not write native records');
 console.log('PASS native search: reference/EAN/UPC/ISBN for product and exact variant, name-only exclusion, literal wildcard escaping, price-index scope and read-only delivery. Local PrestaShop/MariaDB and actual Central handler.');
}
