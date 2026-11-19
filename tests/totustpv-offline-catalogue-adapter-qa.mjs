import test from 'node:test';
import assert from 'node:assert/strict';
import {createCentralTpvAdapter} from '../src/totustpv/central-adapter.js';
import {createTpvHttpClient} from '../src/totustpv/http-client.js';
import {cataloguePricingContext} from '../src/totustpv/catalogue-pricing-context.js';
test('pricing context requires explicit native identity, precision and quantity',()=>{
 const context={customerId:1,addressId:2,shopId:3,currency:'EUR',roundMode:2,roundType:1,computingPrecision:6,quantity:1};
 assert.deepEqual(cataloguePricingContext(context),context);assert.equal(cataloguePricingContext(undefined),null);
 for(const patch of [{computingPrecision:undefined},{computingPrecision:7},{quantity:0},{shopId:0},{currency:'USD'},{roundMode:9},{permission:true}])assert.throws(()=>cataloguePricingContext({...context,...patch}));
});
test('catalogue fallback is transport-only, retains pagination and never handles inventory writes',async()=>{
 const station={environment:'qa',connectionId:'connection',shopId:1,storeId:'store',drawerId:'drawer',canSell:true,canOpen:true,canReconcile:true};let failure=null,saved,reads=0,writes=0;
 const cache={put:async(query,data)=>{writes++;saved={data,savedAt:123};},get:async()=>{reads++;return structuredClone(saved);}};
 const adapter=createCentralTpvAdapter({actorId:'operator',storage:{getItem:()=>null,setItem:()=>{}},catalogueCache:()=>cache,invoke:async input=>{
  if(input.action==='context')return {actorId:'operator',workstations:[station]};
  if(input.action==='catalogue'){if(failure)throw failure;return {items:[],currency:'EUR',payable_cart_quote:false,has_more:true,page:0};}
  throw Error('Unexpected action');
 }});
 await adapter.context();await adapter.selectWorkstation({storeId:'store',drawerId:'drawer'});
 await adapter.searchProducts();assert.equal(writes,1);
 failure=Object.assign(Error('Disconnected'),{code:'TPV_CONNECTION_UNAVAILABLE'});
 const result=await adapter.searchProducts();assert.equal(result.offlineCached,true);assert.equal(result.cachedAt,123);assert.equal(result.hasMore,true);assert.equal(reads,1);
 failure=Object.assign(Error('Forbidden'),{code:'TPV_PERMISSION_DENIED'});await assert.rejects(adapter.searchProducts(),/Forbidden/);assert.equal(reads,1);
 failure=Object.assign(Error('Disconnected'),{code:'TPV_CONNECTION_UNAVAILABLE'});await assert.rejects(adapter.searchProducts({inventoryOnly:true}),/Disconnected/);assert.equal(reads,1);
});
test('HTTP transport classification preserves actor guard and authorization failures',async()=>{
 let actor='owner',mode='network';
 const call=createTpvHttpClient({owner:'owner',currentActor:()=>actor,url:'https://central.test',key:'fixture',auth:{getSession:async()=>({data:{session:{user:{id:'owner'},access_token:'synthetic'}}})},request:async()=>{
  if(mode==='network')throw new TypeError('Failed to fetch');
  if(mode==='actor'){actor='other';throw new TypeError('Failed to fetch');}
  return new Response(JSON.stringify({error:'TPV_PERMISSION_DENIED'}),{status:403});
 }});
 await assert.rejects(call({action:'catalogue'}),{code:'TPV_CONNECTION_UNAVAILABLE'});
 mode='forbidden';await assert.rejects(call({action:'catalogue'}),{code:'TPV_PERMISSION_DENIED'});
 mode='actor';await assert.rejects(call({action:'catalogue'}),/sesión ha cambiado/);
});

