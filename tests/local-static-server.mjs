import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
export async function startLocalServer(){
 if(!process.env.TOTUS_START_SERVER)return null;
 const root=new URL('../',import.meta.url);
 const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost'),file=new URL('.'+url.pathname,root);if(!file.href.startsWith(root.href))throw Error('path');res.setHeader('Content-Type',file.pathname.endsWith('.js')?'text/javascript':file.pathname.endsWith('.css')?'text/css':'text/html');res.end(await readFile(file));}catch{res.statusCode=404;res.end();}});
 await new Promise(r=>server.listen(4173,'127.0.0.1',r));return server;
}
