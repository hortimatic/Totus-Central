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
   n(x.base_amount),n(x.vat_amount),n(x.re_amount),n(x.withholding_amount),n(x.gross_expense||x.accounting_amount||x.amount_paid),x.management_only?'Interno':'Contable',x.payment_method||'',x.paid_status||'',x.notes||''
 ]);
 const aoa=[['GASTOS'],[`Periodo: ${fmtDate(from)} - ${fmtDate(to)}`],[],['Fecha','Tienda','Proveedor','NIF','Factura','Descripción','Base','IVA','RE','Retención','Total','Tipo','Pago','Estado','Observaciones'],...rows];
 const end=aoa.length;aoa.push(['','','','','','','','','','','TOTAL','','','']);
 const ws=XLSX.utils.aoa_to_sheet(aoa);ws['A1'].s=titleStyle;ws['A2'].s=subStyle;styleHeader(ws,3,15);
 ws[`K${end+1}`]={t:'n',f:`SUM(K5:K${end})`,s:totalStyle,z:euro};
 for(let r=5;r<=end;r++)for(const col of ['G','H','I','J','K'])if(ws[`${col}${r}`])ws[`${col}${r}`].z=euro;
 autoWidths(ws,[12,18,22,16,16,32,13,13,13,13,15,13,15,13,35]);ws['!autofilter']={ref:`A4:O${end}`};ws['!freeze']={ySplit:4};
 XLSX.utils.book_append_sheet(wb,ws,'Gastos');
 write(wb,`gastos_${from}_${to}.xlsx`);
}

export function exportSummaryWorkbook({closings,expenses,stores,from,to}){
 const wb=book();
 const sales=closings.reduce((a,x)=>a+n(x.cash_sales)+n(x.card_sales)+n(x.bizum_sales)+n(x.online_sales)+n(x.other_income),0);
 const accounting=expenses.filter(x=>!x.management_only).reduce((a,x)=>a+n(x.gross_expense||x.accounting_amount||x.amount_paid),0);
 const internal=expenses.filter(x=>x.management_only).reduce((a,x)=>a+n(x.gross_expense||x.accounting_amount||x.amount_paid),0);
 const costs=accounting+internal;
 const summary=[
  ['RESUMEN DE GESTIÓN'],[`Periodo: ${fmtDate(from)} - ${fmtDate(to)}`],[],
  ['Concepto','Importe'],['Ventas',sales],['Gastos contables',accounting],['Gastos internos',internal],['Gastos totales',costs],['Resultado real',sales-costs]
 ];
 const ws=XLSX.utils.aoa_to_sheet(summary);ws['A1'].s=titleStyle;ws['A2'].s=subStyle;styleHeader(ws,3,2);for(const r of [5,6,7,8,9])if(ws[`B${r}`])ws[`B${r}`].z=euro;
 ws['A9'].s=totalStyle;ws['B9'].s={...totalStyle};ws['B9'].z=euro;autoWidths(ws,[24,18]);XLSX.utils.book_append_sheet(wb,ws,'Resumen');

 const perStore=stores.map(s=>{
  const cs=closings.filter(x=>x.store_id===s.id),es=expenses.filter(x=>x.store_id===s.id);
  const sv=cs.reduce((a,x)=>a+n(x.cash_sales)+n(x.card_sales)+n(x.bizum_sales)+n(x.online_sales)+n(x.other_income),0);
  const ex=es.reduce((a,x)=>a+n(x.gross_expense||x.accounting_amount||x.amount_paid),0);
  const internal=es.filter(x=>x.management_only).reduce((a,x)=>a+n(x.gross_expense||x.accounting_amount||x.amount_paid),0);
  return [s.name,sv,ex-internal,internal,sv-ex];
 });
 const ws2=XLSX.utils.aoa_to_sheet([['Tienda','Ventas','Gastos contables','Gastos internos','Resultado'],...perStore]);styleHeader(ws2,0,5);for(let r=2;r<=perStore.length+1;r++)for(const c of ['B','C','D','E'])if(ws2[`${c}${r}`])ws2[`${c}${r}`].z=euro;autoWidths(ws2,[22,16,18,18,16]);XLSX.utils.book_append_sheet(wb,ws2,'Por tienda');
 write(wb,`resumen_${from}_${to}.xlsx`);
}


