import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer();
const {chromium}=await import('playwright');
const browser=await chromium.launch({headless:true,channel:process.env.TOTUS_BROWSER_CHANNEL||'msedge'}),report=[];
await mkdir('qa-artifacts',{recursive:true});
try{for(const width of [390,768,1440]){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/tests/prestashop-harness.html');await page.addStyleTag({url:'http://127.0.0.1:4173/src/productos.css'});
 await page.evaluate(async()=>{
  const {createProductosUI,productosWorkspacePage}=await import('../src/productos-ui.js');document.querySelector('#chatHarness').innerHTML=productosWorkspacePage();
  const q=window.tableQA={calls:[],item:{id:'42',name:'pruebas · simulación',reference:'QA-42',ean13:'',price:'10',wholesale_price:'4',active:'0',id_tax_rules_group:'0',associations:{images:[],combinations:[]}}};
  const invoke=async b=>{q.calls.push(structuredClone(b));const out={ok:true,store:b.store,resource:b.resource,record_id:b.record_id};
   if(b.action==='prestashop_product_create_profile')return {...out,persisted:false,language_ids:['1','2']};
   if(b.action==='prestashop_product_step_prepare')return {...out,persisted:false,can_commit:true,fingerprint:'b'.repeat(64)};
   if(b.action==='prestashop_product_step_commit'){q.item=null;return {...out,record_id:b.product_id,persisted:true,verified:true,deleted:true};}
   if(b.action==='prestashop_product_prepare')return {...out,can_commit:true,fingerprint:'a'.repeat(64),changes:b.changes.map(c=>({...c,before:q.item[c.field],after:c.value,changed:String(q.item[c.field])!==c.value}))};
   if(b.action==='prestashop_product_commit'){for(const c of b.changes)q.item[c.field]=c.value;return {...out,persisted:true,verified:true};}
   if(b.action==='prestashop_item_read')return {...out,item:structuredClone(q.item)};
   if(b.action==='prestashop_read'){const auxiliary=['manufacturers','categories'].includes(b.resource)?Array.from({length:15},(_,i)=>({id:String(i+1),name:'Opción '+i})):[];return {...out,page:b.page,possibly_more:false,rows:b.resource==='products'?(q.item?[structuredClone(q.item)]:[]):auxiliary};}throw Error(b.action);
  };
  
  // Stable identity throughout this fixture's authenticated session.
  const owner=crypto.randomUUID();q.ui=createProductosUI({actor:()=>owner,allowed:()=>true,canEdit:()=>true,rpc:async()=>({connections:[{id:'1',name:'PrestaShop · Hortimatic',protocol:'prestashop',enabled:true,configured:true,revision:1,verified_revision:1,real_data_authorized:true}]}),invoke});await q.ui.mount(document.querySelector('#productosRoot'));
 });
 await page.getByRole('button',{name:'Editar fila',exact:true}).click();
 await page.locator('[data-pr-table-field="reference"]').fill('QA-EDITADA');await page.locator('[data-pr-table-field="reference"]').blur();await page.evaluate(async()=>await tableQA.ui.mount(document.querySelector('#productosRoot')));await page.locator('[data-pr-table-field="reference"]').waitFor();assert.equal(await page.locator('[data-pr-table-field="reference"]').inputValue(),'QA-EDITADA');assert.equal(await page.evaluate(()=>tableQA.calls.some(c=>c.action.endsWith('_commit'))),false);
 await page.getByRole('button',{name:'Revisar',exact:true}).click();await page.getByRole('button',{name:'Guardar cambios',exact:true}).click();await page.getByText(/guardado y releído/).waitFor();
 assert.equal(await page.evaluate(()=>tableQA.item.reference),'QA-EDITADA');assert.equal(await page.getByRole('button',{name:'Editar fila',exact:true}).count(),1);
 await page.locator('.prd-row-menu summary').click();await page.getByRole('button',{name:'Archivar (desactivar)',exact:true}).click();await page.getByRole('button',{name:'Guardar cambios',exact:true}).click();await page.getByText(/guardado y releído/).waitFor();assert.equal(await page.evaluate(()=>tableQA.item.visibility),'none');assert.equal(await page.evaluate(()=>tableQA.item.available_for_order),'0');
 const last=page.locator('.prd-catalog-table tbody tr td').last();await last.focus();await last.press('ArrowLeft');assert.equal(await page.evaluate(()=>document.activeElement.cellIndex),await last.evaluate(n=>n.cellIndex-1));await page.locator('.prd-catalog-table tbody td').first().press('End');await page.waitForFunction(()=>{const n=document.querySelector('.prd-catalog-table');return n.scrollWidth<=n.clientWidth||n.scrollLeft>0;});
 const identity=await page.locator('.prd-catalog-table').evaluate(v=>{const n=v.querySelector('td[data-label="Producto"]'),r=n.getBoundingClientRect(),b=v.getBoundingClientRect();return {left:r.left,right:r.right,viewportLeft:b.left,viewportRight:b.right};});
 assert(identity.left>=identity.viewportLeft&&identity.right<=identity.viewportRight,'Product identity remains visible at the last columns');
 await page.getByRole('button',{name:'Buscar en Todas las marcas',exact:true}).click();const filter=page.locator('[data-pr-select-search]').first();await filter.fill('Opción 12');assert.equal(await page.locator('.prd-select-option:visible').count(),1);await page.getByRole('button',{name:'Cerrar selector',exact:true}).click();
 await page.evaluate(async()=>{const {applyInterfaceAppearance}=await import('../src/appearance-ui.js');applyInterfaceAppearance({primary:'#8040c0',card:'#202530',text:'#ffffff',bg:'#10141a',radius:18,borderWidth:3},true);});
 assert.equal(await page.locator('.prd-stitch').evaluate(n=>getComputedStyle(n).color),'rgb(255, 255, 255)');
 assert.equal(await page.evaluate(()=>document.querySelector('#productosRoot').scrollWidth>innerWidth+2),false);assert.deepEqual(errors,[]);
 await page.locator('.prd-row-menu summary').click();await page.getByRole('button',{name:'Duplicar producto',exact:true}).click();await page.getByText(/Duplicado preparado en borrador/).waitFor();assert.equal(await page.locator('[data-pr-value="reference"]').inputValue(),'QA-EDITADA-COPIA');assert.equal(await page.evaluate(()=>tableQA.calls.filter(c=>c.action==='prestashop_product_create_commit').length),0);
 await page.getByRole('tab',{name:/1\. Catálogo General/}).click();await page.locator('.prd-row-menu summary').click();await page.getByRole('button',{name:'Eliminar producto',exact:true}).click();await page.locator('[data-pr-stage-remove-confirm]').fill('ELIMINAR 42');await page.locator('[data-pr-stage-remove-confirm]').blur();await page.getByRole('button',{name:'Validar esta etapa',exact:true}).click();await page.getByText('Etapa validada sin escribir.',{exact:true}).waitFor();await page.getByRole('button',{name:'Guardar esta etapa',exact:true}).click();await page.getByText(/eliminado y ausencia verificada/).waitFor();assert.equal(await page.locator('.prd-catalog-table tbody tr').count(),0);
 report.push({width,mode:'simulation',passed:['table_edit_save_readback','archive_save','keyboard_columns','filter_native_select','interface_preferences','no_page_overflow','duplicate_draft','delete_review_and_absence'],writes:await page.evaluate(()=>tableQA.calls.filter(c=>c.action.endsWith('_commit')).length)});await page.screenshot({path:'qa-artifacts/productos-table-'+width+'.png',fullPage:true});await page.close();
}}finally{await browser.close();await server?.close();await writeFile('qa-artifacts/productos-table-report.json',JSON.stringify(report,null,2));}
console.log('Products table: edit/save/readback, archive, arrows, dropdown search and appearance at 390/768/1440 PASS; simulated writes only.');
