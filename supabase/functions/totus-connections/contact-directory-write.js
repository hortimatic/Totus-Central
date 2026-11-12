import {directoryMutation,directoryLocalized} from '../../../src/contact-directory-contract.js';
import {prestashopStore,storeConnection} from '../../../src/prestashop-readonly.js';
import {directorySchemaProjection,directoryXmlLanguages,selectedXmlValues,prepareProductStageXml,directoryXmlField,sha256Text} from '../../../src/productos-write-contract.js';
import {safeEndpoint,connectionHeaders,boundedText,boundedJson} from './transport.js';

const numeric=field=>field.startsWith('id_')||['position','active','newsletter','optin','is_guest','show_public_prices','custom','max_payment_days','outstanding_allow_amount'].includes(field);
const same=(field,a,b)=>a===b||numeric(field)&&a!==''&&b!==''&&Number.isFinite(Number(a))&&Number(a)===Number(b);

// This module receives a connection only after authenticated directory/module
// authorization. Its journal is server-only and stores no customer fields.
export async function writeContactDirectory(connection,input,{request=fetch,resolve,journal=/** @type {any} */(null)}={}){
 const q=directoryMutation(input),commit=q.action==='prestashop_directory_commit',store=prestashopStore(q.store);
 if(!connection||storeConnection([connection],q.store)!==connection||connection.id!==q.id||connection.revision!==q.revision||!connection.enabled||connection.verified_revision!==q.revision||connection.real_data_authorized!==true)throw Error('Actualiza y verifica la conexión de esta tienda.');
 const base=new URL(connection.endpoint);
 if(base.origin!==store.origin||base.pathname.replace(/\/$/,'')!=='/api'||base.search||base.hash)throw Error('La escritura exige la API oficial de la tienda elegida.');
 if(commit&&!journal)throw Error('No está disponible el registro duradero de publicación.');
 const headers={...connectionHeaders(connection),Accept:'application/xml'};
 const url=(resource,id=null,params={})=>{const u=new URL(base);u.pathname='/api/'+resource+(id?'/'+id:'');for(const [k,v]of Object.entries(params))u.searchParams.set(k,v);return u;};
 async function send(u,method='GET',body){const target=await safeEndpoint(u.href,resolve);return request(target.href,{method,headers:{...headers,...(body?{'Content-Type':'application/xml; charset=utf-8'}:{})},body,credentials:'omit',redirect:'error',signal:AbortSignal.timeout(20000)});}
 async function xml(u,{missing=false}={}){const r=await send(u);if(missing&&r.status===404){await r.body?.cancel();return null;}if(!r.ok){await r.body?.cancel();throw Error('La tienda rechazó la ficha del directorio (HTTP '+r.status+').');}if(/html/i.test(r.headers.get('content-type')||'')){await r.body?.cancel();throw Error('La tienda devolvió una página de acceso.');}return boundedText(r,2097152);}
 async function list(resource,params={},page=0){const r=await send(url(resource,null,{output_format:'JSON',display:'[id]',limit:page*100+',100',sort:'[id_ASC]',...params}));if(!r.ok){await r.body?.cancel();throw Error('No se pudo comprobar la relación '+resource+'.');}const value=await boundedJson(r),rows=Array.isArray(value)&&!value.length?[]:value?.[resource];if(!Array.isArray(rows)||rows.length>100||rows.some(row=>!/^\d+$/.test(String(row.id))))throw Error('Relación de directorio no verificable.');return rows;}
 const signature=await sha256Text(JSON.stringify({store:q.store,kind:q.kind,resource:q.resource,operation:q.operation,id:q.record_id||null,fields:Object.fromEntries(Object.entries(q.fields).sort(([a],[b])=>a.localeCompare(b)))}));
 const previous=commit?await journal.lookup(signature):null;
 // Creation and shared-value deletion are handled by dedicated native flows.
 // Never fall back to an update or a blind POST for an unknown operation.
 if(q.operation!=='update')throw Error('Esta operación de directorio todavía no está disponible.');
 const schema=await xml(url(q.resource,null,{schema:'synopsis'})),projection=directorySchemaProjection(schema,q.resource),target=url(q.resource,q.record_id,{display:projection});
 const original=await xml(target),fingerprint=await sha256Text(original);
 if(directoryXmlField(original,q.resource,'id')!==String(q.record_id))throw Error('La tienda devolvió otra ficha.');
 if(q.resource==='addresses'){
  const own={clientes:'id_customer',proveedores:'id_supplier',marcas:'id_manufacturer'}[q.kind];
  if(!/^[1-9]\d*$/.test(directoryXmlField(original,q.resource,own)))throw Error('La dirección no pertenece al directorio elegido.');
  for(const field of ['id_customer','id_supplier','id_manufacturer'])if(field!==own&&Number(directoryXmlField(original,q.resource,field)||0)>0)throw Error('La dirección pertenece a otro directorio.');
  for(const field of ['id_customer','id_supplier','id_manufacturer'])if(q.fields[field]!==undefined&&!same(field,directoryXmlField(original,q.resource,field),q.fields[field]))throw Error('No se puede trasladar una dirección a otro titular. Crea una dirección nueva.');
 }
 let languages=null;
 const changes=[];
 for(const [field,value]of Object.entries(q.fields)){
  if(directoryLocalized(q.resource,field)){
   if(!languages){const r=await send(url('languages',null,{output_format:'JSON',display:'[id,iso_code,active]',limit:'0,100'}));if(!r.ok){await r.body?.cancel();throw Error('No se pudo leer el idioma de la tienda.');}const payload=await boundedJson(r);languages=payload.languages;if(!Array.isArray(languages)||!languages.length||languages.length>=100)throw Error('Inventario de idiomas incompleto.');}
   const ids=directoryXmlLanguages(original,q.resource,field),chosen=languages.find(l=>String(l.active)==='1'&&l.iso_code==='es'&&ids.includes(String(l.id)))||languages.find(l=>String(l.active)==='1'&&ids.includes(String(l.id)));
   if(!chosen)throw Error('No hay un idioma activo compatible con esta ficha.');changes.push({field,value,language_id:String(chosen.id)});
  }else changes.push({field,value});
 }
 const checked=selectedXmlValues(original,q.resource,q.record_id,changes);
 const differences=checked.changes.map(c=>({...c,changed:!same(c.field,c.before,c.value)}));
 if(previous){
  if(differences.some(c=>c.changed))throw Error('Hay una publicación previa pendiente. Actualiza la ficha para consultar su resultado antes de repetirla.');
  if(previous.status!=='completed')await journal.complete(signature,String(q.record_id));
  return {ok:true,store:q.store,kind:q.kind,resource:q.resource,record_id:String(q.record_id),persisted:true,verified:true,replayed:true};
 }
 if(!commit)return {ok:true,store:q.store,kind:q.kind,resource:q.resource,record_id:String(q.record_id),fingerprint,changes:differences,can_commit:true,persisted:false};
 if(q.fingerprint!==fingerprint)throw Error('La ficha ha cambiado. Actualiza la revisión antes de publicar.');
 if(!differences.some(c=>c.changed))return {ok:true,store:q.store,kind:q.kind,resource:q.resource,record_id:String(q.record_id),unchanged:true,verified:true,persisted:false};
 // Validate referenced entities in the same shop before applying any update.
 for(const [field,resource]of Object.entries({id_default_group:'groups',id_lang:'languages',id_country:'countries',id_state:'states',id_attribute_group:'product_options',id_feature:'product_features'}))if(Number(q.fields[field])>0){const rows=await list(resource,{'filter[id]':'['+q.fields[field]+']'});if(rows.length!==1||String(rows[0].id)!==q.fields[field])throw Error('Selecciona un registro existente de '+resource+' en esta tienda.');}
 if(await sha256Text(await xml(target))!==fingerprint)throw Error('La ficha cambió durante la revisión. No se ha escrito nada.');
 const claim=await journal.claim(signature,String(q.record_id));if(claim?.status!=='claimed')throw Error('La publicación ya está en curso.');
 let status;
 try{const response=await send(target,'PUT',prepareProductStageXml(checked.patched,q.resource,{}, {},String(q.record_id)));status=response.status;await response.body?.cancel();}catch{await journal.uncertain(signature,String(q.record_id));throw Error('Resultado de publicación incierto. Actualiza esta misma ficha antes de reintentar.');}
 try{
  if(status>=400&&status!==500)throw Error('La tienda rechazó la publicación.');
  const reread=await xml(target),result=selectedXmlValues(reread,q.resource,q.record_id,changes);
  if(result.changes.some(c=>!same(c.field,c.before,c.value)))throw Error('La relectura no coincide con los cambios publicados.');
  await journal.complete(signature,String(q.record_id));
  return {ok:true,store:q.store,kind:q.kind,resource:q.resource,record_id:String(q.record_id),persisted:true,verified:true,...(status>=400?{reconciled:true}:{}),request_id:q.request_id};
 }catch{await journal.uncertain(signature,String(q.record_id));throw Error('La tienda respondió HTTP '+status+' y no se pudo verificar la publicación. Actualiza la ficha; no se repetirá automáticamente.');}
}
