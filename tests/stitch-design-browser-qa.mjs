import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {clickModuleLink} from './ui-navigation.mjs';
import {APPEARANCE_PRESETS} from '../src/appearance-core.js';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],views=[];
let stored={config:APPEARANCE_PRESETS.stitch,revision:0};
page.on('pageerror',error=>errors.push(error.message));
try{
 await fs.mkdir('artifacts/stitch-complete',{recursive:true});
 await page.exposeFunction('__saveStitchPreference',args=>{
  assert.equal(args.p_expected_revision,stored.revision);
  stored={config:args.p_config,revision:stored.revision+1};return {data:stored,error:null};
 });
 await page.route('**/tests/mock-supabase.js',async route=>{
  const response=await route.fetch();let source=await response.text();
  source=source.replace('window.__mockDb=db;',()=>"window.__mockDb=db;db.profiles[0].ui_preferences="+JSON.stringify({interface:stored})+';');
  source=source.replace('rpc:async(name,args)=>{',`rpc:async(name,args)=>{if(name==='totus_save_my_appearance'){const result=await window.__saveStitchPreference(args);db.profiles[0].ui_preferences.interface=result.data;return result;}`);
  await route.fulfill({response,body:source});
 });
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html');
 await page.locator('#nav [data-route]').first().waitFor();
 // Only synthetic mock preferences: production preferences and accounting never change here.
 const routes=await page.locator('#nav [data-route]').evaluateAll(es=>es.map(e=>e.dataset.route));
 assert.equal(routes.length,13);
 for(const route of routes){
  await clickModuleLink(page,page.locator('#nav [data-route="'+route+'"]'));
  if(route==='tareas')await page.locator('.tasks-calendar').waitFor();
  if(route==='equipo')await page.locator('.team-chat').waitFor();
  const controls=await page.locator('#content > .page > .module-tabs [data-action],#content > .page > .tabs [data-action]').evaluateAll(es=>es.map(e=>({action:e.dataset.action,section:e.dataset.section})).filter(e=>e.section));
  const sections=[null,...controls];
  for(const section of sections){
   if(section)await page.locator('#content [data-action="'+section.action+'"][data-section="'+section.section+'"]').click();
   for(const width of [1440,390,320]){
    await page.setViewportSize({width,height:1000});
    assert.equal(await page.locator('link[href$="stitch-design.css"]').count(),1);
    assert.equal(await page.locator('#nav .nav-btn .ui-icon').count(),13);
    await page.evaluate(()=>document.fonts.ready);
    const visible=await page.locator('#content').evaluate(e=>({client:e.clientWidth,scroll:e.scrollWidth}));
    if(visible.scroll>visible.client+2)console.log('Overflow elements',route,width,await page.locator('#content *').evaluateAll(es=>es.filter(e=>{let r=e.getBoundingClientRect();return r.width&&r.right>innerWidth+2&&getComputedStyle(e).visibility!=='hidden';}).slice(0,12).map(e=>({tag:e.tagName,class:e.className,right:e.getBoundingClientRect().right,text:e.textContent.slice(0,60)}))));
    assert.equal(await page.locator('#nav [aria-current=page]').getAttribute('data-route'),route);
    await page.screenshot({path:'artifacts/stitch-complete/'+route+'-'+(section?.section||'principal')+'-'+width+'.png',fullPage:true});
    assert(visible.scroll<=visible.client+2,route+' '+width+' content overflow '+JSON.stringify(visible));
    views.push({route,section:section?.section||'principal',width});
   }
  }
 }
 await page.setViewportSize({width:1440,height:1000});
 await clickModuleLink(page,page.locator('#nav [data-route=configuracion]'));
 await page.locator('[data-preset]').selectOption('stitch');
 await page.locator('[data-apply-preset]').click();
 await page.locator('.appearance-grid button[type=submit]').click();
 await page.getByText('Configuración guardada y aplicada.',{exact:true}).waitFor();
 assert.equal(await page.locator('html').evaluate(e=>e.style.getPropertyValue('--accent')),'#006591');
 await page.reload();await page.locator('[data-account-open]').waitFor();
 assert.equal(await page.locator('html').evaluate(e=>e.style.getPropertyValue('--accent')),'#006591','Personal Stitch palette survives reload');
 assert.deepEqual(errors,[]);await fs.writeFile('artifacts/stitch-complete/views.json',JSON.stringify(views,null,2));
 console.log('STITCH: '+views.length+' module/subtab/width views, all navigation icons, personal preset save and reload OK.');
}finally{await browser.close();}
