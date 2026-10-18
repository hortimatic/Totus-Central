import fs from 'node:fs';
import xlsx from 'xlsx-js-style';
global.window={XLSX:xlsx};
const {buildStoreAnnualWorkbook,buildGestorWorkbook}=await import('../src/excel.js');

const pad=0.83203125;
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
for(const [month,title] of [['Abril','Hortimatic Abril 2026'],['Mayo','Hortimatic Mayo 2026'],['Junio','Hortimatic Junio 2026'],['Julio','Hortimatic Julio 2026']]){
 if(storeWb.Sheets[month].B1?.v!==title)throw new Error('Título Hortimatic no coincide con Excel original: '+month);
}

if(storeWb.SheetNames[0]!=='Enero'||storeWb.SheetNames[11]!=='Diciembre')throw new Error('Month sheet names are wrong');
const multipleClosings=buildStoreAnnualWorkbook({
 store:stores[0],year:2026,expenses,categories,
 closings:[...closings,{id:'c3',store_id:'h',business_date:'2026-01-02',cash_sales:20,card_sales:33,bizum_sales:0,online_sales:0,other_income:0,cash_withdrawals:7,actual_cash:100,include_in_income:true}]
});
const matchingRow=Object.entries(multipleClosings.Sheets.Enero).find(([k,v])=>/^B\d+$/.test(k)&&String(v?.v||'').startsWith('2 Viernes'));
if(!matchingRow)throw Error('No se localiza el día de prueba');
const dayRow=matchingRow[0].slice(1);
if(multipleClosings.Sheets.Enero['E'+dayRow]?.v!==483||multipleClosings.Sheets.Enero['F'+dayRow]?.v!==57)throw Error('Se han perdido importes de varias cajas cerradas el mismo día');
const nosWb=buildStoreAnnualWorkbook({store:stores[1],year:2026,closings,expenses,categories});
for(const [month,title] of [['Abril','NewOldSmok Abril 2026'],['Mayo','Newoldsmok Mayo 2026'],['Junio','Newoldsmok Junio 2026'],['Julio','Newoldsmok Julio 2026']]){
 if(nosWb.Sheets[month].B1?.v!==title)throw new Error('Título NewOldSmok no coincide con Excel original: '+month);
}
const nosJan=nosWb.Sheets.Enero;
if(Math.abs(nosJan['!cols'][2]?.wch-(30.7109375-pad))>0.00001)throw new Error('NewOldSmok: original expense column width must be 30.71');
if(Math.abs(storeWb.Sheets.Enero['!cols'][2]?.wch-(33-pad))>0.00001)throw new Error('Hortimatic: original expense column width must be 33');
const jan=storeWb.Sheets.Enero;
if(jan['!merges']?.length!==1)throw new Error('Original shop workbook must have only its B1:F1 merge');
if(jan['!cols']?.length!==6)throw new Error('Original shop workbook A:F widths must be preserved');
if(!/^A1:F/.test(jan['!ref']||''))throw new Error('Shop workbook must preserve the original A:F grid');

if(jan.B1?.v!=='Enero 2026')throw new Error('Original month title layout missing');
if(jan.B2?.v!=='Dia'||jan.C2?.v!=='Gastos'||jan.D2?.v!=='Precio'||jan.E2?.v!=='Tarjeta'||jan.F2?.v!=='Salida de caja')throw new Error('Original headers do not match');
const merchCell=Object.entries(jan).find(([k,v])=>/^C\d+$/.test(k)&&v?.v==='Pedido');if(!merchCell||merchCell[1]?.s?.fill?.fgColor?.rgb!=='00B0F0')throw new Error('Original merchandise color missing');
const totalCell=Object.entries(jan).find(([k,v])=>!k.startsWith('!')&&v?.v==='Total');
if(!totalCell)throw new Error('Monthly Total row missing');
const totalRow=Number(totalCell[0].match(/\d+/)[0]);
if(!jan[`D${totalRow}`]?.f||!jan[`E${totalRow}`]?.f||!jan[`F${totalRow}`]?.f)throw new Error('Monthly total formulas missing');

