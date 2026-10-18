import {chromium} from 'playwright';
import xlsx from 'xlsx-js-style';
import {PDFDocument} from 'pdf-lib';
import JSZip from 'jszip';
import fs from 'node:fs/promises';
const base='http://127.0.0.1:4173/tests/app-mock.html';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({acceptDownloads:true,viewport:{width:1440,height:960}});
page.setDefaultTimeout(5000);
page.on('dialog',async d=>{await d.accept(d.type()==='prompt'?(d.message().includes('ELIMINAR ROL')?'ELIMINAR ROL':'ELIMINAR USUARIO'):undefined);});
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
// An unauthenticated or broken fixture must fail immediately; subsequent missing buttons are cascading errors.
if(errors.length){
 await browser.close();
 console.error('E2E MOCK ARRANQUE FALLÓ\n- '+errors.join('\n- '));
 process.exit(1);
}
await check('Navegación: accesos directos ocultos y rechazo sin excepción',async()=>{
 const before=errors.length;
 await page.evaluate(async()=>{
  const {state}=await import('../src/state.js');
  window.__qaOriginalUser={...state.user};
  window.__qaOriginalPerms=[...state.data.userPermissions];
  state.user={...state.user,role:'gerente'};
  state.data.userPermissions=[...state.data.userPermissions,{
   email:state.user.email,module:'pricing',can_view:false,can_create:false,
   can_edit:false,can_delete:false,can_export:false
  }];
 });
 await page.locator('#nav [data-route="inicio"]').click();
 assert(await page.locator('#content [data-route="pricing"]').count()===0,
  'El panel Inicio deja accesos directos a Pricing aunque el rol no puede entrar');
 assert(await page.locator('#nav [data-route="pricing"]').count()===0,
  'El menú lateral deja entrar en Pricing sin permiso');
 await page.evaluate(()=>{
  const b=document.createElement('button');b.id='qaForbiddenRoute';b.dataset.route='pricing';
  document.getElementById('content').appendChild(b);
 });
 await page.locator('#qaForbiddenRoute').click();
 assert((await page.locator('#toastHost').innerText()).includes('No tienes permiso'),
  'Un intento de navegación bloqueado no da un aviso claro');
 assert(errors.length===before,'Una ruta no autorizada provocó excepción JavaScript');
 await page.evaluate(async()=>{
  const {state}=await import('../src/state.js');
  state.user=window.__qaOriginalUser;
  state.data.userPermissions=window.__qaOriginalPerms;
  delete window.__qaOriginalUser;delete window.__qaOriginalPerms;
 });
 await page.locator('#nav [data-route="inicio"]').click();
});
await check('Roles por módulo: alta, edición y restablecimiento',async()=>{
 await nav('administracion');
 await page.locator('[data-action="admin-section"][data-section="roles"]').first().click();
 assert((await page.locator('#content').innerText()).includes('Gerencia'),'Falta la matriz de roles');
 await page.locator('[data-action="role-permissions"][data-role="gerente"]').click();
 assert(await page.locator('[id^="roleperm_"]').count()===45,'Deben existir 9 módulos × 5 permisos');
 await page.locator('#rolepreset_gastos').selectOption('read');
 await page.locator('[data-action="role-permissions-save"]').click();
 await page.waitForTimeout(100);
 const saved=await page.evaluate(()=>window.__mockDb.ops_role_permissions);
 assert(saved.length===9,'No se guardaron los nueve módulos del rol');
 assert(saved.find(x=>x.role==='gerente'&&x.module==='gastos')?.can_create===false,'No persistió el permiso de Gastos');
 await page.locator('[data-action="role-permissions"][data-role="gerente"]').click();
 assert(!(await page.locator('#roleperm_gastos_create').isChecked()),'La edición no recupera los permisos guardados');
 await page.locator('[data-action="role-permissions-reset"]').click();
 await page.waitForTimeout(100);
 assert((await page.evaluate(()=>window.__mockDb.ops_role_permissions)).length===0,'No se restableció la matriz del rol');
 await page.locator('[data-action="admin-section"][data-section="usuarios"]').click();
});
await check('Ayudas i: apertura, contenido y campos de un gasto',async()=>{
 await nav('gastos');
 await page.locator('[data-action="expense-new"]').click();
 const aids=page.locator('#content .field-help summary');
 assert(await aids.count()>=14,'Faltan iconos i en los formularios');
 await aids.first().click();
 assert(await page.locator('#content .field-help[open] [role="note"]').count()>=1,'Al pulsar i no aparece información');
 assert((await page.locator('#content .field-help[open] [role="note"]').first().innerText()).length>20,'La ayuda no explica el campo');
 await page.locator('[data-action="expense-back"]').first().click();
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
 await page.locator('[data-action="closing-reopen"]').click();
 await page.waitForTimeout(100);
 assert((await db()).closings[0].status==='borrador','No se puede reabrir un cierre');
 await page.locator('[data-action="closing-save-close"]').click();
 await page.waitForTimeout(100);
 assert((await db()).closings[0].status==='cerrado','No se puede volver a cerrar una caja reabierta');
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
await check('Gastos: adjuntar factura PDF y recuperar el documento',async()=>{
 await nav('gastos');
 if(await page.locator('[data-action="expense-back"]').count())await page.locator('[data-action="expense-back"]').first().click();
 await page.locator('[data-action="expense-new"]').click();
 await page.locator('#exSupplier').fill('Proveedor QA PDF');
 await page.locator('#exInvoice').fill('TEST-PDF-2026');
 await page.locator('#exLineDesc_0').fill('Compra simulada con justificante');
 await page.locator('#exLineBase_0').fill('200,00');
 await page.locator('#exLineVat_0').fill('21');
 await page.locator('#exLineRe_0').fill('5,2');
 const pdf=await PDFDocument.create();pdf.addPage([300,200]);
 await page.locator('#exFile').setInputFiles({name:'justificante-test.pdf',mimeType:'application/pdf',buffer:Buffer.from(await pdf.save())});
 assert((await page.locator('#exSelectedFile').innerText()).includes('justificante-test.pdf'),'La ficha no muestra el nombre de la factura seleccionada');
 assert(await page.locator('#exFilePreview').isEnabled(),'La vista previa previa al guardado sigue bloqueada');
 await page.locator('[data-action="expense-file-preview"]').click();
 await page.locator('#modalHost .document-frame').waitFor({state:'visible'});
 assert((await page.locator('#modalHost').innerText()).includes('todavía NO guardado'),'La vista previa confunde adjuntar con guardar');
 await page.locator('#modalHost .close-btn').click();
 assert(await page.locator('#exFile').evaluate(el=>el.files?.length===1),'Ver la factura ha borrado el archivo seleccionado');
 await page.locator('[data-action="expense-save"]').click();
 await page.waitForTimeout(100);
 const d=await db(),ex=d.expenses.find(x=>x.invoice_number==='TEST-PDF-2026');
 assert(ex&&Math.abs(ex.gross_expense-252.4)<.01,'No cuadra factura con IVA y RE');
 assert(d.documents.some(x=>x.id===ex.document_id&&x.original_name==='justificante-test.pdf'&&x.linked_entity_id===ex.id),'Factura PDF no asociada al gasto');
 await page.locator('[data-action="expense-document-preview"]').first().click();
 await page.locator('#modalHost .document-frame').waitFor({state:'visible'});
 await page.locator('#modalHost .close-btn').click();
 const ready=page.waitForEvent('download');
 await page.locator('[data-action="expense-document-download"]').first().click();
 assert((await ready).suggestedFilename()==='justificante-test.pdf','Descarga del justificante incorrecta');
});
await check('Gastos: índice de facturas, búsqueda, desglose gestor y PDF descargable',async()=>{
 await nav('gastos');
 if(await page.locator('[data-action="expense-back"]').count())await page.locator('[data-action="expense-back"]').first().click();
 await page.locator('[data-action="expense-section"][data-section="facturas"]').click();
 assert((await page.locator('#content').innerText()).includes('Facturas y justificantes de gastos'),'Falta la sección documental en Gastos');
 assert((await page.locator('#content').innerText()).includes('TEST-PDF-2026'),'No aparece la factura adjunta en el índice');
 assert((await page.locator('#content').innerText()).includes('Proveedor QA PDF'),'Faltan datos de proveedor');
 assert(await page.locator('#gastosAttachment').count()===1,'Falta filtro de justificantes');
 await page.locator('#gastosQuery').fill('TEST-PDF-2026');
 await page.locator('#gastosAttachment').selectOption('attached');
 await page.locator('[data-action="gastos-apply"]').click();
 assert((await page.locator('#content .data-table tbody tr').count())===1,'La búsqueda por factura no filtra correctamente');
 await page.locator('[data-action="expense-gestor-detail"]').first().click();
 const gestor=page.locator('#modalHost');
 assert(await gestor.locator('th').count()===20,'La ficha de gestoría no conserva las 20 columnas');
 const headerTexts=(await gestor.locator('th').allTextContents()).map(s=>s.replace(/\s+/g,' ').trim());
 for(const txt of ['NIF/CIF','Base IVA','Cuota IVA','Base R.E.','Cuota R.E.','Imputable a IRPF','Neto pagado']){
  assert(headerTexts.includes(txt),'Falta columna gestoría: '+txt+'; detectadas: '+headerTexts.join(', '));
 }
 assert((await gestor.innerText()).toLocaleLowerCase('es').includes('sin revisar'),'Debe avisarse si el desglose fiscal no está cotejado');
 await gestor.locator('.close-btn').click();
 await page.locator('[data-action="expense-document-preview"]').first().click();
 await page.locator('#modalHost .document-frame').waitFor({state:'visible'});
 await page.locator('#modalHost .close-btn').click();
 const pdfReady=page.waitForEvent('download');
 await page.locator('[data-action="expense-document-download"]').first().click();
 const file=await pdfReady;
 assert(file.suggestedFilename()==='justificante-test.pdf','La descarga desde Gastos tiene nombre incorrecto');
 const bytes=await fs.readFile(await file.path());
 assert(bytes.subarray(0,5).toString()==='%PDF-','La factura descargada no es un PDF original válido');
 // Searching by original filename must export the same expense as the archive list.
 await page.locator('#gastosQuery').fill('justificante-test.pdf');
 await page.locator('[data-action="gastos-apply"]').click();
 assert(await page.locator('#content .data-table tbody tr').count()===1,'No encuentra la factura por nombre del archivo');
 const filenameDownload=page.waitForEvent('download');
 await page.locator('[data-action="export-expenses-current"]').click();
 const filenameFile=await filenameDownload;
 const filenameBook=xlsx.read(await fs.readFile(await filenameFile.path()),{type:'buffer'});
 const filenameRows=xlsx.utils.sheet_to_json(filenameBook.Sheets.Gastos,{header:1});
 assert(filenameRows.some(row=>row.includes('TEST-PDF-2026')),'Buscar un justificante por nombre no coincide con el Excel exportado');
 await page.locator('#gastosQuery').fill('TEST-PDF-2026');
 await page.locator('[data-action="gastos-apply"]').click();
 await page.locator('#gastosFrom').fill('2026-01-01');
 await page.locator('#gastosTo').fill('2026-01-31');
 await page.locator('[data-action="gastos-apply"]').click();
 assert((await page.locator('#content').innerText()).includes('No hay facturas'),'El filtro de fechas no excluye octubre');
 await page.locator('#gastosFrom').fill('2026-10-01');
 await page.locator('#gastosTo').fill('2026-10-31');
 await page.locator('#gastosQuery').fill('');
 await page.locator('#gastosAttachment').selectOption('missing');
 await page.locator('[data-action="gastos-apply"]').click();
 assert((await page.locator('#content').innerText()).includes('QA-F-1'),'No aparece el gasto sin justificante');
 assert(!(await page.locator('#content').innerText()).includes('TEST-PDF-2026'),'El filtro sin justificante incluye facturas adjuntas');
 // The XLSX must match the applied attachment filter, not just the screen.
 const missingDownload=page.waitForEvent('download');
 await page.locator('[data-action="export-expenses-current"]').click();
 const missingFile=await missingDownload;
 const missingBook=xlsx.read(await fs.readFile(await missingFile.path()),{type:'buffer'});
 const missingRows=xlsx.utils.sheet_to_json(missingBook.Sheets.Gastos,{header:1});
 assert(missingRows.some(row=>row.includes('QA-F-1')),'XLSX sin archivo no incluye gasto visible');
 assert(!missingRows.some(row=>row.includes('TEST-PDF-2026')),'XLSX sin archivo exporta una factura que tiene PDF');
 await page.locator('#gastosAttachment').selectOption('attached');
 await page.locator('[data-action="gastos-apply"]').click();
 const attachedDownload=page.waitForEvent('download');
 await page.locator('[data-action="export-expenses-current"]').click();
 const attachedFile=await attachedDownload;
 const attachedBook=xlsx.read(await fs.readFile(await attachedFile.path()),{type:'buffer'});
 const attachedRows=xlsx.utils.sheet_to_json(attachedBook.Sheets.Gastos,{header:1});
 assert(attachedRows.some(row=>row.includes('TEST-PDF-2026')),'XLSX con archivo omite factura con PDF');
 assert(!attachedRows.some(row=>row.includes('QA-F-1')),'XLSX con archivo exporta gasto sin justificante');
 await page.locator('#gastosAttachment').selectOption('all');
 await page.locator('[data-action="gastos-apply"]').click();
 await page.locator('[data-action="expense-section"][data-section="registros"]').click();
 assert((await page.locator('#content').innerText()).includes('Gastos'),'No puede volver al listado habitual de gastos');
});
await check('Cajas: segunda tienda, fecha distinta y conciliación de todos los cobros',async()=>{
 await nav('cajas');
 if(await page.locator('[data-action="closing-back"]').count())await page.locator('[data-action="closing-back"]').first().click();
 await page.locator('[data-action="closing-new"]').first().click();
 const storeB=await page.evaluate(()=>window.__mockDb.ops_stores.find(x=>x.name==='NewOldSmok').id);
 await page.locator('#clStore').selectOption(storeB);
 const ids=await page.locator('.drawer-entry').evaluateAll(rows=>rows.map(x=>x.dataset.drawerId));
 assert(ids.length===1,'NewOldSmok debe mostrar solo su caja, sin mezclar Hortimatic');
 const id=ids[0];
 await page.locator('#drCard_'+id).fill('8,50');
 await page.locator('#clReported').fill('125,00');
 await page.locator('#clDate').fill('2026-09-15');
 assert((await page.locator('#drCard_'+id).inputValue())==='8,50','Cambiar fecha ha borrado importes del usuario');
 assert((await page.locator('#clReported').inputValue())==='125,00','Cambiar fecha ha borrado el total de control');
 await page.locator('#drOpen_'+id).fill('10,00');
 await page.locator('#drClose_'+id).fill('30,00');
 await page.locator('#drWithdraw_'+id).fill('2,00');
 await page.locator('#drCard_'+id).fill('40,00');
 await page.locator('#drBizum_'+id).fill('5,00');
 await page.locator('#drOnline_'+id).fill('12,00');
 await page.locator('#clReported').fill('79,00');
 await page.locator('[data-action="closing-save-close"]').click();
 await page.waitForTimeout(100);
 const result=(await db()).closings.find(x=>x.store_id===storeB);
 assert(result?.status==='cerrado','El cierre de la segunda tienda no se guardó cerrado');
 assert(result.business_date==='2026-09-15','La fecha de septiembre no se conserva');
 assert(Math.abs(result.cash_sales-22)<0.001,'Cálculo de efectivo: final + retiradas - apertura');
 assert(Math.abs(result.card_sales-40)<0.001&&Math.abs(result.bizum_sales-5)<0.001&&Math.abs(result.online_sales-12)<0.001,'Se mezclan las formas de pago');
 const total=result.cash_sales+result.card_sales+result.bizum_sales+result.online_sales;
 assert(Math.abs(total-79)<0.001,'Cierre diario no cuadra');
});
await check('Gastos: control interno, clasificación y rechazo de factura duplicada',async()=>{
 await page.evaluate(async()=>{
  const c={id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',name:'Horas extra',code:'INTERNAL_OVERTIME',active:true,sort_order:10};
  window.__mockDb.ops_expense_categories.push(c);
  const state=(await import('../src/state.js')).state;
  state.data.categories.push(c);
 });
 await nav('gastos');
 if(await page.locator('[data-action="expense-back"]').count())await page.locator('[data-action="expense-back"]').first().click();
 await page.locator('[data-action="expense-new"]').click();
 await page.locator('#exSupplier').fill('Horas extra QA');
 await page.locator('#exInvoice').fill('INTERNO-2026');
 await page.locator('#exLineDesc_0').fill('Horas extra de personal - control interno');
 await page.locator('#exLineCategory_0').selectOption('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
 assert(await page.locator('#exManagement').isChecked(),'Un gasto INTERNAL_ debe marcarse como solo control interno');
 assert(!(await page.locator('#exLineDed_0').isChecked()),'Un gasto interno no puede quedar deducible');
 assert((await page.locator('#exLineDedPct_0').inputValue())==='0','Porcentaje deducible interno debe ser cero');
 await page.locator('#exLineBase_0').fill('300,00');
 await page.locator('#exLineVat_0').fill('0');
 await page.locator('#exLineRe_0').fill('0');
 await page.locator('[data-action="expense-save"]').click();
 await page.waitForTimeout(100);
 const before=(await db()).expenses;
 const internal=before.find(x=>x.invoice_number==='INTERNO-2026');
 assert(internal&&internal.management_only&&Math.abs(internal.gross_expense-300)<.01,'El gasto interno no se guardó correctamente');
 await page.locator('[data-action="expense-back"]').first().click();
 await page.locator('[data-action="expense-new"]').click();
 await page.locator('#exSupplier').fill('Horas extra QA');
 await page.locator('#exInvoice').fill('INTERNO-2026');
 await page.locator('#exLineDesc_0').fill('Intento de duplicado');
 await page.locator('#exLineBase_0').fill('300');
 await page.locator('[data-action="expense-save"]').click();
 assert((await db()).expenses.length===before.length,'Se registró dos veces el mismo justificante');
 assert((await page.locator('#toastHost').innerText()).includes('Ya existe un gasto'),'Debe explicarse claramente el duplicado');
 await page.waitForTimeout(100);
 const expectedConsoleError=errors.findIndex(x=>x.includes('Ya existe un gasto con esta factura para el mismo proveedor'));
 if(expectedConsoleError>=0)errors.splice(expectedConsoleError,1);
 await page.locator('[data-action="expense-back"]').first().click();
});
await check('Gastos: reemplazar justificante, previsualizar Excel y evitar archivos huérfanos',async()=>{
 await nav('gastos');
 if(await page.locator('[data-action="expense-back"]').count())await page.locator('[data-action="expense-back"]').first().click();
 await page.locator('[data-action="expense-new"]').first().click();
 await page.locator('#exSupplier').fill('Proveedor sustitución QA');
 await page.locator('#exInvoice').fill('REPLACE-QA-2026');
 await page.locator('#exLineDesc_0').fill('Factura con sustitución de justificante');
 await page.locator('#exLineBase_0').fill('40,00');
 const docA=await PDFDocument.create();docA.addPage([400,220]);
 await page.locator('#exFile').setInputFiles({name:'documento-antiguo.pdf',mimeType:'application/pdf',buffer:Buffer.from(await docA.save())});
 await page.locator('[data-action="expense-save"]').first().click();
 await page.waitForTimeout(120);
 const old=(await db()).expenses.find(x=>x.invoice_number==='REPLACE-QA-2026');
 assert(old?.document_id,'La factura inicial no se asoció');
 const previousId=old.document_id;
 const book=xlsx.utils.book_new();xlsx.utils.book_append_sheet(book,xlsx.utils.aoa_to_sheet([['Concepto','Base'],['Factura de ensayo',40]]),'Factura');
 await page.locator('#exFile').setInputFiles({name:'vista-previa.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(xlsx.write(book,{bookType:'xlsx',type:'buffer'}))});
 await page.locator('[data-action="expense-file-preview"]').click();
 assert((await page.locator('#modalHost .excel-preview').innerText()).includes('Factura de ensayo'),'La vista previa Excel de gastos no presenta las celdas');
 await page.locator('#modalHost .close-btn').click();
 const docB=await PDFDocument.create();docB.addPage([440,230]);
 await page.locator('#exFile').setInputFiles({name:'documento-actualizado.pdf',mimeType:'application/pdf',buffer:Buffer.from(await docB.save())});
 await page.locator('[data-action="expense-save"]').first().click();
 await page.waitForTimeout(140);
 const after=await db(),updated=after.expenses.find(x=>x.id===old.id);
 assert(updated?.document_id&&updated.document_id!==previousId,'No se sustituyó el justificante anterior');
 assert(!after.documents.some(d=>d.id===previousId),'Quedó registro documental huérfano de la factura antigua');
 assert(after.documents.some(d=>d.id===updated.document_id&&d.original_name==='documento-actualizado.pdf'),'No se conservó la factura nueva');
 await page.locator('[data-action="expense-document-preview"]').first().click();
 await page.locator('#modalHost .document-frame').waitFor({state:'visible'});
 await page.locator('#modalHost .close-btn').click();
 const ready=page.waitForEvent('download');
 await page.locator('[data-action="expense-document-download"]').first().click();
 const dl=await ready;
 assert(dl.suggestedFilename()==='documento-actualizado.pdf','Se descarga el justificante antiguo');
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
await check('Facturación externa: archivo PDF original obligatorio y vinculado',async()=>{
 await nav('facturacion');
 if(await page.locator('[data-action="invoice-back"]').count())await page.locator('[data-action="invoice-back"]').first().click();
 await page.locator('[data-action="external-invoice-new"]').click();
 await page.locator('#ivExternalNumber').fill('EXT-0092');
 await page.locator('#ivCustomer').fill('Cliente externo simulado');
 await page.locator('#ivDesc_0').fill('Factura de prueba externa');
 await page.locator('#ivUnit_0').fill('80,00');
 const pdf=await PDFDocument.create();pdf.addPage([300,200]);
 await page.locator('#ivSourceFile').setInputFiles({name:'original-externa.pdf',mimeType:'application/pdf',buffer:Buffer.from(await pdf.save())});
 await page.locator('[data-action="invoice-save"]').click();
 await page.waitForTimeout(120);
 const snap=await db();
 assert(snap.invoices.some(x=>x.origin==='externa'&&x.source_document_id),'Factura externa sin documento original vinculado');
 assert(snap.documents.some(x=>x.original_name==='original-externa.pdf'),'No se archivó el justificante de factura externa');
});
await check('Proforma: emisión, conversión a factura y líneas sin duplicación',async()=>{
 await nav('facturacion');
 if(await page.locator('[data-action="invoice-back"]').count())await page.locator('[data-action="invoice-back"]').first().click();
 await page.locator('[data-action="proforma-new"]').first().click();
 await page.locator('#ivCustomer').fill('Cliente proforma QA');
 await page.locator('#ivDesc_0').fill('Producto test proforma');
 await page.locator('#ivQty_0').fill('3');
 await page.locator('#ivUnit_0').fill('10,00');
 await page.locator('[data-action="invoice-save"]').first().click();
 await page.waitForTimeout(140);
 const list1=(await db()).invoices;
 const proforma=list1.find(x=>x.document_type==='proforma'&&x.customer_name==='Cliente proforma QA');
 assert(proforma?.status==='borrador','La proforma no se guardó como borrador');
 await page.locator('[data-action="invoice-finalize"]').first().click();
 await page.waitForTimeout(140);
 const now=(await db()).invoices.find(x=>x.id===proforma.id);
 assert(now.status==='emitida'&&now.display_number.startsWith('PH-'),'Proforma no emitida con su numeración');
 await page.locator('[data-action="proforma-convert"]').first().click();
 await page.waitForTimeout(140);
 const list2=(await db()).invoices;
 const newInvoice=list2.find(x=>x.source_proforma_document_id===proforma.id);
 assert(newInvoice?.status==='borrador'&&newInvoice.document_type==='factura','La conversión no creó borrador de factura');
 assert(list2.find(x=>x.id===proforma.id).status==='convertida','La proforma de origen no quedó marcada como convertida');
 const lines=await page.evaluate(id=>window.__mockDb.ops_sales_invoice_lines.filter(x=>x.invoice_id===id),newInvoice.id);
 assert(lines.length===1&&lines[0].description==='Producto test proforma'&&lines[0].quantity===3,'La factura convertida perdió sus conceptos o cantidades');
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
 assert(d.documents.some(x=>x.original_name==='factura-qa.txt'),'Documento no archivado');
 assert(d.uploads>=1,'Archivo no subido a storage simulado');
 assert(d.documents.some(x=>x.original_name==='factura-qa.txt'),'Nombre de archivo erróneo');
 await page.locator('[data-action="document-preview"]').first().click();
 await page.locator('#modalHost .text-preview').waitFor({state:'visible'});
 assert((await page.locator('#modalHost .text-preview').innerText()).includes('Importe: 121 euros'),'El texto de la factura no aparece en vista previa');
 await page.locator('#modalHost .close-btn').click();
 const download=page.waitForEvent('download');
 await page.locator('[data-action="document-download"]').first().click();
 const actualDownload=await download;
 assert(actualDownload.suggestedFilename()==='factura-qa.txt','El fichero descargado tiene otro nombre');
});
await check('Documentos: importación ZIP por lote, vista previa y sin duplicados',async()=>{
 await nav('documentos');
 if(await page.locator('[data-action="document-back"]').count())await page.locator('[data-action="document-back"]').first().click();
 const zipped=new JSZip();
 zipped.file('Febrero 2026/Proveedor X 12-2-2026.pdf',Buffer.from('%PDF-1.4\\n1 0 obj\\n<<>>\\nendobj\\n%%EOF'));
 zipped.file('Marzo 2026/Proveedor Y.pdf',Buffer.from('%PDF-1.4\\n1 0 obj\\n<<>>\\nendobj\\n%%EOF'));
 const zipBook=xlsx.utils.book_new();xlsx.utils.book_append_sheet(zipBook,xlsx.utils.aoa_to_sheet([['Concepto','Euros'],['Prueba',1]]),'Datos');
 zipped.file('Informes/Libro referencia.xlsx',Buffer.from(xlsx.write(zipBook,{bookType:'xlsx',type:'buffer'})));
 zipped.file('Informes/Resumen.docx',Buffer.from('Documento Word de prueba'));
 const buffer=await zipped.generateAsync({type:'nodebuffer'});
 const before=(await db()).documents.length;
 await page.locator('#documentBulkZip').setInputFiles({name:'facturas-staging.zip',mimeType:'application/zip',buffer});
 await page.waitForFunction(n=>window.__mockDb.ops_documents.length>=n+4,before,{timeout:12000});
 await page.waitForTimeout(250);
 const docs=(await db()).documents;
 assert(docs.length===before+4,'La importación ZIP no registró los cuatro formatos del lote');
 assert(docs.filter(x=>x.original_name.endsWith('.pdf')).slice(-2).every(x=>x.status==='pendiente'),'Los PDF deben estar pendientes de conciliar');
 assert(docs.some(x=>x.original_name==='Proveedor X 12-2-2026.pdf'),'El nombre original se ha perdido');
 await nav('documentos');
 await page.locator('#documentBulkZip').setInputFiles({name:'facturas-staging.zip',mimeType:'application/zip',buffer});
 await page.waitForTimeout(300);
 assert((await db()).documents.length===before+4,'Se duplicaron PDF al reimportar el ZIP');
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
 assert((await db()).documents.some(x=>x.original_name==='qa-factura.xlsx'),'El Excel no quedó guardado');
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
await check('Documentos PDF: subir, mostrar y descargar',async()=>{
 await nav('documentos');
 if(await page.locator('[data-action="document-back"]').count())await page.locator('[data-action="document-back"]').first().click();
 await page.locator('[data-action="document-new"]').click();
 const pdf=await PDFDocument.create();pdf.addPage([350,240]);
 const buffer=Buffer.from(await pdf.save());
 await page.locator('#docFile').setInputFiles({name:'factura-simulada.pdf',mimeType:'application/pdf',buffer});
 await page.locator('#docParty').fill('Proveedor PDF QA');
 await page.locator('[data-action="document-save"]').click();
 await page.waitForTimeout(100);
 assert((await db()).documents.some(x=>x.original_name==='factura-simulada.pdf'),'No se ha guardado el PDF');
 await page.locator('[data-action="document-preview"]').first().click();
 await page.locator('#modalHost .document-frame').waitFor({state:'visible'});
 await page.locator('#modalHost .close-btn').click();
 const ready=page.waitForEvent('download');
 await page.locator('[data-action="document-download"]').first().click();
 assert((await ready).suggestedFilename()==='factura-simulada.pdf','Descarga PDF incorrecta');
});
await check('Descarga conjunta de documentos archivados',async()=>{
 await nav('documentos');
 if(await page.locator('[data-action="document-back"]').count())await page.locator('[data-action="document-back"]').first().click();
 const promise=page.waitForEvent('download',{timeout:5000});
 await page.locator('[data-action="documents-zip"]').click();
 const exportFile=await promise;
 assert(exportFile.suggestedFilename().endsWith('.zip'),'La descarga conjunta debe ser ZIP');
});
await check('Documentos homónimos: dos subidas y descarga ZIP sin sobrescrituras',async()=>{
 await nav('documentos');
 if(await page.locator('[data-action="document-back"]').count())await page.locator('[data-action="document-back"]').first().click();
 for(const i of [1,2]){
  await page.locator('[data-action="document-new"]').click();
  await page.locator('#docParty').fill('Proveedor homonimo');
  await page.locator('#docDate').fill('2026-10-10');
  await page.locator('#docFile').setInputFiles({name:'justificante-repetido.txt',mimeType:'text/plain',buffer:Buffer.from('JUSTIFICANTE DISTINTO QA '+i)});
  await page.locator('[data-action="document-save"]').click();
  await page.waitForTimeout(120);
  await page.locator('[data-action="document-back"]').first().click();
 }
 const repeated=(await db()).documents.filter(d=>d.original_name==='justificante-repetido.txt');
 assert(repeated.length===2,'No se guardaron dos documentos homónimos');
 assert(repeated[0].id!==repeated[1].id&&repeated[0].storage_path!==repeated[1].storage_path,'Documentos homónimos colisionan en Storage');
 const started=page.waitForEvent('download',{timeout:12000});
 await page.locator('[data-action="documents-zip"]').first().click();
 const exported=await started;
 const zip=await JSZip.loadAsync(await fs.readFile(await exported.path()));
 const entries=Object.keys(zip.files).filter(n=>n.endsWith('_justificante-repetido.txt'));
 assert(entries.length===2,'La descarga ZIP filtrada ha perdido un justificante por nombre repetido');
 const bodies=await Promise.all(entries.map(n=>zip.file(n).async('string')));
 assert(bodies.includes('JUSTIFICANTE DISTINTO QA 1')&&bodies.includes('JUSTIFICANTE DISTINTO QA 2'),'No se conservaron los dos contenidos distintos');
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
 await page.locator('[data-action="user-edit"][data-email="empleado-qa@example.com"]').click();
 await page.locator('[data-action="user-delete"]').click();
 await page.waitForTimeout(100);
 assert(!(await db()).team.some(x=>x.email==='empleado-qa@example.com'),'No se eliminó el usuario de prueba');

});
await check('Navegación de todas las pestañas tras operaciones',async()=>{
 for(const route of ['inicio','pricing','cajas','gastos','facturacion','documentos','fiscalidad','informes','administracion']){
  await nav(route);
  const t=(await page.locator('#content').innerText()).trim();
  assert(t.length>20,route+' está vacía');
 }
});
await check('Descargas desde los botones reales de Cajas, Gastos e Informes',async()=>{
 for(const [route,action,expected] of [
  ['cajas','export-closings-current','.xlsx'],
  ['gastos','export-expenses-current','.xlsx'],
  ['informes','export-summary','.xlsx'],
  ['informes','export-gestor-book','.xlsx']
 ]){
  await nav(route);
  if(route==='cajas'&&await page.locator('[data-action="closing-back"]').count())await page.locator('[data-action="closing-back"]').first().click();
  if(route==='gastos'&&await page.locator('[data-action="expense-back"]').count())await page.locator('[data-action="expense-back"]').first().click();
  const started=page.waitForEvent('download',{timeout:7000});
  await page.locator('[data-action="'+action+'"]').first().click();
  const exported=await started;
  assert(exported.suggestedFilename().endsWith(expected),'Descarga incorrecta de '+route+': '+exported.suggestedFilename());
  if(action==='export-summary'){
   const wb=xlsx.read(await fs.readFile(await exported.path()),{type:'buffer',cellStyles:true});
   const summary=wb.Sheets.Resumen,byStore=wb.Sheets['Por tienda'];
   assert(summary?.A12?.v==='Resultado real','El resumen no refleja el resultado en su posición original');
   assert(Number.isFinite(summary?.B12?.v),'El resultado del resumen no es un importe válido');
   assert(Math.abs(summary.B8.v-summary.B9.v-summary.B10.v-summary.B12.v)<0.011,'Ingresos - gastos no coincide con resultado');
   assert(byStore?.A1?.v==='Tienda'&&byStore?.E1?.v==='Resultado','La hoja por tienda no contiene todas las columnas');
  }
 }
});
await check('Pricing: guardar consulta con histórico y producto independiente',async()=>{
 await nav('pricing');
 await page.locator('#pqQuery').fill('Líquido de prueba QA');
 await page.locator('#pqCost').fill('2,50');
 await page.locator('#pqPvp').fill('6,30');
 await page.locator('[data-action="consultation-save"]').click();
 await page.waitForTimeout(100);
 const history=await page.evaluate(()=>({consultations:window.__mockDb.consultations,actions:window.__mockDb.consultation_history}));
 assert(history.consultations.length===1&&history.actions.length===1,'La consulta no guardó su histórico');
 await page.locator('[data-action="product-new"]').first().click();
 await page.locator('#prSku').fill('SKU-QA-001');
 await page.locator('#prName').fill('Producto de prueba independiente');
 await page.locator('#prPvp').fill('6,30');
 await page.locator('[data-action="product-save"]').click();
 await page.waitForTimeout(100);
 const products=await page.evaluate(()=>window.__mockDb.products);
 assert(products.some(x=>x.sku==='SKU-QA-001'),'Producto sin guardar');
});
await check('Fiscalidad: alta y edición de ajuste fiscal',async()=>{
 await nav('fiscalidad');
 await page.locator('[data-action="fiscal-adjustment-new"]').first().click();
 await page.locator('#faDescription').fill('Regularización simulada');
 await page.locator('#faAmount').fill('25,50');
 await page.locator('#faKind').selectOption('ingreso_extra');
 await page.locator('[data-action="fiscal-adjustment-save"]').click();
 await page.waitForTimeout(100);
 const values=await page.evaluate(()=>window.__mockDb.ops_fiscal_adjustments);
 assert(values.some(x=>x.description==='Regularización simulada'&&Math.abs(x.amount-25.5)<.001),'Ajuste fiscal no guardado');
});
await check('Backup integral: descarga de base de datos y archivos simulados',async()=>{
 await nav('administracion');
 const section=page.locator('[data-action="admin-section"][data-section="backups"]');
 if(await section.count())await section.first().click();
 const filePromise=page.waitForEvent('download',{timeout:15000});
 await page.locator('[data-action="backup-create"]').click();
 const exported=await filePromise;
 assert(exported.suggestedFilename().endsWith('.totusbackup'),'La copia no tiene formato .totusbackup');
});
await check('Paquete gestor ZIP: ambos Excel, CSV conciliados y facturas PDF originales',async()=>{
 await page.evaluate(async()=>{
  const row={id:crypto.randomUUID(),store_id:null,income_date:'2026-10-10',amount:31.40,concept:'Ingreso extra simulado para conciliación'};
  window.__mockDb.ops_income_adjustments.push(row);
  const state=(await import('../src/state.js')).state;
  state.data.incomeAdjustments.push(row);
 });
 await nav('informes');
 const ready=page.waitForEvent('download',{timeout:12000});
 await page.locator('[data-action="export-gestor-package"]').first().click();
 const download=await ready;
 assert(download.suggestedFilename()==='Paquete_gestor_2026.zip','El paquete del gestor no tiene el nombre anual correcto');
 const archive=await JSZip.loadAsync(await fs.readFile(await download.path()));
 const names=Object.keys(archive.files);
 for(const required of ['01_INGRESOS/Ingresos_2026.csv','02_GASTOS/Libros_gestor_y_auditoria_2026_Totus.xlsx','03_DIARIOS/Gastos y ventas Hortimatic 2026.xlsx','03_DIARIOS/Gastos y ventas NewOldSmok 2026.xlsx','04_RESUMEN/Resumen_2026.csv']){
  assert(!!archive.file(required),'Falta fichero del gestor: '+required);
 }
 assert(names.some(x=>x.endsWith('/justificante-test.pdf')),'No se incluyó la factura PDF original de gastos en el ZIP');
 const workbook= xlsx.read(await archive.file('02_GASTOS/Libros_gestor_y_auditoria_2026_Totus.xlsx').async('nodebuffer'),{type:'buffer',cellFormula:true,cellStyles:true});
 for(const quarter of [1,2,3,4]){
  assert(workbook.SheetNames.includes('Libro gestor '+quarter+'T'),'Falta el libro fiscal del trimestre '+quarter);
  assert(workbook.SheetNames.includes('Conciliación '+quarter+'T'),'Falta la conciliación del trimestre '+quarter);
 }
 assert(workbook.SheetNames.includes('Auditoría gestor'),'Falta la hoja de auditoría para gestoría');
 for(const sheet of workbook.SheetNames.filter(n=>n.startsWith('Libro gestor '))){
  const cells=xlsx.utils.sheet_to_json(workbook.Sheets[sheet],{header:1,defval:''});
  assert(!cells.flat().some(x=>String(x).includes('Horas extra QA')),'Gasto interno enviado erróneamente a fiscalidad');
 }
 for(const name of ['Hortimatic','Newoldsmok']){
  const p='03_DIARIOS/Gastos y ventas '+(name==='Hortimatic'?name:'NewOldSmok')+' 2026.xlsx';
  const book=xlsx.read(await archive.file(p).async('nodebuffer'),{type:'buffer',cellFormula:true,cellStyles:true});
  assert(book.SheetNames.length===12&&book.SheetNames[0]==='Enero'&&book.SheetNames[11]==='Diciembre','El libro de '+name+' perdió hojas mensuales');
  const monthly=book.Sheets.Septiembre;
  assert(monthly&&Object.values(monthly).some(cell=>cell?.f&&String(cell.f).includes('SUM(')),'Faltan fórmulas en el libro de '+name);
 }

 const index=archive.file('05_DOCUMENTOS/Indice_documentos_2026.csv');
 assert(index,'El paquete no incluye el índice de documentos');
 const indexText=await index.async('string');
 const docs2026=(await db()).documents.filter(d=>String(d.document_date||d.created_at).startsWith('2026'));
 assert(indexText.trim().split(/\r?\n/).length===docs2026.length+1,'El índice no contiene una fila por documento');
 const colliding=names.filter(x=>x.startsWith('05_DOCUMENTOS/factura_recibida/Proveedor_homonimo/')&&x.includes('justificante-repetido')&&x.endsWith('.txt'));
 assert(colliding.length===2,'El paquete de gestoría sobrescribió uno de los documentos homónimos');
 const content=await Promise.all(colliding.map(n=>archive.file(n).async('string')));
 assert(content.includes('JUSTIFICANTE DISTINTO QA 1')&&content.includes('JUSTIFICANTE DISTINTO QA 2'),'El paquete gestor no conserva los originales íntegros');

 const summary=await archive.file('04_RESUMEN/Resumen_2026.csv').async('string');
 const incomes=await archive.file('01_INGRESOS/Ingresos_2026.csv').async('string');
 const declared=Number(summary.match(/Ventas;([\d.]+)/)?.[1]);
 const rows=incomes.trim().split(/\r?\n/).slice(1);
 const included=rows.reduce((sum,line)=>sum+Number((line.split(';')[3]||'0').replaceAll('"','')),0);
 assert(Number.isFinite(declared)&&Math.abs(declared-included)<.02,'El resumen del ZIP y sus ingresos detallados no cuadran');
});
await check('Roles: gerente y encargado con permisos de navegación',async()=>{
 for(const [role,adminVisible] of [['gerente',true],['encargado',false]]){
  const rolePage=await browser.newPage({locale:'es-ES',viewport:{width:390,height:844}});
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
await check('Roles personalizados: crear, asignar permisos, editar, listar en usuarios y eliminar',async()=>{
 await nav('administracion');
 await page.locator('[data-action="admin-section"][data-section="roles"]').first().click();
 await page.locator('[data-action="role-new"]').click();
 await page.locator('#roleName').fill('Personal de almacén');
 const newCode=await page.locator('#roleCode').inputValue();
 assert(newCode==='personal_de_almacen','El código no se normaliza correctamente: '+newCode);
 await page.locator('#roleTemplate').selectOption('read');
 await page.locator('[data-action="role-save"]').click();
 await page.waitForTimeout(160);
 const initial=await page.evaluate(()=>({roles:window.__mockDb.ops_roles,rights:window.__mockDb.ops_role_permissions}));
 assert(initial.roles.some(x=>x.code===newCode),'El rol no está guardado');
 assert(initial.rights.filter(x=>x.role===newCode).length===9,'La plantilla debe guardar 9 módulos');
 await page.locator('[data-action="role-permissions"][data-role="'+newCode+'"]').click();
 assert((await page.locator('[id^="roleperm_"]').count())===45,'No se muestran los permisos por módulo');
 await page.locator('#roleBulkPreset').selectOption('work');
 await page.locator('[data-action="role-bulk-apply"]').click();
 assert(await page.locator('#roleperm_gastos_create').isChecked(),'La plantilla de operativa no activa Crear');
 assert(!(await page.locator('#roleperm_administracion_view').isChecked()),'Un rol personalizado no recibe acceso administrativo');
 await page.locator('[data-action="role-permissions-save"]').click();
 await page.waitForTimeout(160);
 await page.locator('[data-action="role-rename"][data-role="'+newCode+'"]').click();
 await page.locator('#roleName').fill('Apoyo y almacén');
 await page.locator('[data-action="role-save"]').click();
 await page.waitForTimeout(150);
 assert((await page.evaluate(code=>window.__mockDb.ops_roles.find(r=>r.code===code)?.name,newCode))==='Apoyo y almacén','No se renombró');
 await page.locator('[data-action="admin-section"][data-section="usuarios"]').first().click();
 await page.locator('[data-action="user-new"]').click();
 assert(await page.locator('#usRole option[value="'+newCode+'"]').count()===1,'El rol no se ofrece al crear usuario');
 await page.locator('#modalHost .close-btn').click();
 await page.locator('[data-action="admin-section"][data-section="roles"]').first().click();
 await page.locator('[data-action="role-delete"][data-role="'+newCode+'"]').click();
 await page.waitForTimeout(150);
 assert(!(await page.evaluate(code=>window.__mockDb.ops_roles.some(r=>r.code===code),newCode)),'No se eliminó el rol vacío');
 assert(await page.locator('[data-action="role-delete"][data-role="admin"]').count()===0,'El administrador no es eliminable');
});
await browser.close();
if(errors.length){console.error('E2E MOCK QA FALLÓ\n- '+errors.join('\n- '));process.exit(1)}
console.log('E2E MOCK QA: operaciones y pestañas correctas');
