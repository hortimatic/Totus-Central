import test from 'node:test';import assert from 'node:assert/strict';
import {barcodeTargetPage,barcodePlan,internalBarcode} from '../src/totustpv/barcode-options.js';
const target=(product_id,attribute_id=0)=>({product_id,attribute_id,name:'Artículo '+product_id,variant_name:attribute_id?'Rojo':'',reference:'REF-'+product_id});
const base={source:'native-missing-barcode-targets',plan_version:1,field:'ean13',shop_id:1,items:[target(1),target(2,3)],has_more:true,cursor:[2,3],bounds:{product:5,attribute:4}};
test('target capture projects only bounded catalogue metadata and follows composite native IDs',()=>{
 const read=barcodeTargetPage({...base,private:'omit',items:base.items.map(row=>({...row,cost:123,password:'omit'}))},{field:'ean13',shopId:1});assert.deepEqual(read,base);assert.notEqual(read.cursor,base.cursor);
 const next={...base,items:[target(3)],cursor:[3,0],has_more:false};assert.deepEqual(barcodeTargetPage(next,{field:'ean13',shopId:1,cursor:[2,3],bounds:base.bounds}),next);
 const empty={...base,items:[],cursor:[2,3],has_more:false};assert.deepEqual(barcodeTargetPage(empty,{cursor:[2,3],bounds:base.bounds}),empty);
 const changed={...base,items:[],cursor:[3,0]};assert.deepEqual(barcodeTargetPage(changed,{cursor:[2,3],bounds:base.bounds}),changed,'A concurrently filled page may still advance the read cursor');
});
test('capture refuses changed shop, field or boundary, repeats, disordered IDs and nonadvancing cursors',()=>{
 for(const [value,expected] of [[base,{shopId:2}],[base,{field:'upc'}],[base,{bounds:{product:6,attribute:4}}],[{...base,items:[target(1),target(1)]},{}],[{...base,items:[target(2,3),target(1)]},{}],[{...base,cursor:[0,0]},{}],[{...base,items:[target(6)]},{}],[{...base,items:Array(51).fill(target(1))},{}],[{...base,items:[{...target(1),product_id:'1'}]},{}],[{...base,source:'browser'},{}]])assert.throws(()=>barcodeTargetPage(value,expected));
 assert.throws(()=>barcodeTargetPage(base,{cursor:[1,0]}),'A previously captured identity cannot be appended again');
});
test('planning captured targets can preserve codes already present and unavailable targets without a write',()=>{
 const item={...target(1),code:internalBarcode('ean13',1),snapshot_fingerprint:'a'.repeat(64)};
 const plan={source:'native-missing-barcodes-plan',plan_version:1,capability:{can_execute:true,reason:'ready'},field:'ean13',scheme:'rcn13-04',shop_id:1,items:[item],has_more:false,skipped_shared:0,plan_fingerprint:'b'.repeat(64)};
 const skipped=[{product_id:2,attribute_id:0,reason:'already-set',code:'4006381333931'},{product_id:3,attribute_id:0,reason:'unavailable',code:null}];assert.deepEqual(barcodePlan({...plan,skipped_targets:skipped}).skipped_targets,skipped);
 for(const skipped_targets of [[{...skipped[0],product_id:1}],[{...skipped[0],code:''}],[{...skipped[1],code:'not-null'}],[{...skipped[0],reason:'ignore'}],Array(51).fill(skipped[0])])assert.throws(()=>barcodePlan({...plan,skipped_targets}));
});
