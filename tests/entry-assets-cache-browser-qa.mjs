import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
import {versionEntryAssets} from '../tools/version-entry-assets.mjs';
const sha='b'.repeat(40),source=fs.readFileSync('index.html','utf8');
const assets=[...source.matchAll(/(?:href|src)="(src\/[^"?#]+\.(?:css|m?js))"/g)].map(m=>m[1]);
const versioned=versionEntryAssets(source,sha);
for(const asset of assets)assert(versioned.includes(asset+'?v='+sha),'Unversioned entry asset: '+asset);
assert.equal(versionEntryAssets(versioned,sha),versioned);
let upgraded=false;const reads=[];
const server=createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname.endsWith('.css')){reads.push(req.url);res.setHeader('Cache-Control','public,max-age=31536000');res.setHeader('Content-Type','text/css');res.end(':root{--cache-revision:'+(upgraded?'new':'old')+'}');return;}
 const entry='<html><head>'+assets.filter(a=>a.endsWith('.css')).map(a=>'<link rel="stylesheet" href="'+a+'">').join('')+'</head><body>Fixture sin datos</body></html>';
 res.setHeader('Cache-Control','no-store');res.end(upgraded&&url.pathname!=='/stale'?versionEntryAssets(entry,sha):entry);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage(),url='http://127.0.0.1:'+server.address().port;
 await page.goto(url,{waitUntil:'networkidle'});assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--cache-revision').trim()),'old');
 upgraded=true;await page.goto(url+'/stale',{waitUntil:'networkidle'});
 assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--cache-revision').trim()),'old','The fixture reproduces the stale unversioned stylesheet');
 await page.goto(url+'/?release=new',{waitUntil:'networkidle'});
 assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--cache-revision').trim()),'new','An existing browser cache must load the new styles');
 for(const asset of assets.filter(a=>a.endsWith('.css')))assert(reads.includes('/'+asset+'?v='+sha),'New CSS was not requested: '+asset);
 console.log('ENTRY CACHE: every entry CSS/JS versioned; warm browser cache upgrades all styles without clearing storage PASS.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
