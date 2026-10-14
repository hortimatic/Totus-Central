import assert from 'node:assert/strict';
const addr=({r,c})=>{let col='',i=c+1;while(i){i--;col=String.fromCharCode(65+i%26)+col;i=Math.floor(i/26)}return col+(r+1)};
let last;
const XLSX={
 utils:{
  book_new:()=>({SheetNames:[],Sheets:{}}),
  aoa_to_sheet:aoa=>{const ws={};aoa.forEach((row,r)=>row.forEach((v,c)=>{if(v!==undefined&&v!=='')ws[addr({r,c})]={t:typeof v==='number'?'n':'s',v}}));return ws},
  encode_cell:addr,
  book_append_sheet:(wb,ws,name)=>{wb.SheetNames.push(name);wb.Sheets[name]=ws}
 },
 writeFile:(wb,name)=>{last={wb,name}}
};
global.window={XLSX};
const {exportExpensesWorkbook,exportClosingsWorkbook,exportSummaryWorkbook}=await import('../src/excel.js');
const settings={from:'2026-01-01',to:'2026-01-31'};
exportExpensesWorkbook({...settings,expenses:[],stores:[]});
assert.equal(last.wb.Sheets.Gastos.K5.f,'0','Empty expenses export must not sum backwards or include its own total');
exportClosingsWorkbook({...settings,closings:[],closingDrawers:[],stores:[],drawers:[]});
assert.equal(last.wb.Sheets.Cierres.H5.f,'0','Empty closings export must not be circular');
const expense={store_id:'s1',expense_date:'2026-01-15',supplier_name:'QA',gross_expense:0,accounting_amount:126.2,amount_paid:126.2,management_only:false};
exportExpensesWorkbook({...settings,expenses:[expense],stores:[{id:'s1',name:'QA shop'}]});
assert.equal(last.wb.Sheets.Gastos.K5.v,0,'Zero-valued gross expense cannot fall back to paid amount');
assert.equal(last.wb.Sheets.Gastos.K6.f,'SUM(K5:K5)','One-row expense total must reference the data row');
exportSummaryWorkbook({...settings,closings:[],expenses:[expense],invoices:[],fiscalAdjustments:[],incomeAdjustments:[],stores:[{id:'s1',name:'QA shop'}]});
assert.equal(last.wb.Sheets.Resumen.B9.v,0,'Summary accounting expenses must retain zero');
console.log('Excel invariants: empty exports, zero values and total formulas OK');
