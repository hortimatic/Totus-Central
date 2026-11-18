import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startLocalServer} from '../local-static-server.mjs';
export async function exerciseOfflineSaleBrowser({handle,actor,fixture,paths}){
 const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true});
 const page=await browser.newPage(),errors=[],requests=[];let lost=false,saleId,disconnected=false;
 const posts=()=>paths.filter(row=>row.method==='POST'&&row.path==='/api/totus_tpv_sales').length,before=posts();
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4173'?route.continue():route.abort('blockedbyclient'));
  await page.route('**/__offline_sale_fixture',async route=>{
   if(disconnected)return route.abort('internetdisconnected');
   const body=route.request().postData(),input=JSON.parse(body);
   const response=await handle(new Request('https://central.local/tpv',{method:'POST',headers:{Authorization:'Bearer synthetic-auth-fixture','Content-Type':'application/json'},body})),text=await response.text();requests.push({action:input.action,status:response.status,result:JSON.parse(text)?.status,error:JSON.parse(text)?.error});
   if(input.action==='submit'&&response.status===200&&!lost){lost=true;saleId=input.operationId;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'TEST_LOST_REPLY'})});}
   await route.fulfill({status:response.status,contentType:'application/json',body:text});
  });
  const mount=async()=>page.evaluate(async ({actor,productId,reference})=>{
   fixture.workspace.dispose();const {createTpvWorkspace}=await import('/src/totustpv/workspace.js'),{createCentralTpvAdapter}=await import('/src/totustpv/central-adapter.js');
   const adapter=createCentralTpvAdapter({actorId:actor,storage:localStorage,centralCatalogueSource:query=>({connectionId:query.connectionId,revision:query.revision,store:'qa-shop',readAt:Date.now(),productsComplete:true,products:[{id:String(productId),__store:'qa-shop',name:reference,reference}]}),invoke:async payload=>{let response;try{response=await fetch('/__offline_sale_fixture',{method:'POST',body:JSON.stringify(payload)});}catch{const error=Error('Sin conexión');error.code='TPV_CONNECTION_UNAVAILABLE';throw error;}const result=await response.json();if(!response.ok||result?.error)throw Error(result?.error||'Fixture error');return result;}});
   const context=await adapter.context(),session=context.sessions.find(row=>row.status==='open'),drawer=context.drawers.find(row=>row.id===session.drawerId);
   await adapter.selectSession(session);const prepared=await adapter.prepareOfflineCatalogue();if(prepared?.completedProducts!==1||prepared.variants<1||prepared.priceSnapshots!==2)throw Error('Native catalogue preparation incomplete');
   const firstPage=await adapter.searchProducts({productId,page:0}),lastPage=await adapter.searchProducts({productId,page:1});
   if(firstPage.pricingContext?.quantity!==1||firstPage.pricingContext.shopId!==drawer.shopId||!Number.isInteger(firstPage.pricingContext.computingPrecision))throw Error('Native pricing context missing');
   if(!Number.isSafeInteger(firstPage[0]?.priceValidForMs)||firstPage[0].priceValidForMs<=0||firstPage[0].priceValidForMs>360000)throw Error('Native temporal offer lifetime missing');
   const quantityPage=await adapter.searchProducts({productId,pricingQuantity:3});
   if(quantityPage.pricingContext?.quantity!==3||quantityPage[0]?.id!==productId+':0')throw Error('Native quantity price not confirmed');
   const belowThreshold=await adapter.searchProducts({productId,pricingQuantity:2});
   if(belowThreshold[0].unitTaxInclMicros!==firstPage[0].unitTaxInclMicros||quantityPage[0].unitTaxInclMicros>=firstPage[0].unitTaxInclMicros||Math.abs(quantityPage[0].unitTaxInclMicros-firstPage[0].unitTaxInclMicros*0.9)>1)throw Error('Native volume discount threshold not respected');
   if(firstPage.length!==1||firstPage[0].id!==productId+':0'||firstPage.hasMore||lastPage.length||lastPage.hasMore)throw Error('Native simple product pagination invalid');
   const {createOfflineJournal}=await import('/src/totustpv/offline-journal.js'),{offlineDevice}=await import('/src/totustpv/offline-device.js');
   window.saleJournal=createOfflineJournal({scope:{actorId:actor,connectionId:drawer.connectionId,storeId:session.storeId,drawerId:drawer.id,shopId:drawer.shopId,deviceId:offlineDevice()}});
   window.saleWorkspace=createTpvWorkspace({actor:()=>({id:actor,active:true,full_name:'Operador local'}),can:()=>true,autoOpen:true,createLiveAdapter:()=>adapter});saleWorkspace.mount(document.querySelector('#tpv'));
  },{actor,productId:fixture.productId,reference:fixture.reference});
  await page.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');await mount();
  await page.locator('[data-tpv-search]').fill(fixture.reference);await page.locator(`[data-tpv-add="${fixture.productId}:0"]`).click();
  await page.getByRole('button',{name:'Calcular y cobrar',exact:true}).click();
  const pay=page.locator('[data-tpv-form="pay"]');await pay.locator('[name=received]').fill('100,00');await pay.locator('button[type=submit]').click();
  await page.getByText('Respuesta pendiente de recuperar',{exact:true}).waitFor();assert.ok(saleId);
  const stored=await page.evaluate(id=>saleJournal.get(id),saleId);assert.equal(stored.status,'uncertain');assert.ok(stored.ticket.commercial);assert.equal(stored.ticket.lines[0].productId,fixture.productId);assert.equal(posts(),before+1);
  await page.reload();await mount();await page.getByText('Pedido verificado en PrestaShop',{exact:true}).waitFor();
  assert.equal((await page.evaluate(id=>saleJournal.get(id),saleId)).status,'synced');assert.equal(posts(),before+1);assert.deepEqual(errors,[]);
  await page.getByRole('button',{name:'Nuevo ticket',exact:true}).click();
  await page.locator('[data-tpv-search]').fill(fixture.reference);
  await page.locator(`[data-tpv-add="${fixture.productId}:0"]`).waitFor();
  const offlineBefore=posts();disconnected=true;await page.context().setOffline(true);
  await page.locator(`[data-tpv-add="${fixture.productId}:0"]`).click();
  await page.getByRole('button',{name:'Calcular y cobrar',exact:true}).click();
  await page.getByRole('heading',{name:'Cobro sin conexión',exact:true}).waitFor();
  const offlinePay=page.locator('[data-tpv-form="pay"]');await offlinePay.locator('[name=received]').fill('100,00');
  await offlinePay.getByRole('button',{name:'Guardar venta en este dispositivo',exact:true}).click();
  await page.getByRole('heading',{name:'Venta guardada en este dispositivo',exact:true}).waitFor();
  const queued=await page.evaluate(async()=>(await saleJournal.list()).filter(row=>row.status==='queued'));assert.equal(queued.length,1);
  assert.equal(posts(),offlineBefore,'A newly prepared offline basket cannot create a native order while disconnected');
  await page.getByRole('button',{name:'Nuevo ticket',exact:true}).click();await page.locator('[data-tpv-search]').waitFor();
  disconnected=false;await page.context().setOffline(false);
  let synchronized;
  for(let attempt=0;attempt<300;attempt++){
   synchronized=await page.evaluate(id=>saleJournal.get(id),queued[0].id);
   if(['synced','conflict'].includes(synchronized.status))break;
   await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.equal(synchronized.status,'synced','The local journal must finish native reconciliation before success is reported');
  assert.equal(posts(),offlineBefore+1,'Restored connectivity creates exactly one order for the new offline basket');
  assert.deepEqual(errors,[]);
  console.log('PASS actual workspace checkout: durable IndexedDB, lost reply and reload recovery; a new offline basket is saved without native writes, next ticket opens, reconnection creates exactly one order. Local PrestaShop only.');
 }catch(error){console.error('OFFLINE UI FAILURE',JSON.stringify({requests,errors,text:(await page.locator('#tpv').innerText()).slice(0,5000),local:saleId?await page.evaluate(id=>saleJournal.get(id),saleId):null},null,2));throw error;}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
