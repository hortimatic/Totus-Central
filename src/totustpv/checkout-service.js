/** Server-side application service for a durably prepared sale.
 * Dependencies must be authenticated Central adapters. This is not an HTTP
 * endpoint and must never be wired directly to browser-supplied dependencies.
 * No in-memory production ledger, built-in transport retry or POSTPV dependency.
 */
import {assertSameCheckoutScope, remoteOrderKey} from './context.js';
import {paymentSummary, verifyRemoteSale} from './model.js';
import {nativePaymentPlan,verifyNativePaymentBreakdown} from './server/payment-readback.js';

const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const positive = value => Number.isSafeInteger(value) && value > 0;
const requireValue = (condition, code) => { if (!condition) throw new Error(code); };
const safeReason = error => /^TPV_[A-Z0-9_]{1,90}$/.test(error?.message || '') ? error.message : 'TPV_REMOTE_OR_STORAGE_FAILURE';
const copy = value => structuredClone(value);

/**
 * Ledger contract:
 * - get is scoped; a missing record never creates/restarts a sale.
 * - claimSubmission atomically changes ready -> dispatched, compares revision,
 *   binds immutable quote, actor and payments, and enforces one dispatch per cart.
 *   Returning won:true means that decision is already committed durably.
 * - rememberRemote/markUncertain use the claim token; never clear remote IDs.
 * - confirm atomically completes the sale and records unique payment/cash events.
 * - reconcile confirmation compares record revision, so concurrent GET recovery
 *   cannot overwrite a newer result. No lease expiration permits another POST.
 */
