import {barcodeTargetPage,barcodePlan} from '../barcode-options.js';
import {barcodeLabels} from '../barcode-labels.js';

/** Capture the complete membership before asking for one generation approval.
 * Each request reads one bounded native page. The durable cursor, rather than
 * browser memory, determines where an interrupted preparation resumes.
 */
export function createBarcodeService({rpc,transport,scope,authorize,nativeRequests}){
 if(typeof rpc!=='function'||typeof transport?.readNativeBarcodeTargets!=='function'||typeof authorize!=='function')
  throw Error('TPV_BARCODE_ADAPTER_REQUIRED');
 scope=structuredClone(scope);
 const journal=async(action,id,data={})=>{
  const response=await rpc('totus_tpv_barcode_jobs',{p_action:action,p_id:id,p_scope:scope,p_data:structuredClone(data)});
  if(response?.error)throw Error(/^TPV_[A-Z0-9_]{1,90}$/.test(response.error.message||'')?response.error.message:'TPV_STORAGE_UNAVAILABLE');
  if(!response||!Object.hasOwn(response,'data'))throw Error('TPV_STORAGE_UNAVAILABLE');return response.data;
 };
 const execution=async(action,id,data={})=>{
  const response=await rpc('totus_tpv_barcode_execution',{p_action:action,p_id:id,p_scope:scope,p_data:structuredClone(data)});
  if(response?.error)throw Error(/^TPV_[A-Z0-9_]{1,90}$/.test(response.error.message||'')?response.error.message:'TPV_STORAGE_UNAVAILABLE');
  if(!response||!Object.hasOwn(response,'data'))throw Error('TPV_STORAGE_UNAVAILABLE');return response.data;
 };
 return Object.freeze({
  create:id=>journal('create',id),list:()=>journal('list',null),
  get:(id,{after=0,pageSize=50}={})=>journal('get',id,{after,pageSize}),
  confirm:id=>journal('confirm',id,{accepted:true}),
  pause:id=>journal('pause',id),resume:id=>journal('resume',id),cancel:id=>journal('cancel',id),
  async labels(id,query={}){
   const job=await journal('get',id,query),targets=job.items.map(row=>({productId:row.productId,attributeId:row.attributeId}));
   if(!targets.length)return {field:job.field,items:[],skipped:[]};
   await authorize('view');
   return barcodeLabels(await transport.readNativeBarcodeLabels({field:job.field,targets}),{field:job.field,shopId:scope.shopId,targets});
  },
  async advance(id){
   if(typeof nativeRequests?.execute!=='function'||typeof nativeRequests?.recover!=='function'||typeof transport.readNativeBarcodePlan!=='function')throw Error('TPV_BARCODE_ADAPTER_REQUIRED');
   const next=await execution('next',id);
   let outcome;
   if(next.kind==='plan'){
    await authorize('edit');
    const plan=barcodePlan(await transport.readNativeBarcodePlan({field:next.field,targets:next.targets,skipExisting:true}));
    if(!plan.capability.can_execute)throw Error('TPV_BARCODE_NATIVE_HOOKS_UNREVIEWED');
    await execution('plan',id,{afterOrdinal:next.afterOrdinal,plan});
   }else if(next.kind==='execute'){
    await authorize('edit');
    outcome=await nativeRequests.execute({operationId:next.operationId,command:'barcodes.assign',payload:next.payload});
   }else if(next.kind==='recover'){
    await authorize('view');
    outcome=await nativeRequests.recover(next.operationId);
   }else if(!['idle','completed'].includes(next.kind))throw Error('TPV_BARCODE_STATE_INVALID');
   if(outcome?.status==='preserved')await execution('preserve',id,{operationId:next.operationId,proof:outcome.preserved});
   // The public view never exposes the saved command payload or intention hash.
   return journal('get',id);
  },
  async capture(id){
   const job=await journal('get',id);
   if(job.status!=='preparing')return job;
   // Current role and workstation authorization precedes native credential use.
   await authorize('edit');
   const page=barcodeTargetPage(await transport.readNativeBarcodeTargets({field:job.field,cursor:job.cursor,
    ...(job.bounds?{bounds:job.bounds}:{})}),{field:job.field,shopId:scope.shopId,cursor:job.cursor,
     ...(job.bounds?{bounds:job.bounds}:{})});
   return journal('capture',id,{fromCursor:job.cursor,page});
  }
 });
}
