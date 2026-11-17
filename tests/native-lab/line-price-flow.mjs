import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function exerciseNativeLinePrice({call,raw,selection,fixture,preferences,nativeRead,paths}){
 const sample=fixture.linePriceSetup,items=sample.items,drawer={connectionId:selection.connectionId,shopId:selection.shopId,id:selection.drawerId};
 const set=allowPriceChanges=>preferences(drawer,{lineOptions:{allowPriceChanges}}),posts=()=>paths.filter(row=>row.method==='POST').length;
 const source=async id=>{const data=await nativeRead(`products?filter[id]=[${id}]`);assert.equal(data.products.length,1);return String(data.products[0].price);};
 const stock=async(id,attribute=0)=>{const data=await nativeRead(`stock_availables?filter[id_product]=[${id}]&filter[id_product_attribute]=[${attribute}]&filter[id_shop]=[1]`);assert.equal(data.stock_availables.length,1);return Number(data.stock_availables[0].quantity);};
 const pay=(id,total)=>({allocations:[{id:'cash-line-price',method:'cash',amountCents:total,receivedCents:total}],confirmation:{operationId:id,totalCents:total,currency:'EUR',accepted:true}});
 const initial=await source(items.normal.id),rows=await call({action:'catalogue',selection,operationId:randomUUID(),search:sample.prefix});assert.equal(rows.items.find(row=>row.product_id===items.normal.id).unit_price_override,true);
 assert.deepEqual((await preferences(drawer)).lineOptions,{allowPriceChanges:false,requireSaleNote:false});
 const id=randomUUID(),intent={action:'prepare',selection,operationId:id,lines:[{productId:items.normal.id,attributeId:0,qty:2,discount:{kind:'price',value:725}}]},before=posts();
 assert.equal((await raw(intent)).result.error,'TPV_PRICE_CHANGE_FORBIDDEN');assert.equal(posts(),before);
 assert.equal((await raw({...intent,lineOptions:{allowPriceChanges:true}})).result.error,'TPV_REQUEST_FIELD_FORBIDDEN');assert.equal(posts(),before);
 await set(true);const prepared=await call(intent);assert.equal(prepared.status,'ready');assert.equal(prepared.expected.hasPriceOverride,true);assert.equal(prepared.expected.totalCents,1450);assert.equal(await source(items.normal.id),initial);
 await set(false);const stale=await raw({action:'submit',selection,operationId:id,payments:pay(id,1450)});assert.equal(stale.result.error,'TPV_PRICE_CHANGE_FORBIDDEN');assert.equal(await stock(items.normal.id),8);
 await set(true);const sold=await call({action:'submit',selection,operationId:id,payments:pay(id,1450)});assert.equal(sold.status,'confirmed');assert.equal(await stock(items.normal.id),6);assert.equal(await source(items.normal.id),initial);
 const after=posts();assert.equal((await call({action:'recover',selection,operationId:id})).orderId,sold.orderId);assert.equal((await call({action:'submit',selection,operationId:id,payments:pay(id,1450)})).orderId,sold.orderId);assert.equal(posts(),after);
 const sales=[[id,items.normal.id,0,2,1450,8]];
 for(const [item,price,qty,total] of [[items.variant,1025,1,1025],[items.zero,375,2,750]]){
  const saleId=randomUUID(),attribute=item.attributeId||0,previous=await stock(item.id,attribute),base=await source(item.id),calculated=await call({action:'prepare',selection,operationId:saleId,lines:[{productId:item.id,attributeId:attribute,qty,discount:{kind:'price',value:price}}]});assert.equal(calculated.expected.totalCents,total);
  const result=await call({action:'submit',selection,operationId:saleId,payments:pay(saleId,total)});assert.equal(result.status,'confirmed');assert.equal(await stock(item.id,attribute),previous-qty);assert.equal(await source(item.id),base);sales.push([saleId,item.id,attribute,qty,total,previous]);
 }
 await set(false);
 for(const [discount,total] of [[{kind:'percent',value:1000},721],[{kind:'amount',value:100},701]]){const saleId=randomUUID(),previous=await stock(items.normal.id),calculated=await call({action:'prepare',selection,operationId:saleId,lines:[{productId:items.normal.id,attributeId:0,qty:1,discount}]});assert.equal(calculated.expected.totalCents,total);assert.equal(calculated.expected.hasPriceOverride,undefined);assert.equal((await call({action:'submit',selection,operationId:saleId,payments:pay(saleId,total)})).status,'confirmed');assert.equal(await source(items.normal.id),initial);sales.push([saleId,items.normal.id,0,1,total,previous]);}
 // Restore in reverse order because the same product has several open sales.
 for(const [saleId,product,attribute,qty,total,previous] of [...sales].reverse()){const available=await call({action:'returnable',selection,operationId:randomUUID(),saleId}),refundId=randomUUID();assert.equal((await call({action:'prepare-refund',selection,operationId:refundId,saleId,items:[{detailId:available.items[0].detail_id,qty,restock:true}],payments:[{method:'cash',amountCents:total}]})).status,'ready');assert.equal((await call({action:'submit-refund',selection,operationId:refundId,confirmation:{accepted:true,operationId:refundId,totalCents:total,currency:'EUR'}})).status,'confirmed');assert.equal(await stock(product,attribute),previous);}
 console.log('PASS native line prices: disabled/forged preference refused before POST, native prices reduced/increased/from zero, variant, immutable catalogue price, changed-policy refusal, payment/invoice/stock evidence, same-request recovery and refund/restock. Isolated PostgreSQL and PrestaShop only.');
 return {saleIds:sales.map(row=>row[0])};
}
