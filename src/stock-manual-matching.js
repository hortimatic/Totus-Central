// Manual pairing operates only on unmatched documentary lines. It never edits
// the underlying PDFs, PrestaShop stock, or reusable product equivalences.
const string=value=>String(value??'').trim();

export function unmatchedStockRows(rows=[]){
 return {
  supplier:rows.filter(row=>string(row.supplier_name)&&!string(row.prestashop_name)&&row.match_confirmed!==true),
  prestashop:rows.filter(row=>string(row.prestashop_name)&&!string(row.supplier_name)&&row.match_confirmed!==true)
 };
}

export function pairUnmatchedStockRows(rows,{supplierLineId,prestashopLineId,note,issueKind,actor}={}){
 const supplier=rows.find(row=>row.id===supplierLineId);
 const prestashop=rows.find(row=>row.id===prestashopLineId);
 if(!supplier||!prestashop||supplier===prestashop)throw new Error('Selecciona una línea distinta de cada documento.');
 const unmatched=unmatchedStockRows(rows);
 if(!unmatched.supplier.includes(supplier)||!unmatched.prestashop.includes(prestashop)){
  throw new Error('La correspondencia cambió. Actualiza la recepción antes de asignar.');
 }
 if(!['same_product','prestashop_catalog','supplier_catalog'].includes(issueKind)){
  throw new Error('Indica si se trata del mismo producto o de una incidencia de catálogo.');
 }
 if(string(note).length<20||string(note).length>5000){
  throw new Error('La asignación necesita una comprobación escrita de 20 a 5000 caracteres.');
 }
 if(typeof supplier.supplier_qty!=='number'||typeof prestashop.prestashop_qty!=='number'||
    supplier.prestashop_qty!==0||prestashop.supplier_qty!==0){
  throw new Error('Las cantidades documentales no admiten esta asignación.');
 }
 if(!Array.isArray(supplier.source_refs)||!supplier.source_refs.length||
    !Array.isArray(prestashop.source_refs)||!prestashop.source_refs.length){
  throw new Error('Cada artículo debe conservar la referencia a su documento.');
 }
 const sourceRefs=[...supplier.source_refs,...prestashop.source_refs];
 if(sourceRefs.some(ref=>!string(ref.source_id)||!string(ref.line_id)||!string(ref.locator))){
  throw new Error('Faltan referencias completas de los documentos originales.');
 }
 const refKeys=sourceRefs.map(ref=>[ref.source_id,ref.line_id].join(':'));
 if(refKeys.some((key,index)=>!key||refKeys.indexOf(key)!==index)){
  throw new Error('La asignación duplicaría una línea del documento.');
 }
 const updated={
  ...supplier,
  prestashop_name:prestashop.prestashop_name,
  prestashop_qty:prestashop.prestashop_qty,
  match_confirmed:true,
  source_refs:sourceRefs,
  match_note:string(note),
  manual_assignment:{
   supplier_line_id:supplier.id,
   prestashop_line_id:prestashop.id,
   prestashop_variant:prestashop.variant||'',
   kind:issueKind,
   reason:string(note),
   assigned_by:string(actor),
   assigned_at:new Date().toISOString()
  }
 };
 return {
  row:updated,
  rows:rows.filter(row=>row.id!==prestashopLineId)
    .map(row=>row.id===supplierLineId?updated:row)
 };
}
