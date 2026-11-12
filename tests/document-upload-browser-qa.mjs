import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startLocalServer} from './local-static-server.mjs';
import {documentMimeType} from '../src/file-utils.js';
if(!process.env.CI)process.env.TOTUS_START_SERVER='1';
const server=await startLocalServer();
const browser=await chromium.launch({headless:true,...(process.env.TOTUS_CHROME?{channel:'chrome'}:{})});
try{
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Model the actual private bucket MIME contract, unlike the permissive mock.
 await page.route('**/tests/mock-supabase.js',async route=>{
  const res=await route.fetch();let source=await res.text();
  const needle='upload:async(path,file)=>{uploaded.set(bucket+\'/\'+path,file);';
  assert(source.includes(needle));
  source=source.replace(needle,`upload:async(path,file,options)=>{if(bucket==='business-documents'&&!['text/markdown','application/pdf','text/plain'].includes(options?.contentType))return {data:null,error:{message:'mime type is not supported'}};uploaded.set(bucket+'/'+path,file);`);
  await route.fulfill({response:res,body:source});
 });
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html');
 await page.locator('#nav [data-route=documentos]').click();
 await page.locator('[data-action=document-new]').click();
 await page.locator('#docFile').setInputFiles({name:'estudio.md',mimeType:'',buffer:Buffer.from('# Informe autorizado de prueba')});
 await page.getByRole('status').filter({hasText:'estudio.md'}).waitFor();
 await page.locator('[data-action=document-file-clear]').click();
 assert.equal(await page.locator('#docFile').evaluate(e=>e.files.length),0);
 await page.locator('[data-action=document-save]').click();
 await page.locator('#docUploadStatus').filter({hasText:'No se ha guardado: Selecciona un archivo'}).waitFor();
 await page.locator('#docFile').setInputFiles({name:'estudio.md',mimeType:'',buffer:Buffer.from('# Informe autorizado de prueba')});
 await page.locator('[data-action=document-save]').click();
 await page.getByRole('heading',{name:'estudio.md',exact:true}).waitFor();
 assert.equal(await page.evaluate(async()=>{const {state}=await import('../src/state.js');return state.data.documents.find(d=>d.original_name==='estudio.md').mime_type;}),'text/markdown');
 await page.locator('[data-action=document-back]').first().click();
 await page.locator('[data-action=document-new]').click();
 await page.locator('#docFile').setInputFiles({name:'informe.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 fixture')});
 await page.locator('[data-action=document-save]').click();
 await page.getByRole('heading',{name:'informe.pdf',exact:true}).waitFor();
 assert.equal(await page.evaluate(async()=>{const {state}=await import('../src/state.js');return state.data.documents.filter(d=>['estudio.md','informe.pdf'].includes(d.original_name)).length;}),2);
 assert.equal(documentMimeType({name:'datos.csv',type:'application/octet-stream'}),'text/csv');
 assert.equal(documentMimeType({name:'unknown.exe',type:''}),'application/octet-stream');
 // UI must fit ordinary narrow and wide screens without a second page scrollbar.
 for(const width of [390,1017,1440]){
  await page.setViewportSize({width,height:800});
  assert(await page.locator('.document-file-selection').isVisible());
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }
 assert.deepEqual(errors,[]);
 console.log('DOCUMENT UPLOAD QA: empty MIME Markdown, PDF, clear selection, visible error, saved record/MIME readback and three widths passed (isolated fixture, no production writes).');
}finally{await browser.close();if(server)await new Promise(r=>server.close(r));}
