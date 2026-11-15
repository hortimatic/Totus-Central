import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
import {buildModuleRoutes} from '../tools/build-module-routes.mjs';
import {MODULE_PATHS} from '../src/module-navigation.js';
const root=path.resolve('artifacts/module-paths-site');await fs.mkdir(root,{recursive:true});
for(const file of ['index.html','favicon.svg','fondo_original.png'])await fs.copyFile(file,path.join(root,file));
await fs.cp('src',path.join(root,'src'),{recursive:true});buildModuleRoutes(root);
const server=createServer(async(req,res)=>{try{let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/deployment(?=\/|$)/,'');let file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep))throw Error('Outside site');if((await fs.stat(file)).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':file.endsWith('.json')?'application/json':'text/html');res.end(await fs.readFile(file));}catch{res.statusCode=404;res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*.supabase.co/**',route=>route.fulfill({contentType:'application/json',body:'null'}));
 for(const prefix of ['', '/deployment'])for(const [id,segment] of Object.entries(MODULE_PATHS)){
  const response=await page.goto(origin+prefix+'/'+segment,{waitUntil:'load'});assert.equal(response.status(),200);await page.locator('#loginEmail').waitFor();
  const actual=await page.evaluate(async()=>{const nav=await import(new URL('src/module-navigation.js',document.baseURI));return {base:document.baseURI,module:nav.requestedModule(location.href,Object.keys(nav.MODULE_PATHS).map(id=>({id}))),script:document.querySelector('script[src*=bootstrap]').src};});
  assert.equal(actual.base,origin+prefix+'/');assert.equal(actual.module,id);assert(actual.script.startsWith(origin+prefix+'/src/bootstrap.js'));assert.equal(new URL(page.url()).search,'');
  if(segment==='tareas'){await page.reload({waitUntil:'load'});await page.locator('#loginEmail').waitFor();}
 }
 assert.deepEqual(errors,[]);console.log('MODULE PATHS: all Spanish routes directly accessible, actual boot assets and reload at domain root and hosting prefix PASS; no authenticated writes.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
