import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true}),page=await browser.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await page.evaluate(async()=>{
  const api=await import('../src/api.js'),rpc=api.sb.rpc.bind(api.sb);let lost=0;window.__requestKeys=[];
  api.sb.rpc=async(name,args)=>{
   const response=await rpc(name,args);
   if(name==='totus_save_expense'){
    window.__requestKeys.push(args.p_expense.request_id);
    if(lost++<2)return {data:null,error:{message:'Respuesta perdida después de guardar',code:''}};
   }
   return response;
  };
 });
 await page.locator('#nav [data-route="gastos"]').click();await page.locator('[data-action="expense-new"]').click();
 await page.locator('#exSupplier').fill('Proveedor QA doble respuesta perdida');await page.locator('#exInvoice').fill('REPLAY-QA');
 await page.locator('#exLineDesc_0').fill('Compra de prueba');await page.locator('#exLineBase_0').fill('10');await page.locator('#exLineVat_0').fill('0');
 await page.locator('#exFile').setInputFiles({name:'original-replay.txt',mimeType:'text/plain',buffer:Buffer.from('Original ficticio que debe conservarse')});
 await page.locator('[data-action="expense-save"]').click();
 await page.getByText(/No se ha podido confirmar el guardado/).last().waitFor();
 assert.equal(await page.evaluate(()=>window.__mockDb.ops_expenses.length),1);
 assert.equal(await page.evaluate(()=>window.__mockDb.ops_documents.length),1);
 await page.locator('[data-action="expense-save"]').click();
 await page.getByText('Guardado confirmado. No se ha creado otro registro.',{exact:true}).last().waitFor();
 const result=await page.evaluate(()=>({expenses:window.__mockDb.ops_expenses.length,documents:window.__mockDb.ops_documents.length,files:window.__mockUploads.size,keys:window.__requestKeys,linked:window.__mockDb.ops_expenses[0].document_id===window.__mockDb.ops_documents[0].id}));
 assert.equal(result.expenses,1);assert.equal(result.documents,1);assert.equal(result.files,1);assert(result.linked);
 assert.equal(result.keys.length,3);assert.equal(new Set(result.keys).size,1);assert(result.keys[0]);assert.deepEqual(errors,[]);
 console.log('BUSINESS WRITE BROWSER QA: two lost replies and explicit retry retain one request, expense, document and original file');
}finally{await browser.close()}
