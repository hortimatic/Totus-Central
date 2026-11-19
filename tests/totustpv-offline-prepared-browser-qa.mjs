import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true});
try{
 for(const mode of ['confirmed','conflict','lost-response','reopen','lost-final-status','stale-recovery']){
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');
 await page.evaluate(async mode=>{
  fixture.workspace.dispose();const {createTpvWorkspace}=await import('/src/totustpv/workspace.js');
  const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),session={id:id(5),status:'open',storeId:id(2),drawerId:id(3)};
  window.sends=0;window.deliveries=[];window.statusReads=0;window.retryCallbacks=[];const originalTimer=window.setTimeout;window.setTimeout=(callback,delay,...args)=>{if(delay===30000){retryCallbacks.push(callback);return originalTimer(()=>{},3600000);}return originalTimer(callback,delay,...args);};const adapter={mode:'qa',context:async()=>({stores:[{id:id(2),name:'Local'}],drawers:[{id:id(3),storeId:id(2),connectionId:id(4),shopId:1,name:'Caja',canSell:true}],sessions:[session]}),selectSession:async()=>session,pendingSale:async()=>window.reopening?id(6):null,searchProducts:async()=>[{id:'1:0',name:'Artículo',priceCents:801,stock:10}],quote:async()=>({id:id(6),totalCents:801,currency:'EUR',paymentMethods:['cash'],quoteExpiresAt:Date.now()+60000}),localSaleTicket:({payments})=>({cashSessionId:session.id,lines:[{productId:1,qty:1}],totalCents:801,currency:'EUR',payments}),offlineDelivery:()=>({dispatch:async({operationId})=>{if(!navigator.onLine)throw Error('Must not sync offline');deliveries.push(operationId);return {operationId,status:['reopen','lost-final-status','stale-recovery'].includes(mode)?'confirmed':mode,verified:true};},recover:async({operationId})=>{if(mode!=='lost-response')throw Error('Unexpected recovery');deliveries.push('recover:'+operationId);return {operationId,status:'confirmed',verified:true};}}),recover:async({operationId})=>{statusReads++;if(mode==='stale-recovery'){await new Promise(resolve=>window.releaseStatus=resolve);window.statusReturned=true;}if(mode==='lost-final-status'&&statusReads===1){const error=new Error('Connection lost');error.code='TPV_CONNECTION_UNAVAILABLE';throw error;}return {id:operationId,status:'confirmed',reference:'TEST-1',totalCents:801,changeCents:199};},submit:async()=>{sends++;throw Error('Must not send offline');}};
  window.reopenWorkspace=()=>{window.reopening=true;testWorkspace.dispose();window.testWorkspace=createTpvWorkspace(options);testWorkspace.mount(document.querySelector('#tpv'));};const options={actor:()=>({id:id(1),active:true}),can:()=>true,createLiveAdapter:()=>adapter,autoOpen:true};window.testWorkspace=createTpvWorkspace(options);testWorkspace.mount(document.querySelector('#tpv'));
 },mode);
 await page.locator('[data-tpv-add="1:0"]').click();await page.getByRole('button',{name:'Calcular y cobrar',exact:true}).click();
 await page.locator('[name=received]').fill('10,00');
 if(mode!=='lost-response')await page.evaluate(()=>Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false}));
 await page.getByRole('button',{name:'Confirmar cobro y crear pedido',exact:true}).click();
 if(mode==='lost-response'){
  await page.getByRole('heading',{name:'Respuesta pendiente de recuperar',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Confirmar cobro y crear pedido',exact:true}).count(),0);
  assert.match(await page.locator('[aria-label="Resultado de venta"]').innerText(),/8,01/);
  await page.getByRole('button',{name:'Recuperar resultado',exact:true}).click();
  await page.getByRole('heading',{name:'Pedido verificado en PrestaShop',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>sends),1);
  assert.deepEqual(await page.evaluate(()=>deliveries),['recover:00000000-0000-4000-8000-000000000006']);
  assert.deepEqual(errors,[]);await page.close();continue;
 }
 await page.getByRole('heading',{name:'Venta guardada en este dispositivo'}).waitFor();
 if(mode==='reopen'){await page.evaluate(()=>reopenWorkspace());await page.getByRole('heading',{name:'Venta guardada en este dispositivo',exact:true}).waitFor();}
 assert.match(await page.locator('[aria-label="Resultado de venta"]').innerText(),/1,99/);
 await page.getByRole('button',{name:'Sincronizar ahora',exact:true}).click();
 await page.getByText('La venta está guardada. La sincronización continuará cuando vuelva la conexión.',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>sends),0);assert.deepEqual(errors,[]);
 await page.evaluate(mode=>{window.retryCallbacks=[];Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>true});window.dispatchEvent(new Event('online'));if(mode!=='lost-final-status')window.dispatchEvent(new Event('online'));},mode);
 if(mode==='stale-recovery'){
  await page.waitForFunction(()=>typeof window.releaseStatus==='function');
  await page.evaluate(()=>testWorkspace.mount(document.querySelector('#tpv')));
  await page.locator('[data-tpv-add="1:0"]').waitFor();
  await page.evaluate(async()=>{releaseStatus();await new Promise(resolve=>setTimeout(resolve,0));});
  await page.locator('[data-tpv-add="1:0"]').click();
  assert.equal(await page.getByRole('heading',{name:'Pedido verificado en PrestaShop',exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'Calcular y cobrar',exact:true}).isEnabled(),true);
  assert.deepEqual(errors,[]);await page.close();continue;
 }
 if(mode==='lost-final-status'){
  await page.getByText('La venta está sincronizada. Se recuperará su resultado automáticamente cuando vuelva la conexión.',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>retryCallbacks.length),1);
  assert.equal(await page.evaluate(()=>statusReads),1);
  await page.evaluate(()=>retryCallbacks.shift()());
 }
 await page.getByRole('heading',{name:mode!=='conflict'?'Pedido verificado en PrestaShop':'Venta pendiente de revisión',exact:true}).waitFor();
 assert.deepEqual(await page.evaluate(()=>deliveries),['00000000-0000-4000-8000-000000000006']);
 if(mode==='lost-final-status'){assert.equal(await page.evaluate(()=>statusReads),2);assert.equal(await page.evaluate(()=>sends),0);}
 if(mode!=='conflict')assert.match(await page.locator('[aria-label="Resultado de venta"]').innerText(),/1,99/);else assert.match(await page.locator('[aria-label="Resultado de venta"]').innerText(),/No se enviará automáticamente/);assert.deepEqual(errors,[]);
 await page.close();
 }
 console.log('PASS: prepared payment persists offline, displays change and pending state, avoids sending or recharging');
}finally{await browser.close();await server.close();}
