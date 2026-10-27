import assert from 'node:assert/strict';
import {createDocumentRemovalWorker} from '../supabase/functions/totus-onedrive/document-removal-worker.js';
import fs from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {archiveHash} from '../src/recovery-core.js';
let rows=[],files=new Set(),mode='',calls=[];
const rpc=async(name,args)=>{
 calls.push(name);
 if(name==='totus_pending_document_removals')return structuredClone(rows);
 assert.equal(name,'totus_finish_document_removal');
 assert(!files.has(args.p_path),'Metadata must not be removed before the file');
 if(mode==='finish-error'&&args.p_id==='a')throw new Error('Injected finish failure');
 const index=rows.findIndex(r=>r.id===args.p_id);if(index>=0)rows.splice(index,1);
 return {id:args.p_id,status:index<0?'already_removed':'removed'};
};
const worker=createDocumentRemovalWorker({rpc,verifyArchive:async row=>{
 calls.push('archive:'+row.storage_path);if(mode==='archive-error'&&row.id==='a')throw Error('Injected archive failure');
 return {id:row.id,storage_path:row.storage_path,sha256:row.sha256,status:'archive_verified'};
},removeFile:async(bucket,path)=>{
 assert.equal(bucket,'business-documents');calls.push('file:'+path);
 if(mode==='storage-error'&&path==='qa/a.txt')throw new Error('Injected Storage failure');files.delete(path);
}});
assert.deepEqual(await worker(),{completed:0,failed:0,pending:0,errors:[]});
const reset=()=>{rows=['a','b'].map(id=>({id,storage_path:'qa/'+id+'.txt',sha256:''}));files=new Set(rows.map(r=>r.storage_path));calls=[];};
reset();mode='archive-error';let blocked=await worker();assert.equal(blocked.completed,1);assert.equal(blocked.pending,1);assert(files.has('qa/a.txt'));assert(!calls.includes('file:qa/a.txt'),'Archive failure must never remove the only original');
reset();mode='storage-error';let result=await worker();assert.equal(result.completed,1);assert.equal(result.failed,1);assert.equal(result.pending,1);assert.deepEqual(rows.map(r=>r.id),['a']);assert(files.has('qa/a.txt'));
mode='';result=await worker();assert.equal(result.completed,1);assert.equal(result.pending,0);assert.equal(files.size,0);
reset();mode='finish-error';result=await worker();assert.equal(result.completed,1);assert.equal(result.pending,1);assert(!files.has('qa/a.txt'));assert.equal(rows[0].id,'a');
mode='';result=await worker();assert.equal(result.pending,0);assert.equal(rows.length,0);
assert(!calls.includes('totus_begin_document_removal'),'The worker must only process previously authorized intents');
await assert.rejects(worker(0),/Lote/);await assert.rejects(worker(6),/Lote/);
// Execute the actual server copier and archive verifier with isolated transports.
const source=await fs.readFile(new URL('../supabase/functions/totus-onedrive/index.ts',import.meta.url),'utf8');
const copier=source.slice(source.indexOf('async function mirrorOneDocument('),source.indexOf('async function mirrorDocuments('));
const verifier=source.slice(source.indexOf('async function verifyDocumentRemovalArchive('),source.indexOf('async function cleanupPendingDocumentRemovals('));
assert(copier.length>100&&verifier.length>100);
const originalBytes=new Uint8Array([1,2,3]),originalHash=await archiveHash(originalBytes);
let doc,mirrored,remoteBytes,remoteId,connected,proofs,puts,downloads;
const resetArchive=()=>{doc={id:'qa-archive-document',storage_path:'qa/original.txt',sha256:originalHash,size_bytes:3,doc_type:'factura_recibida',document_date:'2026-10-27',original_name:'original.txt',supplier_or_customer:'Proveedor ficticio',invoice_number:'QA-1'};mirrored=null;remoteBytes=new Uint8Array();remoteId='qa-onedrive-item';connected=true;proofs=[];puts=0;downloads=0;};
const archiveAdmin={
 from(table){return {select(){return this},eq(){return this},maybeSingle:async()=>({data:structuredClone(table==='ops_documents'?doc:mirrored),error:null}),upsert:async value=>{assert.equal(table,'ops_onedrive_documents');mirrored=structuredClone(value);return {data:null,error:null};}};},
 storage:{from:bucket=>({download:async path=>{assert.equal(bucket,'business-documents');assert.equal(path,doc.storage_path);downloads++;return {data:new Blob([originalBytes]),error:null};}})},
 rpc:async(name,args)=>{assert.equal(name,'totus_verify_document_removal_archive');assert.equal(args.p_archive_sha256,originalHash);proofs.push(args);return {data:{id:args.p_id,storage_path:args.p_path,sha256:args.p_sha256,status:'archive_verified'},error:null};}
};
const checked=result=>{if(result.error)throw result.error;return result.data;};
const verify=new Function('admin','check','config','token','root','ensurePath','graph','encodedPath','cleanPart','readContent','fileHash',stripTypeScriptTypes(copier+'\n'+verifier)+';return verifyDocumentRemovalArchive;')(
 archiveAdmin,checked,async()=>({connected,tested_at:connected?'QA':null}),async()=> 'fictitious-token',async()=>{},async()=>{},
 async(_token,_path,options={})=>{if(options.method==='PUT'){puts++;remoteBytes=new Uint8Array(options.body).slice();}return new Response(JSON.stringify({id:remoteId}),{status:200});},
 parts=>parts.map(encodeURIComponent).join('/'),value=>value,async()=>remoteBytes.slice().buffer,archiveHash
);
resetArchive();let actual=await verify({id:doc.id,storage_path:doc.storage_path,sha256:doc.sha256});assert.equal(actual.status,'archive_verified');assert.equal(puts,1);assert.equal(downloads,1);assert.equal(proofs.length,1);assert.deepEqual(remoteBytes,originalBytes);
proofs=[];puts=0;actual=await verify({id:doc.id,storage_path:doc.storage_path,sha256:doc.sha256});assert.equal(puts,0,'An existing matching archive must be checked without overwriting it');assert.equal(proofs.length,1);
proofs=[];remoteBytes=new Uint8Array([9,9,9]);await assert.rejects(verify({id:doc.id,storage_path:doc.storage_path,sha256:doc.sha256}),/dañado/);assert.equal(proofs.length,0,'Corrupted remote bytes must never receive a verified proof');
remoteBytes=originalBytes.slice();remoteId='wrong-item';await assert.rejects(verify({id:doc.id,storage_path:doc.storage_path,sha256:doc.sha256}),/no coincide/);assert.equal(proofs.length,0);
resetArchive();connected=false;await assert.rejects(verify({id:doc.id,storage_path:doc.storage_path,sha256:doc.sha256}),/Conecta/);assert.equal(puts,0);assert.equal(downloads,0);assert.equal(proofs.length,0);
resetArchive();await assert.rejects(verify({id:doc.id,storage_path:'another/path',sha256:doc.sha256}),/cambió/);assert.equal(puts,0);
doc=null;assert.equal((await verify({id:'already-removed',storage_path:'qa/old.txt',sha256:''})).status,'already_removed');