test('shared Central source reuses the chosen connection revision without catalogue requests',async()=>{
 let source={connectionId:'connection',revision:3,store:'hortimatic',readAt:Date.now(),productsComplete:true,products:[{id:'42',__store:'hortimatic',name:'Existing product'}]},sourceCalls=[];const requests=[];
 const stations=[{environment:'qa',connectionId:'connection',connectionRevision:3,shopId:1,storeId:'store',drawerId:'drawer',canSell:true,canOpen:true,canReconcile:true},{environment:'qa',connectionId:'second',connectionRevision:1,shopId:1,storeId:'other',drawerId:'other-drawer',canSell:true,canOpen:true,canReconcile:true}];
 let pending=null;
 const adapter=createCentralTpvAdapter({actorId:'operator',storage:{getItem:()=>null,setItem:()=>{}},centralCatalogueSource:async query=>{sourceCalls.push(query);if(pending)await pending;return source;},invoke:async input=>{requests.push(input.action);assert.equal(input.action,'context');return {actorId:'operator',workstations:stations};}});
 await adapter.context();await adapter.selectWorkstation({storeId:'store',drawerId:'drawer'});
 const snapshot=await adapter.catalogueSource();snapshot.products[0].name='Mutated outside';assert.equal(source.products[0].name,'Existing product');assert.deepEqual(requests,['context']);assert.deepEqual(sourceCalls[0],{connectionId:'connection',revision:3});
 source={...source,revision:2};await assert.rejects(adapter.catalogueSource(),/no corresponde/);source.revision=3;
 source.products.push({...source.products[0]});await assert.rejects(adapter.catalogueSource(),/repetidos/);source.products.pop();
 let release;pending=new Promise(resolve=>{release=resolve;});const delayed=adapter.catalogueSource();await adapter.selectWorkstation({storeId:'other',drawerId:'other-drawer'});release();await assert.rejects(delayed,/puesto ha cambiado/);
});

test('offline shared search filters category descendants, keeps missing price unknown and paginates deterministically',async()=>{
 const {offlineCatalogueSearch}=await import('../src/totustpv/offline-catalogue-search.js');
 const source={productsComplete:true,readAt:100,metadata:{categories:[{id:'2',id_parent:'1'},{id:'3',id_parent:'2'},{id:'4',id_parent:'3'}],warnings:[]},products:Array.from({length:23},(_,i)=>({id:String(i+1),name:'Artículo '+(i+1),active:'1',id_category_default:i===0?'4':'2',reference:'REF-'+(i+1)}))};
 const native={id:'1:0',nativeProductId:1,name:'Artículo 1',reference:'REF-1',priceCents:801,stock:3,chooseVariant:false};
 const pages=[{savedAt:100,data:{items:[native]}},{savedAt:101,data:{items:[{...native,priceCents:802}]}}];
 const result=offlineCatalogueSearch(source,pages,{sortField:'name',page:0});assert.equal(result.length,20);assert.equal(result.hasMore,true);assert.equal(result.totalCount,23);assert.equal(result[0].priceCents,802);assert.equal(result[1].priceCents,null);assert.equal(result[1].offlineUnavailable,true);
 assert.equal(offlineCatalogueSearch(source,[...pages,{savedAt:102,data:{pricingContext:{quantity:3},items:[{...native,priceCents:500}]}}],{})[0].priceCents,802,'quantity-specific preview must not replace the one-unit catalogue');
 assert.equal(offlineCatalogueSearch(source,pages,{page:1}).length,3);
 assert.equal(offlineCatalogueSearch(source,pages,{categoryId:3}).length,1);
 assert.equal(offlineCatalogueSearch(source,pages,{catalogueFilters:{excludedCategories:[3]}}).totalCount,22);
 assert.equal(offlineCatalogueSearch(source,pages,{search:'REF-1',searchFields:['reference']}).totalCount,11);
 assert.equal(offlineCatalogueSearch(source,pages,{catalogueFilters:{hideUnavailable:true}}).totalCount,1);
 assert.throws(()=>offlineCatalogueSearch({...source,metadata:null},pages,{categoryId:3}),/Faltan categorías/);
});

