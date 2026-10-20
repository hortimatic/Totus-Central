import {MAX_SAVED_BACKUPS} from './backup-retention.js';
const DAY_MONTH=30.4375;
const nonnegative=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
export function planStorage({usage,reference,runs=[],protectedPaths=[],keep=MAX_SAVED_BACKUPS,archiveLimit=120*1048576,horizonDays=3650,activeOriginalBytes}={}){
 const months=Number(reference?.planning_sample_months),sample=Number(reference?.planning_sample_files_bytes),sampleCopy=Number(reference?.planning_sample_full_backup_bytes),limit=Number(reference?.files_limit_bytes);
 const originals=Number(usage?.documents_bytes)+Number(usage?.assets_bytes),all=Number(usage?.all_buckets_bytes);
 if(usage?.status!=='ok'||reference?.plan!=='Free'||!reference?.checked_at||![originals,all].every(nonnegative)||all<originals||![months,sample,sampleCopy,limit].every(v=>Number.isFinite(v)&&v>0)||!Number.isInteger(keep)||keep<1||keep>10)return {available:false};
 const active=activeOriginalBytes===undefined?originals:Number(activeOriginalBytes);
 if(!nonnegative(active))return {available:false};
 const saved=runs.filter(r=>r.status==='success'&&r.storage_path&&nonnegative(Number(r.size_bytes))&&Number(r.size_bytes)>0).slice().sort((a,b)=>String(b.started_at).localeCompare(String(a.started_at))||String(b.id).localeCompare(String(a.id)));
 const savedBytes=saved.reduce((n,r)=>n+Number(r.size_bytes),0);
 if(savedBytes>all-originals)return {available:false};
 const pinned=new Set(protectedPaths.filter(Boolean));
 const older=saved.slice(1).filter(r=>!pinned.has(r.storage_path));
 const daily=sample/months/DAY_MONTH,ratio=sampleCopy/sample;
 const fixed=all-originals-savedBytes;
 const queue=saved.filter((r,i)=>i<keep||pinned.has(r.storage_path)).reverse().map(r=>({size:Number(r.size_bytes),pinned:pinned.has(r.storage_path)}));
 const initial=originals+fixed+queue.reduce((n,r)=>n+r.size,0);
 const result={available:true,months,monthlyOriginalBytes:sample/months,currentOriginalBytes:originals,currentFilesBytes:all,activeOriginalBytes:active,currentCopyBytes:active*ratio,fullCopiesBytes:active*ratio*keep,retainedBytes:queue.reduce((n,r)=>n+r.size,0),otherBackupBytes:fixed,downloadableOlderCount:older.length,downloadableOlderBytes:older.reduce((n,r)=>n+Number(r.size_bytes),0),initialBytes:initial,freedByPolicyBytes:all-initial,limit,keep,days:null,reason:null};
 for(let day=1;day<=horizonDays;day++){
  const data=originals+daily*day,copy=(active+daily*day)*ratio,peak=data+fixed+queue.reduce((n,r)=>n+r.size,0)+copy;
  if(peak>limit||copy>archiveLimit){return {...result,days:day,reason:peak>limit?'space':'archive',peakBytes:peak,copyAtLimitBytes:copy};}
  queue.push({size:copy,pinned:false});
  while(queue.length>keep){const i=queue.findIndex((r,index)=>!r.pinned&&index<queue.length-1);if(i<0)break;queue.splice(i,1);}
 }
 return result;
}
