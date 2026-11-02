// Reuse a complete saved receipt extraction only after the caller has downloaded
// and hashed the original. Queries use the AI's scoped client, never service_role.
export async function verifiedSavedExtraction(client,sha256,{authorize=async()=>{}}={}){
 if(!/^[a-f0-9]{64}$/.test(sha256||''))return null;
 await authorize('documentos','view');
 const docs=await client.from('ops_documents').select('id').eq('sha256',sha256).order('id').limit(21);
 if(docs.error)throw Error('No se pudo comprobar la lectura guardada del original.');
 if(!docs.data?.length||docs.data.length>20)return null;
 const sources=await client.from('ops_stock_sources').select('extracted_text,extraction').in('document_id',docs.data.map(d=>d.id)).order('id').limit(21);
 if(sources.error)throw Error('No se pudo consultar la lectura autorizada de la recepción.');
 if(!sources.data?.length||sources.data.length>20)return null;
 const texts=[];
 for(const source of sources.data){
  const e=source.extraction||{},text=source.extracted_text;
  if(e.state!=='ready'||typeof text!=='string'||!text.trim()||text.length>120000||e.warnings?.length)continue;
  const paged=['pdfjs-text-v1','sharepoint-text-v1'].includes(e.reader)&&Number.isInteger(e.total_pages)&&e.total_pages>0&&Array.isArray(e.pages)&&e.pages.length===e.total_pages&&e.pages.every((p,i)=>p.page===i+1&&p.readable===true);
  const hashed=['cloudflare','verified-saved-extraction','verified-original-text'].includes(e.reader)&&e.sha256===sha256;
  if(paged||hashed)texts.push(text);
 }
 if(!texts.length||texts.some(t=>t!==texts[0]))return null;
 await authorize('documentos','view');
 return {text:texts[0],reader:'verified-saved-extraction',sha256_verified:true};
}
