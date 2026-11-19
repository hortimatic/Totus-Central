import test from 'node:test';
import assert from 'node:assert/strict';
import {createTpvNativeTransport,nativePaidOrderXml} from '../src/totustpv/server/native-transport.js';
const scope={connectionId:'00000000-0000-4000-8000-000000000001',actorId:'00000000-0000-4000-8000-000000000003',connectionRevision:1,storeId:'store-one',shopId:2,environment:'qa'};
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
  qaPolicy:options.noQaPolicy?null:{stage:'preproduction',nativeVersion:'8.2.8',connectionId:scope.connectionId,
   origin:'https://shop.example',protectedOrigins:['https://production.example'],
   protectedConnectionIds:['00000000-0000-4000-8000-000000000099']},
  resolve:async()=>options.privateAddress?['127.0.0.1']:['93.184.216.34'],
  allowedPaymentModules:['ps_cashondelivery'],allowNativeCommand:async()=>options.commandsAllowed===true,
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
test('barcode plans use only the owned read resource and bounded native target parameters',async()=>{
 const f=fixture({extension:true});await f.transport.readNativeBarcodePlan({field:'upc',productId:12,attributeId:3});
 const url=new URL(f.requests[0].url);assert.equal(url.pathname,'/api/totus_tpv_barcodes');assert.equal(f.requests[0].init.method,'GET');assert.equal(url.searchParams.get('actor_id'),scope.actorId);assert.equal(url.searchParams.get('field'),'upc');assert.equal(url.searchParams.get('product_id'),'12');assert.equal(url.searchParams.get('attribute_id'),'3');
 for(const query of [{field:'isbn'},{productId:'12'},{productId:0},{productId:2147483648},{productId:12,attributeId:-1},{attributeId:3}])await assert.rejects(f.transport.readNativeBarcodePlan(query),/TPV_BARCODE_QUERY_INVALID/);
 await assert.rejects(f.transport.read('products',{field:'upc'}),/TPV_NATIVE_QUERY_INVALID/);assert.equal(f.requests.length,1);
});

test('barcode writes retain the native command authorization gate',async()=>{
 const operationId=scope.connectionId,f=fixture({extension:true});
 await assert.rejects(f.transport.nativeCommand({operationId,command:'barcodes.assign',payload:{}}),/TPV_NATIVE_COMMAND_DISABLED/);assert.equal(f.requests.length,0);
 const allowed=fixture({extension:true,commandsAllowed:true});await allowed.transport.nativeCommand({operationId,command:'barcodes.assign',payload:{plan_version:1,field:'ean13',items:[],plan_fingerprint:'0'.repeat(64),item_index:0}});
 assert.equal(new URL(allowed.requests[0].url).pathname,'/api/totus_tpv_barcodes');assert.equal(allowed.requests[0].init.method,'POST');assert.equal(JSON.parse(allowed.requests[0].init.body).command,'barcodes.assign');
});

test('barcode target paging retains its boundary and selected planning cannot broaden into an arbitrary native query',async()=>{
 const f=fixture({extension:true});await f.transport.readNativeBarcodeTargets({field:'reference',cursor:[12,3],bounds:{product:99,attribute:50}});
 const page=new URL(f.requests[0].url);assert.equal(page.searchParams.get('mode'),'targets');assert.equal(page.searchParams.get('max_product'),'99');assert.equal(page.searchParams.get('after_product'),'12');
 await f.transport.readNativeBarcodePlan({field:'ean13',targets:[{productId:12,attributeId:3},{productId:13,attributeId:0}],skipExisting:true});const plan=new URL(f.requests[1].url);assert.equal(plan.searchParams.get('targets'),'12:3,13:0');assert.equal(plan.searchParams.get('skip_existing'),'1');
 for(const value of [{cursor:[-1,0]},{cursor:[1]},{bounds:{product:1}},{bounds:{product:1,attribute:0,sql:'x'}}])await assert.rejects(f.transport.readNativeBarcodeTargets(value),/BARCODE_QUERY_INVALID/);
 for(const value of [{skipExisting:true},{targets:[]},{targets:[{productId:1,attributeId:0},{productId:1,attributeId:0}]},{targets:[{productId:1,attributeId:0}],productId:2}])await assert.rejects(f.transport.readNativeBarcodePlan(value),/BARCODE_QUERY_INVALID/);assert.equal(f.requests.length,2);
});

