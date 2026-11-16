import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');
 await page.evaluate(async()=>{
  fixture.workspace.dispose();const {createTpvWorkspace}=await import('../src/totustpv/workspace.js');
  window.stockFixture={receipts:[],creates:0,steps:0,failRead:true};
  const items=[{id:'101:0',nativeProductId:101,name:'Artículo uno',reference:'SCAN1',stock:0,priceCents:150},
   {id:'102:3',nativeProductId:102,name:'Variante dos',reference:'SCAN2',stock:0,priceCents:200}];
  const adapter={mode:'qa',context:async()=>({stores:[{id:'shop',name:'Tienda QA'}],drawers:[{id:'drawer',storeId:'shop',name:'Caja QA'}],
   sessions:[{id:'session',storeId:'shop',drawerId:'drawer',status:'open'}]}),selectSession:async()=>{},categories:async()=>[],
   searchProducts:async({search})=>{await new Promise(r=>setTimeout(r,180));return search?items.filter(i=>i.reference===search):items;},
   stockReceipts:async()=>structuredClone(stockFixture.receipts),
   createStockReceipt:async({reason,lines})=>{stockFixture.creates++;const receipt={id:'receipt',reason,status:'pending',lines:lines.map((l,n)=>({label:l.name,quantity:l.quantity,operationId:'operation'+n,status:'pending'}))};stockFixture.receipts.push(receipt);return structuredClone(receipt);},
   getStockReceipt:async()=>structuredClone(stockFixture.receipts[0]),
   advanceStockReceipt:async()=>{stockFixture.steps++;const r=stockFixture.receipts[0];r.status='processing';const line=r.lines.find(l=>l.status!=='verified');
    if(stockFixture.failRead){stockFixture.failRead=false;line.status='uncertain';}else{line.status='verified';line.result={before:0,after:line.quantity};}
    if(r.lines.every(l=>l.status==='verified'))r.status='verified';return structuredClone(r);}
  };
  stockFixture.workspace=createTpvWorkspace({actor:()=>({id:'operator',active:true}),can:()=>true,canStock:()=>true,
   autoOpen:true,createLiveAdapter:()=>adapter});stockFixture.workspace.mount(document.querySelector('#tpv'));
 });
 await page.getByRole('button',{name:'Entrada de stock',exact:true}).click();
 const scanner=page.locator('[data-tpv-search]');await scanner.waitFor();
 for(const code of ['SCAN1','SCAN1','SCAN1','SCAN2']){await scanner.fill(code);await scanner.press('Enter');}
 await page.waitForFunction(()=>document.querySelectorAll('[data-tpv-stock-quantity]').length===2);
 assert.equal(await page.locator('[data-tpv-stock-quantity="101:0"]').inputValue(),'3','Rapid repeated scans accumulate while earlier lookup is in flight');
 assert.equal(await page.locator('[data-tpv-stock-quantity="102:3"]').inputValue(),'1');
 assert.equal(await page.evaluate(()=>stockFixture.workspace.hasDraft()),true);
 await page.locator('[data-tpv-stock-reason]').fill('Albarán 1582');
 await page.getByRole('button',{name:'Guardar entrada para revisar',exact:true}).click();
 await page.locator('[data-tpv-stock-run]').waitFor();
 assert.equal(await page.evaluate(()=>stockFixture.creates),1);assert.equal(await page.evaluate(()=>stockFixture.steps),0,'Saving the manifest does not receive stock');
 assert.equal(await page.evaluate(()=>stockFixture.workspace.hasDraft()),false);
 await page.evaluate(()=>stockFixture.workspace.mount(document.querySelector('#tpv')));
 await page.getByRole('button',{name:'Entrada de stock',exact:true}).click();
 await page.getByRole('button',{name:'Albarán 1582 · Preparada',exact:true}).click();
 await page.getByRole('button',{name:'Confirmar y registrar mercancía',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'pendiente de recuperar'}).waitFor();
 assert.equal(await page.evaluate(()=>stockFixture.steps),1);
 await page.getByRole('button',{name:'Recuperar y continuar entrada',exact:true}).click();
 await page.getByText('Entrada de mercancía verificada.',{exact:true}).waitFor();
 assert.equal(await page.locator('[data-tpv-stock-run]').count(),0);
 assert.equal(await page.evaluate(()=>stockFixture.creates),1);
 assert.deepEqual(await page.evaluate(()=>stockFixture.receipts[0].lines.map(l=>l.quantity)),[3,1]);
 await fs.mkdir('artifacts/totustpv-stock',{recursive:true});
 for(const width of [1440,768,390]){await page.setViewportSize({width,height:950});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,`No overflow ${width}`);
  await page.screenshot({path:`artifacts/totustpv-stock/${width}.png`,fullPage:true});}
 assert.deepEqual(errors,[]);console.log('PASS stock intake UI: queued rapid scans, repeated quantities, no write before confirmation, persisted manifest recovery, partial-result recovery and three widths. Synthetic native responses only.');
}finally{await page.close();await browser.close();if(server)await new Promise(r=>server.close(r));}
