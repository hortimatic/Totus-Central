import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {startLocalServer} from './local-static-server.mjs';
import {navigate} from './ui-navigation.mjs';
import {PDFDocument} from 'pdf-lib';
async function examplePdf(kind){
 const pdf=await PDFDocument.create(),p=pdf.addPage([620,800]),draw=(text,x,y)=>p.drawText(text,{x,y,size:10});
 if(kind==='supplier'){
  [['Descripción',40],['Cantidad',300],['Precio',360]].forEach(([s,x])=>draw(s,x,700));
  draw('Producto demostración 10 mg',40,650);draw('10',300,650);draw('2.00',360,650);
 }else{
  [['Nombre',20],['Ref',160],['Empleado',300],['Tipo',400],['Cantidad(8)',500]].forEach(([s,x])=>draw(s,x,700));
  draw('Producto demostración',20,650);draw('10 mg',20,638);draw('REF-1',180,650);draw('Prueba',300,650);draw('Añadido',400,650);draw('8',500,650);
 }
 return [...await pdf.save()];
}
const server=await startLocalServer();
const {chromium}=await import(process.env.TOTUS_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.TOTUS_BROWSER_CHANNEL?{channel:process.env.TOTUS_BROWSER_CHANNEL}:{})});
await mkdir('artifacts/stock-rules',{recursive:true});
try{
 for(const width of [390,1017,1440]){
  const page=await browser.newPage({viewport:{width,height:950}}),errors=[],ai=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/totus-ai|cohere|groq|cloudflare|generativelanguage/.test(r.url()))ai.push(r.url());});
  await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
  await page.evaluate(async()=>{
   const {sb}=await import('../src/api.js'),{stockSummary}=await import('../src/stock-core.js'),db=window.__mockDb,original=sb.rpc.bind(sb),store=db.ops_stores[0].id;
   const r={id:crypto.randomUUID(),store_id:store,supplier:'Proveedor de prueba',reference:'COTEJO-SIN-IA',received_on:'2026-11-04',revision:1,status:'pending',result:{rows:[],coverage:[],complete:false}};db.ops_stock_receipts=[r];
   db.ops_stock_sources=['supplier','prestashop'].map((kind,i)=>({id:crypto.randomUUID(),receipt_id:r.id,source_kind:kind,document_id:crypto.randomUUID(),extraction:{state:i?'partial':'ready'},extracted_text:'Referencia;Producto;Variante;Cantidad;Unidad\nREF-1;Producto demostración;10 mg;'+(i?'8':'10')+';uds'}));
   db.ops_documents=db.ops_stock_sources.map(s=>({id:s.document_id,original_name:s.source_kind+'.txt',storage_path:'demo/'+s.source_kind,store_id:store}));window.ruleQA={writes:[],failOnce:true};
   sb.rpc=async(name,p={})=>{
    if(name==='totus_stock_context'){if(window.ruleQA.failRead){window.ruleQA.failRead=false;return {data:null,error:{message:'Lectura temporalmente indisponible'}};}return {data:{receipt:structuredClone(r),sources:db.ops_stock_sources.map(s=>({...structuredClone(s),document:db.ops_documents.find(d=>d.id===s.document_id)})),equivalences:[]},error:null};}
    if(name==='totus_stock_save_result'){
     if(window.ruleQA.failOnce){window.ruleQA.failOnce=false;return {data:null,error:{message:'Fallo temporal de guardado de prueba'}};}
     if(p.p_revision!==r.revision)return {data:null,error:{message:'La recepción ha cambiado'}};
     window.ruleQA.writes.push(structuredClone(p));window.ruleQA.failRead=true;r.result=structuredClone(p.p_result);r.status=stockSummary(r.result,db.ops_stock_sources).status;r.revision++;db.ops_stock_revisions.push({id:crypto.randomUUID(),receipt_id:r.id,revision:r.revision,action:'result_saved',actor_email:'qa@example.invalid',created_at:new Date().toISOString()});return {data:structuredClone(r),error:null};
    }return original(name,p);
   };
  });
  if(width===1017)for(const kind of ['supplier','prestashop'])await page.evaluate(async({kind,bytes})=>{
   const {sb}=await import('../src/api.js'),db=window.__mockDb,source=db.ops_stock_sources.find(s=>s.source_kind===kind),doc=db.ops_documents.find(d=>d.id===source.document_id);
   doc.original_name=kind+'.pdf';source.extracted_text='Texto antiguo incompleto';source.extraction={state:'partial'};
   await sb.storage.from('business-documents').upload(doc.storage_path,new Blob([new Uint8Array(bytes)],{type:'application/pdf'}));
  },{kind,bytes:await examplePdf(kind)});
  await navigate(page,'cotejos');await page.locator('[data-action="stock-open"]').first().click();await page.getByRole('button',{name:'Cotejar factura con entrada · sin IA',exact:true}).click();
  if(width===1017)await page.locator('[data-rule-document]').first().waitFor();
  await page.locator('#stockRuleEditor').waitFor();assert.equal(await page.locator('[data-rule-line]').count(),2);
  await page.getByRole('button',{name:'Comparar documentos sin IA',exact:true}).click();await page.locator('[data-rule-error]').filter({hasText:'Confirma'}).waitFor();assert.equal(await page.evaluate(()=>ruleQA.writes.length),0);
  for(const section of await page.locator('[data-rule-document]').all()){await section.locator('[data-rule-note]').fill('He verificado el original completo, las líneas, sus variantes y sus unidades.');await section.locator('[data-rule-reviewed]').check();}
  await page.getByRole('button',{name:'Comparar documentos sin IA',exact:true}).click();await page.locator('.stock-rule-proposal').waitFor();assert.match(await page.locator('.stock-rule-proposal').innerText(),/Con diferencias/);assert.match(await page.locator('.stock-rule-results').innerText(),/-2/);
  await page.getByRole('button',{name:'Guardar cotejo sin IA',exact:true}).click();await page.locator('[data-rule-error]').filter({hasText:'Fallo temporal'}).waitFor();assert(await page.locator('.stock-rule-proposal').isVisible());
  await page.getByRole('button',{name:'Guardar cotejo sin IA',exact:true}).click();await page.locator('[data-rule-error]').filter({hasText:'El cotejo se ha guardado'}).waitFor();
  await page.getByRole('button',{name:'Guardar cotejo sin IA',exact:true}).click();await page.getByText('Cotejo sin IA guardado y comprobado en la recepción.',{exact:true}).waitFor();
  const saved=await page.evaluate(()=>ruleQA.writes);assert.equal(saved.length,1);assert.equal(saved[0].p_result.engine.uses_ai,false);assert.equal(saved[0].p_result.rows[0].prestashop_qty,8);assert.equal(saved[0].p_result.rows[0].supplier_qty,10);assert.equal(saved[0].p_result.rows[0].source_refs.length,2);
  if(width===1017){assert(saved[0].p_result.coverage.every(s=>s.reader==='pdfjs-columns-v2'));assert.equal(await page.evaluate(()=>__mockDb.ops_stock_sources[0].extracted_text),'Texto antiguo incompleto','Original sources must remain unchanged');}
  assert.equal(await page.evaluate(()=>__mockDb.ops_stock_receipts[0].revision),2);assert.equal(await page.locator('.stock-page').evaluate(e=>e.scrollWidth>e.clientWidth+2),false);assert.deepEqual(ai,[]);assert.deepEqual(errors,[]);
  await page.screenshot({path:'artifacts/stock-rules/receipt-'+width+'.png',fullPage:true});await page.close();console.log('PASS receipt no-AI:',width,'coverage, shortage, retry, one save, revision/history, no AI requests');
 }
}finally{await browser.close();await server?.close();}
