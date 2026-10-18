import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {RECOVERY_TABLES,buildRecoveryArchive,readRecoveryArchive,prepareRecoveryPlan,archiveHash} from '../src/recovery-core.js';
import {runApplicationRecovery} from '../src/recovery-runner.js';
const jobId='11111111-1111-4111-8111-111111111111';
const actor='22222222-2222-4222-8222-222222222222';
const database=Object.fromEntries(RECOVERY_TABLES.map(t=>[t,[]]));
database.profiles=[{id:actor,email:'qa@example.invalid'}];
database.ops_documents=[{id:'doc',storage_path:'original/invoice.pdf',uploaded_by:actor,mime_type:'application/pdf'}];
database.ops_document_templates=[{id:'template',logo_path:'logos/current.jpg'}];
database.ops_sales_invoices=[{id:'issued',status:'emitida',display_number:'F-001',total_amount:121,created_by:actor,record_hash:'unchanged-financial-hash',template_snapshot:{issuer:{business_name:'QA'},logo_path:'logos/historic.jpg'}}];
database.ops_audit_log=[{id:1,user_id:actor,detail:{note:'logos/current.jpg'}}];
const initialFiles=new Map([
 ['business-documents/original/invoice.pdf',new Uint8Array([1,2,3])],
 ['business-assets/logos/current.jpg',new Uint8Array([4,5])],
 ['business-assets/logos/historic.jpg',new Uint8Array([6,7])]
]);
const snapshot={database,project_ref:'qa-project',database_instance:jobId,schema_hash:'a'.repeat(64),revision:'b'.repeat(64),created_at:'2026-10-18T00:00:00Z',identities:[{id:actor,email:'qa@example.invalid'}],storage:{'business-documents':['original/invoice.pdf'],'business-assets':['logos/current.jpg','logos/historic.jpg']}};
const built=await buildRecoveryArchive(snapshot,JSZip,async(b,p)=>initialFiles.get(b+'/'+p));
const archive=await readRecoveryArchive(built.bytes,JSZip,{projectRef:'qa-project',instance:jobId,schemaHash:snapshot.schema_hash});
assert.equal(archive.database.ops_documents[0].uploaded_by,actor,'Backup must retain the author');
assert.equal(archive.database.ops_sales_invoices[0].created_by,actor);
assert.equal(archive.manifest.version,3);
await assert.rejects(()=>readRecoveryArchive(built.bytes,JSZip,{projectRef:'other-project'}),/otro proyecto/);
const extra=await JSZip.loadAsync(built.bytes);extra.file('unexpected.txt','unexpected');
const tampered=await JSZip.loadAsync(built.bytes);tampered.file('storage/business-assets/logos/current.jpg',new Uint8Array([99]));
const extraBytes=await extra.generateAsync({type:'uint8array'});
await assert.rejects(()=>readRecoveryArchive(extraBytes,JSZip),/inesperado/);
const corruptBytes=await tampered.generateAsync({type:'uint8array'});
await assert.rejects(()=>readRecoveryArchive(corruptBytes,JSZip),/dañada/);
const bomb=built.bytes.slice();const view=new DataView(bomb.buffer,bomb.byteOffset,bomb.byteLength);
for(let offset=0;offset<bomb.length-46;offset++)if(view.getUint32(offset,true)===0x02014b50){view.setUint32(offset+24,201*1024*1024,true);break}
await assert.rejects(()=>readRecoveryArchive(bomb,JSZip),/límite de seguridad/);
const plan=await prepareRecoveryPlan(archive,jobId);
assert.equal(plan.files.length,3);assert.equal(plan.database.ops_sales_invoices[0].record_hash,'unchanged-financial-hash');
assert.equal(plan.database.ops_sales_invoices[0].created_by,actor);
assert.equal(plan.database.ops_audit_log[0].detail.note,'logos/current.jpg','Do not rewrite historic free text');
assert.match(plan.database.ops_sales_invoices[0].template_snapshot.logo_path,/^recovery\//);
assert.equal(database.ops_documents[0].storage_path,'original/invoice.pdf','Preparation mutated the source');

function adapterFor(failure=''){
 const files=new Map(initialFiles),state={job:{status:'uploaded'},live:{unchanged:true},commits:0,writes:0};
 const adapter={
  getJob:async()=>{if(failure==='unknown'&&state.commits)throw new Error('status unavailable');return structuredClone(state.job)},
  claimJob:async()=>{if(failure==='already-running')return false;state.job.status='preparing';return true},
  readFile:async(b,p)=>failure==='prepared-hash'&&p.startsWith('recovery/')?new Uint8Array([99]):files.get(b+'/'+p),
  writeCheckpoint:async(p,bytes)=>{if(failure==='checkpoint-upload')throw new Error('checkpoint upload');files.set('checkpoint/'+p,bytes)},
  readCheckpoint:async p=>failure==='checkpoint-hash'?new Uint8Array([99]):files.get('checkpoint/'+p),
  setCheckpoint:async(p,rev)=>Object.assign(state.job,{checkpoint_path:p,before_revision:rev}),
  writeFile:async(file,bytes)=>{state.writes++;if(failure==='file-upload'&&state.writes===2)throw new Error('file upload');files.set(file.bucket+'/'+file.target,bytes)},
  markPrepared:async()=>state.job.status='prepared',
  commit:async payload=>{
   state.commits++;
   if(['commit','concurrent','unknown'].includes(failure))throw new Error(failure==='concurrent'?'data changed':'commit response unavailable');
   state.live=payload;state.job.status='committed';state.job.result={ops_sales_invoices:1};
   if(failure==='network-after')throw new Error('response lost after commit');
   return state.job.result;
  },
  failJob:async error=>{if(state.job.status!=='committed')Object.assign(state.job,{status:'failed',error})}
 };
 return {adapter,state,files};
}
for(const failure of ['checkpoint-upload','checkpoint-hash','file-upload','prepared-hash','commit','concurrent','unknown','already-running']){
 const {adapter,state,files}=adapterFor(failure);
 await assert.rejects(()=>runApplicationRecovery({archive,snapshot,jobId,JSZip,adapter}));
 assert.deepEqual(state.live,{unchanged:true},failure+' changed live records');
 for(const [path,bytes] of initialFiles)assert.equal(await archiveHash(files.get(path)),await archiveHash(bytes),failure+' modified an original file');
 if(['checkpoint-upload','checkpoint-hash','file-upload','prepared-hash','already-running'].includes(failure))assert.equal(state.commits,0,'Commit ran before preparation succeeded');
}
for(const failure of ['', 'network-after']){
 const {adapter,state}=adapterFor(failure);
 const result=await runApplicationRecovery({archive,snapshot,jobId,JSZip,adapter});
 assert.equal(result.result.ops_sales_invoices,1);assert.equal(state.job.status,'committed');
 await runApplicationRecovery({archive,snapshot,jobId,JSZip,adapter});
 assert.equal(state.commits,1,'Retry performed a second destructive commit');
}
for(const failure of ['', 'revision', 'checkpoint-hash', 'prepared-hash']){
 const {adapter,state,files}=adapterFor(failure);
 const checkpointPath='restauraciones/puntos-vuelta/'+jobId+'.totusbackup';
 Object.assign(state.job,{status:'prepared',before_revision:snapshot.revision,checkpoint_path:checkpointPath});
 files.set('checkpoint/'+checkpointPath,built.bytes);
 for(const file of plan.files)files.set(file.bucket+'/'+file.target,initialFiles.get(file.bucket+'/'+file.path));
 const resumedSnapshot=failure==='revision'?{...snapshot,revision:'c'.repeat(64)}:snapshot;
 const run=()=>runApplicationRecovery({archive,snapshot:resumedSnapshot,jobId,JSZip,adapter});
 if(failure){await assert.rejects(run);assert.equal(state.commits,0);assert.deepEqual(state.live,{unchanged:true})}
 else{await run();assert.equal(state.commits,1);assert.equal(state.job.status,'committed')}
 assert.equal(state.writes,0,'Resume must verify existing prepared files without replacing them');
}
console.log('RECOVERY CORE QA: authors, historic assets, ZIP limits, checkpoints, concurrent writes, lost responses, idempotent retry and prepared resume OK');
