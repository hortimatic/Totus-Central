/** Native readback adapter; never fixes state or repeats a payment implicitly.
 * Quote and attributed inventory evidence are separate verified server adapters.
 * A raw quantity difference alone cannot attribute a concurrent stock movement.
 */
import {createNativeCartPreflight} from './cart-preflight.js';
import {paymentSummary} from '../model.js';
const requireValue=(condition,code)=>{if(!condition)throw new Error(code);};
const positive=value=>Number.isSafeInteger(value)&&value>0;
const nativeId=value=>/^[1-9][0-9]*$/.test(String(value))&&positive(Number(value))?Number(value):null;
const flag=value=>value===true||value===1||value==='1';
export function nativeCents(value) {
  const text=String(value),match=text.match(/^(0|[1-9][0-9]*)(?:\.([0-9]{1,6}))?$/);
  requireValue(match,'TPV_NATIVE_AMOUNT_INVALID');
  const fraction=(match[2]||'').padEnd(2,'0');
  requireValue(!/[1-9]/.test(fraction.slice(2)),'TPV_NATIVE_AMOUNT_PRECISION_UNSUPPORTED');
  const amount=Number(match[1])*100+Number(fraction.slice(0,2));
  requireValue(Number.isSafeInteger(amount)&&amount<=100_000_000_000,'TPV_NATIVE_AMOUNT_INVALID');
  return amount;
}
export function nativeMicros(value) {
  const match=String(value).match(/^(0|[1-9][0-9]*)(?:\.([0-9]{1,6}))?$/);
  requireValue(match,'TPV_NATIVE_AMOUNT_INVALID');
  const amount=Number(match[1])*1000000+Number((match[2]||'').padEnd(6,'0'));
  requireValue(Number.isSafeInteger(amount)&&amount<=1000000000000000,'TPV_NATIVE_AMOUNT_INVALID');
  return amount;
}
function rows(payload,key) {
  // Native PS JSON encodes an empty filtered list as [] in some versions.
  if(Array.isArray(payload)&&payload.length===0)return [];
  requireValue(payload && Object.hasOwn(payload,key),'TPV_NATIVE_LIST_SHAPE_INVALID');
  const value=payload[key];
  if(value && typeof value==='object' && !Array.isArray(value) && Object.keys(value).length===0)return [];
  requireValue(Array.isArray(value),'TPV_NATIVE_LIST_SHAPE_INVALID');
  return value;
}
export function createNativeSaleAdapter({scope,transport,verifyPrepared,readInventoryEvidence}) {
  scope=structuredClone(scope);
  requireValue(transport && typeof transport.read==='function' && typeof transport.createOrderOnce==='function' &&
    typeof verifyPrepared==='function' && typeof readInventoryEvidence==='function','TPV_NATIVE_ADAPTER_REQUIRED');
  const inspectCart=createNativeCartPreflight({scope,transport});
  function sameScope(requested) {
    requireValue(requested && ['connectionId','connectionRevision','storeId','shopId','currency','environment'].every(key=>requested[key]===scope[key]),
      'TPV_NATIVE_ORDER_SCOPE_MISMATCH');
  }
  async function ordersForCart({scope:requested,cartId}) {
    sameScope(requested);requireValue(positive(cartId),'TPV_NATIVE_CART_INVALID');
    const found=rows(await transport.read('orders',{display:'[id,id_cart,id_shop]',
      'filter[id_cart]':`[${cartId}]`,limit:'0,2'}),'orders');
    requireValue(found.length<=1 && found.every(order=>nativeId(order.id) && Number(order.id_cart)===cartId &&
      Number(order.id_shop)===scope.shopId),'TPV_CART_ORDER_AMBIGUOUS');
    return found.map(order=>({connectionId:scope.connectionId,shopId:scope.shopId,cartId,orderId:nativeId(order.id)}));
  }
  async function readSale({scope:requested,orderId,expected}) {
    sameScope(requested);requireValue(positive(orderId),'TPV_NATIVE_ORDER_ID_MISSING');
    const order=(await transport.read('orders/'+orderId))?.order;
    requireValue(order && nativeId(order.id)===orderId && Number(order.id_shop)===scope.shopId &&
      Number(order.id_cart)===expected.cartId,'TPV_REMOTE_ORDER_MISMATCH');
    const stateId=nativeId(order.current_state);
    requireValue(stateId,'TPV_ORDER_STATE_MISSING');
    requireValue(typeof order.reference==='string' && /^[A-Za-z0-9_-]{1,32}$/.test(order.reference),
      'TPV_NATIVE_ORDER_REFERENCE_INVALID');
    const [stateResponse,currencyResponse,detailsResponse,paymentsResponse]=await Promise.all([
      transport.read('order_states/'+stateId),transport.read('currencies/'+nativeId(order.id_currency)),
      transport.read('order_details',{'filter[id_order]':`[${orderId}]`,display:'full',limit:'0,201'}),
      transport.read('order_payments',{'filter[order_reference]':`[${order.reference}]`,display:'full',limit:'0,21'})
    ]);
    const state=stateResponse?.order_state,currency=currencyResponse?.currency;
    requireValue(state && nativeId(state.id)===stateId && currency && nativeId(currency.id)===expected.currencyId &&
      currency.iso_code===scope.currency,'TPV_NATIVE_STATE_OR_CURRENCY_INVALID');
    const details=rows(detailsResponse,'order_details'),payments=rows(paymentsResponse,'order_payments');
    requireValue(details.length>0 && details.length<=200 && details.every(line=>Number(line.id_order)===orderId),
      'TPV_NATIVE_DETAIL_FILTER_INVALID');
    requireValue(payments.length>0 && payments.length<=20 && payments.every(payment=>
      payment.order_reference===order.reference && Number(payment.id_currency)===expected.currencyId && nativeId(payment.id)),
      'TPV_NATIVE_PAYMENT_FILTER_INVALID');
    const lines=details.map(line=>{
      const prepared=expected.lines.find(item=>item.productId===Number(line.product_id)&&item.attributeId===Number(line.product_attribute_id));
      if(prepared&&Object.hasOwn(prepared,'unitTaxInclMicros'))return {
        productId:nativeId(line.product_id),attributeId:Number(line.product_attribute_id),qty:Number(line.product_quantity),
        unitTaxInclMicros:nativeMicros(line.unit_price_tax_incl),unitTaxExclMicros:nativeMicros(line.unit_price_tax_excl),
        lineTaxInclCents:nativeCents(line.total_price_tax_incl),lineTaxExclCents:nativeCents(line.total_price_tax_excl)};
      return {productId:nativeId(line.product_id),attributeId:Number(line.product_attribute_id),
        qty:Number(line.product_quantity),unitTaxInclCents:nativeCents(line.unit_price_tax_incl),
        ...(prepared&&Object.hasOwn(prepared,'unitTaxExclMicros')?
          {unitTaxExclMicros:nativeMicros(line.unit_price_tax_excl)}:{unitTaxExclCents:nativeCents(line.unit_price_tax_excl)})};
    });
    const inventory=await readInventoryEvidence({scope:structuredClone(scope),orderId,expected:structuredClone(expected)});
    return {connectionId:scope.connectionId,storeId:scope.storeId,shopId:scope.shopId,cartId:Number(order.id_cart),orderId,
      customerId:Number(order.id_customer),invoiceAddressId:Number(order.id_address_invoice),
      deliveryAddressId:Number(order.id_address_delivery),currencyId:Number(order.id_currency),currency:currency.iso_code,
      paymentModule:order.module,stateId,statePaid:flag(state.paid),totalCents:nativeCents(order.total_paid_tax_incl),
      shippingCents:nativeCents(order.total_shipping_tax_incl),discountCents:nativeCents(order.total_discounts_tax_incl),
      receivedCents:nativeCents(order.total_paid_real),lines,inventory,
      payments:payments.map(payment=>({id:nativeId(payment.id),amountCents:nativeCents(payment.amount),
        methodLabel:payment.payment_method,currency:currency.iso_code,recordVerified:true}))};
  }
  function validatePayments({scope:requested,expected,payments}) {
    sameScope(requested);
    requireValue(typeof transport.assertMutationTarget==='function'&&transport.assertMutationTarget()===true,
      'TPV_QA_POLICY_REQUIRED');
    requireValue(Array.isArray(payments)&&payments.length===1,'TPV_NATIVE_SPLIT_PAYMENT_UNSUPPORTED');
    requireValue(['cash','card'].includes(expected.nativePaymentMethod)&&payments[0].method===expected.nativePaymentMethod&&
      expected.nativePaymentLabels?.[payments[0].method]===expected.paymentLabel,'TPV_NATIVE_PAYMENT_MAPPING_REQUIRED');
    requireValue(paymentSummary(expected.totalCents,payments).fullyPaid,'TPV_PAYMENT_NOT_SETTLED');
    return true;
  }
  return Object.freeze({ordersForCart,readSale,
    validatePayments,
    async revalidatePrepared({scope:requested,record}) {
      sameScope(requested);
      const prepared=structuredClone(record);
      await inspectCart({scope:requested,expected:prepared.expected});
      return verifyPrepared({scope:structuredClone(scope),record:prepared});
    },
    async submitOrderOnce({scope:requested,expected,payments}) {
      validatePayments({scope:requested,expected,payments});return transport.createOrderOnce(expected);
    }
  });
}
