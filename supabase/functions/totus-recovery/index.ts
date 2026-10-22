import {createCloudBackupReader} from '../../../src/cloud-backup-reader.js';
import {SET_FORMAT,SET_INDEX_BYTES} from '../../../src/backup-set.js';
import {createHash} from 'node:crypto';
import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {NativeBackupZip as JSZip} from '../totus-backup-run/native-zip.js';
import {readBackupObject,writeBackupObject,validateBackupIndex} from '../../../src/backup-transport.js';
import {readRecoveryArchive,MAX_ARCHIVE_BYTES} from '../../../src/recovery-core.js';
import {runApplicationRecovery} from '../../../src/recovery-runner.js';

const url=Deno.env.get('SUPABASE_URL')||'';
const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',{auth:{persistSession:false,autoRefreshToken:false}});
const projectRef=new URL(url).hostname.split('.')[0];
const cors={'Access-Control-Allow-Origin':'https://hortimatic.github.io','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function checked<T>(response:{data:T;error:unknown},label:string):T{
 if(response.error)throw new Error(label+': '+String((response.error as {message?:string})?.message||response.error));
 return response.data;
}
const backupReaders=new WeakMap<Request,ReturnType<typeof createCloudBackupReader>>();
function readerFor(req:Request){
 let reader=backupReaders.get(req);if(reader)return reader;
 reader=createCloudBackupReader({
  lookup:async(root:string)=>checked(await admin.from('ops_backup_runs').select('id,storage_provider').eq('status','success').eq('storage_path',root).maybeSingle(),'No se pudo localizar la copia completa'),
  prepare:async(runId:string)=>{
   const response=await fetch(url+'/functions/v1/totus-onedrive',{method:'POST',headers:{'Content-Type':'application/json',Authorization:req.headers.get('Authorization')||''},body:JSON.stringify({action:'backup-file-urls',run_id:runId}),signal:AbortSignal.timeout(30000)});
   if(!response.ok)throw new Error('No se pudo preparar la lectura privada de la copia.');
   return response.json();
  },
  readLocal:async(path:string)=>{const result=await admin.storage.from('business-backups').download(path);return result.error?null:result.data;}
 });backupReaders.set(req,reader);return reader;
}
const download=async(bucket:string,path:string,req?:Request)=>{
 if(bucket==='business-documents'&&req){
  const linkResponse=await fetch(url+'/functions/v1/totus-onedrive',{method:'POST',headers:{'Content-Type':'application/json',Authorization:req.headers.get('Authorization')||''},body:JSON.stringify({action:'document-file-url',path}),signal:AbortSignal.timeout(30000)});
  const link=await linkResponse.json();
  if(!linkResponse.ok)throw new Error('No se pudo preparar un original para el punto de recuperación.');
  if(link.provider==='onedrive'){
   if(typeof link.url!=='string'||new URL(link.url).protocol!=='https:')throw new Error('Ubicación de recuperación no válida.');
   const response=await fetch(link.url,{signal:AbortSignal.timeout(60000)});
   if(!response.ok)throw new Error('No se pudo leer un original de OneDrive para la recuperación.');
   return await response.blob();
  }
  if(link.provider!=='supabase')throw new Error('Ubicación de recuperación desconocida.');
 }
 if(bucket==='business-backups'&&req)return readerFor(req)(path);
 const data=checked(await admin.storage.from(bucket).download(path),'No se pudo leer el archivo');
 if(!data)throw new Error('El archivo no está disponible');
 return data;
};
const contentType=(path:string)=>({pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',txt:'text/plain',csv:'text/csv',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}[path.split('.').pop()?.toLowerCase()||'']||'application/octet-stream');

async function verifyCheckpointObject(path:string,proof:any,req:Request){
 const root=await download('business-backups',path,req),bytes=new Uint8Array(await root.arrayBuffer());
 if(bytes[0]!==123){
  if(bytes.length!==Number(proof.size_bytes)||createHash('sha256').update(bytes).digest('hex')!==proof.archive_sha256)throw new Error('El respaldo actual está dañado.');
  return;
 }
 if(bytes.length<=SET_INDEX_BYTES&&JSON.parse(new TextDecoder().decode(bytes)).format===SET_FORMAT){
  const handle=await readBackupObject(path,(part:string)=>download('business-backups',part,req),JSZip.archiveHash,proof.archive_sha256);
  const archive=await readRecoveryArchive(handle,JSZip,{projectRef});
  if(handle.byteLength!==Number(proof.size_bytes)||archive.manifest.revision!==proof.archive_manifest?.revision)throw new Error('El juego no coincide con la copia actual verificada.');
  return;
 }
 if(bytes.length>16384)throw new Error('Índice de respaldo no válido.');
 const index=validateBackupIndex(path,JSON.parse(new TextDecoder().decode(bytes)));
 if(index.sha256!==proof.archive_sha256||index.size!==Number(proof.size_bytes))throw new Error('El respaldo actual no coincide con la prueba verificada.');
 const whole=createHash('sha256');
 for(const part of index.parts){
  const file=await download('business-backups',part.path,req),piece=new Uint8Array(await file.arrayBuffer());
  if(piece.length!==part.size||createHash('sha256').update(piece).digest('hex')!==part.sha256)throw new Error('Falta un fragmento correcto del respaldo actual.');
  whole.update(piece);
 }
 if(whole.digest('hex')!==proof.archive_sha256)throw new Error('El respaldo completo está dañado.');
}

async function inspectSavedCopy(backupId:string,req:Request){
 if(!uuid.test(backupId))throw new Error('Selecciona una copia guardada válida.');
 const proof=checked(await admin.from('ops_backup_runs').select('id,status,storage_path,archive_sha256').eq('id',backupId).eq('status','success').maybeSingle(),'No se pudo consultar la copia guardada');
 if(!proof?.storage_path||!proof.archive_sha256)throw new Error('La copia elegida ya no está disponible.');
 const current=checked(await admin.rpc('totus_export_recovery_snapshot'),'No se pudo contrastar el destino');
 const handle=await readBackupObject(proof.storage_path,(path:string)=>download('business-backups',path,req),JSZip.archiveHash,proof.archive_sha256);
 const archive=await readRecoveryArchive(handle,JSZip,{projectRef,instance:current.database_instance,schemaHash:current.schema_hash});
 if(archive.manifest.version!==3)throw new Error('Esta copia antigua solo permite comprobar sus archivos.');
 return {proof,archive};
}

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return reply({error:'Método no permitido'},405);
 let jobId='';
 try{
  const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
  if(!token)return reply({error:'Sesión requerida'},401);
  const auth=await admin.auth.getUser(token);
  const user=auth.data?.user;
  if(auth.error||!user?.email)return reply({error:'Sesión no válida'},401);
  const member=checked(await admin.from('team_members').select('role,active').eq('email',user.email.toLowerCase()).maybeSingle(),'No se pudieron comprobar los permisos');
  if(!member?.active||member.role!=='admin')return reply({error:'Solo administración puede recuperar una copia'},403);
  const body=await req.json();jobId=String(body.job_id||'').toLowerCase();
  if(!uuid.test(jobId))return reply({error:'Solicitud no válida'},400);
  if(body.action==='review-saved'){
   const {archive}=await inspectSavedCopy(String(body.backup_id||''),req);
   return reply({verified:true,manifest:archive.manifest,rows:Object.values(archive.database).reduce((sum:number,rows:any)=>sum+rows.length,0),files:Object.values(archive.manifest.storage).reduce((sum:number,paths:any)=>sum+paths.length,0)});
  }
  const getJob=async()=>checked(await admin.from('ops_recovery_jobs').select('*').eq('id',jobId).maybeSingle(),'No se pudo consultar la recuperación');
  const existing=await getJob();
  if(existing){
   if(existing.requested_by!==user.id)return reply({error:'La solicitud pertenece a otra cuenta'},403);
   if(existing.status==='committed')return reply({job_id:jobId,result:existing.result,replayed:true});
   if(body.action!=='register'&&!['uploaded','prepared'].includes(existing.status))return reply({error:'Esta solicitud ya está en curso o ha terminado. Consulta su estado.',job_id:jobId},409);
  }
  const prefix='restauraciones/solicitudes/'+user.id;
  const uploadedPath=prefix+'/'+jobId+'.totusbackup';
  const sourcePath=existing?.source_path||uploadedPath;
  if(body.action==='register-saved'){
   if(existing)throw new Error('La solicitud ya existe. Consulta su estado antes de repetirla.');
   const {proof}=await inspectSavedCopy(String(body.backup_id||''),req);
   checked(await admin.from('ops_recovery_jobs').insert({id:jobId,requested_by:user.id,requested_email:user.email.toLowerCase(),source_path:proof.storage_path}),'No se pudo registrar la copia elegida');
   return reply({job_id:jobId,status:'uploaded',source_path:proof.storage_path});
  }
  if(body.action==='register'){
   if(!existing)checked(await admin.from('ops_recovery_jobs').insert({id:jobId,requested_by:user.id,requested_email:user.email.toLowerCase(),source_path:sourcePath}),'No se pudo registrar la solicitud');
   return reply({job_id:jobId,status:existing?.status||'uploaded',source_path:sourcePath});
  }
  let sourceHash:string|null=null;
  if(sourcePath===uploadedPath){
   const objects=checked(await admin.storage.from('business-backups').list(prefix,{limit:100,search:jobId+'.totusbackup'}),'No se pudo comprobar el tamaño de la copia');
   const sourceInfo=objects?.find(x=>x.name===jobId+'.totusbackup');
   if(!sourceInfo||!Number.isFinite(Number(sourceInfo.metadata?.size))||Number(sourceInfo.metadata.size)>MAX_ARCHIVE_BYTES)return reply({error:'La copia no está disponible o supera el límite de carga'},400);
  }else{
   const saved=checked(await admin.from('ops_backup_runs').select('id,archive_sha256').eq('status','success').eq('storage_path',sourcePath).maybeSingle(),'No se pudo comprobar la copia elegida');
   if(!saved?.archive_sha256)throw new Error('La copia elegida ya no está disponible.');sourceHash=saved.archive_sha256;
  }
  const snapshot=checked(await admin.rpc('totus_export_recovery_snapshot'),'No se pudo preparar la copia actual');
  snapshot.project_ref=projectRef;
  const archive=await readRecoveryArchive(await readBackupObject(sourcePath,(path:string)=>download('business-backups',path,req),JSZip.archiveHash,sourceHash),JSZip,{projectRef,instance:snapshot.database_instance,schemaHash:snapshot.schema_hash});
  if(!existing)checked(await admin.from('ops_recovery_jobs').insert({id:jobId,requested_by:user.id,requested_email:user.email.toLowerCase(),source_path:sourcePath}),'No se pudo registrar la solicitud');
  const write=async(bucket:string,path:string,bytes:Uint8Array,type:string)=>{
   checked(await admin.storage.from(bucket).upload(path,bytes,{contentType:type,upsert:false}),'No se pudo guardar el archivo');
  };
  const result=await runApplicationRecovery({archive,snapshot,jobId,JSZip,adapter:{
   getJob,
   claimJob:async()=>!!checked(await admin.from('ops_recovery_jobs').update({status:'preparing'}).eq('id',jobId).eq('status','uploaded').select('id'),'No se pudo iniciar la recuperación')?.length,
   getVerifiedCheckpoint:async(currentSnapshot:any,expectedPath?:string)=>{
    let q=admin.from('ops_backup_runs').select('storage_path,size_bytes,archive_sha256,archive_manifest').eq('status','success').eq('snapshot_revision',currentSnapshot.revision);
    if(expectedPath)q=q.eq('storage_path',expectedPath);
    const proof=checked(await q.order('started_at',{ascending:false}).limit(1).maybeSingle(),'No se pudo consultar el respaldo actual');
    if(!proof){
     const size=currentSnapshot.database.ops_documents.reduce((n:number,d:any)=>n+Number(d.size_bytes||0),0);
     if(size>32*1024*1024)throw new Error('Crea una copia completa actual antes de recuperar los datos.');
     return null;
    }
    const path=proof.storage_path,manifest=proof.archive_manifest;
    if(!manifest||manifest.revision!==currentSnapshot.revision||manifest.project_ref!==projectRef||manifest.schema_hash!==currentSnapshot.schema_hash)throw new Error('El respaldo actual no tiene una prueba compatible.');
    await verifyCheckpointObject(path,proof,req);
    return {path,manifest};
   },
   readFile:(bucket:string,path:string)=>download(bucket,path,req),
   writeCheckpoint:(path:string,bytes:Uint8Array)=>writeBackupObject(path,bytes,(part:string,value:Uint8Array)=>write('business-backups',part,value,'application/octet-stream'),(part:string)=>download('business-backups',part)),
   readCheckpoint:(path:string)=>readBackupObject(path,(part:string)=>download('business-backups',part,req),JSZip.archiveHash),
   setCheckpoint:async(path:string,revision:string)=>{checked(await admin.from('ops_recovery_jobs').update({checkpoint_path:path,before_revision:revision}).eq('id',jobId).eq('status','preparing').select('id').single(),'No se pudo guardar el punto de vuelta atrás');},
   writeFile:async(file:{bucket:string;path:string;target:string},bytes:Uint8Array)=>{
    const doc=file.bucket==='business-documents'?archive.database.ops_documents.find((d:{storage_path:string})=>d.storage_path===file.path):null;
    const mime=doc?.mime_type&&/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(doc.mime_type)?doc.mime_type:contentType(file.path);
    await write(file.bucket,file.target,bytes,mime);
   },
   markPrepared:async()=>{checked(await admin.from('ops_recovery_jobs').update({status:'prepared'}).eq('id',jobId).eq('status','preparing').select('id').single(),'No se pudo terminar la preparación');},
   commit:async(database:unknown,metadata:unknown)=>checked(await admin.rpc('totus_commit_recovery',{p_job:jobId,p_payload:database,p_metadata:metadata}),'La recuperación no se ha confirmado'),
   failJob:async(message:string)=>{checked(await admin.from('ops_recovery_jobs').update({status:'failed',error:message.slice(0,1500),finished_at:new Date().toISOString()}).eq('id',jobId).in('status',['preparing','prepared']),'No se pudo actualizar el estado');}
  }});
  return reply({job_id:jobId,...result});
 }catch(e){return reply({error:String(e instanceof Error?e.message:e),job_id:jobId||undefined},500);}
});