export function createCheckoutService({authorize, ledger, native, settlements, now = Date.now}) {
  requireValue(typeof authorize === 'function' && typeof now === 'function', 'TPV_SERVER_ADAPTER_REQUIRED');
  for (const method of ['get','claimSubmission','rememberRemote','markUncertain','confirm'])
    requireValue(typeof ledger?.[method] === 'function', 'TPV_DURABLE_LEDGER_REQUIRED');
  for (const method of ['revalidatePrepared','validatePayments','ordersForCart','submitOrderOnce','readSale'])
    requireValue(typeof native?.[method] === 'function', 'TPV_NATIVE_ADAPTER_REQUIRED');
  requireValue(typeof settlements?.verify === 'function', 'TPV_SETTLEMENT_ADAPTER_REQUIRED');

  async function load(command, action) {
    requireValue(uuid(command?.operationId), 'TPV_OPERATION_ID_INVALID');
    const scope = await authorize({selection:copy(command.selection),action});
    const record = await ledger.get({scope,operationId:command.operationId});
    requireValue(record && record.id === command.operationId, 'TPV_OPERATION_NOT_FOUND');
    assertSameCheckoutScope(scope, record.scope);
    if(action==='sell')requireValue(scope.actorId===record.scope.actorId,'TPV_PREPARED_ACTOR_MISMATCH');
    requireValue(positive(record.revision) && record.expected && record.expected.storeId === scope.storeId &&
      record.expected.shopId === scope.shopId && record.expected.currency === scope.currency &&
      positive(record.expected.cartId), 'TPV_PREPARED_SALE_INVALID');
    return {scope,record:copy(record)};
  }

  function result(record, extra = {}) {
    return {operationId:record.id,status:record.status,orderId:record.orderId ?? null,
      retryOrderForbidden:record.status !== 'ready',...extra};
  }

  async function reconcileRecord(scope, record, token = null) {
    if(record.status==='cancelled')return result(record,{retryOrderForbidden:true});
    let orderId = record.orderId ?? null;
    try {
      const orders = await native.ordersForCart({scope,cartId:record.expected.cartId});
      requireValue(Array.isArray(orders) && orders.length <= 1 && orders.every(row =>
        positive(row.orderId) && row.cartId === record.expected.cartId && row.shopId === scope.shopId &&
        row.connectionId === scope.connectionId), 'TPV_CART_ORDER_AMBIGUOUS');
      if (orderId != null) requireValue(orders.length === 1 && orders[0].orderId === orderId, 'TPV_REMOTE_ORDER_MISMATCH');
      else if (orders.length === 1) orderId = orders[0].orderId;
      requireValue(positive(orderId), 'TPV_REMOTE_ORDER_NOT_OBSERVED');
      await ledger.rememberRemote({scope,operationId:record.id,revision:record.revision,token,orderId,
        remoteKey:remoteOrderKey(scope,orderId)});
      const observed = await native.readSale({scope,operationId:record.id,sourceActorId:record.scope.actorId,orderId,expected:copy(record.expected),payments:copy(record.payments)});
      requireValue(observed?.connectionId === scope.connectionId && observed?.orderId === orderId,
        'TPV_REMOTE_CONNECTION_MISMATCH');
      verifyNativePaymentBreakdown(record.expected,record.payments,observed.payments);
      const verification = verifyRemoteSale(record.expected,observed);
      requireValue(verification.status === 'confirmed', verification.reason || 'TPV_REMOTE_VERIFICATION_FAILED');
      const confirmed = await ledger.confirm({scope,operationId:record.id,revision:record.revision,token,
        orderId,remoteKey:remoteOrderKey(scope,orderId),verification:copy(verification),observed:copy(observed)});
      requireValue(confirmed?.status === 'confirmed' && confirmed.orderId === orderId, 'TPV_CONFIRMATION_NOT_PERSISTED');
      return result({...record,...confirmed});
    } catch (error) {
      const reason = safeReason(error);
      // A failed checkpoint must not turn into another dispatch. The already
      // committed dispatch claim is itself a durable recovery barrier.
      let recoveryPersisted = false;
      try {
        const saved = await ledger.markUncertain({scope,operationId:record.id,revision:record.revision,token,orderId,reason});
        // Another reconciler may already have completed the same operation.
        if (saved?.status === 'confirmed') return result({...record,...saved});
        recoveryPersisted = saved?.status === 'uncertain';
      } catch { /* return the known remote ID even when storage is unavailable */ }
      return result({...record,status:'uncertain',orderId},{reason,recoveryPersisted});
    }
  }

  async function submit(command) {
    const {scope,record} = await load(command,'sell');
    if (record.status === 'confirmed') return result(record);
    // A second POST is forbidden even if a timed-out worker's lease has expired.
    if (record.status !== 'ready' || record.orderId != null) return result(record,{retryOrderForbidden:true});
    const clock = now();
    requireValue(Number.isFinite(record.quoteExpiresAt) && record.quoteExpiresAt > clock, 'TPV_QUOTE_EXPIRED');
    const checked = await native.revalidatePrepared({scope,record:copy(record)});
    requireValue(checked?.unchanged === true && checked?.cartId === record.expected.cartId,
      'TPV_QUOTE_CHANGED');
    // Settlements must be read/verified on the server. Never trust status:paid
    // or providerVerified sent by a caller. Cash requires operator confirmation.
    const payments = await settlements.verify({scope,operationId:record.id,expected:copy(record.expected),
      requested:copy(command.payments)});
    requireValue(paymentSummary(record.expected.totalCents,payments).fullyPaid, 'TPV_PAYMENT_NOT_SETTLED');
    nativePaymentPlan(record.expected,payments);
    requireValue(await native.validatePayments({scope,expected:copy(record.expected),payments:copy(payments)})===true,
      'TPV_NATIVE_PAYMENT_UNSUPPORTED');
    const freshScope = await authorize({selection:copy(command.selection),action:'sell'});
    assertSameCheckoutScope(scope,freshScope);
    requireValue(now() < record.quoteExpiresAt, 'TPV_QUOTE_EXPIRED');
    const claim = await ledger.claimSubmission({scope:freshScope,operationId:record.id,revision:record.revision,
      expected:copy(record.expected),payments:copy(payments),...(command.payments?.confirmation?.operatorAcknowledgement?{operatorAcknowledgement:copy(command.payments.confirmation.operatorAcknowledgement)}:{})});
    if (claim?.won !== true) return result({...record,...claim?.record},{retryOrderForbidden:true});
    requireValue(typeof claim.token === 'string' && claim.token.length >= 16, 'TPV_DISPATCH_CLAIM_INVALID');
    const dispatched = {...record,status:'dispatched',payments:copy(payments)};
    try {
      const existing = await native.ordersForCart({scope,cartId:record.expected.cartId});
      requireValue(Array.isArray(existing) && existing.length === 0, 'TPV_CART_ALREADY_ORDERED');
      const response = await native.submitOrderOnce({scope,operationId:record.id,expected:copy(record.expected),payments:copy(payments)});
      requireValue(positive(response?.orderId), 'TPV_REMOTE_ORDER_ID_MISSING');
      dispatched.orderId = response.orderId;
      await ledger.rememberRemote({scope,operationId:record.id,revision:record.revision,token:claim.token,
        orderId:response.orderId,remoteKey:remoteOrderKey(scope,response.orderId)});
    } catch {
      // A POST may have succeeded without a readable response. Only GET recovery
      // follows, including when the first checkpoint failed after success.
    }
    return reconcileRecord(scope,dispatched,claim.token);
  }

  async function reconcile(command) {
    const {scope,record} = await load(command,'reconcile');
    if (record.status === 'confirmed') return result(record);
    requireValue(['dispatched','uncertain'].includes(record.status), 'TPV_RECONCILIATION_NOT_REQUIRED');
    // No call to submitOrderOnce or settlement creation on this path.
    return reconcileRecord(scope,record);
  }
  return Object.freeze({submit,reconcile});
}
