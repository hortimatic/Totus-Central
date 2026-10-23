import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await page.evaluate(async()=>{
  const {sb}=await import('../src/api.js'),db=window.__mockDb,original=sb.rpc.bind(sb);
  for(const name of ['ops_stock_receipts','ops_stock_sources','ops_stock_revisions','ops_stock_equivalences'])db[name]=[];
  const clone=v=>structuredClone(v);
  sb.rpc=async(name,p={})=>{
   if(!name.startsWith('totus_stock_'))return original(name,p);
   const r=db.ops_stock_receipts.find(r=>r.id===p.p_id);
   const revision=(r,action)=>db.ops_stock_revisions.push({id:crypto.randomUUID(),receipt_id:r.id,revision:r.revision,action,actor_email:'qa@example.com',created_at:new Date().toISOString()});
   if(name==='totus_stock_create'){
    const next={id:crypto.randomUUID(),store_id:p.p_store,supplier:p.p_supplier,reference:p.p_reference,received_on:p.p_date,notes:p.p_notes,revision:1,status:'pending',result:{rows:[],coverage:[],complete:false}};
    db.ops_stock_receipts.push(next);revision(next,'created');return {data:clone(next),error:null};
   }
   if(name==='totus_stock_context')return {data:{receipt:clone(r),sources:db.ops_stock_sources.filter(s=>s.receipt_id===r.id).map(s=>({...clone(s),document:clone(db.ops_documents.find(d=>d.id===s.document_id))})),equivalences:[]},error:null};
   if(name==='totus_stock_edit'){
    Object.assign(r,{store_id:p.p_store,supplier:p.p_supplier,reference:p.p_reference,received_on:p.p_date,notes:p.p_notes,status:'pending',result:{rows:[],coverage:[],complete:false},revision:r.revision+1});revision(r,'edited');return {data:clone(r),error:null};
   }
   if(name==='totus_stock_add_source'){
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
 await page.locator('#stockSupplier').fill('Proveedor prueba');
 await page.locator('#stockReference').fill('Pedido <QA>');
 await page.locator('[data-action="stock-create-save"]').click();
 await page.getByText('Recepción creada. Añade los documentos.',{exact:true}).waitFor();
 await page.locator('#stockFiles').setInputFiles({name:'proveedor.txt',mimeType:'text/plain',buffer:Buffer.from('Referencia A; Producto A; 10 unidades')});
 await page.locator('[data-action="stock-upload-save"]').click();
 await page.getByText('proveedor.txt',{exact:true}).waitFor();
 await page.locator('#stockKind').selectOption('prestashop');
 await page.locator('#stockFiles').setInputFiles({name:'entrada.txt',mimeType:'text/plain',buffer:Buffer.from('Referencia A; Producto A; 10 unidades recibidas')});
 await page.locator('[data-action="stock-upload-save"]').click();
 await page.getByText('entrada.txt',{exact:true}).waitFor();
 assert.equal(await page.locator('.stock-source').count(),2);
 await page.locator('[data-action="stock-text"]').first().click();assert((await page.locator('.stock-text').innerText()).includes('10 unidades'));
 await page.locator('[data-action="close-modal"]').filter({visible:true}).last().click();
 await page.locator('[data-action="stock-prompt-view"]').click();assert((await page.locator('#modalHost textarea').inputValue()).includes('totus_stock_context'));
 await page.locator('[data-action="close-modal"]').filter({visible:true}).last().click();
 const financial=await page.evaluate(()=>JSON.stringify([window.__mockDb.ops_expenses,window.__mockDb.ops_daily_closings,window.__mockDb.ops_sales_invoices]));
 assert.equal(financial,'[[],[],[]]','Receipts must not create accounting entries');
 await page.evaluate(()=>{
  const db=window.__mockDb,r=db.ops_stock_receipts[0],sources=db.ops_stock_sources;
  r.status='matched';r.result={complete:true,coverage:sources.map(s=>({source_id:s.id,complete:true,explanation:'Test read'})),rows:[{id:'r1',supplier_name:'Producto A',prestashop_name:'Producto A PS',variant:'Variante QA',unit:'unidad',unit_factor:1,unit_confirmed:true,match_confirmed:true,supplier_qty:10,prestashop_qty:10,adjustment_qty:0,adjustment_included:'no',source_refs:sources.map(s=>({source_id:s.id,locator:'Fila 1',line_id:'r1'}))}]};
 });
 await page.locator('[data-action="stock-refresh"]').click();await page.getByText('Producto A PS',{exact:true}).waitFor();
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'No page overflow');
  assert(await page.locator('[data-action="stock-upload-save"]').isVisible());
 }
 await page.setViewportSize({width:1440,height:1000});
 await page.locator('[data-action="stock-source-remove"]').last().click();await page.locator('#modalHost [data-confirm="accept"]').click();
 await page.getByText('entrada.txt',{exact:true}).waitFor({state:'hidden'});
 assert.equal(await page.locator('.stock-source').count(),1);
 assert.equal(await page.getByText('Producto A PS',{exact:true}).count(),0);
 assert.equal(await page.evaluate(()=>window.__mockDb.ops_documents.length),2,'Unlink must preserve originals');
 await page.locator('[data-action="stock-edit"]').click();await page.locator('#stockEditSupplier').fill('Proveedor corregido');await page.locator('[data-action="stock-edit-save"]').click();await page.getByText('Recepción actualizada. Revisa el cotejo.',{exact:true}).waitFor();
 await page.locator('[data-action="stock-back"]').click();await page.locator('#stockQuery').fill('inexistente');await page.locator('[data-action="stock-search"]').click();await page.getByText('Sin recepciones',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);
 console.log('STOCK BROWSER: receipt, both uploads, readable text, ChatGPT instruction, result refresh, safe unlink, search, accounting isolation and mobile layout OK');
}catch(error){console.log('STOCK BROWSER FAILURE',await page.locator('#modalHost').innerText(),await page.locator('#toastHost').innerText(),errors);throw error;}finally{await browser.close()}
