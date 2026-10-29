import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';

// A real browser using only the repository's fictitious Supabase mock.
const browser=await chromium.launch({headless:true});
const auditTables=['ops_audit_log','team_user_audit_log','ops_chat_events','ops_task_events','ops_stock_revisions'];
const errors=[];
async function auditedPage(query=''){
 const page=await browser.newPage({acceptDownloads:true});
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(tables=>{window.__qaAuditTables=tables;window.__qaAuditCalls=[];},auditTables);
 await page.route('**/tests/mock-supabase.js',async route=>{
  const response=await route.fetch();let source=await response.text();
  const needle='then(ok,fail){return Promise.resolve(databaseResult(this.result())).then(ok,fail)}';
  assert(source.includes(needle));
  const replacement=`then(ok,fail){
   if(window.__qaAuditTables.includes(this.table)){
    window.__qaAuditCalls.push(this.table);
    if(window.__qaAuditFailure===this.table)
     return Promise.resolve({data:null,error:{message:'Fallo de lectura de ensayo'}}).then(ok,fail);
    if(window.__qaAuditGate)
     return window.__qaAuditGate.then(()=>Promise.resolve(databaseResult(this.result())).then(ok,fail));
   }
   return Promise.resolve(databaseResult(this.result())).then(ok,fail)
  }`;
  source=source.replace(needle,replacement);
  await route.fulfill({response,body:source});
 });
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html'+query,{waitUntil:'networkidle'});
 return page;
}
async function report(page){return page.evaluate(async()=>{const {state}=await import('../src/state.js');return {count:state.data.audit.length,updated:state.data.auditUpdatedAt,error:state.data.auditError,loading:state.data.auditLoading};});}
try{
 const page=await auditedPage();
 assert.deepEqual(await page.evaluate(()=>window.__qaAuditCalls),[],'Startup must not load audit history');
 await page.locator('#nav [data-route="administracion"]').click();
 assert.deepEqual(await page.evaluate(()=>window.__qaAuditCalls),[],'Administration overview must not load audit history');

 await page.evaluate(()=>{
  window.__mockDb.ops_audit_log=Array.from({length:1105},(_,i)=>({id:'aud-lazy-'+i,created_at:new Date(Date.UTC(2026,0,1,0,i)).toISOString(),area:'gastos',action:'actualizar',user_email:'qa@example.com',detail:{referencia:'prueba ficticia'}}));
  window.__qaAuditGate=new Promise(resolve=>{window.__qaAuditRelease=resolve;});
 });
 await page.locator('[data-action="admin-section"][data-section="log"]').click();
 await page.waitForFunction(()=>window.__qaAuditCalls.includes('ops_audit_log'));
 await page.getByText('Consultando el historial del Log…').waitFor();
 const firstLoading=await page.locator('#content').innerText();
 assert(firstLoading.includes('Cargando historial'),'First read must clearly indicate pending history');
 assert(!firstLoading.includes('0 eventos')&&!firstLoading.includes('Sin eventos para estos filtros'),'Pending history must not claim to be empty');
 assert(!firstLoading.includes('Página 1 de 1'),'Pending history must not show fictitious pagination');
 assert.equal(await page.locator('[data-action="admin-log-export"]').isDisabled(),true,'No CSV before first valid audit read');
 const callsBefore=await page.evaluate(()=>window.__qaAuditCalls.length);
 await page.locator('[data-action="admin-section"][data-section="log"]').click();
 assert.equal(await page.evaluate(()=>window.__qaAuditCalls.length),callsBefore,'Repeated Log render/entry must share the pending read');
 await page.evaluate(()=>{window.__qaAuditGate=null;window.__qaAuditRelease();});
 await page.waitForFunction(async()=>{const {state}=await import('../src/state.js');return !!state.data.auditUpdatedAt&&!state.data.auditLoading;});
 assert.equal(await page.locator('[data-action="admin-log-export"]').isDisabled(),false);
 assert((await report(page)).count>=1105,'First complete read retains whole history');
 const download=page.waitForEvent('download');await page.locator('[data-action="admin-log-export"]').click();
 const csv=await fs.readFile(await (await download).path(),'utf8');
 assert(csv.trim().split(/\r?\n/).length>=1106,'CSV includes all events rather than only the first page');

 const previous=await report(page);
 await page.evaluate(()=>{window.__qaAuditFailure='ops_task_events';});
 await page.locator('[data-action="admin-log-refresh"]').click();
 await page.getByText('No se ha podido actualizar el registro:',{exact:false}).waitFor();
 const failed=await report(page);
 assert.equal(failed.count,previous.count,'A failed refresh keeps the previous complete history');
 assert.equal(failed.updated,previous.updated,'A failed refresh must not claim a newer read');
 assert.match(failed.error,/Fallo de lectura de ensayo/);
 assert.equal(await page.locator('[data-action="admin-log-export"]').isDisabled(),false,'Existing complete snapshot remains available with a visible warning');
 await page.evaluate(()=>{window.__qaAuditFailure=null;});
 await page.locator('[data-action="admin-log-refresh"]').click();
 await page.waitForFunction(async()=>{const {state}=await import('../src/state.js');return !state.data.auditError&&!state.data.auditLoading;});

 // Exercise a normal refresh entry point while Log stays on screen, after new activity.
 await page.evaluate(()=>{
  window.__mockDb.ops_audit_log.push({id:'after-operation-qa',created_at:'2026-10-29T13:00:00Z',area:'gastos',action:'actualizar',user_email:'qa@example.com',detail:{}});
  const button=document.createElement('button');button.dataset.action='backup-refresh';button.textContent='Actualización tras operación simulada';document.querySelector('#content').append(button);
 });
 await page.locator('[data-action="backup-refresh"]').click();
 await page.waitForFunction(async()=>{const {state}=await import('../src/state.js');return !state.data.auditLoading&&state.data.audit.some(x=>x.id==='after-operation-qa');});
 const afterRefresh=await report(page);
 assert(afterRefresh.count>previous.count,'Refreshing core while Log is visible must read fresh audit events');

 await page.locator('#nav [data-route="inicio"]').click();
 const beforeNav=await page.evaluate(()=>window.__qaAuditCalls.length);
 await page.locator('#nav [data-route="administracion"]').click();
 await page.waitForFunction(n=>window.__qaAuditCalls.length>n,beforeNav);
 assert.equal(await page.locator('[data-action="admin-log-refresh"]').count(),1,'Returning directly to Administration must restore the Log panel');

 // A delayed read must not block the same-account session after sign-out and re-login.
 await page.evaluate(()=>{window.__qaAuditGate=new Promise(resolve=>{window.__qaAuditRelease=resolve;});});
 await page.locator('[data-action="admin-log-refresh"]').click();
 await page.waitForFunction(()=>window.__qaAuditCalls.includes('ops_audit_log'));
 await page.evaluate(async()=>{await (await import('../src/api.js')).sb.auth.signOut();});
 assert.equal((await report(page)).updated,null,'Sign-out must erase any previously read audit history');
 await page.locator('#loginEmail').fill('qa@example.com');
 await page.locator('#loginPassword').fill('Password-for-sandbox-only');
 await page.locator('#loginForm button[type="submit"]').click();
 await page.locator('#nav [data-route="administracion"]').waitFor();
 await page.evaluate(()=>{window.__qaAuditGate=null;});
 await page.locator('#nav [data-route="administracion"]').click();
 await page.locator('[data-action="admin-section"][data-section="log"]').click();
 await page.waitForFunction(async()=>{const {state}=await import('../src/state.js');return !!state.data.auditUpdatedAt&&!state.data.auditLoading;});
 const newSession=await report(page);
 await page.evaluate(()=>window.__qaAuditRelease());
 await page.waitForTimeout(100);
 const afterOld=await report(page);
 assert.deepEqual(afterOld,newSession,'Old completion must not alter the new session result, error or in-flight flag');
 assert((await page.locator('#toastHost .toast.bad').allTextContents()).every(message=>message.trim()),'Old request must not leave an empty error toast in the new session');
 await page.close();

 const employee=await auditedPage('?role=encargado');
 assert.deepEqual(await employee.evaluate(()=>window.__qaAuditCalls),[],'Unprivileged boot does not query audit');
 assert.equal(await employee.locator('#nav [data-route="administracion"]').count(),0,'No Log access without permissions');
 await employee.close();
 assert.deepEqual(errors,[],'No browser errors');
 console.log('LAZY AUDIT BROWSER QA: boot isolation, tab/navigation, gated first load, safe CSV, full history, failures, retry, post-refresh, same-user logout race, restricted user');
}finally{await browser.close();}
