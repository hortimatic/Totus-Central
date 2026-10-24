// Exercise the actual Edge handler with isolated Auth/Storage/Postgres adapters.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import JSZip from 'jszip';
import {RECOVERY_TABLES,buildRecoveryArchive,archiveHash} from '../src/recovery-core.js';
const actor='22222222-2222-4222-8222-222222222222',jobId='11111111-1111-4111-8111-111111111111';
let handler,state;
const database=Object.fromEntries(RECOVERY_TABLES.map(t=>[t,[]]));
database.profiles=[{id:actor,email:'qa@example.invalid'}];
database.team_members=[{email:'qa@example.invalid',role:'admin',active:true}];
database.ops_documents=[{id:'document',storage_path:'original/test.pdf',uploaded_by:actor,mime_type:'application/pdf'}];
database.ops_sales_invoices=[{id:'invoice',created_by:actor,status:'emitida',display_number:'QA-001',total_amount:121}];
const snapshot={database,project_ref:'qa-project',database_instance:jobId,schema_hash:'a'.repeat(64),revision:'b'.repeat(64),created_at:'2026-10-18T00:00:00Z',identities:[{id:actor,email:'qa@example.invalid'}],storage:{'business-documents':['original/test.pdf'],'business-assets':[]}};
const original=new Uint8Array([1,2,3]);
const built=await buildRecoveryArchive(snapshot,JSZip,async()=>original);
class Query{
 constructor(table){this.table=table;this.filters=[];this.op='select'}
 order(){return this} limit(){return this}
 select(){return this} eq(k,v){this.filters.push(x=>x[k]===v);return this}
 in(k,values){this.filters.push(x=>values.includes(x[k]));return this}
 maybeSingle(){this.singleRow=true;return this} single(){this.singleRow=true;return this}
 insert(row){this.op='insert';this.row=row;return this} update(row){this.op='update';this.row=row;return this}
 then(resolve,reject){return Promise.resolve().then(()=>{
  if(this.table==='ops_backup_runs'){const rows=(state.backups||[]).filter(x=>this.filters.every(f=>f(x)));return {data:this.singleRow?rows[0]||null:rows,error:null};}
  if(this.table==='team_members')return {data:{role:state.role,active:state.active},error:null};
  if(this.table!=='ops_recovery_jobs')throw Error('Unexpected table '+this.table);
  if(this.op==='insert')state.jobs.push({status:'uploaded',...structuredClone(this.row)});
  const rows=state.jobs.filter(x=>this.filters.every(f=>f(x)));
  if(this.op==='update')rows.forEach(x=>Object.assign(x,this.row));
  return {data:structuredClone(this.singleRow?rows[0]||null:rows),error:null};
 }).then(resolve,reject)}
}
globalThis.__recoveryHandlerClient={
 auth:{getUser:async token=>({data:{user:token==='valid'?{id:actor,email:'qa@example.invalid'}:null},error:token==='valid'?null:{message:'Invalid token'}})},
 from:t=>new Query(t),
 rpc:async(name,args)=>{
  if(name==='totus_export_recovery_snapshot')return {data:structuredClone(snapshot),error:null};
  assert.equal(name,'totus_commit_recovery');state.commitCalls++;
  const job=state.jobs.find(x=>x.id===args.p_job);assert.equal(job.status,'prepared');
  assert.ok(state.files.has('business-backups/'+job.checkpoint_path)||state.cloudBackup,'Missing checkpoint');
  const path=args.p_payload.ops_documents[0].storage_path;
  if(state.cloudBackup)assert.equal(path,'original/test.pdf','An unchanged original should be reused from the verified checkpoint');
  else assert.ok(path.startsWith('recovery/'+jobId+'/'));
  assert.ok(state.files.has('business-documents/'+path));
  assert.equal(args.p_payload.ops_documents[0].uploaded_by,actor);
  state.live=args.p_payload;Object.assign(job,{status:'committed',result:{ops_documents:1}});
  return {data:job.result,error:null};
 },
 storage:{from:bucket=>({
  download:async path=>({data:state.files.get(bucket+'/'+path)||null,error:state.files.has(bucket+'/'+path)?null:{message:'Missing file'}}),
  upload:async(path,bytes,options)=>{
   assert.equal(options.upsert,false);
   if(state.failUpload&&path.startsWith('recovery/'))return {data:null,error:{message:'Injected transfer failure'}};
   if(state.files.has(bucket+'/'+path))return {data:null,error:{message:'Already exists'}};
   state.files.set(bucket+'/'+path,new Blob([bytes]));return {data:{path},error:null};
  },
  list:async prefix=>({data:[...state.files].filter(([p])=>p.startsWith(bucket+'/'+prefix+'/')).map(([p,b])=>({name:p.split('/').pop(),metadata:{size:b.size}})),error:null})
 })}
};
const originalFetch=globalThis.fetch;
globalThis.fetch=async(address,options)=>{
 if(String(address)==='https://qa-project.supabase.co/functions/v1/totus-onedrive'){
  assert.equal(options.headers.Authorization,'Bearer valid');
  const body=JSON.parse(options.body);
  if(body.action==='backup-file-urls'){
   assert.ok(['saved-copy','33333333-3333-4333-8333-333333333333'].includes(body.run_id));
   return new Response(JSON.stringify({files:[{path:'automaticas/saved.totusbackup',url:state.unsafeCloudBackup?'http://qa.example.invalid/backup':'https://qa.example.invalid/backup'}]}));
  }
  assert.equal(body.action,'backup-document-urls');
  assert.deepEqual(body.paths,['original/test.pdf']);
  return new Response(JSON.stringify({files:[{path:'original/test.pdf',provider:state.cloudOriginal?'onedrive':'supabase',url:'https://qa.example.invalid/original.pdf',size_bytes:original.length}]}));
 }
 if(String(address)==='https://qa.example.invalid/original.pdf')return new Response(original);
 if(String(address)==='https://qa.example.invalid/backup')return new Response(state.corruptCloudBackup?new Uint8Array([0]):built.bytes);
 throw Error('Unexpected external request in recovery test');
};
globalThis.__recoveryHandlerZip=JSZip;
globalThis.Deno={env:{get:key=>key==='SUPABASE_URL'?'https://qa-project.supabase.co':'server-only-test-key'},serve:fn=>{handler=fn}};
let code=await fs.readFile(new URL('../supabase/functions/totus-recovery/index.ts',import.meta.url),'utf8');
code=code.replace(/import \{createClient\} from 'npm:[^']+';/,"const createClient=()=>globalThis.__recoveryHandlerClient;")
 .replace(/import \{NativeBackupZip as JSZip\} from '[^']+';/,'const JSZip=globalThis.__recoveryHandlerZip;');
