import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');
 await page.evaluate(async()=>{
  fixture.workspace.dispose();const {createTpvWorkspace}=await import('../src/totustpv/workspace.js');
  window.tableFixture={prefs:{viewMode:'table',initialCategoryId:0,columns:['photo','name','reference','stock','price']},queries:[],writes:[]};
  const items=Array.from({length:50},(_,n)=>({id:(n+1)+':0',nativeProductId:n+1,name:'Artículo '+String(n+1).padStart(2,'0'),reference:'REF'+(n+1),stock:50-n,priceCents:(n+1)*100}));
  const adapter={mode:'qa',context:async()=>({stores:[{id:'shop',name:'Tienda QA'}],drawers:[{id:'drawer',storeId:'shop',name:'Caja QA',connectionId:'connection',shopId:1}],sessions:[{id:'session',storeId:'shop',drawerId:'drawer',status:'open'}]}),
   selectSession:async()=>{},categories:async()=>[],searchProducts:async q=>{tableFixture.queries.push(q);
    const key={name:'name',stock:'stock',reference:'reference',id:'nativeProductId'}[q.sortField]||'name';
    const ordered=[...items].sort((a,b)=>(typeof a[key]==='number'?a[key]-b[key]:String(a[key]).localeCompare(String(b[key]),'es',{numeric:true}))*(q.sortDirection==='desc'?-1:1));
    const result=ordered.slice((q.page||0)*20,((q.page||0)+1)*20);Object.defineProperty(result,'hasMore',{value:((q.page||0)+1)*20<items.length});return result;}};
  tableFixture.workspace=createTpvWorkspace({actor:()=>({id:'operator',active:true}),can:()=>true,autoOpen:true,createLiveAdapter:()=>adapter,
   workspacePreferences:async(drawer,value)=>{if(value){tableFixture.writes.push(value);Object.assign(tableFixture.prefs,value);}return structuredClone(tableFixture.prefs);}});
  tableFixture.workspace.mount(document.querySelector('#tpv'));
 });
 await page.locator('.tpv-catalogue-table').waitFor();
 assert.equal(await page.locator('.tpv-catalogue-table tbody tr').count(),20);
 await page.locator('[data-tpv-sort=stock]').click();
 assert.equal(await page.locator('td[data-tpv-column=stock]').first().innerText(),'1');
 await page.getByRole('button',{name:'Siguiente',exact:true}).click();
 assert.equal(await page.locator('td[data-tpv-column=stock]').first().innerText(),'21','Page two continues the whole-result order');
 await page.locator('[data-tpv-sort=stock]').click();
 assert.equal(await page.locator('td[data-tpv-column=stock]').first().innerText(),'50','Changing direction resets pagination');
 assert.equal(await page.evaluate(()=>tableFixture.queries.at(-1).page),0);
 assert.equal(await page.evaluate(()=>tableFixture.prefs.sortDirection),'desc');
 await page.locator('.tpv-columns>summary').click();
 await page.locator('[data-tpv-columns-panel] .tc-settings-header').waitFor();
 assert.equal(await page.locator('[data-tpv-columns-panel] .tc-settings-header').count(),1,'Common Central configurator');
 assert.equal(await page.locator('[data-tpv-column-check=cost]').count(),0,'Costs are not offered without Products access');
 await page.locator('[data-tpv-column-check=reference]').uncheck();
 await page.locator('[data-tpv-column-check=supplier]').check();
 await page.locator('[data-tpv-column-position=supplier]').selectOption({value:'1'});
 await page.getByRole('button',{name:'Guardar distribución',exact:true}).click();
 await page.getByText('Columnas guardadas en tu cuenta.',{exact:true}).waitFor();
 assert.deepEqual(await page.evaluate(()=>tableFixture.prefs.columns),['photo','supplier','name','stock','price']);
 await page.evaluate(()=>tableFixture.workspace.mount(document.querySelector('#tpv')));
 await page.locator('.tpv-catalogue-table').waitFor();
 assert.equal(await page.locator('td[data-tpv-column=reference]').count(),0);
 assert.equal(await page.locator('.tpv-catalogue-table thead th').nth(1).innerText(),'Proveedor ↕');
 assert.equal(await page.evaluate(()=>tableFixture.workspace.hasDraft()),false,'Table controls never create an edited sale');
 await fs.mkdir('artifacts/totustpv-table',{recursive:true});
 for(const width of [1440,768,390]){await page.setViewportSize({width,height:950});
  await page.locator('.tpv-columns>summary').click();await page.locator('[data-tpv-column-search]').fill('existencias');
  const box=await page.locator('[data-tpv-columns-panel]').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1);
  assert.ok(box.y>=0&&box.y+box.height<=950);
  await page.getByRole('button',{name:'Cerrar columnas',exact:true}).click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  await page.screenshot({path:`artifacts/totustpv-table/${width}.png`,fullPage:true});}
 assert.deepEqual(errors,[]);console.log('PASS catalogue table: common column editor, role-limited costs, persisted visibility/order, whole-result sort/page parameters, reset page on direction and three viewport sizes. Synthetic catalogue source.');
}finally{await page.close();await browser.close();if(server)await new Promise(r=>server.close(r));}
