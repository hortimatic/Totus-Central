import { chromium } from 'playwright';

const base='http://127.0.0.1:4173';
const cases=[
 ['inicio','?route=inicio'],
 ['pricing','?route=pricing'],
 ['cajas-list','?route=cajas'],
 ['cajas-new','?route=cajas&mode=record&id=new'],
 ['cajas-record','?route=cajas&mode=record&id=cl1'],
 ['gastos-list','?route=gastos'],
 ['gastos-new','?route=gastos&mode=record&id=new'],
 ['gastos-record','?route=gastos&mode=record&id=ex1'],
 ['facturas-list','?route=facturacion'],
 ['factura-new','?route=facturacion&mode=record&id=new&type=factura&kind=invoice&origin=totus'],
 ['rectificativa-new','?route=facturacion&mode=record&id=new&type=factura&kind=rectifying&origin=totus'],
 ['externa-new','?route=facturacion&mode=record&id=new&type=factura&kind=invoice&origin=externa'],
 ['factura-record','?route=facturacion&mode=record&id=iv1'],
 ['documentos-list','?route=documentos'],
 ['documentos-new','?route=documentos&mode=record&id=new'],
 ['documentos-record','?route=documentos&mode=record&id=doc1'],
 ['fiscalidad','?route=fiscalidad'],
 ['informes','?route=informes'],
 ['admin-users','?route=administracion&section=usuarios'],
 ['admin-business','?route=administracion&section=negocio'],
 ['admin-fiscal','?route=administracion&section=fiscal'],
 ['admin-storage','?route=administracion&section=storage'],
 ['admin-backups','?route=administracion&section=backups'],
 ['admin-log','?route=administracion&section=log']
];
const viewports=[
 ['desktop',{width:1440,height:1000}],
 ['mobile',{width:390,height:844}]
];
const browser=await chromium.launch({headless:true});
const errors=[];
for(const [vpName,viewport] of viewports){
 const page=await browser.newPage({viewport});
 const pageErrors=[];
 page.on('pageerror',e=>pageErrors.push('pageerror: '+e.message));
 page.on('console',m=>{if(m.type()==='error')pageErrors.push('console: '+m.text())});
 for(const [name,query] of cases){
   pageErrors.length=0;
   const url=base+'/tests/ui-harness.html'+query;
   const resp=await page.goto(url,{waitUntil:'networkidle'});
   if(!resp||!resp.ok())errors.push(`${vpName}/${name}: HTTP ${resp?.status()}`);
   const text=(await page.locator('#root').innerText()).trim();
   if(text.length<20)errors.push(`${vpName}/${name}: vista vacía`);
   const buttons=await page.locator('button[data-action]').count();
   if(buttons===0&&name!=='inicio')errors.push(`${vpName}/${name}: sin acciones`);
   const bodyBox=await page.locator('body').boundingBox();
   const scrollWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
   if(vpName==='mobile'&&scrollWidth>viewport.width+8){
     const overflow=await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>document.documentElement.clientWidth+8).slice(0,6).map(e=>({tag:e.tagName,cls:e.className,w:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right})));
     const onlyTables=overflow.length&&overflow.every(x=>String(x.cls).includes('data-table')||x.tag==='TABLE'||x.tag==='TD'||x.tag==='TH');
     if(!onlyTables)errors.push(`${vpName}/${name}: desborde horizontal ${scrollWidth}px > ${viewport.width}px ${JSON.stringify(overflow)}`);
   }
   for(const pe of pageErrors)errors.push(`${vpName}/${name}: ${pe}`);
 }
 await page.close();
}

{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errs=[];page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
 await page.goto(base+'/tests/ui-harness.html?route=inicio',{waitUntil:'networkidle'});
 for(const id of ['homePriceQuery','homePriceCost','homePricePvp','homePriceCompetitor','homePriceDiscount']){
   if(await page.locator('#'+id).count()!==1)errors.push('inicio: falta '+id);
 }
 await page.locator('#homePriceQuery').fill('Producto QA');
 await page.locator('#homePriceCost').fill('10');
 await page.locator('#homePricePvp').fill('24,20');
 await page.locator('#homePriceCompetitor').fill('25');
 await page.locator('#homePriceDiscount').fill('10');
 await page.locator('#homePriceDiscount').dispatchEvent('input');
 const mp=(await page.locator('#homePriceMarginPct').innerText()).trim();
 if(!mp.includes('%')||mp==='0,00 %')errors.push('inicio: calculadora rápida no actualiza margen');
 for(const action of ['home-price-save','home-report-quarter','home-report-year','admin-storage-home','admin-users-home']){
   if(await page.locator(`[data-action="${action}"]`).count()!==1)errors.push('inicio: falta acción '+action);
 }
 for(const textNeedle of ['Operativa de hoy','Precios y ventas','Documentos y fiscalidad','Seguimiento y sistema','Gastos del','Facturación y cobros','Documentos recientes','Estado del sistema']){
   if(!(await page.locator('#root').innerText()).includes(textNeedle))errors.push('inicio incompleto: '+textNeedle);
 }
 for(const e of errs)errors.push('inicio interacción: '+e);
 await page.close();
}
await browser.close();
if(errors.length){console.error('BROWSER QA FALLÓ\n- '+errors.join('\n- '));process.exit(1)}
console.log('Browser QA desktop + mobile: OK');