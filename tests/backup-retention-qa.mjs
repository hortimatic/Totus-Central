import assert from 'node:assert/strict';
import {MAX_SAVED_BACKUPS,DEFAULT_SAVED_BACKUPS,backupRetentionCount,obsoleteBackupCandidates,oldestBackupCandidates,backupObjectPaths,backupRunState,backupFailureSummary} from '../src/backup-retention.js';
const runs=Array.from({length:13},(_,i)=>({id:String(i),status:'success',started_at:new Date(Date.UTC(2026,0,i+1)).toISOString(),storage_path:'automaticas/'+i+'.totusbackup'}));
assert.deepEqual(oldestBackupCandidates(runs).map(r=>r.id),['7','6','5','4','3','2','1','0']);
assert.equal(oldestBackupCandidates(runs.slice(0,5)).length,0);
assert.deepEqual(oldestBackupCandidates(runs,['automaticas/0.totusbackup']).map(r=>r.id),['7','6','5','4','3','2','1']);
assert.equal(oldestBackupCandidates([...runs.slice(0,5),{...runs[12],status:'failed'}]).length,0);
assert.equal(backupRunState({status:'running',started_at:'2026-01-01T00:00:00Z'},Date.parse('2026-01-02T00:00:00Z')),'unfinished');
assert.equal(backupRunState({status:'success',storage_path:null}),'failed');
assert(backupFailureSummary('Array buffer allocation failed').includes('memoria'));
assert.deepEqual(backupObjectPaths('automaticas/0.totusbackup',[{name:'0.totusbackup'},{name:'0.totusbackup.part-0000'},{name:'0.totusbackup.part-0001'},{name:'0.totusbackup.part-evil'},{name:'10.totusbackup'}]),['automaticas/0.totusbackup','automaticas/0.totusbackup.part-0000','automaticas/0.totusbackup.part-0001']);
console.log('BACKUP RETENTION QA: newest five, failures excluded, checkpoints protected, exact parts only');

const cloud=[0,1].map(i=>({id:'cloud'+i,status:'success',storage_path:'cloud/'+i,started_at:'2026-10-20T0'+(9-i)+':00:00Z',storage_provider:'onedrive',archive_manifest:{version:3},archive_sha256:'a'.repeat(64)}));
const old={id:'legacy',status:'success',storage_path:'old/legacy',started_at:'2026-10-19T10:00:00Z',archive_manifest:null,archive_sha256:null};
assert.equal(obsoleteBackupCandidates([old,...cloud]).length,1);
assert.equal(obsoleteBackupCandidates([old,cloud[0]]).length,0,'Two verified cloud successors are mandatory');
assert.equal(obsoleteBackupCandidates([old,...cloud],['old/legacy']).length,0,'A recovery checkpoint cannot be retired as obsolete');
assert.equal(obsoleteBackupCandidates([{...old,archive_manifest:{version:4}},...cloud]).length,0,'Future formats must not be mistaken for legacy copies');
assert.equal(obsoleteBackupCandidates([{...old,started_at:'2026-10-21T10:00:00Z'},...cloud]).length,0,'A newer unknown backup is not obsolete');
console.log('LEGACY BACKUP RETENTION QA: two verified successors, protected paths and future formats enforced');

assert.equal(backupRunState({status:'running',started_at:new Date(Date.now()-4*60*1000).toISOString()}),'unfinished','The UI must reflect the hosted three-minute interruption boundary');

assert.equal(MAX_SAVED_BACKUPS,10);assert.equal(DEFAULT_SAVED_BACKUPS,5);
assert.equal(backupRetentionCount(10),10);
const bundleNames=['0.totusbackup','0.totusbackup.datos-0000.zip','0.totusbackup.documentos-0001.zip','0.totusbackup.codigo-0000.zip'];
assert.deepEqual(backupObjectPaths('automaticas/0.totusbackup',[
 ...bundleNames.map(name=>({name})),
 ...['0.totusbackup.documentos-0001.zip.other','0.totusbackup.documentos-00001.zip','0.totusbackup.documentos-evil.zip','10.totusbackup.datos-0000.zip','0.totusbackup.otra-0000.zip'].map(name=>({name}))
]),bundleNames.map(name=>'automaticas/'+name),'Partitioned backups must retire every exact component without touching other files');
for(const bad of [0,11,5.5,'wrong',null])assert.throws(()=>backupRetentionCount(bad));
assert.deepEqual(oldestBackupCandidates(runs,[],10).map(r=>r.id),['2','1','0']);
assert.equal(oldestBackupCandidates(runs.slice(0,10),[],10).length,0);
assert.deepEqual(oldestBackupCandidates(runs,['automaticas/1.totusbackup'],10).map(r=>r.id),['2','0']);
console.log('CONFIGURABLE RETENTION QA: five default, ten maximum, explicit retention, protected copies and invalid settings verified');
