import {fmtDate,n} from './utils.js';

const XLSX=window.XLSX;
const euro='#,##0.00 "€"';
const headerStyle={font:{bold:true,color:{rgb:'FFFFFF'}},fill:{fgColor:{rgb:'1F2937'}},alignment:{horizontal:'center',vertical:'center'},border:{bottom:{style:'thin',color:{rgb:'CBD5E1'}}}};
const titleStyle={font:{bold:true,sz:16},alignment:{horizontal:'left'}};
const subStyle={font:{bold:true,color:{rgb:'475569'}},fill:{fgColor:{rgb:'F1F5F9'}}};
const totalStyle={font:{bold:true},fill:{fgColor:{rgb:'E2E8F0'}},border:{top:{style:'thin',color:{rgb:'94A3B8'}}}};

function styleHeader(ws,row,cols){for(let c=0;c<cols;c++){const cell=ws[XLSX.utils.encode_cell({r:row,c})];if(cell)cell.s=headerStyle}}
function styleMoney(ws,range){for(const addr of range){if(ws[addr]){ws[addr].z=euro;ws[addr].s={alignment:{horizontal:'right'}}}}}
function autoWidths(ws,widths){ws['!cols']=widths.map(w=>({wch:w}))}
function addAutoFilter(ws,lastCol,lastRow){ws['!autofilter']={ref:`A1:${lastCol}${lastRow}`}}
function book(){return XLSX.utils.book_new()}
function write(wb,name){XLSX.writeFile(wb,name,{cellStyles:true})}
function storeName(stores,id){return stores.find(s=>s.id===id)?.name||''}
function drawerName(drawers,id){return drawers.find(d=>d.id===id)?.name||''}

export function exportClosingsWorkbook({closings,closingDrawers,stores,drawers,from,to}){
 const wb=book();
 const rows=closings.map(c=>[
  fmtDate(c.business_date),storeName(stores,c.store_id),n(c.cash_sales),n(c.card_sales),n(c.bizum_sales),n(c.online_sales),n(c.other_income),
  n(c.cash_sales)+n(c.card_sales)+n(c.bizum_sales)+n(c.online_sales)+n(c.other_income),n(c.actual_cash),c.status||'',c.notes||''
 ]);
 const aoa=[['CIERRES DE CAJA'],[`Periodo: ${fmtDate(from)} - ${fmtDate(to)}`],[],['Fecha','Tienda','Efectivo','Tarjeta','Bizum','Online','Otros','Total ventas','Efectivo final','Estado','Observaciones'],...rows];
 const totalRow=aoa.length;
 aoa.push(['','','','','','','','TOTAL','','','']);
 const ws=XLSX.utils.aoa_to_sheet(aoa);
 ws['A1'].s=titleStyle;ws['A2'].s=subStyle;styleHeader(ws,3,11);
 ws[`H${totalRow+1}`]={t:'n',f:`SUM(H5:H${totalRow})`,s:totalStyle,z:euro};
 for(let r=5;r<=totalRow;r++)for(const col of ['C','D','E','F','G','H','I'])if(ws[`${col}${r}`])ws[`${col}${r}`].z=euro;
 autoWidths(ws,[12,18,13,13,13,13,13,15,15,12,35]);
 ws['!freeze']={xSplit:0,ySplit:4};
 ws['!autofilter']={ref:`A4:K${totalRow}`};
 XLSX.utils.book_append_sheet(wb,ws,'Cierres');

 const byId=new Map(closings.map(c=>[c.id,c]));
 const detail=closingDrawers.filter(d=>byId.has(d.closing_id)).map(d=>{
   const c=byId.get(d.closing_id);
   const total=n(d.closing_cash)+n(d.cash_withdrawals)+n(d.cash_expenses_declared)+n(d.cash_extra_out)-n(d.cash_extra_in)-n(d.opening_cash)+n(d.card_sales)+n(d.bizum_sales)+n(d.online_sales)+n(d.other_income);
   return [fmtDate(c.business_date),storeName(stores,c.store_id),drawerName(drawers,d.drawer_id),n(d.opening_cash),n(d.closing_cash),n(d.card_sales),n(d.bizum_sales),n(d.online_sales),n(d.other_income),n(d.cash_withdrawals),n(d.cash_expenses_declared),n(d.cash_extra_in),n(d.cash_extra_out),total];
 });
 const wa=XLSX.utils.aoa_to_sheet([['Fecha','Tienda','Caja','Apertura','Cierre','Tarjeta','Bizum','Online','Otros','Salidas','Gastos caja','Entradas extra','Salidas extra','Total'],...detail]);
 styleHeader(wa,0,14);for(let r=2;r<=detail.length+1;r++)for(const col of ['D','E','F','G','H','I','J','K','L','M','N'])if(wa[`${col}${r}`])wa[`${col}${r}`].z=euro;
 autoWidths(wa,[12,18,18,13,13,13,13,13,13,13,13,13,13,15]);wa['!autofilter']={ref:`A1:N${detail.length+1}`};wa['!freeze']={ySplit:1};
 XLSX.utils.book_append_sheet(wb,wa,'Detalle por caja');

 write(wb,`cierres_${from}_${to}.xlsx`);
}

