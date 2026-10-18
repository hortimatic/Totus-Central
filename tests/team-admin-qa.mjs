import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';

// Execute the actual Edge handler with isolated Auth/database adapters.
const source=stripTypeScriptTypes(fs.readFileSync(new URL('../supabase/functions/team-admin/index.ts',import.meta.url),'utf8').replace(/^import .*\r?\n/,''));
async function scenario({action='set_password',callerRole='admin',memberRole='admin',active=false,existing=true,paginated=false}={}){
 let handler;const writes=[],updates=[],pages=[];
 const member={email:'target@qa.invalid',full_name:'Target',role:memberRole,active};
 const from=table=>{
  const filters={};let mutation;
  const query={select(){return query},eq(k,v){filters[k]=v;return query},
   upsert(value){mutation=value;writes.push({table,value});return query},
   insert(value){writes.push({table,value});return query},
   update(value){mutation=value;writes.push({table,value});return query},
   maybeSingle(){return Promise.resolve({data:table==='ops_roles'?{code:'gerente'}:filters.email==='caller@qa.invalid'?{role:callerRole,active:true}:member,error:null})},
   then(resolve,reject){return Promise.resolve({data:mutation,error:null,count:1}).then(resolve,reject)}};
  return query;
 };
 const auth={getUser:async()=>({data:{user:{email:'caller@qa.invalid'}}}),resetPasswordForEmail:async()=>({error:null}),admin:{
  listUsers:async({page})=>{pages.push(page);return {data:{users:paginated&&page===1?Array.from({length:1000},(_,i)=>({id:`other-${i}`,email:`other-${i}@qa.invalid`})):existing?[{id:'target-id',email:member.email,email_confirmed_at:'2026-01-01'}]:[]},error:null}},
  updateUserById:async(id,value)=>{updates.push({id,value});return {error:null}},
  createUser:async()=>{throw new Error('Unexpected account creation')}
 }};
 const env={SUPABASE_URL:'https://qa.invalid',SUPABASE_ANON_KEY:'test-public',SUPABASE_SERVICE_ROLE_KEY:'test-secret'};
 vm.runInNewContext(source,{createClient:()=>({auth,from}),Deno:{env:{get:k=>env[k]},serve:h=>{handler=h}},Response,Request,console});
 const response=await handler(new Request('https://qa.invalid/team-admin',{method:'POST',headers:{Authorization:'Bearer test-session','Content-Type':'application/json'},body:JSON.stringify({action,email:member.email,full_name:'Changed name',role:'gerente',password:'fixture-only-password'})}));
 return {status:response.status,body:await response.json(),writes,updates,pages};
}
for(const memberRole of ['admin','encargado']){
 const result=await scenario({memberRole,paginated:true});
 assert.equal(result.status,200);assert.deepEqual(result.pages,[1,2]);
 assert.equal(result.writes.filter(w=>w.table==='team_members').length,0,'Credential maintenance cannot reactivate or change roles');
 assert.equal(result.updates[0].value.user_metadata.role,memberRole);
 assert.equal(result.updates[0].value.user_metadata.full_name,'Target');
}
for(const action of ['invite','resend_invite']){
 const result=await scenario({action});assert.equal(result.status,200);
 assert.equal(result.writes.filter(w=>w.table==='team_members').length,0,'Recovery for confirmed accounts must preserve revoked access');
}
assert.equal((await scenario({existing:false})).status,404);
const denied=await scenario({callerRole:'gerente'});assert.equal(denied.status,403);assert.equal(denied.updates.length,0);assert.equal(denied.writes.length,0);
console.log('TEAM ADMIN QA: credential maintenance preserves role, identity and revoked access; pagination and authorization verified.');
