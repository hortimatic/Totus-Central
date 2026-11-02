import test from 'node:test';import assert from 'node:assert/strict';import xlsx from 'xlsx-js-style';
import {monthlyDiaryFile} from '../src/agent-workbooks.js';
import {buildStoreMonthlyWorkbook} from '../src/excel.js';import {selectReportData} from '../src/report-period.js';
const store={id:'h',name:'Hortimatic'},data={stores:[store],categories:[{id:'merch',code:'MERCH'}],closings:[{id:'c',store_id:'h',business_date:'2026-10-22',card_sales:80,cash_withdrawals:25}],expenses:[{id:'e',store_id:'h',expense_date:'2026-10-22',supplier_name:'Ficticio',invoice_number:'QA-1',category_id:'merch',gross_expense:42,withholding_amount:0}],incomeAdjustments:[]};
test('the attached XLSX is the same workbook as Informes including colours, formulas and invoice numbers',async()=>{
 const file=monthlyDiaryFile(data,{store,year:2026,month:10},xlsx),bytes=new Uint8Array(await file.arrayBuffer());
 assert.equal(file.type,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');assert(file.name.endsWith('.xlsx'));assert.equal(bytes[0],80);assert.equal(bytes[1],75);
 const expected=buildStoreMonthlyWorkbook({store,year:2026,month:10,...selectReportData(data,{from:'2026-10-01',to:'2026-10-31',store:store.id}),categories:data.categories},xlsx);
 const reference=xlsx.read(xlsx.write(expected,{type:'array',bookType:'xlsx',cellStyles:true}),{type:'array',cellStyles:true});
 const actual=xlsx.read(bytes,{type:'array',cellStyles:true});assert.deepEqual(actual.SheetNames,reference.SheetNames);assert.deepEqual(actual.Sheets,reference.Sheets);
 assert(Object.values(actual.Sheets[actual.SheetNames[0]]).some(c=>c.v==='QA-1'));assert(Object.values(actual.Sheets[actual.SheetNames[0]]).some(c=>c.f));
});
test('server engine injection never changes the browser engine or exposes another store',async()=>{
 const sentinel={};globalThis.window={XLSX:sentinel};
 const other={...data,expenses:[...data.expenses,{...data.expenses[0],id:'other',store_id:'other',invoice_number:'PRIVATE-OTHER'}]};
 const file=monthlyDiaryFile(other,{store,year:2026,month:10},xlsx);assert.equal(window.XLSX,sentinel);
 const result=xlsx.read(await file.arrayBuffer(),{type:'array'});assert(!JSON.stringify(result.Sheets).includes('PRIVATE-OTHER'));delete globalThis.window;
});
test('invalid month never creates a different report',()=>{assert.throws(()=>monthlyDiaryFile(data,{store,year:2026,month:13},xlsx),/mes/);});
