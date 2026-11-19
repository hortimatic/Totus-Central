import test from 'node:test';import assert from 'node:assert/strict';import {createCentralTpvHandler} from '../supabase/functions/totus-tpv/handler.js';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),actor=id(1),drawer=id(2),session=id(3),connection='b554f6cc-4df1-412b-b063-e1cbd82d9e66';
function fixture({denied=false,badAuth=false}={}){
 const calls=[],row={connectionId:connection,connectionRevision:5,shopId:1,storeId:id(4),drawerId:drawer,environment:'qa',canReconcile:true,canSell:true,session:{id:session,status:'open'},nativeProfile:{verified:true,configured:true,native_version:'8.2.8',installation_id:id(5),shop_id:1,currency:'EUR'}};
 const factory=(url,key)=>({auth:{getUser:async()=>badAuth?{error:{message:'Denied'}}:{data:{user:{id:actor,user_metadata:{actorId:id(99)}}}}},rpc:async(name,args)=>{
  calls.push({name,args,key});if(name==='totus_tpv_context')return {data:{actorId:actor,workstations:[row]}};
  if(name==='totus_tpv_check')return denied?{error:{message:'TPV_SELL_FORBIDDEN'}}:{data:true};
  if(name==='totus_tpv_signature_journal'){assert.equal(key,'service-fixture');assert.equal(args.p_action,'get');return {data:null};}
  throw Error('Unexpected RPC '+name);
 }});
 const render=Object.assign(async()=>assert.fail('Read must not render'),{validateOriginal:async()=>assert.fail('Read must not parse native PDF')});
 const handle=createCentralTpvHandler({factory,signatureRenderer:render,env:{get:k=>({SUPABASE_URL:'https://fixture.invalid',SUPABASE_ANON_KEY:'public-fixture',SUPABASE_SERVICE_ROLE_KEY:'service-fixture'}[k])},request:()=>assert.fail('Signature archive read must not contact native shop')});
 return {calls,call:async changes=>{const response=await handle(new Request('https://fixture.invalid/tpv',{method:'POST',headers:{Authorization:'Bearer fixture-token','Content-Type':'application/json'},body:JSON.stringify({action:'signature-get',selection:{connectionId:connection,shopId:1,drawerId:drawer,sessionId:session},operationId:id(6),...changes})}));return {status:response.status,body:await response.json()};}};
}
test('signature archive read uses the actual actor and scoped journal without native credentials',async()=>{
 const f=fixture(),response=await f.call();assert.equal(response.status,200);assert.equal(response.body,null);
 const call=f.calls.find(x=>x.name==='totus_tpv_signature_journal');assert.equal(call.args.p_scope.actorId,actor);assert.equal(call.args.p_scope.drawerId,drawer);assert.equal(call.args.p_scope.sessionId,undefined);assert.equal(f.calls.some(x=>x.name==='totus_api_server'),false);
});
test('forged fields, revoked rights, foreign drawer and absent consent do not reach signature storage',async()=>{
 for(const [options,changes] of [[{badAuth:true},{}],[{denied:true},{}],[{}, {actorId:id(99)}],[{}, {selection:{connectionId:connection,shopId:1,drawerId:id(99),sessionId:session}}],[{}, {action:'signature-sign',originalSha256:'0'.repeat(64),ink:{width:1000,height:400,strokes:[[[20,40],[100,80]]]},accepted:false}]]){
  const f=fixture(options),reply=await f.call(changes);assert.notEqual(reply.status,200,JSON.stringify(reply));assert.equal(f.calls.some(x=>x.name==='totus_tpv_signature_journal'),false);assert.equal(f.calls.some(x=>x.name==='totus_api_server'),false);
 }
});
