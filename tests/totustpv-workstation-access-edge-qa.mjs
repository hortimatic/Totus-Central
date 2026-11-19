import test from 'node:test';
import assert from 'node:assert/strict';
import {createCentralTpvHandler} from '../supabase/functions/totus-tpv/handler.js';
const actor='00000000-0000-4000-8000-000000000001',operator='00000000-0000-4000-8000-000000000002',
 drawer='00000000-0000-4000-8000-000000000003',requestId='00000000-0000-4000-8000-000000000004',
 connection='b554f6cc-4df1-412b-b063-e1cbd82d9e66';
function fixture({denied=false,badAuth=false,revision=7}={}){
 const calls=[];const factory=(url,key)=>{calls.push({factory:key});return {
  auth:{getUser:async()=>badAuth?{error:{message:'Denied'}}:{data:{user:{id:actor,user_metadata:{actorId:operator}}}}},
  rpc:async(name,args)=>{calls.push({name,args,key});
   if(name==='totus_api_manager')return denied?{error:{message:'TPV_CONFIGURATION_FORBIDDEN'}}:{data:{connections:[{id:connection,revision}]}};
   if(name==='totus_tpv_workstation_access_batch')return {data:args.p_data?{id:args.p_request_id,connectionId:connection,confirmed:true,group:args.p_data.group,items:[]}:null};
   if(name==='totus_tpv_workstation_access')return {data:{connectionId:connection,revision,items:[]}};
   if(name==='totus_tpv_update_workstation_access')return {data:{...args.p_data,revision:args.p_data.expectedRevision+1}};
   throw Error('Unexpected RPC '+name);
  }};};
 const handle=createCentralTpvHandler({factory,env:{get:key=>({SUPABASE_URL:'https://fixture.invalid',SUPABASE_ANON_KEY:'public-fixture',SUPABASE_SERVICE_ROLE_KEY:'privileged-fixture'}[key])},
  request:()=>{throw Error('Access administration must not contact a shop');}});
 return {calls,call:async body=>{const response=await handle(new Request('https://central.invalid/tpv',{method:'POST',
  headers:{Authorization:'Bearer ordinary-user-token','Content-Type':'application/json'},body:JSON.stringify(body)}));return {status:response.status,body:await response.json()};}};
}
const read={action:'workstations',connectionId:connection,revision:7};
const update={action:'update-workstation-access',selection:{connectionId:connection,shopId:1,drawerId:drawer},
 operationId:requestId,operatorId:operator,revision:7,assignmentRevision:3,permissions:{sell:false,open:true,reconcile:true},active:true};
test('manager read checks the actual session and manager scope before using a privileged client',async()=>{
 for(const options of [{badAuth:true},{denied:true},{revision:8}]){const f=fixture(options);assert.notEqual((await f.call(read)).status,200);
  assert.equal(f.calls.some(call=>call.factory==='privileged-fixture'),false);}
 const f=fixture();assert.equal((await f.call(read)).status,200);
 assert.deepEqual(f.calls.find(call=>call.name==='totus_tpv_workstation_access').args,{p_actor:actor,p_connection:connection,p_revision:7});
 assert.equal(f.calls.some(call=>call.name==='totus_api_server'),false,'No credential is loaded to edit Central access');
});
test('an access update binds the manager to the verified user and preserves the request and expected revision',async()=>{
 const f=fixture(),response=await f.call(update);assert.equal(response.status,200);
 const call=f.calls.find(call=>call.name==='totus_tpv_update_workstation_access');assert.equal(call.key,'privileged-fixture');
 assert.deepEqual(call.args,{p_actor:actor,p_connection:connection,p_revision:7,p_request_id:requestId,
  p_data:{operatorId:operator,drawerId:drawer,shopId:1,expectedRevision:3,permissions:update.permissions,active:true}});
});
test('forged identity, foreign targets and malformed permissions fail before privileged access',async()=>{
 for(const body of [{...read,actorId:operator},{...update,actorId:operator},{...update,active:'true'},
  {...update,selection:{...update.selection,sessionId:requestId}}, {...update,assignmentRevision:0},
  {...update,permissions:{...update.permissions,reconcile:false}}, {...update,permissions:{sell:true,open:'true',reconcile:true}},
  {...update,permissions:{...update.permissions,admin:true}},{...update,selection:{...update.selection,connectionId:operator}}]){
  const f=fixture();assert.equal((await f.call(body)).status,400);assert.equal(f.calls.some(call=>call.factory==='privileged-fixture'),false);
 }
});


test('grouped access uses only verified manager scope and no shop credentials, including recovery',async()=>{
 const payload={action:'access-batch-save',selection:{connectionId:connection},revision:7,operationId:requestId,group:{kind:'store',id:drawer},targets:[{operatorId:operator,drawerId:drawer,shopId:1,assignmentRevision:3}],permissions:update.permissions,active:true};
 const f=fixture();assert.equal((await f.call(payload)).status,200);const saved=f.calls.find(c=>c.name==='totus_tpv_workstation_access_batch');assert.equal(saved.args.p_actor,actor);assert.deepEqual(saved.args.p_data,{group:payload.group,targets:payload.targets,permissions:payload.permissions,active:true});assert.equal(f.calls.some(c=>c.name==='totus_api_server'),false);
 const lookup={action:'access-batch-get',selection:{connectionId:connection},revision:7,operationId:requestId};assert.deepEqual((await f.call(lookup)).body,null);assert.equal(f.calls.filter(c=>c.name==='totus_tpv_workstation_access_batch').at(-1).args.p_data,null);
 for(const options of [{denied:true},{badAuth:true},{revision:8}]){const x=fixture(options);assert.notEqual((await x.call(lookup)).status,200);assert.equal(x.calls.some(c=>c.factory==='privileged-fixture'),false);}
 for(const patch of [{actorId:operator},{group:{kind:'all',id:drawer}},{targets:[]},{targets:Array(101).fill(payload.targets[0])},{targets:[payload.targets[0],payload.targets[0]]},{targets:[{...payload.targets[0],assignmentRevision:0}]},{selection:{connectionId:connection,shopId:1}},{permissions:{...payload.permissions,admin:true}},{active:'true'}]){const x=fixture();assert.equal((await x.call({...payload,...patch})).status,400);assert.equal(x.calls.some(c=>c.factory==='privileged-fixture'),false);}
});
