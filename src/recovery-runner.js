import {buildRecoveryArchive,readRecoveryArchive,prepareRecoveryPlan,archiveHash} from './recovery-core.js';

// The adapter owns authenticated IO. Uploaded files are immutable; old files remain
// available for the checkpoint and sessions that were open before recovery.
export async function runApplicationRecovery({archive,snapshot,jobId,JSZip,adapter}){
 const current=await adapter.getJob();
 if(current?.status==='committed')return {result:current.result,replayed:true};
 const resuming=current?.status==='prepared';
 if(!resuming&&!await adapter.claimJob())throw new Error('La recuperación ya está en curso o ha terminado. Consulta su estado.');
 try{
  if(resuming){
   if(snapshot.revision!==current.before_revision)throw new Error('Los datos han cambiado desde la preparación. Selecciona de nuevo la copia para conservar antes el estado actual.');
   const checkpoint=await readRecoveryArchive(await adapter.readCheckpoint(current.checkpoint_path),JSZip,
    {projectRef:snapshot.project_ref,instance:snapshot.database_instance,schemaHash:snapshot.schema_hash});
   if(checkpoint.manifest.revision!==current.before_revision)throw new Error('El punto de recuperación no coincide con la revisión preparada.');
   const plan=await prepareRecoveryPlan(archive,jobId);
   for(const file of plan.files)if(await archiveHash(await adapter.readFile(file.bucket,file.target))!==file.hash)
    throw new Error('Un archivo preparado ya no coincide con la copia.');
   return {result:await adapter.commit(plan.database,archive.manifest),checkpoint:current.checkpoint_path,replayed:false};
  }
  const checkpoint=await buildRecoveryArchive(snapshot,JSZip,adapter.readFile);
  const checkpointPath='restauraciones/puntos-vuelta/'+jobId+'.totusbackup';
  await adapter.writeCheckpoint(checkpointPath,checkpoint.bytes);
  if(await archiveHash(await adapter.readCheckpoint(checkpointPath))!==await archiveHash(checkpoint.bytes))
   throw new Error('No se ha podido verificar el punto de recuperación. Los datos actuales se conservan.');
  await adapter.setCheckpoint(checkpointPath,snapshot.revision);
  const plan=await prepareRecoveryPlan(archive,jobId);
  for(const file of plan.files){
   const bytes=await archive.zip.file('storage/'+file.bucket+'/'+file.path).async('uint8array');
   await adapter.writeFile(file,bytes);
   if(await archiveHash(await adapter.readFile(file.bucket,file.target))!==file.hash)
    throw new Error('No se ha podido verificar un archivo preparado. Los datos actuales se conservan.');
  }
  await adapter.markPrepared();
  const result=await adapter.commit(plan.database,archive.manifest);
  return {result,checkpoint:checkpointPath,replayed:false};
 }catch(error){
  // An HTTP failure can occur after PostgreSQL committed. A conditional failure
  // update waits on that job's row lock and cannot overwrite a committed status.
  let status;
  try{
   status=await adapter.getJob();
   if(status?.status==='committed')return {result:status.result,replayed:true};
   await adapter.failJob(String(error?.message||error));
   status=await adapter.getJob();
   if(status?.status==='committed')return {result:status.result,replayed:true};
  }catch{/* Keep prepared files when commit status is unknown. Never delete live data. */}
  throw error;
 }
}
