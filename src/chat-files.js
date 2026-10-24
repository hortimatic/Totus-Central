export const CHAT_FILE_LIMIT=20*1024*1024;
export const CHAT_FILE_MIMES={
 pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',
 xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 xls:'application/vnd.ms-excel',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 zip:'application/zip',txt:'text/plain',md:'text/plain',csv:'text/csv'
};
export function chatFileMetadata(file){
 const name=String(file?.name||''),size=Number(file?.size),extension=name.split('.').pop().toLowerCase(),mime=CHAT_FILE_MIMES[extension];
 if(!name||name.length>240||/[\x00-\x1f]/.test(name)||!mime||!Number.isSafeInteger(size)||size<1||size>CHAT_FILE_LIMIT)
  throw new Error('Archivo no válido. Admite PDF, imágenes, Excel, Word, ZIP y texto, hasta 20 MB por archivo.');
 return {name,size,mime_type:mime};
}
export function microsoftTransferUrl(value){
 let url;try{url=new URL(value);}catch{throw new Error('La dirección de subida de Microsoft no es válida.');}
 const host=url.hostname.toLowerCase();
 if(url.protocol!=='https:'||url.username||url.password||!['onedrive.com','1drv.com','sharepoint.com','microsoftpersonalcontent.com','storage.live.com'].some(d=>host===d||host.endsWith('.'+d)))
  throw new Error('La dirección no pertenece al almacenamiento de Microsoft.');
 return url.href;
}
export async function chatFileHash(file){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export function checkChatFileSignature(file,bytes){
 const ext=file.original_name?.split('.').pop().toLowerCase()||file.name?.split('.').pop().toLowerCase();
 const starts=values=>values.every((v,i)=>bytes[i]===v);
 const str=(a,b)=>new TextDecoder().decode(bytes.slice(a,b));
 const zip=['zip','docx','xlsx'].includes(ext),text=['txt','md','csv'].includes(ext);
 if(ext==='pdf'&&str(0,5)!=='%PDF-'||ext==='png'&&!starts([137,80,78,71,13,10,26,10])||
  ['jpg','jpeg'].includes(ext)&&!starts([255,216,255])||ext==='webp'&&(str(0,4)!=='RIFF'||str(8,12)!=='WEBP')||
  zip&&!starts([80,75])||ext==='xls'&&!(starts([208,207,17,224])||starts([80,75])))
  throw new Error('El contenido del archivo no coincide con su formato. No se ha asociado otro documento.');
 if(text){try{new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new Error('El texto debe estar codificado en UTF-8.');}}
}
export async function uploadChatFile(file,{messageId,clientId,request,fetchFile=fetch,onProgress=()=>{}}){
 const metadata=chatFileMetadata(file),sha256=await chatFileHash(file);
 const prepared=await request('chat-file-prepare',{message_id:messageId,client_id:clientId,name:metadata.name,size:metadata.size,sha256});
 if(prepared.complete)return prepared.file;
 const target=microsoftTransferUrl(prepared.upload_url),chunk=327680*10;
 let offset=0,retries=0;
 while(offset<file.size){
  const end=Math.min(offset+chunk,file.size);
  try{
   // This pre-authorized URL is scoped to one file. Never send Supabase headers.
   const response=await fetchFile(target,{method:'PUT',headers:{'Content-Range':'bytes '+offset+'-'+(end-1)+'/'+file.size},body:file.slice(offset,end),redirect:'error',signal:AbortSignal.timeout(60000)});
   if(![200,201,202].includes(response.status)){
    if(response.status===416)throw new Error('Consultar posición de subida');
    throw new Error('Microsoft no pudo guardar el fragmento (HTTP '+response.status+').');
   }
   const body=await response.json();
   offset=response.status===202?Number(body.nextExpectedRanges?.[0]?.split('-')[0]):file.size;
   if(!Number.isSafeInteger(offset)||offset<end||offset>file.size)throw new Error('Microsoft devolvió una posición de subida no válida.');
   retries=0;onProgress(Math.round(offset/file.size*100));
  }catch(error){
   if(++retries>2)throw error;
   const status=await fetchFile(target,{method:'GET',redirect:'error',signal:AbortSignal.timeout(20000)});
   if(status.status===404||status.status===410)break; // The last write may have committed; verify by ID/path.
   if(!status.ok)throw error;
   const body=await status.json(),next=Number(body.nextExpectedRanges?.[0]?.split('-')[0]);
   if(!Number.isSafeInteger(next)||next<offset||next>file.size)throw error;
   offset=next;
  }
 }
 return (await request('chat-file-complete',{file_id:prepared.file.id})).file;
}
