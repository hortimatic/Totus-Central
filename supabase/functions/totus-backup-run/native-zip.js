import {ZipWriter,Uint8ArrayWriter,Uint8ArrayReader} from 'npm:@zip.js/zip.js@2.24.0';

// The hosted worker has a small JavaScript CPU budget. Keep the same ordinary
// ZIP format, but delegate DEFLATE to the runtime's native CompressionStream.
export class NativeBackupZip{
 constructor(){this.entries=new Map()}
 file(name,content){
  if(this.entries.has(name))throw new Error('Entrada duplicada en copia: '+name);
  this.entries.set(name,typeof content==='string'?new TextEncoder().encode(content):new Uint8Array(content));
  return this;
 }
 async generateAsync({compression}){
  const level=compression==='DEFLATE'?6:0;
  if(level){
   const probe=new CompressionStream('deflate-raw');
   await probe.writable.abort();
  }
  const writer=new ZipWriter(new Uint8ArrayWriter(),{level,useCompressionStream:true,useWebWorkers:false});
  for(const [name,bytes]of this.entries)await writer.add(name,new Uint8ArrayReader(bytes));
  return writer.close();
 }
}
