// STAGING ONLY. A server-side, authenticated backup job; never exposes the service key to clients.
// Automated calls require the unique secret held in Supabase Vault.
// Manual calls additionally require an authenticated administrator.
import {createClient} from "npm:@supabase/supabase-js@2.118.0";
import {NativeBackupZip} from "./native-zip.js";
import {buildRecoveryArchive,archiveHash} from "../../../src/recovery-core.js";
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
  const {bytes:archive}=await buildRecoveryArchive(snapshot,NativeBackupZip,async(bucket:string,path:string)=>{
   const {data,error}=await admin.storage.from(bucket).download(path);
   if(error||!data)throw new Error("No se pudo leer un archivo vinculado: "+(error?.message||path));
   return data;
  });
  const totalRows=Object.values(snapshot.database).reduce((count:number,rows:unknown)=>count+(rows as unknown[]).length,0);
  const totalFiles=Object.values(snapshot.storage).reduce((count:number,paths:unknown)=>count+(paths as unknown[]).length,0);
  const folder=String(config.destination_folder||"automaticas");
  const pathname=folder+"/Totus_Central_"+new Date().toISOString().replace(/[:.]/g,"-")+"_"+backupId.slice(0,8)+".totusbackup";
  const {error:upErr}=await admin.storage.from("business-backups").upload(pathname,new Blob([archive],{type:"application/octet-stream"}),{contentType:"application/octet-stream",upsert:false});
  if(upErr)throw new Error("No se guardó la copia: "+upErr.message);
  await admin.from("ops_backup_runs").update({storage_path:pathname,size_bytes:archive.byteLength}).eq("id",backupId);
  const {data:remote,error:verifyError}=await admin.storage.from("business-backups").download(pathname);
  if(verifyError||!remote||await archiveHash(remote)!==await archiveHash(archive))throw new Error("No se pudo verificar la copia subida; se conserva la última copia correcta.");
  const {error:updateErr}=await admin.from("ops_backup_runs").update({status:"success",finished_at:new Date().toISOString(),storage_path:pathname,size_bytes:archive.byteLength,rows_count:totalRows,files_count:totalFiles}).eq("id",backupId);
  if(updateErr)throw updateErr;
  // Retain the newly verified snapshot; delete old ones only after successful upload.
  const limit=new Date(Date.now()-Number(config.retention_days||10)*86400000).toISOString();
  const {data:expired,error:expiredErr}=await admin.from("ops_backup_runs").select("id,storage_path").eq("status","success").lt("started_at",limit).neq("id",backupId).limit(100);
  if(!expiredErr){
   for(const previous of expired||[]){
    if(!previous.storage_path)continue;
    const {error:rmError}=await admin.storage.from("business-backups").remove([previous.storage_path]);
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
