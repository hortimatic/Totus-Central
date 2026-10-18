import {chromium} from 'playwright';
import {PDFDocument} from 'pdf-lib';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildGestorSourceRows,gestorSourcePrintHtml} from '../src/gestor-format.js';
const expenses=Array.from({length:50},(_,i)=>({id:String(i),expense_date:'2026-10-18',fiscal_reviewed:true,supplier_name:'Proveedor ficticio de comprobación',invoice_number:'QA-'+String(i+1).padStart(4,'0')}));
const expenseLines=expenses.map(e=>({expense_id:e.id,description:'Servicio simulado',base_amount:100,vat_rate:21,vat_amount:21,re_base:100,re_rate:5.2,re_amount:5.2,irpf_imputable:126.2}));
const rows=buildGestorSourceRows({expenses,expenseLines});
const html=gestorSourcePrintHtml({rows,settings:{business_name:'EMPRESA FICTICIA · QA',tax_id:'IDENTIFICADOR DE PRUEBA',business_address:'Dirección simulada'},year:2026,from:'2026-10-01',to:'2026-10-31'});
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.setContent(html,{waitUntil:'load'});
 assert.equal(await page.locator('.gestor-page').count(),3);
 for(const table of await page.locator('table').all()){
  assert.equal(await table.locator('thead tr:last-child th').count(),17);
  const overflow=await table.evaluate(t=>[...t.querySelectorAll('td')].filter(el=>el.scrollWidth>el.clientWidth+2).length);
  assert.equal(overflow,0,'Se recortan números o textos de la tabla');
 }
 const pdf=await page.pdf({preferCSSPageSize:true,printBackground:true});
 const parsed=await PDFDocument.load(pdf);
 assert.equal(parsed.getPageCount(),3,'La tabla desborda el A4 horizontal y añade páginas');
 for(const p of parsed.getPages())assert(p.getWidth()>p.getHeight());
 fs.mkdirSync('artifacts',{recursive:true});
 fs.writeFileSync('artifacts/gestor_source_qa.pdf',pdf);
 await page.locator('.gestor-page').first().screenshot({path:'artifacts/gestor_source_qa.png'});
 console.log('GESTOR PRINT QA: 100 filas, tres páginas A4 horizontales, 17 columnas, números sin recorte y PDF reabierto.');
}finally{await browser.close()}
