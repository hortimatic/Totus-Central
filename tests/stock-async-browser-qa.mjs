import {clickModuleLink} from './ui-navigation.mjs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true}),page=await browser.newPage();
try{
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await clickModuleLink(page,page.locator('#nav [data-route="cotejos"]'));await page.getByText('Sin recepciones',{exact:true}).waitFor();
 await page.locator('[data-action="stock-library"]').click();await page.getByText('Biblioteca de productos',{exact:true}).waitFor();
 await page.evaluate(async()=>{
  const {sb}=await import('../src/api.js'),from=sb.from.bind(sb);
  sb.from=table=>{
   const q=from(table),then=q.then.bind(q);
   q.then=(resolve,reject)=>{
    if(table==='ops_stock_equivalences'&&window.delayLibrary){window.delayLibrary=false;window.releaseLibrary=()=>then(resolve,reject);return;}
    return then(resolve,reject);
   };return q;
  };
 });
 const delayedRefresh=async()=>{
  await page.evaluate(()=>{window.delayLibrary=true;window.releaseLibrary=null;});
  await page.locator('[data-action="stock-library-refresh"]').click();
  await page.waitForFunction(()=>typeof window.releaseLibrary==='function');
 };
 await delayedRefresh();const field=await page.locator('#stockLibraryQuery').elementHandle();
 await page.locator('#stockLibraryQuery').fill('Búsqueda escrita mientras carga');
 await page.locator('#stockLibraryQuery').evaluate(el=>el.setSelectionRange(3,8));
 await page.evaluate(()=>window.releaseLibrary());await page.waitForFunction(el=>!el.isConnected,field);
 assert.equal(await page.locator('#stockLibraryQuery').inputValue(),'Búsqueda escrita mientras carga','A late library refresh erased the query being written');
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'stockLibraryQuery','A late library refresh must preserve keyboard focus while typing');
 assert.deepEqual(await page.locator('#stockLibraryQuery').evaluate(el=>[el.selectionStart,el.selectionEnd]),[3,8],'The selected text must survive a late refresh');
 await page.locator('#stockLibraryQuery').press('Enter');assert.equal(await page.evaluate(()=>document.activeElement?.id),'stockLibraryQuery','Applying a library query with Enter must keep the search usable');
 await delayedRefresh();await page.locator('[data-action="stock-back"]').click();await page.getByText('Recepciones de mercancía',{exact:true}).waitFor();
 await page.evaluate(()=>window.releaseLibrary());await page.waitForTimeout(100);
 assert.equal(await page.getByRole('heading',{name:'Biblioteca de productos',exact:true}).count(),0,'A completed old read reopened the library after leaving it');
 await page.evaluate(async()=>{
  const {sb}=await import('../src/api.js'),rpc=sb.rpc.bind(sb),db=window.__mockDb;
  for(const id of ['receipt-a','receipt-b'])db.ops_stock_receipts.push({id,store_id:db.ops_stores[0].id,supplier:id==='receipt-a'?'Proveedor A ficticio':'Proveedor B ficticio',reference:id,received_on:'2026-01-15',revision:1,status:'pending',notes:'',result:{rows:[],coverage:[],complete:false}});
  sb.rpc=async(name,args)=>{
   if(name!=='totus_stock_context')return rpc(name,args);
   const response={data:{receipt:structuredClone(db.ops_stock_receipts.find(r=>r.id===args.p_id)),sources:[],equivalences:[]},error:null};
   if(args.p_id==='receipt-a')return new Promise(resolve=>window.releaseReceiptA=()=>resolve(response));
   return response;
  };
 });
 await page.locator('[data-action="stock-refresh"]').click();await page.locator('[data-action="stock-open"][data-id="receipt-a"]').waitFor();
 await page.locator('[data-action="stock-open"][data-id="receipt-a"]').click();await page.waitForFunction(()=>typeof window.releaseReceiptA==='function');
 await page.locator('[data-action="stock-open"][data-id="receipt-b"]').click();await page.getByRole('heading',{name:/Proveedor B ficticio/}).waitFor();
 await page.evaluate(()=>window.releaseReceiptA());await page.waitForTimeout(100);
 assert.equal(await page.getByRole('heading',{name:/Proveedor A ficticio/}).count(),0,'An older receipt response replaced the newer selection');
 assert.equal(await page.getByRole('heading',{name:/Proveedor B ficticio/}).count(),1);
 await page.locator('[data-action="stock-back"]').click();await page.locator('[data-action="stock-library"]').click();await page.getByRole('heading',{name:'Biblioteca de productos',exact:true}).waitFor();
 await delayedRefresh();
 await page.evaluate(async()=>{
  const {state}=await import('../src/state.js');state.user={...state.user,email:'another-qa@example.invalid'};
  const {stockPage}=await import('../src/stock-ui.js');document.getElementById('content').innerHTML=stockPage();
 });
 await page.evaluate(()=>window.releaseLibrary());await page.waitForTimeout(100);
 assert.equal(await page.getByRole('heading',{name:'Biblioteca de productos',exact:true}).count(),0,'A read started by another identity repopulated its cached view');
 assert.equal(await page.locator('#content').getByRole('heading',{name:'Recepciones de mercancía',exact:true}).count(),1);
 assert.equal(await page.locator('[data-action="stock-open"]').count(),0,'The new identity inherited cached receipt rows');
 console.log('STOCK ASYNC UI: delayed refresh preserves typed query and cannot reopen a page after navigation');
}finally{await browser.close()}
