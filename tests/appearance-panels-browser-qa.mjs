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
  const {state}=await import('../src/state.js'),{renderers}=await import('../src/pages/main.js'),{applyInterfaceAppearance,createAppearanceUI}=await import('../src/appearance-ui.js'),{setOneDriveStatus}=await import('../src/onedrive-connection.js'),{connectionsHtml,mountConnectionsTabs}=await import('../src/connections-ui.js');
  state.data.storageUsage={status:'ok',total_bytes:1000,limit_bytes:100000,backup_bytes:2000,database_bytes:3000,observed_total_bytes:6000,all_buckets_bytes:3000,buckets:[],measured_at:new Date().toISOString()};
  state.data.brands=[{id:'qa-brand-1',name:'Marca ficticia',website:'',email:'',phone:''},{id:'qa-brand-2',name:'Segunda marca de prueba',website:'https://example.invalid/marca-con-direccion-larga',email:'',phone:''}];
  state.views.administracion.section='storage';
  setOneDriveStatus({configured:true,connected:true,credential_expires_at:'2027-04-18',quota:{used:1000,total:100000}});
  window.panelRender=(route,config)=>{state.route=route;applyInterfaceAppearance(config);document.querySelector('#content').innerHTML=renderers[route]();if(route==='configuracion'){const host=document.querySelector('#appearanceRoot');createAppearanceUI({settings:()=>({appearance_config:config}),save:async()=>{},actor:()=>state.user.email,canEdit:()=>true,confirm:async()=>true}).mount(host);const page=document.querySelector('.appearance-page');page.insertAdjacentHTML('beforeend',connectionsHtml());mountConnectionsTabs(page,{appearance:host,connections:document.querySelector('#connectionsRoot'),guard:async()=>true,disposeTest:()=>{},mountTest:()=>{}});}};
 });
 const selectors={inicio:'.dashboard-hero,.store-status-card',fiscalidad:'.fiscal-page>section.card:first-of-type',informes:'.reports-page>section.card:first-of-type',administracion:'.storage-provider-card,.credential-card,.storage-backup-strip,.storage-detail-panel',configuracion:'.configuration-sections,.appearance-tools'};
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
 assert.deepEqual(errors,[]);console.log('APPEARANCE PANELS: actual home, fiscal, reports, storage and configuration panels follow border/color/radius/glow at 0px and 3px, desktop/intermediate/mobile; brands one frame.');
}finally{await browser.close();}
