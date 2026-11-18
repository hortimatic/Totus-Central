import {cataloguePricingContext} from './catalogue-pricing-context.js';
import {roundPriceSubtotal} from './offline-rounding.js';
/** Select native quantity previews. This is not a payable quote: cart rules,
 * permissions and fiscal reconciliation must be checked before recording sale. */
export function offlineBasketPrices({lines,pages,context,now=Date.now()}){
 const expected=cataloguePricingContext(context),seen=new Set();
 if(!expected||!Array.isArray(lines)||!lines.length||lines.length>200||!Array.isArray(pages)||!Number.isSafeInteger(now))throw Error('No se puede comprobar el precio local de la cesta.');
 let validUntil=Number.MAX_SAFE_INTEGER;
 const selected=lines.map(line=>{
  if(!Number.isSafeInteger(line.productId)||line.productId<=0||!Number.isSafeInteger(line.attributeId)||line.attributeId<0||!Number.isSafeInteger(line.qty)||line.qty<1||line.qty>10000)throw Error('La cesta contiene una variante o cantidad no válida.');
  const key=`${line.productId}:${line.attributeId}`;
  if(seen.has(key))throw Error('Agrupa las cantidades de la misma variante antes de calcular el precio.');seen.add(key);
  const candidates=[];
  for(const page of pages){
   const actual=cataloguePricingContext(page.data?.pricingContext);
   if(!actual||Object.keys(expected).some(field=>field!=='quantity'&&actual[field]!==expected[field]))continue;
   if(!Number.isSafeInteger(page.requestedAt)||page.requestedAt<0||page.requestedAt>now)continue;
   for(const row of page.data.items||[]){
    if(row.id!==key||row.nativeProductId!==line.productId||row.chooseVariant)continue;
    const breaks=row.quantityBreaks;
    if(!Array.isArray(breaks)||breaks[0]!==1||breaks.length>1001||breaks.some((q,i)=>!Number.isSafeInteger(q)||q<1||q>10000||i>0&&q<=breaks[i-1]))continue;
    const tier=breaks.filter(q=>q<=line.qty).at(-1);
    if(!Number.isSafeInteger(row.priceValidForMs)||row.priceValidForMs<0||row.priceValidForMs>86400000)continue;
    const deadline=page.requestedAt+row.priceValidForMs;
    if(!Number.isSafeInteger(deadline))continue;
    if(!Number.isSafeInteger(row.unitTaxExclMicros)||!Number.isSafeInteger(row.unitTaxInclMicros)||row.unitTaxExclMicros<0||row.unitTaxInclMicros<row.unitTaxExclMicros||row.unitTaxInclMicros>1000000000000000)continue;
    const observedTier=breaks.filter(q=>q<=actual.quantity).at(-1);
    candidates.push({row,tier,observedTier,quantity:actual.quantity,signature:JSON.stringify(breaks),deadline,requestedAt:page.requestedAt});
   }
  }
  candidates.sort((a,b)=>b.requestedAt-a.requestedAt);
  const newest=candidates[0];
  if(newest&&candidates.some(item=>item.requestedAt===newest.requestedAt&&item.signature!==newest.signature))throw Error('Hay tramos locales contradictorios. Actualiza el catálogo.');
  // Every quantity inside a native price tier uses that tier's price. A later
  // preview for quantity 2 must supersede quantity 1 when both belong to tier 1;
  // otherwise an old unit price could silently survive a price change.
  const matching=candidates.filter(item=>item.signature===newest?.signature&&item.observedTier===item.tier);
  const latest=matching[0];
  if(!latest||now>=latest.deadline||now>=newest.deadline)throw Error(`Falta un precio vigente para la variante ${key} y su cantidad.`);
  if(matching.some(item=>item.requestedAt===latest.requestedAt&&(item.row.unitTaxInclMicros!==latest.row.unitTaxInclMicros||item.row.unitTaxExclMicros!==latest.row.unitTaxExclMicros||item.tier!==latest.tier)))throw Error('Hay precios locales contradictorios. Actualiza el catálogo.');
  validUntil=Math.min(validUntil,latest.deadline,newest.deadline);
  return {productId:line.productId,attributeId:line.attributeId,qty:line.qty,pricingQuantity:latest.tier,unitTaxInclMicros:latest.row.unitTaxInclMicros,unitTaxExclMicros:latest.row.unitTaxExclMicros};
 });
 return {lines:selected,pricingContext:expected,validUntil,subtotals:offlineBasketSubtotals(selected,expected)};
}

/** Match native product rows and initial total independently. PrestaShop's
 * LINE mode rounds final rows but sums unrounded initial rows for Cart::BOTH.
 * These subtotals exclude cart discounts, shipping and wrapping, not a quote. */
export function offlineBasketSubtotals(lines,context){
 const policy=cataloguePricingContext(context);
 if(!policy)throw Error('Falta el contexto de cálculo de la cesta.');
 const options={mode:policy.roundMode,type:policy.roundType,computingPrecision:policy.computingPrecision};
 const calculate=(field,type)=>roundPriceSubtotal(lines.map(line=>({unitMicros:line[field],quantity:line.qty})),{...options,type}).totalCents;
 const initialType=policy.roundType===1?1:3;
 const productsGrossCents=calculate('unitTaxInclMicros',policy.roundType),productsNetCents=calculate('unitTaxExclMicros',policy.roundType);
 const initialGrossCents=calculate('unitTaxInclMicros',initialType),initialNetCents=calculate('unitTaxExclMicros',initialType);
 return {productsGrossCents,productsNetCents,initialGrossCents,initialNetCents,grossRoundingDifferenceCents:initialGrossCents-productsGrossCents,netRoundingDifferenceCents:initialNetCents-productsNetCents};
}
