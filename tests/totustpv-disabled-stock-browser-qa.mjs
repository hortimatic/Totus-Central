import assert from 'node:assert/strict';import {chromium} from 'playwright';import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:950}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');
 await page.evaluate(async()=>{fixture.workspace.dispose();const {createTpvWorkspace}=await import('/src/totustpv/workspace.js');
  const active={id:'101:0',nativeProductId:101,name:'Habilitado',reference:'ACTIVE',stock:3,priceCents:150,saleEnabled:true};
  const disabled={id:'102:0',nativeProductId:102,name:'Deshabilitado',reference:'DISABLED',stock:0,priceCents:150,saleEnabled:false,chooseVariant:true};
  window.disabledFixture={calls:[],resolve:null,late:false};const f=disabledFixture;
  const adapter={mode:'qa',context:async()=>({stores:[{id:'store',name:'Tienda QA'}],drawers:[{id:'drawer',storeId:'store',name:'Caja QA',canSell:true,canOpen:true,canReconcile:true}],sessions:[{id:'session',storeId:'store',drawerId:'drawer',status:'open'}]}),selectSession:async()=>{},categories:async()=>[],stockReceipts:async()=>[],
   searchProducts:async query=>{f.calls.push(query);
    if(query.inventoryOnly&&query.search==='LATE'){await new Promise(resolve=>f.resolve=resolve);return [disabled];}
    if(query.productId===102)return [{...disabled,id:'102:1',chooseVariant:false,name:'Deshabilitado · Rojo'},{...disabled,id:'102:2',chooseVariant:false,name:'Deshabilitado · Azul'}];
    const rows=query.inventoryOnly?[active,disabled]:[active];return rows.filter(row=>!query.search||row.reference.includes(query.search));}
  };
  f.workspace=createTpvWorkspace({actor:()=>({id:'actor',active:true}),can:()=>true,canStock:()=>true,autoOpen:true,confirm:async()=>true,
   workspacePreferences:async()=>({search:{includeDisabledStock:true}}),createLiveAdapter:()=>adapter});f.workspace.mount(document.querySelector('#tpv'));
 });
 await page.locator('[data-tpv-add="101:0"]').waitFor();assert.equal(await page.locator('[data-tpv-add="102:0"]').count(),0);
 await page.getByText('Más acciones',{exact:true}).click();await page.getByRole('button',{name:'Entrada de stock',exact:true}).click();
 const checkbox=page.locator('[data-tpv-disabled-stock]');await page.locator('[data-tpv-stock="102:0"]').waitFor();assert.equal(await checkbox.isChecked(),true);
 await checkbox.uncheck();await page.locator('[data-tpv-stock="102:0"]').waitFor({state:'detached'});await checkbox.check();
 await page.locator('[data-tpv-stock="102:0"]').click();await page.locator('[data-tpv-stock="102:1"]').waitFor();
 await page.getByRole('button',{name:'Venta',exact:true}).click();await page.locator('[data-tpv-add="101:0"]').waitFor();
 assert.equal(await page.locator('.tpv-variant-dialog').count(),0);assert.equal(await page.locator('[data-tpv-add^="102:"]').count(),0);
 const saleQuery=await page.evaluate(()=>disabledFixture.calls.at(-1));assert.equal(saleQuery.productId,0);assert.equal(saleQuery.inventoryOnly,undefined);
 await page.getByText('Más acciones',{exact:true}).click();await page.getByRole('button',{name:'Entrada de stock',exact:true}).click();await checkbox.waitFor();
 await page.locator('[data-tpv-search]').fill('LATE');await page.waitForFunction(()=>typeof disabledFixture.resolve==='function');
 await page.getByRole('button',{name:'Venta',exact:true}).click();await page.evaluate(()=>disabledFixture.resolve());
 await page.locator('.tpv-product-list .tpv-empty').waitFor();assert.equal(await page.locator('[data-tpv-add^="102:"]').count(),0,'An old inventory result cannot populate the sale view');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);assert.deepEqual(errors,[]);
 await page.evaluate(()=>disabledFixture.workspace.dispose());await page.close();
}console.log('PASS disabled-stock UI desktop/mobile: saved default, temporary filter, disabled variants, stock-to-sale context reset and rejected late inventory response. Synthetic read service; no financial writes.');
}finally{await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
