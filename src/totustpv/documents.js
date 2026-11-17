import {receiptOptions,receiptLogoUrl} from './receipt-options.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(value/100);
const paymentLabel=method=>({cash:'Efectivo',card:'Tarjeta',bizum:'Bizum',transfer:'Transferencia'}[method]||method);
function customerHtml(customer,o){if(!o.showCustomer||!customer?.invoice)return '';
 const address=a=>[a.address1,a.address2,[a.postcode,a.city].filter(Boolean).join(' '),a.country].filter(Boolean).map(esc).join(' · '),invoice=customer.invoice;
 return `<section class="tpv-receipt-customer" aria-label="Cliente"><strong>Cliente</strong><div>${esc(invoice.name)}</div>
  ${o.showCustomerCompany&&invoice.company?`<div>${esc(invoice.company)}</div>`:''}<p>${address(invoice)}</p>
  ${o.showCustomerPhone&&invoice.phone?`<div>Tel. ${esc(invoice.phone)}</div>`:''}${o.showCustomerEmail&&customer.email?`<div>${esc(customer.email)}</div>`:''}
  ${o.showAddressComment&&invoice.comment?`<p style="white-space:pre-wrap">${esc(invoice.comment)}</p>`:''}
  ${o.showDeliveryAddress&&customer.delivery?`<strong>Entrega</strong><div>${esc(customer.delivery.name)}</div><p>${address(customer.delivery)}</p>`:''}</section>`;}
export function receiptHtml(document,options,{preview=false}={}){
 if(!preview&&!document?.existing_document||!['receipt','gift'].includes(document?.kind)||document.currency!=='EUR'||!Array.isArray(document.lines))throw Error('Documento no válido.');
 const gift=document.kind==='gift',merchant=document.merchant,o=receiptOptions(options),logo=receiptLogoUrl(document.merchant_logo_origin,merchant.logo_path);
 let date=document.created_at;if(o.dateFormat!=='native'){const parsed=new Date(String(date).replace(' ','T'));if(Number.isFinite(parsed.getTime()))date=new Intl.DateTimeFormat('es-ES',{dateStyle:o.dateFormat==='long'?'long':'short',timeStyle:o.dateFormat==='long'?'medium':'short'}).format(parsed);}
 return `<article class="tpv-document" aria-label="Documento de venta" style="font-family:${o.fontFamily==='monospace'?'monospace':'Arial,sans-serif'};font-size:${o.fontSize}px"><header>${o.showLogo?logo?`<img class="tpv-receipt-logo" src="${esc(logo)}" alt="${esc(merchant.name)}" referrerpolicy="no-referrer" style="display:block;max-width:100%;max-height:70px;object-fit:contain;margin:0 auto 8px">`:preview?'<div class="tpv-sample-logo" aria-label="Ejemplo de logo">LOGO</div>':'':''}<h3>${gift?'Ticket regalo':esc(o.title)}</h3><strong>${esc(merchant.name)}</strong>
  <p>${[...(o.showAddress?[merchant.address,merchant.address2,merchant.postcode,merchant.city]:[]),merchant.registration,o.showPhone?merchant.phone:''].filter(Boolean).map(esc).join(' · ')}</p>
  <small>${preview?'Vista previa · datos de ejemplo':'Preproducción · documento de pruebas'}</small></header><p>${preview?('Ejemplo de ticket'+(o.showOrderReference?' · REF-EJEMPLO':'')):`Pedido #${esc(document.order_id)}${o.showOrderReference?` · ${esc(document.reference)}`:''}`}${o.showDate?`<br>${esc(date)}`:''}</p>
  ${gift?'':customerHtml(document.customer,o)}
  <table><thead><tr><th>Artículo</th><th>Ud.</th>${gift?'':'<th>Importe</th>'}</tr></thead><tbody>${document.lines.map((line,index)=>`<tr><td>${o.numberLines?`${index+1}. `:''}${esc(line.name)}${o.showReferences?`<small>${esc(line.reference)}</small>`:''}</td><td>${esc(line.quantity)}</td>${gift?'':`<td>${money(line.line_cents)}</td>`}</tr>`).join('')}</tbody></table>
  ${gift?'':`<dl>${o.showDiscounts&&document.discount_cents?`<div><dt>Descuentos de ticket</dt><dd>−${money(document.discount_cents)}</dd></div>`:''}<div><dt>Total</dt><dd><strong>${money(document.total_cents)}</strong></dd></div>
   ${o.showPayments?Object.entries(document.payments).map(([method,cents])=>`<div><dt>${esc(paymentLabel(method))}</dt><dd>${money(cents)}</dd></div>`).join(''):''}</dl>${preview?'':'<small>La factura nativa está disponible en Documentos de este pedido.</small>'}`}
  ${o.footer?`<p class="tpv-receipt-footer" style="white-space:pre-wrap">${esc(o.footer)}</p>`:''}
  ${preview?'':'<div class="inline-actions"><button type="button" class="btn secondary" data-tpv-action="close-document">Cerrar documento</button><button type="button" class="btn primary" data-tpv-action="print-document">Imprimir</button></div>'}</article>`;
}
export function receiptPreviewHtml(options){return receiptHtml({kind:'receipt',currency:'EUR',created_at:'2026-11-16 12:30:00',
 merchant:{name:'Tu establecimiento',address:'Dirección del establecimiento',city:'Localidad',phone:'Teléfono',registration:'Datos fiscales'},
 customer:{email:'cliente@ejemplo.invalid',invoice:{name:'Cliente de ejemplo',company:'Empresa de ejemplo',address1:'Dirección del cliente',postcode:'00000',city:'Localidad',country:'País',phone:'Teléfono del cliente',comment:'Comentario de ejemplo'},delivery:{name:'Destinatario de ejemplo',address1:'Dirección de entrega',postcode:'00000',city:'Localidad',country:'País'}},
 lines:[{name:'Artículo de ejemplo',reference:'REF-001',quantity:2,line_cents:1000}],payments:{cash:900},total_cents:900,discount_cents:100},options,{preview:true});}
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
 return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page{size:auto;margin:5mm}*{box-sizing:border-box}body{font:11px Arial,sans-serif;color:#111;margin:0;width:48mm;overflow-wrap:anywhere}h3,p{margin:6px 0}table{table-layout:fixed;border-collapse:collapse;width:100%;font-size:10px}th,td{text-align:left;padding:5px 2px;border-bottom:1px solid #ddd}th:first-child{width:50%}th:nth-child(2){width:15%;white-space:nowrap}th:last-child,td:last-child{text-align:right;white-space:nowrap}small{display:block;font-size:9px}dl>div{display:flex;justify-content:space-between;gap:5px;padding:3px 0}dt{min-width:0}dd{margin:0;text-align:right;white-space:nowrap}.tpv-document th:last-child{font-size:.85em;white-space:nowrap}.tpv-document table{font-size:.91em}.tpv-document small{font-size:.82em}.inline-actions{display:none}</style></head><body>${html}</body></html>`;
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
