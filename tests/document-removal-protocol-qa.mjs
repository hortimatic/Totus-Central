import assert from 'node:assert/strict';
import {retireStoredDocument} from '../src/document-removal.js';
const document={id:'qa-document',storage_path:'qa/original.txt',sha256:'a'.repeat(64)};
for(const failure of ['begin','server',null]){
 const calls=[],error=new Error('Injected '+failure);
 const rpc=async(name,args)=>{calls.push(name);assert.equal(name,'totus_begin_document_removal');assert.equal(args.p_id,document.id);assert.equal(args.p_path,document.storage_path);assert.equal(args.p_sha256,document.sha256);if(failure==='begin')throw error;return {id:args.p_id,status:'pending'};};
 const completeRemoval=async doc=>{calls.push('server-archive-and-remove');assert.equal(doc,document);if(failure==='server')throw error;return {id:doc.id,status:'removed'};};
 if(failure)await assert.rejects(retireStoredDocument(document,{rpc,completeRemoval}),e=>e===error&&(failure==='begin'||e.documentRemovalPending===true));
 else assert.equal((await retireStoredDocument(document,{rpc,completeRemoval})).status,'removed');
 assert.deepEqual(calls,failure==='begin'?['totus_begin_document_removal']:failure==='server'?['totus_begin_document_removal','server-archive-and-remove','totus_begin_document_removal']:['totus_begin_document_removal','server-archive-and-remove']);
}
for(const response of [null,{}, {id:'another-file',status:'pending'},{id:document.id,status:'unknown'}]){
 let touched=false;
 await assert.rejects(retireStoredDocument(document,{rpc:async()=>response,completeRemoval:async()=>{touched=true}}),/No se pudo confirmar la autorización/);
 assert.equal(touched,false);
}
let touches=0,calls=0;
assert.equal((await retireStoredDocument(document,{rpc:async()=>{calls++;return {id:document.id,status:'already_removed'}},completeRemoval:async()=>{touches++}})).status,'already_removed');
assert.equal(touches,0);assert.equal(calls,1);
let complete=false;
assert.equal((await retireStoredDocument(document,{rpc:async()=>({id:document.id,status:complete?'already_removed':'pending'}),completeRemoval:async()=>{complete=true;throw Error('Reply lost after server completion');}})).status,'already_removed');
await assert.rejects(retireStoredDocument(document,{rpc:async()=>{throw Error('Must not be called');}}),/Falta el servicio/);
console.log('DOCUMENT REMOVAL PROTOCOL QA: server-only archive/removal, rejected intent, retained pending requests and lost completion reply verified');
