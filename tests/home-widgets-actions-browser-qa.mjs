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
  "  if(resource==='currencies')rows=[{id:'1',iso_code:'EUR'}];",
  "  if(resource==='order_details')rows=(a.order_ids||[]).map(id=>({",
  "   id:String(100000+Number(id)),id_order:id,product_id:'11',product_attribute_id:Number(id)%2?'10':'20',product_name:Number(id)%2?'Producto QA 10 mg':'Producto QA 0 mg',product_quantity:'1',",
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
 await page.locator('[data-home-widget="opening"]').waitFor({timeout:30000});
 for(const label of ['Vape','Head','NewOldSmok'])assert((await page.locator('[data-home-widget="opening"]').innerText()).includes(label));
 await page.waitForFunction(()=>document.querySelectorAll('[data-home-widget="shop-h"] .home-ps-metrics strong').length>=5);
 await page.waitForFunction(()=>document.querySelectorAll('[data-home-widget="shop-n"] .home-ps-metrics strong').length>=5);
 await page.getByText('300,00 €',{exact:true}).first().waitFor();
 assert.equal(await page.evaluate(()=>window.__qaHomeContextCalls),1,'Un solo contexto autenticado sirve a todos los widgets PrestaShop de Inicio');
 const h=await page.locator('[data-home-widget="shop-h"]').boundingBox();
 const n=await page.locator('[data-home-widget="shop-n"]').boundingBox();
 assert(h&&n&&Math.abs(h.y-n.y)<12&&n.x>h.x+8,'Ambas tiendas deben verse paralelas en escritorio');
 assert((await page.locator('[data-home-widget="shop-h"] .home-ps-top').innerText()).includes('Producto QA 0 mg'),'Se conserva la combinación 0 mg en más vendidos');
 assert((await page.locator('[data-home-widget="shop-h"] .home-ps-top').innerText()).includes('Producto QA 10 mg'),'Se conserva la combinación 10 mg sin mezclar variantes');
 const orders=page.locator('[data-home-widget="orders"]');
 await page.waitForFunction(()=>document.querySelectorAll('[data-home-widget="orders"] tbody tr').length===10);
 const today=new Date().toISOString().slice(0,10);
 await orders.locator('[data-home-filter="from"]').fill(today);
 await page.waitForFunction(()=>document.querySelectorAll('[data-home-widget="orders"] tbody tr').length===10);
 assert.equal(await orders.locator('[data-home-filter="from"]').inputValue(),today,'El periodo se cambia desde la propia tabla');
 assert.equal(await orders.locator('[data-home-command="open-order"]').count(),10);
 assert.equal(await orders.locator('.home-order-product-line').count(),10,'Los diez pedidos muestran sus productos recuperados por línea');
 assert((await orders.locator('.home-order-product-line').first().innerText()).includes('Producto QA'),'Las unidades y nombres proceden de order_details');
 assert((await orders.locator('thead th').allTextContents()).some(label=>label.trim()==='Atendido por'),'La columna de atención existe aunque esté fuera del viewport horizontal');
 fs.mkdirSync('qa-artifacts/inicio',{recursive:true});
 await page.screenshot({path:'qa-artifacts/inicio/escritorio-1440.png',fullPage:true});
 const number=await orders.locator('[data-home-command="open-order"]').first().getAttribute('data-order');
 await orders.locator('[data-home-command="next-page"]').click();
 assert.notEqual(await orders.locator('[data-home-command="open-order"]').first().getAttribute('data-order'),number);
 await orders.locator('[data-home-command="prev-page"]').click();
 assert.equal(await orders.locator('[data-home-command="open-order"]').first().getAttribute('data-order'),number);
 await orders.locator('[data-home-filter="page"]').fill('2');
 await orders.locator('[data-home-filter="page"]').press('Tab');
 assert.notEqual(await orders.locator('[data-home-command="open-order"]').first().getAttribute('data-order'),number,'El selector numérico cambia de página');
 await orders.locator('[data-home-filter="page"]').fill('1');
 await orders.locator('[data-home-filter="page"]').press('Tab');
 assert.equal(await orders.locator('[data-home-command="open-order"]').first().getAttribute('data-order'),number,'El selector regresa a la primera página');
 await orders.locator('[data-home-filter="query"]').fill('QA-R18');
 await orders.locator('[data-home-filter="query"]').press('Tab');
 assert.equal(await orders.locator('[data-home-command="open-order"]').count(),2,'La búsqueda filtra ambos catálogos sin inventar pedidos');
 await orders.locator('[data-home-filter="query"]').fill('');
 await orders.locator('[data-home-filter="query"]').press('Tab');
 await page.locator('[data-home-command="edit"]').click();
 await page.locator('[data-home-command="select"][data-id="orders"]').click();
 await page.locator('[data-home-config="width"]').selectOption('8');
 await page.locator('[data-home-config="height"]').selectOption('5');
 await page.screenshot({path:'qa-artifacts/inicio/editor-1440.png',fullPage:true});
 assert((await orders.getAttribute('style')).includes('--span: 8'));
 assert((await orders.getAttribute('style')).includes('--height: 5'));
 await page.setViewportSize({width:1024,height:900});
 const area=orders.locator('[data-home-orders-viewport]');
 await orders.locator('[data-home-command="scroll-right"]').click();
 await page.waitForTimeout(400);
 if(await area.evaluate(x=>x.scrollWidth>x.clientWidth))
  assert(await area.evaluate(x=>x.scrollLeft>0),'La flecha derecha debe desplazar columnas, no ser decorativa');
 await page.locator('[data-home-config="store"]').selectOption('hortimatic');
 await page.waitForFunction(()=>document.querySelectorAll('[data-home-widget="orders"] tbody tr').length===10);
 assert(!(await orders.locator('tbody').innerText()).includes('NewOldSmok'),'El filtro de tienda se aplica realmente');
 const resize=orders.locator('[data-home-resize="orders"]');
 await resize.focus();await resize.press('ArrowDown');
 assert((await orders.getAttribute('style')).includes('--tablet-height: 10'),'Redimensión de tablet accesible por teclado sin afectar escritorio');
 assert((await orders.getAttribute('style')).includes('--height: 5'),'El tamaño escritorio no cambia al redimensionar la tablet');
 await page.locator('[data-home-command="save"]').click();
 await page.waitForFunction(()=>window.__homeSaved?.revision===1);
 await page.getByText('Tu Inicio se ha guardado y verificado en tu cuenta.',{exact:true}).waitFor();
 await page.locator('[data-home-command="edit"]').click();
 await page.locator('[data-home-command="select"][data-id="orders"]').click();
 await page.locator('[data-home-command="duplicate"][data-id="orders"]').click();
 const duplicated=page.locator('[data-home-type="prestashop.orders"]');
 assert.equal(await duplicated.count(),2,'Duplicación real de la tabla de pedidos');
 const other=duplicated.last(),otherId=await other.getAttribute('data-home-widget');
 assert(otherId&&otherId!=='orders','La tabla duplicada conserva identificador propio');
 await page.locator('[data-home-config="store"]').selectOption('newoldsmok');
 await page.waitForFunction(id=>[...document.querySelectorAll('[data-home-widget="'+id+'"] [data-home-command="open-order"]')].some(x=>x.dataset.order.startsWith('8')),otherId);
 await page.locator('[data-home-command="select"][data-id="orders"]').click();
 await page.locator('[data-home-config="store"]').selectOption('hortimatic');
 await page.waitForFunction(()=>[...document.querySelectorAll('[data-home-widget="orders"] [data-home-command="open-order"]')].some(x=>x.dataset.order.startsWith('7')));
 await other.locator('[data-home-filter="query"]').fill('QA-R18');
 await other.locator('[data-home-filter="query"]').press('Tab');
 assert.equal(await other.locator('[data-home-command="open-order"]').count(),1,'El filtro de la copia se aplica a NewOldSmok');
 assert.equal(await orders.locator('[data-home-command="open-order"]').count(),10,'El otro widget mantiene sus diez pedidos y sus filtros');
 await page.locator('[data-home-command="save"]').click();
 await page.waitForFunction(()=>window.__homeSaved?.revision===2);
 assert.equal(await duplicated.count(),2,'Persisten ambas instancias de pedidos');

 await page.setViewportSize({width:1440,height:960});
 await orders.locator('[data-home-command="open-orders"]').click();
 await page.locator('.ps-tabs [data-prestashop-action="tab"][data-tab="orders"][aria-pressed="true"]').waitFor({timeout:20000});
 assert.equal(new URL(page.url()).searchParams.get('module'),'prestashop','Abrir pedidos navega al módulo correcto');
 await clickModuleLink(page,page.locator('#nav [data-route="inicio"]'));
 const item=page.locator('[data-home-widget="orders"] [data-home-command="open-order"]').first();
 await item.waitFor({timeout:20000});
 const id=await item.getAttribute('data-order'),store=await item.getAttribute('data-shop');
 await item.click();
 await page.locator('.ps-tabs [data-prestashop-action="tab"][data-tab="orders"][aria-pressed="true"]').waitFor({timeout:20000});
 const url=new URL(page.url());assert.equal(url.searchParams.get('ps_order'),id);assert.equal(url.searchParams.get('ps_store'),store);
 await clickModuleLink(page,page.locator('#nav [data-route="inicio"]'));
 await page.locator('.dashboard-hero [data-action="closing-new"]').click();
 await page.locator('#clStore').waitFor({timeout:16000});
 assert.equal(new URL(page.url()).searchParams.get('module'),'cajas','El botón Nuevo cierre abre el formulario existente');
 for(const width of [320,390,768,1024,1440,1920]){
  await page.setViewportSize({width,height:900});
  await clickModuleLink(page,page.locator('#nav [data-route="inicio"]'));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,'Inicio sin desbordamientos a '+width+'px');
  if(width===390)await page.screenshot({path:'qa-artifacts/inicio/movil-390.png',fullPage:true});
 }
 assert.deepEqual(errors,[],'Sin errores Javascript');
 console.log('HOME WIDGET ACTIONS PASS: tiendas, ventas, 10 pedidos, filtros, paginación, scroll, resize, guardado verificado, pedido detallado, caja y seis tamaños');
}finally{
 await browser.close();
 if(server)await new Promise(resolve=>server.close(resolve));
}