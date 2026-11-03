import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=process.cwd(),port=Number(process.env.AUDIT_PORT||4173);
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
http.createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(!/^\/(src|assets|tests)\/|^\/node_modules\/(xlsx-js-style|jszip)\/|^\/(favicon\.svg|fondo_original\.png)$/.test(pathname)){res.writeHead(404).end();return;}
  let target=path.resolve(root,'.'+pathname);
  if(!target.startsWith(root+path.sep)){res.writeHead(404).end();return;}
  if(pathname==='/node_modules/jszip/dist/jszip.min.js'&&process.env.AUDIT_JSZIP)target=path.resolve(path.dirname(fileURLToPath(process.env.AUDIT_JSZIP)),'../dist/jszip.min.js');
  const body=await fs.readFile(target);res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'}).end(body);
 }catch{res.writeHead(404).end();}
}).listen(port,'127.0.0.1',()=>console.log('Isolated audit server ready'));
