/** A manifest is persisted before any stock command is dispatched. Process one
 * pending line per request, retaining all verified lines across interruptions. */
export function createStockReceiptService({rpc,nativeRequests,scope}){
 const journal=async(action,id,data={})=>{
  const response=await rpc('totus_tpv_stock_receipts',{p_action:action,p_id:id,p_scope:scope,p_data:data});
  if(response?.error)throw Error(/^TPV_[A-Z0-9_]{1,90}$/.test(response.error.message||'')?response.error.message:'TPV_STORAGE_UNAVAILABLE');
  if(!response||!Object.hasOwn(response,'data'))throw Error('TPV_STORAGE_UNAVAILABLE');return response.data;
 };
 return Object.freeze({
  create:(id,payload)=>journal('create',id,payload),
  list:()=>journal('list',null),
  get:id=>journal('get',id),
  cancel:id=>journal('cancel',id),
  async advance(id){
   const receipt=await journal('start',id);
   if(receipt.status!=='processing')return receipt;
   const line=receipt.lines.find(row=>row.status!=='verified');if(!line)return receipt;
   if(line.status==='pending')await nativeRequests.execute({operationId:line.operationId,command:'stock.receive',
    payload:{product_id:line.productId,attribute_id:line.attributeId,quantity:line.quantity,reason:receipt.reason}});
   else await nativeRequests.recover(line.operationId);
   return journal('get',id);
  }
 });
}
