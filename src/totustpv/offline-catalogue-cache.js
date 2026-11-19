import {cataloguePricingContext} from './catalogue-pricing-context.js';
/** Read-only catalogue snapshots. These are not payable quotes or permissions.
 * Separate database from the delivery journal: cache replacement cannot erase sales.
 */
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
const canonical=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
const need=(value,message)=>{if(!value)throw Error(message);};
const itemFields=['id','name','reference','saleEnabled','stock','temporaryLineNames','unitPriceOverride','allowOutOfStock','priceCents','netPriceCents','minimumQty','chooseVariant','nativeProductId','variantAttributes','barcode','upc','isbn','manufacturer','supplier','costCents','imageUrl','unitTaxInclMicros','unitTaxExclMicros','quantityBreaks','priceValidForMs'];
function snapshot(value){
 need(value&&Array.isArray(value.items)&&value.items.length<=1000&&typeof value.hasMore==='boolean'&&Number.isSafeInteger(value.page)&&value.page>=0,'El catálogo guardado no es válido.');
 need(value.items.every(row=>row&&typeof row.id==='string'&&typeof row.name==='string'&&Object.keys(row).every(key=>itemFields.includes(key))),'Los artículos guardados no son válidos.');
 need(Object.keys(value).every(key=>['items','hasMore','page','totalCount','variantGroups','variantGroupId','pricingContext'].includes(key)),'El catálogo contiene datos no admitidos.');
 need(value.items.every(row=>['unitTaxInclMicros','unitTaxExclMicros'].every(key=>row[key]==null||Number.isSafeInteger(row[key])&&row[key]>=0&&row[key]<=1000000000000000)&&(row.unitTaxInclMicros==null||row.unitTaxExclMicros==null||row.unitTaxExclMicros<=row.unitTaxInclMicros)),'Los precios detallados del catálogo no son válidos.');
 need(value.items.every(row=>row.priceValidForMs===undefined||Number.isSafeInteger(row.priceValidForMs)&&row.priceValidForMs>=0&&row.priceValidForMs<=86400000),'La vigencia del precio guardado no es válida.');
 need(canonical(value).length<=2000000,'Esta página del catálogo es demasiado grande para guardarla.');
 if(value.pricingContext!==undefined)cataloguePricingContext(value.pricingContext);
 return structuredClone(value);
}
export function createOfflineCatalogueCache({scope,indexedDB=globalThis.indexedDB,name='totus-tpv-catalogue-v1',now=Date.now}={}){
 need(scope&&['actorId','connectionId','drawerId'].every(key=>uuid(scope[key]))&&Number.isSafeInteger(scope.shopId)&&scope.shopId>0&&['customerId','addressId'].every(key=>Number.isSafeInteger(scope[key])&&scope[key]>=0),'No se ha identificado el catálogo de este puesto y cliente.');
 const revision=scope.revision??0;need(Number.isSafeInteger(revision)&&revision>=0,'La revisión del catálogo no es válida.');
 const partition=canonical({...Object.fromEntries(['actorId','connectionId','drawerId','shopId','customerId','addressId'].map(key=>[key,scope[key]])),revision});
 const queryKey=query=>{const key=canonical(query);need(typeof key==='string'&&key.length<=5000,'La consulta de catálogo no es válida.');return key;};
 async function transaction(write,action){
  need(indexedDB,'No se puede guardar el catálogo en este navegador.');
  const db=await new Promise((resolve,reject)=>{
   const request=indexedDB.open(name,1);let blocked=false;
   request.onupgradeneeded=()=>request.result.createObjectStore('pages',{keyPath:['partition','query']});
   request.onerror=()=>reject(Error('No se puede abrir el catálogo guardado.'));
   request.onblocked=()=>{blocked=true;reject(Error('Cierra las otras ventanas para preparar el catálogo guardado.'));};
   request.onsuccess=()=>{if(blocked){request.result.close();return;}request.result.onversionchange=()=>request.result.close();resolve(request.result);};
  });
  try{return await new Promise((resolve,reject)=>{
   const tx=db.transaction('pages',write?'readwrite':'readonly');let result,failure;
   tx.oncomplete=()=>resolve(result);tx.onerror=()=>{};tx.onabort=()=>reject(failure||Error('No se ha podido guardar el catálogo.'));
   const fail=error=>{failure=error;tx.abort();};
   try{action(tx.objectStore('pages'),value=>{result=value;},fail);}catch(error){fail(error);}
  });}finally{db.close();}
 }
 return Object.freeze({
  async put(query,value,{requestedAt}={}){
   const key=queryKey(query),data=snapshot(value),savedAt=now();
   need(Number.isSafeInteger(requestedAt)&&requestedAt>=0&&requestedAt<=savedAt,'La fecha del catálogo no es válida.');
   return transaction(true,(store,done,fail)=>{
    const request=store.get([partition,key]);request.onsuccess=()=>{try{
     // A slow, older response must not replace a more recent request's result.
     if(request.result?.requestedAt>=requestedAt){done(false);return;}
     store.put({partition,query:key,requestedAt,savedAt,data,fingerprint:canonical(data)});done(true);
    }catch(error){fail(error);}};
   });
  },
  async pages({includeExpired=false}={}){
   need(typeof includeExpired==='boolean','La consulta de catálogo no es válida.');
   return transaction(false,(store,done,fail)=>{
    const rows=[],request=store.openCursor(IDBKeyRange.bound([partition],[partition,[]]));
    request.onsuccess=()=>{try{const cursor=request.result;if(!cursor){done(rows);return;}const row=cursor.value;
     need(row.partition===partition&&Number.isSafeInteger(row.savedAt)&&Number.isSafeInteger(row.requestedAt)&&row.requestedAt>=0&&row.requestedAt<=row.savedAt&&row.fingerprint===canonical(row.data),'El catálogo guardado requiere una actualización.');
     const instant=now(),age=instant-row.requestedAt;if(instant>=row.savedAt&&age>=0&&(includeExpired||age<Math.min(86400000,...row.data.items.map(item=>item.priceValidForMs??86400000))))rows.push({data:snapshot(row.data),savedAt:row.savedAt,requestedAt:row.requestedAt});
     cursor.continue();
    }catch(error){fail(error);}};
   });
  },
  async get(query,{maxAgeMs=86400000}={}){
   need(Number.isSafeInteger(maxAgeMs)&&maxAgeMs>=0&&maxAgeMs<=86400000,'La vigencia del catálogo no es válida.');
   const key=queryKey(query);
   return transaction(false,(store,done,fail)=>{
    const request=store.get([partition,key]);request.onsuccess=()=>{try{
     const row=request.result;if(!row){done(null);return;}
     need(row.partition===partition&&row.query===key&&Number.isSafeInteger(row.savedAt)&&Number.isSafeInteger(row.requestedAt)&&row.requestedAt<=row.savedAt&&row.fingerprint===canonical(row.data),'El catálogo guardado ha cambiado. Conecta para actualizarlo.');
     const instant=now(),age=instant-row.requestedAt;
     if(instant<row.savedAt||age<0||age>=Math.min(maxAgeMs,...row.data.items.map(item=>item.priceValidForMs??86400000))){done(null);return;}
     done({data:snapshot(row.data),savedAt:row.savedAt,requestedAt:row.requestedAt});
    }catch(error){fail(error);}};
   });
  }
 });
}
