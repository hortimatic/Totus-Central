import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {startLocalServer} from './local-static-server.mjs';
const {chromium}=await import('playwright'),server=await startLocalServer();
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4173/tests/prestashop-harness.html');await page.addStyleTag({url:'http://127.0.0.1:4173/src/contact-directory.css'});
 await page.evaluate(async()=>{
  const {createContactDirectoryUI,directoryPageHtml}=await import('../src/contact-directory-ui.js');
  const q=window.unionQA={actor:'union-user',canView:true,calls:[],saved:null,disableH:false,hold:false,release:null,rows:{hortimatic:[{id:'1',firstname:'Origen',lastname:'Uno',email:'origen@example.invalid',active:'1'},{id:'2',firstname:'Origen',lastname:'Dos',active:'1'}],newoldsmok:[{id:'1',firstname:'Destino',lastname:'Uno',email:'destino@example.invalid',active:'1'},{id:'2',firstname:'Destino',lastname:'Dos',active:'1'}]}};
  const connections=()=>['hortimatic','newoldsmok'].map((shop,i)=>({id:i?'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb':'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'PrestaShop · '+(i?'NewOldSmok':'Hortimatic'),protocol:'prestashop',enabled:!(shop==='hortimatic'&&q.disableH),configured:true,revision:1,verified_revision:1,real_data_authorized:true}));
  document.querySelector('#chatHarness').innerHTML=directoryPageHtml('clientes','<p>Clientes locales</p>');
  q.ui=createContactDirectoryUI({actor:()=>q.actor,can:(_kind,op)=>op==='view'?q.canView:true,confirm:async()=>true,notify:()=>{},rpc:async(name,args)=>{if(name==='totus_directory_context')return {connections:connections()};if(name==='totus_directory_table'){if(args.p_layout){if(args.p_layout.source==='both')throw Error('La vista conjunta no es una conexión de escritura');q.saved=structuredClone(args.p_layout);}return q.saved;}if(name==='totus_directory_views')return [];throw Error(name);},invoke:async b=>{
   q.calls.push(structuredClone(b));const out={...b,ok:true};
   if(b.action==='prestashop_directory_read'){
    if(q.hold&&b.store==='hortimatic'&&b.resource==='customers')await new Promise(resolve=>q.release=resolve);
    const lang=b.store==='hortimatic'?'1':'2';let rows=[];
    if(b.resource==='customers')rows=b.record_id?q.rows[b.store].filter(r=>r.id===b.record_id):q.rows[b.store];
    if(b.resource==='languages')rows=[{id:lang,iso_code:'es',active:'1'}];
    if(b.resource==='groups')rows=[{id:'3',name:[{id:lang,value:'Clientes'}]}];
    if(b.resource==='addresses')rows=(b.customer_ids||b.filters?.customer_ids||[]).map(id=>({id:String(100+Number(id)),id_customer:id,id_country:'6',deleted:'0',phone:b.store==='hortimatic'?'111111111':'222222222',address1:b.store+' · dirección',city:'Madrid'}));
    if(b.resource==='countries')rows=[{id:'6',name:[{id:lang,value:'España'}]}];
    return {...out,rows,possibly_more:false};
   }
   if(b.action==='prestashop_directory_prepare')return {...out,can_commit:true,fingerprint:'a'.repeat(64)};
   if(b.action==='prestashop_directory_commit'){const row=b.operation==='create'?{id:'3'}:q.rows[b.store].find(r=>r.id===b.record_id);Object.assign(row,b.fields);if(b.operation==='create')q.rows[b.store].push(row);return {...out,record_id:row.id,persisted:true,verified:true};}
   throw Error(b.action);
  }});await q.ui.mount(document.querySelector('[data-directory-root]'));
 });
 const both=async(count=2)=>{await page.getByRole('button',{name:'Ambas tiendas',exact:true}).click();await page.getByRole('status').filter({hasText:'Hortimatic: '+count+' clientes · NewOldSmok: 2 clientes'}).waitFor();};
 await both();assert.equal(await page.locator('.directory-table tbody tr').count(),4);
 assert.equal(await page.locator('[data-directory-record="hortimatic:1"]').count(),1);assert.equal(await page.locator('[data-directory-record="newoldsmok:1"]').count(),1);
 assert.match(await page.locator('.directory-table').innerText(),/111111111/);assert.match(await page.locator('.directory-table').innerText(),/222222222/);
 await page.locator('[data-directory-search]').fill('Destino');assert.equal(await page.locator('.directory-table tbody tr').count(),2);await page.getByRole('button',{name:'Limpiar',exact:true}).click();
 await page.getByLabel('Seleccionar esta página',{exact:true}).check();assert.equal(await page.locator('[data-directory-select]:checked').count(),4);await page.getByLabel('Seleccionar esta página',{exact:true}).uncheck();
 await page.locator('[data-directory-select="newoldsmok:1"]').check();const ready=page.waitForEvent('download');await page.getByRole('button',{name:'CSV',exact:true}).click();const csv=await readFile(await (await ready).path(),'utf8');assert.match(csv,/Tienda/);assert.match(csv,/NewOldSmok/);assert.doesNotMatch(csv,/Origen/);
 await page.getByRole('button',{name:'Configurar columnas',exact:true}).click();await page.locator('[data-directory-column-search]').fill('Email');assert.equal(await page.locator('.directory-column-list>.tc-column-row:visible').count(),1);await page.locator('[data-column=email]').uncheck();assert.equal(await page.locator('.directory-column-list>.tc-column-row:visible').count(),1);await page.locator('[data-column=email]').check();await page.getByRole('button',{name:'Cerrar columnas',exact:true}).click();
 await page.locator('[data-directory-record="newoldsmok:1"]').click();await page.locator('dialog input[name=firstname]').waitFor();assert.equal(await page.locator('dialog input[name=firstname]').inputValue(),'Destino');
 await page.locator('dialog input[name=firstname]').fill('Destino actualizado');await page.getByRole('button',{name:'Publicar cambios en NewOldSmok',exact:true}).click();await page.waitForFunction(()=>unionQA.rows.newoldsmok[0].firstname==='Destino actualizado');
 assert.equal(await page.evaluate(()=>unionQA.rows.hortimatic[0].firstname),'Origen');assert.equal(await page.evaluate(()=>unionQA.calls.filter(c=>c.action==='prestashop_directory_commit').every(c=>c.store==='newoldsmok'&&c.record_id==='1')),true);
 await page.locator('dialog').waitFor({state:'detached'});await both();assert.match(await page.locator('.directory-table').innerText(),/Destino actualizado/);
 for(const width of [390,768,1440,1920]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'No combined directory page overflow at '+width);const heights=await page.locator('.directory-sources button').evaluateAll(buttons=>buttons.map(b=>Math.round(b.getBoundingClientRect().height)));assert.equal(new Set(heights).size,1,'Source controls keep equal heights');}
 await page.evaluate(()=>unionQA.ui.mount(document.querySelector('[data-directory-root]')));await page.getByRole('status').filter({hasText:'Hortimatic: 2 clientes · NewOldSmok: 2 clientes'}).waitFor();assert.equal(await page.locator('[data-directory-source=both]').getAttribute('aria-pressed'),'true');
 await page.locator('[data-directory-create-store=hortimatic]').click();await page.locator('dialog input[name=firstname]').waitFor();await page.locator('dialog input[name=firstname]').fill('Nuevo H');await page.locator('dialog input[name=lastname]').fill('QA');await page.locator('dialog input[name=email]').fill('nuevo@example.invalid');await page.getByRole('button',{name:'Publicar cambios en Hortimatic',exact:true}).click();await page.waitForFunction(()=>unionQA.rows.hortimatic.length===3);await page.locator('dialog').waitFor({state:'detached'});assert.equal(await page.evaluate(()=>unionQA.rows.newoldsmok.length),2);await both(3);
 await page.evaluate(()=>unionQA.disableH=true);await page.getByRole('button',{name:'Actualizar',exact:true}).click();await page.getByRole('status').filter({hasText:'Hortimatic: No disponible'}).waitFor();assert.equal(await page.locator('.directory-table tbody tr').count(),2,'An unavailable store does not erase the other store or claim complete coverage');
 await page.evaluate(()=>{unionQA.disableH=false;unionQA.hold=true;});await page.getByRole('button',{name:'Actualizar',exact:true}).click();await page.waitForFunction(()=>typeof unionQA.release==='function');await page.locator('.directory-internal-tools>summary').click();await page.getByRole('button',{name:'Referencias internas de Totus',exact:true}).click();await page.evaluate(()=>{unionQA.hold=false;unionQA.release();});await page.waitForTimeout(50);assert.equal(await page.locator('[data-directory-local]').isVisible(),true);assert.equal(await page.locator('[data-directory-source=local]').getAttribute('aria-pressed'),'true');
 await page.evaluate(()=>{unionQA.canView=false;return unionQA.ui.mount(document.querySelector('[data-directory-root]'));});assert.equal(await page.getByRole('button',{name:'Ambas tiendas',exact:true}).isDisabled(),true);assert.equal(await page.locator('[data-directory-local]').isVisible(),true);
 assert.deepEqual(errors,[]);console.log('COMBINED CUSTOMERS: full two-store snapshots, address/language isolation, same native IDs, correct-store edit/readback, source restoration, partial store failure, late response cancellation and four widths PASS; fictional adapters only.');
}finally{await browser.close();await server?.close();}
