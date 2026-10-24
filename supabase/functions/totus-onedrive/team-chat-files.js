import {CHAT_FILE_LIMIT,chatFileMetadata,microsoftTransferUrl,checkChatFileSignature} from '../../../src/chat-files.js';
export function createTeamChatFiles({admin,scoped,check,token,root,ensurePath,graph,encodedPath,fileHash,headers,fetchFile=fetch}){
 const pathFor=f=>'/me/drive/special/approot:/'+encodedPath(f.onedrive_path.split('/'));
 const json=data=>new Response(JSON.stringify(data),{headers:{...headers,'Content-Type':'application/json'}});
 async function bounded(response){
  const declared=Number(response.headers.get('Content-Length'));if(declared>CHAT_FILE_LIMIT)throw new Error('El archivo supera 20 MB.');
  if(!response.body)throw new Error('El archivo está vacío.');
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{for(;;){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>CHAT_FILE_LIMIT){await reader.cancel();throw new Error('El archivo supera 20 MB.');}chunks.push(r.value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
 }
 async function content(f,access){
  let restored=null;
  if(f.storage_path.startsWith('recovery/')){const local=await admin.storage.from('business-documents').download(f.storage_path);if(!local.error&&local.data){if(local.data.size>CHAT_FILE_LIMIT)throw new Error('El adjunto supera 20 MB.');restored=new Uint8Array(await local.data.arrayBuffer());}}
  const response=restored?null:await graph(access,pathFor(f)+':/content');
  let data;
  if(restored)data=restored;
  else
  if(response.status===302){
   const address=microsoftTransferUrl(response.headers.get('Location'));
   const remote=await fetchFile(address,{signal:AbortSignal.timeout(30000),redirect:'error'});
   if(!remote.ok)throw new Error('No se pudo leer el original de Microsoft.');
   data=await bounded(remote);
  }else if(response.status===200)data=await bounded(response);
  else if(response.status===404){
   const local=await admin.storage.from('business-documents').download(f.storage_path);
   if(local.error||!local.data)throw new Error('No se encuentra el adjunto. Revisa su copia de seguridad.');
   if(local.data.size>CHAT_FILE_LIMIT)throw new Error('El adjunto supera el límite permitido.');
   data=new Uint8Array(await local.data.arrayBuffer());
  }else throw new Error('Microsoft no pudo leer el adjunto (HTTP '+response.status+').');
  if(data.byteLength!==Number(f.size_bytes)||await fileHash(data)!==f.sha256)throw new Error('El adjunto no coincide con su original. No se ha mostrado otro archivo.');
  checkChatFileSignature(f,data);return data;
 }
 async function fileFor(id,client){
  if(!/^[a-f0-9-]{36}$/i.test(String(id||'')))throw new Error('Referencia de archivo no válida.');
  const f=check(await client.from('ops_chat_files').select('*').eq('id',id).maybeSingle(),'No se pudo comprobar el acceso al archivo.');
  if(!f||f.deleted_at)throw new Error('No tienes acceso a este adjunto.');
  return f;
 }
 async function verify(f,user){
  if(f.uploaded_by!==user.id)throw new Error('Solo el autor puede completar esta subida.');
  const access=await token();await root(access);
  const response=await graph(access,pathFor(f));if(!response.ok)throw new Error('La subida no ha terminado. Vuelve a seleccionar el mismo archivo y reintenta.');
  const item=await response.json();if(!item.file||Number(item.size)!==Number(f.size_bytes)||!item.id)throw new Error('Microsoft no ha confirmado el archivo completo.');
  await content(f,access);
  return check(await admin.rpc('totus_chat_file_verified',{p_id:f.id,p_item:item.id,p_actor:user.id}),'No se pudo asociar el archivo verificado.');
 }
 async function handle(req,body){
  const {client,user}=await scoped(req),action=String(body.action);
  if(action==='chat-file-prepare'){
   const metadata=chatFileMetadata({name:body.name,size:body.size});
   const f=check(await client.rpc('totus_chat_file_begin',{p_message:body.message_id,p_client:body.client_id,p_name:metadata.name,p_size:metadata.size,p_hash:body.sha256,p_mime:metadata.mime_type}),'No se pudo reservar el adjunto.');
   if(f.status==='ready')return json({file:f,complete:true});
   const access=await token();await root(access);await ensurePath(access,f.onedrive_path.split('/').slice(0,-1),new Set());
   const existing=await graph(access,pathFor(f));
   if(existing.status===200)return json({file:await verify(f,user),complete:true});
   if(existing.status!==404)throw new Error('No se pudo comprobar la carpeta del chat.');
   const response=await graph(access,pathFor(f)+':/createUploadSession',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({item:{'@microsoft.graph.conflictBehavior':'fail',name:f.onedrive_path.split('/').pop(),fileSize:Number(f.size_bytes)}})});
   if(!response.ok)throw new Error('Microsoft no pudo preparar la subida (HTTP '+response.status+').');
   const value=await response.json();return json({file:f,upload_url:microsoftTransferUrl(value.uploadUrl),expires_at:value.expirationDateTime});
  }
  const f=await fileFor(body.file_id,client);
  if(action==='chat-file-complete')return json({file:await verify(f,user)});
  if(action!=='chat-file-content')throw new Error('Operación de archivo no reconocida.');
  if(f.status!=='ready')throw new Error('Este adjunto todavía no ha terminado de subir.');
  const bytes=await content(f,await token());
  return new Response(bytes,{headers:{...headers,'Content-Type':f.mime_type,'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(f.original_name),'X-Content-Type-Options':'nosniff','Content-Length':String(bytes.length)}});
 }
 async function resolvePath(path,req,job=false){
  const client=job?admin:(await scoped(req)).client;
  const f=check(await client.from('ops_chat_files').select('*').eq('storage_path',path).eq('status','ready').maybeSingle(),'No se pudo comprobar el adjunto de la copia.');
  if(!f)return null;
  if(f.storage_path.startsWith('recovery/')){
   const local=await admin.storage.from('business-documents').createSignedUrl(path,300);
   if(!local.error&&local.data?.signedUrl)return {provider:'supabase',url:local.data.signedUrl,size_bytes:Number(f.size_bytes),sha256:f.sha256};
  }
  const response=await graph(await token(),pathFor(f)+':/content');
  if(response.status===302)return {provider:'onedrive',url:microsoftTransferUrl(response.headers.get('Location')),size_bytes:Number(f.size_bytes),sha256:f.sha256};
  if(response.status===404){
   const result=await admin.storage.from('business-documents').createSignedUrl(path,300);
   if(!result.error&&result.data?.signedUrl)return {provider:'supabase',url:result.data.signedUrl,size_bytes:Number(f.size_bytes),sha256:f.sha256};
  }
  throw new Error('No se pudo localizar un adjunto verificado de la copia.');
 }
 async function reconcilePending(){
  const rows=check(await admin.from('ops_chat_files').select('*').eq('status','uploading').is('deleted_at',null).order('last_checked_at',{ascending:true,nullsFirst:true}).limit(3),'No se pudo comprobar las subidas pendientes.');
  let completed=0;
  for(const f of rows){
   try{await verify(f,{id:f.uploaded_by});completed++;}
   catch{await admin.from('ops_chat_files').update({last_checked_at:new Date().toISOString(),last_error:'La subida no se ha completado o sus permisos han cambiado. Puedes reintentar con el mismo original.'}).eq('id',f.id).eq('status','uploading');}
  }
  return {completed};
 }
 return {handle,resolvePath,reconcilePending};
}