const MONTHS=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const WEEKDAYS=['Domingo','Lunes','Martes','Miercoles','Jueves','Viernes','Sabado'];
const LEGACY_COLORS={other:'00B050',payroll:'FFC000',orders:'00B0F0',fixed:'FFFF00',irpf:'92D050',total:'FF0000',stripe:'DCE6F1',header:'4F81BD',grid:'95B3D7'};
function legacyGroup(expense,categories){
 const code=categories.find(x=>x.id===expense.category_id)?.code||'';
 if(code==='MERCH')return'orders';
 if(['PAYROLL','SOCIAL','RETA','FAMILY_COLLAB'].includes(code))return'payroll';
 if(code==='TAX'||['111','115'].includes(String(expense.withholding_model||'')))return'irpf';
 if(code==='OTHER'||code.startsWith('INTERNAL_'))return'other';
 return'fixed';
}
function excelDateKey(y,m,d){return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`}
function moneyStyle(fill){return {fill:fill?{fgColor:{rgb:fill}}:undefined,font:{name:'Calibri',sz:11},alignment:{horizontal:'right'},numFmt:'#,##0.00',border:{top:{style:'thin',color:{rgb:'95B3D7'}},bottom:{style:'thin',color:{rgb:'95B3D7'}}}}}
function textStyle(fill,bold=false,align='left'){return {fill:fill?{fgColor:{rgb:fill}}:undefined,font:{name:'Calibri',sz:11,bold},alignment:{horizontal:align,vertical:'center'},border:{top:{style:'thin',color:{rgb:'95B3D7'}},bottom:{style:'thin',color:{rgb:'95B3D7'}}}}}
function sumFormula(refs){return refs.length?`SUM(${refs.join(',')})`:'0'}
function setCell(ws,addr,value,style,formula=null){
 const t=typeof value==='number'?'n':'s';ws[addr]={t,v:value,s:style};if(formula)ws[addr].f=formula;
}
function appendLegacyMonthlySheet(wb,{store,year,month,closings,expenses,categories}){
 const monthName=MONTHS[month],ws={};
 ws['!ref']='B1:F80';ws['!cols']=[{wch:2},{wch:11.71},{wch:33},{wch:9.14},{wch:9.14},{wch:12.14}];ws['!merges']=[XLSX.utils.decode_range('B1:F1')];ws['!freeze']={ySplit:2};
 setCell(ws,'B1',`${monthName} ${year}`,{fill:{fgColor:{rgb:'000000'}},font:{name:'Calibri',sz:11,bold:true,color:{rgb:'FFFF00'}},alignment:{horizontal:'center'}});
 const headers=['Dia','Gastos','Precio','Tarjeta','Salida de caja'];
 for(let i=0;i<headers.length;i++)setCell(ws,XLSX.utils.encode_cell({r:1,c:i+1}),headers[i],{fill:{fgColor:{rgb:LEGACY_COLORS.header}},font:{name:'Calibri',sz:11,bold:true,color:{rgb:'000000'}},alignment:{horizontal:'center'},border:{top:{style:'thin',color:{rgb:'95B3D7'}},bottom:{style:'thin',color:{rgb:'95B3D7'}}}});
 const days=new Date(year,month+1,0).getDate();let row=3;const groupRefs={other:[],payroll:[],orders:[],fixed:[],irpf:[]};const expenseRefs=[];
 const byDateClose=new Map(closings.filter(x=>x.store_id===store.id&&String(x.business_date).startsWith(`${year}-${String(month+1).padStart(2,'0')}`)).map(x=>[String(x.business_date).slice(0,10),x]));
 const expMonth=expenses.filter(x=>x.store_id===store.id&&String(x.expense_date).startsWith(`${year}-${String(month+1).padStart(2,'0')}`)).sort((a,b)=>String(a.expense_date).localeCompare(String(b.expense_date))||String(a.created_at||'').localeCompare(String(b.created_at||'')));
 for(let d=1;d<=days;d++){
   const key=excelDateKey(year,month,d),close=byDateClose.get(key),dayExp=expMonth.filter(x=>String(x.expense_date).slice(0,10)===key);
   const count=Math.max(1,dayExp.length);
   for(let k=0;k<count;k++,row++){
     const stripe=row%2===1?LEGACY_COLORS.stripe:null,ex=dayExp[k]||null;
     if(k===0)setCell(ws,`B${row}`,`${d} ${WEEKDAYS[new Date(year,month,d).getDay()]}`,textStyle(stripe,true));
     else setCell(ws,`B${row}`,'',textStyle(stripe,true));
     if(ex){
       const g=legacyGroup(ex,categories),amount=n(ex.gross_expense||ex.accounting_amount||ex.amount_paid);
       setCell(ws,`C${row}`,ex.description||ex.supplier_name||'Gasto',textStyle(LEGACY_COLORS[g],false));
       setCell(ws,`D${row}`,amount,moneyStyle(stripe));groupRefs[g].push(`D${row}`);expenseRefs.push(`D${row}`);
     }else{setCell(ws,`C${row}`,'',textStyle(stripe));setCell(ws,`D${row}`,'',moneyStyle(stripe))}
     if(k===0&&close){
       setCell(ws,`E${row}`,n(close.card_sales),moneyStyle(stripe));setCell(ws,`F${row}`,n(close.cash_withdrawals),moneyStyle(stripe));
     }else{setCell(ws,`E${row}`,'',moneyStyle(stripe));setCell(ws,`F${row}`,'',moneyStyle(stripe))}
   }
 }
 row+=2;const summaryStart=row;
 const groups=[['Otros','other'],['SS y nominas','payroll'],['Pedidos ','orders'],['Gastos fijos','fixed'],['IRPF','irpf']];
 for(const [label,g] of groups){setCell(ws,`B${row}`,label,textStyle(LEGACY_COLORS[g],true));setCell(ws,`C${row}`,0,textStyle(row%2===1?LEGACY_COLORS.stripe:null,false,'center'),sumFormula(groupRefs[g]));row++}
 const totalRow=row;setCell(ws,`B${row}`,'Total',textStyle(LEGACY_COLORS.total,true));setCell(ws,`C${row}`,0,textStyle(LEGACY_COLORS.stripe,false,'center'),`SUM(C${summaryStart}:C${row-1})`);setCell(ws,`D${row}`,0,moneyStyle(LEGACY_COLORS.stripe),expenseRefs.length?`SUM(${expenseRefs.join(',')})`:'0');
 const firstData=3,lastData=summaryStart-3;setCell(ws,`E${row}`,0,moneyStyle(LEGACY_COLORS.stripe),`SUM(E${firstData}:E${lastData})`);setCell(ws,`F${row}`,0,moneyStyle(LEGACY_COLORS.stripe),`SUM(F${firstData}:F${lastData})`);
 row+=2;const internalRefs=expMonth.filter(x=>x.management_only).map(ex=>{const ix=expMonth.indexOf(ex);return null}).filter(Boolean);
 const internalTotal=expMonth.filter(x=>x.management_only).reduce((a,x)=>a+n(x.gross_expense||x.accounting_amount||x.amount_paid),0);
 ws['!merges'].push(XLSX.utils.decode_range(`C${row}:D${row}`));setCell(ws,`C${row}`,monthName,{font:{name:'Calibri',sz:11},alignment:{horizontal:'center'}});row++;
 const recalc=`SUM(E${totalRow},F${totalRow})`;ws['!merges'].push(XLSX.utils.decode_range(`C${row}:D${row}`));setCell(ws,`C${row}`,'',{fill:{fgColor:{rgb:'FFFF00'}},font:{name:'Calibri',sz:11},alignment:{horizontal:'center'}},`TEXT(E${totalRow},"0.00")&"€ Tarjeta + "&TEXT(F${totalRow},"0.00")&"€ metalico"`);row++;
 ws['!merges'].push(XLSX.utils.decode_range(`C${row}:D${row}`));setCell(ws,`C${row}`,'',{fill:{fgColor:{rgb:'FFFF00'}},font:{name:'Calibri',sz:11},alignment:{horizontal:'center'}},`"Total recaudado: "&TEXT(${recalc},"0.00")&"€"`);row++;
 ws['!merges'].push(XLSX.utils.decode_range(`C${row}:D${row}`));setCell(ws,`C${row}`,'',{fill:{fgColor:{rgb:'92D050'}},font:{name:'Calibri',sz:11},alignment:{horizontal:'left'}},`"Gastos: "&TEXT(D${totalRow},"0.00")&"€"`);row++;
 if(internalTotal>0){ws['!merges'].push(XLSX.utils.decode_range(`C${row}:D${row}`));setCell(ws,`C${row}`,`Menos gastos internos: ${internalTotal.toFixed(2).replace('.',',')}€`,{fill:{fgColor:{rgb:'92D050'}},font:{name:'Calibri',sz:11},alignment:{horizontal:'left'}});row++}
 const fiscalFormula=internalTotal>0?`D${totalRow}-${internalTotal}`:`D${totalRow}`;
 ws['!merges'].push(XLSX.utils.decode_range(`C${row}:D${row}`));setCell(ws,`C${row}`,'',{fill:{fgColor:{rgb:'92D050'}},font:{name:'Calibri',sz:11},alignment:{horizontal:'center'}},`TEXT(D${totalRow},"0.00")&"€ - "&TEXT(${internalTotal},"0.00")&"€ = "&TEXT(${fiscalFormula},"0.00")&"€"`);row++;
 ws['!merges'].push(XLSX.utils.decode_range(`C${row}:D${row}`));setCell(ws,`C${row}`,'',{fill:{fgColor:{rgb:'DCE6F1'}},font:{name:'Calibri',sz:11},alignment:{horizontal:'center'}},`TEXT(${recalc},"0.00")&"€ - "&TEXT(${fiscalFormula},"0.00")&"€ = "&TEXT(${recalc}-${fiscalFormula},"0.00")&"€"`);row++;
 ws['!merges'].push(XLSX.utils.decode_range(`C${row}:D${row}`));setCell(ws,`C${row}`,'',{fill:{fgColor:{rgb:'00B0F0'}},font:{name:'Calibri',sz:11},alignment:{horizontal:'center'}},`"Total  "&TEXT(${recalc}-${fiscalFormula},"0.00")&"€"`);
 ws['!ref']=`B1:F${Math.max(row,totalRow)}`;
 XLSX.utils.book_append_sheet(wb,ws,monthName);
}
export function exportStoreAnnualWorkbook({store,year,closings,expenses,categories}){
 const wb=book();for(let month=0;month<12;month++)appendLegacyMonthlySheet(wb,{store,year,month,closings,expenses,categories});
 wb.Workbook=wb.Workbook||{};wb.Workbook.CalcPr={calcMode:'auto',fullCalcOnLoad:true,forceFullCalc:true};
 write(wb,`Gastos y ventas ${store.name} ${year}.xlsx`);
}
