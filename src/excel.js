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

export function exportSummaryWorkbook({closings,expenses,stores,invoices=[],fiscalAdjustments=[],incomeAdjustments=[],from,to}){
 const wb=book();
 const closeSales=closings.filter(x=>x.include_in_income!==false).reduce((a,x)=>a+n(x.cash_sales)+n(x.card_sales)+n(x.bizum_sales)+n(x.online_sales)+n(x.other_income),0);
 const extraInvoiceSales=invoices.filter(x=>x.document_type==='factura'&&x.status==='emitida'&&x.include_in_income===true).reduce((a,x)=>a+n(x.total_amount),0);
 const adjustmentSales=fiscalAdjustments.filter(x=>x.kind==='ingreso_extra').reduce((a,x)=>a+n(x.amount),0)+incomeAdjustments.reduce((a,x)=>a+n(x.amount),0);
 const sales=closeSales+extraInvoiceSales+adjustmentSales;
 const accounting=expenses.filter(x=>!x.management_only).reduce((a,x)=>a+n(x.gross_expense||x.accounting_amount||x.amount_paid),0);
 const internal=expenses.filter(x=>x.management_only).reduce((a,x)=>a+n(x.gross_expense||x.accounting_amount||x.amount_paid),0);
 const costs=accounting+internal;
 const summary=[
  ['RESUMEN DE GESTIÓN'],[`Periodo: ${fmtDate(from)} - ${fmtDate(to)}`],[],
  ['Concepto','Importe'],['Ventas de cierres',closeSales],['Facturas adicionales',extraInvoiceSales],['Ajustes de ingreso',adjustmentSales],['Ingresos totales',sales],['Gastos contables',accounting],['Gastos internos',internal],['Gastos totales',costs],['Resultado real',sales-costs]
 ];
 const ws=XLSX.utils.aoa_to_sheet(summary);ws['A1'].s=titleStyle;ws['A2'].s=subStyle;styleHeader(ws,3,2);for(let r=5;r<=13;r++)if(ws[`B${r}`])ws[`B${r}`].z=euro;
 ws['A13'].s=totalStyle;ws['B13'].s={...totalStyle};ws['B13'].z=euro;autoWidths(ws,[24,18]);XLSX.utils.book_append_sheet(wb,ws,'Resumen');

 const perStore=stores.map(s=>{
  const cs=closings.filter(x=>x.store_id===s.id&&x.include_in_income!==false),es=expenses.filter(x=>x.store_id===s.id),is=invoices.filter(x=>x.store_id===s.id&&x.document_type==='factura'&&x.status==='emitida'&&x.include_in_income===true),as=fiscalAdjustments.filter(x=>x.kind==='ingreso_extra'&&x.store_id===s.id);
  const sv=cs.reduce((a,x)=>a+n(x.cash_sales)+n(x.card_sales)+n(x.bizum_sales)+n(x.online_sales)+n(x.other_income),0)+is.reduce((a,x)=>a+n(x.total_amount),0)+as.reduce((a,x)=>a+n(x.amount),0)+incomeAdjustments.filter(x=>x.store_id===s.id).reduce((a,x)=>a+n(x.amount),0);
  const ex=es.reduce((a,x)=>a+n(x.gross_expense||x.accounting_amount||x.amount_paid),0);
  const internal=es.filter(x=>x.management_only).reduce((a,x)=>a+n(x.gross_expense||x.accounting_amount||x.amount_paid),0);
  return [s.name,sv,ex-internal,internal,sv-ex];
 });
 const commonAdj=fiscalAdjustments.filter(x=>x.kind==='ingreso_extra'&&!x.store_id).reduce((a,x)=>a+n(x.amount),0)+incomeAdjustments.filter(x=>!x.store_id).reduce((a,x)=>a+n(x.amount),0);
 if(commonAdj)perStore.push(['General / sin tienda',commonAdj,0,0,commonAdj]);
 const ws2=XLSX.utils.aoa_to_sheet([['Tienda','Ventas','Gastos contables','Gastos internos','Resultado'],...perStore]);styleHeader(ws2,0,5);for(let r=2;r<=perStore.length+1;r++)for(const c of ['B','C','D','E'])if(ws2[`${c}${r}`])ws2[`${c}${r}`].z=euro;autoWidths(ws2,[22,16,18,18,16]);XLSX.utils.book_append_sheet(wb,ws2,'Por tienda');
 write(wb,`resumen_${from}_${to}.xlsx`);
}


