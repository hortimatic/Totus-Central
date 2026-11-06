// Productos / PrestaShop 1.7: restrictive write contract.
// Never accept XML, URLs, arbitrary paths, numeric relationships or shop IDs from the client.
// The source XML comes exclusively from a freshly validated server-side GET.
// The caller must explicitly map each language ID in the TARGET shop.
export const PRODUCT_WRITE_FIELDS=Object.freeze({
 products:Object.freeze(['reference','ean13','upc','isbn','mpn','price','wholesale_price','weight','width','height','depth','additional_shipping_cost','active','available_for_order','show_price','online_only','visibility','condition','on_sale','minimal_quantity','name','description','description_short','meta_title','meta_description','link_rewrite']),
 combinations:Object.freeze(['reference','ean13','upc','isbn','mpn','price','wholesale_price','weight','minimal_quantity','low_stock_threshold','low_stock_alert'])
});
export const LOCALIZED_PRODUCT_FIELDS=Object.freeze(['name','description','description_short','meta_title','meta_description','link_rewrite']);
const local=new Set(LOCALIZED_PRODUCT_FIELDS);
const decimal=new Set(['price','wholesale_price','weight','width','height','depth','additional_shipping_cost','minimal_quantity','low_stock_threshold']);
const flags=new Set(['active','available_for_order','show_price','online_only','on_sale','low_stock_alert']);
const allowedVisibility=new Set(['both','catalog','search','none']);
const allowedCondition=new Set(['new','used','refurbished']);
const uuid=/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const integer=/^[1-9]\d{0,14}$/;
const hash=/^[a-f0-9]{64}$/;
const own=(v,k)=>Object.prototype.hasOwnProperty.call(v,k);
function invalid(message='Solicitud de escritura de Productos no válida.'){throw Error(message);}
function validateValue(field,value,resource){
 if(typeof value!=='string'||value.length>16000||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value))invalid('Valor de '+field+' no válido.');
 const max=field==='reference'?64:['ean13','upc','isbn','mpn'].includes(field)?40:field==='name'?128:field==='link_rewrite'?128:field==='meta_title'?255:field==='meta_description'?512:field==='description_short'?8000:field==='description'?16000:255;
 if(value.length>max)invalid('El campo '+field+' supera el tamaño permitido.');
 if(decimal.has(field)){
  if(!(resource==='combinations'&&field==='price'?/^-?(?:0|[1-9]\d{0,10})(?:\.\d{1,6})?$/:/^(?:0|[1-9]\d{0,10})(?:\.\d{1,6})?$/).test(value))invalid('Importe o medida de '+field+' no válido.');
 }
 if(flags.has(field)&&!['0','1'].includes(value))invalid('Indicador de '+field+' no válido.');
 if(field==='visibility'&&!allowedVisibility.has(value))invalid('Visibilidad no admitida.');
 if(field==='condition'&&!allowedCondition.has(value))invalid('Estado del artículo no admitido.');
 if(field==='link_rewrite'&&!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value))invalid('URL amigable no válida.');
 if(field==='ean13'&&value!==''&&!/^\d{13}$/.test(value))invalid('EAN debe contener 13 dígitos.');
 if(field==='upc'&&value!==''&&!/^\d{12}$/.test(value))invalid('UPC debe contener 12 dígitos.');
 if(field==='minimal_quantity'&&(!/^[1-9]\d{0,6}$/.test(value)))invalid('Cantidad mínima incorrecta.');
 if(field==='low_stock_threshold'&&(!/^\d{1,7}$/.test(value)))invalid('Umbral de stock incorrecto.');
 // A combination price is an impact on base price and may legitimately be negative.
 return value;
}
export function validateProductWriteRequest(input){
 if(!input||typeof input!=='object'||Array.isArray(input))invalid();
 const keys=new Set(['action','id','call_id','revision','store','resource','record_id','expected_product_id','changes','expected_fingerprint','request_id','confirmed']);
 if(Object.keys(input).some(k=>!keys.has(k)))invalid('Campos de solicitud no admitidos.');
 if(!['prestashop_product_prepare','prestashop_product_commit'].includes(input.action)||!['hortimatic','newoldsmok'].includes(input.store)||
  !['products','combinations'].includes(input.resource)||!integer.test(String(input.record_id??''))||!uuid.test(String(input.id??''))||!uuid.test(String(input.call_id??''))||
  !Number.isSafeInteger(input.revision)||input.revision<1)invalid();
 if(input.resource==='combinations'&&!integer.test(String(input.expected_product_id||'')))invalid('Falta el ID del producto al que pertenece la combinación.');
 if(input.resource==='products'&&own(input,'expected_product_id'))invalid('Un producto no acepta un ID de padre.');
 if(!Array.isArray(input.changes)||input.changes.length<1||input.changes.length>12)invalid('Selecciona entre 1 y 12 campos para validar.');
 const fields=new Set(),normalized=[];
 for(const row of input.changes){
  if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).some(k=>!['field','value','language_id'].includes(k)))invalid();
  const field=row.field;
  if(typeof field!=='string'||!PRODUCT_WRITE_FIELDS[input.resource].includes(field))invalid('Campo no habilitado para escritura: '+field);
  const languageId=local.has(field)?String(row.language_id??''):null;
  if(local.has(field)&&!integer.test(languageId))invalid('Selecciona un idioma real de la tienda de destino para '+field+'.');
  if(!local.has(field)&&own(row,'language_id'))invalid('Idioma no permitido para '+field+'.');
  const token=field+':'+(languageId??'');
  if(fields.has(token))invalid('El campo está repetido.');fields.add(token);
  normalized.push({field,value:validateValue(field,row.value,input.resource),...(languageId?{language_id:languageId}:{})});
 }
 const commit=input.action==='prestashop_product_commit';
 if(commit&&(!hash.test(String(input.expected_fingerprint||''))||!uuid.test(String(input.request_id||''))||input.confirmed!==true))invalid('Para escribir debes aportar huella previa, request_id y confirmación explícita.');
 if(!commit&&(own(input,'expected_fingerprint')||own(input,'request_id')||own(input,'confirmed')))invalid('La preparación no acepta confirmaciones de escritura.');
 return {action:input.action,store:input.store,resource:input.resource,record_id:String(input.record_id),
  changes:normalized,...(input.resource==='combinations'?{expected_product_id:String(input.expected_product_id)}:{}),commit,...(commit?{expected_fingerprint:input.expected_fingerprint,request_id:input.request_id}:{})};
}
const tag=/<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<\/?[A-Za-z_][^>]*?>/g;
function tree(xml){
 tag.lastIndex=0;
 if(typeof xml!=='string'||xml.length>2097152||/<!DOCTYPE|<!ENTITY/i.test(xml))invalid('XML del proveedor no permitido.');
 const roots=[],stack=[];let m,last=0;
 while((m=tag.exec(xml))){
  const before=xml.slice(last,m.index);
  if(before.includes('<'))invalid('Marcado XML desconocido.');
  last=tag.lastIndex;
  const raw=m[0];
  if(raw.startsWith('<!')||raw.startsWith('<?'))continue;
  const closing=raw.startsWith('</'),name=raw.match(/^<\/?([A-Za-z_][\w.:-]*)/)?.[1];
  if(!name)invalid('XML no reconocido.');
  if(closing){
   const node=stack.pop();
   if(!node||node.name!==name)invalid('Estructura XML inconsistente.');
   node.contentEnd=m.index;node.end=tag.lastIndex;
   continue;
  }
  const node={name,open:m.index,contentStart:tag.lastIndex,contentEnd:tag.lastIndex,end:tag.lastIndex,
   attributes:raw.slice(name.length+1,-1),selfClosing:raw.endsWith('/>'),children:[]};
  if(stack.length)stack.at(-1).children.push(node);else roots.push(node);
  if(!raw.endsWith('/>'))stack.push(node);
 }
 if(xml.slice(last).includes('<')||stack.length||roots.length!==1||roots[0].name!=='prestashop')invalid('Respuesta XML de PrestaShop no válida.');
 return roots[0];
}
const direct=(node,name)=>{
 const list=node.children.filter(child=>child.name===name);
 if(list.length!==1)invalid('El XML no tiene un campo único '+name+'.');
 return list[0];
};
const unescapeXml=value=>value.replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g,m=>{
 const name=m.slice(1,-1);
 const named={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};
 if(own(named,name))return named[name];
 const point=name[1]==='x'?parseInt(name.slice(2),16):parseInt(name.slice(1),10);
 return Number.isInteger(point)&&point>=0&&point<=0x10FFFF?String.fromCodePoint(point):m;
});
const xmlValue=value=>unescapeXml(value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,(_,s)=>s));
const safeCdata=value=>'<![CDATA['+value.replaceAll(']]>',']]]]><![CDATA[>')+']]>';
export function selectedXmlValues(xml,resource,id,changes,expectedProductId=null){
 const root=tree(xml),singular=resource==='products'?'product':'combination';
 const item=direct(root,singular),idNode=direct(item,'id'),actual=xmlValue(xml.slice(idNode.contentStart,idNode.contentEnd));
 if(actual.trim()!==String(id))invalid('El XML no corresponde al registro solicitado.');
 if(resource==='combinations'){
  if(!integer.test(String(expectedProductId||'')))invalid('Falta el producto padre de la combinación.');
  const parent=direct(item,'id_product');
  if(xmlValue(xml.slice(parent.contentStart,parent.contentEnd)).trim()!==String(expectedProductId))invalid('La combinación no pertenece al producto de destino previsto.');
 }
 const result=[],slots=[];
 for(const change of changes){
  const node=direct(item,change.field);
  let slot=node;
  if(change.language_id){
   const matching=node.children.filter(c=>c.name==='language'&&new RegExp('\\bid=(["\\x27])'+change.language_id+'\\1').test(c.attributes));
   if(matching.length!==1)invalid('Idioma '+change.language_id+' ausente o duplicado en '+change.field+'.');
   slot=matching[0];
  }else if(node.children.length)invalid('Campo complejo requiere idioma y mapeo explícitos: '+change.field+'.');
  if(slot.selfClosing)invalid('Campo XML autocerrado: actualizar requiere un adaptador específico, no se escribirá.');
  const before=xmlValue(xml.slice(slot.contentStart,slot.contentEnd));
  result.push({...change,before,changed:before!==change.value});
  slots.push({start:slot.contentStart,end:slot.contentEnd,value:safeCdata(change.value)});
 }
 let patched=xml;
 for(const replacement of slots.sort((a,b)=>b.start-a.start))patched=patched.slice(0,replacement.start)+replacement.value+patched.slice(replacement.end);
 // Parse and check the resulting document again before any remote PUT.
 tree(patched);
 return {patched,changes:result};
}
export async function sha256Text(value){
 const bytes=new TextEncoder().encode(value);
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
}


