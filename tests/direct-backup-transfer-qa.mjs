import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createDirectBackupTransfer,readBoundedBackupContent} from '../supabase/functions/totus-onedrive/backup-transfer.js';
const id='11111111-1111-4111-8111-111111111111',path='automaticas/proof.totusbackup';
const digest=b=>createHash('sha256').update(new Uint8Array(b)).digest('hex');
let db,objects,events,invalidLocation=false,providerFailure=false;
const reset=()=>{
 db={ops_backup_runs:[{id,status:'running',started_at:'2026-10-20T00:35:00Z',storage_path:path}],ops_onedrive_backups:[],ops_onedrive_backup_files:[]};
 objects=new Map();events=[];invalidLocation=false;providerFailure=false;
};
const admin={from(table){return {
 filters:[],action:'select',
 select(){return this},eq(k,v){this.filters.push(r=>r[k]===v);return this},is(k,v){this.filters.push(r=>(r[k]??null)===v);return this},
 single(){this.one=true;return this},maybeSingle(){this.one=true;return this},
 insert(value){this.action='insert';this.value=value;return this},upsert(value){this.action='upsert';this.value=value;return this},
 update(value){this.action='update';this.value=value;return this},
 then(resolve){
  let rows=db[table].filter(r=>this.filters.every(f=>f(r)));
  if(this.action==='insert'){db[table].push({...this.value});rows=[this.value]}
  if(this.action==='upsert'){const prior=db[table].find(r=>r.run_id===this.value.run_id&&r.source_path===this.value.source_path);if(prior)Object.assign(prior,this.value);else db[table].push({...this.value});rows=[this.value]}
  if(this.action==='update')rows.forEach(r=>Object.assign(r,this.value));
  return Promise.resolve({data:structuredClone(this.one?rows[0]||null:rows),error:null}).then(resolve);
 }
}}};
const check=(result,label)=>{if(result.error)throw Error(label);return result.data};
const graph=async(_token,route,options={})=>{
 assert.ok(route.startsWith('/me/drive/special/approot:/02%20Copias%20de%20seguridad/'),'Only application backup folders');
 if(route.endsWith('/createUploadSession')){
  assert.equal(options.method,'POST');assert.equal(JSON.parse(options.body).item['@microsoft.graph.conflictBehavior'],'fail');
  return Response.json({uploadUrl:'https://upload.example/session/'+events.push(route)});
 }
 const encoded=route.split(':/')[1],relative=decodeURIComponent(encoded.replace(/:\/content$|\?\$select=id,size$/g,''));
 const file=[...objects.keys()].find(p=>relative.endsWith('/'+p));
 if(providerFailure||!file)return new Response(null,{status:404});
 if(route.endsWith(':/content'))return new Response(null,{status:302,headers:{Location:invalidLocation?'http://unsafe.invalid/file':'https://download.example/'+encodeURIComponent(file)}});
 return Response.json({id:'item-'+file,size:objects.get(file).length});
};
const transfer=()=>createDirectBackupTransfer({admin,check,config:async()=>({connected:true,tested_at:'2026-10-20'}),token:async()=>'private-token',root:async()=>{},ensurePath:async()=>{},graph,encodedPath:p=>p.map(encodeURIComponent).join('/'),fileHash:async b=>digest(b),fetchFile:async(url,opts)=>{
 assert.equal(new URL(url).protocol,'https:');assert.equal(opts.headers,undefined,'No application authorization forwarded to a private download URL');
 return new Response(objects.get(decodeURIComponent(new URL(url).pathname.slice(1))));
}});
reset();let api=transfer(),prepared=await api.prepare(id);assert.equal(prepared.sessions.length,16);assert.equal(prepared.source_path,path);assert.equal(db.ops_onedrive_backups[0].verified_at,undefined);
await assert.rejects(()=>api.verify(id,path+'.part-0015',1,'a'.repeat(64)),/fuera/);
await assert.rejects(()=>api.verify(id,'other.totusbackup',1,'a'.repeat(64)),/fuera/);
await assert.rejects(()=>api.verify('bad',path,1,'a'.repeat(64)),/Referencia/);
const partPath=path+'.part-0000',bytes=new Uint8Array(8*1024*1024),sha=digest(bytes);
objects.set(partPath,bytes);await assert.rejects(()=>api.verify(id,partPath,bytes.length,'f'.repeat(64)),/no coincide/);
assert.equal(db.ops_onedrive_backup_files.length,0);
let proof=await api.verify(id,partPath,bytes.length,sha);assert.deepEqual(proof,{verified:true,path:partPath,size:bytes.length,sha256:sha});
assert.equal(db.ops_onedrive_backups[0].verified_at,undefined,'A part is not a completed backup');
await api.stagedUrl(id,partPath);
const tail=new Uint8Array([1]),tailPath=path+'.part-0001';objects.set(tailPath,tail);await api.verify(id,tailPath,tail.length,digest(tail));
const index={format:'totus-backup-parts',version:1,size:bytes.length+1,sha256:sha,parts:[{path:partPath,size:bytes.length,sha256:sha},{path:tailPath,size:1,sha256:digest(tail)}]};
const indexBytes=new TextEncoder().encode(JSON.stringify(index));objects.set(path,indexBytes);
db.ops_onedrive_backup_files[0].verified_at=null;
await assert.rejects(()=>api.verify(id,path,indexBytes.length,digest(indexBytes)),/Falta un fragmento/);
assert.equal(db.ops_onedrive_backups[0].verified_at,undefined,'Incomplete archive cannot publish');
db.ops_onedrive_backup_files[0].verified_at='2026-10-20';
await api.verify(id,path,indexBytes.length,digest(indexBytes));assert.ok(db.ops_onedrive_backups[0].verified_at);
assert.equal(db.ops_onedrive_backups[0].archive_sha256,sha);
await assert.rejects(()=>api.prepare(id),/no se sobrescribe/);
objects.set(partPath,new TextEncoder().encode('changed'));
await assert.rejects(()=>api.verify(id,partPath,7,digest(objects.get(partPath))),/no se modifica/);
db.ops_backup_runs[0].status='success';await assert.rejects(()=>api.verify(id,path,indexBytes.length,digest(indexBytes)),/no está en preparación/);
reset();api=transfer();await api.prepare(id);objects.set(partPath,bytes);invalidLocation=true;await assert.rejects(()=>api.verify(id,partPath,bytes.length,sha),/localizar/);
reset();api=transfer();await api.prepare(id);objects.set(partPath,bytes);providerFailure=true;await assert.rejects(()=>api.verify(id,partPath,bytes.length,sha),/localizar/);
assert.equal(db.ops_onedrive_backups[0].verified_at,undefined);
await assert.rejects(()=>readBoundedBackupContent(new Response(new Uint8Array([1]),{headers:{'Content-Length':String(9*1024*1024)}})),/8 MiB/);
await assert.rejects(()=>readBoundedBackupContent(new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(8*1024*1024));c.enqueue(new Uint8Array([1]));c.close()}}))),/8 MiB/);
await assert.rejects(()=>readBoundedBackupContent(new Response(new Uint8Array())),/vacío/);
console.log('DIRECT BACKUP QA: narrow AppFolder sessions, exact readback proofs, partial publication fence, changed data, bounded reads, HTTPS and unavailable provider verified');
