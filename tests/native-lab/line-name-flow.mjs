import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function exerciseNativeLineName({call,raw,selection,fixture,preferences,nativeRead,paths}){
 const results=[];for(const item of [fixture.linePriceSetup.items.normal,fixture.linePriceSetup.items.variant]){const drawer={connectionId:selection.connectionId,shopId:selection.shopId,id:selection.drawerId};
 const original=await nativeRead(`products?filter[id]=[${item.id}]`),posts=()=>paths.filter(row=>row.method==='POST').length;
 const prepare=(id,name)=>({action:'prepare',selection,operationId:id,lines:[{productId:item.id,attributeId:item.attributeId||0,qty:1,...(name===undefined?{}:{displayName:name})}]});
 await preferences(drawer,{lineOptions:{allowNameChanges:false}});let before=posts();
 assert.equal((await raw(prepare(randomUUID(),'Artículo personalizado'))).result.error,'TPV_LINE_NAME_FORBIDDEN');assert.equal(posts(),before);
 await preferences(drawer,{lineOptions:{allowNameChanges:true}});
 for(const name of ['<script>','a'.repeat(256),'bad\u0000']){assert.equal((await raw(prepare(randomUUID(),name))).result.error,'TPV_LINE_NAME_INVALID');assert.equal(posts(),before);}
 const name='Preparado especial del cliente 🙂',id=randomUUID();
 const parked=await call({action:'park',selection,operationId:randomUUID(),version:0,label:'Preparado del cliente',payload:{lines:[{productId:item.id,attributeId:item.attributeId||0,qty:1,label:name,displayName:name,originalLabel:'Artículo del catálogo'}]}});
 const claimed=await call({action:'claim-draft',selection,operationId:randomUUID(),draftId:parked.id,version:parked.version});
 assert.equal(claimed.payload.lines[0].displayName,name);assert.equal(claimed.payload.lines[0].originalLabel,'Artículo del catálogo');
 const ready=await call({...prepare(id,claimed.payload.lines[0].displayName),draftId:claimed.id,draftVersion:claimed.version});assert.equal(ready.status,'ready');assert.equal(ready.expected.hasLineNameOverrides,true);
 const total=ready.expected.totalCents,payments={allocations:[{id:'cash-name',method:'cash',amountCents:total,receivedCents:total}],confirmation:{operationId:id,totalCents:total,currency:'EUR',accepted:true}};
 await preferences(drawer,{lineOptions:{allowNameChanges:false}});before=posts();assert.equal((await raw({action:'submit',selection,operationId:id,payments})).result.error,'TPV_LINE_NAME_FORBIDDEN');assert.equal(posts(),before);
 await preferences(drawer,{lineOptions:{allowNameChanges:true}});
 const sold=await call({action:'submit',selection,operationId:id,payments});assert.equal(sold.status,'confirmed');
 const written=posts();assert.equal((await call({action:'recover',selection,operationId:id})).status,'confirmed');assert.equal((await call({action:'submit',selection,operationId:id,payments})).status,'confirmed');assert.equal(posts(),written);
 const receipt=await call({action:'document',selection,operationId:id,kind:'receipt'});assert.ok(JSON.stringify(receipt).includes(name));
 const after=await nativeRead(`products?filter[id]=[${item.id}]`);assert.deepEqual(after,original,'Temporary sale names must never modify catalogue products');
 const available=await call({action:'returnable',selection,operationId:randomUUID(),saleId:id}),refundId=randomUUID();
 await call({action:'prepare-refund',selection,operationId:refundId,saleId:id,items:[{detailId:available.items[0].detail_id,qty:1,restock:true}],payments:[{method:'cash',amountCents:total}]});
 assert.equal((await call({action:'submit-refund',selection,operationId:refundId,confirmation:{accepted:true,operationId:refundId,totalCents:total,currency:'EUR'}})).status,'confirmed');
 console.log('PASS temporary sale name: opt-in, malformed refusal before native writes, policy revocation before payment, native OrderDetail and receipt, read-only recovery, unchanged catalogue, refund and restock. Local only.');
 results.push({operationId:id,orderId:sold.orderId});}return {sales:results};
}
