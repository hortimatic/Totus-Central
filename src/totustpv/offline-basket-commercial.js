import {cataloguePricingContext} from './catalogue-pricing-context.js';
import {offlineCommercial} from './offline-commercial.js';
import {roundPriceLine,roundPriceLineMicros,roundPriceSubtotal} from './offline-rounding.js';
import {reconcileNativeTaxedSubtotal} from './server/native-subtotal.js';

/** Local capture for an unmodified basket. Never evidence of a native order.
 * Delivery must obtain a fresh native quote and compare every captured amount.
 */
export function offlineBasketCommercial(basket,{now=Date.now()}={}){
 const context=cataloguePricingContext(basket?.pricingContext);
 if(!context||!Number.isSafeInteger(now)||now<0||!Number.isSafeInteger(basket?.validUntil)||basket.validUntil<=now||!Array.isArray(basket.lines)||!basket.lines.length||basket.lines.length>200)
  throw Error('Actualiza los precios del catálogo antes de preparar este cobro sin conexión.');
 const options={mode:context.roundMode,type:context.roundType,computingPrecision:context.computingPrecision};
 const lines=basket.lines.map(line=>({productId:line.productId,attributeId:line.attributeId,qty:line.qty,
  unitTaxInclMicros:line.unitTaxInclMicros,unitTaxExclMicros:line.unitTaxExclMicros,
  lineTaxInclCents:roundPriceLine(line.unitTaxInclMicros,line.qty,options),lineTaxExclCents:roundPriceLine(line.unitTaxExclMicros,line.qty,options),
  ...(context.roundType===3?{lineTaxInclMicros:roundPriceLineMicros(line.unitTaxInclMicros,line.qty,options),lineTaxExclMicros:roundPriceLineMicros(line.unitTaxExclMicros,line.qty,options)}:{})}));
 if(context.roundType===3){
  const subtotal=field=>roundPriceSubtotal(lines.map(line=>({unitMicros:line[field],quantity:1})),{...options,type:3}).totalCents;
  const balanced=reconcileNativeTaxedSubtotal(lines.map(line=>({key:`${line.productId}:${line.attributeId}`,netMicros:line.lineTaxExclMicros,grossMicros:line.lineTaxInclMicros})),
   {netCents:subtotal('lineTaxExclMicros'),grossCents:subtotal('lineTaxInclMicros'),mode:context.roundMode});
  const byKey=new Map(balanced.map(line=>[line.key,line]));
  for(const line of lines){const row=byKey.get(`${line.productId}:${line.attributeId}`);line.lineTaxInclCents=row.grossCents;line.lineTaxExclCents=row.netCents;}
 }
 return offlineCommercial({currency:context.currency,customerId:context.customerId,invoiceAddressId:context.addressId,deliveryAddressId:context.addressId,
  totalCents:lines.reduce((sum,line)=>sum+line.lineTaxInclCents,0),totalTaxExclCents:lines.reduce((sum,line)=>sum+line.lineTaxExclCents,0),
  discountCents:0,shippingCents:0,nativeRoundMode:context.roundMode,nativeRoundType:context.roundType,lines});
}
