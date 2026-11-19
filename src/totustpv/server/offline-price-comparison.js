/** Compare a captured commercial snapshot with a fresh server-verified native
 * quote. This does not authorize a sale or validate an offline permission.
 * Never silently change a total that the operator has already collected.
 */
export function compareOfflinePrices(captured,current){
 const conflicts=new Set(),uint=value=>Number.isSafeInteger(value)&&value>=0;
 if(!captured||!current)return {matches:false,conflicts:['snapshot-missing']};
 for(const key of ['totalCents','totalTaxExclCents','discountCents','shippingCents','nativeRoundMode','nativeRoundType']){
  if(!uint(captured[key])||!uint(current[key])||captured[key]!==current[key])conflicts.add(key);
 }
 if(captured.currency!==current.currency||captured.currency!=='EUR')conflicts.add('currency');
 for(const key of ['customerId','invoiceAddressId','deliveryAddressId'])if(!Number.isSafeInteger(captured[key])||captured[key]<=0||captured[key]!==current[key])conflicts.add('customer');
 const rows=value=>Array.isArray(value?.lines)&&value.lines.length>0&&value.lines.length<=200?value.lines:null;
 const a=rows(captured),b=rows(current);
 if(!a||!b||a.length!==b.length)conflicts.add('lines');
 else{
  const key=line=>`${line?.productId}:${line?.attributeId}`;
  if(new Set(a.map(key)).size!==a.length||new Set(b.map(key)).size!==b.length)conflicts.add('lines');
  const priceFields=['unitTaxInclMicros','unitTaxExclMicros','lineTaxInclCents','lineTaxExclCents',...(captured.nativeRoundType===3||current.nativeRoundType===3?['lineTaxInclMicros','lineTaxExclMicros']:[])];
  for(const line of a){
   const found=b.find(row=>key(row)===key(line));
   if(!found||!Number.isSafeInteger(line.productId)||line.productId<=0||!uint(line.attributeId)||!Number.isSafeInteger(line.qty)||line.qty<=0||line.qty!==found.qty){conflicts.add('lines');continue;}
   for(const field of priceFields)if(!uint(line[field])||!uint(found[field])||line[field]!==found[field])conflicts.add('line-prices');
  }
 }
 return {matches:conflicts.size===0,conflicts:[...conflicts]};
}
