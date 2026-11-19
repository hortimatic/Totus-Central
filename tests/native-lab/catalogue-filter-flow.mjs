import assert from 'node:assert/strict';
export async function exerciseNativeCatalogueFilters({call,fixture,nativeWriteCount}){
 const sample=fixture.catalogueFilterSetup,before=nativeWriteCount(),base={search:sample.prefix};
 const all=await call(base);assert.equal(all.total_count,4);assert.equal(all.items.length,4);
 const filtered=await call({...base,catalogueFilters:{hideUnavailable:true,excludedCategories:[]}});assert.equal(filtered.total_count,2);
 assert.deepEqual(filtered.items.map(row=>row.product_id).sort((a,b)=>a-b),[sample.ids.available,sample.ids.variants].sort((a,b)=>a-b));
 const parent=filtered.items.find(row=>row.product_id===sample.ids.variants);assert.equal(parent.stock,0);assert.equal(parent.choose_variant,true);
 const variants=await call({productId:sample.ids.variants,catalogueFilters:{hideUnavailable:true,excludedCategories:[]}});
 assert.equal(variants.total_count,1);assert.equal(variants.items.length,1);assert.equal(variants.items[0].attribute_id,fixture.variant.variants[1].attributeId);assert.ok(variants.items[0].stock>0);
 assert.ok(variants.items[0].variant_attributes.length>0);assert.ok(variants.items[0].variant_attributes.every(row=>Number.isSafeInteger(row.id)&&Number.isSafeInteger(row.groupId)&&row.name&&row.groupName));
 assert.ok(variants.variant_groups.length>0);const group=variants.variant_groups[0];
 const groupAsc=await call({productId:sample.ids.variants,variantGroupId:group.id,sortField:'name',sortDirection:'asc'});
 const groupDesc=await call({productId:sample.ids.variants,variantGroupId:group.id,sortField:'name',sortDirection:'desc'});
 assert.equal(groupAsc.variant_group_id,group.id);assert.equal(groupAsc.total_count,2);
 assert.deepEqual(groupDesc.items.map(row=>row.attribute_id),groupAsc.items.map(row=>row.attribute_id).reverse());
 await assert.rejects(()=>call({productId:sample.ids.variants,variantGroupId:2147483647}),/CATALOGUE_VARIANT_GROUP_INVALID/);
 await assert.rejects(()=>call({variantGroupId:group.id}),/CATALOGUE_QUERY_INVALID/);
 const paged=sample.variantPage,pages=[];
 for(const page of [0,1]){const result=await call({productId:paged.productId,variantGroupId:paged.groupId,sortField:'name',sortDirection:'asc',page});assert.equal(result.total_count,23);assert.equal(result.items.length,page===0?20:3);assert.equal(result.has_more,page===0);pages.push(...result.items.map(row=>row.attribute_id));}
 assert.deepEqual(pages,[...paged.ids].reverse(),'Group ordering precedes pagination across the complete native result');
 await assert.rejects(()=>call({productId:sample.ids.variants,variantGroupId:paged.groupId}),/CATALOGUE_VARIANT_GROUP_INVALID/);
 const unavailable=await call({search:fixture.variant.variants[0].reference,catalogueFilters:{hideUnavailable:true,excludedCategories:[]}});assert.equal(unavailable.total_count,0);
 for(const excluded of [sample.parentId,sample.childId]){const result=await call({...base,catalogueFilters:{hideUnavailable:false,excludedCategories:[excluded]}});assert.equal(result.total_count,0);assert.equal(result.items.length,0);}
 const price=await call({...base,sortField:'price',catalogueFilters:{hideUnavailable:true,excludedCategories:[]}});assert.equal(price.total_count,2);assert.deepEqual(price.catalogue_filters,{hideUnavailable:true,excludedCategories:[]});
 const excludedPrice=await call({...base,sortField:'price',catalogueFilters:{hideUnavailable:true,excludedCategories:[sample.parentId]}});assert.equal(excludedPrice.items.length,0);
 await assert.rejects(call({...base,catalogueFilters:{hideUnavailable:false,excludedCategories:[2147483647]}}),/FILTER_CATEGORY_INVALID/);
 const pageAll=await call({search:sample.pagePrefix});assert.equal(pageAll.total_count,23);assert.equal(pageAll.items.length,20);assert.equal(pageAll.has_more,true);assert.ok(pageAll.items.every(row=>row.stock===0));
 const pageFiltered=await call({search:sample.pagePrefix,catalogueFilters:{hideUnavailable:true,excludedCategories:[]}});assert.equal(pageFiltered.total_count,1);assert.equal(pageFiltered.items[0].product_id,sample.pageAvailable);assert.equal(pageFiltered.has_more,false,'Available item beyond an unfiltered page is still found');
 assert.equal(nativeWriteCount(),before,'Native catalogue filtering only reads');
 console.log('PASS native catalogue visibility: zero/negative simple stock, parent aggregate zero with available variant, complete result counts, exact unavailable variant, category descendants, price-index isolation and unknown category rejection. Actual loopback PrestaShop/MariaDB.');
}
