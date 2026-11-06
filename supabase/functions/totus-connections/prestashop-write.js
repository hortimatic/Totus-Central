import {prestashopStore,storeConnection} from '../../../src/prestashop-readonly.js';
import {validateProductWriteRequest,selectedXmlValues,sha256Text} from '../../../src/productos-write-contract.js';
export {validateProductWriteRequest} from '../../../src/productos-write-contract.js';
import {safeEndpoint,connectionHeaders,boundedText} from './transport.js';

// Server-only XML transport. Do NOT expose raw XML, secrets, the prepared XML,
// arbitrary URLs or audit payloads containing descriptions to the browser.
// POST (new product), stock and associations intentionally remain unsupported.
export async function runPrestashopProductWrite(connection,input,{request=fetch,resolve,env=Deno.env}={}){
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
 const target=await safeEndpoint(base.href,resolve);
 const headers={...connectionHeaders(connection),Accept:'application/xml'};
 const read=async()=>{
  const response=await request(target.href,{method:'GET',headers,credentials:'omit',redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!response.ok){await response.body?.cancel();throw Error('PrestaShop rechazó la ficha de origen (HTTP '+response.status+').');}
  if(/text\/html|application\/xhtml/i.test(response.headers.get('content-type')||'')){
   await response.body?.cancel();throw Error('El proveedor devolvió HTML.');
  }
  return boundedText(response,2097152);
 };
 // This is a dry-run GET unless both authenticated API access and a guarded commit
 // have been configured in a separate, reviewed deployment.
 if(operation.commit&&env.get('TOTUS_PRESTASHOP_PRODUCT_WRITE_ENABLED')!=='1')
  throw Error('Escritura de productos bloqueada: falta habilitación técnica revisada.');
 const original=await read(),fingerprint=await sha256Text(original);
 const result=selectedXmlValues(original,operation.resource,operation.record_id,operation.changes,operation.expected_product_id);
 if(!operation.commit)return {ok:true,store:store.key,resource:operation.resource,record_id:operation.record_id,
  fingerprint,changes:result.changes,persisted:false,can_commit:false,revision_required:true};
 if(fingerprint!==operation.expected_fingerprint)
  throw Error('La ficha ha cambiado desde la preparación. Actualiza la vista previa, no se ha escrito nada.');
 const dirty=result.changes.filter(row=>row.changed);
 if(!dirty.length)return {ok:true,store:store.key,resource:operation.resource,record_id:operation.record_id,
  changes:result.changes,persisted:false,unchanged:true};
 // Extra GET shrinks the race window, but cannot make PrestaShop PUT transactional.
 // A persistent request_id journal and technical review are prerequisites to enabling writes.
 const second=await read();
 if(await sha256Text(second)!==fingerprint)throw Error('La ficha ha cambiado durante la operación. No se ha escrito nada.');
 let response;
 try{
  response=await request(target.href,{method:'PUT',headers:{...headers,'Content-Type':'application/xml; charset=utf-8'},body:result.patched,
   credentials:'omit',redirect:'error',signal:AbortSignal.timeout(20000)});
 }catch{
  throw Error('Resultado de escritura incierto. Consulta el producto real antes de reintentar; no generes otro request_id.');
 }
 if(!response.ok){const code=response.status;await response.body?.cancel();
  throw Error('PrestaShop rechazó la escritura (HTTP '+code+'). Comprueba el producto antes de reintentar.');}
 await response.body?.cancel();
 let verification;
 try{verification=selectedXmlValues(await read(),operation.resource,operation.record_id,operation.changes,operation.expected_product_id);}
 catch{throw Error('PrestaShop respondió correctamente pero la relectura falló. Estado incierto: comprobar manualmente.');}
 if(verification.changes.some(row=>row.changed))throw Error('PrestaShop respondió, pero la relectura no coincide con los valores solicitados. Revisión obligatoria.');
 return {ok:true,store:store.key,resource:operation.resource,record_id:operation.record_id,
  changes:result.changes,persisted:true,verified:true,request_id:operation.request_id};
}
