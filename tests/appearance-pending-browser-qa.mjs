import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {chatAction} from './chat-menu-helper.mjs';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),failures=[];
try{
 await page.goto('http://127.0.0.1:4173/tests/chat-harness.html');
 await page.evaluate(async()=>{
  const {appearancePage,createAppearanceUI}=await import('../src/appearance-ui.js');
  const style=document.createElement('link');style.rel='stylesheet';style.href='../src/appearance.css';document.head.append(style);
  document.querySelector('#chatHarness').innerHTML=appearancePage();
  const q=window.pendingAppearance={row:{},owner:'a',saves:[]};
  q.ui=createAppearanceUI({settings:()=>q.row,actor:()=>q.owner,canEdit:()=>true,confirm:async()=>true,save:async(section,config)=>{q.saves.push(config);await new Promise(resolve=>q.release=resolve);q.row={appearance_config:config};}});
  q.ui.mount(document.querySelector('#appearanceRoot'));
 });
 await page.locator('[data-appearance-group="1"] summary').click();await page.locator('[name=theme]').selectOption('dark');
 assert.equal(await page.locator('[data-appearance-group="1"]').evaluate(el=>el.open),false,'Changing theme retains folded groups');
 await page.locator('[name=logoHeight]').fill('64');await page.locator('[data-preview-size=mobile]').click();
 assert(await page.locator('[data-brand-logo]').evaluate(el=>el.getBoundingClientRect().right<=el.parentElement.getBoundingClientRect().right),'Largest logo stays within mobile preview');
 await page.locator('[name=brandName]').fill('Diseño guardado');await page.locator('button[type=submit]').click();
 await page.waitForFunction(()=>!!pendingAppearance.release);
 if(!await page.locator('[name=brandName]').isDisabled())failures.push('Appearance fields can change while their save is pending');
 await page.evaluate(()=>pendingAppearance.release());
 await page.getByText('Configuración guardada y aplicada.',{exact:true}).waitFor();
 if(!await page.locator('[data-remove-image=customLogoData]').isDisabled())failures.push('Remove logo becomes enabled without an image after save');
 await page.locator('[name=brandName]').fill('Anterior');await page.locator('button[type=submit]').click();
 await page.evaluate(()=>{pendingAppearance.oldRelease=pendingAppearance.release;pendingAppearance.ui.dispose();pendingAppearance.owner='b';pendingAppearance.row={};pendingAppearance.ui.mount(document.querySelector('#appearanceRoot'));});
 await page.locator('[name=brandName]').fill('Siguiente');await page.locator('button[type=submit]').click();
 await page.evaluate(async()=>{pendingAppearance.oldRelease();await Promise.resolve();await Promise.resolve();});
 assert(await page.locator('[name=brandName]').isDisabled(),'Late completion from prior account cannot unlock the current save');
 await page.evaluate(()=>pendingAppearance.release());await page.getByText('Configuración guardada y aplicada.',{exact:true}).waitFor();
 await page.goto('http://127.0.0.1:4173/tests/chat-harness.html');
 await page.evaluate(async()=>{
  const {createTeamChat}=await import('../src/team-chat-ui.js');
  const q=window.pendingChat={layout:{},messages:[]};
  q.chat=createTeamChat({actor:()=> 'qa@example.invalid',can:()=>true,confirm:async()=>true,rpc:async(name,p)=>{
   if(name==='totus_chat_context')return {channels:[{id:'a',name:'Ensayo',member_role:'member'}],messages:[],members:[],layout:q.layout};
   if(name==='totus_chat_save_layout'){q.layout=p.p_layout;return q.layout;}
   if(name==='totus_chat_command')return {};
   throw Error('Unexpected '+name);
  }});await q.chat.mount(document.querySelector('#chatHarness'));
  const native=createImageBitmap;q.releases=[];window.createImageBitmap=async file=>{await new Promise(resolve=>{q.release=resolve;q.releases.push(resolve);});return native(file);};
 });
 await page.locator('[data-chat=open][data-id=a]').click();await chatAction(page,'alerts');
 const art=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=8;c.height=8;return c.toDataURL('image/png').split(',')[1];});
 await page.locator('[data-background-file]').setInputFiles({name:'background.png',mimeType:'image/png',buffer:Buffer.from(art,'base64')});
 await page.getByText('Preparando imagen…',{exact:true}).waitFor();
 await page.locator('[data-background-remove]').click();await page.evaluate(()=>pendingChat.release());
 await page.waitForFunction(()=>!document.querySelector('dialog [type=submit]').disabled);
 if(await page.locator('[name=chat_background]').inputValue()!=='default')failures.push('Removing a pending Chat background is undone by its late image result');
 await page.locator('[data-background-file]').setInputFiles({name:'first.png',mimeType:'image/png',buffer:Buffer.from(art,'base64')});
 await page.locator('[data-background-file]').setInputFiles({name:'second.png',mimeType:'image/png',buffer:Buffer.from(art,'base64')});
 await page.evaluate(()=>pendingChat.releases[1]());
 assert(await page.locator('dialog [type=submit]').isDisabled(),'Earlier image result cannot unlock the newer pending upload');
 await page.evaluate(()=>pendingChat.releases[2]());await page.getByText('Imagen preparada. Pulsa Guardar para aplicarla.',{exact:true}).waitFor();
 await page.locator('dialog [type=submit]').click();assert.equal(await page.evaluate(()=>pendingChat.layout.chat_background),'image');
 await chatAction(page,'alerts');
 await page.locator('[data-background-file]').setInputFiles({name:'damaged.png',mimeType:'image/png',buffer:Buffer.from('not an image')});
 await page.evaluate(()=>pendingChat.releases[3]());
 await page.getByText('No se pudo leer la imagen. Elige otro archivo JPG, PNG o WebP válido.',{exact:true}).waitFor();
 assert(await page.locator('dialog [type=submit]').isEnabled(),'A damaged image does not leave the dialog locked');
 assert.equal(await page.locator('[name=chat_background]').inputValue(),'image','The prior valid background survives an invalid replacement');
 await page.evaluate(()=>pendingChat.chat.reset());
 assert.deepEqual(failures,[]);console.log('Appearance pending operations: controls locked, no empty removal, cancelled Chat background cannot return OK');
}finally{await browser.close();}
