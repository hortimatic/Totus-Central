export const LIST_PAGE_SIZES=['20','50','100','all'];
export function listPage(rows,preferences={}){
 const size=LIST_PAGE_SIZES.includes(String(preferences.size))?String(preferences.size):'20';
 const pages=size==='all'?1:Math.max(1,Math.ceil(rows.length/Number(size)));
 const page=Math.max(0,Math.min(pages-1,Math.trunc(Number(preferences.page)||0)));
 const start=size==='all'?0:page*Number(size),end=size==='all'?rows.length:Math.min(rows.length,start+Number(size));
 return {size,page,pages,total:rows.length,start:rows.length?start+1:0,end,rows:rows.slice(start,end)};
}
export function productCategoryIds(product){return [...new Set([product.id_category_default,...(product.associations?.categories||[]).map(x=>typeof x==='object'?x.id:x)].filter(x=>/^\d+$/.test(String(x||''))).map(String))];}
export function catalogCategoryChoices(products,categories=[]){
 const names=new Map(categories.map(x=>[String(x.id),String(x.name||'Categoría #'+x.id)]));
 const ids=new Set([...products.flatMap(productCategoryIds),...categories.map(c=>String(c.id)).filter(id=>/^\d+$/.test(id))]);return [...ids].map(id=>[id,names.get(id)||'Categoría #'+id]).sort((a,b)=>a[1].localeCompare(b[1],'es'));
}
export function filterCatalogRows(rows,{query='',category='all',active='all'}={}){
 const needle=query.trim().toLocaleLowerCase('es');return rows.filter(p=>(!needle||[p.id,p.name,p.reference,p.ean13].some(v=>String(v||'').toLocaleLowerCase('es').includes(needle)))&&(category==='all'||productCategoryIds(p).includes(category))&&(active==='all'||String(p.active)===active));
}
