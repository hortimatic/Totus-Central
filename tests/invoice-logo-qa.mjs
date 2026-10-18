import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';

// Full UI test against the isolated in-browser Supabase mock.
// These files never reach the real company's storage.
const pngA=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFElEQVR4nGPkcOthgAEmBiSAmwMAKxQA4q7yKTMAAAAASUVORK5CYII=','base64');
const pngB=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFElEQVR4nGPcouHGAANMDEgANwcAOhYBKlK6+/kAAAAASUVORK5CYII=','base64');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:960},locale:'es-ES'});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.setDefaultTimeout(7000);
const snapshot=()=>page.evaluate(()=>({
  templates:structuredClone(window.__mockDb.ops_document_templates),
  assets:[...window.__mockUploads.keys()].filter(x=>x.startsWith('business-assets/'))
}));
const exitModal=async()=>await page.locator('#modalHost .close-btn').click();
try {
  await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
  await page.locator('#userCard').waitFor({state:'visible'});
  await page.locator('#nav [data-route="facturacion"]').click();
  await page.locator('[data-action="billing-section"][data-section="plantillas"]').first().click();
  await page.locator('[data-action="template-new"]').click();

  await page.locator('#tpName').fill('Plantilla prueba logo');
  await page.locator('#tpCode').fill('LOGOQA');
  assert.deepEqual(await page.locator('#tpStyle option').evaluateAll(els=>els.map(el=>el.value)),['brand','clean','compact'],'Los estilos deben coincidir con el CHECK real de Supabase');
  assert.deepEqual(await page.locator('#tpFont option').evaluateAll(els=>els.map(el=>el.value)),['helvetica','courier','times'],'Las fuentes deben coincidir con el CHECK real de Supabase');
  await page.locator('#tpLogo').setInputFiles({name:'no-es-imagen.pdf',mimeType:'application/pdf',buffer:Buffer.from('fake')});
  await page.locator('#modalHost [data-action="template-save"]').click();
  await page.waitForTimeout(150);
  let data=await snapshot();
  assert(!data.templates.some(x=>x.code==='LOGOQA'),'Se aceptó un fichero de logo con MIME no permitido');
  assert.equal(data.assets.length,0,'Un logo inválido generó archivos en Storage');

  await page.locator('#tpLogo').setInputFiles({name:'logo-muy-grande.png',mimeType:'image/png',buffer:Buffer.alloc(5*1024*1024+1,1)});
  await page.locator('#modalHost [data-action="template-save"]').click();
  await page.waitForTimeout(150);
  data=await snapshot();
  assert(!data.templates.some(x=>x.code==='LOGOQA'),'Se aceptó un logo superior a 5MB');
  assert.equal(data.assets.length,0,'Un logo excesivo generó archivos en Storage');

  await page.locator('#tpLogo').setInputFiles({name:'logo-qa-original.png',mimeType:'image/png',buffer:pngA});
  await page.locator('#modalHost [data-action="template-save"]').click();
  await page.waitForFunction(()=>window.__mockDb.ops_document_templates.some(x=>x.code==='LOGOQA'));
  data=await snapshot();
  let tpl=data.templates.find(x=>x.code==='LOGOQA');
  assert.equal(tpl.style,'brand','La plantilla debe persistir el estilo canónico');
  assert(tpl?.logo_path?.startsWith('logos/'),'Plantilla creada sin ruta de logo');
  assert.equal(tpl.logo_name,'logo-qa-original.png');
  assert(data.assets.includes('business-assets/'+tpl.logo_path),'El archivo no se subió a Storage simulado');
  const oldPath=tpl.logo_path;
  await page.locator('[data-action="template-preview"][data-id="'+tpl.id+'"]').click();
  await page.locator('#modalHost img.invoice-logo').waitFor({state:'visible'});
  await page.waitForFunction(()=>{const img=document.querySelector('#modalHost img.invoice-logo');return img&&img.complete&&img.naturalWidth===4});
  fs.mkdirSync('artifacts',{recursive:true});
  await page.locator('#modalHost .modal').screenshot({path:'artifacts/invoice_logo_preview_desktop.png'});
  await exitModal();

  await page.locator('[data-action="template-edit"][data-id="'+tpl.id+'"]').click();
  await page.locator('#tpLogo').setInputFiles({name:'logo-qa-nuevo.png',mimeType:'image/png',buffer:pngB});
  await page.locator('#modalHost [data-action="template-save"]').click();
  await page.waitForFunction(id=>window.__mockDb.ops_document_templates.find(x=>x.id===id)?.logo_name==='logo-qa-nuevo.png',tpl.id);
  data=await snapshot();
  tpl=data.templates.find(x=>x.id===tpl.id);
  assert.notEqual(tpl.logo_path,oldPath,'La sustitución no ha generado una nueva ruta');
  assert(data.assets.includes('business-assets/'+tpl.logo_path),'Falta el logo nuevo');
  assert(!data.assets.includes('business-assets/'+oldPath),'El logo anterior quedó huérfano sin referencias');

  await page.locator('[data-action="template-preview"][data-id="'+tpl.id+'"]').click();
  await page.waitForFunction(()=>{const img=document.querySelector('#modalHost img.invoice-logo');return img&&img.complete&&img.naturalWidth===4});
  await exitModal();

  await page.setViewportSize({width:390,height:844});
  await page.locator('[data-action="template-preview"][data-id="'+tpl.id+'"]').click();
  await page.locator('#modalHost img.invoice-logo').waitFor({state:'visible'});
  const geometry=await page.locator('#modalHost .modal').evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right}});
  assert(geometry.left>=-2&&geometry.right<=392,'La vista previa del logo se desborda en móvil');
  await page.locator('#modalHost .modal').screenshot({path:'artifacts/invoice_logo_preview_mobile.png'});
  await exitModal();

  // Comprobar también el logo dentro de una factura de prueba, su popup de
  // impresión y el PDF real generado por Chromium. La base de producción no se usa.
  await page.locator('[data-action="billing-section"][data-section="documentos"]').first().click();
  await page.locator('[data-action="invoice-new"]').first().click();
  await page.locator('#ivCustomer').fill('Cliente ficticio · Logo QA');
  await page.locator('#ivDesc_0').fill('Servicio de simulación con identidad corporativa');
  await page.locator('#ivQty_0').fill('1');
  await page.locator('#ivUnit_0').fill('20,00');
  await page.locator('details.invoice-presentation > summary').click();
  await page.locator('#ivTemplate').selectOption(tpl.id);
  await page.locator('[data-action="invoice-save"]').first().click();
  await page.waitForFunction(()=>window.__mockDb.ops_sales_invoices.some(x=>x.customer_name?.includes('Logo QA')));
  await page.locator('[data-action="invoice-back"]').first().click();
  await page.locator('[data-action="invoice-preview"]').first().click();
  await page.locator('#modalHost img.invoice-logo').waitFor({state:'visible'});
  await page.waitForFunction(()=>{const i=document.querySelector('#modalHost img.invoice-logo');return i?.complete&&i.naturalWidth===4});
  const popupWait=page.waitForEvent('popup');
  await page.locator('#modalHost [data-action="invoice-print"]').first().click();
  const popup=await popupWait;
  await popup.locator('img.invoice-logo').waitFor({state:'visible'});
  await popup.waitForFunction(()=>{const i=document.querySelector('img.invoice-logo');return i?.complete&&i.naturalWidth===4});
  assert((await popup.locator('body').innerText()).includes('Cliente ficticio'),'La factura para imprimir ha perdido su cliente');
  const printed=await popup.pdf({format:'A4',printBackground:true});
  assert(printed.subarray(0,5).toString()==='%PDF-','No se genera un PDF de factura imprimible');
  assert(printed.length>4000,'El PDF de factura parece vacío');
  fs.writeFileSync('artifacts/invoice_logo_print_qa.pdf',printed);
  await popup.close();
  await exitModal();

  assert.deepEqual(errors,[],'Errores JavaScript en subida/vista previa/sustitución');
  console.log('INVOICE LOGO QA: validaciones, subida, sustitución, vista previa, factura impresa con logo, PDF y móvil: OK');
}finally{
  await browser.close();
}
