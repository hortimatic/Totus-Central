import {chromium} from 'playwright';
import fs from 'node:fs';
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true});
const errors=[],screens=[];
const scenes=[
 {route:'administracion',section:'usuarios',action:'user-new'},
 {route:'administracion',section:'roles',action:'role-new'},
 {route:'administracion',section:'fiscal',action:'expense-category-new'},
 {route:'facturacion',section:'clientes',action:'customer-new'},
 {route:'facturacion',section:'plantillas',action:'template-new'},
 {route:'facturacion',section:'series',action:'series-new'},
 {route:'fiscalidad',action:'fiscal-adjustment-new'},
 {route:'fiscalidad',action:'income-adjustment-new'}
];
for(const [size,width] of [['desktop',1440],['tablet',768],['mobile',390],['small-mobile',320]]){
 const page=await browser.newPage({viewport:{width,height:850},locale:'es-ES'});
 page.on('pageerror',err=>errors.push(size+' pageerror '+err.message));
 for(const scene of scenes){
  await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
  await page.locator('#nav [data-route="'+scene.route+'"]').click();
  if(scene.section){
   const tabAction=scene.route==='administracion'?'admin-section':'billing-section';
   await page.locator('[data-action="'+tabAction+'"][data-section="'+scene.section+'"]').first().click();
  }
  const action=page.locator('#content [data-action="'+scene.action+'"]').first();
  if(!await action.count()){errors.push(size+' '+scene.action+' button not found');continue}
  await action.click();
  const modal=page.locator('#modalHost .modal').first();
  if(!await modal.isVisible()){errors.push(size+' '+scene.action+' modal not visible');continue}
  const geometry=await modal.evaluate(el=>{
   const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height}};
   const bounds=rect(el),buttons=[...el.querySelectorAll('.form-actions .btn')].filter(e=>getComputedStyle(e).display!=='none').map(rect);
   const controls=[...el.querySelectorAll('input:not([type="hidden"]):not([type="file"]),select,textarea')].map(x=>({id:x.id,...rect(x)})).filter(x=>x.w>0);
   const brokenControls=controls.filter(x=>x.x<bounds.x-1||x.right>bounds.right+1);
   const brokenButtons=buttons.filter(x=>x.x<bounds.x-1||x.right>bounds.right+1);
   const overlap=[];
   for(let i=0;i<buttons.length;i++)for(let j=i+1;j<buttons.length;j++){
    const a=buttons[i],b=buttons[j];
    if(Math.min(a.right,b.right)-Math.max(a.x,b.x)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>2)overlap.push([i,j]);
   }
   return {bounds,buttons,brokenControls,brokenButtons,overlap,screenWidth:innerWidth,screenHeight:innerHeight};
  });
  if(geometry.bounds.x<-2||geometry.bounds.right>width+2)errors.push(size+' '+scene.action+' modal exceeds viewport '+JSON.stringify(geometry.bounds));
  if(geometry.brokenButtons.length||geometry.brokenControls.length||geometry.overlap.length)
   errors.push(size+' '+scene.action+' deformed modal: '+JSON.stringify({buttons:geometry.brokenButtons,controls:geometry.brokenControls.slice(0,3),overlap:geometry.overlap,bounds:geometry.bounds}));
  if(size==='small-mobile'||(size==='desktop'&&scene.action==='user-new'))
   await page.screenshot({path:'artifacts/layout_modal_'+size+'_'+scene.action+'.png'});
  screens.push({size,action:scene.action,buttons:geometry.buttons.length,controls:geometry.brokenControls.length});
 }
 await page.close();
}
await browser.close();
fs.writeFileSync('artifacts/modal-geometry.json',JSON.stringify({screens,errors},null,2));
console.log('MODAL GEOMETRY QA: '+screens.length+' sesiones en 320/390/768/1440px; problemas='+errors.length);
if(errors.length){console.error(errors.slice(0,28).join('\n'));process.exit(1)}
