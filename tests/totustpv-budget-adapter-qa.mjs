import test from 'node:test';
import assert from 'node:assert/strict';
import {createCentralTpvAdapter} from '../src/totustpv/central-adapter.js';
const station={environment:'qa',connectionId:'connection',shopId:1,storeId:'store',drawerId:'drawer',canSell:true,canOpen:true,canReconcile:true};
test('lost budget save recovers the original intent after reload without an open cash session',async()=>{
 const storageMap=new Map(),requests=[];let lost=true;
 const storage={getItem:key=>storageMap.get(key)||null,setItem:(key,value)=>storageMap.set(key,value)};
 const make=()=>createCentralTpvAdapter({actorId:'operator',storage,invoke:async body=>{
  if(body.action==='context')return {actorId:'operator',workstations:[station]};
  assert.equal(body.action,'budget-create');assert.equal(body.selection.sessionId,undefined);requests.push(structuredClone(body));
  if(lost){lost=false;throw Error('Lost reply');}return {id:body.operationId,status:'saved',reference:'P-000001'};
 }});
 const first=make();await first.context();await first.selectWorkstation({storeId:'store',drawerId:'drawer'});
 const ticket={lines:[{productId:'101:7',qty:2}],title:'Oferta',publicNote:'Preparar para recogida',validDays:15};
 await assert.rejects(first.saveBudget(ticket),/Lost reply/);assert.equal(first.pendingBudget(),true);
 const second=make();await second.context();await second.selectWorkstation({storeId:'store',drawerId:'drawer'});
 assert.equal(second.pendingBudget(),true);assert.equal((await second.recoverBudgetPreparation()).reference,'P-000001');
 assert.deepEqual(requests[1],requests[0]);assert.equal(second.pendingBudget(),false);assert.equal(await second.recoverBudgetPreparation(),null);
 assert.equal(JSON.stringify([...storageMap.values()]).includes(ticket.publicNote),false,'Resolved intent is removed from local request storage');
});
test('a pending budget refuses changed content and can only be recovered by its account and workstation',async()=>{
 const storageMap=new Map(),storage={getItem:key=>storageMap.get(key)||null,setItem:(key,value)=>storageMap.set(key,value)};let writes=0;
 const make=actorId=>createCentralTpvAdapter({actorId,storage,invoke:async body=>{
  if(body.action==='context')return {actorId,workstations:[station,{...station,drawerId:'other'}]};writes++;throw Error('Unavailable');
 }});
 const a=make('operator');await a.context();await a.selectWorkstation({storeId:'store',drawerId:'drawer'});
 const ticket={lines:[{productId:'101:0',qty:1}],title:'Original'};await assert.rejects(a.saveBudget(ticket),/Unavailable/);
 await assert.rejects(a.saveBudget({...ticket,title:'Changed'}),/solicitud pendiente/);assert.equal(writes,1);
 await a.selectWorkstation({storeId:'store',drawerId:'other'});assert.equal(a.pendingBudget(),false);assert.equal(await a.recoverBudgetPreparation(),null);
 const b=make('another-operator');await b.context();await b.selectWorkstation({storeId:'store',drawerId:'drawer'});assert.equal(b.pendingBudget(),false);assert.equal(await b.recoverBudgetPreparation(),null);assert.equal(writes,1);
});
