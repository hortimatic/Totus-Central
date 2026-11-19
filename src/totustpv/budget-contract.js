import {lineAdjustment} from './line-options.js';
import {lineName} from './line-name.js';
import {saleNote} from './sale-note.js';
const need=ok=>{if(!ok)throw Error('TPV_BUDGET_INPUT_INVALID');};
const positive=value=>Number.isSafeInteger(value)&&value>0&&value<=2147483647;
function text(value,max,multiline=false){need(typeof value==='string');const s=value.replace(/\r\n?/g,'\n').trim();need(Array.from(s).length<=max&&!(multiline?/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\uD800-\uDFFF]/u:/[\u0000-\u001f\u007f\uD800-\uDFFF]/u).test(s));return s;}
/** User intent only. Native amounts, document identity and expiry timestamps
 * are never accepted from the browser. */
export function budgetDraft(value){
 need(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>['lines','customerId','invoiceAddressId','deliveryAddressId','adjustment','coupon','note','title','publicNote','validDays'].includes(key)));
 need(Array.isArray(value.lines)&&value.lines.length>0&&value.lines.length<=200);const seen=new Set();
 const lines=value.lines.map(line=>{need(line&&typeof line==='object'&&!Array.isArray(line)&&Object.keys(line).every(key=>['productId','attributeId','qty','discount','displayName'].includes(key))&&positive(line.productId)&&Number.isSafeInteger(line.attributeId)&&line.attributeId>=0&&line.attributeId<=2147483647&&Number.isSafeInteger(line.qty)&&line.qty>=1&&line.qty<=10000);
  const identity=line.productId+':'+line.attributeId;need(!seen.has(identity));seen.add(identity);const discount=lineAdjustment(line.discount),displayName=lineName(line.displayName);
  return {productId:line.productId,attributeId:line.attributeId,qty:line.qty,...(discount?{discount}:{}),...(displayName?{displayName}:{})};});
 const title=text(value.title===undefined?'Presupuesto':value.title,120),publicNote=text(value.publicNote??'',1000,true),validDays=value.validDays??30;need(title.length>0&&Number.isInteger(validDays)&&validDays>=1&&validDays<=365);
 const result={lines,title,publicNote,validDays};
 if(['customerId','invoiceAddressId','deliveryAddressId'].some(key=>value[key]!==undefined)){need(positive(value.customerId)&&positive(value.invoiceAddressId)&&(value.deliveryAddressId===undefined||positive(value.deliveryAddressId)));Object.assign(result,{customerId:value.customerId,invoiceAddressId:value.invoiceAddressId,deliveryAddressId:value.deliveryAddressId??value.invoiceAddressId});}
 if(value.adjustment!==undefined){const adjustment=lineAdjustment(value.adjustment);need(adjustment.kind!=='price');result.adjustment=adjustment;}
 if(value.coupon!==undefined){need(typeof value.coupon==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(value.coupon));result.coupon=value.coupon;}
 const note=saleNote(value.note);if(note!==undefined)result.note=note;
 return result;
}
