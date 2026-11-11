import assert from 'node:assert/strict';
import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer();
const {chromium}=await import(process.env.TOTUS_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.TOTUS_BROWSER_CHANNEL?{channel:process.env.TOTUS_BROWSER_CHANNEL}:{})});
try{
 for(const width of [390,768,1440]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:4173/tests/chat-harness.html');
  const values=await page.evaluate(async()=>{
   const sources=['styles.css','appearance.css','stitch-design.css','home-widgets.css','productos.css'];
   for(const source of sources){const link=document.createElement('link');link.rel='stylesheet';link.href='../src/'+source;document.head.append(link);await new Promise((ok,fail)=>{link.onload=ok;link.onerror=fail;});}
   const {appearanceVariables}=await import('../src/appearance-core.js');
   const settings={
    theme:'dark',bg:'#071020',surface:'#182238',card:'#1b293b',text:'#eeeeee',muted:'#b8c8db',
    headingText:'#fedcba',labelText:'#bbccee',topbarBackground:'#112233',topbarText:'#ffffff',
    inputBackground:'#24364a',inputText:'#ffeedd',tableHeadBackground:'#334455',
    tableHeadText:'#ffffcc',tableRowBackground:'#222f40',secondaryButtonBackground:'#445566',
    secondaryButtonText:'#fcfcff',noteBackground:'#172e4c',noteText:'#bedfff',
    filterBackground:'#0d2937',modalBackground:'#1a3848'
   };
   const root=document.documentElement;root.dataset.appearance='dark';
   for(const [key,value] of Object.entries(appearanceVariables(settings)))root.style.setProperty(key,value);
   const fixture=document.createElement('div');fixture.id='app';
   fixture.innerHTML='<header class="topbar"><h1>Cabecera</h1></header><div class="card"><h3>Título de tarjeta</h3><div class="field"><label>Etiqueta</label><input value="Valor"></div><table class="data-table"><thead><tr><th>Encabezado</th></tr></thead><tbody><tr><td>Fila</td></tr></tbody></table><button class="btn secondary">Botón</button><div class="note">Nota neutra</div><div class="filters">Filtros</div><div class="modal">Ventana</div><section class="home-widget-header"><h3>Inicio</h3></section><table class="home-orders-table"><thead><tr><th>Pedidos</th></tr></thead></table><div id="productosRoot"><div class="prd-stitch"><h3>Producto</h3><div class="prd-fields"><label>Referencia</label><input value="PR-001"></div><table class="prd-catalog-table"><thead><tr><th>Nombre</th></tr></thead><tbody><tr><td>Producto ficticio</td></tr></tbody></table></div></div></div>';
   document.body.append(fixture);
   const color=selector=>{const style=getComputedStyle(fixture.querySelector(selector));return {text:style.color,bg:style.backgroundColor};};
   return Object.fromEntries(['.topbar','.topbar h1','.card h3','.field label','.field input','.data-table th','.data-table td','.btn.secondary','.note','.filters','.modal','.home-widget-header h3','.home-orders-table th','#productosRoot .prd-stitch h3','#productosRoot .prd-fields input','#productosRoot .prd-catalog-table th'].map(selector=>[selector,color(selector)]));
  });
  assert.equal(values['.topbar'].bg,'rgb(17, 34, 51)','Header background');
  assert.equal(values['.topbar h1'].text,'rgb(255, 255, 255)','Header text');
  assert.equal(values['.card h3'].text,'rgb(254, 220, 186)','Heading text');
  assert.equal(values['.field label'].text,'rgb(187, 204, 238)','Form label');
  assert.equal(values['.field input'].bg,'rgb(36, 54, 74)','Input background');
  assert.equal(values['.field input'].text,'rgb(255, 238, 221)','Input text');
  assert.equal(values['.data-table th'].bg,'rgb(51, 68, 85)','Table heading background');
  assert.equal(values['.data-table th'].text,'rgb(255, 255, 204)','Table heading text');
  assert.equal(values['.data-table td'].bg,'rgb(34, 47, 64)','Table cell background');
  assert.equal(values['.btn.secondary'].bg,'rgb(68, 85, 102)','Secondary button');
  assert.equal(values['.btn.secondary'].text,'rgb(252, 252, 255)','Secondary button text');
  assert.equal(values['.note'].bg,'rgb(23, 46, 76)','Notice background');
  assert.equal(values['.note'].text,'rgb(190, 223, 255)','Notice text');
  assert.equal(values['.filters'].bg,'rgb(13, 41, 55)','Filter box');
  assert.equal(values['.modal'].bg,'rgb(26, 56, 72)','Modal box');
  assert.equal(values['.home-widget-header h3'].text,'rgb(254, 220, 186)','Inicio widget heading');
  assert.equal(values['.home-orders-table th'].bg,'rgb(51, 68, 85)','Inicio table header');
  assert.equal(values['#productosRoot .prd-stitch h3'].text,'rgb(254, 220, 186)','Productos headings');
  assert.equal(values['#productosRoot .prd-fields input'].bg,'rgb(36, 54, 74)','Productos input box');
  assert.equal(values['#productosRoot .prd-catalog-table th'].bg,'rgb(51, 68, 85)','Productos table heading');
  assert.deepEqual(errors,[]);
  await page.close();
 }
 console.log('Independent text and box colors: actual CSS cascade at 390/768/1440px PASS');
}finally{await browser.close();await server?.close();}
