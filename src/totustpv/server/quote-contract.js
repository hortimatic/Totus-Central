/** Consume a native-owned cart quote on Central's authenticated server.
 * These arguments are server-loaded records and an authenticated native response,
 * never a browser-provided quote/profile/stock snapshot. A SHA-256 fingerprint
 * detects changed content; it is not authentication or a replacement for TLS/ACL.
 */
import {lineName} from '../line-name.js';
import {nativeCents,nativeMicros} from './native-adapter.js';
const need=(ok,code)=>{if(!ok)throw new Error(code);};
const positive=value=>Number.isSafeInteger(value)&&value>0;
const validUint=value=>Number.isSafeInteger(value)&&value>=0;
function ordered(value){if(Array.isArray(value))return value.map(ordered);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,ordered(value[key])]));
 need(value===null||['string','boolean'].includes(typeof value)||Number.isSafeInteger(value),'TPV_NATIVE_QUOTE_VALUE_INVALID');return value;}
export async function nativeQuoteFingerprint(quote){
 // PHP JSON_UNESCAPED_UNICODE still escapes these two line separators.
 const serialized=JSON.stringify(ordered(quote)).replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
 const bytes=new TextEncoder().encode(serialized);
 const hash=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(hash)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
export async function expectedFromNativeQuote({scope,ownedCart,profile,response,stockRecords,now=Date.now()}) {
 need(response?.quote?.commercial_only===undefined||response.quote.commercial_only===false,'TPV_COMMERCIAL_QUOTE_NOT_PAYABLE');
 scope=structuredClone(scope);ownedCart=structuredClone(ownedCart);profile=structuredClone(profile);
 response=structuredClone(response);stockRecords=structuredClone(stockRecords);
 need(Number.isFinite(now)&&ownedCart?.id&&positive(ownedCart.cartId)&&ownedCart.actorId===scope?.actorId&&
  ['connectionId','connectionRevision','storeId','shopId','drawerId','sessionId','currency','environment'].every(key=>
   ownedCart[key]===scope[key]),'TPV_CART_OWNERSHIP_REQUIRED');
 need(profile?.verified===true&&profile.nativeVersion==='8.2.8'&&
  ['connectionId','connectionRevision','shopId','currency','environment'].every(key=>profile[key]===scope[key])&&
  positive(profile.quoteLifetimeMs)&&profile.quoteLifetimeMs<=120000&&(profile.allowOutOfStock===undefined||typeof profile.allowOutOfStock==='boolean')&&
  typeof profile.paymentModule==='string'&&/^[a-z][a-z0-9_]{1,63}$/.test(profile.paymentModule),
  'TPV_NATIVE_QUOTE_PROFILE_INVALID');
 need(response?.verified===true&&response.native_reference===ownedCart.cartId&&
  Number.isSafeInteger(response.quoted_at)&&response.quoted_at<=now+5000&&
  response.quoted_at+profile.quoteLifetimeMs>now,'TPV_NATIVE_QUOTE_EXPIRED');
 const quote=response.quote;
 need(quote&&response.quote_fingerprint===await nativeQuoteFingerprint(quote),'TPV_NATIVE_QUOTE_FINGERPRINT_MISMATCH');
 need(quote.cart_id===ownedCart.cartId&&quote.shop_id===scope.shopId&&quote.currency===scope.currency&&
  [['customer_id','customerId'],['invoice_address_id','invoiceAddressId'],['delivery_address_id','deliveryAddressId'],
   ['currency_id','currencyId'],['language_id','languageId'],['carrier_id','carrierId']].every(([key,field])=>
    positive(quote[key])&&quote[key]===ownedCart[field]),'TPV_NATIVE_QUOTE_SCOPE_MISMATCH');
 need(validUint(quote.round_mode)&&quote.round_mode<=5&&[1,2,3].includes(quote.round_type)&&
  Array.isArray(quote.lines)&&quote.lines.length>0&&quote.lines.length<=200&&Array.isArray(stockRecords),
  'TPV_NATIVE_QUOTE_LINES_INVALID');
 const seen=new Set(),usedStock=new Set();
 const lines=quote.lines.map(line=>{
  const key=`${line.product_id}:${line.attribute_id}`;
  need(positive(line.product_id)&&validUint(line.attribute_id)&&positive(line.quantity)&&line.quantity<=10000&&
   !seen.has(key)&&(line.allow_out_of_stock===undefined||typeof line.allow_out_of_stock==='boolean'),'TPV_NATIVE_QUOTE_LINES_INVALID');seen.add(key);
  need(profile.allowOutOfStock!==true||typeof line.allow_out_of_stock==='boolean','TPV_NATIVE_STOCK_POLICY_UNAVAILABLE');
  if(line.catalogue_name!==undefined)need(typeof line.catalogue_name==='string'&&Array.from(line.catalogue_name).length>0&&Array.from(line.catalogue_name).length<=512,'TPV_NATIVE_LINE_NAME_INVALID');
  if(line.display_name!==undefined)need(lineName(line.display_name)===line.display_name&&line.display_name!=='','TPV_NATIVE_LINE_NAME_INVALID');
  const records=stockRecords.filter(stock=>stock.productId===line.product_id&&stock.attributeId===line.attribute_id);
  need(records.length===1,'TPV_QUOTE_STOCK_MAPPING_REQUIRED');const stock=records[0];
  need(positive(stock.id)&&!usedStock.has(stock.id)&&stock.shopId===scope.shopId&&stock.shopGroupId===0&&
   stock.dependsOnStock===false&&Number.isSafeInteger(stock.quantity)&&stock.quantity>=-2147483648&&stock.quantity<=2147483647&&
   (stock.quantity>=line.quantity||profile.allowOutOfStock===true&&line.allow_out_of_stock===true&&stock.quantity-line.quantity>=-2147483648),
   'TPV_QUOTE_STOCK_UNAVAILABLE');usedStock.add(stock.id);
  const result={productId:line.product_id,attributeId:line.attribute_id,qty:line.quantity,
   unitTaxInclMicros:nativeMicros(line.unit_tax_incl),unitTaxExclMicros:nativeMicros(line.unit_tax_excl),
   lineTaxInclCents:nativeCents(line.line_tax_incl),lineTaxExclCents:nativeCents(line.line_tax_excl),
   stockRecordId:stock.id,stockBefore:stock.quantity,...(line.catalogue_name!==undefined?{catalogueName:line.catalogue_name}:{}),...((line.display_name??line.catalogue_name)!==undefined?{name:line.display_name??line.catalogue_name}:{})};
  need(result.unitTaxExclMicros<=result.unitTaxInclMicros&&result.lineTaxExclCents<=result.lineTaxInclCents,
   'TPV_NATIVE_QUOTE_TAX_INVALID');return result;
 });
 const totalCents=nativeCents(quote.total_tax_incl),totalTaxExclCents=nativeCents(quote.total_tax_excl),
  productsTaxInclCents=nativeCents(quote.products_tax_incl),productsTaxExclCents=nativeCents(quote.products_tax_excl),
  shippingCents=nativeCents(quote.shipping_tax_incl),discountCents=nativeCents(quote.discounts_tax_incl);
 need(totalCents>0&&totalCents===quote.total_cents&&totalTaxExclCents<=totalCents&&
  productsTaxExclCents<=productsTaxInclCents&&lines.reduce((sum,line)=>sum+line.lineTaxInclCents,0)===productsTaxInclCents&&
  productsTaxInclCents+shippingCents-discountCents===totalCents,'TPV_NATIVE_QUOTE_TOTAL_INVALID');
 need(Array.isArray(profile.paidStateIds)&&profile.paidStateIds.length>0&&profile.paidStateIds.every(positive),
  'TPV_STATE_MAPPING_REQUIRED');
 return {expected:{storeId:scope.storeId,shopId:scope.shopId,cartId:ownedCart.cartId,currency:scope.currency,
  customerId:ownedCart.customerId,invoiceAddressId:ownedCart.invoiceAddressId,deliveryAddressId:ownedCart.deliveryAddressId,
  currencyId:ownedCart.currencyId,languageId:ownedCart.languageId,carrierId:ownedCart.carrierId,
  totalCents,totalTaxExclCents,productsTaxInclCents,productsTaxExclCents,shippingCents,discountCents,lines,...(profile.allowOutOfStock===true?{allowOutOfStock:true}:{}),
  nativeRoundMode:quote.round_mode,nativeRoundType:quote.round_type,nativeQuoteFingerprint:response.quote_fingerprint,
  paymentModule:profile.paymentModule,nativePaymentLabels:structuredClone(profile.nativePaymentLabels),
  operatorPaymentPolicy:structuredClone(profile.operatorPaymentPolicy),paidStateIds:[...profile.paidStateIds]},
  quoteExpiresAt:Math.min(now+profile.quoteLifetimeMs,response.quoted_at+profile.quoteLifetimeMs)};
}
