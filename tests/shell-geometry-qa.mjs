import {chromium} from 'playwright';
import {openNavigation} from './ui-navigation.mjs';
import fs from 'node:fs';
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true});
const fails=[],screens=[];
const routes=['inicio','pricing','cajas','gastos','facturacion','documentos','fiscalidad','informes','administracion'];
for(const [size,width] of [['desktop',1440],['tablet',768],['mobile',390],['small-mobile',320]]){
 const page=await browser.newPage({viewport:{width,height:850},locale:'es-ES'});
 const js=[];
 page.on('pageerror',e=>js.push(e.message));
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 for(const route of routes){
  const link=page.locator('#nav [data-route="'+route+'"]');
  if(!await link.count()){fails.push(size+'/'+route+': navigation route is missing');continue}
  await openNavigation(page);await link.click();
  const s=await page.evaluate(()=>{
   const box=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height}};
   const app=document.querySelector('#app'),top=box(document.querySelector('.topbar')),
     title=box(document.getElementById('pageTitle')),content=box(document.querySelector('#content')),sidebar=box(document.querySelector('.sidebar'));
   const status=getComputedStyle(document.querySelector('.sidebar'));
   return {top,title,content,sidebar,viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,sidebarPosition:status.position};
  });
  if(s.scrollWidth>width+3){fails.push(size+'/'+route+': global horizontal scroll '+s.scrollWidth);console.log(size,route,await page.locator('#content *').evaluateAll(es=>es.filter(el=>{const r=el.getBoundingClientRect();return r.width&&r.right>innerWidth+3;}).slice(0,10).map(el=>({tag:el.tagName,classes:el.className,right:el.getBoundingClientRect().right}))));}
  if(s.title.right>s.top.right+4||s.title.x<s.top.x-4)fails.push(size+'/'+route+': title exceeds header '+JSON.stringify({title:s.title,header:s.top}));
  if(s.content.right>width+3||s.content.x<0)fails.push(size+'/'+route+': main content exceeds viewport '+JSON.stringify(s.content));
  if(width>800){
   if(s.sidebar.right>s.content.x+1)fails.push(size+'/'+route+': sidebar overlaps main content');
  }else{
   if(s.sidebarPosition!=='fixed'||Math.abs(s.sidebar.h-850)>3||Math.abs(s.sidebar.y)>3)
    fails.push(size+'/'+route+': mobile drawer dimensions incorrect '+JSON.stringify(s.sidebar));
   if(!await page.locator('.sidebar').evaluate(el=>el.inert))fails.push(size+'/'+route+': closed mobile navigation remains focusable');
   if(s.top.bottom>s.content.y+2)fails.push(size+'/'+route+': topbar overlaps content');
  }
  if(size==='small-mobile'&&['inicio','gastos','facturacion','administracion'].includes(route))
   await page.screenshot({path:'artifacts/layout_shell_'+size+'_'+route+'.png'});
  screens.push({size,route,bodyWidth:s.scrollWidth});
 }
 if(js.length)fails.push(size+': JavaScript '+js.slice(0,3).join('; '));
 await page.close();
}
await browser.close();
fs.writeFileSync('artifacts/shell-geometry.json',JSON.stringify({screens,fails},null,2));
console.log('SHELL GEOMETRY QA: '+screens.length+' real navigation states at 320,390,768,1440px; '+fails.length+' failures');
if(fails.length){console.error(fails.slice(0,22).join('\n'));process.exit(1)}
