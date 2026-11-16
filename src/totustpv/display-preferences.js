export const TPV_DISPLAY_DEFAULTS=Object.freeze({showPrices:true,showStock:true,showReferences:true,beepOnAdd:false,ticketNewestFirst:false});
export const TPV_DISPLAY_LABELS=Object.freeze({showPrices:'Mostrar precios en las tarjetas de artículos',showStock:'Mostrar existencias en las tarjetas de artículos',
 showReferences:'Mostrar referencias en las tarjetas de artículos',beepOnAdd:'Sonido al añadir un artículo al ticket',ticketNewestFirst:'Mostrar primero el último artículo añadido al ticket'});
export function displayPreferences(value){return Object.fromEntries(Object.entries(TPV_DISPLAY_DEFAULTS).map(([key,fallback])=>[key,typeof value?.[key]==='boolean'?value[key]:fallback]));}
export function displayPreferencesHtml(value){const options=displayPreferences(value);return Object.entries(TPV_DISPLAY_LABELS).map(([key,label])=>
 `<label class="tpv-check"><input type="checkbox" name="${key}" ${options[key]?'checked':''}> ${label}</label>`).join('');}
