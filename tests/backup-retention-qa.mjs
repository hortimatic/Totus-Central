import assert from 'node:assert/strict';
import {oldestBackupCandidates,backupObjectPaths} from '../src/backup-retention.js';
const runs=Array.from({length:13},(_,i)=>({id:String(i),status:'success',started_at:new Date(Date.UTC(2026,0,i+1)).toISOString(),storage_path:'automaticas/'+i+'.totusbackup'}));
assert.deepEqual(oldestBackupCandidates(runs).map(r=>r.id),['2','1','0']);
assert.equal(oldestBackupCandidates(runs.slice(0,10)).length,0);
assert.deepEqual(oldestBackupCandidates(runs,['automaticas/0.totusbackup']).map(r=>r.id),['2','1']);
assert.equal(oldestBackupCandidates([...runs.slice(0,10),{...runs[12],status:'failed'}]).length,0);
assert.deepEqual(backupObjectPaths('automaticas/0.totusbackup',[{name:'0.totusbackup'},{name:'0.totusbackup.part-0000'},{name:'0.totusbackup.part-0001'},{name:'0.totusbackup.part-evil'},{name:'10.totusbackup'}]),['automaticas/0.totusbackup','automaticas/0.totusbackup.part-0000','automaticas/0.totusbackup.part-0001']);
console.log('BACKUP RETENTION QA: newest ten, failures excluded, checkpoints protected, exact parts only');
