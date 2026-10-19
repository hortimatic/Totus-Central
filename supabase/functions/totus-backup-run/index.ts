// STAGING ONLY. A server-side, authenticated backup job; never exposes the service key to clients.
// Automated calls require the unique secret held in Supabase Vault.
// Manual calls additionally require an authenticated administrator.
import {createClient} from "npm:@supabase/supabase-js@2.118.0";
import {NativeBackupZip,SegmentedBackupZip} from "./native-zip.js";
import {buildRecoveryArchive,readRecoveryArchive} from "../../../src/recovery-core.js";
import {writeBackupObject,readBackupObject} from '../../../src/backup-transport.js';
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
  // Retain the newly verified snapshot; delete old ones only after successful upload.
  const limit=new Date(Date.now()-Number(config.retention_days||10)*86400000).toISOString();
  const {data:expired,error:expiredErr}=await admin.from("ops_backup_runs").select("id,storage_path").eq("status","success").lt("started_at",limit).neq("id",backupId).limit(100);
  const {data:jobs,error:jobsError}=await admin.from("ops_recovery_jobs").select("checkpoint_path");
  const protectedPaths=new Set((jobs||[]).map(j=>j.checkpoint_path));
  if(!expiredErr&&!jobsError){
   for(const previous of expired||[]){
    if(!previous.storage_path||protectedPaths.has(previous.storage_path))continue;
    const slash=previous.storage_path.lastIndexOf('/'),folder=previous.storage_path.slice(0,slash),name=previous.storage_path.slice(slash+1);
    const {data:objects,error:listError}=await admin.storage.from("business-backups").list(folder,{search:name,limit:100});
    if(listError||!objects||objects.length>=100)continue;
    const paths=objects.filter(o=>o.name===name||o.name.startsWith(name+'.part-')&&/^\d{4}$/.test(o.name.slice((name+'.part-').length))).map(o=>folder+'/'+o.name);
    if(!paths.includes(previous.storage_path))continue;
    const {error:rmError}=await admin.storage.from("business-backups").remove(paths);
    if(!rmError)await admin.from("ops_backup_runs").update({status:"expired",storage_path:null}).eq("id",previous.id);
   }
  }
  return {id:backupId,status:"success",size_bytes:archive.byteLength,rows_count:totalRows,files_count:totalFiles,storage_path:pathname};
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
  return reply(await run(mode));
 }catch(e){return reply({error:String(e instanceof Error?e.message:e)},500);}
});
