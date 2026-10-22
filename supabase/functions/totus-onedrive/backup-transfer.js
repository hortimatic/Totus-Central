import {validateBackupSet,backupSetProof,SET_FORMAT,SET_COMPONENT_BYTES,SET_INDEX_BYTES} from '../../../src/backup-set.js';

import {BACKUP_PART_BYTES,validateBackupIndex} from '../../../src/backup-index.js';
const UUID=/^[a-f0-9-]{36}$/i,MAX_PARTS=15,MAX_INDEX=16384;
export async function readBoundedBackupContent(response,limit=BACKUP_PART_BYTES){
 const declared=Number(response.headers.get('content-length'));
 if(Number.isFinite(declared)&&declared>limit)throw new Error('El fragmento supera '+(limit/1048576)+' MiB.');
 if(!response.body)throw new Error('Falta el fragmento de copia.');
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{for(;;){const value=await reader.read();if(value.done)break;size+=value.value.byteLength;
  if(size>limit){await reader.cancel();throw new Error('El fragmento supera '+(limit/1048576)+' MiB.');}chunks.push(value.value);
 }}finally{reader.releaseLock();}
 if(!size)throw new Error('El fragmento está vacío.');
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
export function createDirectBackupTransfer({admin,check,config,token,root,ensurePath,graph,encodedPath,fileHash,fetchFile=fetch}){
 const folderFor=run=>'02 Copias de seguridad/'+new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(run.started_at)).replace(/:/g,'-')+' - Copia completa - '+run.id.slice(0,8);
 async function context(runId,path=null){
  if(!UUID.test(runId))throw new Error('Referencia de copia no válida.');
  const run=check(await admin.from('ops_backup_runs').select('id,status,started_at,storage_path').eq('id',runId).single(),'No se pudo comprobar la copia en preparación.');
  const source=run?.storage_path;
  if(run?.status!=='running'||!source?.endsWith('.totusbackup')||source.length>1024||/[\\\x00-\x1f]/.test(source)||source.split('/').some(p=>!p||p==='.'||p==='..'))throw new Error('La copia no está en preparación.');
  if(path!==null){
   const suffix=String(path).slice(source.length);
   if(path!==source&&(!String(path).startsWith(source)||!(/^\.part-\d{4}$/.test(suffix)&&Number(suffix.slice(-4))<MAX_PARTS||/^\.(?:datos|documentos|codigo)-\d{4}\.zip$/.test(suffix))))throw new Error('Archivo fuera de la copia en preparación.');
  }
  const c=await config();if(!c.connected||!c.tested_at)throw new Error('OneDrive no está comprobado.');
  const saved=check(await admin.from('ops_onedrive_backups').select('*').eq('run_id',runId).maybeSingle(),'No se pudo comprobar el destino.');
  if(saved&&saved.source_path!==source)throw new Error('El destino de la copia cambió.');
  const folder=saved?.folder_path||folderFor(run);
  if(!folder.startsWith('02 Copias de seguridad/'))throw new Error('Destino de copia no válido.');
  return {run,source,saved,folder};
 }
 const route=(folder,path)=>'/me/drive/special/approot:/'+encodedPath([...folder.split('/'),...path.split('/')]);
 async function prepare(runId,requestedPaths=null){
  const c=await context(runId);if(c.saved?.verified_at)throw new Error('Una copia verificada no se sobrescribe.');
  const access=await token();await root(access);
  await ensurePath(access,[...c.folder.split('/'),...c.source.split('/').slice(0,-1)],new Set());
  if(!c.saved)check(await admin.from('ops_onedrive_backups').insert({run_id:runId,source_path:c.source,folder_path:c.folder,archive_sha256:'0'.repeat(64),archive_size:0,total_files:1}),'No se pudo registrar la copia en preparación.');
  const paths=requestedPaths||[c.source,...Array.from({length:MAX_PARTS},(_,i)=>c.source+'.part-'+String(i).padStart(4,'0'))],sessions=[];let next=0;
  if(!Array.isArray(paths)||!paths.length||paths.length>20||new Set(paths).size!==paths.length)throw new Error('Inventario de subida no válido.');
  for(const path of paths)await context(runId,path);
  const worker=async()=>{while(next<paths.length){
   const path=paths[next++],response=await graph(access,route(c.folder,path)+':/createUploadSession',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({item:{'@microsoft.graph.conflictBehavior':'fail'}})});
   if(!response.ok)throw new Error('No se pudo preparar la subida privada (HTTP '+response.status+').');
   const value=await response.json();if(typeof value.uploadUrl!=='string'||new URL(value.uploadUrl).protocol!=='https:')throw new Error('Subida privada no válida.');
   sessions.push({path,url:value.uploadUrl});
  }};
  await Promise.all(Array.from({length:3},worker));return {source_path:c.source,sessions};
 }
 async function download(access,folder,path){
  const response=await graph(access,route(folder,path)+':/content'),location=response.headers.get('Location');
  if(response.status!==302||!location||new URL(location).protocol!=='https:')throw new Error('No se pudo localizar el fragmento privado.');
  const content=await fetchFile(location,{signal:AbortSignal.timeout(60000)});
  if(!content.ok)throw new Error('No se pudo leer el fragmento privado.');
  return readBoundedBackupContent(content,SET_COMPONENT_BYTES);
 }
 async function verify(runId,path,size,sha256){
  if(!Number.isSafeInteger(size)||size<1||size>SET_COMPONENT_BYTES||!/^[a-f0-9]{64}$/.test(sha256))throw new Error('Prueba de fragmento no válida.');
  const c=await context(runId,path),access=await token(),bytes=await download(access,c.folder,path);
  if(bytes.length!==size||await fileHash(bytes.buffer)!==sha256)throw new Error('El fragmento de OneDrive no coincide con el original.');
  const isRoot=path===c.source;let index=null;
  if(isRoot&&bytes[0]===123){
   if(bytes.length>SET_INDEX_BYTES)throw new Error('Índice demasiado grande.');
   const parsed=JSON.parse(new TextDecoder().decode(bytes));
   index=parsed.format===SET_FORMAT?validateBackupSet(c.source,parsed):validateBackupIndex(c.source,parsed);
   if(index.format===SET_FORMAT&&await fileHash(new TextEncoder().encode(backupSetProof(index)).buffer)!==index.sha256)throw new Error('El índice del juego no coincide con su huella.');
   const parts=check(await admin.from('ops_onedrive_backup_files').select('source_path,size_bytes,sha256,verified_at').eq('run_id',runId),'No se pudo comprobar el inventario.');
   for(const part of index.parts)if(!parts.some(p=>p.source_path===part.path&&Number(p.size_bytes)===part.size&&p.sha256===part.sha256&&p.verified_at))throw new Error('Falta un fragmento verificado. No se confirma la copia.');
  }else if(isRoot&&(bytes[0]!==80||bytes[1]!==75))throw new Error('La copia pequeña no es un ZIP.');
  if(c.saved?.verified_at){
   const existing=check(await admin.from('ops_onedrive_backup_files').select('sha256,size_bytes,verified_at').eq('run_id',runId).eq('source_path',path).maybeSingle(),'No se pudo comprobar el fragmento.');
   if(existing?.verified_at&&existing.sha256===sha256&&Number(existing.size_bytes)===size)return {verified:true,path,size,sha256};
   throw new Error('Una copia verificada no se modifica.');
  }
  const itemResponse=await graph(access,route(c.folder,path)+'?$select=id,size');
  if(!itemResponse.ok)throw new Error('No se pudo comprobar la identidad del fragmento.');
  const item=await itemResponse.json();if(Number(item.size)!==size||typeof item.id!=='string')throw new Error('La identidad del fragmento no coincide.');
  check(await admin.from('ops_onedrive_backup_files').upsert({run_id:runId,source_path:path,item_id:item.id,size_bytes:size,sha256,verified_at:new Date().toISOString()},{onConflict:'run_id,source_path'}),'No se pudo registrar el fragmento verificado.');
  if(isRoot)check(await admin.from('ops_onedrive_backups').update({archive_sha256:index?index.sha256:sha256,archive_size:index?index.size:size,total_files:index?index.parts.length+1:1,verified_at:new Date().toISOString()}).eq('run_id',runId).is('verified_at',null),'No se pudo confirmar la copia completa.');
  return {verified:true,path,size,sha256};
 }
 async function stagedUrl(runId,path){
  const c=await context(runId,path);
  const file=check(await admin.from('ops_onedrive_backup_files').select('verified_at').eq('run_id',runId).eq('source_path',path).maybeSingle(),'No se pudo comprobar el fragmento.');
  if(!file?.verified_at)throw new Error('El fragmento no está verificado.');
  const response=await graph(await token(),route(c.folder,path)+':/content'),location=response.headers.get('Location');
  if(response.status!==302||!location||new URL(location).protocol!=='https:')throw new Error('No se pudo preparar la lectura privada.');
  return {url:location};
 }
 return {prepare,verify,stagedUrl};
}
