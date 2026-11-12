import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {startLocalServer} from './local-static-server.mjs';
import {chromium} from 'playwright';

const server=await startLocalServer();
const browser=await chromium.launch({headless:true,...(process.env.TOTUS_BROWSER_CHANNEL?{channel:process.env.TOTUS_BROWSER_CHANNEL}:{})});
const report=[];
await mkdir('qa-artifacts/catalogue-resilience',{recursive:true});
try{
 for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/tests/prestashop-harness.html');
  await page.addStyleTag({url:'http://127.0.0.1:4173/src/productos.css'});
  await page.evaluate(async()=>{
   const {createAttributesWorkspace}=await import('../src/productos-attributes-workspace.js');
   document.querySelector('#chatHarness').innerHTML='<section id="productosRoot" class="prd-professional"><div id="workspace"></div></section>';
   const q=window.resilience={owner:'A',revision:1,scenario:'normal',calls:[],edits:[],creates:[],opened:[],held:null,release:null};
   const response=(store,args)=>{
    const rows=args.resource==='product_options'?(args.page===0?[{id:'1',name:store==='hortimatic'?'Color H':'Color N'}]:[{id:'2',name:'Segundo grupo'}]):args.resource==='product_option_values'?[{id:'3',id_attribute_group:'1',name:'Azul'}]:args.resource==='products'?(args.page===0?[{id:'41',name:'Producto A'}]:[{id:'42',name:'Producto B'}]):args.resource==='combinations'?(args.page===0?[{id:'51',id_product:'41',associations:{product_option_values:[{id:'3'}]}}]:[{id:'52',id_product:'42',associations:{product_option_values:[{id:'3'}]}}]):[];
    return {ok:true,store,resource:args.resource,page:args.page,rows,possibly_more:['product_options','products','combinations'].includes(args.resource)&&args.page===0};
   };
   q.ui=createAttributesWorkspace({actor:()=>q.owner,contextKey:s=>s+'|'+q.revision,canEdit:()=>false,canCreate:()=>false,hasProduct:()=>false,onEdit:(...a)=>q.edits.push(a),onCreate:a=>q.creates.push(a),onProduct:id=>q.opened.push(id),invoke:async(store,action,args)=>{
    q.calls.push({store,action,...args});
    if(action!=='prestashop_read')throw Error('Unexpected write');
    if(q.scenario==='held'&&store==='hortimatic'&&args.resource==='product_options'&&args.page===0){q.held=true;return new Promise(resolve=>{q.release=()=>resolve(response(store,args));});}
    if(q.scenario==='error')throw Error('Red de prueba no disponible');
    const result=response(store,args);
    if(q.scenario==='duplicate'&&args.resource==='product_options'&&args.page===1)result.rows=[{id:'1',name:'Duplicado'}];
    if(q.scenario==='wrong-store')result.store=store==='hortimatic'?'newoldsmok':'hortimatic';
    if(q.scenario==='empty-page'&&args.resource==='product_options'&&args.page===0)result.rows=[];
    return result;
   }});
   q.mount=store=>q.ui.mount(document.querySelector('#workspace'),store);
   q.mount('hortimatic');
  });
  const idle=()=>page.waitForFunction(()=>document.querySelector('[data-attr-action=refresh]')?.disabled===false);
  await idle();
  assert.equal(await page.locator('.prd-attribute-group-list>button').count(),2,'Groups include subsequent pages');
  assert(await page.getByRole('button',{name:'Editar grupo',exact:true}).isDisabled());
  assert(await page.getByRole('button',{name:'Editar valor',exact:true}).isDisabled());
  assert(await page.getByRole('button',{name:'Crear atributo',exact:true}).isDisabled());
  await page.getByRole('button',{name:'Productos asociados',exact:true}).click();
  await page.getByRole('heading',{name:'2 productos asociados · 2 combinaciones',exact:true}).waitFor();
  assert(await page.evaluate(()=>resilience.calls.some(c=>c.resource==='products'&&c.page===1)&&resilience.calls.some(c=>c.resource==='combinations'&&c.page===1)));
  await page.evaluate(()=>{resilience.scenario='error';});await page.getByRole('button',{name:'Actualizar',exact:true}).click();await idle();
  await page.getByRole('status').filter({hasText:'Red de prueba no disponible'}).waitFor();
  assert.equal(await page.locator('.prd-attribute-group-list>button').count(),2,'Failed refresh retains explicitly dated cache');
  for(const scenario of ['duplicate','empty-page','wrong-store']){
   await page.evaluate(s=>{resilience.scenario=s;resilience.ui.invalidate();resilience.mount('hortimatic');},scenario);await idle();
   assert.equal(await page.locator('.prd-attribute-group-list>button').count(),0,'Invalid response must not populate the cache: '+scenario);
   assert((await page.getByRole('status').innerText()).length>0,'Invalid response must show a failure');
  }
  await page.evaluate(()=>{resilience.scenario='held';resilience.mount('hortimatic');});
  await page.waitForFunction(()=>resilience.held);
  await page.evaluate(()=>{resilience.scenario='normal';resilience.mount('newoldsmok');});await idle();
  await page.getByRole('heading',{name:'Color N',exact:true}).waitFor();
  await page.evaluate(async()=>{resilience.release();await new Promise(r=>setTimeout(r,0));});
  assert.equal(await page.getByRole('heading',{name:'Color H',exact:true}).count(),0,'Late previous-store data is discarded');
  await page.evaluate(()=>{resilience.held=null;resilience.scenario='held';resilience.mount('hortimatic');});await page.waitForFunction(()=>resilience.held);
  await page.evaluate(()=>{resilience.owner='B';resilience.scenario='normal';resilience.mount('newoldsmok');});await idle();
  await page.evaluate(async()=>{resilience.release();await new Promise(r=>setTimeout(r,0));});
  await page.getByRole('heading',{name:'Color N',exact:true}).waitFor();
  assert.equal(await page.getByRole('heading',{name:'Color H',exact:true}).count(),0,'Late previous-account data is discarded');
  await page.evaluate(()=>{resilience.held=null;resilience.scenario='held';resilience.mount('hortimatic');});await page.waitForFunction(()=>resilience.held);
  await page.evaluate(async()=>{resilience.ui.dispose();document.querySelector('#workspace').remove();resilience.release();await new Promise(r=>setTimeout(r,0));});
  assert.equal(await page.locator('.prd-attributes-workspace').count(),0,'A detached workspace cannot return after its request completes');
  assert.deepEqual(await page.evaluate(()=>({edits:resilience.edits,creates:resilience.creates,writes:resilience.calls.filter(c=>c.action!=='prestashop_read')})),{edits:[],creates:[],writes:[]});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
  report.push({width,api:'simulated',passed:['all_pages','readonly_permissions','failed_refresh_keeps_dated_cache','duplicate_ids_rejected','empty_incomplete_page_rejected','foreign_store_rejected','late_store_response_discarded','late_account_response_discarded','detached_host_not_restored','no_writes','no_overflow']});
  await page.screenshot({path:'qa-artifacts/catalogue-resilience/readonly-'+width+'.png',fullPage:true});await page.close();
 }
 console.log('Catalogue resilience: complete pagination, readonly, invalid/late responses, account/store isolation PASS; simulated API.');
}finally{await browser.close();await server?.close();await writeFile('qa-artifacts/catalogue-resilience/report.json',JSON.stringify(report,null,2));}
