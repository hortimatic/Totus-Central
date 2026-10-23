import assert from 'node:assert/strict';
import {importStockDocument} from '../supabase/functions/totus-onedrive/stock-import.js';
const body={path:'01 Documentos/Recepciones/2026/pedido.pdf',item_id:'item-1',name:'pedido.pdf',receipt_id:'receipt',revision:1,kind:'supplier',quickxor:'same-hash',text:'Producto 10',extraction:{state:'ready'},actor_email:'admin@example.invalid'};
let saved;
const dependencies={
 admin:{from:()=>({select(){return this},eq(){return this},single:async()=>({data:{id:'receipt',revision:1},error:null})}),rpc:async(_name,args)=>{saved=args;return {data:{revision:2,status:'pending'},error:null}}},
 check:r=>{if(r.error)throw new Error('Database error');return r.data},token:async()=>'private-token',root:async()=>{},
 graph:async()=>({ok:true,json:async()=>({id:'item-1',name:'pedido.pdf',file:{hashes:{quickXorHash:'same-hash'}},size:3})}),
 encodedPath:parts=>parts.map(encodeURIComponent).join('/'),readContent:async()=>new Uint8Array([1,2,3]).buffer,fileHash:async()=>'a'.repeat(64)
};
const result=await importStockDocument(body,dependencies);assert.equal(result.imported,true);assert.equal(saved.p_sha,'a'.repeat(64));assert.equal(saved.p_size,3);assert(!JSON.stringify(result).includes('private-token'));
for(const change of [{path:'../outside.pdf'},{path:'01 Documentos/Recepciones/../outside.pdf'},{item_id:'other'},{quickxor:'wrong'},{revision:2},{kind:'unknown'},{text:'x'.repeat(250001)}]){
 await assert.rejects(()=>importStockDocument({...body,...change},dependencies));
}
await assert.rejects(()=>importStockDocument(body,{...dependencies,readContent:async()=>new ArrayBuffer(4)}),/tamaño/);
console.log('STOCK CLOUD IMPORT QA: private app-folder scope, identity, copy hash, byte size, optimistic revision and no token disclosure verified');
