import {Zip,ZipPassThrough} from 'npm:fflate@0.8.3';
import {deflateRawSync} from 'node:zlib';

class NativeDeflateFile extends ZipPassThrough{
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
   const file=compression==='DEFLATE'?new NativeDeflateFile(name):new ZipPassThrough(name);
   writer.add(file);file.push(bytes,true);
  }
  writer.end();
  if(!complete)throw new Error('La copia ZIP no terminó correctamente.');
  const output=new Uint8Array(total);let offset=0;
  for(const chunk of chunks){output.set(chunk,offset);offset+=chunk.length}
  return output;
 }
}
