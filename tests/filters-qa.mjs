import assert from 'node:assert/strict';
import {dateFilters} from '../src/components.js';
import {inicio,gastos,documentos,fiscalidad,informes} from '../src/pages/main.js';
import {state} from '../src/state.js';
import {inRange,monthRange,isoToday} from '../src/utils.js';
import {validateExpenseClassification} from '../src/calculations.js';

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

// Protección de gastos internos frente a imputación fiscal accidental.
const internalCategory={id:'internal-overtime',code:'INTERNAL_OVERTIME'};
const fiscalCategory={id:'normal-supply',code:'UTIL'};
const internalLine={category_id:'internal-overtime',deductible_irpf:false,deductible_pct:0};
const normalLine={category_id:'normal-supply',deductible_irpf:true,deductible_pct:100};
assert.equal(validateExpenseClassification([internalLine],[internalCategory,fiscalCategory],true),true);
assert.throws(()=>validateExpenseClassification([internalLine],[internalCategory,fiscalCategory],false),/Solo control interno|solo de control interno/);
assert.throws(()=>validateExpenseClassification([{...internalLine,deductible_irpf:true}],[internalCategory],true),/deducible/);
assert.throws(()=>validateExpenseClassification([internalLine,normalLine],[internalCategory,fiscalCategory],true),/No mezcles/);
assert.equal(validateExpenseClassification([normalLine],[internalCategory,fiscalCategory],false),true);

// Documentos, fiscalidad e informes deben conservar un único contenedor de filtros
// incluso cuando incorporan selector de estado, trimestre o año.
state.views.documentos={mode:'list',id:null};
for(const [module,html,additional] of [
 ['documentos',documentos(),'documentosStatus'],
 ['fiscalidad',fiscalidad(),'fiscal-quarter'],
 ['informes',informes(),'informesYear']
]){
 assert.equal((html.match(/class="filters"/g)||[]).length,1,module+': filtros duplicados o anidados');
 assert.ok(html.includes(additional),module+': falta control complementario');
 assert.ok(html.includes('id="'+(module==='fiscalidad'?'fiscalFrom':module+'From')+'"'),module+': falta control Desde');
}
console.log('FILTERS QA: estructura, fechas inclusivas, tiendas, gastos internos y pagos OK');

// Conciliación real de cálculos en tres pantallas con un ingreso manual y un ajuste
// fiscal, sin depender de la fecha concreta de ejecución del workflow.
const current=isoToday(),currentMonth=monthRange(current);
state.user={email:'qa@example.invalid',role:'admin',full_name:'QA'};
state.data.settings={irpf_prepayment_rate:0,difficult_expense_pct:0,difficult_expense_annual_cap:0,difficult_expense_enabled:true};
state.data.storageUsage={status:'ok',total_bytes:0,limit_bytes:500*1024*1024};
state.data.closings=[];state.data.expenses=[];state.data.expenseLines=[];
state.data.invoices=[];state.data.documents=[];state.data.taxPayments=[];
state.data.fiscalAdjustments=[{id:'a1',store_id:'a',adjustment_date:current,kind:'ingreso_extra',amount:25}];
state.data.incomeAdjustments=[{id:'m1',store_id:'a',income_date:current,amount:150}];
state.filters.fiscalidad={from:currentMonth.from,to:currentMonth.to,store:'all',query:''};
state.filters.informes={from:currentMonth.from,to:currentMonth.to,store:'all',query:''};
const kpiAmount=(markup,label)=>{
 const escaped=label.replace(/[.*+?^${()|[\]\\]/g,'\\$&');
 return markup.match(new RegExp(escaped+'<\\/span><strong>([\\s\\S]*?)<\\/strong>'))?.[1]||'';
};
assert.match(kpiAmount(inicio(),'Ingresos del mes'),/175,00\\s*€/,'Inicio excluye ingresos manuales');
assert.match(kpiAmount(inicio(),'Ingresos acumulados'),/175,00\\s*€/,'Inicio trimestral difiere del libro');
assert.match(kpiAmount(inicio(),'IRPF orientativo'),/0,00\\s*€/,'Tipo IRPF 0 % se reemplazó por 20 %');
assert.match(kpiAmount(fiscalidad(),'Ingresos del periodo'),/175,00\\s*€/,'Fiscalidad omite ingresos manuales');
assert.match(kpiAmount(fiscalidad(),'Ingresos acumulados'),/175,00\\s*€/,'Fiscalidad omite ingreso manual acumulado');
assert.match(kpiAmount(fiscalidad(),'130 calculado del trimestre'),/0,00\\s*€/,'Fiscalidad ignora tipo IRPF 0 %');
assert.match(kpiAmount(informes(),'Ventas del periodo'),/175,00\\s*€/,'Informes no coincide con su Excel exportado');
state.filters.fiscalidad.store='a';
state.data.fiscalAdjustments.push({id:'other',store_id:'b',adjustment_date:current,kind:'gasto_deducible_extra',amount:90});
assert.match(kpiAmount(fiscalidad(),'Gastos/amortizaciones extra'),/0,00\\s*€/,'Un ajuste de otra tienda contamina el filtro fiscal');
console.log('INCOME CONSISTENCY QA: Inicio/Fiscalidad/Informes, ingresos manuales, IRPF 0 %, filtro por tienda OK');
