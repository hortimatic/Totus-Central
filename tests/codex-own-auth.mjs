import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const original=readFileSync(new URL('../supabase/functions/totus-assistant/index.ts',import.meta.url),'utf8');
const withOperations=original.replace("import {runOperation} from './assistant-operations.ts'","const runOperation=()=>{throw new Error('Unexpected operation')}");
const source=withOperations.replace(/import \{ createClient \} from '[^']+'/,"const createClient=()=>{throw new Error('No live client in tests')}");
const isolated=source.replace(/import \{[^}]+\} from '.\/assistant-attachments.ts'/,"const attachChatExpenseDocument=()=>{throw new Error('Unexpected attachment')}; const readExpenseContext=()=>{throw new Error('Unexpected context')}; const reviewExpenseDocument=()=>{throw new Error('Unexpected review')}");
const chatIsolated=isolated.replace("import {readTeamChat,sendTeamChat} from './assistant-chat.ts'","const readTeamChat=()=>{throw new Error('Unexpected chat read')}; const sendTeamChat=()=>{throw new Error('Unexpected chat send')}");
const {handle}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(chatIsolated)).toString('base64'));
const job='11111111-1111-4111-8111-111111111111',ticket='a'.repeat(64);
const env={get:k=>({SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_ROLE_KEY:'server-test',SUPABASE_ANON_KEY:'public-test'})[k]};
function setup(action='session_check',overrides={}){
 const calls=[],results=[];const account={id:'own-codex-id',email:'codex@totuscentral.invalid',app_metadata:{totus_codex:true}};
 const work={action,payload:{expense:{request_id:job,fiscal_reviewed:false},lines:[{description:'fictional'}]},credentials:{email:account.email,password:'x'.repeat(96)}};
 function chain(table){
  let operation='';
  const x={select(){return x},eq(){return x},upsert(payload){calls.push(['upsert',table,payload]);return Promise.resolve({error:null})},
   update(){operation='update';return x},insert(payload){calls.push(['insert',table,payload]);return Promise.resolve({error:null})},
   single(){return Promise.resolve({data:table==='team_members'?{email:'chatgpt@totuscentral.invalid',full_name:'ChatGPT',active:!overrides.targetInactive,role:'admin'}:{id:'saved-id',created_by:account.id},error:null})},
   maybeSingle(){return Promise.resolve({data:{active:!overrides.inactive,role:overrides.notAdmin?'encargado':'admin'},error:null})},
   order(){return Promise.resolve({data:[{expense_id:'saved-id'}],error:null})},
   then(resolve){resolve({data:null,error:null})}};
  return x;
 }
 const admin={from:chain,rpc:async(name,args)=>{
  calls.push(['admin_rpc',name]);
  if(name==='totus_assistant_claim')return overrides.badTicket?{error:{message:'denied'}}:{data:work};
  results.push(args);return {error:null};
 },auth:{admin:{listUsers:async()=>({data:{users:overrides.existing?[overrides.existing]:[]}}),createUser:async(args)=>{calls.push(['createUser',args]);return {data:{user:account}}}}}};
 const scoped={from:chain,functions:{invoke:async(name,args)=>{calls.push(['user_function',name,args]);return {data:{ok:true}}}},rpc:async(name,args)=>{calls.push(['user_rpc',name,args]);return overrides.saveError?{error:{message:'validación rechazada'}}:{data:name==='totus_assistant_validate_expense'?{validated:true}:'saved-id'}},
 auth:{signInWithPassword:async(args)=>{calls.push(['login',args.email]);return overrides.loginFail?{error:{message:'login failed'}}:{data:{session:{access_token:'fictitious'},user:account}}},
 getUser:async()=>({data:{user:account}}),signOut:async()=>{calls.push(['logout']);return {}}}};
 return {calls,results,work,factory:(url,key)=>key==='server-test'?admin:scoped,run:()=>handle(new Request('https://example.invalid',{method:'POST',body:JSON.stringify({job,ticket})}),env,(url,key)=>key==='server-test'?admin:scoped)};
}

