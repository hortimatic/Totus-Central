import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true}),errors=[],cloud=new Map();
const ids=['cccccccc-cccc-4ccc-cccc-cccccccccccc','dddddddd-dddd-4ddd-dddd-dddddddddddd'];
async function account(index){
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),id=ids[index];page.on('pageerror',e=>errors.push(e.message));
 await page.exposeFunction('__persistInterface',async(owner,args)=>{
  assert.equal(owner,id);const before=cloud.get(id)||{revision:0};
  if(args.p_expected_revision!==before.revision)return {data:null,error:{message:'Tu apariencia cambió en otra ventana. Actualiza antes de guardar.'}};
  const saved={config:args.p_config,revision:before.revision+1};cloud.set(id,structuredClone(saved));return {data:saved,error:null};
 });
 await page.route('**/tests/mock-supabase.js',async route=>{
  const response=await route.fetch();let source=await response.text();
  source=source.replace("const userId='cccccccc-cccc-4ccc-cccc-cccccccccccc';","const userId='"+id+"';");
  source=source.replace('window.__mockDb=db;',()=>"window.__mockDb=db;db.profiles[0].ui_preferences="+JSON.stringify({reports:['keep'],...(cloud.has(id)?{interface:cloud.get(id)}:{})})+';');
  source=source.replace('rpc:async(name,args)=>{',`rpc:async(name,args)=>{
   if(name==='totus_save_my_appearance'){
    const result=await window.__persistInterface(session.user.id,args);
    if(!result.error)db.profiles[0].ui_preferences={...db.profiles[0].ui_preferences,interface:result.data};
    return result;
   }`);
  await route.fulfill({response,body:source});
 });
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html?role=encargado',{waitUntil:'networkidle'});
 await page.locator('#nav [data-route=configuracion]').waitFor();return page;
}
try{
 const a=await account(0),b=await account(1),go=p=>p.locator('#nav [data-route=configuracion]').click();
 await go(a);await a.locator('[name=brandName]').fill('Interfaz de Ana');await a.locator('[name=borderColor]').fill('#dd1122');
 const image=await a.evaluate(()=>{const c=document.createElement('canvas');c.width=32;c.height=32;c.getContext('2d').fillRect(8,8,16,16);return c.toDataURL('image/png').split(',')[1];});
 await a.locator('[data-image=customLogoData]').setInputFiles({name:'logo.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});await a.waitForFunction(()=>document.querySelector('[name=logoMode]').value==='uploaded');
 await a.locator('#appearanceRoot [type=submit]').click();await a.getByText('Configuración guardada y aplicada.',{exact:true}).waitFor();
 const savedLogo=await a.locator('#app .sidebar>.brand img').getAttribute('src');assert(savedLogo.startsWith('data:image/webp'));
 await a.reload({waitUntil:'networkidle'});assert.equal(await a.locator('#app .sidebar>.brand b').textContent(),'Interfaz de Ana','Saved appearance must be applied by real boot after reload');
 assert.equal(await a.locator('#app .sidebar>.brand img').getAttribute('src'),savedLogo,'Logo persists through reload');
 assert.equal(await b.locator('#app .sidebar>.brand b').textContent(),'Totus Central','Other account stays independent');
 await go(b);await b.locator('[name=brandName]').fill('Interfaz de Bruno');await b.locator('#appearanceRoot [type=submit]').click();await b.getByText('Configuración guardada y aplicada.',{exact:true}).waitFor();
 await b.reload({waitUntil:'networkidle'});assert.equal(await b.locator('#app .sidebar>.brand b').textContent(),'Interfaz de Bruno');
 await a.reload({waitUntil:'networkidle'});assert.equal(await a.locator('#app .sidebar>.brand b').textContent(),'Interfaz de Ana');
 await go(a);await a.locator('[data-appearance-group="3"]').evaluate(el=>el.open=false);await a.locator('[data-jump="3"]').click();assert(await a.locator('[data-appearance-group="3"]').evaluate(el=>el.open),'Quick navigation opens its settings group');assert.equal(await a.locator('[name=borderColor]').inputValue(),'#dd1122');
 await a.locator('[data-appearance-tab=login]').click();assert(await a.locator('#appearanceRoot [type=submit]').isDisabled(),'Personal editing does not grant shared Login editing');
 assert.deepEqual(await a.evaluate(()=>window.__mockDb.profiles[0].ui_preferences.reports),['keep']);
 assert.equal(await a.evaluate(()=>window.__mockDb.ops_business_settings[0].appearance_config),undefined,'No write to organization appearance');
 assert.deepEqual(errors,[]);console.log('Personal interface browser: real app boot, reload, two accounts, logo bytes, border, profile siblings and shared Login permissions OK');
}finally{await browser.close();}
