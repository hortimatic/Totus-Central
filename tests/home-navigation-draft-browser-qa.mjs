import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {startLocalServer} from './local-static-server.mjs';
import {clickModuleLink} from './ui-navigation.mjs';
const {chromium}=await import(process.env.TOTUS_PLAYWRIGHT_MODULE||'playwright');
const server=await startLocalServer(),browser=await chromium.launch({headless:true,channel:process.env.TOTUS_BROWSER_CHANNEL||(process.platform==='win32'?'msedge':undefined)});
try{
 const page=await browser.newPage();
 const source=readFileSync('tests/mock-supabase.js','utf8'),marker='const rpc=async (name,args={})=>{';
 assert(source.includes(marker));
 await page.route('**/tests/mock-supabase.js',route=>route.fulfill({contentType:'text/javascript',body:source.replace(marker,marker+"if(name==='totus_home_tasks_context')return {data:{rows:[],people:[{email:'qa@example.com',name:'QA'}],can_select_users:true},error:null};")}));
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await page.locator('[data-ht-user]').waitFor({state:'attached'});
 await page.locator('[data-ht-user]').selectOption('qa@example.com');
 await page.locator('[data-activity-toggle]').first().uncheck();
 await clickModuleLink(page,page.locator('#nav a[data-route=marcas]'));
 await page.locator('#pageTitle').filter({hasText:'Marcas'}).waitFor();
 assert.equal(await page.getByRole('heading',{name:'Cambios sin guardar',exact:true}).count(),0,'Consultative calendar/chart controls never dirty the business form');
 await clickModuleLink(page,page.locator('#nav a[data-route=inicio]'));
 await page.locator('#homePriceQuery').waitFor();
 await page.locator('#homePriceQuery').fill('Consulta de precio pendiente QA');
 await clickModuleLink(page,page.locator('#nav a[data-route=marcas]'));
 await page.getByRole('heading',{name:'Cambios sin guardar',exact:true}).waitFor();
 await page.getByRole('button',{name:'Cancelar',exact:true}).click();
 assert.equal(await page.locator('#homePriceQuery').inputValue(),'Consulta de precio pendiente QA','Real unsaved data remains protected');
 console.log('Home navigation: asynchronous user selector and chart controls are consultative; real price drafts remain protected. PASS');
}finally{await browser.close();await server?.close();}
