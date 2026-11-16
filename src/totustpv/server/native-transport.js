/** Official PrestaShop Webservice transport for Central's future TPV handler.
 * Reuses Central's URL/secret/response protections. No POSTPV endpoints, cookies,
 * arbitrary URL forwarding, PUT state recovery, SQL or automatic write retries.
 */
import {safeEndpoint,connectionHeaders,boundedJson,boundedText} from '../../../supabase/functions/totus-connections/transport.js';
import {assertQaTarget} from './qa-policy.js';
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
  nativeExtension=null,allowNativeQuote=async()=>false,allowNativeCommand=async()=>false,qaPolicy=null
}={}) {
  connection=structuredClone(connection);scope=structuredClone(scope);
  allowedPaymentModules=structuredClone(allowedPaymentModules);
  nativeExtension=structuredClone(nativeExtension);
  qaPolicy=structuredClone(qaPolicy);
  requireValue(connection && connection.id === scope?.connectionId && connection.revision === scope.connectionRevision &&
    connection.enabled === true && connection.verified_revision === connection.revision &&
    connection.real_data_authorized === true && connection.protocol === 'prestashop' && positive(scope.shopId),
    'TPV_NATIVE_CONNECTION_UNVERIFIED');
  const base=new URL(connection.endpoint);
  requireValue(base.origin === connection.website_origin && base.pathname.replace(/\/$/,'') === '/api' &&
    !base.search && !base.hash, 'TPV_NATIVE_ORIGIN_MISMATCH');
  // Native WebserviceRequest::fetch trims the key. Match that canonical form
  // before HTTP Basic encoding, including clipboard line breaks, without
  // changing the stored credential or removing interior characters.
  if(typeof connection.secret==='string')connection.secret=connection.secret.trim();
  const headers=connectionHeaders(connection);
  const resources=/^(?:orders|carts|customers|addresses|products|combinations|stock_availables|stock_movements|order_details|order_payments|order_histories|order_states|configurations|currencies|languages|carriers|countries|states)(?:\/[1-9][0-9]{0,14})?$/;
  const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
  const commandResources=Object.freeze({'setup.qa':'totus_tpv_setup','cart.prepare':'totus_tpv_carts',
    'cart.quote':'totus_tpv_quotes','sale.commit':'totus_tpv_sales','return.commit':'totus_tpv_returns','stock.receive':'totus_tpv_stock'});
  function extensionScope(){
    assertQaTarget(connection,scope,qaPolicy);
    requireValue(nativeExtension?.verified===true&&uuid(nativeExtension.installationId)&&uuid(scope.actorId)&&
      nativeExtension.connectionId===scope.connectionId&&nativeExtension.connectionRevision===scope.connectionRevision&&
      nativeExtension.shopId===scope.shopId&&nativeExtension.protocol===1,'TPV_NATIVE_EXTENSION_UNVERIFIED');
  }
  async function call(resource,method,query={},body,nativePrices=false,nativeCommand=false) {
    // Every mutation is QA-bound even when another server feature gate allows it.
    // With a QA policy, reads are also confined to the same test installation.
    if(method!=='GET'||qaPolicy)assertQaTarget(connection,scope,qaPolicy);
    const extensionResource=nativeCommand&&((method==='POST'&&Object.values(commandResources).includes(resource))||
      (method==='GET'&&['totus_tpv_profile','totus_tpv_operations','totus_tpv_returns','totus_tpv_catalogue','totus_tpv_documents','totus_tpv_customers'].includes(resource)));
    requireValue(resources.test(resource)||extensionResource, 'TPV_NATIVE_RESOURCE_FORBIDDEN');
    const url=new URL(base.href);url.pathname='/api/'+resource;
    url.searchParams.set('output_format','JSON');url.searchParams.set('id_shop',String(scope.shopId));
    for(const [key,value] of Object.entries(query)) {
      const ordinary=/^(?:display|limit|sort|filter\[[a-z_]+\])$/.test(key);
      const price=nativePrices && /^products\/[1-9][0-9]*$/.test(resource) &&
        /^price\[totus_(?:incl|excl)\]\[(?:country|state|county|currency|group|quantity|product_attribute|decimals|use_tax|use_reduction|only_reduction|use_ecotax)\]$/.test(key);
      const extensionQuery=extensionResource&&method==='GET'&&['actor_id','operation_id','sale_operation_id'].includes(key)&&uuid(value);
      const catalogueQuery=['totus_tpv_catalogue','totus_tpv_customers'].includes(resource)&&method==='GET'&&
        (key==='search'||['page','page_size','product_id','customer_id','address_id','category_id','categories_only'].includes(key)&&/^(0|[1-9][0-9]*)$/.test(value));
      const documentQuery=resource==='totus_tpv_documents'&&method==='GET'&&key==='kind'&&['receipt','gift','invoice','delivery','credit-note'].includes(value);
      requireValue((ordinary || price || extensionQuery || catalogueQuery || documentQuery) && typeof value==='string' &&
        value.length<=1000 && !/[\x00-\x1f]/.test(value), 'TPV_NATIVE_QUERY_INVALID');
      url.searchParams.set(key,value);
    }
    const target=await safeEndpoint(url.href,resolve);
    const response=await request(target.href,{method,headers:{...headers,...(body?{'Content-Type':nativeCommand?'application/json':'application/xml'}:{})},
      ...(body?{body}:{}),redirect:'error',credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(20000)});
    if(!response.ok) {
      // Only the connector's fixed machine code crosses this boundary. Native
      // errors may contain private data; never relay their arbitrary text.
      let reason=null;
      try{const body=await boundedJson(response,65536);
       const errors=Array.isArray(body?.errors)?body.errors:[];
       const code=errors.length===1?errors[0]?.message:null;
       if(typeof code==='string'&&/^TOTUS_[A-Z0-9_]{1,60}$/.test(code))reason=code.slice(6);
      }catch{}
      if(reason)throw new Error('TPV_NATIVE_REMOTE_'+reason);
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
    assertMutationTarget(){return assertQaTarget(connection,scope,qaPolicy);},
    read:(resource,query={})=>call(resource,'GET',query),
    async inspectNativeProfile(){
      assertQaTarget(connection,scope,qaPolicy);
      requireValue(uuid(scope.actorId),'TPV_NATIVE_OPERATION_INVALID');
      return call('totus_tpv_profile','GET',{},undefined,false,true);
    },
    /** Server-only named commands. Caller must persist the operation before
     * invoking this method; transport performs exactly one POST, never retries.
     * Unknown outcomes are recovered with readNativeOperation, never resubmitted.
     */
    async nativeCommand({operationId,command,payload}){
      extensionScope();requireValue(uuid(operationId)&&Object.hasOwn(commandResources,command)&&payload&&
        typeof payload==='object'&&!Array.isArray(payload),'TPV_NATIVE_COMMAND_INVALID');
      requireValue(await allowNativeCommand({scope:structuredClone(scope),command,operationId})===true,
        'TPV_NATIVE_COMMAND_DISABLED');
      const body=JSON.stringify({protocol:1,operation_id:operationId,installation_id:nativeExtension.installationId,
        shop_id:scope.shopId,actor_id:scope.actorId,command,payload});
      requireValue(new TextEncoder().encode(body).length<=65536,'TPV_NATIVE_COMMAND_TOO_LARGE');
      return call(commandResources[command],'POST',{},body,false,true);
    },
    async readNativeProfile(){extensionScope();return call('totus_tpv_profile','GET',{},undefined,false,true);},
    async readNativeCustomers({search='',page=0,customerId=0}={}){
      extensionScope();requireValue(typeof search==='string'&&search.length<=100&&Number.isSafeInteger(page)&&page>=0&&page<10000&&
        Number.isSafeInteger(customerId)&&customerId>=0,'TPV_CUSTOMER_QUERY_INVALID');
      return call('totus_tpv_customers','GET',{search,page:String(page),customer_id:String(customerId)},undefined,false,true);
    },
    async readNativeDocument({operationId,sourceActorId,kind}){
      extensionScope();requireValue(uuid(operationId)&&uuid(sourceActorId)&&['receipt','gift','invoice','delivery','credit-note'].includes(kind),'TPV_DOCUMENT_QUERY_INVALID');
      return call('totus_tpv_documents','GET',{operation_id:operationId,actor_id:sourceActorId,kind},undefined,false,true);
    },
    async readNativeOperation(operationId,{sourceActorId=scope.actorId}={}){
      extensionScope();requireValue(uuid(operationId)&&uuid(sourceActorId),'TPV_NATIVE_OPERATION_INVALID');
      // sourceActorId is supplied only by the server-owned sale journal after
      // authorizing the current operator. It is not an HTTP request field.
      return call('totus_tpv_operations','GET',{operation_id:operationId,actor_id:sourceActorId},undefined,false,true);
    },
    async readNativeReturnable(saleOperationId){
      extensionScope();requireValue(uuid(saleOperationId),'TPV_NATIVE_OPERATION_INVALID');
      return call('totus_tpv_returns','GET',{sale_operation_id:saleOperationId,actor_id:scope.actorId},undefined,false,true);
    },
    async readNativeCategories(){extensionScope();return call('totus_tpv_catalogue','GET',{categories_only:'1'},undefined,false,true);},
    async readNativeCatalogue({search='',page=0,pageSize=20,productId=0,customerId,addressId,categoryId=0}={}){
      extensionScope();requireValue(typeof search==='string'&&search.length<=120&&Number.isSafeInteger(page)&&page>=0&&page<=1000&&
        Number.isSafeInteger(pageSize)&&pageSize>0&&pageSize<=50&&Number.isSafeInteger(productId)&&productId>=0&&
        (customerId===undefined||positive(customerId))&&(addressId===undefined||positive(addressId))&&Number.isSafeInteger(categoryId)&&categoryId>=0&&categoryId<=2147483647,'TPV_CATALOGUE_QUERY_INVALID');
      return call('totus_tpv_catalogue','GET',{search,page:String(page),page_size:String(pageSize),product_id:String(productId),category_id:String(categoryId),
        ...(customerId?{customer_id:String(customerId)}:{}),...(addressId?{address_id:String(addressId)}:{})},undefined,false,true);
    },
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
