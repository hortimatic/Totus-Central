import test from 'node:test';
import assert from 'node:assert/strict';
import {createTpvNativeTransport,nativePaidOrderXml} from '../src/totustpv/server/native-transport.js';
const scope={connectionId:'00000000-0000-4000-8000-000000000001',actorId:'00000000-0000-4000-8000-000000000003',connectionRevision:1,storeId:'store-one',shopId:2};
const connection={id:scope.connectionId,revision:1,verified_revision:1,enabled:true,real_data_authorized:true,
 protocol:'prestashop',endpoint:'https://shop.example/api',website_origin:'https://shop.example',secret:'fixture-secret-not-real'};
const expected={storeId:scope.storeId,shopId:2,cartId:701,customerId:501,invoiceAddressId:601,deliveryAddressId:601,
 currencyId:1,languageId:1,carrierId:5,paymentModule:'ps_cashondelivery',paymentLabel:'TotusTPV · efectivo',
 totalCents:801,totalTaxExclCents:662,productsTaxInclCents:801,productsTaxExclCents:662,
 lines:[{productId:101,attributeId:5,qty:1}]};
const priceContext={productId:101,attributeId:5,quantity:3,countryId:6,stateId:373,postcode:'28001',
 currencyId:2,groupId:3,useEcotax:true};
