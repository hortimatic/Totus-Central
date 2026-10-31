import {clickModuleLink} from './ui-navigation.mjs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await page.locator('#userCard').waitFor({state:'visible'});
 const id=await page.evaluate(async()=>{
  const api=await import('../src/api.js'),db=window.__mockDb,id=crypto.randomUUID(),day=new Date().toLocaleDateString('en-CA');
  db.ops_expenses.push({id,store_id:db.ops_stores[0].id,expense_date:day,supplier_name:'QA respuesta perdida',description:'Pago QA',gross_expense:45,amount_paid:45,paid_status:'pagado',paid_date:day,management_only:true,fiscal_reviewed:false});
  const from=api.sb.from.bind(api.sb);let loseOnce=true;
  api.sb.from=table=>{const q=from(table),result=q.result.bind(q);q.result=()=>{const response=result();if(loseOnce&&table==='ops_expenses'&&q.mode==='update'&&q.value?.document_id){loseOnce=false;return {data:null,error:{message:'TypeError: Failed to fetch',code:'',details:'Response lost after commit'}};}return response;};return q;};
  await api.loadCore();return id;
 });
 await clickModuleLink(page,page.locator('#nav [data-route="gastos"]'));
 await page.locator('[data-action="expense-edit"][data-id="'+id+'"]').click();
 await page.locator('#exFile').setInputFiles({name:'receipt-qa.txt',mimeType:'text/plain',buffer:Buffer.from('Original que debe conservarse')});
 await page.locator('[data-action="expense-attach-save"]').click();
 await page.locator('#toastHost .toast').first().waitFor();
 const after=await page.evaluate(id=>{const e=window.__mockDb.ops_expenses.find(x=>x.id===id),d=window.__mockDb.ops_documents.find(x=>x.id===e.document_id);return {documentId:e.document_id,documentExists:!!d,fileExists:!!d&&window.__mockUploads.has('business-documents/'+d.storage_path),expenses:window.__mockDb.ops_expenses.length};},id);
 assert(after.documentId,'The committed expense must retain its attachment ID');
 assert(after.documentExists,'A lost reply after COMMIT must never delete the associated document');
 assert(after.fileExists,'A lost reply after COMMIT must never delete the original file');
 assert.equal(after.expenses,1);
 const payment=await page.evaluate(async()=>{
  const api=await import('../src/api.js'),from=api.sb.from.bind(api.sb);let loseOnce=true;
  api.sb.from=table=>{const q=from(table),result=q.result.bind(q);q.result=()=>{const response=result();if(loseOnce&&table==='ops_tax_payments'&&q.mode==='insert'){loseOnce=false;return {data:null,error:{message:'Respuesta perdida después de guardar',code:''}};}return response;};return q;};
  const saved=await api.insert('ops_tax_payments',{tax_type:'130',fiscal_year:2026,quarter:4,period_label:'4T 2026',payment_date:null,amount:50.2,status:'previsto',notes:'QA lectura de confirmación'});
  return {id:saved.id,rows:window.__mockDb.ops_tax_payments.length,amount:saved.amount};
 });
 assert(payment.id);assert.equal(payment.rows,1);assert.equal(payment.amount,50.2);
 console.log('AMBIGUOUS WRITE BROWSER QA: committed attachment survives a lost response without duplicate accounting records');
}finally{await browser.close()}
