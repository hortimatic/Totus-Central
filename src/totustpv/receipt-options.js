const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const RECEIPT_DEFAULTS=Object.freeze({title:'Justificante de compra',footer:'',fontFamily:'arial',fontSize:11,dateFormat:'native',showLogo:true,showAfterSale:false,printAfterSale:false,showOrderReference:true,numberLines:false,showCustomer:false,showCustomerPhone:false,showCustomerEmail:false,showAddressComment:false,showDeliveryAddress:false,showCustomerCompany:false,
 showReferences:true,showAddress:true,showPhone:true,showPayments:true,showDiscounts:true,showDate:true});
export const RECEIPT_CHECKS=Object.freeze({showLogo:'Logo del establecimiento',showAfterSale:'Mostrar justificante al confirmar',printAfterSale:'Imprimir justificante al confirmar',showOrderReference:'Referencia del pedido',numberLines:'Numerar artículos del ticket',showCustomer:'Nombre y dirección del cliente',showCustomerPhone:'Teléfono del cliente',showCustomerEmail:'Correo del cliente',showAddressComment:'Comentario de dirección',showDeliveryAddress:'Dirección de entrega',showCustomerCompany:'Empresa del cliente',showReferences:'Referencia de cada artículo',showAddress:'Dirección del establecimiento',showPhone:'Teléfono del establecimiento',
 showPayments:'Formas de pago',showDiscounts:'Total de descuentos',showDate:'Fecha del pedido'});
export function receiptOptions(value){const out={...RECEIPT_DEFAULTS};
 for(const key of Object.keys(RECEIPT_CHECKS))if(typeof value?.[key]==='boolean')out[key]=value[key];
 if(typeof value?.title==='string'&&value.title.trim().length>0&&value.title.length<=80&&!/[\x00-\x1f]/.test(value.title))out.title=value.title.trim();
 if(typeof value?.footer==='string'&&value.footer.length<=500&&!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value.footer))out.footer=value.footer;
 if(['arial','monospace'].includes(value?.fontFamily))out.fontFamily=value.fontFamily;
 if(Number.isInteger(value?.fontSize)&&value.fontSize>=10&&value.fontSize<=16)out.fontSize=value.fontSize;
 if(['native','short','long'].includes(value?.dateFormat))out.dateFormat=value.dateFormat;
 return out;
}
export function receiptLogoUrl(origin,path){try{const base=new URL(origin);if(base.protocol==='https:'&&base.href===base.origin+'/'&&
 typeof path==='string'&&/^\/img\/[a-zA-Z0-9][a-zA-Z0-9_.-]{0,179}\.(png|jpe?g|gif|webp)$/i.test(path))return base.origin+path;}catch{}return null;}
export function receiptOptionsFromForm(fields){return receiptOptions({title:fields.get('receipt-title'),footer:fields.get('receipt-footer'),fontFamily:fields.get('receipt-fontFamily'),
 fontSize:Number(fields.get('receipt-fontSize')),dateFormat:fields.get('receipt-dateFormat'),
 ...Object.fromEntries(Object.keys(RECEIPT_CHECKS).map(key=>[key,fields.get('receipt-'+key)==='on']))});}
const customerKeys=['showCustomer','showCustomerPhone','showCustomerEmail','showAddressComment','showDeliveryAddress','showCustomerCompany'];
export function receiptOptionsHtml(value){const o=receiptOptions(value),checks=entries=>entries.map(([key,label])=>`<label class="tpv-check"><input type="checkbox" name="receipt-${key}" ${o[key]?'checked':''}> ${label}</label>`).join('');return `<fieldset class="tpv-receipt-settings"><legend>Justificante y ticket regalo</legend>
 <label>Título del justificante<input name="receipt-title" maxlength="80" required value="${esc(o.title)}"></label>
 <label>Tipo de letra<select name="receipt-fontFamily"><option value="arial" ${o.fontFamily==='arial'?'selected':''}>Arial</option><option value="monospace" ${o.fontFamily==='monospace'?'selected':''}>Monoespaciada</option></select></label>
 <label>Tamaño de letra<select name="receipt-fontSize">${[10,11,12,13,14,15,16].map(n=>`<option ${n===o.fontSize?'selected':''}>${n}</option>`).join('')}</select></label>
 <label>Formato de fecha<select name="receipt-dateFormat">${[['native','Fecha de la tienda'],['short','Fecha y hora breve'],['long','Fecha y hora completa']].map(([key,label])=>`<option value="${key}" ${key===o.dateFormat?'selected':''}>${label}</option>`).join('')}</select></label>
 ${checks(Object.entries(RECEIPT_CHECKS).filter(([key])=>!customerKeys.includes(key)))}
 <fieldset class="tpv-receipt-customer-options"><legend>Cliente en el justificante</legend>${checks(customerKeys.map(key=>[key,RECEIPT_CHECKS[key]]))}<p class="small muted">Activa nombre y dirección para incluir los campos elegidos. El ticket regalo oculta los datos del cliente.</p></fieldset>
 <label>Texto al pie<textarea name="receipt-footer" maxlength="500" rows="3">${esc(o.footer)}</textarea></label>
 <p class="small muted">Estas opciones cambian la presentación del justificante. La factura y su numeración se conservan en la tienda. El ticket regalo siempre oculta los importes. Tras recuperar una venta, imprime desde Documentos.</p></fieldset>`;}
