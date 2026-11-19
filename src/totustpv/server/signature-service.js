import {signatureInk} from '../signature-capture.js';
import {signatureHash,signatureOriginal} from './signature-pdf.js';
const need=(ok,code)=>{if(!ok)throw Error(code);};
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function inkValue(value){try{return signatureInk(value);}catch{throw Error('TPV_SIGNATURE_INK_INVALID');}}
async function stored(record){
 if(record===null)return null;
 need(record&&uuid(record.id)&&uuid(record.operationId)&&Number.isSafeInteger(record.orderId)&&record.orderId>0&&['prepared','signed','cancelled'].includes(record.status)&&record.original?.order_id===record.orderId&&typeof record.actorName==='string'&&typeof record.acceptanceText==='string','TPV_SIGNATURE_STORAGE_MISMATCH');
 await signatureOriginal(record.original);
 if(record.status==='signed'){
  inkValue(record.ink);const doc=record.signed;
  need(doc?.mime==='application/pdf'&&doc.filename==='totus-invoice-'+record.orderId+'-firmada.pdf'&&doc.originalSha256===record.original.sha256&&typeof doc.base64==='string'&&doc.base64.length<=3000000&&/^JVBERi0[A-Za-z0-9+/]*={0,2}$/.test(doc.base64)&&/^[a-f0-9]{64}$/.test(doc.sha256||''),'TPV_SIGNATURE_STORAGE_MISMATCH');
  let bytes;try{bytes=Uint8Array.from(atob(doc.base64),c=>c.charCodeAt(0));}catch{throw Error('TPV_SIGNATURE_STORAGE_MISMATCH');}
  need(await signatureHash(bytes)===doc.sha256,'TPV_SIGNATURE_STORAGE_MISMATCH');
 }
 return record;
}
/** No native mutation: capture one issued PDF, sign that immutable snapshot, recover it. */
export function createSignatureService({rpc,transport,scope,render,now=Date.now}){
 need(typeof rpc==='function'&&typeof render==='function'&&typeof render.validateOriginal==='function','TPV_SIGNATURE_UNAVAILABLE');scope=structuredClone(scope);
 async function call(name,args){const response=await rpc(name,args);if(response?.error)throw Error(/^TPV_[A-Z0-9_]{1,90}$/.test(response.error.message||'')?response.error.message:'TPV_SIGNATURE_STORAGE_UNAVAILABLE');need(response&&Object.hasOwn(response,'data'),'TPV_SIGNATURE_STORAGE_UNAVAILABLE');return response.data;}
 const journal=(action,id,data={})=>{need(uuid(id),'TPV_SIGNATURE_REQUEST_INVALID');return call('totus_tpv_signature_journal',{p_action:action,p_id:id,p_scope:scope,p_data:data});};
 const get=async id=>{const record=await stored(await journal('get',id));need(!record||record.id===id,'TPV_SIGNATURE_STORAGE_MISMATCH');return record;};
 return Object.freeze({get,
  async find(saleId){const record=await stored(await journal('find',saleId));need(!record||record.operationId===saleId,'TPV_SIGNATURE_STORAGE_MISMATCH');return record;},
  async prepare({operationId,saleId}){
   need(uuid(operationId)&&uuid(saleId),'TPV_SIGNATURE_REQUEST_INVALID');
   const existing=await get(operationId);if(existing){need(existing.operationId===saleId,'TPV_SIGNATURE_ALREADY_BOUND');need(existing.status!=='cancelled','TPV_SIGNATURE_CANCELLED');if(existing.status==='prepared')need(Date.parse(existing.expiresAt)>now(),'TPV_SIGNATURE_EXPIRED');return existing;}
   const sales=await call('totus_tpv_orders',{p_scope:scope,p_order_id:null,p_sale_id:saleId}),sale=sales?.[0];
   need(Array.isArray(sales)&&sales.length===1&&sale.id===saleId&&sale.status==='confirmed'&&Number.isSafeInteger(sale.orderId)&&sale.orderId>0&&uuid(sale.scope?.actorId),'TPV_SIGNATURE_SALE_FORBIDDEN');
   need(typeof transport?.readNativeDocument==='function','TPV_SIGNATURE_UNAVAILABLE');
   const native=await transport.readNativeDocument({operationId:sale.id,sourceActorId:sale.scope.actorId,kind:'invoice'});
   need(native?.order_id===sale.orderId,'TPV_SIGNATURE_DOCUMENT_INVALID');
   const original=Object.fromEntries(['kind','existing_document','mime','order_id','filename','base64','sha256'].map(key=>[key,native[key]]));
   await render.validateOriginal(original);
   const prepared=await stored(await journal('prepare',operationId,{saleId,original}));
   need(prepared&&prepared.operationId===saleId&&prepared.orderId===sale.orderId&&['prepared','signed'].includes(prepared.status)&&(prepared.status==='signed'||prepared.id===operationId),'TPV_SIGNATURE_STORAGE_MISMATCH');return prepared;
  },
  async sign({operationId,originalSha256,ink,accepted}){
   need(accepted===true,'TPV_SIGNATURE_ACCEPTANCE_REQUIRED');const normalized=inkValue(ink),record=await get(operationId);
   need(record,'TPV_SIGNATURE_NOT_FOUND');need(originalSha256===record.original.sha256,'TPV_SIGNATURE_DOCUMENT_HASH_MISMATCH');
   if(record.status==='signed'){need(same(record.ink,normalized),'TPV_SIGNATURE_ALREADY_BOUND');return record;}
   need(record.status==='prepared','TPV_SIGNATURE_CANCELLED');need(Date.parse(record.expiresAt)>now(),'TPV_SIGNATURE_EXPIRED');
   const signedAt=new Date(now()).toISOString(),signed=await render({document:record.original,ink:normalized,snapshotId:record.id,actorName:record.actorName,signedAt,acceptanceText:record.acceptanceText});
   const result=await stored(await journal('sign',record.id,{ink:normalized,signed,signedAt}));
   need(result?.id===record.id&&result.status==='signed'&&result.original.sha256===record.original.sha256&&same(result.ink,normalized),'TPV_SIGNATURE_STORAGE_MISMATCH');return result;
  },
  async cancel(operationId){const record=await stored(await journal('cancel',operationId));need(record?.id===operationId&&record.status==='cancelled','TPV_SIGNATURE_STORAGE_MISMATCH');return record;}
 });
}
