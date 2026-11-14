import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const sourceHash=text=>createHash('sha256').update(text.replace(/\r\n/g,'\n')).digest('hex');
export function checkServiceDeployment({baseline,live,proposed,allowed=[]}){
 if(!baseline||live?.version!==baseline.version)throw Error('La versión activa ha cambiado: relee el servicio antes de preparar el despliegue.');
 const files=Object.fromEntries((live.files||[]).map(file=>[file.name,sourceHash(file.content)]));
 if(JSON.stringify(Object.keys(files).sort())!==JSON.stringify(Object.keys(baseline.files).sort()))throw Error('El paquete activo tiene dependencias distintas de la referencia revisada.');
 for(const [file,hash]of Object.entries(baseline.files))if(files[file]!==hash)throw Error('El servicio activo ha cambiado: '+file);
 const permitted=new Set(allowed),changes=[];
 for(const file of new Set([...Object.keys(files),...Object.keys(proposed)])){
  if(!(file in proposed))throw Error('No se permite retirar una dependencia activa: '+file);
  if(files[file]!==sourceHash(proposed[file])){
   if(!permitted.has(file))throw Error('Cambio de servicio no declarado: '+file);
   changes.push(file);
  }
 }
 return changes;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),value=flag=>args[args.indexOf(flag)+1];
 if(!args.includes('--service')||!args.includes('--live')||!args.includes('--plan'))throw Error('Uso: node tools/check-service-deployment.mjs --service NOMBRE --live LECTURA_ACTUAL.json --plan PLAN.json');
 const name=value('--service'),lock=JSON.parse(fs.readFileSync('stability/live-services.json','utf8')).services.find(s=>s.name===name);
 const manifest=JSON.parse(fs.readFileSync('supabase/functions/deployment-manifest.json','utf8')).services.find(s=>s.name===name);
 if(!manifest||!lock)throw Error('Servicio sin referencia revisada.');
 const live=JSON.parse(fs.readFileSync(value('--live'),'utf8')),plan=JSON.parse(fs.readFileSync(value('--plan'),'utf8'));
 if(plan.service!==name||!plan.reason?.trim()||!Array.isArray(plan.changedFiles))throw Error('El plan debe indicar servicio, motivo y archivos exactos.');
 const proposed=Object.fromEntries(manifest.files.map(file=>[file,fs.readFileSync(file,'utf8')]));
 const changes=checkServiceDeployment({baseline:lock,live,proposed,allowed:plan.changedFiles});
 console.log(JSON.stringify({service:name,baseVersion:lock.version,changedFiles:changes,dependencies:manifest.files.length,verified:true},null,2));
}
