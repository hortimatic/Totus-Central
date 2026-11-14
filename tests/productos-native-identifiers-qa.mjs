import test from 'node:test';
import assert from 'node:assert/strict';
import {validateProductCreateRequest,validateProductWriteRequest,prepareProductCreationXml,minimalBlankProductSchema} from '../src/productos-write-contract.js';
const id='11111111-1111-4111-8111-111111111111';
const base={action:'prestashop_product_create_prepare',id,call_id:id,revision:1,store:'newoldsmok',reference:'PAPEL-MONKEY-RS-CELULOSA-ROSA',price:'1.25',category_id:'43',translations:[{language_id:'1',name:'Monkey Transparent Pink Cellulose KS',link_rewrite:'monkey-transparent-pink-cellulose-ks'}]};
test('copy preserves the real 12-digit native EAN without padding or moving it to UPC',()=>{
 const checked=validateProductCreateRequest({...base,fields:[{field:'ean13',value:'762497004366'}]});
 const xml=prepareProductCreationXml(minimalBlankProductSchema(['1']),checked);
 assert.match(xml,/<ean13><!\[CDATA\[762497004366\]\]><\/ean13>/);
 assert.doesNotMatch(xml,/0762497004366/);
});
test('product and combination edit accept native numeric ranges and preserve leading zeros',()=>{
 for(const resource of ['products','combinations'])for(const [field,max] of [['ean13',13],['upc',12]]){
  for(const value of ['', '0','00000001','762497004366','1'.repeat(max)]){
   const request={action:'prestashop_product_prepare',id,call_id:id,revision:1,store:'newoldsmok',resource,record_id:'42',...(resource==='combinations'?{expected_product_id:'41'}:{}),changes:[{field,value}]};
   assert.equal(validateProductWriteRequest(request).changes[0].value,value);
  }
  for(const value of ['1'.repeat(max+1),'123ABC','12-34','12 34','12.34'])assert.throws(()=>validateProductWriteRequest({action:'prestashop_product_prepare',id,call_id:id,revision:1,store:'newoldsmok',resource,record_id:'42',...(resource==='combinations'?{expected_product_id:'41'}:{}),changes:[{field,value}]}),/EAN|UPC/);
 }
});
