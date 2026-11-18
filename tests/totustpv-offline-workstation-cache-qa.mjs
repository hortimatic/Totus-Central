import test from 'node:test';import assert from 'node:assert/strict';import {createOfflineWorkstationCache} from '../src/totustpv/offline-workstation-cache.js';import {createCentralTpvAdapter} from '../src/totustpv/central-adapter.js';
const storage=()=>{const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),values};};
const context={actorId:'owner',workstations:[{connectionId:'connection',connectionRevision:1,storeId:'store',shopId:1,drawerId:'drawer',storeName:'Tienda',drawerName:'Caja',canSell:true,canOpen:true,canReconcile:true,environment:'qa',session:{id:'session',status:'open',secret:'NEVER_SESSION'},nativeProfile:{counter_customer_id:1,counter_address_id:2,secret:'NEVER_PROFILE'},apiKey:'NEVER_KEY'}],token:'NEVER_TOKEN'};
test('workstation read cache projects no credentials, preserves original lease, isolates account and scope',()=>{
 const disk=storage();let instant=1000;const cache=createOfflineWorkstationCache({actorId:'owner',storage:disk,now:()=>instant});
 cache.put('context','',context);assert.doesNotMatch([...disk.values.values()].join(''),/NEVER/);
 instant=2000;assert.equal(cache.get('context','').readAt,1000);assert.equal(cache.get('context','').data.workstations[0].session.id,'session');
 assert.equal(createOfflineWorkstationCache({actorId:'other',storage:disk,now:()=>instant}).get('context',''),null);assert.equal(cache.get('context','other'),null);
 cache.revoke();assert.equal(cache.get('context',''),null);cache.put('context','',context);assert.ok(cache.get('context',''));
 instant=302000;assert.equal(cache.get('context',''),null);instant=999;assert.equal(cache.get('context',''),null);
 assert.throws(()=>cache.put('context','',{...context,actorId:'other'}));
});
test('new adapter recovers cached reads only for transport failure, never a server denial or a settings write',async()=>{
 const disk=storage();let offline=false,denied=false,writes=0;
 const invoke=async input=>{if(offline||denied){const error=Error(denied?'TPV_PERMISSION_DENIED':'TPV_CONNECTION_UNAVAILABLE');error.code=error.message;throw error;}
  if(input.action==='context')return context;
  if(input.action==='categories')return {has_more:false,categories:[{id:1,name:'Familia'}]};
  if(input.action==='payment-options'){if(input.settings)writes++;return {options:{enabledMethods:['cash'],labels:{cash:'Efectivo'},referencePolicy:{}}};}
  throw Error('Unexpected request');};
 const make=()=>createCentralTpvAdapter({actorId:'owner',storage:disk,invoke});
 const first=make();const live=await first.context();await first.selectSession(live.sessions[0]);await first.categories();await first.paymentOptions();
 offline=true;const restored=make(),cached=await restored.context();assert.equal(cached.drawers[0].canSell,true);await restored.selectSession(cached.sessions[0]);assert.equal((await restored.categories())[0].label,'Familia');assert.deepEqual((await restored.paymentOptions()).options.enabledMethods,['cash']);
 assert.equal(await restored.pendingSale(),null);
 await assert.rejects(restored.paymentOptions({enabledMethods:['card']}),/TPV_CONNECTION_UNAVAILABLE/);assert.equal(writes,0);
 denied=true;await assert.rejects(restored.context(),/TPV_PERMISSION_DENIED/);await assert.rejects(restored.categories(),/TPV_PERMISSION_DENIED/);
 denied=false;await assert.rejects(make().context(),/TPV_CONNECTION_UNAVAILABLE/,'A later outage cannot revive a cache invalidated by an explicit server denial');
});
test('a delayed context response cannot revive an offline snapshot after a concurrent access denial',async()=>{
 const disk=storage();let release,count=0,network=false;
 const invoke=async()=>{if(network){const error=Error('TPV_CONNECTION_UNAVAILABLE');error.code=error.message;throw error;}
  if(++count===1)return new Promise(resolve=>release=()=>resolve(context));
  const error=Error('TPV_PERMISSION_DENIED');error.code=error.message;throw error;};
 const adapter=createCentralTpvAdapter({actorId:'owner',storage:disk,invoke});
 const delayed=adapter.context();await Promise.resolve();await assert.rejects(adapter.context(),/TPV_PERMISSION_DENIED/);release();
 await assert.rejects(delayed,/acceso ha cambiado/);network=true;
 await assert.rejects(createCentralTpvAdapter({actorId:'owner',storage:disk,invoke}).context(),/TPV_CONNECTION_UNAVAILABLE/);
});
