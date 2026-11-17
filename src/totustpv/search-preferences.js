export const TPV_SEARCH_FIELDS=Object.freeze({reference:'Referencia',ean13:'EAN 13',upc:'UPC',isbn:'ISBN',name:'Nombre y atributos'});
export const DEFAULT_SEARCH_FIELDS=Object.freeze(['reference','ean13','upc','name']);
export function catalogueSearchFields(value=DEFAULT_SEARCH_FIELDS){
 if(!Array.isArray(value)||value.length<1||value.length>5||new Set(value).size!==value.length||value.some(key=>typeof key!=='string'||!Object.hasOwn(TPV_SEARCH_FIELDS,key)))throw Error('Selecciona al menos un criterio de búsqueda válido.');
 return Object.keys(TPV_SEARCH_FIELDS).filter(key=>value.includes(key));
}
export function searchPreferences(value){
 if(value===undefined||value===null)return {fields:[...DEFAULT_SEARCH_FIELDS],numericKeyboard:false};
 if(typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['fields','numericKeyboard'].includes(key))||value.numericKeyboard!==undefined&&typeof value.numericKeyboard!=='boolean')throw Error('Revisa la configuración del buscador.');
 return {fields:catalogueSearchFields(value.fields),numericKeyboard:value.numericKeyboard===true};
}
export function searchPreferencesFromForm(fields){const values=typeof fields.getAll==='function'?fields.getAll('searchFields'):fields.get('searchFields');
 return searchPreferences({fields:Array.isArray(values)?values:values===undefined||values===null?[]:[values],numericKeyboard:fields.get('numericKeyboard')==='on'});
}
export function searchPreferencesHtml(value){const options=Array.isArray(value?.fields)&&value.fields.length===0?{fields:[],numericKeyboard:value.numericKeyboard===true}:searchPreferences(value);return `<fieldset class="tpv-receipt-check-group"><legend>Buscar artículos</legend><p class="small muted">Elige los datos que se consultan en todo el catálogo de esta tienda.</p>${Object.entries(TPV_SEARCH_FIELDS).map(([key,label])=>`<label class="tpv-check"><input type="checkbox" name="searchFields" value="${key}" ${options.fields.includes(key)?'checked':''}> ${label}</label>`).join('')}<label class="tpv-check"><input type="checkbox" name="numericKeyboard" ${options.numericKeyboard?'checked':''}> Teclado numérico al buscar en móvil</label><p class="small muted">El teclado numérico facilita escanear o escribir códigos. Puedes seguir pegando texto; no cambia los datos del artículo.</p></fieldset>`;}
