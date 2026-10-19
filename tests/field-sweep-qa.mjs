import {chromium} from 'playwright';
import fs from 'node:fs';
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true});
const pages=[
 ['inicio','?route=inicio'],['pricing','?route=pricing'],
 ['cajas-list','?route=cajas'],['cajas-form','?route=cajas&mode=record&id=new'],
 ['gastos-list','?route=gastos'],['gastos-form','?route=gastos&mode=record&id=new'],
 ['gastos-facturas','?route=gastos&section=facturas'],
 ['facturas-list','?route=facturacion'],
 ['facturacion-clientes','?route=facturacion&section=clientes'],['facturacion-plantillas','?route=facturacion&section=plantillas'],['facturacion-series','?route=facturacion&section=series'],['factura-form','?route=facturacion&mode=record&id=new&type=factura&kind=invoice&origin=totus'],
 ['rectificativa-form','?route=facturacion&mode=record&id=new&type=factura&kind=rectifying&origin=totus'],
 ['proforma-form','?route=facturacion&mode=record&id=new&type=proforma&kind=invoice&origin=totus'],
 ['externa-form','?route=facturacion&mode=record&id=new&type=factura&kind=invoice&origin=externa'],
 ['documentos-list','?route=documentos'],['documentos-form','?route=documentos&mode=record&id=new'],
 ['fiscalidad','?route=fiscalidad'],['informes','?route=informes'],
 ['admin-users','?route=administracion&section=usuarios'],
 ['admin-roles','?route=administracion&section=roles'],['admin-business','?route=administracion&section=negocio'],
 ['admin-fiscal','?route=administracion&section=fiscal'],['admin-storage','?route=administracion&section=storage'],
 ['admin-backups','?route=administracion&section=backups'],['admin-log','?route=administracion&section=log']
];
const report=[],errors=[];
for(const [size,viewport] of [['desktop',{width:1440,height:960}],['tablet',{width:768,height:1024}],['mobile',{width:390,height:844}]]){
 const page=await browser.newPage({locale:'es-ES',viewport});
 const jsErrors=[];
 page.on('pageerror',e=>jsErrors.push(e.message));
 for(const [view,query] of pages){
  jsErrors.length=0;
  await page.goto('http://127.0.0.1:4173/tests/ui-harness.html'+query,{waitUntil:'networkidle'});
  const controls=page.locator('#root input:not([type="file"]):not([type="hidden"]):not([disabled]):not([readonly]),#root textarea:not([disabled]):not([readonly]),#root select:not([disabled]):not([readonly])');
  const count=await controls.count();
  let filled=0;
  for(let i=0;i<count;i++){
   const element=controls.nth(i);
   if(!(await element.isVisible()))continue;
   const tag=await element.evaluate(el=>el.tagName.toLowerCase());
   const type=(await element.getAttribute('type')||'text').toLowerCase();
   const decimal=await element.getAttribute('data-decimal');
   try{
    if(tag==='select'){
     const val=await element.evaluate(el=>[...el.options].find(o=>!o.disabled)?.value);
     if(val!==undefined)await element.selectOption(val);
    }else if(type==='checkbox'){
     await element.check({force:true});
    }else if(type==='radio'){
     await element.check({force:true});
    }else{
     const sample=decimal==='true'?'10,50':type==='date'?'2026-03-30':type==='number'?'1':type==='email'?'qa@example.com':type==='url'?'https://example.com':type==='tel'?'600000000':type==='time'?'11:30':type==='color'?'#4472c4':type==='password'?'QA1234Aa!':'Dato de simulación QA';
     await element.fill(sample,{timeout:2000});
    }
    filled++;
   }catch(e){errors.push(size+'/'+view+': '+(await element.getAttribute('id')||type)+' -> '+e.message.slice(0,190))}
  }
  if(jsErrors.length)errors.push(size+'/'+view+' JavaScript: '+jsErrors.join(' | '));
  report.push({viewport:size,view,total:count,filled});
 }
 await page.close();
}
await browser.close();
fs.writeFileSync('artifacts/field-sweep.json',JSON.stringify({report,errors},null,2));
console.log('FIELD SWEEP: '+report.length+' vistas, '+report.reduce((a,x)=>a+x.filled,0)+' campos rellenados o seleccionados; fallos='+errors.length);
if(errors.length){console.error(errors.slice(0,35).join('\n'));process.exit(1)}
