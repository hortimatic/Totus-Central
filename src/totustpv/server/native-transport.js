/** Official PrestaShop Webservice transport for Central's future TPV handler.
 * Reuses Central's URL/secret/response protections. No POSTPV endpoints, cookies,
 * arbitrary URL forwarding, PUT state recovery, SQL or automatic write retries.
 */
import {safeEndpoint,connectionHeaders,boundedJson,boundedText} from '../../../supabase/functions/totus-connections/transport.js';
const positive = value => Number.isSafeInteger(value) && value > 0;
const cents = value => Number.isSafeInteger(value) && value >= 0 && value <= 100_000_000_000;
const requireValue = (condition, code) => { if (!condition) throw new Error(code); };
const escapeXml = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const tag = (name,value) => `<${name}>${escapeXml(value)}</${name}>`;

export function nativePaidOrderXml(expected, allowedPaymentModules) {
  requireValue(expected && ['cartId','customerId','invoiceAddressId','deliveryAddressId','currencyId','languageId','carrierId','shopId']
    .every(key=>positive(expected[key])), 'TPV_NATIVE_IDENTITIES_REQUIRED');
  requireValue(cents(expected.totalCents) && expected.totalCents > 0 && cents(expected.totalTaxExclCents) &&
    expected.totalTaxExclCents <= expected.totalCents && cents(expected.productsTaxInclCents) &&
    cents(expected.productsTaxExclCents), 'TPV_NATIVE_TOTALS_INVALID');
  requireValue(Array.isArray(allowedPaymentModules) && allowedPaymentModules.includes(expected.paymentModule) &&
    /^[a-z][a-z0-9_]{1,63}$/.test(expected.paymentModule) && !/(?:tpvtienda|postpv)/i.test(expected.paymentModule),
    'TPV_NATIVE_PAYMENT_MODULE_UNVERIFIED');
  requireValue(typeof expected.paymentLabel === 'string' && expected.paymentLabel.trim().length > 0 &&
    expected.paymentLabel.length <= 70 && !/[\x00-\x1f]/.test(expected.paymentLabel), 'TPV_NATIVE_PAYMENT_LABEL_INVALID');
  requireValue(Array.isArray(expected.lines) && expected.lines.length > 0 && expected.lines.length <= 200 &&
    expected.lines.every(line=>positive(line.productId) && Number.isSafeInteger(line.attributeId) && line.attributeId >= 0 &&
      positive(line.qty) && line.qty<=10000), 'TPV_NATIVE_LINES_INVALID');
  const fields={id_cart:expected.cartId,id_customer:expected.customerId,id_address_invoice:expected.invoiceAddressId,
    id_address_delivery:expected.deliveryAddressId,id_currency:expected.currencyId,id_lang:expected.languageId,
    id_carrier:expected.carrierId,id_shop:expected.shopId,module:expected.paymentModule,payment:expected.paymentLabel,
    conversion_rate:1,total_paid:(expected.totalCents/100).toFixed(2),total_paid_real:(expected.totalCents/100).toFixed(2),
    total_products:(expected.productsTaxExclCents/100).toFixed(2),total_products_wt:(expected.productsTaxInclCents/100).toFixed(2)};
  // Order::addWs validates the real Cart and uses PS_OS_WS_PAYMENT. A supplied
  // current_state does not override that process; never claim it would.
  const rows=expected.lines.map(line=>'<order_row>'+tag('product_id',line.productId)+
    tag('product_attribute_id',line.attributeId)+tag('product_quantity',line.qty)+'</order_row>').join('');
  return '<?xml version="1.0" encoding="UTF-8"?><prestashop><order>'+Object.entries(fields).map(([k,v])=>tag(k,v)).join('')+
    '<associations><order_rows>'+rows+'</order_rows></associations></order></prestashop>';
}

