import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import JSZip from 'jszip';
import {RECOVERY_TABLES,buildRecoveryArchive,readRecoveryArchive,archiveHash} from '../src/recovery-core.js';
import {writeBackupObject,readBackupObject} from '../src/backup-transport.js';
const code=(await fs.readFile(new URL('../supabase/functions/totus-backup-run/native-zip.js',import.meta.url),'utf8')).replace('npm:fflate@0.8.3',import.meta.resolve('fflate'));
const {NativeBackupZip,SegmentedBackupZip}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const id='11111111-1111-4111-8111-111111111111';
const database=Object.fromEntries(RECOVERY_TABLES.map(t=>[t,[]]));
const files=new Map([['docs/factura con acento á.pdf',randomBytes(1024*1024)],['docs/large.pdf',Buffer.alloc(53*1024*1024,65)]]);
database.ops_documents=[...files.keys()].map((storage_path,i)=>({id:String(i),storage_path,uploaded_by:id}));
const snapshot={database,project_ref:'qa-project',database_instance:id,schema_hash:'a'.repeat(64),revision:'b'.repeat(64),created_at:'2026-10-19T00:00:00Z',identities:[],storage:{'business-documents':[...files.keys()],'business-assets':[]}};
const start=performance.now();
const built=await buildRecoveryArchive(snapshot,NativeBackupZip,async(_b,p)=>files.get(p));
const restored=await readRecoveryArchive(built.bytes,NativeBackupZip,{projectRef:'qa-project'});
await JSZip.loadAsync(built.bytes,{checkCRC32:true});
for(const [p,bytes]of files)assert.equal(await archiveHash(await restored.zip.file('storage/business-documents/'+p).async('uint8array')),await archiveHash(bytes));
await assert.rejects(()=>readRecoveryArchive(built.bytes.slice(0,-1),NativeBackupZip),/ZIP/);
const small=new NativeBackupZip();small.file('small.txt','hello');
assert.equal(await (await JSZip.loadAsync(await small.generateAsync({compression:'STORE'}))).file('small.txt').async('string'),'hello');
const segmented=await buildRecoveryArchive(snapshot,SegmentedBackupZip,async(_b,p)=>files.get(p));
const objects=new Map(),path='private/segmented.totusbackup';
await writeBackupObject(path,segmented.bytes,async(p,b)=>objects.set(p,new Uint8Array(b)),async p=>objects.get(p));
const complete=await readBackupObject(path,async p=>objects.get(p));
assert.equal(await archiveHash(complete),segmented.bytes.sha256);
const checked=await readRecoveryArchive(complete,NativeBackupZip);
assert.deepEqual(checked.manifest.integrity.storage,restored.manifest.integrity.storage);
console.log('NATIVE BACKUP ZIP QA: ordinary ZIP round trip, Unicode paths, original hashes, native compression above 49 MB and STORE compatibility; elapsed '+Math.round(performance.now()-start)+' ms.');

// A full year at the observed nine-month rate fits without retaining the new ZIP.
const {cloudBackupZip}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const cloudObjects=new Map(),cloudPath='private/year.totusbackup',seed=randomBytes(1024*1024);
const paths=Array.from({length:112},(_,i)=>'documents/year-'+i+'.pdf');
const year=structuredClone(snapshot);year.storage['business-documents']=paths;year.database.ops_documents=paths.map((storage_path,i)=>({id:String(i),storage_path,sha256:null}));
let peakPending=0;
const Cloud=cloudBackupZip({path:cloudPath,write:async(p,b)=>cloudObjects.set(p,new Uint8Array(b)),read:async p=>cloudObjects.get(p)});
class TrackedCloud extends Cloud{async flush(final){peakPending=Math.max(peakPending,this.pendingBytes);return super.flush(final)}}
const streamed=await buildRecoveryArchive(year,TrackedCloud,async()=>seed);
assert.equal(streamed.bytes.stored,true);assert.equal(streamed.bytes.segments,undefined);
assert.ok(streamed.bytes.byteLength>112*1024*1024);
assert.ok(peakPending<10*1024*1024,'New archive buffering must stay bounded near one 8 MiB part');
const yearBytes=await readBackupObject(cloudPath,async p=>cloudObjects.get(p));
assert.equal(await archiveHash(yearBytes),streamed.bytes.sha256);
const yearRead=await readRecoveryArchive(yearBytes,NativeBackupZip,{projectRef:'qa-project'});
assert.equal(Object.keys(yearRead.manifest.integrity.storage['business-documents']).length,112);
await JSZip.loadAsync(yearBytes,{checkCRC32:true});
for(const p of [paths[0],paths[111]])assert.equal(await archiveHash(await yearRead.zip.file('storage/business-documents/'+p).async('uint8array')),await archiveHash(seed));
for(const fault of ['write','read']){
 const failed=new Map(),root='private/fail-'+fault+'.totusbackup';
 const Bad=cloudBackupZip({path:root,write:async(p,b)=>{if(fault==='write')throw Error('transfer failed');failed.set(p,new Uint8Array(b))},read:async p=>fault==='read'?new Uint8Array([0]):failed.get(p)});
 await assert.rejects(()=>buildRecoveryArchive(year,Bad,async()=>seed));
 assert.equal(failed.has(root),false,'An incomplete transfer must never publish the root index');
}
console.log('STREAMING BACKUP QA: 112 MiB full archive, ordinary ZIP CRC, bounded part buffer, complete hashes and failed-transfer publication fence OK');
