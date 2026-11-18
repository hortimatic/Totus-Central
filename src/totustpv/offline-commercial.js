/** Portable commercial data only. Validation is not proof of authorization. */
const amounts=['totalCents','totalTaxExclCents','discountCents','shippingCents'];
const customers=['customerId','invoiceAddressId','deliveryAddressId'];
const prices=['unitTaxInclMicros','unitTaxExclMicros','lineTaxInclCents','lineTaxExclCents'];
const lineKeys=['productId','attributeId','qty',...prices];
const keys=['currency',...amounts,...customers,'nativeRoundMode','nativeRoundType','lines'];
const uint=value=>Number.isSafeInteger(value)&&value>=0;
const need=ok=>{if(!ok)throw Error('El desglose guardado del ticket no es válido. Conserva el ticket para su revisión.');};
export function offlineCommercial(value){
 need(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&Object.keys(value).every(key=>keys.includes(key)));
 need(value.currency==='EUR'&&amounts.every(key=>uint(value[key])&&value[key]<=100000000000)&&value.totalTaxExclCents<=value.totalCents&&customers.every(key=>Number.isSafeInteger(value[key])&&value[key]>0));
 need([0,1,2,3,4,5].includes(value.nativeRoundMode)&&[1,2,3].includes(value.nativeRoundType)&&Array.isArray(value.lines)&&value.lines.length>0&&value.lines.length<=200);
 const selectedLineKeys=value.nativeRoundType===3?[...lineKeys,'lineTaxInclMicros','lineTaxExclMicros']:lineKeys;
 const seen=new Set();let gross=0;
 for(const line of value.lines){
  need(line&&typeof line==='object'&&!Array.isArray(line)&&Object.keys(line).length===selectedLineKeys.length&&Object.keys(line).every(key=>selectedLineKeys.includes(key)));
  need(Number.isSafeInteger(line.productId)&&line.productId>0&&uint(line.attributeId)&&Number.isSafeInteger(line.qty)&&line.qty>0&&line.qty<=10000&&prices.every(key=>uint(line[key])));
  if(value.nativeRoundType===3)need(['lineTaxInclMicros','lineTaxExclMicros'].every(key=>uint(line[key])&&line[key]<=1000000000000000)&&line.lineTaxExclMicros<=line.lineTaxInclMicros);
  const id=`${line.productId}:${line.attributeId}`;need(!seen.has(id));seen.add(id);
  need(line.unitTaxExclMicros<=line.unitTaxInclMicros&&line.lineTaxExclCents<=line.lineTaxInclCents);gross+=line.lineTaxInclCents;
 }
 need(Number.isSafeInteger(gross)&&gross+value.shippingCents-value.discountCents===value.totalCents);
 return structuredClone(value);
}
export function commercialFromExpected(expected){
 const value=Object.fromEntries(keys.filter(key=>key!=='lines').map(key=>[key,expected?.[key]]));
 value.lines=expected?.lines?.map(line=>Object.fromEntries((expected.nativeRoundType===3?[...lineKeys,'lineTaxInclMicros','lineTaxExclMicros']:lineKeys).map(key=>[key,line[key]])));
 return offlineCommercial(value);
}

/** Keep the six native decimal places; catalogue previews in cents lose detail.
 * This value still needs cart rules and rounding before it can become a quote. */
export function catalogueUnitMicros(value){
 if(value===undefined)return null;
 if(typeof value!=='string'||! /^(0|[1-9][0-9]*)(?:\.[0-9]{1,6})?$/.test(value)||value.length>24)throw Error('El precio guardado del catálogo no es válido.');
 const [whole,fraction='']=value.split('.'),amount=BigInt(whole)*1000000n+BigInt(fraction.padEnd(6,'0'));
 if(amount>1000000000000000n)throw Error('El precio guardado supera el intervalo admitido.');
 return Number(amount);
}
