// STAGING ONLY. A server-side, authenticated backup job; never exposes the service key to clients.
// Automated calls require the unique secret held in Supabase Vault.
// Manual calls additionally require an authenticated administrator.
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
async function verifySavedBackup(id:string){
 const {data:run,error}=await admin.from('ops_backup_runs').select('storage_path,status,archive_sha256').eq('id',id).single();
 if(error||!run?.storage_path||run.status!=='success')throw new Error('Copia no disponible.');
 const bytes=await readBackupObject(run.storage_path,async(path:string)=>{
  const {data,error}=await admin.storage.from('business-backups').download(path);
  if(error||!data)throw new Error('No se pudo leer un archivo de la copia.');return data;
 });
 const archive=await readRecoveryArchive(bytes,NativeBackupZip,{projectRef:new URL(SUPABASE_URL).hostname.split('.')[0]});
 return {verified:true,scope:archive.manifest.scope,tables:Object.fromEntries(Object.entries(archive.database).map(([table,rows])=>[table,(rows as any[]).length])),files:Object.fromEntries(Object.entries(archive.manifest.storage).map(([bucket,paths])=>[bucket,(paths as any[]).length])),identities:archive.manifest.identities.length,revision:archive.manifest.revision};
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
async function run(mode:string){
 const {data:id,error:claimError}=await admin.rpc("totus_backup_claim",{p_mode:mode});
 if(claimError)throw claimError;
 if(!id)return {skipped:true,reason:"No corresponde a este horario o ya existe una copia para este periodo."};
 const backupId=String(id);
 try{
  const {data:config,error:configError}=await admin.from("ops_backup_config").select("*").eq("id",1).single();
  if(configError)throw configError;
  const {data:snapshot,error:snapshotError}=await admin.rpc("totus_export_recovery_snapshot");
  if(snapshotError)throw snapshotError;
  snapshot.project_ref=new URL(SUPABASE_URL).hostname.split(".")[0];
  // Reuse verified immutable originals from the previous full backup. The new
  // archive is still complete; only newly attached files need individual reads.
  const {data:previous,error:previousError}=await admin.from('ops_backup_runs').select('storage_path').eq('status','success').order('started_at',{ascending:false}).limit(1).maybeSingle();
  if(previousError)throw previousError;
  let cached:any=null;
  if(previous?.storage_path){
   const prior=await readBackupObject(previous.storage_path,async(path:string)=>{
    const {data,error}=await admin.storage.from('business-backups').download(path);
    if(error||!data)throw new Error('No se pudo leer la copia anterior verificada.');return data;
   });
   cached=await readRecoveryArchive(prior,NativeBackupZip,{projectRef:snapshot.project_ref});
  }
  const downloadUrls=new Map<string,string>();
  for(const [bucket,paths] of Object.entries(snapshot.storage)){
   const missing=(paths as string[]).filter(path=>!cached?.zip.file('storage/'+bucket+'/'+path));
   if(!missing.length)continue;
   const {data:links,error:linkError}=await admin.storage.from(bucket).createSignedUrls(missing,180);
   if(linkError||!links)throw new Error('No se pudo preparar la lectura privada del archivo.');
   for(const link of links){
    if(link.error||!link.path||!link.signedUrl)throw new Error('No se pudo autorizar un archivo de la copia.');
    downloadUrls.set(bucket+'/'+link.path,link.signedUrl);
   }
  }
  const {bytes:archive,manifest}=await buildRecoveryArchive(snapshot,SegmentedBackupZip,async(bucket:string,path:string)=>{
   const prior=cached?.zip.file('storage/'+bucket+'/'+path);
   if(prior){const bytes=await prior.async('uint8array');delete cached.zip.files['storage/'+bucket+'/'+path];return bytes;}
   for(let attempt=0;attempt<3;attempt++){
    const link=downloadUrls.get(bucket+'/'+path);
    if(!link)throw new Error('Archivo fuera del inventario de la copia.');
    const response=await fetch(link);
    if(response.ok)return await response.blob();
    await response.body?.cancel();
    if(attempt===2)throw new Error('No se pudo leer un archivo vinculado: HTTP '+response.status);
    await new Promise(resolve=>setTimeout(resolve,250*(attempt+1)));
   }
   throw new Error('No se pudo completar la lectura.');
  });
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
  const {error:updateErr}=await admin.from("ops_backup_runs").update({status:"success",finished_at:new Date().toISOString(),storage_path:pathname,size_bytes:archive.byteLength,rows_count:totalRows,files_count:totalFiles,snapshot_revision:snapshot.revision,archive_sha256:archive.sha256,archive_manifest:manifest}).eq("id",backupId);
  if(updateErr)throw updateErr;
  // Only rotate after the new archive has been uploaded and verified.
  const retention=await pruneBackups().catch(e=>({warning:String(e.message||e)}));
  return {id:backupId,status:"success",retention,size_bytes:archive.byteLength,rows_count:totalRows,files_count:totalFiles,storage_path:pathname};
 }catch(e){
  await admin.from("ops_backup_runs").update({status:"failed",finished_at:new Date().toISOString(),error_message:String(e instanceof Error?e.message:e).slice(0,1000)}).eq("id",backupId);
  throw e;
 }
}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return reply({error:"Method not allowed"},405);
 try{
  const body=await req.json().catch(()=>({}));
  const mode=String(body?.mode||"");
  if(!(await canStart(req,mode)))return reply({error:"Acceso denegado."},403);
  if(body?.action==='verify')return reply(await verifySavedBackup(String(body?.id||'')));
  if(body?.action==='delete'){
   if(mode!=='manual')return reply({error:'La eliminación requiere un administrador identificado.'},403);
   return reply(await deleteSavedBackup(String(body?.id||'')));
  }
  return reply(body?.action==="prune"?await pruneBackups():await run(mode));
 }catch(e){return reply({error:String(e instanceof Error?e.message:e)},500);}
});
