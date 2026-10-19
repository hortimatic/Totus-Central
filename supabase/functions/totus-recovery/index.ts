import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {NativeBackupZip as JSZip} from '../totus-backup-run/native-zip.js';
import {readBackupObject,writeBackupObject,validateBackupIndex,BACKUP_PART_BYTES} from '../../../src/backup-transport.js';
import {readRecoveryArchive,MAX_ARCHIVE_BYTES,archiveHash} from '../../../src/recovery-core.js';
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
const download=async(bucket:string,path:string)=>{
 const data=checked(await admin.storage.from(bucket).download(path),'No se pudo leer el archivo');
 if(!data)throw new Error('El archivo no está disponible');
 return data;
};
const contentType=(path:string)=>({pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',txt:'text/plain',csv:'text/csv',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}[path.split('.').pop()?.toLowerCase()||'']||'application/octet-stream');

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
  const getJob=async()=>checked(await admin.from('ops_recovery_jobs').select('*').eq('id',jobId).maybeSingle(),'No se pudo consultar la recuperación');
  const existing=await getJob();
  if(existing){
   if(existing.requested_by!==user.id)return reply({error:'La solicitud pertenece a otra cuenta'},403);
   if(existing.status==='committed')return reply({job_id:jobId,result:existing.result,replayed:true});
   if(body.action!=='register'&&!['uploaded','prepared'].includes(existing.status))return reply({error:'Esta solicitud ya está en curso o ha terminado. Consulta su estado.',job_id:jobId},409);
  }
  const prefix='restauraciones/solicitudes/'+user.id;
  const sourcePath=prefix+'/'+jobId+'.totusbackup';
  if(body.action==='register'){
   if(!existing)checked(await admin.from('ops_recovery_jobs').insert({id:jobId,requested_by:user.id,requested_email:user.email.toLowerCase(),source_path:sourcePath}),'No se pudo registrar la solicitud');
   return reply({job_id:jobId,status:existing?.status||'uploaded',source_path:sourcePath});
  }
  const objects=checked(await admin.storage.from('business-backups').list(prefix,{limit:100,search:jobId+'.totusbackup'}),'No se pudo comprobar el tamaño de la copia');
  const sourceInfo=objects?.find(x=>x.name===jobId+'.totusbackup');
  if(!sourceInfo||!Number.isFinite(Number(sourceInfo.metadata?.size))||Number(sourceInfo.metadata.size)>MAX_ARCHIVE_BYTES)
   return reply({error:'La copia no está disponible o supera 96 MB'},400);
  const snapshot=checked(await admin.rpc('totus_export_recovery_snapshot'),'No se pudo preparar la copia actual');
  snapshot.project_ref=projectRef;
  const archive=await readRecoveryArchive(await readBackupObject(sourcePath,(path:string)=>download('business-backups',path)),JSZip,{projectRef,instance:snapshot.database_instance,schemaHash:snapshot.schema_hash});
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
    const slash=path.lastIndexOf('/'),folder=path.slice(0,slash),name=path.slice(slash+1);
    const objects=checked(await admin.storage.from('business-backups').list(folder,{search:name,limit:100}),'No se pudo comprobar el respaldo actual');
    const root=objects?.find(x=>x.name===name);
    if(!root)throw new Error('Falta el respaldo previo a la recuperación.');
    if(Number(proof.size_bytes)>BACKUP_PART_BYTES){
     if(Number(root.metadata?.size)>16384)throw new Error('Índice de respaldo no válido.');
     const index=validateBackupIndex(path,JSON.parse(await (await download('business-backups',path)).text()));
     if(index.sha256!==proof.archive_sha256||index.size!==Number(proof.size_bytes))throw new Error('El respaldo actual no coincide con la prueba verificada.');
     for(const part of index.parts){const item=objects.find(x=>folder+'/'+x.name===part.path);if(!item||Number(item.metadata?.size)!==part.size)throw new Error('Falta un fragmento del respaldo actual.');}
    }else if(await archiveHash(await download('business-backups',path))!==proof.archive_sha256)throw new Error('El respaldo actual está dañado.');
    return {path,manifest};
   },
   readFile:download,
   writeCheckpoint:(path:string,bytes:Uint8Array)=>writeBackupObject(path,bytes,(part:string,value:Uint8Array)=>write('business-backups',part,value,'application/octet-stream'),(part:string)=>download('business-backups',part)),
   readCheckpoint:(path:string)=>readBackupObject(path,(part:string)=>download('business-backups',part)),
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
