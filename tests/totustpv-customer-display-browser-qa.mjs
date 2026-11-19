import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:950}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');
 await page.evaluate(async()=>{
  const {createCustomerDisplay}=await import('/src/totustpv/customer-display.js');
  window.screenFixture={allowed:true,canName:true,now:Date.now(),options:{enabled:true,showPrices:true,showCustomer:true,color:'#ffffff',fontSize:23},
   model:{storeName:'Tienda ficticia',environment:'qa',phase:'estimate',customerName:'Cliente ficticio',email:'NEVER_EMAIL',secret:'NEVER_SECRET',
    totalCents:1250,lines:[{name:'Artículo <img src=x onerror=alert(1)>',quantity:2,cents:1000},{name:'Otro artículo ficticio',quantity:1,cents:250}]}};
  screenFixture.controller=createCustomerDisplay({getState:()=>screenFixture.model,getOptions:()=>screenFixture.options,allowed:()=>screenFixture.allowed,
   canShowCustomer:()=>screenFixture.canName,clock:()=>screenFixture.now});
  const button=document.createElement('button');button.id='open-public';button.textContent='Abrir pantalla ficticia';button.onclick=()=>screenFixture.controller.open();document.body.append(button);
 });
 const waiting=page.waitForEvent('popup');await page.locator('#open-public').click();let display=await waiting;display.on('pageerror',e=>errors.push(e.message));
 await display.setViewportSize({width,height:950});await display.getByRole('heading',{name:'Tu compra',exact:true}).waitFor();
 await display.getByText('Hola, Cliente ficticio',{exact:true}).waitFor();assert.equal(await display.locator('img').count(),0,'Names are text, never markup');
 assert.equal(await display.evaluate(()=>window.opener),null);assert.equal((await display.content()).includes('NEVER_'),false);
 assert.equal(await display.locator('[data-display-amount]').innerText(),'12,50 €');
 assert.equal(await display.evaluate(()=>document.compatMode),'CSS1Compat');
 assert.equal(await display.locator('body').evaluate(el=>getComputedStyle(el).getPropertyValue('--display-on-accent').trim()),'#000000','Light colors automatically receive dark readable text');
 await page.evaluate(()=>{screenFixture.options.color='#1773c9';screenFixture.model.lines[0].name='Té verde · 100 g';screenFixture.model.lines[1].name='Taza de cerámica';screenFixture.controller.sync();});
 await display.screenshot({path:`artifacts/tpv-pantalla-cliente-${width}.png`,fullPage:true});
 await page.evaluate(()=>{screenFixture.shortLines=screenFixture.model.lines;screenFixture.model.lines=Array.from({length:100},(_,i)=>({name:'Artículo ficticio '+i,quantity:1,cents:100}));screenFixture.model.totalCents=1000000000000;screenFixture.controller.sync();});
 assert.equal(await display.locator('[data-display-lines]').evaluate(el=>el.scrollHeight>el.clientHeight),true,'Long tickets scroll within their own list');
 assert.equal(await display.locator('[data-display-total]').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),true,'The total remains visible on long tickets');
 assert.equal(await display.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 await page.evaluate(()=>{screenFixture.model.lines=screenFixture.shortLines;screenFixture.model.totalCents=1250;screenFixture.controller.sync();});
 await page.evaluate(()=>{screenFixture.options.showPrices=false;screenFixture.canName=false;screenFixture.controller.sync();});
 assert.equal(await display.locator('[data-display-total]').isVisible(),false);assert.equal(await display.locator('[data-display-lines] b').count(),0);
 assert.equal(await display.locator('[data-display-customer]').innerText(),'');assert.equal((await display.locator('body').innerText()).includes('12,50'),false);
 await page.evaluate(()=>{screenFixture.options.showPrices=true;screenFixture.options.color='#1773c9';screenFixture.model.phase='confirmed';screenFixture.controller.sync();});
 await display.getByRole('heading',{name:'Gracias por tu compra',exact:true}).waitFor();
 await page.evaluate(()=>{screenFixture.now+=16000;screenFixture.controller.sync();});await display.getByRole('heading',{name:'Bienvenido',exact:true}).waitFor();
 assert.equal(await display.locator('[data-display-lines] li').count(),0);assert.equal(await display.locator('[data-display-amount]').innerText(),'');
 await page.evaluate(()=>{screenFixture.now=Date.now();screenFixture.model.phase='verified';screenFixture.controller.sync();});
 await display.getByRole('heading',{name:'Todo listo para pagar',exact:true}).waitFor();
 await page.evaluate(()=>{screenFixture.now=Date.now()-11000;});
 await display.evaluate(()=>document.body.dataset.tpvHeartbeat=String(Date.now()-11000));await display.getByRole('heading',{name:'Pantalla en espera',exact:true}).waitFor({timeout:2500});
 assert.equal(await display.locator('[data-display-lines] li').count(),0);assert.equal(await display.locator('[data-display-amount]').innerText(),'');
 await page.evaluate(()=>{screenFixture.now=Date.now();screenFixture.controller.sync();});await display.getByRole('heading',{name:'Todo listo para pagar',exact:true}).waitFor();
 assert.equal(await display.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 await display.close();const reopening=page.waitForEvent('popup');await page.locator('#open-public').click();display=await reopening;
 await display.getByRole('heading',{name:'Todo listo para pagar',exact:true}).waitFor();
 const closed=display.waitForEvent('close');await page.evaluate(()=>{screenFixture.allowed=false;screenFixture.controller.sync();});await closed;
 assert.deepEqual(errors,[]);await page.close();
 }
 // Shared workspace integration: preferences, ticket updates and account/disposal cleanup.
 const page=await browser.newPage({viewport:{width:1440,height:950}});await page.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');
 await page.evaluate(async()=>{
  fixture.workspace.dispose();const {createTpvWorkspace}=await import('/src/totustpv/workspace.js');
  window.workspaceScreen={preferences:{customerDisplay:{enabled:true,showPrices:true,showCustomer:false,color:'#1773c9',fontSize:23}},writes:[]};
  const adapter={mode:'qa',context:async()=>({stores:[{id:'shop',name:'Tienda ficticia'}],drawers:[{id:'drawer',storeId:'shop',name:'Caja ficticia',connectionId:'connection',shopId:1,canSell:true,canOpen:true,canReconcile:true}],sessions:[{id:'session',storeId:'shop',drawerId:'drawer',status:'open'}]}),
   selectSession:async()=>{},categories:async()=>[],searchProducts:async()=>[{id:'1:0',name:'Artículo ficticio',stock:5,priceCents:350}],localBasketPrices:async({lines})=>new Promise(resolve=>workspaceScreen.finishPrices=()=>resolve({validUntil:Date.now()+60000,pricingContext:{roundMode:2,roundType:1,computingPrecision:6},lines:lines.map(line=>({...line,unitTaxInclMicros:3500000}))}))};
  workspaceScreen.workspace=createTpvWorkspace({actor:()=>({id:'operator',active:true}),can:()=>true,autoOpen:true,createLiveAdapter:()=>adapter,
   workspacePreferences:async(drawer,value)=>{if(value){workspaceScreen.writes.push(value);workspaceScreen.preferences={...workspaceScreen.preferences,...value};}return structuredClone(workspaceScreen.preferences);}});
  workspaceScreen.workspace.mount(document.querySelector('#tpv'));
 });
 await page.locator('[data-tpv-add]').waitFor();await page.getByText('Más acciones',{exact:true}).click();
 const waiting=page.waitForEvent('popup');await page.getByRole('button',{name:'Pantalla para cliente',exact:true}).click();const display=await waiting;
 await display.getByRole('heading',{name:'Bienvenido',exact:true}).waitFor();await page.getByText('Más acciones',{exact:true}).click();await page.locator('[data-tpv-add]').click();
 await display.getByText('Artículo ficticio',{exact:true}).waitFor();assert.equal(await display.locator('[data-display-total]').isVisible(),false,'Unknown basket price must not appear as a payable total');
 await page.waitForFunction(()=>typeof workspaceScreen.finishPrices==='function');await page.evaluate(()=>workspaceScreen.finishPrices());
 await display.waitForFunction(()=>document.querySelector('[data-display-amount]').textContent==='3,50 €');
 await page.getByText('Más acciones',{exact:true}).click();await page.getByRole('button',{name:'Configuración',exact:true}).click();
 await page.locator('[name=customer-display-fontSize]').selectOption('30');
 await page.locator('[name=customer-display-color]').evaluate(el=>{el.value='#c58e24';el.dispatchEvent(new Event('change',{bubbles:true}));});
 await page.getByRole('button',{name:'Guardar mostrador',exact:true}).click();await page.getByText('Mostrador guardado en tu cuenta.',{exact:true}).waitFor();
 assert.equal(await display.locator('body').evaluate(el=>getComputedStyle(el).fontSize),'30px');
 assert.equal(await display.locator('body').evaluate(el=>el.style.getPropertyValue('--display-accent')),'#c58e24');
 assert.equal(await page.evaluate(()=>workspaceScreen.workspace.hasDraft()),true,'The current unsold ticket remains a genuine draft');
 await page.locator('[name=customer-display-enabled]').uncheck();const closing=display.waitForEvent('close');await page.getByRole('button',{name:'Guardar mostrador',exact:true}).click();
 await closing;assert.equal(await page.evaluate(()=>workspaceScreen.writes.at(-1).customerDisplay.enabled),false);
 await page.evaluate(()=>workspaceScreen.workspace.dispose());await page.close();
 console.log('PASS customer display: desktop/mobile public projection, no contact/identity/payment payload, current name permission, prices off, escaped text, light/dark accent contrast, confirmation expiry, stale-parent cleanup, reconnect, permission cleanup and workspace preference/ticket integration. No remote shop or physical-monitor certification.');
}finally{await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
