import {chromium} from 'playwright';
import fs from 'node:fs';
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true});
const failures=[],notices=[];
const routes=['inicio','pricing','cajas','gastos','facturacion','documentos','fiscalidad','informes','administracion'];
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
for(const [viewportName,viewport] of [['wide',{width:1640,height:900}],['desktop',{width:1440,height:960}],['tablet',{width:768,height:1024}],['mobile',{width:390,height:844}],['small-mobile',{width:320,height:740}]]){
 const page=await browser.newPage({locale:'es-ES',viewport});
 for(const [view,query] of pages){
  const label=viewportName+'/'+view;
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
   const compressedHeadings=[];
   for(const header of root.querySelectorAll('.section-head')){
    const action=header.querySelector('.btn,.inline-actions');
    if(!action||!visible(action))continue;
    const title=header.querySelector('h2,h3');
    if(!title||!visible(title))continue;
    const ctx=document.createElement('canvas').getContext('2d');
    ctx.font=getComputedStyle(title).font;
    const text=(title.textContent||'').trim();
    const longest=Math.max(...text.split(/\s+/).map(word=>ctx.measureText(word).width),0);
    const heading=title.getBoundingClientRect(),parent=header.getBoundingClientRect();
    if(longest>heading.width+3&&longest<parent.width-12)
      compressedHeadings.push({title:text.slice(0,85),headingWidth:Math.round(heading.width),wordWidth:Math.round(longest),parentWidth:Math.round(parent.width)});
   }
   const clipped=[];
   for(const el of root.querySelectorAll('.section-head h2,.section-head h3,.kpi strong,.field-caption,.btn,.summary-row strong')){
    if(!visible(el))continue;
    const st=getComputedStyle(el);
    if(st.overflowX==='visible'&&st.whiteSpace!=='nowrap')continue;
    if(el.scrollWidth>el.clientWidth+6)clipped.push({tag:el.tagName,cls:el.className,text:(el.innerText||el.textContent||'').slice(0,70),overflow:Math.round(el.scrollWidth-el.clientWidth)});
   }
   const infoIcons=[...root.querySelectorAll('.field-help>summary')].filter(visible).map(el=>{
    const r=el.getBoundingClientRect();
    return {w:r.width,h:r.height,content:getComputedStyle(el,'::after').content,text:el.textContent.trim(),fontSize:parseFloat(getComputedStyle(el).fontSize)};
   });
   const invalidInfoIcons=infoIcons.filter(i=>Math.abs(i.w-i.h)>1||i.w<18||i.h<18||i.text!=='i'||i.fontSize<10||!['none','normal'].includes(i.content));
   return {duplicate,unlabeled,links,outOfBounds,blank,forms,clipped,compressedHeadings,invalidInfoIcons,infoIconsCount:infoIcons.length};
  });
  if(audit.duplicate.length)failures.push(label+' duplicate visible element IDs: '+JSON.stringify(audit.duplicate));
  if(audit.links.length)failures.push(label+' labels for missing controls: '+JSON.stringify(audit.links));
  if(audit.blank.length)failures.push(label+' tall empty blocks: '+JSON.stringify(audit.blank));
  if(audit.unlabeled.length)failures.push(label+' unlabeled controls: '+JSON.stringify(audit.unlabeled));
  if(audit.outOfBounds.length)failures.push(label+' small targets: '+JSON.stringify(audit.outOfBounds));
  if(audit.clipped.length)failures.push(label+' clipped text: '+JSON.stringify(audit.clipped.slice(0,8)));
  if(audit.compressedHeadings.length)failures.push(label+' button squeezes heading across a word: '+JSON.stringify(audit.compressedHeadings.slice(0,8)));
  if(audit.invalidInfoIcons.length)failures.push(label+' malformed i icons: '+JSON.stringify(audit.invalidInfoIcons.slice(0,8)));
  if(view==='admin-storage'){
   const observed=page.locator('#storageObservedBar'),total=page.locator('#storageObservedTotal');
   if(await observed.count()!==1||await total.count()!==1)failures.push(label+' no renderiza barra superior de almacenamiento observado');
   else{
    const widths=await observed.locator('span').evaluateAll(els=>els.map(el=>Math.round(el.getBoundingClientRect().width)));
    if(widths.length!==4||widths[0]<20||widths[1]<=0||widths[2]<=0||widths[3]<=0)
     failures.push(label+' barras de base/documentos/logos/copias sin representación visible: '+widths.join(','));
    if(!(await total.innerText()).includes('36,00 MB'))failures.push(label+' total real de almacenamiento observado incorrecto');
   }
  }
  if(view==='inicio'){
   const overlaps=await page.evaluate(()=>[...document.querySelectorAll('.store-status-card')].map(card=>{
    const metrics=card.querySelector('.metric-list')?.getBoundingClientRect();
    const action=card.querySelector('.form-actions');
    if(!metrics||!action)return {error:'Faltan métricas o botón'};
    const button=action.getBoundingClientRect();
    return {name:card.querySelector('h3')?.textContent||'Tienda',overlap:button.top<metrics.bottom-1,position:getComputedStyle(action).position,actionY:Math.round(button.top),metricsBottom:Math.round(metrics.bottom)};
   }));
   for(const problem of overlaps)if(problem.error||problem.overlap||problem.position!=='static')
    failures.push(label+' cierre de caja sobrepuesto: '+JSON.stringify(problem));
  }
  const helpButtons=page.locator('#root .field-help>summary');
  const helpCount=await helpButtons.count();
  for(const position of [...new Set([0,Math.max(0,helpCount-1)])]){
   if(!helpCount)break;
   const icon=helpButtons.nth(position);
   if(!await icon.isVisible())continue;
   await icon.click({force:true});
   // Allow the browser one rendering frame to settle the native details geometry.
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
   const measured=await icon.evaluate(el=>{
    const note=el.closest('details')?.querySelector('[role="note"]');
    const b=note?.getBoundingClientRect();
    return b?{left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:innerWidth,height:innerHeight}:null;
   });
   if(measured&&(measured.left< -4||measured.right>measured.width+4||measured.top< -4||measured.bottom>measured.height+4))
    failures.push(label+' popup out of viewport: '+JSON.stringify(measured));
   await icon.click({force:true});
  }
  if(['admin-storage','admin-backups','admin-log','admin-roles','facturacion-plantillas','facturacion-series','gastos-facturas','gastos-form','cajas-form','factura-form','documentos-form'].includes(view))
    await page.screenshot({path:'artifacts/layout_'+viewportName+'_'+view+'.png',fullPage:true});
 }
 await page.close();
}
await browser.close();
fs.writeFileSync('artifacts/layout-audit.json',JSON.stringify({failures,notices},null,2));
console.log('Auditado: '+(5*pages.length)+' vistas; avisos='+notices.length+' errores='+failures.length);
if(notices.length)console.log('Avisos:\n'+notices.slice(0,20).join('\n'));
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
