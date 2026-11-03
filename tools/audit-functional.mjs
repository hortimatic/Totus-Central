// Runs existing user journeys against local fictional fixtures, never production.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
const suites=['full-flow-qa','deep-editing-browser-qa','pricing-integral-browser-qa','closing-integral-browser-qa','expense-integral-browser-qa','stock-browser-qa','stock-async-browser-qa','tasks-browser-qa','team-chat-browser-qa','chat-ai-target-browser-qa','api-manager-browser-qa','configuration-journeys-browser-qa','account-workspace-browser-qa','user-purge-browser-qa','user-permissions-browser-qa','write-lock-browser-qa','ambiguous-write-browser-qa','session-startup-browser-qa','annual-package-browser-qa','recovery-browser-qa','live-refresh-qa'];
const root=process.cwd(),out=path.resolve(process.env.AUDIT_OUTPUT||'artifacts/functional-audit'),port=Number(process.env.AUDIT_PORT||4173);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid local test port');
await fs.mkdir(out,{recursive:true});
// Fail before running journeys when the harness is unavailable; manage our own server.
const serverFile=path.join(root,'tests','.audit3-server.mjs');
await fs.writeFile(serverFile,"import '../tools/audit-server.mjs';");
const server=spawn(process.execPath,[serverFile],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
process.on('exit',()=>server.kill());
await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Local audit server did not start')),5000);server.once('error',reject);server.stderr.once('data',data=>{clearTimeout(timer);reject(Error(String(data)))});server.stdout.once('data',()=>{clearTimeout(timer);resolve()});});
const preflight=await fetch('http://127.0.0.1:'+port+'/tests/app-mock.html');
if(!preflight.ok||!(await preflight.text()).includes('mock-supabase.js')){server.kill();throw Error('The isolated fictional harness is unavailable');}
for(const file of ['node_modules/xlsx-js-style/dist/xlsx.bundle.js','node_modules/jszip/dist/jszip.min.js'])if(!(await fetch('http://127.0.0.1:'+port+'/'+file)).ok)throw Error('Missing harness dependency: '+file);
const selected=process.env.AUDIT_ONLY?process.env.AUDIT_ONLY.split(','):suites;
if(selected.some(x=>!suites.includes(x)))throw Error('Unknown audit suite');
const results=process.env.AUDIT_ONLY?JSON.parse(await fs.readFile(path.join(out,'results.json'),'utf8')).suites.filter(x=>!selected.includes(x.suite)):[];let next=0;
async function run(name){
 const original=path.join(root,'tests',name+'.mjs'),temporary=path.join(root,'tests','.audit3-'+name+'.mjs');
 let source=await fs.readFile(original,'utf8');
 for(const [pkg,env] of [['playwright','AUDIT_PLAYWRIGHT'],['pdf-lib','AUDIT_PDF_LIB'],['jszip','AUDIT_JSZIP']])if(process.env[env])source=source.replaceAll("from '"+pkg+"'","from '"+process.env[env]+"'").replaceAll("import('"+pkg+"')","import('"+process.env[env]+"')");
 source=source.replaceAll(':4173',':'+port);
 if(process.env.AUDIT_BROWSER_CHANNEL)source=source.replaceAll('headless:true','headless:true,channel:'+JSON.stringify(process.env.AUDIT_BROWSER_CHANNEL));
 await fs.writeFile(temporary,source);const started=Date.now();
 try{
  const child=spawn(process.execPath,[temporary],{cwd:root,env:process.env,windowsHide:true,stdio:['ignore','pipe','pipe']});let text='';
  child.stdout.on('data',c=>text+=c);child.stderr.on('data',c=>text+=c);
  const timeout=setTimeout(()=>child.kill(),240000);
  const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve)});clearTimeout(timeout);
  await fs.writeFile(path.join(out,name+'.log'),text);
  const result={suite:name,passed:code===0,exit:code,duration_ms:Date.now()-started,checks:text.split(/\r?\n/).filter(x=>/^OK |QA:| QA:|controls passed|E2E MOCK/.test(x)).slice(-50)};
  results.push(result);await fs.writeFile(path.join(out,'results.json'),JSON.stringify({environment:'local fictional fixtures',production_writes:false,suites:results},null,2));console.log(JSON.stringify(result));
 }finally{await fs.unlink(temporary).catch(()=>{});}
}
await Promise.all(Array.from({length:2},async()=>{while(next<selected.length){const name=selected[next++];await run(name)}}));
console.log(JSON.stringify({passed:results.filter(x=>x.passed).length,total:results.length}));if(results.some(x=>!x.passed))process.exitCode=1;
server.kill();await fs.unlink(serverFile).catch(()=>{});
