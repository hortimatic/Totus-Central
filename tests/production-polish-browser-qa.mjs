import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const source=await fs.readFile('index.html','utf8');assert(!source.includes('<strong>TOTUS CENTRAL</strong>'));assert(source.includes('class="app-version"'));assert(!source.includes('<span class="brand-mark">T</span>'));
const browser=await chromium.launch({headless:true}),page=await browser.newPage({locale:'es-ES',viewport:{width:1440,height:950}}),errors=[],calls=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.route('**/functions/v1/totus-recovery',async route=>{
  const body=route.request().postDataJSON();calls.push(body);
  if(body.action==='review-saved'){await route.fulfill({json:{verified:true,rows:12,files:3,manifest:{version:3,created_at:'2026-10-20T12:00Z'}}});return;}
  if(body.action==='register-saved'){await page.evaluate(({id})=>window.__mockDb.ops_recovery_jobs.push({id,requested_by:'cccccccc-cccc-4ccc-cccc-cccccccccccc',requested_email:'qa@example.com',status:'uploaded',source_path:'automaticas/selected.totusbackup',created_at:new Date().toISOString()}),{id:body.job_id});await route.fulfill({json:{job_id:body.job_id,source_path:'automaticas/selected.totusbackup'}});return;}
  await page.evaluate(id=>Object.assign(window.__mockDb.ops_recovery_jobs.find(j=>j.id===id),{status:'committed',result:{}}),body.job_id);await route.fulfill({json:{job_id:body.job_id,result:{}}});
 });
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 assert.equal(await page.locator('.sidebar-foot .app-version').count(),0);assert.equal(await page.locator('.sidebar .brand .app-version').count(),1);
 const brand=await page.locator('.sidebar .brand').boundingBox();assert(brand.height<90,'Brand must remain compact');
 await page.locator('#nav [data-route="administracion"]').click();
 await page.locator('[data-action="user-new"]').click();
 await page.locator('#usPassword').fill('Synthetic-password-only-123');
 const eye=page.locator('[data-action="password-visibility"]');assert.equal(await page.locator('#usPassword').getAttribute('type'),'password');
 await eye.click();assert.equal(await page.locator('#usPassword').getAttribute('type'),'text');assert.equal(await eye.getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#usPassword').inputValue(),'Synthetic-password-only-123');
 await eye.click();assert.equal(await page.locator('#usPassword').getAttribute('type'),'password');
 await page.locator('button[data-action="close-modal"]').click();
 await page.locator('[data-action="admin-section"][data-section="roles"]').click();
 await page.locator('[data-action="role-rename"][data-role="gerente"]').click();
 await page.locator('#roleName').fill('Gerencia de prueba');await page.locator('[data-action="role-save"]').click();
 await page.getByRole('heading',{name:'Gerencia de prueba',exact:true}).waitFor();
 assert.equal(await page.locator('[data-action="role-rename"][data-role="admin"]').count(),0);
 await page.evaluate(async()=>{
  const {sb}=await import('../src/api.js'),previous=sb.functions.invoke;
  sb.functions.invoke=async(name,options)=>name==='totus-backup-run'?{data:{status:'success'},error:null}:previous(name,options);
  const copy={id:'33333333-3333-4333-8333-333333333333',status:'success',storage_path:'automaticas/selected.totusbackup',started_at:'2026-10-20T12:00Z',size_bytes:1024,files_count:3,rows_count:12};
  window.__mockDb.ops_backup_runs=[copy];const {state}=await import('../src/state.js');state.data.backupRuns=[copy];
 });
 await page.locator('[data-action="admin-section"][data-section="backups"]').click();
 await page.locator('[data-action="backup-history-restore"]').click();await page.getByRole('heading',{name:'Restaurar copia elegida',exact:true}).waitFor();
 assert.equal(calls.length,1);assert.equal(calls[0].action,'review-saved');
 await page.locator('[data-action="recovery-confirm"]').click();assert.equal(await page.locator('[data-confirm="accept"]').isDisabled(),true);
 await page.locator('[data-confirm="cancel"]').click();assert.equal(calls.length,1,'Cancelling must not register or restore anything');
 await page.locator('[data-action="backup-history-restore"]').click();await page.locator('[data-action="recovery-confirm"]').click();
 await page.locator('#confirmPhrase').fill('RECUPERAR COPIA');await page.locator('[data-confirm="accept"]').click();
 await page.getByText('Recuperación completada y verificada.',{exact:true}).waitFor();
 assert.deepEqual(calls.map(c=>c.action),['review-saved','review-saved','register-saved','process']);assert.equal(calls[2].backup_id,'33333333-3333-4333-8333-333333333333');
 assert.deepEqual(errors,[]);
 console.log('PRODUCTION POLISH BROWSER: compact brand, password visibility, existing-role labels, selected cloud restore, explicit confirmation and cancellation without writes verified.');
}finally{await browser.close();}
