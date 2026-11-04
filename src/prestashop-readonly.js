// Read-only PrestaShop contracts. Store names are explicit: never infer a shop from a URL.
export const PRESTASHOP_STORES=Object.freeze([
 {key:'hortimatic',name:'Hortimatic',connectionName:'PrestaShop · Hortimatic'},
 {key:'newoldsmok',name:'NewOldSmok',connectionName:'PrestaShop · NewOldSmok'}
]);
export const PRESTASHOP_RESOURCES=Object.freeze({
 orders:Object.freeze(['id','reference','date_add','payment','total_paid_tax_incl','total_paid_tax_excl','current_state','valid','id_currency','id_customer','id_address_invoice','id_address_delivery','id_shop','invoice_number','invoice_date','total_shipping_tax_incl','total_discounts_tax_incl']),
 currencies:Object.freeze(['id','iso_code','name']),
 customers:Object.freeze(['id','firstname','lastname','email','company']),
 addresses:Object.freeze(['id','firstname','lastname','company','address1','address2','postcode','city','phone','phone_mobile','vat_number','dni']),
 products:Object.freeze(['id','reference','name','ean13','weight','active','date_add','date_upd','id_default_image']),
 order_details:Object.freeze(['id','id_order','product_id','product_attribute_id','product_name','product_reference','product_quantity','total_price_tax_incl','total_price_tax_excl','unit_price_tax_incl','unit_price_tax_excl','reduction_percent']),
 stock_availables:Object.freeze(['id','id_product','id_product_attribute','id_shop','quantity']),
 stock_movements:Object.freeze(['id','id_product','id_product_attribute','id_stock_mvt_reason','physical_quantity','sign','date_add','id_employee','id_order','id_supply_order'])
});
export function prestashopStore(key){const store=PRESTASHOP_STORES.find(s=>s.key===key);if(!store)throw Error('Tienda PrestaShop no admitida.');return store;}
export function storeConnection(connections,key){
 const expected=prestashopStore(key).connectionName;
 const found=(Array.isArray(connections)?connections:[]).filter(c=>c?.protocol==='prestashop'&&c?.name===expected);
 if(found.length!==1)return null;
 return found[0];
}
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
 if(['customers','addresses','currencies'].includes(input.resource)){if(!/^\d{1,15}$/.test(String(input.record_id||'')))throw Error('Selecciona un registro de detalle.');out.recordId=String(input.record_id);}else if(input.record_id!==undefined)throw Error('El recurso no admite registro de detalle.');
 if(input.order_id!==undefined){
  if(input.resource!=='order_details'||!/^\d{1,15}$/.test(String(input.order_id)))throw Error('Pedido de detalle no válido.');
  out.orderId=String(input.order_id);
 }else if(input.resource==='order_details')throw Error('Selecciona el pedido para leer sus líneas.');
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
 const values=payload?.[resource];
 if(!Array.isArray(values))throw Error('Respuesta PrestaShop no compatible con el recurso.');
 if(values.length>pageSize)throw Error('La API devolvió más filas de las solicitadas.');
 const fields=PRESTASHOP_RESOURCES[resource],seen=new Set();
 const rows=values.map(value=>{
  if(!value||typeof value!=='object'||Array.isArray(value)||value.id===undefined||value.id===null)throw Error('Fila PrestaShop sin identificador.');
  const id=String(value.id);if(!/^\d+$/.test(id)||seen.has(id))throw Error('Fila PrestaShop duplicada o sin ID válido.');seen.add(id);
  return Object.fromEntries(fields.map(k=>[k,scalar(value[k])]));
 });
 return {rows,possibly_more:rows.length===pageSize};
}
