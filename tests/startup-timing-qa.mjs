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
console.log('STARTUP TIMING QA: sanitized phases, duration, errors, account isolation and memory reset');