const closingTotal=Number(totalCell[0].slice(1));
const summaryFormula=Object.entries(jan).filter(([address,cell])=>/^C\d+$/.test(address)&&typeof cell?.f==='string'&&cell.f.startsWith('"Total  "')).map(x=>x[1].f)[0];
if(!summaryFormula||!summaryFormula.includes('-(D'+closingTotal+'-300)'))throw new Error('Monthly result invalid: row='+closingTotal+' formula='+String(summaryFormula));
if(summaryFormula.includes('-D'+closingTotal+'-300'))throw new Error('Invalid monthly result order of operations');
const gestorWb=buildGestorWorkbook({
 year:2026,settings:{difficult_expense_pct:5,irpf_prepayment_rate:20},stores,closings,expenses,expenseLines,categories,
 invoices:[],incomeAdjustments:[],fiscalAdjustments:[],taxPayments:[]
});
const firstSemesterWb=buildGestorWorkbook({
 year:2026,onlyPeriodsWithData:true,settings:{difficult_expense_pct:5,irpf_prepayment_rate:20},stores,closings,expenses,expenseLines,categories,
 invoices:[],incomeAdjustments:[],fiscalAdjustments:[],taxPayments:[]
});
if(firstSemesterWb.SheetNames.length!==5)throw new Error('El libro enero-junio debe tener las cinco hojas del original de gestoría');
for(const name of ['Auditoría gestor','Conciliación 1T','Conciliación 2T','Libro gestor 1T','Libro gestor 2T'])if(!firstSemesterWb.SheetNames.includes(name))throw new Error('Falta hoja original: '+name);
const extendedSemesterWb=buildGestorWorkbook({
 year:2026,onlyPeriodsWithData:true,settings:{difficult_expense_pct:5,irpf_prepayment_rate:20},stores,closings,expenses,expenseLines,categories,
 invoices:[],incomeAdjustments:[{income_date:'2026-07-06',store_id:'h',amount:25}],fiscalAdjustments:[],taxPayments:[]
});
if(extendedSemesterWb.SheetNames.length!==7||!extendedSemesterWb.SheetNames.includes('Libro gestor 3T'))throw new Error('El trimestre nuevo no se incorpora al libro');
const withManualIncome=buildGestorWorkbook({
 year:2026,settings:{difficult_expense_pct:5,irpf_prepayment_rate:20},stores,closings,expenses,expenseLines,categories,
 invoices:[],incomeAdjustments:[{income_date:'2026-02-06',store_id:'h',amount:25,concept:'Ingreso complementario QA'}],fiscalAdjustments:[],taxPayments:[]
});
if(Math.abs(withManualIncome.Sheets['Auditoría gestor']['B4'].v-gestorWb.Sheets['Auditoría gestor']['B4'].v-25)>.001)throw new Error('Ingreso manual omitido en la auditoría fiscal');
if(Math.abs(withManualIncome.Sheets['Conciliación 1T']['B5'].v-gestorWb.Sheets['Conciliación 1T']['B5'].v-25)>.001)throw new Error('Ingreso manual omitido en la conciliación de la tienda');
const withUnassigned=buildGestorWorkbook({
 year:2026,settings:{difficult_expense_pct:0,irpf_prepayment_rate:0},stores,closings,expenses,expenseLines,categories,
 invoices:[],fiscalAdjustments:[],
 incomeAdjustments:[{income_date:'2026-01-12',store_id:null,amount:40,concept:'Ajuste general de caja'}],taxPayments:[]
});
const zeroAudit=withUnassigned.Sheets['Auditoría gestor'];
const commonRecon=withUnassigned.Sheets['Conciliación 1T'];
if(Math.abs(zeroAudit.B4.v-gestorWb.Sheets['Auditoría gestor'].B4.v-40)>.001)throw new Error('Ingreso general omitido en Auditoría gestor');
if(Math.abs(commonRecon.D4.v-gestorWb.Sheets['Conciliación 1T'].D4.v-40)>.001)throw new Error('Ingreso general omitido en conciliación');
if(Math.abs(commonRecon.B4.v-gestorWb.Sheets['Conciliación 1T'].B4.v)>.001)throw new Error('Ingreso general asignado indebidamente a Hortimatic');
if(zeroAudit.E4.v!==0||zeroAudit.G4.v!==0)throw new Error('La configuración fiscal con tipo cero fue ignorada');
for(const name of ['Auditoría gestor','Conciliación 1T','Conciliación 2T','Conciliación 3T','Conciliación 4T','Libro gestor 1T','Libro gestor 2T','Libro gestor 3T','Libro gestor 4T'])if(!gestorWb.SheetNames.includes(name))throw new Error('Missing gestor sheet '+name);
for(const sheetName of ['Conciliación 1T','Conciliación 2T','Conciliación 3T','Conciliación 4T']){
 const ws=gestorWb.Sheets[sheetName];
 for(const col of ['B','C','D','E','F','G','H','I','J','K','L']){
  const expected='SUM('+col+'4:'+col+'6)';
  if(ws[col+'7']?.f!==expected)throw new Error('Falta suma trazable de gestoría: '+sheetName+' '+col+'7');
 }
}
const audit=gestorWb.Sheets['Auditoría gestor'];
if(Math.abs(audit['!cols']?.[0]?.wch-(28-pad))>0.00001||Math.abs(audit['!cols']?.[7]?.wch-(45-pad))>0.00001)throw new Error('Gestor audit original column widths do not match');
if(!audit['!merges']?.some(m=>m.s.r===11&&m.s.c===0&&m.e.r===16&&m.e.c===7))throw new Error('Gestor audit explanatory block A12:H17 missing');
if(audit['A8']?.v!=='Incidencia'||audit['F8']?.v!=='Acción recomendada')throw new Error('Gestor incident register missing');
for(const q of [1,2,3,4]){
 const ws=gestorWb.Sheets['Conciliación '+q+'T'];
 const widths=[15,18,19,17,19,20,17,22,17,17,18,24];
 if(widths.some((w,i)=>Math.abs(ws['!cols']?.[i]?.wch-(w-pad))>0.00001))throw new Error('Conciliación '+q+'T no respeta anchuras originales');
 if(!ws['!merges']?.some(m=>m.s.r===8&&m.s.c===0&&m.e.r===12&&m.e.c===11))throw new Error('Falta nota combinada A9:L13 en '+q+'T');
}
const book=gestorWb.Sheets['Libro gestor 1T'];
if([8,13,14,21,6,14,31,25].some((w,i)=>Math.abs(book['!cols']?.[i]?.wch-(w-pad))>0.00001))throw new Error('Libro gestor no respeta anchuras originales');
const expected=['Orden','Fecha','Nº fra. recibida','Nº fra. proveedor','Rt','NIF/CIF','Razón social','Concepto','Base IVA','% IVA','Cuota IVA','Base R.E.','% R.E.','Cuota R.E.','Imputable a IRPF','Base retención','% retención','Cuota retenida','Total factura','Neto pagado'];
for(let i=0;i<expected.length;i++){const cell=book[xlsx.utils.encode_cell({r:2,c:i})];if(cell?.v!==expected[i])throw new Error('Gestor header mismatch at '+expected[i])}

