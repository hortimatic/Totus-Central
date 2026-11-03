// Read-only PrestaShop contracts. Store names are explicit: never infer a shop from a URL.
export const PRESTASHOP_STORES=Object.freeze([
 {key:'hortimatic',name:'Hortimatic',connectionName:'PrestaShop · Hortimatic'},
 {key:'newoldsmok',name:'NewOldSmok',connectionName:'PrestaShop · NewOldSmok'}
]);
export const PRESTASHOP_RESOURCES=Object.freeze({
 orders:Object.freeze(['id','reference','date_add','payment','total_paid_tax_incl']),
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
export function prestashopRows(payload,resource,pageSize){
 if(!PRESTASHOP_RESOURCES[resource])throw Error('Recurso no permitido.');
 const values=payload?.[resource];
 if(!Array.isArray(values))throw Error('Respuesta PrestaShop no compatible con el recurso.');
 if(values.length>pageSize)throw Error('La API devolvió más filas de las solicitadas.');
 const fields=PRESTASHOP_RESOURCES[resource],seen=new Set();
 const rows=values.map(value=>{
  if(!value||typeof value!=='object'||Array.isArray(value)||value.id===undefined||value.id===null)throw Error('Fila PrestaShop sin identificador.');
  const id=String(value.id);if(!/^\d+$/.test(id)||seen.has(id))throw Error('Fila PrestaShop duplicada o sin ID válido.');seen.add(id);
  return Object.fromEntries(fields.map(k=>[k,value[k]===undefined||value[k]===null?null:String(value[k])]));
 });
 return {rows,possibly_more:rows.length===pageSize};
}
