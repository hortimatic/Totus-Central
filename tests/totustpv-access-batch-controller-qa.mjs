import test from 'node:test';
import assert from 'node:assert/strict';
import {accessBatchRequest,createAccessBatchPanel} from '../src/totustpv/workstation-access-batch.js';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const actor=id(1),connection=id(2),drawer=id(3),operator=id(4),store=id(5),operation=id(6);
const row={operatorId:operator,drawerId:drawer,shopId:1,revision:3,storeId:store,storeName:'Tienda',operatorName:'Empleado',drawerName:'Caja',active:true};
const config={connectionId:connection,revision:7,accesses:[row]};
const request={action:'access-batch-save',operationId:operation,selection:{connectionId:connection},revision:7,group:{kind:'store',id:store},targets:[{operatorId:operator,drawerId:drawer,shopId:1,assignmentRevision:3}],permissions:{sell:true,open:false,reconcile:true},active:true};
const receipt={id:operation,connectionId:connection,confirmed:true,group:request.group,items:[{...row,revision:4,permissions:request.permissions}]};
const NativeFormData=globalThis.FormData;
globalThis.FormData=class extends NativeFormData{constructor(entries){super();for(const [k,v] of entries||[])this.append(k,v);}};
const form=[['role','sell'],['active','on'],['target',[operator,drawer,1].join(':')]];
function fixture({invoke=async()=>receipt,storage,identity=()=>actor,allowed=()=>true}={}){const values=new Map();const disk=storage||{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};const calls=[];return {values,disk,calls,panel:createAccessBatchPanel({actor:identity,canManage:allowed,invoke:async r=>{calls.push(r);return invoke(r);},storage:disk,makeId:()=>operation})};}
test('request rejects extra fields at each boundary and returns an independent copy',()=>{
 assert.deepEqual(accessBatchRequest(request),request);const clone=accessBatchRequest(request);clone.targets[0].shopId=2;assert.equal(request.targets[0].shopId,1);
 for(const change of [r=>r.extra=true,r=>r.selection.extra=true,r=>r.group.extra=true,r=>r.targets[0].extra=true,r=>r.permissions.extra=true,r=>r.targets.push({...r.targets[0]}),r=>r.targets=[],r=>r.active='true']){const r=structuredClone(request);change(r);assert.throws(()=>accessBatchRequest(r));}
});
test('review is read-only; confirmed save persists before sending and removes receipt pointer',async()=>{
 const f=fixture();f.panel.open(config);assert.equal(f.panel.hasDraft(),false);f.panel.filter({name:'batch-group',value:store});assert.equal(f.panel.hasDraft(),false);f.panel.review(form);assert.equal(f.calls.length,0);assert.equal(f.values.size,0);assert.equal(f.panel.hasDraft(),true);await f.panel.save();assert.deepEqual(f.calls,[request]);assert.equal(f.values.size,0);assert.equal(f.panel.hasDraft(),false);
});
test('lost reply survives recreation; recovery reads the same operation without resending',async()=>{
 const f=fixture({invoke:async()=>{throw Error('lost reply');}});f.panel.open(config);f.panel.review(form);await assert.rejects(f.panel.save(),/lost reply/);assert.equal(f.panel.hasPending(),true);assert.equal(f.values.size,1);assert.throws(()=>f.panel.close());
 const recovered=fixture({storage:f.disk});recovered.panel.open(config);await recovered.panel.recover();assert.equal(recovered.calls.length,1);assert.equal(recovered.calls[0].action,'access-batch-get');assert.equal(recovered.calls[0].operationId,operation);assert.equal(f.values.size,0);
});
test('verified absent receipt retries the frozen operation only once with unchanged versions',async()=>{
 const f=fixture({invoke:async()=>{throw Error('lost reply');}});f.panel.open(config);f.panel.review(form);await assert.rejects(f.panel.save());
 const r=fixture({storage:f.disk,invoke:async r=>r.action==='access-batch-get'?null:receipt});r.panel.open(config);await r.panel.recover();assert.deepEqual(r.calls[1],request);assert.equal(r.calls.length,2);
});
test('blocked browser storage prevents dispatch and leaves review available',async()=>{
 const f=fixture({storage:{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}}});f.panel.open(config);f.panel.review(form);await assert.rejects(f.panel.save(),/almacenamiento/);assert.equal(f.calls.length,0);assert.equal(f.panel.hasPending(),false);assert.equal(f.panel.hasDraft(),true);
});
test('changed identity or permission cannot dispatch a reviewed request',async()=>{
 for(const field of ['identity','permission']){let current=actor,allowed=true;const f=fixture({identity:()=>current,allowed:()=>allowed});f.panel.open(config);f.panel.review(form);if(field==='identity')current=id(9);else allowed=false;await assert.rejects(f.panel.save());assert.equal(f.calls.length,0);}
});
test('malformed confirmation retains evidence; stale snapshot releases only after verified absence',async()=>{
 const f=fixture({invoke:async()=>({...receipt,items:[]})});f.panel.open(config);f.panel.review(form);await assert.rejects(f.panel.save(),/comprobar/);assert.equal(f.values.size,1);
 const r=fixture({storage:f.disk,invoke:async()=>null});r.panel.open({...config,revision:8});await assert.rejects(r.panel.recover(),/cambiado/);assert.equal(r.calls.length,1);assert.equal(r.panel.hasPending(),false);assert.equal(f.values.size,0);
});

test('a delayed result cannot confirm a request after account change or panel reset',async()=>{
 for(const mode of ['actor','reset']){let current=actor,resolve;const f=fixture({identity:()=>current,invoke:()=>new Promise(r=>resolve=r)});f.panel.open(config);f.panel.review(form);const pending=f.panel.save();if(mode==='actor')current=id(99);else f.panel.reset();resolve(receipt);await assert.rejects(pending,/cuenta/);assert.equal(f.values.size,1);assert.equal(f.calls.length,1);}
});
