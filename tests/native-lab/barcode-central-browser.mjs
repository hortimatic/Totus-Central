import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startLocalServer} from '../local-static-server.mjs';
import {readFile} from 'node:fs/promises';
import {prepareZXingModule,readBarcodes} from 'zxing-wasm/reader';
export async function exerciseCentralBarcodeBrowser({handle,actor,loseCompletion,paths}){
 const wasm=await readFile(new URL(import.meta.resolve('zxing-wasm/reader/zxing_reader.wasm')));
 await prepareZXingModule({overrides:{wasmBinary:wasm.buffer.slice(wasm.byteOffset,wasm.byteOffset+wasm.byteLength)},fireImmediately:true});
 const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[];let latestLabels;
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/__tpv_fixture',async route=>{
   const response=await handle(new Request('https://central.local/tpv',{method:'POST',headers:{Authorization:'Bearer synthetic-auth-fixture','Content-Type':'application/json'},body:route.request().postData()}));
   const body=await response.text();if(JSON.parse(route.request().postData()).action==='barcode-labels'&&response.ok)latestLabels=JSON.parse(body);
   await route.fulfill({status:response.status,contentType:'application/json',body});
  });
  await page.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');
  await page.evaluate(async actor=>{
   const {createTpvWorkspace}=await import('/src/totustpv/workspace.js'),{createCentralTpvAdapter}=await import('/src/totustpv/central-adapter.js');
   document.body.innerHTML='<main class="totus-tpv" id="root"></main>';
   window.barcodeWorkspace=createTpvWorkspace({actor:()=>({id:actor,active:true}),can:()=>true,canStock:()=>true,canReadCost:()=>true,confirm:async()=>true,
    createLiveAdapter:()=>createCentralTpvAdapter({actorId:actor,storage:localStorage,invoke:async body=>{
     const response=await fetch('/__tpv_fixture',{method:'POST',body:JSON.stringify(body)}),value=await response.json();if(!response.ok||value.error)throw Error(value.error||'Fixture request failed');return value;
    }})});window.barcodeWorkspace.mount(document.querySelector('#root'));
  },actor);
  await page.getByRole('button',{name:'Entrar al mostrador'}).click();
  await page.locator('.tpv-actions summary').click();await page.getByRole('button',{name:'Códigos de barras',exact:true}).click();
  await page.getByRole('heading',{name:'Códigos de barras',exact:true}).waitFor();
  await page.locator('.tpv-barcode-settings summary').click();
  await page.locator('[name=barcodeField]').selectOption('upc');await page.locator('[name=barcodeGeneratorEnabled]').check();
  await page.getByRole('button',{name:'Guardar configuración',exact:true}).click();
  await page.getByRole('button',{name:'Preparar lista',exact:true}).click();
  await page.getByRole('heading',{name:'Lista para revisar',exact:true}).waitFor({timeout:120000});
  const before=paths.filter(p=>p.method==='POST'&&p.path==='/api/totus_tpv_barcodes').length;
  assert.equal(await page.getByRole('button',{name:'Generar códigos',exact:true}).isDisabled(),true);
  await page.locator('[data-tpv-barcode-accepted]').check();loseCompletion();
  await page.getByRole('button',{name:'Generar códigos',exact:true}).click();
  await page.getByText('Hay resultados pendientes de comprobar.',{exact:false}).waitFor({timeout:120000});
  await page.getByRole('button',{name:'Cancelar trabajo',exact:true}).click();
  await page.getByRole('heading',{name:'Cancelado',exact:true}).waitFor();
  const sent=paths.filter(p=>p.method==='POST'&&p.path==='/api/totus_tpv_barcodes').length;assert.equal(sent,before+1);
  await page.getByRole('button',{name:'Comprobar operaciones enviadas',exact:true}).click();
  await page.getByRole('button',{name:'Comprobar operaciones enviadas',exact:true}).waitFor({state:'detached',timeout:120000});
  assert.equal(paths.filter(p=>p.method==='POST'&&p.path==='/api/totus_tpv_barcodes').length,sent,'Cancelled recovery must not dispatch another code');
  await page.getByRole('cell',{name:'Código generado',exact:true}).waitFor();
  await page.getByRole('button',{name:'Preparar etiquetas',exact:true}).click();
  const symbol=page.locator('.tpv-label-symbol');await symbol.waitFor();
  const image=await symbol.screenshot(),decoded=await readBarcodes(new Uint8Array(image),{formats:['UPCA','EAN13'],maxNumberOfSymbols:1});
  const currentCode=await page.locator('.tpv-barcode-label code').innerText();assert.equal(decoded.length,1);assert.equal(decoded[0].text.replace(/^0(?=\d{12}$)/,''),currentCode);
  const lookup=await page.evaluate(async code=>{
   const send=async body=>{const response=await fetch('/__tpv_fixture',{method:'POST',body:JSON.stringify(body)});return {status:response.status,data:await response.json()};};
   const context=await send({action:'context'}),station=context.data.workstations[0];
   return send({action:'catalogue',operationId:crypto.randomUUID(),selection:{connectionId:station.connectionId,shopId:station.shopId,drawerId:station.drawerId},search:code,searchFields:['upc']});
  },currentCode);
  assert.equal(lookup.status,200);assert.equal(lookup.data.items.length,1);assert.equal(lookup.data.items[0].product_id,latestLabels.items[0].productId);assert.equal(lookup.data.items[0].attribute_id,latestLabels.items[0].attributeId);
  assert.equal(paths.filter(p=>p.method==='POST'&&p.path==='/api/totus_tpv_barcodes').length,sent,'Label preview cannot assign a code');
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:950});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.screenshot({path:`artifacts/barcode-central-native-${width}.png`,fullPage:true});
  }
  assert.deepEqual(errors,[]);assert.equal(paths.some(p=>p.path==='/api/totus_tpv_sales'),false);
  console.log('PASS native barcode workspace UI → actual adapter/handler/PostgreSQL/native module: UPC selection, full review, explicit approval, interrupted completion, cancel and GET-only recovery, no open cash or sale,1440/390. Auth/delivery fixtures; loopback only.');
 }finally{await browser.close();await server.close();}
}
