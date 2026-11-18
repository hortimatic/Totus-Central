const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=cents=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(cents/100);
export function receiptVouchersHtml(document,enabled){
 if(!enabled||document.kind==='gift'||!Number.isSafeInteger(document.discount_cents)||document.discount_cents<=0)return '';
 const rows=document.vouchers;
 const valid=document.vouchers_complete===true&&Array.isArray(rows)&&rows.length<=200&&rows.every(row=>
  row&&typeof row.name==='string'&&row.name.length<=1024&&Number.isSafeInteger(row.amount_cents)&&row.amount_cents>0)&&
  rows.reduce((sum,row)=>sum+row.amount_cents,0)===document.discount_cents;
 if(!valid)return '<small>El desglose histórico de vales y descuentos no está disponible para este pedido.</small>';
 return `<section class="tpv-receipt-vouchers" aria-label="Vales y descuentos del ticket"><strong>Vales y descuentos del ticket</strong><dl>${rows.map(row=>`<div><dt>${esc(row.name.trim()||'Descuento del ticket')}</dt><dd>−${money(row.amount_cents)}</dd></div>`).join('')}</dl></section>`;
}
