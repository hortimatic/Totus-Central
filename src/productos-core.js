// Productos · selección de campos y planes de transferencia SIN escrituras.
import {WEBSITE_CHOICES as PRODUCT_STORES} from './website-registry.js';
export {PRODUCT_STORES};
export const PRODUCT_SECTIONS=Object.freeze({
 general:['name','reference','ean13','isbn','upc','mpn','active','visibility','condition','show_condition','available_for_order','show_price','online_only','description_short','description'],
 precios:['price','wholesale_price','unity','on_sale','ecotax'],
 seo:['meta_title','meta_description','meta_keywords','link_rewrite','redirect_type','id_type_redirected'],
 transporte:['weight','width','height','depth','additional_shipping_cost','additional_delivery_times','delivery_in_stock','delivery_out_stock'],
 inventario:['minimal_quantity','low_stock_threshold','low_stock_alert','available_date','available_now','available_later']
});
export const VARIANT_FIELDS=Object.freeze(['reference','ean13','isbn','upc','mpn','price','wholesale_price','weight','minimal_quantity','low_stock_threshold','low_stock_alert']);
const FIELDS=new Set(Object.values(PRODUCT_SECTIONS).flat());
const own=(x,k)=>Object.prototype.hasOwnProperty.call(x||{},k);
export const cleanId=value=>/^[1-9]\d{0,14}$/.test(String(value??''))?String(value):null;
export const textValue=value=>{
 if(value===null||value===undefined)return '';
 if(typeof value==='string'||typeof value==='number'||typeof value==='boolean')return String(value);
 if(Array.isArray(value))return value.map(entry=>textValue(entry?.value??entry)).filter(Boolean).join(' · ');
 if(typeof value==='object'&&Array.isArray(value.language))return textValue(value.language);
 if(typeof value==='object'&&own(value,'value'))return textValue(value.value);
 return '';
};
const decimalInputs=new Set(['price','wholesale_price','unit_price_ratio','unit_price_impact','ecotax','weight','width','height','depth','additional_shipping_cost','product_supplier_price_te','reduction']);
export function productInputValue(field,value){
 const text=String(value??'');if(!decimalInputs.has(field))return text;
 const raw=text.trim();if(!/^-?(?:\d+(?:[,.]\d+)?|[,.]\d+)$/.test(raw))return text;
 return raw.replace(',','.').replace(/^(-?)\./,(_,sign)=>sign+'0.').replace(/^(-?)0+(?=\d)/,'$1');
}
export function normalizedProduct(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('La ficha de PrestaShop no es válida.');
 const id=cleanId(raw.id);
 if(!id)throw Error('La ficha no tiene ID de producto válido.');
 return {id,raw,reference:textValue(raw.reference).trim(),name:textValue(raw.name).trim(),combinations:associationIds(raw,'combinations'),categories:associationIds(raw,'categories'),images:associationIds(raw,'images')};
}
export function associationIds(resource,name){
 const payload=resource?.associations?.[name],singular=name==='categories'?'category':name==='images'?'image':name==='combinations'?'combination':name==='product_option_values'?'product_option_value':null;
 const entries=Array.isArray(payload)?payload:Array.isArray(payload?.[singular])?payload[singular]:payload?.[singular]?[payload[singular]]:[];
 return [...new Set(entries.map(item=>cleanId(item?.id??item)).filter(Boolean))];
}
export function matchExactReference(rows,reference){
 const ref=textValue(reference).trim().toLocaleLowerCase('es');
 if(!ref)return {status:'missing_reference',product:null};
 const matches=(rows||[]).filter(p=>textValue(p?.reference).trim().toLocaleLowerCase('es')===ref);
 return matches.length===1?{status:'matched',product:matches[0]}:{status:matches.length>1?'ambiguous':'not_found',product:null};
}
export function safeFields(fields,{variant=false}={}){
 const accepted=variant?new Set(VARIANT_FIELDS):FIELDS;
 if(!Array.isArray(fields)||fields.length>accepted.size||fields.some(f=>!accepted.has(f))||new Set(fields).size!==fields.length)throw Error('Hay campos no permitidos o duplicados en la selección.');
 return fields;
}
const canonical=value=>JSON.stringify(value??null);
export function planSelectedFields({source,target=null,fields=[],overrides={},variant=false}){
 if(!source||typeof source!=='object'||Array.isArray(source))throw Error('Falta la ficha de origen.');
 safeFields(fields,{variant});
 if(!overrides||typeof overrides!=='object'||Array.isArray(overrides)||Object.keys(overrides).some(k=>!fields.includes(k)))throw Error('La edición contiene campos no seleccionados.');
 return fields.map(field=>{
  const original=target&&own(target,field)?target[field]:null;
  const next=own(overrides,field)?overrides[field]:source[field];
  if(next===undefined||next===null||typeof next==='object'&&!Array.isArray(next)&&!own(next,'language')||typeof next==='string'&&next.length>300000)throw Error('El campo '+field+' no tiene un valor transferible.');
  return {field,before:original,after:next,changed:canonical(original)!==canonical(next)};
 });
}
export function buildProductPlan({source,target=null,store,fields=[],overrides={},variants=[]}){
 if(!PRODUCT_STORES.some(s=>s.key===store))throw Error('Tienda de destino no admitida.');
 if(target&&cleanId(target.id)===null)throw Error('Destino existente sin ID válido.');
 const product=planSelectedFields({source,target,fields,overrides});
 if(!Array.isArray(variants)||variants.length>500)throw Error('Selección de combinaciones no válida.');
 const seen=new Set();
 const planned=variants.map(v=>{
  if(!v||!v.source||typeof v.source!=='object')throw Error('Combinación de origen inválida.');
  const sourceId=cleanId(v.source.id),draftKey=typeof v.source.draft_key==='string'&&/^draft-[a-z0-9-]{10,}$/.test(v.source.draft_key)?v.source.draft_key:null;
  if(!sourceId&&!draftKey)throw Error('Combinación sin identificador temporal o real.');
  const key=sourceId||draftKey;
  if(seen.has(key))throw Error('Combinación repetida.');seen.add(key);
  if(v.target&&!cleanId(v.target.id))throw Error('Combinación de destino sin ID.');
    return {source_id:sourceId,draft_key:draftKey,draft_image_keys:v.source.__draftImageKeys??null,target_id:v.target?cleanId(v.target.id):null,source_default_on:String(v.source.default_on)==='1',source_image_ids:associationIds(v.source,'images'),source_stock:v.source.__stock?{quantity:String(v.source.__stock.quantity),out_of_stock:String(v.source.__stock.out_of_stock??'0'),depends_on_stock:String(v.source.__stock.depends_on_stock??'0'),location:String(v.source.__stock.location??'')}:null,
    changes:planSelectedFields({source:v.source,target:v.target,fields:v.fields||[],overrides:v.overrides||{},variant:true}),
    attributes:associationIds(v.source,'product_option_values'),source_attributes:(v.source.__attributes||[]).map(a=>({group:a.group,value:a.value})),
    requires_attribute_mapping:!v.target};
 });
 return {
  store,operation:target?'update':'create',source_id:cleanId(source.id),target_id:target?cleanId(target.id):null,
  changes:product,variants:planned,requires_review:true,persisted:false,
  warnings:[...(!target?['El alta requiere completar campos obligatorios, categorías e idiomas del destino.']:[]),
    ...(planned.some(v=>v.requires_attribute_mapping)?['Hay variantes nuevas: confirmar la correspondencia de atributos de la tienda de destino.']:[]),
    'Las categorías, imágenes, impuestos y existencias necesitan correspondencia propia por tienda; no se trasladan por ID.']
 };
}
export function bulkVariantSelection(rows,ids,fields){
 safeFields(fields,{variant:true});
 const selected=new Set((ids||[]).map(cleanId));
 if(selected.has(null)||selected.size!==(ids||[]).length)throw Error('La selección de combinaciones no es válida.');
 const matched=(rows||[]).filter(row=>selected.has(cleanId(row.id)));
 if(matched.length!==selected.size)throw Error('Faltan combinaciones seleccionadas: no se modifica el resto.');
 return matched.map(row=>({id:cleanId(row.id),reference:textValue(row.reference),fields}));
}

