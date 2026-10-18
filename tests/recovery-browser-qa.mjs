import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({acceptDownloads:true,locale:'es-ES'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
let calls=[];
try{
 await page.route('**/functions/v1/totus-recovery',async route=>{
  const body=route.request().postDataJSON();calls.push(body);
  const id=body.job_id,source='restauraciones/solicitudes/cccccccc-cccc-4ccc-cccc-cccccccccccc/'+id+'.totusbackup';
  if(body.action==='register'){
   await page.evaluate(({id,source})=>window.__mockDb.ops_recovery_jobs.push({id,requested_by:'cccccccc-cccc-4ccc-cccc-cccccccccccc',requested_email:'qa@example.com',created_at:new Date().toISOString(),status:'uploaded',source_path:source}),{id,source});
   await route.fulfill({json:{job_id:id,source_path:source}});return;
  }
  const found=await page.evaluate(source=>window.__mockUploads.has('business-backups/'+source),source);
  assert.equal(found,true,'The reviewed archive must be uploaded before requesting recovery');
  await page.evaluate(id=>Object.assign(window.__mockDb.ops_recovery_jobs.find(x=>x.id===id),{status:'committed',checkpoint_path:'restauraciones/puntos-vuelta/'+id+'.totusbackup',result:{}}),id);
  await route.fulfill({json:{job_id:id,result:{}}});
 });
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await page.locator('#nav [data-route="administracion"]').click();
 await page.locator('[data-action="admin-section"][data-section="backups"]').click();
 const downloaded=page.waitForEvent('download');await page.locator('[data-action="backup-create"]').click();
 const download=await downloaded,bytes=await fs.readFile(await download.path());
 await page.locator('#backupFile').setInputFiles({name:'qa.totusbackup',mimeType:'application/octet-stream',buffer:bytes});
 await page.locator('[data-action="recovery-review"]').click();
 await page.getByRole('heading',{name:'Revisar recuperación',exact:true}).waitFor();
 assert.match(await page.locator('#modalHost').innerText(),/contraseñas/);
 await page.locator('[data-action="recovery-confirm"]').click();
 const accept=page.locator('[data-confirm="accept"]');assert.equal(await accept.isDisabled(),true);
 await page.locator('#confirmPhrase').fill('RECUPERAR');assert.equal(await accept.isDisabled(),true);
 await page.locator('[data-confirm="cancel"]').click();assert.equal(calls.length,0,'Cancel must not start a recovery');
 await page.locator('[data-action="recovery-review"]').click();await page.locator('[data-action="recovery-confirm"]').click();
 await page.locator('#confirmPhrase').fill('RECUPERAR COPIA');await page.locator('[data-confirm="accept"]').click();
 await page.getByText('Completada',{exact:true}).waitFor();
 assert.deepEqual(calls.map(x=>x.action),['register','process']);
 assert.equal(await page.getByRole('button',{name:'Copia anterior',exact:true}).count(),1);
 assert.equal(await page.getByRole('button',{name:'Continuar recuperación',exact:true}).count(),0);
 assert.deepEqual(errors,[]);
 await page.screenshot({path:'artifacts/review_recovery_mock.png',fullPage:true});
 console.log('RECOVERY BROWSER QA: reviewed copy, typed confirmation, cancellation without writes, upload, completion and journal actions OK (isolated adapters)');
}finally{await browser.close()}
