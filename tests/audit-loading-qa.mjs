import assert from 'node:assert/strict';
const db={ops_audit_log:Array.from({length:1105},(_,i)=>({id:String(i).padStart(5,'0'),created_at:'2026-01-01T10:00:00Z',area:'gastos',action:'actualizar'})),team_user_audit_log:[],ops_chat_events:[{id:'chat',created_at:'2026-01-01T11:00:00Z',action:'send',actor_email:'qa@example.invalid'}],ops_task_events:[],ops_backup_runs:[]};
const calls=[];let fail='';
global.window={supabase:{createClient:()=>({from(table){
 const call={table,columns:'*',since:null,orders:[],range:[0,999]};
 const q={select(columns){call.columns=columns;return q;},gte(key,value){call.since={key,value};return q;},eq(key,value){call.eq={key,value};return q;},order(key,{ascending}){call.orders.push([key,ascending]);return q;},range(a,b){call.range=[a,b];return q;},then(resolve,reject){calls.push(call);if(fail===table)return Promise.resolve({data:null,error:{message:'Fallo de ensayo'}}).then(resolve,reject);let rows=(db[table]||[]).filter(r=>(!call.since||r[call.since.key]>=call.since.value)&&(!call.eq||r[call.eq.key]===call.eq.value));rows=[...rows].sort((a,b)=>{for(const [key,ascending] of call.orders){const n=String(a[key]??'').localeCompare(String(b[key]??''));if(n)return ascending?n:-n;}return 0;});return Promise.resolve({data:rows.slice(call.range[0],call.range[1]+1),error:null}).then(resolve,reject);}};return q;
 }})}};
const {state}=await import('../src/state.js');const {reloadAudit,invalidateAuditReads,sb}=await import('../src/api.js');
state.user={email:'qa@example.invalid',role:'admin'};
await reloadAudit();assert.equal(state.data.audit.length,1106);assert.equal(calls.filter(c=>c.table==='ops_audit_log'&&c.columns==='*').length,2);
db.ops_audit_log.push({id:'new',created_at:'2026-01-02T10:00:00Z',area:'gastos',action:'crear'});
calls.length=0;await reloadAudit();assert.equal(state.data.audit.length,1107);assert(calls.find(c=>c.table==='ops_audit_log').since);
assert(!calls.find(c=>c.table==='ops_backup_runs').columns.includes('archive_manifest'),'Polling must not download large backup manifests');
await reloadAudit();assert.equal(state.data.audit.length,1107,'Repeated inclusive reads do not duplicate events');
db.ops_chat_events=[];await reloadAudit();assert(!state.data.audit.some(r=>r.id==='chat:chat'),'Channel visibility must be rechecked, not cached');
const previous=state.data.audit;fail='ops_task_events';await assert.rejects(reloadAudit(),/Fallo de ensayo/);assert.equal(state.data.audit,previous,'Failed reads preserve the last complete snapshot');fail='';
calls.length=0;await reloadAudit({full:true});assert.equal(calls.find(c=>c.table==='ops_audit_log').since,null);
state.user={email:'other@example.invalid',role:'gerente'};calls.length=0;await reloadAudit();
assert(!calls.some(c=>c.table==='team_user_audit_log'||c.table==='ops_backup_runs'));assert.equal(calls.find(c=>c.table==='ops_audit_log').since,null,'Account changes reset incremental history');
db.ops_stock_revisions=[{id:'stock-qa',receipt_id:'receipt-qa',revision:2,action:'source_added',actor_email:'qa@example.invalid',created_at:'2026-01-02T12:00:00Z'}];
calls.length=0;await reloadAudit();assert(state.data.audit.some(r=>r.id==='stock:stock-qa'&&r.area==='recepciones'));
assert(!calls.find(c=>c.table==='ops_stock_revisions').columns.includes('snapshot'),'Polling must not fetch complete receipt snapshots');
db.ops_stock_revisions=[];await reloadAudit();assert(!state.data.audit.some(r=>r.id==='stock:stock-qa'),'Changed receipt visibility must not leave cached events');
const from=sb.from.bind(sb);let release,reached;
const gate=new Promise(resolve=>release=resolve),started=new Promise(resolve=>reached=resolve);
sb.from=table=>{const q=from(table);if(table==='ops_stock_revisions'){const then=q.then.bind(q);q.then=(resolve,reject)=>{reached();return gate.then(()=>then(resolve,reject));};}return q;};
const inFlight=reloadAudit();await started;
state.user={email:'new-identity@example.invalid',role:'gerente'};const newHistory=[];state.data.audit=newHistory;
release();await inFlight;assert.equal(state.data.audit,newHistory,'A delayed previous-identity read must not repopulate the audit view');
sb.from=from;
// A logout and a new login for the same identity must also invalidate pending reads.
state.user={email:'qa@example.invalid',role:'admin'};
let letOldProceed,oldReadStarted;
const staleGate=new Promise(resolve=>letOldProceed=resolve),oldStarted=new Promise(resolve=>oldReadStarted=resolve);
sb.from=table=>{
 const q=from(table);
 if(table==='ops_stock_revisions'){
  const then=q.then.bind(q);
  q.then=(resolve,reject)=>{oldReadStarted();return staleGate.then(()=>then(resolve,reject));};
 }
 return q;
};
const oldSameUser=reloadAudit();await oldStarted;
invalidateAuditReads();
const newlyResetHistory=[];state.data.audit=newlyResetHistory;
letOldProceed();await oldSameUser;
assert.equal(state.data.audit,newlyResetHistory,'An invalidated read must not publish into a new session with the same user');
sb.from=from;calls.length=0;await reloadAudit();
assert.equal(calls.find(c=>c.table==='ops_audit_log').since,null,'A new session must not reuse previous incremental history');
console.log('AUDIT LOADING QA: complete history, incremental refresh, no duplicate rows, fresh channel visibility, failure retention and bounded backup metadata');

// A cleanup in another session must remove deleted cached events.
const deletedId=db.ops_audit_log[0].id;db.ops_audit_log.shift();db.ops_audit_log.push({id:"cleanup-marker",created_at:"2026-02-01T00:00:00Z",action:"limpiar_historial",area:"administracion"});
await reloadAudit();assert(!state.data.audit.some(r=>r.id===deletedId),"Cleanup marker invalidates incremental history in other sessions");
