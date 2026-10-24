import assert from 'node:assert/strict';
import XLSX from 'xlsx-js-style';
import {expenseReportStyle,categoryReportGroup,normalizeExpenseColor,EXPENSE_REPORT_COLORS} from '../src/expense-colors.js';
global.window={XLSX};
const {buildStoreMonthlyWorkbook}=await import('../src/excel.js');
const categories=['MERCH','RENT','PAYROLL','SOCIAL','RETA','INDEMNITY','INTERNAL_PERSONAL','UTILITIES','TAX'].map(code=>({id:code,code}));
for(const [code,group] of Object.entries({MERCH:'orders',RENT:'fixed',PAYROLL:'payroll',SOCIAL:'payroll',RETA:'payroll',INDEMNITY:'payroll',INTERNAL_PERSONAL:'other',UTILITIES:'fixed',TAX:'irpf'})){
 const style=expenseReportStyle({category_id:code,withholding_model:'115'},categories);
 assert.equal(style.group,group,code);assert.equal(style.color,EXPENSE_REPORT_COLORS[group]);
}
assert.equal(normalizeExpenseColor('#ff00b0f0'),'00B0F0');
assert.equal(normalizeExpenseColor('url(bad)'),null);
assert.equal(normalizeExpenseColor('0000B050'),null,'Transparent ARGB must not become an opaque category');
assert.equal(expenseReportStyle({category_id:'RENT',withholding_model:'115'},categories).color,'FFFF00','Rent retention is not a tax payment');
assert.equal(expenseReportStyle({category_id:'INTERNAL_PERSONAL',source_ref:JSON.stringify({source:{color:'FFC000'}})},categories).group,'payroll','Read nested original payroll color');
assert.equal(expenseReportStyle({source_group:'fixed',source_color:'00B0F0'},categories).group,'orders','Original known color and subtotal must agree');
assert.equal(expenseReportStyle({source_ref:'bad json',category_id:'MERCH'},categories).group,'orders');
const overridden=categories.map(c=>c.id==='MERCH'?{...c,report_group:'other'}:c);
assert.deepEqual(expenseReportStyle({category_id:'MERCH',source_color:'00B0F0'},overridden),{group:'other',color:'00B050'});
assert.equal(categoryReportGroup({code:'MERCH',report_group:'invalid'}),'orders');
const store={id:'h',name:'Hortimatic'},date='2026-10-02';
const expenses=[
 {id:'rent',category_id:'RENT',description:'Rent with retention',gross_expense:1210,withholding_amount:190,withholding_model:'115'},
 {id:'order',category_id:'MERCH',description:'Order',gross_expense:100},
 {id:'staff',category_id:'INTERNAL_PERSONAL',description:'Original staff',gross_expense:20,source_ref:JSON.stringify({source:{color:'FFC000'}})},
 {id:'refund',category_id:'MERCH',description:'Credit note',gross_expense:-10}
].map(e=>({...e,store_id:'h',expense_date:date}));
const original=JSON.stringify(expenses);
const args={store,year:2026,month:10,closings:[],categories,expenses};
function find(sheet,label,col='C'){const addr=Object.keys(sheet).find(a=>new RegExp('^'+col+'[0-9]+$').test(a)&&sheet[a]?.v===label);assert(addr,'Missing '+label);return addr.slice(1)}
const wb=buildStoreMonthlyWorkbook(args),ws=wb.Sheets.Octubre;
for(const [label,color] of [['Rent with retention','FFFF00'],['Order','00B0F0'],['Original staff','FFC000'],['Credit note','00B0F0']]){
 assert.equal(ws['C'+find(ws,label)].s.fill.fgColor.rgb,color);
}
const sum=(sheet,label)=>sheet['C'+find(sheet,label,'B')].v;
assert.equal(sum(ws,'Gastos fijos'),1020);
assert.equal(sum(ws,'Pedidos '),90);
assert.equal(sum(ws,'SS y nominas'),20);
assert.equal(sum(ws,'IRPF'),0);
const revised=buildStoreMonthlyWorkbook({...args,categories:overridden}).Sheets.Octubre;
assert.equal(sum(revised,'Otros'),90);assert.equal(sum(revised,'Pedidos '),0);
assert.equal(sum(revised,'Total'),sum(ws,'Total'),'Only presentation/grouping changes');
assert.equal(JSON.stringify(expenses),original,'Do not mutate saved business inputs');
const bytes=XLSX.write(wb,{type:'buffer',bookType:'xlsx',cellStyles:true});
const reopened=XLSX.read(bytes,{type:'buffer',cellStyles:true,cellFormula:true}).Sheets.Octubre;
for(const [label,color] of [['Rent with retention','FFFF00'],['Order','00B0F0'],['Original staff','FFC000']]){
 const addr='C'+find(ws,label);
 assert.equal(reopened[addr].s.fgColor.rgb,color,'Actual exported fill '+label);
}
assert.equal(reopened['E'+find(ws,'Rent with retention')].v,1020);
assert(reopened['C'+find(ws,'Gastos fijos','B')].f.includes('E'),'Subtotal still uses numeric price column');
const source={kind:'monthly_source_reference',batch:'qa',period:'2026-10',bank_entries:[],withdrawal_entries:[],payment_entries:[{date,row:4,label:'Imported order',amount:25,group:'fixed',color:'ff00b0f0'}]};
const sourced=buildStoreMonthlyWorkbook({...args,expenses:[],incomeAdjustments:[{store_id:'h',notes:JSON.stringify(source)}]}).Sheets.Octubre;
assert.equal(sourced['C'+find(sourced,'Imported order')].s.fill.fgColor.rgb,'00B0F0');
assert.equal(sum(sourced,'Pedidos '),25);assert.equal(sum(sourced,'Gastos fijos'),0);
console.log('EXPENSE COLORS: category defaults, rent retention, original nested/ARGB fills, override, refund, subtotal consistency and XLSX round-trip verified.');
