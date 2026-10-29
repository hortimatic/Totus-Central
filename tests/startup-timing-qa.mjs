import assert from 'node:assert/strict';
import {beginStartupTiming,timedStartup,finishStartupTiming,clearStartupTiming,startupTimingReport} from '../src/startup-timing.js';

assert.equal(startupTimingReport(),'','No measurement without a completed boot');
beginStartupTiming('sesion_recuperada');
await timedStartup('sesion',async()=>({user_email:'private@example.invalid',secret:'do-not-export'}));
await timedStartup('core:ops_expenses',async()=>[{value:'12345',notes:'private bookkeeping'}]);
await timedStartup('core:ops_documents',async()=>{throw new Error('secret error with token');}).catch(()=>{});
await timedStartup('some-user-private-value',async()=>true);
finishStartupTiming();
const output=startupTimingReport();
for(const phase of ['Tipo: sesion_recuperada','sesion:','core:ops_expenses:','core:ops_documents:','arranque_completo:'])
 assert(output.includes(phase),'Expected phase missing: '+phase);
assert.match(output,/core:ops_documents: [0-9.]+ ms \[error\]/);
for(const secret of ['private@example.invalid','do-not-export','private bookkeeping','secret error with token','some-user-private-value'])
 assert(!output.includes(secret),'Sensitive content or arbitrary label leaked: '+secret);
assert(!/https?:\/\//.test(output),'Report must not include any URL');
beginStartupTiming('login_manual');await timedStartup('login_manual',async()=>true);finishStartupTiming();
assert.match(startupTimingReport(),/Tipo: login_manual/);
assert(!startupTimingReport().includes('core:ops_expenses'),'A new run must not include the preceding run');
clearStartupTiming();
assert.equal(startupTimingReport(),'','Logout must erase timings');

// A pending request from the previous account must never enter another run.
let releaseOld;
const oldGate=new Promise(resolve=>{releaseOld=resolve;});
const oldRun=beginStartupTiming('sesion_recuperada');
const oldRequest=timedStartup('core:ops_expenses',()=>oldGate);
clearStartupTiming(); // signed out / account changed
const currentRun=beginStartupTiming('sesion_recuperada');
await timedStartup('sesion',async()=>({ok:true}));
releaseOld({privateNote:'old account data'});
await oldRequest;
finishStartupTiming('ok',oldRun); // stale boot may also complete late
assert.equal(startupTimingReport(),'','The old boot cannot finalize the current run');
finishStartupTiming('ok',currentRun);
const isolated=startupTimingReport();
assert(isolated.includes('sesion:'),'Current request must remain visible');
assert(!isolated.includes('core:ops_expenses:'),'Stale request from prior session must not contaminate new timings');
assert(!isolated.includes('old account data'));

// Also isolate overlapping starts without sign-out, and a late rejected core read.
let failOld;
const oldFailure=new Promise((_,reject)=>{failOld=reject;});
beginStartupTiming('sesion_recuperada');
const pendingCore=timedStartup('carga_principal',()=>oldFailure);
const newerRun=beginStartupTiming('sesion_recuperada');
failOld(new Error('secret from prior run'));
await assert.rejects(pendingCore,/secret from prior run/);
finishStartupTiming('ok',newerRun);
assert(!startupTimingReport().includes('carga_principal:'),'Old rejection must not leak into new run');
assert.match(startupTimingReport(),/arranque_completo: [0-9.]+ ms$/m,'Old rejection must not mark a newer run failed');

// A caught main-load error must be reflected in the complete startup status.
const failedRun=beginStartupTiming('sesion_recuperada');
await assert.rejects(timedStartup('carga_principal',async()=>{throw new Error('private core error');}),/private core error/);
finishStartupTiming('ok',failedRun); // refresh catches the loadCore error
const failedReport=startupTimingReport();
assert.match(failedReport,/carga_principal: [0-9.]+ ms \[error\]/);
assert.match(failedReport,/arranque_completo: [0-9.]+ ms \[error\]/);
assert(!failedReport.includes('private core error'));

// Optional Storage failure remains visible but must NOT fail the main boot.
const optionalRun=beginStartupTiming('sesion_recuperada');
await timedStartup('carga_principal',async()=>true);
await timedStartup('almacenamiento',async()=>({status:'error',message:'private storage error'}));
finishStartupTiming('ok',optionalRun);
const optionalReport=startupTimingReport();
assert.match(optionalReport,/almacenamiento: [0-9.]+ ms \[error\]/);
assert.match(optionalReport,/arranque_completo: [0-9.]+ ms$/m);
assert(!optionalReport.includes('private storage error'));
clearStartupTiming();
console.log('STARTUP TIMING QA: sanitized phases, duration, errors, account isolation and memory reset');
