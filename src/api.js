import {SUPABASE_URL,SUPABASE_KEY} from './config.js';
import {state} from './state.js';
import {setRolePermissions} from './permissions.js';
import {combineAuditEvents,mergeAuditRows} from './audit-register.js';
import {assertService,matchesSavedFields,verifiedWrite} from './write-safety.js';
export const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const assert=assertService;
export async function login(email,password){const r=await sb.auth.signInWithPassword({email,password});assert(r,'Acceso');return r.data.session}
export async function logout(){await sb.auth.signOut()}
export async function recover(email){const r=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});assert(r,'Recuperación')}
// Always sort by a unique key before paginating. This prevents missing
// or duplicated rows when a date/other display sort contains ties.
const TABLE_KEYS={
 ops_roles:['code'],ops_role_permissions:['role','module'],
 ops_user_permissions:['email','module'],team_members:['email']
};
export async function select(table,{order,ascending=false,limit=100000,filter,allowTruncated=false,columns='*'}={}){
 if(!Number.isSafeInteger(limit)||limit<1)throw new Error('Límite de consulta no válido.');
 const keys=TABLE_KEYS[table]||['id'];
 const sorts=[...new Set([...(order?[order]:[]),...keys])];
 const rows=[],pageSize=1000;let from=0;
 while(from<limit){
  let q=sb.from(table).select(columns);
  if(filter)q=filter(q);
  for(let i=0;i<sorts.length;i++)q=q.order(sorts[i],{ascending:i===0&&order?ascending:true});
  const size=Math.min(pageSize,limit-from);
  q=q.range(from,from+size-1);
  if(typeof q.abortSignal==='function')q=q.abortSignal(AbortSignal.timeout(20000));
  const r=await q;assert(r,table);
  const batch=r.data||[];
  if(!Array.isArray(batch))throw new Error(table+': respuesta de datos no válida.');
  rows.push(...batch);
  if(batch.length<size)break;
  from+=size;
 }
 if(rows.length===limit&&!allowTruncated)
  throw new Error(table+': se alcanzó el límite de '+limit+' filas. No se mostrarán datos incompletos.');
 return rows;
}
const UUID_INSERT_TABLES=new Set(['brands','families','providers','consultations','ops_documents','ops_tax_payments','ops_customers','ops_document_templates','ops_invoice_series','ops_suppliers','ops_expense_categories','ops_stores','ops_cash_drawers','ops_fiscal_adjustments','ops_income_adjustments','price_history','product_variants','product_provider_prices','product_competitor_prices']);
async function readWriteRecord(table,id){
 if(id===undefined||id===null)return null;
 const result=await sb.from(table).select().eq('id',id).maybeSingle();assert(result,`Comprobar ${table}`);return result.data;
}
export async function insert(table,row){
 const candidate={...row};if(UUID_INSERT_TABLES.has(table)&&candidate.id==null)candidate.id=crypto.randomUUID();
 return verifiedWrite(async()=>{const r=await sb.from(table).insert(candidate).select().single();assert(r,`Crear ${table}`);return r.data},()=>readWriteRecord(table,candidate.id),saved=>matchesSavedFields(saved,candidate));
}
export async function update(table,id,row){
 return verifiedWrite(async()=>{const r=await sb.from(table).update(row).eq('id',id).select().single();assert(r,`Actualizar ${table}`);return r.data},()=>readWriteRecord(table,id),saved=>matchesSavedFields(saved,row));
}
export async function remove(table,id){
 if(id===undefined||id===null||id==='')throw new Error('Falta el identificador del registro que deseas eliminar.');
 const r=await sb.from(table).delete().eq('id',id).select('id');assert(r,`Eliminar ${table}`);
 if(!Array.isArray(r.data)||r.data.length!==1)throw new Error(`No se eliminó el registro de ${table}. Puede faltar permiso, estar ya borrado o tener referencias protegidas. Actualiza y comprueba su estado.`);
 return r.data[0];
}
export async function rpc(name,args={}){const r=await sb.rpc(name,args);assert(r,name);return r.data}
export async function invokeTeam(payload){const s=(await sb.auth.getSession()).data.session;if(!s)throw new Error('Sesión no válida');const res=await fetch(`${SUPABASE_URL}/functions/v1/team-admin`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${s.access_token}`,apikey:SUPABASE_KEY},body:JSON.stringify(payload)});const body=await res.json().catch(()=>({}));if(!res.ok)throw new Error(body.error||`Error ${res.status}`);return body}
export async function invokeRecovery(jobId,action='process',values={}){
 const session=(await sb.auth.getSession()).data.session;
 if(!session)throw new Error('Sesión no válida');
 const response=await fetch(`${SUPABASE_URL}/functions/v1/totus-recovery`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`,apikey:SUPABASE_KEY},body:JSON.stringify({...values,job_id:jobId,action})});
 const body=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(body.error||'No se pudo completar la recuperación. Consulta su estado antes de reintentar.');
 return body;
}
export async function upload(bucket,path,file){const r=await sb.storage.from(bucket).upload(path,file,{contentType:file.type,upsert:false});assert(r,'Subida');return r.data}
async function documentLocation(path){
 const session=(await sb.auth.getSession()).data.session;
 if(!session)throw new Error('Sesión no válida.');
 const response=await fetch(SUPABASE_URL+'/functions/v1/totus-onedrive',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token,apikey:SUPABASE_KEY},body:JSON.stringify({action:'document-file-url',path}),signal:AbortSignal.timeout(30000)});
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(result.error||'No se pudo localizar el documento.');
 if(result.provider==='supabase')return null;
 if(result.provider!=='onedrive'||typeof result.url!=='string'||new URL(result.url).protocol!=='https:')throw new Error('La ubicación del documento no es válida.');
 return result.url;
}
export async function signedUrl(bucket,path,seconds=120){
 if(bucket==='business-documents'){const remote=await documentLocation(path);if(remote)return remote;}
 const r=await sb.storage.from(bucket).createSignedUrl(path,seconds);
 if(r.error&&(/not found|no encontrado/i.test(r.error.message||'')||Number(r.error.status)===404))throw new Error('Archivo no encontrado. Comprueba su ubicación o restaura el adjunto.');
 assert(r,'Vista previa');return r.data.signedUrl;
}
export async function downloadFile(bucket,path,metadata={}){
 const address=await signedUrl(bucket,path,300);
 const response=await fetch(address,{signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw new Error('No se pudo leer el archivo (HTTP '+response.status+').');
 const blob=await response.blob();
 if(metadata.size_bytes!=null&&Number(metadata.size_bytes)!==blob.size)throw new Error('El tamaño del archivo no coincide con el documento.');
 if(metadata.sha256){
  const actual=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('');
  if(actual!==metadata.sha256)throw new Error('El archivo no coincide con su original. No se ha mostrado otro documento.');
 }
 return blob;
}
export async function removeFile(bucket,path){
 const files=sb.storage.from(bucket),r=await files.remove([path]);assert(r,'Eliminar archivo');
 // HEAD can reuse a cached successful GET after removal. Listing uses POST and
 // checks the current object index instead of the browser's download cache.
 const slash=path.lastIndexOf('/'),folder=slash<0?'':path.slice(0,slash),name=path.slice(slash+1);
 const check=await files.list(folder,{search:name,limit:100,offset:0});
 assert(check,'Comprobar eliminación');
 if(!Array.isArray(check.data)||check.data.length>=100||check.data.some(file=>file.name===name))
  throw new Error('No se ha podido retirar el archivo. Se conserva su ficha para poder revisarlo o reintentar.');
}
// Independent refresh: reports errors without fabricating an empty Supabase bucket.
export async function reloadStorageUsage(){
 try{
  const data=await rpc('totus_storage_usage');
  if(!data||data.status!=='ok'||data.source!=='supabase_storage_objects')throw new Error('Respuesta de Storage no verificable.');
  state.data.storageUsage={...data,status:'ok',fetched_at:new Date().toISOString()};
  return state.data.storageUsage;
 }catch(e){
  state.data.storageUsage={status:'error',message:String(e?.message||e),fetched_at:new Date().toISOString()};
  return state.data.storageUsage;
 }
}
export async function loadCore(){
 const tasks=[
 ['settings','ops_business_settings'],['backupConfig','ops_backup_config'],['backupRuns','ops_backup_runs','started_at'],['recoveryJobs','ops_recovery_jobs','created_at'],['roles','ops_roles','sort_order'],['rolePermissions','ops_role_permissions'],['userPermissions','ops_user_permissions'],['team','team_members'],['profiles','profiles'],['stores','ops_stores'],['drawers','ops_cash_drawers'],['categories','ops_expense_categories'],['suppliers','ops_suppliers'],
 ['closings','ops_daily_closings','business_date'],['closingDrawers','ops_daily_closing_drawers'],['expenses','ops_expenses','expense_date'],['expenseLines','ops_expense_lines'],
 ['customers','ops_customers','name'],['series','ops_invoice_series','year'],['invoices','ops_sales_invoices','issue_date'],['invoiceLines','ops_sales_invoice_lines'],['documents','ops_documents','created_at'],
 ['taxPayments','ops_tax_payments','created_at'],['fiscalAdjustments','ops_fiscal_adjustments','adjustment_date'],['incomeAdjustments','ops_income_adjustments','income_date'],
 ['templates','ops_document_templates','name'],['brands','brands','name'],['families','families','name'],['products','products','updated_at'],['variants','product_variants','created_at'],
 ['providers','providers','name'],['providerPrices','product_provider_prices','created_at'],['competitors','product_competitor_prices','created_at'],['consultations','consultations','updated_at']
 ];
 // A single sign-in must not occupy dozens of database connections while a
 // maintenance lock is pending. Wait for the bounded in-flight reads to finish
 // and publish state only when every required table has loaded successfully.
 const results=new Array(tasks.length);let next=0,failure=null;
 const worker=async()=>{
  while(!failure&&next<tasks.length){
   const index=next++,[,table,order]=tasks[index];
   try{results[index]=await select(table,{order,ascending:false})}
   catch(error){failure||=error}
  }
 };
 await Promise.all(Array.from({length:Math.min(4,tasks.length)},worker));
 if(failure)throw failure;
 const documentRemovals=await rpc('totus_pending_document_removals');
 if(!Array.isArray(documentRemovals))throw new Error('No se pudo comprobar el estado de las retiradas documentales.');
 tasks.forEach(([key],i)=>state.data[key]=results[i]);
 state.data.documentRemovals=documentRemovals;
 setRolePermissions(state.data.rolePermissions);
 state.data.settings=state.data.settings[0]||null;
 state.data.backupConfig=state.data.backupConfig[0]||null;
 await reloadStorageUsage();
 if(['admin','gerente'].includes(state.user?.role))await reloadAudit().catch(error=>{state.data.auditError=error.message});
}
let auditHistoryCache=null;
export async function reloadAudit({full=false}={}){
 if(!['admin','gerente'].includes(state.user?.role))return;
 const owner=state.user.email+':'+state.user.role;
 const cache=!full&&auditHistoryCache?.owner===owner?auditHistoryCache:null;
 const since=rows=>rows?.reduce((last,r)=>String(r.created_at||'')>last?String(r.created_at):last,'')||'';
 const history=(table,rows)=>select(table,{order:'created_at',ascending:false,filter:since(rows)?q=>q.gte('created_at',since(rows)):undefined});
 const [newEvents,newUsers,chat,tasks]=await Promise.all([
  history('ops_audit_log',cache?.events),
  state.user.role==='admin'?history('team_user_audit_log',cache?.users):Promise.resolve([]),
  select('ops_chat_events',{order:'created_at',ascending:false}),
  select('ops_task_events',{order:'created_at',ascending:false})
 ]);
 const backups=state.user.role==='admin'?await select('ops_backup_runs',{order:'started_at',ascending:false,columns:'id,mode,status,started_at,finished_at,files_count,rows_count,error_message'}):[];
 const events=mergeAuditRows(cache?.events,newEvents),users=mergeAuditRows(cache?.users,newUsers);
 auditHistoryCache={owner,events,users};
 state.data.audit=combineAuditEvents({events,users,chat,tasks,backups,people:[...(state.data.team||[]),...(state.data.profiles||[])]});
 state.data.auditError='';state.data.auditUpdatedAt=new Date().toISOString();
}
