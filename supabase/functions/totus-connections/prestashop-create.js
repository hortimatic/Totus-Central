// Server-side-only PrestaShop product creation.
// Real POST is gated: never enable until the persistent idempotency journal is deployed,
// reviewed, and injected. Do not use this for an unapproved production test.
import {prestashopConnectionStore,storeConnection} from '../../../src/prestashop-readonly.js';
import {validateProductCreateRequest,prepareProductCreationXml,parseCreatedProductId,parsePrestashopResourceId,inspectProductReferenceListing,inspectReconciledNewProduct,productCreateLanguageIds,productLanguageIdsFromListing,minimalBlankProductSchema,sha256Text,LOCALIZED_PRODUCT_FIELDS,readPrestashopXmlField,productRedirectTarget} from '../../../src/productos-write-contract.js';
import {safeEndpoint,connectionHeaders,boundedText} from './transport.js';
import {discoverPrestashop} from './prestashop.js';
export {validateProductCreateRequest} from '../../../src/productos-write-contract.js';

export async function runPrestashopProductCreate(connection,input,{request=fetch,resolve,env=Deno.env,journal=/** @type {any} */(null)}={}){
 const op=validateProductCreateRequest(input),store=prestashopConnectionStore(connection,op.store);
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
 const signature=await sha256Text(JSON.stringify({store:op.store,reference:op.reference,price:op.price,category_id:op.category_id,translations:op.translations,fields:op.fields,relations:op.relations}));
 const verifyReadback=async(expectedId=null)=>{
  const extra=[...op.fields.map(f=>f.field),...LOCALIZED_PRODUCT_FIELDS.filter(f=>!['name','link_rewrite'].includes(f)).filter(f=>op.translations.some(t=>Object.prototype.hasOwnProperty.call(t,f)))];
  for(const [key,field] of [['manufacturer_id','id_manufacturer'],['supplier_id','id_supplier'],['tax_rules_group_id','id_tax_rules_group'],['category_ids','categories[id]'],['related_product_ids','accessories[id]'],['tag_ids','tags[id]'],['features','product_features[id,id_feature_value]']])if(Object.prototype.hasOwnProperty.call(op.relations||{},key))extra.push(field);
  const xml=await fetchXml('products',{'filter[reference]':'['+op.reference+']',language:'['+op.translations.map(t=>t.language_id).join('|')+']',display:'['+['id','reference','active','price','id_category_default','name','link_rewrite',...extra].join(',')+']'});
  return inspectReconciledNewProduct(xml,op,expectedId);
 };
 let retrying=false,previousSignature=null;
 if(op.commit){
  const prior=await journal.lookup(op.request_id);
  if(prior){
   if(prior.store!==op.store||prior.reference!==op.reference||
      (prior.signature!==signature&&!op.retry_absent))
    throw Error('El request_id ya se ha usado para otra solicitud.');
   if(!['pending','uncertain','completed'].includes(prior.status))throw Error('Estado de alta no verificable.');
   const found=inspectProductReferenceListing(await fetchXml('products',{'filter[reference]':'['+op.reference+']',display:'[id,reference]'}));
   if(op.retry_absent&&prior.status==='uncertain'&&!prior.product_id&&found.length===0){
    if(typeof journal.retryAbsent!=='function')throw Error('Falta el registro de recuperación revisado.');
    retrying=true;previousSignature=prior.signature;
   }else{
    if(prior.signature!==signature)throw Error('La solicitud corregida no puede sustituir un producto existente o una operación en curso.');
    const verified=await verifyReadback(prior.product_id||null);
    if(prior.status!=='completed')await journal.complete({request_id:op.request_id,signature,product_id:verified.id});
    return {ok:true,store:op.store,resource:'products',record_id:String(verified.id),request_id:op.request_id,persisted:true,verified:true,active:false,reused:true};
   }
  }
  else if(op.retry_absent)throw Error('No existe una solicitud incierta propia que recuperar.');
 }
 let schema,legacy_schema_fallback=false;
 try{schema=await fetchXml('products',{schema:'blank'});}
 catch(error){
  // Known PrestaShop 1.7.8 blank-schema bug: use fresh destination languages,
  // never import an existing product or reuse its shop-specific relations.
  if(!String(error?.message||'').includes('(HTTP 500)'))throw error;
  legacy_schema_fallback=true;
 }
 // The schema endpoint can be scoped to only the default language. The same
 // destination language inventory must govern both profile and POST validation.
 const languageListing=await fetchXml('languages',{display:'[id]'});
 if(!legacy_schema_fallback){
  if(readPrestashopXmlField(schema,'product','id').trim())throw Error('El esquema de alta contiene un producto existente.');
  productCreateLanguageIds(schema);
 }
 schema=minimalBlankProductSchema(productLanguageIdsFromListing(languageListing));
 const category=await fetchXml('categories/'+op.category_id);
 if(parsePrestashopResourceId(category,'category')!==op.category_id)throw Error('La categoría pertenece a otro registro.');
 const checked=new Set(['categories/'+op.category_id]);
 const verifyRelation=async(resource,node,id)=>{
  const key=resource+'/'+id;
  if(checked.has(key))return null;
  const xml=await fetchXml(key,resource==='products'?{display:'[id]'}:{});
  if(parsePrestashopResourceId(xml,node)!==id)throw Error('La relación '+resource+' no coincide con el registro elegido.');
  checked.add(key);return xml;
 };
 const redirectType=op.fields.find(f=>f.field==='redirect_type');if(redirectType){const redirect=productRedirectTarget(redirectType.value,op.fields.find(f=>f.field==='id_type_redirected')?.value);if(redirect)await verifyRelation(redirect.resource,redirect.node,redirect.id);}
 for(const [key,resource,node] of [['manufacturer_id','manufacturers','manufacturer'],['supplier_id','suppliers','supplier'],['tax_rules_group_id','tax_rule_groups','tax_rule_group']])if(op.relations?.[key])await verifyRelation(resource,node,op.relations[key]);
 for(const [key,resource,node] of [['category_ids','categories','category'],['related_product_ids','products','product'],['tag_ids','tags','tag']])for(const id of op.relations?.[key]||[])await verifyRelation(resource,node,id);
 for(const feature of op.relations?.features||[]){
  await verifyRelation('product_features','product_feature',feature.feature_id);
  const xml=await verifyRelation('product_feature_values','product_feature_value',feature.value_id);
  if(!xml||readPrestashopXmlField(xml,'product_feature_value','id_feature')!==feature.feature_id)throw Error('El valor no pertenece a la característica seleccionada.');
 }

 const duplicates=inspectProductReferenceListing(await fetchXml('products',{'filter[reference]':'['+op.reference+']',display:'[id,reference]'}));
 if(duplicates.length)throw Error('Ya existe un producto con esa referencia en la tienda de destino. No se creará otro.');
 const body=prepareProductCreationXml(schema,op);
 const fingerprint=await sha256Text(schema+'|'+category+'|'+signature);
 if(!op.commit)return {ok:true,store:op.store,resource:'products',operation:'create',reference:op.reference,category_id:op.category_id,
  language_ids:op.translations.map(t=>t.language_id),fingerprint,legacy_schema_fallback,persisted:false,can_commit:env.get('TOTUS_PRESTASHOP_PRODUCT_CREATE_ENABLED')==='1'};
 if(fingerprint!==op.expected_fingerprint)throw Error('El esquema o la categoría han cambiado. Prepara el alta de nuevo.');
 const claim=await (retrying?journal.retryAbsent:journal.claim)({request_id:op.request_id,store:op.store,reference:op.reference,signature,...(retrying?{previous_signature:previousSignature}:{})});
 if(claim?.status!=='claimed')throw Error('El alta está registrada por otro proceso o pendiente de conciliación. No se repetirá.');
 const url=new URL(base.href);url.pathname='/api/products';url.searchParams.set('language','['+op.translations.map(t=>t.language_id).join('|')+']');const target=await safeEndpoint(url.href,resolve);
 let id=null,postProblem=null;
 try{
  const response=await request(target.href,{method:'POST',headers:{...headers,'Content-Type':'application/xml; charset=utf-8'},body,credentials:'omit',redirect:'error',signal:AbortSignal.timeout(30000)});
  if(!response.ok){await response.body?.cancel();throw Error('PrestaShop respondió HTTP '+response.status+'.');}
  id=parseCreatedProductId(await boundedText(response,2097152));
 }catch(error){postProblem=error;}
 let verified;
 try{
  // Mandatory GET even after HTTP 200: the server is the authority, not the
  // POST response. On 1.7.8 a 500 after insert may still mean success.
  verified=await verifyReadback(id);
  id=verified.id;
 }catch(readbackError){
  await journal.uncertain({request_id:op.request_id,signature,...(id?{product_id:id}:{}),
   reason:'La relectura del resultado del POST no permite acreditar el alta'});
  throw Error('Alta incierta. NO repitas la creación: revisa la referencia y el diario antes de continuar. '
   +(postProblem instanceof Error?postProblem.message+' ':'')
   +(readbackError instanceof Error?readbackError.message:''));
 }
 try{
  await journal.complete({request_id:op.request_id,signature,product_id:id});
 }catch{
  // The database update might have completed despite a lost response.
  // Never issue another POST or silently unlock this reference.
  throw Error('El producto existe y se ha verificado por GET, pero falta confirmar el diario. No repitas el POST; concilia el request_id.');
 }
 return {ok:true,store:op.store,resource:'products',record_id:id,request_id:op.request_id,
  persisted:true,verified:true,active:false,reconciled_after_post_error:!!postProblem};
}


