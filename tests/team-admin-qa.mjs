import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';

// Execute the actual Edge handler with isolated Auth/database adapters.
const source=stripTypeScriptTypes(fs.readFileSync(new URL('../supabase/functions/team-admin/index.ts',import.meta.url),'utf8').replace(/^import .*$/gm,''));
async function scenario({action='set_password',callerRole='admin',memberRole='admin',active=false,existing=true,paginated=false,password='fixture-only-password',retired=false,purged=false,cleanup=false,authDeleted=false,profileRole=null,profileActive=null,requestedActive=false}={}){
 let handler;const writes=[],updates=[],pages=[],profiles=new Map();
 const member={email:'target@qa.invalid',full_name:'Target',role:memberRole,active,deleted_at:retired?'2026-01-01':null,purged_at:purged?'2026-01-02':null,auth_cleanup_pending:cleanup};
 const from=table=>{
  const filters={};let mutation;
  const query={select(){return query},eq(k,v){filters[k]=v;return query},
   upsert(value){mutation=value;writes.push({table,value});if(table==='profiles')profiles.set(value.id,{...value});return query},
   insert(value){writes.push({table,value});return query},
   update(value){mutation=value;writes.push({table,value});return query},
   maybeSingle(){const data=table==='profiles'?(profiles.get(filters.id)||{id:filters.id,email:member.email,full_name:member.full_name,role:profileRole??(member.active?member.role:'pendiente'),active:profileActive??member.active}):table==='ops_roles'?{code:'gerente'}:filters.email==='caller@qa.invalid'?{role:callerRole,active:true}:member;return Promise.resolve({data,error:null})},
   then(resolve,reject){return Promise.resolve({data:mutation,error:null,count:1}).then(resolve,reject)}};
  return query;
 };
 const auth={getUser:async()=>({data:{user:{email:'caller@qa.invalid'}}}),resetPasswordForEmail:async()=>({error:null}),admin:{
  listUsers:async({page})=>{pages.push(page);return {data:{users:paginated&&page===1?Array.from({length:1000},(_,i)=>({id:`other-${i}`,email:`other-${i}@qa.invalid`})):existing?[{id:'target-id',email:member.email,email_confirmed_at:'2026-01-01',deleted_at:authDeleted?'2026-01-02':null}]:[]},error:null}},
  updateUserById:async(id,value)=>{updates.push({id,value});return {error:null}},
  createUser:async()=>({data:{user:{id:'new-target-id',email:member.email}},error:null}),
  inviteUserByEmail:async email=>({data:{user:{id:'invited-target-id',email}},error:null})
 }};
 const env={SUPABASE_URL:'https://qa.invalid',SUPABASE_ANON_KEY:'test-public',SUPABASE_SERVICE_ROLE_KEY:'test-secret'};
 vm.runInNewContext(source,{createClient:()=>({auth,from}),Deno:{env:{get:k=>env[k]},serve:h=>{handler=h}},Response,Request,console});
 const response=await handler(new Request('https://qa.invalid/team-admin',{method:'POST',headers:{Authorization:'Bearer test-session','Content-Type':'application/json'},body:JSON.stringify({action,email:member.email,full_name:'Changed name',role:'gerente',active:requestedActive,password,phone:'600000000',job_title:'QA manager',store:'QA centre',employee_notes:'QA notes'})}));
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
assert(!('avatar_url' in ficha),'Ordinary invitations and creation must not clear existing photo fields');

const invited=await scenario({action:'invite',existing:false});
assert.equal(invited.status,200,'Invitación de usuario nuevo conserva el circuito legítimo');
const invitedProfile=invited.writes.find(w=>w.table==='profiles')?.value;
assert.equal(invitedProfile?.id,'invited-target-id');
assert.equal(invitedProfile?.active,true);
const createdProfile=created.writes.find(w=>w.table==='profiles')?.value;
assert.equal(createdProfile?.id,'new-target-id','El alta enlaza el ID Auth real, no crea otra identidad');
assert.equal(createdProfile?.role,'gerente');
assert.equal(createdProfile?.active,true,'El alta del miembro activo habilita su propio perfil');
for(const action of ['update_member','set_active']){
 const fixed=await scenario({action,memberRole:'gerente',active:true});
 assert.equal(fixed.status,200,'La administración puede conciliar perfil y equipo: '+action);
 const profile=fixed.writes.find(w=>w.table==='profiles')?.value;
 assert.equal(profile?.id,'target-id','Solo puede actualizar la identidad Auth correspondiente');
 assert.equal(profile?.role,'gerente');
 assert.equal(profile?.active,action==='update_member','set_active usa el estado solicitado (falso en esta prueba)');
}
const expresslyDisabled=await scenario({action:'update_member',memberRole:'gerente',active:true,profileActive:false,profileRole:'gerente'});
assert.equal(expresslyDisabled.status,400,'Una cuenta Auth desactivada deliberadamente no se reactiva al guardar su nombre');
assert.equal(expresslyDisabled.writes.filter(w=>w.table==='profiles').length,0,'No se toca un perfil desactivado intencionalmente');
const explicitlyActivated=await scenario({action:'set_active',memberRole:'gerente',active:false,profileActive:false,profileRole:'gerente',requestedActive:true});
assert.equal(explicitlyActivated.status,200,'Solo Activar en Administración puede reactivar un perfil desactivado');
assert.equal(explicitlyActivated.writes.find(w=>w.table==='profiles')?.value.active,true);

const newlyPending=await scenario({action:'update_member',memberRole:'gerente',active:true,profileActive:false,profileRole:'pendiente'});
assert.equal(newlyPending.status,200,'Administración sí reconcilia un perfil pendiente con el miembro activo');
assert.equal(newlyPending.writes.find(w=>w.table==='profiles')?.value.active,true);
const missingAuth=await scenario({action:'update_member',existing:false});
assert.equal(missingAuth.writes.filter(w=>w.table==='profiles').length,0,'Sin Auth no se crea una identidad ficticia');

const denied=await scenario({callerRole:'gerente'});assert.equal(denied.status,403);assert.equal(denied.updates.length,0);assert.equal(denied.writes.length,0);
for(const authDeleted of [false,true]){
 const recreated=await scenario({action:'create_user',retired:true,purged:true,existing:authDeleted,authDeleted});assert.equal(recreated.status,200);
 const row=recreated.writes.find(w=>w.table==='team_members').value;assert.equal(row.role,'gerente');assert.equal(row.active,true);
 for(const field of ['deleted_at','purged_at','purge_auth_id','avatar_url','avatar_path'])assert.equal(row[field],null);assert.equal(row.auth_cleanup_pending,false);
}
for(const action of ['set_password','update_member','set_active','resend_invite']){const result=await scenario({action,retired:true,purged:true});assert.equal(result.status,409);assert.equal(result.updates.length,0);assert.equal(result.writes.length,0);}
assert.equal((await scenario({action:'create_user',retired:true,purged:false,existing:false})).status,409);
assert.equal((await scenario({action:'create_user',retired:true,purged:true,cleanup:true,existing:false})).status,409);
const liveAuthConflict=await scenario({action:'create_user',retired:true,purged:true,existing:true});assert.equal(liveAuthConflict.status,409);assert.equal(liveAuthConflict.writes.length,0,'A live Auth identity cannot be taken over through a purged team row');
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
