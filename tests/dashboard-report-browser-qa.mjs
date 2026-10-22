import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import JSZip from 'jszip';
import XLSX from 'xlsx-js-style';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await page.evaluate(async()=>{
  const db=window.__mockDb,{sb,loadCore}=await import('../src/api.js'),shop=db.ops_stores[0].id;
  db.ops_daily_closings.push({id:'period-close',store_id:shop,business_date:'2026-01-02',status:'cerrado',cash_sales:100,card_sales:50,include_in_income:true});
  db.ops_expenses.push({id:'period-expense',store_id:shop,expense_date:'2026-01-02',supplier_name:'Proveedor periodo',description:'Compra enero',invoice_number:'E-ENE',gross_expense:20,accounting_amount:20,management_only:false,fiscal_reviewed:true,document_id:'period-doc',paid_status:'pagado'},{id:'internal-expense',store_id:shop,expense_date:'2026-01-03',supplier_name:'Control general',description:'Gasto interno general',gross_expense:7,management_only:true,paid_status:'pagado',document_kind:'otro'});
  db.ops_expense_lines.push({id:'period-line',expense_id:'period-expense',description:'Compra enero',base_amount:20,vat_amount:0,re_amount:0,deductible_irpf:true,irpf_imputable:20});
  db.ops_tax_payments.push({id:'period-tax',tax_type:'130',status:'pagado',payment_date:'2026-01-04',fiscal_year:2025,quarter:4,amount:10});
  db.ops_sales_invoices.push({id:'period-client',store_id:shop,issue_date:'2026-01-02',document_type:'factura',status:'emitida',display_number:'C-ENE',customer_name:'Cliente periodo',total_amount:30,include_in_income:false,generated_document_id:'client-doc'});
  for(const [id,date,name] of [['period-doc','2025-12-31','proveedor-enero.txt'],['client-doc','2026-02-01','cliente-enero.txt'],['unrelated-doc','2026-01-03','no-incluir.txt']]){
   const blob=new Blob(['DOCUMENTO QA '+id],{type:'text/plain'}),path='qa/'+id+'.txt';
   await sb.storage.from('business-documents').upload(path,blob);
   db.ops_documents.push({id,store_id:shop,document_date:date,original_name:name,doc_type:id==='client-doc'?'factura_emitida':'factura_recibida',storage_path:path,mime_type:'text/plain',size_bytes:blob.size,status:'revisada'});
  }
  await loadCore();
 });
 const nav=route=>page.locator('#nav [data-route="'+route+'"]').click();
 await nav('inicio');await page.locator('#inicioFrom').fill('2026-01-01');await page.locator('#inicioTo').fill('2026-01-31');await page.locator('[data-action="inicio-apply"]').click();
 await page.getByText('150,00 €',{exact:true}).first().waitFor();
 assert.deepEqual((await page.locator('.home-period-kpis .kpi strong').allTextContents()).map(text=>text.replace(/\s/g,' ')),['150,00 €','20,00 €','130,00 €','17,00 €']);
 assert.equal(await page.locator('.home-activity svg').count(),1);
 await nav('informes');await page.locator('#reportPeriodYear').fill('2026');await page.locator('#reportPeriodMonth').selectOption('1');await page.locator('[data-action="report-period-month"]').click();
 assert.equal(await page.locator('#informesFrom').inputValue(),'2026-01-01');assert.equal(await page.locator('#informesTo').inputValue(),'2026-01-31');
 assert.deepEqual((await page.locator('.reports-page > .kpis .kpi strong').allTextContents()).map(text=>text.replace(/\s/g,' ')),['150,00 €','20,00 €','17,00 €','130,00 €'],'Reports must exclude internal expenses and paid taxes from the displayed result');
 assert.equal(await page.locator('.internal-expenses-panel').getByText('Control general',{exact:true}).count(),1);
 await page.getByLabel('Información sobre Variación del dinero que queda en caja',{exact:true}).click();assert((await page.locator('details.field-help[open]').innerText()).includes('abrir con 100 €'));
 await page.getByLabel('Información sobre Variación del dinero que queda en caja',{exact:true}).click();
 await page.locator('[data-action="report-block-up"][data-block="gestor"]').click();
 await page.getByText('Orden guardado en tu cuenta.',{exact:true}).waitFor();
 let order=await page.locator('[data-report-block]').evaluateAll(es=>es.map(el=>el.dataset.reportBlock));
 assert(order.indexOf('gestor')<order.indexOf('monthly'));
 const saved=await page.evaluate(()=>window.__mockDb.profiles[0].ui_preferences.report_blocks);assert.deepEqual(order,saved);
 await nav('inicio');await nav('informes');assert.deepEqual(await page.locator('[data-report-block]').evaluateAll(es=>es.map(el=>el.dataset.reportBlock)),saved);
 const ready=page.waitForEvent('download');await page.locator('[data-action="export-gestor-period-package"]').click();const download=await ready;
 assert.equal(download.suggestedFilename(),'Paquete_gestor_2026-01-01_2026-01-31.zip');
 const zip=await JSZip.loadAsync(fs.readFileSync(await download.path())),names=Object.keys(zip.files);
 assert(names.includes('02_GASTOS/Tabla_gestoria_2026-01-01_2026-01-31.xlsx'));
 const index=await zip.file('05_DOCUMENTOS/Indice_documentos.csv').async('string');assert(index.includes('period-doc'));assert(index.includes('client-doc'));assert(!index.includes('unrelated-doc'));
 const wb=XLSX.read(await zip.file('02_GASTOS/Tabla_gestoria_2026-01-01_2026-01-31.xlsx').async('nodebuffer'));assert(Object.values(wb.Sheets[wb.SheetNames[0]]).some(c=>c?.v==='E-ENE'));
 await nav('gastos');await page.locator('[data-action="expense-new"]').click();await page.locator('#exDocKind').selectOption('control_interno');
 assert(await page.locator('#exManagement').isChecked());assert(await page.locator('#exManagement').isDisabled());assert(!(await page.locator('#exFiscalReviewed').isChecked()));
 assert(!(await page.locator('#exLineDed_0').isChecked()));assert(await page.locator('#exLineDed_0').isDisabled());assert.equal(await page.locator('#exLineDedPct_0').inputValue(),'0');
 await page.locator('#exDocKind').selectOption('factura');await page.locator('#exManagement').uncheck();assert(await page.locator('#exLineDed_0').isChecked());assert.equal(await page.locator('#exLineDedPct_0').inputValue(),'100');
 await page.locator('#exDocKind').selectOption('control_interno');await page.locator('[data-action="expense-line-add"]').click();assert(await page.locator('#exLineDed_1').isDisabled());assert.equal(await page.locator('#exLineDedPct_1').inputValue(),'0');await page.locator('[data-action="expense-line-remove"]').last().click();

 await page.locator('#exSupplier').fill('Gasto interno nuevo QA');await page.locator('#exInvoice').fill('INT-QA');await page.locator('#exLineDesc_0').fill('Control interno general');await page.locator('#exLineBase_0').fill('10');await page.locator('#exLineVat_0').fill('0');
 await page.locator('[data-action="expense-save"]').click();await page.getByText('Gasto guardado.',{exact:true}).waitFor();
 const expense=await page.evaluate(()=>window.__mockDb.ops_expenses.find(e=>e.invoice_number==='INT-QA'));assert.equal(expense.document_kind,'otro');assert.equal(expense.management_only,true);assert.equal(expense.fiscal_reviewed,false);
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await nav('inicio');assert(await page.locator('.home-activity svg').isVisible());assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));}
 assert.deepEqual(errors,[]);
 console.log('DASHBOARD / REPORT BROWSER: matching graph/KPIs, month picker, persisted order, contextual explanations, ZIP with client and supplier originals outside file dates, internal expense creation and mobile geometry verified.');
}finally{await browser.close()}
