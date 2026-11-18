import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {barcodePlan,barcodeTargetPage} from '../../src/totustpv/barcode-options.js';
export async function exerciseNativeBarcodeHttp({api,command,fixture,actor,readOnlyKey,nativeHttpTrace,simulateLostResult,addTargetAfterBoundary,changeFixturePrice}){
 const resource='totus_tpv_barcodes',query=resource+'?field=ean13&product_id='+fixture.productId;
 const scan=await api(resource+'?mode=targets&field=ean13',{actor});assert.equal(scan.status,200,JSON.stringify(scan.result));const first=barcodeTargetPage(scan.result,{field:'ean13',shopId:1});assert.equal(first.items.length,50);assert.equal(first.has_more,true);
 const tail=`&after_product=${first.cursor[0]}&after_attribute=${first.cursor[1]}&max_product=${first.bounds.product}&max_attribute=${first.bounds.attribute}`;
 const next=await api(resource+'?mode=targets&field=ean13'+tail,{actor});assert.equal(next.status,200,JSON.stringify(next.result));const second=barcodeTargetPage(next.result,{field:'ean13',shopId:1,cursor:first.cursor,bounds:first.bounds});assert.ok(first.items.length+second.items.length>=60,'Target capture is not limited to fifty');
 const seen=new Set(first.items.map(row=>row.product_id+':'+row.attribute_id));assert.equal(second.items.some(row=>seen.has(row.product_id+':'+row.attribute_id)),false);
 const added=await addTargetAfterBoundary();assert.ok(added.productId>first.bounds.product);
 const end=`&after_product=${first.bounds.product}&after_attribute=${first.bounds.attribute}`;
 const bounded=await api(resource+'?mode=targets&field=ean13'+end+`&max_product=${first.bounds.product}&max_attribute=${first.bounds.attribute}`,{actor});assert.equal(bounded.status,200);assert.equal(barcodeTargetPage(bounded.result,{field:'ean13',shopId:1,cursor:[first.bounds.product,first.bounds.attribute],bounds:first.bounds}).items.length,0,'New products must not enter a captured boundary');
 const fresh=await api(resource+'?mode=targets&field=ean13'+end,{actor});assert.equal(fresh.status,200);assert.equal(fresh.result.items.some(row=>row.product_id===added.productId),true,'A new preparation may see the new product');
 assert.equal((await api(query,{auth:false,actor})).status,401,'Anonymous barcode plans are forbidden');
 assert.notEqual((await api(query,{actor:'not-an-identity'})).status,200);
 const planned=await api(query,{actor});assert.equal(planned.status,200,JSON.stringify(planned.result));const plan=barcodePlan(planned.result);
 assert.equal(plan.items.length,1);assert.equal(plan.items[0].product_id,fixture.productId);assert.equal(plan.capability.can_execute,true);
 const intent=command('barcodes.assign',{plan_version:1,field:plan.field,items:plan.items,plan_fingerprint:plan.plan_fingerprint,item_index:0});
 assert.equal((await api(query,{actor,authKey:readOnlyKey})).status,200,'A scoped read-only key may inspect plans');
 assert.notEqual((await api(resource,{method:'POST',body:intent,authKey:readOnlyKey})).status,200,'An authenticated read-only key must not assign a code');
 assert.equal((await api(resource,{method:'POST',body:intent,auth:false})).status,401);
 assert.notEqual((await api(resource,{method:'PUT',body:intent})).status,200,'No generic rewrite endpoint');
 const written=await api(resource,{method:'POST',body:intent});assert.equal(written.status,200,JSON.stringify(written.result));assert.equal(written.result.verified,true,JSON.stringify(written.result));assert.equal(written.result.items[0].code,plan.items[0].code);
 const recovery=await api('totus_tpv_operations?operation_id='+intent.operation_id,{actor});assert.equal(recovery.status,200);assert.equal(recovery.result.status,'verified',JSON.stringify(recovery.result));assert.deepEqual(recovery.result.result,written.result,'GET returns exact original native proof');
 assert.deepEqual((await api(resource,{method:'POST',body:intent})).result,written.result,'A duplicate cannot write twice');
 assert.notEqual((await api('totus_tpv_operations?operation_id='+intent.operation_id,{actor:randomUUID()})).status,200,'A different actor cannot read the intent');
 const forged={...intent,payload:{...intent.payload,item_index:1}};assert.notEqual((await api(resource,{method:'POST',body:forged})).status,200,'A bound operation cannot change its target');
 const native=await api('products/'+fixture.productId);assert.equal(native.status,200);assert.equal(native.result.product.ean13,plan.items[0].code);
 assert.notEqual((await api(query,{actor})).status,200,'A nonempty field is never offered as missing');
 const preserved=await api(resource+'?field=ean13&targets='+fixture.productId+':0&skip_existing=1',{actor});assert.equal(preserved.status,200);const skipped=barcodePlan(preserved.result);assert.equal(skipped.items.length,0);assert.deepEqual(skipped.skipped_targets,[{product_id:fixture.productId,attribute_id:0,reason:'already-set',code:plan.items[0].code}]);
 const upcReply=await api(resource+'?field=upc&product_id='+fixture.productId,{actor});assert.equal(upcReply.status,200);const upc=barcodePlan(upcReply.result);
 const lost=command('barcodes.assign',{plan_version:1,field:upc.field,items:upc.items,plan_fingerprint:upc.plan_fingerprint,item_index:0});
 const observed=await simulateLostResult(lost);assert.equal(observed.journal_status,'pending');const beforePosts=nativeHttpTrace.filter(row=>row.method==='POST').length;
 const recoveredLost=await api('totus_tpv_operations?operation_id='+lost.operation_id,{actor});assert.equal(recoveredLost.status,200);assert.equal(recoveredLost.result.status,'verified',JSON.stringify(recoveredLost.result));assert.deepEqual(recoveredLost.result.result,observed.result);
 assert.equal(nativeHttpTrace.filter(row=>row.method==='POST').length,beforePosts,'Recovery after a native commit must remain GET-only');
 const edited=await changeFixturePrice('9.000000');
 try{const historical=await api('totus_tpv_operations?operation_id='+intent.operation_id,{actor});assert.equal(historical.status,200);assert.equal(historical.result.status,'verified');assert.deepEqual(historical.result.result,written.result,'A completed assignment keeps its original proof after legitimate price and other-code edits');}
 finally{await changeFixturePrice(edited.before);}
 console.log('PASS native barcode HTTP: original Webservice auth/ACL, one reviewed target, immutable intent, exact GET recovery, duplicate suppression, actor and changed-intent denial, native product readback; loopback QA only.');
}
