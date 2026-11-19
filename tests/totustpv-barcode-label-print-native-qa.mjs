import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import path from 'node:path';import {readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';import {PDFDocument} from 'pdf-lib';
import {prepareZXingModule,readBarcodes} from 'zxing-wasm/reader';
import {startLocalServer} from './local-static-server.mjs';
const samples=JSON.parse(execFileSync(path.resolve('artifacts/php82/php.exe'),['-c','artifacts/native-lab/php.ini','tests/native-lab/barcode-label-patterns.php'],{encoding:'utf8',env:{...process.env,OPENSSL_CONF:path.resolve('artifacts/php82/extras/ssl/openssl.cnf')}}).trim().split(/\r?\n/).at(-1));
const wasm=await readFile(new URL(import.meta.resolve('zxing-wasm/reader/zxing_reader.wasm')));await prepareZXingModule({overrides:{wasmBinary:wasm.buffer.slice(wasm.byteOffset,wasm.byteOffset+wasm.byteLength)},fireImmediately:true});
const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:950},deviceScaleFactor:3});
 await page.goto('http://127.0.0.1:4173/tests/totustpv-barcode-panel.html');
 for(const [index,sample] of samples.entries()){
  const paper=sample.field==='reference'?(sample.code.length>30?'a4landscape':'thermal100'):'thermal58';
  const html=await page.evaluate(async({sample,paper})=>{const {labelPrintDocument}=await import('/src/totustpv/barcode-labels.js');return labelPrintDocument({items:[{...sample,name:'Artículo del laboratorio',variantName:'Rojo · 30 ml'}]},{paper,copies:3});},{sample,paper});
  await page.setContent(html);const symbol=page.locator('.tpv-label-symbol').first(),decoded=await readBarcodes(new Uint8Array(await symbol.screenshot()),{formats:['EAN13','UPCA','Code128'],maxNumberOfSymbols:1});
  assert.equal(decoded.length,1,'Rendered barcode must decode');assert.equal(decoded[0].text.replace(/^0(?=\d{12}$)/,''),sample.code.replace(/^0(?=\d{12}$)/,''));
  const bytes=await page.pdf({preferCSSPageSize:true,printBackground:true}),pdf=await PDFDocument.load(bytes),first=pdf.getPage(0);
  assert.equal(pdf.getPageCount(),paper==='a4landscape'?1:3,'Each roll label must fit exactly one physical page');
  assert.ok(Math.abs(first.getWidth()-(paper==='a4landscape'?297:paper==='thermal100'?100:58)*72/25.4)<1);
  assert.ok(Math.abs(first.getHeight()-(paper==='a4landscape'?210:50)*72/25.4)<1);
  await writeFile(`artifacts/barcode-label-${index}.pdf`,bytes);
 }
 console.log('PASS native label print: TCPDF EAN13/UPCA/Code128 incl64-char reference → local SVG → ZXing decode; three roll labels yield exactly3 correctly sized PDF pages, A4 landscape fits long reference. Physical printer/scanner unverified.');
}finally{await browser.close();await server.close();}
