import assert from 'node:assert/strict';
import {retireStoredDocument} from '../src/document-removal.js';
const document={id:'qa-document',storage_path:'qa/original.txt',sha256:'a'.repeat(64)};
for(const failure of ['begin','file','finish',null]){
 const calls=[],error=new Error('Injected '+failure);
 const rpc=async(name,args)=>{calls.push(name);assert.equal(args.p_id,document.id);assert.equal(args.p_path,document.storage_path);assert.equal(args.p_sha256,document.sha256);if(name==='totus_'+failure+'_document_removal')throw error;return {id:args.p_id,status:name.includes('begin')?'pending':'removed'};};
 const removeFile=async(bucket,path)=>{calls.push('remove-file');assert.equal(bucket,'business-documents');assert.equal(path,document.storage_path);if(failure==='file')throw error;};
 if(failure)await assert.rejects(retireStoredDocument(document,{rpc,removeFile}),e=>e===error&&(!['file','finish'].includes(failure)||e.documentRemovalPending===true));
 else assert.equal((await retireStoredDocument(document,{rpc,removeFile})).status,'removed');
 assert.deepEqual(calls,failure==='begin'?['totus_begin_document_removal']:failure==='file'?['totus_begin_document_removal','remove-file']:['totus_begin_document_removal','remove-file','totus_finish_document_removal']);
}
for(const response of [null,{}, {id:'another-file',status:'pending'},{id:document.id,status:'unknown'}]){
 let touched=false;
 await assert.rejects(retireStoredDocument(document,{rpc:async()=>response,removeFile:async()=>{touched=true}}),/No se pudo confirmar la autorización/);
 assert.equal(touched,false);
}
let touches=0,calls=0;
assert.equal((await retireStoredDocument(document,{rpc:async()=>{calls++;return {id:document.id,status:'already_removed'}},removeFile:async()=>{touches++}})).status,'already_removed');
assert.equal(touches,0);assert.equal(calls,1);
console.log('DOCUMENT REMOVAL PROTOCOL QA: rejected begin never touches bytes; Storage/finish failures keep a retryable server intent; success preserves operation order');
