import {clickModuleLink} from './ui-navigation.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import JSZip from 'jszip';
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
  await page.evaluate(({id,source})=>{
   const checkpoint='restauraciones/puntos-vuelta/'+id+'.totusbackup';
   window.__mockUploads.set('business-backups/'+checkpoint,window.__mockUploads.get('business-backups/'+source));
   Object.assign(window.__mockDb.ops_recovery_jobs.find(x=>x.id===id),{status:'committed',checkpoint_path:checkpoint,result:{}});
  },{id,source});
  await route.fulfill({json:{job_id:id,result:{}}});
 });
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await clickModuleLink(page,page.locator('#nav [data-route="administracion"]'));
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
 await page.locator('tr').filter({has:page.getByRole('button',{name:'Copia anterior',exact:true})}).getByText('Completada',{exact:true}).waitFor();
 assert.deepEqual(calls.map(x=>x.action),['register','process']);
 assert.equal(await page.getByRole('button',{name:'Copia anterior',exact:true}).count(),1);
 assert.equal(await page.getByRole('button',{name:'Continuar recuperación',exact:true}).count(),0);
 for(const label of ['Copia anterior','Copia solicitada']){
  const ready=page.waitForEvent('download');await page.getByRole('button',{name:label,exact:true}).click();
  const file=await ready;assert.deepEqual(await fs.readFile(await file.path()),bytes,label+' must return the selected original archive');
 }
 const jobId=await page.evaluate(async()=>{const job=window.__mockDb.ops_recovery_jobs[0];job.status='prepared';await(await import('../src/api.js')).loadCore();return job.id;});
 await page.locator('[data-action="admin-section"][data-section="backups"]').click();
 await page.getByRole('button',{name:'Continuar recuperación',exact:true}).click();
 await page.locator('#confirmPhrase').fill('RECUPERAR COPIA');await page.locator('[data-confirm="accept"]').click();
 await page.waitForFunction(id=>window.__mockDb.ops_recovery_jobs.find(x=>x.id===id).status==='committed',jobId);
 await page.getByText('Recuperación completada y verificada.',{exact:true}).last().waitFor();
 assert.deepEqual(calls.map(x=>x.action),['register','process','process'],'Continue must reuse the registered job without another upload');assert.equal(calls.at(-1).job_id,jobId);
 const dataPart=await new JSZip().file('LEER.txt','Datos ficticios para probar solo la descarga, no una recuperación real.').generateAsync({type:'nodebuffer'});
 const codePart=await new JSZip().file('LEER.txt','Código ficticio de ensayo de transporte.').generateAsync({type:'nodebuffer'});
 const componentFixture=await page.evaluate(async({jobId,dataPart,codePart})=>{
  const {signBackupSet,componentPath}=await import('../src/backup-set.js'),{archiveHash}=await import('../src/recovery-core.js');
  const path='restauraciones/puntos-vuelta/'+jobId+'.componentes.json',parts=[];
  for(const [kind,values] of [['datos',dataPart],['codigo',codePart]]){const bytes=new Uint8Array(values),partPath=componentPath(path,kind,0);parts.push({kind,number:0,path:partPath,size:bytes.length,sha256:await archiveHash(bytes)});window.__mockUploads.set('business-backups/'+partPath,new Blob([bytes]));}
  const index=await signBackupSet(path,parts);window.__mockUploads.set('business-backups/'+path,new Blob([JSON.stringify(index)]));
  window.__mockDb.ops_recovery_jobs.find(x=>x.id===jobId).checkpoint_path=path;await(await import('../src/api.js')).loadCore();return {index,path};
 },{jobId,dataPart:Array.from(dataPart),codePart:Array.from(codePart)});
 await page.locator('[data-action="admin-section"][data-section="backups"]').click();await page.getByRole('button',{name:'Copia anterior',exact:true}).click();
 await page.getByRole('heading',{name:'Componentes de recuperación',exact:true}).waitFor();
 const indexReady=page.waitForEvent('download');await page.locator('[data-action="recovery-component-download"][data-part="-1"]').click();
 const indexFile=await indexReady;assert.deepEqual(JSON.parse(await fs.readFile(await indexFile.path(),'utf8')),componentFixture.index);
 const partReady=page.waitForEvent('download');await page.locator('[data-action="recovery-component-download"][data-part="0"]').click();
 const partFile=await partReady;assert.deepEqual(await fs.readFile(await partFile.path()),dataPart);
 let unexpectedDownloads=0;page.on('download',()=>unexpectedDownloads++);
 await page.evaluate(path=>window.__mockUploads.set('business-backups/'+path,new Blob(['componente dañado de ensayo'])),componentFixture.index.parts[0].path);
 await page.locator('[data-action="recovery-component-download"][data-part="0"]').click();await page.getByText('Componente dañado.',{exact:true}).waitFor();
 assert.equal(unexpectedDownloads,0,'A corrupted component must not be downloaded as a usable backup');
 assert.deepEqual(errors,[]);
 await page.screenshot({path:'artifacts/review_recovery_mock.png',fullPage:true});
 console.log('RECOVERY BROWSER QA: reviewed copy, typed confirmation, cancellation without writes, upload, completion and journal actions OK (isolated adapters)');
}finally{await browser.close()}
