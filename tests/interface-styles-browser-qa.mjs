import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer(),{chromium}=await import(process.env.TOTUS_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.TOTUS_BROWSER_CHANNEL?{channel:process.env.TOTUS_BROWSER_CHANNEL}:{})});
const cloud=new Map();await mkdir('artifacts/interface-styles',{recursive:true});
async function mount(page,owner){
 await page.evaluate(async({owner,saved})=>{
  document.head.insertAdjacentHTML('beforeend','<link rel="stylesheet" href="../src/appearance.css">');
  const {createAppearanceUI,appearancePage,applyInterfaceAppearance}=await import('../src/appearance-ui.js');
  const qa=window.stylesQA={owner,row:{appearance_config:saved?.active||{}},library:saved?.book||{revision:0,items:[]},confirm:true};
  document.body.innerHTML='<main id="main">'+appearancePage()+'</main>';
  qa.ui=createAppearanceUI({settings:()=>qa.row,styles:()=>qa.library,actor:()=>qa.owner,canEdit:()=>true,confirm:async()=>qa.confirm,
   save:async(section,config)=>{await window.persistStyleQA(qa.owner,{active:config,book:qa.library});qa.row.appearance_config=config;applyInterfaceAppearance(config);},
   saveStyle:async command=>{const result=await window.saveStyleQA(qa.owner,command);qa.library=result;return result;}});
  qa.ui.mount(document.querySelector('#appearanceRoot'));applyInterfaceAppearance(qa.row.appearance_config);
 },{owner,saved:cloud.get(owner)});
}
try{for(const width of [390,1440]){
 const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.exposeFunction('persistStyleQA',async(owner,data)=>cloud.set(owner,structuredClone(data)));
 await page.exposeFunction('saveStyleQA',async(owner,c)=>{
  const data=cloud.get(owner)||{},book=structuredClone(data.book||{revision:0,items:[]});
  if(c.revision!==book.revision)throw Error('Tus estilos cambiaron en otra ventana. Actualiza antes de guardar.');
  const row=book.items.find(x=>x.id===c.id);
  if(c.action==='create')book.items.push({id:c.id,name:c.name,config:c.config});
  if(c.action==='rename')row.name=c.name;
  if(c.action==='replace')Object.assign(row,{name:c.name,config:c.config});
  if(c.action==='remove')book.items=book.items.filter(x=>x.id!==c.id);
  book.revision++;cloud.set(owner,{...data,book});return {...book,changed_id:c.action==='remove'?null:c.id};
 });
 await page.goto('http://127.0.0.1:4173/tests/chat-harness.html');await mount(page,'a'+width);
 await page.locator('[name=cardGlow]').fill('24');await page.locator('[name=borderWidth]').fill('3');
 await page.locator('[data-preset]').selectOption('totus');await page.locator('[data-apply-preset]').click();
 assert.equal(await page.locator('[name=cardGlow]').inputValue(),'0');assert.equal(await page.locator('[name=borderWidth]').inputValue(),'1');
 await page.locator('[name=primary]').fill('#aabbcc');await page.locator('[name=borderWidth]').fill('2');
 await page.locator('[data-style-name]').fill('Oficina');await page.locator('[data-style-name]').press('Enter');await page.locator('[data-style-status]').filter({hasText:'Estilo guardado en tu cuenta'}).waitFor();
 assert.equal(cloud.get('a'+width).active,undefined,'Library save does not apply interface');
 await page.reload();await mount(page,'a'+width);await page.locator('[data-my-style]').selectOption({label:'Oficina'});await page.locator('[data-style-action=load]').click();assert.equal(await page.locator('[name=primary]').inputValue(),'#aabbcc');assert.equal(await page.locator('[name=borderWidth]').inputValue(),'2');
 await page.locator('#appearanceRoot [type=submit]').click();await page.locator('[data-appearance-status]').filter({hasText:'Configuración guardada'}).waitFor();
 await page.reload();await mount(page,'a'+width);assert.equal(await page.locator('[name=primary]').inputValue(),'#aabbcc');
 await page.locator('[data-my-style]').selectOption({label:'Oficina'});await page.locator('[data-style-name]').fill('Trabajo');await page.locator('[data-style-action=rename]').click();await page.locator('[data-my-style] option').filter({hasText:'Trabajo'}).waitFor({state:'attached'});
 await page.locator('[name=primary]').fill('#334455');await page.locator('[data-style-action=replace]').click();await page.locator('[data-style-status]').filter({hasText:'Estilo guardado en tu cuenta'}).waitFor();assert.equal(cloud.get('a'+width).book.items[0].config.primary,'#334455');
 await page.screenshot({path:'artifacts/interface-styles/styles-'+width+'.png',fullPage:true});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');
 await page.locator('[data-my-style]').selectOption({label:'Trabajo'});
 await page.locator('[data-style-export]').click();
 const sharedCode=await page.locator('[data-style-share-code]').inputValue();
 assert.equal(JSON.parse(sharedCode).format,'totus-interface-style');
 assert.equal(JSON.parse(sharedCode).config.primary,'#334455');
 assert(!sharedCode.includes('customLogoData'),'A share code must exclude personal images');
 assert(!sharedCode.includes('brandName'),'A share code must exclude personal identity');
 await mount(page,'b'+width);assert.equal(await page.locator('[data-my-style] option').count(),1,'Other account cannot see private styles before import');
 await page.locator('[data-style-share-code]').fill(sharedCode);
 await page.locator('[data-style-import]').click();
 await page.locator('[data-style-share-status]').filter({hasText:'Estilo recibido y guardado'}).waitFor();
 assert.equal(cloud.get('b'+width).book.items[0].config.primary,'#334455','Receiver saves a private independent copy');
 assert.equal(cloud.get('b'+width).active,undefined,'Receiving a style must not apply it automatically');
 await page.reload();await mount(page,'b'+width);
 await page.locator('[data-my-style]').selectOption({label:'Trabajo'});
 await page.locator('[data-style-action=load]').click();
 assert.equal(await page.locator('[name=primary]').inputValue(),'#334455','Shared colour survives recipient reload');
 await page.locator('#appearanceRoot [type=submit]').click();
 await page.locator('[data-appearance-status]').filter({hasText:'Configuración guardada'}).waitFor();
 await page.reload();await mount(page,'b'+width);
 assert.equal(await page.locator('[name=primary]').inputValue(),'#334455','Receiver's applied style survives a full reload');
 assert.equal(cloud.get('b'+width).active.primary,'#334455');
 assert.equal(cloud.get('a'+width).book.items[0].config.primary,'#334455','Sender library stays untouched');
 assert.equal(cloud.get('a'+width).active.primary,'#aabbcc','Sender applied style stays independent');

 await mount(page,'a'+width);await page.locator('[data-my-style]').selectOption({label:'Trabajo'});await page.locator('[data-style-action=remove]').click();await page.locator('[data-style-status]').filter({hasText:'Estilo eliminado'}).waitFor();assert.equal(cloud.get('a'+width).book.items.length,0);assert.equal(cloud.get('a'+width).active.primary,'#aabbcc','Removing a style preserves applied interface');
 // Changing session while a confirmation is open cannot write another account.
 await page.locator('[data-style-name]').fill('Temporal');await page.locator('[data-style-action=create]').click();await page.locator('[data-style-status]').filter({hasText:'Estilo guardado'}).waitFor();
 await page.evaluate(()=>{stylesQA.ui.dispose();stylesQA.owner='b';stylesQA.ui.mount(document.querySelector('#appearanceRoot'));});
 assert.deepEqual(errors,[]);await page.close();console.log('PASS styles '+width+': personal save, reload, two accounts, safe share/import and unchanged applied interface');
}}finally{await browser.close();await server?.close();}
