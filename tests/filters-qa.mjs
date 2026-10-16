import assert from 'node:assert/strict';
import {dateFilters} from '../src/components.js';
import {gastos} from '../src/pages/main.js';
import {state} from '../src/state.js';
import {inRange,monthRange} from '../src/utils.js';

// Filtros de fecha, tienda, tipo y pago: entradas de usuario y límites inclusivos.
assert.equal(inRange('2026-10-01','2026-10-01','2026-10-16'),true);
assert.equal(inRange('2026-10-16','2026-10-01','2026-10-16'),true);
assert.equal(inRange('2026-10-17','2026-10-01','2026-10-16'),false);
assert.equal(inRange('2026-09-30','2026-10-01','2026-10-16'),false);
assert.deepEqual(monthRange('2026-10-16'),{from:'2026-10-01',to:'2026-10-31'});

const extra='<div class="field" id="specialExpenseFilter">Extra</div>';
const filters=dateFilters({from:'2026-10-01',to:'2026-10-16',store:'a',stores:[{id:'a',name:'Hortimatic'}]},'gastos',extra);
assert.equal((filters.match(/class="filters"/g)||[]).length,1,'Debe existir un solo contenedor raíz de filtros');
assert.ok(filters.includes('id="specialExpenseFilter"'));
assert.ok(filters.indexOf(extra)>filters.indexOf('gastos-month'));
assert.ok(filters.indexOf(extra)<filters.lastIndexOf('</div>'));

state.data.stores=[{id:'a',name:'Hortimatic',active:true},{id:'b',name:'NewOldSmok',active:true}];
state.data.expenses=[
 {id:'1',expense_date:'2026-10-01',store_id:'a',supplier_name:'INICIO INCLUIDO',invoice_number:'A1',management_only:false,paid_status:'pagado',gross_expense:10},
 {id:'2',expense_date:'2026-10-16',store_id:'a',supplier_name:'FIN INCLUIDO',invoice_number:'A2',management_only:true,paid_status:'pendiente',gross_expense:20},
 {id:'3',expense_date:'2026-10-17',store_id:'a',supplier_name:'FECHA FUERA',invoice_number:'A3',management_only:false,paid_status:'pagado',gross_expense:30},
 {id:'4',expense_date:'2026-10-10',store_id:'b',supplier_name:'TIENDA FUERA',invoice_number:'B1',management_only:false,paid_status:'pagado',gross_expense:40}
];
state.views.gastos={mode:'list',id:null};
state.filters.gastos={from:'2026-10-01',to:'2026-10-16',store:'a',query:'',kind:'all',paid:'all'};
let html=gastos();
assert.equal((html.match(/class="filters"/g)||[]).length,1,'Gastos no debe anidar dos contenedores de filtros');
assert.match(html,/id="gastosFrom"/);
assert.match(html,/id="gastosKind"/);
assert.match(html,/id="gastosPaid"/);
assert.ok(html.includes('INICIO INCLUIDO')&&html.includes('FIN INCLUIDO'),'Ambos extremos del rango deben aparecer');
assert.ok(!html.includes('FECHA FUERA')&&!html.includes('TIENDA FUERA'),'No mezclar fechas ni establecimientos');
state.filters.gastos.kind='internal';
html=gastos();
assert.ok(!html.includes('INICIO INCLUIDO')&&html.includes('FIN INCLUIDO'),'El filtro interno no puede incluir gastos fiscales');
state.filters.gastos.paid='pagado';
html=gastos();
assert.ok(!html.includes('FIN INCLUIDO'),'El filtro de pago debe combinarse con el filtro interno');
console.log('FILTERS QA: estructura, fechas inclusivas, tiendas, gastos internos y pagos OK');