for(const file of ['recovery-core.js','recovery-runner.js','backup-transport.js','backup-set.js','cloud-backup-reader.js'])code=code.replace('../../../src/'+file,new URL('../src/'+file,import.meta.url).href);
code=code.replace('./chat-file-reader.js',new URL('../supabase/functions/totus-recovery/chat-file-reader.js',import.meta.url).href);
await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(code)).toString('base64'));
const reset=()=>{state={role:'admin',active:true,jobs:[],files:new Map([['business-documents/original/test.pdf',new Blob([original])]]),live:{untouched:true},commitCalls:0}};
const request=(body={},token='valid',method='POST')=>handler(new Request('https://qa.invalid',{method,headers:token?{Authorization:'Bearer '+token}: {},...(method==='POST'?{body:JSON.stringify(body)}:{})}));
reset();assert.equal((await request({},'', 'OPTIONS')).status,204);assert.equal((await request({},'','GET')).status,405);
assert.equal((await request({},'')).status,401);assert.equal((await request({},'invalid')).status,401);
state.role='staff';assert.equal((await request({job_id:jobId})).status,403);state.role='admin';state.active=false;assert.equal((await request({job_id:jobId})).status,403);state.active=true;
assert.equal((await request({job_id:'../../other'})).status,400);
const register=await (await request({job_id:jobId,action:'register'})).json();
assert.equal(register.source_path,'restauraciones/solicitudes/'+actor+'/'+jobId+'.totusbackup');
state.jobs[0].requested_by='another-user';assert.equal((await request({job_id:jobId})).status,403);state.jobs[0].requested_by=actor;
state.jobs[0].status='preparing';assert.equal((await request({job_id:jobId})).status,409);state.jobs[0].status='uploaded';
assert.equal((await request({job_id:jobId})).status,400);assert.equal(state.commitCalls,0);
for(const failUpload of [true,false]){
 reset();state.failUpload=failUpload;
 const registered=await (await request({job_id:jobId,action:'register'})).json();
 state.files.set('business-backups/'+registered.source_path,new Blob([built.bytes]));
 const response=await request({job_id:jobId});
 assert.equal(response.status,failUpload?500:200,await response.text());
 assert.equal(await archiveHash(await state.files.get('business-documents/original/test.pdf').arrayBuffer()),await archiveHash(original));
 if(failUpload){assert.equal(state.commitCalls,0);assert.deepEqual(state.live,{untouched:true});assert.equal(state.jobs[0].status,'failed')}
 else{assert.equal(state.commitCalls,1);assert.equal(state.jobs[0].status,'committed');assert.equal((await request({job_id:jobId})).status,200);assert.equal(state.commitCalls,1)}
}
reset();state.cloudOriginal=true;state.files.delete('business-documents/original/test.pdf');
const cloudJob=await (await request({job_id:jobId,action:'register'})).json();
state.files.set('business-backups/'+cloudJob.source_path,new Blob([built.bytes]));
const cloudResponse=await request({job_id:jobId});
assert.equal(cloudResponse.status,200,await cloudResponse.text());
assert.equal(state.commitCalls,1,'A OneDrive original must be included in the checkpoint before restoring');

