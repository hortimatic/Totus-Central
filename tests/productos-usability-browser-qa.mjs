import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer();
const {chromium}=await import('playwright');
const browser=await chromium.launch({headless:true,channel:process.env.TOTUS_BROWSER_CHANNEL||'msedge'}),report=[];
await mkdir('qa-artifacts',{recursive:true});
try{for(const width of [390,768,1024,1440]){
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
   if(b.action==='prestashop_read'){const auxiliary=['manufacturers','categories'].includes(b.resource)?Array.from({length:15},(_,i)=>({id:String(i+1),name:'Opción '+i})):[];return {...out,page:b.page,possibly_more:q.catalog&&b.resource==='products'&&!b.product_ids&&b.page===0,rows:b.resource==='products'?(q.catalog?(b.product_ids?[{...q.item,id:b.product_ids[0],reference:'EXACT-'+b.product_ids[0]}]:Array.from({length:b.page===0?100:37},(_,i)=>({...q.item,id:String(100+b.page*100+i),reference:'CAT-'+(100+b.page*100+i)}))):(q.item?[structuredClone(q.item)]:[])):auxiliary};}throw Error(b.action);
  };
  
  // Stable identity throughout this fixture's authenticated session.
  const owner=crypto.randomUUID();q.ui=createProductosUI({actor:()=>owner,allowed:()=>true,canEdit:()=>true,rpc:async()=>({connections:[{id:'1',name:'PrestaShop · Hortimatic',protocol:'prestashop',enabled:true,configured:true,revision:1,verified_revision:1,real_data_authorized:true}]}),invoke});await q.ui.mount(document.querySelector('#productosRoot'));
 });

 await page.evaluate(()=>{tableQA.catalog=true});
 await page.getByRole('button',{name:'Actualizar',exact:true}).click();
 await page.getByText('100 productos cargados · quedan páginas por consultar',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Consultar catálogo completo',exact:true}).click();
 await page.getByText('Catálogo completo consultado: 137 productos.',{exact:true}).waitFor();
 assert.equal(await page.locator('.prd-catalog-table tbody tr').count(),20);
 assert.equal(await page.getByRole('button',{name:'Consultar catálogo completo',exact:true}).count(),0);
 await page.locator('[data-pr-page-size]').selectOption('50');
 assert.equal(await page.locator('.prd-catalog-table tbody tr').count(),50);
 await page.locator('[data-pr-search]').fill('9999');await page.locator('[data-pr-search]').blur();
 await page.getByRole('button',{name:'Buscar ID / referencia en tienda',exact:true}).click();
 await page.getByText('1 productos encontrados en la tienda por ID o referencia exacta.',{exact:true}).waitFor();
 assert.equal(await page.locator('.prd-catalog-table tbody tr').count(),1);
 assert.equal(await page.locator('.prd-catalog-table tbody').innerText().then(t=>t.includes('EXACT-9999')),true);
 await page.locator('[data-pr-search]').fill('');await page.locator('[data-pr-search]').blur();
 const web=page.locator('.prd-catalog-table tbody tr').first().getByRole('link',{name:'Ver en la web ↗',exact:true});
 assert.match(await web.getAttribute('href'),/^https:\/\/hortimatic.com\/index.php\?controller=product&id_product=\d+$/);
 assert.equal(await web.getAttribute('target'),'_blank');assert.match(await web.getAttribute('rel'),/noopener/);
 const tabs=await page.getByRole('tab').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect()));assert(tabs.every((r,i)=>r.width>45&&(i===0||r.x>=tabs[i-1].right-1)),'Five tabs have usable, non-overlapping widths');
 assert((await page.locator('.prd-v4-header').boundingBox()).height<90,'Compact workspace header');
 await page.screenshot({path:'qa-artifacts/productos-usability-catalog-'+width+'.png',fullPage:false});
 await page.getByRole('button',{name:'Buscar en Todas las marcas',exact:true}).click();
 await page.locator('[data-pr-select-search]').fill('Opción 12');
 await page.getByRole('button',{name:'Opción 12',exact:true}).click();
 assert.equal(await page.locator('#catalogo-brand-filter').inputValue(),'13');
 await page.getByRole('button',{name:'Buscar en Todas las marcas',exact:true}).click();
 await page.keyboard.press('Escape');assert.equal(await page.locator('.prd-select-dialog').count(),0);
 assert.equal(await page.locator('#catalogo-brand-filter').inputValue(),'13');
 await page.locator('#catalogo-brand-filter').selectOption('');
 const menu=page.locator('.prd-row-menu').last();await menu.locator('summary').click();
 await page.waitForFunction(()=>document.querySelector('.prd-row-menu[open]>div')?.style.position==='fixed');
 const bounds=await menu.locator(':scope>div').boundingBox();assert(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width+1&&bounds.y+bounds.height<=900,'Menu remains in viewport');
 await page.keyboard.press('Escape');assert.equal(await menu.getAttribute('open'),null);
 await page.evaluate(async()=>{const host=document.createElement('section');host.id='pickerQA';host.innerHTML='<label><span>Categorías de prueba</span><select multiple aria-label="Categorías de prueba">'+Array.from({length:20},(_,i)=>'<option value="'+i+'" '+(i===0?'selected':'')+'>Categoría '+i+'</option>').join('')+'</select></label>';document.querySelector('#productosRoot').append(host);const {enhanceProductSelects}=await import('../src/productos-controls.js');enhanceProductSelects(host);});
 await page.getByRole('button',{name:'Buscar en Categorías de prueba',exact:true}).click();
 await page.locator('[data-pr-select-search]').fill('Categoría 12');await page.getByRole('checkbox',{name:'Categoría 12',exact:true}).check();
 assert.equal(await page.locator('#pickerQA select').evaluate(n=>[...n.selectedOptions].map(o=>o.value).join(',')),'0','Changes are staged until Apply');
 await page.getByRole('button',{name:'Aplicar selección',exact:true}).click();
 assert.equal(await page.locator('#pickerQA select').evaluate(n=>[...n.selectedOptions].map(o=>o.value).join(',')),'0,12');
 await page.locator('#pickerQA select').focus();await page.keyboard.press('Enter');await page.getByRole('button',{name:'Limpiar selección',exact:true}).click();await page.keyboard.press('Escape');
 assert.equal(await page.locator('#pickerQA select').evaluate(n=>[...n.selectedOptions].map(o=>o.value).join(',')),'0,12','Escape discards unconfirmed choices');
 assert.deepEqual(errors,[]);
 report.push({width,passed:['catalog_137_paginated','page_size_50','server_exact_search_outside_first_page','searchable_picker_apply','escape_cancel','menu_within_viewport','multiple_selection_apply_and_cancel','keyboard_open_picker']});await page.close();
}}finally{await browser.close();await server?.close();await writeFile('qa-artifacts/productos-usability-report.json',JSON.stringify(report,null,2));}
console.log('Products usability: full catalogue beyond 100, pagination, exact server search and picker at 390/768/1024/1440 PASS; simulation.');



