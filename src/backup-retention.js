export const MAX_SAVED_BACKUPS=10;
export function oldestBackupCandidates(runs,protectedPaths=[]){
 const protectedSet=new Set(protectedPaths);
 return runs.filter(r=>r.status==='success'&&r.storage_path)
  .sort((a,b)=>String(b.started_at).localeCompare(String(a.started_at))||String(b.id).localeCompare(String(a.id)))
  .slice(MAX_SAVED_BACKUPS).filter(r=>!protectedSet.has(r.storage_path));
}
export function backupObjectPaths(path,objects){
 const slash=path.lastIndexOf('/'),folder=path.slice(0,slash),name=path.slice(slash+1);
 if(slash<1||!name.endsWith('.totusbackup'))throw new Error('Ruta de copia inválida.');
 return objects.filter(o=>o.name===name||o.name.startsWith(name+'.part-')&&/^\d{4}$/.test(o.name.slice((name+'.part-').length))).map(o=>folder+'/'+o.name);
}
