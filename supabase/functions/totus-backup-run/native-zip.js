import {Zip,ZipPassThrough} from 'npm:fflate@0.8.3';
import {deflateRawSync,inflateRawSync,crc32} from 'node:zlib';
import {createHash} from 'node:crypto';

class NativeStoredFile extends ZipPassThrough{
 push(bytes,final){
  if(!final)throw new Error('La copia necesita el archivo original completo.');
  this.crc=crc32(bytes);this.size=bytes.length;this.process(bytes,true);
 }
}
class NativeDeflateFile extends NativeStoredFile{
 constructor(name){super(name);this.compression=8}
 process(bytes,final){
  if(!final)throw new Error('La copia necesita el archivo original completo.');
  this.ondata(null,deflateRawSync(bytes,{level:1}),true);
 }
}

// The hosted worker has a small JavaScript CPU budget. Keep the same ordinary
// ZIP format, but delegate DEFLATE to the runtime's native zlib at low CPU cost.
async function nativeArchiveHash(value){
 const bytes=typeof value==='string'?new TextEncoder().encode(value):value instanceof Blob?new Uint8Array(await value.arrayBuffer()):value;
 // Offload bounded pieces to asynchronous WebCrypto; keep the full archive hash
 // native so its verification does not allocate another complete archive.
 if(bytes.byteLength<=8*1024*1024)return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
 return createHash('sha256').update(bytes).digest('hex');
}

export class NativeBackupZip{
 static archiveHash=nativeArchiveHash;
 constructor(){this.entries=new Map()}
 file(name,content){
  if(this.entries.has(name))throw new Error('Entrada duplicada en copia: '+name);
  this.entries.set(name,typeof content==='string'?new TextEncoder().encode(content):content instanceof Uint8Array?content:new Uint8Array(content));
  return this;
 }
 async generateAsync({compression}){
  const chunks=[];let total=0,complete=false;
  const writer=new Zip((error,bytes,final)=>{
   if(error)throw error;
   chunks.push(bytes);total+=bytes.length;complete=final;
  });
  for(const [name,bytes]of this.entries){
   // Preserve originals in STORE. PDFs and images are already compressed;
   // recompressing hundreds of small originals can exceed the hosted CPU budget.
   // Compress only the database and manifest.
   const compress=compression==='DEFLATE'&&(name==='database.json'||name==='manifest.json');
   const file=compress?new NativeDeflateFile(name):new NativeStoredFile(name);
   file.mtime=new Date('1980-01-01T00:00:00Z');writer.add(file);file.push(bytes,true);
   this.entries.delete(name);
  }
  writer.end();
  if(!complete)throw new Error('La copia ZIP no terminó correctamente.');
  if(this.segmented){
   const hash=createHash('sha256');for(const chunk of chunks)hash.update(chunk);
   return {segments:chunks,byteLength:total,sha256:hash.digest('hex')};
  }
  const output=new Uint8Array(total);let offset=0;
  for(const chunk of chunks){output.set(chunk,offset);offset+=chunk.length}
  return output;
 }
 static async loadAsync(input){
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(bytes.length<22)throw new Error('ZIP incompleto.');
  let end=-1;
  for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--)if(view.getUint32(p,true)===0x06054b50&&p+22+view.getUint16(p+20,true)===bytes.length){end=p;break}
  if(end<0||view.getUint16(end+4,true)!==0||view.getUint16(end+6,true)!==0||view.getUint16(end+8,true)!==view.getUint16(end+10,true))throw new Error('ZIP dividido o inválido.');
  const count=view.getUint16(end+10,true),start=view.getUint32(end+16,true),length=view.getUint32(end+12,true);
  if(count===65535||start+length!==end)throw new Error('Directorio ZIP no válido.');
  const files=Object.create(null);let p=start;
  for(let i=0;i<count;i++){
   if(p+46>end||view.getUint32(p,true)!==0x02014b50)throw new Error('Entrada ZIP no válida.');
   const flags=view.getUint16(p+8,true),method=view.getUint16(p+10,true),compressed=view.getUint32(p+20,true),size=view.getUint32(p+24,true);
   const nameSize=view.getUint16(p+28,true),extra=view.getUint16(p+30,true),comment=view.getUint16(p+32,true),local=view.getUint32(p+42,true),next=p+46+nameSize+extra+comment;
   if(next>end||flags&1||![0,8].includes(method)||compressed===0xffffffff||size===0xffffffff||local+30>start||view.getUint32(local,true)!==0x04034b50)throw new Error('ZIP cifrado o no compatible.');
   const name=new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(p+46,p+46+nameSize));
   const from=local+30+view.getUint16(local+26,true)+view.getUint16(local+28,true);
   if(!name||files[name]||from+compressed>start||view.getUint16(local+8,true)!==method)throw new Error('Archivo ZIP duplicado o fuera de límites.');
   const payload=bytes.subarray(from,from+compressed);
   files[name]={name,dir:name.endsWith('/'),_data:{uncompressedSize:size},async:async type=>{
    const value=method===0?payload:inflateRawSync(payload,{maxOutputLength:Math.max(1,size)});
    if(value.length!==size)throw new Error('Tamaño de archivo ZIP incorrecto.');
    if(type==='string')return new TextDecoder().decode(value);
    if(type==='uint8array')return value;
    throw new Error('Tipo ZIP no compatible.');
   }};
   p=next;
  }
  if(p!==end)throw new Error('Directorio ZIP incompleto.');
  return {files,file:name=>files[name]||null};
 }
}
export class SegmentedBackupZip extends NativeBackupZip{
 constructor(){
  super();this.segmented=true;this.chunks=[];this.total=0;this.complete=false;this.names=new Set();
  this.writer=new Zip((error,bytes,final)=>{
   if(error)throw error;
   this.chunks.push(bytes);this.total+=bytes.length;this.complete=final;
  });
 }
 file(name,content){
  if(this.names.has(name))throw new Error('Entrada duplicada en copia: '+name);
  if(this.complete)throw new Error('La copia ya está cerrada.');
  this.names.add(name);
  const bytes=typeof content==='string'?new TextEncoder().encode(content):content instanceof Uint8Array?content:new Uint8Array(content);
  // Package each original as it arrives instead of retaining a second complete
  // uncompressed inventory alongside the finished archive in the hosted worker.
  const compress=name==='database.json'||name==='manifest.json';
  const file=compress?new NativeDeflateFile(name):new NativeStoredFile(name);
  file.mtime=new Date('1980-01-01T00:00:00Z');this.writer.add(file);file.push(bytes,true);
  return this;
 }
 async generateAsync(){
  this.writer.end();
  if(!this.complete)throw new Error('La copia ZIP no terminó correctamente.');
  const hash=createHash('sha256');for(const chunk of this.chunks)hash.update(chunk);
  return {segments:this.chunks,byteLength:this.total,sha256:hash.digest('hex')};
 }
}