export function createTpvNativeTransport(connection, scope, {
  request=fetch,resolve,allowOrderCreation=async()=>false,allowedPaymentModules=[],
  nativeExtension=null,allowNativeQuote=async()=>false
}={}) {
  connection=structuredClone(connection);scope=structuredClone(scope);
  allowedPaymentModules=structuredClone(allowedPaymentModules);
  nativeExtension=structuredClone(nativeExtension);
  requireValue(connection && connection.id === scope?.connectionId && connection.revision === scope.connectionRevision &&
    connection.enabled === true && connection.verified_revision === connection.revision &&
    connection.real_data_authorized === true && connection.protocol === 'prestashop' && positive(scope.shopId),
    'TPV_NATIVE_CONNECTION_UNVERIFIED');
  const base=new URL(connection.endpoint);
  requireValue(base.origin === connection.website_origin && base.pathname.replace(/\/$/,'') === '/api' &&
    !base.search && !base.hash, 'TPV_NATIVE_ORIGIN_MISMATCH');
  const headers=connectionHeaders(connection);
  const resources=/^(?:orders|carts|customers|addresses|products|combinations|stock_availables|stock_movements|order_details|order_payments|order_histories|order_states|configurations|currencies|languages|carriers|countries|states)(?:\/[1-9][0-9]{0,14})?$/;
  async function call(resource,method,query={},body,nativePrices=false,nativeCommand=false) {
    requireValue(resources.test(resource)||(nativeCommand&&resource==='totus_tpv_quotes'&&method==='POST'), 'TPV_NATIVE_RESOURCE_FORBIDDEN');
    const url=new URL(base.href);url.pathname='/api/'+resource;
    url.searchParams.set('output_format','JSON');url.searchParams.set('id_shop',String(scope.shopId));
    for(const [key,value] of Object.entries(query)) {
      const ordinary=/^(?:display|limit|sort|filter\[[a-z_]+\])$/.test(key);
      const price=nativePrices && /^products\/[1-9][0-9]*$/.test(resource) &&
        /^price\[totus_(?:incl|excl)\]\[(?:country|state|county|currency|group|quantity|product_attribute|decimals|use_tax|use_reduction|only_reduction|use_ecotax)\]$/.test(key);
      requireValue((ordinary || price) && typeof value==='string' &&
        value.length<=1000 && !/[\x00-\x1f]/.test(value), 'TPV_NATIVE_QUERY_INVALID');
      url.searchParams.set(key,value);
    }
    const target=await safeEndpoint(url.href,resolve);
    const response=await request(target.href,{method,headers:{...headers,...(body?{'Content-Type':nativeCommand?'application/json':'application/xml'}:{})},
      ...(body?{body}:{}),redirect:'error',credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(20000)});
    if(!response.ok) {
      await response.body?.cancel();
      throw new Error(`TPV_NATIVE_HTTP_${response.status}`);
    }
    const type=response.headers.get('content-type') || '';
    if(type.includes('json')) return boundedJson(response,2097152);
    if(method==='POST' && type.includes('xml')) {
      const xml=await boundedText(response,131072);
      requireValue(!/<!DOCTYPE|<!ENTITY/i.test(xml), 'TPV_NATIVE_XML_UNSAFE');
      const match=xml.match(/<order(?:\s[^>]*)?>\s*<id>\s*(?:<!\[CDATA\[)?([1-9][0-9]*)(?:\]\]>)?\s*<\/id>/);
      requireValue(match && positive(Number(match[1])), 'TPV_NATIVE_ORDER_ID_MISSING');
      return {order:{id:Number(match[1])}};
    }
    await response.body?.cancel();throw new Error('TPV_NATIVE_RESPONSE_TYPE_INVALID');
  }
  return Object.freeze({
    read:(resource,query={})=>call(resource,'GET',query),
    async quoteOwnedCart({operationId,cartId}) {
      const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
      requireValue(uuid(operationId)&&positive(cartId)&&uuid(scope.actorId),'TPV_NATIVE_QUOTE_IDENTITY_INVALID');
      requireValue(nativeExtension?.verified===true&&uuid(nativeExtension.installationId)&&
        nativeExtension.connectionId===scope.connectionId&&nativeExtension.connectionRevision===scope.connectionRevision&&
        nativeExtension.shopId===scope.shopId&&nativeExtension.protocol===1&&
        await allowNativeQuote({scope:structuredClone(scope),cartId})===true,'TPV_NATIVE_QUOTE_DISABLED');
      const body={protocol:1,operation_id:operationId,installation_id:nativeExtension.installationId,
        shop_id:scope.shopId,actor_id:scope.actorId,command:'cart.quote',payload:{cart_id:cartId}};
      const result=await call('totus_tpv_quotes','POST',{},JSON.stringify(body),false,true);
      requireValue(result?.verified===true&&result.native_reference===cartId&&result.quote?.cart_id===cartId&&
        result.quote?.shop_id===scope.shopId,'TPV_NATIVE_QUOTE_RESPONSE_INVALID');
      return result;
    },
    /** Native product-price preview, not a payable cart quote. In 8.2.8 this
     * engine has no customer/cart input and does not apply cart-rule totals.
     * Keep all six decimals; never round the unit here to derive a sale total.
     * Context values must be resolved by the authenticated server.
     */
    async readProductPricePreview(context) {
      context=structuredClone(context);
      const allowed=['productId','attributeId','quantity','countryId','stateId','postcode','currencyId','groupId','useEcotax'];
      requireValue(context && Object.keys(context).every(key=>allowed.includes(key)) &&
        ['productId','quantity','countryId','currencyId','groupId'].every(key=>positive(context[key])) &&
        context.quantity<=10000 && ['attributeId','stateId'].every(key=>Number.isSafeInteger(context[key]) && context[key]>=0) &&
        typeof context.postcode==='string' && /^[A-Za-z0-9 -]{0,12}$/.test(context.postcode) &&
        typeof context.useEcotax==='boolean','TPV_NATIVE_PRICE_CONTEXT_INVALID');
      const query={};
      for(const [alias,tax] of [['totus_incl','1'],['totus_excl','0']]) {
        // The pinned 8.2.8 implementation reads `county` as the postcode,
        // despite the tutorial naming this parameter `postcode`.
        const fields={country:context.countryId,state:context.stateId,county:context.postcode,currency:context.currencyId,
          group:context.groupId,quantity:context.quantity,product_attribute:context.attributeId,decimals:6,
          use_tax:tax,use_reduction:1,only_reduction:0,use_ecotax:context.useEcotax?1:0};
        for(const [key,value] of Object.entries(fields))query[`price[${alias}][${key}]`]=String(value);
      }
      const product=(await call(`products/${context.productId}`,'GET',query,undefined,true))?.product;
      requireValue(Number(product?.id)===context.productId && ['totus_incl','totus_excl'].every(key=>
        typeof product[key]==='string' && /^(0|[1-9][0-9]{0,9})(?:\.[0-9]{1,6})?$/.test(product[key])),
        'TPV_NATIVE_PRICE_RESPONSE_INVALID');
      return {productId:context.productId,attributeId:context.attributeId,quantity:context.quantity,
        unitTaxInclDecimal:product.totus_incl,unitTaxExclDecimal:product.totus_excl,
        source:'native-product-price',payableCartQuote:false};
    },
    async createOrderOnce(expected) {
      requireValue(expected?.shopId===scope.shopId && expected?.storeId===scope.storeId,
        'TPV_NATIVE_ORDER_SCOPE_MISMATCH');
      requireValue(await allowOrderCreation({scope:structuredClone(scope)}) === true, 'TPV_NATIVE_CHECKOUT_DISABLED');
      const xml=nativePaidOrderXml(expected,allowedPaymentModules);
      const response=await call('orders','POST',{},xml);
      const orderId=Number(response?.order?.id);
      requireValue(positive(orderId), 'TPV_NATIVE_ORDER_ID_MISSING');
      return {orderId};
    }
  });
}
