// PrestaShop 1.7.8.11 only. Shared, deliberately small read-only contract. Nothing executes SQL.
export const PRESTASHOP_VERSION='1.7.8.11';
export const PRESTASHOP_STORES=Object.freeze([
 {id:'hortimatic',label:'Hortimatic',location:'Azuqueca',drawers:'Vape y Head',connectionName:'PrestaShop · Hortimatic'},
 {id:'newoldsmok',label:'NewOldSmok',location:'Alcalá',drawers:'Caja de Alcalá',connectionName:'PrestaShop · NewOldSmok'}
]);
export const PRESTASHOP_RESOURCES=Object.freeze({
 stock_availables:{label:'Existencias disponibles',field:'stock_availables'},
 stock_movements:{label:'Movimientos de stock',field:'stock_movements'}
});
export function prestashopStore(id){const store=PRESTASHOP_STORES.find(s=>s.id===id);if(!store)throw Error('Tienda de PrestaShop no admitida.');return store;}
export function linkedPrestashop(connections,storeId){
 const store=prestashopStore(storeId),rows=(Array.isArray(connections)?connections:[]).filter(c=>c.protocol==='prestashop'&&c.name===store.connectionName);
 return {connection:rows.length===1?rows[0]:null,ambiguous:rows.length>1};
}
export function prestashopPage(input={}){
 const offset=input.offset??0,limit=input.limit??50;
 if(!Number.isSafeInteger(offset)||offset<0||offset>1000000||!Number.isSafeInteger(limit)||limit<1||limit>100)throw Error('Paginación de PrestaShop no válida.');
 return {offset,limit};
}
export function prestashopReadUrl(connection,input={}){
 if(typeof input.resource!=='string'||!Object.prototype.hasOwnProperty.call(PRESTASHOP_RESOURCES,input.resource))throw Error('Recurso PrestaShop no permitido.');
 const {offset,limit}=prestashopPage(input),url=new URL(connection.endpoint);
 if(!url.pathname.match(/\/api\/?$/i)||url.search||url.hash||url.username||url.password)throw Error('Configura la URL HTTPS de la raíz /api del PrestaShop.');
 url.pathname=url.pathname.replace(/\/$/,'')+'/'+input.resource;
 url.searchParams.set('output_format','JSON');url.searchParams.set('display','full');url.searchParams.set('sort','[id_ASC]');url.searchParams.set('limit',offset+','+limit);
 return url.href;
}
const field=(o,key,size=160)=>{const value=o?.[key];if(value===null||value===undefined||typeof value==='object')return null;return String(value).slice(0,size);};
export function prestashopRows(resource,data){
 if(typeof resource!=='string'||!Object.prototype.hasOwnProperty.call(PRESTASHOP_RESOURCES,resource))throw Error('Recurso PrestaShop no permitido.');const key=PRESTASHOP_RESOURCES[resource].field;
 const raw=data?.[key];if(raw===undefined)throw Error('El PrestaShop no ha devuelto el recurso solicitado.');if(!Array.isArray(raw))throw Error('El PrestaShop devolvió filas con un formato inesperado.');
 if(raw.length>100)throw Error('Respuesta del PrestaShop mayor que la página permitida.');
 const keys=resource==='stock_availables'?['id','id_product','id_product_attribute','id_shop','id_shop_group','quantity','depends_on_stock','out_of_stock','location']:['id','id_product','id_product_attribute','id_employee','id_stock_mvt_reason','id_order','id_supply_order','physical_quantity','sign','date_add','reference'];
 const seen=new Set();return raw.map(row=>{if(!row||typeof row!=='object'||Array.isArray(row))throw Error('Fila de PrestaShop no válida.');const id=field(row,'id');if(!id||!/^\d+$/.test(id)||seen.has(id))throw Error('Identificador PrestaShop ausente, no numérico o duplicado.');seen.add(id);return Object.fromEntries(keys.map(k=>[k,field(row,k)]));});
}
