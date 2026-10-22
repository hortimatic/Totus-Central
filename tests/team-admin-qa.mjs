import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';

// Execute the actual Edge handler with isolated Auth/database adapters.
const source=stripTypeScriptTypes(fs.readFileSync(new URL('../supabase/functions/team-admin/index.ts',import.meta.url),'utf8').replace(/^import .*\r?\n/,''));
async function scenario({action='set_password',callerRole='admin',memberRole='admin',active=false,existing=true,paginated=false,password='fixture-only-password'}={}){
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
  createUser:async()=>({data:{user:{id:'new-target-id'}},error:null})
 }};
 const env={SUPABASE_URL:'https://qa.invalid',SUPABASE_ANON_KEY:'test-public',SUPABASE_SERVICE_ROLE_KEY:'test-secret'};
 vm.runInNewContext(source,{createClient:()=>({auth,from}),Deno:{env:{get:k=>env[k]},serve:h=>{handler=h}},Response,Request,console});
 const response=await handler(new Request('https://qa.invalid/team-admin',{method:'POST',headers:{Authorization:'Bearer test-session','Content-Type':'application/json'},body:JSON.stringify({action,email:member.email,full_name:'Changed name',role:'gerente',password,phone:'600000000',job_title:'QA manager',store:'QA centre',employee_notes:'QA notes'})}));
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
const created=await scenario({action:'create_user',existing:false});assert.equal(created.status,200);
const ficha=created.writes.find(w=>w.table==='team_members').value;
assert.equal(ficha.phone,'600000000');assert.equal(ficha.job_title,'QA manager');assert.equal(ficha.store,'QA centre');assert.equal(ficha.employee_notes,'QA notes');
const denied=await scenario({callerRole:'gerente'});assert.equal(denied.status,403);assert.equal(denied.updates.length,0);assert.equal(denied.writes.length,0);
const short=await scenario({password:'fixture-8'});assert.equal(short.status,400);assert.equal(short.updates.length,0);assert.equal(short.writes.length,0);
console.log('TEAM ADMIN QA: credential maintenance preserves role, identity and revoked access; pagination and authorization verified.');

// A rejected optional password must not save unrelated profile changes first.
const appSource=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const clientStart=appSource.indexOf("async function saveUser(email=''){");
const clientEnd=appSource.indexOf('\nasync function toggleUser(',clientStart);
assert.ok(clientStart>=0&&clientEnd>clientStart);
async function clientSave(password,email='admin@qa.invalid'){
 const calls=[],values={usName:'Nombre editado',usEmail:'new@qa.invalid',usRole:'admin',usPhone:'',usJob:'',usStore:'',usNotes:'',usPassword:password};
 const context={required:id=>values[id],val:id=>values[id]||'',state:{data:{team:[{email:'admin@qa.invalid',role:'admin',active:true}]}},invokeTeam:async value=>{calls.push(value)},closeModal(){},refresh:async()=>{}};
 const save=vm.runInNewContext('('+appSource.slice(clientStart,clientEnd)+')',context);
 try{await save(email);return {calls,error:null}}catch(error){return {calls,error:String(error.message)}}
}
for(const email of ['admin@qa.invalid','']){
 const rejected=await clientSave('short',email);
 assert.match(rejected.error,/12 caracteres/);
 assert.equal(rejected.calls.length,0,'Invalid credentials must not partially update the profile');
}
const renameOnly=await clientSave('');
assert.equal(renameOnly.error,null);
assert.deepEqual(renameOnly.calls.map(x=>x.action),['update_member'],'Renaming must not invoke credential maintenance');
assert.equal(renameOnly.calls[0].role,'admin');
assert.equal(renameOnly.calls[0].store,'');
const withPassword=await clientSave('fixture-only-password');
assert.deepEqual(withPassword.calls.map(x=>x.action),['update_member','set_password']);
console.log('USER FORM QA: invalid password makes no writes; name-only save preserves access and role.');
