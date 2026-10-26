import assert from 'node:assert/strict';
import {createDocumentRemovalWorker} from '../supabase/functions/totus-onedrive/document-removal-worker.js';
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
const worker=createDocumentRemovalWorker({rpc,removeFile:async(bucket,path)=>{
 assert.equal(bucket,'business-documents');calls.push('file:'+path);
 if(mode==='storage-error'&&path==='qa/a.txt')throw new Error('Injected Storage failure');files.delete(path);
}});
assert.deepEqual(await worker(),{completed:0,failed:0,pending:0,errors:[]});
const reset=()=>{rows=['a','b'].map(id=>({id,storage_path:'qa/'+id+'.txt',sha256:''}));files=new Set(rows.map(r=>r.storage_path));calls=[];};
reset();mode='storage-error';let result=await worker();assert.equal(result.completed,1);assert.equal(result.failed,1);assert.equal(result.pending,1);assert.deepEqual(rows.map(r=>r.id),['a']);assert(files.has('qa/a.txt'));
mode='';result=await worker();assert.equal(result.completed,1);assert.equal(result.pending,0);assert.equal(files.size,0);
reset();mode='finish-error';result=await worker();assert.equal(result.completed,1);assert.equal(result.pending,1);assert(!files.has('qa/a.txt'));assert.equal(rows[0].id,'a');
mode='';result=await worker();assert.equal(result.pending,0);assert.equal(rows.length,0);
assert(!calls.includes('totus_begin_document_removal'),'The worker must only process previously authorized intents');
await assert.rejects(worker(0),/Lote/);await assert.rejects(worker(6),/Lote/);
console.log('DOCUMENT REMOVAL WORKER QA: independent server batches, Storage/finish failure isolation, retained intents and interrupted retries verified');
