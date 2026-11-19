import {textValue,associationIds} from '../productos-core.js';
import {catalogueSearchFields} from './search-preferences.js';
import {catalogueFilters} from './catalogue-preferences.js';
/** Search Central's imported products; only native cached rows carry sale previews.
 * Missing prices/stock remain missing. Base catalogue prices are never payable.
 */
export function offlineCatalogueSearch(source,pages,query){
 if(!source?.productsComplete||!Array.isArray(source.products))throw Error('El catálogo de Productos aún no está completo.');
 const fields=catalogueSearchFields(query.searchFields),filters=catalogueFilters(query.catalogueFilters),page=query.page??0;
 if(!Number.isSafeInteger(page)||page<0)throw Error('Página de catálogo no válida.');
 const category=query.categoryId||0,parent=new Map((source.metadata?.categories||[]).map(row=>[Number(row.id),Number(row.id_parent)]));
 if((category||filters.excludedCategories.length)&&(!source.metadata?.categories||source.metadata.warnings?.includes('categories')))throw Error('Faltan categorías guardadas para aplicar este filtro sin conexión.');
 const belongs=(id,root)=>{const seen=new Set();while(id>0&&!seen.has(id)){if(id===root)return true;seen.add(id);id=parent.get(id);}return false;};
 const cached=new Map(),groups=new Map();
 for(const entry of [...pages].sort((a,b)=>a.savedAt-b.savedAt)){
  if(entry.data.pricingContext&&entry.data.pricingContext.quantity!==1)continue;
  for(const row of entry.data.items)cached.set(row.id,row);
  for(const group of entry.data.variantGroups||[])groups.set(group.id,group);
 }
 const byProduct=new Map();for(const row of cached.values()){const list=byProduct.get(row.nativeProductId)||[];list.push(row);byProduct.set(row.nativeProductId,list);}
 const term=String(query.search||'').trim().toLocaleLowerCase('es');let rows=[];
 for(const product of source.products){
  if(String(product.active)==='0')continue;
  const id=Number(product.id),categories=[Number(product.id_category_default),...associationIds(product,'categories').map(Number)];
  if(category&&!categories.some(value=>belongs(value,category))||filters.excludedCategories.some(root=>categories.some(value=>belongs(value,root))))continue;
  let candidates;
  if(query.productId){if(id!==query.productId)continue;candidates=(byProduct.get(id)||[]).filter(row=>!row.chooseVariant);}
  else{
   const variants=associationIds(product,'combinations').length>0;
   const saved=byProduct.get(id)||[],native=saved.find(row=>variants?row.chooseVariant:row.id===id+':0');
   // A parent only opens the variant picker; never borrow one variant's price
   // or stock as if it represented the whole product.
   const availableVariants=variants&&saved.some(row=>!row.chooseVariant&&!row.offlineUnavailable);
   candidates=[native||{id:id+':0',nativeProductId:id,name:textValue(product.name),reference:String(product.reference||''),barcode:String(product.ean13||''),stock:null,priceCents:null,netPriceCents:null,chooseVariant:variants,offlineUnavailable:!availableVariants,saleEnabled:true,minimumQty:1,variantAttributes:[]}];
  }
  for(const row of candidates){
   if(filters.hideUnavailable&&!(row.stock>0)&&!(row.chooseVariant&&(byProduct.get(id)||[]).some(variant=>!variant.chooseVariant&&variant.stock>0)))continue;
   if(term&&!fields.some(field=>String(({name:row.name,reference:row.reference,ean13:row.barcode,upc:row.upc,isbn:row.isbn})[field]||'').toLocaleLowerCase('es').includes(term)))continue;
   rows.push(structuredClone(row));
  }
 }
 const sort=query.sortField||'name',direction=query.sortDirection==='desc'?-1:1;
 if(!['name','reference','stock','price'].includes(sort))throw Error('Esta ordenación no está disponible sin conexión.');
 rows.sort((a,b)=>{const key=sort==='price'?'priceCents':sort,groupName=row=>row.variantAttributes?.filter(attribute=>attribute.groupId===query.variantGroupId).map(attribute=>attribute.name).join(' · ')||row.name,x=sort==='name'&&query.variantGroupId?groupName(a):a[key],y=sort==='name'&&query.variantGroupId?groupName(b):b[key];if(x==null||y==null)return x==null&&y==null?a.id.localeCompare(b.id):x==null?1:-1;const cmp=typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),'es',{numeric:true});return direction*cmp||a.id.localeCompare(b.id);});
 const totalCount=rows.length,items=rows.slice(page*20,(page+1)*20);
 Object.defineProperties(items,{hasMore:{value:(page+1)*20<totalCount},page:{value:page},totalCount:{value:totalCount},variantGroups:{value:[...groups.values()]},variantGroupId:{value:query.variantGroupId||0},offlineCached:{value:true},cachedAt:{value:source.readAt},offlineCoveragePartial:{value:true}});
 return items;
}
