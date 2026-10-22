// One request owns this reader. Private URLs never persist beyond that request.
export function createCloudBackupReader({lookup,prepare,readLocal,fetchFile=fetch}){
 const proofs=new Map(),inventories=new Map();
 const safe=p=>typeof p==='string'&&p.length<=2048&&!/[\\\x00-\x1f]/.test(p)&&p.split('/').every(s=>s&&s!=='.'&&s!=='..');
 return async path=>{
  if(!safe(path))throw new Error('Ruta de copia no válida.');
  const root=path.replace(/(?:\.part-\d{4}|\.(?:datos|documentos|codigo)-\d{4}\.zip)$/,'');
  if(!proofs.has(root))proofs.set(root,Promise.resolve().then(()=>lookup(root)));
  const proof=await proofs.get(root);
  const cloud=async()=>{
   if(!proof?.id)throw new Error('El respaldo solicitado no está disponible.');
   if(!inventories.has(root))inventories.set(root,Promise.resolve().then(async()=>{
    const result=await prepare(proof.id),files=result?.files;
    if(!Array.isArray(files)||!files.length||files.length>4097)throw new Error('Inventario de copia no válido.');
    const links=new Map();
    for(const file of files){
     if(!safe(file.path)||file.path!==root&&!file.path.startsWith(root+'.')||links.has(file.path)||typeof file.url!=='string'||new URL(file.url).protocol!=='https:')throw new Error('Ubicación privada de copia no válida.');
     links.set(file.path,file.url);
    }
    return links;
   }));
   const location=(await inventories.get(root)).get(path);
   if(!location)throw new Error('Archivo fuera del inventario de la copia.');
   const response=await fetchFile(location,{signal:AbortSignal.timeout(60000)});
   if(!response.ok)throw new Error('No se pudo leer un componente de OneDrive.');
   return response.blob();
  };
  if(proof?.storage_provider==='onedrive')return cloud();
  const local=await readLocal(path);
  if(local)return local;
  return cloud();
 };
}
