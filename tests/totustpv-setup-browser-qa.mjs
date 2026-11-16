import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html?module=tpv',{waitUntil:'networkidle'});
 await page.locator('#totusTpvRoot').waitFor();
 await page.evaluate(async()=>{
  const {sb}=await import('../src/api.js'),original=sb.rpc.bind(sb);
  const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
  window.tpvSetupQA={reads:0,fail:false};
  sb.rpc=async(name,args)=>{
   if(name!=='totus_sales_context')return original(name,args);
   tpvSetupQA.reads++;if(tpvSetupQA.fail)return {data:null,error:{message:'Consulta temporalmente no disponible.'}};
   const websites=[{key:'web-qa',name:'Portal QA',origin:'https://shop.example.invalid',status:'active',business_id:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',connection_id:id(1)},
    {key:'web-preprod',name:'Preproducción QA',origin:'https://preprod.example.invalid',status:'active',business_id:null,connection_id:id(2)}];
   return {data:{websites,businesses:[{id:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',name:'Establecimiento QA'}],
    connections:websites.map(row=>({id:row.connection_id,protocol:'prestashop',store_key:row.key,website_origin:row.origin,
     revision:5,verified_revision:5,enabled:true,configured:true,real_data_authorized:true}))},error:null};
  };
 });
 assert.equal(await page.evaluate(()=>tpvSetupQA.reads),0,'No extra startup request');
 assert.equal(await page.getByRole('button',{name:'Comprobar conexión',exact:true}).isVisible(),false,'Administration is outside the daily entry');
 await page.getByText('Administrar tiendas y cajas',{exact:true}).click();
 await page.getByRole('button',{name:'Comprobar conexión',exact:true}).click();
 await page.locator('.tpv-setup article').nth(1).waitFor();
 assert.equal(await page.evaluate(()=>tpvSetupQA.reads),1);
 const mapped=page.locator('.tpv-setup article').filter({hasText:'Portal QA'});
 assert.match(await mapped.innerText(),/API verificada/);assert.match(await mapped.innerText(),/Caja Head.*Caja Vape/s);
 const unassigned=page.locator('.tpv-setup article').filter({hasText:'Preproducción QA'});
 assert.match(await unassigned.innerText(),/API verificada/);assert.match(await unassigned.innerText(),/Sin establecimiento asignado/);
 assert.doesNotMatch(await unassigned.innerText(),/Caja Head|Caja Vape/);
 assert.equal(await page.locator('[data-tpv-action=payment], [data-tpv-form=open]').count(),0,'Diagnostic cannot open or charge');
 await fs.mkdir('artifacts/totustpv-setup',{recursive:true});
 for(const width of [1440,768,390]){
  await page.setViewportSize({width,height:950});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  await page.screenshot({path:`artifacts/totustpv-setup/${width}.png`,fullPage:true});
 }
 await page.evaluate(()=>tpvSetupQA.fail=true);
 await page.getByRole('button',{name:'Comprobar conexión',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Consulta temporalmente'}).waitFor();
 assert.equal(await page.locator('.tpv-setup article').count(),0,'Failed refresh clears stale verification');
 await page.getByRole('button',{name:'Probar con datos ficticios'}).click();
 await page.getByRole('button',{name:'Abrir caja de práctica',exact:true}).waitFor();
 assert.deepEqual(errors,[]);
 console.log('PASS TPV setup UI: lazy authenticated context, exact website/business/drawer links, unassigned preproduction, blocked checkout, refresh failure without stale status and three widths. Fictional server metadata only.');
}finally{await page.close();await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
