import {readProductPreservationProjection} from './prestashop-write.js';
import {prestashopCapabilities} from './prestashop.js';
import {runProductImageReplacement} from './prestashop-product-image-replace.js';
import {runProductRemoval,runWholeProductRemoval} from './prestashop-product-remove.js';
import {validateProductStage} from '../../../src/productos-stages-contract.js';
import {inspectTransparentProductPng} from '../../../src/productos-png.js';
import {prepareProductStageXml,inspectProductStageXml,minimalProductStageSchema,sha256Text,parsePrestashopResourceId,readPrestashopXmlField,productFinalizationFields,productLanguageIdsFromListing,inspectProductAssociationIds,LOCALIZED_PRODUCT_FIELDS,readPrestashopCombinationXml} from '../../../src/productos-write-contract.js';
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
 let languageIds=[];
 const headers={...connectionHeaders(connection),Accept:'application/xml'};
 const call=async(path,options={},query={})=>{
  const url=new URL(base.href);url.pathname='/api/'+path;if((path.startsWith('products/')||path.startsWith('totus_product_images/')||path.startsWith('product_options')||path.startsWith('product_option_values'))&&languageIds.length)url.searchParams.set('language','['+languageIds.join('|')+']');for(const [k,v] of Object.entries(query))url.searchParams.set(k,String(v));
  const target=await safeEndpoint(url.href,resolve),response=await request(target.href,{...options,method:options.method||'GET',headers:{...headers,...options.headers},redirect:'error',credentials:'omit',signal:AbortSignal.timeout(30000)});
  if(!response.ok){await response.body?.cancel();throw Error('PrestaShop rechazó '+path+' (HTTP '+response.status+').');}
  if(/text\/html|application\/xhtml/i.test(response.headers.get('content-type')||'')){await response.body?.cancel();throw Error('La tienda devolvió HTML en vez del recurso solicitado.');}
  return response;
 };
 const xml=async(path,query={})=>boundedText(await call(path,{},query),2097152);
 const json=async(path,query={})=>boundedJson(await call(path,{headers:{Accept:'application/json'}},{...query,output_format:'JSON'}),2097152);
 // PUT replaces the full multilingual product, even when finishing only flags.
 // Reading selected/active languages would erase the installed inactive ones.
 if(['finish','image_metadata','attribute_group','attribute_value','manufacturer','supplier'].includes(op.kind))languageIds=productLanguageIdsFromListing(await xml('languages',{display:'[id]'}));
 // 1.7's getCoverWs dereferences false when a newly created product has no
 // image yet. Do not request calculated cover/position fields for this workflow.
 const productDisplay=op.kind==='finish'?await readProductPreservationProjection(connection,{request,resolve}):null;
 if(op.kind==='remove_product')return runWholeProductRemoval(op,{xml,call,journal,env});
 const root=await xml('products/'+op.product_id,{display:op.kind==='finish'?productDisplay:op.existing_product?'[id,reference,price,active,available_for_order,visibility]':'[id,reference]'});
 if(parsePrestashopResourceId(root,'product')!==op.product_id||(!op.existing_product&&readPrestashopXmlField(root,'product','reference')!==parent.reference))throw Error('La ficha de destino no corresponde al producto registrado.');
 if(op.kind==='image_replace')return runProductImageReplacement(op,{root,xml,json,call,journal,env});
 if(['remove_variation','remove_image'].includes(op.kind))return runProductRemoval(op,{root,xml,json,call,journal,env});
 const rootJson=async()=>{const data=await json('products/'+op.product_id,{display:'[id,reference,images[id]]'});const product=data.product||data.products?.[0];if(String(product?.id)!==op.product_id)throw Error('Ficha de producto no verificable.');return product;};
 const assertVariant=async id=>{
  if(id==='0')return;
  const row=readPrestashopCombinationXml(await xml('combinations/'+id),id);
  if(String(row?.id)!==id||String(row.id_product)!==op.product_id)throw Error('La combinación pertenece a otro producto.');
 };
 if(op.kind==='image_metadata'){const product=await rootJson(),images=product.associations?.images;if(!Array.isArray(images)||!images.some(row=>String(row.id)===op.record_id))throw Error('La imagen pertenece a otro producto.');if(Number(op.fields.position)>images.length)throw Error('La posición supera el número de imágenes del producto.');}
 if(op.kind==='variation_edit')await assertVariant(op.record_id);
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
 if(op.kind==='finish'){
  const verifyRelation=async(resource,singular,id)=>{if(id==='0')return;const data=await json(resource+'/'+id),row=data[singular]||data[resource]?.[0];if(String(row?.id)!==id)throw Error('Relación de '+resource+' no verificable en esta tienda.');};
  for(const [key,resource,singular]of [['id_category_default','categories','category'],['id_manufacturer','manufacturers','manufacturer'],['id_supplier','suppliers','supplier'],['id_tax_rules_group','tax_rule_groups','tax_rule_group']])if(op.fields[key])await verifyRelation(resource,singular,op.fields[key]);
  for(const [key,resource,singular]of [['categories','categories','category'],['tags','tags','tag'],['accessories','products','product']])for(const id of op.associations[key]||[]){if(key==='accessories'&&id===op.product_id)throw Error('Un producto no puede ser accesorio de sí mismo.');await verifyRelation(resource,singular,id);}
  for(const feature of op.associations.product_features||[]){await verifyRelation('product_features','product_feature',feature.feature_id);const data=await json('product_feature_values/'+feature.value_id),value=data.product_feature_value||data.product_feature_values?.[0];if(String(value?.id)!==feature.value_id||String(value.id_feature)!==feature.feature_id)throw Error('El valor no pertenece a la característica seleccionada.');}
  if(op.associations.categories){const main=op.fields.id_category_default||readPrestashopXmlField(root,'product','id_category_default');if(!op.associations.categories.includes(main))throw Error('La categoría principal debe estar entre las asociadas.');}
 }
 if(op.fields.id_default_combination)await assertVariant(op.fields.id_default_combination);
 if(op.associations.images?.length||op.fields.id_default_image){
  const product=await rootJson(),ids=new Set((product.associations?.images||[]).map(row=>String(row.id)));
  if([...(op.associations.images||[]),...(op.fields.id_default_image?[op.fields.id_default_image]:[])].some(id=>!ids.has(id)))throw Error('La imagen no pertenece a este producto.');
 }
 const attribute=['attribute_group','attribute_value'].includes(op.kind),master=attribute||['manufacturer','supplier'].includes(op.kind);
 if(attribute){for(const key of op.kind==='attribute_group'?['name','public_name']:['name']){const actual=op.fields[key].map(t=>t.language_id).sort();if(JSON.stringify(actual)!==JSON.stringify([...languageIds].sort()))throw Error('Completa el nombre en todos los idiomas instalados de esta tienda.');}}
 if(op.kind==='attribute_value'){const data=await json('product_options/'+op.fields.id_attribute_group),group=data.product_option||data.product_options?.[0];if(String(group?.id)!==op.fields.id_attribute_group)throw Error('El grupo de atributo no pertenece a esta tienda.');if(group.group_type==='color'&&!op.fields.color)throw Error('El grupo de color necesita un color #RRGGBB.');if(group.group_type!=='color'&&op.fields.color)throw Error('Este grupo no representa colores. Deja el color vacío.');}
 const image=op.kind==='image'?await inspectTransparentProductPng(op.image.base64):null;
 const signature=await sha256Text(JSON.stringify({kind:op.kind,product_id:op.product_id,...(['variation_edit','image_metadata'].includes(op.kind)?{record_id:op.record_id}:{}),fields:op.fields,associations:op.associations,...(image?{image:op.image.base64}:{})}));
 const masterNames=()=>Array.isArray(op.fields.name)?op.fields.name.map(t=>t.value):[op.fields.name];
 const filters=master?{'filter[name]':'['+masterNames()[0]+']'}:{'filter[id_product]':'['+op.product_id+']'};
 if(op.kind==='attribute_value')filters['filter[id_attribute_group]']='['+op.fields.id_attribute_group+']';
 if(op.kind==='variation')filters['filter[reference]']='['+op.fields.reference+']';
 if(['stock','supplier_price','special_price'].includes(op.kind))filters['filter[id_product_attribute]']='['+op.fields.id_product_attribute+']';
 if(op.kind==='supplier_price')filters['filter[id_supplier]']='['+op.fields.id_supplier+']';
 if(op.kind==='special_price')for(const key of ['id_shop','id_shop_group','id_currency','id_country','id_group','id_customer','id_cart','from_quantity','from','to'])filters['filter['+key+']']='['+op.fields[key]+']';
 const find=async()=>{
  if(master){const found=new Set(),fold=v=>String(v).normalize('NFKC').trim().toLocaleLowerCase('es'),names=new Set(masterNames().map(fold));for(let page=0;;page++){const data=await json(op.resource,{...(op.kind==='attribute_value'?{'filter[id_attribute_group]':'['+op.fields.id_attribute_group+']'}:{}),display:'full',limit:(page*100)+',100'}),rows=Array.isArray(data)&&!data.length?[]:data[op.resource];if(!Array.isArray(rows))throw Error('No se pudieron comprobar los atributos existentes.');for(const row of rows){if(!/^[1-9]\d{0,14}$/.test(String(row.id))||op.kind==='attribute_value'&&String(row.id_attribute_group)!==op.fields.id_attribute_group)throw Error('Catálogo de atributos no verificable.');const values=Array.isArray(row.name)?row.name.map(t=>t.value):[row.name];if(values.some(v=>names.has(fold(v))))found.add(String(row.id));}if(rows.length<100)break;if(page>=1000)throw Error('Catálogo de atributos incompleto.');}if(found.size>1)throw Error('Hay varios atributos con el mismo nombre. Selecciona el correcto sin crear otro.');return [...found][0]||null;}
  const data=await json(op.resource,{...filters,display:'[id]',limit:'0,2'}),rows=Array.isArray(data)&&!data.length?[]:data[op.resource];
  if(!Array.isArray(rows)||rows.length>1)throw Error('La etapa devuelve varios registros: selecciona y revisa el destino antes de escribir.');
  if(rows.length&&!/^[1-9]\d{0,14}$/.test(String(rows[0].id)))throw Error('Registro de etapa no válido.');return rows.length?String(rows[0].id):null;
 };
 const desired=op.kind==='finish'?productFinalizationFields(root,op.fields):op.kind==='image_metadata'?op.fields:master?{...op.fields,...(op.kind==='attribute_group'?{is_color_group:op.fields.group_type==='color'?'1':'0'}:{})}:{id_product:op.product_id,...op.fields};
 let nativeHtmlNormalized=false;
 const verify=async(recordId)=>{
  const checked=inspectProductStageXml(await xml(op.resource+'/'+recordId,op.kind==='finish'?{display:'[id,'+[...Object.keys(desired),...Object.keys(op.associations).map(key=>key==='product_features'?'product_features[id,id_feature_value]':key+'[id]')].join(',')+']'}:{}),op.resource,desired,op.associations);
  if(checked.id!==String(recordId))throw Error('La relectura pertenece a otro registro.');
  nativeHtmlNormalized||=checked.native_html_normalized===true;
  return checked;
 };
 const prior=op.commit?await journal.lookup(op):null;
 if(prior){
  if(prior.signature!==signature)throw Error('Esta etapa ya está vinculada a otros datos.');
  const recordId=prior.record_id||(op.kind==='finish'?op.product_id:['variation_edit','image_metadata'].includes(op.kind)?op.record_id:op.kind==='image'?null:await find());
  if(!recordId)throw Error('Resultado incierto. No se repetirá una carga o creación: revisa el registro de la tienda.');
  if(op.kind!=='image')await verify(String(recordId));
  else{const product=await rootJson();if(!(product.associations?.images||[]).some(row=>String(row.id)===String(recordId)))throw Error('No se confirma la imagen en este producto.');}
  if(prior.status!=='completed')await journal.complete(op,signature,String(recordId));
  return {ok:true,store:op.store,kind:op.kind,resource:op.resource,record_id:String(recordId),persisted:true,verified:true,reused:true,...(nativeHtmlNormalized?{native_html_normalized:true}:{})};
 }
 if(op.existing_product&&op.kind==='variation'){
  const expected=[...op.associations.product_option_values].sort().join(',');
  for(let page=0;;page++){
   const data=await json('combinations',{'filter[id_product]':'['+op.product_id+']',display:'full',limit:(page*100)+',100'});
   const rows=Array.isArray(data)&&!data.length?[]:data.combinations;
   if(!Array.isArray(rows))throw Error('No se han podido comprobar las combinaciones existentes.');
   for(const row of rows){
    if(String(row.id_product)!==op.product_id||!Array.isArray(row.associations?.product_option_values))throw Error('Combinaciones existentes incompletas.');
    const values=row.associations.product_option_values.map(v=>String(v.id));
    if(values.some(v=>!/^[1-9]\d{0,14}$/.test(v)))throw Error('Atributos existentes no verificables.');
    if([...values].sort().join(',')===expected)throw Error('Ya existe una combinación con esos atributos. No se creará otra.');
   }
   if(rows.length<100)break;
   if(page>=1000)throw Error('No se pudo completar la comprobación de atributos existentes.');
  }
 }
 const recordId=op.kind==='finish'?op.product_id:['variation_edit','image_metadata'].includes(op.kind)?op.record_id:op.kind==='image'?null:await find();
 if(op.record_id&&op.record_id!==recordId)throw Error('El registro de destino cambió desde la selección.');
 if(master&&recordId)throw Error('Ya existe un atributo con ese nombre en la tienda. Selecciónalo en lugar de crear otro.');
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
 if(op.kind==='stock'&&op.fields.id_product_attribute==='0'){const data=await json('products/'+op.product_id,{display:'[id,combinations[id]]'}),product=data.product||data.products?.[0];if(String(product?.id)!==op.product_id)throw Error('No se pudo verificar el producto de estas existencias.');const combinations=Array.isArray(product.associations?.combinations)?product.associations.combinations:inspectProductAssociationIds(await xml('products/'+op.product_id,{display:'[id,combinations[id]]'}),op.product_id,'combinations');if(combinations.length){try{inspectProductStageXml(original,'stock_availables',{id_product:op.product_id,id_product_attribute:'0',quantity:op.fields.quantity});}catch{throw Error('La cantidad total se deriva de las combinaciones. Ajusta sus existencias individuales.');}}}
 if(op.kind==='image_metadata'){const image=inspectProductStageXml(original,'totus_product_images',{id_product:op.product_id});if(image.id!==op.record_id)throw Error('Metadatos de otra imagen.');}
 const body=image?null:prepareProductStageXml(original,op.resource,desired,op.associations,recordId);
 const fingerprint=await sha256Text(signature+'|'+original+'|'+(recordId||'')+(op.existing_product?'|'+root:''));
 const advertised=master?prestashopCapabilities(await xml('')).resources.find(r=>r.name===op.resource):null,missing_permissions=master?['GET','POST'].filter(m=>advertised?.permissions?.[m]!==true):[];
 const enabled=!missing_permissions.length&&env.get('TOTUS_PRESTASHOP_PRODUCT_CREATE_ENABLED')==='1'&&env.get('TOTUS_PRESTASHOP_PRODUCT_STAGES_ENABLED')==='1';
 if(!op.commit)return {ok:true,store:op.store,kind:op.kind,resource:op.resource,record_id:recordId,fingerprint,persisted:false,can_commit:enabled,missing_permissions,legacy_schema_fallback};
 if(missing_permissions.length&&op.commit)throw Error('La conexión necesita '+op.resource+': '+missing_permissions.join(', ')+'.');
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
