import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {receiptHtml} from '../../src/totustpv/documents.js';
export async function exerciseReceiptVariants({call,selection,fixture,rename,preferences}){
 const productId=fixture.variant.productId,attributeId=fixture.variant.variants[0].attributeId,id=randomUUID();
 const prepared=await call({action:'prepare',selection,operationId:id,lines:[{productId,attributeId,qty:1}]});
 const total=prepared.expected.totalCents;
 const sold=await call({action:'submit',selection,operationId:id,payments:{allocations:[{id:'cash',method:'cash',amountCents:total,receivedCents:total}],confirmation:{accepted:true,operationId:id,totalCents:total,currency:'EUR'}}});
 assert.equal(sold.status,'confirmed');
 const document=kind=>call({action:'document',selection,operationId:id,kind});
 const original=await document('receipt');assert.equal(original.lines.length,1);
 const line=original.lines[0];assert.match(line.base_name,/Totus variantes QA/);assert.ok(line.variant_name.length>0);
 assert.ok(receiptHtml(original).includes(line.variant_name));assert.ok(!receiptHtml(original,{showAttributes:false}).includes(line.variant_name));
 assert.ok(receiptHtml(original,{showAttributes:false}).includes(line.base_name));
 await rename(productId,attributeId);
 const historical=await document('receipt');assert.deepEqual(historical.lines,original.lines,'Renaming current product and attribute cannot rewrite the historical ticket');
 const gift=await document('gift');assert.equal(gift.lines[0].variant_name,line.variant_name);assert.doesNotMatch(receiptHtml(gift),/€/);
 const drawer={connectionId:selection.connectionId,shopId:selection.shopId,id:selection.drawerId};
 await preferences(drawer,{receipt:{showAttributes:false}});assert.equal((await preferences(drawer)).receipt.showAttributes,false);
 console.log('PASS receipt variant history: actual native combination sale, immutable base and attribute names after catalogue rename, optional rendering, gift privacy and persisted preference. Local fixture only.');
 return {id,original,gift};
}
