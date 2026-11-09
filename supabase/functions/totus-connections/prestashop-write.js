import {prestashopStore,storeConnection} from '../../../src/prestashop-readonly.js';
import {validateProductWriteRequest,selectedXmlValues,prepareProductStageXml,sha256Text,productLanguageIdsFromListing,productPreservationProjection,productRedirectTarget,parsePrestashopResourceId,readPrestashopXmlField} from '../../../src/productos-write-contract.js';
export {validateProductWriteRequest} from '../../../src/productos-write-contract.js';
import {safeEndpoint,connectionHeaders,boundedText} from './transport.js';

// Server-only XML transport. Do NOT expose raw XML, secrets, the prepared XML,
// arbitrary URLs or audit payloads containing descriptions to the browser.
// POST (new product), stock and associations intentionally remain unsupported.
export async function runPrestashopProductWrite(connection,input,{request=fetch,resolve,env=Deno.env,journal=/** @type {any} */(null)}={}){
 const operation=validateProductWriteRequest(input);
 const store=prestashopStore(operation.store);
 if(!connection||storeConnection([connection],operation.store)!==connection)throw Error('La conexión no corresponde a la tienda seleccionada.');
 if(connection.enabled!==true||connection.verified_revision!==connection.revision||connection.real_data_authorized!==true)
  throw Error('La conexión no está activada, verificada y autorizada.');
 const base=new URL(connection.endpoint);
 // Writes must never be redirected to a third-party server by editing a connection.
 if(base.origin!==store.origin||base.search||base.hash||base.pathname.replace(/\/$/,'')!=='/api')
  throw Error('La escritura exige la URL oficial /api de la tienda correspondiente.');
 base.pathname='/api/'+operation.resource+'/'+operation.record_id;
 // Native 1.7 can throw while rendering computed image fields before any image
 // exists. Fetch the editable contract and real relations, not cover getters.

 if(operation.commit&&env.get('TOTUS_PRESTASHOP_PRODUCT_WRITE_ENABLED')!=='1')
  throw Error('Escritura de productos bloqueada: falta habilitación técnica revisada.');
 if(operation.commit&&!journal)throw Error('Falta el diario duradero de actualización.');
 const headers={...connectionHeaders(connection),Accept:'application/xml'};
 if(operation.resource==='products'){
  const schemaUrl=new URL(connection.endpoint);schemaUrl.pathname='/api/products';schemaUrl.searchParams.set('schema','synopsis');
  const schemaTarget=await safeEndpoint(schemaUrl.href,resolve),schemaResponse=await request(schemaTarget.href,{method:'GET',headers,credentials:'omit',redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!schemaResponse.ok){await schemaResponse.body?.cancel();throw Error('No se pudo consultar el esquema nativo de conservación (HTTP '+schemaResponse.status+').');}
  base.searchParams.set('display',productPreservationProjection(await boundedText(schemaResponse,2097152)));
 }
 let languageIds=[...new Set(operation.changes.map(row=>row.language_id).filter(Boolean))];
 if(operation.resource==='products'){
  const inventory=new URL(connection.endpoint);inventory.pathname='/api/languages';inventory.searchParams.set('display','[id]');
  const destination=await safeEndpoint(inventory.href,resolve);
  const response=await request(destination.href,{method:'GET',headers,credentials:'omit',redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!response.ok){await response.body?.cancel();throw Error('No se pudo verificar el inventario de idiomas (HTTP '+response.status+').');}
  languageIds=productLanguageIdsFromListing(await boundedText(response,2097152));
 }
 if(languageIds.length)base.searchParams.set('language','['+languageIds.join('|')+']');
 const target=await safeEndpoint(base.href,resolve);
 const read=async()=>{
  const response=await request(target.href,{method:'GET',headers,credentials:'omit',redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!response.ok){await response.body?.cancel();throw Error('PrestaShop rechazó la ficha de origen (HTTP '+response.status+').');}
  if(/text\/html|application\/xhtml/i.test(response.headers.get('content-type')||'')){
   await response.body?.cancel();throw Error('El proveedor devolvió HTML.');
  }
  return boundedText(response,2097152);
 };
 const signature=await sha256Text(JSON.stringify({store:operation.store,resource:operation.resource,id:operation.record_id,parent:operation.expected_product_id||null,changes:operation.changes}));
 const previous=operation.commit?await journal.lookup(signature):null;
 const original=await read(),fingerprint=await sha256Text(original);
 if(operation.resource==='products'&&operation.changes.some(c=>['redirect_type','id_type_redirected'].includes(c.field))){
  const value=field=>operation.changes.find(c=>c.field===field)?.value??readPrestashopXmlField(original,'product',field),redirect=productRedirectTarget(value('redirect_type'),value('id_type_redirected'),operation.record_id);
  if(redirect){const url=new URL(connection.endpoint);url.pathname='/api/'+redirect.resource+'/'+redirect.id;url.searchParams.set('display','[id]');const target=await safeEndpoint(url.href,resolve),response=await request(target.href,{method:'GET',headers,credentials:'omit',redirect:'error',signal:AbortSignal.timeout(20000)});if(!response.ok){await response.body?.cancel();throw Error('El destino de redirección no está disponible en esta tienda.');}if(parsePrestashopResourceId(await boundedText(response,2097152),redirect.node)!==redirect.id)throw Error('El destino de redirección no coincide con el registro elegido.');}
 }
 const result=selectedXmlValues(original,operation.resource,operation.record_id,operation.changes,operation.expected_product_id);
 if(previous){
  if(result.changes.some(row=>row.changed))throw Error('Actualización pendiente o incierta: no se repetirá el PUT. Revisa la ficha real.');
  if(previous.status!=='completed')await journal.complete(signature);
  return {ok:true,store:store.key,resource:operation.resource,record_id:operation.record_id,changes:result.changes,persisted:true,verified:true,replayed:true,request_id:operation.request_id};
 }
 if(!operation.commit)return {ok:true,store:store.key,resource:operation.resource,record_id:operation.record_id,
  fingerprint,changes:result.changes,persisted:false,can_commit:env.get('TOTUS_PRESTASHOP_PRODUCT_WRITE_ENABLED')==='1',revision_required:true};
 if(fingerprint!==operation.expected_fingerprint)
  throw Error('La ficha ha cambiado desde la preparación. Actualiza la vista previa, no se ha escrito nada.');
 const dirty=result.changes.filter(row=>row.changed);
 if(!dirty.length)return {ok:true,store:store.key,resource:operation.resource,record_id:operation.record_id,
  changes:result.changes,persisted:false,unchanged:true};
 // Extra GET shrinks the race window, but cannot make PrestaShop PUT transactional.
 // A persistent request_id journal and technical review are prerequisites to enabling writes.
 const second=await read();
 if(await sha256Text(second)!==fingerprint)throw Error('La ficha ha cambiado durante la operación. No se ha escrito nada.');
 const claim=await journal.claim(signature);if(claim?.status!=='claimed')throw Error('Esta actualización ya se ha enviado; comprueba su resultado.');
 let response;
 try{
  response=await request(target.href,{method:'PUT',headers:{...headers,'Content-Type':'application/xml; charset=utf-8'},body:prepareProductStageXml(result.patched,operation.resource,{}),
   credentials:'omit',redirect:'error',signal:AbortSignal.timeout(20000)});
 }catch{
  await journal.uncertain(signature);
  throw Error('Resultado de escritura incierto. Consulta el producto real antes de reintentar; no generes otro request_id.');
 }
 if(!response.ok){const code=response.status;await response.body?.cancel();
  // Native 1.7 may save successfully and then fail serializing calculated fields.
  // Only an exact readback can reconcile that response; never issue another PUT.
  if(code===500){
   try{const checked=selectedXmlValues(await read(),operation.resource,operation.record_id,operation.changes,operation.expected_product_id);
    if(checked.changes.every(row=>!row.changed)){await journal.complete(signature);return {ok:true,store:store.key,resource:operation.resource,record_id:operation.record_id,changes:result.changes,persisted:true,verified:true,reconciled:true,request_id:operation.request_id};}
   }catch{}
  }
  await journal.uncertain(signature);
  throw Error('PrestaShop rechazó la escritura (HTTP '+code+'). Comprueba el producto antes de reintentar.');}
 await response.body?.cancel();
 let verification;
 try{verification=selectedXmlValues(await read(),operation.resource,operation.record_id,operation.changes,operation.expected_product_id);}
 catch{await journal.uncertain(signature);throw Error('PrestaShop respondió correctamente pero la relectura falló. Estado incierto: comprobar manualmente.');}
 if(verification.changes.some(row=>row.changed)){await journal.uncertain(signature);throw Error('PrestaShop respondió, pero la relectura no coincide con los valores solicitados. Revisión obligatoria.');}
 await journal.complete(signature);
 return {ok:true,store:store.key,resource:operation.resource,record_id:operation.record_id,
  changes:result.changes,persisted:true,verified:true,request_id:operation.request_id};
}