export function exportExpensesWorkbook({expenses,stores,from,to}){
 const wb=book();
 const rows=expenses.map(x=>[
   fmtDate(x.expense_date),storeName(stores,x.store_id),x.supplier_name||'',x.supplier_tax_id||'',x.invoice_number||'',x.description||'',
   n(x.base_amount),n(x.vat_amount),n(x.re_amount),n(x.withholding_amount),n(x.gross_expense||x.accounting_amount||x.amount_paid),x.payment_method||'',x.paid_status||'',x.notes||''
 ]);
 const aoa=[['GASTOS'],[`Periodo: ${fmtDate(from)} - ${fmtDate(to)}`],[],['Fecha','Tienda','Proveedor','NIF','Factura','Descripción','Base','IVA','RE','Retención','Total','Pago','Estado','Observaciones'],...rows];
 const end=aoa.length;aoa.push(['','','','','','','','','','','TOTAL','','','']);
 const ws=XLSX.utils.aoa_to_sheet(aoa);ws['A1'].s=titleStyle;ws['A2'].s=subStyle;styleHeader(ws,3,14);
 ws[`K${end+1}`]={t:'n',f:`SUM(K5:K${end})`,s:totalStyle,z:euro};
 for(let r=5;r<=end;r++)for(const col of ['G','H','I','J','K'])if(ws[`${col}${r}`])ws[`${col}${r}`].z=euro;
 autoWidths(ws,[12,18,22,16,16,32,13,13,13,13,15,15,13,35]);ws['!autofilter']={ref:`A4:N${end}`};ws['!freeze']={ySplit:4};
 XLSX.utils.book_append_sheet(wb,ws,'Gastos');
 write(wb,`gastos_${from}_${to}.xlsx`);
}

export function exportSummaryWorkbook({closings,expenses,stores,from,to}){
 const wb=book();
 const sales=closings.reduce((a,x)=>a+n(x.cash_sales)+n(x.card_sales)+n(x.bizum_sales)+n(x.online_sales)+n(x.other_income),0);
 const costs=expenses.reduce((a,x)=>a+n(x.gross_expense||x.accounting_amount||x.amount_paid),0);
 const summary=[
  ['RESUMEN DE GESTIÓN'],[`Periodo: ${fmtDate(from)} - ${fmtDate(to)}`],[],
  ['Concepto','Importe'],['Ventas',sales],['Gastos',costs],['Resultado',sales-costs]
 ];
 const ws=XLSX.utils.aoa_to_sheet(summary);ws['A1'].s=titleStyle;ws['A2'].s=subStyle;styleHeader(ws,3,2);for(const r of [5,6,7])if(ws[`B${r}`])ws[`B${r}`].z=euro;
 ws['A7'].s=totalStyle;ws['B7'].s={...totalStyle};ws['B7'].z=euro;autoWidths(ws,[24,18]);XLSX.utils.book_append_sheet(wb,ws,'Resumen');

 const perStore=stores.map(s=>{
  const cs=closings.filter(x=>x.store_id===s.id),es=expenses.filter(x=>x.store_id===s.id);
  const sv=cs.reduce((a,x)=>a+n(x.cash_sales)+n(x.card_sales)+n(x.bizum_sales)+n(x.online_sales)+n(x.other_income),0);
  const ex=es.reduce((a,x)=>a+n(x.gross_expense||x.accounting_amount||x.amount_paid),0);
  return [s.name,sv,ex,sv-ex];
 });
 const ws2=XLSX.utils.aoa_to_sheet([['Tienda','Ventas','Gastos','Resultado'],...perStore]);styleHeader(ws2,0,4);for(let r=2;r<=perStore.length+1;r++)for(const c of ['B','C','D'])if(ws2[`${c}${r}`])ws2[`${c}${r}`].z=euro;autoWidths(ws2,[22,16,16,16]);XLSX.utils.book_append_sheet(wb,ws2,'Por tienda');
 write(wb,`resumen_${from}_${to}.xlsx`);
}
