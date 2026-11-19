import assert from 'node:assert/strict';import {chromium} from 'playwright';import {mkdir} from 'node:fs/promises';import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true});
try{const context=await browser.newContext();await context.route('**/*',route=>{
 const url=new URL(route.request().url());if(url.origin!=='http://127.0.0.1:4173')return route.abort('blockedbyclient');
 if(url.pathname==='/clientes')return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="es"><title>Clientes de prueba</title><p>Consulta ficticia</p></html>'});return route.continue();});
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');
 await page.evaluate(async()=>{
  fixture.workspace.dispose();const {createTpvWorkspace}=await import('/src/totustpv/workspace.js');
  window.menuFixture={actor:'owner',saved:new Map(),failNext:false,writes:0};const drawer={id:'drawer',storeId:'store',connectionId:'connection',shopId:1,name:'Caja A',canSell:true,canOpen:true,canReconcile:true};
  menuFixture.workspace=createTpvWorkspace({actor:()=>({id:menuFixture.actor,active:true}),can:()=>true,autoOpen:true,
   createLiveAdapter:()=>({mode:'qa',context:async()=>({stores:[{id:'store',name:'Tienda A'}],drawers:[drawer],sessions:[{id:'session',storeId:'store',drawerId:'drawer',status:'open'}]}),selectSession:async()=>{},categories:async()=>[],searchProducts:async()=>[{id:'1:0',name:'Artículo conservado',stock:10,priceCents:150}]}),
   canReturnPolicy:()=>menuFixture.editReturns!==false,
   returnPolicyStore:async(drawer,value)=>{if(value){menuFixture.returnPolicy=structuredClone(value);if(menuFixture.losePolicy){menuFixture.losePolicy=false;throw Error('Respuesta de devoluciones perdida');}}return menuFixture.returnPolicy||{allowPartial:true};},
   menuLinksStore:async(drawer,value)=>{const key=menuFixture.actor+':'+drawer.id;if(value){menuFixture.writes++;menuFixture.saved.set(key,structuredClone(value));if(menuFixture.failNext){menuFixture.failNext=false;throw Error('Respuesta perdida: vuelve a guardar los mismos accesos.');}}if(!value&&menuFixture.deferRead){menuFixture.deferRead=false;const result=structuredClone(menuFixture.saved.get(key)||[]);await new Promise(resolve=>menuFixture.releaseRead=resolve);return result;}if(value&&menuFixture.deferNext){menuFixture.deferNext=false;const result=structuredClone(menuFixture.saved.get(key));await new Promise(resolve=>menuFixture.release=resolve);return result;}return menuFixture.saved.get(key)||[];}});
  menuFixture.workspace.mount(document.querySelector('#tpv'));
 });
 await page.locator('[data-tpv-add]').waitFor();await page.locator('[data-tpv-add]').click();
 await page.getByText('Más acciones',{exact:true}).click();await page.getByRole('button',{name:'Configuración',exact:true}).click();
 assert.equal(await page.locator('[name=allowPartial]').isChecked(),true);
 await page.locator('[name=allowPartial]').uncheck();await page.evaluate(()=>menuFixture.losePolicy=true);
 await page.getByRole('button',{name:'Guardar devoluciones',exact:true}).click();await page.getByRole('alert').filter({hasText:'Respuesta de devoluciones perdida'}).waitFor();
 assert.equal(await page.locator('[name=allowPartial]').isChecked(),false);
 await page.getByRole('button',{name:'Guardar devoluciones',exact:true}).click();await page.getByText('Configuración de devoluciones guardada para esta caja.',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>menuFixture.returnPolicy.allowPartial),false);
 await page.evaluate(()=>menuFixture.editReturns=false);
 await page.getByRole('button',{name:'Venta',exact:true}).click();await page.getByText('Más acciones',{exact:true}).click();await page.getByRole('button',{name:'Configuración',exact:true}).click();
 assert.equal(await page.locator('[name=allowPartial]').isDisabled(),true);
 assert.equal(await page.getByRole('button',{name:'Guardar devoluciones',exact:true}).count(),0);
 await page.evaluate(()=>menuFixture.editReturns=true);
 await page.getByRole('button',{name:'Venta',exact:true}).click();await page.getByText('Más acciones',{exact:true}).click();await page.getByRole('button',{name:'Configuración',exact:true}).click();
 assert.equal(await page.locator('[name=allowPartial]').isChecked(),false,'The drawer policy survives reopening configuration');

 assert.equal(await page.locator('.tpv-menu-link-row:not([hidden])').count(),1);
 await page.getByRole('button',{name:'Añadir acceso',exact:true}).click();assert.equal(await page.locator('.tpv-menu-link-row:not([hidden])').count(),2);
 await page.locator('[name=menu-label-1]').fill('Temporal');await page.locator('[name=menu-url-1]').fill('/ventas');
 await page.getByRole('button',{name:'Quitar acceso 2',exact:true}).click();assert.equal(await page.locator('.tpv-menu-link-row:not([hidden])').count(),1);assert.equal(await page.locator('[name=menu-url-1]').inputValue(),'');
 await page.locator('[name=menu-label-0]').fill('Clientes');await page.locator('[name=menu-url-0]').fill('/clientes');await page.evaluate(()=>menuFixture.failNext=true);
 await page.getByRole('button',{name:'Guardar accesos',exact:true}).click();await page.getByRole('alert').filter({hasText:'Respuesta perdida'}).waitFor();
 assert.equal(await page.locator('[name=menu-url-0]').inputValue(),'/clientes');assert.equal(await page.evaluate(()=>menuFixture.workspace.hasDraft()),true);
 await page.getByRole('button',{name:'Guardar accesos',exact:true}).click();await page.getByText('Accesos guardados para tu cuenta y esta caja.',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>menuFixture.saved.get('owner:drawer').length),1);assert.equal(await page.evaluate(()=>menuFixture.writes),2);
 await page.getByText('Más acciones',{exact:true}).click();const newTab=context.waitForEvent('page');await page.getByRole('link',{name:'Clientes ↗',exact:true}).click();const popup=await newTab;await popup.waitForLoadState();assert.equal(new URL(popup.url()).pathname,'/clientes');assert.equal(await popup.evaluate(()=>opener===null),true);await popup.close();
 await page.getByRole('button',{name:'Venta',exact:true}).click();assert.equal(await page.locator('[data-tpv-quantity]').inputValue(),'1');
 await page.getByText('Más acciones',{exact:true}).click();await page.getByRole('button',{name:'Configuración',exact:true}).click();assert.equal(await page.locator('[name=menu-label-0]').inputValue(),'Clientes');
 await mkdir('artifacts/totustpv-menu-links',{recursive:true});for(const width of [1440,390]){await page.setViewportSize({width,height:950});await page.locator('.tpv-menu-links').scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);await page.screenshot({path:`artifacts/totustpv-menu-links/settings-${width}.png`,fullPage:true});}
 await page.locator('[name=menu-url-0]').fill('https://example.invalid/?token=private');await page.getByRole('button',{name:'Guardar accesos',exact:true}).click();await page.getByRole('alert').filter({hasText:'tokens'}).waitFor();assert.equal(await page.evaluate(()=>menuFixture.writes),2);
 await page.locator('[name=menu-label-0]').fill('Guardado de la cuenta anterior');await page.locator('[name=menu-url-0]').fill('/ventas');await page.evaluate(()=>menuFixture.deferNext=true);
 await page.getByRole('button',{name:'Guardar accesos',exact:true}).click();await page.waitForFunction(()=>typeof menuFixture.release==='function');
 await page.evaluate(()=>{menuFixture.actor='other';menuFixture.workspace.mount(document.querySelector('#tpv'));});await page.locator('[data-tpv-search]').waitFor();await page.getByText('Más acciones',{exact:true}).click();assert.equal(await page.locator('[data-tpv-menu-link]').count(),0);
 await page.evaluate(async()=>{menuFixture.release();await new Promise(resolve=>setTimeout(resolve,0));});await page.getByRole('button',{name:'Venta',exact:true}).click();await page.getByText('Más acciones',{exact:true}).click();assert.equal(await page.locator('[data-tpv-menu-link]').count(),0,'A late save cannot populate another account menu');
 await page.evaluate(()=>{menuFixture.saved.set('other:drawer',Array.from({length:6},(_,i)=>({label:'Acceso largo '+i+' '+('W'.repeat(25)),url:'/clientes?vista='+i})));menuFixture.workspace.mount(document.querySelector('#tpv'));});await page.locator('[data-tpv-search]').waitFor();
 for(const height of [568,400]){await page.setViewportSize({width:390,height});await page.locator('.tpv-actions').evaluate(el=>el.open=false);await page.getByText('Más acciones',{exact:true}).click();await page.waitForFunction(()=>{const p=document.querySelector('.tpv-actions>div'),r=p.getBoundingClientRect();return p.style.maxHeight!==''&&r.top>=0&&r.bottom<=innerHeight;});
  assert.equal(await page.locator('.tpv-actions>div').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),true,'The long action menu fits the available viewport');
  await page.locator('.tpv-actions>div').evaluate(el=>el.scrollTop=el.scrollHeight);assert.equal(await page.getByRole('button',{name:'Salir del puesto',exact:true}).evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
 }
 await page.evaluate(()=>{menuFixture.deferRead=true;menuFixture.workspace.mount(document.querySelector('#tpv'));});
 await page.waitForFunction(()=>typeof menuFixture.releaseRead==='function');
 await page.evaluate(()=>{menuFixture.actor='third';menuFixture.workspace.mount(document.querySelector('#tpv'));});
 await page.locator('[data-tpv-search]').waitFor();
 await page.evaluate(async()=>{menuFixture.releaseRead();await new Promise(resolve=>setTimeout(resolve,0));});
 await page.getByText('Más acciones',{exact:true}).click();
 assert.equal(await page.locator('[data-tpv-menu-link]').count(),0,'A late initial settings read cannot populate another account menu');
 assert.deepEqual(errors,[]);console.log('PASS menu links browser: save/readback, lost reply retry, external tab with no opener, current ticket preserved, unsafe URL refusal before write, account isolation and1440/390 without overflow. Synthetic persistence only.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
