import assert from 'node:assert/strict';
import XLSX from 'xlsx-js-style';
global.window={XLSX};
const {buildStoreAnnualWorkbook}=await import('../src/excel.js');
const wb=buildStoreAnnualWorkbook({store:{id:'h',name:'Hortimatic'},year:2026,closings:[],categories:[],expenses:[
 {id:'rent',store_id:'h',expense_date:'2026-01-02',description:'Rent with withholding',gross_expense:1174.91,withholding_amount:184.49},
 {id:'tax',store_id:'h',expense_date:'2026-01-03',description:'Withholding remittance',gross_expense:184.49,withholding_amount:0}
]});
const sheet=wb.Sheets.Enero;
assert(Math.abs(sheet.D4.v-990.42)<0.001);
assert.equal(sheet.D5.v,184.49);
const total=Object.entries(sheet).find(([key,cell])=>key.startsWith('B')&&cell.v==='Total')[0].slice(1);
assert(Math.abs(sheet[`D${total}`].v-1174.91)<0.001,'Supplier net bill plus tax remittance must not double-count withholding');
console.log('LEGACY RETENTION QA: daily workbook reconciles supplier net and later withholding remittance.');
