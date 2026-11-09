import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer(),{chromium}=await import('playwright'),browser=await chromium.launch({headless:true,channel:process.env.TOTUS_BROWSER_CHANNEL||'msedge'}),report=[];
await mkdir('qa-artifacts',{recursive:true});
try{for(const width of [390,1440]){
 const page=await browser.newPage({viewport:{width,height:900}});await page.goto('http://127.0.0.1:4173/tests/prestashop-harness.html');await page.addStyleTag({url:'http://127.0.0.1:4173/src/productos.css'});
 await page.evaluate(async()=>{
  const {createProductosUI,productosWorkspacePage}=await import('../src/productos-ui.js');document.querySelector('#chatHarness').innerHTML=productosWorkspacePage();
  const product=(id,name,reference,variants=[])=>({id,name,reference,price:'10',wholesale_price:'4',active:'0',visibility:'none',available_for_order:'0',minimal_quantity:'0',available_date:'0000-00-00',description:'Descripción de simulación',description_short:'Resumen de simulación',meta_title:name,link_rewrite:reference.toLowerCase(),associations:{images:[],combinations:variants.map(id=>({id}))}});
  const q=window.copyCircuit={calls:[],db:{'hortimatic|products|42':product('42','pruebas 2 · simulación','QA-COPY',['100','101']),'hortimatic|products|43':product('43','pruebas simple · simulación','QA-SIMPLE'),'hortimatic|combinations|100':{id:'100',id_product:'42',reference:'QA-RED',default_on:'0',price:'0',minimal_quantity:'1',associations:{product_option_values:[{id:'10'}]}},'hortimatic|combinations|101':{id:'101',id_product:'42',reference:'QA-BLUE',default_on:'1',price:'2',minimal_quantity:'1',associations:{product_option_values:[{id:'11'}]}}}};
  q.original=JSON.stringify(q.db['hortimatic|products|42']);let serial=800;
  const invoke=async b=>{q.calls.push(structuredClone(b));const out={ok:true,store:b.store,resource:b.resource,record_id:b.record_id,persisted:false};
   if(b.action==='prestashop_item_read'){const item=q.db[b.store+'|'+b.resource+'|'+b.record_id];if(!item)throw Error('Missing fixture record');return {...out,item:structuredClone(item)};}
   if(b.action==='prestashop_product_create_profile')return {...out,resource:'products',language_ids:['1']};
   if(b.action==='prestashop_product_create_prepare')return {...out,resource:'products',reference:b.reference,fingerprint:'a'.repeat(64),can_commit:true};
   if(b.action==='prestashop_product_create_commit'){q.db[b.store+'|products|701']=product('701',b.translations[0].name,b.reference);return {...out,resource:'products',record_id:'701',persisted:true,verified:true,active:false};}
   if(b.action==='prestashop_product_step_prepare')return {...out,fingerprint:'b'.repeat(64),can_commit:true};
   if(b.action==='prestashop_product_step_commit'){if(b.kind!=='variation')throw Error('Unexpected stage');const id=String(++serial);q.db[b.store+'|combinations|'+id]={id,id_product:b.product_id,...b.fields,associations:{product_option_values:b.associations.product_option_values.map(id=>({id}))}};q.db[b.store+'|products|'+b.product_id].associations.combinations.push({id});return {...out,record_id:id,persisted:true,verified:true};}
   if(b.action==='prestashop_read'){let rows=[];const group=b.store==='hortimatic'?'5':'15',red=b.store==='hortimatic'?'10':'20',blue=b.store==='hortimatic'?'11':'21';
    if(b.resource==='products')rows=Object.entries(q.db).filter(([k])=>k.startsWith(b.store+'|products|')).map(([,v])=>v).filter(v=>!b.references?.length||b.references.includes(v.reference));
    if(b.resource==='categories')rows=[{id:'99',name:'Pruebas'}];if(b.resource==='product_options')rows=[{id:group,name:'Color'}];if(b.resource==='product_option_values')rows=[{id:red,id_attribute_group:group,name:'Rojo'},{id:blue,id_attribute_group:group,name:'Azul'}];if(b.resource==='currencies')rows=[{id:'1',name:'Euro',iso_code:'EUR'}];
    return {...out,page:b.page,possibly_more:false,rows:structuredClone(rows)};
   }throw Error('Unexpected '+b.action);
  };
  q.ui=createProductosUI({actor:()=> 'copy-circuit',allowed:()=>true,canEdit:()=>true,rpc:async()=>({connections:['Hortimatic','NewOldSmok'].map((name,i)=>({id:String(i+1),name:'PrestaShop · '+name,protocol:'prestashop',enabled:true,configured:true,revision:1,verified_revision:1,real_data_authorized:true}))}),invoke});await q.ui.mount(document.querySelector('#productosRoot'));
 });
 await page.locator('[data-pr-action="open-product"][data-id="42"]').click();await page.getByRole('tab',{name:/3\. Copiar entre Tiendas/}).click();await page.getByRole('button',{name:'Seleccionar Todo',exact:true}).click();
 await page.getByRole('button',{name:'Preparar subida a NewOldSmok',exact:true}).click();await page.locator('[data-pr-create-field="category_id"]').waitFor();await page.locator('[data-pr-create-field="category_id"]').selectOption('99');
 await page.getByRole('button',{name:'Preparar subida a NewOldSmok',exact:true}).click();await page.getByRole('button',{name:'Confirmar y subir copia a NewOldSmok',exact:true}).waitFor();assert.equal(await page.evaluate(()=>copyCircuit.calls.some(c=>c.action==='prestashop_product_create_commit')),false,'Preparation cannot write');
 await page.getByRole('button',{name:'Confirmar y subir copia a NewOldSmok',exact:true}).click();await page.getByRole('button',{name:'Completar copia en NewOldSmok',exact:true}).waitFor();assert.equal(await page.getByRole('tab',{name:/3\./}).getAttribute('aria-selected'),'true');
 await page.getByRole('button',{name:'Completar copia en NewOldSmok',exact:true}).click();await page.waitForFunction(()=>copyCircuit.db['newoldsmok|products|701'].associations.combinations.length===2);assert.equal(await page.evaluate(()=>copyCircuit.calls.filter(c=>c.action==='prestashop_product_create_commit').length),1);
 assert.equal(await page.evaluate(()=>JSON.stringify(copyCircuit.db['hortimatic|products|42'])===copyCircuit.original),true);report.push({width,mode:'simulation',passed:['prepare_copy_in_copy_tab','explicit_confirm_upload','complete_variants_in_copy_tab','one_base_post','source_unchanged']});await page.close();
}}finally{await browser.close();await server?.close();await writeFile('qa-artifacts/productos-copy-upload-report.json',JSON.stringify(report,null,2));}
console.log('Copy tab: prepare, explicitly upload base and complete selected variants in destination at 390/1440 PASS; simulated API.');
