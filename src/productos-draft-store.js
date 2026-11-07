// Per-user local work in progress, including image bytes and stable operation IDs.
// IndexedDB avoids localStorage's small quota. No credentials are stored here.
const database=()=>new Promise((resolve,reject)=>{
 if(typeof indexedDB==='undefined'){resolve(null);return;}
 const request=indexedDB.open('totus-product-drafts',1);
 request.onupgradeneeded=()=>request.result.createObjectStore('drafts');
 request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
});
export async function productDraftStore(actor,value=undefined){
 if(typeof actor!=='string'||!actor)return null;
 const db=await database();if(!db)return null;
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction('drafts',value===undefined?'readonly':'readwrite'),store=tx.objectStore('drafts');
  const request=value===undefined?store.get(actor):value===null?store.delete(actor):store.put({version:1,value,saved_at:new Date().toISOString()},actor);
  let result=null;request.onsuccess=()=>{result=request.result;};
  tx.oncomplete=()=>resolve(value===undefined&&result?.version===1?result.value:null);
  tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
 });}finally{db.close();}
}