/** Write an ordinary ZIP directly to verified fixed-size cloud pieces.
 * Only one original and one part are retained; publishing the index is last. */
export function cloudBackupZip({path,write,read,partBytes=8*1024*1024,maxBytes=120*1024*1024}){
 return class CloudBackupZip{
  static concurrency=1;
  static archiveHash=nativeArchiveHash;
  constructor(){
   this.names=new Set();this.pending=[];this.pendingBytes=0;this.total=0;this.parts=[];this.digest=createHash('sha256');this.complete=false;this.failed=null;
   this.writer=new Zip((error,bytes,final)=>{
    if(error){this.failed=error;return;}
    this.total+=bytes.length;
    if(this.total>maxBytes){this.failed=new Error('La copia supera la capacidad de recuperación.');return;}
    this.digest.update(bytes);this.pending.push(bytes);this.pendingBytes+=bytes.length;this.complete=final;
   });
  }
  async saveVerified(path,bytes,sha256){
   const proof=await write(path,bytes);
   if(proof?.verified===true){
    if(proof.path!==path||proof.size!==bytes.length||proof.sha256!==sha256)throw new Error('La confirmación remota no coincide con la copia.');
    return;
   }
   const received=await read(path),actual=received instanceof Blob?new Uint8Array(await received.arrayBuffer()):new Uint8Array(received);
   if(actual.length!==bytes.length||await nativeArchiveHash(actual)!==sha256)throw new Error('El archivo guardado no coincide con la copia.');
  }
  async flush(final=false){
   if(this.failed)throw this.failed;
   while(this.pendingBytes>=partBytes||final&&this.pendingBytes){
    const size=Math.min(partBytes,this.pendingBytes),piece=new Uint8Array(size);let offset=0;
    while(offset<size){
     const chunk=this.pending[0],take=Math.min(chunk.length,size-offset);piece.set(chunk.subarray(0,take),offset);offset+=take;
     if(take===chunk.length)this.pending.shift();else this.pending[0]=chunk.subarray(take);
    }
    this.pendingBytes-=size;
    const piecePath=path+'.part-'+String(this.parts.length).padStart(4,'0'),sha256=await nativeArchiveHash(piece);
    await this.saveVerified(piecePath,piece,sha256);
    this.parts.push({path:piecePath,size,sha256});
   }
  }
  async file(name,content){
   if(this.names.has(name)||this.complete)throw new Error('Entrada duplicada o copia cerrada.');
   this.names.add(name);
   const bytes=typeof content==='string'?new TextEncoder().encode(content):content instanceof Uint8Array?content:new Uint8Array(content);
   const file=name==='database.json'||name==='manifest.json'?new NativeDeflateFile(name):new NativeStoredFile(name);
   file.mtime=new Date('1980-01-01T00:00:00Z');this.writer.add(file);file.push(bytes,true);await this.flush();
   return this;
  }
  async generateAsync(){
   this.writer.end();if(this.failed)throw this.failed;
   if(!this.complete)throw new Error('La copia ZIP no terminó correctamente.');
   await this.flush(true);
   const sha256=this.digest.digest('hex');
   // The shared reader also accepts segmented small ZIPs when their size exceeds
   // partBytes; use the standard 8 MiB piece size in production.
   if(this.total<=partBytes){
    const only=this.parts[0],value=await read(only.path);
    const bytes=value instanceof Blob?new Uint8Array(await value.arrayBuffer()):new Uint8Array(value);
    await this.saveVerified(path,bytes,sha256);
   }else{
    const index=new TextEncoder().encode(JSON.stringify({format:'totus-backup-parts',version:1,size:this.total,sha256,parts:this.parts}));
    await this.saveVerified(path,index,await nativeArchiveHash(index));
   }
   return {stored:true,byteLength:this.total,sha256};
  }
 };
}
