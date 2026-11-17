import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');
 await page.evaluate(async()=>{
  fixture.workspace.dispose();const {createTpvWorkspace}=await import('../src/totustpv/workspace.js');
  window.productFixture={saved:[],steps:0,loseReply:true,canCreate:true};
  const lists={categories:[{id:'2',name:'Accesorios',active:'1'},{id:'3',name:'Bebidas',active:'1'},{id:'4',name:'Ropa',active:'1'}],
   manufacturers:[{id:'1',name:'Marca',active:'1'}],suppliers:[{id:'1',name:'Proveedor',active:'1'}],tax_rule_groups:[{id:'1',name:'IVA general',active:'1',deleted:'0'}],
   product_options:[{id:'1',name:'Color',public_name:'Color'}],product_option_values:[{id:'1',id_attribute_group:'1',name:'Azul'},{id:'2',id_attribute_group:'1',name:'Rojo'}],
   countries:[{id:'1',iso_code:'ES',active:'1'}],tax_rules:[{id:'1',id_country:'1',id_tax_rules_group:'1',id_tax:'1',id_state:'0',zipcode_from:'0',zipcode_to:'0'}],taxes:[{id:'1',active:'1',rate:'21'}]};
  const adapter={mode:'qa',context:async()=>({stores:[{id:'shop',name:'Tienda de pruebas'}],drawers:[{id:'drawer',storeId:'shop',name:'Mostrador',canSell:true,canOpen:true,canReconcile:true}],sessions:[{id:'session',storeId:'shop',drawerId:'drawer',status:'open'}]}),
   selectSession:async()=>{},categories:async()=>[],searchProducts:async()=>[{id:'1:0',nativeProductId:1,name:'Artículo del ticket',stock:10,priceCents:300}],
   productProfile:async()=>({ok:true,language_ids:['1']}),productMetadata:async resource=>({rows:lists[resource],possibly_more:false}),
   quote:async()=>({id:'quote',totalCents:300,paymentMethods:['cash','card']}),discardQuote:async()=>{},
   productIntakes:async()=>structuredClone(productFixture.saved),
   prepareProductIntake:async draft=>{
    if(!productFixture.saved.length)productFixture.saved.push({id:'request',name:draft.name,reference:draft.reference,status:'ready',currentStep:0,
     steps:[{key:'base',kind:'base',label:'Ficha del producto',status:'pending'},{key:'stock',kind:'stock',label:'Unidades del producto',status:'pending'},{key:'finish',kind:'finish',label:'Disponibilidad del producto',status:'pending'}]});
    productFixture.draft=draft;
    if(productFixture.loseReply){productFixture.loseReply=false;throw Error('Respuesta perdida de prueba');}return structuredClone(productFixture.saved[0]);},
   getProductIntake:async()=>structuredClone(productFixture.saved[0]),
   advanceProductIntake:async()=>{productFixture.steps++;const row=productFixture.saved[0];row.steps[row.currentStep].status='verified';row.currentStep++;row.productId='99';row.status=row.currentStep===row.steps.length?'completed':'ready';return structuredClone(row);}
  };
  productFixture.workspace=createTpvWorkspace({actor:()=>({id:'operator',active:true}),can:()=>true,canReadCost:()=>true,canCreateProduct:()=>productFixture.canCreate,confirm:async()=>true,autoOpen:true,createLiveAdapter:()=>adapter});
  productFixture.workspace.mount(document.querySelector('#tpv'));
 });
 await page.getByRole('button',{name:/Artículo del ticket/}).click();
 await page.getByText('Más acciones',{exact:true}).click();await page.getByRole('button',{name:'Nuevo producto',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Nuevo producto',exact:true});await dialog.waitFor();
 await dialog.getByLabel('Nombre del artículo',{exact:true}).fill('Camiseta azul');await dialog.getByLabel('Referencia',{exact:true}).fill('CAMISETA-001');
 await dialog.getByLabel('Precio de venta sin impuestos (€)',{exact:true}).fill('12,50');
 await dialog.getByLabel('Categoría',{exact:true}).selectOption('4');await dialog.getByLabel('Impuestos',{exact:true}).selectOption('1');
 assert.match(await dialog.locator('[data-tpv-product-price]').innerText(),/15,125/);
 await dialog.getByLabel('Precio de venta con impuestos (€)',{exact:true}).fill('15,13');
 assert.equal(await dialog.getByLabel('Precio de venta sin impuestos (€)',{exact:true}).inputValue(),'12.504132');
 await dialog.getByLabel('Precio de venta sin impuestos (€)',{exact:true}).fill('12,50');
 await dialog.getByLabel('Unidades disponibles',{exact:true}).fill('5');
 assert.equal(await page.evaluate(()=>productFixture.workspace.hasDraft()),true);
 await fs.mkdir('artifacts/totustpv-product-intake',{recursive:true});
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:950});
  await page.screenshot({path:`artifacts/totustpv-product-intake/form-${width}.png`,fullPage:true});
  assert.equal(await dialog.evaluate(el=>el.scrollWidth>el.clientWidth+2),false,'Dialog fits '+width);
 }
 await dialog.getByRole('button',{name:'Añadir combinación',exact:true}).click();
 await dialog.locator('[data-tpv-product-property="attributeValueIds"]').selectOption('1');
 await dialog.locator('[data-tpv-product-variant="0"][data-tpv-product-property="quantity"]').fill('3');
 const png=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=8;const ctx=canvas.getContext('2d');ctx.fillStyle='#c28230';ctx.fillRect(2,2,4,4);return canvas.toDataURL('image/png').split(',')[1];});
 await dialog.locator('[data-tpv-product-images]').first().setInputFiles({name:'camiseta.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
 await dialog.getByAltText('Imagen 1 preparada',{exact:true}).waitFor();await dialog.locator('[data-tpv-product-property="imageIndexes"]').selectOption('0');
 assert.equal(await dialog.evaluate(el=>el.scrollWidth>el.clientWidth+2),false,'Combinations and image controls fit on mobile');
 await dialog.getByRole('button',{name:'Guardar ficha para revisar',exact:true}).click();
 await dialog.getByRole('alert').filter({hasText:'Respuesta perdida'}).waitFor();
 assert.equal(await dialog.getByLabel('Nombre del artículo',{exact:true}).isDisabled(),true,'A possibly saved request cannot be edited into another intent');
 await dialog.getByRole('button',{name:'Comprobar envío',exact:true}).click();
 const review=page.getByRole('dialog',{name:'Alta de producto',exact:true});await review.waitFor();assert.equal(await page.evaluate(()=>productFixture.steps),0);
 await review.getByRole('button',{name:'Confirmar y crear producto',exact:true}).click();
 await review.getByText('Alta terminada',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>productFixture.steps),3);assert.equal(await page.evaluate(()=>productFixture.saved.length),1);
 assert.equal(await page.evaluate(()=>productFixture.draft.variants[0].quantity),3);
 assert.deepEqual(await page.evaluate(()=>productFixture.draft.variants[0].imageIndexes),[0]);assert.equal(await page.evaluate(()=>productFixture.draft.images.length),1);
 await page.screenshot({path:'artifacts/totustpv-product-intake/review-390.png',fullPage:true});
 await review.getByRole('button',{name:'Cerrar alta de producto',exact:true}).click();
 assert.equal(await page.locator('.tpv-ticket-line').count(),1,'The original unpaid ticket survives product creation');
 await page.getByRole('button',{name:'Ver ticket',exact:true}).click();await page.locator('[data-tpv-action="payment"]').click();
 await page.locator('[data-tpv-form="pay"]').waitFor();await page.getByText('Más acciones',{exact:true}).click();
 await page.getByRole('button',{name:'Altas de productos',exact:true}).click();await review.waitFor();
 assert.equal(await review.getByRole('button',{name:'Preparar otro artículo',exact:true}).count(),0,'A prepared checkout permits product history but no product mutation');
 await review.getByRole('button',{name:'Cerrar alta de producto',exact:true}).click();await page.getByRole('button',{name:'Volver al ticket',exact:true}).click();
 await page.evaluate(()=>{productFixture.canCreate=false;});
 await page.getByRole('button',{name:'Artículo del ticket',exact:false}).first().click();
 await page.getByText('Más acciones',{exact:true}).click();assert.equal(await page.getByRole('button',{name:'Nuevo producto',exact:true}).count(),0);
 await page.getByRole('button',{name:'Altas de productos',exact:true}).click();
 await page.getByRole('dialog',{name:'Alta de producto',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Preparar otro artículo',exact:true}).count(),0);
 assert.deepEqual(errors,[]);console.log('PASS product intake browser: desktop/mobile form, country tax preview, pending-reply lock, same-draft recovery, explicit confirmation, ordered progress, preserved ticket and permission loss. Synthetic responses only.');
}finally{await page.close();await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
