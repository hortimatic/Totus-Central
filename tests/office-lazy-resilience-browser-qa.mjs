import {clickModuleLink} from './ui-navigation.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import XLSX from 'xlsx-js-style';

const browser=await chromium.launch({headless:true});
async function pageWithoutEagerOffice(){
 const page=await browser.newPage({acceptDownloads:true});
 await page.route('**/node_modules/xlsx-js-style/dist/xlsx.bundle.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:''}));
 await page.route('**/node_modules/jszip/dist/jszip.min.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:''}));
 return page;
}
try{
 // The failed first click must leave the live page intact; the next click retries.
 const page=await pageWithoutEagerOffice();
 let attempts=0;
 await page.route('https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js',route=>{
  attempts++;
  if(attempts===1)return route.abort('failed');
  return route.fulfill({path:'node_modules/xlsx-js-style/dist/xlsx.bundle.js',contentType:'application/javascript'});
 });
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await clickModuleLink(page,page.locator('#nav [data-route="cajas"]'));
 await page.locator('[data-action="export-closings-current"]').click();
 await page.locator('#toastHost').getByText('No se pudo cargar excel',{exact:false}).waitFor();
 assert.equal(await page.locator('[data-action="export-closings-current"]').count(),1,'Failed load cannot replace the page');
 const ready=page.waitForEvent('download',{timeout:20000});
 await page.locator('[data-action="export-closings-current"]').click();
 const wb=XLSX.read(await readFile(await (await ready).path()),{type:'buffer'});
 assert(wb.SheetNames.includes('Cierres'),'Retry must prepare real Excel');
 assert.equal(attempts,2,'Exactly one retry after an actual failure');
 await page.close();

 // A session change while the first script is in flight cannot trigger its old export.
 const stale=await pageWithoutEagerOffice();
 let started,release;
 const loading=new Promise(resolve=>started=resolve),gate=new Promise(resolve=>release=resolve);
 await stale.route('https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js',async route=>{
  started();await gate;await route.fulfill({path:'node_modules/xlsx-js-style/dist/xlsx.bundle.js',contentType:'application/javascript'});
 });
 let staleDownloads=0;stale.on('download',()=>staleDownloads++);
 await stale.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await clickModuleLink(stale,stale.locator('#nav [data-route="cajas"]'));
 await stale.locator('[data-action="export-closings-current"]').click();
 await loading;
 await stale.evaluate(async()=>{const {state}=await import('../src/state.js');state.session={...state.session};});
 release();
 await stale.waitForFunction(()=>typeof window.XLSX?.read==='function');
 await stale.waitForTimeout(150);
 assert.equal(staleDownloads,0,'A stale session may not download another session export');
 await stale.close();

 // A failed document preview must not leave a false loading result; it remains retryable.
 const preview=await pageWithoutEagerOffice();
 let previewLoads=0;
 await preview.route('https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js',route=>{
  previewLoads++;return previewLoads===1?route.abort('failed'):route.fulfill({path:'node_modules/xlsx-js-style/dist/xlsx.bundle.js',contentType:'application/javascript'});
 });
 await preview.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 const previewBook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(previewBook,XLSX.utils.aoa_to_sheet([['Prueba de reintento']]),'Datos');
 await clickModuleLink(preview,preview.locator('#nav [data-route="documentos"]'));
 await preview.locator('[data-action="document-new"]').click();
 await preview.locator('#docParty').fill('Vista previa de reintento');
 await preview.locator('#docFile').setInputFiles({name:'reintento-vista.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:XLSX.write(previewBook,{type:'buffer',bookType:'xlsx'})});
 await preview.locator('[data-action="document-save"]').click();
 await preview.locator('[data-action="document-back"]').first().click();
 const row=preview.locator('tr').filter({hasText:'reintento-vista.xlsx'});
 await row.locator('[data-action="document-preview"]').click();
 await preview.locator('#modalHost [role="alert"]').getByText('No se pudo cargar excel',{exact:false}).waitFor();
 assert(!(await preview.locator('#modalHost').innerText()).includes('Cargando archivo adjunto'),'Failure cannot leave a misleading spinner');
 await preview.locator('#modalHost .close-btn').click();
 await row.locator('[data-action="document-preview"]').click();
 await preview.locator('#modalHost').getByText('Prueba de reintento').waitFor();
 assert.equal(previewLoads,2,'Document preview must retry after failure');
 await preview.close();

 // Two distinct user exports may share one script request without suppressing either action.
 const concurrent=await pageWithoutEagerOffice();
 let requests=0;
 await concurrent.route('https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js',async route=>{
  requests++;await new Promise(resolve=>setTimeout(resolve,180));
  await route.fulfill({path:'node_modules/xlsx-js-style/dist/xlsx.bundle.js',contentType:'application/javascript'});
 });
 const downloads=[];concurrent.on('download',item=>downloads.push(item.suggestedFilename()));
 await concurrent.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await clickModuleLink(concurrent,concurrent.locator('#nav [data-route="informes"]'));
 await concurrent.locator('[data-action="export-closings"]').click();
 await concurrent.locator('[data-action="export-expenses"]').click();
 await concurrent.waitForFunction(()=>document.querySelector('script[src*="xlsx-js-style"]')!=null);
 await concurrent.waitForTimeout(250);
 assert.equal(requests,1,'Concurrent exports must share one script request');
 assert.equal(downloads.length,2,'Distinct legitimate exports must both finish');
 assert(downloads.some(n=>n.startsWith('cierres_'))&&downloads.some(n=>n.startsWith('gastos_')),'Both workbook identities must be preserved');
 await concurrent.close();
 console.log('Office lazy resilience: failure/retry, stale session and two independent concurrent exports OK');
}finally{await browser.close()}
