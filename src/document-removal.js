// Begin keeps metadata and the OneDrive map while locking out new associations.
// Finish runs only after Storage confirms the file is absent. Failed attempts
// stay in the private server queue so a retry or the worker can finish safely.
export async function retireStoredDocument(document,{rpc,removeFile}){
 if(!document?.id)throw new Error('Falta el documento que se quiere eliminar.');
 const args={p_id:document.id,p_path:document.storage_path||'',p_sha256:document.sha256||''};
 const begun=await rpc('totus_begin_document_removal',args);
 if(begun?.id!==document.id||!['pending','already_removed'].includes(begun?.status))throw new Error('No se pudo confirmar la autorización para eliminar este archivo. No se ha tocado su contenido.');
 if(begun.status==='already_removed')return begun;
 try{
  if(args.p_path)await removeFile('business-documents',args.p_path);
  const finished=await rpc('totus_finish_document_removal',args);
  if(finished?.id!==document.id||!['removed','already_removed'].includes(finished?.status))throw new Error('No se pudo confirmar el final de la eliminación. Actualiza su estado antes de reintentar.');
  return finished;
 }catch(error){
  error.documentRemovalPending=true;
  throw error;
 }
}
