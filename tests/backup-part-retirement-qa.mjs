import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {validateBackupIndex,BACKUP_PART_BYTES} from '../src/backup-index.js';
const source=await fs.readFile(new URL('../supabase/functions/totus-backup-run/index.ts',import.meta.url),'utf8');
const start=source.indexOf('async function retireVerifiedBackupParts('),end=source.indexOf('async function retireVerifiedDocuments(',start);
assert.ok(start>=0&&end>start);
const code=stripTypeScriptTypes(source.slice(start,end));
const id='11111111-1111-4111-8111-111111111111',path='automaticas/test.totusbackup',hash='a'.repeat(64);
const index={format:'totus-backup-parts',version:1,size:2*BACKUP_PART_BYTES,sha256:hash,parts:[0,1].map(n=>({path:path+'.part-'+String(n).padStart(4,'0'),size:BACKUP_PART_BYTES,sha256:hash}))};
let state;
const reset=()=>state={status:'success',version:3,mirror:true,mirrorHash:hash,verified:true,source:'onedrive',root:true,parts:true,removeError:false,removeCalls:0,verifiedCalls:0,audits:0};
const admin={from(table){return {select(){return this},eq(){return this},single(){return this},maybeSingle(){return this},insert(){state.audits++;return {error:null}},then(resolve){return Promise.resolve(table==='ops_backup_runs'?{data:{status:state.status,storage_path:path,size_bytes:index.size,archive_sha256:hash,archive_manifest:{version:state.version}},error:null}:{data:state.mirror?{verified_at:'2026-10-20',archive_sha256:state.mirrorHash,archive_size:index.size}:null,error:null}).then(resolve)}}},
 storage:{from(){return {
  list:async()=>({data:[...(state.root?[{name:'test.totusbackup',metadata:{size:1000}}]:[]),...(state.parts?index.parts.map(p=>({name:p.path.split('/').pop(),metadata:{size:p.size}})):[]),{name:'test.totusbackup-extra',metadata:{size:123}}],error:null}),
  download:async()=>({data:new Blob([JSON.stringify(index)]),error:null}),
  remove:async paths=>{state.removeCalls++;assert.deepEqual(paths,index.parts.map(p=>p.path));if(!state.removeError)state.parts=false;return {error:state.removeError?{message:'failed'}:null}}
 }}}};
const verify=async(_id,source)=>{assert.equal(_id,id);assert.equal(source,'onedrive');state.verifiedCalls++;return {verified:state.verified,source:state.source}};
const run=new Function('admin','verifySavedBackup','validateBackupIndex',code+';return retireVerifiedBackupParts;')(admin,verify,validateBackupIndex);
for(const [field,value]of [['status','expired'],['version',2],['mirror',false],['mirrorHash','b'.repeat(64)],['verified',false],['source','supabase'],['root',false]]){
 reset();state[field]=value;await assert.rejects(()=>run(new Request('https://qa.invalid'),id));assert.equal(state.removeCalls,0,field+' must block deletion');
}
reset();state.removeError=true;await assert.rejects(()=>run(new Request('https://qa.invalid'),id));assert.equal(state.parts,true);
reset();const result=await run(new Request('https://qa.invalid'),id);assert.equal(result.retired,2);assert.equal(result.freed_bytes,index.size);assert.equal(state.root,true);assert.equal(state.audits,1);assert.equal(state.verifiedCalls,1);
assert.equal((await run(new Request('https://qa.invalid'),id)).retired,0);assert.equal(state.removeCalls,1,'A retry must not repeat removal');
reset();await assert.rejects(()=>run(new Request('https://qa.invalid'),'../invalid'));assert.equal(state.removeCalls,0);
console.log('BACKUP PART RETIREMENT QA: complete cloud proof, current reference, exact pieces, retained index, failure handling and idempotency verified');
