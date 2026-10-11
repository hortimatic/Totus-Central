import {chromium} from 'playwright';
const base='http://127.0.0.1:4173/tests/app-mock.html';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({acceptDownloads:true,viewport:{width:1440,height:960}});
page.setDefaultTimeout(5000);
const errors=[];
page.on('pageerror',e=>errors.push('JS '+e.message));
page.on('console',m=>{if(m.type()==='error')errors.push('Consola '+m.text())});
const check=async (label,fn)=>{try{await fn();console.log('OK '+label)}catch(e){errors.push(label+': '+e.message);console.error('ERROR '+label+': '+e.message)}};
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
const db=()=>page.evaluate(()=>({
 closings:window.__mockDb.ops_daily_closings,
 expenses:window.__mockDb.ops_expenses,
 invoices:window.__mockDb.ops_sales_invoices,
 documents:window.__mockDb.ops_documents,
 team:window.__mockDb.team_members,
 uploads:window.__mockUploads.size
}));
const nav=async route=>{await page.locator('#nav [data-route="'+route+'"]').click();await page.waitForTimeout(50)};
await check('Arranque real y autenticación simulada',async()=>{
 await page.goto(base,{waitUntil:'networkidle'});
 await page.locator('#userCard').waitFor({state:'visible'});
 assert((await page.locator('#content').innerText()).includes('Operativa de hoy'),'Pantalla Inicio vacía');
 assert((await page.locator('#nav .nav-btn').count())===9,'La navegación principal debe tener nueve pestañas');
});
await check('Cajas: creación, cálculo, guardado y lectura',async()=>{
 await nav('cajas');
 await page.locator('[data-action="closing-new"]').first().click();
 const drawers=await page.locator('.drawer-entry').count();
 assert(drawers===2,'Hortimatic debe mostrar dos cajas');
 const ids=await page.locator('.drawer-entry').evaluateAll(rows=>rows.map(x=>x.dataset.drawerId));
 await page.locator('#drOpen_'+ids[0]).fill('100,00');
 await page.locator('#drClose_'+ids[0]).fill('150,00');
 await page.locator('#drCard_'+ids[0]).fill('20,00');
 await page.locator('#drClose_'+ids[1]).fill('0');
 await page.locator('#clReported').fill('70');
 await page.locator('[data-action="closing-save-close"]').click();
 await page.waitForTimeout(100);
 const d=await db();
 assert(d.closings.length===1,'No se guardó el cierre');
 assert(d.closings[0].status==='cerrado','El cierre no quedó cerrado');
 assert(Math.abs(d.closings[0].card_sales-20)<0.01,'Tarjetas mal sumadas');
 assert(Math.abs(d.closings[0].cash_sales-50)<0.01,'Efectivo mal sumado');
});
await check('Gastos: creación, importe decimal y líneas fiscales',async()=>{
 await nav('gastos');
 await page.locator('[data-action="expense-new"]').click();
 await page.locator('#exSupplier').fill('Proveedor de ensayo');
 await page.locator('#exInvoice').fill('QA-F-1');
 await page.locator('#exLineDesc_0').fill('Compra simulada');
 await page.locator('#exLineBase_0').fill('100,00');
 await page.locator('#exLineVat_0').fill('21');
 await page.locator('#exLineRe_0').fill('5,2');
 await page.locator('[data-action="expense-save"]').click();
 await page.waitForTimeout(100);
 const d=await db();
 assert(d.expenses.length===1,'El gasto no se guardó');
 assert(Math.abs(d.expenses[0].gross_expense-126.2)<0.01,'El importe IVA + RE no cuadra');
});
await check('Facturación: crear borrador con líneas e importes',async()=>{
 await nav('facturacion');
 await page.locator('[data-action="invoice-new"]').first().click();
 await page.locator('#ivCustomer').fill('Cliente ensayo');
 await page.locator('#ivDesc_0').fill('Servicio de prueba');
 await page.locator('#ivQty_0').fill('2');
 await page.locator('#ivUnit_0').fill('50,00');
 await page.locator('[data-action="invoice-save"]').click();
 await page.waitForTimeout(100);
 const d=await db();
 assert(d.invoices.length===1,'Factura no guardada');
 assert(d.invoices[0].status==='borrador','Factura debe quedar en borrador');
 assert(Math.abs(d.invoices[0].total_amount-121)<0.01,'Factura total incorrecto');
});
await check('Documentos: subida, archivo y metadatos',async()=>{
 await nav('documentos');
 await page.locator('[data-action="document-new"]').click();
 await page.locator('#docParty').fill('Proveedor QA');
 await page.locator('#docNumber').fill('DOC-001');
 await page.locator('#docFile').setInputFiles({name:'factura-qa.txt',mimeType:'text/plain',buffer:Buffer.from('Factura de prueba\nImporte: 121 euros\n')});
 await page.locator('[data-action="document-save"]').click();
 await page.waitForTimeout(100);
 const d=await db();
 assert(d.documents.length===1,'Documento no archivado');
 assert(d.uploads===1,'Archivo no subido a storage simulado');
 assert(d.documents[0].original_name==='factura-qa.txt','Nombre de archivo erróneo');
});
await check('Usuarios: crear y comprobar persistencia simulada',async()=>{
 await nav('administracion');
 await page.locator('[data-action="user-new"]').first().click();
 await page.locator('#usName').fill('Empleado prueba QA');
 await page.locator('#usEmail').fill('empleado-qa@example.com');
 await page.locator('#usRole').selectOption('encargado');
 await page.locator('#usPassword').fill('PruebaClave2026!');
 await page.locator('[data-action="user-save"]').click();
 await page.waitForTimeout(100);
 const d=await db();
 assert(d.team.some(x=>x.email==='empleado-qa@example.com'&&x.role==='encargado'),'Usuario no creado');
});
await check('Navegación de todas las pestañas tras operaciones',async()=>{
 for(const route of ['inicio','pricing','cajas','gastos','facturacion','documentos','fiscalidad','informes','administracion']){
  await nav(route);
  const t=(await page.locator('#content').innerText()).trim();
  assert(t.length>20,route+' está vacía');
 }
});
await browser.close();
if(errors.length){console.error('E2E MOCK QA FALLÓ\n- '+errors.join('\n- '));process.exit(1)}
console.log('E2E MOCK QA: operaciones y pestañas correctas');
