import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
const source=await fs.readFile(new URL('../supabase/functions/totus-onedrive/index.ts',import.meta.url),'utf8');
const start=source.indexOf('async function cleanupRetiredDocuments('),end=source.indexOf('async function runDocumentMirror(',start);
assert.ok(start>=0&&end>start);
const code=stripTypeScriptTypes(source.slice(start,end));
let rows=[],current=[],calls=[],updates=[],already=false,originalId='old-item',digest='a'.repeat(64);
const row={id:'queue-id',onedrive_path:'01 Documentos/old.pdf',onedrive_item_id:'old-item',size_bytes:3,sha256:'a'.repeat(64),attempts:0};
const query=table=>{let change=null;return {select(){return this},is(){return this},order(){return this},limit(){return this},eq(){return this},update(value){change=value;return this},then(resolve,reject){if(change)updates.push(change);return Promise.resolve({data:change?null:table==='ops_onedrive_cleanup'?rows:current,error:null}).then(resolve,reject)}}};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status});
const graph=async(_access,path,options={})=>{
 calls.push({path,method:options.method||'GET'});
 if(path.endsWith(encodeURIComponent('99 Archivo de documentos retirados')))return json({id:'archive-folder',folder:{}});
 if(options.method==='PATCH')return json({id:originalId});
 if(path.includes('queue-id'))return already?json({id:'old-item'}):json({},404);
 return json({id:originalId});
};
const clean=new Function('admin','check','token','root','ensurePath','graph','encodedPath','cleanPart','readContent','fileHash',code+';return cleanupRetiredDocuments;')(
 {from:query},r=>{if(r.error)throw r.error;return r.data},async()=> 'synthetic',async()=>{},async()=>{},graph,
 p=>p.map(encodeURIComponent).join('/'),s=>s,async()=>new Uint8Array([1,2,3]).buffer,async()=>digest);
assert.deepEqual(await clean(),{archived:0,kept:0,failed:0});assert.equal(calls.length,0);
rows=[row];current=[{document_id:'active'}];assert.equal((await clean()).kept,1);assert.ok(!calls.some(c=>c.method==='PATCH'));
current=[];calls=[];updates=[];already=false;
assert.equal((await clean()).archived,1);assert.ok(calls.some(c=>c.method==='PATCH'));
assert.equal(updates.at(-1).resolution,'archived');assert.ok(updates.at(-1).archived_at);
assert.ok(!calls.some(c=>c.method==='DELETE'),'Retired originals must be preserved, never deleted');
calls=[];updates=[];already=true;
assert.equal((await clean()).archived,1);assert.ok(!calls.some(c=>c.method==='PATCH'),'A retried archive must be idempotent');
calls=[];updates=[];already=false;originalId='different-file';
assert.equal((await clean()).failed,1);assert.ok(!calls.some(c=>c.method==='PATCH'));assert.equal(updates.at(-1).attempts,1);
originalId='old-item';already=true;updates=[];digest='b'.repeat(64);
assert.equal((await clean()).failed,1);assert.ok(!updates.some(u=>u.archived_at),'Failed integrity must remain pending');
console.log('ONEDRIVE RETIRED DOCUMENT QA: active originals protected, reversible archive, idempotent retries, item identity, content hash and absence of DELETE verified.');
