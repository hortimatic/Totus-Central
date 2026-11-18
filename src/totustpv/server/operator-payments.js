/** Real cashier-declared payments for cash and an independent card terminal.
 * This adapter does not charge/refund a bank and does not claim provider proof.
 * The checkout journal durably binds accepted allocations and dispatched_by to
 * the immutable quote before any native order effect. Use only on the server.
 */
import {assertSameCheckoutScope} from '../context.js';
import {paymentSummary} from '../model.js';
import {paymentReference} from '../payment-reference.js';
const need=(ok,code)=>{if(!ok)throw new Error(code);};
const positive=value=>Number.isSafeInteger(value)&&value>0;
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const keys=(object,allowed)=>object&&typeof object==='object'&&!Array.isArray(object)&&
 Object.keys(object).every(key=>allowed.includes(key));
export const OPERATOR_PAYMENT_MODES=Object.freeze({cash:'cash-in-hand',card:'external-terminal',bizum:'external-receipt',transfer:'external-receipt'});
const modes=OPERATOR_PAYMENT_MODES;

export function createOperatorPaymentVerifier({authorize,readPolicy}) {
 need(typeof authorize==='function'&&typeof readPolicy==='function','TPV_OPERATOR_PAYMENT_ADAPTER_REQUIRED');
 return Object.freeze({async verify({scope,operationId,expected,requested}){
  scope=structuredClone(scope);expected=structuredClone(expected);requested=structuredClone(requested);
  need(uuid(operationId)&&uuid(scope?.actorId),'TPV_PAYMENT_IDENTITY_INVALID');
  need(keys(requested,['allocations','confirmation'])&&keys(requested.confirmation,
   ['operationId','totalCents','currency','accepted'])&&requested.confirmation.accepted===true&&
   requested.confirmation.operationId===operationId&&requested.confirmation.totalCents===expected?.totalCents&&
   requested.confirmation.currency===scope.currency,'TPV_OPERATOR_CONFIRMATION_REQUIRED');
  need(Array.isArray(requested.allocations)&&requested.allocations.length>0&&requested.allocations.length<=4,
   'TPV_PAYMENT_ALLOCATIONS_INVALID');
  const fresh=await authorize({scope:structuredClone(scope),action:'sell'});
  assertSameCheckoutScope(scope,fresh);
  need(fresh.actorId===scope.actorId,'TPV_PAYMENT_ACTOR_MISMATCH');
  const policy=await readPolicy({scope:structuredClone(scope)});
  const preparedPolicy=expected.operatorPaymentPolicy;
  need(policy?.enabled===true&&positive(policy.revision)&&preparedPolicy?.revision===policy.revision&&
   policy.environment===scope.environment&&preparedPolicy.environment===scope.environment&&
   policy.connectionId===scope.connectionId&&policy.shopId===scope.shopId&&policy.storeId===scope.storeId&&
   policy.currency===scope.currency,'TPV_PAYMENT_POLICY_STALE');
  if(policy.settingsRevision!==undefined||preparedPolicy.settingsRevision!==undefined){
   need(Number.isSafeInteger(policy.settingsRevision)&&policy.settingsRevision>=0&&
    policy.settingsRevision===preparedPolicy.settingsRevision&&policy.drawerId===scope.drawerId&&
    preparedPolicy.drawerId===scope.drawerId,'TPV_PAYMENT_POLICY_STALE');
  }
  need(new Set(requested.allocations.map(row=>row.method)).size===requested.allocations.length,
   'TPV_DUPLICATE_PAYMENT_METHOD');
  const accepted=requested.allocations.map(row=>{
   need(keys(row,['id','method','amountCents','receivedCents','reference'])&&Object.hasOwn(modes,row.method)&&
    policy.modes?.[row.method]===modes[row.method]&&preparedPolicy.modes?.[row.method]===modes[row.method],
    'TPV_PAYMENT_METHOD_NOT_CONFIGURED');
   if(row.method!=='cash')need(!Object.hasOwn(row,'receivedCents'),'TPV_NONCASH_CHANGE_FORBIDDEN');
   if(row.method==='cash')need(!Object.hasOwn(row,'reference'),'TPV_CASH_REFERENCE_FORBIDDEN');
   let reference;
   try{reference=paymentReference(row.reference);}catch{throw Error('TPV_PAYMENT_REFERENCE_INVALID');}
   if(row.method!=='cash'){
    const currentMode=policy.referencePolicy?.[row.method]??'hidden',preparedMode=preparedPolicy.referencePolicy?.[row.method]??'hidden';
    need(['hidden','optional','required'].includes(currentMode)&&currentMode===preparedMode,'TPV_PAYMENT_POLICY_STALE');
    need(currentMode!=='hidden'||reference===undefined,'TPV_PAYMENT_REFERENCE_FORBIDDEN');
    need(currentMode!=='required'||reference!==undefined,'TPV_PAYMENT_REFERENCE_REQUIRED');
   }
   return {id:row.id,method:row.method,amountCents:row.amountCents,status:'settled',
    ...(reference===undefined?{}:{reference}),
    ...(row.method==='cash'?{receivedCents:row.receivedCents}:{})};
  });
  need(paymentSummary(expected.totalCents,accepted).fullyPaid,'TPV_PAYMENT_NOT_SETTLED');
  // No HTTP/PSP call: the employee has accepted the cash or checked the terminal.
  // References are operator annotations. Never add caller-supplied provider
  // proof, a complete card number or a card security code.
  return accepted;
 }});
}