// Product creation is separate from selective PUT. The destination shop supplies
// the blank schema and language IDs; we never copy entity IDs from another shop.
export function validateProductCreateRequest(input){
 if(!input||typeof input!=='object'||Array.isArray(input))invalid();
 const accepted=new Set(['action','id','call_id','revision','store','reference','price','category_id','translations','expected_fingerprint','request_id','confirmed']);
 if(Object.keys(input).some(key=>!accepted.has(key))||!['prestashop_product_create_prepare','prestashop_product_create_commit'].includes(input.action)||
 !['hortimatic','newoldsmok'].includes(input.store)||!uuid.test(String(input.id||''))||!uuid.test(String(input.call_id||''))||
 !Number.isSafeInteger(input.revision)||input.revision<1||!integer.test(String(input.category_id||'')))invalid('Solicitud de alta de producto no válida.');
 if(typeof input.reference!=='string'||!/^[a-z0-9][a-z0-9._-]{2,63}$/i.test(input.reference))invalid('Referencia no válida para evitar duplicados.');
 validateValue('price',input.price,'products');
 if(!Array.isArray(input.translations)||input.translations.length<1||input.translations.length>12)invalid('Selecciona los idiomas de destino.');
 const seen=new Set();
 const translations=input.translations.map(t=>{
  if(!t||typeof t!=='object'||Array.isArray(t)||Object.keys(t).some(k=>!['language_id','name','link_rewrite'].includes(k))||
  !integer.test(String(t.language_id||''))||seen.has(String(t.language_id)))invalid('Idiomas repetidos o no válidos.');
  seen.add(String(t.language_id));
  validateValue('name',t.name,'products');
  validateValue('link_rewrite',t.link_rewrite,'products');
  if(!t.name.trim())invalid('No se puede crear un producto sin nombre.');
  return {language_id:String(t.language_id),name:t.name,link_rewrite:t.link_rewrite};
 });
 const commit=input.action==='prestashop_product_create_commit';
 if(commit&&(!hash.test(String(input.expected_fingerprint||''))||!uuid.test(String(input.request_id||''))||input.confirmed!==true))
  invalid('El alta exige confirmación, huella vigente y request_id estable.');
 if(!commit&&(own(input,'expected_fingerprint')||own(input,'request_id')||own(input,'confirmed')))
  invalid('No se aceptan confirmaciones durante la preparación.');
 return {store:input.store,resource:'products',reference:input.reference,price:input.price,category_id:String(input.category_id),translations,
  commit,...(commit?{expected_fingerprint:input.expected_fingerprint,request_id:input.request_id}:{})};
}
export function prepareProductCreationXml(schema,create){
 const root=tree(schema),product=direct(root,'product'),id=direct(product,'id');
 if(xmlValue(schema.slice(id.contentStart,id.contentEnd)).trim())invalid('El esquema de alta contiene un ID; no es una ficha en blanco.');
 const desired=new Map();
 const set=(node,value)=>{
  if(node.selfClosing||node.children.length)invalid('El esquema contiene campos complejos no compatibles.');
  if(desired.has(node.contentStart))invalid('Campo XML de alta duplicado.');
  desired.set(node.contentStart,{start:node.contentStart,end:node.contentEnd,value:safeCdata(value)});
 };
 for(const [field,value] of [['reference',create.reference],['price',create.price],['active','0'],['id_category_default',create.category_id]]){
  set(direct(product,field),value);
 }
 const names=direct(product,'name'),slugs=direct(product,'link_rewrite');
 const ids=names.children.filter(x=>x.name==='language').map(x=>x.attributes.match(/\bid\s*=\s*(["'])(\d+)\1/i)?.[2]);
 if(!ids.length||ids.some(x=>!x)||new Set(ids).size!==ids.length)invalid('No se han identificado los idiomas del esquema.');
 const expected=new Set(ids),given=new Set(create.translations.map(t=>t.language_id));
 if(ids.length!==given.size||[...given].some(x=>!expected.has(x)))invalid('Las traducciones no cubren los idiomas del destino.');
 for(const t of create.translations){
  for(const [node,value] of [[names,t.name],[slugs,t.link_rewrite]]){
   const matches=node.children.filter(x=>x.name==='language'&&x.attributes.match(/\bid\s*=\s*(["'])(\d+)\1/i)?.[2]===t.language_id);
   if(matches.length!==1)invalid('Idioma no reconocido en el esquema de alta.');
   set(matches[0],value);
  }
 }
 const associations=direct(product,'associations'),categories=direct(associations,'categories');
 const category=direct(categories,'category');
 set(direct(category,'id'),create.category_id);
 let xml=schema;
 for(const change of [...desired.values()].sort((a,b)=>b.start-a.start))xml=xml.slice(0,change.start)+change.value+xml.slice(change.end);
 tree(xml);
 return xml;
}
export function parseCreatedProductId(xml){
 const root=tree(xml),product=direct(root,'product'),node=direct(product,'id');
 const id=xmlValue(xml.slice(node.contentStart,node.contentEnd)).trim();
 if(!integer.test(id))invalid('PrestaShop no ha devuelto un ID de producto válido.');
 return id;
}
export function inspectProductReferenceListing(xml){
 const root=tree(xml),collection=direct(root,'products');
 if(collection.children.some(n=>n.name!=='product'))invalid('Listado de referencias no válido.');
 const result=collection.children.map(n=>{
  const id=n.attributes.match(/\bid\s*=\s*(["'])(\d+)\1/i)?.[2];
  if(!id||!integer.test(id))invalid('Producto listado sin identificador.');
  return id;
 });
 if(new Set(result).size!==result.length)invalid('Listado de productos duplicado.');
 return result;
}
