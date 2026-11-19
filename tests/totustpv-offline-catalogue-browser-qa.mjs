import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');
 const result=await page.evaluate(async()=>{
  const {createOfflineCatalogueCache}=await import('/src/totustpv/offline-catalogue-cache.js');
  const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
  const scope={actorId:id(1),connectionId:id(2),drawerId:id(3),shopId:1,customerId:4,addressId:5};
  const name='catalogue-qa-'+crypto.randomUUID();let time=1000;
  const make=s=>createOfflineCatalogueCache({scope:s,name,now:()=>time});
  const cache=make(scope),query={search:'café',page:0},data={items:[{id:'1:2',name:'Café',priceCents:100}],page:0,hasMore:false,pricingContext:{customerId:4,addressId:5,shopId:1,currency:'EUR',roundMode:2,roundType:1,computingPrecision:6,quantity:1}};
  await cache.put(query,data,{requestedAt:900});data.items[0].name='Changed outside';
  const saved=await cache.get({page:0,search:'café'});
  const isolated=[];for(const [key,value] of Object.entries({actorId:id(6),connectionId:id(7),drawerId:id(8),shopId:2,customerId:6,addressId:7,revision:2}))isolated.push(await make({...scope,[key]:value}).get(query));
  const wrongQuery=await cache.get({...query,page:1});
  const older=await cache.put(query,{...data,items:[{id:'1:2',name:'Older'}]},{requestedAt:800});
  const stillSaved=await cache.get(query);time=2000;
  const newer=await cache.put(query,{...data,items:[{id:'1:2',name:'Newer'}]},{requestedAt:1900});
  let quotaRejected=false;const original=IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put=function(){throw new DOMException('Full','QuotaExceededError');};
  try{await cache.put(query,data,{requestedAt:1950});}catch{quotaRejected=true;}finally{IDBObjectStore.prototype.put=original;}
  const afterQuota=await cache.get(query);time=86402001;const expired=await cache.get(query);time=1999;const clockRollback=await cache.get(query);
  time=2000;window.catalogueTest={scope,name};
  return {saved,isolated,wrongQuery,older,stillSaved,newer,quotaRejected,afterQuota,expired,clockRollback};
 });
 assert.equal(result.saved.data.items[0].name,'Café');assert.ok(result.isolated.every(row=>row===null));assert.equal(result.wrongQuery,null);
 assert.equal(result.older,false);assert.equal(result.stillSaved.data.items[0].name,'Café');assert.equal(result.newer,true);
 assert.equal(result.quotaRejected,true);assert.equal(result.afterQuota.data.items[0].name,'Newer');assert.equal(result.expired,null);assert.equal(result.clockRollback,null);
 const slow=await page.evaluate(async()=>{
  const {createOfflineCatalogueCache}=await import('/src/totustpv/offline-catalogue-cache.js');
  let instant=86400100;
  const cache=createOfflineCatalogueCache({...window.catalogueTest,name:'slow-'+crypto.randomUUID(),now:()=>instant});
  await cache.put({page:0},{items:[{id:'1:0',name:'Respuesta lenta'}],page:0,hasMore:false},{requestedAt:0});
  const expired=await cache.get({page:0}),pages=await cache.pages();
  instant=90000000;
  await cache.put({page:1},{items:[{id:'2:0',name:'Precio anterior'}],page:1,hasMore:false},{requestedAt:instant-300001});
  const tooOld=await cache.get({page:1},{maxAgeMs:300000});
  const visible=await cache.pages();
  return {expired,pages,tooOld,visible};
 });
 assert.equal(slow.expired,null);assert.deepEqual(slow.pages,[]);assert.equal(slow.tooOld,null);
 assert.equal(slow.visible.length,1);assert.equal(slow.visible[0].requestedAt,89699999);
 const temporal=await page.evaluate(async()=>{
  const {createOfflineCatalogueCache}=await import('/src/totustpv/offline-catalogue-cache.js');let instant=1000;
  const cache=createOfflineCatalogueCache({...window.catalogueTest,name:'temporal-'+crypto.randomUUID(),now:()=>instant});
  const value={items:[{id:'3:0',name:'Oferta',priceValidForMs:2000}],page:0,hasMore:false};
  await cache.put({page:0},value,{requestedAt:1000});instant=2999;const before=await cache.get({page:0});
  instant=3000;const atBoundary=await cache.get({page:0}),pages=await cache.pages();
  let rejected=false;try{await cache.put({page:1},{...value,items:[{...value.items[0],priceValidForMs:-1}]},{requestedAt:3000});}catch{rejected=true;}
  const history=await cache.pages({includeExpired:true});
  return {before,atBoundary,pages,rejected,history};
 });
 assert.ok(temporal.before);assert.equal(temporal.atBoundary,null);assert.deepEqual(temporal.pages,[]);assert.equal(temporal.rejected,true);
 assert.equal(temporal.history.length,1);assert.equal(temporal.history[0].requestedAt,1000);
 const basketExpiry=await page.evaluate(async()=>{
  const {createOfflineCatalogueCache}=await import('/src/totustpv/offline-catalogue-cache.js');
  const {createCentralTpvAdapter}=await import('/src/totustpv/central-adapter.js');
  const context={customerId:4,addressId:5,shopId:1,currency:'EUR',roundMode:2,roundType:1,computingPrecision:6,quantity:1};
  const scope=window.catalogueTest.scope,name='basket-expiry-'+crypto.randomUUID(),instant=Date.now();
  const cache=createOfflineCatalogueCache({scope,name});
  const row={id:'3:0',nativeProductId:3,name:'Oferta',quantityBreaks:[1],priceValidForMs:86400000,unitTaxInclMicros:1000000,unitTaxExclMicros:1000000};
  await cache.put({search:'old'},{items:[row],page:0,hasMore:false,pricingContext:context},{requestedAt:instant-2000});
  const station={environment:'qa',connectionId:scope.connectionId,shopId:1,storeId:scope.drawerId,drawerId:scope.drawerId,canSell:true,canOpen:true,canReconcile:true,nativeProfile:{counter_customer_id:4,counter_address_id:5}};
  let calls=0;
  const adapter=createCentralTpvAdapter({actorId:scope.actorId,storage:localStorage,catalogueCache:()=>cache,invoke:async input=>{calls++;if(input.action!=='context')throw Error('Unexpected network');return {actorId:scope.actorId,workstations:[station]};}});
  await adapter.context();await adapter.selectWorkstation({storeId:station.storeId,drawerId:station.drawerId});
  const args={lines:[{productId:3,attributeId:0,qty:1}],pricingContext:context};
  const before=await adapter.localBasketPrices(args);
  await cache.put({search:'new'},{items:[{...row,priceValidForMs:1,unitTaxInclMicros:900000,unitTaxExclMicros:900000}],page:0,hasMore:false,pricingContext:context},{requestedAt:instant-1000});
  let message='';try{await adapter.localBasketPrices(args);}catch(error){message=error.message;}
  return {before:before.subtotals.initialGrossCents,message,calls};
 });
 assert.equal(basketExpiry.before,100);assert.match(basketExpiry.message,/Falta un precio vigente/);assert.equal(basketExpiry.calls,1);
 const fixture=await page.evaluate(()=>catalogueTest);await page.reload();
 const restored=await page.evaluate(async fixture=>{const {createOfflineCatalogueCache}=await import('/src/totustpv/offline-catalogue-cache.js');return createOfflineCatalogueCache({...fixture,now:()=>2000}).get({search:'café',page:0});},fixture);
 assert.equal(restored.data.items[0].name,'Newer');assert.equal(restored.data.pricingContext.computingPrecision,6);assert.equal(restored.data.pricingContext.customerId,4);
 const integration=await page.evaluate(async()=>{
  const {createCentralTpvAdapter}=await import('/src/totustpv/central-adapter.js');
  const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');let disconnected=false;
  const station={environment:'qa',connectionId:id(22),shopId:1,storeId:id(23),drawerId:id(24),canSell:true,canOpen:true,canReconcile:true};
  const adapter=createCentralTpvAdapter({actorId:id(21),storage:localStorage,invoke:async input=>{
   if(input.action==='context')return {actorId:id(21),workstations:[station]};
   if(disconnected)throw Object.assign(Error('Offline'),{code:'TPV_CONNECTION_UNAVAILABLE'});
   return {currency:'EUR',payable_cart_quote:false,has_more:false,page:0,items:[{id:'12:0',name:'Artículo guardado',product_id:12,preview_cents:123,stock:2,minimum_quantity:1,choose_variant:false}]};
  }});
  await adapter.context();await adapter.selectWorkstation({storeId:station.storeId,drawerId:station.drawerId});
  const online=await adapter.searchProducts();disconnected=true;const offline=await adapter.searchProducts();
  return {onlineName:online[0].name,offlineName:offline[0].name,offline:offline.offlineCached,price:offline[0].priceCents,hasMore:offline.hasMore};
 });
 assert.deepEqual(integration,{onlineName:'Artículo guardado',offlineName:'Artículo guardado',offline:true,price:123,hasMore:false});
 const sourceResult=await page.evaluate(async()=>{
  const {createCentralTpvAdapter}=await import('/src/totustpv/central-adapter.js');
  const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
  const station={environment:'qa',connectionId:id(32),connectionRevision:4,shopId:1,storeId:id(33),drawerId:id(34),canSell:true,canOpen:true,canReconcile:true,session:{id:id(35),status:'open'}};
  const source={connectionId:station.connectionId,revision:4,store:'hortimatic',productsComplete:true,readAt:Date.now(),products:[{id:'42',__store:'hortimatic',name:'Desde Productos',price:'10',unexpected:'discard'}],metadata:{categories:[{id:'2',name:'Inicio',unexpected:'discard'}],warnings:[]}};
  let calls=0,permission=true,connected=true;
  const build=provider=>createCentralTpvAdapter({actorId:id(31),storage:localStorage,canReadCentralCatalogue:()=>permission,centralCatalogueSource:provider,invoke:async input=>{calls++;if(input.action!=='context'){if(!connected)throw Object.assign(Error('Disconnected'),{code:'TPV_CONNECTION_UNAVAILABLE'});return {pricing_context:{customerId:4,addressId:5,shopId:1,currency:'EUR',roundMode:2,roundType:1,computingPrecision:6,quantity:1},currency:'EUR',payable_cart_quote:false,has_more:false,page:input.page,items:[{id:'42:0',product_id:42,name:'Desde Productos',stock:2,minimum_quantity:1,choose_variant:false,quantity_breaks:[1],price_valid_for_ms:86400000,unit_tax_incl:'8.012101',unit_tax_excl:'6.621571',preview_cents:801,preview_tax_excl_cents:662}]};}return {actorId:id(31),workstations:[station]};}});
  const first=build(()=>source);const context=await first.context();await first.selectSession(context.sessions[0]);const prepared=await first.prepareOfflineCatalogue();await first.prepareOfflineCatalogue();connected=false;
  const fresh=build(()=>null),next=await fresh.context();await fresh.selectSession(next.sessions[0]);const restored=await fresh.catalogueSource();const found=await fresh.searchProducts({search:'Desde'});permission=false;const forbidden=await fresh.catalogueSource();
  const {createOfflineSourceStore}=await import('/src/totustpv/offline-source-store.js');
  const scope={actorId:id(31),connectionId:id(32),revision:4,shopId:1},store=createOfflineSourceStore({scope});
  const changedScope=[];for(const patch of [{actorId:id(38)},{connectionId:id(39)},{revision:5},{shopId:2}])changedScope.push(await createOfflineSourceStore({scope:{...scope,...patch}}).get());
  const old=await store.put({...source,readAt:source.readAt-1000});
  const expired=await createOfflineSourceStore({scope,now:()=>source.readAt+86400001}).get();
  return {prepared,found:[...found],partial:found.offlineCoveragePartial,restored,forbidden,calls,changedScope,old,expired};
 });
 assert.equal(sourceResult.restored.products[0].name,'Desde Productos');assert.equal(sourceResult.restored.products[0].unexpected,undefined);assert.equal(sourceResult.restored.metadata.categories[0].unexpected,undefined);
 assert.equal(sourceResult.prepared.completedProducts,1);assert.equal(sourceResult.calls,4);assert.equal(sourceResult.found[0].name,'Desde Productos');assert.equal(sourceResult.found[0].priceCents,801);assert.equal(sourceResult.found[0].unitTaxInclMicros,8012101);assert.equal(sourceResult.found[0].offlineUnavailable,undefined);assert.equal(sourceResult.partial,true);assert.equal(sourceResult.forbidden,null);assert.ok(sourceResult.changedScope.every(row=>row===null));assert.equal(sourceResult.old,false);assert.equal(sourceResult.expired,null);
 console.log('PASS actual IndexedDB catalogue: reload persistence, actor/store/drawer/customer/address isolation, query identity, old response protection, expiry, clock rollback and quota rollback. Cache only; not offline checkout certification.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
