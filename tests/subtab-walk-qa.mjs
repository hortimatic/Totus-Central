import {chromium} from 'playwright';
import {clickModuleLink} from './ui-navigation.mjs';
import fs from 'node:fs';
fs.mkdirSync('artifacts',{recursive:true});
const routes=[
 {route:'inicio',sections:[null]},
 {route:'pricing',sections:[null]},
 {route:'cajas',sections:[null]},
 {route:'gastos',action:'expense-section',sections:['registros','facturas']},
 {route:'facturacion',action:'billing-section',sections:['documentos','clientes','plantillas','series']},
 {route:'documentos',sections:[null]},
 {route:'cotejos',sections:[null]},
 {route:'tareas',sections:[null]},
 {route:'equipo',sections:[null]},
 {route:'configuracion',sections:[null]},
 {route:'fiscalidad',sections:[null]},
 {route:'informes',sections:[null]},
 {route:'administracion',action:'admin-section',sections:['usuarios','roles','negocio','fiscal','storage','backups','log']}
];
const browser=await chromium.launch({headless:true}),errors=[],views=[],names=[];
for(const [size,width] of [['wide',1640],['desktop',1180],['mobile',390],['narrow',320]]){
 const page=await browser.newPage({viewport:{width,height:900},locale:'es-ES'});
 page.on('pageerror',e=>errors.push(size+' JavaScript: '+e.message));
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 for(const mod of routes){
  const nav=page.locator('#nav [data-route="'+mod.route+'"]');
  if(await nav.count()!==1){errors.push(size+': missing '+mod.route+' main navigation');continue}
  await clickModuleLink(page,nav);
  for(const section of mod.sections){
   const key=size+'/'+mod.route+(section?'/'+section:'');
   if(section){
    const tab=page.locator('#content [data-action="'+mod.action+'"][data-section="'+section+'"]').first();
    if(!await tab.count()){errors.push(key+': missing subtab');continue}
    await tab.click();
    if(!await page.locator('#content [data-action="'+mod.action+'"][data-section="'+section+'"].active').count())
      errors.push(key+': subtab not active after clicking');
   }
   if(mod.route==='administracion'&&section==='storage'&&await page.locator('details.storage-technical').count())await page.locator('details.storage-technical > summary').click();
   if(mod.route==='configuracion'){for(const tab of await page.locator('[data-appearance-tab]').all()){await tab.click();await page.screenshot({path:'artifacts/mobile-audit/config-'+size+'-'+await tab.getAttribute('data-appearance-tab')+'.png',fullPage:true});}}
   const info=await page.evaluate(()=>{
    const root=document.querySelector('#content'),rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
    const visible=el=>{const x=getComputedStyle(el),b=el.getBoundingClientRect();return x.display!=='none'&&x.visibility!=='hidden'&&b.width>0&&b.height>0};
    const emptyButtons=[...root.querySelectorAll('button')].filter(visible).filter(el=>!el.dataset.action&&el.type!=='submit').map(el=>el.outerHTML.slice(0,180));
    const badControls=[],overlaps=[];
    for(const el of root.querySelectorAll('input,select,textarea')){
     if(!visible(el)||el.type==='hidden'||el.type==='file')continue;
     const box=rect(el),ancestor=el.closest('.field,label');
     if(!ancestor)continue;
     const parent=rect(ancestor);
     if(box.x<parent.x-6||box.right>parent.right+6)badControls.push({name:el.id||el.name,box,parent});
    }
    for(const head of root.querySelectorAll('.section-head')){
     const title=head.querySelector('h2,h3'),buttons=[...head.querySelectorAll('.btn')].filter(visible);
     if(!title||!visible(title))continue;
     const a=rect(title);
     for(const button of buttons){const b=rect(button);
      if(Math.min(a.right,b.right)-Math.max(a.x,b.x)>3&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>3)
       overlaps.push({title:title.textContent.slice(0,55),action:button.textContent.slice(0,45),titleBox:a,buttonBox:b});
     }
    }
    const heading=[...root.querySelectorAll('.section-head h2,.section-head h3')].filter(visible).length;
    const blankPanels=[...root.querySelectorAll('.card')].filter(visible).filter(el=>el.getBoundingClientRect().height>380&&(el.innerText||'').trim().length<15).map(el=>({class:el.className,height:Math.round(el.getBoundingClientRect().height)}));
    return {buttons:root.querySelectorAll('button').length,fields:root.querySelectorAll('input,select,textarea').length,emptyButtons,badControls,overlaps,blankPanels,heading,
     scrollWidth:document.documentElement.scrollWidth,innerWidth,htmlChars:(root.innerText||'').trim().length};
   });
   if(info.htmlChars<30)errors.push(key+': empty module');
   if(info.scrollWidth>width+3)errors.push(key+': unexpected whole-page horizontal scroll '+info.scrollWidth+'>'+width);
   if(info.emptyButtons.length)errors.push(key+': inert buttons '+JSON.stringify(info.emptyButtons.slice(0,2)));
   if(info.badControls.length)errors.push(key+': fields protrude from parents '+JSON.stringify(info.badControls.slice(0,2)));
   if(info.overlaps.length)errors.push(key+': header buttons overlap text '+JSON.stringify(info.overlaps.slice(0,2)));
   if(info.blankPanels.length)errors.push(key+': blank oversized card '+JSON.stringify(info.blankPanels.slice(0,2)));
   views.push({key,...info});
   names.push(key);
   if(size==='wide'||size==='narrow')
    await page.screenshot({path:'artifacts/mobile-audit/layout_walk_'+size+'_'+mod.route+'_'+section+'.png',fullPage:true});
  }
 }
 await page.close();
}
await browser.close();
fs.writeFileSync('artifacts/subtab-walk.json',JSON.stringify({screens:names,views,errors},null,2));
console.log('SUBTAB WALK QA: '+views.length+' actual-click states; all module pages and administrative/billing/expense subtab panels at 1640,1180,390,320; '+errors.length+' failures');
if(errors.length){console.error(errors.slice(0,32).join('\n'));process.exit(1)}
