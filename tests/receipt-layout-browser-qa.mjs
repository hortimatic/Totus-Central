import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true}),errors=[];
await mkdir('artifacts/receipt-layout',{recursive:true});
try{
 for(const width of [1440,934,390]){
  const page=await browser.newPage({viewport:{width,height:900}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
  await page.evaluate(async()=>{
   const {state}=await import('../src/state.js'),{sb}=await import('../src/api.js'),{stockAction,stockPage}=await import('../src/stock-ui.js');
   const receipt={id:'11111111-aaaa-4111-8111-111111111111',store_id:state.data.stores[0].id,supplier:'Proveedor ficticio',reference:'QA visual',received_on:'2026-11-02',revision:1,status:'pending',result:{rows:[]}};
   const previous=sb.rpc.bind(sb);sb.rpc=async(name,args)=>name==='totus_stock_context'?{data:{receipt,sources:[],equivalences:[]}}:previous(name,args);
   window.__mockDb.ops_stock_revisions=[];state.route='cotejos';
   await stockAction('stock-open',{dataset:{id:receipt.id}},{render:()=>{document.querySelector('#content').innerHTML=stockPage();}});
   const {applyInterfaceAppearance}=await import('../src/appearance-ui.js');applyInterfaceAppearance({fontSize:16,logoHeight:62,sidebarWidth:256,navigationMode:'expanded'});
  });
  await page.locator('#stockFiles').waitFor();
  const geometry=await page.evaluate(()=>{
   const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
   return {select:rect('#stockKind'),file:rect('#stockFiles'),grid:rect('.stock-upload'),brand:rect('#moduleNavigation>.brand'),rail:rect('#moduleNavigation'),toggle:rect('.desktop-nav-collapse'),glyph:rect('.desktop-nav-collapse svg'),scroll:document.documentElement.scrollWidth,viewport:innerWidth};
  });
  assert(geometry.scroll<=geometry.viewport+1,'no horizontal page overflow at '+width);
  for(const field of [geometry.select,geometry.file]){assert(field.x>=geometry.grid.x-1&&field.right<=geometry.grid.right+1);assert(Math.abs(field.height-44)<=1);}
  if(width>600)assert(Math.abs(geometry.select.y-geometry.file.y)<=1,'upload controls share the same baseline');
  if(width>800){
   assert(geometry.brand.y<=geometry.rail.y+8,'brand starts at the top rather than below a separate toggle row');
   assert(Math.abs((geometry.glyph.y+geometry.glyph.height/2)-(geometry.toggle.y+geometry.toggle.height/2))<=1,'arrow itself is vertically centered');
   assert(Math.abs((geometry.glyph.x+geometry.glyph.width/2)-(geometry.toggle.x+geometry.toggle.width/2))<=1,'arrow itself is horizontally centered');
   assert(Math.abs((geometry.toggle.y+geometry.toggle.height/2)-(geometry.brand.y+geometry.brand.height/2))<=1,'collapse button is centered in the brand header');
   await page.locator('.desktop-nav-collapse').click();assert.equal(await page.locator('.desktop-nav-collapse').getAttribute('aria-expanded'),'false');
   await page.locator('.desktop-nav-collapse').click();assert.equal(await page.locator('.desktop-nav-collapse').getAttribute('aria-expanded'),'true');
  }
  await page.locator('.stock-upload').scrollIntoViewIfNeeded();
  await page.screenshot({path:'artifacts/receipt-layout/'+width+'.png',fullPage:true});await page.close();
 }
 assert.deepEqual(errors,[]);console.log('RECEIPT LAYOUT QA: desktop, intermediate viewport and mobile; aligned controls and navigation header.');
}finally{await browser.close();}
