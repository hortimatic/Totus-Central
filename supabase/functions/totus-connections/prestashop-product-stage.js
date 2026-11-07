import {validateProductStage} from '../../../src/productos-stages-contract.js';
import {inspectTransparentProductPng} from '../../../src/productos-png.js';
import {prepareProductStageXml,inspectProductStageXml,minimalProductStageSchema,sha256Text,parsePrestashopResourceId,readPrestashopXmlField,productFinalizationFields,PRODUCT_CREATE_FIELDS,LOCALIZED_PRODUCT_FIELDS} from '../../../src/productos-write-contract.js';
import {prestashopStore,storeConnection} from '../../../src/prestashop-readonly.js';
import {safeEndpoint,connectionHeaders,boundedJson,boundedText} from './transport.js';
export {validateProductStage} from '../../../src/productos-stages-contract.js';

export async function runPrestashopProductStage(connection,input,{request=fetch,resolve,env=Deno.env,journal=/** @type {any} */(null)}={}){
 const op=validateProductStage(input),store=prestashopStore(op.store);
 if(!connection||storeConnection([connection],op.store)!==connection||connection.enabled!==true||connection.verified_revision!==connection.revision||connection.real_data_authorized!==true)throw Error('Conexión de tienda no verificada.');
 const base=new URL(connection.endpoint);
 if(base.origin!==store.origin||base.pathname.replace(/\/$/,'')!=='/api'||base.search||base.hash)throw Error('La etapa exige la API oficial de la tienda.');
 if(!journal||typeof journal.parent!=='function')throw Error('Falta el registro de la creación del producto.');
 const parent=await journal.parent(op.parent_request_id);
 if(parent?.status!=='completed'||String(parent.product_id)!==op.product_id||parent.store!==op.store)throw Error('Esta etapa no pertenece a un producto creado y verificado por tu sesión.');
 const headers={...connectionHeaders(connection),Accept:'application/xml'};
 const call=async(path,options={},query={})=>{
  const url=new URL(base.href);url.pathname='/api/'+path;for(const [k,v] of Object.entries(query))url.searchParams.set(k,String(v));
  const target=await safeEndpoint(url.href,resolve),response=await request(target.href,{...options,method:options.method||'GET',headers:{...headers,...options.headers},redirect:'error',credentials:'omit',signal:AbortSignal.timeout(30000)});
  if(!response.ok){await response.body?.cancel();throw Error('PrestaShop rechazó '+path+' (HTTP '+response.status+').');}
  if(/text\/html|application\/xhtml/i.test(response.headers.get('content-type')||'')){await response.body?.cancel();throw Error('La tienda devolvió HTML en vez del recurso solicitado.');}
  return response;
 };
 const xml=async(path,query={})=>boundedText(await call(path,{},query),2097152);
 const json=async(path,query={})=>boundedJson(await call(path,{headers:{Accept:'application/json'}},{...query,output_format:'JSON'}),2097152);
 // 1.7's getCoverWs dereferences false when a newly created product has no
 // image yet. Do not request calculated cover/position fields for this workflow.
 const productDisplay='['+[...new Set(['id','reference','price','active','id_category_default','id_manufacturer','id_supplier','id_tax_rules_group',...PRODUCT_CREATE_FIELDS,...LOCALIZED_PRODUCT_FIELDS,'categories[id]','images[id]','combinations[id]','product_features[id,id_feature_value]','tags[id]','accessories[id]','attachments[id]'])].join(',')+']';
 const root=await xml('products/'+op.product_id,{display:op.kind==='finish'?productDisplay:'[id,reference]'});
 if(parsePrestashopResourceId(root,'product')!==op.product_id||readPrestashopXmlField(root,'product','reference')!==parent.reference)throw Error('La ficha de destino no corresponde al producto registrado.');
 const rootJson=async()=>{const data=await json('products/'+op.product_id,{display:'[id,reference,images[id]]'});const product=data.product||data.products?.[0];if(String(product?.id)!==op.product_id)throw Error('Ficha de producto no verificable.');return product;};
 const assertVariant=async id=>{
  if(id==='0')return;
  const data=await json('combinations/'+id),row=data.combination||data.combinations?.[0];
  if(String(row?.id)!==id||String(row.id_product)!==op.product_id)throw Error('La combinación pertenece a otro producto.');
 };
 if(op.fields.id_product_attribute)await assertVariant(op.fields.id_product_attribute);
 if(op.kind==='variation'){
  const groups=new Set();
  for(const id of op.associations.product_option_values){
   const data=await json('product_option_values/'+id),row=data.product_option_value||data.product_option_values?.[0];
   if(String(row?.id)!==id||!row.id_attribute_group||groups.has(String(row.id_attribute_group)))throw Error('Los atributos de la combinación no son válidos o repiten un grupo.');
   groups.add(String(row.id_attribute_group));
  }
 }
 if(op.kind==='supplier_price'){
  for(const [resource,key,singular] of [['suppliers','id_supplier','supplier'],['currencies','id_currency','currency']]){
   const data=await json(resource+'/'+op.fields[key]),row=data[singular]||data[resource]?.[0];if(String(row?.id)!==op.fields[key])throw Error('Proveedor o moneda no verificable.');
  }
 }
 if(op.fields.id_default_combination)await assertVariant(op.fields.id_default_combination);
 if(op.associations.images?.length||op.fields.id_default_image){
  const product=await rootJson(),ids=new Set((product.associations?.images||[]).map(row=>String(row.id)));
  if([...(op.associations.images||[]),...(op.fields.id_default_image?[op.fields.id_default_image]:[])].some(id=>!ids.has(id)))throw Error('La imagen no pertenece a este producto.');
 }
 const image=op.kind==='image'?await inspectTransparentProductPng(op.image.base64):null;
 const signature=await sha256Text(JSON.stringify({kind:op.kind,product_id:op.product_id,fields:op.fields,associations:op.associations,...(image?{image:op.image.base64}:{})}));
 const filters={'filter[id_product]':'['+op.product_id+']'};
 if(op.kind==='variation')filters['filter[reference]']='['+op.fields.reference+']';
 if(['stock','supplier_price','special_price'].includes(op.kind))filters['filter[id_product_attribute]']='['+op.fields.id_product_attribute+']';
 if(op.kind==='supplier_price')filters['filter[id_supplier]']='['+op.fields.id_supplier+']';
 if(op.kind==='special_price')for(const key of ['id_shop','id_shop_group','id_currency','id_country','id_group','id_customer','id_cart','from_quantity','from','to'])filters['filter['+key+']']='['+op.fields[key]+']';
 const find=async()=>{
  const data=await json(op.resource,{...filters,display:'[id]',limit:'0,2'}),rows=Array.isArray(data)&&!data.length?[]:data[op.resource];
  if(!Array.isArray(rows)||rows.length>1)throw Error('La etapa devuelve varios registros: selecciona y revisa el destino antes de escribir.');
  if(rows.length&&!/^[1-9]\d{0,14}$/.test(String(rows[0].id)))throw Error('Registro de etapa no válido.');return rows.length?String(rows[0].id):null;
 };
 const desired=op.kind==='finish'?productFinalizationFields(root,op.fields):{id_product:op.product_id,...op.fields};
 let nativeHtmlNormalized=false;
 const verify=async(recordId)=>{
  const checked=inspectProductStageXml(await xml(op.resource+'/'+recordId,op.kind==='finish'?{display:'[id,'+Object.keys(desired).join(',')+']'}:{}),op.resource,desired,op.associations);
  nativeHtmlNormalized||=checked.native_html_normalized===true;
  return checked;
 };
 const prior=op.commit?await journal.lookup(op):null;
 if(prior){
  if(prior.signature!==signature)throw Error('Esta etapa ya está vinculada a otros datos.');
  const recordId=prior.record_id||(op.kind==='finish'?op.product_id:op.kind==='image'?null:await find());
  if(!recordId)throw Error('Resultado incierto. No se repetirá una carga o creación: revisa el registro de la tienda.');
  if(op.kind!=='image')await verify(String(recordId));
  else{const product=await rootJson();if(!(product.associations?.images||[]).some(row=>String(row.id)===String(recordId)))throw Error('No se confirma la imagen en este producto.');}
  if(prior.status!=='completed')await journal.complete(op,signature,String(recordId));
  return {ok:true,store:op.store,kind:op.kind,resource:op.resource,record_id:String(recordId),persisted:true,verified:true,reused:true,...(nativeHtmlNormalized?{native_html_normalized:true}:{})};
 }
 const recordId=op.kind==='finish'?op.product_id:op.kind==='image'?null:await find();
 if(op.record_id&&op.record_id!==recordId)throw Error('El registro de destino cambió desde la selección.');
 if(op.kind==='variation'&&recordId)throw Error('Ya hay una combinación con esa referencia. No se creará otra.');
 if(op.kind==='stock'&&!recordId)throw Error('PrestaShop todavía no ha creado el registro de existencias para este producto o combinación.');
 let original,legacy_schema_fallback=false;
 if(image)original='';else if(op.kind==='finish')original=root;else if(recordId)original=await xml(op.resource+'/'+recordId);
 else{
  try{original=await xml(op.resource,{schema:'blank'});}
  catch(error){
   if(!String(error?.message||'').includes('(HTTP 500)'))throw error;
   // The same 1.7 OutputBuilder defect affects blank combination and price
   // schemas. Only our typed, fixed native entity contract can be substituted.
   original=minimalProductStageSchema(op.resource);legacy_schema_fallback=true;
  }
 }
 const body=image?null:prepareProductStageXml(original,op.resource,desired,op.associations,recordId);
 const fingerprint=await sha256Text(signature+'|'+original+'|'+(recordId||''));
 const enabled=env.get('TOTUS_PRESTASHOP_PRODUCT_CREATE_ENABLED')==='1'&&env.get('TOTUS_PRESTASHOP_PRODUCT_STAGES_ENABLED')==='1';
 if(!op.commit)return {ok:true,store:op.store,kind:op.kind,resource:op.resource,record_id:recordId,fingerprint,persisted:false,can_commit:enabled,legacy_schema_fallback};
 if(!enabled)throw Error('Las etapas de creación todavía no están habilitadas en este servidor.');
 if(fingerprint!==op.expected_fingerprint)throw Error('El destino cambió: prepara de nuevo la etapa antes de guardar.');
 if((await journal.claim(op,signature))?.status!=='claimed')throw Error('La etapa ya está en curso; comprueba el resultado sin repetirla.');
 let saved=recordId;
 try{
  if(image){
   const form=new FormData();form.append('image',new Blob([image.bytes],{type:'image/png'}),op.image.name);
   const response=await call('images/products/'+op.product_id,{method:'POST',body:form});
   saved=inspectProductStageXml(await boundedText(response,2097152),'images',{}).id;
   const product=await rootJson();if(!(product.associations?.images||[]).some(row=>String(row.id)===saved))throw Error('La imagen cargada no aparece en el producto.');
  }else{
   const response=await call(op.resource+(recordId?'/'+recordId:''),{method:recordId?'PUT':'POST',headers:{'Content-Type':'application/xml; charset=utf-8'},body});
   const returned=await boundedText(response,2097152);
   saved=recordId||inspectProductStageXml(returned,op.resource,desired,op.associations).id;
   await verify(saved);
  }
 }catch(error){
  if(!image){try{saved=saved||await find();if(saved){await verify(saved);await journal.complete(op,signature,saved);return {ok:true,store:op.store,kind:op.kind,resource:op.resource,record_id:saved,persisted:true,verified:true,reconciled:true,...(nativeHtmlNormalized?{native_html_normalized:true}:{})};}}catch{}}
  await journal.uncertain(op,signature);throw Error('Etapa incierta; no se repetirá automáticamente. '+String(error?.message||error));
 }
 await journal.complete(op,signature,saved);
 return {ok:true,store:op.store,kind:op.kind,resource:op.resource,record_id:saved,persisted:true,verified:true,...(nativeHtmlNormalized?{native_html_normalized:true}:{}),...(image?{original_transparent:true,store_may_convert_format:true}:{})};
}
