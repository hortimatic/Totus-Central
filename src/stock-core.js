// Deterministic comparison only. Product matching is confirmed by a person or ChatGPT.
export const STOCK_STATES={pending:'Pendiente de cotejo',needs_review:'Falta revisar',differences:'Con diferencias',matched:'Sin diferencias documentales',reviewed:'Revisado'};
const quantity=v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1000000?v:null;
export function stockLineResult(row={}){
 const f=quantity(row.supplier_qty),p=quantity(row.prestashop_qty),a=quantity(row.adjustment_qty);
 const factor=quantity(row.unit_factor);
 const reasons=[];
 if(f===null||p===null)reasons.push('Falta una cantidad');
 if(row.match_confirmed!==true)reasons.push('Correspondencia sin confirmar');
 if(row.unit_confirmed!==true||!String(row.unit||'').trim()||factor===null||factor<=0)reasons.push('Unidad o conversión sin confirmar');
 if(factor!==null&&factor!==1&&!String(row.conversion_reason||'').trim())reasons.push('Falta justificar la conversión');
 if(a===null||!['yes','no'].includes(row.adjustment_included))reasons.push('Ajuste sin aclarar');
 if(a!==null&&a!==0&&!String(row.adjustment_reason||'').trim())reasons.push('Falta justificar el ajuste');
 const expected=f!==null&&factor!==null?f*factor:null;
 const received=p===null||a===null||!['yes','no'].includes(row.adjustment_included)?null:p-(row.adjustment_included==='yes'?a:0);
 const difference=expected===null||received===null?null:Math.round((received-expected)*1000000)/1000000;
 return {expected,received,difference,reasons,status:reasons.length?'needs_review':difference!==0?'differences':'matched'};
}
// Adjustments to a documented count are separate review evidence, not edits
// to the invoice or to the PrestaShop movement. Preserve both calculations.
export function stockCorrectedLineResult(row={}){
 const original=stockLineResult(row),change=row.unit_correction;
 const valid=v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1000000;
 if(!change||!valid(change.expected)||!valid(change.received)||!String(change.reason||'').trim()){
  return {...original,hasCorrection:false,originalExpected:original.expected,originalReceived:original.received,originalDifference:original.difference};
 }
 return {...original,expected:change.expected,received:change.received,
  difference:Math.round((change.received-change.expected)*1000000)/1000000,
  originalExpected:original.expected,originalReceived:original.received,originalDifference:original.difference,
  hasCorrection:true};
}
export function stockSummary(result={},sources=[]){
 const rows=Array.isArray(result.rows)?result.rows:[],coverage=Array.isArray(result.coverage)?result.coverage:[];
 const sourceIds=new Set(sources.map(s=>s.id)),used=new Set(),issues=[];
 if(!sources.some(s=>s.source_kind==='supplier')||!sources.some(s=>s.source_kind==='prestashop'))issues.push('Faltan documentos de uno de los dos lados');
 for(const source of sources){
  const entries=coverage.filter(c=>c.source_id===source.id),c=entries[0];
  if(entries.length!==1||c?.complete!==true||!String(c?.explanation||'').trim())issues.push('Cobertura pendiente: '+source.id);
  if(source.extraction?.state!=='ready'&&!(c?.manually_verified===true&&String(c?.reading_note||'').trim()))issues.push('Lectura pendiente: '+source.id);
 }
 if(coverage.some(c=>!sourceIds.has(c.source_id)))issues.push('Cobertura de un documento ajeno');
 const details=rows.map(row=>{
  const line=stockLineResult(row),refs=Array.isArray(row.source_refs)?row.source_refs:[];
  if(!refs.length)issues.push('Línea sin origen: '+row.id);
  for(const ref of refs){
   const key=ref.source_id+':'+ref.line_id;
   if(!sourceIds.has(ref.source_id)||!String(ref.locator||'').trim()||!String(ref.line_id||'').trim()||used.has(key))issues.push('Referencia inexistente, incompleta o repetida: '+key);
   used.add(key);
  }
  return {...line,id:row.id};
 });
 if(result.complete!==true||!rows.length||new Set(rows.map(r=>r.id)).size!==rows.length)issues.push('Revisión incompleta');
 const status=issues.length||details.some(r=>r.status==='needs_review')?'needs_review':details.some(r=>r.status==='differences')?'differences':'matched';
 return {status,rows:details,issues,differences:details.filter(r=>r.difference!==null&&r.difference!==0).length};
}
export function stockChatPrompt(receipt){
 return "Coteja la recepción RECEIPT_ID de Totus Central. Primero descubre las herramientas disponibles en este chat: Supabase y GitHub; SharePoint/OneDrive si está disponible. No confundas búsqueda web con acceso privado ni asumas que falta conexión sin intentar una lectura.\nLee docs/COTEJOS_CHATGPT.md en hortimatic/Totus-Central, rama totus-central.\nUsa Supabase awmojepsasikxocoeqtu: public.totus_stock_context para leer la revisión actual, textos completos disponibles, cobertura e identificadores Graph de los originales. Consulta su biblioteca de equivalencias confirmadas antes de proponer nombres distintos.\nSi OneDrive no ofrece lectura para un formato, usa extracted_text cuando la cobertura sea completa; no es necesario volver a configurar Microsoft para leer ese texto. Si faltan páginas o hay imágenes sin texto, lee el original con SharePoint/OneDrive o deja pendiente únicamente lo que no puedas comprobar.\nVerifica todos los documentos y líneas, respeta variantes y unidades por paquete, evita duplicar factura y albarán, y pregunta solo por equivalencias realmente dudosas. No generalices una equivalencia válida solo para este pedido.\nGuarda mediante public.totus_stock_save_result con la revisión actual y vuelve a leer para verificar que quedó guardado. No modifiques contabilidad ni PrestaShop. No leas claves ni crees enlaces públicos. Si una herramienta falta, indica cuál y la operación exacta intentada, y continúa con las vías disponibles. Nunca inventes un resultado correcto.".replace('RECEIPT_ID',receipt.id);
}
