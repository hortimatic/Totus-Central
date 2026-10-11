import {sb,rpc} from './api.js';
import {download} from './utils.js';

const JSZip=window.JSZip;
export const BACKUP_TABLES=[
 'ops_business_settings','ops_stores','ops_expense_categories','ops_cash_drawers','ops_invoice_series',
 'ops_suppliers','ops_customers','ops_document_templates','ops_documents','ops_daily_closings','ops_daily_closing_drawers',
 'ops_expenses','ops_expense_lines','ops_sales_invoices','ops_sales_invoice_lines','ops_tax_payments','ops_fiscal_adjustments','ops_income_adjustments','ops_reta_brackets','ops_audit_log',
 'brands','families','providers','products','product_variants','product_provider_prices','product_competitor_prices','price_history','consultations','consultation_history'
];
const STORAGE_BUCKETS=['business-documents','business-assets'];

async function allRows(table){
 const rows=[];let from=0;
 while(true){
  const {data,error}=await sb.from(table).select('*').range(from,from+999);
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
 const manifest={};
 for(const bucket of STORAGE_BUCKETS){
  const paths=await listFiles(bucket);
  manifest[bucket]=paths;
  for(const path of paths){
   const {data,error}=await sb.storage.from(bucket).download(path);
   if(error)throw new Error('No se pudo incluir '+bucket+'/'+path+': '+error.message);
   zip.file('storage/'+bucket+'/'+path,data);
  }
 }
 return manifest;
}
export async function createBackup(){
 if(!JSZip)throw new Error('No está disponible el motor ZIP.');
 const zip=new JSZip(),database={};
 for(const table of BACKUP_TABLES)database[table]=sanitize(table,await allRows(table));
 const storage=await addStorage(zip);
 const manifest={format:'totus-clean-backup',version:1,created_at:new Date().toISOString(),tables:BACKUP_TABLES,storage};
 zip.file('manifest.json',JSON.stringify(manifest,null,2));
 zip.file('database.json',JSON.stringify(database));
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
 if(manifest.format!=='totus-clean-backup'||manifest.version!==1)throw new Error('Formato de copia no compatible.');
 const database=JSON.parse(await dbf.async('string'));
 for(const table of BACKUP_TABLES)if(!Array.isArray(database[table]))throw new Error('Falta la tabla '+table+' en la copia.');
 return {zip,manifest,database};
}
async function restoreStorage(zip,manifest){
 const wanted=new Map();
 for(const bucket of STORAGE_BUCKETS){
  const paths=manifest.storage?.[bucket]||[];
  wanted.set(bucket,new Set(paths));
  for(const path of paths){
   const entry=zip.file('storage/'+bucket+'/'+path);
   if(!entry)throw new Error('Falta el archivo '+bucket+'/'+path+' en la copia.');
   const blob=await entry.async('blob');
   const {error}=await sb.storage.from(bucket).upload(path,blob,{upsert:true});
   if(error)throw new Error('No se pudo restaurar '+bucket+'/'+path+': '+error.message);
  }
 }
 for(const bucket of STORAGE_BUCKETS){
  const keep=wanted.get(bucket)||new Set(),existing=await listFiles(bucket);
  const extra=existing.filter(p=>!keep.has(p));
  for(let i=0;i<extra.length;i+=100){
   const batch=extra.slice(i,i+100);
   if(!batch.length)continue;
   const {error}=await sb.storage.from(bucket).remove(batch);
   if(error)throw new Error('Los datos se restauraron, pero no se pudieron limpiar archivos sobrantes de '+bucket+': '+error.message);
  }
 }
}
export async function restoreBackup(file,reason){
 const {zip,manifest,database}=await inspectBackup(file);
 await rpc('totus_restore_backup',{p_payload:database,p_reason:reason});
 await restoreStorage(zip,manifest);
 return manifest;
}