test('Codex setup creates its own Auth account and audited team member',async()=>{
 const q=setup('codex_setup');assert.equal((await q.run()).status,200);
 assert(q.calls.some(c=>c[0]==='createUser'&&c[1].email==='codex@totuscentral.invalid'&&c[1].app_metadata.totus_codex===true));
 assert(q.calls.some(c=>c[0]==='insert'&&c[1]==='team_members'&&c[2].full_name==='Codex'));
 assert(q.calls.some(c=>c[0]==='insert'&&c[1]==='team_user_audit_log'));
 assert(q.calls.some(c=>c[0]==='login'&&c[1]==='codex@totuscentral.invalid'));
 assert(q.calls.some(c=>c[0]==='logout'));
 assert(!JSON.stringify(q.results).includes('x'.repeat(96)));
});
test('Codex identity cannot use an unprefixed ChatGPT operation',async()=>{
 const q=setup('save_expense');assert.equal((await q.run()).status,400);
 assert(!q.calls.some(c=>c[0]==='login'||c[0]==='user_rpc'));
});
test('rejected setup ticket cannot create a user',async()=>{
 const q=setup('codex_setup',{badTicket:true});assert.equal((await q.run()).status,401);
 assert(!q.calls.some(c=>c[0]==='createUser'||c[0]==='login'));
});
test('inactive Codex cannot use its session',async()=>{
 const q=setup('codex_session_check',{inactive:true});assert.equal((await q.run()).status,400);
 assert(q.results[0].p_error);assert(!q.results[0].p_result);
});
test('Codex session has a distinct verified actor',async()=>{
 const q=setup('codex_session_check');assert.equal((await q.run()).status,200);
 assert.equal(q.results[0].p_result.email,'codex@totuscentral.invalid');
 assert.equal(q.results[0].p_result.session_verified,true);
});

test('setup retry does not recreate or reset an existing Codex account',async()=>{
 const q=setup('codex_setup',{existing:{id:'own-codex-id',email:'codex@totuscentral.invalid',app_metadata:{totus_codex:true}}});
 assert.equal((await q.run()).status,200);
 assert(!q.calls.some(c=>c[0]==='createUser'||c[0]==='upsert'||c[0]==='insert'));
});
test('setup cannot take over an existing account without Codex server metadata',async()=>{
 const q=setup('codex_setup',{existing:{id:'someone-else',email:'codex@totuscentral.invalid',app_metadata:{}}});
 assert.equal((await q.run()).status,400);
 assert(!q.calls.some(c=>c[0]==='createUser'||c[0]==='login'||c[0]==='upsert'||c[0]==='insert'));
});
test('setup never reactivates a revoked identity',async()=>{
 const q=setup('codex_setup',{inactive:true,existing:{id:'own-codex-id',email:'codex@totuscentral.invalid',app_metadata:{totus_codex:true}}});
 assert.equal((await q.run()).status,400);
 assert(!q.calls.some(c=>c[0]==='createUser'||c[0]==='login'||c[0]==='upsert'||c[0]==='insert'));
});

 test('Codex can save and validate expenses with its own authenticated identity',async()=>{
  for(const action of ['codex_save_expense','codex_validate_expense']){
   const q=setup(action);assert.equal((await q.run()).status,200);
   assert(q.calls.some(c=>c[0]==='login'&&c[1]==='codex@totuscentral.invalid'));
   assert(q.calls.some(c=>c[0]==='user_rpc'&&c[1]===(action==='codex_save_expense'?'totus_save_expense':'totus_assistant_validate_expense')));
   assert(!q.calls.some(c=>c[0]==='admin_rpc'&&['totus_save_expense','totus_assistant_validate_expense'].includes(c[1])));
  }
 });

 test('authorized admin grant calls existing team-admin with Codex session and rereads',async()=>{
  const q=setup('codex_grant_chatgpt_admin');assert.equal((await q.run()).status,200);
  const call=q.calls.find(c=>c[0]==='user_function');assert.equal(call[1],'team-admin');
  assert.equal(call[2].body.role,'admin');assert.equal(call[2].body.email,'chatgpt@totuscentral.invalid');
  assert.equal(q.results[0].p_result.verified,true);
  assert(!q.calls.some(c=>c[0]==='update'||c[0]==='createUser'));
 });
 test('grant cannot reactivate target or run after Codex administrator permission is revoked',async()=>{
  for(const o of [{targetInactive:true},{notAdmin:true}]){const q=setup('codex_grant_chatgpt_admin',o);assert.equal((await q.run()).status,400);assert(!q.calls.some(c=>c[0]==='user_function'));}
 });
