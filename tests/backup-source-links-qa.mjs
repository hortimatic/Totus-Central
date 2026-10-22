import assert from 'node:assert/strict';
import {createBackupDocumentLinks} from '../supabase/functions/totus-onedrive/backup-source-links.js';
let docs,maps,calls,missing,http,fail,duplicate;
function reset(n=30){
 docs=Array.from({length:n},(_,i)=>({id:'d'+i,storage_path:'docs/'+i+'.pdf',size_bytes:3,sha256:'a'.repeat(64)}));
 maps=docs.map((d,i)=>({document_id:d.id,source_path:d.storage_path,onedrive_item_id:'item!'+i,size_bytes:3,sha256:d.sha256,verified_at:'2026-10-22'}));
 calls=[];missing=false;http=false;fail=false;duplicate=false;
}
const admin={from:table=>({select(){return this},in(){return this},then(resolve){return Promise.resolve({data:structuredClone(table==='ops_documents'?(missing?docs.slice(1):docs):maps),error:null}).then(resolve)}}),storage:{from:()=>({createSignedUrls:async paths=>({data:paths.map(path=>({path,signedUrl:'https://local.invalid/'+path})),error:null})})}};
const check=(r,label)=>{if(r.error)throw Error(label);return r.data;};
const links=createBackupDocumentLinks({admin,check,config:async()=>({connected:true,tested_at:'2026-10-22'}),token:async()=>'fake-test-token',root:async()=>{},fetchGraph:async(url,options)=>{
 assert.equal(url,'https://graph.microsoft.com/v1.0/$batch');assert.equal(options.method,'POST');assert.equal(options.headers.Authorization,'Bearer fake-test-token');
 const {requests}=JSON.parse(options.body);assert(requests.length<=20);assert(requests.every(r=>r.method==='GET'&&r.url.startsWith('/me/drive/items/')&&!r.url.includes('..')));
 calls.push(requests.length);
 const responses=requests.map(r=>({id:r.id,status:fail?429:200,headers:{'Retry-After':'5'},body:{id:decodeURIComponent(r.url.split('/').pop()),size:3,'@microsoft.graph.downloadUrl':(http?'http:':'https:')+'//download.invalid/'+r.id}})).reverse();
 if(duplicate&&responses.length>1)responses[1].id=responses[0].id;
 return Response.json({responses});
}});
reset();let result=await links(docs.map(d=>d.storage_path));assert.equal(result.files.length,30);assert.deepEqual(calls,[20,10]);assert(result.files.every(f=>f.provider==='onedrive'));
await assert.rejects(()=>links(['../invalid']),/válido/);await assert.rejects(()=>links(['x','x']),/válido/);
reset(1);maps[0].sha256='b'.repeat(64);await assert.rejects(()=>links(['docs/0.pdf']),/coincide/);assert.equal(calls.length,0);
reset(1);maps[0].verified_at=null;await assert.rejects(()=>links(['docs/0.pdf']),/coincide/);
reset(1);missing=true;await assert.rejects(()=>links(['docs/0.pdf']),/disponible/);
reset(1);http=true;await assert.rejects(()=>links(['docs/0.pdf']),/confirmado/);
reset(1);fail=true;await assert.rejects(()=>links(['docs/0.pdf']),/Retry after 5000ms/);
reset(2);duplicate=true;await assert.rejects(()=>links(docs.map(d=>d.storage_path)),/incompleta/);
reset(1);maps=[];result=await links(['docs/0.pdf']);assert.equal(result.files[0].provider,'supabase');assert.equal(calls.length,0);
console.log('BACKUP SOURCE LINKS: bulk database reads, 20-item Graph batches, verified identities/hashes/sizes, expiry-safe links, local fallback and rejection of missing/altered/insecure responses OK');
