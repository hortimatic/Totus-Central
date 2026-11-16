/** Use the SAME verified directory writer and durable publication journal as
 * Central's Customers module. No second customer store or alternate save path. */
import {writeContactDirectory} from '../../../supabase/functions/totus-connections/contact-directory-write.js';
const need=(ok,code)=>{if(!ok)throw Error(code);};
export async function writeTpvCustomer({input,scope,websiteKey,websiteName,connection,rpc,request,resolve}){
 need(['customers','addresses'].includes(input.resource)&&['create','update'].includes(input.operation)&&
  input.fields&&typeof input.fields==='object'&&!Array.isArray(input.fields),'TPV_CUSTOMER_REQUEST_INVALID');
 const base={kind:'clientes',store:websiteKey,id:scope.connectionId,revision:scope.connectionRevision,
  call_id:crypto.randomUUID(),request_id:input.operationId,resource:input.resource,operation:input.operation,fields:input.fields,
  ...(input.operation==='update'?{record_id:String(input.recordId)}:{})};
 let claimAttempted=false,pendingObserved=false;
 async function call(action,signature,record_id,metadata={}){if(action==='claim')claimAttempted=true;const response=await rpc('totus_directory_operation',{
  p_action:action,p_request_id:input.operationId,p_data:{actor_id:scope.actorId,connection_id:scope.connectionId,
   revision:scope.connectionRevision,resource:input.resource,operation:input.operation,signature,...metadata,...(record_id?{record_id}:{})}});
  if(response?.error)throw Error('TPV_CUSTOMER_PUBLICATION_PENDING');if(action==='lookup'&&response.data)pendingObserved=true;return response.data;}
 const journal={lookup:signature=>call('lookup',signature),claim:(signature,id,metadata)=>call('claim',signature,id,metadata),
  complete:(signature,id)=>call('complete',signature,id),uncertain:(signature,id)=>call('uncertain',signature,id)};
 const bound={...connection,store_key:websiteKey,website_name:websiteName,website_origin:'https://preproduccion.hortimatic.com'},
  options={request,resolve,journal,nativeShopId:scope.shopId};
 try{const prepared=await writeContactDirectory(bound,{...base,action:'prestashop_directory_prepare'},options);
 if(prepared.verified===true&&(prepared.persisted===true||prepared.unchanged===true))return prepared;
 need(prepared.can_commit===true&&/^[a-f0-9]{64}$/.test(prepared.fingerprint||''),'TPV_CUSTOMER_PREPARATION_FAILED');
 return await writeContactDirectory(bound,{...base,action:'prestashop_directory_commit',fingerprint:prepared.fingerprint,confirmed:true},options);
 }catch(error){if(claimAttempted||pendingObserved)throw Error('TPV_CUSTOMER_PUBLICATION_PENDING');
  const rejected=Error('TPV_CUSTOMER_FIELDS_REJECTED');
  if(/^(?:Email|Nombre|Texto|Campo|Indicador|Falta|Selecciona|Ya existe|Relación|El campo|Provincia|País|Los datos)/.test(error.message||'')&&error.message.length<=240)rejected.detail=error.message;
  throw rejected;
 }
}
