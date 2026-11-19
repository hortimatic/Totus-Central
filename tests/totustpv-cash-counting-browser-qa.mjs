import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');
 await page.evaluate(async()=>{
  fixture.workspace.dispose();const {createTpvWorkspace}=await import('../src/totustpv/workspace.js');window.cashFixture={preferences:null,closes:[],loseClose:true};
  const adapter={mode:'qa',context:async()=>({stores:[{id:'shop',name:'Tienda de pruebas'}],drawers:[{id:'drawer',storeId:'shop',name:'Caja',canSell:true,canOpen:true,canReconcile:true}],sessions:[{id:'session',storeId:'shop',drawerId:'drawer',status:'open'}]}),
   selectSession:async()=>{},categories:async()=>[],searchProducts:async()=>[{id:'1:0',name:'Artículo',stock:5,priceCents:801}],
   quote:async()=>({id:'quote',totalCents:801,paymentMethods:['cash','card']}),discardQuote:async()=>{},
   sessionSummary:async()=>({openingCents:10000,salesCents:801,cashCents:801,expectedCashCents:10801,payments:{cash:801},unresolved:0}),
   closeSession:async data=>{cashFixture.closes.push(data);if(cashFixture.loseClose){cashFixture.loseClose=false;throw Error('Respuesta de cierre perdida');}return {status:'closed',differenceCents:0};}
  };
  cashFixture.workspace=createTpvWorkspace({actor:()=>({id:'operator',active:true}),can:()=>true,confirm:async()=>true,autoOpen:true,createLiveAdapter:()=>adapter,
   workspacePreferences:async(drawer,data)=>{if(data)cashFixture.preferences=structuredClone(data);return cashFixture.preferences;}});
  cashFixture.workspace.mount(document.querySelector('#tpv'));
 });
 await page.getByText('Más acciones',{exact:true}).click();await page.getByRole('button',{name:'Configuración',exact:true}).click();
 await page.getByLabel('Billetes y monedas',{exact:true}).selectOption([]);
 await page.getByRole('button',{name:'Guardar mostrador',exact:true}).click();await page.getByRole('alert').filter({hasText:'al menos un billete'}).waitFor();
 assert.deepEqual(errors,[],'An empty selection is a recoverable form error, not a render failure');
 await page.getByLabel('Billetes y monedas',{exact:true}).selectOption(['2000','500','100','1']);
 await page.getByRole('button',{name:'Guardar mostrador',exact:true}).click();await page.getByText('Mostrador guardado en tu cuenta.',{exact:true}).waitFor();
 assert.deepEqual(await page.evaluate(()=>cashFixture.preferences.cash.denominations),[2000,500,100,1]);
 assert.equal(await page.evaluate(()=>cashFixture.workspace.hasDraft()),false);
 await page.getByRole('button',{name:'Venta',exact:true}).click();await page.locator('[data-tpv-add="1:0"]').click();await page.locator('[data-tpv-action="payment"]').click();
 const pay=page.locator('[data-tpv-form="pay"]');await pay.waitFor();assert.equal(await pay.locator('[data-tpv-tender="10000"]').count(),0);
 await pay.locator('[data-tpv-count="received"] summary').click();
 await pay.locator('[name=receivedCoin2000]').fill('1');await pay.locator('[name=receivedCoin1]').fill('3');
 assert.equal(await pay.locator('[name=received]').inputValue(),'20,03');assert.match(await pay.locator('[data-tpv-change]').innerText(),/12,02/);
 await pay.locator('[name=receivedCoin1]').fill('1.5');assert.equal(await pay.evaluate(form=>form.checkValidity()),false);
 await pay.locator('[name=method]').selectOption('card');assert.equal(await pay.locator('[name=receivedCoin1]').isDisabled(),true);assert.equal(await pay.evaluate(form=>form.checkValidity()),true);
 await pay.locator('[name=method]').selectOption('cash');await pay.locator('[data-tpv-tender-exact]').click();assert.equal(await pay.evaluate(form=>form.checkValidity()),true);
 assert.equal(await pay.locator('[name=received]').inputValue(),'8,01');
 await page.getByRole('button',{name:'Volver al ticket',exact:true}).click();await page.locator('[data-tpv-remove="1:0"]').click();
 await page.getByRole('button',{name:'Caja',exact:true}).click();const close=page.locator('[data-tpv-form="close"]');await close.locator('[data-tpv-count="counted"] summary').click();
 for(const [name,value]of [['countedCoin2000','5'],['countedCoin500','1'],['countedCoin100','3'],['countedCoin1','1']])await close.locator(`[name=${name}]`).fill(value);
 assert.equal(await close.locator('[name=counted]').inputValue(),'108,01');
 await fs.mkdir('artifacts/totustpv-cash-counting',{recursive:true});
 for(const width of [1440,390]){await page.setViewportSize({width,height:950});await page.screenshot({path:`artifacts/totustpv-cash-counting/count-${width}.png`,fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,'Cash counter fits '+width);
  if(width===390)assert.equal(await page.locator('[data-tpv-form="movement"] input,[data-tpv-form="movement"] select').evaluateAll(fields=>fields.every(field=>field.getBoundingClientRect().width>=240)),true,'Movement fields remain usable on mobile');}
 await close.getByRole('button',{name:'Cerrar caja',exact:true}).click();await page.getByRole('alert').filter({hasText:'Respuesta de cierre perdida'}).waitFor();
 assert.equal(await close.locator('[name=counted]').inputValue(),'108,01');assert.equal(await close.locator('[name=countedCoin2000]').inputValue(),'5');
 await close.getByRole('button',{name:'Cerrar caja',exact:true}).click();await page.getByText('Caja cerrada. Diferencia:',{exact:false}).waitFor();
 assert.deepEqual(await page.evaluate(()=>cashFixture.closes.map(row=>row.countedCents)),[10801,10801]);assert.deepEqual(errors,[]);
 console.log('PASS cash counting browser: configured faces, empty-selection recovery, received total/change, invalid counts, card-switch validation, exact tender, closing total, preserved counts after lost reply and desktop/mobile. Synthetic responses; no physical cash certification.');
}finally{await page.close();await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
