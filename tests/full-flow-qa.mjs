import {chromium} from 'playwright';
import xlsx from 'xlsx-js-style';
const base='http://127.0.0.1:4173/tests/app-mock.html';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({acceptDownloads:true,viewport:{width:1440,height:960}});
page.setDefaultTimeout(5000);
page.on('dialog',async d=>{await d.accept();});
const errors=[];
page.on('pageerror',e=>errors.push('JS '+e.message));
page.on('console',m=>{if(m.type()==='error')errors.push('Consola '+m.text())});
const check=async (label,fn)=>{try{await fn();console.log('OK '+label)}catch(e){errors.push(label+': '+e.message);console.error('ERROR '+label+': '+e.message);await page.locator('#modalHost .close-btn').click().catch(()=>{});}};
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
const db=()=>page.evaluate(()=>({
 closings:window.__mockDb.ops_daily_closings,
 expenses:window.__mockDb.ops_expenses,
 invoices:window.__mockDb.ops_sales_invoices,
 documents:window.__mockDb.ops_documents,
 team:window.__mockDb.team_members,
 uploads:window.__mockUploads.size
}));
const nav=async route=>{if(await page.locator('#modalHost .close-btn').count())await page.locator('#modalHost .close-btn').click();await page.locator('#nav [data-route="'+route+'"]').click();await page.waitForTimeout(50)};
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
 await page.locator('#exLineBase_0').fill('importe no válido');
 await page.locator('[data-action="expense-save"]').click();
 assert((await db()).expenses.length===0,'No debe guardar importes con letras');
 assert((await page.locator('#toastHost').innerText()).includes('importe no válido'),'Debe explicar qué importe corregir');
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
 await page.locator('[data-action="invoice-preview"]').first().click();
 assert((await page.locator('#modalHost').innerText()).includes('Cliente ensayo'),'La vista previa de factura no muestra el cliente');
 const popupReady=page.waitForEvent('popup',{timeout:5000});
 await page.locator('#modalHost [data-action="invoice-print"]').first().click();
 const printPopup=await popupReady;
 await printPopup.locator('body').waitFor({state:'visible'});
 await printPopup.waitForFunction(()=>document.body?.innerText?.includes('Cliente ensayo'),{timeout:5000});
 const cssHref=await printPopup.locator('link[rel="stylesheet"]').getAttribute('href');
 assert(cssHref?.includes('/src/styles.css'),'La impresión no carga la hoja de estilos');
 await printPopup.close();
 await page.locator('#modalHost .close-btn').click();
 await page.locator('[data-action="invoice-finalize"]').first().click();
 await page.waitForTimeout(100);
 const issued=await db();
 assert(issued.invoices[0].status==='emitida','La factura no se ha emitido');
 assert(/^H-0001$/.test(issued.invoices[0].display_number),'La numeración emitida no coincide');
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
 await page.locator('[data-action="document-preview"]').first().click();
 await page.locator('#modalHost .text-preview').waitFor({state:'visible'});
 assert((await page.locator('#modalHost .text-preview').innerText()).includes('Importe: 121 euros'),'El texto de la factura no aparece en vista previa');
 await page.locator('#modalHost .close-btn').click();
 const download=page.waitForEvent('download');
 await page.locator('[data-action="document-download"]').first().click();
 const actualDownload=await download;
 assert(actualDownload.suggestedFilename()==='factura-qa.txt','El fichero descargado tiene otro nombre');
});
await check('Documentos Excel: carga y vista previa',async()=>{
 await nav('documentos');
 if(await page.locator('[data-action="document-back"]').count())await page.locator('[data-action="document-back"]').first().click();
 await page.locator('[data-action="document-new"]').click();
 const wb=xlsx.utils.book_new();
 xlsx.utils.book_append_sheet(wb,xlsx.utils.aoa_to_sheet([['Concepto','Importe'],['Factura prueba',126.2]]),'Ensayo');
 const buffer=Buffer.from(xlsx.write(wb,{bookType:'xlsx',type:'buffer'}));
 await page.locator('#docFile').setInputFiles({name:'qa-factura.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer});
 await page.locator('#docParty').fill('Prueba XLSX');
 await page.locator('[data-action="document-save"]').click();
 await page.waitForTimeout(120);
 assert((await db()).documents.length===2,'El Excel no quedó guardado');
 await page.locator('[data-action="document-preview"]').first().click();
 await page.locator('#modalHost .excel-preview').waitFor({state:'visible'});
 assert((await page.locator('#modalHost .excel-preview').innerText()).includes('Factura prueba'),'Contenido Excel perdido en vista previa');
 await page.locator('#modalHost .close-btn').click();
 await page.locator('#docNotes').fill('Archivado y revisado en QA');
 await page.locator('[data-action="document-save"]').click();
 await page.waitForTimeout(100);
 assert((await db()).documents.some(x=>x.original_name==='qa-factura.xlsx'&&x.notes==='Archivado y revisado en QA'),'La edición de metadatos no persiste');
 const download=page.waitForEvent('download');
 await page.locator('[data-action="document-download"]').first().click();
 assert((await download).suggestedFilename()==='qa-factura.xlsx','El archivo XLSX descargado no coincide con el original');
 await page.locator('[data-action="document-delete"]').click();
 await page.waitForTimeout(100);
 assert(!(await db()).documents.some(x=>x.original_name==='qa-factura.xlsx'),'No se ha eliminado el documento de prueba');

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
 await page.locator('[data-action="user-edit"][data-email="empleado-qa@example.com"]').click();
 await page.locator('#usJob').fill('Encargado de simulación');
 await page.locator('[data-action="user-save"]').click();
 await page.waitForTimeout(100);
 assert((await db()).team.some(x=>x.email==='empleado-qa@example.com'&&x.job_title==='Encargado de simulación'),'No se actualizó la ficha de usuario');
});
await check('Navegación de todas las pestañas tras operaciones',async()=>{
 for(const route of ['inicio','pricing','cajas','gastos','facturacion','documentos','fiscalidad','informes','administracion']){
  await nav(route);
  const t=(await page.locator('#content').innerText()).trim();
  assert(t.length>20,route+' está vacía');
 }
});
await check('Roles: gerente y encargado con permisos de navegación',async()=>{
 for(const [role,adminVisible] of [['gerente',true],['encargado',false]]){
  const rolePage=await browser.newPage({viewport:{width:390,height:844}});
  await rolePage.goto(base+'?role='+role,{waitUntil:'networkidle'});
  try{await rolePage.locator('#app').waitFor({state:'visible',timeout:3000})}
  catch(e){throw new Error(role+': acceso fallido. Mensaje='+await rolePage.locator('#loginMessage').innerText()+'; APP='+await rolePage.locator('#app').getAttribute('class')+'; contenido='+String(await rolePage.locator('#content').innerText()).slice(0,140))}

  const canSee=await rolePage.locator('#nav [data-route="administracion"]').count()>0;
  assert(canSee===adminVisible,'Permisos de navegación incorrectos: '+role);
  if(role==='gerente'){
   await rolePage.locator('#nav [data-route="administracion"]').click();
   assert(!(await rolePage.locator('#content').innerText()).includes('Nuevo usuario'),'Gerente no debe dar de alta usuarios');
  }
  await rolePage.close();
 }
});
await browser.close();
if(errors.length){console.error('E2E MOCK QA FALLÓ\n- '+errors.join('\n- '));process.exit(1)}
console.log('E2E MOCK QA: operaciones y pestañas correctas');
