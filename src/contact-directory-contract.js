// Business fields only. Authentication/password/reset tokens are never returned.
export const DIRECTORY_KINDS=Object.freeze({
 clientes:{title:'Clientes',module:'facturacion',resource:'customers',resources:['customers','addresses','orders','order_details','products','combinations','currencies','countries','states','groups','languages']},
 proveedores:{title:'Proveedores',module:'gastos',resource:'suppliers',resources:['suppliers','addresses','products','product_suppliers','countries','states','languages']},
 marcas:{title:'Marcas',module:'pricing',resource:'manufacturers',resources:['manufacturers','addresses','products','countries','states','languages']},
 atributos:{title:'Atributos',module:'productos',resource:'product_options',resources:['product_options','product_option_values','product_features','product_feature_values','products','combinations','languages']}
});
export const DIRECTORY_FIELDS=Object.freeze({
 customers:['id','id_default_group','id_lang','id_gender','firstname','lastname','email','birthday','newsletter','optin','website','company','siret','ape','outstanding_allow_amount','show_public_prices','id_risk','max_payment_days','active','is_guest','deleted','date_add','date_upd','id_shop','id_shop_group'],
 addresses:['id','id_customer','id_supplier','id_manufacturer','id_country','id_state','alias','company','lastname','firstname','address1','address2','postcode','city','other','phone','phone_mobile','vat_number','dni','date_add','date_upd','deleted'],
 suppliers:['id','name','active','description','meta_title','meta_description','meta_keywords','date_add','date_upd'],
 manufacturers:['id','name','active','description','short_description','meta_title','meta_description','meta_keywords','date_add','date_upd'],
 product_options:['id','name','public_name','group_type','position'],product_option_values:['id','id_attribute_group','name','color','position'],
 product_features:['id','name','position'],product_feature_values:['id','id_feature','value','custom'],
 products:['id','name','reference','id_manufacturer','id_supplier','id_default_image','wholesale_price','price','active','associations'],
 combinations:['id','id_product','reference','wholesale_price','price','associations'],
 product_suppliers:['id','id_product','id_product_attribute','id_supplier','id_currency','product_supplier_reference','product_supplier_price_te'],
 orders:['id','reference','id_customer','id_currency','valid','payment','module','date_add','total_paid_tax_incl','total_paid_tax_excl','total_shipping_tax_excl','total_wrapping_tax_excl','current_state'],
 order_details:['id','id_order','product_id','product_attribute_id','product_name','product_reference','product_quantity','purchase_supplier_price','original_wholesale_price','total_price_tax_incl','total_price_tax_excl'],
 currencies:['id','iso_code','name'],countries:['id','iso_code','name','active'],states:['id','id_country','name','iso_code','active'],groups:['id','name','price_display_method'],languages:['id','iso_code','name','active']
});
const readonly=new Set(['id','date_add','date_upd','id_shop','id_shop_group','deleted','associations']);
export const DIRECTORY_WRITABLE=Object.freeze(Object.fromEntries(['customers','addresses','suppliers','manufacturers','product_options','product_option_values','product_features','product_feature_values'].map(resource=>[resource,DIRECTORY_FIELDS[resource].filter(f=>!readonly.has(f))])));
const id=/^[1-9]\d{0,14}$/,uuid=/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const flag=new Set(['active','newsletter','optin','is_guest','show_public_prices','custom']);
// Native limits from PrestaShop 1.7.8.11 Customer/Address definitions.
const nativeLimits={suppliers:{name:64,meta_title:255,meta_description:512,meta_keywords:255},manufacturers:{name:64,meta_title:255,meta_description:512},product_options:{name:128,public_name:64},product_option_values:{name:128},product_features:{name:128},product_feature_values:{value:255},customers:{firstname:255,lastname:255,email:255},addresses:{alias:32,company:255,firstname:255,lastname:255,address1:128,address2:128,postcode:12,city:64,other:300,phone:32,phone_mobile:32,dni:16}};
export const DIRECTORY_LOCALIZED=new Set(['description','short_description','meta_title','meta_description','meta_keywords','public_name','value']);
export const directoryLocalized=(resource,field)=>DIRECTORY_LOCALIZED.has(field)||(field==='name'&&['product_options','product_option_values','product_features'].includes(resource));
export function directoryQuery(input){
 if(input?.action!=='prestashop_directory_read')throw Error('Acción de lectura no válida.');
 if(!input||!DIRECTORY_KINDS[input.kind]||!['hortimatic','newoldsmok'].includes(input.store)||!DIRECTORY_KINDS[input.kind].resources.includes(input.resource))throw Error('Directorio o recurso no permitido.');
 if(!uuid.test(input.id||'')||!uuid.test(input.call_id||'')||!Number.isSafeInteger(input.revision)||input.revision<1)throw Error('Identidad de conexión no válida.');
 if(!Number.isSafeInteger(input.page)||input.page<0||input.page>1000||!Number.isSafeInteger(input.page_size)||input.page_size<1||input.page_size>100)throw Error('Paginación de directorio no válida.');
 const allowed=new Set(['action','kind','store','id','call_id','revision','resource','page','page_size','record_id','customer_ids','order_ids','product_ids','supplier_id','manufacturer_id','supplier_ids','manufacturer_ids','country_id']);
 if(Object.keys(input).some(k=>!allowed.has(k)))throw Error('Campos de lectura no admitidos.');
 const out={...input};
 if(input.record_id!==undefined&&!id.test(String(input.record_id)))throw Error('Registro no válido.');
 for(const [key,resources,max]of [['customer_ids',['orders','addresses'],25],['order_ids',['order_details'],25],['product_ids',['products','combinations','product_suppliers'],100],['supplier_ids',['addresses','products','product_suppliers'],25],['manufacturer_ids',['addresses','products'],25]])if(input[key]!==undefined){const values=input[key];if(!resources.includes(input.resource)||!Array.isArray(values)||!values.length||values.length>max||values.some(v=>!id.test(String(v)))||new Set(values.map(String)).size!==values.length)throw Error('Selección de '+key+' no válida.');out[key]=values.map(String);}
 for(const [key,resource]of [['supplier_id','suppliers'],['manufacturer_id','manufacturers']])if(input[key]!==undefined&&(!['addresses','products','product_suppliers'].includes(input.resource)||!id.test(String(input[key]))||input.kind!==(resource==='suppliers'?'proveedores':'marcas')))throw Error('Relación de directorio no válida.');
 if(input.supplier_ids!==undefined&&(input.kind!=='proveedores'||input.supplier_id!==undefined)||input.manufacturer_ids!==undefined&&(input.kind!=='marcas'||input.manufacturer_id!==undefined))throw Error('Titulares de directorio no válidos.');
 if(input.country_id!==undefined&&(input.resource!=='states'||!id.test(String(input.country_id))))throw Error('País de provincia no válido.');
 if(input.customer_ids!==undefined&&input.kind!=='clientes'||input.order_ids!==undefined&&input.kind!=='clientes')throw Error('El directorio no permite consultar clientes o pedidos.');
 if(input.resource==='addresses'&&(input.kind==='clientes'&&!input.customer_ids||input.kind==='proveedores'&&!input.supplier_id&&!input.supplier_ids||input.kind==='marcas'&&!input.manufacturer_id&&!input.manufacturer_ids))throw Error('Selecciona el titular de la dirección.');
 if(input.resource==='orders'&&!input.customer_ids||input.resource==='order_details'&&!input.order_ids)throw Error('Selecciona los clientes o pedidos de la consulta.');
 return out;
}
export function directoryMutation(input){
 if(!['prestashop_directory_prepare','prestashop_directory_commit'].includes(input?.action))throw Error('Acción de escritura no válida.');
 const k=DIRECTORY_KINDS[input?.kind],resource=input?.resource;
 if(!k||!['hortimatic','newoldsmok'].includes(input.store)||!k.resources.includes(resource)||!DIRECTORY_WRITABLE[resource])throw Error('Directorio de escritura no permitido.');
 if(!uuid.test(input.id||'')||!uuid.test(input.call_id||'')||!uuid.test(input.request_id||'')||!Number.isSafeInteger(input.revision)||input.revision<1)throw Error('Solicitud sin identidad válida.');
 if(!['create','update','delete'].includes(input.operation)||input.operation!=='create'&&!id.test(String(input.record_id||''))||input.operation==='create'&&input.record_id!==undefined)throw Error('Operación o registro no válido.');
 const allowed=new Set(['action','kind','store','id','call_id','revision','resource','operation','record_id','request_id','fields','fingerprint','confirmed']);
 if(Object.keys(input).some(key=>!allowed.has(key))||!input.fields||typeof input.fields!=='object'||Array.isArray(input.fields)||Object.keys(input.fields).length>40)throw Error('Campos no admitidos.');
 const fields={};
 for(const [field,raw]of Object.entries(input.fields)){
  if(!DIRECTORY_WRITABLE[resource].includes(field)||typeof raw!=='string'||raw.length>100000||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(raw))throw Error('Campo no editable: '+field);
  const value=raw.trim();if(nativeLimits[resource]?.[field]&&Array.from(value).length>nativeLimits[resource][field])throw Error('El campo '+field+' supera el tamaño permitido por PrestaShop.');
  if(flag.has(field)&&!['0','1'].includes(value))throw Error('Indicador no válido: '+field);
  if(field.startsWith('id_')&&!/^(0|[1-9]\d{0,14})$/.test(value))throw Error('Relación no válida: '+field);
  if(['firstname','lastname','name','public_name','value','address1','city','alias'].includes(field)&&(!value||/[<>={}]/.test(value)))throw Error('Texto no válido: '+field);
  if(field==='name'&&['manufacturers','suppliers'].includes(resource)&&/[;#]/.test(value))throw Error('Nombre de catálogo no válido.');
  if(field==='email'&&!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value))throw Error('Email no válido.');
  if(field==='website'&&value&&!/^https?:\/\/[^\s<>]+$/i.test(value))throw Error('Web no válida.');
  if(field==='group_type'&&!['select','radio','color'].includes(value))throw Error('Tipo de atributo no válido.');
  if(field==='color'&&value&&!/^#[a-f\d]{6}$/i.test(value))throw Error('Color no válido.');
  if(['position','max_payment_days'].includes(field)&&!/^\d{1,7}$/.test(value))throw Error('Número no válido.');
  if(field==='outstanding_allow_amount'&&!/^\d{1,10}(\.\d{1,6})?$/.test(value))throw Error('Importe no válido.');
  if(field==='birthday'&&value&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value))throw Error('Fecha no válida.');fields[field]=value;
 }
 if(resource==='addresses')for(const [kind,field]of [['clientes','id_customer'],['proveedores','id_supplier'],['marcas','id_manufacturer']])if(kind!==input.kind&&Number(fields[field]||0)!==0)throw Error('Una dirección no puede trasladarse a otro directorio.');
 if(resource==='addresses'&&input.operation==='create'&&!id.test(fields[{clientes:'id_customer',proveedores:'id_supplier',marcas:'id_manufacturer'}[input.kind]]||''))throw Error('Selecciona el titular de la dirección.');
 if(input.operation==='delete'&&Object.keys(fields).length)throw Error('Una eliminación no admite cambios de campos.');
 if(input.operation!=='delete'&&!Object.keys(fields).length)throw Error('No hay campos para guardar.');
 if(input.operation==='create')for(const field of ({customers:['firstname','lastname','email'],addresses:['firstname','lastname','address1','city','alias','id_country'],suppliers:['name'],manufacturers:['name'],product_options:['name','public_name','group_type'],product_option_values:['name','id_attribute_group'],product_features:['name'],product_feature_values:['value','id_feature']}[resource]))if(!fields[field]||field.startsWith('id_')&&fields[field]==='0')throw Error('Falta '+field+'.');
 if(input.action==='prestashop_directory_commit'&&(input.confirmed!==true||!/^[a-f\d]{64}$/.test(input.fingerprint||'')))throw Error('Revisa los cambios antes de publicar.');
 return {...input,fields};
}
export function directoryRows(payload,resource,pageSize){
 const raw=Array.isArray(payload)&&!payload.length?[]:payload?.[resource];if(!Array.isArray(raw)||raw.length>pageSize)throw Error('Listado de directorio incompleto.');
 const seen=new Set(),fields=DIRECTORY_FIELDS[resource];
 return raw.map(row=>{if(!row||!id.test(String(row.id))||seen.has(String(row.id)))throw Error('ID de directorio ausente o repetido.');seen.add(String(row.id));const clean={};
  for(const field of fields){if(row[field]===undefined)continue;const value=row[field];if(field==='associations'){
    clean.associations={};for(const key of ['combinations','product_option_values','product_features','categories','images'])if(Array.isArray(value?.[key]))clean.associations[key]=value[key].map(v=>{if(!id.test(String(v?.id)))throw Error('Asociación no válida.');return {id:String(v.id),...(v.id_feature_value&&id.test(String(v.id_feature_value))?{id_feature_value:String(v.id_feature_value)}:{})};});
   }else if(Array.isArray(value)){clean[field]=value.map(v=>{if(!id.test(String(v.id))||typeof v.value!=='string')throw Error('Idioma no válido.');return {id:String(v.id),value:v.value};});}
   else if(value===null||['string','number','boolean'].includes(typeof value))clean[field]=value===null?null:String(value);else throw Error('Dato de directorio no válido.');
  }return clean;
 });
}
