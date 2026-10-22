import {archiveHash,validateArchivePath} from './recovery-core.js';
export const SET_FORMAT='totus-backup-set';
export const SET_VERSION=4;
export const SET_COMPONENT_BYTES=32*1024*1024;
export const SET_MAX_COMPONENTS=4096;
export const SET_INDEX_BYTES=2*1024*1024;
const HASH=/^[a-f0-9]{64}$/;
export function componentPath(path,kind,n=0){
 if(!['datos','documentos','codigo'].includes(kind)||!Number.isInteger(n)||n<0||n>=SET_MAX_COMPONENTS)throw new Error('Componente de copia no válido.');
 return path+'.'+kind+'-'+String(n).padStart(4,'0')+'.zip';
}
export function validateBackupSet(path,index){
 validateArchivePath(path);
 if(index?.format!==SET_FORMAT||index.version!==SET_VERSION||!Array.isArray(index.parts)||index.parts.length<2||index.parts.length>SET_MAX_COMPONENTS||!HASH.test(index.sha256||''))throw new Error('Índice del juego de copias no válido.');
 const seen=new Set();let size=0;
 for(const p of index.parts){
  if(!['datos','documentos','codigo'].includes(p.kind)||!Number.isInteger(p.number)||p.path!==componentPath(path,p.kind,p.number)||seen.has(p.path)||!Number.isSafeInteger(p.size)||p.size<1||p.size>SET_COMPONENT_BYTES||!HASH.test(p.sha256||''))throw new Error('Componente de copia fuera de inventario.');
  seen.add(p.path);size+=p.size;
 }
 if(index.parts.filter(p=>p.kind==='datos').length!==1||index.parts.filter(p=>p.kind==='codigo').length!==1||index.size!==size)throw new Error('Faltan datos o código en el juego de copias.');
 return index;
}
export function backupSetProof(index){
 return JSON.stringify({format:index.format,version:index.version,size:index.size,parts:index.parts});
}
export async function signBackupSet(path,parts,hash=archiveHash){
 const index={format:SET_FORMAT,version:SET_VERSION,size:parts.reduce((n,p)=>n+p.size,0),parts};
 index.sha256=await hash(backupSetProof(index));validateBackupSet(path,index);
 if(new TextEncoder().encode(JSON.stringify(index)).length>SET_INDEX_BYTES)throw new Error('Inventario de copia demasiado grande.');
 return index;
}
export async function openBackupSet(path,index,read,hash=archiveHash,expectedHash=null){
 validateBackupSet(path,index);
 if(await hash(backupSetProof(index))!==index.sha256||expectedHash&&expectedHash!==index.sha256)throw new Error('El índice de la copia está dañado.');
 return {format:SET_FORMAT,byteLength:index.size,index,async openZip(JSZip){
  const files=Object.create(null);let cached=null,cachedPath='';
  async function volume(p){
   if(cachedPath===p.path)return cached;
   cached=null;cachedPath='';
   const input=await read(p.path),bytes=input instanceof Blob?new Uint8Array(await input.arrayBuffer()):new Uint8Array(input);
   if(bytes.length!==p.size||await hash(bytes)!==p.sha256)throw new Error('Falta un componente correcto: '+p.path.split('/').pop());
   if(p.kind==='codigo')return null;
   const zip=await JSZip.loadAsync(bytes);let expanded=0;
   for(const entry of Object.values(zip.files)){
    if(entry.dir)continue;
    validateArchivePath(entry.name);
    const length=entry._data?.uncompressedSize;
    if(!Number.isSafeInteger(length)||length<0)throw new Error('Componente ZIP sin tamaño válido.');
    expanded+=length;if(expanded>40*1024*1024)throw new Error('Un componente ZIP supera el límite de seguridad.');
    if(p.kind==='datos'&&!['database.json','manifest.json'].includes(entry.name)||p.kind==='documentos'&&!entry.name.startsWith('storage/'))throw new Error('Contenido inesperado en un componente.');
   }
   cached=zip;cachedPath=p.path;return zip;
  }
  for(const p of index.parts){
   const zip=await volume(p);if(!zip)continue;
   for(const entry of Object.values(zip.files)){
    if(entry.dir)continue;
    if(files[entry.name])throw new Error('Archivo duplicado entre componentes.');
    const name=entry.name;
    files[name]={name,dir:false,_data:{uncompressedSize:entry._data?.uncompressedSize},async:async type=>{
     const current=await volume(p);return current.file(name).async(type);
    }};
   }
  }
  cached=null;cachedPath='';
  return {files,file:name=>files[name]||null,componentSet:true};
 }};
}
export async function readSelectedBackupSet(selected,JSZip){
 const items=Array.from(selected||[]);
 const roots=items.filter(f=>f.name.endsWith('.totusbackup'));
 if(roots.length!==1)throw new Error('Selecciona un único índice .totusbackup y todos sus ZIP del mismo juego.');
 const root=roots[0];if(root.size>SET_INDEX_BYTES)throw new Error('Índice demasiado grande.');
 const index=JSON.parse(await root.text()),rootName=root.name;
 const paths=new Set(index.parts?.map(p=>p.path)||[]),base=[...paths][0]?.split('/').slice(0,-1).join('/')||'automaticas';
 const path=base+'/'+rootName,byName=new Map();
 for(const file of items){if(byName.has(file.name))throw new Error('Hay nombres de archivo duplicados.');byName.set(file.name,file);}
 if(items.length!==index.parts?.length+1)throw new Error('Selecciona todos los componentes del juego y ningún archivo adicional.');
 const archive=await openBackupSet(path,index,async p=>{const f=byName.get(p.split('/').pop());if(!f)throw new Error('Falta '+p.split('/').pop());return f;});
 return {archive,index,root,path,files:items};
}

export async function uploadSelectedBackupSet(target,selected,write,hash=archiveHash){
 const {index,files}=selected,byName=new Map(files.map(f=>[f.name,f])),parts=[];
 for(const part of index.parts){
  const file=byName.get(part.path.split('/').pop());if(!file||file.size!==part.size||await hash(file)!==part.sha256)throw new Error('Componente local incompleto o dañado.');
  const path=componentPath(target,part.kind,part.number);await write(path,new Uint8Array(await file.arrayBuffer()));
  parts.push({...part,path});
 }
 const remapped=await signBackupSet(target,parts,hash);
 await write(target,new TextEncoder().encode(JSON.stringify(remapped)));
 return remapped;
}
