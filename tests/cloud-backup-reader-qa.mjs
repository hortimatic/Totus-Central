import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {createCloudBackupReader} from '../src/cloud-backup-reader.js';
import {createPartitionedBackup} from '../supabase/functions/totus-backup-run/partitioned-job.js';
import {readBackupObject} from '../src/backup-transport.js';
import {RECOVERY_TABLES,readRecoveryArchive} from '../src/recovery-core.js';
const native=(await fs.readFile('supabase/functions/totus-backup-run/native-zip.js','utf8')).replace('npm:fflate@0.8.3',import.meta.resolve('fflate'));
const {NativeBackupZip}=await import('data:text/javascript;base64,'+Buffer.from(native).toString('base64'));
const root='automaticas/test.totusbackup',id='11111111-1111-4111-8111-111111111111';
const database=Object.fromEntries(RECOVERY_TABLES.map(t=>[t,[]]));
const original=new Uint8Array([1,2,3]),hash=NativeBackupZip.archiveHash,files=Array.from({length:63},(_,i)=>'docs/'+i+'.pdf');
database.ops_documents=files.map((storage_path,i)=>({id:String(i),storage_path,sha256:null}));
const snapshot={database,project_ref:'qa-project',database_instance:id,schema_hash:'a'.repeat(64),revision:'b'.repeat(64),created_at:'2026-10-22T00:00Z',identities:[],storage:{'business-documents':files,'business-assets':[]},source_revision:'c'.repeat(40)};
const objects=new Map(),codeZip=new NativeBackupZip();codeZip.file('README.md','Source');
const engine=createPartitionedBackup({Zip:NativeBackupZip,hash,readOriginal:async()=>original,writeComponent:async(p,b)=>objects.set(p,b),readCode:async()=>({bytes:await codeZip.generateAsync({compression:'STORE'}),revision:snapshot.source_revision})});
let result={job:await engine.start(snapshot,root)};while(!result.complete)result=await engine.advance(result.job);
let lookups=0,prepares=0,locals=0,reads=0;
const inventory={files:[...objects.keys()].map((path,i)=>({path,url:'https://qa.invalid/'+i}))};
const setup=(overrides={})=>createCloudBackupReader({lookup:async p=>{lookups++;assert.equal(p,root);return {id,storage_provider:'onedrive'};},prepare:async copy=>{prepares++;assert.equal(copy,id);return inventory;},readLocal:async()=>{locals++;return null;},fetchFile:async(address,options)=>{reads++;assert.equal(options.headers,undefined,'Private download URLs must not receive authentication headers');const file=inventory.files.find(f=>f.url===address);assert.ok(file);return new Response(objects.get(file.path));},...overrides});
const reader=setup(),handle=await readBackupObject(root,reader,hash,result.index.sha256);
const archive=await readRecoveryArchive(handle,NativeBackupZip,{projectRef:'qa-project'});
assert.equal(archive.manifest.storage['business-documents'].length,63);assert.deepEqual(archive.database,database);
assert.equal(lookups,1);assert.equal(prepares,1);assert.equal(locals,0);assert.ok(reads>objects.size,'Exercise repeated reads without repeated provider queries');
for(const bad of [
 {files:[{path:root,url:'http://qa.invalid'}]},
 {files:[{path:'another/copy',url:'https://qa.invalid'}]},
 {files:[inventory.files[0],inventory.files[0]]},
 {files:[]}
])await assert.rejects(()=>setup({prepare:async()=>bad})(root));
await assert.rejects(()=>setup()('../unsafe'));
await assert.rejects(()=>setup({prepare:async()=>({files:[inventory.files[0]]})})(root+'.datos-0000.zip'));
const local=setup({lookup:async()=>null,readLocal:async()=>new Blob([original])});assert.deepEqual(new Uint8Array(await (await local(root)).arrayBuffer()),original);
const fallback=setup({lookup:async()=>({id,storage_provider:'supabase'})});await fallback(root);
const failure=setup({fetchFile:async()=>new Response('',{status:503})});await assert.rejects(()=>failure(root));
const source=await fs.readFile('supabase/functions/totus-backup-run/index.ts','utf8');
const extracted=stripTypeScriptTypes(source.slice(source.indexOf('async function verifySavedBackup('),source.indexOf('async function verifiedCloudLocation(')));
let providerCalls=0,rehearsals=0;
const run={id,status:'success',storage_path:root,storage_provider:'onedrive',archive_sha256:result.index.sha256};
const query={select(){return this},eq(){return this},single:async()=>({data:run,error:null})};
const admin={from:()=>query,storage:{from(){throw Error('A verified OneDrive copy must not probe Supabase per component');}},rpc:async(name,args)=>{assert.equal(name,'totus_verify_recovery_rows');assert.deepEqual(args.p_payload,database);rehearsals++;return {data:{verified:true,tables:38},error:null};}};
const oneDriveAction=async(req,action,args)=>{providerCalls++;assert.equal(action,'backup-file-urls');assert.equal(args.run_id,id);return inventory;};
const realReader=options=>createCloudBackupReader({...options,fetchFile:async address=>new Response(objects.get(inventory.files.find(f=>f.url===address).path))});
const verify=Function('admin','readBackupObject','NativeBackupZip','readRecoveryArchive','SUPABASE_URL','oneDriveAction','createCloudBackupReader',extracted+';return verifySavedBackup;')(admin,readBackupObject,NativeBackupZip,readRecoveryArchive,'https://qa-project.supabase.co',oneDriveAction,realReader);
const verified=await verify(id,'onedrive',new Request('https://qa.invalid'));
assert.equal(verified.verified,true);assert.equal(verified.files['business-documents'],63);assert.equal(providerCalls,1);assert.equal(rehearsals,1);
console.log('CLOUD BACKUP READER QA: multipart verification and actual handler; one private inventory lookup; repeated component reads, local legacy, fallback, wrong paths and unsafe URLs covered.');
