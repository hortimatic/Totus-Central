import {STOCK_STATES,stockLineResult,stockSummary} from './stock-core.js';
const text=v=>String(v??'');
export const stockIdentity=v=>text(v).trim().toLocaleLowerCase('es');
export function filterStockReceipts(rows,{query='',store='all',from='',to='',status='all'}={},storeName=()=> ''){
 if(from&&to&&from>to)throw new Error('La fecha inicial debe ser anterior o igual a la final.');
 const q=stockIdentity(query);
 return rows.filter(r=>(store==='all'||r.store_id===store)&&(!from||r.received_on>=from)&&(!to||r.received_on<=to)&&(status==='all'||r.status===status)&&(!q||stockIdentity([r.supplier,r.reference,storeName(r.store_id),STOCK_STATES[r.status]].join(' ')).includes(q)));
}
export function sameStockEquivalence(e,r,receipt){
 return e.store_id===receipt.store_id&&['supplier','supplier_name','prestashop_name','variant','unit'].every(k=>stockIdentity(e[k])===stockIdentity(k==='supplier'?receipt.supplier:r[k]));
}
export function stockExportRows(context,storeName=''){
 const r=context.receipt,sources=context.sources||[],summary=stockSummary(r.result,sources);
 return (r.result?.rows||[]).map(line=>{
  const x=stockLineResult(line);
  return {'Fecha':r.received_on,'Tienda':storeName,'Proveedor':r.supplier,'Pedido o referencia':r.reference,'Revisión':r.revision,
   'Estado del pedido':STOCK_STATES[summary.status],
   'Producto del proveedor':line.supplier_name||'','Producto de PrestaShop':line.prestashop_name||'','Variante':line.variant||'','Unidad':line.unit||'',
   'Cantidad en factura':line.supplier_qty??null,'Unidades por paquete':line.unit_factor??null,'Unidades esperadas':x.expected,
   'Unidades en PrestaShop':line.prestashop_qty??null,'Ajuste externo':line.adjustment_qty??null,'Ajuste incluido':line.adjustment_included==='yes'?'Sí':line.adjustment_included==='no'?'No':'Pendiente',
   'Unidades recibidas del pedido':x.received,'Diferencia':x.difference,'Estado de la línea':STOCK_STATES[x.status],
   'Conversión confirmada':line.conversion_reason||'','Motivo del ajuste':line.adjustment_reason||'','Pendiente de revisar':x.reasons.join(' · '),
   'Documentos y líneas de origen':(line.source_refs||[]).map(ref=>(sources.find(s=>s.id===ref.source_id)?.document?.original_name||'Documento')+' · '+ref.locator).join('\n')};
 });
}
const escape=v=>text(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function stockReportHtml(context,storeName=''){
 const r=context.receipt,rows=stockExportRows(context,storeName),s=stockSummary(r.result,context.sources||[]);
 const fields=['Producto del proveedor','Producto de PrestaShop','Variante','Unidades esperadas','Unidades recibidas del pedido','Diferencia','Estado de la línea','Documentos y líneas de origen'];
 return '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Cotejo · '+escape(r.reference||r.supplier)+'</title><style>body{font:14px system-ui;color:#182536;max-width:1200px;margin:32px auto;padding:0 20px}h1{font-size:26px}small,p{line-height:1.5}table{border-collapse:collapse;width:100%;font-size:12px}td,th{border:1px solid #d8e0ea;padding:9px;text-align:left;vertical-align:top;white-space:pre-line}th{background:#edf3f9}tr:nth-child(even){background:#fafcfe}.status{padding:12px;background:#edf3f9;border-radius:8px}.note{color:#526174}@media print{@page{size:A4 landscape;margin:12mm}body{margin:0;padding:0;max-width:none}thead{display:table-header-group}tr{break-inside:avoid}}</style><h1>Totus Central · Cotejo de mercancía</h1><p><b>'+escape(r.supplier)+'</b><br>'+escape(storeName)+' · '+escape(r.received_on)+' · '+escape(r.reference)+' · Revisión '+r.revision+'</p><p class="status">'+escape(STOCK_STATES[s.status])+' · '+rows.length+' líneas · '+s.differences+' con diferencia</p>'+(s.issues.length?'<p>'+escape(s.issues.map(issue=>(context.sources||[]).reduce((v,source)=>v.replaceAll(source.id,source.document?.original_name||'Documento'),issue)).join(' · '))+'</p>':'')+'<table><thead><tr>'+fields.map(f=>'<th>'+escape(f)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+fields.map(f=>'<td>'+escape(row[f]??'Pendiente')+'</td>').join('')+'</tr>').join('')+'</tbody></table><h2>Conversiones y ajustes</h2>'+rows.filter(row=>row['Conversión confirmada']||row['Motivo del ajuste']).map(row=>'<p><b>'+escape(row['Producto del proveedor'])+'</b><br>'+escape(row['Cantidad en factura'])+' × '+escape(row['Unidades por paquete'])+' = '+escape(row['Unidades esperadas'])+' unidades<br>'+escape(row['Conversión confirmada'])+' '+escape(row['Motivo del ajuste'])+'</p>').join('')+'<p class="note">Una cantidad pendiente no es cero. Este informe conserva el estado y las fuentes de la revisión indicada. No modifica existencias ni contabilidad. Puedes imprimirlo o guardarlo como PDF desde el navegador.</p></html>';
}
export function stockChatEvidence(context){
 const r=context.receipt;
 return JSON.stringify({application:'Totus Central',receipt_id:r.id,revision:r.revision,store_id:r.store_id,supplier:r.supplier,reference:r.reference,received_on:r.received_on,
 sources:(context.sources||[]).map(s=>({id:s.id,kind:s.source_kind,name:s.document?.original_name,graph_item_url:s.document?.graph_item_url||s.graph_item_url,text:s.extracted_text,extraction:s.extraction})),
 equivalences:context.equivalences||[]},null,2);
}
