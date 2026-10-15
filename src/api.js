import {SUPABASE_URL,SUPABASE_KEY} from './config.js';
import {state} from './state.js';
export const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const assert=({error},ctx)=>{if(error)throw new Error(`${ctx}: ${error.message}`)};
export async function login(email,password){const r=await sb.auth.signInWithPassword({email,password});assert(r,'Acceso');return r.data.session}
export async function logout(){await sb.auth.signOut()}
export async function recover(email){const r=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});assert(r,'Recuperación')}
export async function select(table,{order,ascending=false,limit=20000,filter}={}){
 const rows=[],pageSize=1000;let from=0;
 while(from<limit){
  let q=sb.from(table).select('*');
  if(filter)q=filter(q);
  if(order)q=q.order(order,{ascending});
  const size=Math.min(pageSize,limit-from);
  q=q.range(from,from+size-1);
  const r=await q;assert(r,table);
  const batch=r.data||[];rows.push(...batch);
  if(batch.length<size)break;
  from+=size;
 }
 return rows;
}
export async function insert(table,row){const r=await sb.from(table).insert(row).select().single();assert(r,`Crear ${table}`);return r.data}
export async function update(table,id,row){const r=await sb.from(table).update(row).eq('id',id).select().single();assert(r,`Actualizar ${table}`);return r.data}
export async function remove(table,id){const r=await sb.from(table).delete().eq('id',id);assert(r,`Eliminar ${table}`)}
export async function rpc(name,args={}){const r=await sb.rpc(name,args);assert(r,name);return r.data}
export async function invokeTeam(payload){const s=(await sb.auth.getSession()).data.session;if(!s)throw new Error('Sesión no válida');const res=await fetch(`${SUPABASE_URL}/functions/v1/team-admin`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${s.access_token}`,apikey:SUPABASE_KEY},body:JSON.stringify(payload)});const body=await res.json().catch(()=>({}));if(!res.ok)throw new Error(body.error||`Error ${res.status}`);return body}
export async function upload(bucket,path,file){const r=await sb.storage.from(bucket).upload(path,file,{contentType:file.type,upsert:false});assert(r,'Subida');return r.data}
export async function signedUrl(bucket,path,seconds=120){const r=await sb.storage.from(bucket).createSignedUrl(path,seconds);assert(r,'Vista previa');return r.data.signedUrl}
export async function removeFile(bucket,path){const r=await sb.storage.from(bucket).remove([path]);assert(r,'Eliminar archivo')}
export async function loadCore(){
 const tasks=[
 ['settings','ops_business_settings'],['userPermissions','ops_user_permissions'],['team','team_members'],['profiles','profiles'],['stores','ops_stores'],['drawers','ops_cash_drawers'],['categories','ops_expense_categories'],['suppliers','ops_suppliers'],
 ['closings','ops_daily_closings','business_date'],['closingDrawers','ops_daily_closing_drawers'],['expenses','ops_expenses','expense_date'],['expenseLines','ops_expense_lines'],
 ['customers','ops_customers','name'],['series','ops_invoice_series','year'],['invoices','ops_sales_invoices','issue_date'],['invoiceLines','ops_sales_invoice_lines'],['documents','ops_documents','created_at'],
 ['taxPayments','ops_tax_payments','created_at'],['reta','ops_reta_brackets','bracket_order'],['fiscalAdjustments','ops_fiscal_adjustments','adjustment_date'],['incomeAdjustments','ops_income_adjustments','income_date'],
 ['templates','ops_document_templates','name'],['brands','brands','name'],['families','families','name'],['products','products','updated_at'],['variants','product_variants','created_at'],
 ['providers','providers','name'],['providerPrices','product_provider_prices','created_at'],['competitors','product_competitor_prices','created_at'],['consultations','consultations','updated_at']
 ];
 const results=await Promise.all(tasks.map(([,table,order])=>select(table,{order,ascending:false}).catch(e=>{console.error(e);throw e})));
 tasks.forEach(([key],i)=>state.data[key]=results[i]);
 state.data.settings=state.data.settings[0]||null;
 state.data.storageUsage=await rpc('totus_storage_usage').catch(()=>({documents_bytes:0,documents_count:0,assets_bytes:0,assets_count:0,total_bytes:0,limit_bytes:Number(state.data.settings?.storage_limit_bytes||500*1024*1024)}));
 if(['admin','gerente'].includes(state.user?.role)){state.data.audit=await select('ops_audit_log',{order:'created_at',ascending:false,limit:1000}).catch(()=>[])}
}
