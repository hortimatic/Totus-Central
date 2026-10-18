import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:950}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 const id=await page.evaluate(async()=>{
  const db=window.__mockDb,id=crypto.randomUUID(),day=new Date().toLocaleDateString('en-CA');
  db.ops_documents.push({id,store_id:db.ops_stores[0].id,document_date:day,doc_type:'factura_emitida',status:'archivada',original_name:'original.txt',mime_type:'text/plain',storage_path:'qa/issued.txt',size_bytes:8,uploaded_by:db.profiles[0].id});
  db.ops_sales_invoices.push({id:crypto.randomUUID(),document_type:'factura',status:'emitida',source_document_id:id,issue_date:day,total_amount:121});
  window.__mockUploads.set('business-documents/qa/issued.txt',new Blob(['ORIGINAL']));
  await (await import('../src/api.js')).loadCore();return id;
 });
 await page.locator('#nav [data-route="documentos"]').click();await page.locator('[data-action="document-edit"][data-id="'+id+'"]').click();
 assert.equal(await page.locator('#docFile').isDisabled(),true,'Issued original must not offer replacement');
 assert.equal(await page.locator('[data-action="document-delete"]').count(),0);
 await page.locator('#docNotes').fill('Clasificación revisada');await page.locator('[data-action="document-save"]').click();
 await page.getByText('Documento actualizado.',{exact:true}).waitFor();
 assert.equal(await page.evaluate(async()=>window.__mockUploads.get('business-documents/qa/issued.txt').text()),'ORIGINAL');
 assert.equal(await page.evaluate(id=>window.__mockDb.ops_documents.find(x=>x.id===id).notes,id),'Clasificación revisada');
 assert.deepEqual(errors,[]);await page.close();
 const failure=await browser.newPage();
 await failure.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await failure.locator('#nav [data-route="gastos"]').click();await failure.locator('[data-action="expense-new"]').click();
 await failure.locator('#exSupplier').fill('Proveedor de prueba de fallos');await failure.locator('#exInvoice').fill('QA-FAIL-001');
 await failure.locator('#exLineDesc_0').fill('Concepto');await failure.locator('#exLineBase_0').fill('10');
 await failure.locator('#exFile').setInputFiles({name:'recoverable.txt',mimeType:'text/plain',buffer:Buffer.from('Keep this file')});
 await failure.evaluate(()=>{
  const client=window.supabase.createClient(),original=client.rpc;let rejected=false;
  client.rpc=async(...args)=>{if(args[0]==='totus_save_expense'&&!rejected){rejected=true;return {data:null,error:{message:'Injected transaction failure'}}}return original(...args)};
  window.__mockStorageRemoveError=true;
 });
 await failure.locator('[data-action="expense-save"]').first().click();
 await failure.getByText(/No se ha podido completar la retirada del adjunto/).waitFor();
 assert.deepEqual(await failure.evaluate(()=>({expenses:window.__mockDb.ops_expenses.length,documents:window.__mockDb.ops_documents.length,files:window.__mockUploads.size})),{expenses:0,documents:1,files:1});
 await failure.evaluate(()=>window.__mockStorageRemoveError=false);
 await failure.locator('[data-action="expense-save"]').first().click();await failure.getByText('Gasto guardado.',{exact:true}).waitFor();
 assert.equal(await failure.evaluate(()=>window.__mockDb.ops_expenses.length),1);
 assert.equal(await failure.evaluate(()=>{const db=window.__mockDb,e=db.ops_expenses[0];return db.ops_documents.find(x=>x.id===e.document_id).linked_entity_id===e.id}),true);
 console.log('ATTACHMENT INTEGRITY QA: issued original cannot be replaced/deleted; notes remain editable; a failed transaction and failed cleanup retain the file and metadata; retry creates exactly one linked expense');
}finally{await browser.close()}