// The ordinary user can only authorize its own durable intent. No service key is exposed.
const endpoint=source.slice(source.indexOf('async function completeDocumentRemoval('),source.indexOf('async function documentFileUrl('));
let begun,mirrorRuns=0,scopedHeaders,lastArguments,endpointDoc,endpointFailure;
const completeOnServer=new Function('createClient','url','Deno','check','runDocumentMirror','admin',stripTypeScriptTypes(endpoint)+';return completeDocumentRemoval;')(
 (_url,_key,options)=>{scopedHeaders=options.global.headers;return {rpc:async(name,args)=>{assert.equal(name,'totus_begin_document_removal');lastArguments=args;return {data:begun,error:null};}};},
 'https://qa.invalid',{env:{get:()=> 'QA-NOT-A-REAL-KEY'}},checked,
 async()=>{mirrorRuns++;if(!endpointFailure)endpointDoc=null;return {removals:{errors:endpointFailure?[{id:'other-user',message:'OTHER_PRIVATE_DIAGNOSTIC'}]:[]}};},
 {from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:endpointDoc,error:null})})}
);
const request=new Request('https://qa.invalid',{headers:{Authorization:'Bearer QA-FICTITIOUS'}}),body={id:'target',path:'qa/target',sha256:''};
await assert.rejects(completeOnServer(body,new Request('https://qa.invalid')),/Acceso/);assert.equal(mirrorRuns,0);
begun={id:'wrong',status:'pending'};await assert.rejects(completeOnServer(body,request),/autorización/);assert.equal(mirrorRuns,0);
begun={id:'target',status:'already_removed'};assert.equal((await completeOnServer(body,request)).status,'already_removed');assert.equal(mirrorRuns,0);
begun={id:'target',status:'pending'};endpointDoc={id:'target'};assert.equal((await completeOnServer(body,request)).status,'removed');assert.equal(mirrorRuns,1);assert.deepEqual(scopedHeaders,{Authorization:'Bearer QA-FICTITIOUS'});assert.deepEqual(lastArguments,{p_id:'target',p_path:'qa/target',p_sha256:''});
endpointDoc={id:'target'};endpointFailure=true;await assert.rejects(completeOnServer(body,request),error=>/pendiente/.test(error.message)&&!error.message.includes('OTHER_PRIVATE_DIAGNOSTIC'));
console.log('DOCUMENT REMOVAL WORKER QA: verified archive before removal, missing/corrupt/foreign archive rejection, isolated user authorization, retries and retained originals verified');