const MONTHS=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const WEEKDAYS=['Domingo','Lunes','Martes','Miercoles','Jueves','Viernes','Sabado'];
const XLSX_WCH_PAD=0.83203125;
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
 ws['!ref']='A1:I80';ws['!cols']=[null,...[11.7109375,/newold|smok/i.test(store.name||'')?30.7109375:33,9.140625,9.140625,12.140625,9.140625,9.140625,9.140625].map(w=>({wch:w-XLSX_WCH_PAD}))];ws['!merges']=[XLSX.utils.decode_range('B1:F1')];ws['!freeze']={ySplit:2};
 setCell(ws,'B1',`${monthName} ${year}`,{fill:{fgColor:{rgb:'000000'}},font:{name:'Calibri',sz:11,bold:true,color:{rgb:'FFFF00'}},alignment:{horizontal:'center'}});
 const headers=['Dia','Gastos','Precio','Tarjeta','Salida de caja'];
 for(let i=0;i<headers.length;i++)setCell(ws,XLSX.utils.encode_cell({r:1,c:i+1}),headers[i],{font:{name:'Calibri',sz:11,bold:true,color:{rgb:'000000'}},alignment:{horizontal:'center'}});
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
 setCell(ws,`C${row}`,monthName,{font:{name:'Calibri',sz:11},alignment:{horizontal:'center'}});row++;
 const recalc=`SUM(E${totalRow},F${totalRow})`;setCell(ws,`C${row}`,'',{fill:{fgColor:{rgb:'FFFF00'}},font:{name:'Calibri',sz:11},alignment:{horizontal:'center'}},`TEXT(E${totalRow},"0.00")&"€ Tarjeta + "&TEXT(F${totalRow},"0.00")&"€ metalico"`);row++;
 setCell(ws,`C${row}`,'',{fill:{fgColor:{rgb:'FFFF00'}},font:{name:'Calibri',sz:11},alignment:{horizontal:'center'}},`"Total recaudado: "&TEXT(${recalc},"0.00")&"€"`);row++;
 setCell(ws,`C${row}`,'',{fill:{fgColor:{rgb:'92D050'}},font:{name:'Calibri',sz:11},alignment:{horizontal:'left'}},`"Gastos: "&TEXT(D${totalRow},"0.00")&"€"`);row++;
 if(internalTotal>0){setCell(ws,`C${row}`,`Menos gastos internos: ${internalTotal.toFixed(2).replace('.',',')}€`,{fill:{fgColor:{rgb:'92D050'}},font:{name:'Calibri',sz:11},alignment:{horizontal:'left'}});row++}
 const fiscalFormula=internalTotal>0?`D${totalRow}-${internalTotal}`:`D${totalRow}`;
 setCell(ws,`C${row}`,'',{fill:{fgColor:{rgb:'92D050'}},font:{name:'Calibri',sz:11},alignment:{horizontal:'center'}},`TEXT(D${totalRow},"0.00")&"€ - "&TEXT(${internalTotal},"0.00")&"€ = "&TEXT(${fiscalFormula},"0.00")&"€"`);row++;
 setCell(ws,`C${row}`,'',{fill:{fgColor:{rgb:'DCE6F1'}},font:{name:'Calibri',sz:11},alignment:{horizontal:'center'}},`TEXT(${recalc},"0.00")&"€ - "&TEXT(${fiscalFormula},"0.00")&"€ = "&TEXT(${recalc}-${fiscalFormula},"0.00")&"€"`);row++;
 setCell(ws,`C${row}`,'',{fill:{fgColor:{rgb:'00B0F0'}},font:{name:'Calibri',sz:11},alignment:{horizontal:'center'}},`"Total  "&TEXT(${recalc}-${fiscalFormula},"0.00")&"€"`);
 ws['!ref']=`A1:I${Math.max(row,totalRow)}`;
 XLSX.utils.book_append_sheet(wb,ws,monthName);
}
export function buildStoreAnnualWorkbook({store,year,closings,expenses,categories}){
 const wb=book();for(let month=0;month<12;month++)appendLegacyMonthlySheet(wb,{store,year,month,closings,expenses,categories});
 wb.Workbook=wb.Workbook||{};wb.Workbook.CalcPr={calcMode:'auto',fullCalcOnLoad:true,forceFullCalc:true};return wb;
}
export function exportStoreAnnualWorkbook(args){const wb=buildStoreAnnualWorkbook(args);write(wb,`Gastos y ventas ${args.store.name} ${args.year}.xlsx`);}


