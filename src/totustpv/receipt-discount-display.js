/** Rendering policy only; no source amount, total or historic rate is changed. */
export function receiptPriceVisible(line,options){return options.showDiscountedPrices!==false||Number.isSafeInteger(line.line_discount_cents)&&line.line_discount_cents===0&&historicalGroupRate(line)===0;}
export function historicalGroupRate(line){const value=line?.group_reduction_percent_micros;return Number.isSafeInteger(value)&&value>=0&&value<=100000000?value:null;}
export function receiptGroupDiscountHtml(line,options){
 const rate=historicalGroupRate(line);if(!options.showGroupDiscount||rate===null||rate===0)return '';
 return '<small>Descuento de grupo registrado: '+new Intl.NumberFormat('es-ES',{maximumFractionDigits:6}).format(rate/1000000)+' %</small>';
}