fs.mkdirSync('artifacts',{recursive:true});

const roundtripStore='artifacts/QA_Gastos_y_ventas_Hortimatic_2026.xlsx';
const roundtripGestor='artifacts/QA_Libros_gestor_2026.xlsx';
xlsx.writeFile(storeWb,roundtripStore,{cellStyles:true});
xlsx.writeFile(gestorWb,roundtripGestor,{cellStyles:true});
for(const file of [roundtripStore,roundtripGestor]){
 const reread=xlsx.readFile(file,{cellStyles:true,cellFormula:true});
 if(!reread.SheetNames.length)throw new Error('Roundtrip workbook without sheets: '+file);
 if(fs.statSync(file).size<5000)throw new Error('Exported workbook suspiciously small: '+file);
}
const rereadStore=xlsx.readFile(roundtripStore,{cellStyles:true,cellFormula:true});
const rereadJan=rereadStore.Sheets.Enero;
const rrTotal=Object.entries(rereadJan).find(([k,v])=>/^B\d+$/.test(k)&&v?.v==='Total');
if(!rrTotal)throw new Error('Roundtrip store workbook lost Total row');
const rrRow=Number(rrTotal[0].match(/\d+/)[0]);
for(const col of ['D','E','F'])if(!rereadJan[`${col}${rrRow}`]?.f)throw new Error('Roundtrip workbook lost formula '+col+rrRow);
const rereadGestor=xlsx.readFile(roundtripGestor,{cellStyles:true,cellFormula:true});
if(!rereadGestor.SheetNames.includes('Auditoría gestor'))throw new Error('Roundtrip gestor workbook lost audit sheet');

console.log('Excel QA OK');
