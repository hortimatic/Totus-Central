import {RECOVERY_TABLES,LEGACY_RECOVERY_TABLES,isLegacyStockArchive,validateMetadata} from '../../../src/recovery-core.js';
import {componentPath,signBackupSet,SET_COMPONENT_BYTES} from '../../../src/backup-set.js';
export function createPartitionedBackup({Zip,hash,readOriginal,writeComponent,readCode}){
 async function start(snapshot,path){
  const database=JSON.stringify(snapshot.database);
  if(new TextEncoder().encode(database).length>32*1024*1024)throw new Error('Los datos contables necesitan ampliar su capacidad de recuperación.');
  const manifest={format:'totus-clean-backup',version:3,bundle_version:4,scope:'same-project-application-data',
   project_ref:snapshot.project_ref,database_instance:snapshot.database_instance,schema_hash:snapshot.schema_hash,revision:snapshot.revision,
   created_at:snapshot.created_at,tables:isLegacyStockArchive({...snapshot,tables:Object.keys(snapshot.database||{})},snapshot.database)?[...LEGACY_RECOVERY_TABLES]:[...RECOVERY_TABLES],storage:snapshot.storage,identities:snapshot.identities,
   integrity:{database:await hash(database),identities:await hash(JSON.stringify(snapshot.identities)),storage:{'business-documents':{},'business-assets':{}}}};
  validateMetadata(manifest,snapshot.database);
  const known=new Map(snapshot.database.ops_documents.filter(d=>d.storage_path&&d.sha256).map(d=>[d.storage_path,d.sha256]));
  return {version:4,snapshot,source_revision:snapshot.source_revision,path,manifest,cursor:0,parts:[],files:Object.entries(snapshot.storage).flatMap(([bucket,paths])=>paths.map(path=>({bucket,path,sha256:bucket==='business-documents'?known.get(path)||null:null}))),stage:'documents'};
 }
 async function save(job,kind,zip,number){
  const bytes=await zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
  if(bytes.length>SET_COMPONENT_BYTES)throw new Error('Un componente supera 32 MB; no se publica una copia incompleta.');
  const path=componentPath(job.path,kind,number),sha256=await hash(bytes);
  await writeComponent(path,bytes,sha256);
  job.parts.push({kind,number,path,size:bytes.length,sha256});
 }
 async function advance(job){
  if(job.stage==='documents'){
   const zip=new Zip();let expanded=0,files=0;
   while(job.cursor<job.files.length&&files<30){
    const file=job.files[job.cursor],input=await readOriginal(file.bucket,file.path);
    if(input==null)throw new Error('Falta un original. Se conservan las copias anteriores.');
    const bytes=input instanceof Blob?new Uint8Array(await input.arrayBuffer()):new Uint8Array(input);
    if(bytes.length>24*1024*1024)throw new Error('Un documento supera 24 MB y necesita dividirse antes de incorporarlo a este formato.');
    if(files&&expanded+bytes.length>24*1024*1024)break;
    const digest=await hash(bytes);
    if(file.sha256&&file.sha256!==digest)throw new Error('El documento no coincide con el original del inventario.');
    job.manifest.integrity.storage[file.bucket][file.path]=digest;zip.file('storage/'+file.bucket+'/'+file.path,bytes);
    expanded+=bytes.length;files++;job.cursor++;
   }
   if(files)await save(job,'documentos',zip,job.parts.filter(p=>p.kind==='documentos').length);
   if(job.cursor===job.files.length)job.stage='code';
   return {job,complete:false};
  }
  if(job.stage==='code'){
   const source=await readCode();
   if(source.bytes.length>SET_COMPONENT_BYTES)throw new Error('El paquete de código supera el tamaño permitido.');
   const path=componentPath(job.path,'codigo',0),sha256=await hash(source.bytes);
   await writeComponent(path,source.bytes,sha256);
   job.parts.push({kind:'codigo',number:0,path,size:source.bytes.length,sha256});
   job.manifest.source_revision=source.revision;job.stage='data';return {job,complete:false};
  }
  if(job.stage==='data'){
   const zip=new Zip();zip.file('database.json',JSON.stringify(job.snapshot.database));zip.file('manifest.json',JSON.stringify(job.manifest));zip.file('LEEME.txt','TOTUS CENTRAL - JUEGO DE COPIA\nConserva el indice .totusbackup y todos los ZIP juntos. Cada juego cuenta como una copia.\nDATOS: contabilidad, usuarios de referencia, permisos e inventario. DOCUMENTOS: originales en ZIP numerados. CODIGO: version publicada y sus instrucciones.\nPara comprobar o recuperar en este proyecto: Administracion > Copias, seleccionar el indice y todos sus ZIP. No subas un solo ZIP como si fuera una copia completa.\nLas contrasenas y claves privadas no se exportan. Para reconstruir otra instalacion sigue el manual incluido con el codigo y vuelve a autorizar los servicios.\n');
   await save(job,'datos',zip,0);job.stage='complete';
  }
  if(job.stage!=='complete')throw new Error('Estado de copia desconocido.');
  const index=await signBackupSet(job.path,job.parts,hash);
  await writeComponent(job.path,new TextEncoder().encode(JSON.stringify(index)),await hash(JSON.stringify(index)));
  return {job,complete:true,index,manifest:job.manifest};
 }
 return {start,advance};
}