test('billing metadata is a scoped authenticated GET and rejects invalid sale identity',async()=>{
 const f=fixture({extension:true});
 await f.transport.readNativeBilling({operationId:scope.connectionId,sourceActorId:scope.actorId});
 assert.equal(f.requests.length,1);assert.equal(f.requests[0].init.method,'GET');
 const url=new URL(f.requests[0].url);assert.equal(url.searchParams.get('kind'),'billing');
 assert.equal(url.searchParams.get('actor_id'),scope.actorId);assert.equal(url.searchParams.get('id_shop'),'2');
 await assert.rejects(()=>f.transport.readNativeBilling({operationId:'invalid',sourceActorId:scope.actorId}),/TPV_DOCUMENT_QUERY_INVALID/);
 assert.equal(f.requests.length,1);
});

test('read uses Central credentials privately, native shop context and no ambient cookies',async()=>{
 const f=fixture();await f.transport.read('orders',{'filter[id_cart]':'[701]',display:'[id,id_cart]',limit:'0,2'});
 const {url,init}=f.requests[0],u=new URL(url);
 assert.equal(u.searchParams.get('id_shop'),'2');assert.equal(u.searchParams.get('filter[id_cart]'),'[701]');
 assert.ok(init.headers.Authorization.startsWith('Basic '));assert.equal(url.includes(connection.secret),false);
 assert.equal(init.credentials,'omit');assert.equal(init.redirect,'error');assert.equal(init.cache,'no-store');
});

test('clipboard whitespace uses the same canonical key as native authentication without mutating its source',async()=>{
 const secret=' \t'+connection.secret+'\r\n',source={...connection,secret};
 const f=fixture({connection:source});await f.transport.read('orders');
 assert.equal(f.requests[0].init.headers.Authorization,'Basic '+btoa(connection.secret+':'));
 assert.equal(source.secret,secret);
 const interior=fixture({connection:{secret:'fixture internal whitespace'}});await interior.transport.read('orders');
 assert.equal(interior.requests[0].init.headers.Authorization,'Basic '+btoa('fixture internal whitespace:'));
});

test('remote error diagnostics retain fixed connector codes and discard arbitrary native text',async()=>{
 for(const [message,expected]of [['TOTUS_NATIVE_AUTH_REQUIRED','TPV_NATIVE_REMOTE_NATIVE_AUTH_REQUIRED'],
  ['private customer data and SQL','TPV_NATIVE_HTTP_400']]){
  const f=fixture({response:()=>new Response(JSON.stringify({errors:[{message}]}),{status:400,headers:{'content-type':'application/json'}})});
  await assert.rejects(f.transport.read('orders'),error=>error.message===expected);
  assert.equal(f.requests.length,1);
 }
});

