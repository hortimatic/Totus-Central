import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true}),page=await browser.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await mkdir('artifacts/appearance-panels',{recursive:true});
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await page.locator('#nav [data-route]').first().waitFor();
 await page.evaluate(async()=>{
  const {state}=await import('../src/state.js'),{renderers}=await import('../src/pages/main.js'),{applyInterfaceAppearance,createAppearanceUI}=await import('../src/appearance-ui.js'),{setOneDriveStatus}=await import('../src/onedrive-connection.js');
  state.data.storageUsage={status:'ok',total_bytes:1000,limit_bytes:100000,backup_bytes:2000,database_bytes:3000,observed_total_bytes:6000,all_buckets_bytes:3000,buckets:[],measured_at:new Date().toISOString()};
  state.data.brands=[{id:'qa-brand-1',name:'Marca ficticia',website:'',email:'',phone:''},{id:'qa-brand-2',name:'Segunda marca de prueba',website:'https://example.invalid/marca-con-direccion-larga',email:'',phone:''}];
  state.views.administracion.section='storage';
  setOneDriveStatus({configured:true,connected:true,credential_expires_at:'2027-04-18',quota:{used:1000,total:100000}});
  window.panelRender=(route,config)=>{state.route=route;applyInterfaceAppearance(config);document.querySelector('#content').innerHTML=renderers[route]();if(route==='configuracion'){const host=document.querySelector('#appearanceRoot');createAppearanceUI({settings:()=>({appearance_config:config}),save:async()=>{},actor:()=>state.user.email,canEdit:()=>true,confirm:async()=>true}).mount(host);}};
 });
 const selectors={inicio:'.dashboard-hero,.store-status-card',fiscalidad:'.fiscal-page>section.card:first-of-type',informes:'.reports-page>section.card:first-of-type',administracion:'.storage-provider-card,.credential-card,.storage-backup-strip,.storage-detail-panel',configuracion:'.appearance-page>.card',apis:'[data-api-manager]'};
 for(const width of [1440,934,390]){
  await page.setViewportSize({width,height:900});
  for(const borderWidth of [0,3])for(const [route,selector] of Object.entries(selectors)){
   const config={borderWidth,borderColor:'#9357d4',borderStrength:24,radius:borderWidth?20:8,shadow:'strong',cardGlow:12,fontSize:16};
   await page.evaluate(({route,config})=>panelRender(route,config),{route,config});
   const panels=await page.locator(selector).evaluateAll(es=>es.map(e=>{const s=getComputedStyle(e);return {class:e.className,widths:['Top','Right','Bottom','Left'].map(side=>s['border'+side+'Width']),colors:['Top','Right','Bottom','Left'].map(side=>s['border'+side+'Color']),radius:s.borderTopLeftRadius,shadow:s.boxShadow};}));
   assert(panels.length>0,route+' renders its panels');if(route==='administracion')assert.equal(panels.length,10,'all storage panels covered');if(route==='inicio')assert.equal(panels.length,3,'hero and both stores covered');
   for(const panel of panels){assert.deepEqual(panel.widths,Array(4).fill(borderWidth+'px'),route+' '+panel.class);assert.deepEqual(panel.colors,Array(4).fill('rgb(147, 87, 212)'),route+' border color');assert.equal(panel.radius,config.radius+'px',route+' radius');assert(panel.shadow.includes('12px'),route+' personal glow');}
   if(['fiscalidad','informes'].includes(route)){
    const corners=await page.locator(selector+'>.filters').evaluate(e=>{const s=getComputedStyle(e);return [s.borderTopLeftRadius,s.borderBottomRightRadius,getComputedStyle(e.parentElement).overflow];});
    assert.deepEqual(corners.slice(0,2),Array(2).fill(Math.max(0,config.radius-borderWidth)+'px'));assert.notEqual(corners[2],'hidden','help remains unclipped');
   }
   assert(await page.locator('#content').evaluate(e=>e.scrollWidth<=e.clientWidth+1),route+' no page overflow '+width);
   if(borderWidth===3)await page.screenshot({path:'artifacts/appearance-panels/'+route+'-'+width+'.png',fullPage:true});
  }
  await page.evaluate(()=>panelRender('marcas',{borderWidth:3,radius:20}));
  assert.equal(await page.locator('.contact-brands-page>.card>.table-wrap').evaluate(e=>getComputedStyle(e).borderTopWidth),'0px','brand directory has one outer frame');
  if(width>800)assert(await page.locator('.contact-brands-page .table-wrap').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'brand actions fit desktop table');
 }
 // Personal row height is a minimum. Once cells become blocks, a fixed height
 // clips long receipt names and makes equivalence actions overlap the next row.
 for(const width of [390,753,1017,1440])for(const tableRowHeight of [34,52]){
  await page.setViewportSize({width,height:900});
  await page.evaluate(({tableRowHeight})=>{
   panelRender('marcas',{tableRowHeight,fontSize:16});
   document.querySelector('#content').innerHTML='<section class="card card-pad"><div class="table-wrap mobile-card-table"><table class="data-table"><thead><tr><th>Proveedor</th><th>Producto</th><th>Revisión</th></tr></thead><tbody>'+Array.from({length:3},()=>'<tr><td data-label="Proveedor">Garden Seeds Trading, S.L.</td><td data-label="Producto">CBD E-Liquid Iguana Smoke Gorilla Glue 100 mg. 10 ml.<p>Variante y cantidad documentales que deben quedar visibles al consultar la recepción.</p></td><td data-label="Revisión"><p>Correspondencia sin confirmar. Hay que revisar la variante exacta antes de guardar.</p><p>Observación documental de varias líneas que no debe pisar la fila siguiente.</p><div class="inline-actions"><button class="btn secondary">Guardar equivalencia</button><button class="btn secondary">Corregir unidades</button></div></td></tr>').join('')+'</tbody></table></div></section>';
  },{tableRowHeight});
  const geometry=await page.locator('.mobile-card-table tbody>tr').evaluateAll(rows=>rows.map(row=>({bottom:row.getBoundingClientRect().bottom,cells:Array.from(row.cells).map(cell=>({bottom:cell.getBoundingClientRect().bottom,contentBottom:Math.max(...Array.from(cell.children).map(e=>e.getBoundingClientRect().bottom),cell.getBoundingClientRect().top)}))})));
  for(const row of geometry)for(const cell of row.cells){assert(cell.bottom<=row.bottom+1,'cell stays inside row at '+width);assert(cell.contentBottom<=cell.bottom+1,'text and actions stay inside cell at '+width+' with personal height '+tableRowHeight);}
 }
 assert.deepEqual(errors,[]);console.log('APPEARANCE PANELS: personal borders and table row minimums verified across desktop/intermediate/mobile, including long receipt names, notes and actions.');
}finally{await browser.close();}
