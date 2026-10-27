import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const code=readFileSync(new URL('../supabase/functions/totus-assistant/assistant-attachments.ts',import.meta.url),'utf8');
const {attachChatExpenseDocument,sha256,readExpenseContext,reviewExpenseDocument}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(code)).toString('base64'));
const ids={expense_id:'11111111-1111-4111-8111-111111111111',file_id:'22222222-2222-4222-8222-222222222222',request_id:'33333333-3333-4333-8333-333333333333',expected_updated_at:'2026-10-27T12:00:00Z'};
const user={id:'own-user'};
async function fixture(options={}){
 const bytes=new TextEncoder().encode('%PDF-1.7\nFICTITIOUS TEST\n%%EOF'),hash=await sha256(bytes);
 const expense={id:ids.expense_id,expense_date:'2026-10-18',updated_at:ids.expected_updated_at,store_id:'store',supplier_name:'Example',invoice_number:'EXAMPLE-1',document_id:null,fiscal_reviewed:false,base_amount:19.99,vat_amount:4.20,amount_paid:0,paid_status:'pendiente',accounting_amount:24.19,notes:'Preserve',management_only:false};
 const source={id:ids.file_id,status:'ready',verified_at:ids.expected_updated_at,mime_type:'application/pdf',original_name:'Example.pdf',size_bytes:bytes.length,sha256:hash};
 let doc=null,uploads=0,updates=0,docUpdates=0;const files=new Map();
 const storage={upload:async(path,b)=>{uploads++;files.set(path,new Blob([b]));return {data:{path}}},download:async(path)=>files.has(path)?{data:files.get(path)}:{error:{message:'not found'}}};
 const client={storage:{from:()=>storage},functions:{invoke:async()=>({data:new Blob([options.badBytes?'wrong':bytes])})},from(table){
  const q={mode:'read',payload:null,select(){return q},eq(){return q},is(){return q},insert(p){q.mode='insert';q.payload=p;return q},update(p){q.mode='update';q.payload=p;return q},
   async single(){return q.resolve()},async maybeSingle(){return q.resolve()},async order(){return {data:[{expense_id:expense.id,description:'Example'}]}},resolve(){
    if(table==='ops_business_settings')return {data:{fiscal_regime:'example',estimation_method:'example'}};
    if(table==='ops_stores')return {data:{name:'Example store'}};
    if(table==='ops_chat_files')return {data:options.noChannel?null:source};
    if(table==='ops_documents'){if(q.mode==='insert'){doc={...q.payload};return {data:{...doc}}}if(q.mode==='update'){if(options.docConcurrent)return {data:null};docUpdates++;Object.assign(doc,q.payload)}return {data:doc?{...doc}:null}}
    if(table==='ops_expenses'){if(q.mode==='update'){if(options.concurrent)return {data:null};updates++;Object.assign(expense,q.payload,{updated_at:'2026-10-27T12:01:00Z'});doc.linked_entity_id=expense.id;return {data:{...expense}}}return {data:{...expense}}}
    throw new Error(table);
   }};
  return q;
 }};
 return {client,expense,source,getDoc:()=>doc,getUploads:()=>uploads,getUpdates:()=>updates,getDocUpdates:()=>docUpdates};
}
test('attachment preserves amounts, fiscal review, payment and notes',async()=>{const f=await fixture(),before={...f.expense};const r=await attachChatExpenseDocument(f.client,ids,user);assert(r.sha256_verified);assert.equal(r.document.uploaded_by,user.id);for(const k of Object.keys(before))if(!['document_id','updated_at'].includes(k))assert.deepEqual(r.expense[k],before[k]);assert.equal(f.getUploads(),1)});
test('retry does not upload or attach twice',async()=>{const f=await fixture();await attachChatExpenseDocument(f.client,ids,user);const r=await attachChatExpenseDocument(f.client,ids,user);assert(r.already_attached);assert.equal(f.getUploads(),1);assert.equal(f.getUpdates(),1)});
test('channel denial stops before upload',async()=>{const f=await fixture({noChannel:true});await assert.rejects(attachChatExpenseDocument(f.client,ids,user),/canal/);assert.equal(f.getUploads(),0)});
test('wrong original bytes stop before upload',async()=>{const f=await fixture({badBytes:true});await assert.rejects(attachChatExpenseDocument(f.client,ids,user),/original/);assert.equal(f.getUploads(),0)});
test('stale version cannot attach',async()=>{const f=await fixture();await assert.rejects(attachChatExpenseDocument(f.client,{...ids,expected_updated_at:'2026-10-26T12:00:00Z'},user),/ha cambiado/);assert.equal(f.getUploads(),0)});
test('concurrent edit preserves expense and recoverable document',async()=>{const f=await fixture({concurrent:true});await assert.rejects(attachChatExpenseDocument(f.client,ids,user),/ha cambiado/);assert.equal(f.expense.document_id,null);assert(f.getDoc())});
test('unrelated existing attachment never replaced',async()=>{const f=await fixture();f.expense.document_id='unrelated';await assert.rejects(attachChatExpenseDocument(f.client,ids,user),/no se sustituye/i);assert.equal(f.getUploads(),0)});
test('operation ID required',async()=>{const f=await fixture();await assert.rejects(attachChatExpenseDocument(f.client,{...ids,request_id:null},user),/obligatorias/)});

const review=(f)=>({expense_id:ids.expense_id,document_id:ids.request_id,expected_sha256:f.source.sha256,expected_status:'pendiente',status:'revisada',reason:'Original y conceptos cotejados; fiscalidad pendiente de aclaración.'});
test('document review preserves fiscal review and payment',async()=>{const f=await fixture();await attachChatExpenseDocument(f.client,ids,user);const r=await reviewExpenseDocument(f.client,review(f));assert.equal(r.document.status,'revisada');assert.equal(r.fiscal_reviewed,false);assert.equal(r.payment_status,'pendiente');assert.equal(f.getDocUpdates(),1)});
test('document review retry does not duplicate the reason',async()=>{const f=await fixture();await attachChatExpenseDocument(f.client,ids,user);await reviewExpenseDocument(f.client,review(f));const r=await reviewExpenseDocument(f.client,review(f));assert(r.already_reviewed);assert.equal(f.getDocUpdates(),1)});
test('different hash cannot accept document review',async()=>{const f=await fixture();await attachChatExpenseDocument(f.client,ids,user);await assert.rejects(reviewExpenseDocument(f.client,{...review(f),expected_sha256:'a'.repeat(64)}),/ha cambiado/);assert.equal(f.getDocUpdates(),0)});
test('concurrent document review is not reported as saved',async()=>{const f=await fixture({docConcurrent:true});await attachChatExpenseDocument(f.client,ids,user);await assert.rejects(reviewExpenseDocument(f.client,review(f)),/ha cambiado/);assert.equal(f.getDocUpdates(),0)});
test('authenticated expense context returns actual lines, document and settings without edits',async()=>{const f=await fixture();await attachChatExpenseDocument(f.client,ids,user);const before=f.getUpdates();const r=await readExpenseContext(f.client,{expense_id:ids.expense_id});assert.equal(r.document.id,ids.request_id);assert.equal(r.lines.length,1);assert.equal(r.review_states.fiscal_reviewed,false);assert.equal(r.fiscal_settings.fiscal_regime,'example');assert.equal(f.getUpdates(),before)});


