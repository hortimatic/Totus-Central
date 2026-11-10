import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {startLocalServer} from './local-static-server.mjs';
import {clickModuleLink} from './ui-navigation.mjs';

const server=await startLocalServer();
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:960},locale:'es-ES'});
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('dialog',dialog=>dialog.accept());
try{
 const src=fs.readFileSync('tests/mock-supabase.js','utf8');
 const rpcMarker='const rpc=async (name,args={})=>{';
 const rpcInject=[
  rpcMarker,
  " if(name==='totus_prestashop_context'){window.__qaHomeContextCalls=(window.__qaHomeContextCalls||0)+1;return {data:{connections:[",
  "  {protocol:'prestashop',name:'PrestaShop · Hortimatic',id:'ps-h',revision:1,verified_revision:1,configured:true,enabled:true,real_data_authorized:true},",
  "  {protocol:'prestashop',name:'PrestaShop · NewOldSmok',id:'ps-n',revision:1,verified_revision:1,configured:true,enabled:true,real_data_authorized:true}",
  " ]},error:null};}",
  " if(name==='totus_home_dashboard'){",
  "  window.__homeSaved||={revision:0,layout:null};",
  "  if(args.p_action==='read')return {data:{...window.__homeSaved},error:null};",
  "  if(args.p_action==='save'&&args.p_expected_revision===window.__homeSaved.revision){",
  "   window.__homeSaved.revision++;window.__homeSaved.layout=structuredClone(args.p_layout);",
  "   return {data:{...window.__homeSaved},error:null};",
  "  }",
  "  return {data:null,error:{message:'Revisión obsoleta'}};",
  " }"
 ].join('\n');
 const fnMarker='functions:{invoke:async (name,options)=>{';
 const fnInject=[
  fnMarker,
  " if(name==='totus-connections'){",
  "  const a=options?.body||{},shop=a.store,resource=a.resource,day=new Date().toISOString().slice(0,10);",
  "  if(a.action!=='prestashop_read')return {data:{error:'Acción no simulada'},error:null};",
  "  let rows=[];",
  "  if(resource==='orders'&&a.page===0)rows=Array.from({length:24},(_,i)=>({",
  "   id:String((shop==='hortimatic'?7000:8000)+i),reference:'QA-R'+i,date_add:day+' 12:00:00',",
  "   total_paid_tax_incl:'12.500000',total_paid_tax_excl:'10.330000',id_currency:'1',payment:'Tarjeta',valid:'1',current_state:'21',id_customer:'0'",
  "  }));",
  "  if(resource==='products'&&a.page===0)rows=[{id:'101',name:'QA Producto A',reference:'',ean13:'',weight:'0'},{id:'102',name:'QA Producto B',reference:'SKU102',ean13:'1234567890123',weight:'0.1'},{id:'103',name:'QA Producto C',reference:'SKU103',ean13:'1234567890123',weight:'0.2'}];",
  "  if(resource==='currencies')rows=[{id:'1',iso_code:'EUR'}];",
  "  if(resource==='order_details')rows=(a.order_ids||[]).map(id=>({",
  "   id:String(100000+Number(id)),id_order:id,product_id:'11',product_attribute_id:Number(id)%2?'10':'20',product_reference:Number(id)%2?'SKU-QA-10':'SKU-QA-0',product_name:Number(id)%2?'Producto QA 10 mg':'Producto QA 0 mg',product_quantity:'1',",
  "   total_price_tax_incl:'12.50',total_price_tax_excl:'10.33'",
  "  }));",
  "  return {data:{ok:true,store:shop,resource,page:a.page,rows,possibly_more:false},error:null};",
  " }"
 ].join('\n');
 assert(src.includes(rpcMarker)&&src.includes(fnMarker),'Contrato mock no encontrado');
 const contextMarker="if(name==='totus_api_manager'||name==='totus_prestashop_context')";
 assert(src.includes(contextMarker),'Mock client RPC debe permitir PrestaShop');
 const adjusted=src.replace(contextMarker,"if(name==='totus_prestashop_context')return rpc(name,args);\n  "+contextMarker);
 const injected=adjusted.replace(rpcMarker,rpcInject).replace(fnMarker,fnInject);
 await page.route('**/tests/mock-supabase.js',route=>route.fulfill({contentType:'text/javascript',body:injected}));
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await page.locator('#homePrestashopSummary').waitFor({timeout:30000});
 assert.equal(await page.locator('.home-dashboard-toolbar').count(),0,'Inicio original: sin barra de personalización');
 assert.equal(await page.locator('.opening-panel').count(),1,'No se toca la apertura de cajas');
 for(const label of ['Vape','Head','NewOldSmok'])assert((await page.locator('.opening-panel').innerText()).includes(label),'Aperturas originales: '+label);
 await page.waitForFunction(()=>document.querySelectorAll('[data-home-widget="shop-h"] .home-ps-metrics strong').length===5);
 await page.waitForFunction(()=>document.querySelectorAll('[data-home-widget="shop-n"] .home-ps-metrics strong').length===5);
 assert.equal(await page.evaluate(()=>window.__qaHomeContextCalls),1,'Un contexto autenticado compartido entre tiendas');
 const h=await page.locator('[data-home-widget="shop-h"]').boundingBox(),n=await page.locator('[data-home-widget="shop-n"]').boundingBox();
 assert(h&&n&&Math.abs(h.y-n.y)<14&&n.x>h.x,'Dos tiendas paralelas en escritorio');
 const top=await page.locator('[data-home-widget="shop-h"] .home-ps-top').innerText();
 assert(top.includes('Producto QA 0 mg')&&top.includes('Producto QA 10 mg'),'Las variantes vendidas se mantienen separadas');
 assert.equal(await page.locator('.home-prestashop-more').evaluate(el=>el.open),false,'Los análisis detallados no invaden el Inicio anterior');
 await page.locator('.home-prestashop-more > summary').click();
 const orders=page.locator('[data-home-widget="orders"]');
 await page.waitForFunction(()=>document.querySelectorAll('[data-home-widget="orders"] tbody tr').length===10);
 assert.equal(await orders.locator('[data-home-command="open-order"]').count(),10,'Pedidos paginados de diez');
 assert.equal(await orders.locator('.home-order-product-line').count(),10,'Productos reales por línea');
 assert((await orders.locator('thead th').allTextContents()).includes('Atendido por'),'Se conservan las columnas');
 const first=await orders.locator('[data-home-command="open-order"]').first().getAttribute('data-order');
 await orders.locator('[data-home-command="next-page"]').click();
 assert.notEqual(await orders.locator('[data-home-command="open-order"]').first().getAttribute('data-order'),first,'Paginación activa');
 await orders.locator('[data-home-command="prev-page"]').click();
 assert.equal(await orders.locator('[data-home-command="open-order"]').first().getAttribute('data-order'),first);
 await orders.locator('[data-home-filter="query"]').fill('QA-R18');
 await orders.locator('[data-home-filter="query"]').press('Tab');
 assert.equal(await orders.locator('[data-home-command="open-order"]').count(),2,'Búsqueda en ambos establecimientos');
 await orders.locator('[data-home-filter="query"]').fill('');
 await orders.locator('[data-home-filter="query"]').press('Tab');
 const quality=page.locator('[data-home-type="prestashop.quality"]');
 await quality.getByText('QA Producto A').first().waitFor();
 assert((await quality.innerText()).includes('Sin referencia'),'Calidad de catálogo consultada');
 const productWidget=page.locator('[data-home-type="prestashop.top"]');
 assert((await productWidget.innerText()).includes('Combinación #20'),'Más vendidos por variantes, sin mezclar');
 assert.equal(await page.evaluate(()=>window.__homeSaved),undefined,'No se lee ni guarda un diseño modular obsoleto');
 fs.mkdirSync('qa-artifacts/inicio',{recursive:true});
 await page.screenshot({path:'qa-artifacts/inicio/original-con-prestashop-1440.png',fullPage:true});
 await orders.locator('[data-home-command="open-orders"]').click();
 await page.locator('.ps-tabs [data-prestashop-action="tab"][data-tab="orders"][aria-pressed="true"]').waitFor({timeout:20000});
 assert.equal(new URL(page.url()).searchParams.get('module'),'prestashop');
 await clickModuleLink(page,page.locator('#nav [data-route="inicio"]'));
 await page.locator('.opening-panel').waitFor();
 await page.locator('.dashboard-hero [data-action="closing-new"]').click();
 await page.locator('#clStore').waitFor({timeout:16000});
 assert.equal(new URL(page.url()).searchParams.get('module'),'cajas','Nuevo cierre original navega al formulario de Cajas');
 for(const width of [320,390,768,1024,1440,1920]){
  await page.setViewportSize({width,height:900});
  await clickModuleLink(page,page.locator('#nav [data-route="inicio"]'));
  assert.equal(await page.locator('.opening-panel').count(),1,'El Inicio original sigue completo a '+width);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,'Sin desbordamiento de página a '+width+'px');
  if(width===390)await page.screenshot({path:'qa-artifacts/inicio/original-con-prestashop-390.png',fullPage:true});
 }
 assert.deepEqual(errors,[],'Sin errores Javascript');
 console.log('RESTORE HOME + PRESTASHOP PASS: tienda, pedidos, productos, catálogo, navegación, originales, seis tamaños');
}finally{
 await browser.close();
 if(server)await new Promise(resolve=>server.close(resolve));
}
