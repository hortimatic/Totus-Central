// The caller supplies server-authenticated archive verification and Storage removal.
// Each path stays reserved by the private retirement ledger even after finish;
// delayed duplicate work cannot target a newly reused original at that path.
export function createDocumentRemovalWorker({rpc,verifyArchive,removeFile}){
 if(typeof verifyArchive!=='function')throw new Error('Falta la verificación del archivo recuperable.');
 return async function run(limit=5){
  if(!Number.isInteger(limit)||limit<1||limit>5)throw new Error('Lote de retirada no válido.');
  const rows=await rpc('totus_pending_document_removals',{});
  if(!Array.isArray(rows))throw new Error('No se pudo comprobar la cola de documentos pendientes.');
  let completed=0;const errors=[];
  for(const row of rows.slice(0,limit)){
   try{
    if(!row?.id||typeof row.storage_path!=='string')throw new Error('Solicitud de retirada no válida.');
    const proof=await verifyArchive(row);
    if(proof?.id===row.id&&proof?.status==='already_removed'){completed++;continue;}
    if(proof?.id!==row.id||proof?.status!=='archive_verified'||proof.storage_path!==row.storage_path||proof.sha256!==(row.sha256||''))throw new Error('No se ha confirmado un original recuperable de este documento.');
    if(row.storage_path)await removeFile('business-documents',row.storage_path);
    const result=await rpc('totus_finish_document_removal',{p_id:row.id,p_path:row.storage_path,p_sha256:row.sha256||''});
    if(result?.id!==row.id||!['removed','already_removed'].includes(result?.status))throw new Error('No se pudo confirmar la retirada documental.');
    completed++;
   }catch(error){errors.push({id:row?.id||null,message:error?.message||'No se pudo completar la retirada.'});}
  }
  const remaining=await rpc('totus_pending_document_removals',{});
  if(!Array.isArray(remaining))throw new Error('No se pudo comprobar el resultado de la cola documental.');
  return {completed,failed:errors.length,pending:remaining.length,errors};
 };
}
