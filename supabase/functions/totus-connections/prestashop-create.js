// Server-side-only PrestaShop product creation.
// Real POST is gated: never enable until the persistent idempotency journal is deployed,
// reviewed, and injected. Do not use this for an unapproved production test.
import {prestashopStore,storeConnection} from '../../../src/prestashop-readonly.js';
import {validateProductCreateRequest,prepareProductCreationXml,parseCreatedProductId,parsePrestashopResourceId,inspectProductReferenceListing,inspectNewProduct,productCreateLanguageIds,sha256Text} from '../../../src/productos-write-contract.js';
import {safeEndpoint,connectionHeaders,boundedText} from './transport.js';
export {validateProductCreateRequest} from '../../../src/productos-write-contract.js';

export async function runPrestashopProductCreate(connection,input,{request=fetch,resolve,env=Deno.env,journal=/** @type {any} */(null)}={}){
 const op=validateProductCreateRequest(input),store=prestashopStore(op.store);
 if(!connection||storeConnection([connection],store.key)!==connection||connection.enabled!==true||
  connection.verified_revision!==connection.revision||connection.real_data_authorized!==true)
  throw Error('La conexión no corresponde a una tienda activa y verificada.');
 const base=new URL(connection.endpoint);
 if(base.origin!==store.origin||base.search||base.hash||base.pathname.replace(/\/$/,'')!=='/api')
  throw Error('El alta exige la URL oficial de la tienda seleccionada.');
 if(op.commit&&(env.get('TOTUS_PRESTASHOP_PRODUCT_CREATE_ENABLED')!=='1'||!journal||
  !['lookup','claim','complete','uncertain'].every(k=>typeof journal[k]==='function')))
  throw Error('Alta bloqueada: falta habilitación revisada y registro duradero de idempotencia.');
 const headers={...connectionHeaders(connection),Accept:'application/xml'};
 const fetchXml=async(path,params)=>{
  const url=new URL(base.href);url.pathname='/api/'+path;
  for(const [key,value] of Object.entries(params||{}))url.searchParams.set(key,value);
  const target=await safeEndpoint(url.href,resolve);
  const response=await request(target.href,{method:'GET',headers,credentials:'omit',redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!response.ok){await response.body?.cancel();throw Error('PrestaShop rechazó la consulta de '+path+' (HTTP '+response.status+').');}
  if(/text\/html|application\/xhtml/i.test(response.headers.get('content-type')||'')){await response.body?.cancel();throw Error('La tienda devolvió HTML, no datos Webservice.');}
  return boundedText(response,2097152);
 };
 const signature=await sha256Text(JSON.stringify({store:op.store,reference:op.reference,price:op.price,category_id:op.category_id,translations:op.translations}));
 if(op.commit){
  const prior=await journal.lookup(op.request_id);
  if(prior){
   if(prior.signature!==signature||prior.store!==op.store||prior.reference!==op.reference)
    throw Error('El request_id ya se ha usado para otra solicitud.');
   if(prior.status!=='completed'||!prior.product_id)throw Error('Alta anterior pendiente o incierta; no se repetirá el POST.');
   const written=await fetchXml('products/'+prior.product_id);
   inspectNewProduct(written,prior.product_id,op.reference);
   return {ok:true,store:op.store,resource:'products',record_id:prior.product_id,request_id:op.request_id,persisted:true,verified:true,reused:true};
  }
 }
 const schema=await fetchXml('products',{schema:'blank'});
 const category=await fetchXml('categories/'+op.category_id);
 if(parsePrestashopResourceId(category,'category')!==op.category_id)throw Error('La categoría pertenece a otro registro.');
 const duplicates=inspectProductReferenceListing(await fetchXml('products',{'filter[reference]':'['+op.reference+']',display:'[id,reference]'}));
 if(duplicates.length)throw Error('Ya existe un producto con esa referencia en la tienda de destino. No se creará otro.');
 const body=prepareProductCreationXml(schema,op);
 const fingerprint=await sha256Text(schema+'|'+category+'|'+signature);
 if(!op.commit)return {ok:true,store:op.store,resource:'products',operation:'create',reference:op.reference,category_id:op.category_id,
  language_ids:op.translations.map(t=>t.language_id),fingerprint,persisted:false,can_commit:false};
 if(fingerprint!==op.expected_fingerprint)throw Error('El esquema o la categoría han cambiado. Prepara el alta de nuevo.');
 const claim=await journal.claim({request_id:op.request_id,store:op.store,reference:op.reference,signature});
 if(claim?.status!=='claimed')throw Error('El alta está registrada por otro proceso o pendiente de conciliación. No se repetirá.');
 const url=new URL(base.href);url.pathname='/api/products';const target=await safeEndpoint(url.href,resolve);
 let result,id;
 try{
  result=await request(target.href,{method:'POST',headers:{...headers,'Content-Type':'application/xml; charset=utf-8'},body,credentials:'omit',redirect:'error',signal:AbortSignal.timeout(30000)});
  if(!result.ok){await result.body?.cancel();throw Error('PrestaShop respondió HTTP '+result.status+'.');}
  id=parseCreatedProductId(await boundedText(result,2097152));
 }catch(e){
  await journal.uncertain({request_id:op.request_id,signature,reason:'Respuesta de alta incierta'});
  throw Error('Resultado del alta incierto; revisar la referencia antes de reintentar. '+(e instanceof Error?e.message:''));
 }
 try{
  const written=await fetchXml('products/'+id);
  inspectNewProduct(written,id,op.reference);
  await journal.complete({request_id:op.request_id,signature,product_id:id});
 }catch{
  await journal.uncertain({request_id:op.request_id,signature,product_id:id,reason:'Fallo de relectura'});
  throw Error('PrestaShop respondió al alta, pero la verificación final está pendiente. No reintentar automáticamente.');
 }
 return {ok:true,store:op.store,resource:'products',record_id:id,request_id:op.request_id,persisted:true,verified:true,active:false};
}


// Read-only preparation: language IDs come from the destination's own Webservice.
// It does not need or disclose any credentials on the client and never uses POST.
export async function readPrestashopProductCreateProfile(connection,input,{request=fetch,resolve}={}){
 const store=prestashopStore(input.store);
 if(!connection||storeConnection([connection],store.key)!==connection||connection.enabled!==true||
    connection.verified_revision!==connection.revision||connection.real_data_authorized!==true)
  throw Error('La conexión no corresponde a la tienda activa y verificada.');
 const base=new URL(connection.endpoint);
 if(base.origin!==store.origin||base.search||base.hash||base.pathname.replace(/\/$/,'')!=='/api')
  throw Error('La dirección Webservice no pertenece a esta tienda.');
 base.pathname='/api/products';base.searchParams.set('schema','blank');
 const target=await safeEndpoint(base.href,resolve);
 const response=await request(target.href,{method:'GET',headers:{...connectionHeaders(connection),Accept:'application/xml'},
  credentials:'omit',redirect:'error',signal:AbortSignal.timeout(20000)});
 if(!response.ok){await response.body?.cancel();throw Error('No se pudo leer el esquema de productos (HTTP '+response.status+').');}
 if(/text\/html|application\/xhtml/i.test(response.headers.get('content-type')||'')){await response.body?.cancel();throw Error('La API devolvió HTML.');}
 const language_ids=productCreateLanguageIds(await boundedText(response,2097152));
 return {ok:true,store:store.key,resource:'products',language_ids,persisted:false};
}
