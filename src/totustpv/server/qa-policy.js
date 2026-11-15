/** Current deployment stage: mutations may target only explicitly bound QA.
 * Policy is server-owned configuration, never JSON supplied by the browser.
 * Passing an ordinary checkout feature flag cannot lift this environment gate.
 */
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const need=(value,code)=>{if(!value)throw new Error(code);};
const normalizedHost=origin=>new URL(origin).hostname.toLowerCase().replace(/^www\./,'');
export function assertQaTarget(connection,scope,policy){
 need(policy?.stage==='preproduction'&&policy.nativeVersion==='8.2.8'&&uuid(policy.connectionId)&&
  typeof policy.origin==='string'&&Array.isArray(policy.protectedOrigins)&&policy.protectedOrigins.length>0&&
  Array.isArray(policy.protectedConnectionIds)&&policy.protectedConnectionIds.length>0&&
  policy.protectedConnectionIds.every(uuid),'TPV_QA_POLICY_REQUIRED');
 let expected,actual;try{expected=new URL(policy.origin);actual=new URL(connection.endpoint);}catch{throw new Error('TPV_QA_ORIGIN_INVALID');}
 need(expected.protocol==='https:'&&!expected.username&&!expected.password&&expected.origin===policy.origin&&
  !expected.port&&!actual.username&&!actual.password,'TPV_QA_ORIGIN_INVALID');
 let protectedHosts;try{protectedHosts=policy.protectedOrigins.map(value=>{
  const url=new URL(value);need(url.protocol==='https:'&&url.origin===value,'TPV_QA_POLICY_INVALID');return normalizedHost(value);
 });}catch{throw new Error('TPV_QA_POLICY_INVALID');}
 need(!protectedHosts.includes(normalizedHost(actual.origin))&&
  !protectedHosts.includes(normalizedHost(policy.origin))&&
  !policy.protectedConnectionIds.includes(connection.id),'TPV_QA_PRODUCTION_FORBIDDEN');
 need(scope.environment==='qa'&&connection.id===policy.connectionId&&scope.connectionId===policy.connectionId&&
  actual.origin===policy.origin&&connection.website_origin===policy.origin,'TPV_QA_TARGET_MISMATCH');
 return true;
}

/** Only a proposed identity-preserving transition, never an executable switch.
 * Native order/customer IDs remain scoped to their original connection IDs.
 */
export function planDomainTransition({candidate,retiring,targetOrigin,acceptance}){
 need(candidate&&retiring&&uuid(candidate.connectionId)&&uuid(retiring.connectionId)&&
  candidate.connectionId!==retiring.connectionId&&candidate.nativeVersion==='8.2.8'&&
  uuid(candidate.businessId)&&candidate.businessId===retiring.businessId&&
  uuid(candidate.installationId)&&uuid(retiring.installationId)&&
  candidate.installationId!==retiring.installationId,'TPV_CUTOVER_IDENTITIES_REQUIRED');
 const required=['sales','mixedPayments','refunds','stock','users','cashDrawers','recovery','documents',
  'migrationRehearsal','qaDataIsolation','legacyHistory'];
 need(acceptance?.approved===true&&required.every(key=>acceptance[key]===true),'TPV_CUTOVER_NOT_READY');
 let target,source;try{target=new URL(targetOrigin);source=new URL(candidate.origin);}catch{throw new Error('TPV_CUTOVER_ORIGIN_INVALID');}
 need(target.protocol==='https:'&&target.origin===targetOrigin&&targetOrigin===retiring.origin&&
  source.protocol==='https:'&&source.origin===candidate.origin&&candidate.origin!==targetOrigin,'TPV_CUTOVER_ORIGIN_INVALID');
 return {executable:false,requiresExplicitCutover:true,connectionId:candidate.connectionId,
  installationId:candidate.installationId,businessId:candidate.businessId,from:candidate.origin,to:targetOrigin,
  retireConnectionId:retiring.connectionId,disableRetiredEndpointBeforeSwitch:true,
  preserveRetiredHistory:true,mergeNativeIds:false,excludeQaOperationsFromLiveTotals:true};
}
