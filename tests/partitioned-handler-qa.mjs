import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {createPartitionedBackup} from '../supabase/functions/totus-backup-run/partitioned-job.js';
import {RECOVERY_TABLES} from '../src/recovery-core.js';
const zipCode=(await fs.readFile('supabase/functions/totus-backup-run/native-zip.js','utf8')).replace('npm:fflate@0.8.3',import.meta.resolve('fflate'));
const {NativeBackupZip}=await import('data:text/javascript;base64,'+Buffer.from(zipCode).toString('base64'));
const full=await fs.readFile('supabase/functions/totus-backup-run/index.ts','utf8');
const extracted=stripTypeScriptTypes(full.slice(full.indexOf('async function partitionedRun('),full.indexOf('async function capacityProbe(')));
const id='11111111-1111-4111-8111-111111111111',original=new Uint8Array([1,2,3]),hash=NativeBackupZip.archiveHash;
const database=Object.fromEntries(RECOVERY_TABLES.map(t=>[t,[]]));database.ops_documents=[{id:'doc',storage_path:'docs/test.pdf',sha256:await hash(original)}];
const snapshot={database,database_instance:id,schema_hash:'a'.repeat(64),revision:'b'.repeat(64),created_at:'2026-10-22T00:00Z',identities:[],storage:{'business-documents':['docs/test.pdf'],'business-assets':[]}};
const before=JSON.stringify(database),code=new NativeBackupZip();code.file('README.md','test source');const codeBytes=await code.generateAsync({compression:'STORE'});
let db,objects,fail,pruned,claims;
function reset(){db={ops_backup_work:[],ops_backup_runs:[],ops_backup_config:[{id:1,destination_folder:'automaticas'}],ops_onedrive_config:[{id:1,connected:true,tested_at:'2026-10-22'}]};objects=new Map();fail=false;pruned=0;claims=0;}
class Query{
 constructor(table){this.table=table;this.filters=[];this.op='select';}
 select(){return this}order(){return this}limit(){return this}
 eq(k,v){this.filters.push(r=>r[k]===v);return this}
 or(){this.filters.push(r=>!r.lease_until||Date.parse(r.lease_until)<Date.now());return this}
 maybeSingle(){this.one=true;return this}single(){this.one=true;return this}
 insert(v){this.op='insert';this.value=v;return this}update(v){this.op='update';this.value=v;return this}delete(){this.op='delete';return this}
 then(resolve,reject){return Promise.resolve().then(()=>{
  let rows=db[this.table].filter(r=>this.filters.every(f=>f(r)));
  if(this.op==='insert'){db[this.table].push(structuredClone(this.value));rows=[this.value];}
  if(this.op==='update')rows.forEach(r=>Object.assign(r,structuredClone(this.value)));
  if(this.op==='delete')db[this.table]=db[this.table].filter(r=>!rows.includes(r));
  return {data:structuredClone(this.one?rows[0]||null:rows),error:null};
 }).then(resolve,reject);}
}
const admin={from:t=>new Query(t),rpc:async(name)=>{
 if(name==='totus_backup_claim'){claims++;db.ops_backup_runs.push({id,status:'running'});return {data:id,error:null};}
 if(name==='totus_export_recovery_snapshot')return {data:structuredClone(snapshot),error:null};
 throw Error('Unexpected RPC '+name);
},storage:{from:()=>({download:async()=>({data:new Blob([original]),error:null}),upload:async(p,b)=>{objects.set(p,new Uint8Array(await b.arrayBuffer()));return {error:null};}})}};
const action=async(_req,name,b)=>{
 if(name==='verify-backup-file'){if(!objects.has(b.path))throw Error('Not saved yet');assert.equal(await hash(objects.get(b.path)),b.sha256);return {verified:true,path:b.path,size:b.size,sha256:b.sha256};}
 if(name==='prepare-backup-upload')return {sessions:b.paths.map(path=>({path,url:'https://upload.invalid/'+encodeURIComponent(path)}))};
 if(name==='prune-backups')return {pruned:true};throw Error(name);
};
const fakeFetch=async(url,options)=>{
 if(url.endsWith('build-info.json'))return Response.json({commit:'c'.repeat(40)});
 if(url.startsWith('https://codeload.github.com/'))return new Response(codeBytes);
 if(url.startsWith('https://upload.invalid/')){if(fail)throw Error('Temporary provider failure');objects.set(decodeURIComponent(new URL(url).pathname.slice(1)),Uint8Array.from(options.body));return new Response(null,{status:201});}
 throw Error(url);
};
const run=new Function('admin','NativeBackupZip','createPartitionedBackup','oneDriveAction','oneDriveRead','fetch','SUPABASE_URL','run','pruneBackups',extracted+';return partitionedRun;')(admin,NativeBackupZip,createPartitionedBackup,action,()=>{throw Error('unexpected read')},fakeFetch,'https://qa-project.supabase.co',()=>{throw Error('legacy fallback')},async()=>{assert.equal(db.ops_backup_runs[0].status,'success');pruned++;return {maximum:10};});
const req=new Request('https://qa.invalid',{method:'POST'});
reset();let result=await run('manual',req);assert(result.pending);assert.equal(db.ops_backup_runs[0].status,'running');
assert.equal(db.ops_backup_work[0].state.snapshot,undefined,'Do not rewrite the full database in every batch');
assert.deepEqual(db.ops_backup_work[0].snapshot.database,database);
const count=objects.size;db.ops_backup_work[0].lease_until=new Date(Date.now()+120000).toISOString();
result=await run('scheduled',req);assert(result.pending);assert.equal(objects.size,count,'Concurrent lease must not write');
db.ops_backup_work[0].lease_until=null;result=await run('scheduled',req);assert(result.pending);
result=await run('scheduled',req);assert.equal(result.status,'success');assert.equal(db.ops_backup_work.length,0);assert.equal(pruned,1);assert.equal(claims,1);
assert.equal(db.ops_backup_runs[0].archive_manifest.bundle_version,4);assert.equal(JSON.stringify(database),before);
reset();fail=true;
for(let i=0;i<5;i++){await assert.rejects(()=>run(i?'scheduled':'manual',req),/Temporary/);if(i<4)assert.equal(db.ops_backup_work[0].state.cursor,0,'A failed upload must not advance the saved inventory');}
assert.equal(db.ops_backup_runs[0].status,'failed');assert.equal(db.ops_backup_work.length,0);assert.equal(pruned,0,'Never rotate previous copies after a failed attempt');
console.log('PARTITIONED HANDLER: actual coordinator, snapshot isolation, leases, cloud resume, code/data closure, failure retries and rotation only after success OK');
