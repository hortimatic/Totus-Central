import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function versionEntryAssets(html,revision){
 if(!/^[a-f0-9]{40}$/.test(revision))throw Error('Invalid build revision');
 return html.replace(/\b(href|src)=(['"])(src\/[^'"?#]+\.(?:css|m?js))(?:\?[^'"#]*)?\2/g,(_,attr,quote,asset)=>`${attr}=${quote}${asset}?v=${revision}${quote}`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const entry=path.join(process.argv[2]||'_site','index.html');
 fs.writeFileSync(entry,versionEntryAssets(fs.readFileSync(entry,'utf8'),process.argv[3]));
}
