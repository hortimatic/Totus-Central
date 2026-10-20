import {sb,rpc,downloadFile} from './api.js';
import {SUPABASE_URL} from './config.js';
import {RECOVERY_TABLES,buildRecoveryArchive,readRecoveryArchive,loadBoundedRecoveryZip} from './recovery-core.js';
import {download} from './utils.js';

const JSZip=window.JSZip;
export const BACKUP_TABLES=RECOVERY_TABLES;
const STORAGE_BUCKETS=['business-documents','business-assets'];
async function sha256(bytes){
 const buffer=typeof bytes==='string'?new TextEncoder().encode(bytes):bytes instanceof Blob?await bytes.arrayBuffer():bytes;
 const digest=await crypto.subtle.digest('SHA-256',buffer);
 return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

export async function createBackup(){
 if(!JSZip)throw new Error('No está disponible el motor ZIP.');
 const snapshot=await rpc('totus_export_recovery_snapshot');
 snapshot.project_ref=new URL(SUPABASE_URL).hostname.split('.')[0];
 const {bytes,manifest}=await buildRecoveryArchive(snapshot,JSZip,async(bucket,path)=>{
  return downloadFile(bucket,path);
 });
 const blob=new Blob([bytes],{type:'application/octet-stream'});
 download(blob,`Totus_Central_${new Date().toISOString().replace(/[:.]/g,'-')}.totusbackup`);
 return {size:blob.size,manifest};
}
export async function inspectBackup(file){
 if(!file)throw new Error('Selecciona una copia.');
 const zip=await loadBoundedRecoveryZip(file,JSZip),mf=zip.file('manifest.json'),dbf=zip.file('database.json');
 if(!mf||!dbf)throw new Error('La copia no contiene manifest.json y database.json.');
 const manifest=JSON.parse(await mf.async('string'));
 if(manifest.version===3)return readRecoveryArchive(file,JSZip);
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
  if(!manifest.tables?.includes(table)&&database[table]===undefined&&['ops_roles','ops_role_permissions','ops_user_permissions','ops_backup_config','profiles','team_members','team_email_log','team_user_audit_log'].includes(table))database[table]=[];
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
// Retain the old entrypoint as a read-only compatibility guard. Recovery writes
// must go through the authenticated server coordinator, including its checkpoint.
export async function restoreBackup(file){
 await inspectBackup(file);
 throw new Error('Restauración antigua deshabilitada por seguridad. Para una copia v3 utiliza «Revisar para recuperar», que prepara los archivos y guarda un punto de vuelta atrás. No se ha modificado ningún dato.');
}
