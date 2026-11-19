import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');
 await page.evaluate(async()=>{
  fixture.workspace.dispose();
  const {createOfflinePanel,offlineDevice}=await import('/src/totustpv/offline-panel.js');
  const {createOfflineJournal}=await import('/src/totustpv/offline-journal.js');
  const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
  const scope={actorId:id(1),connectionId:id(2),storeId:id(3),shopId:1,drawerId:id(4),cashSessionId:id(6)};
  const journal=createOfflineJournal({scope:{...scope,deviceId:offlineDevice()}});
  const ticket={cashSessionId:id(6),lines:[{productId:1,qty:1}],payments:[{method:'cash',amountCents:801}],totalCents:801,currency:'EUR'};
  await journal.capture({id:id(10),ticket});await journal.capture({id:id(11),ticket:{...ticket,cashSessionId:id(7)}});
  const pending=await journal.capture({id:id(90),ticket}),claimed=await journal.claim(id(90),pending.revision);await journal.settle(id(90),claimed.record.revision,{status:'conflict',remoteOperationId:id(90)});
  const calls=[];let active=true;const panel=createOfflinePanel({getScope:()=>scope,isCurrent:()=>active,getAdapter:()=>({offlineDelivery:()=>({dispatch:async({operationId})=>{calls.push(operationId);return {operationId,status:'confirmed',verified:true};},recover:async({operationId})=>{calls.push('recover:'+operationId);return {operationId,status:'confirmed',verified:true};}})})});
  await panel.open();const root=document.querySelector('#tpv');root.innerHTML=panel.html();root.addEventListener('click',async event=>{if(event.target.dataset.tpvAction==='offline-sync'){await panel.synchronize();root.innerHTML=panel.html();}if(event.target.dataset.tpvAction==='offline-recheck'){await panel.recheck(event.target.dataset.tpvOfflineId);root.innerHTML=panel.html();}});
  window.panelFixture={panel,journal,calls,id,scope,deactivate:()=>{active=false;}};
 });
 assert.match(await page.locator('#tpv').innerText(),/Pendiente de sincronizar/);
 assert.match(await page.locator('#tpv').innerText(),/Otra sesión de caja/);
 await page.context().setOffline(true);
 const offline=await page.evaluate(async()=>{try{await panelFixture.panel.synchronize();return null;}catch(error){return {message:error.message,calls:panelFixture.calls.length,status:(await panelFixture.journal.get(panelFixture.id(10))).status};}});
 assert.deepEqual(offline,{message:'Las ventas siguen guardadas. Conecta para sincronizarlas.',calls:0,status:'queued'});
 await page.context().setOffline(false);
 await page.getByRole('button',{name:'Sincronizar ahora'}).click();
 await page.waitForFunction(()=>document.querySelector('#tpv').textContent.includes('Sincronizado'));
 assert.deepEqual(await page.evaluate(async()=>({calls:panelFixture.calls,other:(await panelFixture.journal.get(panelFixture.id(11))).status})),{calls:['00000000-0000-4000-8000-000000000010'],other:'queued'});
 await page.getByRole('button',{name:'Comprobar de nuevo',exact:true}).click();
 await page.waitForFunction(()=>panelFixture.calls.length===2);
 assert.deepEqual(await page.evaluate(()=>panelFixture.calls),['00000000-0000-4000-8000-000000000010','recover:00000000-0000-4000-8000-000000000090']);
 assert.equal(await page.evaluate(async()=> (await panelFixture.journal.get(panelFixture.id(90))).status),'synced');
 const newlySaved=await page.evaluate(async()=>{
  const {journal,panel,id,scope}=panelFixture;
  await journal.capture({id:id(91),ticket:{cashSessionId:scope.cashSessionId,lines:[{productId:2,qty:1}],payments:[{method:'cash',amountCents:200}],totalCents:200,currency:'EUR'}});
  await Promise.all([panel.synchronize(),panel.synchronize()]);
  return {status:(await journal.get(id(91))).status,sends:panelFixture.calls.filter(value=>value===id(91)).length,other:(await journal.get(id(11))).status};
 });
 assert.deepEqual(newlySaved,{status:'synced',sends:1,other:'queued'});
 const denied=await page.evaluate(async()=>{panelFixture.deactivate();try{await panelFixture.panel.synchronize();return false;}catch{return true;}});assert.equal(denied,true);
 await page.evaluate(async()=>{
  const {createTpvWorkspace}=await import('/src/totustpv/workspace.js');
  const {scope}=panelFixture,session={id:scope.cashSessionId,status:'open',storeId:scope.storeId,drawerId:scope.drawerId};
  const adapter={mode:'qa',context:async()=>({stores:[{id:scope.storeId,name:'Tienda local'}],drawers:[{id:scope.drawerId,storeId:scope.storeId,name:'Caja local',connectionId:scope.connectionId,shopId:scope.shopId,canSell:true,canOpen:true,canReconcile:true}],sessions:[session]}),selectSession:async()=>session,searchProducts:async()=>[],prepareOfflineCatalogue:async({onProgress})=>{onProgress({products:2,completedProducts:1});await new Promise(resolve=>{window.finishPreparation=resolve;});return {products:2,completedProducts:2,validUntil:Date.now()+60000};},offlineDelivery:()=>({dispatch:async()=>{throw Error('Unexpected submission');},recover:async()=>{throw Error('Unexpected recovery');}})};
  window.integratedWorkspace=createTpvWorkspace({actor:()=>({id:scope.actorId,active:true,full_name:'Operador local'}),can:()=>true,createLiveAdapter:()=>adapter,autoOpen:true});
  integratedWorkspace.mount(document.querySelector('#tpv'));
 });
 await page.getByText('Guardando catálogo · 1 de 2 productos',{exact:true}).waitFor();
 const focused=page.locator('[data-tpv-search]');await focused.focus();
 await page.evaluate(()=>finishPreparation());
 await page.getByText('Catálogo guardado actualizado',{exact:true}).waitFor();
 assert.equal(await focused.evaluate(el=>document.activeElement===el),true);
 await page.getByText('Más acciones',{exact:true}).click();
 await page.getByRole('button',{name:'Ventas pendientes de sincronizar'}).click();
 await page.getByRole('heading',{name:'Ventas guardadas en este dispositivo'}).waitFor();
 assert.match(await page.locator('#tpv').innerText(),/Sincronizado/);
 assert.match(await page.locator('#tpv').innerText(),/Otra sesión de caja/);
 await page.getByRole('button',{name:'Sincronizar ahora'}).click();
 await page.getByRole('button',{name:'Venta',exact:true}).click();
 await page.getByRole('heading',{name:'Ventas guardadas en este dispositivo'}).waitFor({state:'hidden'});
 await page.evaluate(async()=>{
  integratedWorkspace.dispose();const {createTpvWorkspace}=await import('/src/totustpv/workspace.js');
  const {scope,journal,id}=panelFixture,operationId=id(12),session={id:scope.cashSessionId,status:'open',storeId:scope.storeId,drawerId:scope.drawerId};
  const ticket={cashSessionId:session.id,lines:[{productId:1,qty:1}],payments:[{method:'cash',amountCents:801}],totalCents:801,currency:'EUR'};
  await journal.capture({id:operationId,ticket});const claimed=await journal.claim(operationId,1);await journal.settle(operationId,claimed.record.revision,{status:'uncertain',remoteOperationId:operationId});
  const calls=[];const adapter={mode:'qa',context:async()=>({stores:[{id:scope.storeId,name:'Tienda local'}],drawers:[{id:scope.drawerId,storeId:scope.storeId,name:'Caja local',connectionId:scope.connectionId,shopId:scope.shopId,canSell:true,canOpen:true,canReconcile:true}],sessions:[session]}),selectSession:async()=>session,searchProducts:async()=>[],pendingSale:async()=>operationId,
   offlineDelivery:()=>({dispatch:async()=>{throw Error('Must not resend');},recover:async()=>{calls.push('offline-recover');return {operationId,status:'confirmed',verified:true};}}),
   recover:async()=>{calls.push('normal-status');if((await journal.get(operationId)).status!=='synced')throw Error('Local state not reconciled');return {id:operationId,status:'confirmed',reference:'Pedido #42',totalCents:801};}};
  window.recoveryCalls=calls;window.integratedWorkspace=createTpvWorkspace({actor:()=>({id:scope.actorId,active:true,full_name:'Operador local'}),can:()=>true,createLiveAdapter:()=>adapter,autoOpen:true});integratedWorkspace.mount(document.querySelector('#tpv'));
 });
 await page.getByText('Pedido verificado en PrestaShop',{exact:true}).waitFor();
 assert.deepEqual(await page.evaluate(()=>recoveryCalls),['offline-recover','normal-status']);
 await page.evaluate(async()=>{
  integratedWorkspace.dispose();const {createTpvWorkspace}=await import('/src/totustpv/workspace.js');
  const {scope,journal,id}=panelFixture,operationId=id(13),session={id:scope.cashSessionId,status:'open',storeId:scope.storeId,drawerId:scope.drawerId};
  await journal.capture({id:operationId,ticket:{cashSessionId:session.id,lines:[{productId:1,qty:1}],payments:[{method:'cash',amountCents:801}],totalCents:801,currency:'EUR'}});
  const gate=new Promise(resolve=>{window.releaseAutomaticSync=resolve;});window.automaticCalls=[];
  const adapter={mode:'qa',context:async()=>({stores:[{id:scope.storeId,name:'Tienda local'}],drawers:[{id:scope.drawerId,storeId:scope.storeId,name:'Caja local',connectionId:scope.connectionId,shopId:scope.shopId,canSell:true,canOpen:true,canReconcile:true}],sessions:[session]}),selectSession:async()=>session,searchProducts:async()=>[],
   offlineDelivery:()=>({dispatch:async({operationId})=>{automaticCalls.push(operationId);await gate;return {operationId,status:'confirmed',verified:true};},recover:async()=>{throw Error('Unexpected recovery');}})};
  window.integratedWorkspace=createTpvWorkspace({actor:()=>({id:scope.actorId,active:true,full_name:'Operador local'}),can:()=>true,createLiveAdapter:()=>adapter,autoOpen:true});integratedWorkspace.mount(document.querySelector('#tpv'));
 });
 await page.getByRole('button',{name:'Venta',exact:true}).waitFor();
 await page.context().setOffline(true);await page.context().setOffline(false);
 await page.waitForFunction(()=>automaticCalls.length===1);
 await page.evaluate(()=>{window.dispatchEvent(new Event('online'));window.dispatchEvent(new Event('online'));releaseAutomaticSync();});
 await page.waitForFunction(()=>document.querySelector('#tpv').textContent.includes('Venta guardada sincronizada.')&&!document.querySelector('[data-tpv-action="sale"]').disabled);
 assert.equal(await page.evaluate(async()=>(await panelFixture.journal.get(panelFixture.id(13))).status),'synced');
 await page.getByText('Más acciones',{exact:true}).click();await page.getByRole('button',{name:'Ventas pendientes de sincronizar'}).click();
 await page.getByRole('button',{name:'Sincronizar ahora'}).click();
 assert.deepEqual(await page.evaluate(()=>automaticCalls),['00000000-0000-4000-8000-000000000013']);
 assert.equal(await page.evaluate(async()=>(await panelFixture.journal.get(panelFixture.id(11))).status),'queued');
 await page.evaluate(async()=>{
  integratedWorkspace.dispose();const {createTpvWorkspace}=await import('/src/totustpv/workspace.js');
  const {scope,journal,id}=panelFixture,operationId=id(14),session={id:scope.cashSessionId,status:'open',storeId:scope.storeId,drawerId:scope.drawerId};
  await journal.capture({id:operationId,ticket:{cashSessionId:session.id,lines:[{productId:1,qty:1}],payments:[{method:'cash',amountCents:801}],totalCents:801,currency:'EUR'}});
  window.retryCalls=[];window.retryCallbacks=[];const original=window.setTimeout;window.restoreTimer=()=>{window.setTimeout=original;};
  window.setTimeout=(callback,delay,...args)=>{if(delay===30000){retryCallbacks.push(callback);return original(()=>{},3600000);}return original(callback,delay,...args);};
  const adapter={mode:'qa',context:async()=>({stores:[{id:scope.storeId,name:'Tienda local'}],drawers:[{id:scope.drawerId,storeId:scope.storeId,name:'Caja local',connectionId:scope.connectionId,shopId:scope.shopId,canSell:true,canOpen:true,canReconcile:true}],sessions:[session]}),selectSession:async()=>session,searchProducts:async()=>[],
   offlineDelivery:()=>({dispatch:async({operationId})=>{retryCalls.push(['send',operationId]);throw Error('Server unavailable while browser online');},recover:async({operationId})=>{retryCalls.push(['recover',operationId]);return {operationId,status:'confirmed',verified:true};}})};
  window.integratedWorkspace=createTpvWorkspace({actor:()=>({id:scope.actorId,active:true,full_name:'Operador local'}),can:()=>true,createLiveAdapter:()=>adapter,autoOpen:true});integratedWorkspace.mount(document.querySelector('#tpv'));
 });
 await page.waitForFunction(()=>retryCallbacks.length===1&&!document.querySelector('[data-tpv-action="sale"]').disabled);
 assert.equal(await page.evaluate(()=>navigator.onLine),true);
 assert.equal(await page.evaluate(async()=>(await panelFixture.journal.get(panelFixture.id(14))).status),'uncertain');
 await page.evaluate(()=>retryCallbacks.shift()());
 await page.waitForFunction(()=>retryCalls.length===2&&document.querySelector('#tpv').textContent.includes('Venta guardada sincronizada.'));
 assert.equal(await page.evaluate(async()=>(await panelFixture.journal.get(panelFixture.id(14))).status),'synced');
 assert.deepEqual(await page.evaluate(()=>retryCalls),[['send','00000000-0000-4000-8000-000000000014'],['recover','00000000-0000-4000-8000-000000000014']]);
 await page.evaluate(()=>{integratedWorkspace.dispose();restoreTimer();});
 console.log('PASS offline panel in Chromium: real IndexedDB, rendered states, manual sync, foreign cash-session remains queued, changed identity blocks delivery. Native transport mocked; offline capture not covered.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
