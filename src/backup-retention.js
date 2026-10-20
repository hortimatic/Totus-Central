export const MAX_SAVED_BACKUPS=10;
export const DEFAULT_SAVED_BACKUPS=5;
export function backupRetentionCount(value=DEFAULT_SAVED_BACKUPS){
 const count=Number(value);
 if(!Number.isInteger(count)||count<1||count>MAX_SAVED_BACKUPS)throw new Error('El número de copias debe estar entre 1 y '+MAX_SAVED_BACKUPS+'.');
 return count;
}
export function backupRunState(run,now=Date.now()){
 if(run.status==='success'&&run.storage_path)return 'saved';
 if(run.status==='expired')return 'removed';
 if(run.status==='running')return now-Date.parse(run.started_at)>3*60*1000?'unfinished':'running';
 return 'failed';
}
export function backupFailureSummary(message=''){
 if(/array buffer|memory|allocation/i.test(message))return 'El servidor se quedó sin memoria al preparar la copia.';
 if(/CPUTime|compresi[oó]n/i.test(message))return 'El servidor interrumpió la preparación por su límite de procesamiento.';
 if(/429|connections/i.test(message))return 'Supabase limitó temporalmente la lectura de archivos.';
 if(/plazo|confirmaci[oó]n/i.test(message))return 'La copia no llegó a confirmarse dentro del tiempo disponible.';
 return 'No se completó la copia. Consulta el detalle para conocer el motivo.';
}
export function oldestBackupCandidates(runs,protectedPaths=[],keep=DEFAULT_SAVED_BACKUPS){
 keep=backupRetentionCount(keep);
 const protectedSet=new Set(protectedPaths);
 return runs.filter(r=>r.status==='success'&&r.storage_path)
  .sort((a,b)=>String(b.started_at).localeCompare(String(a.started_at))||String(b.id).localeCompare(String(a.id)))
  .slice(keep).filter(r=>!protectedSet.has(r.storage_path));
}
export function backupObjectPaths(path,objects){
 const slash=path.lastIndexOf('/'),folder=path.slice(0,slash),name=path.slice(slash+1);
 if(slash<1||!name.endsWith('.totusbackup'))throw new Error('Ruta de copia inválida.');
 return objects.filter(o=>o.name===name||o.name.startsWith(name+'.part-')&&/^\d{4}$/.test(o.name.slice((name+'.part-').length))).map(o=>folder+'/'+o.name);
}

export function obsoleteBackupCandidates(runs,protectedPaths=[]){
 const saved=runs.filter(r=>r.status==='success'&&r.storage_path);
 const verified=saved.filter(r=>r.storage_provider==='onedrive'&&r.archive_manifest?.version===3&&/^[a-f0-9]{64}$/.test(r.archive_sha256||''))
  .sort((a,b)=>String(b.started_at).localeCompare(String(a.started_at)));
 if(verified.length<2)return [];
 const protectedSet=new Set(protectedPaths.filter(Boolean)),before=String(verified[1].started_at);
 return saved.filter(r=>{
  const legacy=r.archive_manifest==null&&!r.archive_sha256||Number.isInteger(r.archive_manifest?.version)&&r.archive_manifest.version<3;
  return legacy&&String(r.started_at)<before&&!protectedSet.has(r.storage_path);
 });
}
