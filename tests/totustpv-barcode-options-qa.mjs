import assert from 'node:assert/strict';
import {barcodeOptions,barcodePlan,barcodeKey,internalBarcode,checkDigit,barcodeOptionsHtml} from '../src/totustpv/barcode-options.js';
assert.deepEqual(barcodeOptions(),{field:'ean13',generatorEnabled:false});
for(const v of [null,[],{field:'isbn'},{generatorEnabled:1},{unexpected:true}])assert.throws(()=>barcodeOptions(v));
assert.equal(checkDigit('400638133393'),'1');
for(const field of ['ean13','upc','reference'])for(const pid of [1,2147483647])for(const aid of [0,2147483647])for(const attempt of [0,999,1000,2147483647]){
 const code=internalBarcode(field,pid,aid,attempt);assert.ok(code.length<=64);
 if(field!=='reference')assert.equal(checkDigit(code.slice(0,-1)),code.at(-1));
}
assert.equal(barcodeKey(internalBarcode('ean13',1)),barcodeKey(internalBarcode('upc',1)));
assert.notEqual(internalBarcode('ean13',1),internalBarcode('ean13',1,1));
for(const args of [['ean13',0],['upc',2147483648],['reference',1,-1],['ean13',1,0,2147483648]])assert.throws(()=>internalBarcode(...args));
const item={product_id:1,attribute_id:0,name:'Producto',variant_name:'',reference:'',code:internalBarcode('ean13',1),snapshot_fingerprint:'b'.repeat(64)};
const plan={source:'native-missing-barcodes-plan',plan_version:1,capability:{can_execute:true,reason:'ready'},field:'ean13',scheme:'rcn13-04',shop_id:1,items:[item],has_more:false,skipped_shared:0,plan_fingerprint:'a'.repeat(64)};
assert.deepEqual(barcodePlan(plan),plan);
for(const items of [[item,item],[{...item,product_id:2147483648}],[{...item,code:'4006381333931'}],[{...item,code:item.code.slice(0,-1)+'9'}]])assert.throws(()=>barcodePlan({...plan,items}));
assert.match(barcodeOptionsHtml(undefined,false),/disabled/);assert.match(barcodeOptionsHtml(undefined,true),/empresa/);
console.log('PASS barcode settings, internal RCN check digits, canonical aliases, bounds, reviewed plan projection');