test('cached variants remain reachable without a cached parent and never invent parent totals',async()=>{
 const {offlineCatalogueSearch}=await import('../src/totustpv/offline-catalogue-search.js');
 const source={productsComplete:true,readAt:100,products:[{id:'42',name:'Camiseta',associations:{combinations:[{id:'7'},{id:'8'}]}}]};
 const variant={id:'42:7',nativeProductId:42,name:'Camiseta roja',chooseVariant:false,stock:2,priceCents:1000};
 const pages=[{savedAt:100,data:{items:[variant]}}];
 const parent=offlineCatalogueSearch(source,pages,{})[0];
 assert.equal(parent.chooseVariant,true);assert.equal(parent.offlineUnavailable,false);assert.equal(parent.stock,null);assert.equal(parent.priceCents,null);
 assert.deepEqual([...offlineCatalogueSearch(source,pages,{productId:42})],[variant]);
 assert.equal(offlineCatalogueSearch(source,pages,{catalogueFilters:{hideUnavailable:true}}).length,1);
 assert.equal(offlineCatalogueSearch(source,[{savedAt:100,data:{items:[{...variant,stock:0}]}}],{catalogueFilters:{hideUnavailable:true}}).length,0);
 assert.equal(offlineCatalogueSearch(source,[],{})[0].offlineUnavailable,true);
});

