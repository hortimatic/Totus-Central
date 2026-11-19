const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(value/100);
const date=value=>new Date(value).toLocaleString('es-ES',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
export const budgetStatus=value=>({saved:'Guardado',checkout:'Ticket abierto',sold:'Convertido en venta',cancelled:'Anulado'}[value]||'Estado pendiente');
function party(value){return [value.company,value.name,value.taxId||value.registration,value.address,value.address2,[value.postcode,value.city,value.country].filter(Boolean).join(' '),value.phone,value.email].filter(Boolean).map(text=>esc(text)).join('<br>');}
/** Only immutable server-saved commercial fields are printed. Internal notes,
 * native cart/command identities and checkout authority never enter the page. */
export function budgetDocumentHtml(document){
 const s=document?.snapshot,presentation=document?.presentation??{hidePrices:false};
 if(!presentation||typeof presentation!=='object'||Array.isArray(presentation)||Object.keys(presentation).some(k=>k!=='hidePrices')||typeof presentation.hidePrices!=='boolean')throw Error('No se puede comprobar la presentación del presupuesto. Vuelve a consultarlo.');
 const hidePrices=presentation.hidePrices;
 if(!document?.reference||!s||s.currency!=='EUR'||!Array.isArray(s.lines)||!s.lines.length||!Number.isSafeInteger(s.totalCents)||!Number.isSafeInteger(s.totalTaxExclCents))throw Error('No se puede mostrar este presupuesto. Vuelve a consultarlo.');
 const unit=value=>new Intl.NumberFormat('es-ES',{minimumFractionDigits:2,maximumFractionDigits:6}).format(value/1000000)+' €';
 return `<article class="tpv-budget-document" aria-label="Documento del presupuesto"><header><p class="small">PRESUPUESTO</p><h3>${esc(document.title)}</h3><p><strong>${esc(document.reference)}</strong> · ${esc(budgetStatus(document.status))}${document.expired?' · Caducado':''}</p></header>
  <div class="tpv-budget-parties"><section aria-label="Establecimiento"><strong>${esc(document.storeName)}</strong><p>${party(s.merchant||{})}</p></section><section aria-label="Cliente"><strong>Cliente</strong><p>${s.customer?party(s.customer):'Cliente de mostrador'}</p></section></div>
  <p>Preparado: ${esc(date(document.createdAt))}<br>Válido hasta: ${esc(date(document.validUntil))}</p>
  <div class="tpv-table-scroll"><table><thead><tr><th>${hidePrices?'Artículo':'Artículo · cantidad y precio con IVA'}</th><th>${hidePrices?'Cantidad':'Importe'}</th></tr></thead><tbody>${s.lines.map(line=>`<tr><td>${esc(line.name)}${hidePrices?'':`<small>${esc(line.qty)} × ${esc(unit(line.unitTaxInclMicros))}</small>`}</td><td>${hidePrices?esc(line.qty):money(line.lineTaxInclCents)}</td></tr>`).join('')}</tbody></table></div>
  ${hidePrices?'<p class="small muted">Documento presentado sin precios.</p>':`<dl><div><dt>Base imponible</dt><dd>${money(s.totalTaxExclCents)}</dd></div><div><dt>Impuestos</dt><dd>${money(s.totalCents-s.totalTaxExclCents)}</dd></div>${s.shippingCents?`<div><dt>Envío incluido en el total</dt><dd>${money(s.shippingCents)}</dd></div>`:''}${s.discountCents?`<div><dt>Descuento del pedido</dt><dd>${money(s.discountCents)}</dd></div>`:''}<div><dt><strong>Total con impuestos</strong></dt><dd><strong>${money(s.totalCents)}</strong></dd></div></dl>`}
  ${document.publicNote?`<p class="tpv-budget-public-note">${esc(document.publicNote).replace(/\n/g,'<br>')}</p>`:''}
  <footer><p>Documento comercial. El cobro se acredita con el justificante de la venta.</p>${document.orderId?`<p>Vinculado al pedido #${esc(document.orderId)}</p>`:''}</footer></article>`;
}
