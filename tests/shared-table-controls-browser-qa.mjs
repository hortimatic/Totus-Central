import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,channel:process.platform==='win32'?'msedge':undefined});
try{
 const shared=await fs.readFile('src/column-settings.js','utf8');const source=(await fs.readFile('src/shared-table-controls.js','utf8')).replace("'./column-settings.js'",JSON.stringify('data:text/javascript;base64,'+Buffer.from(shared).toString('base64')));
 for(const width of [390,1016,1920]){
  const page=await browser.newPage({viewport:{width,height:700},reducedMotion:'reduce'});
  await page.setContent('<style>.table-wrap{width:100%;overflow:auto}table{width:2400px}td{width:400px}</style><section><div class="table-wrap"><table><tr><td>A</td><td>B</td><td>C</td><td>D</td><td>E</td><td>F</td></tr></table></div></section>');
  await page.evaluate(async encoded=>{const module=await import('data:text/javascript;base64,'+encoded);window.stopArrows=module.installSharedTableArrows();},Buffer.from(source).toString('base64'));
  const left=page.getByRole('button',{name:'Recorrer columnas hacia la izquierda'}),right=page.getByRole('button',{name:'Recorrer columnas hacia la derecha'});
  assert.equal(await left.isDisabled(),true);await right.click();await page.waitForFunction(()=>document.querySelector('.table-wrap').scrollLeft>100&&!document.querySelector('[data-tc-table-action=left]').disabled);assert.equal(await left.isDisabled(),false);
  await left.click();await page.waitForFunction(()=>document.querySelector('.table-wrap').scrollLeft===0);
  await page.evaluate(()=>document.querySelector('table').style.width='100%');await page.locator('.tc-table-arrows').waitFor({state:'hidden'});
  await page.evaluate(()=>window.stopArrows());assert.equal(await page.locator('.tc-table-arrows').count(),0);await page.close();
 }
 const page=await browser.newPage();
 await page.route('https://qa.example.invalid/**',route=>route.fulfill({contentType:'text/html',body:'<section><div class="table-wrap"><table class="data-table"><thead><tr><th>Nombre</th><th>Precio</th><th>Estado</th></tr></thead><tbody><tr><td>Ficticio</td><td>5</td><td>Activo</td></tr></tbody></table></div></section>'}));
 const install=()=>page.evaluate(async encoded=>{const module=await import('data:text/javascript;base64,'+encoded);window.stopArrows=module.installSharedTableArrows(document,{owner:()=>window.qaOwner||'actor-A'});},Buffer.from(source).toString('base64'));
 await page.goto('https://qa.example.invalid/?module=prueba');await install();await page.getByLabel('Configurar columnas',{exact:true}).click();
 await page.getByLabel('Precio',{exact:true}).uncheck();await page.getByLabel('Posición de Estado').selectOption('0');assert.equal(await page.getByRole('button',{name:'Subir Estado',exact:true}).isDisabled(),true);await page.getByRole('button',{name:'Subir Nombre',exact:true}).click();assert.deepEqual(await page.locator('thead th:visible').allTextContents(),['Nombre','Estado']);await page.getByRole('button',{name:'Mover Estado',exact:true}).press('Alt+ArrowUp');assert.deepEqual(await page.locator('thead th:visible').allTextContents(),['Estado','Nombre']);
 assert.deepEqual(await page.locator('thead th:visible').allTextContents(),['Estado','Nombre']);await page.getByLabel('Nombre de vista',{exact:true}).fill('Mi vista');await page.getByRole('button',{name:'Guardar vista personal',exact:true}).click();
 await page.reload();await install();assert.deepEqual(await page.locator('thead th:visible').allTextContents(),['Estado','Nombre']);await page.getByLabel('Configurar columnas',{exact:true}).click();await page.getByRole('button',{name:'Restablecer columnas',exact:true}).click();await page.getByLabel('Vista guardada',{exact:true}).selectOption('Mi vista');assert.deepEqual(await page.locator('thead th:visible').allTextContents(),['Estado','Nombre']);await page.getByRole('button',{name:'Restablecer columnas',exact:true}).click();assert.deepEqual(await page.locator('thead th:visible').allTextContents(),['Nombre','Precio','Estado']);
 await page.reload();await page.evaluate(()=>window.qaOwner='actor-B');await install();assert.deepEqual(await page.locator('thead th:visible').allTextContents(),['Nombre','Precio','Estado']);
 await page.goto('https://qa.example.invalid/gastos');await install();await page.getByLabel('Configurar columnas',{exact:true}).click();await page.getByLabel('Precio',{exact:true}).uncheck();await page.getByRole('button',{name:'Guardar distribución',exact:true}).click();
 await page.goto('https://qa.example.invalid/cajas');await install();assert.deepEqual(await page.locator('thead th:visible').allTextContents(),['Nombre','Precio','Estado'],'Clean routes keep separate table layouts');
 await page.goto('https://qa.example.invalid/gastos');await install();assert.deepEqual(await page.locator('thead th:visible').allTextContents(),['Nombre','Estado'],'Clean route layout survives navigation');
 await page.close();
 const preview=await browser.newPage();
 await preview.setContent('<article class="invoice-preview"><div class="table-wrap"><table class="data-table"><thead><tr><th>Concepto</th><th>Total</th></tr></thead><tbody><tr><td>Ejemplo</td><td>121</td></tr></tbody></table></div></article>');
 await preview.evaluate(async encoded=>{const module=await import('data:text/javascript;base64,'+encoded);window.stopPreviewTools=module.installSharedTableArrows(document,{owner:()=> 'actor-A'});},Buffer.from(source).toString('base64'));
 await preview.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert.equal(await preview.locator('.tc-table-tools,.tc-table-arrows').count(),0);assert.deepEqual(await preview.locator('thead th').allTextContents(),['Concepto','Total']);await preview.close();
 console.log('Shared controls: three widths, movement, boundaries, resize, persistent columns, account isolation, static invoice exclusion and disposal passed.');
}finally{await browser.close();}
