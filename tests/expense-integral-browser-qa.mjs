import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import XLSX from 'xlsx-js-style';

await fs.mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[];
async function scenario(name,test){
 if(process.env.QA_CASE&&!name.includes(process.env.QA_CASE))return;
 const page=await browser.newPage({viewport:{width:1440,height:1000},locale:'es-ES'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});await test(page);assert.deepEqual(errors,[]);results.push({name,ok:true});console.log('PASS '+name)}
 catch(error){results.push({name,ok:false,error:error.message});console.error('FAIL '+name+': '+error.message)}
 finally{await page.close()}
}
const nav=page=>page.locator('#nav [data-route="gastos"]').click();
async function create(page){await nav(page);await page.locator('[data-action="expense-new"]').click();await page.locator('#exSupplier').fill('Proveedor integral QA');await page.locator('#exInvoice').fill('INTEGRAL-QA');await page.locator('#exLineDesc_0').fill('Concepto QA')}
async function seed(page){return page.evaluate(async()=>{
 const db=window.__mockDb,day=new Date().toLocaleDateString('en-CA'),store=db.ops_stores[0].id;
 const invoice={id:'77777777-7777-4777-8777-777777777771',store_id:store,expense_date:day,supplier_name:'INTERNET INTELIGENTE SLU',supplier_tax_id:'QA123',invoice_number:'B/QA',description:'Mercancía QA',base_amount:100,vat_amount:21,re_amount:5.2,withholding_amount:0,gross_expense:126.2,accounting_amount:126.2,amount_paid:126.2,paid_status:'pagado',paid_date:day,management_only:false,fiscal_reviewed:true,document_kind:'factura'};
 const bank={...invoice,id:'77777777-7777-4777-8777-777777777772',supplier_name:'Apunte Excel: Vaperalia',management_only:true,source_ref:JSON.stringify({kind:'bank_payment_source',requires_invoice_reconciliation:true,related_invoice_expense_id:invoice.id,relation_status:'reconciled'})};
 const internal={...invoice,id:'77777777-7777-4777-8777-777777777773',supplier_name:'Control interno QA',supplier_tax_id:'',invoice_number:'INTERNAL-QA',management_only:true,fiscal_reviewed:false,gross_expense:50,accounting_amount:50,base_amount:50,vat_amount:0,re_amount:0,amount_paid:50,document_kind:'otro'};
 db.ops_expenses.push(invoice,bank,internal);
 db.ops_expense_lines.push({id:'integral-line',expense_id:invoice.id,description:invoice.description,base_amount:100,vat_rate:21,re_rate:5.2,withholding_rate:0,deductible_irpf:true,deductible_pct:100,irpf_imputable:126.2});
 db.ops_tax_payments.push({id:'integral-tax',tax_type:'130',fiscal_year:2026,quarter:3,amount:20,status:'pagado',payment_date:day,period_label:'3T 2026'});
 await(await import('../src/api.js')).loadCore();return {store,day};
})}
try{
 await scenario('Importes inválidos y base pendiente no se convierten en cero',async p=>{
  await create(p);await p.locator('#exLineBase_0').fill('12,xx');assert.match(await p.locator('#exSumTotal').innerText(),/Revisa/);
  await p.locator('[data-action="expense-save"]').click();assert.equal(await p.evaluate(()=>window.__mockDb.ops_expenses.length),0);
  await p.locator('#exLineBase_0').fill('');await p.locator('[data-action="expense-save"]').click();assert.equal(await p.evaluate(()=>window.__mockDb.ops_expenses.length),0);
  await p.locator('#exLineBase_0').fill('100');await p.locator('#exLineVat_0').fill('21');assert.match(await p.locator('#exSumTotal').innerText(),/121,00/);
 });
 await scenario('Pago parcial exige fecha igual que Registrar pago',async p=>{
  await create(p);await p.locator('#exLineBase_0').fill('100');await p.locator('#exPaidStatus').selectOption('parcial');await p.locator('#exPaidAmount').fill('50');await p.locator('#exPaidDate').fill('');
  await p.locator('[data-action="expense-save"]').click();assert.equal(await p.evaluate(()=>window.__mockDb.ops_expenses.length),0);
  await p.locator('#exPaidDate').fill(new Date().toLocaleDateString('en-CA'));await p.locator('[data-action="expense-save"]').click();await p.getByText('Gasto guardado.',{exact:true}).waitFor();
  assert.equal(await p.evaluate(()=>window.__mockDb.ops_expenses[0].amount_paid),50);
 });
 await scenario('Proveedor aplica tipo, NIF, pago e impuestos sin borrar un NIF vacío anterior',async p=>{
  await p.evaluate(async()=>{window.__mockDb.ops_suppliers.push({id:'integral-supplier',name:'Proveedor nómina QA',tax_id:null,active:true,default_document_kind:'nomina',default_payment_method:'transferencia',default_vat_rate:0,default_re_rate:0,default_withholding_rate:15,default_withholding_model:'111',default_deductible_pct:100});await(await import('../src/api.js')).loadCore()});
  await create(p);await p.locator('#exTax').fill('NIF ANTERIOR');await p.locator('#exSupplierId').selectOption('integral-supplier');
  assert.equal(await p.locator('#exDocKind').inputValue(),'nomina');assert.equal(await p.locator('#exTax').inputValue(),'');assert.equal(await p.locator('#exPayment').inputValue(),'transferencia');assert.equal(await p.locator('#exLineWh_0').inputValue(),'15');assert.equal(await p.locator('#exLineModel_0').inputValue(),'111');
 });
 await scenario('Control interno excluye fiscalidad y conserva el gasto y sus documentos',async p=>{
  await create(p);await p.locator('#exLineBase_0').fill('40');await p.locator('#exLineVat_0').fill('0');await p.locator('#exDocKind').selectOption('control_interno');
  assert(await p.locator('#exManagement').isChecked());assert(!await p.locator('#exFiscalReviewed').isEnabled());assert(!await p.locator('#exLineDed_0').isChecked());
  await p.locator('[data-action="expense-save"]').click();await p.getByText('Gasto guardado.',{exact:true}).waitFor();
  const result=await p.evaluate(async()=>{const db=window.__mockDb,{deductibleExpenseTotal}=await import('../src/calculations.js');return {e:db.ops_expenses[0],ded:deductibleExpenseTotal(db.ops_expenses,db.ops_expense_lines)}});
  assert.equal(result.e.management_only,true);assert.equal(result.e.gross_expense,40);assert.equal(result.ded,0);assert.equal(result.e.fiscal_reviewed,false);
 });
 await scenario('Factura sin revisión, revisión fiscal y retención coherentes con previsiones',async p=>{
  await create(p);await p.locator('#exLineBase_0').fill('100');await p.locator('#exLineVat_0').fill('21');await p.locator('#exLineWh_0').fill('19');await p.locator('#exLineModel_0').selectOption('115');await p.locator('#exPaidStatus').selectOption('pendiente');await p.locator('[data-action="expense-save"]').click();await p.getByText('Gasto guardado.',{exact:true}).waitFor();
  const calculation=()=>p.evaluate(async()=>{const {deductibleExpenseTotal}=await import('../src/calculations.js'),db=window.__mockDb;return {ded:deductibleExpenseTotal(db.ops_expenses,db.ops_expense_lines),line:db.ops_expense_lines[0],expense:db.ops_expenses[0]}});
  assert.equal((await calculation()).ded,0);await p.locator('#exFiscalReviewed').check();await p.locator('[data-action="expense-save"]').click();await p.getByText('Gasto guardado.',{exact:true}).last().waitFor();
  const c=await calculation();assert.equal(c.ded,121);assert.equal(c.line.withholding_model,'115');assert.equal(c.line.withholding_amount,19);assert.equal(c.expense.amount_paid,0);assert.match(await p.locator('#exSumTotal').innerText(),/102,00/);
  await p.locator('#nav [data-route="fiscalidad"]').click();assert.match(await p.locator('.fiscal-forecast').innerText(),/19,00/);
 });
 await scenario('Duplicados y fecha futura rechazados sin alterar la factura guardada',async p=>{
  await seed(p);await create(p);await p.locator('#exSupplier').fill('INTERNET INTELIGENTE SLU');await p.locator('#exTax').fill('QA123');await p.locator('#exInvoice').fill('B/QA');await p.locator('#exLineBase_0').fill('100');await p.locator('[data-action="expense-save"]').click();assert.equal(await p.evaluate(()=>window.__mockDb.ops_expenses.length),3);
  await p.locator('#exInvoice').fill('NEW-FUTURE-QA');await p.locator('#exDate').fill('2099-01-01');await p.locator('[data-action="expense-save"]').click();assert.equal(await p.evaluate(()=>window.__mockDb.ops_expenses.length),3);
 });
 await scenario('Factura común conserva su ámbito al filtrar documentos de una tienda',async p=>{
  const info=await seed(p);await p.evaluate(async({store,day})=>{const db=window.__mockDb,e=db.ops_expenses[0];e.store_id=null;e.document_id='common-document';db.ops_documents.push({id:'common-document',store_id:store,doc_type:'factura_recibida',document_date:day,original_name:'common-qa.pdf'});await(await import('../src/api.js')).loadCore()},info);
  await nav(p);await p.locator('[data-section="facturas"]').click();await p.locator('#gastosStore').selectOption(info.store);await p.locator('#gastosKind').selectOption('fiscal');await p.locator('[data-action="gastos-apply"]').click();assert.equal(await p.locator('[data-action="expense-edit"][data-id="77777777-7777-4777-8777-777777777771"]').count(),0);
 });
 await scenario('Archivo adjunto y pago mantienen los datos fiscales y el original',async p=>{
  await seed(p);await nav(p);await p.locator('[data-action="expense-edit"][data-id="77777777-7777-4777-8777-777777777771"]').click();
  await p.locator('#exFile').setInputFiles({name:'factura-integral.txt',mimeType:'text/plain',buffer:Buffer.from('Original QA inmutable')});
  await p.locator('[data-action="expense-attach-save"]').click();await p.getByText('Factura adjuntada al mismo gasto. Importes y revisión fiscal conservados.',{exact:true}).waitFor();
  const before=await p.evaluate(()=>({...window.__mockDb.ops_expenses[0]}));assert(before.document_id);await p.locator('[data-action="expense-back"]').first().click();await p.locator('[data-section="facturas"]').click();
  await p.locator('[data-action="expense-payment-open"][data-id="77777777-7777-4777-8777-777777777771"]').click();await p.locator('#expensePaymentStatus').selectOption('parcial');await p.locator('#expensePaymentAmount').fill('60');await p.locator('[data-action="expense-payment-save"]').click();await p.getByText('Pago registrado sin modificar el gasto.',{exact:true}).waitFor();
  const after=await p.evaluate(()=>({...window.__mockDb.ops_expenses[0]}));for(const key of ['base_amount','vat_amount','re_amount','withholding_amount','fiscal_reviewed','document_id','gross_expense'])assert.equal(after[key],before[key]);assert.equal(after.amount_paid,60);
 });
 await scenario('Guardar solo color permite guardar después, sin aceptar cambios concurrentes',async p=>{
  await seed(p);await p.evaluate(async()=>{window.__mockDb.ops_expenses[0].updated_at='2026-10-28T10:00:00Z';await(await import('../src/api.js')).loadCore();const {sb}=await import('../src/api.js'),rpc=sb.rpc.bind(sb);sb.rpc=async(name,args)=>{const r=await rpc(name,args);if(name==='totus_set_expense_report_group')window.__mockDb.ops_expenses[0].updated_at='2026-10-28T11:00:00Z';return r}});
  await nav(p);await p.locator('[data-action="expense-edit"][data-id="77777777-7777-4777-8777-777777777771"]').click();await p.locator('#exNotes').fill('Nota pendiente propia');await p.locator('#exReportGroup').selectOption('orders');await p.locator('[data-action="expense-report-group-save"]').click();await p.getByText('Categoría del Excel guardada. Vuelve a generar el informe para ver el cambio.',{exact:true}).waitFor();
  assert.equal(await p.locator('#exNotes').inputValue(),'Nota pendiente propia');await p.locator('[data-action="expense-save"]').click();try{await p.getByText('Gasto guardado.',{exact:true}).waitFor({timeout:3000})}catch{throw new Error(await p.locator('#toastHost').innerText())};assert.equal(await p.evaluate(()=>window.__mockDb.ops_expenses[0].notes),'Nota pendiente propia');
 });
 await scenario('Guardar solo adjunto avisa antes de descartar otros cambios',async p=>{
  await seed(p);await nav(p);await p.locator('[data-action="expense-edit"][data-id="77777777-7777-4777-8777-777777777771"]').click();await p.locator('#exNotes').fill('Nota que no quiero perder');await p.locator('#exFile').setInputFiles({name:'draft-qa.txt',mimeType:'text/plain',buffer:Buffer.from('QA')});
  await p.locator('[data-action="expense-attach-save"]').click();await p.getByRole('heading',{name:'Guardar solo el adjunto',exact:true}).waitFor();await p.locator('[data-confirm="cancel"]').click();assert.equal(await p.locator('#exNotes').inputValue(),'Nota que no quiero perder');assert.equal(await p.locator('#exFile').evaluate(e=>e.files.length),1);assert.equal(await p.evaluate(()=>window.__mockDb.ops_documents.length),0);
 });
 await scenario('Exportación respeta pagos Excel, internos, alias Vaperalia y adjuntos',async p=>{
  await seed(p);await nav(p);
  for(const [kind,query,expected] of [['payment','',['Apunte Excel: Vaperalia']],['internal','',['Control interno QA']],['fiscal','Vaperalia',['INTERNET INTELIGENTE SLU']]]){
   await p.locator('#gastosKind').selectOption(kind);await p.locator('#gastosQuery').fill(query);await p.locator('[data-action="gastos-apply"]').click();
   const ready=p.waitForEvent('download');await p.locator('[data-action="export-expenses-current"]').click();const file=await ready,path=await file.path();const book=XLSX.readFile(path);const rows=XLSX.utils.sheet_to_json(book.Sheets.Gastos,{header:1});
   assert.deepEqual(rows.slice(4).filter(r=>r[2]).map(r=>r[2]),expected);
   if(kind==='payment')assert(!book.SheetNames.some(n=>/impuestos/i.test(n)),'Payment-only filter cannot add tax settlements');
  }
 });
 await scenario('Proveedor: alta, edición, inactivo, búsqueda y protección de referencias',async p=>{
  await p.evaluate(async()=>{window.__mockDb.ops_suppliers=[];await(await import('../src/api.js')).loadCore()});
  await nav(p);await p.locator('[data-section="proveedores"]').click();await p.locator('[data-action="expense-supplier-new"]').click();
  await p.locator('#esName').fill('Proveedor con todos los datos QA');await p.locator('#esTax').fill('QA-NIF');await p.locator('#esDocKind').selectOption('control_interno');await p.locator('#esVat').fill('101');await p.locator('[data-action="expense-supplier-save"]').click();assert.equal(await p.evaluate(()=>window.__mockDb.ops_suppliers.length),0);
  await p.locator('#esVat').fill('0');await p.locator('[data-action="expense-supplier-save"]').click();await p.getByText('Proveedor de gastos guardado.',{exact:true}).waitFor();
  await p.locator('[data-action="expense-supplier-edit"]').click();assert.equal(await p.locator('#esDocKind').inputValue(),'control_interno');await p.locator('#esActive').uncheck();await p.locator('[data-action="expense-supplier-save"]').click();await p.getByText('Proveedor de gastos guardado.',{exact:true}).last().waitFor();
  assert.equal(await p.locator('[data-action="expense-supplier-edit"]').count(),0);await p.locator('#expenseSuppliersInactive').check();await p.locator('[data-action="expense-suppliers-search"]').click();assert.equal(await p.locator('[data-action="expense-supplier-edit"]').count(),1);
 });
 await scenario('Presentación: tres pestañas, ficha y proveedor entre 320 y 2560 px',async p=>{
  await seed(p);await nav(p);
  for(const section of ['registros','facturas','proveedores']){
   await p.locator(`[data-action="expense-section"][data-section="${section}"]`).click();
   for(const width of [320,360,390,412,480,600,768,834,900,1024,1100,1280,1440,1600,1920,2200,2560]){
    await p.setViewportSize({width,height:1000});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),section+' page overflows at '+width+': '+JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll('#content .card,#content .filters,#content .section-head,#content .kpis,#content .toolbar')].map(e=>({class:e.className,w:e.getBoundingClientRect().width,x:e.getBoundingClientRect().x,scroll:e.scrollWidth})))));
   }
  }
  await p.setViewportSize({width:1440,height:1000});await p.locator('[data-section="registros"]').click();await p.locator('[data-action="expense-new"]').click();
  for(const width of [320,390,768,834,1024,1440,2560]){await p.setViewportSize({width,height:1000});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'Form overflows '+width)}
  await p.screenshot({path:'artifacts/expense-integral-mobile.png',fullPage:true});
 });
}finally{
 await fs.writeFile('artifacts/expense-integral-results.json',JSON.stringify(results,null,2));await browser.close();
}
assert(results.every(r=>r.ok),JSON.stringify(results.filter(r=>!r.ok),null,2));
