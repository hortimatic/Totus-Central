import {chromium} from 'playwright';
import fs from 'node:fs';
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true});
const failures=[],notices=[];
const routes=['inicio','pricing','cajas','gastos','facturacion','documentos','fiscalidad','informes','administracion'];
const pages=['?route=inicio','?route=pricing','?route=cajas','?route=cajas&mode=record&id=new','?route=gastos','?route=gastos&mode=record&id=new','?route=facturacion','?route=facturacion&mode=record&id=new','?route=documentos','?route=documentos&mode=record&id=new','?route=fiscalidad','?route=informes','?route=administracion&section=usuarios','?route=administracion&section=negocio','?route=administracion&section=fiscal','?route=administracion&section=storage','?route=administracion&section=backups','?route=administracion&section=log'];
for(const [viewportName,viewport] of [['desktop',{width:1440,height:960}],['mobile',{width:390,height:844}]]){
 const page=await browser.newPage({locale:'es-ES',viewport});
 for(const query of pages){
  const label=viewportName+'/'+query;
  await page.goto('http://127.0.0.1:4173/tests/ui-harness.html'+query,{waitUntil:'networkidle'});
  const audit=await page.evaluate(()=>{
   const root=document.querySelector('#root');
   const visible=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};
   const ids=new Map(),duplicate=[],unlabeled=[],links=[],outOfBounds=[];
   for(const el of root.querySelectorAll('[id]')){if(!visible(el))continue;const id=el.id;if(!id)continue;if(ids.has(id))duplicate.push({id,first:ids.get(id),second:el.tagName});else ids.set(id,el.tagName)}
   for(const el of root.querySelectorAll('button,input,select,textarea')){
    if(!visible(el))continue;
    const label=(el.getAttribute('aria-label')||el.textContent||el.getAttribute('placeholder')||el.labels?.[0]?.textContent||'').trim();
    if(!label && !(el.type==='hidden') && !el.title)unlabeled.push((el.id||el.outerHTML).slice(0,100));
    const b=el.getBoundingClientRect();if(b.width<20||b.height<18)outOfBounds.push({name:el.id||el.textContent.slice(0,35),width:Math.round(b.width),height:Math.round(b.height)});
   }
   for(const label of root.querySelectorAll('label[for]'))if(!document.getElementById(label.htmlFor))links.push(label.htmlFor);
   const forms=[...root.querySelectorAll('form')].filter(visible).length;
   const blank=[...root.querySelectorAll('.card,.record-main,.record-side,.table-wrap')].filter(visible).filter(el=>el.getBoundingClientRect().height>300 && (el.innerText||'').trim().length<12).slice(0,4).map(el=>({class:el.className,height:Math.round(el.getBoundingClientRect().height)}));
   return {duplicate,unlabeled,links,outOfBounds,blank,forms};
  });
  if(audit.duplicate.length)failures.push(label+' duplicate visible element IDs: '+JSON.stringify(audit.duplicate));
  if(audit.links.length)failures.push(label+' labels for missing controls: '+JSON.stringify(audit.links));
  if(audit.blank.length)failures.push(label+' tall empty blocks: '+JSON.stringify(audit.blank));
  if(audit.unlabeled.length)failures.push(label+' unlabeled controls: '+JSON.stringify(audit.unlabeled));
  if(audit.outOfBounds.length)failures.push(label+' small targets: '+JSON.stringify(audit.outOfBounds));
 }
 await page.close();
}
await browser.close();
fs.writeFileSync('artifacts/layout-audit.json',JSON.stringify({failures,notices},null,2));
console.log('Auditado: '+(2*pages.length)+' vistas; avisos='+notices.length+' errores='+failures.length);
if(notices.length)console.log('Avisos:\n'+notices.slice(0,20).join('\n'));
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
