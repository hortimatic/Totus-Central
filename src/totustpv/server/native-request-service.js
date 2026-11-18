/** Durable preparation/stock commands. A lost response can only trigger GET
 * recovery. A process restart or a second click never grants a second POST.
 */
const need=(ok,code)=>{if(!ok)throw new Error(code);};
const positive=value=>Number.isSafeInteger(value)&&value>0;
export function createNativeRequestService({rpc,transport,scope}){
 need(typeof rpc==='function'&&typeof transport?.nativeCommand==='function'&&typeof transport?.readNativeOperation==='function',
  'TPV_NATIVE_REQUEST_ADAPTER_REQUIRED');
 scope=structuredClone(scope);
 async function journal(action,id,data={}){
  const response=await rpc('totus_tpv_native_command',{p_action:action,p_id:id,p_scope:scope,p_data:structuredClone(data)});
  if(response?.error)throw new Error(/^TPV_[A-Z0-9_]{1,90}$/.test(response.error.message||'')?response.error.message:'TPV_NATIVE_STORAGE_UNAVAILABLE');
  need(response&&Object.hasOwn(response,'data'),'TPV_NATIVE_STORAGE_UNAVAILABLE');return response.data;
 }
 function verify(record,result){
  need(result?.verified===true,'TPV_NATIVE_READBACK_REQUIRED');
  if(record.command==='setup.qa'){
   need(result.native_reference===scope.nativeInstallationId&&result.environment==='qa'&&
    ['carrier_id','counter_customer_id','counter_address_id','preparing_state_id','paid_state_id'].every(key=>positive(result[key])),
    'TPV_NATIVE_SETUP_READBACK_REQUIRED');return;
  }
  if(record.command==='barcodes.assign'){
   const p=record.payload,schemes={ean13:'rcn13-04',upc:'rcn12-4',reference:'totus-reference'};
   const item=p?.items?.[p.item_index];
   need(item&&Object.hasOwn(schemes,p.field),'TPV_NATIVE_BARCODE_RESPONSE_INVALID');
   const expected={verified:true,native_reference:record.id,shop_id:scope.shopId,plan_version:1,
    field:p.field,scheme:schemes[p.field],plan_fingerprint:p.plan_fingerprint,item_index:p.item_index,items:[item],count:1};
   // Compare the whole immutable receipt, including the selected variant and code.
   const canonical=value=>JSON.stringify(value,(_,row)=>row&&typeof row==='object'&&!Array.isArray(row)?
    Object.fromEntries(Object.keys(row).sort().map(key=>[key,row[key]])):row);
   need(canonical(result)===canonical(expected),'TPV_NATIVE_BARCODE_RESPONSE_INVALID');return;
  }
  need(positive(result.native_reference),'TPV_NATIVE_READBACK_REQUIRED');
  if(record.command==='cart.prepare')need(positive(result.cart_id)&&result.native_reference===result.cart_id&&
   result.session_id===record.payload.session_id&&result.drawer_id===record.payload.drawer_id&&
   (record.payload.commercial_only??false)===(result.commercial_only??false),'TPV_NATIVE_PREPARED_CART_MISMATCH');
  else if(record.command==='cart.quote')need(result.native_reference===record.payload.cart_id&&
   result.quote?.cart_id===record.payload.cart_id&&result.quote?.shop_id===scope.shopId&&
   (record.payload.commercial_only??false)===(result.quote?.commercial_only??false),'TPV_NATIVE_QUOTE_RESPONSE_INVALID');
  else if(record.command==='stock.receive')need(result.product_id===record.payload.product_id&&
   result.attribute_id===record.payload.attribute_id&&result.quantity===record.payload.quantity&&result.shop_id===scope.shopId&&
   result.stock_movement_id===result.native_reference,'TPV_NATIVE_STOCK_RESPONSE_INVALID');
  else throw new Error('TPV_NATIVE_REQUEST_INVALID');
 }
 async function recoverRecord(record){
  need(record,'TPV_NATIVE_REQUEST_NOT_FOUND');
  try{
   const read=await transport.readNativeOperation(record.id);
   if(record.command==='barcodes.assign'&&read?.status==='preserved'){
    const p=record.payload,item=p.items[p.item_index],proof=read.preserved;
    need(read.operation_id===record.id&&read.native_command==='barcodes.assign'&&read.retry_command_forbidden===true&&read.execution_finished===true&&read.effect_observed===false&&read.failure_code==='TOTUS_BARCODE_FIELD_ALREADY_SET'&&
     proof&&Object.keys(proof).length===8&&proof.plan_version===1&&proof.shop_id===scope.shopId&&proof.field===p.field&&proof.product_id===item.product_id&&proof.attribute_id===item.attribute_id&&proof.plan_fingerprint===p.plan_fingerprint&&proof.item_index===p.item_index&&typeof proof.code==='string'&&Array.from(proof.code).length>0&&Array.from(proof.code).length<=64,'TPV_NATIVE_BARCODE_RESPONSE_INVALID');
    await journal('uncertain',record.id);
    return {operationId:record.id,status:'preserved',preserved:{...proof},retryCommandForbidden:true};
   }
   need(read?.status==='verified'&&read.operation_id===record.id,'TPV_NATIVE_RESULT_UNCERTAIN');
   verify(record,read.result);
   const saved=await journal('complete',record.id,{result:read.result});
   need(saved?.status==='verified','TPV_NATIVE_STORAGE_UNAVAILABLE');
   return {operationId:record.id,status:'verified',result:saved.result,retryCommandForbidden:true};
  }catch{
   try{await journal('uncertain',record.id);}catch{}
   return {operationId:record.id,status:'uncertain',retryCommandForbidden:true};
  }
 }
 return Object.freeze({
  async execute({operationId,command,payload}){
   const record=await journal('claim',operationId,{command,payload});
   need(record,'TPV_NATIVE_REQUEST_NOT_FOUND');
   if(record.won===true){try{await transport.nativeCommand({operationId,command,payload});}catch{}}
   return recoverRecord(record);
  },async recover(operationId){return recoverRecord(await journal('get',operationId));}
 });
}

/** Stable sub-operation identities survive a server restart between cart,
 * quote and prepared-sale persistence. They are not authentication tokens.
 */
export async function nativeStepId(operationId,step,purpose='sale'){
 need(typeof operationId==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(operationId)&&['cart','quote'].includes(step)&&['sale','budget'].includes(purpose),'TPV_NATIVE_OPERATION_INVALID');
 const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode((purpose==='sale'?'TotusTPV:1:':'TotusTPV:budget:1:')+operationId+':'+step))).slice(0,16);
 bytes[6]=(bytes[6]&15)|128;bytes[8]=(bytes[8]&63)|128;
 const hex=[...bytes].map(byte=>byte.toString(16).padStart(2,'0')).join('');
 return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
