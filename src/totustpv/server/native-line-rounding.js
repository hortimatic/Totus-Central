import {roundPriceLineMicros,roundPriceMicros} from '../offline-rounding.js';

/** Prove the native LINE subtotal/initial-total difference for an unmodified
 * basket. This is arithmetic evidence, never permission to collect payment.
 * Shipping, promotions and fees require their own native component evidence.
 */
export function nativeLineRoundingDifference({lines,mode,productsGrossCents,productsNetCents,initialGrossCents,initialNetCents}){
 const need=(ok)=>{if(!ok)throw Error('TPV_NATIVE_LINE_ROUNDING_UNPROVEN');};
 need(Array.isArray(lines)&&lines.length>0&&lines.length<=200&&Number.isInteger(mode)&&mode>=0&&mode<=5);
 need([productsGrossCents,productsNetCents,initialGrossCents,initialNetCents].every(value=>Number.isSafeInteger(value)&&value>=0&&value<=100000000000));
 need(productsNetCents<=productsGrossCents&&initialNetCents<=initialGrossCents);
 const seen=new Set();let gross=0n,net=0n,roundedGross=0n,roundedNet=0n;
 for(const line of lines){
  need(line&&Number.isSafeInteger(line.productId)&&line.productId>0&&Number.isSafeInteger(line.attributeId)&&line.attributeId>=0&&Number.isSafeInteger(line.qty)&&line.qty>0&&line.qty<=10000);
  const key=`${line.productId}:${line.attributeId}`;need(!seen.has(key));seen.add(key);
  need(['unitTaxInclMicros','unitTaxExclMicros','lineTaxInclCents','lineTaxExclCents'].every(key=>Number.isSafeInteger(line[key])&&line[key]>=0));
  need(line.unitTaxExclMicros<=line.unitTaxInclMicros&&line.unitTaxInclMicros<=1000000000000000);
  const options={mode,type:2,computingPrecision:2};
  const g=roundPriceLineMicros(line.unitTaxInclMicros,line.qty,options)/10000;
  const n=roundPriceLineMicros(line.unitTaxExclMicros,line.qty,options)/10000;
  need(g===line.lineTaxInclCents&&n===line.lineTaxExclCents);
  roundedGross+=BigInt(g);roundedNet+=BigInt(n);
  gross+=BigInt(line.unitTaxInclMicros)*BigInt(line.qty);net+=BigInt(line.unitTaxExclMicros)*BigInt(line.qty);
 }
 need(gross<=BigInt(Number.MAX_SAFE_INTEGER)&&net<=BigInt(Number.MAX_SAFE_INTEGER));
 need(roundedGross===BigInt(productsGrossCents)&&roundedNet===BigInt(productsNetCents));
 need(roundPriceMicros(Number(gross),mode)===initialGrossCents&&roundPriceMicros(Number(net),mode)===initialNetCents);
 return {grossCents:initialGrossCents-productsGrossCents,netCents:initialNetCents-productsNetCents};
}
