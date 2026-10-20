import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
const source=await fs.readFile(new URL('../supabase/functions/totus-onedrive/index.ts',import.meta.url),'utf8');
const start=source.indexOf('async function documentFileUrl('),end=source.indexOf('async function backupFileUrl(',start);
assert.ok(start>=0&&end>start);
const code=stripTypeScriptTypes(source.slice(start,end));
let visible=true,mapped=null,calls=0,status=302,location='https://download.example.invalid/file';
const doc={id:'synthetic',storage_path:'qa/invoice.pdf',size_bytes:3,sha256:'a'.repeat(64)};
const query=data=>({select(){return this},eq(){return this},async maybeSingle(){return {data,error:null}}});
const admin={auth:{getUser:async jwt=>({data:{user:jwt==='valid'?{id:'actor'}:null},error:null})},from:table=>query(table==='ops_documents'?doc:mapped)};
const resolve=new Function('admin','createClient','url','Deno','check','graph','token','encodedPath',code+';return documentFileUrl;')(
 admin,()=>({from:()=>query(visible?doc:null)}),'https://qa.example.invalid',{env:{get:()=> 'public-key'}},
 r=>{if(r.error)throw r.error;return r.data},async()=>{calls++;return new Response(null,{status,headers:{Location:location}})},
 async()=> 'synthetic',p=>p.map(encodeURIComponent).join('/'));
const request=jwt=>new Request('https://qa.example.invalid',{headers:jwt?{Authorization:'Bearer '+jwt}:{}});
await assert.rejects(()=>resolve(doc.storage_path,request()),/denegado/);
await assert.rejects(()=>resolve(doc.storage_path,request('invalid')),/denegado/);
visible=false;await assert.rejects(()=>resolve(doc.storage_path,request('valid')),/denegado/);
assert.equal(calls,0,'Denied users must not reach OneDrive');
visible=true;assert.equal((await resolve(doc.storage_path,request('valid'))).provider,'supabase');
mapped={...doc,source_path:doc.storage_path,onedrive_path:'01 Documentos/qa.pdf',verified_at:'2026-10-20'};
assert.equal((await resolve(doc.storage_path,request('valid'))).provider,'onedrive');
mapped.sha256='b'.repeat(64);await assert.rejects(()=>resolve(doc.storage_path,request('valid')),/no coincide/);
mapped.sha256=doc.sha256;mapped.size_bytes=4;await assert.rejects(()=>resolve(doc.storage_path,request('valid')),/no coincide/);
mapped.size_bytes=3;mapped.source_path='other.pdf';await assert.rejects(()=>resolve(doc.storage_path,request('valid')),/no coincide/);
mapped.source_path=doc.storage_path;status=500;await assert.rejects(()=>resolve(doc.storage_path,request('valid')),/No se pudo abrir/);
status=302;location='http://download.example.invalid/file';await assert.rejects(()=>resolve(doc.storage_path,request('valid')),/No se pudo abrir/);
await assert.rejects(()=>resolve('../secret',request('valid')),/Ruta/);
console.log('ONEDRIVE DOCUMENT ACCESS QA: anonymous, expired identity, RLS denial, unmapped originals, verified mapping, stale path/hash/size, remote failure and HTTPS-only verified.');
