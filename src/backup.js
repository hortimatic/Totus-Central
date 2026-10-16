import {sb,rpc} from './api.js';
import {download} from './utils.js';

const JSZip=window.JSZip;
export const BACKUP_TABLES=[
 'ops_business_settings','ops_stores','ops_expense_categories','ops_cash_drawers','ops_invoice_series',
 'ops_suppliers','ops_customers','ops_document_templates','ops_documents','ops_daily_closings','ops_daily_closing_drawers',
 'ops_expenses','ops_expense_lines','ops_sales_invoices','ops_sales_invoice_lines','ops_tax_payments','ops_fiscal_adjustments','ops_income_adjustments','ops_reta_brackets','ops_audit_log',
 'brands','families','providers','products','product_variants','product_provider_prices','product_competitor_prices','price_history','consultations','consultation_history',
 'ops_roles','ops_role_permissions','ops_user_permissions','ops_backup_config'
];
const STORAGE_BUCKETS=['business-documents','business-assets'];
async function sha256(bytes){
 const buffer=typeof bytes==='string'?new TextEncoder().encode(bytes):bytes instanceof Blob?await bytes.arrayBuffer():bytes;
 const digest=await crypto.subtle.digest('SHA-256',buffer);
 return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

async function allRows(table){
 const rows=[];let from=0;
 const orderKey={ops_roles:'code',ops_role_permissions:'role',ops_user_permissions:'email'}[table]||'id';
 while(true){
  const {data,error}=await sb.from(table).select('*').order(orderKey,{ascending:true}).range(from,from+999);
  if(error)throw new Error(table+': '+error.message);
  rows.push(...(data||[]));
  if(!data||data.length<1000)break;
  from+=1000;
 }
 return rows;
}
function sanitize(table,rows){
 const actorCols={
  products:['created_by'],consultations:['created_by'],consultation_history:['user_id'],price_history:['user_id'],
  ops_documents:['uploaded_by'],ops_daily_closings:['created_by','closed_by'],ops_expenses:['created_by'],
  ops_sales_invoices:['created_by'],ops_tax_payments:['created_by'],ops_fiscal_adjustments:['created_by'],ops_income_adjustments:['created_by'],ops_audit_log:['user_id']
 };
 const cols=actorCols[table]||[];
 return rows.map(row=>{const x={...row};for(const c of cols)x[c]=null;return x});
}
async function listFiles(bucket,prefix=''){
 const out=[];let offset=0;
 while(true){
  const {data,error}=await sb.storage.from(bucket).list(prefix,{limit:1000,offset,sortBy:{column:'name',order:'asc'}});
  if(error)throw new Error(bucket+': '+error.message);
  const list=data||[];
  for(const item of list){
   const full=prefix?prefix+'/'+item.name:item.name;
   if(item.id)out.push(full);else out.push(...await listFiles(bucket,full));
  }
  if(list.length<1000)break;
  offset+=1000;
 }
 return out;
}
async function addStorage(zip){
 const manifest={},hashes={};
 for(const bucket of STORAGE_BUCKETS){
  const paths=await listFiles(bucket);
  manifest[bucket]=paths;hashes[bucket]={};
  for(const path of paths){
   const {data,error}=await sb.storage.from(bucket).download(path);
   if(error)throw new Error('No se pudo incluir '+bucket+'/'+path+': '+error.message);
   zip.file('storage/'+bucket+'/'+path,data);
   hashes[bucket][path]=await sha256(data);
  }
 }
 return {manifest,hashes};
}
export async function createBackup(){
 if(!JSZip)throw new Error('No está disponible el motor ZIP.');
 const zip=new JSZip(),database={};
 for(const table of BACKUP_TABLES)database[table]=sanitize(table,await allRows(table));
 const {manifest:storage,hashes}=await addStorage(zip);
 const databaseJson=JSON.stringify(database);
 const manifest={format:'totus-clean-backup',version:2,created_at:new Date().toISOString(),tables:BACKUP_TABLES,storage,integrity:{database:await sha256(databaseJson),storage:hashes}};
 zip.file('manifest.json',JSON.stringify(manifest,null,2));
 zip.file('database.json',databaseJson);
 const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});
 const stamp=new Date().toISOString().replace(/[:.]/g,'-');
 download(blob,`Totus_Central_${stamp}.totusbackup`);
 return {size:blob.size,manifest};
}
export async function inspectBackup(file){
 if(!file)throw new Error('Selecciona una copia.');
 const zip=await JSZip.loadAsync(file),mf=zip.file('manifest.json'),dbf=zip.file('database.json');
 if(!mf||!dbf)throw new Error('La copia no contiene manifest.json y database.json.');
 const manifest=JSON.parse(await mf.async('string'));
 if(manifest.format!=='totus-clean-backup'||![1,2].includes(manifest.version))throw new Error('Formato de copia no compatible.');
 const databaseJson=await dbf.async('string');
 if(manifest.version===2){
  if(!manifest.integrity?.database||await sha256(databaseJson)!==manifest.integrity.database)throw new Error('Copia dañada: datos sin integridad.');
 }
 const database=JSON.parse(databaseJson);
 if(!database||typeof database!=='object'||Array.isArray(database))throw new Error('Estructura de base de datos no válida.');
 for(const table of BACKUP_TABLES){
  if(manifest.version===1&&table==='ops_income_adjustments'&&database[table]===undefined)database[table]=[];
  // Las copias antiguas v2 no incluían roles/permisos/catálogo de programación; las cuentas/Auth siguen excluidas.
  if(!manifest.tables?.includes(table)&&database[table]===undefined&&['ops_roles','ops_role_permissions','ops_user_permissions','ops_backup_config'].includes(table))database[table]=[];
  if(!Array.isArray(database[table]))throw new Error('Falta la tabla '+table+' en la copia.');
 }
 // Evitar que una copia manipulada incluya rutas duplicadas, archivos ajenos o ZIPs inconsistentes.
 const expectedEntries=new Set(['manifest.json','database.json']);
 for(const bucket of STORAGE_BUCKETS){
  const paths=manifest.storage?.[bucket];
  if(!Array.isArray(paths))throw new Error('Falta inventario de archivos de '+bucket);
  if(new Set(paths).size!==paths.length)throw new Error('La copia incluye rutas duplicadas en '+bucket);
  for(const path of paths){
   if(typeof path!=='string'||!path||path.includes('..')||path.includes('\\')||path.startsWith('/')||path.split('/').some(s=>!s||s==='.'||s==='..'))throw new Error('Ruta inválida en copia: '+path);
   expectedEntries.add('storage/'+bucket+'/'+path);
  }
 }
 for(const name of Object.keys(zip.files)){
  if(zip.files[name].dir)continue;
  if(!expectedEntries.has(name))throw new Error('Archivo inesperado en copia: '+name);
 }
 // Rechazar copias incompletas antes de iniciar cualquier cambio en base de datos.
 for(const bucket of STORAGE_BUCKETS){
  const paths=manifest.storage?.[bucket];
  if(!Array.isArray(paths))throw new Error('Falta inventario de archivos de '+bucket);
  for(const path of paths){
   if(typeof path!=='string'||!path||path.includes('..')||path.includes('\\')||path.startsWith('/'))throw new Error('Ruta inválida en copia: '+path);
   const entry=zip.file('storage/'+bucket+'/'+path);
   if(!entry||entry.dir)throw new Error('Falta el archivo '+bucket+'/'+path+' en la copia.');
   if(manifest.version===2){
    const expected=manifest.integrity?.storage?.[bucket]?.[path];
    if(!expected||await sha256(await entry.async('uint8array'))!==expected)throw new Error('Copia dañada: archivo sin integridad '+bucket+'/'+path);
   }
  }
 }
 return {zip,manifest,database};
}
// SAFETY LOCK: restoring SQL rows and storage objects in separate transactions is not atomic.
// A partial failure could leave invoices and attachments inconsistent or delete newer files.
// Keep validation/read-only inspection available; refuse all writes until a staged,
// recoverable, server-coordinated restore procedure has passed end-to-end tests.
export async function restoreBackup(file,reason){
 await inspectBackup(file);
 throw new Error('Restauración deshabilitada por seguridad: primero hay que implementar y probar una restauración recuperable de base de datos y archivos. No se ha modificado ningún dato.');
}
