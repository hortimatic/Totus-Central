import {receiptOptions,receiptWebsiteUrl} from './receipt-options.js';
import {receiptNumber} from './receipt-series.js';
import {historicalGroupRate} from './receipt-discount-display.js';
const amount=value=>Number.isSafeInteger(value)&&value>=0&&value<=100000000000;
const text=value=>typeof value==='string'&&value.length<=2048&&!/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value);
const pick=(source,keys)=>Object.fromEntries(keys.filter(key=>text(source?.[key])).map(key=>[key,source[key]]));
const identity=line=>JSON.stringify([line.name,line.reference||'',line.quantity]);
export function giftReceiptBase(source){
 if(source?.kind!=='gift'||source.existing_document!==true||source.currency!=='EUR'||!Number.isSafeInteger(source.order_id)||source.order_id<1||!text(source.reference)||!source.reference.trim()||!Array.isArray(source.lines)||source.lines.length<1||source.lines.length>200)throw Error('El ticket regalo no corresponde a un pedido comprobado.');
 const lines=source.lines.map(line=>{if(!text(line?.name)||!line.name.trim()||!Number.isSafeInteger(line.quantity)||line.quantity<1||line.quantity>10000)throw Error('Los artículos del ticket regalo no son válidos.');return {...pick(line,['name','reference','base_name','variant_name']),quantity:line.quantity};});
 const result={kind:'gift',existing_document:true,order_id:source.order_id,reference:source.reference,currency:'EUR',lines,merchant:pick(source.merchant,['name','address','address2','postcode','city','phone','registration','logo_path']),...pick(source,['created_at','operator_name','environment'])};
 for(const key of ['merchant_origin','merchant_logo_origin']){const origin=receiptWebsiteUrl(source[key]);if(origin)result[key]=origin;}
 const number=receiptNumber(source.ticket_number);if(number)result.ticket_number=number;
 if(source.reference_barcode){const barcode=pick(source.reference_barcode,['format','mime','text','payload']);if(typeof source.reference_barcode.data==='string'&&source.reference_barcode.data.length<100000)barcode.data=source.reference_barcode.data;result.reference_barcode=barcode;}
 return result;
}
export function giftReceiptWithDiscounts(gift,receipt){
 const base=giftReceiptBase(gift),unavailable=()=>({...base,giftDiscounts:{available:false}});
 if(receipt?.kind!=='receipt'||receipt.existing_document!==true||receipt.currency!=='EUR'||receipt.order_id!==base.order_id||receipt.reference!==base.reference||!amount(receipt.total_cents)||!Array.isArray(receipt.lines)||receipt.lines.length!==base.lines.length)return unavailable();
 const groups=new Map();for(const line of receipt.lines){if(!text(line?.name)||!Number.isSafeInteger(line.quantity)||line.quantity<1||line.quantity>10000)return unavailable();const key=identity(line),values=groups.get(key)||[];values.push(line);groups.set(key,values);}
 const counts=new Map();for(const line of base.lines){const key=identity(line);counts.set(key,(counts.get(key)||0)+1);}
 if([...groups].some(([key,values])=>counts.get(key)!==values.length)||[...counts].some(([key,count])=>groups.get(key)?.length!==count))return unavailable();
 // Copy the native recorded discounts, never invert a current price or rate.
 const nativeComplete=receipt.line_discounts_complete===true&&receipt.lines.every(line=>amount(line.line_discount_cents))&&amount(receipt.line_discount_cents)&&receipt.lines.reduce((sum,line)=>sum+line.line_discount_cents,0)===receipt.line_discount_cents;
 const values=base.lines.map(line=>{const candidates=groups.get(identity(line));return nativeComplete&&candidates.every(row=>row.line_discount_cents===candidates[0].line_discount_cents)?candidates[0].line_discount_cents:null;});
 const ticketCents=amount(receipt.discount_cents)?receipt.discount_cents:null;
 const partial=values.some(value=>value===null)||ticketCents===null||receipt.lines.some(line=>historicalGroupRate(line)!==0);
 return {...base,giftDiscounts:{available:true,lines:values,ticketCents,partial}};
}
export function giftDiscountState(document){
 const data=document?.giftDiscounts;
 if(document?.kind!=='gift'||!Array.isArray(document.lines)||data?.available!==true||Object.keys(data).some(key=>!['available','lines','ticketCents','partial'].includes(key))||!Array.isArray(data.lines)||data.lines.length!==document.lines?.length||!data.lines.every(value=>value===null||amount(value))||!(data.ticketCents===null||amount(data.ticketCents))||typeof data.partial!=='boolean')return null;
 return data;
}
export async function loadGiftReceipt({getDocument,saleId,options,current=()=>true}){
 const guard=()=>{if(!current())throw Error('La sesión ha cambiado. Vuelve a abrir el documento.');};
 guard();const gift=giftReceiptBase(await getDocument({saleId,kind:'gift'}));guard();
 if(!receiptOptions(options).showGiftDiscounts)return gift;
 let receipt;try{receipt=await getDocument({saleId,kind:'receipt'});}catch{guard();return {...gift,giftDiscounts:{available:false}};}
 guard();return giftReceiptWithDiscounts(gift,receipt);
}
