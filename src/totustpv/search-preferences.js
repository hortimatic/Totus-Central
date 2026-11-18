export const TPV_SEARCH_FIELDS=Object.freeze({reference:'Referencia',ean13:'EAN 13',upc:'UPC',isbn:'ISBN',name:'Nombre y atributos'});
export const DEFAULT_SEARCH_FIELDS=Object.freeze(['reference','ean13','upc','name']);
export function catalogueSearchFields(value=DEFAULT_SEARCH_FIELDS){
 if(!Array.isArray(value)||value.length<1||value.length>5||new Set(value).size!==value.length||value.some(key=>typeof key!=='string'||!Object.hasOwn(TPV_SEARCH_FIELDS,key)))throw Error('Selecciona al menos un criterio de búsqueda válido.');
 return Object.keys(TPV_SEARCH_FIELDS).filter(key=>value.includes(key));
}
export function searchPreferences(value){
 if(value===undefined||value===null)return {fields:[...DEFAULT_SEARCH_FIELDS],numericKeyboard:false,includeDisabledStock:false};
 if(typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['fields','numericKeyboard','includeDisabledStock'].includes(key))||['numericKeyboard','includeDisabledStock'].some(key=>value[key]!==undefined&&typeof value[key]!=='boolean'))throw Error('Revisa la configuración del buscador.');
 return {fields:catalogueSearchFields(value.fields),numericKeyboard:value.numericKeyboard===true,includeDisabledStock:value.includeDisabledStock===true};
}
export function searchPreferencesFromForm(fields){const values=typeof fields.getAll==='function'?fields.getAll('searchFields'):fields.get('searchFields');
 return searchPreferences({fields:Array.isArray(values)?values:values===undefined||values===null?[]:[values],numericKeyboard:fields.get('numericKeyboard')==='on',includeDisabledStock:fields.get('includeDisabledStock')==='on'});
}
export function searchPreferencesHtml(value){const options=Array.isArray(value?.fields)&&value.fields.length===0?{fields:[],numericKeyboard:value.numericKeyboard===true,includeDisabledStock:value.includeDisabledStock===true}:searchPreferences(value);return `<fieldset class="tpv-receipt-check-group"><legend>Buscar artículos</legend><p class="small muted">Elige los datos que se consultan en todo el catálogo de esta tienda.</p>${Object.entries(TPV_SEARCH_FIELDS).map(([key,label])=>`<label class="tpv-check"><input type="checkbox" name="searchFields" value="${key}" ${options.fields.includes(key)?'checked':''}> ${label}</label>`).join('')}<label class="tpv-check"><input type="checkbox" name="numericKeyboard" ${options.numericKeyboard?'checked':''}> Teclado numérico al buscar en móvil</label><label class="tpv-check"><input type="checkbox" name="includeDisabledStock" ${options.includeDisabledStock?'checked':''}> Buscar artículos deshabilitados al recibir mercancía</label><p class="small muted">Esta opción se aplica a la entrada de mercancía. No activa los artículos ni los muestra para vender.</p><p class="small muted">El teclado numérico facilita escanear o escribir códigos. Puedes seguir pegando texto; no cambia los datos del artículo.</p></fieldset>`;}
