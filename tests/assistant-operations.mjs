import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const source=readFileSync(new URL('../supabase/functions/totus-assistant/assistant-operations.ts',import.meta.url),'utf8').replace('../../../src/agent-identity.js',new URL('../src/agent-identity.js',import.meta.url).href);
const {runOperation:executeOperation,operationCatalogue}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64'));
const runOperation=(client,payload,user)=>executeOperation(client,payload,{id:'verified-fixture-user',app_metadata:{totus_agent:true},...user});
const request='11111111-1111-4111-8111-111111111111';
function mock(error=null){const calls=[];return {calls,client:{rpc:async(name,args)=>{calls.push({name,args});return error?{error}:{data:name==='totus_business_write_contract'?{request_replay:1}:request}},from(table){calls.push({table});const q={select(){return q},eq(){return q},gte(){return q},lte(){return q},order(){return q},range:async(a,b)=>({data:[{id:request}],error})};return q}}};}
for(const email of ['chatgpt@totuscentral.invalid','codex@totuscentral.invalid','custom-cloud@example.invalid','custom-router@example.invalid']){
 test(email+' saves a closing through the normal replay-protected RPC',async()=>{const m=mock();const r=await runOperation(m.client,{operation:'rpc',name:'totus_save_closing',args:{p_closing:{request_id:request},p_drawers:[]}}, {email});assert.equal(r.executed,true);assert.deepEqual(m.calls.map(x=>x.name),['totus_business_write_contract','totus_save_closing']);});
 test(email+' uses its own identity for reception results',async()=>{const m=mock();await runOperation(m.client,{operation:'rpc',name:'totus_stock_save_result',args:{p_id:request,p_revision:1,p_result:{rows:[]}}},{email});assert.equal(m.calls[0].args.p_actor_email,email);});
}
test('rejects arbitrary SQL, secret RPCs, privileged cloud registration and impersonation',async()=>{for(const name of ['execute_sql','totus_onedrive_secret','totus_assistant_claim','totus_stock_register_cloud_document','constructor']){const m=mock();await assert.rejects(()=>runOperation(m.client,{operation:'rpc',name,args:{}},{email:'codex@totuscentral.invalid'}));assert.equal(m.calls.length,0);}const m=mock();await assert.rejects(()=>runOperation(m.client,{operation:'rpc',name:'totus_stock_context',args:{p_id:request,p_actor_email:'someone@example.invalid'}},{email:'codex@totuscentral.invalid'}),/suplantar/);assert.equal(m.calls.length,0);});
test('cannot silently overwrite stale closing or use a fresh retry identity',async()=>{const m=mock(),user={email:'codex@totuscentral.invalid'};for(const p_closing of [{},{id:request,request_id:request}])await assert.rejects(()=>runOperation(m.client,{operation:'rpc',name:'totus_save_closing',args:{p_closing,p_drawers:[]} },user));assert.equal(m.calls.length,0);});
test('server errors remain errors and no retries are invented',async()=>{const m=mock({message:'Permiso denegado'});await assert.rejects(()=>runOperation(m.client,{operation:'rpc',name:'totus_tasks_context',args:{p_from:'2026-10-01',p_to:'2026-10-31'}},{email:'chatgpt@totuscentral.invalid'}),/Permiso/);assert.equal(m.calls.length,1);});
test('destructive commands require confirmation in addition to server checks',async()=>{const m=mock();await assert.rejects(()=>runOperation(m.client,{operation:'rpc',name:'totus_delete_expense',args:{p_id:request,p_reason:'Authorized test'}},{email:'codex@totuscentral.invalid'}),/Confirmación/);assert.equal(m.calls.length,0);});
test('bounded reads preserve RLS and deny credentials and unknown filters',async()=>{const m=mock(),user={email:'chatgpt@totuscentral.invalid'};for(const p of [{table:'vault.secrets'},{table:'ops_expenses',limit:201},{table:'ops_expenses',filters:[{column:'id',operator:'or',value:'x'}]}])await assert.rejects(()=>runOperation(m.client,{operation:'read',...p},user));assert.equal(m.calls.length,1);const r=await runOperation(m.client,{operation:'read',table:'ops_expenses',limit:20},user);assert.equal(r.rows.length,1);assert.equal(r.limit,20);});
test('catalogue advertises exact arguments without exposing credential maintenance',()=>{const c=operationCatalogue();assert(c.rpc.totus_save_closing.includes('p_closing'));assert(!Object.hasOwn(c.rpc,'totus_onedrive_secret'));assert(!c.read_tables.includes('team_members'));});

test('Products uses the assistants own authenticated functions client and rejects foreign store results',async()=>{
 const calls=[],client={functions:{invoke:async(name,options)=>{calls.push({name,options});return {data:{ok:true,store:'hortimatic',resource:'products',persisted:false}}}}};
 const args={action:'prestashop_product_create_prepare',store:'hortimatic',reference:'FICTIONAL'};
 const result=await runOperation(client,{operation:'products',args},{email:'chatgpt@totuscentral.invalid'});
 assert.equal(result.data.store,'hortimatic');assert.deepEqual(calls,[{name:'totus-connections',options:{body:args}}]);
 await assert.rejects(()=>runOperation(client,{operation:'products',args:{...args,store:'newoldsmok'}},{email:'chatgpt@totuscentral.invalid'}),/no verificable/);
 await assert.rejects(()=>runOperation(client,{operation:'products',args:{action:'create_actor',store:'hortimatic'}},{email:'chatgpt@totuscentral.invalid'}),/no admitida/);
});

test('Products forwards the bounded diagnostic from its own service instead of hiding every failure',async()=>{
 const client={functions:{invoke:async()=>({data:null,error:{message:'Edge Function returned a non-2xx status code',context:new Response(JSON.stringify({error:'Traducción name del idioma 1 no coincide'}),{status:400})}})}};
 await assert.rejects(()=>runOperation(client,{operation:'products',args:{action:'prestashop_product_create_commit',store:'newoldsmok'}},{email:'chatgpt@totuscentral.invalid'}),/idioma 1/);
});
