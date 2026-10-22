import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {createHash} from 'node:crypto';
const source=await fs.readFile('supabase/functions/totus-onedrive/index.ts','utf8');
const code=stripTypeScriptTypes(source.slice(source.indexOf('async function syncOnlineManuals('),source.indexOf('async function backupFileUrl(')));
const stored=new Map(),hash=async b=>createHash('sha256').update(new Uint8Array(b)).digest('hex');
const manual='El formato admite 120 MiB de archivo y 128 MiB expandidos. Preparar una ampliación.\nLa credencial actual caduca el 01/01/2099; renovarla antes de esa fecha desde los servicios autorizados.\nOtro apartado que debe conservarse.';
const sync=new Function('token','root','ensurePath','fetch','graph','encodedPath','readContent','fileHash',code+';return syncOnlineManuals;')(
 async()=>'test',async()=>{},async()=>{},async url=>new Response(url.endsWith('docs/MANUAL_CHATGPT_ONLINE.md')?manual:'Generic documentation'),
 async(_token,path,options)=>{stored.set(path,options.body);return new Response(null,{status:200});},parts=>parts.map(encodeURIComponent).join('/'),
 async(_token,path)=>stored.get(path).buffer,hash);
await assert.rejects(()=>sync('not-a-revision'),/revisión/);
const result=await sync('a'.repeat(40));assert(result.verified);assert.equal(result.files,5);
const body=new TextDecoder().decode([...stored].find(([p])=>p.endsWith('MANUAL_CHATGPT_ONLINE.md:/content'))[1]);
assert(body.includes('juegos v4'));assert(body.includes('Otro apartado que debe conservarse.'));
assert(!body.includes('El formato admite 120 MiB'));assert(!body.includes('01/01/2099'));
assert(body.includes('90 días antes')&&body.includes('30 días antes'));
assert(!body.includes('\\n\\n'),'Manual must contain real line breaks');
console.log('BACKUP MANUAL SYNC: five private cloud documents, updated instructions, no stale credential deadline and verified readback OK');
