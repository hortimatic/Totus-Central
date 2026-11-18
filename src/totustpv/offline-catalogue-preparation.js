/** Enrich Central's existing product IDs with native variant/stock/price data.
 * Sequential reads keep store load bounded. This never creates carts or orders.
 */
import {cataloguePricingContext} from './catalogue-pricing-context.js';
export async function prepareOfflineCatalogue({source,readPage,readCachedPage=async()=>null,isCurrent=()=>true,onProgress=()=>{},signal,beforePage=async()=>{},now=Date.now}){
 let pricingContext=null,validUntil=null,lastObserved=now();
 const checkTime=()=>{const instant=now();if(!Number.isSafeInteger(instant)||instant<lastObserved)throw Error('El reloj ha cambiado durante la preparación.');lastObserved=instant;if(validUntil!==null&&instant>=validUntil)throw Error('Un precio ha caducado durante la preparación. Vuelve a actualizar el catálogo.');return instant;};
 const guard=()=>{checkTime();if(signal?.aborted)throw signal.reason||new Error('Se ha detenido la preparación del catálogo.');if(!isCurrent())throw Error('Ha cambiado el puesto o cliente. Se ha detenido la preparación del catálogo.');};
 guard();if(!source?.productsComplete||!Array.isArray(source.products))throw Error('Todavía no está disponible el catálogo completo de Productos.');
 const products=source.products.filter(row=>String(row.active)!=='0'&&String(row.available_for_order)!=='0');
 const progress={products:products.length,completedProducts:0,variants:0,priceSnapshots:0};onProgress({...progress});
 for(const product of products){
  const productId=Number(product.id),quantities=[1];let quantitySignature=null,baseVariants=null;
  if(!Number.isSafeInteger(productId)||productId<=0)throw Error('El catálogo contiene un producto sin identificar.');
  for(const quantity of quantities){
  const seen=new Set();
  for(let page=0;;page++){
   guard();if(page>1000)throw Error('No se han podido completar todas las variantes de este producto.');
   const query={productId,page,...(quantity===1?{}:{pricingQuantity:quantity})};
   let rows=await readCachedPage(query);guard();
   if(rows===null){await beforePage({...query,signal});guard();rows=await readPage(query);guard();}
   if(!Array.isArray(rows)||typeof rows.hasMore!=='boolean'||rows.page!==page)throw Error('La página de variantes no se ha podido verificar.');
   if(!rows.length)throw Error('La tienda ha devuelto una página vacía sin completar las variantes.');
   if(!Number.isSafeInteger(rows.priceReadAt)||rows.priceReadAt<0||rows.priceReadAt>now())throw Error('Falta la fecha de consulta de estos precios.');
   const context=cataloguePricingContext(rows.pricingContext??undefined);
   if(!context||context.quantity!==quantity)throw Error('Falta el contexto de cálculo para preparar estos precios.');
   if(pricingContext&&Object.keys(context).some(key=>key!=='quantity'&&context[key]!==pricingContext[key]))throw Error('La configuración de precios ha cambiado durante la preparación. Vuelve a preparar el catálogo.');
   pricingContext={...context,quantity:1};
   for(const row of rows){
    if(row.nativeProductId!==productId||row.chooseVariant||seen.has(row.id)||!Number.isSafeInteger(row.stock)||!Number.isSafeInteger(row.unitTaxInclMicros)||!Number.isSafeInteger(row.unitTaxExclMicros)||row.unitTaxExclMicros<0||row.unitTaxInclMicros<row.unitTaxExclMicros)throw Error('Faltan datos completos de una variante para guardarla sin conexión.');
    if(!Number.isSafeInteger(row.priceValidForMs)||row.priceValidForMs<=0||row.priceValidForMs>86400000)throw Error('Falta una vigencia válida para preparar este precio.');
    const deadline=rows.priceReadAt+row.priceValidForMs;if(!Number.isSafeInteger(deadline))throw Error('La fecha de vigencia no es válida.');
    validUntil=validUntil===null?deadline:Math.min(validUntil,deadline);checkTime();
    const breaks=row.quantityBreaks;
    if(!Array.isArray(breaks)||breaks.length>1001||breaks[0]!==1||breaks.some((value,index)=>!Number.isSafeInteger(value)||value<1||value>10000||index>0&&value<=breaks[index-1]))throw Error('Faltan los tramos de cantidad del producto.');
    const signature=JSON.stringify(breaks);if(quantitySignature&&signature!==quantitySignature)throw Error('Los tramos de cantidad han cambiado durante la preparación.');quantitySignature=signature;
    if(quantity===1)for(const value of breaks)if(!quantities.includes(value))quantities.push(value);
    seen.add(row.id);progress.priceSnapshots++;if(quantity===1)progress.variants++;
   }
   if(!rows.hasMore)break;
  }
  if(quantity===1)baseVariants=new Set(seen);
  else if(seen.size!==baseVariants.size||[...seen].some(id=>!baseVariants.has(id)))throw Error('Las variantes han cambiado durante la preparación de precios por cantidad.');
  }
  progress.completedProducts++;onProgress({...progress});
 }
 guard();return {...progress,pricingContext,validUntil};
}
