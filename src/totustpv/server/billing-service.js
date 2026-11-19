import {signatureDocumentBlob} from '../signature-document.js';
const need=(ok,code)=>{if(!ok)throw Error(code);};
const positive=value=>Number.isSafeInteger(value)&&value>0;
const text=(value,max)=>typeof value==='string'&&Array.from(value).length<=max&&!/[\x00-\x1f\x7f]/.test(value);
const decimal=value=>typeof value==='string'&&/^(?:0|[1-9][0-9]{0,9})\.\d{6}$/.test(value);
/** Compare an issued invoice to the confirmed Central sale before exposing
 * the explicitly projected native fields. No document/revenue write exists. */
export function verifiedBillingMetadata(document,sale){
 need(document?.source==='native-billing-document'&&document.kind==='billing'&&document.existing_document===true&&
  document.order_id===sale.orderId&&document.total_cents===sale.totalCents&&document.currency===sale.currency&&
  document.customer_id===sale.expected.customerId&&document.invoice_address_id===sale.expected.invoiceAddressId&&
  positive(document.invoice_id)&&positive(document.number)&&text(document.formatted_number,128)&&
  text(document.order_reference,32)&&text(document.issued_at,32),'TPV_BILLING_DOCUMENT_MISMATCH');
 const amounts=['total_tax_incl','total_tax_excl','discount_tax_incl','discount_tax_excl','shipping_tax_incl','shipping_tax_excl'];
 need(amounts.every(key=>decimal(document[key]))&&Math.round(Number(document.total_tax_incl)*100)===sale.totalCents,
  'TPV_BILLING_DOCUMENT_MISMATCH');
 need(Array.isArray(document.lines)&&document.lines.length>0&&document.lines.length<=200&&
  Array.isArray(sale.expected.lines)&&document.lines.length===sale.expected.lines.length,'TPV_BILLING_DOCUMENT_MISMATCH');
 const ids=new Set(),expected=new Map(sale.expected.lines.map(row=>[row.productId+':'+row.attributeId,row]));
 const lineAmounts=['unit_tax_excl','unit_tax_incl','line_tax_excl','line_tax_incl','recorded_tax_rate','recorded_ecotax','recorded_ecotax_tax_rate'];
 const lines=document.lines.map(row=>{
  const key=row?.product_id+':'+row?.attribute_id,line=expected.get(key);
  need(line&&positive(row.detail_id)&&!ids.has(row.detail_id)&&row.quantity===line.qty&&text(row.name,512)&&
   lineAmounts.every(key=>decimal(row[key])),'TPV_BILLING_DOCUMENT_MISMATCH');
  ids.add(row.detail_id);expected.delete(key);
  return Object.fromEntries(['detail_id','product_id','attribute_id','name','quantity',...lineAmounts].map(key=>[key,row[key]]));
 });
 need(expected.size===0,'TPV_BILLING_DOCUMENT_MISMATCH');
 return {...Object.fromEntries(['order_id','order_reference','invoice_id','number','formatted_number','issued_at','currency','customer_id',
  'invoice_address_id','total_cents',...amounts].map(key=>[key,document[key]])),lines};
}

export async function readBillingDocument({rpc,scope,operationId,kind,refundId,transport}){
 need(['billing','invoice','credit-note'].includes(kind),'TPV_BILLING_QUERY_INVALID');
 const response=await rpc('totus_tpv_billing_read',{p_scope:scope,p_sale:operationId,p_query:{}});
 if(response?.error)throw Error(/^TPV_[A-Z0-9_]+$/.test(response.error.message||'')?response.error.message:'TPV_STORAGE_UNAVAILABLE');
 const sale=response?.data;need(sale?.id===operationId&&positive(sale.orderId),'TPV_BILLING_SALE_NOT_FOUND');
 if(kind==='billing'){
  const document=verifiedBillingMetadata(await transport.readNativeBilling({operationId,sourceActorId:sale.sourceActorId}),sale);
  return {document,sale:{id:sale.id,orderId:sale.orderId,createdAt:sale.createdAt,totalCents:sale.totalCents,currency:sale.currency,
   customerId:sale.customerId,drawerName:sale.drawerName,operatorName:sale.operatorName,refundCents:sale.refundCents,refunds:sale.refunds}};
 }
 const source=kind==='credit-note'?sale.refundSources.find(row=>row.id===refundId):{id:sale.id,actorId:sale.sourceActorId};
 need(source,'TPV_BILLING_RETURN_NOT_FOUND');
 const document=await transport.readNativeDocument({operationId:source.id,sourceActorId:source.actorId,kind});
 need(document?.existing_document===true&&document.kind===kind&&document.order_id===sale.orderId&&document.mime==='application/pdf'&&
  typeof document.base64==='string'&&document.base64.length<=12000000&&/^[A-Za-z0-9+/]*={0,2}$/.test(document.base64)&&
  document.base64.startsWith('JVBERi0'),'TPV_BILLING_DOCUMENT_MISMATCH');
 return {mime:document.mime,base64:document.base64,orderId:sale.orderId,kind};
}

/** The archive is already held by Central. It never requests shop credentials. */
export async function readBillingSignature({rpc,scope,operationId}){
 const response=await rpc('totus_tpv_billing_signature',{p_scope:scope,p_sale:operationId});
 if(response?.error)throw Error(/^TPV_[A-Z0-9_]+$/.test(response.error.message||'')?response.error.message:'TPV_STORAGE_UNAVAILABLE');
 const record=response?.data;if(record===null)return {available:false};
 need(record?.operationId===operationId&&record.status==='signed'&&positive(record.orderId),'TPV_BILLING_DOCUMENT_MISMATCH');
 await signatureDocumentBlob(record,'signed');
 return {available:true,mime:'application/pdf',base64:record.signed.base64,filename:record.signed.filename,orderId:record.orderId,
  signedAt:record.signedAt,actorName:record.actorName};
}
