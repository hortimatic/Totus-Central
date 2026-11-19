import assert from 'node:assert/strict';import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';import {startLocalServer} from '../local-static-server.mjs';
export async function exerciseReceiptVariantsBrowser({handle,actor,preferences,original,gift}){
 const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.origin==='http://127.0.0.1:4173')return route.continue();return route.abort('blockedbyclient');});
  await page.route('**/__variant_preferences',async route=>{const {drawer,value}=JSON.parse(route.request().postData());return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(await preferences(drawer,value))});});
  await page.route('**/__variant_fixture',async route=>{const response=await handle(new Request('https://central.local/tpv',{method:'POST',headers:{Authorization:'Bearer synthetic-auth-fixture','Content-Type':'application/json'},body:route.request().postData()}));return route.fulfill({status:response.status,contentType:'application/json',body:await response.text()});});
  await page.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');
  const mount=()=>page.evaluate(async actor=>{
   window.variantWorkspace?.dispose();window.fixture?.workspace?.dispose();
   const {createTpvWorkspace}=await import('/src/totustpv/workspace.js'),{createCentralTpvAdapter}=await import('/src/totustpv/central-adapter.js');
   window.variantWorkspace=createTpvWorkspace({actor:()=>({id:actor,active:true,full_name:'Operador de pruebas'}),can:()=>true,confirm:async()=>true,autoOpen:true,
    workspacePreferences:async(drawer,value)=>{const response=await fetch('/__variant_preferences',{method:'POST',body:JSON.stringify({drawer,value})});return response.json();},
    createLiveAdapter:()=>createCentralTpvAdapter({actorId:actor,storage:localStorage,invoke:async payload=>{const response=await fetch('/__variant_fixture',{method:'POST',body:JSON.stringify(payload)}),result=await response.json();if(!response.ok||result.error)throw Error(result.error||'Fixture failed');return result;}})});variantWorkspace.mount(document.querySelector('#tpv'));
  },actor);
  const settings=async()=>{await page.getByText('Más acciones',{exact:true}).click();await page.getByRole('button',{name:'Configuración',exact:true}).click();await page.getByLabel('Atributos y variante de cada artículo',{exact:true}).waitFor();};
  await mount();await settings();
  const checkbox=page.getByLabel('Atributos y variante de cada artículo',{exact:true}),preview=page.locator('[data-tpv-receipt-preview]');
  assert.equal(await checkbox.isChecked(),false);assert.doesNotMatch(await preview.innerText(),/Color: Azul/);
  await checkbox.check();assert.match(await preview.innerText(),/Color: Azul/);
  await page.getByRole('button',{name:'Guardar mostrador',exact:true}).click();await page.getByText('Mostrador guardado en tu cuenta.',{exact:true}).waitFor();
  await mount();await settings();assert.equal(await checkbox.isChecked(),true);assert.match(await preview.innerText(),/Color: Azul/);
  await mkdir('artifacts/totustpv-receipt-variants',{recursive:true});
  for(const width of [1440,390]){await page.setViewportSize({width,height:950});await preview.scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);await preview.screenshot({path:`artifacts/totustpv-receipt-variants/preview-${width}.png`});}
  await checkbox.uncheck();assert.doesNotMatch(await preview.innerText(),/Color: Azul/);
  await page.getByRole('button',{name:'Guardar mostrador',exact:true}).click();await page.getByText('Mostrador guardado en tu cuenta.',{exact:true}).waitFor();
  await mount();await settings();assert.equal(await checkbox.isChecked(),false);
  for(const [name,document,showAttributes] of [['visible',original,true],['hidden',original,false],['gift',gift,true]]){
   const printed=await page.evaluate(async({document:receipt,showAttributes})=>{
    const {receiptHtml,prepareTpvPrintHtml}=await import('/src/totustpv/documents.js');
    return prepareTpvPrintHtml(receiptHtml(receipt,{showAttributes,showLogo:false,showBarcode:false}),'Ticket con variante');
   },{document,showAttributes});
   const paper=await browser.newPage({viewport:{width:220,height:850}});await paper.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');await paper.setContent(printed);await paper.emulateMedia({media:'print'});
   const dimensions=await paper.evaluate(async()=>{const {fitTpvPrintPage}=await import('/src/totustpv/documents.js');return fitTpvPrintPage(document);});
   assert.equal(dimensions.paperMm,58);assert.ok(dimensions.heightMm<220);
   assert.equal(await paper.evaluate(()=>document.body.scrollWidth>document.body.clientWidth+1),false,'Variant text must fit the 48mm content width');
   const text=await paper.locator('body').innerText();assert.ok(text.includes(original.lines[0].base_name));assert.equal(text.includes(original.lines[0].variant_name),showAttributes);
   if(name==='gift')assert.doesNotMatch(text,/€/);
   await paper.pdf({path:`artifacts/totustpv-receipt-variants/${name}-58mm.pdf`,preferCSSPageSize:true,printBackground:true});
   await paper.screenshot({path:`artifacts/totustpv-receipt-variants/${name}-58mm.png`,clip:{x:0,y:0,width:220,height:await paper.locator('body').evaluate(el=>Math.ceil(el.getBoundingClientRect().height))}});await paper.close();
  }
  assert.deepEqual(errors,[]);console.log('PASS receipt variants browser: real workspace preference/preview and reload, desktop/mobile, historical native receipt and gift rendered to 58mm PDF with attributes on/off. Physical printer unverified.');
 }finally{await page.close();await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
}
