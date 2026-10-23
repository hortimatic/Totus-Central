// Deterministic comparison only. Product matching is confirmed by a person or ChatGPT.
export const STOCK_STATES={pending:'Pendiente de cotejo',needs_review:'Falta revisar',differences:'Con diferencias',matched:'Sin diferencias documentales'};
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
 return 'Coteja la recepción '+receipt.id+' de Totus Central. Lee primero docs/COTEJOS_CHATGPT.md en hortimatic/Totus-Central, rama totus-central. Usa Supabase awmojepsasikxocoeqtu: public.totus_stock_context para obtener los documentos, su texto y sus identificadores de OneDrive. No modifiques contabilidad ni PrestaShop. Verifica todos los documentos y líneas, conserva las variantes y pide confirmación de equivalencias dudosas. Guarda el resultado con public.totus_stock_save_result indicando la revisión actual. Si algún documento no se puede leer, deja la recepción pendiente; nunca inventes un resultado correcto.';
}
