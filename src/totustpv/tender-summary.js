import {cashTenderPreview} from './model.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(value/100);
/** Presentation of the verified total and existing tender calculation; no allocation writes. */
export function tenderSummaryHtml({totalCents,cashPartCents,receivedCents,discountCents=0,externalLabel='Tarjeta'}){
 const tender=cashTenderPreview({totalCents,cashPartCents,receivedCents});
 if(!Number.isSafeInteger(discountCents)||discountCents<0)throw Error('Revisa el descuento del cobro.');
 return `<span>Total a cobrar <strong data-tpv-confirm-total>${money(totalCents)}</strong></span>`+
 (discountCents?`<span>Descuento del ticket incluido <b>−${money(discountCents)}</b></span>`:'')+
 (cashPartCents&&tender.cardPartCents?`<span>Parte en efectivo <b>${money(cashPartCents)}</b></span>`:'')+
 (cashPartCents?`<span>Entregado <b>${money(tender.receivedCents)}</b></span><span>${tender.missingCents?'Falta por entregar':'Cambio a devolver'} <strong data-tpv-change>${money(tender.missingCents||tender.changeCents)}</strong></span>`:'')+
 (tender.cardPartCents?`<span>Importe de ${esc(externalLabel.toLocaleLowerCase('es'))} <b>${money(tender.cardPartCents)}</b></span>`:'');
}
