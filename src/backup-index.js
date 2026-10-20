export const BACKUP_PART_BYTES=8*1024*1024;
const hashPattern=/^[a-f0-9]{64}$/;
export function validateBackupIndex(path,index,maxArchiveBytes=120*1024*1024){
 if(index.format!=='totus-backup-parts'||index.version!==1||!Number.isSafeInteger(index.size)||index.size<=BACKUP_PART_BYTES||index.size>maxArchiveBytes
  ||!hashPattern.test(index.sha256||'')||!Array.isArray(index.parts)||index.parts.length!==Math.ceil(index.size/BACKUP_PART_BYTES))throw new Error('Índice de copia no válido.');
 let total=0;
 for(let n=0;n<index.parts.length;n++){
  const p=index.parts[n],size=Math.min(BACKUP_PART_BYTES,index.size-total);
  if(p.path!==path+'.part-'+String(n).padStart(4,'0')||p.size!==size||!hashPattern.test(p.sha256||''))throw new Error('Fragmentos de copia no válidos.');
  total+=size;
 }
 return index;
}
