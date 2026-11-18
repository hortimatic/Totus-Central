import {saleModifiers} from './sale-modifiers.js';
import {saleNote} from './sale-note.js';
import {offlineCommercial} from './offline-commercial.js';
import {paymentReference} from './payment-reference.js';
/** Local delivery journal. A saved entry is NOT a confirmed remote sale.
 * Dispatch claims never expire into a second POST. Reconcile by the same ID.
 * No authentication tokens or shop credentials belong in this store.
 */
const need=(ok,message)=>{if(!ok)throw Error(message);};
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
const fields=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>keys.includes(key));
const positive=value=>Number.isSafeInteger(value)&&value>0;
function scopeKey(scope){
 need(scope&&['actorId','connectionId','storeId','drawerId','deviceId'].every(key=>uuid(scope[key]))&&Number.isSafeInteger(scope.shopId)&&scope.shopId>0,'El puesto local no está identificado.');
 return JSON.stringify(['actorId','connectionId','storeId','shopId','drawerId','deviceId'].map(key=>scope[key]));
}
const canonical=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
function validateTicket(ticket){
   if(ticket?.commercial!==undefined){const c=offlineCommercial(ticket.commercial);need((ticket.customerId===undefined||ticket.customerId===c.customerId)&&(ticket.addressId===undefined||ticket.addressId===c.invoiceAddressId)&&c.totalCents===ticket.totalCents&&c.currency===ticket.currency&&Array.isArray(ticket.lines)&&c.lines.length===ticket.lines.length&&ticket.lines.every(line=>c.lines.some(native=>native.productId===line.productId&&native.attributeId===(line.attributeId??0)&&native.qty===line.qty)),'El desglose no corresponde al ticket guardado.');}
   need(ticket&&typeof ticket==='object'&&!Array.isArray(ticket)&&Object.keys(ticket).every(key=>['lines','customerId','addressId','totalCents','currency','payments','catalogueRevision','cashSessionId','commercial','note','adjustment','coupon'].includes(key)),'Datos de ticket local no válidos.');
   need(ticket.note===undefined||typeof ticket.note==='string'&&ticket.note.length>0&&saleNote(ticket.note)===ticket.note,'La nota del ticket local no es válida.');
   need(Array.isArray(ticket.lines)&&ticket.lines.length>0&&ticket.lines.length<=200&&Array.isArray(ticket.payments)&&ticket.payments.length<=4&&ticket.currency==='EUR'&&Number.isSafeInteger(ticket.totalCents)&&ticket.totalCents>=0,'El ticket local no está completo.');
   need(ticket.lines.every(line=>fields(line,['productId','attributeId','qty','unitCents','name','discount','displayName'])&&positive(line.productId)&&positive(line.qty)&&line.qty<=10000&&(line.attributeId===undefined||Number.isSafeInteger(line.attributeId)&&line.attributeId>=0)&&(line.unitCents===undefined||Number.isSafeInteger(line.unitCents)&&line.unitCents>=0)&&(line.name===undefined||typeof line.name==='string'&&line.name.length<=512)),'Los artículos del ticket local no son válidos.');
   need(new Set(ticket.lines.map(line=>`${line.productId}:${line.attributeId??0}`)).size===ticket.lines.length,'Agrupa las unidades de cada variante en una sola línea antes de guardar el ticket.');
   saleModifiers(ticket);
   need(ticket.payments.every(row=>fields(row,['method','amountCents','receivedCents','reference'])&&['cash','card','bizum','transfer'].includes(row.method)&&positive(row.amountCents)&&(row.receivedCents===undefined||row.method==='cash'&&Number.isSafeInteger(row.receivedCents)&&row.receivedCents>=row.amountCents)&&(row.reference===undefined||row.method!=='cash'&&typeof row.reference==='string'&&row.reference.length>0&&paymentReference(row.reference)===row.reference))&&new Set(ticket.payments.map(row=>row.method)).size===ticket.payments.length&&ticket.payments.reduce((sum,row)=>sum+row.amountCents,0)===ticket.totalCents,'Los importes o referencias del ticket local no son válidos.');
   need(['customerId','addressId'].every(key=>ticket[key]===undefined||positive(ticket[key]))&&(ticket.cashSessionId===undefined||uuid(ticket.cashSessionId))&&(ticket.catalogueRevision===undefined||typeof ticket.catalogueRevision==='string'&&/^[a-f0-9]{64}$/.test(ticket.catalogueRevision)),'La identificación del ticket local no es válida.');
}
export function createOfflineJournal({scope,indexedDB=globalThis.indexedDB,name='totus-tpv-offline-v1',now=Date.now}={}){
 const partition=scopeKey(scope);
 const open=()=>new Promise((resolve,reject)=>{
  need(indexedDB,'Este navegador no permite guardar ventas sin conexión.');
  const request=indexedDB.open(name,1);let blocked=false;
  request.onupgradeneeded=()=>{const store=request.result.createObjectStore('operations',{keyPath:['partition','id']});store.createIndex('partition','partition');};
  request.onsuccess=()=>{if(blocked){request.result.close();return;}request.result.onversionchange=()=>request.result.close();resolve(request.result);};
  request.onerror=()=>reject(Error('No se ha podido abrir el registro local. No cierres el ticket.'));
  request.onblocked=()=>{blocked=true;reject(Error('Cierra las otras ventanas de Totus para actualizar el registro local.'));};
 });
 async function transaction(write,action){const db=await open();
  try{return await new Promise((resolve,reject)=>{
   let result,failure;const tx=db.transaction('operations',write?'readwrite':'readonly',write?{durability:'strict'}:undefined),store=tx.objectStore('operations');
   tx.oncomplete=()=>resolve(structuredClone(result));
   tx.onabort=()=>reject(failure||Error('No se ha podido guardar el ticket en este dispositivo. No confirmes el cobro.'));
   tx.onerror=()=>{};
   const fail=error=>{failure=error?.name==='QuotaExceededError'?Error('No hay espacio para guardar el ticket en este dispositivo. No confirmes el cobro; conserva la pantalla abierta y pide ayuda al responsable.'):error;tx.abort();};
   try{action(store,value=>{result=value;},fail);}catch(error){fail(error);}
  });}finally{db.close();}
 }
 function validateStored(row,id){need(row.partition===partition&&row.id===id&&uuid(id)&&positive(row.revision)&&['queued','dispatching','uncertain','synced','conflict'].includes(row.status),'El registro local requiere revisión.');validateTicket(row.ticket);need(row.fingerprint===canonical(row.ticket),'Los datos del ticket local han cambiado. Conserva el registro para su revisión.');}
 function getThen(store,id,action,fail){const request=store.get([partition,id]);request.onsuccess=()=>{try{if(request.result)validateStored(request.result,id);action(request.result);}catch(error){fail(error);}};}
 return Object.freeze({
  async capture({id,ticket}){
   need(uuid(id),'El ticket local necesita un identificador válido.');
   validateTicket(ticket);
   const value=structuredClone(ticket),fingerprint=canonical(value);need(fingerprint.length<=250000,'El ticket es demasiado grande para guardarlo.');
   return transaction(true,(store,done,fail)=>getThen(store,id,prior=>{
    if(prior){need(prior.fingerprint===fingerprint,'Este identificador ya corresponde a otro ticket.');done(prior);return;}
    const record={partition,id,ticket:value,fingerprint,status:'queued',revision:1,createdAt:now(),updatedAt:now()};store.add(record);done(record);
   },fail));
  },
  get(id){need(uuid(id),'Identificador local no válido.');return transaction(false,(store,done,fail)=>getThen(store,id,row=>done(row||null),fail));},
  list({after='',limit=100}={}){
   need((after===''||uuid(after))&&positive(limit)&&limit<=100,'Revisa la página de ventas pendientes.');
   return transaction(false,(store,done,fail)=>{
    const rows=[],range=IDBKeyRange.bound([partition,after],[partition,'\uffff'],after!=='');
    const request=store.openCursor(range);
    request.onsuccess=()=>{try{const cursor=request.result;if(!cursor){done(rows);return;}
     validateStored(cursor.value,cursor.value.id);rows.push(cursor.value);
     if(rows.length===limit){done(rows);return;}cursor.continue();
    }catch(error){fail(error);}};
   });
  },
  claim(id,revision){need(uuid(id)&&positive(revision),'Identificador o versión del ticket local no válidos.');return transaction(true,(store,done,fail)=>getThen(store,id,row=>{
   need(row,'No se encuentra el ticket local.');
   if(row.status!=='queued'||row.revision!==revision){done({won:false,record:row});return;}
   const record={...row,status:'dispatching',revision:row.revision+1,updatedAt:now()};store.put(record);done({won:true,record});
  },fail));},
  recheck(id,revision){
   need(uuid(id)&&positive(revision),'Identificador o versión del ticket local no válidos.');
   return transaction(true,(store,done,fail)=>getThen(store,id,row=>{
    need(row,'No se encuentra el ticket local.');
    if(row.status!=='conflict'||row.revision!==revision){done({updated:false,record:row});return;}
    // Recovery consults the same remote operation. Never reopen a POST claim.
    const record={...row,status:'uncertain',revision:row.revision+1,updatedAt:now()};store.put(record);done({updated:true,record});
   },fail));
  },
  settle(id,revision,{status,remoteOperationId}={}){
   need(uuid(id)&&positive(revision),'Identificador o versión del ticket local no válidos.');
   need(['uncertain','synced','conflict'].includes(status)&&uuid(remoteOperationId),'Resultado de sincronización no válido.');
   return transaction(true,(store,done,fail)=>getThen(store,id,row=>{
    need(row,'No se encuentra el ticket local.');
    need(remoteOperationId===id,'El resultado corresponde a otra operación.');
    if(row.revision!==revision||!['dispatching','uncertain'].includes(row.status)){done({updated:false,record:row});return;}
    const record={...row,status,remoteOperationId,revision:row.revision+1,updatedAt:now()};store.put(record);done({updated:true,record});
   },fail));
  }
 });
}
