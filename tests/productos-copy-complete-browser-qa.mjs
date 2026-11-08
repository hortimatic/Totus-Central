import assert from 'node:assert/strict';
import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer(),{chromium}=await import('playwright'),browser=await chromium.launch({headless:true,channel:process.env.TOTUS_BROWSER_CHANNEL||'msedge'});
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:4173/tests/prestashop-harness.html');
 const result=await page.evaluate(async()=>{
  const {createProductWizard}=await import('../src/productos-create-ui.js');
  const {adaptStoreHTML}=await import('../src/productos-copy-text.js');
  const {mapCopyRelations}=await import('../src/productos-copy-map.js');
  const categoryLink=adaptStoreHTML('<a href="https://hortimatic.com/33-bandejas">Bandejas Hortimatic</a><a href="https://hortimatic.com/99-desconocida">Otro</a>','hortimatic','newoldsmok',{categoryMap:{33:'71'}});
  if(!categoryLink.value.includes('controller=category&amp;id_category=71')||!categoryLink.value.includes('hortimatic.com/99-desconocida')||categoryLink.unresolved.length!==1)throw Error('Category URLs must use verified destination mappings only');
  const source={id:'42',id_shop_default:'9',__sourceStore:'hortimatic',name:'Hortimatic muestra',id_category_default:'4',id_manufacturer:'7',reference:'COPY-FULL',price:'10',active:'0',available_for_order:'0',visibility:'none',id_default_image:'91',description:'<p>Hortimatic <a href="https://hortimatic.com/">tienda</a><img src="https://hortimatic.com/91-large_default/product.jpg" alt="Hortimatic foto"></p>',associations:{categories:[{id:'4'}],images:[{id:'91'},{id:'92'}]}};
  const mapped=mapCopyRelations(source,{manufacturers:[{id:'7',name:'Marca'}],categories:[{id:'4',name:'Inicio',id_parent:'0'}]},{manufacturers:[{id:'70',name:'Marca'}],categories:[{id:'40',name:'Inicio',id_parent:'0'}]});
  const plan={store:'newoldsmok',operation:'create',changes:[{field:'name',after:'NewOldSmok muestra',changed:true},{field:'description',after:source.description,changed:true}],variants:[{source_id:'100',source_stock:{quantity:'3',out_of_stock:'0',depends_on_stock:'0',location:'A'},source_image_ids:['91'],source_attributes:[{group:'Color',value:'Azul'}],source_default_on:true,changes:[{field:'reference',after:'COPY-BLUE'},{field:'price',after:'2'}]},{source_id:'101',source_stock:{quantity:'7',out_of_stock:'0',depends_on_stock:'0',location:'B'},source_image_ids:['92'],source_attributes:[{group:'Color',value:'Rojo'}],changes:[{field:'reference',after:'COPY-RED'},{field:'price',after:'3'}]}]};
  const canvas=document.createElement('canvas');canvas.width=40;canvas.height=60;canvas.getContext('2d').fillRect(10,10,20,40);const base64=canvas.toDataURL('image/png').split(',')[1];
  const calls=[],progress=[];let serial=900,fail=true;
  const wizard=createProductWizard({canEdit:()=>true,onProgress:async message=>progress.push(message),invoke:async(store,action,args)=>{
   calls.push({store,action,args:structuredClone(args)});
   if(action==='prestashop_product_create_profile')return {persisted:false,resource:'products',language_ids:['1']};
   if(action==='prestashop_read')return {resource:args.resource,rows:({categories:[{id:'40',name:'Inicio'}],stock_availables:[{id:'801',id_product:'701',id_product_attribute:'903',id_shop:'1',quantity:'0'},{id:'802',id_product:'701',id_product_attribute:'905',id_shop:'1',quantity:'0'}],product_options:[{id:'50',name:'Color'}],product_option_values:[{id:'51',id_attribute_group:'50',name:'Azul'},{id:'52',id_attribute_group:'50',name:'Rojo'}],image_types:[{id:'1',name:'large_default',products:'1',width:'80',height:'100'}]})[args.resource]||[],possibly_more:false};
   if(action==='prestashop_item_read'&&args.resource==='products')return {item:{id:'701',id_shop_default:'1'}};
   if(action==='prestashop_item_read')return {item:{id:args.record_id,id_product:args.product_id,mime:'image/png',base64}};
   if(action==='prestashop_product_create_prepare')return {persisted:false,resource:'products',reference:args.reference,fingerprint:'a'.repeat(64),can_commit:true};
   if(action==='prestashop_product_create_commit')return {persisted:true,verified:true,record_id:'701'};
   if(action==='prestashop_product_step_prepare')return {persisted:false,fingerprint:'b'.repeat(64),can_commit:true};
   if(action==='prestashop_product_step_commit'){if(args.kind==='variation'&&fail){fail=false;throw Error('Simulated interruption after photos');}return {persisted:true,verified:true,record_id:String(++serial)};}
   throw Error(action);
  }});
  wizard.handleChange({dataset:{prCopyOption:'stock',prCreateStore:'newoldsmok'},checked:true});
  await wizard.perform('create-load','newoldsmok',plan,source);wizard.render(plan,source);
  wizard.handleChange({dataset:{prCreateStore:'newoldsmok',prCreateField:'reference'},value:'COPY-FULL'});
  wizard.handleChange({dataset:{prCreateStore:'newoldsmok',prCreateField:'category_id'},value:'40'});
  await wizard.perform('create-prepare','newoldsmok',plan,source);wizard.handleChange({dataset:{prCreateConfirm:'newoldsmok'},value:'CREAR'});await wizard.perform('create-commit','newoldsmok',plan,source);
  let interrupted=false;try{await wizard.perform('create-stage-copy-all','newoldsmok',plan,source);}catch(error){interrupted=error.message.includes('Simulated interruption');}
  const snapshot=wizard.snapshot();wizard.restore(snapshot);
  const message=await wizard.perform('create-stage-copy-all','newoldsmok',plan,source),beforeRepeat=calls.filter(c=>c.action==='prestashop_product_step_commit').length;
  await wizard.perform('create-stage-copy-all','newoldsmok',plan,source);
  const commits=calls.filter(c=>c.action==='prestashop_product_step_commit'),images=commits.filter(c=>c.args.kind==='image'),variants=commits.filter(c=>c.args.kind==='variation'),finish=commits.find(c=>c.args.kind==='finish');
  const html=adaptStoreHTML('<img src="https://hortimatic.com/91-large_default/product.jpg" alt="Hortimatic"><a href="https://hortimatic.com/other">Hortimatic</a>','hortimatic','newoldsmok',{imageMap:{91:'901'}});
  return {mapped,interrupted,message,progress,images:images.map(c=>c.args),variants:variants.map(c=>c.args),finish:finish.args,stocks:commits.filter(c=>c.args.kind==='stock').map(c=>c.args),repeatedWrites:calls.filter(c=>c.action==='prestashop_product_step_commit').length-beforeRepeat,html,allDestinationWrites:commits.every(c=>c.store==='newoldsmok'&&c.args.product_id==='701')};
 });
 assert.equal(result.mapped.categoryId,'40');assert.equal(result.mapped.relations.manufacturer_id,'70');assert.deepEqual(result.mapped.unresolved,[]);
 assert(result.interrupted);assert.equal(result.images.length,2,'Resume preserves uploaded images');assert.equal(result.repeatedWrites,0,'Completed copy does not write again');assert(result.allDestinationWrites);
 assert.deepEqual(result.variants.slice(-2).map(c=>c.associations.images),[['901'],['902']]);assert.deepEqual(result.variants.slice(-2).map(c=>c.associations.product_option_values),[['51'],['52']]);
 assert.deepEqual(result.stocks.map(row=>row.fields.quantity),['3','7']);assert.deepEqual(result.stocks.map(row=>row.fields.id_product_attribute),['903','905']);
 assert.equal(result.finish.fields.id_default_image,'901');assert.equal(result.finish.fields.id_default_combination,'903');assert.equal(result.finish.fields.active,'0');
 assert.match(result.finish.fields.description[0].value,/NewOldSmok/);assert.match(result.finish.fields.description[0].value,/newoldsmok.com\/901-large_default/);assert.doesNotMatch(result.finish.fields.description[0].value,/hortimatic.com/);
 assert.equal(result.variants[0].step_key,result.variants[1].step_key,'Uncertain variation reuses its operation');assert(result.progress.length>=10);
 assert.match(result.html.value,/newoldsmok.com\/901-large_default/);assert.match(result.html.value,/hortimatic.com\/other/);assert.equal(result.html.unresolved.length,1);
 console.log('Complete copy simulation: photos, mapped variants, store texts, interrupted resume, no duplicate photos/writes, destination IDs and relations PASS');
}finally{await browser.close();await server?.close();}
