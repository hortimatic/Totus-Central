// STAGING ONLY. A server-side, authenticated backup job; never exposes the service key to clients.
// Automated calls require the unique secret held in Supabase Vault.
// Manual calls additionally require an authenticated administrator.
import {createClient} from "npm:@supabase/supabase-js@2.57.0";
import JSZip from "npm:jszip@3.10.1";
const SUPABASE_URL=Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin=createClient(SUPABASE_URL,SERVICE_ROLE,{auth:{persistSession:false,autoRefreshToken:false}});
const cors={"Access-Control-Allow-Origin":"https://hortimatic.github.io","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-totus-backup-job","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json",...cors}});
const TABLES=[
 "ops_business_settings","ops_stores","ops_expense_categories","ops_cash_drawers","ops_invoice_series",
 "ops_suppliers","ops_customers","ops_document_templates","ops_documents","ops_daily_closings","ops_daily_closing_drawers",
 "ops_expenses","ops_expense_lines","ops_sales_invoices","ops_sales_invoice_lines","ops_tax_payments",
 "ops_fiscal_adjustments","ops_income_adjustments","ops_reta_brackets","ops_audit_log",
 "brands","families","providers","products","product_variants","product_provider_prices",
 "product_competitor_prices","price_history","consultations","consultation_history",
 "ops_roles","ops_role_permissions","ops_user_permissions","ops_backup_config"
] as const;
const ORDERS:Record<string,string>={"ops_roles":"code","ops_role_permissions":"role","ops_user_permissions":"email"};
const BUCKETS=["business-documents","business-assets"] as const;
const OMIT_USER:Record<string,string[]>={
 products:["created_by"],consultations:["created_by"],consultation_history:["user_id"],price_history:["user_id"],
 ops_documents:["uploaded_by"],ops_daily_closings:["created_by","closed_by"],ops_expenses:["created_by"],
 ops_sales_invoices:["created_by"],ops_tax_payments:["created_by"],ops_fiscal_adjustments:["created_by"],
 ops_income_adjustments:["created_by"],ops_audit_log:["user_id"]
};
function sanitize(table:string,rows:Record<string,unknown>[]){
 return rows.map(row=>{const item={...row};for(const key of OMIT_USER[table]||[])item[key]=null;return item});
}
async function allRows(table:string){
 const rows:Record<string,unknown>[]=[];
 for(let offset=0;;offset+=1000){
  const {data,error}=await admin.from(table).select("*").order(ORDERS[table]||"id",{ascending:true}).range(offset,offset+999);
  if(error)throw new Error("No se puede exportar "+table+": "+error.message);
  rows.push(...data||[]);
  if((data||[]).length<1000)break;
  if(rows.length>500000)throw new Error("El volumen de "+table+" requiere exportación por lotes avanzada.");
 }
 return rows;
}
async function listFiles(bucket:string,prefix=""):Promise<string[]>{
 let result:string[]=[];
 for(let offset=0;;offset+=1000){
  const {data,error}=await admin.storage.from(bucket).list(prefix,{limit:1000,offset,sortBy:{column:"name",order:"asc"}});
  if(error)throw new Error("No se puede inventariar "+bucket+": "+error.message);
  for(const item of data||[]){
   const full=prefix?prefix+"/"+item.name:item.name;
   if(item.id)result.push(full);else result=result.concat(await listFiles(bucket,full));
  }
  if((data||[]).length<1000)break;
 }
 return result;
}
async function sha(bytes:Uint8Array|string|Blob):Promise<string>{
 const buffer=typeof bytes==="string"?new TextEncoder().encode(bytes):bytes instanceof Blob?new Uint8Array(await bytes.arrayBuffer()):bytes;
 const hash=await crypto.subtle.digest("SHA-256",buffer);
 return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
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
  const zip=new JSZip(),database:Record<string,unknown>={};let totalRows=0,totalFiles=0;
  for(const table of TABLES){const rows=await allRows(table);database[table]=sanitize(table,rows);totalRows+=rows.length;}
  const storage:Record<string,string[]>={},hashes:Record<string,Record<string,string>>={};
  for(const bucket of BUCKETS){
   const paths=await listFiles(bucket);storage[bucket]=paths;hashes[bucket]={};
   for(const file of paths){
    const {data,error}=await admin.storage.from(bucket).download(file);
    if(error||!data)throw new Error("Error de lectura de "+bucket+"/"+file+": "+(error?.message||"No disponible"));
    zip.file("storage/"+bucket+"/"+file,data);
    hashes[bucket][file]=await sha(data);
    totalFiles++;
   }
  }
  const databaseJson=JSON.stringify(database);
  const manifest={format:"totus-clean-backup",version:2,created_at:new Date().toISOString(),tables:[...TABLES],storage,integrity:{database:await sha(databaseJson),storage:hashes}};
  zip.file("manifest.json",JSON.stringify(manifest,null,2));
  zip.file("database.json",databaseJson);
  const archive=await zip.generateAsync({type:"uint8array",compression:"DEFLATE",compressionOptions:{level:6}});
  // Standard private Storage uploads have a hard cap; do not claim success for incomplete backups.
  if(archive.byteLength>49*1024*1024)throw new Error("La copia supera 49 MB; se necesita carga segmentada antes de activar copias de mayor tamaño.");
  const folder=String(config.destination_folder||"automaticas");
  const pathname=folder+"/Totus_Central_"+new Date().toISOString().replace(/[:.]/g,"-")+"_"+backupId.slice(0,8)+".totusbackup";
  const {error:upErr}=await admin.storage.from("business-backups").upload(pathname,new Blob([archive],{type:"application/octet-stream"}),{contentType:"application/octet-stream",upsert:false});
  if(upErr)throw new Error("No se guardó la copia: "+upErr.message);
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