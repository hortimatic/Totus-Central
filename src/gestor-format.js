import {esc,fmtDate,inRange} from './utils.js';

// Column order and tax split transcribed from the accountant's original report.
// The accountant owns Nºfra.rec. and Rt; never invent those references.
export const GESTOR_SOURCE_COLUMNS=['Orden','fecha','Nºfra.rec.','Nºfra.proveedor','Rt','Identificación','Concepto','Base IVA','%','Cuota IVA','Base R. Equiv.','%','Cuota R.Equiv.','Imputable a IRPF','Base retención','%','Cuota retenida'];
export const GESTOR_AMOUNT_COLUMNS=[7,9,10,12,13,14,16];
const round=v=>Math.round((Number(v)+Number.EPSILON)*100)/100;
const numeric=(v,label)=>{const n=Number(v??0);if(!Number.isFinite(n))throw new Error('Dato no válido en '+label);return n};
const concepts={MERCH:'COMPRAS MERCADERIAS',RENT:'ARRENDAMIENTOS Y CAN',PAYROLL:'SUELDOS Y SALARIOS',SOCIAL:'SEGURIDAD SOCIAL O A',RETA:'SEGURIDAD SOCIAL O A',UTILITIES:'SUMINISTROS',BANK:'SERVICIOS BANCARIOS',PROFESSIONAL:'SERVICIOS PROFESIONA'};

export function buildGestorSourceRows({expenses=[],expenseLines=[],categories=[],from='',to='',store='all'}={}){
 const grouped=new Map();
 for(const line of expenseLines){const key=String(line.expense_id);if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(line)}
 const selected=expenses.filter(e=>!e.management_only&&e.fiscal_reviewed===true&&inRange(e.expense_date,from,to)&&(store==='all'||e.store_id===store))
  .sort((a,b)=>String(a.expense_date).localeCompare(String(b.expense_date))||String(a.created_at||'').localeCompare(String(b.created_at||''))||String(a.id).localeCompare(String(b.id)));
 const rows=[];
 for(const expense of selected){
  const lines=(grouped.get(String(expense.id))||[]).slice().sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0)||String(a.id||'').localeCompare(String(b.id||'')));
  if(!lines.length)throw new Error('Falta el desglose de la factura '+(expense.invoice_number||expense.id)+'. Revísala antes de preparar la tabla de gestoría.');
  for(const line of lines){
   const base=numeric(line.base_amount,'base'),vat=numeric(line.vat_amount,'IVA'),re=numeric(line.re_amount,'recargo');
   const category=categories.find(c=>c.id===(line.category_id||expense.category_id));
   const concept=concepts[category?.code]||category?.name?.toUpperCase()||line.description||expense.description||'';
   const identity=[expense.supplier_tax_id,expense.supplier_name].filter(Boolean).join(' ');
   const deductible=line.deductible_irpf===false?0:numeric(line.irpf_imputable,'IRPF');
   const total=base+vat+re;
   const baseDeductible=total===0?0:round(deductible*base/total),taxDeductible=round(deductible-baseDeductible);
   const common=[fmtDate(expense.expense_date),expense.received_invoice_number||'',expense.invoice_number||'',expense.accountant_rt||'',identity];
   rows.push([rows.length+1,...common,concept,base,numeric(line.vat_rate,'tipo IVA'),vat,numeric(line.re_base,'base recargo'),numeric(line.re_rate,'tipo recargo'),re,baseDeductible,numeric(line.withholding_base,'base retención'),numeric(line.withholding_rate,'tipo retención'),numeric(line.withholding_amount,'retención')]);
   if(vat!==0||re!==0)rows.push([rows.length+1,...common,'IVA SOPORTADO(RECARG','','','','','','',taxDeductible,'','','']);
  }
 }
 return rows;
}

