import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {startLocalServer} from './local-static-server.mjs';

const server=await startLocalServer();
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:960},locale:'es-ES'});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('dialog',dialog=>dialog.accept());
try{
 const source=fs.readFileSync('tests/mock-supabase.js','utf8');
 const marker='const rpc=async (name,args={})=>{';
 assert(source.includes(marker),'El mock debe exponer el contrato RPC conocido');
 const pref=`const __homePrefs={revision:0,layout:null};
 window.__homePrefs=__homePrefs;
 const rpc=async (name,args={})=>{
  if(name==='totus_home_dashboard'){
   if(args.p_action==='read')return {data:{...__homePrefs},error:null};
   if(args.p_action==='save'&&args.p_expected_revision===__homePrefs.revision){
    __homePrefs.revision++;__homePrefs.layout=args.p_layout;
    return {data:{...__homePrefs},error:null};
   }
   return {data:null,error:{message:'Revisión de Inicio obsoleta'}};
  }`;
 await page.route('**/tests/mock-supabase.js',route=>route.fulfill({contentType:'text/javascript',body:source.replace(marker,pref)}));
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await page.locator('[data-home-widget="opening"]').waitFor({timeout:25000});
 assert.equal(await page.locator('[data-home-type="prestashop.summary"]').count(),2,'Dos resúmenes separados');
 assert.equal(await page.locator('.dashboard-hero [data-action="closing-new"]').count(),1,'Mantiene la acción original de nuevo cierre en su cabecera');
 assert.equal(await page.locator('[data-home-widget="activity"] svg').count(),1,'Mantiene la gráfica y sus funciones');
 const cash=await page.locator('[data-home-widget="opening"]').innerText();
 for(const label of ['Vape','Head','NewOldSmok'])assert(cash.includes(label),'Conserva la caja '+label);
 for(const width of [320,390,768,1024,1440,1920]){
  await page.setViewportSize({width,height:960});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
  assert.equal(overflow,false,'La página no desborda a '+width+' px');
 }
 await page.setViewportSize({width:1440,height:960});
 await page.locator('[data-home-command="edit"]').click();
 await page.locator('[data-home-command="select"][data-id="shop-h"]').click();
 await page.locator('[data-home-config="width"]').selectOption('8');
 assert((await page.locator('[data-home-widget="shop-h"]').getAttribute('style')).includes('--span: 8'),'El tamaño cambia a 8 columnas');
 await page.locator('[data-home-config="tabletWidth"]').selectOption('4');
 await page.locator('[data-home-config="tabletHeight"]').selectOption('6');
 await page.locator('[data-home-config="mobileHeight"]').selectOption('7');
 await page.setViewportSize({width:768,height:900});
 assert((await page.locator('[data-home-widget="shop-h"]').getAttribute('style')).includes('--tablet-span: 4'),'Anchura tablet independiente');
 const tabletBox=await page.locator('[data-home-widget="shop-h"]').boundingBox();
 assert(tabletBox?.height>=410&&tabletBox.height<=445,'La altura tablet debe ajustarse a seis unidades');
 await page.setViewportSize({width:390,height:900});
 assert((await page.locator('[data-home-widget="shop-h"]').getAttribute('style')).includes('--mobile-height: 7'),'Altura móvil independiente');
 await page.locator('[data-home-resize="shop-h"]').focus();
 await page.locator('[data-home-resize="shop-h"]').press('ArrowUp');
 assert((await page.locator('[data-home-widget="shop-h"]').getAttribute('style')).includes('--mobile-height: 6'),'Las teclas ajustan la altura móvil');
 await page.setViewportSize({width:1440,height:960});
 assert((await page.locator('[data-home-widget="shop-h"]').getAttribute('style')).includes('--span: 8'),'La edición móvil no altera la anchura de escritorio');

 await page.locator('[data-home-command="duplicate"]').click();
 assert.equal(await page.locator('[data-home-type="prestashop.summary"]').count(),3,'Duplicación de instancia');
 await page.locator('[data-home-command="hide"]').click();
 await page.locator('.home-hidden-widgets summary').click();
 await page.locator('[data-home-command="show"]').last().click();
 assert.equal(await page.locator('[data-home-type="prestashop.summary"]').count(),3,'Recuperación de ocultos');
 await page.evaluate(async()=>{
  const {state}=await import('../src/state.js');
  const row={id:'qa-fiscal-review',store_id:window.__mockDb.ops_stores[0].id,expense_date:'2026-11-10',supplier_name:'Proveedor pendiente fiscal QA',description:'Documento con revisión fiscal pendiente',fiscal_reviewed:false,management_only:false,paid_status:'pagado',accounting_amount:18,gross_expense:18,document_kind:'factura'};
  state.data.expenses.push(row);
  window.__mockDb.ops_expenses.push(row);
 });
 await page.locator('[data-home-command="add"][data-type="expenses.pending"]').click();
 await page.locator('[data-home-type="expenses.pending"]').getByText('1 gastos con revisión fiscal pendiente').waitFor();
 assert((await page.locator('[data-home-type="expenses.pending"]').innerText()).includes('Proveedor pendiente fiscal QA'),'Los gastos pagados también pueden requerir revisión fiscal');
 assert.equal(await page.locator('[data-home-type="expenses.pending"] [data-home-command="open-expense"]').count(),1,'La ficha fiscal permite abrir gasto real');
 await page.locator('[data-home-command="save"]').click();
 await page.waitForFunction(()=>window.__homePrefs?.revision===1);
 assert.equal(await page.locator('[data-home-type="prestashop.summary"]').count(),3);
 await page.locator('#nav [data-route="cajas"]').click();
 await page.locator('#nav [data-route="inicio"]').click();
 await page.waitForFunction(()=>document.querySelectorAll('[data-home-type="prestashop.summary"]').length===3,undefined,{timeout:15000});
 await page.locator('[data-home-type="expenses.pending"] [data-home-command="open-expense"]').click();
 await page.waitForFunction(async()=>{const {state}=await import('../src/state.js');return state.route==='gastos'&&state.views.gastos?.id==='qa-fiscal-review'},undefined,{timeout:18000});

 assert.deepEqual(errors,[],'Sin errores de Javascript');
 console.log('INICIO MODULAR E2E PASS: seis anchos, cajas por tienda, gráfica original, edición, tamaño, duplicación, ocultar/restaurar, guardado simulado y regreso de módulo');
}finally{
 await browser.close();
 if(server)await new Promise(resolve=>server.close(resolve));
}
