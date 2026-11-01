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
  source=source.replace('rpc:async(name,args)=>{',`rpc:async(name,args)=>{
   if(name==='totus_save_my_appearance'){const result=await window.__saveStitchPreference(args);db.profiles[0].ui_preferences.interface=result.data;return result;}
   if(name==='totus_tasks_context')return {data:{rows:[],archived_tasks:[],stores:db.ops_stores,people:[{email:'qa@example.com',name:'Equipo de prueba'}]},error:null};
   if(['totus_chat_personalized_context','totus_chat_notification_context'].includes(name))return {data:{channels:[{id:'stitch-demo',name:'Equipo de prueba',group_name:'Hortimatic',member_role:'manager',last_seq:1,unread:0}],messages:[{id:'stitch-message',channel_id:'stitch-demo',seq:1,author_email:'qa@example.com',body:'Mensaje ficticio para comprobar el nuevo diseño de Chat.',created_at:new Date().toISOString(),replies:0,reactions:[],files:[]}],members:[{email:'qa@example.com',member_role:'manager'}],directory:[{email:'qa@example.com',name:'Equipo de prueba'}],layout:{}},error:null};
   if(name==='totus_chat_command')return {data:{ok:true},error:null};
  `);
  await route.fulfill({response,body:source});
 });
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html');
 await page.locator('#nav [data-route]').first().waitFor();
 // Only synthetic mock preferences: production preferences and accounting never change here.
 const routes=await page.locator('#nav [data-route]').evaluateAll(es=>es.map(e=>e.dataset.route));
 await page.evaluate(async()=>{const {isoToday}=await import('../src/utils.js');const db=window.__mockDb;db.ops_daily_closings.push({id:crypto.randomUUID(),store_id:db.ops_stores[0].id,business_date:isoToday(),status:'cerrado',card_sales:18447.41,cash_withdrawals:7950,cash_sales:7950,bizum_sales:0,online_sales:0,other_income:0,opening_cash:200,actual_cash:200,reported_total_sales:26397.41,difference:0,notes:'Cierre ficticio para comprobar importes grandes'});});
 assert.equal(routes.length,13);
 const collapse=page.getByRole('button',{name:'Minimizar navegación',exact:true});
 await collapse.click();
 assert.equal(await page.locator('html').evaluate(e=>e.classList.contains('navigation-compact')),true);
 assert.equal(await page.locator('.sidebar').evaluate(e=>e.getBoundingClientRect().width),72);
 assert.equal(await page.locator('#nav a[title]').count(),13);
 await page.getByRole('button',{name:'Ampliar navegación',exact:true}).click();
 assert.equal(await page.locator('html').evaluate(e=>e.classList.contains('navigation-compact')),false);
 assert.equal(await page.locator('.sidebar-foot').isVisible(),false);
 assert(await page.getByRole('button',{name:'Abrir mi cuenta'}).isVisible());
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.locator('.desktop-nav-collapse').isVisible(),false);
 await page.setViewportSize({width:1440,height:1000});
 for(const route of routes){
  await clickModuleLink(page,page.locator('#nav [data-route="'+route+'"]'));
  if(route==='tareas')await page.locator('.tasks-calendar').waitFor();
  if(route==='equipo')await page.locator('.team-chat').waitFor();
  const controls=await page.locator('#content > .page > .module-tabs [data-action],#content > .page > .tabs [data-action]').evaluateAll(es=>es.map(e=>({action:e.dataset.action,section:e.dataset.section})).filter(e=>e.section));
  const sections=[null,...controls];
  for(const section of sections){
   if(section)await page.locator('#content .module-tabs [data-action="'+section.action+'"][data-section="'+section.section+'"]').click();
   for(const width of [1440,831,390,320]){
    await page.setViewportSize({width,height:1000});
    assert.equal(await page.locator('link[href$="stitch-design.css"]').count(),1);
    assert.equal(await page.locator('#nav .nav-btn .ui-icon').count(),13);
    await page.evaluate(()=>document.fonts.ready);
    const visible=await page.locator('#content').evaluate(e=>({client:e.clientWidth,scroll:e.scrollWidth}));
    if(visible.scroll>visible.client+2)console.log('Overflow elements',route,width,await page.locator('#content *').evaluateAll(es=>es.filter(e=>{let r=e.getBoundingClientRect();return r.width&&r.right>innerWidth+2&&getComputedStyle(e).visibility!=='hidden';}).slice(0,12).map(e=>({tag:e.tagName,class:e.className,right:e.getBoundingClientRect().right,text:e.textContent.slice(0,60)}))));
    assert.equal(await page.locator('#nav [aria-current=page]').getAttribute('data-route'),route);
    if(route==='cajas')assert(await page.locator('.closing-kpis .kpi').first().locator('strong').evaluate(e=>e.getBoundingClientRect().height<35),'The amount and currency symbol stay on one line');
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
 await page.locator('[name=navigationMode]').selectOption('compact');
 await page.locator('[name=startModule]').selectOption('cajas');
 await page.locator('.appearance-grid button[type=submit]').click();
 await page.getByText('Configuración guardada y aplicada.',{exact:true}).waitFor();
 assert.equal(await page.locator('html').evaluate(e=>e.style.getPropertyValue('--accent')),'#006591');
 await page.reload();await page.locator('[data-account-open]').waitFor();
 assert.equal(await page.locator('html').evaluate(e=>e.style.getPropertyValue('--accent')),'#006591','Personal Stitch palette survives reload');
 assert.equal(await page.locator('html').evaluate(e=>e.classList.contains('navigation-compact')),true,'Personal compact setting survives reload');
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html');await page.locator('[data-account-open]').waitFor();
 assert.equal(await page.locator('#nav [aria-current=page]').getAttribute('data-route'),'cajas','Saved startup module applies when no module is requested');
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html?module=informes');await page.locator('[data-account-open]').waitFor();
 assert.equal(await page.locator('#nav [aria-current=page]').getAttribute('data-route'),'informes','An explicit link overrides the startup preference');
 assert.deepEqual(errors,[]);await fs.writeFile('artifacts/stitch-complete/views.json',JSON.stringify(views,null,2));
 console.log('STITCH: '+views.length+' module/subtab/width views, all navigation icons, personal preset save and reload OK.');
}finally{await browser.close();}
