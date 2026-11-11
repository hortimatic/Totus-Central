import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
 await fs.mkdir('artifacts/appearance-tools',{recursive:true});
 await page.goto('http://127.0.0.1:4173/tests/chat-harness.html');
 await page.evaluate(async()=>{
  const link=document.createElement('link');link.rel='stylesheet';link.href='../src/appearance.css';document.head.append(link);
  const {appearancePage,createAppearanceUI}=await import('../src/appearance-ui.js');
  const q=window.toolsQA={owner:'a',editable:true,row:{appearance_revision:0,appearance_config:{brandName:'Marca propia'},login_appearance:{loginBrandName:'Marca compartida',loginLogoMode:'text'}},saves:[]};
  document.querySelector('#chatHarness').innerHTML=appearancePage();
  q.ui=createAppearanceUI({settings:()=>q.row,actor:()=>q.owner,canEdit:()=>q.editable,confirm:async()=>true,save:async(section,config)=>{q.saves.push({section,config});q.row={...q.row,appearance_revision:q.row.appearance_revision+1,[section==='login'?'login_appearance':'appearance_config']:config};}});
  q.ui.mount(document.querySelector('#appearanceRoot'));
 });
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:900});
  for(const module of ['inicio','cajas','gastos','informes']){
   await page.locator('[data-demo-module='+module+']').click();
   assert.equal(await page.locator('[data-demo-view='+module+']').isVisible(),true,'Preview section '+module);
   assert.equal(await page.locator('[data-demo-module='+module+']').getAttribute('aria-pressed'),'true');
   assert.equal(await page.locator('[data-demo-view]:visible').count(),1,'Only one preview module visible');
  }
  assert.equal(await page.evaluate(()=>toolsQA.ui.hasDraft()),false,'Browsing the preview must not mark preferences dirty');
  assert.equal(await page.evaluate(()=>toolsQA.saves.length),0,'Browsing preview never saves');
 }
 await page.setViewportSize({width:1440,height:1000});
 // Contrast smoke test: dark appearance must carry foreground and backgrounds to neutral module controls.
 const dark=await page.evaluate(async()=>{
  const {appearanceVariables}=await import('../src/appearance-core.js');
  const root=document.documentElement;
  root.dataset.appearance='dark';
  for(const [key,value] of Object.entries(appearanceVariables({theme:'dark',bg:'#07111f',surface:'#0b1729',card:'#12233b',text:'#f2f7ff',muted:'#a8c1d8'})))root.style.setProperty(key,value);
  const fixture=document.createElement('div');fixture.id='appearance-dark-smoke';
  fixture.innerHTML='<header class="topbar"><h1>Cabecera</h1><span class="eyebrow">Subtítulo</span></header><section class="card"><label class="field">Texto<input value="Campo"></label><div class="tabs"><button class="tab">Resumen</button></div><button class="btn secondary">Filtrar</button><div class="note">Nota neutral</div></section>';
  document.body.append(fixture);
  const selectors=['.topbar h1','.topbar .eyebrow','.card','.field','.field input','.tab','.btn.secondary','.note'];
  const output=selectors.map(selector=>{const el=fixture.querySelector(selector),s=getComputedStyle(el);return {selector,color:s.color,background:s.backgroundColor};});
  fixture.remove();root.removeAttribute('data-appearance');
  for(const key of Object.keys(appearanceVariables({})))root.style.removeProperty(key);
  return output;
 });
 assert.equal(dark.find(x=>x.selector==='.topbar h1').color,'rgb(242, 247, 255)','Dark topbar text follows appearance');
 assert.equal(dark.find(x=>x.selector==='.card').background,'rgb(18, 35, 59)','Custom dark card color must not be replaced by surface color');
 assert.equal(dark.find(x=>x.selector==='.field input').color,'rgb(242, 247, 255)','Dark input text follows appearance');
 assert.equal(dark.find(x=>x.selector==='.btn.secondary').color,'rgb(242, 247, 255)','Dark secondary button text remains readable');
 assert.equal(dark.find(x=>x.selector==='.note').color,'rgb(242, 247, 255)','Dark neutral note text remains readable');
 await page.locator('[name=card]').fill('#ffffff');
 await page.locator('[name=surface]').fill('#ffffff');
 await page.locator('[name=text]').fill('#ffffff');
 await page.locator('[name=muted]').fill('#dddddd');
 await page.locator('[name=navigationBackground]').fill('#ffffff');
 await page.locator('[name=navigationText]').fill('#ffffff');
 await page.locator('[name=navigationSectionText]').fill('#dddddd');
 assert.match(await page.locator('[data-contrast-result]').textContent(),/contraste insuficiente/i);
 assert.equal(await page.evaluate(()=>toolsQA.saves.length),0,'Contrast audit must not persist anything');
 await page.locator('[data-fix-contrast]').click();
 assert.match(await page.locator('[data-contrast-result]').textContent(),/contraste.*correcto/i);
 assert.notEqual(await page.locator('[name=text]').inputValue(),'#ffffff');
 assert.equal(await page.evaluate(()=>toolsQA.saves.length),0,'Contrast correction stays only in preview until explicitly saved');
 await page.locator('[data-cancel-preview]').click();
 assert.equal(await page.evaluate(()=>toolsQA.ui.hasDraft()),false,'Discard restores the previously stored appearance');
 assert.equal(await page.evaluate(()=>toolsQA.saves.length),0);
 await page.locator('[data-settings-search]').fill('navegacion');
 assert.equal(await page.locator('[data-appearance-group]:visible').count(),1);
 assert.equal(await page.evaluate(()=>toolsQA.ui.hasDraft()),false,'Search does not change preferences');
 assert.equal(await page.evaluate(()=>new FormData(document.querySelector('.appearance-grid')).get('brandName')),'Marca propia','Filtered controls retain their values');
 await page.locator('[name=startModule]').selectOption('equipo');
 await page.locator('[data-settings-search]').fill('');assert.equal(await page.locator('[name=startModule]').inputValue(),'equipo');
 await page.locator('[data-settings-fold]').click();assert.equal(await page.locator('[data-appearance-group][open]').count(),0);
 await page.locator('[data-settings-expand]').click();assert.equal(await page.locator('[data-appearance-group][open]').count(),6);assert.equal(await page.evaluate(()=>toolsQA.saves.length),0);
 await page.locator('[data-appearance-tab=login]').click();
 await page.locator('[data-login-preset]').selectOption('night');await page.locator('[data-login-style]').click();
 assert.equal(await page.locator('[name=loginCardPreset]').inputValue(),'dark');assert.equal(await page.locator('[name=loginBrandName]').inputValue(),'Marca compartida');assert.equal(await page.locator('[data-login-preset]').inputValue(),'night');
 assert.equal(await page.evaluate(()=>toolsQA.row.login_appearance.loginCardPreset),undefined,'Preset remains a preview before save');
 await page.locator('.appearance-grid button[type=submit]').click();await page.getByText('Configuración guardada y aplicada.',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>toolsQA.row.login_appearance.loginCardPreset),'dark');assert.equal(await page.evaluate(()=>toolsQA.row.login_appearance.loginBrandName),'Marca compartida');
 for(const width of [1440,831,390,320]){
  await page.setViewportSize({width,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Appearance toolbar has no page overflow at '+width);
  await page.screenshot({path:'artifacts/appearance-tools/login-'+width+'.png',fullPage:true});
 }
 await page.evaluate(()=>{toolsQA.ui.dispose();toolsQA.owner='b';toolsQA.editable=false;toolsQA.ui.mount(document.querySelector('#appearanceRoot'));});
 assert.equal(await page.locator('[data-settings-search]').inputValue(),'');assert.equal(await page.locator('[data-login-style]').isDisabled(),true);assert.equal(await page.locator('[data-settings-expand]').isDisabled(),false);
 await page.locator('[data-settings-search]').fill('fondo');assert((await page.locator('[data-appearance-group]:visible').count())>0);assert.equal(await page.evaluate(()=>toolsQA.saves.length),1,'Read-only search cannot save shared Login');
 assert.deepEqual(errors,[]);console.log('APPEARANCE TOOLS: search/folding without value loss, preset preview and save, branding, read-only permissions, account isolation and four widths OK.');
}catch(error){await page.screenshot({path:'artifacts/appearance-tools/failure.png',fullPage:true});throw error;}finally{await browser.close();}
