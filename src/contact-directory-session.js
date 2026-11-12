import {DIRECTORY_KINDS,directoryQuery} from './contact-directory-contract.js';
import {storeConnection} from './prestashop-readonly.js';

export function createDirectorySession({kind,actor,can,rpc,invoke,onProgress=()=>{}}){
 if(!DIRECTORY_KINDS[kind])throw Error('Directorio no válido.');
 let owner=null,store=null,connection=null,generation=0,busy=false;
 const cache=new Map(),intents=new Map(),pending=new Map();
 const current=(who,n)=>owner===who&&actor()===who&&generation===n&&can('view');
 const ensure=(who,n)=>{if(!current(who,n))throw Error('La cuenta o la tienda ha cambiado. Abre de nuevo el directorio.');};
 async function enter(nextStore){
  if(busy)throw Error('Espera a que termine la publicación actual.');
  const who=actor(),n=++generation;owner=who;store=nextStore;connection=null;
  if(!who||!can('view'))throw Error('No tienes acceso al directorio.');
  const result=await rpc('totus_directory_context',{p_kind:kind,p_action:'view'});ensure(who,n);
  const selected=storeConnection(result?.connections,nextStore);
  if(!selected?.enabled||!selected.configured||selected.revision!==selected.verified_revision||selected.real_data_authorized!==true)throw Error('La conexión de esta tienda está desactivada, sin verificar o sin autorización. Revisa APIs.');
  connection=selected;return {...selected,store};
 }
 function requestIdentity(){if(!connection||actor()!==owner||!can('view'))throw Error('Actualiza la conexión del directorio.');return {kind,store,id:connection.id,revision:connection.revision};}
 function peek(resource,filters={}){
  requestIdentity();const key=owner+'|'+store+'|'+connection.id+'|'+connection.revision+'|'+resource+'|'+JSON.stringify(filters);
  return cache.has(key)?structuredClone(cache.get(key)):null;
 }
 async function read(resource,filters={},options={}){
  const identity=requestIdentity(),who=owner,n=generation,key=who+'|'+store+'|'+connection.id+'|'+connection.revision+'|'+resource+'|'+JSON.stringify(filters);
  if(options.cached&&cache.has(key))return structuredClone(cache.get(key));
  const pendingKey=n+'|'+key;
  if(pending.has(pendingKey))return structuredClone(await pending.get(pendingKey));
  const task=readPages();pending.set(pendingKey,task);
  try{return structuredClone(await task);}finally{if(pending.get(pendingKey)===task)pending.delete(pendingKey);}
  async function readPages(){
  const rows=[],seen=new Set();
  for(let page=0;page<=1000;page++){
   ensure(who,n);const query=directoryQuery({action:'prestashop_directory_read',...identity,call_id:crypto.randomUUID(),resource,page,page_size:100,...filters});const result=await invoke(query);ensure(who,n);
   if(result?.ok!==true||result.store!==store||result.kind!==kind||result.resource!==resource||result.page!==page||!Array.isArray(result.rows)||result.rows.length>100||typeof result.possibly_more!=='boolean'||!result.rows.length&&result.possibly_more)throw Error('Respuesta de directorio incompleta o de otra tienda.');
   for(const row of result.rows){if(!/^[1-9]\d{0,14}$/.test(String(row?.id))||seen.has(String(row.id)))throw Error('La tienda devolvió un registro repetido o sin ID.');seen.add(String(row.id));rows.push(row);}
   onProgress({resource,loaded:rows.length,store,complete:!result.possibly_more});
   if(!result.possibly_more){const data={rows,complete:true,checked:new Date().toISOString(),store,resource};cache.set(key,structuredClone(data));return data;}
  }
  throw Error('La tienda no ha terminado de paginar el directorio. No se presenta como completo.');
  }
 }
 async function publish(resource,recordId,fields,operation='update'){
  const permission={update:'edit',create:'create',delete:'delete'}[operation];
  if(!permission||!can(permission)||busy)throw Error(busy?'Hay una publicación en curso.':'No tienes permiso para publicar este cambio.');
  fields=Object.fromEntries(Object.entries(fields).sort(([a],[b])=>a.localeCompare(b)));
  const identity=requestIdentity(),who=owner,n=generation,key=JSON.stringify({...identity,resource,operation,recordId,fields});
  const requestId=intents.get(key)||crypto.randomUUID();intents.set(key,requestId);busy=true;
  const body={...identity,resource,operation,fields,request_id:requestId,...(operation!=='create'?{record_id:String(recordId)}:{})};
  try{
   const prepared=await invoke({...body,action:'prestashop_directory_prepare',call_id:crypto.randomUUID()});ensure(who,n);
   if(prepared?.ok===true&&prepared.persisted===true&&prepared.verified===true&&prepared.store===store&&prepared.kind===kind&&prepared.resource===resource&&/^[1-9]\d{0,14}$/.test(String(prepared.record_id))&&(operation==='create'||String(prepared.record_id)===String(recordId))){for(const cacheKey of cache.keys())if(cacheKey.startsWith(who+'|'+store+'|'))cache.delete(cacheKey);intents.delete(key);return prepared;}
   if(prepared?.ok!==true||prepared.can_commit!==true||prepared.store!==store||prepared.kind!==kind||prepared.resource!==resource||operation!=='create'&&String(prepared.record_id)!==String(recordId)||!/^[a-f\d]{64}$/.test(prepared.fingerprint||''))throw Error('No se pudo revisar la publicación en la tienda elegida.');
   const result=await invoke({...body,action:'prestashop_directory_commit',call_id:crypto.randomUUID(),fingerprint:prepared.fingerprint,confirmed:true});ensure(who,n);
   if(result?.ok!==true||result.verified!==true||result.store!==store||result.kind!==kind||result.resource!==resource||!/^[1-9]\d{0,14}$/.test(String(result.record_id))||operation!=='create'&&String(result.record_id)!==String(recordId)||!result.persisted&&!result.unchanged)throw Error('La tienda no ha confirmado y verificado la publicación.');
   for(const cacheKey of cache.keys())if(cacheKey.startsWith(who+'|'+store+'|'))cache.delete(cacheKey);
   intents.delete(key);return result;
  }finally{busy=false;}
 }
 return {enter,read,peek,publish,get store(){return store;},get publishing(){return busy;},dispose(){generation++;connection=null;owner=null;store=null;},clearCache(){cache.clear();}};
}
