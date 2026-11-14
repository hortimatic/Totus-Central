import fs from 'node:fs';import path from 'node:path';import {execFileSync,execFile} from 'node:child_process';import {promisify} from 'node:util';import {startLocalServer} from '../tests/local-static-server.mjs';import {fileURLToPath} from 'node:url';
export function affectedCircuits(files,matrix){return matrix.circuits.filter(circuit=>files.some(file=>circuit.paths.some(prefix=>file.startsWith(prefix))));}
export function validateCircuits(matrix,exists=file=>fs.existsSync(file)){
 const seen=new Set();for(const circuit of matrix.circuits){if(!circuit.id||seen.has(circuit.id)||!circuit.paths?.length||!circuit.tests?.length||!circuit.invariants?.length)throw Error('Circuito incompleto o duplicado: '+circuit.id);seen.add(circuit.id);for(const file of circuit.tests)if(!exists(file))throw Error('Falta el recorrido '+file);}
 return seen.size;
}
export function removedExports(before,after){const names=text=>{const result=new Set([...text.matchAll(/\bexport\s+(?:async\s+)?(?:function|class|const|let)\s+([A-Za-z_$][\w$]*)/g)].map(m=>m[1]));for(const block of text.matchAll(/\bexport\s*\{([^}]+)\}/g))for(const part of block[1].split(',')){const name=part.trim().split(/\s+as\s+/).at(-1);if(/^[A-Za-z_$][\w$]*$/.test(name))result.add(name);}return result;};const current=names(after);return [...names(before)].filter(name=>!current.has(name));}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),baseline=args.includes('--baseline')?args[args.indexOf('--baseline')+1]:'origin/totus-central';
 const matrix=JSON.parse(fs.readFileSync('stability/circuits.json','utf8'));validateCircuits(matrix);
 const changed=[...new Set((execFileSync('git',['diff','--name-only',baseline],{encoding:'utf8'})+'\n'+execFileSync('git',['ls-files','--others','--exclude-standard'],{encoding:'utf8'})).trim().split('\n').filter(Boolean))],affected=affectedCircuits(changed,matrix);
 for(const file of changed.filter(file=>/^src\/.*\.js$/.test(file))){let before='';try{before=execFileSync('git',['show',baseline+':'+file],{encoding:'utf8',stdio:['ignore','pipe','pipe']});}catch{}const after=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';const removed=removedExports(before,after);if(removed.length)throw Error('Contrato retirado sin transición: '+file+' → '+removed.join(', '));}
 const uncovered=changed.filter(file=>/^(src\/|supabase\/functions\/)/.test(file)&&!file.endsWith('deployment-manifest.json')&&!affected.some(c=>c.paths.some(p=>file.startsWith(p))));
 if(uncovered.length)throw Error('Declara los consumidores y recorridos afectados: '+uncovered.join(', '));
 const tests=[...new Set(affected.flatMap(c=>c.tests))],report={baseline,changed,circuits:affected.map(c=>c.id),tests,executed:args.includes('--run')};
 fs.mkdirSync('qa-artifacts',{recursive:true});report.results=[];
 if(args.includes('--run'))for(const file of tests){const needsServer=fs.readFileSync(file,'utf8').includes('127.0.0.1:4173')&&!fs.readFileSync(file,'utf8').includes('startLocalServer');const server=needsServer?await startLocalServer():null;try{const result=await promisify(execFile)(process.execPath,[file],{env:{...process.env,TOTUS_START_SERVER:'1'},maxBuffer:8*1024*1024});process.stdout.write(result.stdout);process.stderr.write(result.stderr);report.results.push({file,passed:true});}catch(error){report.results.push({file,passed:false,error:error.message});throw error;}finally{await server?.close();fs.writeFileSync('qa-artifacts/stability-circuits.json',JSON.stringify(report,null,2)+'\n');}}
 fs.mkdirSync('qa-artifacts',{recursive:true});fs.writeFileSync('qa-artifacts/stability-circuits.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
