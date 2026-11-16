/** Bind the checkout service to Central's server-only journal RPC.
 * rpc must be a service-side client, created AFTER verifying the current user.
 * Never pass the public browser client, a caller's actor ID, or raw payment data.
 */
export function createPostgresCheckoutLedger({rpc}) {
  if (typeof rpc !== 'function') throw new Error('TPV_SERVER_RPC_REQUIRED');
  async function call(action,scope,operationId,data={}) {
    const response=await rpc('totus_tpv_journal',{
      p_action:action,p_operation_id:operationId,p_scope:structuredClone(scope),p_data:structuredClone(data)
    });
    if(response?.error) {
      const message=response.error.message || '';
      throw new Error(/^TPV_[A-Z0-9_]{1,90}$/.test(message)?message:'TPV_JOURNAL_UNAVAILABLE');
    }
    if (!response || !Object.hasOwn(response,'data')) throw new Error('TPV_JOURNAL_UNAVAILABLE');
    return response.data;
  }
  const update = action => ({scope,operationId,...data}) => call(action,scope,operationId,data);
  return Object.freeze({
    get:({scope,operationId})=>call('get',scope,operationId),
    open:({scope,sessionId,openingCents})=>call('open',scope,sessionId,{openingCents}),
    prepare:({scope,operationId,expected,quoteExpiresAt})=>call('prepare',scope,operationId,{expected,quoteExpiresAt}),
    claimSubmission:update('claim'),rememberRemote:update('remember'),markUncertain:update('uncertain'),
    // Only the compact verified result and known remote ID are stored. Full
    // readback/customer payloads and credentials do not enter the journal.
    confirm:({scope,operationId,revision,token,orderId,verification})=>
      call('confirm',scope,operationId,{revision,token,orderId,verification})
  });
}

/** Same service-only boundary for physical cash. No browser may select an actor
 * or insert a counted amount directly into Central's tables.
 */
export function createPostgresCashLedger({rpc}){
 if(typeof rpc!=='function')throw new Error('TPV_SERVER_RPC_REQUIRED');
 async function call(action,{scope,requestId,...data}){
  const response=await rpc('totus_tpv_cash',{p_action:action,p_request_id:requestId,
   p_scope:structuredClone(scope),p_data:structuredClone(data)});
  if(response?.error){const message=response.error.message||'';
   throw new Error(/^TPV_[A-Z0-9_]{1,90}$/.test(message)?message:'TPV_CASH_STORAGE_UNAVAILABLE');}
  if(!response||!Object.hasOwn(response,'data'))throw new Error('TPV_CASH_STORAGE_UNAVAILABLE');
  return response.data;
 }
 return Object.freeze({summary:input=>call('summary',input),movement:input=>call('movement',input),close:input=>call('close',input)});
}