test('native commands retain operation identity and recover by GET without resubmitting',async()=>{
 const operationId='00000000-0000-4000-8000-000000000004';
 const denied=fixture({extension:true});
 await assert.rejects(denied.transport.nativeCommand({operationId,command:'sale.commit',payload:{cart_id:701}}),/COMMAND_DISABLED/);
 assert.equal(denied.requests.length,0);
 const f=fixture({extension:true,commandsAllowed:true,timeout:true});
 await assert.rejects(f.transport.nativeCommand({operationId,command:'sale.commit',payload:{cart_id:701}}),/timeout/);
 assert.equal(f.requests.length,1);
 const sent=JSON.parse(f.requests[0].init.body);
 assert.equal(sent.operation_id,operationId);assert.equal(sent.actor_id,scope.actorId);
 assert.equal(sent.shop_id,scope.shopId);assert.equal(sent.command,'sale.commit');
 assert.equal(f.requests[0].init.headers['Content-Type'],'application/json');
 await assert.rejects(f.transport.readNativeOperation(operationId),/timeout/);
 assert.equal(f.requests.length,2);assert.equal(f.requests[1].init.method,'GET');
 assert.equal(new URL(f.requests[1].url).searchParams.get('actor_id'),scope.actorId);
 await assert.rejects(f.transport.nativeCommand({operationId,command:'stock.arbitrary',payload:{}}),/COMMAND_INVALID/);
 assert.equal(f.requests.length,2);
 await assert.rejects(fixture({extension:true,noQaPolicy:true}).transport.readNativeProfile(),/QA_POLICY_REQUIRED/);
 await assert.rejects(fixture().transport.readNativeProfile(),/EXTENSION_UNVERIFIED/);
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

test('catalogue criteria remain explicit and cannot add arbitrary query fields or resources',async()=>{
 const f=fixture({extension:true});await f.transport.readNativeCatalogue({search:'9780306406157',searchFields:['isbn','reference']});
 const url=new URL(f.requests[0].url);assert.equal(url.searchParams.get('search_fields'),'reference,isbn');assert.equal(url.searchParams.get('id_shop'),'2');
 assert.equal(f.requests[0].init.method,'GET');
 for(const searchFields of [[],['isbn','isbn'],['name) OR 1=1'],['id_shop'],null,'isbn'])await assert.rejects(f.transport.readNativeCatalogue({searchFields}),/CATALOGUE_QUERY_INVALID/);
 await assert.rejects(f.transport.read('products',{search_fields:'isbn'}),/QUERY_INVALID/);assert.equal(f.requests.length,1);
});
test('catalogue visibility allows bounded category IDs only, without changing generic query limits',async()=>{
 const f=fixture({extension:true}),ids=Array.from({length:100},(_,n)=>2147483500+n);
 await f.transport.readNativeCatalogue({catalogueFilters:{hideUnavailable:true,excludedCategories:ids}});
 const url=new URL(f.requests[0].url);assert.equal(url.searchParams.get('hide_unavailable'),'1');assert.equal(url.searchParams.get('excluded_categories'),ids.join(','));
 assert.equal(url.searchParams.get('excluded_categories').length,1099);
 for(const catalogueFilters of [{hideUnavailable:1},{excludedCategories:[0]},{excludedCategories:['2']},{excludedCategories:[2,2]},{allowOutOfStock:true},{extraDetails:true},{excludedCategories:[2147483648]}])await assert.rejects(f.transport.readNativeCatalogue({catalogueFilters}),/CATALOGUE_QUERY_INVALID/);
 await assert.rejects(f.transport.read('products',{excluded_categories:'2'}),/QUERY_INVALID/);assert.equal(f.requests.length,1);
});
test('variant-group ordering is scoped to catalogue combinations and never forwarded to generic resources',async()=>{
 const f=fixture({extension:true});await f.transport.readNativeCatalogue({productId:12,variantGroupId:3});
 const url=new URL(f.requests[0].url);assert.equal(url.searchParams.get('sort_group_id'),'3');assert.equal(url.searchParams.get('product_id'),'12');
 for(const variantGroupId of [-1,'3',1.5,null,2147483648])await assert.rejects(f.transport.readNativeCatalogue({productId:12,variantGroupId}),/CATALOGUE_QUERY_INVALID/);
 await assert.rejects(f.transport.readNativeCatalogue({variantGroupId:3}),/CATALOGUE_QUERY_INVALID/);
 await assert.rejects(f.transport.read('products',{sort_group_id:'3'}),/QUERY_INVALID/);assert.equal(f.requests.length,1);
});
test('native stock-policy preflight uses the existing read-only catalogue boundary and an exact product identity',async()=>{
 const f=fixture({extension:true});await f.transport.readNativeStockPolicy(12);const url=new URL(f.requests[0].url);
 assert.equal(url.pathname,'/api/totus_tpv_catalogue');assert.equal(url.searchParams.get('stock_policy_only'),'1');assert.equal(url.searchParams.get('product_id'),'12');assert.equal(url.searchParams.get('id_shop'),'2');assert.equal(f.requests[0].init.method,'GET');
 for(const value of [0,-1,1.5,'12',2147483648])await assert.rejects(f.transport.readNativeStockPolicy(value),/CATALOGUE_QUERY_INVALID/);
 await assert.rejects(f.transport.read('products',{stock_policy_only:'1'}),/QUERY_INVALID/);assert.equal(f.requests.length,1);
});
test('unit price capability preflight is a scoped read and cannot extend generic product queries',async()=>{
 const f=fixture({extension:true});await f.transport.readNativeProductCapabilities(12);const url=new URL(f.requests[0].url);
 assert.equal(url.pathname,'/api/totus_tpv_catalogue');assert.equal(url.searchParams.get('product_capabilities_only'),'1');assert.equal(url.searchParams.get('product_id'),'12');assert.equal(f.requests[0].init.method,'GET');
 for(const id of [0,-1,'12',1.5,2147483648])await assert.rejects(f.transport.readNativeProductCapabilities(id),/CATALOGUE_QUERY_INVALID/);
 await assert.rejects(f.transport.read('products',{product_capabilities_only:'1'}),/QUERY_INVALID/);assert.equal(f.requests.length,1);
});
