import assert from 'node:assert/strict';
import {CHAT_FILE_LIMIT,chatFileMetadata,microsoftTransferUrl,checkChatFileSignature,uploadChatFile,chatFileHash} from '../src/chat-files.js';
assert.equal(chatFileMetadata({name:'Factura.PDF',size:20}).mime_type,'application/pdf');
for(const file of [{name:'script.html',size:20},{name:'large.pdf',size:CHAT_FILE_LIMIT+1},{name:'empty.txt',size:0}])assert.throws(()=>chatFileMetadata(file));
assert.throws(()=>microsoftTransferUrl('https://1drv.com.evil.invalid/file'));
assert.throws(()=>microsoftTransferUrl('http://x.1drv.com/file'));
assert.equal(microsoftTransferUrl('https://upload.1drv.com/session'),'https://upload.1drv.com/session');
assert.throws(()=>checkChatFileSignature({name:'wrong.pdf'},new TextEncoder().encode('<html>')));
checkChatFileSignature({name:'ok.pdf'},new TextEncoder().encode('%PDF-1.7'));
const file=new File(['texto original'],'prueba.txt',{type:'text/plain'}),hash=await chatFileHash(file),calls=[];
let uploaded=false;
const result=await uploadChatFile(file,{messageId:'message',clientId:'client',request:async(action,p)=>{
 calls.push([action,p]);return action==='chat-file-prepare'?{file:{id:'file'},upload_url:'https://upload.1drv.com/session'}:{file:{id:'file',sha256:hash,status:'ready'}};
},fetchFile:async(url,options)=>{
 assert.equal(options.headers?.Authorization,undefined);assert.equal(options.headers?.apikey,undefined);
 if(options.method==='PUT'){uploaded=true;throw Error('Network response lost after commit');}
 assert.equal(options.method,'GET');return new Response('',{status:404});
}});
assert(uploaded);assert.equal(result.status,'ready');assert.equal(calls.length,2);assert.equal(calls[1][0],'chat-file-complete');
const ready=await uploadChatFile(file,{messageId:'message',clientId:'client',request:async()=>({complete:true,file:{id:'already'}}),fetchFile:async()=>{throw Error('Must not overwrite existing file');}});
assert.equal(ready.id,'already');
console.log('CHAT FILE CORE QA: format/size/host limits, original hash, no forwarded credentials, lost-response recovery and no overwrites OK');
