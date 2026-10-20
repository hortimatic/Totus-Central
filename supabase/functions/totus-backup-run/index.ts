// STAGING ONLY. A server-side, authenticated backup job; never exposes the service key to clients.
// Automated calls require the unique secret held in Supabase Vault.
// Manual calls additionally require an authenticated administrator.
import {createHash} from 'node:crypto';
import {createClient} from "npm:@supabase/supabase-js@2.118.0";
import {NativeBackupZip,SegmentedBackupZip} from "./native-zip.js";
import {buildRecoveryArchive,readRecoveryArchive} from "../../../src/recovery-core.js";
import {writeBackupObject,readBackupObject} from '../../../src/backup-transport.js';
import {MAX_SAVED_BACKUPS,oldestBackupCandidates,backupObjectPaths} from "../../../src/backup-retention.js";
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
 });
 const archive=await readRecoveryArchive(bytes,NativeBackupZip,{projectRef:new URL(SUPABASE_URL).hostname.split('.')[0]});
 const {data:rehearsal,error:rehearsalError}=await admin.rpc('totus_verify_recovery_rows',{p_payload:archive.database});
 if(rehearsalError||rehearsal?.verified!==true)throw new Error('No se pudo comprobar la recuperación de datos: '+(rehearsalError?.message||'resultado incompleto'));
 return {verified:true,source:usedOneDrive?'onedrive':'supabase',rehearsal,scope:archive.manifest.scope,tables:Object.fromEntries(Object.entries(archive.database).map(([table,rows])=>[table,(rows as any[]).length])),files:Object.fromEntries(Object.entries(archive.manifest.storage).map(([bucket,paths])=>[bucket,(paths as any[]).length])),identities:archive.manifest.identities.length,revision:archive.manifest.revision};
}
async function deleteSavedBackup(id:string){
 if(!/^[a-f0-9-]{36}$/i.test(id))throw new Error('Identificador de copia inválido.');
 const {data:runs,error}=await admin.from('ops_backup_runs').select('id,status,started_at,storage_path').in('status',['success','running']);
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
 if(!paths.includes(path))throw new Error('No se encontró el archivo principal. No se ha eliminado la copia.');
 const {error:removeError}=await admin.storage.from('business-backups').remove(paths);
 if(removeError)throw removeError;
 const {error:updateError}=await admin.from('ops_backup_runs').update({status:'expired',storage_path:null,error_message:'Eliminada manualmente por un administrador.'}).eq('id',id).eq('status','success');
 if(updateError)throw updateError;
 return {deleted:id,removed_objects:paths.length};
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
 const runs:any[]=[];
 for(let offset=0;;offset+=1000){
  const {data,error}=await admin.from('ops_backup_runs').select('id,status,started_at,storage_path').eq('status','success').order('started_at',{ascending:false}).range(offset,offset+999);
  if(error)throw error;
  runs.push(...data||[]);if((data||[]).length<1000)break;
 }
 const {data:jobs,error:jobsError}=await admin.from('ops_recovery_jobs').select('checkpoint_path');
 if(jobsError)throw jobsError;
 const candidates=oldestBackupCandidates(runs,(jobs||[]).map(j=>j.checkpoint_path));
 const removed:string[]=[],warnings:string[]=[];
 for(const previous of candidates){
  const path=previous.storage_path,slash=path.lastIndexOf('/'),folder=path.slice(0,slash),name=path.slice(slash+1);
  const {data:objects,error}=await admin.storage.from('business-backups').list(folder,{search:name,limit:100});
  if(error||!objects||objects.length>=100){warnings.push(previous.id+': inventario no verificado');continue;}
  const paths=backupObjectPaths(path,objects);
  if(!paths.includes(path)){warnings.push(previous.id+': archivo principal ausente');continue;}
  const {error:removeError}=await admin.storage.from('business-backups').remove(paths);
  if(removeError){warnings.push(previous.id+': no se pudo liberar el archivo');continue;}
  const {error:updateError}=await admin.from('ops_backup_runs').update({status:'expired',storage_path:null}).eq('id',previous.id).eq('status','success');
  if(updateError)throw updateError;
  removed.push(previous.id);
 }
 return {maximum:MAX_SAVED_BACKUPS,removed,remaining:runs.length-removed.length,warnings};
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
  const {data:previous,error:previousError}=await admin.from('ops_backup_runs') .select('id,storage_path,size_bytes,archive_sha256').eq('status','success').order('started_at',{ascending:false}).limit(1).maybeSingle();
  if(previousError)throw previousError;
  let cached:any=null;
  if(previous?.storage_path&&previous.archive_sha256&&Number(previous.size_bytes)<=96*1024*1024){
   await progress('Leyendo copia anterior verificada');
   const prior=await readBackupObject(previous.storage_path,(path:string)=>backupRead(path,previous.id,req));
   if(createHash('sha256').update(prior).digest('hex')!==previous.archive_sha256)throw new Error('La copia anterior no coincide con su huella registrada.');
   // Only reuse originals, never its database. The complete archive hash is
   // authenticated by the server record; the builder checks each original again.
   cached={zip:await NativeBackupZip.loadAsync(prior)};
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
  await progress("Leyendo documentos y preparando archivo");let filesRead=0;
  const {bytes:archive,manifest}=await buildRecoveryArchive(snapshot,SegmentedBackupZip,async(bucket:string,path:string)=>{
   const prior=cached?.zip.file('storage/'+bucket+'/'+path);
   if(prior){const bytes=await prior.async('uint8array');delete cached.zip.files['storage/'+bucket+'/'+path];return bytes;}
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
  const folder=String(config.destination_folder||"automaticas");
  const pathname=folder+"/Totus_Central_"+new Date().toISOString().replace(/[:.]/g,"-")+"_"+backupId.slice(0,8)+".totusbackup";
  await writeBackupObject(pathname,archive,async(path:string,bytes:Uint8Array)=>{
   const {error}=await admin.storage.from('business-backups').upload(path,new Blob([bytes],{type:'application/octet-stream'}),{contentType:'application/octet-stream',upsert:false});
   if(error)throw new Error('No se guardó la copia: '+error.message);
  },async(path:string)=>{
   const {data,error}=await admin.storage.from('business-backups').download(path);
   if(error||!data)throw new Error('No se pudo verificar la copia.');return data;
  });
  const {error:updateErr}=await admin.from("ops_backup_runs").update({status:"success",error_message:null,finished_at:new Date().toISOString(),storage_path:pathname,size_bytes:archive.byteLength,rows_count:totalRows,files_count:totalFiles,snapshot_revision:snapshot.revision,archive_sha256:archive.sha256,archive_manifest:manifest}).eq("id",backupId);
  if(updateErr)throw updateErr;
  // Only rotate after the new archive has been uploaded and verified.
  const retention=await pruneBackups().catch(e=>({warning:String(e.message||e)}));
  const cleanup=await cleanupUnusedFiles().catch(e=>({warning:String(e.message||e)}));
  return {id:backupId,status:"success",retention,cleanup,size_bytes:archive.byteLength,rows_count:totalRows,files_count:totalFiles,storage_path:pathname};
 }catch(e){
  await admin.from("ops_backup_runs").update({status:"failed",finished_at:new Date().toISOString(),error_message:String(e instanceof Error?e.message:e).slice(0,1000)}).eq("id",backupId);
  throw e;
 }
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
  for(const map of rows){
   try{
    if(!map.verified_at||protectedFiles[map.source_path]!==map.sha256){skipped++;continue;}
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
    if(dryRun)continue;
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
   }catch(error){errors.push(error instanceof Error?error.message:'No se pudo comprobar un documento.');}
  }
  const count=await admin.from('ops_onedrive_documents').select('document_id',{count:'exact',head:true}).is('retired_from_supabase_at',null);
  if(count.error)throw count.error;remaining=Number(count.count)||0;
  if(dryRun||!full||!changed||errors.length||Date.now()>deadline)break;
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

async function mirrorAfterBackup(req:Request){
 try{
  const {data,error}=await admin.from('ops_onedrive_config').select('connected,tested_at').eq('id',1).maybeSingle();
  if(error||!data?.connected||!data.tested_at)return {enabled:false};
  const forward:Record<string,string>={'Content-Type':'application/json'};
  for(const name of ['Authorization','x-totus-backup-job']){const value=req.headers.get(name);if(value)forward[name]=value;}
  const response=await fetch(SUPABASE_URL+'/functions/v1/totus-onedrive',{method:'POST',headers:forward,body:JSON.stringify({action:'mirror-backups',full:true}),signal:AbortSignal.timeout(115000)});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(result.error||'No se pudo copiar la seguridad en OneDrive.');
  return {enabled:true,...result};
 }catch(error){return {enabled:true,warning:String(error instanceof Error?error.message:error)};}
}

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return reply({error:"Method not allowed"},405);
 try{
  const body=await req.json().catch(()=>({}));
  const mode=String(body?.mode||"");
  if(!(await canStart(req,mode)))return reply({error:"Acceso denegado."},403);
  if(body?.action==='cleanup')return reply(await cleanupUnusedFiles());
  if(body?.action==='retire-documents')return reply(await retireVerifiedDocuments(req,body.full===true,body.dry_run===true));
  if(body?.action==='verify'||body?.action==='verify-onedrive')return reply(await verifySavedBackup(String(body?.id||''),body.action==='verify-onedrive'?'onedrive':'supabase',req));
  if(body?.action==='delete'){
   if(mode!=='manual')return reply({error:'La eliminación requiere un administrador identificado.'},403);
   return reply(await deleteSavedBackup(String(body?.id||'')));
  }
  if(body?.action==='prune')return reply(await pruneBackups());
  const result=await run(mode,req);
  const onedrive=await mirrorAfterBackup(req);
  return reply({...result,onedrive});
 }catch(e){return reply({error:String(e instanceof Error?e.message:e)},500);}
});
