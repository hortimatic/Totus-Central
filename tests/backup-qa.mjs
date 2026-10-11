import {chromium} from 'playwright';
import JSZip from 'jszip';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({acceptDownloads:true,locale:'es-ES'});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await page.locator('#nav [data-route="documentos"]').click();
 await page.locator('[data-action="document-new"]').click();
 await page.locator('#docParty').fill('Backup QA');
 await page.locator('#docFile').setInputFiles({name:'backup-comprobante.txt',mimeType:'text/plain',buffer:Buffer.from('Documento de restauración')});
 await page.locator('[data-action="document-save"]').click();
 await page.waitForTimeout(90);
 if((await page.evaluate(()=>window.__mockDb.ops_documents.length))!==1)throw Error('Documento de prueba no creado');
 await page.locator('#nav [data-route="administracion"]').click();
 const tab=page.locator('[data-action="admin-section"][data-section="backups"]');
 if(await tab.count())await tab.first().click();
 const download=page.waitForEvent('download',{timeout:12000});
 await page.locator('[data-action="backup-create"]').click();
 const file=await download;
 if(!file.suggestedFilename().endsWith('.totusbackup'))throw Error('Formato incorrecto');
 const bytes=await fs.readFile(await file.path());
 const zip=await JSZip.loadAsync(bytes);
 const manifest=JSON.parse(await zip.file('manifest.json').async('string'));
 const database=JSON.parse(await zip.file('database.json').async('string'));
 if(!Array.isArray(database.ops_income_adjustments))throw Error('Falta tabla de ajustes manuales');
 if(!manifest.storage['business-documents'].length)throw Error('Faltan archivos almacenados');
 for(const bucket of ['business-documents','business-assets'])for(const path of manifest.storage[bucket])if(!zip.file('storage/'+bucket+'/'+path))throw Error('Archivo ausente '+path);
 const result=await page.evaluate(async arr=>{
  const file=new File([new Uint8Array(arr)],'backup.totusbackup',{type:'application/octet-stream'});
  const mod=await import('../src/backup.js');
  const count=window.__mockDb.ops_documents.length;
  const inspected=await mod.inspectBackup(file);
  let rejected=false,reason='';
  try{await mod.restoreBackup(file,'Ensayo de incompatibilidad SQL')}catch(e){rejected=true;reason=String(e.message)}
  return {rejected,reason,unchanged:window.__mockDb.ops_documents.length===count,tableCount:inspected.manifest.tables.length};
 },[...bytes]);
 if(!result.rejected||!result.unchanged||!result.reason.includes('versión segura'))throw Error('El restaurador antiguo no se ha bloqueado antes de tocar los datos: '+JSON.stringify(result));
 const invalid=await JSZip.loadAsync(bytes);
 const target='storage/business-documents/'+manifest.storage['business-documents'][0];
 invalid.remove(target);
 const tampered=await invalid.generateAsync({type:'uint8array'});
 const declined=await page.evaluate(async arr=>{
  const f=new File([new Uint8Array(arr)],'corrupt.totusbackup');
  const mod=await import('../src/backup.js');
  try{await mod.inspectBackup(f);return false}catch(e){return String(e.message).includes('Falta el archivo')}
 },[...tampered]);
 if(!declined)throw Error('No se rechaza una copia con documento faltante');
 if(errors.length)throw Error('Errores JS: '+errors.join('; '));
 console.log('BACKUP QA: archivo real, tablas, documentos, rechazo de archivo roto y contrato SQL incompatible: OK');
}finally{await browser.close()}
