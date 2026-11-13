import assert from 'node:assert/strict';
import fs from 'node:fs';
const {chromium}=await import(process.env.TOTUS_PLAYWRIGHT_MODULE||'playwright');
import {startLocalServer} from './local-static-server.mjs';
import {clickModuleLink} from './ui-navigation.mjs';

const server=await startLocalServer();
const browser=await chromium.launch({headless:true,...(process.env.TOTUS_BROWSER_CHANNEL?{channel:process.env.TOTUS_BROWSER_CHANNEL}:{})});
const page=await browser.newPage({viewport:{width:1440,height:960},locale:'es-ES'});
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('dialog',dialog=>dialog.accept());
try{
 const src=fs.readFileSync('tests/mock-supabase.js','utf8');
 const rpcMarker='const rpc=async (name,args={})=>{';
 const rpcInject=[
  rpcMarker,
  " if(['totus_tasks_context','totus_home_tasks_context'].includes(name)){window.__qaTaskCalls||=[];window.__qaTaskCalls.push(args);return {data:{rows:[{task_id:'task-qa',title:'Tarea del calendario QA',scheduled_on:args.p_from,state:'pending',description:'',priority:'normal'}],stores:[],people:[]},error:null};}",
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
  "  if(a.action==='prestashop_item_read'&&resource==='combinations')return {data:{ok:true,store:shop,item:{id:a.record_id,id_product:'11',wholesale_price:'4'}},error:null};",
  "  if(a.action!=='prestashop_read')return {data:{error:'Acción no simulada'},error:null};",
  "  let rows=[];",
  "  if(resource==='orders'&&a.page===0)rows=Array.from({length:24},(_,i)=>({",
  "   id:String((shop==='hortimatic'?7000:8000)+i),reference:'QA-R'+i,date_add:day+' 12:00:00',",
  "   total_paid_tax_incl:'12.500000',total_paid_tax_excl:'10.330000',total_shipping_tax_excl:'0',total_wrapping_tax_excl:'0',id_currency:'1',payment:i%3===0?'Bizum':i%3===1?'Transferencia bancaria':'Tarjeta',valid:'1',current_state:'21',id_customer:'0'",
  "  }));",
  "  if(resource==='products'&&a.page===0)rows=[{id:'101',name:'QA Producto A',reference:'',ean13:'',weight:'0'},{id:'102',name:'QA Producto B',reference:'SKU102',ean13:'1234567890123',weight:'0.1'},{id:'103',name:'QA Producto C',reference:'SKU103',ean13:'1234567890123',weight:'0.2'}];",
  "  if(resource==='products'&&a.product_ids)rows=a.product_ids.map(id=>({id,name:'QA Producto',wholesale_price:'3',id_default_image:'40'}));",
  "  if(resource==='order_histories')rows=(a.order_ids||[]).map(id=>({id:String(200000+Number(id)),id_order:id,id_employee:'2',date_add:day+' 12:00:00'}));",
  "  if(resource==='employees')rows=[{id:'2',firstname:'Persona',lastname:'QA'}];",
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
 await page.locator('[data-home-widget="opening"]').waitFor({timeout:30000});
 for(const label of ['Vape','Head','NewOldSmok'])assert((await page.locator('[data-home-widget="opening"]').innerText()).includes(label));
 await page.waitForFunction(()=>document.querySelectorAll('[data-home-widget="shop-h"] .home-ps-metrics strong').length>=5);
 await page.waitForFunction(()=>document.querySelectorAll('[data-home-widget="shop-n"] .home-ps-metrics strong').length>=5);
 await page.getByText('300,00 €',{exact:true}).first().waitFor();
 await page.locator('[data-home-widget="gain"] .home-commercial-total').filter({hasText:'303,84'}).waitFor();
 assert.equal(await page.locator('[data-home-widget="gain"] .home-commercial-chart svg').count(),1);
 assert.equal(await page.evaluate(()=>window.__qaHomeContextCalls),1,'Un solo contexto autenticado sirve a todos los widgets PrestaShop de Inicio');
 const h=await page.locator('[data-home-widget="shop-h"]').boundingBox();
 const n=await page.locator('[data-home-widget="shop-n"]').boundingBox();
 assert(h&&n&&Math.abs(h.y-n.y)<12&&n.x>h.x+8,'Ambas tiendas deben verse paralelas en escritorio');
 assert((await page.locator('[data-home-widget="shop-h"] .home-ps-top').innerText()).includes('Producto QA 0 mg'),'Se conserva la combinación 0 mg en más vendidos');
 assert((await page.locator('[data-home-widget="shop-h"] .home-ps-top').innerText()).includes('Producto QA 10 mg'),'Se conserva la combinación 10 mg sin mezclar variantes');

 // Stitch: periodos reales, no botones decorativos. Cada cambio conserva la otra tienda.
 const summary=page.locator('[data-home-widget="shop-h"]');
 await summary.locator('[data-home-command="period-day"]').click();
 await summary.locator('.home-chart-column').first().waitFor();
 await page.waitForFunction(()=>document.querySelectorAll('[data-home-widget="shop-h"] .home-chart-column').length===24);
 assert.equal(await summary.locator('[data-home-command="period-day"]').getAttribute('aria-pressed'),'true');
 await summary.locator('[data-home-command="period-week"]').click();
 await page.waitForFunction(()=>document.querySelectorAll('[data-home-widget="shop-h"] .home-chart-column').length===7);
 assert.equal(await summary.locator('[data-home-command="period-week"]').getAttribute('aria-pressed'),'true');
 await summary.locator('[data-home-command="period-month"]').click();
 await page.waitForFunction(()=>document.querySelectorAll('[data-home-widget="shop-h"] .home-chart-column').length>=28);
 assert.equal(await summary.locator('[data-home-filter="periodMonth"]').count(),1,'Mes seleccionable');
 await summary.locator('[data-home-command="period-custom"]').click();
 assert.equal(await summary.locator('[data-home-filter="from"]').count(),1,'Desde personalizado');
 assert.equal(await summary.locator('[data-home-filter="to"]').count(),1,'Hasta personalizado');
 assert.equal(await page.locator('[data-home-widget="shop-n"] [data-home-command="period-custom"]').getAttribute('aria-pressed'),'true','Los periodos de las tiendas son independientes');
 const orders=page.locator('[data-home-widget="orders"]');
 assert((await summary.locator('.home-ps-metrics').innerText()).includes('151,92'), 'Summary calculates shared commercial margin');
 assert.equal(await summary.locator('.home-ps-top img').count(),2,'Each ranked variant has a product picture');
 await page.waitForFunction(()=>document.querySelectorAll('[data-home-widget="orders"] tbody tr').length===10);
 const today=new Date().toISOString().slice(0,10);
 await orders.locator('[data-home-filter="from"]').fill(today);
 await page.waitForFunction(()=>document.querySelectorAll('[data-home-widget="orders"] tbody tr').length===10);
 assert.equal(await orders.locator('[data-home-filter="from"]').inputValue(),today,'El periodo se cambia desde la propia tabla');
 assert.equal(await orders.locator('.home-orders-table [data-home-command="open-order"]').count(),10);
 const options=await orders.locator('[data-home-filter="payment"] option').allTextContents();
 assert(options.includes('Bizum')&&options.includes('Transferencia bancaria'),'Payment filters use all native payment names');
 assert((await orders.locator('tbody').innerText()).includes('Persona QA'),'Native initial registration employee is represented');
 assert((await orders.locator('tbody').innerText()).includes('6,33'),'Each order displays its calculated margin');
 assert.equal(await orders.locator('.home-orders-table .home-order-product-line').count(),10,'Los diez pedidos muestran sus productos recuperados por línea');
 assert((await orders.locator('.home-order-product-line').first().innerText()).includes('Producto QA'),'Las unidades y nombres proceden de order_details');
 assert((await orders.locator('thead th').allTextContents()).some(label=>label.trim()==='Atendido por'),'La columna de atención existe aunque esté fuera del viewport horizontal');
 // Regression: image and readable product text must not compete in a tiny equal-width column.
 for(const width of [1017,1337,1920,2560]){
  await page.setViewportSize({width,height:960});
  const cell=orders.locator('.home-orders-products').first();
  if(await cell.isVisible()){
   const metrics=await cell.evaluate(el=>({width:el.getBoundingClientRect().width,text:el.querySelector('.home-order-product-line>span')?.getBoundingClientRect().width,viewport:el.closest('.home-orders-scroll').clientWidth,table:el.closest('table').getBoundingClientRect().width}));
   assert(metrics.width>=290&&metrics.text>=220,'Product photo and text have independent readable space at '+width);
   assert(metrics.table>=metrics.viewport,'The table scrolls rather than compressing all columns');
   if(metrics.table>metrics.viewport+1){
    await orders.locator('[data-home-command="scroll-right"]').click();
    await page.waitForFunction(()=>document.querySelector('[data-home-orders-viewport="orders"]').scrollLeft>0);
   }
  }
 }
 await page.setViewportSize({width:1440,height:960});
 fs.mkdirSync('qa-artifacts/inicio',{recursive:true});
 await page.screenshot({path:'qa-artifacts/inicio/escritorio-1440.png',fullPage:true});
 const number=await orders.locator('.home-orders-table [data-home-command="open-order"]').first().getAttribute('data-order');
 await orders.locator('[data-home-command="next-page"]').click();
 assert.notEqual(await orders.locator('.home-orders-table [data-home-command="open-order"]').first().getAttribute('data-order'),number);
 await orders.locator('[data-home-command="prev-page"]').click();
 assert.equal(await orders.locator('.home-orders-table [data-home-command="open-order"]').first().getAttribute('data-order'),number);
 await orders.locator('[data-home-filter="page"]').fill('2');
 await orders.locator('[data-home-filter="page"]').press('Tab');
 assert.notEqual(await orders.locator('.home-orders-table [data-home-command="open-order"]').first().getAttribute('data-order'),number,'El selector numérico cambia de página');
 await orders.locator('[data-home-filter="page"]').fill('1');
 await orders.locator('[data-home-filter="page"]').press('Tab');
 assert.equal(await orders.locator('.home-orders-table [data-home-command="open-order"]').first().getAttribute('data-order'),number,'El selector regresa a la primera página');
 await orders.locator('[data-home-filter="query"]').fill('QA-R18');
 await orders.locator('[data-home-filter="query"]').press('Tab');
 assert.equal(await orders.locator('.home-orders-table [data-home-command="open-order"]').count(),2,'La búsqueda filtra ambos catálogos sin inventar pedidos');
 await orders.locator('[data-home-filter="query"]').fill('');
 await orders.locator('[data-home-filter="query"]').press('Tab');
 await page.locator('[data-home-command="edit"]').click();
 const selectHomeWidget=async id=>{
  const close=page.locator('[data-home-command="close-panel"]');
  if(await close.count())await close.click();
  await page.locator('[data-home-command="select"][data-id="'+id+'"]').click();
 };
 
 await selectHomeWidget('shop-h');
 await page.locator('[data-home-config="chartMode"]').selectOption('days');
 await page.locator('[data-home-config="chartMetric"]').selectOption('sales');
 assert((await page.locator('[data-home-widget="shop-h"] .home-ps-chart figcaption').innerText()).includes('Ventas válidas EUR'),'La gráfica de ventas lee importes EUR validados');
 assert((await page.locator('[data-home-widget="shop-n"] .home-ps-chart figcaption').innerText()).includes('Pedidos válidos'),'La gráfica de la segunda tienda conserva su configuración');
 const theme=await page.evaluate(()=>{
  const el=document.querySelector('[data-home-widget="shop-h"] .home-ps-chart'),root=document.documentElement;
  const before=getComputedStyle(el).borderTopColor,old=root.style.getPropertyValue('--line');
  root.style.setProperty('--line','#ed7600');const after=getComputedStyle(el).borderTopColor;
  if(old)root.style.setProperty('--line',old);else root.style.removeProperty('--line');
  return {before,after};
 });
 assert.notEqual(theme.before,theme.after,'Los bordes del gráfico heredan el color activo de Mi interfaz');

 await page.locator('[data-home-config="showMetrics"]').selectOption('no');
 assert.equal(await page.locator('[data-home-widget="shop-h"] .home-ps-metrics').count(),0,'Ocultar indicadores modifica el widget de verdad');
 await page.locator('[data-home-config="showMetrics"]').selectOption('yes');
 await page.locator('[data-home-config="chartMode"]').selectOption('hours');
 assert.equal(await page.locator('[data-home-widget="shop-h"] .home-chart-column').count(),24,'La gráfica de horas presenta 24 franjas');
 await page.locator('[data-home-config="topLimit"]').selectOption('8');
 await page.locator('.home-toolbar-actions [data-home-command="panel-library"]').click();
 await page.locator('[data-home-command="add"][data-type="prestashop.top"]').click();
 const productWidget=page.locator('[data-home-type="prestashop.top"]');
 await page.waitForFunction(()=>document.querySelectorAll('[data-home-type="prestashop.top"] .home-products-table tbody tr').length===4);
 assert((await productWidget.locator('thead').first().locator('th').allTextContents()).map(x=>x.trim()).includes('Referencia'),'Cada tabla contiene referencia incluso cuando su columna está fuera del área visible');
 assert((await productWidget.locator('tbody td').allTextContents()).some(x=>x.includes('SKU-QA-10')),'La referencia de la combinación llega del pedido aunque la columna esté desplazada');
 assert((await productWidget.locator('tbody td').allTextContents()).some(x=>x.includes('Combinación #20')),'No se mezclan variantes aunque la columna esté fuera del viewport');
 await page.locator('[data-home-config="productView"]').selectOption('bars');
 assert.equal(await productWidget.locator('.home-products-bars').count(),2,'La vista barras funciona separada por tienda');
 await page.locator('[data-home-config="topLimit"]').selectOption('8');
 await page.locator('.home-toolbar-actions [data-home-command="panel-library"]').click();
 await page.locator('[data-home-command="add"][data-type="prestashop.quality"]').click();
 const quality=page.locator('[data-home-type="prestashop.quality"]');
 await page.waitForFunction(()=>document.querySelectorAll('[data-home-type="prestashop.quality"] .home-quality-shop').length===2);
 await quality.getByText('QA Producto A').first().waitFor();
 assert((await quality.innerText()).includes('Sin referencia'),'Calidad muestra problemas de productos consultados');
 await page.locator('[data-home-config="store"]').selectOption('hortimatic');
 assert.equal(await quality.locator('.home-quality-shop').count(),1,'La revisión de calidad permite filtrar por tienda');
 await selectHomeWidget('shop-h');
 await page.getByText('3 avisos',{exact:true}).first().waitFor();
 await selectHomeWidget('orders');
 await page.locator('[data-home-config="tableDensity"]').selectOption('compact');
 assert.equal(await orders.locator('tbody td').first().evaluate(el=>getComputedStyle(el).paddingTop),'5px','La densidad elegida modifica realmente las filas');
 await page.locator('[data-home-command="column-up"][data-id="orders"][data-column="products"]').click();
 assert.deepEqual((await orders.locator('thead th').allTextContents()).slice(0,3).map(x=>x.trim()),['Pedido','Productos','Referencia'],'Ordenar columnas cambia la tabla');
 await page.locator('[data-home-column="employee"]').uncheck();
 assert(!(await orders.locator('thead th').allTextContents()).includes('Atendido por'),'Ocultar columna no la elimina de otras tablas');
 await page.locator('[data-home-config="width"]').selectOption('8');
 await page.locator('[data-home-config="height"]').selectOption('5');
 await page.screenshot({path:'qa-artifacts/inicio/editor-1440.png',fullPage:true});
 assert((await orders.getAttribute('style')).includes('--span: 8'));
 assert((await orders.getAttribute('style')).includes('--height: 5'));
 await page.setViewportSize({width:1024,height:900});
 assert.equal(await orders.locator('.home-orders-cards').isVisible(),true,'Los pedidos pasan a fichas al estrechar el widget');
 assert.equal(await orders.locator('.home-orders-scroll').isVisible(),false,'No se mantiene tabla con scroll en modo compacto');
 const noScroll=await orders.locator('[data-home-orders-viewport]').evaluate(el=>({overflow:getComputedStyle(el).overflowX,overWidth:el.scrollWidth>el.clientWidth+2}));
 assert.equal(noScroll.overflow,'auto','La tabla amplia conserva desplazamiento horizontal cuando se muestra');
 assert.equal(await orders.locator('.home-orders-scroll').isVisible(),false,'En modo compacto no aparece ninguna barra de la tabla oculta');
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
 await selectHomeWidget('orders');
 await page.locator('[data-home-command="duplicate"][data-id="orders"]').click();
 const duplicated=page.locator('[data-home-type="prestashop.orders"]');
 assert.equal(await duplicated.count(),2,'Duplicación real de la tabla de pedidos');
 const other=duplicated.last(),otherId=await other.getAttribute('data-home-widget');
 assert(otherId&&otherId!=='orders','La tabla duplicada conserva identificador propio');
 await page.locator('[data-home-config="store"]').selectOption('newoldsmok');
 await page.waitForFunction(id=>[...document.querySelectorAll('[data-home-widget="'+id+'"] [data-home-command="open-order"]')].some(x=>x.dataset.order.startsWith('8')),otherId);
 await selectHomeWidget('orders');
 await page.locator('[data-home-config="store"]').selectOption('hortimatic');
 await page.waitForFunction(()=>[...document.querySelectorAll('[data-home-widget="orders"] [data-home-command="open-order"]')].some(x=>x.dataset.order.startsWith('7')));
 await other.locator('[data-home-filter="query"]').fill('QA-R18');
 await other.locator('[data-home-filter="query"]').press('Tab');
 assert.equal(await other.locator('.home-orders-table [data-home-command="open-order"]').count(),1,'El filtro de la copia se aplica a NewOldSmok');
 assert.equal(await orders.locator('.home-orders-table [data-home-command="open-order"]').count(),10,'El otro widget mantiene sus diez pedidos y sus filtros');
 await page.locator('[data-home-command="save"]').click();
 await page.waitForFunction(()=>window.__homeSaved?.revision===2);
 assert.equal(await duplicated.count(),2,'Persisten ambas instancias de pedidos');

 await page.setViewportSize({width:1440,height:960});
 await orders.locator('[data-home-command="open-orders"]').click();
 await page.locator('.ps-tabs [data-prestashop-action="tab"][data-tab="orders"][aria-pressed="true"]').waitFor({timeout:20000});
 assert.equal(new URL(page.url()).searchParams.get('module'),'prestashop','Abrir pedidos navega al módulo correcto');
 await clickModuleLink(page,page.locator('#nav [data-route="inicio"]'));
 const item=page.locator('[data-home-widget="orders"] [data-home-command="open-order"]:visible').first();
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
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2)){console.log('OVERFLOW',width,await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.right>innerWidth+2&&getComputedStyle(el).position!=='fixed';}).slice(0,18).map(el=>({tag:el.tagName,class:el.className,width:Math.round(el.getBoundingClientRect().width),right:Math.round(el.getBoundingClientRect().right),text:el.textContent.slice(0,65)}))));}
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,'Inicio sin desbordamientos a '+width+'px');
  if(width===390)await page.screenshot({path:'qa-artifacts/inicio/movil-390.png',fullPage:true});
 }
 const taskWidget=page.locator('[data-home-widget="tasks"]');await taskWidget.getByRole('button',{name:'Día',exact:true}).click();await taskWidget.locator('[data-ht-date]').fill('2026-11-12');await taskWidget.locator('[data-ht-date]').blur();await taskWidget.getByRole('button',{name:'Abrir Tareas',exact:true}).click();await page.locator('.tasks-calendar.week').waitFor();assert.equal(await page.locator('.task-day').count(),7);assert(await page.evaluate(()=>window.__qaTaskCalls.some(a=>a.p_from==='2026-11-09'&&a.p_to==='2026-11-15')),'The calendar opens the selected date in Tasks');
 assert.deepEqual(errors,[],'Sin errores Javascript');
 console.log('HOME WIDGET ACTIONS PASS: tiendas, ventas, 10 pedidos, filtros, paginación, scroll, resize, guardado verificado, pedido detallado, caja y seis tamaños');
}finally{
 await browser.close();
 if(server)await new Promise(resolve=>server.close(resolve));
}