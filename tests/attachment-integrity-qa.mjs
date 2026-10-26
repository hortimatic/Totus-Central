import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {PDFDocument} from 'pdf-lib';
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

 const attachment=await browser.newPage();
 await attachment.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 const before=await attachment.evaluate(async()=>{
  const db=window.__mockDb,id=crypto.randomUUID(),day=new Date().toLocaleDateString('en-CA');
  const expense={id,store_id:db.ops_stores[0].id,expense_date:day,supplier_name:'Factura todavía sin emitir',description:'Pago registrado',gross_expense:45,accounting_amount:45,amount_paid:45,paid_status:'pagado',paid_date:day,management_only:true,fiscal_reviewed:false,source_ref:JSON.stringify({kind:'bank_payment_source',requires_invoice_reconciliation:true})};
  db.ops_expenses.push(expense);await(await import('../src/api.js')).loadCore();return expense;
 });
 await attachment.locator('#nav [data-route="gastos"]').click();
 await attachment.locator('[data-action="expense-edit"][data-id="'+before.id+'"]').click();
 await attachment.locator('#exFile').setInputFiles({name:'invoice-arrived.txt',mimeType:'text/plain',buffer:Buffer.from('Original supplier document')});
 await attachment.locator('[data-action="expense-attach-save"]').click();
 await attachment.getByText('Factura adjuntada al mismo gasto. Importes y revisión fiscal conservados.',{exact:true}).waitFor();
 const after=await attachment.evaluate(id=>({expense:window.__mockDb.ops_expenses.find(x=>x.id===id),count:window.__mockDb.ops_expenses.length}),before.id);
 assert.equal(after.count,1);assert(after.expense.document_id);
 for(const key of Object.keys(before))assert.deepEqual(after.expense[key],before[key],'Attachment must preserve '+key);
 assert.equal(await attachment.evaluate(id=>window.__mockDb.ops_documents.filter(d=>d.id===id).length,after.expense.document_id),1);
 await attachment.close();

 const detach=await browser.newPage(),detachErrors=[];detach.on('pageerror',e=>detachErrors.push(e.message));
 await detach.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 const detachIds=await detach.evaluate(async()=>{
  const db=window.__mockDb,expense=crypto.randomUUID(),before=crypto.randomUUID(),after=crypto.randomUUID(),day=new Date().toLocaleDateString('en-CA');
  for(const [id,name] of [[before,'original.txt'],[after,'sustituto.txt']]){
   db.ops_documents.push({id,document_date:day,doc_type:'factura_recibida',status:'archivada',original_name:name,mime_type:'text/plain',storage_path:'qa/'+id+'.txt',size_bytes:8});
   window.__mockUploads.set('business-documents/qa/'+id+'.txt',new Blob(['ORIGINAL']));
  }
  db.ops_expenses.push({id:expense,store_id:db.ops_stores[0].id,expense_date:day,supplier_name:'QA asociación concurrente',description:'Ensayo ficticio',gross_expense:45,accounting_amount:45,management_only:true,paid_status:'pagado',document_id:before});
  await(await import('../src/api.js')).loadCore();return {expense,before,after};
 });
 await detach.locator('#nav [data-route="gastos"]').click();
 await detach.locator('[data-action="expense-edit"][data-id="'+detachIds.expense+'"]').click();
 await detach.evaluate(()=>window.confirm=()=>false);
 await detach.locator('[data-action="expense-document-unlink"]').click();
 assert.equal(await detach.evaluate(id=>window.__mockDb.ops_expenses.find(x=>x.id===id).document_id,detachIds.expense),detachIds.before,'Cancel must preserve the association');
 await detach.evaluate(ids=>window.confirm=()=>{window.__mockDb.ops_expenses.find(x=>x.id===ids.expense).document_id=ids.after;return true;},detachIds);
 await detach.locator('[data-action="expense-document-unlink"]').click();
 await detach.getByText(/El registro ha cambiado o ya no tienes permiso/).waitFor();
 assert.equal(await detach.evaluate(id=>window.__mockDb.ops_expenses.find(x=>x.id===id).document_id,detachIds.expense),detachIds.after,'A stale detach must not clear a replacement association');
 await detach.evaluate(async()=>{window.confirm=()=>true;await(await import('../src/api.js')).loadCore();});
 await detach.locator('[data-action="expense-back"]').first().click();
 await detach.locator('[data-action="expense-edit"][data-id="'+detachIds.expense+'"]').click();
 await detach.locator('[data-action="expense-document-unlink"]').click();
 await detach.getByText('Justificante desvinculado. El archivo original se conserva en Documentos.',{exact:true}).waitFor();
 assert.deepEqual(await detach.evaluate(ids=>{
  const db=window.__mockDb,e=db.ops_expenses.find(x=>x.id===ids.expense);
  return {document:e.document_id,amount:e.gross_expense,accounting:e.accounting_amount,originals:db.ops_documents.filter(d=>[ids.before,ids.after].includes(d.id)).length,files:window.__mockUploads.size};
 },detachIds),{document:null,amount:45,accounting:45,originals:2,files:2});
 assert.deepEqual(detachErrors,[]);await detach.close();


 const receipt=await browser.newPage();
 await receipt.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 const taxBefore=await receipt.evaluate(async()=>{
  const id=crypto.randomUUID(),day=new Date().toLocaleDateString('en-CA');
  const row={id,tax_type:'130',fiscal_year:Number(day.slice(0,4)),quarter:Math.ceil(Number(day.slice(5,7))/3),period_label:'Periodo de prueba',payment_date:day,amount:123.45,status:'pagado',notes:'Preservar el pago original'};
  window.__mockDb.ops_tax_payments.push(row);await(await import('../src/api.js')).loadCore();return row;
 });
 await receipt.locator('#nav [data-route="gastos"]').click();
 await receipt.locator('[data-action="tax-payment-receipt"][data-id="'+taxBefore.id+'"]').click();
 const pdf=await PDFDocument.create();pdf.addPage();const pdfBytes=await pdf.save();
 await receipt.locator('#txReceiptFile').setInputFiles({name:'bank-receipt.pdf',mimeType:'application/pdf',buffer:Buffer.from(pdfBytes)});
 await receipt.locator('[data-action="tax-payment-receipt-save"]').click();
 await receipt.getByText('Justificante bancario guardado. El pago y sus importes no han cambiado.',{exact:true}).waitFor();
 const taxAfter=await receipt.evaluate(id=>({payment:window.__mockDb.ops_tax_payments.find(p=>p.id===id),expenses:window.__mockDb.ops_expenses.length}),taxBefore.id);
 assert(taxAfter.payment.document_id);assert.equal(taxAfter.expenses,0,'A tax receipt must never create an expense');
 for(const key of Object.keys(taxBefore))assert.deepEqual(taxAfter.payment[key],taxBefore[key],'Receipt must preserve tax '+key);
 const receiptDoc=await receipt.evaluate(id=>window.__mockDb.ops_documents.find(d=>d.id===id),taxAfter.payment.document_id);
 assert.equal(receiptDoc.linked_entity_type,'tax_payment');assert.equal(receiptDoc.linked_entity_id,taxBefore.id);assert.equal(receiptDoc.doc_type,'impuesto');
 assert.equal(await receipt.locator('[data-action="tax-payment-document-preview"][data-id="'+taxBefore.id+'"]').count(),1);
 assert.equal(await receipt.locator('[data-action="tax-payment-document-download"][data-id="'+taxBefore.id+'"]').count(),1);
 await receipt.close();


 // A tax receipt can predate the reverse-link metadata. Its canonical payment
 // reference must prevent file deletion before any Storage operation.
 const taxGuard=await browser.newPage();
 await taxGuard.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 const legacyTaxDoc=await taxGuard.evaluate(async()=>{
  const db=window.__mockDb,id=crypto.randomUUID(),day=new Date().toLocaleDateString('en-CA');
  db.ops_documents.push({id,document_date:day,doc_type:'impuesto',status:'archivada',original_name:'tax-reference.txt',mime_type:'text/plain',storage_path:'qa/tax-reference.txt',size_bytes:8,uploaded_by:db.profiles[0].id});
  db.ops_tax_payments.push({id:crypto.randomUUID(),tax_type:'130',fiscal_year:Number(day.slice(0,4)),quarter:Math.ceil(Number(day.slice(5,7))/3),payment_date:day,amount:123,status:'pagado',document_id:id});
  window.__mockUploads.set('business-documents/qa/tax-reference.txt',new Blob(['TAX FILE']));
  await(await import('../src/api.js')).loadCore();return id;
 });
 await taxGuard.locator('#nav [data-route="documentos"]').click();
 await taxGuard.locator('[data-action="document-delete"][data-id="'+legacyTaxDoc+'"]').click();
 await taxGuard.getByText('Este documento está vinculado a otro registro. Quita primero el vínculo desde su ficha.',{exact:true}).waitFor();
 assert.equal(await taxGuard.locator('[data-confirm="accept"]').count(),0);
 assert.equal(await taxGuard.evaluate(()=>window.__mockUploads.size),1,'Tax receipt must survive attempted deletion');
 assert.equal(await taxGuard.evaluate(id=>window.__mockDb.ops_documents.some(d=>d.id===id),legacyTaxDoc),true);
 assert.equal(await taxGuard.evaluate(id=>window.__mockDb.ops_tax_payments[0].document_id===id,legacyTaxDoc),true);
 await taxGuard.close();

 const failure=await browser.newPage();
 await failure.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await failure.locator('#nav [data-route="gastos"]').click();await failure.locator('[data-action="expense-new"]').click();
 await failure.locator('#exSupplier').fill('Proveedor de prueba de fallos');await failure.locator('#exInvoice').fill('QA-FAIL-001');
 await failure.locator('#exLineDesc_0').fill('Concepto');await failure.locator('#exLineBase_0').fill('10');
 await failure.locator('#exFile').setInputFiles({name:'recoverable.txt',mimeType:'text/plain',buffer:Buffer.from('Keep this file')});
 await failure.evaluate(()=>{
  const client=window.supabase.createClient(),original=client.rpc;let rejected=false;
  client.rpc=async(...args)=>{if(args[0]==='totus_save_expense'&&!rejected){rejected=true;return {data:null,error:{message:'Injected transaction failure',code:'P0001'}}}return original(...args)};
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
