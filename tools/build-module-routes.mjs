import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {MODULE_PATHS} from '../src/module-navigation.js';
export function buildModuleRoutes(root){
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const base='<script>const moduleBase=document.createElement("base");moduleBase.href=new URL(location.pathname.endsWith("/")?"../":"./",location.href).href;document.head.prepend(moduleBase);</script>';
 const routed=html.replace(/<head>/i,'<head>\n'+base);
 if(routed===html)throw Error('Application HTML has no head');
 for(const route of new Set(Object.values(MODULE_PATHS))){const dir=path.join(root,route);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'index.html'),routed);}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))buildModuleRoutes(process.argv[2]||'_site');
