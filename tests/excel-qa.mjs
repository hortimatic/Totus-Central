import fs from 'node:fs';
import xlsx from 'xlsx-js-style';
global.window={XLSX:xlsx};
const {buildStoreAnnualWorkbook,buildGestorWorkbook}=await import('../src/excel.js');

const stores=[{id:'h',name:'Hortimatic',active:true},{id:'n',name:'NewOldSmok',active:true}];
const categories=[
 {id:'merch',code:'MERCH',name:'Mercancía / producto para tienda'},
 {id:'pay',code:'PAYROLL',name:'Sueldos y salarios'},
 {id:'rent',code:'RENT',name:'Alquileres y cánones'},
 {id:'tax',code:'TAX',name:'Tasas y tributos deducibles'},
 {id:'internal',code:'INTERNAL_WAREHOUSE',name:'Almacén / pago interno'}
];
const closings=[
 {id:'c1',store_id:'h',business_date:'2026-01-02',cash_sales:300,card_sales:450,bizum_sales:25,online_sales:10,other_income:0,cash_withdrawals:50,actual_cash:500,include_in_income:true},
 {id:'c2',store_id:'n',business_date:'2026-01-02',cash_sales:100,card_sales:250,bizum_sales:15,online_sales:20,other_income:0,cash_withdrawals:20,actual_cash:300,include_in_income:true}
];
const expenses=[
 {id:'e1',store_id:'h',expense_date:'2026-01-02',category_id:'merch',supplier_name:'Proveedor',supplier_tax_id:'B1',invoice_number:'F1',description:'Pedido',base_amount:100,vat_amount:21,re_amount:5.2,withholding_amount:0,accounting_amount:126.2,gross_expense:126.2,amount_paid:126.2,management_only:false},
 {id:'e2',store_id:'h',expense_date:'2026-01-03',category_id:'internal',supplier_name:'Almacén',invoice_number:'INT',description:'Almacén',base_amount:300,vat_amount:0,re_amount:0,withholding_amount:0,accounting_amount:300,gross_expense:300,amount_paid:300,management_only:true},
 {id:'e3',store_id:'n',expense_date:'2026-02-05',category_id:'rent',supplier_name:'Arrendador',supplier_tax_id:'B2',invoice_number:'R1',description:'Alquiler',base_amount:500,vat_amount:105,re_amount:0,withholding_amount:75,withholding_model:'115',accounting_amount:605,gross_expense:605,amount_paid:530,management_only:false}
];
const expenseLines=[
 {expense_id:'e1',sort_order:10,category_id:'merch',description:'Pedido',base_amount:100,vat_rate:21,vat_amount:21,re_base:100,re_rate:5.2,re_amount:5.2,irpf_imputable:126.2,withholding_base:0,withholding_rate:0,withholding_amount:0,deductible_irpf:true,deductible_pct:100},
 {expense_id:'e3',sort_order:10,category_id:'rent',description:'Alquiler',base_amount:500,vat_rate:21,vat_amount:105,re_base:0,re_rate:0,re_amount:0,irpf_imputable:605,withholding_base:500,withholding_rate:15,withholding_amount:75,withholding_model:'115',deductible_irpf:true,deductible_pct:100}
];

const storeWb=buildStoreAnnualWorkbook({store:stores[0],year:2026,closings,expenses,categories});
if(storeWb.SheetNames.length!==12)throw new Error('Store workbook must have 12 monthly sheets');
if(storeWb.SheetNames[0]!=='Enero'||storeWb.SheetNames[11]!=='Diciembre')throw new Error('Month sheet names are wrong');
const jan=storeWb.Sheets.Enero;
if(jan.B1?.v!=='Enero 2026')throw new Error('Original month title layout missing');
if(jan.B2?.v!=='Dia'||jan.C2?.v!=='Gastos'||jan.D2?.v!=='Precio'||jan.E2?.v!=='Tarjeta'||jan.F2?.v!=='Salida de caja')throw new Error('Original headers do not match');
const merchCell=Object.entries(jan).find(([k,v])=>/^C\d+$/.test(k)&&v?.v==='Pedido');if(!merchCell||merchCell[1]?.s?.fill?.fgColor?.rgb!=='00B0F0')throw new Error('Original merchandise color missing');
const totalCell=Object.entries(jan).find(([k,v])=>!k.startsWith('!')&&v?.v==='Total');
if(!totalCell)throw new Error('Monthly Total row missing');
const totalRow=Number(totalCell[0].match(/\d+/)[0]);
if(!jan[`D${totalRow}`]?.f||!jan[`E${totalRow}`]?.f||!jan[`F${totalRow}`]?.f)throw new Error('Monthly total formulas missing');

const gestorWb=buildGestorWorkbook({
 year:2026,settings:{difficult_expense_pct:5,irpf_prepayment_rate:20},stores,closings,expenses,expenseLines,categories,
 invoices:[],incomeAdjustments:[],fiscalAdjustments:[],taxPayments:[]
});
for(const name of ['Auditoría gestor','Conciliación 1T','Conciliación 2T','Conciliación 3T','Conciliación 4T','Libro gestor 1T','Libro gestor 2T','Libro gestor 3T','Libro gestor 4T'])if(!gestorWb.SheetNames.includes(name))throw new Error('Missing gestor sheet '+name);
const book=gestorWb.Sheets['Libro gestor 1T'];
const expected=['Orden','Fecha','Nº fra. recibida','Nº fra. proveedor','Rt','NIF/CIF','Razón social','Concepto','Base IVA','% IVA','Cuota IVA','Base R.E.','% R.E.','Cuota R.E.','Imputable a IRPF','Base retención','% retención','Cuota retenida','Total factura','Neto pagado'];
for(let i=0;i<expected.length;i++){const cell=book[xlsx.utils.encode_cell({r:2,c:i})];if(cell?.v!==expected[i])throw new Error('Gestor header mismatch at '+expected[i])}

fs.mkdirSync('artifacts',{recursive:true});
xlsx.writeFile(storeWb,'artifacts/QA_Gastos_y_ventas_Hortimatic_2026.xlsx',{cellStyles:true});
xlsx.writeFile(gestorWb,'artifacts/QA_Libros_gestor_2026.xlsx',{cellStyles:true});
console.log('Excel QA OK');
