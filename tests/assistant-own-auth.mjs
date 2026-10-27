import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const original=readFileSync(new URL('../supabase/functions/totus-assistant/index.ts',import.meta.url),'utf8');
const source=original.replace(/import \{ createClient \} from '[^']+'/,"const createClient=()=>{throw new Error('No live client in tests')}");
const {handle}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64'));
const job='11111111-1111-4111-8111-111111111111',ticket='a'.repeat(64);
const env={get:k=>({SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_ROLE_KEY:'server-test',SUPABASE_ANON_KEY:'public-test'})[k]};
function setup(action='session_check',overrides={}){
 const calls=[],results=[];const account={id:'own-assistant-id',email:'chatgpt@totuscentral.invalid',app_metadata:{totus_assistant:true}};
 const work={action,payload:{expense:{request_id:job,fiscal_reviewed:false},lines:[{description:'fictional'}]},credentials:{email:account.email,password:'x'.repeat(96)}};
 function chain(table){
  let operation='';
  const x={select(){return x},eq(){return x},upsert(payload){calls.push(['upsert',table,payload]);return Promise.resolve({error:null})},
   update(){operation='update';return x},insert(payload){calls.push(['insert',table,payload]);return Promise.resolve({error:null})},
   single(){return Promise.resolve({data:{id:'saved-id',created_by:account.id},error:null})},
   maybeSingle(){return Promise.resolve({data:{active:!overrides.inactive},error:null})},
   order(){return Promise.resolve({data:[{expense_id:'saved-id'}],error:null})},
   then(resolve){resolve({data:null,error:null})}};
  return x;
 }
 const admin={from:chain,rpc:async(name,args)=>{
  calls.push(['admin_rpc',name]);
  if(name==='totus_assistant_claim')return overrides.badTicket?{error:{message:'denied'}}:{data:work};
  results.push(args);return {error:null};
 },auth:{admin:{listUsers:async()=>({data:{users:[]}}),createUser:async(args)=>{calls.push(['createUser',args]);return {data:{user:account}}}}}};
 const scoped={from:chain,rpc:async(name,args)=>{calls.push(['user_rpc',name,args]);return overrides.saveError?{error:{message:'validación rechazada'}}:{data:name==='totus_assistant_validate_expense'?{validated:true}:'saved-id'}},
 auth:{signInWithPassword:async(args)=>{calls.push(['login',args.email]);return overrides.loginFail?{error:{message:'login failed'}}:{data:{session:{access_token:'fictitious'},user:account}}},
 getUser:async()=>({data:{user:account}}),signOut:async()=>{calls.push(['logout']);return {}}}};
 return {calls,results,work,factory:(url,key)=>key==='server-test'?admin:scoped,run:()=>handle(new Request('https://example.invalid',{method:'POST',body:JSON.stringify({job,ticket})}),env,(url,key)=>key==='server-test'?admin:scoped)};
}
test('single-use ticket rejection never logs in',async()=>{const q=setup('session_check',{badTicket:true});assert.equal((await q.run()).status,401);assert(!q.calls.some(x=>x[0]==='login'))});
test('setup creates a real account with explicit deny permissions and verified login',async()=>{const q=setup('setup');assert.equal((await q.run()).status,200);assert(q.calls.some(x=>x[0]==='createUser'));const permissions=q.calls.find(x=>x[0]==='upsert'&&x[1]==='ops_user_permissions')[2];assert.equal(permissions.length,11);assert(permissions.every(x=>!x.can_delete&&!x.can_export));assert.equal(permissions.find(x=>x.module==='administracion').can_view,false);assert.equal(q.results[0].p_result.user_id,'own-assistant-id')});
test('save uses authenticated user client, not service-role writes',async()=>{const q=setup('save_expense');assert.equal((await q.run()).status,200);assert(q.calls.some(x=>x[0]==='user_rpc'&&x[1]==='totus_save_expense'));assert(!q.calls.some(x=>x[0]==='admin_rpc'&&x[1]==='totus_save_expense'));assert.equal(q.results[0].p_result.expense.created_by,'own-assistant-id');assert(q.calls.some(x=>x[0]==='logout'))});
test('cannot auto-accept fiscal review or bypass validation',async()=>{const q=setup('save_expense');q.work.payload.expense.fiscal_reviewed=true;assert.equal((await q.run()).status,400);assert(!q.calls.some(x=>x[0]==='user_rpc'));assert.match(q.results[0].p_error,/pendiente de revisión/)});
test('validation errors remain failed, never success',async()=>{const q=setup('save_expense',{saveError:true});assert.equal((await q.run()).status,400);assert.equal(q.results[0].p_error,'validación rechazada')});
test('simulation calls reversible validation, not save',async()=>{const q=setup('validate_expense');assert.equal((await q.run()).status,200);assert(q.calls.some(x=>x[0]==='user_rpc'&&x[1]==='totus_assistant_validate_expense'));assert.equal(q.results[0].p_result.persisted,false)});
test('inactive account cannot save',async()=>{const q=setup('save_expense',{inactive:true});assert.equal((await q.run()).status,400);assert(!q.calls.some(x=>x[0]==='user_rpc'))});
test('wrong ticket shape rejected before privileged client construction',async()=>{const response=await handle(new Request('https://example.invalid',{method:'POST',body:'{}'}),env,()=>{throw new Error('must not construct')});assert.equal(response.status,401)});