function fixture(options={}) {
 const requests=[];
 const transport=createTpvNativeTransport({...connection,...options.connection},{...scope,...options.scope},{
  resolve:async()=>options.privateAddress?['127.0.0.1']:['93.184.216.34'],
  allowedPaymentModules:['ps_cashondelivery'],
  ...(options.extension?{nativeExtension:{verified:true,installationId:'00000000-0000-4000-8000-000000000002',
   connectionId:scope.connectionId,connectionRevision:1,shopId:2,protocol:1},allowNativeQuote:async()=>options.quoteAllowed===true}:{}),
  ...(options.enabled?{allowOrderCreation:async()=>true}:{}),
  request:async(url,init)=>{
   requests.push({url,init});
   if(options.timeout)throw new DOMException('fixture timeout','AbortError');
   return options.response?.() || new Response(JSON.stringify(init.method==='POST'?{order:{id:'901'}}:{orders:[]}),
    {status:200,headers:{'content-type':'application/json'}});
  }
 });
 return {transport,requests};
}
test('read uses Central credentials privately, native shop context and no ambient cookies',async()=>{
 const f=fixture();await f.transport.read('orders',{'filter[id_cart]':'[701]',display:'[id,id_cart]',limit:'0,2'});
 const {url,init}=f.requests[0],u=new URL(url);
 assert.equal(u.searchParams.get('id_shop'),'2');assert.equal(u.searchParams.get('filter[id_cart]'),'[701]');
 assert.ok(init.headers.Authorization.startsWith('Basic '));assert.equal(url.includes(connection.secret),false);
 assert.equal(init.credentials,'omit');assert.equal(init.redirect,'error');assert.equal(init.cache,'no-store');
});
test('POSTPV resources, other origins, stale revisions, query overrides and local destinations are blocked',async()=>{
 const f=fixture();for(const resource of ['tpv_order_cajas','cajas','orders?ws_key=bad','../orders','orders/0'])
  await assert.rejects(f.transport.read(resource),/FORBIDDEN/);
 await assert.rejects(f.transport.read('orders',{id_shop:'1'}),/QUERY_INVALID/);
 for(const changed of [{scope:{connectionRevision:2}},{connection:{enabled:false}},
  {connection:{endpoint:'https://another.example/api'}},{connection:{real_data_authorized:false}}])
  assert.throws(()=>fixture(changed));
 await assert.rejects(fixture({privateAddress:true}).transport.read('orders'),/públicas/);
 assert.equal(f.requests.length,0);
});
test('checkout remains disabled unless a current server gate explicitly enables it',async()=>{
 const f=fixture();await assert.rejects(f.transport.createOrderOnce(expected),/CHECKOUT_DISABLED/);
 assert.equal(f.requests.length,0);
});
test('only a verified native module may create a paid native order; XML cannot inject fields',async()=>{
 const xml=nativePaidOrderXml({...expected,paymentLabel:'Cash <admin>&"'},['ps_cashondelivery']);
 assert.ok(xml.includes('Cash &lt;admin&gt;&amp;&quot;'));assert.equal(xml.includes('<current_state>'),false);
 assert.equal(xml.includes('<product_id>101</product_id>'),true);
 for(const patch of [{customerId:0},{invoiceAddressId:null},{paymentModule:'tpvtienda'},
  {paymentModule:'unknown_module'},{totalCents:8.01},{paymentLabel:'bad\nlabel'}])
  assert.throws(()=>nativePaidOrderXml({...expected,...patch},['ps_cashondelivery']));
 const f=fixture({enabled:true});assert.deepEqual(await f.transport.createOrderOnce(expected),{orderId:901});
 assert.equal(f.requests.length,1);assert.equal(f.requests[0].init.method,'POST');
 await assert.rejects(f.transport.createOrderOnce({...expected,shopId:1}),/SCOPE_MISMATCH/);
 assert.equal(f.requests.length,1);
});
test('HTTP failure and timeout never trigger an automatic second POST',async()=>{
 for(const options of [{timeout:true},{response:()=>new Response('sensitive upstream detail',{status:500})}]) {
  const f=fixture({enabled:true,...options});await assert.rejects(f.transport.createOrderOnce(expected));
  assert.equal(f.requests.length,1);
 }
});
test('XML order identifiers are accepted, HTML and entity-bearing XML are rejected',async()=>{
 const f=fixture({enabled:true,response:()=>new Response('<prestashop><order><id><![CDATA[901]]></id></order></prestashop>',
  {headers:{'content-type':'application/xml'}})});
 assert.deepEqual(await f.transport.createOrderOnce(expected),{orderId:901});
 for(const [type,body] of [['text/html','<html>login</html>'],['application/xml','<!DOCTYPE x><order><id>901</id></order>']]) {
  const invalid=fixture({enabled:true,response:()=>new Response(body,{headers:{'content-type':type}})});
  await assert.rejects(invalid.transport.createOrderOnce(expected));
 }
});
test('native price preview preserves precision, quantity, address and explicit ecotax; no payment claim',async()=>{
 const f=fixture({response:()=>new Response(JSON.stringify({product:{id:'101',totus_incl:'8.010000',totus_excl:'6.619835'}}),
  {headers:{'content-type':'application/json'}})});
 const preview=await f.transport.readProductPricePreview(priceContext);
 assert.equal(preview.unitTaxExclDecimal,'6.619835');assert.equal(preview.payableCartQuote,false);
 const {url,init}=f.requests[0],query=new URL(url).searchParams;
 assert.equal(init.method,'GET');assert.equal(query.get('id_shop'),'2');
 assert.equal(query.get('price[totus_incl][county]'),'28001');
 assert.equal(query.get('price[totus_incl][quantity]'),'3');
 assert.equal(query.get('price[totus_incl][decimals]'),'6');
 assert.equal(query.get('price[totus_excl][use_tax]'),'0');
 assert.equal(query.get('price[totus_incl][use_ecotax]'),'1');
});
test('generic queries cannot inject price context; unsupported customer/cart context is rejected',async()=>{
 const f=fixture();await assert.rejects(f.transport.read('products/101',{'price[other][use_tax]':'1'}),/QUERY_INVALID/);
 for(const patch of [{customerId:501},{cartId:701},{quantity:0},{postcode:'x&ws_key=bad'},{useEcotax:1},{groupId:null}])
  await assert.rejects(f.transport.readProductPricePreview({...priceContext,...patch}),/CONTEXT_INVALID/);
 assert.equal(f.requests.length,0);
});
test('missing native aliases and float prices are rejected instead of silently using catalogue prices',async()=>{
 for(const product of [{id:101,price:'8.01'},{id:102,totus_incl:'8.01',totus_excl:'6.62'},
  {id:101,totus_incl:8.01,totus_excl:'6.62'},{id:101,totus_incl:'NaN',totus_excl:'6.62'}]) {
  const f=fixture({response:()=>new Response(JSON.stringify({product}),{headers:{'content-type':'application/json'}})});
  await assert.rejects(f.transport.readProductPricePreview(priceContext),/PRICE_RESPONSE_INVALID/);
 }
});
test('owned-cart native quote has a separate explicit server gate, exact resource and private credentials',async()=>{
 const command={operationId:'00000000-0000-4000-8000-000000000004',cartId:701};
 for(const options of [{},{extension:true}]){
  const f=fixture(options);await assert.rejects(f.transport.quoteOwnedCart(command),/QUOTE_DISABLED/);assert.equal(f.requests.length,0);
 }
 const f=fixture({extension:true,quoteAllowed:true,response:()=>new Response(JSON.stringify({verified:true,native_reference:701,quote:{cart_id:701,shop_id:2}}),{headers:{'content-type':'application/json'}})});
 await f.transport.quoteOwnedCart(command);const {url,init}=f.requests[0];assert.equal(new URL(url).pathname,'/api/totus_tpv_quotes');
 assert.equal(init.headers['Content-Type'],'application/json');assert.equal(JSON.parse(init.body).actor_id,scope.actorId);
 assert.equal(JSON.parse(init.body).command,'cart.quote');assert.equal(init.body.includes(connection.secret),false);
 await assert.rejects(f.transport.read('totus_tpv_quotes'),/RESOURCE_FORBIDDEN/);
});
