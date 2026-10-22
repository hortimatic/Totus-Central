const HASH=/^[a-f0-9]{64}$/;
const validPath=p=>typeof p==='string'&&p&&p.length<=1024&&!/[\\\x00-\x1f]/.test(p)&&p.split('/').every(s=>s&&s!=='.'&&s!=='..');
export function createBackupDocumentLinks({admin,check,config,token,root,fetchGraph=fetch}){
 return async function backupDocumentLinks(paths){
  if(!Array.isArray(paths)||paths.length>30||new Set(paths).size!==paths.length||paths.some(p=>!validPath(p)))throw new Error('Lote de documentos no válido.');
  if(!paths.length)return {files:[]};
  const docs=check(await admin.from('ops_documents').select('id,storage_path,size_bytes,sha256').in('storage_path',paths),'No se pudo comprobar el inventario de documentos.');
  if(docs.length!==paths.length)throw new Error('Un documento del lote ya no está disponible.');
  const maps=check(await admin.from('ops_onedrive_documents').select('document_id,source_path,onedrive_item_id,size_bytes,sha256,verified_at').in('document_id',docs.map(d=>d.id)),'No se pudo comprobar la ubicación de los documentos.');
  const remote=[],local=[],files=[];
  for(const doc of docs){
   const m=maps.find(m=>m.document_id===doc.id);
   if(m&&m.source_path===doc.storage_path){
    if(!m.verified_at||!HASH.test(doc.sha256||'')||m.sha256!==doc.sha256||Number(m.size_bytes)!==Number(doc.size_bytes)||typeof m.onedrive_item_id!=='string'||!m.onedrive_item_id||m.onedrive_item_id.length>512)throw new Error('La ubicación del documento no coincide con su original.');
    remote.push({doc,map:m});
   }else local.push(doc);
  }
  if(local.length){
   const links=check(await admin.storage.from('business-documents').createSignedUrls(local.map(d=>d.storage_path),300),'No se pudo preparar el lote de originales.');
   for(const doc of local){
    const link=links.find(l=>l.path===doc.storage_path);
    if(link?.error||!link?.signedUrl||new URL(link.signedUrl).protocol!=='https:')throw new Error('Falta un original del lote.');
    files.push({path:doc.storage_path,url:link.signedUrl,size_bytes:Number(doc.size_bytes),sha256:doc.sha256,provider:'supabase'});
   }
  }
  if(remote.length){
   const c=await config();if(!c.connected||!c.tested_at)throw new Error('OneDrive no está comprobado.');
   const access=await token();await root(access);
   for(let start=0;start<remote.length;start+=20){
    const group=remote.slice(start,start+20);
    // Each GET uses an already verified item identity; callers cannot submit Graph routes.
    const requests=group.map(({map},i)=>({id:String(i),method:'GET',url:'/me/drive/items/'+encodeURIComponent(map.onedrive_item_id)}));
    const response=await fetchGraph('https://graph.microsoft.com/v1.0/$batch',{method:'POST',headers:{Authorization:'Bearer '+access,'Content-Type':'application/json'},body:JSON.stringify({requests}),signal:AbortSignal.timeout(20000),redirect:'error'});
    if(response.status===429)throw new Error('Rate limit de Microsoft. Retry after '+Math.max(1000,Number(response.headers.get('Retry-After')||1)*1000)+'ms.');
    if(!response.ok)throw new Error('Microsoft no pudo preparar el lote (HTTP '+response.status+').');
    const value=await response.json();
    if(!Array.isArray(value.responses)||value.responses.length!==group.length||new Set(value.responses.map(r=>r.id)).size!==group.length)throw new Error('Respuesta de lote incompleta.');
    for(let i=0;i<group.length;i++){
     const part=value.responses.find(p=>p.id===String(i)),{doc,map}=group[i];
     if(part?.status===429)throw new Error('Rate limit de Microsoft. Retry after '+Math.max(1000,Number(part.headers?.['Retry-After']||part.headers?.['retry-after']||1)*1000)+'ms.');
     const item=part?.body,url=item?.['@microsoft.graph.downloadUrl'];
     if(part?.status!==200||item?.id!==map.onedrive_item_id||Number(item?.size)!==Number(doc.size_bytes)||typeof url!=='string'||new URL(url).protocol!=='https:')throw new Error('Microsoft no ha confirmado un original del lote.');
     files.push({path:doc.storage_path,url,size_bytes:Number(doc.size_bytes),sha256:doc.sha256,provider:'onedrive'});
    }
   }
  }
  return {files};
 };
}
