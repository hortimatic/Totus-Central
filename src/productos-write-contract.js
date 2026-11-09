// Productos / PrestaShop 1.7: restrictive write contract.
// Never accept XML, URLs, arbitrary paths, numeric relationships or shop IDs from the client.
// The source XML comes exclusively from a freshly validated server-side GET.
// The caller must explicitly map each language ID in the TARGET shop.
export const PRODUCT_WRITE_FIELDS=Object.freeze({
 manufacturers:Object.freeze(['name','active','description','short_description','meta_title','meta_description','meta_keywords']),
 suppliers:Object.freeze(['name','active','description','meta_title','meta_description','meta_keywords']),
 product_options:Object.freeze(['name','public_name','group_type','position']),
 product_option_values:Object.freeze(['name','color','position']),
 products:Object.freeze(['reference','ean13','upc','isbn','mpn','price','wholesale_price','weight','width','height','depth','additional_shipping_cost','active','available_for_order','show_price','online_only','visibility','condition','on_sale','minimal_quantity','name','description','description_short','meta_title','meta_description','link_rewrite','meta_keywords','redirect_type','id_type_redirected','unit_price_ratio','unity','ecotax','available_date','show_condition','low_stock_threshold','low_stock_alert','additional_delivery_times','available_now','available_later','delivery_in_stock','delivery_out_stock']),
 combinations:Object.freeze(['reference','ean13','upc','isbn','mpn','price','wholesale_price','weight','minimal_quantity','low_stock_threshold','low_stock_alert'])
});
export const LOCALIZED_PRODUCT_FIELDS=Object.freeze(['name','description','description_short','meta_title','meta_description','meta_keywords','link_rewrite','available_now','available_later','delivery_in_stock','delivery_out_stock']);
export const PRODUCT_CREATE_FIELDS=Object.freeze(['ean13','upc','isbn','mpn','wholesale_price','weight','width','height','depth','additional_shipping_cost','minimal_quantity','visibility','condition','available_for_order','show_price','online_only','on_sale','unit_price_ratio','unity','ecotax','available_date','show_condition','low_stock_threshold','low_stock_alert','additional_delivery_times','redirect_type','id_type_redirected']);
const local=new Set(LOCALIZED_PRODUCT_FIELDS);
export const isLocalizedWriteField=(resource,field)=>['manufacturers','suppliers'].includes(resource)?['description','short_description','meta_title','meta_description','meta_keywords'].includes(field):['product_options','product_option_values'].includes(resource)?['name','public_name'].includes(field):local.has(field);
const decimal=new Set(['price','wholesale_price','weight','width','height','depth','additional_shipping_cost','minimal_quantity','low_stock_threshold','unit_price_ratio','ecotax']);
const flags=new Set(['active','available_for_order','show_price','online_only','on_sale','low_stock_alert','show_condition']);
const allowedVisibility=new Set(['both','catalog','search','none']);
const allowedCondition=new Set(['new','used','refurbished']);
const uuid=/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const integer=/^[1-9]\d{0,14}$/;
const hash=/^[a-f0-9]{64}$/;
const own=(v,k)=>Object.prototype.hasOwnProperty.call(v,k);
function invalid(message='Solicitud de escritura de Productos no válida.'){throw Error(message);}
function validateValue(field,value,resource){
 if(typeof value!=='string'||value.length>250000||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value))invalid('Valor de '+field+' no válido.');
 const max=field==='reference'?64:['ean13','upc','isbn','mpn'].includes(field)?40:field==='name'?(['manufacturers','suppliers'].includes(resource)?64:128):field==='public_name'?64:field==='link_rewrite'?128:field==='meta_title'?255:field==='meta_description'?512:field==='description_short'?8000:['description','short_description'].includes(field)?250000:255;
 if(value.length>max)invalid('El campo '+field+' supera el tamaño permitido.');
 if(decimal.has(field)){
  if(!(resource==='combinations'&&field==='price'?/^-?(?:0|[1-9]\d{0,10})(?:\.\d{1,6})?$/:/^(?:0|[1-9]\d{0,10})(?:\.\d{1,6})?$/).test(value))invalid('Importe o medida de '+field+' no válido.');
 }
 if(flags.has(field)&&!['0','1'].includes(value))invalid('Indicador de '+field+' no válido.');
 if(field==='redirect_type'&&!['404','301-product','302-product','301-category','302-category'].includes(value))invalid('Tipo de redirección no admitido por PrestaShop 1.7.8.');
 if(field==='id_type_redirected'&&!/^(?:0|[1-9]\d{0,14})$/.test(value))invalid('Destino de redirección no válido.');
 if(field==='group_type'&&!['select','radio','color'].includes(value))invalid('Tipo de atributo no válido.');
 if(field==='color'&&value!==''&&!/^#[a-f0-9]{6}$/i.test(value))invalid('Color no válido.');
 if(field==='position'&&!/^\d{1,7}$/.test(value))invalid('Posición no válida.');
 if(['name','public_name'].includes(field)&&!value.trim())invalid('El nombre no puede quedar vacío.');
 if(field==='visibility'&&!allowedVisibility.has(value))invalid('Visibilidad no admitida.');
 if(field==='condition'&&!allowedCondition.has(value))invalid('Estado del artículo no admitido.');
 if(field==='link_rewrite'&&!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value))invalid('URL amigable no válida.');
 if(field==='name'&&/[<>;=#{}]/.test(value))invalid('El nombre contiene caracteres que PrestaShop no admite: < > ; = # { }.');
 if(field==='ean13'&&value!==''&&!/^\d{13}$/.test(value))invalid('EAN debe contener 13 dígitos.');
 if(field==='upc'&&value!==''&&!/^\d{12}$/.test(value))invalid('UPC debe contener 12 dígitos.');
 // Native PrestaShop records can contain zero (including freshly created bases).
 // Preserve that unsigned value during a copy instead of inventing a minimum.
 if(field==='minimal_quantity'&&(!/^\d{1,7}$/.test(value)))invalid('La cantidad mínima debe ser un entero sin signo.');
 if(field==='low_stock_threshold'&&(!/^\d{1,7}$/.test(value)))invalid('Umbral de stock incorrecto.');
 if(field==='additional_delivery_times'&&!['0','1','2'].includes(value))invalid('Selecciona el tipo de plazo de entrega.');
 if(field==='available_date'&&!['','0000-00-00'].includes(value)&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value))invalid('Fecha de disponibilidad incorrecta.');
 // A combination price is an impact on base price and may legitimately be negative.
 return value;
}
export function validateProductWriteRequest(input){
 if(!input||typeof input!=='object'||Array.isArray(input))invalid();
 const keys=new Set(['action','id','call_id','revision','store','resource','record_id','expected_product_id','changes','expected_fingerprint','request_id','confirmed','recover_unchanged']);
 if(Object.keys(input).some(k=>!keys.has(k)))invalid('Campos de solicitud no admitidos.');
 if(!['prestashop_product_prepare','prestashop_product_commit'].includes(input.action)||!['hortimatic','newoldsmok'].includes(input.store)||
  !Object.hasOwn(PRODUCT_WRITE_FIELDS,input.resource)||!integer.test(String(input.record_id??''))||!uuid.test(String(input.id??''))||!uuid.test(String(input.call_id??''))||
  !Number.isSafeInteger(input.revision)||input.revision<1)invalid();
 if(input.resource==='combinations'&&!integer.test(String(input.expected_product_id||'')))invalid('Falta el ID del producto al que pertenece la combinación.');
 if(input.resource!=='combinations'&&own(input,'expected_product_id'))invalid('Un producto no acepta un ID de padre.');
 if(!Array.isArray(input.changes)||input.changes.length<1||input.changes.length>100)invalid('Selecciona entre 1 y 100 campos e idiomas para validar.');
 const fields=new Set(),normalized=[];
 for(const row of input.changes){
  if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).some(k=>!['field','value','language_id'].includes(k)))invalid();
  const field=row.field;
  if(typeof field!=='string'||!PRODUCT_WRITE_FIELDS[input.resource].includes(field))invalid('Campo no habilitado para escritura: '+field);
  const languageId=isLocalizedWriteField(input.resource,field)?String(row.language_id??''):null;
  if(isLocalizedWriteField(input.resource,field)&&!integer.test(languageId))invalid('Selecciona un idioma real de la tienda de destino para '+field+'.');
  if(!isLocalizedWriteField(input.resource,field)&&own(row,'language_id'))invalid('Idioma no permitido para '+field+'.');
  const token=field+':'+(languageId??'');
  if(fields.has(token))invalid('El campo está repetido.');fields.add(token);
  normalized.push({field,value:validateValue(field,row.value,input.resource),...(languageId?{language_id:languageId}:{})});
 }
 if(input.resource==='product_options'&&normalized.some(c=>c.field==='group_type'))normalized.push({field:'is_color_group',value:normalized.find(c=>c.field==='group_type').value==='color'?'1':'0'});
 const commit=input.action==='prestashop_product_commit';
 if(own(input,'recover_unchanged')&&(!commit||input.recover_unchanged!==true))invalid('La recuperación debe confirmarse en la misma solicitud de escritura.');
 if(commit&&(!hash.test(String(input.expected_fingerprint||''))||!uuid.test(String(input.request_id||''))||input.confirmed!==true))invalid('Para escribir debes aportar huella previa, request_id y confirmación explícita.');
 if(!commit&&(own(input,'expected_fingerprint')||own(input,'request_id')||own(input,'confirmed')))invalid('La preparación no acepta confirmaciones de escritura.');
 return {action:input.action,store:input.store,resource:input.resource,record_id:String(input.record_id),
  changes:normalized,...(input.resource==='combinations'?{expected_product_id:String(input.expected_product_id)}:{}),commit,...(commit?{expected_fingerprint:input.expected_fingerprint,request_id:input.request_id,...(input.recover_unchanged?{recover_unchanged:true}:{})}:{})};
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
const xmlValue=value=>value.split(/(<!\[CDATA\[[\s\S]*?\]\]>)/g).map(part=>part.startsWith('<![CDATA[')?part.slice(9,-3):unescapeXml(part)).join('');
const safeCdata=value=>'<![CDATA['+value.replaceAll(']]>',']]]]><![CDATA[>')+']]>';
export function selectedXmlValues(xml,resource,id,changes,expectedProductId=null){
 const root=tree(xml),singular=nativeNodes[resource];if(!singular)invalid('Recurso no admitido.');
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
  const before=slot.selfClosing?'':xmlValue(xml.slice(slot.contentStart,slot.contentEnd));
  const same=before===change.value||(resource==='products'&&['description','description_short'].includes(change.field)&&equivalentProductHTML(before,change.value))||((decimal.has(change.field)||flags.has(change.field))&&before!==''&&change.value!==''&&Number(before)===Number(change.value));
  result.push({...change,before,changed:!same});
  slots.push(slot.selfClosing?{start:slot.open,end:slot.end,value:'<'+slot.name+slot.attributes.replace(/\/$/,'')+'>'+safeCdata(change.value)+'</'+slot.name+'>'}:{start:slot.contentStart,end:slot.contentEnd,value:safeCdata(change.value)});
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

const nativeNodes=Object.freeze({manufacturers:'manufacturer',suppliers:'supplier',product_options:'product_option',product_option_values:'product_option_value',products:'product',combinations:'combination',stock_availables:'stock_available',product_suppliers:'product_supplier',specific_prices:'specific_price',images:'image',totus_product_images:'totus_product_image'});
// Native PUT nulls omitted optional fields. Derive the preservation read from
// the shop's own schema, not just the fields this editor happens to expose.
export function productPreservationProjection(schema){
 const product=direct(tree(schema),'product'),fields=['id'];
 const excluded=new Set(['id','associations','manufacturer_name','quantity','position_in_category','id_default_image','id_default_combination','type']);
 for(const node of product.children){
  if(excluded.has(node.name)||/\breadOnly\s*=\s*(["'])true\1/i.test(node.attributes))continue;
  if(!/^[a-z_][a-z0-9_]*$/.test(node.name))invalid('Campo nativo no verificable.');
  fields.push(node.name);
 }
 const associations=product.children.find(n=>n.name==='associations');
 for(const group of associations?.children||[]){
  if(group.name==='stock_availables'||/\breadOnly\s*=\s*(["'])true\1/i.test(group.attributes))continue;
  const row=group.children[0],keys=(row?.children||[]).map(n=>n.name);
  if(!/^[a-z_][a-z0-9_]*$/.test(group.name)||!keys.length||keys.some(k=>!/^[a-z_][a-z0-9_]*$/.test(k)))invalid('Asociación nativa no verificable.');
  fields.push(group.name+'['+[...new Set(keys)].join(',')+']');
 }
 if(fields.length<2)invalid('Esquema de producto incompleto.');
 return '['+[...new Set(fields)].join(',')+']';
}
// 1.7.8's schema renderer can crash on an empty association. This fallback
// covers its official Product definition, only after the server identifies
// that exact release family. It does not manufacture values or a template.
export function legacyProductPreservationProjection(version){
 if(!/^1\.7\.8(?:\.\d+)?$/.test(version||''))return null;
 const fields=['id',...PRODUCT_WRITE_FIELDS.products,'id_shop_default','id_category_default','id_manufacturer','id_supplier','id_tax_rules_group','supplier_reference','location','quantity_discount','cache_is_pack','cache_has_attachments','is_virtual','state','product_type','customizable','text_fields','uploadable_files','indexed','cache_default_attribute','advanced_stock_management','date_add','date_upd','pack_stock_type','categories[id]','images[id]','combinations[id]','product_option_values[id]','product_features[id,id_feature_value]','tags[id]','attachments[id]','accessories[id]','product_bundle[id,id_product_attribute,quantity]'];
 return '['+[...new Set(fields)].join(',')+']';
}
export function minimalProductStageSchema(resource){
 if(!['combinations','product_suppliers','specific_prices','product_options','product_option_values','manufacturers','suppliers'].includes(resource))invalid('Este recurso no admite plantilla de alta alternativa.');
 const singular=nativeNodes[resource];
 return '<prestashop><'+singular+'><id></id>'+(resource.startsWith('product_option')||['manufacturers','suppliers'].includes(resource)?'':'<id_product></id_product>')+(resource==='combinations'?'<associations><product_option_values></product_option_values><images></images></associations>':'')+'</'+singular+'></prestashop>';
}
// Used only after the stage contract has validated every field and relationship.
// No raw XML can arrive from the browser; schema/current XML is fetched by server.
export function productFinalizationFields(xml,fields){
 const product=direct(tree(xml),'product'),associations=direct(product,'associations');
 const groups=associations.children.filter(n=>n.name==='combinations');
 if(groups.length>1)invalid('Asociación de combinaciones duplicada.');
 const combinations=groups[0]?.children||[];
 for(const row of combinations)if(row.name!=='combination'||!integer.test(fieldText(xml,row,'id')))invalid('Combinaciones de destino no verificables.');
 return {...fields,state:'1',product_type:combinations.length?'combinations':'standard'};
}
export function prepareProductStageXml(xml,resource,fields,associations={},recordId=null){
 const singular=nativeNodes[resource];if(!singular)invalid('Recurso de etapa no admitido.');
 const item=direct(tree(xml),singular),edits=[];let extra='';
 if(recordId!==null&&fieldText(xml,item,'id')!==String(recordId))invalid('La ficha de etapa pertenece a otro registro.');
 const block=(node,content)=>edits.push({start:node.open,end:node.end,value:'<'+node.name+'>'+content+'</'+node.name+'>'});
 for(const [field,value] of Object.entries(fields)){
  if(!/^[a-z][a-z0-9_]*$/.test(field)||field==='id')invalid('Campo de etapa no admitido.');
  const content=Array.isArray(value)?value.map(t=>'<language id="'+t.language_id+'">'+safeCdata(t.value)+'</language>').join(''):safeCdata(String(value));
  const nodes=item.children.filter(node=>node.name===field);if(nodes.length>1)invalid('Campo de etapa duplicado.');
  if(Array.isArray(value)&&nodes.length){
   for(const translation of value){
    const matches=nodes[0].children.filter(node=>node.name==='language'&&node.attributes.match(/\bid\s*=\s*(["'])(\d+)\1/)?.[2]===translation.language_id);
    if(matches.length!==1)invalid('Idioma de etapa no presente en la tienda.');
    const slot=matches[0];
    if(slot.selfClosing)edits.push({start:slot.open,end:slot.end,value:'<language id="'+translation.language_id+'">'+safeCdata(translation.value)+'</language>'});
    else edits.push({start:slot.contentStart,end:slot.contentEnd,value:safeCdata(translation.value)});
   }
  }else if(nodes.length)block(nodes[0],content);else extra+='<'+field+'>'+content+'</'+field+'>';
 }
 const parent=item.children.find(node=>node.name==='associations');let added='';
 for(const [name,ids] of Object.entries(associations)){
  const nodeName={product_option_values:'product_option_value',images:'image',categories:'category',tags:'tag',accessories:'product',product_features:'product_feature'}[name];if(!nodeName||!parent)invalid('Asociación de etapa no admitida.');
  const content=ids.map(id=>name==='product_features'?'<product_feature><id>'+safeCdata(id.feature_id)+'</id><id_feature_value>'+safeCdata(id.value_id)+'</id_feature_value></product_feature>':'<'+nodeName+'><id>'+safeCdata(id)+'</id></'+nodeName+'>').join('');
  const nodes=parent.children.filter(node=>node.name===name);if(nodes.length>1)invalid('Asociación duplicada.');
  if(nodes.length)block(nodes[0],content);else added+='<'+name+'>'+content+'</'+name+'>';
 }
 if(['product_options','manufacturers'].includes(resource)&&parent)edits.push({start:parent.open,end:parent.end,value:''});
 if(added)edits.push({start:parent.contentEnd,end:parent.contentEnd,value:added});
 if(['manufacturers','suppliers'].includes(resource)){const computed=item.children.find(node=>node.name==='link_rewrite');if(computed)edits.push({start:computed.open,end:computed.end,value:''});}
 // PrestaShop sends calculated fields on GET which it rejects on PUT.
 for(const name of resource==='products'?['manufacturer_name','quantity',...['position_in_category','id_default_image','id_default_combination','type'].filter(key=>!Object.hasOwn(fields,key))]:resource==='combinations'?['quantity']:[]){
  const node=item.children.find(node=>node.name===name);if(node)edits.push({start:node.open,end:node.end,value:''});
 }
 if(resource==='products'&&parent){const node=parent.children.find(node=>node.name==='stock_availables');if(node)edits.push({start:node.open,end:node.end,value:''});}
 if(extra)edits.push({start:item.contentEnd,end:item.contentEnd,value:extra});
 for(const edit of edits.sort((a,b)=>b.start-a.start))xml=xml.slice(0,edit.start)+edit.value+xml.slice(edit.end);
 tree(xml);return xml;
}
export function inspectProductStageXml(xml,resource,fields,associations={}){
 const singular=nativeNodes[resource];if(!singular)invalid('Recurso de etapa no admitido.');
 const item=direct(tree(xml),singular),id=fieldText(xml,item,'id');if(!integer.test(id))invalid('Etapa sin identificador real.');
 const numeric=new Set(['id_product','id_product_attribute','id_supplier','id_currency','id_shop','id_shop_group','id_country','id_group','id_customer','id_cart','price','wholesale_price','product_supplier_price_te','reduction','from_quantity','weight','ecotax','unit_price_impact','minimal_quantity','low_stock_threshold','quantity','out_of_stock','depends_on_stock','default_on','active','available_for_order','id_default_image','id_default_combination']);
 const number=value=>{if(!/^-?\d+(?:\.\d{1,6})?$/.test(value))return null;const negative=value.startsWith('-'),[whole,fraction='']=value.replace(/^-/,'').split('.');return (negative?-1n:1n)*(BigInt(whole)*1000000n+BigInt(fraction.padEnd(6,'0')));};
 let nativeHtmlNormalized=false;
 const legacyRoot='<section style="max-width:1100px;margin:0 auto;color:#17382b;font-family:Arial,Helvetica,sans-serif;">';
 const legacyDescription=value=>{
  if(typeof value!=='string'||!value.startsWith(legacyRoot))return null;
  for(const wrapper of [legacyRoot,'<header style="padding:28px;background:#edf5ef;border-radius:20px;">',
   '<figure style="margin:26px 0;padding:20px;background:#f3f7f3;border-radius:20px;">','<figure style="margin:26px 0;padding:20px;background:#edf3f7;border-radius:20px;">',
   '<section style="padding:12px 6px;">','<section style="margin-top:24px;">','<section style="margin-top:24px;padding:24px;background:#f3f6fa;border-radius:18px;">',
   '<aside style="margin-top:22px;padding:14px;border:1px solid #cad8cd;border-radius:12px;font-size:13px;line-height:1.6;">'])value=value.replaceAll(wrapper,'');
  return value.replace(/<\/(?:section|header|figure|aside)>/g,'').replaceAll('display:block;width:100%;','');
 };
 for(const [field,value] of Object.entries(fields)){
  if(Array.isArray(value)){
   const node=direct(item,field);
   for(const translation of value){
    const languages=node.children.filter(child=>child.name==='language'&&child.attributes.match(/\bid\s*=\s*(["'])(\d+)\1/)?.[2]===translation.language_id);
    if(languages.length!==1)invalid('La traducción de '+field+' no coincide.');
    const actual=xmlValue(xml.slice(languages[0].contentStart,languages[0].contentEnd));
    if(actual!==translation.value){
     // Recover only the previous Totus builder's known HTML5-to-HTML4
     // transformation. All text, images, links and table cells stay exact.
     if(resource!=='products'||!['description','description_short'].includes(field)||!equivalentProductHTML(translation.value,actual)&&(field!=='description'||!equivalentProductHTML(legacyDescription(translation.value),actual)))invalid('La traducción de '+field+' no coincide.');
     nativeHtmlNormalized=true;
    }
   }
  }else{
   const raw=fieldText(xml,item,field),expected=String(value);
   // Combination::setWsDefaultOn stores false as SQL NULL. The native
   // Webservice serializes that as an empty element, meaning not default.
   // Still require the element, and never normalize other flags or values.
   const actual=resource==='combinations'&&field==='default_on'&&raw===''?'0':raw;
   if(numeric.has(field)?number(actual)===null||number(actual)!==number(expected):actual!==expected)invalid('El campo '+field+' de la etapa no coincide.');
  }
 }
 for(const [name,ids] of Object.entries(associations)){
  const actual=direct(direct(item,'associations'),name).children.map(row=>name==='product_features'?fieldText(xml,row,'id')+':'+fieldText(xml,row,'id_feature_value'):fieldText(xml,row,'id')).sort();
  const expected=ids.map(row=>name==='product_features'?row.feature_id+':'+row.value_id:row).sort();
  if(JSON.stringify(actual)!==JSON.stringify(expected))invalid('Los valores de '+name+' no coinciden.');
 }
 return {id,verified:true,...(nativeHtmlNormalized?{native_html_normalized:true}:{})};
}


// Product creation is separate from selective PUT. The destination shop supplies
// the blank schema and language IDs; we never copy entity IDs from another shop.
export function validateProductRelations(input,categoryId){
 if(input===undefined)return undefined;
 const allowed=['manufacturer_id','supplier_id','tax_rules_group_id','category_ids','related_product_ids','tag_ids','features'];
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!allowed.includes(k)))invalid('Relaciones de producto no admitidas.');
 const out={};
 for(const key of ['manufacturer_id','supplier_id','tax_rules_group_id'])if(own(input,key)){
  if(!integer.test(String(input[key])))invalid('Selecciona un registro real para '+key+'.');out[key]=String(input[key]);
 }
 for(const key of ['category_ids','related_product_ids','tag_ids'])if(own(input,key)){
  if(!Array.isArray(input[key])||input[key].some(id=>!integer.test(String(id)))||new Set(input[key].map(String)).size!==input[key].length)invalid('Selección duplicada o inválida para '+key+'.');
  out[key]=input[key].map(String).sort((a,b)=>Number(a)-Number(b));
 }
 if(out.category_ids&&!out.category_ids.includes(String(categoryId)))invalid('La categoría principal debe estar entre las categorías asociadas.');
 if(own(input,'features')){
  if(!Array.isArray(input.features))invalid('Características incorrectas.');const ids=new Set();
  out.features=input.features.map(f=>{
   if(!f||typeof f!=='object'||Object.keys(f).some(k=>!['feature_id','value_id'].includes(k))||!integer.test(String(f.feature_id))||!integer.test(String(f.value_id))||ids.has(String(f.feature_id)))invalid('Característica repetida o sin valor válido.');
   ids.add(String(f.feature_id));return {feature_id:String(f.feature_id),value_id:String(f.value_id)};
  }).sort((a,b)=>Number(a.feature_id)-Number(b.feature_id));
 }
 return out;
}
export function validateProductCreateRequest(input){
 if(!input||typeof input!=='object'||Array.isArray(input))invalid();
 const accepted=new Set(['action','id','call_id','revision','store','reference','price','category_id','translations','fields','relations','expected_fingerprint','request_id','confirmed','retry_absent']);
 if(Object.keys(input).some(key=>!accepted.has(key))||!['prestashop_product_create_prepare','prestashop_product_create_commit'].includes(input.action)||
 !['hortimatic','newoldsmok'].includes(input.store)||!uuid.test(String(input.id||''))||!uuid.test(String(input.call_id||''))||
 !Number.isSafeInteger(input.revision)||input.revision<1||!integer.test(String(input.category_id||'')))invalid('Solicitud de alta de producto no válida.');
 if(typeof input.reference!=='string'||!/^[a-z0-9][a-z0-9._-]{2,63}$/i.test(input.reference))invalid('Referencia no válida para evitar duplicados.');
 validateValue('price',input.price,'products');
 if(!Array.isArray(input.translations)||input.translations.length<1||input.translations.length>12)invalid('Selecciona los idiomas de destino.');
 const seen=new Set();
 const translations=input.translations.map(t=>{
  if(!t||typeof t!=='object'||Array.isArray(t)||Object.keys(t).some(k=>!['language_id',...LOCALIZED_PRODUCT_FIELDS].includes(k))||
  !integer.test(String(t.language_id||''))||seen.has(String(t.language_id)))invalid('Idiomas repetidos o no válidos.');
  seen.add(String(t.language_id));
  validateValue('name',t.name,'products');
  validateValue('link_rewrite',t.link_rewrite,'products');
  if(!t.name.trim())invalid('No se puede crear un producto sin nombre.');
  const translation={language_id:String(t.language_id),name:t.name,link_rewrite:t.link_rewrite};
  for(const field of LOCALIZED_PRODUCT_FIELDS.filter(f=>!['name','link_rewrite'].includes(f)))if(own(t,field))translation[field]=validateValue(field,t[field],'products');
  return translation;
 });
 const fields=input.fields??[];
 if(!Array.isArray(fields)||fields.length>PRODUCT_CREATE_FIELDS.length)invalid('Campos adicionales de alta no válidos.');
 const chosen=new Set();
 const extra=fields.map(row=>{
  if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).some(k=>!['field','value'].includes(k))||!PRODUCT_CREATE_FIELDS.includes(row.field)||chosen.has(row.field))invalid('Campo adicional de alta no admitido o repetido.');
  chosen.add(row.field);return {field:row.field,value:validateValue(row.field,row.value,'products')};
 });
 if(chosen.has('redirect_type')!==chosen.has('id_type_redirected'))invalid('Selecciona el tipo y el destino de redirección juntos.');
 const commit=input.action==='prestashop_product_create_commit';
 if(own(input,'retry_absent')&&(!commit||input.retry_absent!==true))invalid('El reintento necesita confirmación expresa de una solicitud previa.');
 if(commit&&(!hash.test(String(input.expected_fingerprint||''))||!uuid.test(String(input.request_id||''))||input.confirmed!==true))
  invalid('El alta exige confirmación, huella vigente y request_id estable.');
 if(!commit&&(own(input,'expected_fingerprint')||own(input,'request_id')||own(input,'confirmed')))
  invalid('No se aceptan confirmaciones durante la preparación.');
 return {store:input.store,resource:'products',reference:input.reference,price:input.price,category_id:String(input.category_id),translations,fields:extra,relations:validateProductRelations(input.relations,input.category_id),
  commit,...(commit?{expected_fingerprint:input.expected_fingerprint,request_id:input.request_id,...(input.retry_absent===true?{retry_absent:true}:{})}:{})};
}
export function prepareProductCreationXml(schema,create){
 let root=tree(schema),product=direct(root,'product'),id=direct(product,'id');
 if(xmlValue(schema.slice(id.contentStart,id.contentEnd)).trim())invalid('El esquema de alta contiene un ID; no es una ficha en blanco.');
 // A native blank schema is a catalogue of possible fields, not a POST body.
 // Sending its empty stock/image/pack associations invokes setters for records
 // which do not exist yet. Calculated fields can also invoke write-only setters.
 // Keep destination languages, then include only the reviewed create contract.
 schema=minimalBlankProductSchema(productCreateLanguageIds(schema));
 root=tree(schema);product=direct(root,'product');
 const desired=new Map();
 const set=(node,value)=>{
  if(node.selfClosing||node.children.length)invalid('El esquema contiene campos complejos no compatibles.');
  if(desired.has(node.contentStart))invalid('Campo XML de alta duplicado.');
  desired.set(node.contentStart,{start:node.contentStart,end:node.contentEnd,value:safeCdata(value)});
 };
 for(const [field,value] of [['reference',create.reference],['price',create.price],['active','0'],['state','1'],['id_category_default',create.category_id]]){
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
 const categoryIds=create.relations?.category_ids;
 if(categoryIds){desired.set(categories.contentStart,{start:categories.contentStart,end:categories.contentEnd,value:categoryIds.map(id=>'<category><id>'+safeCdata(id)+'</id></category>').join('')});}
 else set(direct(direct(categories,'category'),'id'),create.category_id);
 let additional='';
 // Only known fields may be added to a minimal 1.7 schema; never accept raw XML or relationships.
 for(const entry of create.fields||[]){
  const nodes=product.children.filter(n=>n.name===entry.field);
  if(nodes.length>1)invalid('Campo adicional duplicado en el esquema.');
  if(nodes.length)set(nodes[0],entry.value);else additional+='<'+entry.field+'>'+safeCdata(entry.value)+'</'+entry.field+'>';
 }
 for(const field of LOCALIZED_PRODUCT_FIELDS.filter(f=>!['name','link_rewrite'].includes(f))){
  if(!create.translations.some(t=>own(t,field)))continue;
  if(create.translations.some(t=>!own(t,field)))invalid('El campo '+field+' no cubre todos los idiomas.');
  const nodes=product.children.filter(n=>n.name===field);
  if(nodes.length>1)invalid('Campo traducido duplicado en el esquema.');
  if(nodes.length){
   for(const t of create.translations){const matches=nodes[0].children.filter(n=>n.name==='language'&&n.attributes.match(/\bid\s*=\s*(["'])(\d+)\1/i)?.[2]===t.language_id);if(matches.length!==1)invalid('Idioma adicional no válido.');set(matches[0],t[field]);}
  }else additional+='<'+field+'>'+create.translations.map(t=>'<language id="'+t.language_id+'">'+safeCdata(t[field])+'</language>').join('')+'</'+field+'>';
 }
 for(const [key,field] of [['manufacturer_id','id_manufacturer'],['supplier_id','id_supplier'],['tax_rules_group_id','id_tax_rules_group']])if(create.relations?.[key]){
  const nodes=product.children.filter(n=>n.name===field);
  if(nodes.length>1)invalid('Relación duplicada en el esquema.');
  if(nodes.length)set(nodes[0],create.relations[key]);else additional+='<'+field+'>'+safeCdata(create.relations[key])+'</'+field+'>';
 }
 let addedAssociations='';
 for(const [key,group,singular] of [['related_product_ids','accessories','product'],['tag_ids','tags','tag'],['features','product_features','product_feature']])if(own(create.relations||{},key)){
  const content=create.relations[key].map(value=>key==='features'?'<product_feature><id>'+safeCdata(value.feature_id)+'</id><id_feature_value>'+safeCdata(value.value_id)+'</id_feature_value></product_feature>':'<'+singular+'><id>'+safeCdata(value)+'</id></'+singular+'>').join('');
  const nodes=associations.children.filter(n=>n.name===group);
  if(nodes.length>1)invalid('Asociación duplicada en el esquema.');
  if(nodes.length){const node=nodes[0];if(node.selfClosing)desired.set(node.open,{start:node.open,end:node.end,value:'<'+group+'>'+content+'</'+group+'>'});else desired.set(node.contentStart,{start:node.contentStart,end:node.contentEnd,value:content});}
  else addedAssociations+='<'+group+'>'+content+'</'+group+'>';
 }
 if(addedAssociations)desired.set(associations.contentEnd,{start:associations.contentEnd,end:associations.contentEnd,value:addedAssociations});
 if(additional)desired.set(associations.open,{start:associations.open,end:associations.open,value:additional});
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
function fieldText(xml,node,field){
 const part=direct(node,field);
 if(part.children.length||part.selfClosing)invalid('El campo '+field+' no es escalar.');
 return xmlValue(xml.slice(part.contentStart,part.contentEnd)).trim();
}
function listingId(xml,node){
 const attr=node.attributes.match(/\bid\s*=\s*(["'])([1-9]\d{0,14})\1/i)?.[2];
 const nodes=node.children.filter(n=>n.name==='id');
 if(nodes.length>1)invalid('El listado contiene varios IDs.');
 const nested=nodes.length===1?fieldText(xml,node,'id'):null;
 if(attr&&nested&&attr!==nested)invalid('El listado tiene un identificador ambiguo.');
 const id=attr||nested;
 if(!id||!integer.test(id))invalid('Producto listado sin identificador.');
 return id;
}
export function inspectProductReferenceListing(xml){
 const root=tree(xml),collection=direct(root,'products');
 if(collection.children.some(n=>n.name!=='product'))invalid('Listado de referencias no válido.');
 const result=collection.children.map(n=>listingId(xml,n));
 if(new Set(result).size!==result.length)invalid('Listado de productos duplicado.');
 return result;
}
// Independent readback through a filtered product collection; PrestaShop 1.7.8
// may persist a POST but throw HTTP 500 when rendering product image details.
// Never treat HTTP status alone as proof the product was or was not created.
export function inspectReconciledNewProduct(xml,expected,expectedId=null){
 let nativeHtmlNormalized=false;
 const root=tree(xml),collection=direct(root,'products');
 if(collection.children.length!==1||collection.children[0].name!=='product')
  invalid('No hay exactamente un producto comprobable con la referencia de destino.');
 const product=collection.children[0],id=listingId(xml,product);
 if(expectedId!==null&&id!==String(expectedId))invalid('La relectura devolvió otro ID de producto.');
 if(fieldText(xml,product,'reference')!==expected.reference)invalid('Referencia de alta no coincidente.');
 if(fieldText(xml,product,'active')!=='0')invalid('No se confirma que el producto esté inactivo.');
 if(fieldText(xml,product,'id_category_default')!==String(expected.category_id))
  invalid('La categoría de alta no coincide.');
 const normalized=value=>{
  if(typeof value!=='string'||!/^(?:0|[1-9]\d{0,10})(?:\.\d{1,6})?$/.test(value))
   invalid('Precio de alta no verificable.');
  const [whole,decimal='']=value.split('.');
  return BigInt(whole)*1000000n+BigInt((decimal+'000000').slice(0,6));
 };
 if(normalized(fieldText(xml,product,'price'))!==normalized(expected.price))
  invalid('El precio creado no coincide.');
 if(!Array.isArray(expected.translations)||!expected.translations.length)
  invalid('Faltan traducciones para verificar el alta.');
 for(const [field,property] of [['name','name'],['link_rewrite','link_rewrite']]){
  const node=direct(product,field);
  if(node.children.length!==expected.translations.length)
   invalid('No coinciden los idiomas del campo '+field+'.');
  for(const entry of expected.translations){
   const matches=node.children.filter(child=>child.name==='language'&&child.attributes.match(/\bid\s*=\s*(["'])([1-9]\d{0,14})\1/i)?.[2]===entry.language_id);
   if(matches.length!==1||matches[0].selfClosing||
      xmlValue(xml.slice(matches[0].contentStart,matches[0].contentEnd))!==entry[property])
    invalid('Traducción '+field+' del idioma '+entry.language_id+' no coincidente.');
  }
 }
 for(const field of LOCALIZED_PRODUCT_FIELDS.filter(f=>!['name','link_rewrite'].includes(f)&&expected.translations.some(t=>own(t,f)))){
  const node=direct(product,field);
  for(const t of expected.translations){
   const matches=node.children.filter(n=>n.name==='language'&&n.attributes.match(/\bid\s*=\s*(["'])(\d+)\1/i)?.[2]===t.language_id);
   if(matches.length!==1)invalid('El campo '+field+' no coincide tras crear.');const actual=xmlValue(xml.slice(matches[0].contentStart,matches[0].contentEnd));if(actual!==t[field]){if(!['description','description_short'].includes(field)||!equivalentProductHTML(t[field],actual))invalid('El campo '+field+' no coincide tras crear.');nativeHtmlNormalized=true;}
  }
 }
 for(const entry of expected.fields||[]){
  const actual=fieldText(xml,product,entry.field);
  if(decimal.has(entry.field)?normalized(actual)!==normalized(entry.value):actual!==entry.value)invalid('El campo '+entry.field+' no coincide tras crear.');
 }
 for(const [key,field] of [['manufacturer_id','id_manufacturer'],['supplier_id','id_supplier'],['tax_rules_group_id','id_tax_rules_group']])if(expected.relations?.[key]&&fieldText(xml,product,field)!==expected.relations[key])invalid('La relación '+field+' no coincide tras crear.');
 for(const [key,group] of [['category_ids','categories'],['related_product_ids','accessories'],['tag_ids','tags'],['features','product_features']])if(own(expected.relations||{},key)){
  const actual=direct(direct(product,'associations'),group).children.map(row=>key==='features'?fieldText(xml,row,'id')+':'+fieldText(xml,row,'id_feature_value'):fieldText(xml,row,'id')).sort();
  const wanted=expected.relations[key].map(row=>key==='features'?row.feature_id+':'+row.value_id:row).sort();
  if(JSON.stringify(actual)!==JSON.stringify(wanted))invalid('La asociación '+group+' no coincide tras crear.');
 }
 return {id,reference:expected.reference,active:false,verified:true,...(nativeHtmlNormalized?{native_html_normalized:true}:{})};
}


export function readPrestashopXmlField(xml,resource,field){
 if(!['product','category','combination','manufacturer','supplier','tax_rule_group','product_feature','product_feature_value','tag'].includes(resource)||!['id','id_feature','reference'].includes(field))invalid('Recurso o campo no admitido.');
 return fieldText(xml,direct(tree(xml),resource),field);
}
export function parsePrestashopResourceId(xml,resource){
 if(!['product','category','combination','manufacturer','supplier','tax_rule_group','product_feature','product_feature_value','tag'].includes(resource))invalid('Recurso no admitido.');
 const root=tree(xml),item=direct(root,resource),node=direct(item,'id');
 const id=xmlValue(xml.slice(node.contentStart,node.contentEnd)).trim();
 if(!integer.test(id))invalid('Respuesta del proveedor sin identificador válido.');
 return id;
}
export function inspectNewProduct(xml,id,reference){
 const root=tree(xml),product=direct(root,'product');
 const node=direct(product,'id'),actual=xmlValue(xml.slice(node.contentStart,node.contentEnd)).trim();
 if(actual!==String(id))invalid('La relectura devolvió otro producto.');
 const ref=direct(product,'reference'),active=direct(product,'active');
 const found=xmlValue(xml.slice(ref.contentStart,ref.contentEnd)).trim(),enabled=xmlValue(xml.slice(active.contentStart,active.contentEnd)).trim();
 if(found!==reference||enabled!=='0')invalid('El producto creado no coincide o quedó activo sin autorización.');
 return {id:actual,reference:found,active:false};
}


export function productCreateLanguageIds(xml){
 const root=tree(xml),product=direct(root,'product'),names=direct(product,'name'),slugs=direct(product,'link_rewrite');
 const extract=node=>{
  const ids=node.children.map(child=>child.name==='language'?child.attributes.match(/\bid\s*=\s*(["'])([1-9]\d{0,14})\1/i)?.[2]:null);
  if(!ids.length||ids.some(x=>!x)||new Set(ids).size!==ids.length)invalid('Idiomas no válidos en la ficha en blanco.');
  return ids;
 };
 const n=extract(names),l=extract(slugs);
 if(n.length!==l.length||n.some(x=>!l.includes(x)))invalid('Idiomas incoherentes entre nombre y URL amigable.');
 return n;
}


// PrestaShop 1.7.8.x has an upstream blank-schema HTTP 500 bug (#26559).
// Read languages from the destination shop and build a SMALL independent create
// template; do not copy any existing product, combinations or internal IDs.
export function productLanguageIdsFromListing(xml){
 const root=tree(xml),list=direct(root,'languages');
 if(!list.children.length||list.children.length>12||list.children.some(x=>x.name!=='language'))
  invalid('La lista de idiomas de destino no es válida.');
 const ids=list.children.map(x=>{
  const attr=x.attributes.match(/\bid\s*=\s*(["'])([1-9]\d{0,14})\1/i)?.[2];
  const idNodes=x.children.filter(n=>n.name==='id');
  if(idNodes.length>1)invalid('La lista tiene varios IDs para el mismo idioma.');
  const nested=idNodes.length===1?xmlValue(xml.slice(idNodes[0].contentStart,idNodes[0].contentEnd)).trim():null;
  if(attr&&nested&&attr!==nested)invalid('ID de idioma ambiguo.');
  return attr||nested;
 });
 if(ids.some(id=>!id||!integer.test(id))||new Set(ids).size!==ids.length)
  invalid('La tienda ha devuelto IDs de idioma ausentes o duplicados.');
 return ids;
}
export function minimalBlankProductSchema(languageIds){
 if(!Array.isArray(languageIds)||!languageIds.length||languageIds.length>12||
    languageIds.some(id=>typeof id!=='string'||!integer.test(id))||
    new Set(languageIds).size!==languageIds.length)
  invalid('Idiomas de alta no válidos.');
 const languages=languageIds.map(id=>'<language id="'+id+'"><![CDATA[]]></language>').join('');
 const schema='<?xml version="1.0" encoding="UTF-8"?>'
  +'<prestashop xmlns:xlink="http://www.w3.org/1999/xlink"><product>'
  +'<id><![CDATA[]]></id><id_category_default><![CDATA[]]></id_category_default>'
  +'<reference><![CDATA[]]></reference><price><![CDATA[]]></price><active><![CDATA[]]></active><state><![CDATA[]]></state>'
  +'<name>'+languages+'</name><link_rewrite>'+languages+'</link_rewrite>'
  +'<associations><categories><category><id><![CDATA[]]></id></category></categories></associations>'
  +'</product></prestashop>';
 if(productCreateLanguageIds(schema).length!==languageIds.length)invalid('No se pudo generar la ficha segura.');
 return schema;
}


// Empty JSON associations are omitted by some native 1.7 responses. XML must
// still contain the requested association node; missing/partial data is not zero.
export function inspectProductAssociationIds(xml,productId,group){
 const names={images:'image',combinations:'combination'};if(!names[group])invalid('Asociación no admitida.');
 const product=direct(tree(xml),'product');if(fieldText(xml,product,'id')!==String(productId))invalid('Ficha de otro producto.');
 const association=direct(direct(product,'associations'),group),ids=[];
 for(const row of association.children){if(row.name!==names[group])invalid('Asociación no verificable.');const id=fieldText(xml,row,'id');if(!integer.test(id)||ids.includes(id))invalid('Identificador de asociación no válido.');ids.push(id);}
 return ids;
}

export function productRedirectTarget(type,id,currentId=null){
 if(!['404','301-product','302-product','301-category','302-category'].includes(type)||!/^(?:0|[1-9]\d{0,14})$/.test(String(id)))invalid('Tipo o destino de redirección no válido.');
 if(type==='404')return null;
 if(String(id)==='0')invalid('Selecciona un destino real para la redirección.');
 const product=type.endsWith('-product');if(product&&String(id)===String(currentId))invalid('Un producto no puede redirigir a sí mismo.');
 return {resource:product?'products':'categories',node:product?'product':'category',id:String(id)};
}

// PrestaShop serializes HTML void elements as XHTML. Accept only that syntactic
// difference: preserve every text, attribute, URL, image and table cell exactly.
export function equivalentProductHTML(left,right){
 if(typeof left!=='string'||typeof right!=='string')return false;
 if(left===right)return true;
 const normalize=value=>{
  if(/<(?:script|style|textarea|title|xmp|plaintext|noscript)(?:\s|>)/i.test(value))return value;
  return value.replace(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<(?:[^"'<>]|"[^"]*"|'[^']*')*>/g,token=>{
   const tag=token.match(/^<(br|img|hr|wbr|col)(?=[\s/>])/i);if(!tag)return token;
   const ending=token.match(/\s*\/?>$/);if(!ending)return token;
   const body=token.slice(tag[0].length,token.length-ending[0].length);let remaining=body;
   while(remaining.trim()){
    const attribute=remaining.match(/^\s+[a-z_:][\w:.-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'))?/i);
    if(!attribute)return token;remaining=remaining.slice(attribute[0].length);
   }
   return token.slice(0,token.length-ending[0].length)+'>';
  });
 };
 return normalize(left)===normalize(right);
}


// Native XML is the canonical representation used by the verified combination
// writer. Read the same representation instead of depending on JSON serialization.
export function readPrestashopCombinationXml(xml,expectedId){
 const item=direct(tree(xml),'combination'),result={};
 for(const field of ['id','id_product',...PRODUCT_WRITE_FIELDS.combinations,'supplier_reference','ecotax','unit_price_impact','default_on','available_date']){
  const nodes=item.children.filter(n=>n.name===field);if(!nodes.length)continue;if(nodes.length!==1)invalid('Campo de combinación duplicado.');
  result[field]=nodes[0].selfClosing?'':fieldText(xml,item,field);
 }
 if(result.id!==String(expectedId)||!integer.test(result.id_product||''))invalid('La combinación no coincide con el identificador o su producto.');
 if(result.default_on==='')result.default_on='0';
 result.associations={};const associations=item.children.filter(n=>n.name==='associations');if(associations.length>1)invalid('Asociaciones de combinación duplicadas.');
 for(const [name,singular]of [['images','image'],['product_option_values','product_option_value']]){
  const groups=associations[0]?.children.filter(n=>n.name===name)||[];if(groups.length>1)invalid('Relación de combinación duplicada.');
  const ids=(groups[0]?.children||[]).map(row=>{if(row.name!==singular)invalid('Relación de combinación no válida.');const id=fieldText(xml,row,'id');if(!integer.test(id))invalid('Relación de combinación sin ID.');return id;});
  if(new Set(ids).size!==ids.length)invalid('Relación de combinación repetida.');result.associations[name]=ids.map(id=>({id}));
 }
 return result;
}
