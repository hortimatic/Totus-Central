import {receiptOptions} from './receipt-options.js';
/** Presentation after a confirmed sale only. It cannot submit or recover a
 * financial command. A failed print/read stays a document issue, not a sale. */
export function createReceiptDelivery({getDocument,print}){
 const requested=new Set();
 return Object.freeze({async afterConfirmation({sale,options,current=()=>true}){
  const o=receiptOptions(options);
  if(sale?.status!=='confirmed'||!sale.id||!Number.isSafeInteger(sale.orderId)||sale.orderId<1||!Number.isSafeInteger(sale.totalCents)||sale.totalCents<0||
   !o.showAfterSale&&!o.printAfterSale||requested.has(sale.id)||!current())return null;
  requested.add(sale.id);
  try{const document=await getDocument({saleId:sale.id,kind:'receipt'});
   if(!current())return null;
   if(document?.existing_document!==true||document.kind!=='receipt'||document.order_id!==sale.orderId||document.currency!=='EUR'||
    !Number.isSafeInteger(document.total_cents)||document.total_cents!==sale.totalCents)throw Error('Document does not match confirmed order');
   if(o.printAfterSale)print(document,o,{current});
   return {document:o.showAfterSale?document:null,printRequested:o.printAfterSale};
  }catch{if(!current())return null;return {warning:'Pedido confirmado. No se ha podido preparar el justificante. Ábrelo desde Documentos.'};}
 }});
}
