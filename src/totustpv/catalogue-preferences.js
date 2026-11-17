const need=(ok,message)=>{if(!ok)throw Error(message);};
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function cataloguePreferences(value){
 if(value===undefined||value===null)return {hideUnavailable:false,excludedCategories:[],extraDetails:false};
 need(typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>['hideUnavailable','excludedCategories','extraDetails'].includes(key)),'Revisa la visibilidad del catálogo.');
 for(const key of ['hideUnavailable','extraDetails'])need(value[key]===undefined||typeof value[key]==='boolean','Revisa la visibilidad del catálogo.');
 const ids=value.excludedCategories??[];need(Array.isArray(ids)&&ids.length<=100&&ids.every(id=>Number.isSafeInteger(id)&&id>0&&id<=2147483647)&&new Set(ids).size===ids.length,'Selecciona hasta cien categorías válidas, sin duplicados.');
 return {hideUnavailable:value.hideUnavailable===true,excludedCategories:[...ids].sort((a,b)=>a-b),extraDetails:value.extraDetails===true};
}
export function cataloguePreferencesFromForm(fields){let ids=typeof fields.getAll==='function'?fields.getAll('excludedCategories'):fields.get('excludedCategories');ids=Array.isArray(ids)?ids:ids===undefined||ids===null?[]:[ids];
 return cataloguePreferences({hideUnavailable:fields.get('hideUnavailable')==='on',extraDetails:fields.get('extraDetails')==='on',excludedCategories:ids.map(id=>/^[1-9][0-9]{0,9}$/.test(String(id))?Number(id):NaN)});
}
export function catalogueFilters(value){need(value===undefined||value===null||Object.keys(value).every(key=>['hideUnavailable','excludedCategories'].includes(key)),'Revisa los filtros del catálogo.');
 const options=cataloguePreferences(value);return {hideUnavailable:options.hideUnavailable,excludedCategories:options.excludedCategories};}
export function visibleCatalogueCategories(rows,excluded){const hidden=new Set(excluded),parents=new Map(rows.map(row=>[row.id,row.parentId])),bounds=row=>Number.isSafeInteger(row.treeLeft)&&Number.isSafeInteger(row.treeRight)&&row.treeLeft>0&&row.treeRight>row.treeLeft,
 ranges=rows.filter(row=>hidden.has(row.id)&&bounds(row));
 return rows.filter(row=>{if(bounds(row)&&ranges.some(root=>row.treeLeft>=root.treeLeft&&row.treeRight<=root.treeRight))return false;
  let id=row.id;const visited=new Set();while(id&&parents.has(id)&&!visited.has(id)){if(hidden.has(id))return false;visited.add(id);id=parents.get(id);}return !hidden.has(id);});
}
export function cataloguePreferencesHtml(value,categories){const options=cataloguePreferences(value);return `<fieldset class="tpv-receipt-check-group"><legend>Visibilidad del catálogo de venta</legend>
 <label class="tpv-check"><input type="checkbox" name="hideUnavailable" ${options.hideUnavailable?'checked':''}> Ocultar artículos y variantes agotados</label>
 <label>Categorías que no se muestran<select name="excludedCategories" multiple aria-label="Categorías que no se muestran">${categories.map(row=>`<option value="${row.id}" ${options.excludedCategories.includes(row.id)?'selected':''}>${esc(row.label||row.name)}</option>`).join('')}</select></label>
 <p class="small muted">Se ocultan también las subcategorías. En la entrada de mercancía no se aplican estos filtros, para poder reponer agotados. Estas opciones no cambian permisos ni existencias.</p>
 <label class="tpv-check"><input type="checkbox" name="extraDetails" ${options.extraDetails?'checked':''}> Mostrar marca, proveedor y códigos en las tarjetas</label></fieldset>`;}
export function catalogueDetails(product){return [['Marca',product.manufacturer],['Proveedor',product.supplier],['EAN',product.barcode],['UPC',product.upc],['ISBN',product.isbn]].filter(([,value])=>typeof value==='string'&&value.trim()).map(([label,value])=>label+': '+value.trim()).join(' · ');}
export function variantDetails(product){return product.chooseVariant||!Array.isArray(product.variantAttributes)?'':product.variantAttributes.filter(row=>typeof row?.name==='string'&&row.name.trim()).map(row=>(typeof row.groupName==='string'&&row.groupName.trim()?row.groupName.trim()+': ':'')+row.name.trim()).join(' · ');}
