import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
import XLSX from 'xlsx-js-style';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await page.evaluate(async()=>{
  const {sb}=await import('../src/api.js'),db=window.__mockDb,original=sb.rpc.bind(sb);
  for(const name of ['ops_stock_receipts','ops_stock_sources','ops_stock_revisions','ops_stock_equivalences'])db[name]=[];
  const clone=v=>structuredClone(v);
  db.ops_suppliers=[{id:crypto.randomUUID(),name:'Proveedor previo',active:true},{id:crypto.randomUUID(),name:'Proveedor corregido',active:true}];
  const {state}=await import('../src/state.js');state.data.suppliers=clone(db.ops_suppliers);
  sb.rpc=async(name,p={})=>{
   if(!name.startsWith('totus_stock_'))return original(name,p);
   const r=db.ops_stock_receipts.find(r=>r.id===p.p_id);
   const revision=(r,action)=>db.ops_stock_revisions.push({id:crypto.randomUUID(),receipt_id:r.id,revision:r.revision,action,actor_email:'qa@example.com',created_at:new Date().toISOString()});
   if(name==='totus_stock_create'){
    const next={id:crypto.randomUUID(),store_id:p.p_store,supplier:p.p_supplier,reference:p.p_reference,received_on:p.p_date,notes:p.p_notes,revision:1,status:'pending',result:{rows:[],coverage:[],complete:false}};
    db.ops_stock_receipts.push(next);revision(next,'created');return {data:clone(next),error:null};
   }
   if(name==='totus_stock_context')return {data:{receipt:clone(r),sources:db.ops_stock_sources.filter(s=>s.receipt_id===r.id).map(s=>({...clone(s),document:clone(db.ops_documents.find(d=>d.id===s.document_id))})),equivalences:clone(db.ops_stock_equivalences)},error:null};
   if(name==='totus_stock_confirm_equivalence'){
    const e={id:crypto.randomUUID(),store_id:p.p_store,supplier:p.p_supplier,supplier_name:p.p_supplier_name,prestashop_name:p.p_prestashop_name,variant:p.p_variant,unit:p.p_unit,unit_factor:p.p_factor,evidence:p.p_evidence,confirmed_at:new Date().toISOString()};db.ops_stock_equivalences.push(e);return {data:e.id,error:null};
   }
   if(name==='totus_stock_edit'){
    Object.assign(r,{store_id:p.p_store,supplier:p.p_supplier,reference:p.p_reference,received_on:p.p_date,notes:p.p_notes,status:'pending',result:{rows:[],coverage:[],complete:false},revision:r.revision+1});revision(r,'edited');return {data:clone(r),error:null};
   }
   if(name==='totus_stock_add_source'){
    if(window.__stockFailOnce){window.__stockFailOnce=false;return {data:null,error:{message:'Fallo temporal QA'}};}
    if(r.revision!==p.p_revision)return {data:null,error:{message:'La recepción ha cambiado'}};
    db.ops_stock_sources.push({id:crypto.randomUUID(),receipt_id:r.id,document_id:p.p_document,source_kind:p.p_kind,extracted_text:p.p_text,extraction:p.p_extraction});
    r.revision++;r.status='pending';revision(r,'source_added');return {data:clone(r),error:null};
   }
   if(name==='totus_stock_remove_source'){
    db.ops_stock_sources=db.ops_stock_sources.filter(s=>s.id!==p.p_source);r.revision++;r.status='pending';r.result={rows:[],coverage:[],complete:false};revision(r,'source_removed');return {data:clone(r),error:null};
   }
   return {data:null,error:{message:'Missing mock RPC'}};
  };
 });
 const nav=()=>page.locator('#nav [data-route="cotejos"]').click();
 await nav();await page.getByText('Sin recepciones',{exact:true}).waitFor();
 await page.locator('[data-action="stock-new"]').click();
 assert.equal(await page.locator('[data-action="stock-back"]').getAttribute('class'),'btn link','Back link uses the same record navigation as Pricing/invoices');
 await page.locator('#stockSupplier').selectOption({label:'Proveedor previo'});
 await page.locator('#stockReference').fill('Factura de prueba 26000000 · pedido 690000 <QA>');
 await page.locator('#stockDate').fill('2026-01-15');
 await page.locator('#stockNewSupplierFiles').setInputFiles({name:'proveedor.txt',mimeType:'text/plain',buffer:Buffer.from('Referencia A; Producto A; 10 unidades')});
 await page.locator('#stockNewPrestashopFiles').setInputFiles({name:'entrada.txt',mimeType:'text/plain',buffer:Buffer.from('Referencia A; Producto A; 10 unidades recibidas')});
 await page.locator('[data-action="stock-supplier-new"]').click();
 assert.equal(await page.locator('#stockSupplierName').evaluate(el=>getComputedStyle(el).borderRadius),'9px','Quick supplier uses the shared form style');
 await page.locator('#stockSupplierName').fill('Proveedor de mercancía · Distribuciones y suministros de la tienda');
 await page.locator('[data-action="stock-supplier-save"]').click();
 await page.getByText('Proveedor seleccionado. Puedes continuar con los documentos.',{exact:true}).waitFor();
 assert.equal(await page.locator('#stockNewSupplierFiles').evaluate(e=>e.files.length),1,'Quick supplier must preserve chosen files');
 assert.equal(await page.locator('#stockNewPrestashopFiles').evaluate(e=>e.files.length),1);
 assert.equal(await page.locator('#stockReference').inputValue(),'Factura de prueba 26000000 · pedido 690000 <QA>');
 await page.locator('[data-action="stock-create-save"]').click();
 await page.getByText('2 archivo(s) asociados.',{exact:true}).waitFor();
 assert.equal(await page.locator('.stock-source').count(),2);
 await page.locator('[data-action="stock-preview"]').first().click();
 await page.locator('#modalHost').getByText(/10 unidades/).waitFor();
 assert((await page.locator('#modalHost').innerText()).includes('10 unidades'));
 await page.locator('[data-action="close-modal"]').filter({visible:true}).last().click();
 await page.locator('[data-action="stock-text"]').first().click();assert((await page.locator('.stock-text').innerText()).includes('10 unidades'));
 await page.locator('[data-action="close-modal"]').filter({visible:true}).last().click();
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.__stockClipboard=text}}));
 await page.locator('[data-action="stock-prompt"]').click();await page.waitForFunction(()=>typeof window.__stockClipboard==='string');
 const copiedPrompt=await page.evaluate(()=>window.__stockClipboard);assert(copiedPrompt.includes('totus_stock_context'));
 await page.locator('[data-action="stock-prompt-view"]').click();assert.equal(await page.locator('#modalHost textarea').inputValue(),copiedPrompt);
 await page.locator('[data-action="close-modal"]').filter({visible:true}).last().click();
 await page.evaluate(()=>navigator.clipboard.writeText=async()=>{throw Error('Portapapeles denegado en ensayo');});
 await page.locator('[data-action="stock-prompt"]').click();assert.equal(await page.locator('#modalHost textarea').inputValue(),copiedPrompt,'Denied clipboard must offer the same instruction for manual copy');
 await page.locator('[data-action="close-modal"]').filter({visible:true}).last().click();
 await page.locator('[data-action="stock-evidence"]').click();assert((await page.locator('#modalHost textarea').inputValue()).includes('proveedor.txt'));
 await page.locator('[data-action="close-modal"]').filter({visible:true}).last().click();
 const financial=await page.evaluate(()=>JSON.stringify([window.__mockDb.ops_expenses,window.__mockDb.ops_daily_closings,window.__mockDb.ops_sales_invoices]));
 assert.equal(financial,'[[],[],[]]','Receipts must not create accounting entries');
 await page.evaluate(()=>{
  const db=window.__mockDb,r=db.ops_stock_receipts[0],sources=db.ops_stock_sources;
  r.status='matched';r.result={complete:true,coverage:sources.map(s=>({source_id:s.id,complete:true,explanation:'Test read'})),rows:[{id:'r1',supplier_name:'Producto A',prestashop_name:'Producto A PS',variant:'Variante QA',unit:'unidad',unit_factor:1,unit_confirmed:true,match_confirmed:true,supplier_qty:10,prestashop_qty:10,adjustment_qty:0,adjustment_included:'no',source_refs:sources.map(s=>({source_id:s.id,locator:'Fila 1',line_id:'r1'}))}]};
 });
 await page.locator('[data-action="stock-refresh"]').click();await page.getByText('Producto A PS',{exact:true}).waitFor();
 for(const width of [1440,1024,890,820,800,390]){
  await page.setViewportSize({width,height:1000});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'No page overflow');
  assert(await page.locator('[data-action="stock-upload-save"]').isVisible());
 }
 await page.setViewportSize({width:1440,height:1000});
 const htmlDownload=page.waitForEvent('download');await page.locator('[data-action="stock-export-html"]').click();
 const html=await readFile(await (await htmlDownload).path(),'utf8');
 assert(html.includes('Producto A PS')&&html.includes('&lt;QA&gt;'),'Readable report must preserve result and escape values');
 const excelDownload=page.waitForEvent('download');await page.locator('[data-action="stock-export-xlsx"]').click();
 const book=XLSX.read(await readFile(await (await excelDownload).path()),{type:'buffer'});
 assert.deepEqual(book.SheetNames,['Cotejo','Documentos']);
 const exported=XLSX.utils.sheet_to_json(book.Sheets.Cotejo);
 assert.equal(exported[0]['Unidades esperadas'],10);assert.equal(exported[0]['Diferencia'],0);
 await page.locator('[data-action="stock-equivalence-new"]').click();
 await page.locator('#stockEquivalenceEvidence').fill('Confirmación expresa QA: misma referencia, variante y unidad.');
 await page.locator('#stockEquivalenceConfirmed').check();
 await page.locator('[data-action="stock-equivalence-save"]').click();await page.getByText('Equivalencia guardada para futuros cotejos.',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.__mockDb.ops_stock_equivalences.length),1);
 await page.locator('[data-action="stock-source-remove"]').last().click();await page.locator('#modalHost [data-confirm="accept"]').click();
 await page.getByText('entrada.txt',{exact:true}).waitFor({state:'hidden'});
 assert.equal(await page.locator('.stock-source').count(),1);
 assert.equal(await page.getByText('Producto A PS',{exact:true}).count(),0);
 assert.equal(await page.evaluate(()=>window.__mockDb.ops_documents.length),2,'Unlink must preserve originals');
 await page.locator('summary').filter({hasText:'Usar un documento ya guardado'}).click();
 const unlinked=await page.evaluate(()=>window.__mockDb.ops_documents.find(d=>d.original_name==='entrada.txt').id);
 await page.locator('#stockExisting').selectOption(unlinked);await page.locator('[data-action="stock-existing-save"]').click();
 await page.getByText('Documento asociado.',{exact:true}).waitFor();
 assert.equal(await page.locator('.stock-source').count(),2);assert.equal(await page.evaluate(()=>window.__mockDb.ops_documents.length),2,'Reuse must not upload a second original');
 await page.locator('[data-action="stock-edit"]').click();await page.locator('#stockEditSupplier').selectOption({label:'Proveedor corregido'});await page.locator('[data-action="stock-edit-save"]').click();await page.getByText('Recepción actualizada. Revisa el cotejo.',{exact:true}).waitFor();
 await page.locator('[data-action="stock-back"]').click();await page.locator('#stockQuery').fill('inexistente');await page.locator('#stockQuery').press('Enter');await page.getByText('Sin recepciones',{exact:true}).waitFor();
 await page.locator('[data-action="stock-filter-clear"]').click();
 await page.evaluate(()=>{const db=window.__mockDb,r=db.ops_stock_receipts[0];db.ops_stock_receipts.push({...structuredClone(r),id:crypto.randomUUID(),reference:'Pedido febrero QA',received_on:'2026-02-20'});});
 await page.locator('[data-action="stock-refresh"]').click();await page.getByText('Pedido febrero QA',{exact:true}).waitFor();
 await page.locator('#stockFrom').fill('2026-01-15');await page.locator('#stockTo').fill('2026-01-15');await page.locator('[data-action="stock-search"]').click();
 await page.getByText('Pedido febrero QA',{exact:true}).waitFor({state:'hidden'});
 assert.equal(await page.locator('[data-action="stock-open"]').count(),1,'Date boundaries inclusive');
 await page.locator('#stockFrom').fill('2026-01-01');await page.locator('#stockTo').fill('2026-02-28');await page.locator('[data-action="stock-search"]').click();
 await page.getByText('Pedido febrero QA',{exact:true}).waitFor();
 assert.equal(await page.locator('[data-action="stock-open"]').count(),2,'Range across months');
 await page.locator('#stockQuery').fill('inexistente');await page.locator('#stockQuery').press('Enter');await page.getByText('Sin recepciones',{exact:true}).waitFor();
 await page.locator('[data-action="stock-filter-clear"]').click();
 await page.locator('[data-action="stock-library"]').click();await page.getByText('Biblioteca de productos',{exact:true}).waitFor();
 await page.locator('[data-action="stock-library-refresh"]').click();await page.getByText('Biblioteca de productos',{exact:true}).waitFor();
 await page.getByText('Producto A PS',{exact:true}).waitFor();
 await page.locator('#stockLibraryQuery').fill('inexistente');await page.locator('#stockLibraryQuery').press('Enter');await page.getByText('Sin equivalencias',{exact:true}).waitFor();
 await page.locator('#stockLibraryQuery').fill('Producto A');await page.locator('#stockLibraryQuery').press('Enter');await page.getByText('Producto A PS',{exact:true}).waitFor();
 await page.locator('[data-action="stock-back"]').click();
 assert.equal(await page.locator('#stockFrom').inputValue(),'','Back preserves cleared filters');
 await page.locator('[data-action="stock-open"]').last().click();await page.locator('#stockFiles').waitFor();
 await page.locator('#stockFiles').setInputFiles({name:'reintento.txt',mimeType:'text/plain',buffer:Buffer.from('Otra línea QA')});
 await page.evaluate(()=>window.__stockFailOnce=true);
 await page.locator('[data-action="stock-upload-save"]').click();
 await page.locator('[data-action="stock-upload-retry-save"]').waitFor();
 const receiptCount=await page.evaluate(()=>window.__mockDb.ops_stock_receipts.length),docCount=await page.evaluate(()=>window.__mockDb.ops_documents.length);
 await page.locator('[data-action="stock-upload-retry-save"]').click();await page.locator('[data-action="stock-upload-retry-save"]').waitFor({state:'hidden'});
 assert.equal(await page.evaluate(()=>window.__mockDb.ops_stock_receipts.length),receiptCount,'Retry must not duplicate receipt');
 assert.equal(await page.evaluate(()=>window.__mockDb.ops_documents.length),docCount,'Retry reuses already uploaded document');
 await page.locator('#stockFiles').setInputFiles({name:'pendiente-descartar.txt',mimeType:'text/plain',buffer:Buffer.from('Original ficticio sin asociar')});
 await page.evaluate(()=>window.__stockFailOnce=true);
 await page.locator('[data-action="stock-upload-save"]').click();await page.locator('[data-action="stock-upload-discard"]').waitFor();
 const preserved=await page.evaluate(()=>window.__mockDb.ops_documents.length);
 await page.locator('[data-action="stock-upload-discard"]').click();await page.locator('#modalHost [data-confirm="accept"]').click();
 await page.locator('[data-action="stock-upload-retry-save"]').waitFor({state:'hidden'});
 assert.equal(await page.evaluate(()=>window.__mockDb.ops_documents.length),preserved,'Discarding pending association must preserve uploaded originals');
 assert.equal(await page.evaluate(()=>JSON.stringify([window.__mockDb.ops_expenses,window.__mockDb.ops_daily_closings,window.__mockDb.ops_sales_invoices])),'[[],[],[]]');
 await page.evaluate(async()=>{
  const {state}=await import('../src/state.js');
  state.data.documents.push({id:'pending-selector-qa',original_name:'Original en retirada QA',store_id:null});
  state.data.documentRemovals.push({id:'pending-selector-qa',storage_path:'qa-only/pending.txt'});
 });
 await page.locator('[data-action="stock-refresh"]').click();await page.locator('#stockExisting').waitFor({state:'attached'});
 assert.equal(await page.locator('#stockExisting option[value="pending-selector-qa"]').count(),0,'A retiring original must not be offered for a new association');
 await page.locator('#nav [data-route="administracion"]').click();
 await page.locator('[data-action="admin-section"][data-section="log"]').click();
 await page.locator('[data-action="admin-log-refresh"]').click();await page.getByText('Eventos actualizados.',{exact:true}).last().waitFor();
 await page.locator('#logArea').selectOption('recepciones');await page.locator('#logQuery').fill('Historial de recepciones');await page.locator('[data-action="admin-log-filter"]').click();
 assert.equal(await page.locator('[data-action="admin-log-detail"]').count(),await page.evaluate(()=>window.__mockDb.ops_stock_revisions.length),'General log must include each existing receipt revision once');
 await page.locator('[data-action="admin-log-detail"]').first().click();
 assert((await page.locator('#modalHost').innerText()).includes('Historial de recepciones'));
 assert.deepEqual(errors,[]);
 console.log('STOCK BROWSER: receipt, both uploads, readable text, ChatGPT instruction, result refresh, safe unlink, search, accounting isolation and mobile layout OK');
}catch(error){console.log('STOCK BROWSER FAILURE',await page.locator('#modalHost').innerText(),await page.locator('#toastHost').innerText(),errors);throw error;}finally{await browser.close()}
