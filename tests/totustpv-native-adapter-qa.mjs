import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeSaleAdapter,nativeCents} from '../src/totustpv/server/native-adapter.js';
import {verifyRemoteSale} from '../src/totustpv/model.js';
const scope={connectionId:'connection-one',connectionRevision:1,storeId:'store-one',shopId:2,currency:'EUR'};
const expected={...scope,cartId:701,customerId:501,invoiceAddressId:601,deliveryAddressId:601,currencyId:1,
 paymentModule:'native_cash',totalCents:801,shippingCents:0,paidStateIds:[11],lines:[{productId:101,attributeId:5,
 qty:1,unitTaxInclCents:801,unitTaxExclCents:662,stockBefore:5}]};
function fixture(patch={}) {
 let posts=0;
 const data={orders:{orders:[{id:'901',id_cart:'701',id_shop:'2'}]},
  'orders/901':{order:{id:'901',id_shop:'2',id_cart:'701',id_customer:'501',id_address_invoice:'601',
   id_address_delivery:'601',id_currency:'1',current_state:'11',reference:'ABC123',module:'native_cash',
   total_paid_tax_incl:'8.010000',total_shipping_tax_incl:'0.000000',total_discounts_tax_incl:'0.000000',total_paid_real:'8.010000'}},
  'order_states/11':{order_state:{id:'11',paid:'1'}},'currencies/1':{currency:{id:'1',iso_code:'EUR'}},
  order_details:{order_details:[{id_order:'901',product_id:'101',product_attribute_id:'5',product_quantity:'1',unit_price_tax_incl:'8.010000',unit_price_tax_excl:'6.620000'}]},
  order_payments:{order_payments:[{id:'701',order_reference:'ABC123',id_currency:'1',amount:'8.010000'}]},...patch};
 const adapter=createNativeSaleAdapter({scope,transport:{read:async resource=>structuredClone(data[resource]),
  createOrderOnce:async()=>{posts++;return {orderId:901};}},verifyPrepared:async()=>({unchanged:true,cartId:701}),
  readInventoryEvidence:async()=>[{mode:'isolated-fixture',productId:101,attributeId:5,before:5,after:4,ambiguous:false}]});
 return {adapter,count:()=>posts};
}
test('native decimal amounts are exact and unsupported precision is rejected before use',()=>{
 assert.equal(nativeCents('8.010000'),801);assert.equal(nativeCents('0'),0);assert.equal(nativeCents('0.1'),10);
 for(const value of ['0.333333','8,01','-1','NaN','1e3',null,'1000000001'])assert.throws(()=>nativeCents(value));
});
test('native order, detail, currency, state and payment readback confirms the expected sale',async()=>{
 const f=fixture();assert.equal((await f.adapter.ordersForCart({scope,cartId:701}))[0].orderId,901);
 const observed=await f.adapter.readSale({scope,orderId:901,expected});
 assert.equal(verifyRemoteSale(expected,observed).status,'confirmed');assert.equal(f.count(),0);
});
test('empty native order responses are valid absence, but ignored filters and splits remain ambiguous',async()=>{
 assert.deepEqual(await fixture({orders:[]}).adapter.ordersForCart({scope,cartId:701}),[]);
 for(const orders of [{},{orders:[{id:901,id_cart:702,id_shop:2}]},{orders:[{id:901,id_cart:701,id_shop:1}]},
  {orders:[{id:901,id_cart:701,id_shop:2},{id:902,id_cart:701,id_shop:2}]}])
  await assert.rejects(fixture({orders}).adapter.ordersForCart({scope,cartId:701}));
});
test('wrong detail/payment filters, absent state and another connection cannot be confirmed',async()=>{
 for(const patch of [{order_details:{order_details:[{id_order:902}]}},
  {order_payments:{order_payments:[{id:701,order_reference:'OTHER',id_currency:1,amount:'8.01'}]}},
  {'orders/901':{order:{id:901,id_shop:2,id_cart:701,current_state:0}}}])
  await assert.rejects(fixture(patch).adapter.readSale({scope,orderId:901,expected}));
 await assert.rejects(fixture().adapter.readSale({scope:{...scope,connectionId:'another'},orderId:901,expected}),/SCOPE_MISMATCH/);
});
test('read and revalidation paths never create orders',async()=>{
 const f=fixture();await f.adapter.revalidatePrepared({scope,record:{expected}});
 await f.adapter.readSale({scope,orderId:901,expected});assert.equal(f.count(),0);
});
