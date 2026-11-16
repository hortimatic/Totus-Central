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
  need(positive(result.native_reference),'TPV_NATIVE_READBACK_REQUIRED');
  if(record.command==='cart.prepare')need(positive(result.cart_id)&&result.native_reference===result.cart_id&&
   result.session_id===record.payload.session_id&&result.drawer_id===record.payload.drawer_id,'TPV_NATIVE_PREPARED_CART_MISMATCH');
  else if(record.command==='cart.quote')need(result.native_reference===record.payload.cart_id&&
   result.quote?.cart_id===record.payload.cart_id&&result.quote?.shop_id===scope.shopId,'TPV_NATIVE_QUOTE_RESPONSE_INVALID');
  else if(record.command==='stock.receive')need(result.product_id===record.payload.product_id&&
   result.attribute_id===record.payload.attribute_id&&result.quantity===record.payload.quantity&&result.shop_id===scope.shopId&&
   result.stock_movement_id===result.native_reference,'TPV_NATIVE_STOCK_RESPONSE_INVALID');
  else throw new Error('TPV_NATIVE_REQUEST_INVALID');
 }
 async function recoverRecord(record){
  need(record,'TPV_NATIVE_REQUEST_NOT_FOUND');
  try{
   const read=await transport.readNativeOperation(record.id);
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
export async function nativeStepId(operationId,step){
 need(typeof operationId==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(operationId)&&['cart','quote'].includes(step),'TPV_NATIVE_OPERATION_INVALID');
 const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('TotusTPV:1:'+operationId+':'+step))).slice(0,16);
 bytes[6]=(bytes[6]&15)|128;bytes[8]=(bytes[8]&63)|128;
 const hex=[...bytes].map(byte=>byte.toString(16).padStart(2,'0')).join('');
 return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
