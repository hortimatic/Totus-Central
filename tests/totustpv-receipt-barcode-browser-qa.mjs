import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {prepareZXingModule,readBarcodes} from 'zxing-wasm/reader';
import {startLocalServer} from './local-static-server.mjs';
import {receiptHtml,prepareTpvPrintHtml} from '../src/totustpv/documents.js';
import {receiptBarcodeUrl} from '../src/totustpv/receipt-options.js';
const fixture=JSON.parse(await readFile(new URL('./fixtures/totustpv-order-barcodes.json',import.meta.url),'utf8'));
const encoder=await readFile(new URL('../connectors/prestashop/src/NativeDocuments.php',import.meta.url),'utf8');
assert.equal(fixture.encoder_sha256,createHash('sha256').update(encoder.replace(/\r\n/g,'\n')).digest('hex'),'Regenerate the fictional native barcode fixtures after changing their producer');
const wasm=await readFile(new URL(import.meta.resolve('zxing-wasm/reader/zxing_reader.wasm'))),originalFetch=globalThis.fetch;
try{globalThis.fetch=()=>Promise.reject(Error('The barcode reader must load its pinned local WASM, not a CDN'));
 await prepareZXingModule({overrides:{wasmBinary:wasm.buffer.slice(wasm.byteOffset,wasm.byteOffset+wasm.byteLength)},fireImmediately:true});
}finally{globalThis.fetch=originalFetch;}
async function decode(bytes,expected){const rows=await readBarcodes(new Uint8Array(bytes),{formats:['Code128'],tryHarder:true,maxNumberOfSymbols:1});
 assert.equal(rows.length,1,'An independent decoder must read the symbol');assert.equal(rows[0].text,expected);}
for(const barcode of fixture.cases){assert.equal(barcode.payload,'R:'+barcode.text);await decode(Buffer.from(barcode.data,'base64'),barcode.payload);}
const example=fixture.cases[0];
for(const invalid of [{...example,mime:'image/svg+xml'},{...example,text:'OTHER'},{...example,payload:'R:OTHER'},
 {...example,data:'javascript:alert(1)'},{...example,data:'iVBORw0KGgo'+'A'.repeat(100000)}])assert.equal(receiptBarcodeUrl(invalid,example.text),null);
const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true});
try{await mkdir('artifacts/native-lab',{recursive:true});for(const dpi of [203,300]){
 const page=await browser.newPage({viewport:{width:220,height:900},deviceScaleFactor:dpi/96});
 await page.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');
 await page.evaluate(async()=>window.fitBarcodePrint=(await import('/src/totustpv/documents.js')).fitTpvPrintPage);
 for(const [index,barcode] of fixture.cases.entries())for(const kind of ['receipt','gift']){
  const document={existing_document:true,kind,currency:'EUR',order_id:42,reference:barcode.text,reference_barcode:barcode,
   created_at:'2026-11-17 12:00:00',merchant:{name:'Tienda ficticia'},lines:[{name:'Artículo ficticio',quantity:1,line_cents:150}],payments:{cash:150},total_cents:150};
  assert.doesNotMatch(receiptHtml(document),/tpv-reference-barcode/,'Barcode printing is opt-in');
  await page.setContent(prepareTpvPrintHtml(receiptHtml(document,{showBarcode:true}),'Prueba de código en papel de 58 mm'));
  await page.waitForFunction(()=>{const image=document.querySelector('.tpv-reference-barcode');return image?.complete&&image.naturalWidth>0;});
  assert.equal((await page.evaluate(()=>window.fitBarcodePrint(document))).paperMm,58);
  assert.equal(await page.evaluate(()=>document.body.scrollWidth>document.body.clientWidth+1),false);
  if(kind==='gift')assert.doesNotMatch(await page.locator('body').innerText(),/1,50|€/);
  assert.equal(await page.evaluate(()=>document.querySelector('.tpv-order-barcode small').getBoundingClientRect().bottom<=document.body.getBoundingClientRect().bottom+1),true,'The readable reference must fit the measured paper height');
  const image=await page.screenshot({clip:{x:0,y:0,width:220,height:await page.locator('body').evaluate(el=>Math.ceil(el.getBoundingClientRect().bottom))},
   path:`artifacts/native-lab/barcode-${kind}-${index}-${dpi}dpi.png`});
  await decode(image,barcode.payload);
  if(index===0&&kind==='receipt')await page.pdf({preferCSSPageSize:true,path:`artifacts/native-lab/barcode-receipt-${dpi}dpi.pdf`});
 }
 await page.close();
}
 console.log('PASS native Code128 fixtures and 58 mm paper at simulated 203/300 dpi: independent ZXing decoding, quiet zones, reference namespace, gift privacy and bounded PNG input. Native encoder fixtures are source-hashed; no CDN, scanner or physical printer claim.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
