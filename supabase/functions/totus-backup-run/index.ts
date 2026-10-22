import {createPartitionedBackup} from './partitioned-job.js';
// Server-side authenticated backup job; never exposes the service key to clients.
// Automated calls require the unique secret held in Supabase Vault.
// Manual calls additionally require an authenticated administrator.
import {createHash} from 'node:crypto';
import {createClient} from "npm:@supabase/supabase-js@2.118.0";
import {NativeBackupZip,cloudBackupZip} from "./native-zip.js";
import {buildRecoveryArchive,readRecoveryArchive,RECOVERY_TABLES,archiveHash} from "../../../src/recovery-core.js";
import {readBackupObject,validateBackupIndex} from '../../../src/backup-transport.js';
import {backupRetentionCount,oldestBackupCandidates,obsoleteBackupCandidates,backupObjectPaths} from "../../../src/backup-retention.js";
const SUPABASE_URL=Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin=createClient(SUPABASE_URL,SERVICE_ROLE,{auth:{persistSession:false,autoRefreshToken:false}});
const cors={"Access-Control-Allow-Origin":"https://hortimatic.github.io","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-totus-backup-job","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json",...cors}});
async function canStart(req:Request,mode:string){
 if(mode==="scheduled"){
  const token=req.headers.get("x-totus-backup-job")||"";
  if(!token)return false;
  const {data,error}=await admin.rpc("totus_backup_cron_authorized",{p_key:token});
  return !error&&data===true;
 }
 if(mode!=="manual")return false;
 const jwt=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
 if(!jwt)return false;
 const {data:{user},error}=await admin.auth.getUser(jwt);
 if(error||!user?.email)return false;
 const {data:staff,error:teamError}=await admin.from("team_members").select("role,active").ilike("email",user.email).maybeSingle();
 return !teamError&&staff?.role==="admin"&&staff?.active===true;
}
async function verifySavedBackup(id:string,source='supabase',req?:Request){
 let usedOneDrive=source==='onedrive';
 const {data:run,error}=await admin.from('ops_backup_runs').select('storage_path,status,archive_sha256').eq('id',id).single();
 if(error||!run?.storage_path||run.status!=='success')throw new Error('Copia no disponible.');
 const bytes=await readBackupObject(run.storage_path,async(path:string)=>{
  if(source==='onedrive'){
   if(!req)throw new Error('Falta autorización para leer OneDrive.');
   const headers:Record<string,string>={'Content-Type':'application/json'};
   for(const name of ['Authorization','x-totus-backup-job']){const value=req.headers.get(name);if(value)headers[name]=value;}
   const linkResponse=await fetch(SUPABASE_URL+'/functions/v1/totus-onedrive',{method:'POST',headers,body:JSON.stringify({action:'backup-file-url',run_id:id,path}),signal:AbortSignal.timeout(30000)});
   const link=await linkResponse.json();
   if(!linkResponse.ok||typeof link.url!=='string'||new URL(link.url).protocol!=='https:')throw new Error('No se pudo leer la copia de OneDrive.');
   const download=await fetch(link.url,{signal:AbortSignal.timeout(60000)});
   if(!download.ok)throw new Error('No se pudo descargar un archivo de OneDrive.');
   return await download.blob();
  }
  const {data,error}=await admin.storage.from('business-backups').download(path);
  if(error||!data){if(!req)throw new Error('No se pudo leer un archivo de la copia.');usedOneDrive=true;return oneDriveRead(req,'backup-file-url',{run_id:id,path});}return data;
 },NativeBackupZip.archiveHash,run.archive_sha256);
 if(!run.archive_sha256)throw new Error('La copia no tiene una huella registrada.');
 const archive=await readRecoveryArchive(bytes,NativeBackupZip,{projectRef:new URL(SUPABASE_URL).hostname.split('.')[0]});
 const {data:rehearsal,error:rehearsalError}=await admin.rpc('totus_verify_recovery_rows',{p_payload:archive.database});
 if(rehearsalError||rehearsal?.verified!==true)throw new Error('No se pudo comprobar la recuperación de datos: '+(rehearsalError?.message||'resultado incompleto'));
 return {verified:true,source:usedOneDrive?'onedrive':'supabase',rehearsal,scope:archive.manifest.scope,tables:Object.fromEntries(Object.entries(archive.database).map(([table,rows])=>[table,(rows as any[]).length])),files:Object.fromEntries(Object.entries(archive.manifest.storage).map(([bucket,paths])=>[bucket,(paths as any[]).length])),identities:archive.manifest.identities.length,revision:archive.manifest.revision};
}
async function verifiedCloudLocation(run:any){
 if(run.storage_provider!=='onedrive'||!/^[a-f0-9]{64}$/.test(run.archive_sha256||''))return false;
 const saved=await admin.from('ops_onedrive_backups').select('verified_at,archive_sha256').eq('run_id',run.id).maybeSingle();
 if(saved.error)throw saved.error;
 return !!saved.data?.verified_at&&saved.data.archive_sha256===run.archive_sha256;
}
async function deleteSavedBackup(id:string,req:Request){
 if(!/^[a-f0-9-]{36}$/i.test(id))throw new Error('Identificador de copia inválido.');
 const {data:runs,error}=await admin.from('ops_backup_runs').select('id,status,started_at,storage_path,storage_provider,archive_sha256').in('status',['success','running']);
 if(error)throw error;
 const saved=(runs||[]).filter(r=>r.status==='success'&&r.storage_path),target=saved.find(r=>r.id===id);
 if(!target)throw new Error('La copia ya no está disponible. Actualiza el listado.');
 if(saved.length<=1)throw new Error('No puedes eliminar la única copia guardada. Crea otra primero.');
 if((runs||[]).some(r=>r.status==='running'&&Date.now()-Date.parse(r.started_at)<15*60*1000))throw new Error('Espera a que termine la copia en preparación.');
 const {data:jobs,error:jobError}=await admin.from('ops_recovery_jobs').select('checkpoint_path,source_path');
 if(jobError)throw jobError;
 if((jobs||[]).some(j=>j.checkpoint_path===target.storage_path||j.source_path===target.storage_path))throw new Error('Esta copia está vinculada a una recuperación y debe conservarse.');
 const path=target.storage_path,slash=path.lastIndexOf('/'),folder=path.slice(0,slash),name=path.slice(slash+1);
 const {data:objects,error:listError}=await admin.storage.from('business-backups').list(folder,{search:name,limit:100});
 if(listError||!objects||objects.length>=100)throw new Error('No se pudo verificar el inventario de la copia.');
 const paths=backupObjectPaths(path,objects);
 if(!paths.includes(path)&&!await verifiedCloudLocation(target))throw new Error('No se encontró una copia completa verificada. No se ha eliminado.');
 const {error:removeError}=paths.length?await admin.storage.from('business-backups').remove(paths):{error:null};
 if(removeError)throw removeError;
 const {error:updateError}=await admin.from('ops_backup_runs').update({status:'expired',storage_path:null,error_message:'Eliminada manualmente por un administrador.'}).eq('id',id).eq('status','success');
 if(updateError)throw updateError;
 let cloud_warning:string|undefined;
 try{
  const headers:Record<string,string>={'Content-Type':'application/json'};
  for(const name of ['Authorization','x-totus-backup-job']){const value=req.headers.get(name);if(value)headers[name]=value;}
  const response=await fetch(SUPABASE_URL+'/functions/v1/totus-onedrive',{method:'POST',headers,body:JSON.stringify({action:'prune-backups'}),signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error('provider');
 }catch{cloud_warning='La referencia se retiró, pero falta comprobar la limpieza en OneDrive. Actualiza la copia en Almacenamiento para reintentar.';}
 return {deleted:id,removed_objects:paths.length,cloud_warning};
}
async function cleanupUnusedFiles(){
 const {data:running,error:runningError}=await admin.from('ops_backup_runs').select('id').eq('status','running').gte('started_at',new Date(Date.now()-15*60*1000).toISOString());
 if(runningError||running?.length)throw new Error('Espera a que termine la copia en preparación.');
 const {data:runs,error:runsError}=await admin.from('ops_backup_runs').select('storage_path,status');
 const {data:jobs,error:jobsError}=await admin.from('ops_recovery_jobs').select('source_path,checkpoint_path,status');
 const {data:snapshot,error:snapshotError}=await admin.rpc('totus_export_recovery_snapshot');
 if(runsError||jobsError||snapshotError||!snapshot?.storage)throw new Error('No se pudo verificar el inventario actual.');
 const linked=new Set([...(runs||[]).filter(r=>r.status==='success'&&r.storage_path).map(r=>r.storage_path),...(jobs||[]).flatMap(j=>[j.source_path,j.checkpoint_path]).filter(Boolean)]);
 const removals:{bucket:string,path:string,bytes:number}[]=[];
 async function inspect(bucket:string,folder:string,used:Set<string>,backup:boolean){
  for(let offset=0;;offset+=100){
   const {data:objects,error}=await admin.storage.from(bucket).list(folder,{limit:100,offset,sortBy:{column:'name',order:'asc'}});
   if(error||!objects)throw new Error('No se pudo revisar el almacenamiento.');
   for(const object of objects){
    if(!object.id||!object.metadata)continue;
    const path=folder+'/'+object.name;
    const base=backup?path.replace(/\.part-\d{4}$/,''):path;
    if(used.has(base)||used.has(path))continue;
    const created=Date.parse(object.created_at||object.updated_at);
    if(!Number.isFinite(created)||Date.now()-created<15*60*1000)continue;
    if(backup&&!/\.totusbackup(?:\.part-\d{4})?$/.test(path))continue;
    removals.push({bucket,path,bytes:Number(object.metadata.size)||0});
   }
   if(objects.length<100)break;
  }
 }
 await inspect('business-backups','automaticas',linked,true);
 await inspect('business-assets','logos',new Set(snapshot.storage['business-assets']||[]),false);
 let bytes=0;
 for(const file of removals){
  const {error}=await admin.storage.from(file.bucket).remove([file.path]);
  if(error)throw new Error('No se pudo retirar un archivo sin uso.');
  bytes+=file.bytes;
 }
 return {removed:removals.length,freed_bytes:bytes};
}

async function pruneBackups(){
 const settings=await admin.from('ops_backup_config').select('retention_days').eq('id',1).single();
 if(settings.error||!settings.data)throw new Error('No se pudo comprobar el número de copias guardadas.');
 const keep=backupRetentionCount(settings.data.retention_days);
 const runs:any[]=[];
 for(let offset=0;;offset+=1000){
  const {data,error}=await admin.from('ops_backup_runs').select('id,status,started_at,storage_path,archive_manifest,archive_sha256,storage_provider').eq('status','success').order('started_at',{ascending:false}).range(offset,offset+999);
  if(error)throw error;
  runs.push(...data||[]);if((data||[]).length<1000)break;
 }
 const {data:jobs,error:jobsError}=await admin.from('ops_recovery_jobs').select('checkpoint_path,source_path');
 if(jobsError)throw jobsError;
 const protectedPaths=(jobs||[]).flatMap(j=>[j.checkpoint_path,j.source_path]).filter(Boolean);
 const candidates=[...new Map([...oldestBackupCandidates(runs,protectedPaths,keep),...obsoleteBackupCandidates(runs,protectedPaths)].map(r=>[r.id,r])).values()];
 const removed:string[]=[],warnings:string[]=[];
 for(const previous of candidates){
  const path=previous.storage_path,slash=path.lastIndexOf('/'),folder=path.slice(0,slash),name=path.slice(slash+1);
  const {data:objects,error}=await admin.storage.from('business-backups').list(folder,{search:name,limit:100});
  if(error||!objects||objects.length>=100){warnings.push(previous.id+': inventario no verificado');continue;}
  const paths=backupObjectPaths(path,objects);
  if(!paths.includes(path)&&!await verifiedCloudLocation(previous)){warnings.push(previous.id+': archivo principal ausente');continue;}
  const {error:removeError}=paths.length?await admin.storage.from('business-backups').remove(paths):{error:null};
  if(removeError){warnings.push(previous.id+': no se pudo liberar el archivo');continue;}
  const {error:updateError}=await admin.from('ops_backup_runs').update({status:'expired',storage_path:null}).eq('id',previous.id).eq('status','success');
  if(updateError)throw updateError;
  removed.push(previous.id);
 }
 return {maximum:keep,removed,remaining:runs.length-removed.length,warnings};
}

async function oneDriveAction(req:Request,action:string,body:Record<string,unknown>){
 const headers:Record<string,string>={'Content-Type':'application/json'};
 for(const name of ['Authorization','x-totus-backup-job']){const value=req.headers.get(name);if(value)headers[name]=value;}
 const response=await fetch(SUPABASE_URL+'/functions/v1/totus-onedrive',{method:'POST',headers,body:JSON.stringify({action,...body}),signal:AbortSignal.timeout(60000)});
 const result=await response.json();
 if(!response.ok||result?.error)throw new Error(result?.error||'OneDrive no pudo completar la operación.');
 return result;
}
async function oneDriveRead(req:Request,action:string,body:Record<string,string>){
 const headers:Record<string,string>={'Content-Type':'application/json'};
 for(const name of ['Authorization','x-totus-backup-job']){const value=req.headers.get(name);if(value)headers[name]=value;}
 const response=await fetch(SUPABASE_URL+'/functions/v1/totus-onedrive',{method:'POST',headers,body:JSON.stringify({action,...body}),signal:AbortSignal.timeout(30000)});
 const link=await response.json();
 if(!response.ok||typeof link.url!=='string'||new URL(link.url).protocol!=='https:')throw new Error('No se pudo localizar un archivo privado en OneDrive.');
 const download=await fetch(link.url,{signal:AbortSignal.timeout(60000)});
 if(!download.ok)throw new Error('No se pudo leer un archivo privado de OneDrive.');
 return await download.blob();
}
async function backupRead(path:string,runId:string,req:Request){
 const {data,error}=await admin.storage.from('business-backups').download(path);
 if(!error&&data)return data;
 return oneDriveRead(req,'backup-file-url',{run_id:runId,path});
}

async function run(mode:string,req:Request){
 const {data:id,error:claimError}=await admin.rpc("totus_backup_claim",{p_mode:mode});
 if(claimError)throw claimError;
 if(!id)return {skipped:true,reason:"No corresponde a este horario o ya existe una copia para este periodo."};
 const backupId=String(id);
 const progress=async(stage:string)=>{console.info(JSON.stringify({backup_stage:stage}));const {error}=await admin.from("ops_backup_runs").update({error_message:stage}).eq("id",backupId).eq("status","running");if(error)throw error;};
 try{
  const {data:config,error:configError}=await admin.from("ops_backup_config").select("*").eq("id",1).single();
  if(configError)throw configError;
  const {data:snapshot,error:snapshotError}=await admin.rpc("totus_export_recovery_snapshot");
  if(snapshotError)throw snapshotError;
  await progress("Preparando inventario de documentos");
  snapshot.project_ref=new URL(SUPABASE_URL).hostname.split(".")[0];
  // Reuse verified immutable originals from the previous full backup. The new
  // archive is still complete; only newly attached files need individual reads.
  const {data:previous,error:previousError}=await admin.from('ops_backup_runs') .select('id,storage_path,size_bytes,archive_sha256,storage_provider').eq('status','success').order('started_at',{ascending:false}).limit(1).maybeSingle();
  if(previousError)throw previousError;
  let cached:any=null;
  if(previous?.storage_path&&previous.archive_sha256&&Number(previous.size_bytes)<=120*1024*1024){
   await progress('Leyendo copia anterior verificada');

   const links=previous.storage_provider==='onedrive'?await oneDriveAction(req,'backup-file-urls',{run_id:previous.id}):null;
   const urls=new Map<string,string>((links?.files||[]).map((f:any)=>[f.path,f.url]));
   const prior=await readBackupObject(previous.storage_path,async(path:string)=>{
    if(previous.storage_provider!=='onedrive')return backupRead(path,previous.id,req);
    const url=urls.get(path);if(!url||new URL(url).protocol!=='https:')throw new Error('Falta un archivo de la copia anterior.');
    const response=await fetch(url,{signal:AbortSignal.timeout(60000)});
    if(!response.ok)throw new Error('No se pudo leer la copia anterior de OneDrive.');return response.blob();
   },NativeBackupZip.archiveHash,previous.archive_sha256);

   // Only reuse originals, never its database. The complete archive hash is
   // authenticated by the server record; the builder checks each original again.
   const zip=await NativeBackupZip.loadAsync(prior);
   const manifest=JSON.parse(await zip.file('manifest.json').async('string'));
   if(manifest.version!==3||manifest.project_ref!==snapshot.project_ref)throw new Error('La copia anterior no tiene un inventario compatible.');
   cached={zip,manifest};
  }
  const downloadUrls=new Map<string,string>();
  for(const [bucket,paths] of Object.entries(snapshot.storage)){
   const missing=(paths as string[]).filter(path=>!cached?.zip.file('storage/'+bucket+'/'+path));
   if(!missing.length)continue;
   const {data:links,error:linkError}=await admin.storage.from(bucket).createSignedUrls(missing,180);
   if(linkError||!links)throw new Error('No se pudo preparar la lectura privada del archivo.');
   for(const link of links){
    if(link.error||!link.path||!link.signedUrl)continue; // A migrated original may live only in OneDrive.
    downloadUrls.set(bucket+'/'+link.path,link.signedUrl);
   }
  }
  const folder=String(config.destination_folder||"automaticas");
  const pathname=folder+"/Totus_Central_"+new Date().toISOString().replace(/[:.]/g,"-")+"_"+backupId.slice(0,8)+".totusbackup";
  const {data:driveConfig,error:driveError}=await admin.from('ops_onedrive_config').select('connected,tested_at').eq('id',1).maybeSingle();
  if(driveError)throw driveError;
  const direct=driveConfig?.connected===true&&!!driveConfig.tested_at;
  const sessions=new Map<string,string>();
  if(direct){
   const planned=await admin.from('ops_backup_runs').update({storage_path:pathname}).eq('id',backupId).eq('status','running').select('id');
   if(planned.error||planned.data?.length!==1)throw new Error('No se pudo registrar la copia en preparación.');
   const prepared=await oneDriveAction(req,'prepare-backup-upload',{run_id:backupId});
   if(prepared.source_path!==pathname||!Array.isArray(prepared.sessions))throw new Error('Destino de copia no válido.');
   for(const item of prepared.sessions){if(typeof item.url!=='string'||new URL(item.url).protocol!=='https:')throw new Error('Destino de subida no válido.');sessions.set(item.path,item.url);}
  }
  const trustedHashes=new WeakMap<Uint8Array,string>();
  const CloudBase=cloudBackupZip({path:pathname,write:async(path:string,bytes:Uint8Array)=>{
   if(direct){
    const url=sessions.get(path);if(!url)throw new Error('La copia supera el inventario de subida preparado.');
    const sha256=await NativeBackupZip.archiveHash(bytes);
    // Upload session URLs are bearer capabilities. Never forward our application
    // authorization headers or the server job key to Microsoft.
    try{
     const result=await fetch(url,{method:'PUT',headers:{'Content-Type':'application/octet-stream','Content-Range':'bytes 0-'+(bytes.length-1)+'/'+bytes.length},body:bytes,signal:AbortSignal.timeout(60000)});
     await result.body?.cancel();
    }catch{/* A lost response is accepted only if independent readback proves it. */}
    const proof=await oneDriveAction(req,'verify-backup-file',{run_id:backupId,path,size:bytes.length,sha256});
    if(proof?.verified!==true||proof.path!==path||proof.size!==bytes.length||proof.sha256!==sha256)throw new Error('OneDrive no ha verificado el archivo guardado.');
    // Keep only the tiny segmented index as a locator in Supabase, never ZIP parts.
    if(path===pathname&&bytes[0]===123){
     const saved=await admin.storage.from('business-backups').upload(path,new Blob([bytes]),{contentType:'application/octet-stream',upsert:false});
     if(saved.error)throw new Error('No se pudo guardar el índice de localización.');
    }
    return proof;
   }
   const {error}=await admin.storage.from('business-backups').upload(path,new Blob([bytes],{type:'application/octet-stream'}),{contentType:'application/octet-stream',upsert:false});
   if(error)throw new Error('No se guardó un fragmento de la copia: '+error.message);
  },read:async(path:string)=>{
   if(direct)return oneDriveRead(req,'staged-backup-file-url',{run_id:backupId,path});
   const {data,error}=await admin.storage.from('business-backups').download(path);
   if(error||!data)throw new Error('No se pudo verificar un fragmento de la copia.');return data;
  }});
  class CloudZip extends CloudBase{
   static archiveHash=async(value:any)=>value instanceof Uint8Array&&trustedHashes.has(value)?trustedHashes.get(value)!:archiveHash(value);
  }
  await progress("Leyendo documentos y preparando archivo");let filesRead=0;
  const {bytes:archive,manifest}=await buildRecoveryArchive(snapshot,CloudZip,async(bucket:string,path:string)=>{
   const prior=cached?.zip.file('storage/'+bucket+'/'+path);
   if(prior){const bytes=await prior.async('uint8array');const digest=cached.manifest.integrity?.storage?.[bucket]?.[path];if(/^[a-f0-9]{64}$/.test(digest||''))trustedHashes.set(bytes,digest);delete cached.zip.files['storage/'+bucket+'/'+path];return bytes;}
   for(let attempt=0;attempt<5;attempt++){
    const link=downloadUrls.get(bucket+'/'+path);
    if(!link){
     if(bucket==='business-documents')return oneDriveRead(req,'document-file-url',{path});
     throw new Error('Archivo fuera del inventario de la copia.');
    }
    const response=await fetch(link);
    if(response.ok){const value=await response.blob();filesRead++;if(filesRead%100===0)await progress("Documentos leídos: "+filesRead);return value;}
    await response.body?.cancel();
    if(attempt===4||![429,500,502,503,504].includes(response.status))throw new Error('No se pudo leer un archivo vinculado: HTTP '+response.status);
    const retry=Number(response.headers.get('Retry-After'));
    const delay=Number.isFinite(retry)&&retry>0?Math.min(10000,retry*1000):Math.min(8000,1000*2**attempt);
    await new Promise(resolve=>setTimeout(resolve,delay));
   }
   throw new Error('No se pudo completar la lectura.');
  });
  await progress("Archivo preparado; comprobando y guardando");
  cached=null;downloadUrls.clear();
  const totalRows=Object.values(snapshot.database).reduce((count:number,rows:unknown)=>count+(rows as unknown[]).length,0);
  const totalFiles=Object.values(snapshot.storage).reduce((count:number,paths:unknown)=>count+(paths as unknown[]).length,0);

  const {error:updateErr}=await admin.from("ops_backup_runs").update({status:"success",error_message:null,finished_at:new Date().toISOString(),storage_path:pathname,size_bytes:archive.byteLength,rows_count:totalRows,files_count:totalFiles,snapshot_revision:snapshot.revision,archive_sha256:archive.sha256,archive_manifest:manifest,storage_provider:direct?'onedrive':'supabase',supabase_parts_retired_at:direct?new Date().toISOString():null}).eq("id",backupId);
  if(updateErr)throw updateErr;
  // Only rotate after the new archive has been uploaded and verified.
  const retention=await pruneBackups().catch(e=>({warning:String(e.message||e)}));
  const cleanup=await cleanupUnusedFiles().catch(e=>({warning:String(e.message||e)}));
  return {id:backupId,status:"success",retention,cleanup,size_bytes:archive.byteLength,rows_count:totalRows,files_count:totalFiles,storage_path:pathname};
 }catch(e){
  await admin.from("ops_backup_runs").update({status:"failed",finished_at:new Date().toISOString(),error_message:String(e instanceof Error?e.message:typeof e==='object'&&e&&'message' in e?e.message:e).slice(0,1000)}).eq("id",backupId);
  throw e;
 }
}




async function partitionedRun(mode:string,req:Request){
 const active=await admin.from('ops_backup_work').select('run_id,state,updated_at,lease_until').order('updated_at').limit(1).maybeSingle();
 if(active.error)throw active.error;
 let job=active.data;
 if(job){
  const record=await admin.from('ops_backup_runs').select('status,size_bytes').eq('id',job.run_id).single();if(record.error)throw record.error;
  if(record.data.status!=='running'){
   if(job.lease_until&&Date.parse(job.lease_until)>Date.now())return {pending:true,id:job.run_id};
   const removed=await admin.from('ops_backup_work').delete().eq('run_id',job.run_id);if(removed.error)throw removed.error;
   if(record.data.status==='success'){
    const retention=await pruneBackups().catch(error=>({warning:String(error.message||error)}));await oneDriveAction(req,'prune-backups',{}).catch(()=>null);
    return {id:job.run_id,status:'success',size_bytes:record.data.size_bytes,retention};
   }
   return {skipped:true,reason:'El intento anterior ya ha terminado. Puedes crear una copia nueva.'};
  }
 }
 const drive=await admin.from('ops_onedrive_config').select('connected,tested_at').eq('id',1).maybeSingle();
 if(!drive.data?.connected||!drive.data?.tested_at){
  if(job)throw new Error('La copia por componentes espera a que OneDrive vuelva a estar disponible.');
  return run(mode,req);
 }
 if(!job){
  const claim=await admin.rpc('totus_backup_claim',{p_mode:mode});if(claim.error)throw claim.error;
  if(!claim.data)return {skipped:true,reason:'No corresponde al horario o ya hay una copia en preparación.'};
  const id=String(claim.data);
  try{
   const settings=await admin.from('ops_backup_config').select('destination_folder').eq('id',1).single();if(settings.error)throw settings.error;
   const source=await admin.rpc('totus_export_recovery_snapshot');if(source.error)throw source.error;
   const snapshot=source.data;snapshot.project_ref=new URL(SUPABASE_URL).hostname.split('.')[0];
   const path=String(settings.data.destination_folder||'automaticas')+'/Totus_Central_'+new Date().toISOString().replace(/[:.]/g,'-')+'_'+id.slice(0,8)+'.totusbackup';
   const buildResponse=await fetch('https://hortimatic.github.io/Totus-Central/build-info.json?backup-version='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(20000)});
   if(!buildResponse.ok)throw new Error('No se pudo identificar el código publicado.');
   const build=await buildResponse.json();snapshot.source_revision=String(build.commit||build.sha||'');
   if(!/^[a-f0-9]{40}$/.test(snapshot.source_revision))throw new Error('Versión de código no válida.');
   const engine=createPartitionedBackup({Zip:NativeBackupZip,hash:NativeBackupZip.archiveHash} as any);
   const {snapshot:originalSnapshot,...state}=await engine.start(snapshot,path);
   const planned=await admin.from('ops_backup_runs').update({storage_path:path,archive_manifest:{bundle_version:4},error_message:'Preparando documentos por componentes'}).eq('id',id).eq('status','running');if(planned.error)throw planned.error;
   const created=await admin.from('ops_backup_work').insert({run_id:id,state,snapshot:originalSnapshot}).select('run_id,state').single();if(created.error)throw created.error;job=created.data;
  }catch(error){
   await admin.from('ops_backup_runs').update({status:'failed',finished_at:new Date().toISOString(),error_message:String(error instanceof Error?error.message:error)}).eq('id',id);throw error;
  }
 }
 const at=new Date().toISOString(),lease=new Date(Date.now()+120000).toISOString();
 const claimed=await admin.from('ops_backup_work').update({lease_until:lease}).eq('run_id',job.run_id).or('lease_until.is.null,lease_until.lt.'+at).select('run_id').maybeSingle();
 if(claimed.error)throw claimed.error;if(!claimed.data)return {pending:true,id:job.run_id,reason:'El servidor está preparando un componente.'};
 let completed:any=null;
 try{
  const writeComponent=async(path:string,bytes:Uint8Array,sha256:string)=>{
   // Retrying a stopped batch may find its immutable verified component already saved.
   const proof=await oneDriveAction(req,'verify-backup-file',{run_id:job.run_id,path,size:bytes.length,sha256}).catch(()=>null);
   if(proof?.verified===true)return;
   const prepared=await oneDriveAction(req,'prepare-backup-upload',{run_id:job.run_id,paths:[path]});
   const session=prepared.sessions?.find((s:any)=>s.path===path);if(!session?.url||new URL(session.url).protocol!=='https:')throw new Error('Destino privado de copia no válido.');
   const upload=await fetch(session.url,{method:'PUT',headers:{'Content-Type':'application/octet-stream','Content-Range':'bytes 0-'+(bytes.length-1)+'/'+bytes.length},body:bytes,signal:AbortSignal.timeout(60000)});await upload.body?.cancel();
   const verified=await oneDriveAction(req,'verify-backup-file',{run_id:job.run_id,path,size:bytes.length,sha256});
   if(verified?.verified!==true||verified.sha256!==sha256||verified.size!==bytes.length)throw new Error('No se ha confirmado un componente de la copia.');
  };
  const engine=createPartitionedBackup({Zip:NativeBackupZip,hash:NativeBackupZip.archiveHash,writeComponent,
   readOriginal:async(bucket:string,path:string)=>{
    const local=await admin.storage.from(bucket).download(path);if(!local.error&&local.data)return local.data;
    if(bucket==='business-documents')return oneDriveRead(req,'document-file-url',{path});
    throw new Error('No se ha encontrado un recurso original.');
   },
   readCode:async()=>{
    const revision=job.state.source_revision;
    const response=await fetch('https://codeload.github.com/hortimatic/Totus-Central/zip/'+revision,{signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw new Error('No se pudo incluir el código en la copia.');
    const maximum=32*1024*1024,declared=Number(response.headers.get('Content-Length'));
    if(declared>maximum||!response.body)throw new Error('El código supera el tamaño permitido o no está disponible.');
    const reader=response.body.getReader(),chunks:Uint8Array[]=[];let total=0;
    try{for(;;){const chunk=await reader.read();if(chunk.done)break;total+=chunk.value.length;if(total>maximum){await reader.cancel();throw new Error('El código supera 32 MB.');}chunks.push(chunk.value);}}finally{reader.releaseLock();}
    const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    await NativeBackupZip.loadAsync(bytes);return {bytes,revision};
   }});
  if(job.state.stage==='data'||job.state.stage==='complete'){
   const source=await admin.from('ops_backup_work').select('snapshot').eq('run_id',job.run_id).single();if(source.error)throw source.error;
   job.state.snapshot=source.data.snapshot;
  }
  const result=await engine.advance(structuredClone(job.state));
  if(!result.complete){
   const save=await admin.from('ops_backup_work').update({state:result.job,updated_at:new Date().toISOString(),lease_until:null}).eq('run_id',job.run_id).eq('lease_until',lease);
   if(save.error)throw save.error;
   await admin.from('ops_backup_runs').update({error_message:'Preparando componentes: '+result.job.cursor+' de '+result.job.files.length+' archivos'}).eq('id',job.run_id).eq('status','running');
   return {pending:true,id:job.run_id,files_completed:result.job.cursor,files_total:result.job.files.length};
  }
  const {snapshot}=result.job;
  const indexBytes=new TextEncoder().encode(JSON.stringify(result.index));
  const saved=await admin.storage.from('business-backups').upload(result.job.path,new Blob([indexBytes]),{contentType:'application/json',upsert:true});if(saved.error)throw saved.error;
  const recorded=await admin.from('ops_backup_runs').update({status:'success',error_message:null,finished_at:new Date().toISOString(),
   size_bytes:result.index.size,rows_count:Object.values(snapshot.database).reduce((n:number,rows:any)=>n+rows.length,0),files_count:result.job.files.length,
   snapshot_revision:snapshot.revision,archive_sha256:result.index.sha256,archive_manifest:result.manifest,storage_provider:'onedrive',supabase_parts_retired_at:new Date().toISOString()}).eq('id',job.run_id).eq('status','running');
  if(recorded.error)throw recorded.error;
  completed={id:job.run_id,status:'success',size_bytes:result.index.size,components:result.index.parts.length};
  const removed=await admin.from('ops_backup_work').delete().eq('run_id',job.run_id);if(removed.error)throw removed.error;
  const retention=await pruneBackups();await oneDriveAction(req,'prune-backups',{}).catch(()=>null);
  return {id:job.run_id,status:'success',size_bytes:result.index.size,components:result.index.parts.length,retention};
 }catch(error){
  if(completed){
   await admin.from('ops_backup_work').delete().eq('run_id',job.run_id).eq('lease_until',lease);
   return {...completed,warning:'La copia está verificada; queda pendiente comprobar la limpieza de las copias antiguas.'};
  }
  // Keep resumable state for temporary failures; previous complete copies remain untouched.
  const failures=Number(job.state.failures||0)+1;
  await admin.from('ops_backup_runs').update({error_message:'Pendiente de reintento: '+String(error instanceof Error?error.message:error).slice(0,800)}).eq('id',job.run_id).eq('status','running');
  if(failures>=5){
   const marked=await admin.from('ops_backup_runs').update({status:'failed',finished_at:new Date().toISOString(),error_message:'No se pudo completar la copia después de cinco intentos: '+String(error instanceof Error?error.message:error).slice(0,700)}).eq('id',job.run_id).eq('status','running');
   if(marked.error)throw marked.error;
   const removed=await admin.from('ops_backup_work').delete().eq('run_id',job.run_id).eq('lease_until',lease);if(removed.error)throw removed.error;
  }else{
   const saved=await admin.from('ops_backup_work').update({state:{...Object.fromEntries(Object.entries(job.state).filter(([k])=>k!=='snapshot')),failures},lease_until:null,updated_at:new Date().toISOString()}).eq('run_id',job.run_id).eq('lease_until',lease);
   if(saved.error)throw saved.error;
  }
  throw error;
 }
}

async function capacityProbe(){
 const MB=1024*1024,path='simulaciones/capacidad-'+crypto.randomUUID()+'.totusbackup',payload=new Uint8Array(MB);
 crypto.getRandomValues(payload.subarray(0,65536));for(let i=65536;i<payload.length;i+=65536)payload.set(payload.subarray(0,65536),i);
 const paths=Array.from({length:112},(_,i)=>'simulation/'+i+'.bin'),database=Object.fromEntries(RECOVERY_TABLES.map((table:string)=>[table,[]]));
 database.ops_documents=paths.map((storage_path:string,i:number)=>({id:String(i),storage_path}));
 const snapshot={project_ref:'simulation',database_instance:'11111111-1111-4111-8111-111111111111',schema_hash:'a'.repeat(64),revision:'b'.repeat(64),created_at:new Date().toISOString(),identities:[],database,storage:{'business-documents':paths,'business-assets':[]}};
 let peakBuffer=0;const Base=cloudBackupZip({path,write:async(p:string,b:Uint8Array)=>{
  const result=await admin.storage.from('business-backups').upload(p,new Blob([b]),{contentType:'application/octet-stream',upsert:false});if(result.error)throw result.error;
 },read:async(p:string)=>{const result=await admin.storage.from('business-backups').download(p);if(result.error||!result.data)throw new Error('Falta un fragmento de simulación.');return result.data;}});
 class Zip extends Base{async flush(final=false){peakBuffer=Math.max(peakBuffer,this.pendingBytes);return super.flush(final)}}
 const start=Date.now(),built=await buildRecoveryArchive(snapshot,Zip,async()=>payload);
 return {created:true,simulation_path:path,simulated_originals:112,size_bytes:built.bytes.byteLength,sha256:built.bytes.sha256,maximum_buffer_bytes:peakBuffer,elapsed_ms:Date.now()-start};
}
async function verifyCapacityProbe(path:string){
 if(!/^simulaciones\/capacidad-[a-f0-9-]{36}\.totusbackup$/.test(path))throw new Error('Simulación no válida.');
 const read=async(p:string)=>{const result=await admin.storage.from('business-backups').download(p);if(result.error||!result.data)throw new Error('No se pudo leer la simulación.');return result.data;};
 const start=Date.now(),root=await read(path),index=validateBackupIndex(path,JSON.parse(await root.text()));
 const bytes=await readBackupObject(path,read,NativeBackupZip.archiveHash);
 const restored=await readRecoveryArchive(bytes,NativeBackupZip,{projectRef:'simulation'});
 if(restored.manifest.storage['business-documents'].length!==112)throw new Error('Simulación incompleta.');
 const paths=[...index.parts.map((p:any)=>p.path),path],removed=await admin.storage.from('business-backups').remove(paths);
 if(removed.error)throw new Error('La simulación pasó, pero no se pudo retirar su archivo sintético.');
 return {verified:true,simulated_originals:112,size_bytes:bytes.length,removed_objects:paths.length,elapsed_ms:Date.now()-start};
}
async function retireVerifiedBackupParts(req:Request,id:string){
 if(!/^[a-f0-9-]{36}$/i.test(id))throw new Error('Referencia de copia no válida.');
 const {data:run,error}=await admin.from('ops_backup_runs').select('storage_path,status,size_bytes,archive_sha256,archive_manifest,storage_provider').eq('id',id).single();
 if(error||run?.status!=='success'||run.archive_manifest?.version!==3||!run.storage_path)throw new Error('Solo se retiran fragmentos de una copia completa compatible.');
 const {data:mirror,error:mirrorError}=await admin.from('ops_onedrive_backups').select('verified_at,archive_sha256,archive_size').eq('run_id',id).maybeSingle();
 if(mirrorError||!mirror?.verified_at||mirror.archive_sha256!==run.archive_sha256||Number(mirror.archive_size)!==Number(run.size_bytes))throw new Error('Primero verifica esta copia completa en OneDrive.');
 const path=run.storage_path,slash=path.lastIndexOf('/'),folder=path.slice(0,slash),name=path.slice(slash+1);
 const {data:objects,error:listError}=await admin.storage.from('business-backups').list(folder,{search:name,limit:100});
 if(listError||!objects||objects.length>=100||!objects.some((o:any)=>o.name===name))throw new Error('No se pudo comprobar el índice de la copia.');
 if(Number(run.size_bytes)<=8*1024*1024)return {retired:0,freed_bytes:0,reason:'La copia pequeña se conserva íntegra.'};
 const root=await admin.storage.from('business-backups').download(path);
 if(root.error||!root.data||root.data.size>16384)throw new Error('Índice de copia no disponible.');
 const index=validateBackupIndex(path,JSON.parse(await root.data.text()));
 if(index.sha256!==run.archive_sha256||index.size!==Number(run.size_bytes))throw new Error('El índice no coincide con la copia registrada.');
 const parts=index.parts.filter((part:any)=>objects.some((o:any)=>folder+'/'+o.name===part.path));
 if(!parts.length&&run.storage_provider==='onedrive')return {retired:0,freed_bytes:0};
 // A fresh full read and row-recovery rehearsal must succeed before any removal.
 const verified=await verifySavedBackup(id,'onedrive',req);
 if(!verified.verified||verified.source!=='onedrive')throw new Error('No se ha podido comprobar la recuperación desde OneDrive.');
 const current=await admin.from('ops_backup_runs').select('status,storage_path,archive_sha256').eq('id',id).single();
 if(current.error||current.data?.status!=='success'||current.data.storage_path!==path||current.data.archive_sha256!==run.archive_sha256)throw new Error('La copia cambió durante la comprobación.');
 const paths=parts.map((p:any)=>p.path);
 const removed=paths.length?await admin.storage.from('business-backups').remove(paths):{error:null};
 if(removed.error)throw new Error('No se pudieron retirar los fragmentos duplicados.');
 const remaining=await admin.storage.from('business-backups').list(folder,{search:name,limit:100});
 if(remaining.error||!remaining.data||remaining.data.length>=100||!remaining.data.some((o:any)=>o.name===name)||remaining.data.some((o:any)=>paths.includes(folder+'/'+o.name)))throw new Error('Revisa el inventario antes de repetir la limpieza.');
 const marked=await admin.from('ops_backup_runs').update({storage_provider:'onedrive',supabase_parts_retired_at:new Date().toISOString()}).eq('id',id).eq('status','success').eq('storage_path',path).eq('archive_sha256',run.archive_sha256).select('id');
 if(marked.error||marked.data?.length!==1)throw new Error('No se pudo confirmar la ubicación de la copia.');
 const freed=parts.reduce((n:number,p:any)=>n+p.size,0);
 const audit=await admin.from('ops_audit_log').insert({user_id:null,user_email:'Tarea del servidor',area:'administracion',action:'duplicados_copia_supabase_retirados',detail:{copia:id,fragmentos:paths.length,bytes_liberados:freed,proteccion:'Copia completa verificada en OneDrive; índice conservado en Supabase'}});
 if(audit.error)throw new Error('La limpieza terminó, pero no se pudo registrar el resumen.');
 return {retired:paths.length,freed_bytes:freed,verified:true};
}

async function retireVerifiedDocuments(req:Request,full=false,dryRun=false){
 const {data:copies,error:copiesError}=await admin.from('ops_onedrive_backups').select('run_id').not('verified_at','is',null).order('verified_at',{ascending:false}).limit(1);
 if(copiesError||!copies?.length)throw new Error('Primero debe existir una copia completa comprobada en OneDrive.');
 const {data:backup,error:backupError}=await admin.from('ops_backup_runs').select('status,archive_manifest').eq('id',copies[0].run_id).single();
 if(backupError||backup?.status!=='success'||backup.archive_manifest?.version!==3)throw new Error('La copia de seguridad no está disponible para proteger la limpieza.');
 const protectedFiles=backup.archive_manifest.integrity?.storage?.['business-documents']||{};
 let retired=0,freed=0,checked=0,skipped=0,remaining=0;const errors:string[]=[];const deadline=Date.now()+85000;
 do{
  const {data:rows,error}=await admin.from('ops_onedrive_documents').select('document_id,source_path,size_bytes,sha256,verified_at').is('retired_from_supabase_at',null).order('document_id').limit(5);
  if(error)throw error;
  if(!rows?.length){remaining=0;break;}
  let changed=0;
  const processRow=async(map:any)=>{
   for(let attempt=0;attempt<3;attempt++){
   try{
    if(!map.verified_at||protectedFiles[map.source_path]!==map.sha256){skipped++;return;}
    const {data:doc,error:docError}=await admin.from('ops_documents').select('id,storage_path,size_bytes,sha256').eq('id',map.document_id).maybeSingle();
    if(docError||!doc||doc.storage_path!==map.source_path||Number(doc.size_bytes)!==Number(map.size_bytes)||doc.sha256!==map.sha256)throw new Error('El documento cambió desde su copia. Se conserva el original.');
    const remote=await oneDriveRead(req,'document-file-url',{path:map.source_path});
    if(remote.size!==Number(map.size_bytes)||createHash('sha256').update(new Uint8Array(await remote.arrayBuffer())).digest('hex')!==map.sha256)throw new Error('OneDrive no supera la comprobación de integridad. Se conserva Supabase.');
    const local=await admin.storage.from('business-documents').download(map.source_path);
    let localBytes=0;
    if(local.error){
     if(!/not found|no encontrado/i.test(local.error.message||'')&&Number(local.error.status)!==404)throw new Error('No se pudo comprobar el original de Supabase.');
    }else if(local.data){
     localBytes=local.data.size;
     if(localBytes!==Number(map.size_bytes)||createHash('sha256').update(new Uint8Array(await local.data.arrayBuffer())).digest('hex')!==map.sha256)throw new Error('El original de Supabase no coincide con su copia. No se retira.');
    }else throw new Error('No se pudo comprobar el original de Supabase.');
    const latest=await admin.from('ops_documents').select('storage_path,sha256,size_bytes').eq('id',map.document_id).maybeSingle();
    if(latest.error||!latest.data||latest.data.storage_path!==map.source_path||latest.data.sha256!==map.sha256||Number(latest.data.size_bytes)!==Number(map.size_bytes))throw new Error('El documento cambió durante la revisión. No se retira.');
    checked++;
    if(dryRun)return;
    if(localBytes){
     const removed=await admin.storage.from('business-documents').remove([map.source_path]);
     if(removed.error)throw new Error('Supabase no confirmó la retirada del duplicado.');
     const slash=map.source_path.lastIndexOf('/'),folder=slash<0?'':map.source_path.slice(0,slash),name=map.source_path.slice(slash+1);
     const listing=await admin.storage.from('business-documents').list(folder,{search:name,limit:100});
     if(listing.error||!Array.isArray(listing.data)||listing.data.length>=100||listing.data.some((item:any)=>item.name===name))throw new Error('No se pudo confirmar que el duplicado se retiró de Supabase.');
    }
    const saved=await admin.from('ops_onedrive_documents').update({retired_from_supabase_at:new Date().toISOString()}).eq('document_id',map.document_id).eq('source_path',map.source_path).eq('sha256',map.sha256).is('retired_from_supabase_at',null).select('document_id');
    if(saved.error)throw new Error('No se pudo registrar la retirada; la copia de OneDrive sigue intacta.');
    if(saved.data?.length){retired++;freed+=localBytes;changed++;}
    return;
   }catch(error){
    const message=error instanceof Error?error.message:'No se pudo comprobar un documento.';
    if(attempt<2&&/rate limit|429|too many requests/i.test(message)&&Date.now()<deadline-10000){
     const wait=Number(message.match(/Retry after (\d+)ms/i)?.[1])||3000;
     await new Promise(resolve=>setTimeout(resolve,Math.min(10000,Math.max(1000,wait+250))));continue;
    }
    errors.push(message);return;
   }
   }
  }
  let cursor=0;
  const concurrency=1; // Keep cleanup bounded and below provider request limits.
  const worker=async()=>{while(cursor<rows.length&&!errors.length&&Date.now()<deadline){const row=rows[cursor++];await processRow(row);}};
  await Promise.all(Array.from({length:Math.min(concurrency,rows.length)},worker));
  const count=await admin.from('ops_onedrive_documents').select('document_id',{count:'exact',head:true}).is('retired_from_supabase_at',null);
  if(count.error)throw count.error;remaining=Number(count.count)||0;
  if(dryRun||!full||!changed||errors.length||Date.now()>deadline)break;
  if(remaining)await new Promise(resolve=>setTimeout(resolve,1000));
 }while(remaining>0);
 if(retired){
  let actor:any=null;
  const jwt=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
  if(jwt)actor=(await admin.auth.getUser(jwt)).data.user;
  const logged=await admin.from('ops_audit_log').insert({user_id:actor?.id||null,user_email:actor?.email||'Tarea automática',area:'administracion',action:'duplicados_documentales_supabase_retirados',detail:{documentos:retired,bytes_liberados:freed,proteccion:'Original verificado en OneDrive y copia completa verificada'}});
  if(logged.error)throw new Error('La retirada se completó pero no pudo registrarse su resumen. Revisa el estado antes de repetir.');
 }
 return {dry_run:dryRun,checked,retired,freed_bytes:freed,remaining,skipped,errors};
}


async function retireDocumentsWithLease(req:Request,full=false,dryRun=false){
 const at=new Date().toISOString(),lease=new Date(Date.now()+180000).toISOString();
 const {data:claim,error}=await admin.from('ops_onedrive_config').update({retirement_lock_until:lease}).eq('id',1).or('retirement_lock_until.is.null,retirement_lock_until.lt.'+at).select('id').maybeSingle();
 if(error)throw new Error('No se pudo reservar la revisión de duplicados.');
 if(!claim)throw new Error('Ya hay una limpieza de duplicados en curso. Espera a que termine.');
 try{return await retireVerifiedDocuments(req,full,dryRun);}
 finally{await admin.from('ops_onedrive_config').update({retirement_lock_until:null}).eq('id',1).eq('retirement_lock_until',lease);}
}

async function retireBackupWithLease(req:Request,id:string){
 const at=new Date().toISOString(),lease=new Date(Date.now()+180000).toISOString();
 const {data:claim,error}=await admin.from('ops_onedrive_config').update({retirement_lock_until:lease}).eq('id',1).or('retirement_lock_until.is.null,retirement_lock_until.lt.'+at).select('id').maybeSingle();
 if(error||!claim)throw new Error('Ya hay una limpieza en curso o no se pudo reservar.');
 try{return await retireVerifiedBackupParts(req,id);}
 finally{await admin.from('ops_onedrive_config').update({retirement_lock_until:null}).eq('id',1).eq('retirement_lock_until',lease);}
}

async function mirrorAfterBackup(req:Request,runId?:string){
 if(!runId)return {enabled:false};
 try{
  const {data:config,error:configError}=await admin.from('ops_onedrive_config').select('connected,tested_at').eq('id',1).maybeSingle();
  if(configError||!config?.connected||!config.tested_at)return {enabled:false};
  // The database owns the next request. Creation, mirroring and retirement each
  // get their own execution budget; the existing two-minute tick retries progress.
  const result=await admin.rpc('totus_onedrive_mirror_tick');
  if(result.error)throw result.error;
  return {enabled:true,queued:!!result.data,automatic_retry:true};
 }catch(error){return {enabled:true,warning:String(error instanceof Error?error.message:error)};}
}

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return reply({error:"Method not allowed"},405);
 try{
  const body=await req.json().catch(()=>({}));
  const mode=String(body?.mode||"");
  if(!(await canStart(req,mode)))return reply({error:"Acceso denegado."},403);
  if(body?.action==='capacity-probe')return reply(await capacityProbe());
  if(body?.action==='capacity-probe-verify')return reply(await verifyCapacityProbe(String(body.path||'')));
  if(body?.action==='cleanup')return reply(await cleanupUnusedFiles());
  if(body?.action==='retire-backup-parts')return reply(await retireBackupWithLease(req,String(body.id||'')));
  if(body?.action==='retire-documents')return reply(await retireDocumentsWithLease(req,body.full===true,body.dry_run===true));
  if(body?.action==='verify'||body?.action==='verify-onedrive')return reply(await verifySavedBackup(String(body?.id||''),body.action==='verify-onedrive'?'onedrive':'supabase',req));
  if(body?.action==='delete'){
   if(mode!=='manual')return reply({error:'La eliminación requiere un administrador identificado.'},403);
   return reply(await deleteSavedBackup(String(body?.id||''),req));
  }
  if(body?.action==='prune')return reply(await pruneBackups());
  const result=await partitionedRun(mode,req);
  const onedrive=await mirrorAfterBackup(req,result.id);
  return reply({...result,onedrive});
 }catch(e){return reply({error:String(e instanceof Error?e.message:typeof e==='object'&&e&&'message' in e?e.message:e)},500);}
});