export function gestorSourceTotals(rows){return GESTOR_SOURCE_COLUMNS.map((_,i)=>GESTOR_AMOUNT_COLUMNS.includes(i)?round(rows.reduce((sum,row)=>sum+numeric(row[i],'total'),0)):'')}
const number=v=>Number(v).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2});
const widths=[2.4,4,4,6,1.5,17.5,13.5,5,2.5,5,5,2.5,5,6.5,5,2.5,6.6];
function rowHtml(row){return '<tr>'+row.map((v,i)=>`<td class="${i>=7?'num':''}">${esc(v===''?'':i>=7?number(v):v)}</td>`).join('')+'</tr>'}

export function gestorSourceBreakdown(rows){
 const vat=new Map(),surcharge=new Map(),concepts=new Map();
 let retentionBase=0,retention=0;
 for(const row of rows){
  if(row[7]!==''){const rate=Number(row[8]||0),group=vat.get(rate)||{base:0,tax:0};group.base+=Number(row[7]||0);group.tax+=Number(row[9]||0);vat.set(rate,group)}
  if(Number(row[10])||Number(row[12])){const rate=Number(row[11]||0),group=surcharge.get(rate)||{base:0,tax:0};group.base+=Number(row[10]||0);group.tax+=Number(row[12]||0);surcharge.set(rate,group)}
  retentionBase+=Number(row[14]||0);retention+=Number(row[16]||0);
  const key=String(row[6]||'Sin concepto'),values=concepts.get(key)||Array(7).fill(0);
  GESTOR_AMOUNT_COLUMNS.forEach((column,i)=>values[i]+=Number(row[column]||0));concepts.set(key,values);
 }
 return {vat:[...vat].sort((a,b)=>a[0]-b[0]),surcharge:[...surcharge].sort((a,b)=>a[0]-b[0]),concepts:[...concepts].sort((a,b)=>a[0].localeCompare(b[0],'es')),retentionBase,retention};
}
function breakdownHtml(rows,offset=0){
 const data=gestorSourceBreakdown(rows),blank=v=>v?number(v):'';
 const types=Array.from({length:Math.max(1,data.vat.length,data.surcharge.length)},(_,i)=>{
  const vat=data.vat[i],re=data.surcharge[i];
  return `<tr>${[vat?blank(vat[1].base):'',vat?number(vat[0]):'',vat?blank(vat[1].tax):'',re?blank(re[1].base):'',re?number(re[0]):'',re?blank(re[1].tax):'',i===0?blank(data.retentionBase):'',i===0?blank(data.retention):''].map(v=>`<td class="num">${v}</td>`).join('')}</tr>`;
 }).join('');
 // Unknown accounting codes stay blank: categories must not invent the accountant's coding.
 const codes={'COMPRAS MERCADERIAS':'600','ARRENDAMIENTOS Y CAN':'621','SERVICIOS PROFESIONA':'623','SERVICIOS BANCARIOS':'626','SUMINISTROS':'628','IVA SOPORTADO(RECARG':'632','SUELDOS Y SALARIOS':'640'};
 return `<h2>DESGLOSE POR TIPOS</h2><table class="breakdown"><thead><tr>${['Base IVA','%','Cuota IVA','Base R.Eq.','%','Cuota R.Eq.','Base retención','Cuota retenida'].map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${types}</tbody></table><h2>DESGLOSE POR CONCEPTOS</h2><table class="breakdown"><colgroup><col style="width:5%"><col style="width:32%">${Array(7).fill('<col style="width:9%">').join('')}</colgroup><thead><tr>${['Código','Descripción','Base IVA','Cuota IVA','Base R. Equiv.','Cuota R. Equiv.','Imputable IRPF','Base retención','Cuota retenida'].map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${data.concepts.slice(offset,offset+24).map(([concept,values])=>`<tr><td>${codes[concept]||''}</td><td>${esc(concept)}</td>${values.map(v=>`<td class="num">${blank(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

export function gestorSourcePrintHtml({rows=[],previousRows=[],settings={},year=new Date().getFullYear(),from='',to='',rowsPerPage=46}={}){
 if(!Number.isInteger(rowsPerPage)||rowsPerPage<1||rowsPerPage>46)throw new Error('Paginación no válida.');
 const chunks=[];for(let i=0;i<rows.length;i+=rowsPerPage)chunks.push(rows.slice(i,i+rowsPerPage));
 if(!chunks.length)chunks.push([]);
 let accumulated=gestorSourceTotals(previousRows);
 const columns='<colgroup>'+widths.map(w=>`<col style="width:${w}%">`).join('')+'</colgroup>';
 const totals=(label,values)=>'<tr class="totals">'+GESTOR_SOURCE_COLUMNS.map((_,i)=>i===0?`<td colspan="7">${esc(label)}</td>`:i<7?'':`<td class="num">${values[i]===''?'':number(values[i])}</td>`).join('')+'</tr>';
 let pages=chunks.map((chunk,page)=>{
  const previous=accumulated,subtotal=gestorSourceTotals(chunk);
  accumulated=accumulated.map((v,i)=>GESTOR_AMOUNT_COLUMNS.includes(i)?round(Number(v)+Number(subtotal[i])):'');
  return `<section class="gestor-page"><header><div><strong>${esc(settings.business_name||'')}</strong><div>${esc(settings.business_address||'')}</div></div><div>D.N.I./C.I.F. : <strong>${esc(settings.tax_id||'')}</strong></div><div>Página ${page+1}<br>Ejercicio : ${esc(year)}</div></header><h1>Compras y gastos / Facturas recibidas (Var.Ex.-Desg.Sop./Rep.)</h1><div class="period">${esc(fmtDate(from))} - ${esc(fmtDate(to))}</div><table>${columns}<thead><tr class="carry"><td colspan="7">Actividad: TODAS · Sumas Anteriores ...</td>${previous.slice(7).map(v=>`<td class="num">${v===''||v===0?'':number(v)}</td>`).join('')}</tr><tr>${GESTOR_SOURCE_COLUMNS.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${chunk.map(rowHtml).join('')||'<tr><td colspan="17">Sin gastos fiscales revisados en el periodo.</td></tr>'}</tbody><tfoot>${totals('TOTAL DE PAGINA ..........',subtotal)}${totals('TOTAL ACUMULADO ..........',accumulated)}</tfoot></table></section>`;
 }).join('');
 for(let offset=0;offset<Math.max(1,gestorSourceBreakdown(rows).concepts.length);offset+=24){
 pages+=`<section class="gestor-page gestor-summary"><header><strong>${esc(settings.business_name||'')}</strong><span>D.N.I./C.I.F. : ${esc(settings.tax_id||'')}</span><span>Página ${chunks.length+1+offset/24} · Ejercicio : ${esc(year)}</span></header><h1>Compras y gastos / Facturas recibidas (Var.Ex.-Desg.Sop./Rep.)</h1><div class="period">DESDE: ${esc(fmtDate(from))} - HASTA: ${esc(fmtDate(to))} · Actividades: TODAS</div>${breakdownHtml(rows,offset)}</section>`;
 }
 return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Compras y gastos ${esc(year)}</title><style>@page{size:A4 landscape;margin:8mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#000;margin:0}header{display:flex;justify-content:space-between;font-size:9pt;line-height:1.5}h1{font-size:10pt;text-align:right;margin:2mm 0}.period{font-size:6.5pt;margin-bottom:1mm}h2{font-size:8pt;margin:5mm 0 2mm}.breakdown{font-size:7pt}.breakdown tbody tr{height:4mm}table{border-collapse:collapse;table-layout:fixed;width:100%;font-size:6pt}th,td{padding:.3mm .5mm;text-align:left;overflow-wrap:anywhere;vertical-align:top;line-height:1.15}th{font-weight:normal;border-bottom:1px solid #000}tbody tr:nth-child(odd),.carry{background:#c5c5c5}tbody tr{height:3.4mm}td.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.totals td{font-weight:bold}.totals:first-child td{border-top:1px solid #000}.totals td[colspan]{text-align:center;font-weight:normal}.gestor-page{break-after:page}.gestor-page:last-child{break-after:auto}tr{break-inside:avoid}@media screen{body{background:#eee;padding:16px}.gestor-page{background:white;width:281mm;min-height:194mm;margin:0 auto 20px;padding:0;box-shadow:0 1px 6px #999}}@media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>${pages}</body></html>`;
}