const GESTOR_NAVY='17365D',GESTOR_BLUE='4472C4',GESTOR_ALT='D9EAF7',GESTOR_LINE='5B9BD5',GESTOR_WARN='FFF2CC',GESTOR_OK='E2F0D9';
function gestorHeader(ws,row,cols){
 for(let i=0;i<cols;i++){const a=XLSX.utils.encode_cell({r:row,c:i});if(ws[a])ws[a].s={fill:{fgColor:{rgb:GESTOR_BLUE}},font:{bold:true,color:{rgb:'FFFFFF'},name:'Calibri',sz:10},alignment:{horizontal:'center',vertical:'center'},border:{bottom:{style:'thin',color:{rgb:GESTOR_LINE}}}}}
}
function gestorTitle(ws,title,lastCol){
 ws['A1']={t:'s',v:title,s:{fill:{fgColor:{rgb:GESTOR_NAVY}},font:{bold:true,color:{rgb:'FFFFFF'},name:'Calibri',sz:14},alignment:{horizontal:'left',vertical:'center'}}};
 ws['!merges']=(ws['!merges']||[]).concat([XLSX.utils.decode_range(`A1:${lastCol}1`)]);
}
function sheetCurrency(ws,start,end,cols){
 for(let r=start;r<=end;r++)for(const col of cols){const a=`${col}${r}`;if(ws[a]){ws[a].z='#,##0.00 "€"';ws[a].s={...(ws[a].s||{}),alignment:{horizontal:'right'},fill:{fgColor:{rgb:r%2?GESTOR_ALT:'FFFFFF'}},border:{bottom:{style:'thin',color:{rgb:GESTOR_LINE}}}}}}
}
function quarterRange(year,q){const sm=(q-1)*3+1,em=q*3;return {from:`${year}-${String(sm).padStart(2,'0')}-01`,to:`${year}-${String(em).padStart(2,'0')}-${String(new Date(year,em,0).getDate()).padStart(2,'0')}`,months:[sm-1,sm,sm+1]}}
function inDate(v,from,to){const d=String(v||'').slice(0,10);return d>=from&&d<=to}
function categoryConcept(categories,id){const c=categories.find(x=>x.id===id);return (c?.name||c?.code||'OTROS').toUpperCase().slice(0,28)}
function fiscalIncomeForPeriod({from,to,closings,invoices=[],fiscalAdjustments=[],incomeAdjustments=[]}){
 const close=closings.filter(x=>x.include_in_income!==false&&inDate(x.business_date,from,to)).reduce((a,x)=>a+n(x.cash_sales)+n(x.card_sales)+n(x.bizum_sales)+n(x.online_sales)+n(x.other_income),0);
 const inv=invoices.filter(x=>x.document_type==='factura'&&x.status==='emitida'&&x.include_in_income===true&&inDate(x.issue_date,from,to)).reduce((a,x)=>a+n(x.total_amount),0);
 const adj=fiscalAdjustments.filter(x=>x.kind==='ingreso_extra'&&inDate(x.adjustment_date,from,to)).reduce((a,x)=>a+n(x.amount),0);
 return close+inv+adj+incomeAdjustments.filter(x=>inDate(x.income_date,from,to)).reduce((a,x)=>a+n(x.amount),0);
}
function expenseLineRows({from,to,expenses,expenseLines,categories}){
 const valid=expenses.filter(x=>!x.management_only&&inDate(x.expense_date,from,to));
 const byExpense=new Map(valid.map(x=>[x.id,x]));const out=[];let order=1;
 for(const line of expenseLines.filter(x=>byExpense.has(x.expense_id)).sort((a,b)=>String(byExpense.get(a.expense_id).expense_date).localeCompare(String(byExpense.get(b.expense_id).expense_date))||(a.sort_order||0)-(b.sort_order||0))){
   const e=byExpense.get(line.expense_id),base=n(line.base_amount),vat=n(line.vat_amount),re=n(line.re_amount),wh=n(line.withholding_amount),total=base+vat+re,net=total-wh;
   out.push([order++,fmtDate(e.expense_date),'',e.invoice_number||'', '',e.supplier_tax_id||'',e.supplier_name||'',categoryConcept(categories,line.category_id||e.category_id),base,n(line.vat_rate),vat,n(line.re_base),n(line.re_rate),re,n(line.irpf_imputable),n(line.withholding_base),n(line.withholding_rate),wh,total,net]);
 }
 return out;
}
function appendGestorBookSheet(wb,q,args){
 const {year,expenses,expenseLines,categories}=args,rng=quarterRange(year,q),rows=expenseLineRows({from:rng.from,to:rng.to,expenses,expenseLines,categories});
 const headers=['Orden','Fecha','Nº fra. recibida','Nº fra. proveedor','Rt','NIF/CIF','Razón social','Concepto','Base IVA','% IVA','Cuota IVA','Base R.E.','% R.E.','Cuota R.E.','Imputable a IRPF','Base retención','% retención','Cuota retenida','Total factura','Neto pagado'];
 const ws=XLSX.utils.aoa_to_sheet([[null],[],headers,...rows]);gestorTitle(ws,`Compras y gastos / Facturas recibidas - Libro gestor ${q}T`,'T');gestorHeader(ws,2,20);
 ws['!cols']=[8,13,14,21,6,14,31,25,14,10,13,14,10,13,17,16,11,15,15,15].map(w=>({wch:w-XLSX_WCH_PAD}));ws['!freeze']={ySplit:3};ws['!autofilter']={ref:`A3:T${rows.length+3}`};
 for(let r=4;r<=rows.length+3;r++){for(let col=0;col<20;col++){const a=XLSX.utils.encode_cell({r:r-1,c:col});if(ws[a])ws[a].s={...(ws[a].s||{}),font:{name:'Calibri',sz:9},fill:{fgColor:{rgb:r%2?GESTOR_ALT:'FFFFFF'}},border:{bottom:{style:'thin',color:{rgb:GESTOR_LINE}}}}}}
 sheetCurrency(ws,4,rows.length+3,['I','J','K','L','M','N','O','P','Q','R','S','T']);
 XLSX.utils.book_append_sheet(wb,ws,`Libro gestor ${q}T`);
 return rows;
}
function monthTotals(args,month){
 const {year,stores,closings,expenses,invoices=[],fiscalAdjustments=[],incomeAdjustments=[]}=args,from=excelDateKey(year,month,1),to=`${year}-${String(month+1).padStart(2,'0')}-${String(new Date(year,month+1,0).getDate()).padStart(2,'0')}`;
 const sales=stores.map(s=>{
   const close=closings.filter(x=>x.store_id===s.id&&x.include_in_income!==false&&inDate(x.business_date,from,to)).reduce((a,x)=>a+n(x.cash_sales)+n(x.card_sales)+n(x.bizum_sales)+n(x.online_sales)+n(x.other_income),0);
   const inv=invoices.filter(x=>x.store_id===s.id&&x.document_type==='factura'&&x.status==='emitida'&&x.include_in_income===true&&inDate(x.issue_date,from,to)).reduce((a,x)=>a+n(x.total_amount),0);
   const adj=fiscalAdjustments.filter(x=>x.kind==='ingreso_extra'&&x.store_id===s.id&&inDate(x.adjustment_date,from,to)).reduce((a,x)=>a+n(x.amount),0);
   return close+inv+adj+incomeAdjustments.filter(x=>x.store_id===s.id&&inDate(x.income_date,from,to)).reduce((a,x)=>a+n(x.amount),0);
 });
 const direct=stores.map(s=>expenses.filter(x=>x.store_id===s.id&&!x.management_only&&inDate(x.expense_date,from,to)).reduce((a,x)=>a+n(x.accounting_amount||x.gross_expense||x.amount_paid),0));
 const common=expenses.filter(x=>!x.store_id&&!x.management_only&&inDate(x.expense_date,from,to)).reduce((a,x)=>a+n(x.accounting_amount||x.gross_expense||x.amount_paid),0);
 return {from,to,sales,direct,common};
}
function appendReconciliationSheet(wb,q,args){
 const {year,stores,fiscalAdjustments=[]}=args,rng=quarterRange(year,q);const months=rng.months.map(m=>monthTotals(args,m));
 const rows=months.map((x,i)=>{const adjustment=fiscalAdjustments.filter(a=>inDate(a.adjustment_date,x.from,x.to)&&a.kind!=='retencion_soportada'&&a.kind!=='ingreso_extra').reduce((s,a)=>s+n(a.amount),0);const sales=x.sales.reduce((a,b)=>a+b,0),direct=x.direct.reduce((a,b)=>a+b,0),gestor=direct+x.common+adjustment;return [MONTHS[rng.months[i]],x.sales[0]||0,x.sales[1]||0,sales,-(x.direct[0]||0),-(x.direct[1]||0),-x.common,adjustment,-gestor,sales-gestor,0,sales-gestor]});
 const totals=new Array(12).fill(0);totals[0]='TOTAL';for(let c=1;c<12;c++)totals[c]=rows.reduce((a,r)=>a+n(r[c]),0);
 const headers=['Mes','Ventas Hortimatic','Ventas NewOldSmok','Ventas totales','Gasto directo Horti','Gasto directo NewOld','Gastos comunes','Ajuste / diferencia gestor','Gastos gestor','Resultado fiscal','Luz almacén incluida','Resultado corregido sin luz almacén'];
 const ws=XLSX.utils.aoa_to_sheet([[null],[],headers,...rows,totals,[],['Fórmula visible: Ventas totales - Gastos del gestor = Resultado fiscal. Los gastos del gestor se forman con gastos directos de las dos tiendas + gastos comunes + ajustes de conciliación.']]);gestorTitle(ws,`Conciliación fiscal trazable - ${q}T ${year}`,'L');gestorHeader(ws,2,12);ws['!cols']=[15,18,19,17,19,20,17,22,17,17,18,24].map(w=>({wch:w-XLSX_WCH_PAD}));ws['!freeze']={ySplit:3};
 sheetCurrency(ws,4,7,['B','C','D','E','F','G','H','I','J','K','L']);for(let c=1;c<12;c++){const col=XLSX.utils.encode_col(c);const cell=ws[col+'7'];if(cell){cell.f=`SUM(${col}4:${col}6)`;cell.t='n';cell.z='#,##0.00 "€"'}}for(let c=0;c<12;c++){const a=XLSX.utils.encode_cell({r:6,c});if(ws[a])ws[a].s={...(ws[a].s||{}),font:{bold:true},fill:{fgColor:{rgb:'D9EAD3'}}}}
 ws['!merges']=(ws['!merges']||[]).concat([XLSX.utils.decode_range('A9:L13')]);
 XLSX.utils.book_append_sheet(wb,ws,`Conciliación ${q}T`);
 return totals;
}
function appendAuditSheet(wb,args,quarterStats){
 const {year,taxPayments=[],fiscalAdjustments=[]}=args,rows=[];
 for(let q=1;q<=4;q++){
   const rng=quarterRange(year,q),income=fiscalIncomeForPeriod({...args,from:rng.from,to:rng.to}),expense=args.expenses.filter(x=>!x.management_only&&inDate(x.expense_date,rng.from,rng.to)).reduce((a,x)=>a+n(x.accounting_amount||x.gross_expense||x.amount_paid),0);
   const extraDed=fiscalAdjustments.filter(x=>x.kind==='gasto_deducible_extra'&&inDate(x.adjustment_date,rng.from,rng.to)).reduce((a,x)=>a+n(x.amount),0),result=income-expense-extraDed,diff=Math.max(0,result*n(args.settings?.difficult_expense_pct||5)/100),base=Math.max(0,result-diff),calc=base*n(args.settings?.irpf_prepayment_rate||20)/100;
   const paid=taxPayments.find(x=>x.tax_type==='130'&&Number(x.fiscal_year)===year&&Number(x.quarter)===q&&x.status==='pagado'),status=paid?(Math.abs(n(paid.amount)-calc)<.02?'Coincide al céntimo':'Diferencia '+(n(paid.amount)-calc).toFixed(2)+' €'):'Sin pago registrado';
   rows.push([`${q}T`,income,-expense,result,-diff,base,-calc,status]);
 }
 const ws=XLSX.utils.aoa_to_sheet([['Auditoría y conciliación con la gestoría - Año '+year],[],['Periodo','Ventas correctas','Gastos gestor','Resultado antes 5 %','5 % difícil justificación','Base neta','20 % / Modelo 130','Estado'],...rows]);gestorTitle(ws,`Auditoría y conciliación con la gestoría - Año ${year}`,'H');gestorHeader(ws,2,8);ws['!cols']=[28,18,18,20,22,24,20,45].map(w=>({wch:w-XLSX_WCH_PAD}));sheetCurrency(ws,4,7,['B','C','D','E','F','G']);for(const [col,label] of [['A','Incidencia'],['B','Periodo'],['C','Importe incluido'],['D','Impacto en gasto'],['E','Impacto estimado en IRPF'],['F','Acción recomendada']])setCell(ws,col+'8',label,{font:{name:'Calibri',sz:10,bold:true},fill:{fgColor:{rgb:GESTOR_ALT}},alignment:{wrapText:true}});ws['!merges'].push(XLSX.utils.decode_range('A12:H17'));setCell(ws,'A12','Comprobación: contrastar ventas, gastos, regularizaciones y pagos registrados con los justificantes originales antes de presentar impuestos.',{font:{name:'Calibri',sz:11},alignment:{wrapText:true,vertical:'top'}});ws['!ref']='A1:H17';XLSX.utils.book_append_sheet(wb,ws,'Auditoría gestor');
}
export function buildGestorWorkbook(args){const wb=book(),quarterStats=[];appendAuditSheet(wb,args,quarterStats);for(let q=1;q<=4;q++)appendReconciliationSheet(wb,q,args);for(let q=1;q<=4;q++)appendGestorBookSheet(wb,q,args);wb.Workbook=wb.Workbook||{};wb.Workbook.CalcPr={calcMode:'auto',fullCalcOnLoad:true,forceFullCalc:true};return wb;}
export function exportGestorWorkbook(args){const wb=buildGestorWorkbook(args);write(wb,`Libros_gestor_y_auditoria_${args.year}_Totus.xlsx`);}
export function workbookBlob(wb){return new Blob([XLSX.write(wb,{type:'array',bookType:'xlsx',cellStyles:true})],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});}
