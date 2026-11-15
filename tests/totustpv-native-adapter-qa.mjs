import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeSaleAdapter,nativeCents,nativeMicros} from '../src/totustpv/server/native-adapter.js';
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
test('native tax-excluded unit prices retain six decimals instead of rounding tax to cents',async()=>{
 assert.equal(nativeMicros('6.619835'),6619835);assert.equal(nativeMicros('8.01'),8010000);
 for(const amount of ['6.6198357','-1','1e3','NaN','1000000001'])assert.throws(()=>nativeMicros(amount));
 const precise=structuredClone(expected);delete precise.lines[0].unitTaxExclCents;precise.lines[0].unitTaxExclMicros=6619835;
 const f=fixture({order_details:{order_details:[{id_order:'901',product_id:'101',product_attribute_id:'5',product_quantity:'1',
  unit_price_tax_incl:'8.010000',unit_price_tax_excl:'6.619835'}]}});
 const observed=await f.adapter.readSale({scope,orderId:901,expected:precise});
 assert.equal(observed.lines[0].unitTaxExclMicros,6619835);
 assert.equal(verifyRemoteSale(precise,observed).status,'confirmed');
 observed.lines[0].unitTaxExclMicros=6620000;
 assert.equal(verifyRemoteSale(precise,observed).status,'uncertain');
});
test('captured native unit/line precision is preserved; rounded units cannot replace native line totals',async()=>{
 // Values read, without mutation, from preproduction QA order 46542/detail 101126.
 // Other dependencies remain fixtures: this is not a new native sale test.
 const precise=structuredClone(expected);
 precise.lines=[{productId:101,attributeId:5,qty:1,unitTaxInclMicros:8012100,unitTaxExclMicros:6621570,
  lineTaxInclCents:801,lineTaxExclCents:662,stockBefore:5}];
 const f=fixture({order_details:{order_details:[{id_order:'901',product_id:'101',product_attribute_id:'5',product_quantity:'1',
  unit_price_tax_incl:'8.012100',unit_price_tax_excl:'6.621570',total_price_tax_incl:'8.010000',total_price_tax_excl:'6.620000'}]}});
 const observed=await f.adapter.readSale({scope,orderId:901,expected:precise});
 assert.equal(observed.lines[0].unitTaxInclMicros,8012100);
 assert.equal(observed.lines[0].lineTaxInclCents,801);
 assert.equal(verifyRemoteSale(precise,observed).status,'confirmed');
 observed.lines[0].unitTaxInclMicros=8010000;
 assert.equal(verifyRemoteSale(precise,observed).status,'uncertain');
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
 const f=fixture();await assert.rejects(f.adapter.revalidatePrepared({scope,record:{expected}}),/CART_IDENTITIES_INVALID/);
 await f.adapter.readSale({scope,orderId:901,expected});assert.equal(f.count(),0);
});
test('classic native adapter refuses split/incorrect payment mappings rather than silently labelling them cash',async()=>{
 const f=fixture(),e={...expected,nativePaymentMethod:'card',paymentLabel:'Tarjeta',nativePaymentLabels:{card:'Tarjeta'}};
 const card={id:'card-one',method:'card',amountCents:801,status:'settled'};
 assert.equal(f.adapter.validatePayments({scope,expected:e,payments:[card]}),true);
 assert.throws(()=>f.adapter.validatePayments({scope,expected:e,payments:[{...card,method:'cash',receivedCents:801}]}),/MAPPING_REQUIRED/);
 assert.throws(()=>f.adapter.validatePayments({scope,expected:e,payments:[{...card,amountCents:400},{...card,id:'second',amountCents:401}]}),/SPLIT_PAYMENT_UNSUPPORTED/);
 assert.equal(f.count(),0);
});
