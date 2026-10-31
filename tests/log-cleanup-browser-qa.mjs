import {clickModuleLink} from './ui-navigation.mjs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
const errors=[];
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await page.evaluate(()=>{
  for(const table of ['ops_audit_log','team_user_audit_log','ops_chat_events','ops_task_events'])window.__mockDb[table]=[{id:table+'-old',created_at:'2020-01-15T12:00:00Z',action:'qa',area:'gastos'}];
  window.__mockDb.ops_audit_log.push({id:'kept-cleanup',created_at:'2020-01-15T12:00:00Z',action:'limpiar_historial',area:'administracion'});
  window.__mockDb.ops_audit_log.push({id:'outside-range',created_at:'2020-02-01T12:00:00Z',action:'qa',area:'gastos'});
  window.__qaBusinessBefore=JSON.stringify(['ops_expenses','ops_daily_closings','ops_documents','ops_chat_messages','ops_tasks','ops_stock_revisions','ops_backup_runs'].map(t=>window.__mockDb[t]||[]));
 });
 await clickModuleLink(page,page.locator('#nav [data-route="administracion"]'));
 await page.locator('[data-section="log"]').click();
 const open=async()=>{await page.locator('[data-action="admin-log-cleanup-open"]').click();await page.locator('#logCleanupFrom').fill('2020-01-01');await page.locator('#logCleanupTo').fill('2020-01-31');};
 const calculate=async count=>{await page.locator('[data-action="admin-log-cleanup-preview"]').click();await page.getByText(count+' registros para eliminar',{exact:true}).waitFor();};
 await open();assert(await page.locator('[data-action="admin-log-cleanup-delete"]').isDisabled());
 await calculate(4);
 await page.locator('#logCleanupTo').fill('2020-01-30');assert(await page.locator('[data-action="admin-log-cleanup-delete"]').isDisabled(),'Editing dates invalidates preview');
 await page.locator('#logCleanupTo').fill('2020-01-31');await calculate(4);
 await page.locator('[data-action="admin-log-cleanup-delete"]').click();await page.locator('[data-confirm="cancel"]').click();
 assert.equal(await page.evaluate(()=>window.__mockDb.ops_task_events.length),1,'Cancel keeps events');
 await open();await calculate(4);
 await page.evaluate(()=>window.__mockDb.ops_audit_log.push({id:'changed-after-preview',created_at:'2020-01-16T12:00:00Z',action:'qa'}));
 await page.locator('[data-action="admin-log-cleanup-delete"]').click();await page.locator('[data-confirm="accept"]').click();
 await page.getByText('El historial ha cambiado. Vuelve a consultar antes de eliminar',{exact:false}).waitFor();
 assert.equal(await page.evaluate(()=>window.__mockDb.ops_task_events.length),1,'Stale preview cannot partially clean');
 await open();await calculate(5);
 await page.locator('[data-action="admin-log-cleanup-delete"]').click();await page.locator('[data-confirm="accept"]').click();
 await page.getByText('Historial limpiado.',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.__mockDb.ops_task_events.length),0);
 assert(await page.evaluate(()=>window.__mockDb.ops_audit_log.some(r=>r.id==='outside-range')&&window.__mockDb.ops_audit_log.some(r=>r.id==='kept-cleanup')),'Range and cleanup marker protection');
 assert(await page.evaluate(()=>window.__qaBusinessBefore===JSON.stringify(['ops_expenses','ops_daily_closings','ops_documents','ops_chat_messages','ops_tasks','ops_stock_revisions','ops_backup_runs'].map(t=>window.__mockDb[t]||[]))),'Business records and files unchanged');
 const snapshot=await page.evaluate(async()=>{const {state}=await import('../src/state.js');return state.data.audit;});
 assert(!snapshot.some(r=>String(r.id).includes('-old')||r.id==='changed-after-preview'),'Deleted events do not remain in incremental cache');
 for(const width of [1440,1180,390,320]){await page.setViewportSize({width,height:850});await page.locator('[data-action="admin-log-cleanup-open"]').click();assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),'No page overflow at '+width);await page.locator('#modalHost .close-btn').click();}
 await page.close();
 const staff=await browser.newPage();await staff.goto('http://127.0.0.1:4173/tests/app-mock.html?role=gerente',{waitUntil:'networkidle'});await clickModuleLink(staff,staff.locator('#nav [data-route="administracion"]'));await staff.locator('[data-section="log"]').click();assert.equal(await staff.locator('[data-action="admin-log-cleanup-open"]').count(),0,'Managers cannot clean Log');await staff.close();
 assert.deepEqual(errors,[]);console.log('LOG CLEANUP BROWSER: preview, invalidation, cancellation, concurrent changes, deletion, cache refresh, permissions and desktop/mobile');
}finally{await browser.close()}
