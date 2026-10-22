// Shared browser/server archive format. No credentials, DOM or network side effects.
export const RECOVERY_TABLES=[
 'ops_business_settings','ops_stores','ops_expense_categories','ops_cash_drawers','ops_invoice_series',
 'ops_suppliers','ops_customers','ops_document_templates','ops_documents','ops_daily_closings','ops_daily_closing_drawers',
 'ops_expenses','ops_expense_lines','ops_sales_invoices','ops_sales_invoice_lines','ops_tax_payments','ops_fiscal_adjustments','ops_income_adjustments','ops_reta_brackets','ops_audit_log',
 'brands','families','providers','products','product_variants','product_provider_prices','product_competitor_prices','price_history','consultations','consultation_history',
 'ops_roles','ops_role_permissions','ops_user_permissions','ops_backup_config',
 'profiles','team_members','team_email_log','team_user_audit_log'
];
export const RECOVERY_BUCKETS=['business-documents','business-assets'];
export const MAX_ARCHIVE_BYTES=120*1024*1024;
export const MAX_EXPANDED_BYTES=128*1024*1024;
export const MAX_DATABASE_BYTES=8*1024*1024;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HASH=/^[0-9a-f]{64}$/;
export async function archiveHash(value){
 const bytes=typeof value==='string'?new TextEncoder().encode(value):value instanceof Blob?await value.arrayBuffer():value;
 return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export function validateArchivePath(path){
 if(typeof path!=='string'||!path||path.length>1024||/[\\\x00-\x1f]/.test(path)||path.startsWith('/')||path.split('/').some(x=>!x||x==='.'||x==='..'))
  throw new Error('Ruta de archivo no válida en la copia.');
 return path;
}
export function recoveryFileReferences(database){
 const refs=Object.fromEntries(RECOVERY_BUCKETS.map(b=>[b,new Set()]));
 for(const doc of database.ops_documents||[])if(doc.storage_path)refs['business-documents'].add(validateArchivePath(doc.storage_path));
 const walk=value=>{
  if(Array.isArray(value)){value.forEach(walk);return}
  if(!value||typeof value!=='object')return;
  for(const [key,item] of Object.entries(value)){
   if(key==='logo_path'&&item)refs['business-assets'].add(validateArchivePath(item));
   else if(item&&typeof item==='object')walk(item);
  }
 };
 for(const table of ['ops_document_templates','ops_sales_invoices','ops_business_settings'])walk(database[table]);
 return Object.fromEntries(RECOVERY_BUCKETS.map(b=>[b,[...refs[b]].sort()]));
}
export function validateMetadata(manifest,database){
 if(manifest.format!=='totus-clean-backup'||manifest.version!==3)
  throw new Error('La recuperación necesita una copia nueva de versión 3. Las anteriores se pueden comprobar, pero no conservan todos los autores.');
 if(!UUID.test(manifest.database_instance||'')||!HASH.test(manifest.schema_hash||'')||!HASH.test(manifest.revision||'')||!manifest.project_ref)
  throw new Error('La copia no identifica su proyecto, estructura o revisión.');
 if(!Array.isArray(manifest.identities)||manifest.identities.some(x=>!UUID.test(x.id||'')||typeof x.email!=='string'))
  throw new Error('El inventario de cuentas de la copia no es válido.');
 if(!database||typeof database!=='object'||Array.isArray(database)||Object.keys(database).length!==RECOVERY_TABLES.length
  ||RECOVERY_TABLES.some(t=>!Array.isArray(database[t]))||!Array.isArray(manifest.tables)
  ||manifest.tables.length!==RECOVERY_TABLES.length||new Set(manifest.tables).size!==RECOVERY_TABLES.length
  ||RECOVERY_TABLES.some(t=>!manifest.tables.includes(t)))throw new Error('Las tablas de la copia están incompletas.');
 const refs=recoveryFileReferences(database);
 for(const bucket of RECOVERY_BUCKETS){
  const paths=manifest.storage?.[bucket];
  if(!Array.isArray(paths)||new Set(paths).size!==paths.length)throw new Error('Inventario de archivos incompleto o duplicado.');
  paths.forEach(validateArchivePath);
  if(JSON.stringify([...paths].sort())!==JSON.stringify(refs[bucket]))throw new Error('Los archivos inventariados no coinciden con los documentos y logos vinculados.');
 }
}
export async function buildRecoveryArchive(snapshot,JSZip,readFile){
 const hashValue=JSZip.archiveHash||archiveHash;
 const manifest={format:'totus-clean-backup',version:3,scope:'same-project-application-data',
  project_ref:snapshot.project_ref,database_instance:snapshot.database_instance,schema_hash:snapshot.schema_hash,
  revision:snapshot.revision,created_at:snapshot.created_at,tables:[...RECOVERY_TABLES],
  storage:snapshot.storage,identities:snapshot.identities,integrity:{storage:{}}};
 validateMetadata(manifest,snapshot.database);
 const zip=new JSZip(),databaseJson=JSON.stringify(snapshot.database);
 if(new TextEncoder().encode(databaseJson).byteLength>MAX_DATABASE_BYTES)throw new Error('Los datos de la copia superan 8 MB. Necesitan un respaldo de mayor capacidad.');
 manifest.integrity.database=await hashValue(databaseJson);
 manifest.integrity.identities=await hashValue(JSON.stringify(manifest.identities));
 let expanded=new TextEncoder().encode(databaseJson).byteLength;
 await zip.file('database.json',databaseJson);
 const pending=[];
 const originalHashes=new Map((snapshot.database.ops_documents||[]).filter(d=>d.storage_path&&d.sha256).map(d=>[d.storage_path,d.sha256]));
 for(const bucket of RECOVERY_BUCKETS){
  manifest.integrity.storage[bucket]={};
  for(const path of manifest.storage[bucket])pending.push({bucket,path});
 }
 let next=0,failure=null;
 const worker=async()=>{
  while(!failure&&next<pending.length){
   const {bucket,path}=pending[next++];
   try{
    const original=await readFile(bucket,path);
    if(original==null)throw new Error('Falta el archivo '+bucket+'/'+path+'. No se ha creado una copia incompleta.');
    const bytes=original instanceof Blob?new Uint8Array(await original.arrayBuffer()):original instanceof Uint8Array?original:new Uint8Array(original);
    expanded+=bytes.byteLength;
    if(expanded>MAX_EXPANDED_BYTES)throw new Error('El contenido descomprimido supera el límite de seguridad de 128 MB. No se ha guardado una copia incompleta.');
    const digest=await hashValue(bytes);
    if(bucket==='business-documents'&&originalHashes.has(path)&&originalHashes.get(path)!==digest)throw new Error('Un original no coincide con la huella registrada. No se ha creado la copia.');
    manifest.integrity.storage[bucket][path]=digest;
    await zip.file('storage/'+bucket+'/'+path,bytes);
   }catch(error){failure||=error;}
  }
 };
 await Promise.all(Array.from({length:Math.min(JSZip.concurrency||4,pending.length)},worker));
 if(failure)throw failure;
 const manifestJson=JSON.stringify(manifest);
 expanded+=new TextEncoder().encode(manifestJson).byteLength;
 if(expanded>MAX_EXPANDED_BYTES)throw new Error('El contenido descomprimido supera el límite de seguridad de 128 MB. No se ha guardado una copia incompleta.');
 await zip.file('manifest.json',manifestJson);
 // Keep the fast path for small archives. Larger source inventories may fit
 // safely after lossless compression; the 120 MB file and 128 MB expansion caps remain.
 const compress=expanded>24*1024*1024;
 const bytes=await zip.generateAsync({type:'uint8array',compression:compress?'DEFLATE':'STORE',compressionOptions:compress?{level:1}:undefined});
 if(bytes.byteLength>MAX_ARCHIVE_BYTES)throw new Error('La copia supera 120 MB. No se ha guardado una copia incompleta.');
 return {bytes,manifest};
}
export async function loadBoundedRecoveryZip(input,JSZip){
 if(input instanceof Blob&&input.size>MAX_ARCHIVE_BYTES)throw new Error('La copia supera el límite de recuperación de 120 MB.');
 if(input?.format==='totus-backup-set')return input.openZip(JSZip);
 const bytes=input instanceof Blob?await input.arrayBuffer():input;
 if(bytes.byteLength>MAX_ARCHIVE_BYTES)throw new Error('La copia supera el límite de recuperación de 120 MB.');
 const zip=await JSZip.loadAsync(bytes);
 let expanded=0;
 for(const entry of Object.values(zip.files)){
  if(entry.dir)continue;
  // JSZip is pinned to 3.10.1. Check the ZIP directory before expanding any file.
  const size=entry._data?.uncompressedSize;
  if(!Number.isSafeInteger(size)||size<0)throw new Error('El ZIP no declara un tamaño de archivo válido.');
  if(entry.name==='database.json'&&size>MAX_DATABASE_BYTES)throw new Error('Los datos de la copia superan el límite de seguridad de 8 MB.');
  expanded+=size;
  if(!zip.componentSet&&expanded>MAX_EXPANDED_BYTES)throw new Error('El contenido descomprimido supera el límite de seguridad de 128 MB.');
 }
 return zip;
}
export async function readRecoveryArchive(input,JSZip,{projectRef,instance,schemaHash}={}){
 const hashValue=JSZip.archiveHash||archiveHash;
 const zip=await loadBoundedRecoveryZip(input,JSZip);
 const mf=zip.file('manifest.json'),db=zip.file('database.json');
 if(!mf||!db)throw new Error('Faltan el inventario o los datos de la copia.');
 const manifest=JSON.parse(await mf.async('string')),databaseJson=await db.async('string'),database=JSON.parse(databaseJson);
 validateMetadata(manifest,database);
 if(projectRef&&manifest.project_ref!==projectRef||instance&&manifest.database_instance!==instance||schemaHash&&manifest.schema_hash!==schemaHash)
  throw new Error('La copia pertenece a otro proyecto o a una estructura incompatible.');
 if(await hashValue(databaseJson)!==manifest.integrity?.database
  ||await hashValue(JSON.stringify(manifest.identities))!==manifest.integrity?.identities)throw new Error('La copia está dañada: falla el control de integridad de datos o cuentas.');
 const expected=new Set(['manifest.json','database.json']);
 for(const doc of database.ops_documents)if(doc.storage_path&&doc.sha256&&doc.sha256!==manifest.integrity?.storage?.['business-documents']?.[doc.storage_path])throw new Error('La copia está dañada: un documento no coincide con su huella registrada.');
 for(const bucket of RECOVERY_BUCKETS)for(const path of manifest.storage[bucket]){
  const name='storage/'+bucket+'/'+path;expected.add(name);
  const entry=zip.file(name);
  if(!entry||entry.dir)throw new Error('Falta el archivo '+bucket+'/'+path+' en la copia.');
  if(await hashValue(await entry.async('uint8array'))!==manifest.integrity?.storage?.[bucket]?.[path])throw new Error('La copia está dañada: falla la integridad del archivo '+bucket+'/'+path);
 }
 for(const entry of Object.values(zip.files))if(!entry.dir&&!expected.has(entry.name))throw new Error('El ZIP incluye un archivo inesperado.');
 return {zip,manifest,database};
}
export async function prepareRecoveryPlan(archive,jobId,{reusable}={}){
 if(!UUID.test(jobId))throw new Error('Identificador de recuperación no válido.');
 const files=[],maps=Object.fromEntries(RECOVERY_BUCKETS.map(b=>[b,new Map()]));
 for(const bucket of RECOVERY_BUCKETS)for(const path of archive.manifest.storage[bucket]){
  if(reusable?.version===3&&reusable.revision&&reusable.project_ref===archive.manifest.project_ref
   &&reusable.database_instance===archive.manifest.database_instance&&reusable.schema_hash===archive.manifest.schema_hash
   &&reusable.integrity?.storage?.[bucket]?.[path]===archive.manifest.integrity.storage[bucket][path]){
   maps[bucket].set(path,path);continue;
  }
  const extension=path.match(/\.([a-z0-9]{1,10})$/i)?.[1].toLowerCase();
  const target='recovery/'+jobId+'/'+await archiveHash(bucket+'/'+path)+(extension?'.'+extension:'');
  maps[bucket].set(path,target);files.push({bucket,path,target,hash:archive.manifest.integrity.storage[bucket][path]});
 }
 const walk=value=>{
  if(Array.isArray(value))return value.map(walk);
  if(!value||typeof value!=='object')return value;
  return Object.fromEntries(Object.entries(value).map(([key,item])=>{
   const bucket=key==='storage_path'?'business-documents':key==='logo_path'?'business-assets':null;
   return [key,bucket&&typeof item==='string'&&maps[bucket].has(item)?maps[bucket].get(item):walk(item)];
  }));
 };
 const database=JSON.parse(JSON.stringify(archive.database));
 for(const table of ['ops_documents','ops_document_templates','ops_sales_invoices','ops_business_settings'])database[table]=walk(database[table]);
 return {database,files};
}
