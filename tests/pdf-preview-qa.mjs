import {chromium} from 'playwright';
import {PDFDocument,rgb} from 'pdf-lib';
import assert from 'node:assert/strict';
const pdf=await PDFDocument.create();
for(let i=0;i<3;i++){const page=pdf.addPage([400,300]);page.drawRectangle({x:30,y:30,width:180,height:150,color:rgb(0,0,1)});page.drawText('PDF QA page '+(i+1),{x:30,y:250,size:20})}
const bytes=[...await pdf.save()];
const browser=await chromium.launch({headless:true});
try{
 for(const width of [1440,320]){
  const page=await browser.newPage({viewport:{width,height:960}});
  await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
  await page.evaluate(async bytes=>{
   const {renderPdfPreview}=await import('/src/pdf-preview.js');
   const host=document.createElement('div');host.id='pdf-test';host.className='document-frame pdf-viewer';document.body.replaceChildren(host);
   await renderPdfPreview(new Blob([new Uint8Array(bytes)],{type:'application/pdf'}),host);
  },bytes);
  await page.locator('[data-pdf-rendered="1"]').waitFor();
  assert(await page.locator('[data-pdf-prev]').isDisabled());
  const painted=await page.locator('canvas').evaluate(c=>{const p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let count=0;for(let i=0;i<p.length;i+=4)if(p[i]<20&&p[i+1]<20&&p[i+2]>200)count++;return count});
  assert(painted>1000,'The preview frame exists but PDF content was not painted');
  for(const expected of [2,3]){await page.locator('[data-pdf-next]').click();await page.locator(`[data-pdf-rendered="${expected}"]`).waitFor()}
  assert(await page.locator('[data-pdf-next]').isDisabled());
  await page.locator('[data-pdf-prev]').click();await page.locator('[data-pdf-rendered="2"]').waitFor();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'PDF viewer overflows mobile viewport');
  if(width===320)await page.screenshot({path:'artifacts/pdf_preview_mobile.png'});
  await page.close();
 }
 for(const width of [881,320]){
  const page=await browser.newPage({viewport:{width,height:680}});
  await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
  const id=await page.evaluate(async bytes=>{
   const id=crypto.randomUUID();window.__mockDb.ops_documents.push({id,original_name:'Invoice preview QA.pdf',doc_type:'factura_recibida',mime_type:'application/pdf',storage_path:'qa/preview.pdf',document_date:new Date().toISOString().slice(0,10)});
   window.__mockUploads.set('business-documents/qa/preview.pdf',new Blob([new Uint8Array(bytes)],{type:'application/pdf'}));
   await (await import('/src/api.js')).loadCore();return id;
  },bytes);
  await page.locator('#nav [data-route="documentos"]').click();
  await page.locator(`[data-action="document-preview"][data-id="${id}"]`).click();
  await page.locator('#pdfPreviewHost[data-pdf-rendered="1"]').waitFor();
  assert(await page.locator('.pdf-document-modal').evaluate(el=>el.scrollHeight<=el.clientHeight+1),'Outer PDF modal must not introduce a second scroll area');
  assert(await page.locator('.pdf-document-modal .modal-body').evaluate(el=>el.scrollHeight<=el.clientHeight+1),'PDF modal body must fit the viewport');
  assert(await page.locator('.pdf-document-modal [data-action="document-download"]').isVisible());
  await page.locator('[data-action="close-modal"]').last().click();
  await page.evaluate(()=>window.__mockUploads.delete('business-documents/qa/preview.pdf'));
  await page.locator(`[data-action="document-preview"][data-id="${id}"]`).click();
  await page.getByRole('alert').filter({hasText:'Archivo no encontrado'}).waitFor();
  await page.close();
 }
 console.log('PDF PREVIEW QA: painted pages, navigation, desktop/mobile modal geometry and visible missing-file errors verified.');
}finally{await browser.close()}
