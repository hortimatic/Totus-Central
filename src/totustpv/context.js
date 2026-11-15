/** Resolve only records loaded by Central's authenticated server context.
 * This validator does not authenticate callers or replace the server/RLS.
 * No operator, connection secret or drawer is invented from browser labels.
 */
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const positive = value => Number.isSafeInteger(value) && value > 0;
const requireValue = (condition, code) => { if (!condition) throw new Error(code); };
const SCOPE_FIELDS = ['connectionId','connectionRevision','storeId','shopId','drawerId','sessionId','currency','environment'];

export function resolveCheckoutContext(selection, records) {
  requireValue(selection && records, 'TPV_CONTEXT_REQUIRED');
  const {actor, connection, store, website, drawer, session, authorization} = records;
  requireValue(actor && uuid(actor.id) && actor.active === true, 'TPV_ACTOR_INACTIVE');
  requireValue(connection && uuid(connection.id) && positive(connection.revision) && connection.active === true,
    'TPV_CONNECTION_INACTIVE');
  requireValue(store && uuid(store.id) && store.active === true, 'TPV_STORE_INACTIVE');
  requireValue(website && website.status === 'active' && website.connection_id === connection.id &&
    website.store_id === store.id && positive(website.shop_id), 'TPV_WEBSITE_MAPPING_REQUIRED');
  requireValue(drawer && uuid(drawer.id) && drawer.active === true && drawer.store_id === store.id,
    'TPV_DRAWER_STORE_MISMATCH');
  requireValue(session && uuid(session.id) && session.status === 'open' && session.drawer_id === drawer.id &&
    session.store_id === store.id && session.currency === website.currency && /^[A-Z]{3}$/.test(session.currency),
    'TPV_CASH_SESSION_MISMATCH');
  // authorization is the result of a current server query, not JWT user_metadata.
  requireValue(authorization && authorization.actor_id === actor.id && authorization.store_id === store.id &&
    authorization.connection_id === connection.id && authorization.drawer_id === drawer.id &&
    authorization.session_id === session.id && authorization.sell === true, 'TPV_SELL_FORBIDDEN');
  const context = {actorId:actor.id, connectionId:connection.id, connectionRevision:connection.revision,
    storeId:store.id, shopId:website.shop_id, drawerId:drawer.id, sessionId:session.id, currency:session.currency};
  if(session.environment!==undefined||selection.environment!==undefined){
    requireValue(['qa','production'].includes(session.environment)&&selection.environment===session.environment,
      'TPV_ENVIRONMENT_MISMATCH');context.environment=session.environment;
  }
  requireValue(SCOPE_FIELDS.every(key => selection[key] === context[key]), 'TPV_CONTEXT_STALE');
  return Object.freeze(context);
}

export function assertSameCheckoutScope(expected, actual) {
  requireValue(expected && actual && SCOPE_FIELDS.every(key => expected[key] === actual[key]), 'TPV_OPERATION_SCOPE_MISMATCH');
}

export function remoteOrderKey(scope, orderId) {
  requireValue(uuid(scope?.connectionId) && positive(scope.shopId) && positive(orderId), 'TPV_REMOTE_ID_INVALID');
  // Native IDs collide between installations. Connection revision is not part of
  // identity: rotating credentials must not make an existing order a new sale.
  return `${scope.connectionId}:${scope.shopId}:${orderId}`;
}
