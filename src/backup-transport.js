import {archiveHash,MAX_ARCHIVE_BYTES} from './recovery-core.js';

// Storage's per-object limit remains unchanged. A large ordinary ZIP is stored
// as immutable, hashed pieces; publish its index only after verifying every piece.
export const BACKUP_PART_BYTES=24*1024*1024;
const INDEX_LIMIT=16384;
const hashPattern=/^[a-f0-9]{64}$/;
export async function writeBackupObject(path,input,write,read){
 const bytes=input instanceof Blob?new Uint8Array(await input.arrayBuffer()):new Uint8Array(input);
 if(bytes.length>MAX_ARCHIVE_BYTES)throw new Error('La copia supera la capacidad de recuperación.');
 if(bytes.length<=BACKUP_PART_BYTES){
  await write(path,bytes);
  if(await archiveHash(await read(path))!==await archiveHash(bytes))throw new Error('La copia subida no coincide con el original.');
  return;
 }
 const index={format:'totus-backup-parts',version:1,size:bytes.length,sha256:await archiveHash(bytes),parts:[]};
 for(let offset=0,n=0;offset<bytes.length;offset+=BACKUP_PART_BYTES,n++){
  const piece=bytes.subarray(offset,offset+BACKUP_PART_BYTES),piecePath=path+'.part-'+String(n).padStart(4,'0');
  const sha256=await archiveHash(piece);
  await write(piecePath,piece);
  if(await archiveHash(await read(piecePath))!==sha256)throw new Error('Un fragmento de la copia no se ha guardado correctamente.');
  index.parts.push({path:piecePath,size:piece.length,sha256});
 }
 await write(path,new TextEncoder().encode(JSON.stringify(index)));
 const actual=await readBackupObject(path,read);
 if(await archiveHash(actual)!==index.sha256)throw new Error('No se ha podido verificar la copia completa.');
}
export async function readBackupObject(path,read){
 const input=await read(path),bytes=input instanceof Blob?new Uint8Array(await input.arrayBuffer()):new Uint8Array(input);
 if(bytes.length>MAX_ARCHIVE_BYTES)throw new Error('La copia supera la capacidad de recuperación.');
 if(bytes[0]!==123)return bytes;
 if(bytes.length>INDEX_LIMIT)throw new Error('Índice de copia demasiado grande.');
 const index=JSON.parse(new TextDecoder().decode(bytes));
 if(index.format!=='totus-backup-parts'||index.version!==1||!Number.isSafeInteger(index.size)||index.size<=BACKUP_PART_BYTES||index.size>MAX_ARCHIVE_BYTES
  ||!hashPattern.test(index.sha256||'')||!Array.isArray(index.parts)||index.parts.length!==Math.ceil(index.size/BACKUP_PART_BYTES))throw new Error('Índice de copia no válido.');
 let total=0;
 for(let n=0;n<index.parts.length;n++){
  const p=index.parts[n],size=Math.min(BACKUP_PART_BYTES,index.size-total);
  if(p.path!==path+'.part-'+String(n).padStart(4,'0')||p.size!==size||!hashPattern.test(p.sha256||''))throw new Error('Fragmentos de copia no válidos.');
  total+=size;
 }
 const output=new Uint8Array(index.size);let offset=0;
 for(const p of index.parts){
  const value=await read(p.path),piece=value instanceof Blob?new Uint8Array(await value.arrayBuffer()):new Uint8Array(value);
  if(piece.length!==p.size||await archiveHash(piece)!==p.sha256)throw new Error('Copia incompleta o fragmento dañado.');
  output.set(piece,offset);offset+=piece.length;
 }
 if(await archiveHash(output)!==index.sha256)throw new Error('Copia completa dañada.');
 return output;
}
