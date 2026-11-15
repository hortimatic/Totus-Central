/** Read-only structural validation of a server-owned prepared cart.
 * This does not calculate tax/discounts or claim that a cart is payable. The
 * authoritative pricing adapter must still validate its quote before dispatch.
 * expected must come from Central's durable operation, never a browser payload.
 */
const need=(condition,code)=>{if(!condition)throw new Error(code);};
const id=value=>/^[1-9][0-9]*$/.test(String(value)) && Number.isSafeInteger(Number(value))?Number(value):null;
const uint=value=>/^(0|[1-9][0-9]*)$/.test(String(value)) && Number.isSafeInteger(Number(value))?Number(value):null;
const yes=value=>value===true || value===1 || value==='1';
const no=value=>value===false || value===0 || value==='0';
function list(payload,key) {
  if(Array.isArray(payload) && payload.length===0)return [];
  need(payload && Object.hasOwn(payload,key) && Array.isArray(payload[key]),'TPV_CART_RESPONSE_INVALID');
  return payload[key];
}
const lineKey=line=>`${line.productId}:${line.attributeId}`;

export function createNativeCartPreflight({scope,transport}) {
  need(scope && id(scope.shopId) && scope.connectionId && Number.isSafeInteger(scope.connectionRevision) &&
    scope.connectionRevision>0 && transport && typeof transport.read==='function','TPV_CART_ADAPTER_REQUIRED');
  // Freeze the selected context; changing a caller object cannot redirect reads.
  const selected=structuredClone(scope);
  return async function inspectPreparedCart({scope:requested,expected}) {
    expected=structuredClone(expected);
    need(requested && ['connectionId','connectionRevision','storeId','shopId','currency'].every(key=>
      requested[key]===selected[key]),'TPV_CART_SCOPE_MISMATCH');
    need(expected && expected.storeId===selected.storeId && expected.shopId===selected.shopId &&
      expected.currency===selected.currency && ['cartId','customerId','invoiceAddressId','deliveryAddressId',
      'currencyId','languageId','carrierId'].every(key=>id(expected[key])),'TPV_CART_IDENTITIES_INVALID');
    need(Array.isArray(expected.lines) && expected.lines.length>0 && expected.lines.length<=200 &&
      expected.lines.every(line=>id(line.productId) && uint(line.attributeId)!==null && id(line.qty) &&
        line.qty<=10000 && id(line.stockRecordId)) &&
      new Set(expected.lines.map(lineKey)).size===expected.lines.length,'TPV_CART_LINES_INVALID');
    const cart=(await transport.read(`carts/${expected.cartId}`))?.cart;
    need(cart && id(cart.id)===expected.cartId && id(cart.id_shop)===selected.shopId &&
      [['id_customer','customerId'],['id_address_invoice','invoiceAddressId'],['id_address_delivery','deliveryAddressId'],
        ['id_currency','currencyId'],['id_lang','languageId'],['id_carrier','carrierId']].every(([field,key])=>
        id(cart[field])===expected[key]),'TPV_CART_CHANGED');
    need(no(cart.gift) && no(cart.recyclable),'TPV_CART_OPTIONS_UNSUPPORTED');
    const remoteLines=cart.associations?.cart_rows;
    need(Array.isArray(remoteLines) && remoteLines.length===expected.lines.length,'TPV_CART_LINES_CHANGED');
    const seen=new Set();
    for(const row of remoteLines) {
      const key=`${id(row.id_product)}:${uint(row.id_product_attribute)}`;
      const line=expected.lines.find(item=>lineKey(item)===key);
      need(line && !seen.has(key) && id(row.quantity)===line.qty && uint(row.id_customization)===0 &&
        [0,expected.deliveryAddressId].includes(uint(row.id_address_delivery)),'TPV_CART_LINES_CHANGED');
      seen.add(key);
    }
    const orders=list(await transport.read('orders',{'filter[id_cart]':`[${expected.cartId}]`,
      display:'[id,id_cart,id_shop]',limit:'0,2'}),'orders');
    need(orders.length===0,'TPV_CART_ALREADY_ORDERED');
    const readEntity=async(resource,entity,entityId)=>{
      const value=(await transport.read(`${resource}/${entityId}`))?.[entity];
      need(value && id(value.id)===entityId,'TPV_CART_RESPONSE_INVALID');return value;
    };
    const addressIds=[...new Set([expected.invoiceAddressId,expected.deliveryAddressId])];
    const [customer,currency,language,carrier,...addresses]=await Promise.all([
      readEntity('customers','customer',expected.customerId),readEntity('currencies','currency',expected.currencyId),
      readEntity('languages','language',expected.languageId),readEntity('carriers','carrier',expected.carrierId),
      ...addressIds.map(addressId=>readEntity('addresses','address',addressId))
    ]);
    need(yes(customer.active) && no(customer.deleted),'TPV_CART_CUSTOMER_UNAVAILABLE');
    need(yes(currency.active) && no(currency.deleted) && currency.iso_code===selected.currency,
      'TPV_CART_CURRENCY_UNAVAILABLE');
    need(yes(language.active) && yes(carrier.active) && no(carrier.deleted),'TPV_CART_DELIVERY_UNAVAILABLE');
    need(addresses.every(address=>no(address.deleted) && id(address.id_customer)===expected.customerId),
      'TPV_CART_ADDRESS_UNAVAILABLE');
    // Bounded sequential product reads avoid bursts of hundreds of API calls.
    const products=new Map(),stocks=new Set();
    for(const line of expected.lines) {
      if(!products.has(line.productId))products.set(line.productId,await readEntity('products','product',line.productId));
      const product=products.get(line.productId);
      need(yes(product.active) && yes(product.available_for_order) && product.type==='simple',
        'TPV_CART_PRODUCT_UNSUPPORTED');
      if(line.attributeId>0) {
        const combination=await readEntity('combinations','combination',line.attributeId);
        need(id(combination.id_product)===line.productId,'TPV_CART_COMBINATION_MISMATCH');
        need(id(combination.minimal_quantity) && line.qty>=Number(combination.minimal_quantity),
          'TPV_CART_MINIMUM_QUANTITY');
      } else {
        need(!Array.isArray(product.associations?.combinations) || product.associations.combinations.length===0,
          'TPV_CART_COMBINATION_REQUIRED');
        need(id(product.minimal_quantity) && line.qty>=Number(product.minimal_quantity),'TPV_CART_MINIMUM_QUANTITY');
      }
      const stock=await readEntity('stock_availables','stock_available',line.stockRecordId);
      need(!stocks.has(line.stockRecordId) && id(stock.id_product)===line.productId &&
        uint(stock.id_product_attribute)===line.attributeId && id(stock.id_shop)===selected.shopId &&
        uint(stock.id_shop_group)===0 && no(stock.depends_on_stock),'TPV_CART_STOCK_SCOPE_MISMATCH');
      stocks.add(line.stockRecordId);
      need(uint(stock.quantity)!==null && Number(stock.quantity)>=line.qty,'TPV_CART_STOCK_INSUFFICIENT');
    }
    // No reservation is claimed: a web sale can change stock after this read.
    return {cartId:expected.cartId,structureVerified:true,pricingVerified:false,stockReserved:false};
  };
}
