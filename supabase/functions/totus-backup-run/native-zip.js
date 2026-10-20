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
export class NativeBackupZip{
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
   writer.add(file);file.push(bytes,true);
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
  this.writer.add(file);file.push(bytes,true);
  return this;
 }
 async generateAsync(){
  this.writer.end();
  if(!this.complete)throw new Error('La copia ZIP no terminó correctamente.');
  const hash=createHash('sha256');for(const chunk of this.chunks)hash.update(chunk);
  return {segments:this.chunks,byteLength:this.total,sha256:hash.digest('hex')};
 }
}
