import assert from 'node:assert/strict';
import {expenseAttachedInvoices,expenseRegisterLines,GESTOR_EXPENSE_COLUMNS} from '../src/expense-register.js';
assert.equal(GESTOR_EXPENSE_COLUMNS.length,20,'El libro de gestoría requiere 20 columnas');
assert.deepEqual(GESTOR_EXPENSE_COLUMNS.slice(5,10),['NIF/CIF','Razón social','Concepto','Base IVA','% IVA']);
const expenses=[
 {id:'e1',store_id:'h',expense_date:'2026-10-10',document_id:'d1',supplier_name:'Proveedor QA',supplier_tax_id:'B123',invoice_number:'F-20',description:'Dos conceptos',management_only:false,fiscal_reviewed:false,gross_expense:207.4,paid_status:'pagado'},
 {id:'e2',store_id:'n',expense_date:'2026-09-11',document_id:null,supplier_name:'Horas extra QA',invoice_number:'IN-1',management_only:true,gross_expense:300,paid_status:'pendiente'},
 {id:'e3',store_id:'h',expense_date:'2026-10-11',document_id:'d3',supplier_name:'Nombre duplicado',invoice_number:'F-21',management_only:false,gross_expense:50}
];
const documents=[
 {id:'d1',doc_type:'factura_recibida',original_name:'justificante.pdf',document_date:'2026-10-10'},
 {id:'d3',doc_type:'factura_recibida',original_name:'justificante.pdf',document_date:'2026-10-11'},
 {id:'dOrphan',doc_type:'factura_recibida',original_name:'sin_enlace.pdf',document_date:'2026-10-09',supplier_or_customer:'Sin asociar'},
 {id:'dOther',doc_type:'informe',original_name:'informe.pdf',document_date:'2026-10-09'}
];
const list=expenseAttachedInvoices(expenses,documents);
assert.equal(list.length,4,'Dos facturas homónimas deben conservarse, junto a un gasto sin archivo y otro pendiente de asociar');
assert.equal(list.filter(x=>x.document?.original_name==='justificante.pdf').length,2);
assert.equal(list.filter(x=>x.unlinked).length,1);
assert.equal(list.filter(x=>x.expense&&!x.document).length,1);
assert.ok(list.find(x=>x.unlinked).searchable.includes('sin_enlace.pdf'));
assert.equal(list.find(x=>x.expense?.id==='e1').date,'2026-10-10');
const lines=[
 {expense_id:'e1',sort_order:10,description:'Línea con recargo',base_amount:100,vat_rate:21,vat_amount:21,re_base:100,re_rate:5.2,re_amount:5.2,irpf_imputable:126.2,withholding_base:0,withholding_rate:0,withholding_amount:0},
 {expense_id:'e1',sort_order:20,description:'Segunda línea',base_amount:70,vat_rate:21,vat_amount:14.7,re_base:70,re_rate:5.2,re_amount:3.64,irpf_imputable:88.34,withholding_base:0,withholding_rate:0,withholding_amount:0}
];
const details=expenseRegisterLines([expenses[0]],lines);
assert.equal(details.length,2,'Una factura de varios conceptos genera una línea por concepto');
assert.equal(details[0].fields.length,20);
assert.equal(details[0].fields[7],'Línea con recargo');
assert.equal(details[0].fields[8],100);
assert.equal(details[0].fields[9],21);
assert.equal(details[0].fields[13],5.2);
assert.equal(details[0].fields[18],126.2);
assert.equal(details[1].fields[19],88.34);
assert.ok(expenseRegisterLines([expenses[1]],[])[0].missingBreakdown,'No se deben inventar líneas fiscales faltantes');
assert.equal(expenseRegisterLines([expenses[1]],[])[0].fields[14],0,'Gasto interno no debe aparecer como deducible IRPF');
console.log('EXPENSE ARCHIVE QA: 20 columnas, 2 conceptos, filtros y facturas sin asociar, duplicados seguros OK');
