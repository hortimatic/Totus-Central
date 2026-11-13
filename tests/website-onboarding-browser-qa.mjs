import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {startLocalServer} from './local-static-server.mjs';
const {chromium}=await import(process.env.TOTUS_PLAYWRIGHT_MODULE||'playwright');
const server=await startLocalServer(),browser=await chromium.launch({headless:true,channel:process.env.TOTUS_BROWSER_CHANNEL||(process.platform==='win32'?'msedge':undefined)}),report=[];
await mkdir('qa-artifacts/websites',{recursive:true});
try{for(const width of [390,969,1920]){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://shop*.example/**',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect x="20" y="10" width="40" height="60" fill="teal"/></svg>'}));
 await page.goto('http://127.0.0.1:4173/tests/prestashop-harness.html');
 await page.addStyleTag({url:'http://127.0.0.1:4173/src/productos.css'});
 await page.addStyleTag({url:'http://127.0.0.1:4173/src/contact-directory.css'});
 await page.evaluate(async()=>{
  const {installWebsiteContext}=await import('../src/website-registry.js');
  const {createProductosUI,productosWorkspacePage}=await import('../src/productos-ui.js');
  const sites=Array.from({length:4},(_,i)=>({key:'web-'+(i+1),name:'Web '+(i+1),origin:'https://shop'+(i+1)+'.example',connection_id:'10000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),status:'active',include_in_totals:i!==2,revision:1}));
  const context={websites:sites,businesses:[],connections:sites.map(s=>({id:s.connection_id,name:'Conexión con otro nombre',store_key:s.key,protocol:'prestashop',enabled:true,configured:true,real_data_authorized:true,revision:1,verified_revision:1}))};installWebsiteContext(context);
  const q=window.websiteQA={sites,context,calls:[],saved:null};
  q.rpc=async(name,args)=>{if(name==='totus_websites'){if(args.p_action==='save'){q.saved=args.p_data;Object.assign(sites.find(s=>s.key===q.saved.key),q.saved);installWebsiteContext(context);}return context;}return context;};
  const product={id:'42',name:'Producto compartido de muestra',reference:'QA-42',active:'1',state:'1',price:'10.00',wholesale_price:'5.00',id_default_image:'9',id_category_default:'1',associations:{images:[{id:'9'}],categories:[{id:'1'}],combinations:[]}};
  q.invoke=async b=>{q.calls.push(b);if(b.action==='prestashop_product_create_profile')return {ok:true,store:b.store,persisted:false,language_ids:['1'],languages:[{id:'1',iso_code:'es',active:'1'}]};if(b.action==='prestashop_item_read')return {ok:true,store:b.store,resource:b.resource,record_id:b.record_id,item:{...product}};if(b.action!=='prestashop_read')throw Error('No writes in browser fixture');return {...b,ok:true,possibly_more:false,rows:b.resource==='products'?[{...product}]:b.resource==='languages'?[{id:'1',iso_code:'es',active:'1'}]:[]};};
  document.querySelector('#chatHarness').innerHTML=productosWorkspacePage();
  q.ui=createProductosUI({actor:()=> 'website-user',allowed:()=>true,canEdit:()=>true,rpc:q.rpc,invoke:q.invoke});await q.ui.mount(document.querySelector('#productosRoot'));
 });
 assert.equal(await page.locator('#store-context-select option').count(),5);
 await page.locator('#store-context-select').selectOption('web-3');
 await page.locator('tbody tr').first().waitFor();
 await page.locator('[data-pr-action="open-product"]').first().click();
 await page.locator('[data-pr-action="mode"][data-mode="comparar"]').click();
 await page.locator('[data-pr-copy-destination]').selectOption('web-4');
 assert.equal(await page.locator('[data-pr-copy-destination]').inputValue(),'web-4');
 assert.match(await page.locator('#tab-copiar').innerText(),/Web 4/);
 assert.equal(await page.locator('[data-pr-copy-option="images"]').count(),1);
 assert(await page.locator('#productosRoot').evaluate(n=>n.getBoundingClientRect().right<=innerWidth+1));
 await page.screenshot({path:'qa-artifacts/websites/products-'+width+'.png',fullPage:false});
 await page.evaluate(async()=>{
  const q=window.websiteQA; q.ui.dispose();
  const {createContactDirectoryUI,directoryPageHtml}=await import('../src/contact-directory-ui.js');
  document.querySelector('#chatHarness').innerHTML=directoryPageHtml('clientes','<p>Directorio local</p>');
  q.directory=createContactDirectoryUI({actor:()=> 'website-user',can:()=>true,rpc:async(name,args)=>name==='totus_directory_context'?q.context:name==='totus_directory_table'?null:[],invoke:async b=>{q.calls.push(b);return {...b,ok:true,possibly_more:false,rows:b.resource==='customers'?[{id:'42',firstname:'Cliente de '+b.store,lastname:'QA',active:'1'}]:b.resource==='languages'?[{id:'1',iso_code:'es',active:'1'}]:[]};}});
  await q.directory.mount(document.querySelector('[data-directory-root]'));
 });
 assert.equal(await page.locator('[data-directory-source]').count(),5);
 await page.locator('[data-directory-source="web-4"]').click();
 await page.getByRole('heading',{name:'Clientes · Web 4',exact:true}).waitFor();
 assert.match(await page.locator('[data-directory-shop]').innerText(),/Cliente de web-4/);
 await page.evaluate(async()=>{
  const q=window.websiteQA,{openWebsiteSettings}=await import('../src/website-onboarding-ui.js');
  await openWebsiteSettings({root:document.querySelector('#chatHarness'),connection:{id:q.sites[2].connection_id},rpc:q.rpc,current:()=>true});
 });
 await page.getByLabel('Nombre visible',{exact:true}).fill('Nueva web renombrada');
 await page.getByRole('button',{name:'Guardar tienda',exact:true}).click();
 assert.equal(await page.evaluate(()=>websiteQA.saved.key),'web-3');
 assert.equal(await page.evaluate(()=>websiteQA.saved.include_in_totals),false);
 assert.deepEqual(errors,[]);report.push({width,api:'simulated',passed:['four_website_selector','third_source_fourth_copy_destination','image_copy_control','fourth_customer_directory','one_button_website_settings','stable_identity','no_page_errors']});await page.close();
}console.log('Independent websites: four sites, product/copy/directory/settings at 390/969/1920 PASS (simulated APIs).');}
finally{await browser.close();await server?.close();await writeFile('qa-artifacts/websites/report.json',JSON.stringify(report,null,2));}
