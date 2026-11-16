import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {zipSync,strToU8} from 'fflate';
const root=path.resolve('connectors/prestashop'),target=path.resolve('artifacts/totus-native');
const files=[...((await fs.readdir(path.join(root,'src'))).filter(name=>name.endsWith('.php')).sort().map(name=>['src/'+name,'src/'+name])),
 ['module/totuscentralconnector.php','totuscentralconnector.php'],['module/Webservice.php','Webservice.php']];
const entries={},hashes={};
for(const [source,destination] of files){const bytes=await fs.readFile(path.join(root,source));entries['totuscentralconnector/'+destination]=bytes;hashes[destination]=createHash('sha256').update(bytes).digest('hex');}
const manifest={name:'totuscentralconnector',version:'0.1.2',nativeVersion:'8.2.8',protocol:1,environment:'qa',
 ui:'Totus Central',installedRemotely:false,files:hashes};
entries['totuscentralconnector/manifest.json']=strToU8(JSON.stringify(manifest,null,2)+'\n');
await fs.mkdir(target,{recursive:true});const zip=zipSync(entries,{level:6,mtime:new Date(2000,0,1,0,0,0)});
await fs.writeFile(path.join(target,'totuscentralconnector-'+manifest.version+'.zip'),zip);
await fs.writeFile(path.join(target,'manifest.json'),JSON.stringify({...manifest,sha256:createHash('sha256').update(zip).digest('hex')},null,2)+'\n');
console.log('Prepared original QA-only native package; no remote installation.');
