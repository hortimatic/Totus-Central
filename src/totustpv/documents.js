import {giftDiscountState,giftReceiptBase,giftReceiptWithDiscounts} from './gift-discounts.js';
import {receiptPriceVisible,historicalGroupRate,receiptGroupDiscountHtml} from './receipt-discount-display.js';
import {receiptVouchersHtml} from './receipt-vouchers.js';
import {receiptOptions,receiptLogoUrl,receiptBarcodeUrl,receiptWebsiteUrl} from './receipt-options.js';
import {taxSummaryHtml} from './tax-summary.js';
import {receiptNumber} from './receipt-series.js';
import {documentPaymentReferences} from './payment-reference.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(value/100);
const discountAmount=value=>new Intl.NumberFormat('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value/100);
const unitMoney=value=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:6}).format(value/1000000);
function linePriceDetails(line,o,gift){if(gift||!receiptPriceVisible(line,o))return '';
 return `${o.showOriginalPrice&&Number.isSafeInteger(line.original_unit_tax_incl_micros)?`<small>Precio original: ${unitMoney(line.original_unit_tax_incl_micros)}</small>`:''}${o.showUnitPrice&&Number.isSafeInteger(line.unit_tax_incl_micros)?`<small>Precio unitario: ${unitMoney(line.unit_tax_incl_micros)}</small>`:''}${o.showLineTax&&Number.isSafeInteger(line.tax_cents)?`<small>Impuesto de línea: ${money(line.tax_cents)}</small>`:''}`;}
const paymentLabel=method=>({cash:'Efectivo',card:'Tarjeta',bizum:'Bizum',transfer:'Transferencia'}[method]||method);
export function receiptLinePresentation(line,showAttributes=true){
 const valid=text=>typeof text==='string'&&Array.from(text).length<=512&&!/[\x00-\x1f\x7f]/.test(text);
 if(!valid(line.base_name)||!line.base_name.trim()||!valid(line.variant_name))return {name:line.name,variant:''};
 return {name:line.base_name,variant:showAttributes?line.variant_name:''};
}
function receiptLineRows(lines,o,gift,giftDiscounts=null){
 const discountColumn=!gift&&o.showLineDiscount;
 return lines.map((line,index)=>{
  const presentation=receiptLinePresentation(line,o.showAttributes);
  const name=`${o.numberLines?`${index+1}. `:''}${esc(presentation.name)}${presentation.variant?`<small>Variante: ${esc(presentation.variant)}</small>`:''}${o.showReferences?`<small>${esc(line.reference)}</small>`:''}`;
  const giftAmount=giftDiscounts?.lines[index];
  const details=linePriceDetails(line,o,gift)+(!gift?receiptGroupDiscountHtml(line,o):giftDiscounts&&giftAmount>0?'<small>Descuento del artículo: −'+money(giftAmount)+'</small>':'');
  // On narrow paper the product keeps the full width; its quantity, reduction
  // and amount form a separate, readable row with actual aligned columns.
  return `${discountColumn?`<tr class="tpv-receipt-item-name"><td colspan="3">${name}</td></tr>`:''}<tr>
   ${discountColumn?'':`<td>${name}</td>`}<td>${esc(line.quantity)}</td>
   ${discountColumn?`<td>${Number.isSafeInteger(line.line_discount_cents)&&line.line_discount_cents>0?'−'+discountAmount(line.line_discount_cents):'—'}</td>`:''}
   ${gift?'':`<td>${receiptPriceVisible(line,o)?money(line.line_cents):'—'}</td>`}</tr>
   ${details?`<tr class="tpv-receipt-line-details"><td colspan="3">${details}</td></tr>`:''}`;
 }).join('');
}
function customerHtml(customer,o){if(!o.showCustomer||!customer?.invoice)return '';
 const address=a=>[a.address1,a.address2,[a.postcode,a.city].filter(Boolean).join(' '),a.country].filter(Boolean).map(esc).join(' · '),invoice=customer.invoice;
 return `<section class="tpv-receipt-customer" aria-label="Cliente"><strong>Cliente</strong><div>${esc(invoice.name)}</div>
  ${o.showCustomerCompany&&invoice.company?`<div>${esc(invoice.company)}</div>`:''}<p>${address(invoice)}</p>
  ${o.showCustomerPhone&&invoice.phone?`<div>Tel. ${esc(invoice.phone)}</div>`:''}${o.showCustomerEmail&&customer.email?`<div>${esc(customer.email)}</div>`:''}
  ${o.showAddressComment&&invoice.comment?`<p style="white-space:pre-wrap">${esc(invoice.comment)}</p>`:''}
  ${o.showDeliveryAddress&&customer.delivery?`<strong>Entrega</strong><div>${esc(customer.delivery.name)}</div><p>${address(customer.delivery)}</p>`:''}</section>`;}
