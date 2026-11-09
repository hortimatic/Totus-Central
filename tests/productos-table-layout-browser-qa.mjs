import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer();
const {chromium}=await import('playwright');
const browser=await chromium.launch({headless:true,channel:process.env.TOTUS_BROWSER_CHANNEL||'msedge'}),report=[];
await mkdir('qa-artifacts',{recursive:true});
try{for(const width of [390,680,969,1280,1920,2560]){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/tests/prestashop-harness.html');await page.addStyleTag({url:'http://127.0.0.1:4173/src/productos.css'});await page.addStyleTag({content:width>=900?'#chatHarness{margin-left:330px;width:calc(100% - 346px);max-width:none!important;min-width:0}':'#chatHarness{width:calc(100% - 24px);margin:12px;min-width:0}'});
 await page.evaluate(async()=>{
  const {createProductosUI,productosWorkspacePage}=await import('../src/productos-ui.js');document.querySelector('#chatHarness').innerHTML=productosWorkspacePage();
  const q=window.tableQA={layout:null,layoutSaves:[],calls:[],item:{id:'42',name:'pruebas · simulación',reference:'QA-42',ean13:'',price:'10',wholesale_price:'4',active:'0',id_tax_rules_group:'0',associations:{images:[],combinations:[]}}};
  const invoke=async b=>{q.calls.push(structuredClone(b));const out={ok:true,store:b.store,resource:b.resource,record_id:b.record_id};
   if(b.action==='prestashop_product_create_profile')return {...out,persisted:false,language_ids:['1','2']};
   if(b.action==='prestashop_product_step_prepare')return {...out,persisted:false,can_commit:true,fingerprint:'b'.repeat(64)};
   if(b.action==='prestashop_product_step_commit'){q.item=null;return {...out,record_id:b.product_id,persisted:true,verified:true,deleted:true};}
   if(b.action==='prestashop_product_prepare')return {...out,can_commit:true,fingerprint:'a'.repeat(64),changes:b.changes.map(c=>({...c,before:q.item[c.field],after:c.value,changed:String(q.item[c.field])!==c.value}))};
   if(b.action==='prestashop_product_commit'){if(q.loseNext){q.loseNext=false;throw Error('Respuesta perdida: estado incierto');}for(const c of b.changes)q.item[c.field]=c.value;return {...out,persisted:true,verified:true};}
   if(b.action==='prestashop_item_read')return {...out,item:structuredClone(q.item)};
   if(b.action==='prestashop_read'){const auxiliary=['manufacturers','categories'].includes(b.resource)?Array.from({length:15},(_,i)=>({id:String(i+1),name:'Opción '+i})):[];return {...out,page:b.page,possibly_more:false,rows:b.resource==='products'?(q.item?[structuredClone(q.item),...(q.filler||[])]:[]):auxiliary};}throw Error(b.action);
  };
  
  // Stable identity throughout this fixture's authenticated session.
  const owner=crypto.randomUUID();q.ui=createProductosUI({tableLayout:{load:async()=>structuredClone(q.layout),save:async layout=>{if(q.holdSave){q.holdSave=false;q.saveHeld=true;await new Promise(resolve=>q.releaseSave=resolve);}q.layout=structuredClone(layout);q.layoutSaves.push(structuredClone(layout));}},actor:()=>owner,allowed:()=>true,canEdit:()=>true,rpc:async()=>({connections:[{id:'1',name:'PrestaShop · Hortimatic',protocol:'prestashop',enabled:true,configured:true,revision:1,verified_revision:1,real_data_authorized:true}]}),invoke});await q.ui.mount(document.querySelector('#productosRoot'));
 });

 const widths=()=>page.locator('th[data-pr-column-heading="image"]').evaluate(n=>n.getBoundingClientRect().width);
 const before=await widths(),handle=page.getByRole('separator',{name:'Ancho de Foto',exact:true});await handle.press('ArrowRight');assert(Math.abs(await widths()-before-10)<2,'Keyboard resizes only the chosen column');
 await handle.scrollIntoViewIfNeeded();const rect=await handle.boundingBox();assert(rect&&rect.y>=0&&rect.y+rect.height<=900,'Pointer starts on a visible column handle');await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();await page.mouse.move(rect.x+rect.width/2+60,rect.y+rect.height/2,{steps:6});await page.mouse.up();assert(Math.abs(await widths()-before-70)<2,'Pointer drag changes actual table width');
 await page.waitForFunction(()=>tableQA.layoutSaves.length>=2);assert.equal(await page.evaluate(()=>tableQA.layout.widths.image),Math.round(before+70));
 await page.locator('.prd-columns summary').click();await page.getByRole('combobox',{name:'Posición de Ref.',exact:true}).selectOption({value:'1'});assert.deepEqual(await page.locator('th[data-pr-column-heading]').evaluateAll(ns=>ns.slice(0,3).map(n=>n.dataset.prColumnHeading)),['image','reference','name']);
 await page.getByRole('button',{name:'Mover Ref.',exact:true}).press('Alt+ArrowDown');assert.deepEqual(await page.locator('th[data-pr-column-heading]').evaluateAll(ns=>ns.slice(0,3).map(n=>n.dataset.prColumnHeading)),['image','name','reference']);
 await page.getByRole('button',{name:'Mover Ref.',exact:true}).dragTo(page.locator('[data-pr-column-option="image"]'));assert.equal(await page.locator('th[data-pr-column-heading]').first().getAttribute('data-pr-column-heading'),'reference');
 await page.waitForFunction(()=>tableQA.layout?.columns?.[0]==='reference');await page.keyboard.press('Escape');
 await page.evaluate(async()=>{for(const key of Object.keys(localStorage))if(key.startsWith('totus-products-columns:')||key.startsWith('totus-products-widths:'))localStorage.removeItem(key);await tableQA.ui.mount(document.querySelector('#productosRoot'));});
 assert.equal(await page.locator('th[data-pr-column-heading]').first().getAttribute('data-pr-column-heading'),'reference','Account save survives a fresh local cache');assert(Math.abs(await widths()-before-70)<2,'Cloud width is restored');
 await page.evaluate(()=>tableQA.holdSave=true);await page.getByRole('separator',{name:'Ancho de Foto',exact:true}).press('ArrowRight');await page.waitForFunction(()=>tableQA.saveHeld);await page.evaluate(()=>{tableQA.mountFinished=false;void tableQA.ui.mount(document.querySelector('#productosRoot')).then(()=>tableQA.mountFinished=true);});await page.evaluate(()=>tableQA.releaseSave());await page.waitForFunction(()=>tableQA.mountFinished);assert(Math.abs(await widths()-before-80)<2,'Leaving and immediately returning waits for the pending account save');
 await page.getByRole('button',{name:'Ver columnas siguientes',exact:true}).click();const margin=page.locator('th[data-pr-column-heading="marginTotal"]');await margin.scrollIntoViewIfNeeded();const help=margin.locator('.field-help');const geometry=await margin.evaluate(n=>{const r=n.getBoundingClientRect(),i=n.querySelector('.field-help').getBoundingClientRect(),c=n.querySelector('.prd-column-caption').getBoundingClientRect();return {height:r.height,infoWidth:i.width,infoHeight:i.height,verticalDifference:Math.abs(i.y+i.height/2-c.y-c.height/2),inside:i.x>=r.x&&i.right<=r.right};});assert(geometry.height<65&&geometry.infoWidth<=18&&geometry.infoHeight<=18&&geometry.verticalDifference<3&&geometry.inside,JSON.stringify(geometry));
 const bounds=await page.locator('.prd-catalog-controls').boundingBox(),rootBounds=await page.locator('#productosRoot').boundingBox();if(width>=1920)assert(rootBounds.width>width-400,'Wide displays use the available module area');assert(bounds.width<=rootBounds.width&&bounds.x>=rootBounds.x&&bounds.x+bounds.width<=rootBounds.x+rootBounds.width+1,'Filters fit available module width');
 const filterBoxes=await page.locator('.prd-catalog-filters label').evaluateAll(ns=>ns.map(n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width};}));assert(filterBoxes.every(r=>r.width>80&&r.left>=bounds.x&&r.right<=bounds.x+bounds.width+1),'All filter fields fit at '+width);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'No page horizontal overflow');
 assert.equal(await page.evaluate(()=>tableQA.calls.some(c=>c.action.endsWith('_commit'))),false);assert.deepEqual(errors,[]);report.push({width,moduleWidth:rootBounds.width,passed:['pointer_resize','keyboard_resize','account_autosave_restore','direct_reorder','drag_reorder','keyboard_reorder','header_help_alignment','responsive_filters','no_business_write']});await page.screenshot({path:'qa-artifacts/productos-layout-'+width+'.png',fullPage:false});await page.close();
}}finally{await browser.close();await server?.close();await writeFile('qa-artifacts/productos-layout-report.json',JSON.stringify(report,null,2));}
console.log('Products personal table layout: resize, autosave, reorder, help and 390/680/969/1280/1920/2560 responsive PASS; simulated business API.');
