import assert from 'node:assert/strict';import {mkdir} from 'node:fs/promises';import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer(),{chromium}=await import('playwright'),browser=await chromium.launch({headless:true,...(process.env.TOTUS_BROWSER_CHANNEL?{channel:process.env.TOTUS_BROWSER_CHANNEL}:{})});
await mkdir('artifacts/prestashop-automations',{recursive:true});
try{for(const width of [390,1017,1440]){
 const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4173/tests/prestashop-harness.html');
 await page.evaluate(async()=>{
  const {createPrestashopAutomations}=await import('../src/prestashop-automations-ui.js');const qa=window.autoQA={calls:[],rules:[],runs:[],owner:'one',count:0};
  document.querySelector('#chatHarness').innerHTML='<section class="ps-workspace"><div id="auto-test"></div></section>';
  qa.component=createPrestashopAutomations({actor:()=>qa.owner,can:()=>true,read:async(store,resource,p)=>({ok:true,store,resource,page:p.page,possibly_more:false,rows:[{id:'1',name:'Producto A',ean13:''},{id:'2',name:'Producto B',ean13:''}]}),rpc:async(name,args)=>{
   qa.calls.push({name,args:structuredClone(args)});const p=args.p_data||{},row=qa.rules.find(r=>r.id===p.id);
   if(args.p_action==='save'){if(row)Object.assign(row,p,{revision:row.revision+1});else qa.rules.push({...p,id:crypto.randomUUID(),revision:1,created_at:new Date().toISOString()});}
   if(args.p_action==='toggle')row.enabled=!row.enabled;if(args.p_action==='remove')qa.rules=qa.rules.filter(r=>r.id!==p.id);
   return {rules:structuredClone(qa.rules),channels:[{id:'11111111-1111-4111-8111-111111111111',name:'Avisos de prueba',group_name:'QA'}],runs:structuredClone(qa.runs)};
  }});await qa.component.mount(document.querySelector('#auto-test'));
 });
 const form=page.locator('[data-auto-form]');await form.locator('[name=name]').fill('Productos sin EAN');await form.locator('[name=recipe]').selectOption('missing_ean');await form.locator('[name=channel_id]').selectOption('11111111-1111-4111-8111-111111111111');await form.locator('[name=sharing_confirmed]').check();await form.locator('[name=enabled]').check();
 await page.getByRole('button',{name:'Probar sin enviar',exact:true}).click();await page.getByRole('heading',{name:'Resultado de prueba · no enviado'}).waitFor();assert.match(await page.locator('.ps-auto-preview pre').innerText(),/Producto A/);assert.equal(await page.evaluate(()=>autoQA.calls.filter(c=>c.args.p_action==='save').length),0);
 await form.getByRole('button',{name:'Guardar regla',exact:true}).click();await page.locator('.ps-auto-rules h4').filter({hasText:'Productos sin EAN'}).waitFor();assert.equal(await page.evaluate(()=>autoQA.rules[0].interval_hours),2);assert.equal(await page.locator('.ps-auto-rules').getByText('Activa',{exact:true}).count(),1);
 await page.locator('.ps-auto-rules').getByRole('button',{name:'Pausar',exact:true}).click();await page.locator('.ps-auto-rules').getByText('Pausada',{exact:true}).waitFor();
 await page.locator('.ps-auto-rules').getByRole('button',{name:'Configurar',exact:true}).click();await form.locator('[name=interval_hours]').selectOption('6');await form.locator('[name=sharing_confirmed]').check();await form.getByRole('button',{name:'Guardar cambios',exact:true}).click();await page.waitForFunction(()=>autoQA.rules[0].interval_hours===6);
 await page.locator('.ps-auto-rules').getByRole('button',{name:'Duplicar',exact:true}).click();assert.equal(await form.locator('[name=enabled]').isChecked(),false);await form.locator('[name=sharing_confirmed]').check();await form.getByRole('button',{name:'Guardar regla',exact:true}).click();await page.waitForFunction(()=>autoQA.rules.length===2);
 await page.screenshot({path:'artifacts/prestashop-automations/rules-'+width+'.png',fullPage:true});
 const item=page.locator('.ps-auto-rules>article').last();await item.getByRole('button',{name:'Eliminar',exact:true}).click();assert.equal(await page.evaluate(()=>autoQA.rules.length),2);await item.getByRole('button',{name:'Confirmar eliminación',exact:true}).click();await page.waitForFunction(()=>autoQA.rules.length===1);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual(errors,[]);await page.close();console.log('PASS automations '+width+': preview without sending, create, edit, duplicate paused, pause, remove, mobile layout');
}}finally{await browser.close();if(server)await new Promise(r=>server.close(r));}
