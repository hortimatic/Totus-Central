/**
 * TotusTPV business contracts, inside Totus Central. Original implementation.
 * No POSTPV, DOM, network, second login or independent application.
 * These pure rules are NOT Auth, a durable ledger, a payment gateway or a
 * PrestaShop adapter. Server authorization and native evidence are mandatory.
 */
const METHODS = new Set(['cash', 'card', 'bizum', 'transfer', 'voucher', 'cheque']);
const MAX_CENTS = 100_000_000_000;
function requireValue(condition, code) { if (!condition) throw new Error(code); }
function cents(value, positive = false) {
  requireValue(Number.isSafeInteger(value) && value >= (positive ? 1 : 0) && value <= MAX_CENTS, 'TPV_MONEY_INVALID');
  return value;
}
function sum(values) { return cents(values.reduce((a, b) => a + b, 0)); }
function identifier(value) { return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value); }
function unique(rows, key) {
  const ids = rows.map(key);
  requireValue(new Set(ids).size === ids.length, 'TPV_DUPLICATE_RECORD');
}

export const TOTUSTPV_MODULE = Object.freeze({id: 'totustpv', label: 'TotusTPV', path: 'tpv', host: 'Totus Central'});

/** Till preview, not proof that an operator or bank has collected anything. */
export function cashTenderPreview({totalCents,cashPartCents,receivedCents}) {
  cents(totalCents,true);cents(cashPartCents);cents(receivedCents);
  requireValue(cashPartCents<=totalCents,'TPV_PAYMENT_TOTAL_MISMATCH');
  requireValue(cashPartCents>0||receivedCents===0,'TPV_NONCASH_CHANGE_FORBIDDEN');
  return {cashPartCents,cardPartCents:totalCents-cashPartCents,receivedCents,
    changeCents:Math.max(0,receivedCents-cashPartCents),
    missingCents:Math.max(0,cashPartCents-receivedCents),cashCovered:receivedCents>=cashPartCents};
}

/** Payment status comes from trusted server evidence, never from a browser flag. */
export function paymentSummary(totalCents, allocations, {allowCredit = false} = {}) {
  cents(totalCents, true);
  requireValue(Array.isArray(allocations) && (allocations.length > 0 || allowCredit), 'TPV_PAYMENTS_REQUIRED');
  unique(allocations, row => row.id);
  let changeCents = 0;
  for (const row of allocations) {
    requireValue(identifier(row.id) && METHODS.has(row.method), 'TPV_PAYMENT_METHOD_INVALID');
    cents(row.amountCents, true);
    requireValue(['settled', 'pending'].includes(row.status), 'TPV_PAYMENT_STATUS_INVALID');
    if (row.method === 'cash') {
      cents(row.receivedCents);
      requireValue(row.receivedCents >= row.amountCents, 'TPV_CASH_INSUFFICIENT');
      changeCents += row.receivedCents - row.amountCents;
    } else {
      requireValue(row.receivedCents == null || row.receivedCents === row.amountCents, 'TPV_NONCASH_CHANGE_FORBIDDEN');
    }
  }
  const allocatedCents = sum(allocations.map(row => row.amountCents));
  requireValue(allocatedCents <= totalCents && (allowCredit || allocatedCents === totalCents), 'TPV_PAYMENT_TOTAL_MISMATCH');
  const collectedCents = sum(allocations.filter(row => row.status === 'settled').map(row => row.amountCents));
  return {
    totalCents, allocatedCents, collectedCents,
    outstandingCents: totalCents - collectedCents,
    cashAppliedCents: sum(allocations.filter(row => row.status === 'settled' && row.method === 'cash').map(row => row.amountCents)),
    changeCents: cents(changeCents), fullyPaid: collectedCents === totalCents
  };
}

