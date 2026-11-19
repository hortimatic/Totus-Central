import assert from 'node:assert/strict';
import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer(),{chromium}=await import('playwright'),browser=await chromium.launch({headless:true,channel:process.env.TOTUS_BROWSER_CHANNEL||'msedge'});
try{
 const page=await browser.newPage({viewport:{width:390,height:800}});await page.goto('http://127.0.0.1:4173/tests/prestashop-harness.html');
 await page.evaluate(async()=>{
  const {createProductosUI,productosWorkspacePage}=await import('../src/productos-ui.js');document.querySelector('#chatHarness').innerHTML=productosWorkspacePage();
  const q=window.connectionRefresh={owner:'connection-refresh',permitted:true,revision:1,contexts:0,calls:[],categoryAttempts:0,categoryFailure:'transient'};
  q.ui=createProductosUI({actor:()=>q.owner,allowed:()=>q.permitted,canEdit:()=>true,
   rpc:async()=>{q.contexts++;return {connections:[{id:'1',name:'PrestaShop · Hortimatic',protocol:'prestashop',enabled:true,configured:true,real_data_authorized:true,revision:q.revision,verified_revision:q.revision}]};},
   invoke:async body=>{q.calls.push(structuredClone(body));if(body.revision!==q.revision)throw Error('Actualiza la conexión antes de probar.');if(body.resource==='categories'){q.categoryAttempts++;if(q.categoryFailure==='transient'&&q.categoryAttempts===1)throw Error('connection closed before message completed');if(q.categoryFailure==='forbidden')throw Error('HTTP 403 Forbidden');}return {ok:true,store:body.store,resource:body.resource,page:body.page,page_size:body.page_size,rows:body.resource==='products'?[{id:'42',reference:'REFRESH-42',name:'Producto conservado',price:'10',active:'0',associations:{}}]:[],possibly_more:false};}
  });await q.ui.mount(document.querySelector('#productosRoot'));
 });
 await page.getByText('Producto conservado',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>connectionRefresh.categoryAttempts),2,'Transient GET retries once');
 await page.evaluate(()=>{connectionRefresh.revision=2;});
 await page.locator('[data-pr-action="catalog-load"]:visible').click();
 await page.waitForFunction(()=>connectionRefresh.calls.some(call=>call.resource==='products'&&call.revision===2));
 await page.waitForFunction(()=>!document.querySelector('[data-pr-action="catalog-load"]').disabled);
 const result=await page.evaluate(()=>({contexts:connectionRefresh.contexts,calls:connectionRefresh.calls}));
 assert(result.contexts>=2);assert.equal(result.calls.at(-1).revision,2);assert(result.calls.every(call=>call.action==='prestashop_read'),'Refreshing settings never sends a business write');
 assert.equal(await page.getByText('Producto conservado',{exact:true}).count(),1);assert.doesNotMatch(await page.locator('#productosRoot').innerText(),/Actualiza la conexión antes de probar/);
 await page.evaluate(()=>{connectionRefresh.categoryFailure='forbidden';connectionRefresh.categoryAttempts=0;});
 await page.locator('[data-pr-action="catalog-load"]:visible').click();await page.waitForFunction(()=>!document.querySelector('[data-pr-action="catalog-load"]').disabled);
 assert.equal(await page.evaluate(()=>connectionRefresh.categoryAttempts),1,'Permission denial is not retried');
 assert.match(await page.locator('#productosRoot .prd-v4-status').innerText(),/Lecturas auxiliares pendientes: categorías/);
 const shared=await page.evaluate(async()=>{
  const q=connectionRefresh,request={connectionId:'1',revision:2},snapshot=q.ui.catalogueSnapshot(request);
  const before=q.calls.length;q.ui.dispose();const afterDispose=q.ui.catalogueSnapshot(request);
  if(snapshot)snapshot.products[0].name='External change';
  const unchanged=q.ui.catalogueSnapshot(request);const wrongRevision=q.ui.catalogueSnapshot({...request,revision:1});
  const {createCentralTpvAdapter}=await import('../src/totustpv/central-adapter.js');
  const adapter=createCentralTpvAdapter({actorId:q.owner,storage:localStorage,centralCatalogueSource:selection=>q.ui.catalogueSnapshot(selection),invoke:async input=>{
   if(input.action!=='context')throw Error('Unexpected remote read');
   return {actorId:q.owner,workstations:[{environment:'qa',connectionId:'1',connectionRevision:2,shopId:1,storeId:'store',drawerId:'drawer',canSell:true,canOpen:true,canReconcile:true}]};
  }});
  await adapter.context();await adapter.selectWorkstation({storeId:'store',drawerId:'drawer'});const tpvSource=await adapter.catalogueSource();
  q.permitted=false;const forbidden=q.ui.catalogueSnapshot(request);q.permitted=true;q.owner='other';const otherActor=q.ui.catalogueSnapshot(request);
  return {tpvSource,snapshot,afterDispose,unchanged,wrongRevision,forbidden,otherActor,noRequests:before===q.calls.length};
 });
 assert.equal(shared.tpvSource.products[0].id,'42');assert.equal(shared.tpvSource.connectionId,'1');assert.equal(shared.snapshot.productsComplete,true);assert.equal(shared.afterDispose.products[0].name,'Producto conservado');assert.equal(shared.unchanged.products[0].name,'Producto conservado');assert.equal(shared.wrongRevision,null);assert.equal(shared.forbidden,null);assert.equal(shared.otherActor,null);assert.equal(shared.noRequests,true);
 console.log('Products connection refresh: changed quota/revision in another tab is reread before catalogue GET; product retained, no writes PASS');
}finally{await browser.close();await server?.close();}
