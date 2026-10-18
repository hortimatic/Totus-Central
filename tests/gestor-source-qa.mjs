import assert from 'node:assert/strict';
import {buildGestorSourceRows,gestorSourceTotals,gestorSourcePrintHtml,GESTOR_SOURCE_COLUMNS} from '../src/gestor-format.js';

const args={from:'2026-01-01',to:'2026-03-31',store:'s1',categories:[{id:'rent',code:'RENT'}],
 expenses:[{id:'rent',store_id:'s1',expense_date:'2026-01-01',supplier_name:'Proveedor ficticio',invoice_number:'ALQ-QA',fiscal_reviewed:true},
 {id:'unreviewed',store_id:'s1',expense_date:'2026-01-01',fiscal_reviewed:false},
 {id:'internal',store_id:'s1',expense_date:'2026-01-01',fiscal_reviewed:true,management_only:true},
 {id:'other-store',store_id:'s2',expense_date:'2026-01-01',fiscal_reviewed:true}],
 expenseLines:[{expense_id:'rent',category_id:'rent',base_amount:500,vat_rate:21,vat_amount:105,re_base:0,re_rate:0,re_amount:0,irpf_imputable:605,deductible_irpf:true,withholding_base:500,withholding_rate:19,withholding_amount:95}]};
const rows=buildGestorSourceRows(args);
assert.equal(GESTOR_SOURCE_COLUMNS.length,17);
assert.equal(rows.length,2,'Gasto e IVA van en filas distintas; excluye internos, no revisados y otra tienda');
assert.equal(rows[0][6],'ARRENDAMIENTOS Y CAN');
assert.equal(rows[0][13],500);
assert.equal(rows[1][6],'IVA SOPORTADO(RECARG');
assert.equal(rows[1][13],105);
assert.equal(rows[0][16],95);
assert.equal(rows[0][2],'','No inventar referencias de la gestoría');
assert.equal(rows[0][4],'');
assert.equal(gestorSourceTotals(rows)[13],605);
const partial=structuredClone(args);Object.assign(partial.expenseLines[0],{irpf_imputable:302.5});
assert.equal(gestorSourceTotals(buildGestorSourceRows(partial))[13],302.5,'No duplicar deducciones parciales al desglosar impuestos');
const recargo=structuredClone(args);Object.assign(recargo.expenseLines[0],{base_amount:100,vat_amount:21,re_base:100,re_rate:5.2,re_amount:5.2,irpf_imputable:126.2});
const reRows=buildGestorSourceRows(recargo);
assert.equal(reRows[1][13],26.2);
assert.equal(gestorSourceTotals(reRows)[12],5.2);
assert.throws(()=>buildGestorSourceRows({...args,expenseLines:[]}),/Falta el desglose/);
assert.equal(buildGestorSourceRows({...args,from:'2026-04-01',to:'2026-06-30'}).length,0);
const html=gestorSourcePrintHtml({rows:[...rows,...rows,...rows],previousRows:rows,rowsPerPage:4,settings:{business_name:'<script>QA</script>'},year:2026,from:args.from,to:args.to});
assert.equal((html.match(/<section class="gestor-page">/g)||[]).length,2);
assert(!html.includes('<script>QA</script>'));
assert(html.includes('&lt;script&gt;QA&lt;/script&gt;'));
assert(html.includes('TOTAL DE PAGINA')&&html.includes('TOTAL ACUMULADO')&&html.includes('Sumas Anteriores'));
assert(!html.includes('Total factura')&&!html.includes('Neto pagado'));
assert(gestorSourcePrintHtml().includes('Sin gastos fiscales revisados'));
console.log('GESTOR SOURCE QA: 17 columnas originales, IVA/RE separado, retención, deducción parcial, filtros, referencias vacías y acumulados.');