/** Physical cash excludes card/Bizum/transfer and cash change already returned. */
export function cashSessionSummary({storeId, drawerId, sessionId, currency, openingCents, entries, countedCents}) {
  requireValue([storeId, drawerId, sessionId].every(identifier) && /^[A-Z]{3}$/.test(currency), 'TPV_CASH_SCOPE_INVALID');
  cents(openingCents);
  requireValue(Array.isArray(entries), 'TPV_CASH_ENTRIES_INVALID');
  unique(entries, row => row.id);
  let expectedCashCents = openingCents;
  for (const row of entries) {
    requireValue(identifier(row.id) && row.storeId === storeId && row.drawerId === drawerId && row.sessionId === sessionId && row.currency === currency, 'TPV_CASH_SCOPE_MISMATCH');
    requireValue(METHODS.has(row.method), 'TPV_PAYMENT_METHOD_INVALID');
    cents(row.amountCents, true);
    requireValue(['sale', 'refund', 'cash-in', 'cash-out', 'transfer-in', 'transfer-out'].includes(row.kind), 'TPV_CASH_KIND_INVALID');
    if (row.method !== 'cash') {
      requireValue(['sale', 'refund'].includes(row.kind), 'TPV_NONCASH_DRAWER_MOVEMENT');
      continue;
    }
    expectedCashCents += (['sale', 'cash-in', 'transfer-in'].includes(row.kind) ? 1 : -1) * row.amountCents;
    requireValue(Number.isSafeInteger(expectedCashCents) && Math.abs(expectedCashCents) <= MAX_CENTS, 'TPV_CASH_BALANCE_INVALID');
  }
  requireValue(expectedCashCents >= 0, 'TPV_CASH_BALANCE_NEGATIVE');
  if (countedCents != null) cents(countedCents);
  return {openingCents, expectedCashCents, countedCents: countedCents ?? null, differenceCents: countedCents == null ? null : countedCents - expectedCashCents};
}

const TRANSITIONS = Object.freeze({
  draft: {quote: 'quoting', park: 'parked', cancel: 'cancelled'},
  quoting: {ready: 'ready', edit: 'draft', reject: 'draft'},
  ready: {submit: 'submitting', edit: 'draft', park: 'parked'},
  submitting: {timeout: 'uncertain', reject: 'uncertain', verify: 'verifying'},
  verifying: {mismatch: 'uncertain'},
  uncertain: {reconcile: 'verifying'},
  parked: {resume: 'draft'}, confirmed: {}, cancelled: {}
});
export function saleTransition(current, event, verification = null) {
  if (current === 'verifying' && event === 'confirm') {
    requireValue(verification?.status === 'confirmed' && verification?.readbackVerified === true, 'TPV_READBACK_REQUIRED');
    return 'confirmed';
  }
  const next = TRANSITIONS[current]?.[event];
  requireValue(Boolean(next), 'TPV_TRANSITION_FORBIDDEN');
  return next;
}
export function canSubmitSale({state, remoteOrderId = null}) {
  return state === 'ready' && remoteOrderId == null;
}

function productKey(row) { return `${row.productId}:${row.attributeId}`; }
function validLine(row) {
  return Number.isSafeInteger(row.productId) && row.productId > 0 && Number.isSafeInteger(row.attributeId) && row.attributeId >= 0 && Number.isSafeInteger(row.qty) && row.qty > 0 && row.qty <= 10_000;
}
/**
 * Classifies a re-read of ONE already submitted order; never sends/retries it.
 * Inputs must be prepared by the authorized native server adapter. Exact
 * stock deltas require an isolated observation; concurrent/ambiguous stock
 * remains uncertain until native movement evidence can attribute the change.
 */