// Read-only preparation: language IDs come from the destination's own Webservice.
// It does not need or disclose any credentials on the client and never uses POST.
export async function readPrestashopProductCreateProfile(connection,input,{request=fetch,resolve}={}){
 const store=prestashopConnectionStore(connection,input.store);
 if(!connection||storeConnection([connection],store.key)!==connection||connection.enabled!==true||
    connection.verified_revision!==connection.revision||connection.real_data_authorized!==true)
  throw Error('La conexión no corresponde a la tienda activa y verificada.');
 const base=new URL(connection.endpoint);
 if(base.origin!==store.origin||base.search||base.hash||base.pathname.replace(/\/$/,'')!=='/api')
  throw Error('La dirección Webservice no pertenece a esta tienda.');
 base.pathname='/api/languages';base.searchParams.set('display','[id]');
 const target=await safeEndpoint(base.href,resolve);
 const response=await request(target.href,{method:'GET',headers:{...connectionHeaders(connection),Accept:'application/xml'},
  credentials:'omit',redirect:'error',signal:AbortSignal.timeout(20000)});
 if(!response.ok){await response.body?.cancel();throw Error('No se pudo consultar los idiomas de la tienda (HTTP '+response.status+').');}
 if(/text\/html|application\/xhtml/i.test(response.headers.get('content-type')||'')){await response.body?.cancel();throw Error('La API devolvió HTML.');}
 const language_ids=productLanguageIdsFromListing(await boundedText(response,2097152));
 const discovery=await discoverPrestashop(connection,input,{request,resolve});
 return {ok:true,store:store.key,resource:'products',language_ids,product_workspace:discovery.product_workspace,persisted:false};
}
