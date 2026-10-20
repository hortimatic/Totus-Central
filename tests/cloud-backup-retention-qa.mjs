import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
const source=await fs.readFile(new URL('../supabase/functions/totus-onedrive/index.ts',import.meta.url),'utf8');
const start=source.indexOf('async function pruneMirroredBackups('),end=source.indexOf('async function mirrorBackups(',start);
assert.ok(start>=0&&end>start);
let state;
const copies=()=>Array.from({length:6},(_,i)=>({run_id:'r'+i,source_path:'copies/'+i,folder_path:'02 Copias de seguridad/r'+i,verified_at:'2026-10-20',ops_backup_runs:{started_at:String(9-i),status:'success',storage_path:'copies/'+i}}));
const reset=()=>state={copies:copies(),jobs:[],deleted:[],removed:[],fail:false,keep:5};
const admin={
 from(table){
  return {
   select(){return this},not(){return this},
   eq(_key,value){this.id=value;return this},
   delete(){this.deleting=true;return this},
   then(resolve){
    if(this.deleting){state.removed.push(this.id);return Promise.resolve({data:null,error:null}).then(resolve)}
    return Promise.resolve({data:structuredClone(table==='ops_recovery_jobs'?state.jobs:state.copies),error:null}).then(resolve);
   }
  };
 }
};
const check=(r,label)=>{if(r.error)throw Error(label);return r.data};
const graph=async(_access,path,options)=>{assert.equal(options.method,'DELETE');state.deleted.push(path);return new Response(null,{status:state.fail?500:204})};
const encodedPath=p=>p.map(encodeURIComponent).join('/');
const run=new Function('admin','check','graph','encodedPath','savedBackupMaximum',stripTypeScriptTypes(source.slice(start,end))+';return pruneMirroredBackups;')(admin,check,graph,encodedPath,async()=>state.keep);
reset();await run('access');assert.deepEqual(state.removed,['r5']);
reset();state.jobs=[{checkpoint_path:'copies/5'}];await run('access');assert.equal(state.deleted.length,0,'Recovery checkpoints must survive ordinary rotation');
reset();state.copies[1].ops_backup_runs.status='expired';state.copies[1].ops_backup_runs.storage_path=null;await run('access');assert.deepEqual(state.removed,['r1'],'Expired mirrors must be retired even below five ordinary copies');
reset();state.copies[1].ops_backup_runs.status='expired';state.copies[1].ops_backup_runs.storage_path=null;state.jobs=[{source_path:'copies/1'}];await run('access');assert.equal(state.deleted.length,0,'A protected source path must survive after run metadata expires');
reset();state.copies=state.copies.slice(0,1);state.copies[0].ops_backup_runs.status='expired';await run('access');assert.equal(state.deleted.length,0,'Never remove the only verified cloud copy without an active successor');
reset();state.fail=true;await assert.rejects(()=>run('access'));assert.equal(state.removed.length,0,'A provider failure must retain the inventory for retry');
reset();state.copies[5].folder_path='01 Facturas';await assert.rejects(()=>run('access'));assert.equal(state.deleted.length,0,'Rotation must never target document folders');
reset();state.copies[5].ops_backup_runs.status='running';await run('access');assert.equal(state.deleted.length,0,'A running transfer must never be pruned');
reset();state.copies[5].ops_backup_runs.status='failed';state.copies[5].verified_at=null;state.copies[5].created_at=new Date(Date.now()-20*60*1000).toISOString();await run('access');assert.deepEqual(state.removed,['r5'],'Old failed partial folders are removed only with an active verified successor');
reset();state.copies[5].ops_backup_runs.status='failed';state.copies[5].verified_at=null;state.copies[5].created_at=new Date().toISOString();await run('access');assert.equal(state.deleted.length,0,'Fresh failed transfers retain a grace period');
console.log('CLOUD BACKUP RETENTION QA: five newest ordinary copies, protected checkpoints/sources, expired inventory, last copy and provider failures verified');

reset();state.keep=10;await run('access');assert.equal(state.deleted.length,0,'Increasing retention to ten must preserve all six existing copies');
reset();state.keep=10;state.copies=Array.from({length:11},(_,i)=>({run_id:'r'+i,source_path:'copies/'+i,folder_path:'02 Copias de seguridad/r'+i,verified_at:'2026-10-20',ops_backup_runs:{started_at:String(99-i),status:'success',storage_path:'copies/'+i}}));await run('access');assert.deepEqual(state.removed,['r10'],'Only the eleventh ordinary copy rotates at a limit of ten');
