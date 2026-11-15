import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeCartPreflight} from '../src/totustpv/server/cart-preflight.js';
import {createNativeSaleAdapter} from '../src/totustpv/server/native-adapter.js';
const scope={connectionId:'connection-one',connectionRevision:1,storeId:'store-one',shopId:2,currency:'EUR'};
const expected={...scope,cartId:701,customerId:501,invoiceAddressId:601,deliveryAddressId:602,
 currencyId:1,languageId:1,carrierId:5,lines:[{productId:101,attributeId:7,qty:2,stockRecordId:801}]};
function fixture() {
 const values={
  'carts/701':{cart:{id:'701',id_shop:'2',id_customer:'501',id_address_invoice:'601',id_address_delivery:'602',
   id_currency:'1',id_lang:'1',id_carrier:'5',gift:'0',recyclable:'0',associations:{cart_rows:[
    {id_product:'101',id_product_attribute:'7',id_customization:'0',id_address_delivery:'602',quantity:'2'}]}}},
  orders:{orders:[]},'customers/501':{customer:{id:501,active:'1',deleted:'0'}},
  'addresses/601':{address:{id:601,id_customer:501,deleted:'0'}},
  'addresses/602':{address:{id:602,id_customer:501,deleted:'0'}},
  'currencies/1':{currency:{id:1,active:'1',deleted:'0',iso_code:'EUR'}},
  'languages/1':{language:{id:1,active:'1'}},'carriers/5':{carrier:{id:5,active:'1',deleted:'0'}},
  'products/101':{product:{id:101,type:'simple',active:'1',available_for_order:'1',minimal_quantity:'1',
   associations:{combinations:[{id:'7'}]}}},
  'combinations/7':{combination:{id:7,id_product:'101',minimal_quantity:'1'}},
  'stock_availables/801':{stock_available:{id:801,id_product:'101',id_product_attribute:'7',id_shop:'2',
   id_shop_group:'0',depends_on_stock:'0',quantity:'5'}}
 };
 const reads=[];
 const transport={async read(resource,query){
  reads.push({resource,query});assert.ok(Object.hasOwn(values,resource),resource);return structuredClone(values[resource]);
 },createOrderOnce:async()=>{throw new Error('Unexpected POST');}};
 const inspect=createNativeCartPreflight({scope,transport});
 return {values,reads,transport,run:(patch={})=>inspect({scope,expected:{...structuredClone(expected),...patch}}),inspect};
}
test('native structure verified without claiming pricing or reserving stock; read only',async()=>{
 const f=fixture();assert.deepEqual(await f.run(),{cartId:701,structureVerified:true,pricingVerified:false,stockReserved:false});
 assert.equal(f.reads.find(row=>row.resource==='orders').query['filter[id_cart]'],'[701]');
});
test('scope mismatch and duplicate expected product lines fail before native reads',async()=>{
 const f=fixture();await assert.rejects(f.inspect({scope:{...scope,shopId:3},expected}),/SCOPE_MISMATCH/);
 await assert.rejects(f.run({lines:[expected.lines[0],expected.lines[0]]}),/LINES_INVALID/);
 assert.equal(f.reads.length,0);
});
test('changed customer, rows, customization or an existing order blocks dispatch preparation',async()=>{
 for(const mutate of [f=>f.values['carts/701'].cart.id_customer='999',
  f=>f.values['carts/701'].cart.associations.cart_rows[0].quantity='3',
  f=>f.values['carts/701'].cart.associations.cart_rows[0].id_customization='4',
  f=>f.values['carts/701'].cart.associations.cart_rows.push(f.values['carts/701'].cart.associations.cart_rows[0]),
  f=>f.values.orders={orders:[{id:901,id_cart:701,id_shop:2}]}]) {
  const f=fixture();mutate(f);await assert.rejects(f.run(),/CART_(CHANGED|LINES_CHANGED|ALREADY_ORDERED)/);
 }
});
test('inactive identities, foreign addresses, currency and deleted carriers fail closed',async()=>{
 for(const [resource,field,value] of [['customers/501','active','0'],['addresses/602','id_customer','999'],
  ['currencies/1','iso_code','USD'],['carriers/5','deleted','1'],['languages/1','active','0']]) {
  const f=fixture();Object.values(f.values[resource])[0][field]=value;
  await assert.rejects(f.run(),/UNAVAILABLE/);
 }
});
test('wrong variant, stock belonging to another shop, shared stock and insufficient stock are blocked',async()=>{
 for(const [resource,field,value] of [['combinations/7','id_product','102'],['stock_availables/801','id_shop','3'],
  ['stock_availables/801','id_shop_group','1'],['stock_availables/801','depends_on_stock','1'],
  ['stock_availables/801','quantity','1'],['combinations/7','minimal_quantity','3']]) {
  const f=fixture();Object.values(f.values[resource])[0][field]=value;await assert.rejects(f.run(),/TPV_CART_/);
 }
});
test('simple products supported; missing variant, virtual products and packs need their own verified path',async()=>{
 const f=fixture();f.values['carts/701'].cart.associations.cart_rows[0].id_product_attribute='0';
 f.values['stock_availables/801'].stock_available.id_product_attribute='0';
 await assert.rejects(f.run({lines:[{...expected.lines[0],attributeId:0}]}),/COMBINATION_REQUIRED/);
 f.values['products/101'].product.associations.combinations=[];
 assert.equal((await f.run({lines:[{...expected.lines[0],attributeId:0}]})).structureVerified,true);
 for(const type of ['pack','virtual']) {
  f.values['products/101'].product.type=type;
  await assert.rejects(f.run({lines:[{...expected.lines[0],attributeId:0}]}),/PRODUCT_UNSUPPORTED/);
 }
});
test('sale adapter cannot skip structural verification even if pricing claims unchanged',async()=>{
 const f=fixture();let priced=0;
 const adapter=createNativeSaleAdapter({scope,transport:f.transport,
  verifyPrepared:async()=>{priced++;return {unchanged:true,cartId:701};},readInventoryEvidence:async()=>[]});
 await adapter.revalidatePrepared({scope,record:{expected}});assert.equal(priced,1);
 f.values['carts/701'].cart.id_shop='3';
 await assert.rejects(adapter.revalidatePrepared({scope,record:{expected}}),/CART_CHANGED/);
 assert.equal(priced,1);
});
test('empty native collection encoding accepted, unknown shapes and missing proof rejected',async()=>{
 const f=fixture();f.values.orders=[];await f.run();f.values.orders={};
 await assert.rejects(f.run(),/RESPONSE_INVALID/);
 f.values.orders={orders:[]};delete f.values['customers/501'].customer.deleted;
 await assert.rejects(f.run(),/CUSTOMER_UNAVAILABLE/);
});
