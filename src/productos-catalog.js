import {textValue,associationIds} from './productos-core.js';
import {csvCell} from './utils.js';
export const PRODUCT_COLUMNS=Object.freeze([
 ['image','Foto'],['name','Producto'],['id','ID'],['reference','Ref.'],['ean13','EAN'],['brand','Marca'],['supplier','Proveedor'],['category','Categoría'],['store','Tienda'],['cost','Coste neto'],['costVat','Coste +IVA'],['costTotal','Coste total'],['price','PVP neto'],['gross','PVP final'],['margin','Margen %'],['marginTotal','Margen €'],['stock','Stock'],['variants','Variantes'],['active','Estado'],['weight','Peso'],['width','Ancho'],['height','Alto'],['depth','Fondo'],['date_add','Creado'],['creator','Autor'],['date_upd','Actualizado']
]);
export function productColumnHeading(key){
 const lines={cost:['Coste','sin IVA'],costVat:['Coste','con IVA'],costTotal:['Coste','IVA + RE'],price:['PVP','sin IVA'],gross:['PVP','con IVA'],margin:['Margen %','sin IVA'],marginTotal:['Margen €','IVA + RE'],weight:['Peso','kg'],width:['Anchura','cm'],height:['Altura','cm'],depth:['Profundidad','cm'],date_add:['Creado','fecha · hora'],creator:['Autor','de alta'],date_upd:['Actualizado','fecha · hora']};
 return lines[key]||[PRODUCT_COLUMNS.find(c=>c[0]===key)?.[1]||key,''];
}
export const DEFAULT_PRODUCT_COLUMNS=Object.freeze(['image','name','id','reference','ean13','brand','category','store','cost','costVat','costTotal','price','gross','marginTotal','margin','stock','variants','active']);
const recentDefault=['image','name','id','reference','ean13','brand','category','store','cost','gross','margin','stock','variants','active'];
const previousDefault=['image','id','reference','name','ean13','brand','category','store','cost','gross','margin','stock','variants','active'];
export function productColumns(value){const valid=new Set(PRODUCT_COLUMNS.map(c=>c[0]));if(Array.isArray(value)&&[previousDefault,recentDefault].some(v=>value.join('|')===v.join('|')))return [...DEFAULT_PRODUCT_COLUMNS];return Array.isArray(value)&&value.includes('name')?[...new Set(value.filter(k=>valid.has(k)))]:[...DEFAULT_PRODUCT_COLUMNS];}
export function catalogProductKey(product,fallbackStore='hortimatic'){
 return (product.__store||fallbackStore)+'|'+String(product.id);
}
export function productPhoto(item,store){
 const id=String(item?.id_default_image||associationIds(item,'images')[0]||'');
 return /^[1-9]\d{0,14}$/.test(id)?'https://'+(store==='newoldsmok'?'newoldsmok.com':'hortimatic.com')+'/'+id+'-home_default/product.jpg':null;
}
export function productWebUrl(item,store){
 const id=String(item?.id||'');
 if(!/^[1-9]\d{0,14}$/.test(id)||!['hortimatic','newoldsmok'].includes(store))return null;
 return 'https://'+(store==='newoldsmok'?'newoldsmok.com':'hortimatic.com')+'/index.php?controller=product&id_product='+id;
}
export function filterProductCatalog(rows,{query='',category='',brand='',active=''}={}){
 const q=query.trim().toLocaleLowerCase('es');
 const relation=(row,key,current,ids=[])=>{if(!current)return true;const [shop,id]=current.includes('|')?current.split('|'):[null,current];return (!shop||row.__store===shop)&&(String(row[key])===id||ids.includes(id));};
 return rows.filter(r=>(!q||[r.id,r.name,r.reference,r.ean13].map(textValue).join(' ').toLocaleLowerCase('es').includes(q))&&relation(r,'id_category_default',category,associationIds(r,'categories'))&&relation(r,'id_manufacturer',brand)&&(active===''||String(r.active)===active));
}
export function productCatalogCsv(rows,columns,value){
 const cell=csvCell;
 return '\uFEFF'+[columns.map(k=>cell(PRODUCT_COLUMNS.find(c=>c[0]===k)?.[1]||k)).join(';'),...rows.map(r=>columns.map(k=>cell(value(r,k))).join(';'))].join('\r\n');
}

export const PRODUCT_COLUMN_MIN_WIDTH=80;
export const PRODUCT_COLUMN_MAX_WIDTH=640;
export function productColumnDefaultWidth(key){return ({image:88,name:220,id:110,reference:170,ean13:140,brand:140,supplier:150,category:150,store:120,creator:150,date_add:170,date_upd:170,marginTotal:130,active:110,actions:250})[key]||112;}
export function productColumnWidths(value){const keys=new Set([...PRODUCT_COLUMNS.map(([k])=>k),'actions']);return value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).filter(([k,v])=>keys.has(k)&&Number.isFinite(v)&&v>=PRODUCT_COLUMN_MIN_WIDTH&&v<=PRODUCT_COLUMN_MAX_WIDTH).map(([k,v])=>[k,Math.round(v)])):{};}
export function moveProductColumn(columns,key,target){const next=productColumns(columns),index=next.indexOf(key);if(index<0||!Number.isInteger(target)||target<0||target>=next.length)return next;next.splice(index,1);next.splice(target,0,key);return next;}
