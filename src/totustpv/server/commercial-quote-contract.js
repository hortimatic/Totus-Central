import {nativeCents,nativeMicros} from './native-adapter.js';
import {nativeQuoteFingerprint} from './quote-contract.js';
import {lineName} from '../line-name.js';
const need=(ok,code)=>{if(!ok)throw Error(code);};
const positive=value=>Number.isSafeInteger(value)&&value>0;
/** An immutable commercial snapshot, deliberately without a checkout expected
 * record, payment module, paid states, stock evidence or dispatch authority.
 * All arguments originate in authenticated server/native reads, never the UI.
 */
export async function commercialFromNativeQuote({scope,ownedCart,profile,response,now=Date.now()}){
 scope=structuredClone(scope);ownedCart=structuredClone(ownedCart);profile=structuredClone(profile);response=structuredClone(response);
 need(Number.isFinite(now)&&ownedCart?.commercialOnly===true&&positive(ownedCart.cartId)&&ownedCart.actorId===scope?.actorId&&
  ['connectionId','connectionRevision','storeId','shopId','drawerId','sessionId','currency','environment'].every(key=>ownedCart[key]===scope[key]),'TPV_COMMERCIAL_CART_OWNERSHIP_REQUIRED');
 need(profile?.verified===true&&profile.nativeVersion==='8.2.8'&&positive(profile.quoteLifetimeMs)&&profile.quoteLifetimeMs<=120000&&
  ['connectionId','connectionRevision','shopId','currency','environment'].every(key=>profile[key]===scope[key]),'TPV_NATIVE_QUOTE_PROFILE_INVALID');
 need(response?.verified===true&&response.native_reference===ownedCart.cartId&&Number.isSafeInteger(response.quoted_at)&&
  response.quoted_at<=now+5000&&response.quoted_at+profile.quoteLifetimeMs>now,'TPV_NATIVE_QUOTE_EXPIRED');
 const q=response.quote;need(q?.commercial_only===true&&response.quote_fingerprint===await nativeQuoteFingerprint(q),'TPV_COMMERCIAL_QUOTE_REQUIRED');
 need(q.cart_id===ownedCart.cartId&&q.shop_id===scope.shopId&&q.currency===scope.currency&&
  [['customer_id','customerId'],['invoice_address_id','invoiceAddressId'],['delivery_address_id','deliveryAddressId'],['currency_id','currencyId'],['language_id','languageId'],['carrier_id','carrierId']].every(([source,target])=>positive(q[source])&&q[source]===ownedCart[target]),'TPV_NATIVE_QUOTE_IDENTITY_MISMATCH');
 need([0,1,2,3,4,5].includes(q.round_mode)&&[1,2].includes(q.round_type)&&Array.isArray(q.lines)&&q.lines.length>0&&q.lines.length<=200,'TPV_NATIVE_QUOTE_LINES_INVALID');
 const seen=new Set(),lines=q.lines.map(line=>{
  const key=line.product_id+':'+line.attribute_id;need(positive(line.product_id)&&Number.isSafeInteger(line.attribute_id)&&line.attribute_id>=0&&positive(line.quantity)&&line.quantity<=10000&&!seen.has(key),'TPV_NATIVE_QUOTE_LINES_INVALID');seen.add(key);
  need(typeof line.catalogue_name==='string'&&Array.from(line.catalogue_name).length>0&&Array.from(line.catalogue_name).length<=512&&!/[\u0000-\u001f\u007f]/u.test(line.catalogue_name),'TPV_NATIVE_LINE_NAME_INVALID');
  if(line.display_name!==undefined)need(lineName(line.display_name)===line.display_name&&line.display_name!=='','TPV_NATIVE_LINE_NAME_INVALID');
  const item={productId:line.product_id,attributeId:line.attribute_id,qty:line.quantity,name:line.display_name??line.catalogue_name,catalogueName:line.catalogue_name,
   unitTaxInclMicros:nativeMicros(line.unit_tax_incl),unitTaxExclMicros:nativeMicros(line.unit_tax_excl),lineTaxInclCents:nativeCents(line.line_tax_incl),lineTaxExclCents:nativeCents(line.line_tax_excl)};
  need(item.unitTaxExclMicros<=item.unitTaxInclMicros&&item.lineTaxExclCents<=item.lineTaxInclCents,'TPV_NATIVE_QUOTE_TAX_INVALID');return item;
 });
 const totalCents=nativeCents(q.total_tax_incl),totalTaxExclCents=nativeCents(q.total_tax_excl),productsTaxInclCents=nativeCents(q.products_tax_incl),productsTaxExclCents=nativeCents(q.products_tax_excl),shippingCents=nativeCents(q.shipping_tax_incl),discountCents=nativeCents(q.discounts_tax_incl);
 need(totalCents===q.total_cents&&totalTaxExclCents<=totalCents&&productsTaxExclCents<=productsTaxInclCents&&lines.reduce((sum,line)=>sum+line.lineTaxInclCents,0)===productsTaxInclCents&&productsTaxInclCents+shippingCents-discountCents===totalCents,'TPV_NATIVE_QUOTE_TOTAL_INVALID');
 let document={};if(q.document_parties!==undefined){
  need(q.document_parties&&typeof q.document_parties==='object'&&!Array.isArray(q.document_parties)&&Object.keys(q.document_parties).length===3&&['merchant','customer','delivery'].every(key=>Object.hasOwn(q.document_parties,key)),'TPV_BUDGET_DOCUMENT_INVALID');
  const fields=(value,keys)=>{need(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>typeof value[key]==='string'&&Array.from(value[key]).length<=512&&!/[\u0000-\u001f\u007f\uD800-\uDFFF]/u.test(value[key])),'TPV_BUDGET_DOCUMENT_INVALID');return Object.fromEntries(keys.map(key=>[key,value[key]]));};
  const merchant=fields(q.document_parties.merchant,['name','address','address2','postcode','city','phone','email','registration']),keys=['name','email','taxId','company','address','address2','postcode','city','phone','country'];
  const customer=fields(q.document_parties.customer,keys),delivery=fields(q.document_parties.delivery,keys);
  document={merchant,customer:ownedCart.customerId===ownedCart.counterCustomerId?null:customer,delivery:ownedCart.customerId===ownedCart.counterCustomerId?null:delivery};
 }
 return {commercial:true,snapshot:{currency:scope.currency,customerId:ownedCart.customerId,invoiceAddressId:ownedCart.invoiceAddressId,deliveryAddressId:ownedCart.deliveryAddressId,
  totalCents,totalTaxExclCents,productsTaxInclCents,productsTaxExclCents,shippingCents,discountCents,lines,...document,nativeRoundMode:q.round_mode,nativeRoundType:q.round_type,nativeQuoteFingerprint:response.quote_fingerprint,nativeCartId:ownedCart.cartId},
  calculatedAt:response.quoted_at,calculationExpiresAt:Math.min(now+profile.quoteLifetimeMs,response.quoted_at+profile.quoteLifetimeMs)};
}
