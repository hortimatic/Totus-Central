// Read-only contracts. Server identity is bound to a registered connection.
import {WEBSITE_CHOICES as PRESTASHOP_STORES,connectionWebsite} from './website-registry.js';
export {PRESTASHOP_STORES};
export const PRESTASHOP_RESOURCES=Object.freeze({
 orders:Object.freeze(['id','reference','date_add','payment','total_paid_tax_incl','total_paid_tax_excl','current_state','valid','id_currency','id_customer','id_address_invoice','id_address_delivery','id_shop','invoice_number','invoice_date','total_shipping_tax_incl','total_shipping_tax_excl','total_wrapping_tax_excl','total_discounts_tax_incl','total_discounts_tax_excl','module']),
 order_states:Object.freeze(['id','name']),
 order_histories:Object.freeze(['id','id_order','id_employee','id_order_state','date_add']),
 employees:Object.freeze(['id','firstname','lastname']),
 taxes:Object.freeze(['id','rate','name','active']),
 tax_rules:Object.freeze(['id','id_tax_rules_group','id_country','id_state','zipcode_from','zipcode_to','id_tax','behavior']),
 countries:Object.freeze(['id','iso_code','name','active']),
 currencies:Object.freeze(['id','iso_code','name']),
 languages:Object.freeze(['id','name','iso_code','active']),
 product_suppliers:Object.freeze(['id','id_product','id_product_attribute','id_supplier','id_currency','product_supplier_reference','product_supplier_price_te']),
 specific_prices:Object.freeze(['id','id_product','id_product_attribute','id_shop','id_shop_group','id_currency','id_country','id_group','id_customer','id_cart','price','from_quantity','reduction','reduction_tax','reduction_type','from','to']),
 customers:Object.freeze(['id','firstname','lastname','email','company']),
 addresses:Object.freeze(['id','firstname','lastname','company','address1','address2','postcode','city','phone','phone_mobile','vat_number','dni']),
 products:Object.freeze(['id','reference','name','ean13','weight','width','height','depth','active','available_for_order','visibility','redirect_type','id_type_redirected','date_add','date_upd','id_default_image','id_default_combination','id_shop_default','id_category_default','id_manufacturer','id_supplier','id_tax_rules_group','wholesale_price','price','ecotax','associations']),
 combinations:Object.freeze(['id','id_product','reference','ean13','price','weight','default_on','associations']),
 categories:Object.freeze(['id','name','active','id_parent']),
 manufacturers:Object.freeze(['id','name','active']),
 suppliers:Object.freeze(['id','name','active']),
 product_features:Object.freeze(['id','name','position']),
 product_feature_values:Object.freeze(['id','id_feature','custom','value']),
 tags:Object.freeze(['id','id_lang','name']),
 tax_rule_groups:Object.freeze(['id','name','active','deleted']),
 totus_product_images:Object.freeze(['id','id_product','position','cover','legend']),
 image_types:Object.freeze(['id','name','width','height','products']),
 product_options:Object.freeze(['id','name','public_name','group_type','position']),
 product_option_values:Object.freeze(['id','id_attribute_group','name','color','position']),
 order_details:Object.freeze(['id','id_order','product_id','product_attribute_id','product_name','product_reference','product_quantity','total_price_tax_incl','total_price_tax_excl','unit_price_tax_incl','unit_price_tax_excl','reduction_percent','purchase_supplier_price','original_wholesale_price','associations']),
 stock_availables:Object.freeze(['id','id_product','id_product_attribute','id_shop','quantity','out_of_stock','depends_on_stock','location']),
 stock_movements:Object.freeze(['id','id_stock','id_stock_mvt_reason','physical_quantity','sign','date_add','id_employee','employee_firstname','employee_lastname','id_order','id_supply_order','price_te']),
 stock_movement_reasons:Object.freeze(['id','name','sign'])
});
export function prestashopStore(key,registry=null){if(registry)return registry.get(key);const store=PRESTASHOP_STORES.find(s=>s.key===key);if(!store)throw Error('Tienda PrestaShop no admitida.');return store;}
export function storeConnection(connections,key,registry=null){
 if(registry)return registry.connection(key,connections);
 const bound=(Array.isArray(connections)?connections:[]).filter(c=>c?.protocol==='prestashop'&&c.store_key===key);
 if((Array.isArray(connections)?connections:[]).some(c=>c?.store_key))return bound.length===1?bound[0]:null;
 const expected=PRESTASHOP_STORES.find(site=>site.key===key)?.connectionName;
 if(!expected)return null;
 const found=(Array.isArray(connections)?connections:[]).filter(c=>c?.protocol==='prestashop'&&c?.name===expected);
 if(found.length!==1)return null;
 return found[0];
}
export function prestashopConnectionStore(connection,key){return connection?.store_key?connectionWebsite(connection,key):prestashopStore(key);}
export function prestashopPage(resource,page=0,pageSize=25){
 const fields=PRESTASHOP_RESOURCES[resource];
 if(!fields)throw Error('Recurso PrestaShop no permitido.');
 if(!Number.isSafeInteger(page)||page<0||page>1000||!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>100)throw Error('Paginación PrestaShop no válida.');
 return {resource,fields,offset:page*pageSize,page,pageSize};
}
// Strict request contract shared by UI and service. No arbitrary fields, URLs or SQL.
export function prestashopQuery(input){
 const page=prestashopPage(input.resource,input.page,input.page_size),out={...page};
 if(input.sort!==undefined&&!['oldest','newest'].includes(input.sort))throw Error('Orden de lectura no válido.');
 out.sort=input.sort||'oldest';
 if(input.from!==undefined||input.to!==undefined){
  if(!['orders','stock_movements'].includes(input.resource))throw Error('El recurso no admite periodo.');
  const valid=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)&&!isNaN(Date.parse(s.replace(' ','T')+'Z'))&&new Date(s.replace(' ','T')+'Z').toISOString().slice(0,19).replace('T',' ')===s;
  if(!valid(input.from)||!valid(input.to)||input.to<input.from)throw Error('Revisa el periodo de consulta.');
  out.from=input.from;out.to=input.to;
 }
 if(['customers','addresses','currencies','taxes','order_states','employees'].includes(input.resource)&&!(input.resource==='currencies'&&input.record_id===undefined)){if(!/^\d{1,15}$/.test(String(input.record_id||'')))throw Error('Selecciona un registro de detalle.');out.recordId=String(input.record_id);}else if(input.record_id!==undefined)throw Error('El recurso no admite registro de detalle.');
 const ids=(value,max)=>{if(!Array.isArray(value)||!value.length||value.length>max||value.some(id=>!/^\d{1,15}$/.test(String(id)))||new Set(value.map(String)).size!==value.length)throw Error('Selección de registros no válida.');return value.map(String);};
 if(input.product_ids!==undefined){if(!['products','stock_availables','product_suppliers','specific_prices'].includes(input.resource))throw Error('La selección no corresponde al recurso.');out.productIds=ids(input.product_ids,100);}
 if(input.stock_ids!==undefined){if(input.resource!=='stock_movements')throw Error('La selección de existencias solo admite movimientos.');out.stockIds=ids(input.stock_ids,100);if(out.stockIds.some(id=>!/^[1-9]\d{0,14}$/.test(id)))throw Error('Los movimientos requieren registros reales de existencias.');}
 if(input.search!==undefined||input.search_field!==undefined){
  if(input.resource!=='products'||!['name','reference','ean13'].includes(input.search_field)||typeof input.search!=='string'||!input.search.trim()||input.search.length>96||/[\[\]|%,\\\x00-\x1f]/.test(input.search)||input.references!==undefined||input.product_ids!==undefined)throw Error('Búsqueda de producto no válida.');
  out.search=input.search.trim();out.searchField=input.search_field;
 }
 if(input.references!==undefined){
  const refs=input.references;
  if(!['products','combinations'].includes(input.resource)||input.product_ids!==undefined||!Array.isArray(refs)||!refs.length||refs.length>35||refs.some(r=>typeof r!=='string'||!r.trim()||r.length>64||/[\[\]|%,\\\x00-\x1f]/.test(r))||new Set(refs).size!==refs.length)throw Error('Selecciona referencias exactas de producto, sin filtros especiales.');
  out.references=refs;
 }
 if(input.order_ids!==undefined){if(!['order_details','order_histories'].includes(input.resource)||input.order_id!==undefined)throw Error('La selección no corresponde al recurso.');out.orderIds=ids(input.order_ids,25);}
 if(input.order_id!==undefined){
  if(!['order_details','order_histories'].includes(input.resource)||!/^\d{1,15}$/.test(String(input.order_id)))throw Error('Pedido de detalle no válido.');
  out.orderId=String(input.order_id);
 }else if(['order_details','order_histories'].includes(input.resource)&&!out.orderIds)throw Error('Selecciona el pedido para leer sus líneas o historial.');
 return out;
}
const scalar=value=>{
 if(value==null)return null;
 if(typeof value==='object'){
  const languages=Array.isArray(value)?value:Array.isArray(value.language)?value.language:[];
  return languages.map(x=>typeof x==='object'?x.value??'':x).filter(x=>typeof x==='string').join(' · ').slice(0,1000);
 }
 return String(value).slice(0,2000);
};
export function prestashopRows(payload,resource,pageSize){
 if(!PRESTASHOP_RESOURCES[resource])throw Error('Recurso no permitido.');
 // PrestaShop 1.7 serializes an empty resource collection as the root [].
 // Do not treat missing objects, error envelopes or non-empty root arrays as empty.
 const values=Array.isArray(payload)&&payload.length===0?[]:payload?.[resource];
 if(!Array.isArray(values))throw Error('Respuesta PrestaShop no compatible con el recurso.');
 if(values.length>pageSize)throw Error('La API devolvió más filas de las solicitadas.');
 const fields=PRESTASHOP_RESOURCES[resource],seen=new Set();
 const rows=values.map(value=>{
  if(!value||typeof value!=='object'||Array.isArray(value)||value.id===undefined||value.id===null)throw Error('Fila PrestaShop sin identificador.');
  const id=String(value.id);if(!/^\d+$/.test(id)||seen.has(id))throw Error('Fila PrestaShop duplicada o sin ID válido.');seen.add(id);
  return Object.fromEntries(fields.map(k=>[k,k==='associations'?Object.fromEntries(['categories','images','product_option_values','taxes','combinations','product_features'].map(name=>{const list=value.associations?.[name];return [name,name==='product_features'?(Array.isArray(list)?list.filter(x=>/^[1-9]\d{0,14}$/.test(String(x?.id))&&/^[1-9]\d{0,14}$/.test(String(x?.id_feature_value))).map(x=>({id:String(x.id),id_feature_value:String(x.id_feature_value)})):[]):Array.isArray(list)?[...new Set(list.map(x=>String(x?.id||'')).filter(id=>/^\d{1,15}$/.test(id)))]:[]];})):scalar(value[k])]));
 });
 return {rows,possibly_more:rows.length===pageSize};
}

export function prestashopProductImage(store,imageId,registry=null){return /^\d+$/.test(String(imageId||''))&&String(imageId)!=='0'?prestashopStore(store,registry).origin+'/'+imageId+'-home_default/product.jpg':null;}
