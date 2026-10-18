import assert from 'node:assert/strict';
import XLSX from 'xlsx-js-style';
global.window={XLSX};
const {buildStoreMonthlyWorkbook}=await import('../src/excel.js');
for(const store of [{id:'h',name:'Hortimatic'},{id:'n',name:'NewOldSmok'}])for(let month=1;month<=12;month++){
 const date=`2026-${String(month).padStart(2,'0')}-02`;
 const args={store,year:2026,month,categories:[],closings:[{store_id:store.id,business_date:date,card_sales:250.25,cash_withdrawals:50}],expenses:[
  {store_id:store.id,expense_date:date,description:'Monthly supplier invoice',invoice_number:`000${month}/QA`,gross_expense:1210,withholding_amount:190},
  {store_id:'other',expense_date:date,invoice_number:'WRONG-STORE',gross_expense:99999},
  {store_id:store.id,expense_date:'2025-01-01',invoice_number:'WRONG-YEAR',gross_expense:99999}
 ]};
 const wb=buildStoreMonthlyWorkbook(args),reopened=XLSX.read(XLSX.write(wb,{type:'buffer',bookType:'xlsx'}),{type:'buffer',cellFormula:true});
 assert.equal(reopened.SheetNames.length,1);
 const sheet=reopened.Sheets[reopened.SheetNames[0]];
 assert.equal(sheet.C2.v,'Gastos');assert.equal(sheet.D2.v,'Nº factura');assert.equal(sheet.E2.v,'Precio');assert.equal(sheet.F2.v,'Tarjeta');assert.equal(sheet.G2.v,'Salida de caja');
 assert.equal(sheet.D4.v,`000${month}/QA`,'Keep invoice numbers as text, including leading zeros');
 assert.equal(sheet.E4.v,1020);assert.equal(sheet.F4.v,250.25);assert.equal(sheet.G4.v,50);
 assert(!Object.values(sheet).some(c=>['WRONG-STORE','WRONG-YEAR'].includes(c?.v)));
 for(const cell of Object.values(sheet))if(cell?.f)assert(!/\bD\d+/.test(cell.f),'Numeric formulas must not refer to the invoice-number column');
 assert(Object.values(sheet).some(c=>c?.f?.includes('SUM(F3:')),'Card totals must move to column F');
 assert(Object.values(sheet).some(c=>c?.f?.includes('SUM(G3:')),'Cash totals must move to column G');
}
assert.throws(()=>buildStoreMonthlyWorkbook({year:2026,month:13}),/mes válido/);
console.log('MONTHLY WORKBOOK QA: 24 files reopened; one month each; invoice text, store/year isolation, net retentions and shifted formulas verified.');
