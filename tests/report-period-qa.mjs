import {clickModuleLink} from './ui-navigation.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import XLSX from 'xlsx-js-style';
import {reportMonths,selectReportData} from '../src/report-period.js';

assert.deepEqual(reportMonths({from:'2025-11-30',to:'2026-02-01'}).map(x=>x.key),['2025-11','2025-12','2026-01','2026-02']);
const fixture={stores:[{id:'a',name:'Alcalá'}],closings:[],expenses:[{id:'x',store_id:'a',expense_date:'2026-02-14',supplier_name:'Gestoría Álvarez'},{id:'y',store_id:'b',expense_date:'2026-02-14',supplier_name:'Gestoría Álvarez'}],invoices:[],fiscalAdjustments:[],incomeAdjustments:[]};
assert.deepEqual(selectReportData(fixture,{from:'2026-02-14',to:'2026-02-14',store:'a',query:'gestoria alvarez'}).expenses.map(x=>x.id),['x']);

const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/tests/mock-supabase.js',async route=>{
  const original=fs.readFileSync('tests/mock-supabase.js','utf8');
  const seed=`const seedStore=db.ops_stores[0].id;
  db.ops_business_settings[0].business_name='Titular de pruebas con nombre y apellidos largos';
  db.ops_invoice_series.push({id:'shared-series',code:'SHARED',year:2026,store_id:null,active:true,document_type:'factura',series_kind:'invoice',prefix:'QA-',padding:4,next_number:1});
  db.ops_document_templates.push({id:'general-template',name:'General QA',store_id:null,active:true,default_invoice:true});
  db.ops_stores.forEach((s,i)=>db.ops_document_templates.push({id:'shop-template-'+i,name:s.name,store_id:s.id,active:true,default_invoice:true}));
  for(const [id,date,total] of [['jan','2026-01-15',10],['feb','2026-02-14',20],['mar','2026-03-01',30]]){
   db.ops_expenses.push({id,store_id:seedStore,expense_date:date,supplier_name:'Gestoría Álvarez',invoice_number:id,description:'Servicio mensual',gross_expense:total,accounting_amount:total,amount_paid:total,paid_status:'pagado',management_only:false,fiscal_reviewed:true});
   db.ops_expense_lines.push({id:'line-'+id,expense_id:id,description:'Servicio mensual',base_amount:total,vat_amount:0,re_amount:0,irpf_imputable:total,deductible_irpf:true});
   db.ops_daily_closings.push({id,store_id:seedStore,business_date:date,notes:'Caja Álvarez',status:'cerrado',cash_sales:total,include_in_income:true});
   db.ops_sales_invoices.push({id,store_id:seedStore,issue_date:date,customer_name:'Cliente Álvarez',display_number:'F-'+id,status:'borrador',document_type:'factura',invoice_kind:'invoice',total_amount:total});
   db.ops_documents.push({id,store_id:seedStore,document_date:date,original_name:'Álvarez-'+id+'.pdf',doc_type:'factura_recibida',status:'archivada',size_bytes:100});
  }`;
  await route.fulfill({contentType:'application/javascript',body:original.replace('window.supabase={createClient:()=>client};',seed+'\nwindow.supabase={createClient:()=>client};')});
 });
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 const nav=route=>clickModuleLink(page,page.locator(`#nav [data-route="${route}"]`));
 // Exercise the real controls in every date-filtered listing, using Enter.
 for(const [route,prefix] of [['cajas','cajas'],['gastos','gastos'],['facturacion','facturas'],['documentos','documentos']]){
  await nav(route);await page.locator('#'+prefix+'From').fill('2026-02-01');await page.locator('#'+prefix+'To').fill('2026-02-28');
  await page.locator('#'+prefix+'Query').fill('alvarez');await page.locator('#'+prefix+'Query').press('Enter');
  assert.equal(await page.locator('.data-table tbody tr').count(),1,route+' must show one February match without requiring accents');
  await page.locator('#'+prefix+'Query').fill('no-match');await page.locator('[data-action="'+prefix+'-apply"]').click();
  assert.equal(await page.locator('.data-table tbody tr').count(),0,route+' must reject unmatched text');
  await page.locator('[data-action="'+prefix+'-clear"]').click();assert.equal(await page.locator('#'+prefix+'Query').inputValue(),'','Clear must reset the search');
 }
 await nav('informes');await page.locator('#informesFrom').fill('2026-01-10');await page.locator('#informesTo').fill('2026-03-05');await page.locator('#informesQuery').fill('alvarez');await page.locator('#informesQuery').press('Enter');
 assert.equal(await page.locator('.monthly-report').count(),3,'Range must show all three months');
 assert.equal(await page.locator('[data-action="export-store-book"]').count(),6,'Two stores for each month');
 await page.locator('#informesStore').selectOption({label:'Hortimatic'});await page.locator('[data-action="informes-apply"]').click();
 assert.equal(await page.locator('[data-action="export-store-book"]').count(),3,'Store filter must affect the monthly list');
 const ready=page.waitForEvent('download');await page.locator('[data-action="export-store-book"][data-month="2"]').click();
 const wb=XLSX.read(fs.readFileSync(await (await ready).path()));assert.deepEqual(wb.SheetNames,['Febrero']);
 assert(Object.values(wb.Sheets.Febrero).some(c=>c?.v==='feb'),'Downloaded month must retain its invoice number');
 await page.locator('[data-action="report-gestor-source-preview"]').click();
 assert.equal(await page.locator('#modalHost details').count(),0,'Single-sheet preview must not nest accordions');
 assert.equal(await page.locator('#modalHost .workbook-scroll').count(),1,'One scroll surface: '+await page.locator('#toastHost').innerText());
 await page.setViewportSize({width:842,height:740});
 const columnWidths=await page.locator('#modalHost .sheet-header td').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().width));
 assert(columnWidths[1]>=110&&columnWidths[5]>=350,'Date and identity columns must retain readable widths in a narrow panel');
 assert.equal(await page.locator('#modalHost .workbook-scroll').evaluate(e=>e.scrollWidth>e.clientWidth),true,'Wide table should scroll instead of squeezing columns');
 await page.setViewportSize({width:1440,height:1000});
 await page.locator('#modalHost .close-btn').click();
 await nav('facturacion');await page.locator('[data-action="invoice-new"]').click();
 assert.equal(await page.locator('#ivSeries').inputValue(),'shared-series');
 assert.equal(await page.locator('#ivTemplate').inputValue(),'shop-template-0');
 await page.locator('#ivCustomer').fill('Cliente sin guardar');await page.locator('#ivDesc_0').fill('Servicio con descripción larga para comprobar la hoja');await page.locator('#ivUnit_0').fill('50');
 await page.locator('#ivStore').selectOption({label:'NewOldSmok'});
 assert.equal(await page.locator('#ivSeries').inputValue(),'shared-series','Same sequence when switching shops');
 assert.equal(await page.locator('#ivTemplate').inputValue(),'shop-template-1','Shop default must replace previous general template');
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});
  await page.waitForFunction(()=>{
   const host=document.querySelector('#invoiceDraftPreview'),paper=host?.querySelector('.invoice-preview');if(!paper)return false;
   const h=host.getBoundingClientRect(),p=paper.getBoundingClientRect();return p.width>0&&p.right<=h.right+2&&p.left>=h.left-2;
  });
 }
 await page.setViewportSize({width:1440,height:1000});await nav('administracion');
 await page.getByRole('heading',{name:'Cambios sin guardar',exact:true}).waitFor();await page.locator('[data-confirm="accept"]').click();
 await page.getByRole('button',{name:'Log',exact:true}).click();
 const actions=await page.locator('.log-filter-actions button').evaluateAll(es=>es.map(e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,bottom:b.bottom}}));
 assert.equal(actions.length,2);assert(Math.abs(actions[0].x-actions[1].x)<2&&actions[1].y>=actions[0].bottom,'Log buttons must be together and vertically stacked');
 assert.deepEqual(errors,[]);
 console.log('REPORT PERIOD QA: cross-year months, inclusive dates, accent-free Enter search in four modules, report text/store filters, monthly file and flat preview verified.');
}finally{await browser.close()}