// Redirect target IDs belong to one shop. Keep other selected fields copyable.
export function productCopyRedirect({fields,source,overrides={},adapted={},crossStore=false}){
 const selected=[...fields],values={...overrides,...adapted};
 if(!crossStore||!selected.some(k=>['redirect_type','id_type_redirected'].includes(k))||Object.hasOwn(adapted,'id_type_redirected'))return {fields:selected,overrides:values,notice:''};
 const type=String(values.redirect_type??source.redirect_type??''),target=String(values.id_type_redirected??source.id_type_redirected??'');
 if(type==='404'||target==='0')return {fields:[...new Set([...selected,'redirect_type','id_type_redirected'])],overrides:{...values,redirect_type:'404',id_type_redirected:'0'},notice:type!=='404'?'La redirección de origen no tiene destino: se prepara sin redirección.':''};
 return {fields:selected.filter(k=>!['redirect_type','id_type_redirected'].includes(k)),overrides:values,notice:'La redirección queda pendiente de elegir en esta tienda. Los demás campos están preparados.'};
}

export function matchVariantInStore(source,rows){
 const normal=v=>String(v??'').normalize('NFKC').trim().toLocaleLowerCase('es');
 const ref=normal(source.reference),byRef=ref?rows.filter(r=>normal(r.reference)===ref):[];
 if(byRef.length)return {status:byRef.length===1?'matched':'ambiguous',variant:byRef.length===1?byRef[0]:null};
 const key=row=>{const a=row.__attributes;if(!Array.isArray(a)||!a.length||a.some(v=>!normal(v.group)||!normal(v.value))||new Set(a.map(v=>normal(v.group))).size!==a.length)return null;return JSON.stringify(a.map(v=>[normal(v.group),normal(v.value)]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));};
 const sourceKey=key(source),found=sourceKey?rows.filter(r=>key(r)===sourceKey):[];
 return {status:found.length===1?'matched':found.length?'ambiguous':'missing',variant:found.length===1?found[0]:null};
}

export function mapVariantAttributes(attributes,groups,values){
 const normal=v=>textValue(v).normalize('NFKC').trim().toLocaleLowerCase('es'),ids=[];
 if(!attributes?.length)return {ids:[],complete:false};
 for(const attr of attributes){if(!normal(attr.group)||!normal(attr.value))return {ids:[],complete:false};const group=groups.filter(g=>normal(g.name)===normal(attr.group));if(group.length!==1)return {ids:[],complete:false};const found=values.filter(v=>String(v.id_attribute_group)===String(group[0].id)&&normal(v.name)===normal(attr.value));if(found.length!==1)return {ids:[],complete:false};ids.push(String(found[0].id));}
 return {ids,complete:new Set(ids).size===attributes.length};
}
