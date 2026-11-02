import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true}),page=await browser.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await mkdir('artifacts/responsive-controls',{recursive:true});
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});await page.locator('#nav [data-route]').first().waitFor();
 await page.evaluate(async()=>{
  const {state}=await import('../src/state.js'),{renderers}=await import('../src/pages/main.js'),{applyInterfaceAppearance}=await import('../src/appearance-ui.js');
  const date=new Date().toISOString();
  state.data.templates=[{id:'qa-template',name:'Plantilla ficticia con nombre extenso para documentos comerciales',code:'QA-LONG-TEMPLATE',brand_name:'Marca de ensayo',logo_filename:'logotipo-con-nombre-largo.png',is_active:true}];
  state.data.series=[{id:'qa-series',name:'Serie ficticia de documentación',prefix:'QA',next_number:1,document_type:'factura',active:true}];
  state.data.documents=[{id:'qa-document',original_name:'Factura ficticia para comprobar todos los controles y nombres largos.pdf',document_date:date.slice(0,10),supplier_or_customer:'Proveedor ficticio de ensayo',mime_type:'application/pdf',size_bytes:1000,status:'pendiente',store_id:state.data.stores[0].id}];
  state.data.suppliers=[{id:'qa-supplier',name:'Proveedor ficticio con un nombre largo de prueba',email:'contacto@example.invalid',tax_id:'QA-FICTION',active:true,default_vat_rate:21,default_re_rate:0}];
  state.data.team=[{email:'usuario-con-correo-largo@example.invalid',full_name:'Usuario ficticio de ensayo',role:'admin',active:true}];
  state.data.roles=[{code:'admin',name:'Administrador',description:'Control de prueba',is_system:true},{code:'gerente',name:'Gerencia',description:'Descripción de prueba más larga que debe conservar su alineación',is_system:true},{code:'dependiente',name:'Dependiente',description:'Ensayo',is_system:false}];
  state.data.backupRuns=[{id:'qa-backup',status:'success',storage_path:'qa-only.zip',started_at:date,finished_at:date,total_bytes:100000,table_count:10,file_count:5}];
  state.data.recoveryJobs=[{id:'qa-recovery',status:'completed',created_at:date,requested_by:'solicitante@example.invalid'}];
  window.renderControls=(route,section)=>{state.route=route;if(section)state.views[route]={...state.views[route],section};document.querySelector('#content').innerHTML=renderers[route]();applyInterfaceAppearance({fontSize:16,sidebarWidth:300,borderWidth:3,radius:15,cardGlow:12});};
 });
 for(const width of [1700,1340,1017,768,390]){
  await page.setViewportSize({width,height:660});
  for(const [route,section] of [['inicio',null],['facturacion','plantillas'],['facturacion','series'],['documentos',null],['proveedores',null],['administracion','usuarios'],['administracion','backups'],['administracion','roles']]){
   await page.evaluate(([r,s])=>renderControls(r,s),[route,section]);
   const tables=await page.locator('#content .mobile-card-table').evaluateAll(es=>es.map(e=>({border:getComputedStyle(e).borderLeftWidth,client:e.clientWidth,scroll:e.scrollWidth,cells:e.querySelectorAll('td').length})));
   if(route!=='inicio'&&section!=='roles')assert(tables.length,'fixture renders table for '+route+'/'+section);
   for(const table of tables){assert.equal(table.border,'0px','one outer frame '+route+'/'+section);assert(table.scroll<=table.client+1,'no horizontal table scroll '+width+' '+route+'/'+section);assert(table.cells>0,'all cells retained');}
   assert(await page.locator('#content').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'page fits '+width+' '+route+'/'+section);
   for(const tab of await page.locator('.module-tabs').all())assert(await tab.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'tabs wrap without scrollbar');
   if(route==='inicio'){const buttons=await page.locator('.dashboard-hero-actions>.btn').evaluateAll(es=>es.map(e=>({x:e.offsetLeft,y:e.offsetTop,w:e.getBoundingClientRect().width})));assert.equal(buttons.length,4);assert(Math.abs(buttons[0].y-buttons[1].y)<1);assert(Math.abs(buttons[2].y-buttons[3].y)<1);assert(Math.abs(buttons[0].w-buttons[3].w)<1,'Home shortcuts share a regular grid');}
   if(section==='roles'){
    const cards=await page.locator('.role-card').evaluateAll(es=>es.map(e=>({top:e.getBoundingClientRect().top,badge:e.querySelector('.section-head>.badge').getBoundingClientRect().top,head:e.querySelector('.section-head').getBoundingClientRect().top})));
    for(const card of cards)assert(Math.abs(card.badge-card.head)<1,'role label stays at header top');
   }
   if(section==='backups')for(const font of await page.locator('.backup-page>.kpis strong').evaluateAll(es=>es.map(e=>parseFloat(getComputedStyle(e).fontSize))))assert(font<=18,'compact backup metrics');
   if(width===1017)await page.screenshot({path:'artifacts/responsive-controls/'+route+'-'+(section||'main')+'.png',fullPage:true});
  }
 }
 await page.setViewportSize({width:1017,height:660});await page.evaluate(()=>renderControls('proveedores'));
 await page.locator('[data-action=expense-supplier-new]').click();await page.locator('#esDeductible').waitFor();
 const check=await page.locator('#esDeductible').boundingBox();assert(check.width<=24&&check.height<=24,'checkbox is not a full-width text field');
 const before=await page.locator('.modal-head').boundingBox();await page.locator('.modal-body').evaluate(e=>e.scrollTop=e.scrollHeight);await page.waitForTimeout(30);const after=await page.locator('.modal-head').boundingBox();assert(Math.abs(before.y-after.y)<1,'modal header remains outside the scrolling fields');
 assert(await page.locator('.modal-body').evaluate(e=>e.scrollHeight>e.clientHeight),'long supplier form scrolls inside its body');
 await page.screenshot({path:'artifacts/responsive-controls/supplier-modal.png'});
 const heights=await page.locator('#headerTools>button:visible').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().height));assert(Math.max(...heights)-Math.min(...heights)<1,'header tools share one height');
 assert.deepEqual(errors,[]);console.log('RESPONSIVE CONTROLS: tables, tabs, roles, compact backup metrics, supplier checkbox and modal scrolling at five widths.');
}finally{await browser.close();}
