// One classification drives both the monthly cell fill and its summary total.
// Presentation only: never used to decide deductibility, amounts or acceptance.
export const EXPENSE_REPORT_GROUPS=Object.freeze([
 {value:'other',label:'Otros',color:'00B050'},
 {value:'payroll',label:'SS y nóminas',color:'FFC000'},
 {value:'orders',label:'Pedidos',color:'00B0F0'},
 {value:'fixed',label:'Gastos fijos',color:'FFFF00'},
 {value:'irpf',label:'IRPF / impuestos pagados',color:'92D050'}
]);
export const EXPENSE_REPORT_COLORS=Object.freeze(Object.fromEntries(EXPENSE_REPORT_GROUPS.map(g=>[g.value,g.color])));
const validGroup=value=>Object.hasOwn(EXPENSE_REPORT_COLORS,value)?value:null;
export function normalizeExpenseColor(value){
 const color=String(value||'').trim().replace(/^#/,'').toUpperCase();
 if(/^[0-9A-F]{6}$/.test(color))return color;
 if(/^FF[0-9A-F]{6}$/.test(color))return color.slice(2);
 return null;
}
function originalStyle(expense){
 let source={};try{source=typeof expense.source_ref==='string'?JSON.parse(expense.source_ref):expense.source_ref||{}}catch{}
 return {group:validGroup(expense.source_group)||validGroup(source?.source_group)||validGroup(source?.source?.group),
  color:normalizeExpenseColor(expense.source_color)||normalizeExpenseColor(source?.source_color)||normalizeExpenseColor(source?.source?.color)};
}
export function categoryReportGroup(category={}){
 const code=String(category.code||'').trim().toUpperCase();
 if(validGroup(category.report_group))return category.report_group;
 if(code==='MERCH')return 'orders';
 if(['PAYROLL','SOCIAL','RETA','FAMILY_COLLAB','INDEMNITY'].includes(code))return 'payroll';
 if(code==='TAX')return 'irpf';
 if(code==='OTHER'||code.startsWith('INTERNAL_'))return 'other';
 return 'fixed';
}
export function expenseReportStyle(expense={},categories=[]){
 const category=categories.find(c=>c.id===expense.category_id)||{};
 if(validGroup(category.report_group))return {group:category.report_group,color:EXPENSE_REPORT_COLORS[category.report_group]};
 const source=originalStyle(expense);
 // Recognized original fills determine the same summary group, even if an old
 // import supplied a conflicting generic group. Keep nonstandard original fills.
 const colorGroup=EXPENSE_REPORT_GROUPS.find(g=>g.color===source.color)?.value;
 const group=colorGroup||source.group||categoryReportGroup(category);
 return {group,color:source.color||EXPENSE_REPORT_COLORS[group]};
}