function barcodeHtml(document,o,preview){if(!o.showBarcode)return '';
 const url=receiptBarcodeUrl(document.reference_barcode,document.reference),content=preview?
  '<div class="tpv-sample-barcode" aria-label="Ejemplo de código de barras"></div><small>Ejemplo · sin pedido real</small>':url?
  `<img class="tpv-reference-barcode" src="${url}" alt="Código de barras del pedido #${esc(document.order_id)}" style="display:block;box-sizing:border-box;width:100%;height:14mm;background:#fff">${o.showOrderReference?`<small>${esc(document.reference)}</small>`:''}`:
  '<small>Código de barras no disponible. Usa el número de pedido.</small>';
 return `<figure class="tpv-order-barcode" style="margin:12px 0 0;text-align:center">${content}</figure>`;}
export function receiptHtml(document,options,{preview=false}={}){
 if(!preview&&!document?.existing_document||!['receipt','gift'].includes(document?.kind)||document.currency!=='EUR'||!Array.isArray(document.lines))throw Error('Documento no válido.');
 const gift=document.kind==='gift',merchant=document.merchant,o=receiptOptions(options),giftDiscounts=gift&&o.showGiftDiscounts?giftDiscountState(document):null,logo=receiptLogoUrl(document.merchant_logo_origin,merchant.logo_path);
 const number=receiptNumber(document.ticket_number),numberHtml=number?`<p class="tpv-ticket-number"><strong>Ticket ${esc(number.label)}</strong></p>`:'';
 let date=document.created_at;if(o.dateFormat!=='native'){const parsed=new Date(String(date).replace(' ','T'));if(Number.isFinite(parsed.getTime()))date=new Intl.DateTimeFormat('es-ES',{dateStyle:o.dateFormat==='long'?'long':'short',timeStyle:o.dateFormat==='long'?'medium':'short'}).format(parsed);}
 return `<article class="tpv-document" aria-label="Documento de venta" style="font-family:${o.fontFamily==='monospace'?'monospace':'Arial,sans-serif'};font-size:${o.fontSize}px"><header>${o.showLogo?logo?`<img class="tpv-receipt-logo" src="${esc(logo)}" alt="${esc(merchant.name)}" referrerpolicy="no-referrer" style="display:block;max-width:100%;max-height:70px;object-fit:contain;margin:0 auto 8px">`:preview?'<div class="tpv-sample-logo" aria-label="Ejemplo de logo">LOGO</div>':'':''}<h3>${gift?'Ticket regalo':document.external_order?'Copia del pedido':esc(o.title)}</h3><strong>${esc(merchant.name)}</strong>
  <p>${[...(o.showAddress?[merchant.address,merchant.address2,merchant.postcode,merchant.city]:[]),merchant.registration,o.showPhone?merchant.phone:''].filter(Boolean).map(esc).join(' · ')}</p>
  <small>${preview?'Vista previa · datos de ejemplo':'Preproducción · documento de pruebas'}</small></header>${numberHtml}<p>${preview?('Ejemplo de ticket'+(o.showOrderReference?' · REF-EJEMPLO':'')):`Pedido #${esc(document.order_id)}${o.showOrderReference?` · ${esc(document.reference)}`:''}`}${o.showDate?`<br>${esc(date)}`:''}</p>
  ${o.showWebsite&&receiptWebsiteUrl(document.merchant_origin)?`<small>${esc(receiptWebsiteUrl(document.merchant_origin))}</small>`:''}
  ${o.showOperator&&typeof document.operator_name==='string'&&document.operator_name.trim()?`<small>Te atendió: ${esc(document.operator_name)}</small>`:''}
  ${gift?'':customerHtml(document.customer,o)}
  ${!gift&&!preview&&(o.showOriginalPrice||o.showLineDiscount||o.includeLineDiscountsInTotal||!o.showDiscountedPrices)&&document.line_discounts_complete!==true?'<small>Este pedido no dispone del desglose histórico de precios y descuentos de artículos.</small>':''}
  ${!gift&&!o.showDiscountedPrices&&document.lines.some(line=>historicalGroupRate(line)===null)?'<small>Algunos artículos no tienen datos históricos suficientes para distinguir sus descuentos; sus importes se mantienen ocultos.</small>':''}
  ${!gift&&o.showGroupDiscount&&document.lines.some(line=>historicalGroupRate(line)===null)?'<small>El porcentaje histórico del grupo no está disponible para algunos artículos.</small>':''}
  <table ${!gift&&o.showLineDiscount?'data-item-discounts':''}><thead><tr>${!gift&&o.showLineDiscount?'<th>Ud.</th><th><abbr title="Descuento del artículo">Dto.</abbr><small>€</small></th>':'<th>Artículo</th><th>Ud.</th>'}${gift?'':'<th>Importe</th>'}</tr></thead><tbody>${receiptLineRows(document.lines,o,gift,giftDiscounts)}</tbody></table>
  ${gift&&o.showGiftDiscounts?giftDiscounts?`${giftDiscounts.ticketCents>0?`<p>Descuento del ticket: −${money(giftDiscounts.ticketCents)}</p>`:''}${giftDiscounts.partial?'<small>Algunos descuentos no tienen un importe histórico desglosado disponible.</small>':!giftDiscounts.lines.some(value=>value>0)&&giftDiscounts.ticketCents===0?'<small>No hay importes de descuento registrados en este justificante.</small>':''}`:'<small>No se ha podido comprobar el desglose de descuentos del regalo. No se muestran importes sin verificar.</small>':''}
  ${gift?'':`${receiptVouchersHtml(document,o.showVouchers)}${taxSummaryHtml({totalCents:document.total_cents,totalTaxExclCents:document.total_tax_excl_cents},options?.showTaxBreakdown===true)}<dl>${o.showDiscounts&&(document.discount_cents||o.includeLineDiscountsInTotal&&document.line_discounts_complete&&document.line_discount_cents)?`<div><dt>${o.includeLineDiscountsInTotal&&document.line_discounts_complete?'Total descuentos':'Descuentos de ticket'}</dt><dd>−${money(document.discount_cents+(o.includeLineDiscountsInTotal&&document.line_discounts_complete?document.line_discount_cents:0))}</dd></div>`:''}${document.external_order&&document.shipping_cents?`<div><dt>Envío</dt><dd>${money(document.shipping_cents)}</dd></div>`:''}${document.external_order&&document.wrapping_cents?`<div><dt>Envoltorio</dt><dd>${money(document.wrapping_cents)}</dd></div>`:''}<div><dt>${document.external_order?'Total del pedido':'Total'}</dt><dd><strong>${money(document.total_cents)}</strong></dd></div>
   ${o.showPayments?Object.entries(document.payments).map(([method,cents])=>`<div><dt>${esc(paymentLabel(method))}${o.showPaymentReferences&&documentPaymentReferences(document)[method]?`<small>Operación: ${esc(documentPaymentReferences(document)[method])}</small>`:''}</dt><dd>${money(cents)}</dd></div>`).join(''):''}</dl>${preview?'':document.external_order?'<small>Copia de un pedido existente. No registra un cobro en caja ni sustituye su factura.</small>':'<small>La factura nativa está disponible en Documentos de este pedido.</small>'}`}
  ${document.external_order&&o.showCustomer&&document.customer_details_unavailable?'<small>Los datos del cliente no están disponibles con tu acceso actual. La copia se muestra sin ellos.</small>':''}
  ${document.external_order&&document.merchant?.details_unavailable?'<small>La tienda no permite consultar su dirección y datos comerciales. Se identifica por su web.</small>':''}
  ${o.footer?`<p class="tpv-receipt-footer" style="white-space:pre-wrap">${esc(o.footer)}</p>`:''}
  ${barcodeHtml(document,o,preview)}
  ${preview?'':'<div class="inline-actions"><button type="button" class="btn secondary" data-tpv-action="close-document">Cerrar documento</button><button type="button" class="btn primary" data-tpv-action="print-document">Imprimir</button></div>'}</article>`;
}
function receiptPreviewDocument(){return {kind:'receipt',existing_document:true,order_id:1,reference:'EJEMPLO',currency:'EUR',created_at:'2026-11-16 12:30:00',
 merchant_origin:'https://tienda.ejemplo.invalid',operator_name:'Operador de ejemplo',
 merchant:{name:'Tu establecimiento',address:'Dirección del establecimiento',city:'Localidad',phone:'Teléfono',registration:'Datos fiscales'},
 customer:{email:'cliente@ejemplo.invalid',invoice:{name:'Cliente de ejemplo',company:'Empresa de ejemplo',address1:'Dirección del cliente',postcode:'00000',city:'Localidad',country:'País',phone:'Teléfono del cliente',comment:'Comentario de ejemplo'},delivery:{name:'Destinatario de ejemplo',address1:'Dirección de entrega',postcode:'00000',city:'Localidad',country:'País'}},
 lines:[{name:'Artículo de ejemplo · Azul · M',base_name:'Artículo de ejemplo',variant_name:'Color: Azul · Talla: M',reference:'REF-001',quantity:2,line_cents:1000,unit_tax_incl_micros:5000000,original_unit_tax_incl_micros:6000000,original_line_cents:1200,line_discount_cents:200,group_reduction_percent_micros:5000000,tax_cents:174}],payments:{cash:400,card:500},payment_intent:[{method:'cash',amount_cents:400,received_cents:400},{method:'card',amount_cents:500,external_reference:'OP-EJEMPLO-0042'}],total_cents:900,total_tax_excl_cents:744,discount_cents:100,vouchers:[{name:"Vale de ejemplo",amount_cents:100}],vouchers_complete:true,line_discount_cents:200,line_discounts_complete:true};}
export function receiptPreviewHtml(options){return receiptHtml(receiptPreviewDocument(),options,{preview:true});}
export function giftReceiptPreviewHtml(options){const receipt=receiptPreviewDocument();receipt.lines=receipt.lines.map(line=>({...line,group_reduction_percent_micros:0}));const gift=giftReceiptBase({...receipt,kind:'gift'});return receiptHtml(receiptOptions(options).showGiftDiscounts?giftReceiptWithDiscounts(gift,receipt):gift,options,{preview:true});}

export async function downloadNativePdf(document){
 if(document?.mime!=='application/pdf'||!document.existing_document||!/^totus-(invoice|delivery|credit-note)-[1-9][0-9]*\.pdf$/.test(document.filename||'')||
  !/^[a-f0-9]{64}$/.test(document.sha256||'')||typeof document.base64!=='string'||document.base64.length>1900000)throw Error('PDF nativo no válido.');
 const bytes=Uint8Array.from(atob(document.base64),c=>c.charCodeAt(0));
 if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw Error('PDF nativo no válido.');
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');
 if(hash!==document.sha256)throw Error('El documento recibido está incompleto. Descárgalo de nuevo.');
 const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'})),link=globalThis.document.createElement('a');
 link.href=url;link.download=document.filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
export function printReceipt(document,options,delivery){
 printTpvMarkup(receiptHtml(document,options),'TotusTPV · pedido '+document.order_id,delivery);
}
export const TOTUS_PRINTER_PROFILE=Object.freeze({model:'Bisofice VTR-T58W',paperMm:58,printableMm:48,marginMm:5});
export function fitTpvPrintPage(document){
 const heightMm=Math.max(30,Math.min(1000,Math.ceil(document.body.getBoundingClientRect().height*25.4/96+TOTUS_PRINTER_PROFILE.marginMm*2+2)));
 const paper=document.createElement('style');paper.textContent=`@page{size:${TOTUS_PRINTER_PROFILE.paperMm}mm ${heightMm}mm;margin:${TOTUS_PRINTER_PROFILE.marginMm}mm}`;
 document.head.append(paper);return {paperMm:TOTUS_PRINTER_PROFILE.paperMm,heightMm};
}
export function prepareTpvPrintHtml(html,title){
 return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page{size:auto;margin:5mm}*{box-sizing:border-box}body{display:flow-root;font:11px Arial,sans-serif;color:#111;margin:0;width:48mm;overflow-wrap:anywhere}h3,p{margin:6px 0}table{table-layout:fixed;border-collapse:collapse;width:100%;font-size:10px}th,td{text-align:left;padding:5px 2px;border-bottom:1px solid #ddd}th:first-child{width:50%}th:nth-child(2){width:15%;white-space:nowrap}th:last-child,td:last-child{text-align:right;white-space:nowrap}small{display:block;font-size:9px}dl>div{display:flex;justify-content:space-between;gap:5px;padding:3px 0}dt{min-width:0}dd{margin:0;text-align:right;white-space:nowrap}.tpv-document th:last-child{font-size:.85em;white-space:nowrap}.tpv-document table{font-size:.91em}.tpv-document small{font-size:.82em}.tpv-document .tpv-tax-summary{margin:6px 0;font-size:.9em}.tpv-document .tpv-tax-summary>div{padding:2px 0}.tpv-document table[data-item-discounts] th:first-child{width:20%}.tpv-document table[data-item-discounts] th:nth-child(2){width:35%;font-size:.85em}.tpv-document table[data-item-discounts] th:nth-child(3){width:45%}.tpv-document table[data-item-discounts] th:last-child{width:45%}.tpv-document table[data-item-discounts] abbr{text-decoration:none}.tpv-document :is(.tpv-receipt-item-name,.tpv-receipt-line-details)>td{white-space:normal;text-align:left}.inline-actions{display:none}</style></head><body>${html}</body></html>`;
}
export function printTpvMarkup(html,title,{current=()=>true}={}){
 const frame=globalThis.document.createElement('iframe');
 frame.title='Impresión de TotusTPV';frame.setAttribute('sandbox','allow-same-origin allow-modals');
 frame.style.cssText='position:fixed;width:1px;height:1px;right:0;bottom:0;border:0;opacity:0';
 frame.onload=async()=>{try{if(!current()){frame.remove();return;}await frame.contentDocument.fonts?.ready;
  if(!frame.isConnected||!current()){frame.remove();return;}
  fitTpvPrintPage(frame.contentDocument);frame.contentWindow.addEventListener('afterprint',()=>frame.remove(),{once:true});frame.contentWindow.print();
 }catch{frame.remove();}};
 frame.srcdoc=prepareTpvPrintHtml(html,title);
 globalThis.document.body.append(frame);setTimeout(()=>frame.remove(),60000);
}
