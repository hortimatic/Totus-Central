// The browser only requests retirement. The server verifies a recoverable
// archive before touching Storage and finishing metadata. Interrupted work
// remains in its private queue; an uncertain reply is checked against the intent.
export async function retireStoredDocument(document,{rpc,completeRemoval}){
 if(!document?.id)throw new Error('Falta el documento que se quiere eliminar.');
 if(typeof completeRemoval!=='function')throw new Error('Falta el servicio de archivo y retirada segura. No se ha tocado el original.');
 const args={p_id:document.id,p_path:document.storage_path||'',p_sha256:document.sha256||''};
 const begun=await rpc('totus_begin_document_removal',args);
 if(begun?.id!==document.id||!['pending','already_removed'].includes(begun?.status))throw new Error('No se pudo confirmar la autorización para eliminar este archivo. No se ha tocado su contenido.');
 if(begun.status==='already_removed')return begun;
 try{
  const finished=await completeRemoval(document);
  if(finished?.id!==document.id||!['removed','already_removed'].includes(finished?.status))throw new Error('No se pudo confirmar el final de la eliminación. Actualiza su estado antes de reintentar.');
  return finished;
 }catch(error){
  try{const readBack=await rpc('totus_begin_document_removal',args);if(readBack?.id===document.id&&readBack?.status==='already_removed')return readBack;}catch{}
  error.documentRemovalPending=true;
  throw error;
 }
}