for(const problem of ['none','corrupt','unsafe']){
 reset();state.cloudBackup=true;state.corruptCloudBackup=problem==='corrupt';state.unsafeCloudBackup=problem==='unsafe';
 state.backups=[{id:'saved-copy',status:'success',storage_path:'automaticas/saved.totusbackup',snapshot_revision:snapshot.revision,size_bytes:built.bytes.length,archive_sha256:await archiveHash(built.bytes),archive_manifest:built.manifest,started_at:'2026-10-20T00:00:00Z'}];
 const savedJob=await (await request({job_id:jobId,action:'register'})).json();
 state.files.set('business-backups/'+savedJob.source_path,new Blob([built.bytes]));
 const response=await request({job_id:jobId});
 assert.equal(response.status,problem==='none'?200:500,await response.text());
 assert.equal(state.commitCalls,problem==='none'?1:0,'A missing/corrupt cloud checkpoint must never allow a commit');
}


const savedId='33333333-3333-4333-8333-333333333333';
reset();state.cloudBackup=true;state.backups=[{id:savedId,status:'success',storage_provider:'onedrive',storage_path:'automaticas/saved.totusbackup',snapshot_revision:snapshot.revision,size_bytes:built.bytes.length,archive_sha256:await archiveHash(built.bytes),archive_manifest:built.manifest}];
const preview=await request({job_id:jobId,action:'review-saved',backup_id:savedId});
assert.equal(preview.status,200,await preview.clone().text());assert.equal((await preview.json()).verified,true);
assert.equal(state.jobs.length,0,'Review must never register or start a recovery');assert.equal(state.commitCalls,0);
assert.equal((await request({job_id:jobId,action:'review-saved',backup_id:'../../foreign'})).status,500);
const registration=await request({job_id:jobId,action:'register-saved',backup_id:savedId});
assert.equal(registration.status,200,await registration.clone().text());assert.equal(state.jobs[0].source_path,'automaticas/saved.totusbackup');
const direct=await request({job_id:jobId});assert.equal(direct.status,200,await direct.clone().text());assert.equal(state.commitCalls,1);
reset();state.role='staff';assert.equal((await request({job_id:jobId,action:'review-saved',backup_id:savedId})).status,403);

globalThis.fetch=originalFetch;
delete globalThis.Deno;delete globalThis.__recoveryHandlerClient;delete globalThis.__recoveryHandlerZip;
console.log('RECOVERY HANDLER QA: real handler rejects invalid Auth, inactive/non-admin users, foreign jobs, unsafe paths; checkpoints, file failure and idempotent completion OK');
