import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {stripTypeScriptTypes} from 'node:module';
const {purgeUserAccess}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(readFileSync(new URL('../supabase/functions/team-admin/purge-user.ts',import.meta.url),'utf8'))).toString('base64'));
function fixture({deny=false,deleted=false,failDelete=false,failFinish=false,missing=false}={}){
 const calls=[];
 const scoped={rpc:async(name)=>{calls.push(name);if(deny||failFinish&&name==='totus_finish_user_purge')return {error:{message:'denied'}};return {data:{auth_id:'old-id'}};}};
 const authAdmin={
  getUserById:async()=>missing?{error:{status:404}}:{data:{user:{deleted_at:deleted?'today':null}}},
  deleteUser:async(id,soft)=>{calls.push({id,soft});return failDelete?{error:{message:'Auth unavailable'}}:{data:{}};}
 };
 return {calls,args:{email:'retired@example.invalid',scoped,admin:{auth:{admin:authAdmin}}}};
}
test('purge checks normal permission before irreversible Auth cleanup and preserves historical UUID',async()=>{const f=fixture();assert.equal((await purgeUserAccess(f.args)).purged,true);assert.deepEqual(f.calls,['totus_prepare_user_purge',{id:'old-id',soft:true},'totus_finish_user_purge']);});
test('denial never reaches Auth',async()=>{const f=fixture({deny:true});await assert.rejects(purgeUserAccess(f.args),/denied/);assert.deepEqual(f.calls,['totus_prepare_user_purge']);});
test('Auth failure never marks purge complete',async()=>{const f=fixture({failDelete:true});await assert.rejects(purgeUserAccess(f.args),/Auth unavailable/);assert(!f.calls.includes('totus_finish_user_purge'));});
test('retry after Auth deletion completes without another deletion',async()=>{for(const options of [{deleted:true},{missing:true}]){const f=fixture(options);assert.equal((await purgeUserAccess(f.args)).purged,true);assert.deepEqual(f.calls,['totus_prepare_user_purge','totus_finish_user_purge']);}});
test('database failure after Auth cleanup is not reported as success',async()=>{const f=fixture({failFinish:true});await assert.rejects(purgeUserAccess(f.args),/denied/);});