export function verifyRemoteSale(expected, observed) {
  const orderId = Number.isSafeInteger(observed?.orderId) && observed.orderId > 0 ? observed.orderId : null;
  try {
    requireValue(orderId != null, 'TPV_ORDER_ID_MISSING');
    requireValue(expected && identifier(expected.storeId) && /^[A-Z]{3}$/.test(expected.currency) && Number.isSafeInteger(expected.shopId) && expected.shopId > 0 && Number.isSafeInteger(expected.cartId) && expected.cartId > 0 && identifier(expected.paymentModule), 'TPV_ORDER_EXPECTATION_INVALID');
    requireValue(expected && observed.storeId === expected.storeId && observed.shopId === expected.shopId && observed.cartId === expected.cartId && observed.currency === expected.currency && observed.paymentModule === expected.paymentModule, 'TPV_ORDER_SCOPE_MISMATCH');
    requireValue(['customerId','invoiceAddressId','deliveryAddressId','currencyId'].every(key =>
      Number.isSafeInteger(expected[key]) && expected[key] > 0 && observed[key] === expected[key]),
      'TPV_ORDER_CUSTOMER_OR_CURRENCY_MISMATCH');
    cents(expected.totalCents, true); cents(expected.shippingCents);
    requireValue(observed.totalCents === expected.totalCents && observed.shippingCents === expected.shippingCents, 'TPV_ORDER_TOTAL_MISMATCH');
    if(Object.hasOwn(expected,'totalTaxExclCents')){
      cents(expected.totalTaxExclCents);
      requireValue(expected.totalTaxExclCents<=expected.totalCents&&observed.totalTaxExclCents===expected.totalTaxExclCents,'TPV_ORDER_TAX_TOTAL_MISMATCH');
    }
    requireValue(Array.isArray(expected.paidStateIds) && expected.paidStateIds.length > 0 && expected.paidStateIds.every(id => Number.isSafeInteger(id) && id > 0), 'TPV_STATE_MAPPING_REQUIRED');
    requireValue(Number.isSafeInteger(observed.stateId) && observed.stateId > 0, 'TPV_ORDER_STATE_MISSING');
    requireValue(expected.paidStateIds.includes(observed.stateId) && observed.statePaid === true, 'TPV_ORDER_STATE_MISMATCH');
    requireValue(Array.isArray(expected.lines) && expected.lines.length > 0 && expected.lines.every(validLine) && Array.isArray(observed.lines) && observed.lines.every(validLine), 'TPV_ORDER_LINES_INVALID');
    unique(expected.lines, productKey); unique(observed.lines, productKey);
    requireValue(expected.lines.length === observed.lines.length, 'TPV_ORDER_LINES_MISMATCH');
    for (const line of expected.lines) {
      const actual = observed.lines.find(item => productKey(item) === productKey(line));
      if(Object.hasOwn(line,'unitTaxInclMicros')) {
        requireValue(['unitTaxInclMicros','unitTaxExclMicros'].every(key=>Number.isSafeInteger(line[key])&&
          line[key]>=0&&line[key]<=MAX_CENTS*10000)&&line.unitTaxExclMicros<=line.unitTaxInclMicros,
          'TPV_ORDER_TAX_INVALID');
        requireValue(!Object.hasOwn(line,'unitTaxInclCents')&&!Object.hasOwn(line,'unitTaxExclCents'),
          'TPV_ORDER_LINES_INVALID');
        cents(line.lineTaxInclCents);cents(line.lineTaxExclCents);
        requireValue(line.lineTaxExclCents<=line.lineTaxInclCents,'TPV_ORDER_TAX_INVALID');
        requireValue(actual&&actual.qty===line.qty&&['unitTaxInclMicros','unitTaxExclMicros','lineTaxInclCents',
          'lineTaxExclCents'].every(key=>actual[key]===line[key]),'TPV_ORDER_LINES_MISMATCH');
        if(expected.nativeRoundType===3){
          requireValue(['lineTaxInclMicros','lineTaxExclMicros'].every(key=>Number.isSafeInteger(line[key])&&line[key]>=0&&line[key]<=MAX_CENTS*10000&&actual[key]===line[key])&&line.lineTaxExclMicros<=line.lineTaxInclMicros,'TPV_ORDER_LINES_MISMATCH');
        }
        continue;
      }
      cents(line.unitTaxInclCents, true);
      let excludedMatches;
      if(Object.hasOwn(line,'unitTaxExclMicros')) {
        requireValue(Number.isSafeInteger(line.unitTaxExclMicros)&&line.unitTaxExclMicros>=0&&
          line.unitTaxExclMicros<=line.unitTaxInclCents*10000,'TPV_ORDER_TAX_INVALID');
        excludedMatches=actual?.unitTaxExclMicros===line.unitTaxExclMicros;
      } else {
        cents(line.unitTaxExclCents);
        requireValue(line.unitTaxExclCents <= line.unitTaxInclCents, 'TPV_ORDER_TAX_INVALID');
        excludedMatches=actual?.unitTaxExclCents===line.unitTaxExclCents;
      }
      requireValue(actual && actual.qty === line.qty && actual.unitTaxInclCents === line.unitTaxInclCents && excludedMatches, 'TPV_ORDER_LINES_MISMATCH');
    }
    const merchandiseCents = sum(expected.lines.map(line => Object.hasOwn(line,'unitTaxInclMicros')?
      line.lineTaxInclCents:line.qty * line.unitTaxInclCents));
    const discountCents = cents(expected.discountCents ?? 0);
    requireValue(discountCents <= merchandiseCents && merchandiseCents + expected.shippingCents - discountCents === expected.totalCents && (observed.discountCents ?? 0) === discountCents, 'TPV_ORDER_EXPECTED_TOTAL_INVALID');
    requireValue(Array.isArray(observed.payments) && observed.payments.length > 0, 'TPV_PAYMENT_RECORD_MISSING');
    unique(observed.payments, row => row.id);
    for (const payment of observed.payments) {
      requireValue(Number.isSafeInteger(payment.id) && payment.id > 0 && payment.currency === expected.currency && payment.recordVerified === true, 'TPV_PAYMENT_RECORD_UNVERIFIED');
      cents(payment.amountCents, true);
    }
    requireValue(sum(observed.payments.map(row => row.amountCents)) === expected.totalCents && observed.receivedCents === expected.totalCents, 'TPV_PAYMENT_RECORD_TOTAL_MISMATCH');
    requireValue(Array.isArray(observed.inventory) && observed.inventory.length === expected.lines.length, 'TPV_STOCK_EVIDENCE_MISSING');
    unique(observed.inventory, productKey);
    const movementIds = new Set();
    for (const line of expected.lines) {
      const inventory = observed.inventory.find(item => productKey(item) === productKey(line));
      requireValue(inventory && inventory.ambiguous === false,'TPV_STOCK_DELTA_UNVERIFIED');
      if(inventory.mode === 'native-movements') {
        requireValue(inventory.orderId === orderId && inventory.recordVerified === true &&
          inventory.deductedQty === line.qty && inventory.stockRecordId === line.stockRecordId &&
          Number.isSafeInteger(inventory.stockRecordId) && inventory.stockRecordId > 0 &&
          Array.isArray(inventory.movementIds) && inventory.movementIds.length > 0 &&
          inventory.movementIds.every(id=>Number.isSafeInteger(id) && id>0 && !movementIds.has(id)),
          'TPV_STOCK_MOVEMENT_UNVERIFIED');
        unique(inventory.movementIds,id=>id);
        inventory.movementIds.forEach(id=>movementIds.add(id));
      } else {
        requireValue(inventory.mode === 'isolated-fixture' && Number.isSafeInteger(line.stockBefore) &&
          line.stockBefore >= line.qty && inventory.before === line.stockBefore && inventory.after === line.stockBefore - line.qty,
          'TPV_STOCK_DELTA_UNVERIFIED');
      }
    }
    return {status: 'confirmed', orderId, readbackVerified: true};
  } catch (error) {
    return {status: 'uncertain', orderId, retryOrderForbidden: true, reason: error.message};
  }
}

export function returnQuantityRemaining(soldQty, returnedQty, requestedQty) {
  requireValue([soldQty, returnedQty, requestedQty].every(Number.isSafeInteger) && soldQty > 0 && returnedQty >= 0 && requestedQty > 0 && returnedQty + requestedQty <= soldQty, 'TPV_RETURN_QUANTITY_INVALID');
  return soldQty - returnedQty - requestedQty;
}
