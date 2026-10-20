import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {createHash} from 'node:crypto';
const source=await fs.readFile(new URL('../supabase/functions/totus-backup-run/index.ts',import.meta.url),'utf8');
const start=source.indexOf('async function retireVerifiedDocuments('),end=source.indexOf('async function mirrorAfterBackup(',start);
assert.ok(start>=0&&end>start);
const code=stripTypeScriptTypes(source.slice(start,end));
const bytes=new Uint8Array([1,2,3]),digest=createHash('sha256').update(bytes).digest('hex'),path='qa/invoice.pdf';
let state;
function reset(){state={copy:true,version:3,protected:true,remote:bytes,local:bytes,exists:true,retired:false,removeError:false,changed:false,removeCalls:0,docReads:0,audits:[]}}
const query=table=>{let operation='read',value,head=false;return {
 select(_fields,options={}){head=options.head===true;return this},not(){return this},order(){return this},limit(){return this},is(){return this},eq(){return this},single(){return this},maybeSingle(){return this},
 update(v){operation='update';value=v;return this},insert(v){operation='insert';value=v;return this},
 then(resolve,reject){return Promise.resolve().then(()=>{
  if(table==='ops_onedrive_backups')return {data:state.copy?[{run_id:'backup'}]:[],error:null};
  if(table==='ops_backup_runs')return {data:{status:'success',archive_manifest:{version:state.version,integrity:{storage:{'business-documents':state.protected?{[path]:digest}:{}}}}},error:null};
  if(table==='ops_documents'){state.docReads++;return {data:{id:'doc',storage_path:state.changed&&state.docReads>1?'qa/new.pdf':path,size_bytes:3,sha256:digest},error:null}}
  if(table==='ops_onedrive_documents'){
   if(operation==='update'){state.retired=true;return {data:[{document_id:'doc'}],error:null}}
   if(head)return {count:state.retired?0:1,error:null};
   return {data:state.retired?[]:[{document_id:'doc',source_path:path,size_bytes:3,sha256:digest,verified_at:'2026-10-20'}],error:null};
  }
  if(table==='ops_audit_log'&&operation==='insert'){state.audits.push(value);return {data:null,error:null}}
  throw Error('Unexpected table '+table);
 }).then(resolve,reject)}
}};
const admin={from:query,storage:{from:()=>({
 download:async()=>state.exists?{data:new Blob([state.local]),error:null}:{data:null,error:{message:'Object not found',status:404}},
 remove:async()=>{state.removeCalls++;if(state.removeError)return {error:{message:'denied'}};state.exists=false;return {error:null}},
 list:async()=>({data:state.exists?[{name:'invoice.pdf'}]:[],error:null})
})}};
const retire=new Function('admin','oneDriveRead','createHash',code+';return retireVerifiedDocuments;')(admin,async()=>new Blob([state.remote]),createHash);
const req=new Request('https://qa.example.invalid');
reset();state.copy=false;await assert.rejects(()=>retire(req),/copia completa/);assert.equal(state.removeCalls,0);
reset();state.version=2;await assert.rejects(()=>retire(req),/proteger/);assert.equal(state.removeCalls,0);
reset();state.protected=false;let result=await retire(req);assert.equal(result.skipped,1);assert.equal(state.removeCalls,0);
reset();state.remote=new Uint8Array([3,2,1]);result=await retire(req);assert.equal(result.errors.length,1);assert.equal(state.removeCalls,0);assert.ok(state.exists);
reset();state.local=new Uint8Array([3,2,1]);result=await retire(req);assert.equal(result.errors.length,1);assert.equal(state.removeCalls,0);
reset();state.changed=true;result=await retire(req);assert.equal(result.errors.length,1);assert.equal(state.removeCalls,0);
reset();result=await retire(req,false,true);assert.equal(result.checked,1);assert.equal(result.retired,0);assert.equal(state.removeCalls,0);assert.ok(!state.retired&&state.exists);
reset();state.removeError=true;result=await retire(req);assert.equal(result.errors.length,1);assert.ok(state.exists&&!state.retired);
reset();result=await retire(req);assert.equal(result.retired,1);assert.equal(result.freed_bytes,3);assert.equal(result.remaining,0);assert.ok(!state.exists&&state.retired);assert.equal(state.audits.length,1);
reset();state.exists=false;result=await retire(req);assert.equal(result.retired,1);assert.equal(result.freed_bytes,0);assert.equal(state.removeCalls,0);
console.log('DOCUMENT RETIREMENT QA: complete backup required, archive coverage, hashes at both providers, concurrent replacement, dry-run, deletion failure, confirmed removal, audit and interrupted retry verified.');

const wrapperStart=source.indexOf('async function retireDocumentsWithLease('),wrapperEnd=source.indexOf('async function mirrorAfterBackup(',wrapperStart);
assert.ok(wrapperStart>=0&&wrapperEnd>wrapperStart);
const wrapperCode=stripTypeScriptTypes(source.slice(wrapperStart,wrapperEnd));
let lease=null,mode='hold',release,startedResolve;
let started=new Promise(resolve=>startedResolve=resolve);
const leaseAdmin={from:()=>{let patch,expected;const q={
 update(value){patch=value;return q},eq(key,value){if(key==='retirement_lock_until')expected=value;return q},or(){return q},select(){return q},
 async execute(){
  if(patch.retirement_lock_until!==null){
   if(lease&&Date.parse(lease)>Date.now())return {data:null,error:null};
   lease=patch.retirement_lock_until;return {data:{id:1},error:null};
  }
  if(lease===expected)lease=null;
  return {data:null,error:null};
 },
 maybeSingle(){return q.execute()},then(resolve,reject){return q.execute().then(resolve,reject)}
 };return q}};
const leasedRetire=new Function('admin','retireVerifiedDocuments',wrapperCode+';return retireDocumentsWithLease;')(leaseAdmin,async()=>{
 if(mode==='hold'){startedResolve();return await new Promise(resolve=>release=()=>resolve({retired:1}))}
 if(mode==='fail')throw Error('Injected cleanup failure');
 lease='another-worker';return {retired:0};
});
const first=leasedRetire(req);await started;
await assert.rejects(()=>leasedRetire(req),/en curso/);
release();assert.equal((await first).retired,1);assert.equal(lease,null);
mode='fail';await assert.rejects(()=>leasedRetire(req),/Injected/);assert.equal(lease,null);
mode='replaced';await leasedRetire(req);assert.equal(lease,'another-worker','An expired worker must not clear a newer lease');
console.log('DOCUMENT RETIREMENT LEASE QA: concurrent cleanup denied, failed worker released, newer lease preserved.');