test('catalogue preparation walks all native variant pages sequentially and refuses partial prices',async()=>{
 const {prepareOfflineCatalogue}=await import('../src/totustpv/offline-catalogue-preparation.js');
 const {catalogueUnitMicros}=await import('../src/totustpv/offline-commercial.js');
 assert.equal(catalogueUnitMicros('8.012101'),8012101);assert.equal(catalogueUnitMicros('0.000001'),1);assert.equal(catalogueUnitMicros(undefined),null);
 for(const value of ['1.0000001','1e2','-1',' 1',1,null])assert.throws(()=>catalogueUnitMicros(value));
 const source={productsComplete:true,products:[{id:'1'},{id:'2'},{id:'3',active:'0'}]},calls=[],progress=[];
 const page=(id,n,more)=>Object.assign([{id:id+':'+(n+1),nativeProductId:id,chooseVariant:false,stock:2,quantityBreaks:[1],priceValidForMs:86400000,unitTaxInclMicros:8012101,unitTaxExclMicros:6621571}],{priceReadAt:Date.now(),page:n,hasMore:more,pricingContext:{customerId:1,addressId:2,shopId:1,currency:'EUR',roundMode:2,roundType:1,computingPrecision:6,quantity:1}});
 const result=await prepareOfflineCatalogue({source,onProgress:p=>progress.push(p),readPage:async q=>{calls.push(q);return page(q.productId,q.page,q.productId===1&&q.page===0);}});
 const remote=[],throttled=[];
 const reused=await prepareOfflineCatalogue({source,readCachedPage:async q=>q.productId===1?page(1,q.page,q.page===0):null,beforePage:async q=>throttled.push(q.productId),readPage:async q=>{remote.push(q.productId);return page(q.productId,q.page,false);}});
 assert.equal(reused.variants,3);assert.deepEqual(remote,[2]);assert.deepEqual(throttled,[2],'cached pages must not incur store-request throttling');
 await assert.rejects(prepareOfflineCatalogue({source,readCachedPage:async()=>{const rows=page(1,0,false);rows[0].priceValidForMs=0;return rows;},readPage:async()=>{throw Error('Must not fetch');}}),/vigencia válida/);
 assert.deepEqual(calls,[{productId:1,page:0},{productId:1,page:1},{productId:2,page:0}]);assert.equal(result.variants,3);assert.equal(result.completedProducts,2);assert.equal(progress.at(-1).products,2);
 for(const lifetime of [undefined,0,-1,86400001])await assert.rejects(prepareOfflineCatalogue({source:{productsComplete:true,products:[{id:'1'}]},readPage:async()=>{const rows=page(1,0,false);rows[0].priceValidForMs=lifetime;return rows;}}),/vigencia válida/);
 for(const expireAt of ['duringRead','afterProgress']){
  let instant=1000;
  await assert.rejects(prepareOfflineCatalogue({source:{productsComplete:true,products:[{id:'1'}]},now:()=>instant,onProgress:p=>{if(expireAt==='afterProgress'&&p.completedProducts===1)instant=2000;},readPage:async()=>{
   const rows=page(1,0,false);rows.priceReadAt=1000;rows[0].priceValidForMs=1000;if(expireAt==='duringRead')instant=2000;return rows;
  }}),/precio ha caducado/,expireAt);
 }
 let instant=1000;
 const valid=await prepareOfflineCatalogue({source:{productsComplete:true,products:[{id:'1'}]},now:()=>instant,readPage:async()=>{const rows=page(1,0,false);rows.priceReadAt=500;rows[0].priceValidForMs=1000;return rows;}});
 assert.equal(valid.validUntil,1500);
 await assert.rejects(prepareOfflineCatalogue({source,now:()=>instant,readPage:async q=>{instant=999;return page(q.productId,0,false);}}),/reloj ha cambiado/);
 const tierCalls=[];
 const tiers=await prepareOfflineCatalogue({source:{productsComplete:true,products:[{id:'1'}]},readPage:async q=>{tierCalls.push(q);const rows=page(1,0,false);rows.pricingContext.quantity=q.pricingQuantity??1;rows[0].quantityBreaks=[1,3,10];return rows;}});
 for(const changed of ['missing','added','replaced']){
  await assert.rejects(prepareOfflineCatalogue({source:{productsComplete:true,products:[{id:'1'}]},readPage:async q=>{
   const rows=page(1,0,false);rows.pricingContext.quantity=q.pricingQuantity??1;rows[0].quantityBreaks=[1,3];
   const second={...rows[0],id:'1:2'};
   if(changed==='missing'&&!q.pricingQuantity||changed==='added'&&q.pricingQuantity)rows.push(second);
   if(changed==='replaced'&&q.pricingQuantity)rows[0]={...rows[0],id:'1:9'};
   return rows;
  }}),/variantes han cambiado/,changed);
 }
 assert.deepEqual(tierCalls,[{productId:1,page:0},{productId:1,page:0,pricingQuantity:3},{productId:1,page:0,pricingQuantity:10}]);assert.equal(tiers.variants,1);assert.equal(tiers.priceSnapshots,3);
 await assert.rejects(prepareOfflineCatalogue({source:{productsComplete:true,products:[{id:'1'}]},readPage:async q=>{const rows=page(1,0,false);rows.pricingContext.quantity=q.pricingQuantity??1;rows[0].quantityBreaks=q.pricingQuantity?[1,4]:[1,3];return rows;}}),/tramos de cantidad han cambiado/);
 await assert.rejects(prepareOfflineCatalogue({source,readPage:async q=>{const rows=page(q.productId,q.page,false);rows[0].unitTaxInclMicros=null;return rows;}}),/Faltan datos/);
 await assert.rejects(prepareOfflineCatalogue({source,readPage:async q=>{const rows=page(q.productId,q.page,false);delete rows.pricingContext;return rows;}}),/Falta el contexto/);
 await assert.rejects(prepareOfflineCatalogue({source,readPage:async q=>{const rows=page(q.productId,q.page,false);rows.pricingContext.roundMode=q.productId===1?2:3;return rows;}}),/configuración de precios ha cambiado/);
 let current=true;await assert.rejects(prepareOfflineCatalogue({source,isCurrent:()=>current,readPage:async q=>{current=false;return page(q.productId,q.page,false);}}),/Ha cambiado/);
 const controller=new AbortController();let reads=0,release,entered;
 const gate=new Promise(resolve=>{entered=resolve;});
 const waiting=prepareOfflineCatalogue({source,signal:controller.signal,beforePage:()=>new Promise(resolve=>{release=resolve;entered();}),readPage:async q=>{reads++;return page(q.productId,q.page,false);}});
 await gate;controller.abort(new Error('Puesto cerrado'));release();await assert.rejects(waiting,/Puesto cerrado/);assert.equal(reads,0);
 const inFlight=new AbortController(),reported=[];
 await assert.rejects(prepareOfflineCatalogue({source,signal:inFlight.signal,onProgress:p=>reported.push(p),readPage:async q=>{inFlight.abort(new Error('Cliente cambiado'));return page(q.productId,q.page,false);}}),/Cliente cambiado/);
 assert.equal(reported.length,1);assert.equal(reported[0].completedProducts,0);
 for(const hasMore of [false,true]){
  const updates=[];await assert.rejects(prepareOfflineCatalogue({source,onProgress:p=>updates.push(p),readPage:async()=>Object.assign([],{page:0,hasMore})}),/página vacía/);
  assert.equal(updates.at(-1).completedProducts,0);
 }
});
