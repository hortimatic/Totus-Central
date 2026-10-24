// Called only after the recovery endpoint has verified an active administrator.
export function createRecoveryDocumentReader({admin,oneDriveRequest,fetchFile=fetch}){
 return async function readDocument(path){
  if(typeof path!=='string'||path.length>1024||path.split('/').some(p=>!p||p==='.'||p==='..')||/[\\\x00-\x1f]/.test(path))throw new Error('Ruta de recuperación no válida.');
  if(path.startsWith('recovery/')){
   // Newly prepared files do not have an ops_documents/chat row until commit.
   const result=await admin.storage.from('business-documents').download(path);
   if(result.error||!result.data)throw new Error('No se pudo verificar un archivo preparado.');
   return result.data;
  }
  const result=await oneDriveRequest({action:'backup-document-urls',paths:[path]});
  const file=result.files?.find(f=>f.path===path);
  if(!file||typeof file.url!=='string'||new URL(file.url).protocol!=='https:')throw new Error('No se pudo localizar un original del punto de recuperación.');
  const response=await fetchFile(file.url,{signal:AbortSignal.timeout(60000),redirect:'error'});
  if(!response.ok)throw new Error('No se pudo leer un original del punto de recuperación.');
  const blob=await response.blob();
  if(file.size_bytes!=null&&blob.size!==Number(file.size_bytes))throw new Error('El original del punto de recuperación tiene otro tamaño.');
  return blob;
 };
}
