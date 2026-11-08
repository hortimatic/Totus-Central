import {textValue,associationIds} from './productos-core.js';
import {csvCell} from './utils.js';
export const PRODUCT_COLUMNS=Object.freeze([
 ['image','Foto'],['name','Producto'],['id','ID'],['reference','Referencia'],['ean13','EAN'],['brand','Marca'],['supplier','Proveedor'],['category','Categoría'],['store','Tienda'],['cost','Coste aprox. sin IVA'],['price','Precio base sin IVA'],['gross','PVP base IVA España'],['margin','Margen aprox.'],['stock','Existencias'],['variants','Variaciones'],['active','Estado'],['weight','Peso (kg)'],['width','Anchura (cm)'],['height','Altura (cm)'],['depth','Profundidad (cm)'],['date_upd','Actualizado']
]);
export const DEFAULT_PRODUCT_COLUMNS=Object.freeze(['image','name','id','reference','ean13','brand','category','store','cost','gross','margin','stock','variants','active']);
const previousDefault=['image','id','reference','name','ean13','brand','category','store','cost','gross','margin','stock','variants','active'];
export function productColumns(value){const valid=new Set(PRODUCT_COLUMNS.map(c=>c[0]));if(Array.isArray(value)&&value.join('|')===previousDefault.join('|'))return [...DEFAULT_PRODUCT_COLUMNS];return Array.isArray(value)&&value.includes('name')?[...new Set(value.filter(k=>valid.has(k)))]:[...DEFAULT_PRODUCT_COLUMNS];}
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
