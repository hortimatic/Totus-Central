import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
import XLSX from 'xlsx-js-style';
import JSZip from 'jszip';

// The existing mock app injects both libraries eagerly. Block only those fixture
// tags, then serve the exact pinned CDN requests from installed test dependencies.
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({acceptDownloads:true});
const errors=[],counts={excel:0,zip:0};
page.on('pageerror',error=>errors.push(error.message));
try{
 await page.route('**/node_modules/xlsx-js-style/dist/xlsx.bundle.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:''}));
 await page.route('**/node_modules/jszip/dist/jszip.min.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:''}));
 await page.route('https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js',route=>{counts.excel++;return route.fulfill({path:'node_modules/xlsx-js-style/dist/xlsx.bundle.js',contentType:'application/javascript'});});
 await page.route('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',route=>{counts.zip++;return route.fulfill({path:'node_modules/jszip/dist/jszip.min.js',contentType:'application/javascript'});});
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 assert.equal(await page.evaluate(()=>typeof window.XLSX),'undefined','No Excel at startup');
 assert.equal(await page.evaluate(()=>typeof window.JSZip),'undefined','No ZIP at startup');
 await page.locator('#nav [data-route="documentos"]').click();
 await page.locator('[data-action="document-new"]').click();
 await page.locator('#docParty').fill('Prueba ZIP bajo demanda');
 await page.locator('#docFile').setInputFiles({name:'lazy-test.txt',mimeType:'text/plain',buffer:Buffer.from('Prueba documental aislada')});
 await page.locator('[data-action="document-save"]').click();
 await page.locator('[data-action="document-back"]').waitFor();
 await page.locator('[data-action="document-back"]').click();
 await page.locator('[data-action="documents-zip"]').waitFor();
 const zipDownload=page.waitForEvent('download',{timeout:15000});
 await page.locator('[data-action="documents-zip"]').click();
 const zipFile=await zipDownload;
 const zip=await JSZip.loadAsync(await readFile(await zipFile.path()));
 assert(Object.keys(zip.files).some(x=>x.endsWith('lazy-test.txt')),'First ZIP click must include selected original');
 assert.equal(counts.zip,1,'Only one ZIP request');
 assert.equal(counts.excel,0,'ZIP must not load Excel');
 await page.locator('#nav [data-route="cajas"]').click();
 const excelDownload=page.waitForEvent('download',{timeout:15000});
 await page.locator('[data-action="export-closings-current"]').click();
 const excelFile=await excelDownload;
 const wb=XLSX.read(await readFile(await excelFile.path()),{type:'buffer',cellStyles:true});
 assert(wb.SheetNames.includes('Cierres'));
 assert.equal(wb.Sheets.Cierres.H5.f,'0','Empty fixture keeps formula for total');
 assert.equal(counts.excel,1,'Only one Excel request');
 assert.equal(counts.zip,1,'Excel must reuse ZIP');
 if(errors.length)throw Error('Browser exceptions: '+errors.join('; '));
 console.log('Office lazy browser QA: initial unloaded state, first ZIP and Excel click, archive, formula and single request OK');
}finally{await browser.close()}
