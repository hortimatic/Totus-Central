import {clickModuleLink} from './ui-navigation.mjs';
import {chromium} from 'playwright';
import JSZip from 'jszip';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({acceptDownloads:true,locale:'es-ES'});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await clickModuleLink(page,page.locator('#nav [data-route="documentos"]'));
 await page.locator('[data-action="document-new"]').click();
 await page.locator('#docParty').fill('Backup QA');
 await page.locator('#docFile').setInputFiles({name:'backup-comprobante.txt',mimeType:'text/plain',buffer:Buffer.from('Documento de restauración')});
 await page.locator('[data-action="document-save"]').click();
 await page.waitForTimeout(90);
 if((await page.evaluate(()=>window.__mockDb.ops_documents.length))!==1)throw Error('Documento de prueba no creado');
 await page.evaluate(()=>{
  // Revertir el orden de inserción para detectar páginas no deterministas.
  for(let i=1204;i>=0;i--)window.__mockDb.ops_expenses.push({
   id:'00000000-0000-4000-8000-'+String(i).padStart(12,'0'),
   expense_date:'2026-10-11',supplier_name:'Prueba paginación',gross_expense:1
  });
 });
 await clickModuleLink(page,page.locator('#nav [data-route="administracion"]'));
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
 if(manifest.version!==3||!manifest.integrity?.database)throw Error('Falta control de integridad v3');
 if(!Array.isArray(database.profiles)||!Array.isArray(database.team_members)||manifest.identities.length!==1)throw Error('Faltan autores o directorio');
 if(database.ops_documents[0].uploaded_by!==manifest.identities[0].id)throw Error('Se ha perdido el autor del documento');
 if(!Array.isArray(database.ops_income_adjustments))throw Error('Falta tabla de ajustes manuales');
 if(database.ops_expenses.length!==1205)throw Error('Paginación del backup pierde gastos');
 if(database.ops_expenses[0].id!=='00000000-0000-4000-8000-000000000000'||database.ops_expenses.at(-1).id!=='00000000-0000-4000-8000-000000001204')throw Error('Paginación sin orden estable');
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
 if(!result.rejected||!result.unchanged||!(/versión segura|incompatible|deshabilitada por seguridad/.test(result.reason)))throw Error('El restaurador antiguo no se ha bloqueado antes de tocar los datos: '+JSON.stringify(result));
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
 const altered=await JSZip.loadAsync(bytes);
 const alteredDatabase=JSON.parse(await altered.file('database.json').async('string'));
 alteredDatabase.ops_expenses.push({id:'forged'});
 altered.file('database.json',JSON.stringify(alteredDatabase));
 const modifiedBytes=await altered.generateAsync({type:'uint8array'});
 const tamperRejected=await page.evaluate(async arr=>{
  const file=new File([new Uint8Array(arr)],'database-alterada.totusbackup');
  const mod=await import('../src/backup.js');
  try{await mod.inspectBackup(file);return false}catch(e){return String(e.message).includes('integridad')}
 },[...modifiedBytes]);
 if(!tamperRejected)throw Error('No se detecta alteración de la base de datos archivada');

 // El restaurador no certificado debe seguir bloqueado incluso con un backup válido.
 // Esta comprobación impide pérdidas y no autoriza escrituras en la BD ni Storage.
 const rejectedRestore=await page.evaluate(async arr=>{
  const file=new File([new Uint8Array(arr)],'backup.totusbackup',{type:'application/octet-stream'});
  const mod=await import('../src/backup.js');
  const beforeRows=window.__mockDb.ops_expenses.length;
  const beforeFiles=window.__mockUploads.size;
  let rejected=false,reason='';
  try{await mod.restoreBackup(file,'Prueba de bloqueo de restauración no certificada')}catch(e){rejected=true;reason=String(e.message)}
  return {rejected,reason,rowsUnchanged:window.__mockDb.ops_expenses.length===beforeRows,filesUnchanged:window.__mockUploads.size===beforeFiles};
 },[...bytes]);
 if(!rejectedRestore.rejected||!rejectedRestore.rowsUnchanged||!rejectedRestore.filesUnchanged||
    !/deshabilitada por seguridad/.test(rejectedRestore.reason))
  throw Error('La restauración no certificada alteraría información: '+JSON.stringify(rejectedRestore));
 if(errors.length)throw Error('Errores JS: '+errors.join('; '));
 console.log('BACKUP QA: descarga, archivos, control de integridad y restauración bloqueada sin modificar datos: OK');
}finally{await browser.close()}
