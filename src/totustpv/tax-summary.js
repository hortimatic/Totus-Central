const valid=value=>Number.isSafeInteger(value)&&value>=0&&value<=100000000000;
const money=value=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(value/100);
/** Presentation of sealed native totals. Never infer a tax rate from a current
 * product, sum rounded line taxes, or change the amount that will be charged. */
export function taxSummary(value){
 if(value?.totalTaxExclCents===undefined||value?.totalTaxExclCents===null)return null;
 if(!valid(value.totalCents)||!valid(value.totalTaxExclCents)||value.totalTaxExclCents>value.totalCents)
  throw Object.assign(Error('No se ha podido verificar el desglose de impuestos. Conserva el ticket y recupera su cálculo antes de cobrar.'),{code:'TPV_TAX_SUMMARY_INVALID'});
 return {baseCents:value.totalTaxExclCents,taxCents:value.totalCents-value.totalTaxExclCents,totalCents:value.totalCents};
}
export function taxSummaryHtml(value,enabled=false){
 if(!enabled)return '';let totals;try{totals=taxSummary(value);}catch{}
 if(!totals)return '<p class="small muted tpv-tax-unavailable">El desglose de impuestos no está disponible para este cálculo.</p>';
 return '<dl class="tpv-tax-summary" aria-label="Base e impuestos"><div><dt>Base sin impuestos</dt><dd>'+money(totals.baseCents)+'</dd></div><div><dt>Impuestos incluidos</dt><dd>'+money(totals.taxCents)+'</dd></div></dl>';
}
