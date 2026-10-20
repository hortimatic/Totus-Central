import {archiveHash,MAX_ARCHIVE_BYTES} from './recovery-core.js';

// Storage's per-object limit remains unchanged. A large ordinary ZIP is stored
// as immutable, hashed pieces; publish its index only after verifying every piece.
import {BACKUP_PART_BYTES,validateBackupIndex} from './backup-index.js';
export {BACKUP_PART_BYTES,validateBackupIndex} from './backup-index.js';
const INDEX_LIMIT=16384;
const hashPattern=/^[a-f0-9]{64}$/;
export async function writeBackupObject(path,input,write,read){
 const segmented=Array.isArray(input?.segments);
 const bytes=segmented?null:input instanceof Blob?new Uint8Array(await input.arrayBuffer()):new Uint8Array(input);
 const size=segmented?input.byteLength:bytes.length;
 if(!Number.isSafeInteger(size)||size<0||size>MAX_ARCHIVE_BYTES)throw new Error('La copia supera la capacidad de recuperación.');
 const range=(start,end)=>{
  if(!segmented)return bytes.subarray(start,end);
  const output=new Uint8Array(end-start);let pos=0;
  for(const part of input.segments){
   if(pos<end&&pos+part.length>start){const from=Math.max(start,pos),to=Math.min(end,pos+part.length);output.set(part.subarray(from-pos,to-pos),from-start)}
   pos+=part.length;
  }
  if(pos!==size)throw new Error('Fragmentos de origen incompletos.');return output;
 };
 const digest=segmented?input.sha256:await archiveHash(bytes);
 if(!hashPattern.test(digest||''))throw new Error('Huella de copia inválida.');
 if(size<=BACKUP_PART_BYTES){
  const value=range(0,size);
  await write(path,value);
  if(await archiveHash(await read(path))!==digest)throw new Error('La copia subida no coincide con el original.');
  return;
 }
 const index={format:'totus-backup-parts',version:1,size,sha256:digest,parts:[]};
 for(let offset=0,n=0;offset<size;offset+=BACKUP_PART_BYTES,n++){
  const piece=range(offset,Math.min(size,offset+BACKUP_PART_BYTES)),piecePath=path+'.part-'+String(n).padStart(4,'0');
  const sha256=await archiveHash(piece);
  await write(piecePath,piece);
  if(await archiveHash(await read(piecePath))!==sha256)throw new Error('Un fragmento de la copia no se ha guardado correctamente.');
  index.parts.push({path:piecePath,size:piece.length,sha256});
 }
 const indexBytes=new TextEncoder().encode(JSON.stringify(index));
 await write(path,indexBytes);
 // Every piece has already been read back and checked. Verifying the immutable
 // index completes the proof without allocating a second full archive in RAM.
 if(await archiveHash(await read(path))!==await archiveHash(indexBytes))throw new Error('No se ha podido verificar el índice de la copia completa.');
}
export async function readBackupObject(path,read,hash=archiveHash){
 const input=await read(path),bytes=input instanceof Blob?new Uint8Array(await input.arrayBuffer()):new Uint8Array(input);
 if(bytes.length>MAX_ARCHIVE_BYTES)throw new Error('La copia supera la capacidad de recuperación.');
 if(bytes[0]!==123)return bytes;
 if(bytes.length>INDEX_LIMIT)throw new Error('Índice de copia demasiado grande.');
 const index=JSON.parse(new TextDecoder().decode(bytes));
 validateBackupIndex(path,index,MAX_ARCHIVE_BYTES);
 const output=new Uint8Array(index.size);let offset=0;
 for(const p of index.parts){
  const value=await read(p.path),piece=value instanceof Blob?new Uint8Array(await value.arrayBuffer()):value instanceof Uint8Array?value:new Uint8Array(value);
  if(piece.length!==p.size||await hash(piece)!==p.sha256)throw new Error('Copia incompleta o fragmento dañado.');
  output.set(piece,offset);offset+=piece.length;
 }
 if(await hash(output)!==index.sha256)throw new Error('Copia completa dañada.');
 return output;
}

