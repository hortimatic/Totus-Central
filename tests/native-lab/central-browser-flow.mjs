import {PDFDocument} from 'pdf-lib';
/** Real UI + Edge handler + SQL + installed native module, loopback only.
 * Auth and delivery remain explicit fixtures; never a remote acceptance claim.
 */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {prepareZXingModule,readBarcodes} from 'zxing-wasm/reader';
import {startLocalServer} from '../local-static-server.mjs';
export async function exerciseCentralBrowser({handle,actor,productId,reference,variant,focus='complete',preferences,signaturePolicy=null,nativeWriteCount,cashSessionCount}){
 const wasm=await readFile(new URL(import.meta.resolve('zxing-wasm/reader/zxing_reader.wasm')));
 await prepareZXingModule({overrides:{wasmBinary:wasm.buffer.slice(wasm.byteOffset,wasm.byteOffset+wasm.byteLength)},fireImmediately:true});
 const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true});
 try{for(const width of focus==='customers'?[1440]:[1440,390]){
  const page=await browser.newPage({viewport:{width,height:950}});const errors=[],closeRequests=[];let lostClose=false,lostSignatureSave=false;const signatureCalls=[];let signedArchiveBytes=null;
  page.on('pageerror',error=>errors.push(error.message));
  // The browser must not contact a remote shop even for a public logo/photo.
  // Keep the production origin in the response, but deliver native fixture
  // assets from the guarded local image server.
  await page.route('**/*',async route=>{const url=new URL(route.request().url());
   if(url.origin==='http://127.0.0.1:4173')return route.continue();
   if(url.origin==='https://preproduccion.hortimatic.com'&&url.pathname.startsWith('/img/')){
    const response=await fetch('http://127.0.0.1:8772'+url.pathname,{redirect:'error',signal:AbortSignal.timeout(10000)});
    return route.fulfill({status:response.status,contentType:response.headers.get('content-type')||'application/octet-stream',body:Buffer.from(await response.arrayBuffer())});
   }
   return route.abort('blockedbyclient');
  });
  await page.route('**/__tpv_preferences',async route=>{const {drawer,value}=JSON.parse(route.request().postData());
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(await preferences(drawer,value))});});
  if(signaturePolicy)await page.route('**/__tpv_signature_policy',async route=>{const {drawer,value}=JSON.parse(route.request().postData());await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(await signaturePolicy(drawer,value))});});
  await page.route('**/__tpv_fixture',async route=>{
   const request=route.request(),action=JSON.parse(request.postData()).action,started=Date.now();
   if(action==='document')console.log('Native browser document request started');
   const response=await handle(new Request('https://central.local/tpv',{method:'POST',
    headers:{Authorization:'Bearer synthetic-auth-fixture','Content-Type':'application/json'},body:request.postData()}));
   const body=await response.text();
   if(action.startsWith('signature-'))signatureCalls.push(JSON.parse(request.postData()));
   if(signaturePolicy&&action==='signature-sign'&&response.status===200&&!lostSignatureSave){lostSignatureSave=true;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'TPV_SIGNATURE_STORAGE_UNAVAILABLE'})});}
   if(action==='close'&&focus!=='customers'){
    closeRequests.push(JSON.parse(request.postData()));
    if(response.status===200&&!lostClose){lostClose=true;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'TPV_STORAGE_UNAVAILABLE'})});}
   }
   if(action==='document'){const result=JSON.parse(body);console.log('Native browser document response',response.status,Date.now()-started,result.error||result.kind||result.mime);}
   await route.fulfill({status:response.status,contentType:'application/json',body});
  });
  await page.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');
  const mount=()=>page.evaluate(async({actor,signaturesEnabled})=>{
   const {createTpvWorkspace}=await import('/src/totustpv/workspace.js');
   const {createCentralTpvAdapter}=await import('/src/totustpv/central-adapter.js');
   document.body.innerHTML='<main id="root" class="totus-tpv"></main>';
   window.fixtureWorkspace=createTpvWorkspace({actor:()=>({id:actor,active:true,full_name:'Cajero del laboratorio'}),can:()=>true,canCustomer:()=>true,
    canSignatureSettings:()=>true,signaturePolicyStore:signaturesEnabled?async(drawer,value)=>{const response=await fetch('/__tpv_signature_policy',{method:'POST',body:JSON.stringify({drawer,value})});return response.json();}:null,
    workspacePreferences:async(drawer,value)=>{const response=await fetch('/__tpv_preferences',{method:'POST',body:JSON.stringify({drawer,value})});return response.json();},
    confirm:async()=>true,createLiveAdapter:()=>createCentralTpvAdapter({actorId:actor,storage:localStorage,
     invoke:async body=>{const response=await fetch('/__tpv_fixture',{method:'POST',body:JSON.stringify(body)}),data=await response.json();
      if(!response.ok||data?.error)throw Error(data?.error||'Fixture request failed');return data;}})});
   window.fixtureWorkspace.mount(document.querySelector('#root'));
  },{actor,signaturesEnabled:!!signaturePolicy});
  await mount();
  await page.getByRole('button',{name:'Entrar al mostrador'}).click();
  await page.getByRole('button',{name:'Abrir caja',exact:true}).click();
  if(width===1440){
   await page.getByRole('button',{name:'Elegir cliente',exact:true}).click();
   await page.getByRole('button',{name:'Nuevo cliente',exact:true}).click();
   const form=page.locator('[data-tpv-client-form="save"]');
   await form.locator('[name=firstname]').fill('QA Central');await form.locator('[name=lastname]').fill('Laboratorio');
   await form.locator('[name=email]').fill('central-'+actor+'@example.invalid');
   await page.getByRole('button',{name:'Guardar y verificar cliente',exact:true}).click();
   await page.locator('[data-tpv-client-action="new-address"],.note.bad').first().waitFor({timeout:60000});
   assert.equal(await page.locator('.note.bad').count(),0,await page.locator('#root').innerText());
   await page.getByRole('button',{name:'Nueva dirección',exact:true}).click();
   await form.locator('[name=address1]').fill('Calle del laboratorio 1');await form.locator('[name=postcode]').fill('28001');
   await form.locator('[name=city]').fill('Madrid');await form.locator('[name=phone]').fill('600000000');await form.locator('[name=dni]').fill('12345678Z');
   const states=await form.locator('[name=id_state] option').count();if(states>1)await form.locator('[name=id_state]').selectOption({index:1});
   assert.deepEqual(await form.evaluate(form=>[...form.elements].filter(el=>el.willValidate&&!el.checkValidity()).map(el=>el.name)),[], 'Native customer address fields must be valid before submit');
   await page.getByRole('button',{name:'Guardar y verificar dirección',exact:true}).click();
   await page.locator('[data-tpv-client-address],.note.bad').first().waitFor({timeout:60000});
   assert.equal(await page.locator('.note.bad').count(),0,await page.locator('#root').innerText());
   await page.getByRole('button',{name:'Editar cliente',exact:true}).click();
   await form.locator('[name=lastname]').fill('Laboratorio revisado');
   await page.getByRole('button',{name:'Guardar y verificar cliente',exact:true}).click();
   await page.locator('[data-tpv-client-edit-address],.note.bad').first().waitFor({timeout:60000});
   assert.equal(await page.locator('.note.bad').count(),0,await page.locator('#root').innerText());
   await page.getByRole('button',{name:'Corregir dirección',exact:true}).click();
   await form.locator('[name=alias]').fill('Dirección corregida');await form.locator('[name=address1]').fill('Calle del laboratorio 2');
   await page.getByRole('button',{name:'Guardar y verificar dirección',exact:true}).click();
   await page.locator('[data-tpv-client-address]').filter({hasText:'Dirección corregida'}).waitFor({timeout:60000});
   assert.equal(await page.locator('[data-tpv-client-address]').count(),2,'Address correction must preserve the original address');
   await page.locator('[data-tpv-client-address]').filter({hasText:'Dirección corregida'}).click();
   await page.locator('.tpv-customer-panel').waitFor({state:'detached'});assert.match(await page.locator('.tpv-ticket header').innerText(),/QA Central Laboratorio revisado/);
  }
  if(focus==='customers'){
   await page.getByRole('button',{name:'Caja',exact:true}).click();await page.getByRole('button',{name:'Cerrar caja',exact:true}).click();
   await page.getByText('Caja cerrada. Diferencia:',{exact:false}).waitFor();assert.deepEqual(errors,[]);await page.close();continue;
  }
  await page.locator('[data-tpv-search]').fill(reference);
  const product=page.locator(`[data-tpv-add="${productId}:0"]`);await product.waitFor();
  if(width===390)await page.locator('[data-tpv-search]').press('Enter');else await product.click();
  if(width===390)await page.getByRole('button',{name:'Ver ticket',exact:true}).click();
  await page.locator('[data-tpv-line-kind]').waitFor();
  if(width===390){await page.locator('[data-tpv-line-kind]').selectOption('amount');await page.locator('[data-tpv-line-value]').fill('0,50');
   await page.getByText('Opciones del ticket',{exact:true}).click();
   await page.locator('[name=discountKind]').selectOption('amount');await page.locator('[name=discountValue]').fill('0,50');
   await page.locator('[name=draftLabel]').fill('Ticket recuperado del navegador');
   await page.getByRole('button',{name:'Aparcar ticket',exact:true}).click();
   await page.locator('[data-tpv-draft-id]').waitFor();
   await page.reload();await mount();await page.getByRole('button',{name:'Entrar al mostrador'}).click();
   await page.getByText('Más acciones',{exact:true}).click();
   await page.getByRole('button',{name:'Tickets aparcados',exact:true}).click();
   await page.getByRole('button',{name:'Recuperar ticket',exact:true}).click();
   await page.getByRole('button',{name:'Ver ticket',exact:true}).click();
   await page.locator('[data-tpv-line-kind]').waitFor();
   assert.equal(await page.locator('[data-tpv-line-value]').inputValue(),'0,50');
   assert.equal(await page.locator('[name=discountValue]').inputValue(),'0,50');
  }
  await page.getByRole('button',{name:'Calcular y cobrar',exact:true}).click();
  await page.locator('[data-tpv-form="pay"],.note.bad').first().waitFor({timeout:60000});
  assert.equal(await page.locator('[data-tpv-form="pay"]').count(),1,'Prepare failed at '+width+': '+await page.locator('#root').innerText());
  await page.getByText('Más acciones',{exact:true}).click();const publicWindow=page.waitForEvent('popup');
  await page.getByRole('button',{name:'Pantalla para cliente',exact:true}).click();const customerDisplay=await publicWindow;
  await customerDisplay.getByRole('heading',{name:'Todo listo para pagar',exact:true}).waitFor();
  assert.match(await customerDisplay.locator('[data-display-amount]').innerText(),width===390?/7,01/:/8,01/);
  if(width===390)assert.match(await customerDisplay.locator('[data-display-discount]').innerText(),/Descuento del ticket: −0,50/);
  if(width===1440)assert.match(await customerDisplay.locator('[data-display-customer]').innerText(),/QA Central Laboratorio/);
  else assert.equal(await customerDisplay.locator('[data-display-customer]').innerText(),'');
  assert.doesNotMatch(await customerDisplay.locator('body').innerText(),/600000000|@ejemplo/);
  await customerDisplay.screenshot({path:`artifacts/native-lab/tpv-pantalla-cliente-${width}.png`,fullPage:true});
  await page.getByText('Más acciones',{exact:true}).click();
  await page.getByRole('button',{name:'Entregado 10 euros',exact:true}).click();
  assert.match(await page.locator('[data-tpv-tender-preview]').innerText(),width===390?/2,99/:/1,99/);
  await page.locator('[name=method]').selectOption(width===1440?'bizum':'mixed');
  if(width===390){await page.locator('[name=externalMethod]').selectOption('transfer');await page.locator('[name=cashPart]').fill('3,00');}
  await page.locator('[name=cardAccepted]').check();
  assert.match(await page.locator('[data-tpv-tender-preview]').innerText(),width===390?/transferencia/:/bizum/);
  await page.getByRole('button',{name:'Confirmar cobro y crear pedido'}).scrollIntoViewIfNeeded();
  assert.match(await page.locator('[data-tpv-confirm-total]').innerText(),width===390?/7,01/:/8,01/);
  if(width===390){assert.match(await page.locator('[data-tpv-tender-preview]').innerText(),/Parte en efectivo.*3,00/s);assert.match(await page.locator('[data-tpv-tender-preview]').innerText(),/Descuento del ticket incluido.*0,50/s);}
  assert.equal(await page.locator('[data-tpv-confirm-total]').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),true,'The verified total remains visible beside final confirmation');
  await page.screenshot({path:`artifacts/native-lab/tpv-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:'Confirmar cobro y crear pedido'}).click();
  await page.getByRole('heading',{name:'Pedido verificado en PrestaShop',exact:true}).waitFor({timeout:60000});
  await customerDisplay.getByRole('heading',{name:'Gracias por tu compra',exact:true}).waitFor();
  assert.equal(await customerDisplay.locator('[data-display-customer]').innerText(),'','The customer name disappears when the sale is confirmed');
  assert.match(await page.locator('.tpv-receipt').innerText(),/Pedido #[0-9]+/);
  const orderId=(await page.locator('.tpv-receipt').innerText()).match(/Pedido #([0-9]+)/)[1];
  assert.match(await page.locator('.tpv-receipt').innerText(),width===390?/7,00/:/0,00/);
  if(signaturePolicy){
   const beforeSignature=nativeWriteCount();await page.locator('.tpv-receipt summary').click();await page.getByRole('button',{name:'Firmar factura',exact:true}).click();
   await page.locator('[data-signature-pdf][data-pdf-rendered]').waitFor({timeout:60000});await page.locator('[data-signature-reviewed]').check();await page.getByRole('button',{name:'Recoger firma',exact:true}).click();
   const rect=await page.locator('.tpv-signature-dialog canvas').boundingBox();await page.mouse.move(rect.x+rect.width*.2,rect.y+rect.height*.35);await page.mouse.down();await page.mouse.move(rect.x+rect.width*.55,rect.y+rect.height*.7,{steps:10});await page.mouse.move(rect.x+rect.width*.8,rect.y+rect.height*.2,{steps:10});await page.mouse.up();await page.getByRole('button',{name:'Aceptar firma',exact:true}).click();
   await page.getByRole('button',{name:'Guardar factura firmada',exact:true}).click();await page.getByRole('button',{name:'Recuperar resultado de firma',exact:true}).waitFor({timeout:60000});
   await page.getByRole('button',{name:'Recuperar resultado de firma',exact:true}).click();await page.getByText('Factura firmada conservada en Central.',{exact:true}).waitFor({timeout:60000});
   assert.equal(signatureCalls.filter(r=>r.action==='signature-sign').length,1);assert.equal(nativeWriteCount(),beforeSignature,'Signing and recovering an issued PDF creates no native order, payment or stock write');
   const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Descargar factura firmada',exact:true}).click()]);assert.equal(download.suggestedFilename(),'totus-invoice-'+orderId+'-firmada.pdf');
   const signedPdf=await PDFDocument.load(await readFile(await download.path()));assert.ok(signedPdf.getPageCount()>=2);
   await page.locator("[data-signature-pdf][data-pdf-rendered]").waitFor({timeout:60000});await page.locator(".tpv-signature-panel").screenshot({path:`artifacts/native-lab/tpv-factura-firmada-${width}.png`});
   await page.getByRole('button',{name:'Volver a documentos',exact:true}).click();await page.getByRole('button',{name:'Venta',exact:true}).click();
  }

  await page.locator('.tpv-receipt summary').click();
  await page.getByRole('button',{name:'Ticket',exact:true}).click();
  await page.getByRole('heading',{name:'Justificante de compra',exact:true}).waitFor();
  assert.match(await page.locator('.tpv-document').innerText(),width===390?/7,01/:/8,01/);
  assert.match(await page.locator('.tpv-document tbody').innerText(),/Precio unitario: [0-9]+,[0-9]+/);
  assert.match(await page.locator('.tpv-document tbody').innerText(),/Impuesto de línea: [0-9]+,[0-9]{2}/);
  assert.match(await page.locator('.tpv-document').innerText(),/Te atendió: Operador original de la venta/);
  assert.doesNotMatch(await page.locator('.tpv-document').innerText(),/Te atendió: Cajero del laboratorio/);
  assert.match(await page.locator('.tpv-document').innerText(),/https:\/\/preproduccion\.hortimatic\.com/);
  await page.waitForFunction(()=>{const logo=document.querySelector('.tpv-receipt-logo');return logo?.complete&&logo.naturalWidth>0;});
  await page.waitForFunction(()=>{const barcode=document.querySelector('.tpv-reference-barcode');return barcode?.complete&&barcode.naturalWidth>0;});
  const barcodeImage=await page.locator('.tpv-reference-barcode').getAttribute('src');
  const decoded=await readBarcodes(new Uint8Array(Buffer.from(barcodeImage.split(',')[1],'base64')),{formats:['Code128'],maxNumberOfSymbols:1});
  assert.equal(decoded.length,1);const orderCode=decoded[0].text;
  assert.equal(orderCode,'R:'+await page.locator('.tpv-order-barcode small').innerText());
  if(width===1440){assert.match(await page.locator('.tpv-receipt-customer').innerText(),/QA Central Laboratorio/);
   assert.match(await page.locator('.tpv-receipt-customer').innerText(),/600000000/);}
  else assert.equal(await page.locator('.tpv-receipt-customer').count(),0,'Anonymous counter identity stays omitted even when the saved customer option is enabled');
  await page.getByRole('button',{name:'Cerrar documento',exact:true}).click();
  await page.locator('.tpv-receipt summary').click();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Factura PDF',exact:true}).click();
  const pdf=await download;assert.match(pdf.suggestedFilename(),/^totus-invoice-[0-9]+\.pdf$/);
  await page.getByRole('button',{name:'Pedidos y devoluciones',exact:true}).click();
  await page.getByRole('button',{name:'Devolver',exact:true}).click();
  await page.locator('[data-tpv-form="refund"] input[type=number]').fill('1');
  await page.locator('[data-tpv-form="refund"] [name=reason]').fill('Artículo del laboratorio devuelto');
  await page.getByRole('button',{name:'Calcular devolución',exact:true}).click();
  await page.getByRole('heading',{name:/Confirmar devolución/}).waitFor();
  assert.match(await page.locator('.tpv-payment').innerText(),width===390?/Efectivo: 3,00/:/Bizum: 8,01/);
  await page.getByRole('button',{name:'Confirmo el reintegro al cliente',exact:true}).click();
  await page.getByText('Devolución verificada:',{exact:false}).waitFor({timeout:60000});
  const creditDownload=page.waitForEvent('download');await page.getByRole('button',{name:/Abono PDF/}).click();
  assert.equal((await creditDownload).suggestedFilename(),'totus-credit-note-'+orderId+'.pdf');
  if(width===1440&&variant){
   await page.getByRole('button',{name:'Venta',exact:true}).click();await page.getByRole('button',{name:'Nuevo ticket',exact:true}).click();
   const target=variant.variants[1];await page.locator('[data-tpv-search]').fill(variant.reference);
   // The native parent carries its default attribute for price preview;
   // choose_variant still requires opening the selection dialog.
   await page.locator(`[data-tpv-add^="${variant.productId}:"]`).click();
   const variantDialog=page.locator('.tpv-variant-dialog');
   await variantDialog.locator(`[data-tpv-add="${variant.productId}:${target.attributeId}"]`).waitFor();
   assert.equal(await variantDialog.evaluate(el=>el.matches(':modal')),true);
   await variantDialog.screenshot({path:'artifacts/native-lab/tpv-native-variant-selector.png'});
   await variantDialog.locator(`[data-tpv-add="${variant.productId}:${target.attributeId}"]`).click();
   await variantDialog.waitFor({state:'hidden'});
   await page.locator(`[data-tpv-quantity="${variant.productId}:${target.attributeId}"]`).waitFor();
   await page.getByRole('button',{name:'Calcular y cobrar',exact:true}).click();await page.locator('[data-tpv-form="pay"]').waitFor({timeout:60000});
   assert.match(await page.locator('.tpv-payment-amount').innerText(),/9,22/);
   await page.getByRole('button',{name:'Entregado 10 euros',exact:true}).click();
   await page.getByRole('button',{name:'Confirmar cobro y crear pedido'}).click();await page.getByRole('heading',{name:'Pedido verificado en PrestaShop',exact:true}).waitFor({timeout:60000});
   const variantOrder=(await page.locator('.tpv-receipt').innerText()).match(/Pedido #([0-9]+)/)[1];
   await page.getByRole('button',{name:'Pedidos y devoluciones',exact:true}).click();
   await page.locator('.tpv-history article').filter({hasText:'Pedido #'+variantOrder}).getByRole('button',{name:'Devolver',exact:true}).click();
   await page.locator('[data-tpv-form="refund"] input[type=number]').fill('1');
   await page.locator('[data-tpv-form="refund"] [name=refundMethod]').selectOption('cash');
   await page.locator('[data-tpv-form="refund"] [name=reason]').fill('Combinación B devuelta');
   await page.getByRole('button',{name:'Calcular devolución',exact:true}).click();await page.getByRole('heading',{name:/Confirmar devolución/}).waitFor();
   await page.getByRole('button',{name:'Confirmo el reintegro al cliente',exact:true}).click();await page.getByText('Devolución verificada:',{exact:false}).waitFor({timeout:60000});
  }
  await page.getByRole('button',{name:'Caja',exact:true}).click();
  assert.match(await page.locator('.tpv-session').innerText(),/100,00/);
  await page.locator('[data-tpv-form="movement"] [name=kind]').selectOption('cash-out');
  await page.locator('[name=amount]').fill('1,00');
  await page.locator('[data-tpv-form="movement"] [name=reason]').fill('Retirada ficticia del navegador');
  await page.getByRole('button',{name:'Registrar movimiento',exact:true}).click();
  await page.getByText('Movimiento de caja registrado.',{exact:true}).waitFor();
  await page.locator('[name=counted]').fill('99,00');
  await page.getByRole('button',{name:'Cerrar caja',exact:true}).click();
  await page.locator('.note.bad').waitFor();
  await page.getByRole('button',{name:'Cerrar caja',exact:true}).click();
  await page.getByText('Caja cerrada. Diferencia:',{exact:false}).waitFor();
  assert.equal(customerDisplay.isClosed(),true,'The public-facing window closes with the cash context');
  assert.equal(closeRequests.length,2);assert.deepEqual(closeRequests[0],closeRequests[1],'A committed close with a lost reply must recover the same request after context no longer reports an open cash session');
  await page.getByText('Más acciones',{exact:true}).click();
  await page.getByRole('button',{name:'Informes de caja',exact:true}).click();
  await page.getByRole('heading',{name:'Cierre de caja',exact:true}).waitFor();
  assert.match(await page.locator('.tpv-cash-report').innerText(),/99,00/);
  assert.match(await page.locator('.tpv-cash-report').innerText(),/Retirada ficticia del navegador/);
  assert.equal(await page.getByRole('button',{name:'Abrir caja',exact:true}).count(),0,'Reports must not require or offer a new cash opening');
  await page.getByRole('button',{name:'Cerrar informes',exact:true}).click();
  const sessionsBeforeHistory=await cashSessionCount(),writesBeforeHistory=nativeWriteCount();
  await page.getByRole('button',{name:'Pedidos y devoluciones',exact:true}).click();
  await page.locator('[data-tpv-order-search] [name=orderId]').fill(orderId);
  await page.getByRole('button',{name:'Buscar pedido',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-tpv-order-search] button[type=submit]')?.disabled===false);
  await page.locator('.tpv-history').getByText('Pedido #'+orderId,{exact:true}).waitFor();
  await page.locator('.tpv-history summary').click();
  try{const [historicalDownload]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Factura PDF',exact:true}).click()]);
   assert.equal(historicalDownload.suggestedFilename(),'totus-invoice-'+orderId+'.pdf');
  }catch(error){throw new Error('Historical invoice download failed: '+await page.locator('.note.bad').allTextContents(),{cause:error});}
  if(signaturePolicy){
   await page.locator('.tpv-history summary').click();await page.getByRole('button',{name:'Factura firmada',exact:true}).click();await page.getByText('Factura firmada conservada en Central.',{exact:true}).waitFor();
   assert.equal(await page.getByRole('button',{name:'Recoger firma',exact:true}).count(),0,'Closed-cash history offers only the conserved signature');
   const [archive]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Descargar factura firmada',exact:true}).click()]);assert.equal(archive.suggestedFilename(),'totus-invoice-'+orderId+'-firmada.pdf');signedArchiveBytes=await readFile(await archive.path());
   await page.getByRole('button',{name:'Volver a documentos',exact:true}).click();
  }
  const writesBeforeLookup=nativeWriteCount();
  await page.locator('[data-tpv-order-search] [name=orderId]').fill(orderCode);
  await page.locator('[data-tpv-order-search] [name=orderId]').press('Enter');
  await page.waitForFunction(()=>document.querySelector('[data-tpv-order-search] button[type=submit]')?.disabled===false);
  await page.getByRole('status').getByText('Historial: referencia '+orderCode.slice(2).toUpperCase()+'.',{exact:true}).waitFor();
  assert.equal(await page.locator('[data-tpv-order-search] [name=orderId]').inputValue(),orderCode);
  assert.equal(await page.locator('[data-tpv-order-search] [name=orderId]').evaluate(field=>document.activeElement===field&&field.selectionStart===0&&field.selectionEnd===field.value.length),true,'The reference remains selected for the next keyboard scan');
  assert.equal(await page.locator('.tpv-history article').count(),1);
  await page.locator('.tpv-history').getByText('Pedido #'+orderId,{exact:true}).waitFor();
  assert.equal(nativeWriteCount(),writesBeforeLookup,'Scanning a receipt only finds the original sale; it cannot write another native order or stock movement');
  assert.equal(await cashSessionCount(),sessionsBeforeHistory,'Historical documents and code lookup must not open another cash session');
  assert.equal(nativeWriteCount(),writesBeforeHistory,'Historical documents only read existing native records');
  await page.getByRole('button',{name:'Caja',exact:true}).click();await page.getByRole('button',{name:'Abrir caja',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  if(signaturePolicy){
   const prepared=signatureCalls.find(row=>row.action==='signature-prepare'),selection={connectionId:prepared.selection.connectionId,shopId:prepared.selection.shopId};
   const billingPage=await browser.newPage({viewport:{width,height:950}});billingPage.on('pageerror',error=>errors.push(error.message));
   await billingPage.route('**/__billing_native',async route=>{const response=await handle(new Request('https://central.local/tpv',{method:'POST',headers:{Authorization:'Bearer synthetic-auth-fixture','Content-Type':'application/json'},body:route.request().postData()}));await route.fulfill({status:response.status,contentType:'application/json',body:await response.text()});});
   await billingPage.goto('http://127.0.0.1:4173/tests/totustpv-billing.html');
   await billingPage.evaluate(async({actor,selection,saleId})=>{const {createTpvBillingUI}=await import('/src/totustpv/billing-ui.js');window.nativeBilling=createTpvBillingUI({actor:()=>actor,client:()=>async input=>{const response=await fetch('/__billing_native',{method:'POST',body:JSON.stringify(input)}),body=await response.json();if(!response.ok)throw Error(body.error);return body;}});await nativeBilling.mount(document.querySelector('#billing'),{...selection,saleId});},{actor,selection,saleId:prepared.saleId});
   const [billingArchive]=await Promise.all([billingPage.waitForEvent('download'),billingPage.getByRole('button',{name:'Factura firmada',exact:true}).click()]);
   assert.equal(billingArchive.suggestedFilename(),'totus-invoice-'+orderId+'-firmada.pdf');assert.deepEqual(await readFile(await billingArchive.path()),signedArchiveBytes,'Facturación downloads the same conserved signed PDF after cash closure');
   await billingPage.getByText('Factura firmada preparada para descargar.',{exact:true}).waitFor();assert.equal(await billingPage.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   await billingPage.screenshot({path:`artifacts/native-lab/tpv-firma-facturacion-${width}.png`,fullPage:true});await billingPage.close();assert.equal(nativeWriteCount(),writesBeforeHistory);assert.equal(await cashSessionCount(),sessionsBeforeHistory);
  }
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log(focus==='customers'?'PASS customer UI → shared directory writer and SQL journal → native customer/address → selected for checkout. Local only.':
  'PASS desktop/mobile UI → Central handler → SQL → native order/refund/stock → cash movement → zero-difference close. Local fixtures only.');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
