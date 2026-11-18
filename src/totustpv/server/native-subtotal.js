/** Reconcile high-precision native lines to an already verified native subtotal.
 * This never changes that subtotal or authorizes a payment. Stable product keys
 * make the result independent of API ordering. Original micros stay intact.
 */
import {roundPriceSubtotal} from '../offline-rounding.js';
export function reconcileNativeSubtotal(lines,totalCents,mode){
 if(!Array.isArray(lines)||!lines.length||lines.length>200||!Number.isSafeInteger(totalCents)||totalCents<0)throw Error('TPV_NATIVE_SUBTOTAL_INVALID');
 const seen=new Set();
 for(const line of lines){
  if(!line||typeof line.key!=='string'||!/^[1-9][0-9]*:(0|[1-9][0-9]*)$/.test(line.key)||seen.has(line.key)||!Number.isSafeInteger(line.micros)||line.micros<0)throw Error('TPV_NATIVE_SUBTOTAL_LINES_INVALID');
  seen.add(line.key);
 }
 const ordered=[...lines].sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0);
 const amounts=roundPriceSubtotal(ordered.map(line=>({unitMicros:line.micros,quantity:1})),{mode,type:3,computingPrecision:6});
 if(amounts.totalCents!==totalCents)throw Error('TPV_NATIVE_SUBTOTAL_MISMATCH');
 return ordered.map((line,index)=>({key:line.key,micros:line.micros,cents:amounts.balancedLineCents[index],roundingAdjustmentCents:amounts.lineRoundingAdjustmentsCents[index]}));
}
/** Joint net/gross allocation: a rounded line must never have negative tax. */
export function reconcileNativeTaxedSubtotal(lines,{netCents,grossCents,mode}){
 if(!Number.isSafeInteger(netCents)||!Number.isSafeInteger(grossCents)||netCents<0||grossCents<netCents||!Array.isArray(lines))throw Error('TPV_NATIVE_SUBTOTAL_TAX_INVALID');
 for(const line of lines)if(!Number.isSafeInteger(line?.netMicros)||!Number.isSafeInteger(line?.grossMicros)||line.netMicros<0||line.grossMicros<line.netMicros)throw Error('TPV_NATIVE_SUBTOTAL_TAX_INVALID');
 const net=reconcileNativeSubtotal(lines.map(line=>({key:line.key,micros:line.netMicros})),netCents,mode);
 const gross=reconcileNativeSubtotal(lines.map(line=>({key:line.key,micros:line.grossMicros})),grossCents,mode);
 const balanced=gross.map((line,index)=>line.micros===net[index].micros?net[index].cents:Math.max(Number(BigInt(line.micros)/10000n),net[index].cents));
 let remaining=grossCents-balanced.reduce((a,b)=>a+b,0);
 if(remaining<0)throw Error('TPV_NATIVE_SUBTOTAL_TAX_ALLOCATION_REQUIRED');
 const order=gross.map((line,index)=>({index,remainder:Number(BigInt(line.micros)%10000n)})).sort((a,b)=>b.remainder-a.remainder||a.index-b.index);
 for(const {index} of order){
  if(remaining===0)break;
  if(gross[index].micros===net[index].micros)continue;
  const ceiling=Number((BigInt(gross[index].micros)+9999n)/10000n);
  if(balanced[index]<ceiling){balanced[index]++;remaining--;}
 }
 if(remaining!==0)throw Error('TPV_NATIVE_SUBTOTAL_TAX_ALLOCATION_REQUIRED');
 return gross.map((line,index)=>({key:line.key,netMicros:net[index].micros,grossMicros:line.micros,netCents:net[index].cents,grossCents:balanced[index],taxCents:balanced[index]-net[index].cents,
  netRoundingAdjustmentCents:net[index].roundingAdjustmentCents,grossRoundingAdjustmentCents:line.roundingAdjustmentCents+balanced[index]-line.cents}));
}
