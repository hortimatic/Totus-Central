import {lineAdjustment} from './line-options.js';
import {lineName} from './line-name.js';
/** Only operator changes, kept separately from native calculated amounts. */
export function saleModifiers(value){
 const result={};
 if(value.adjustment!==undefined){result.adjustment=lineAdjustment(value.adjustment);if(result.adjustment.kind==='price')throw Error('TPV_LINE_ADJUSTMENT_INVALID');}
 if(value.coupon!==undefined){if(typeof value.coupon!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(value.coupon))throw Error('TPV_COUPON_INVALID');result.coupon=value.coupon;}
 const lines=[];
 for(const line of value.lines||[]){
  const discount=lineAdjustment(line.discount),displayName=lineName(line.displayName);
  if(line.displayName!==undefined&&(displayName===undefined||displayName!==line.displayName))throw Error('TPV_LINE_NAME_INVALID');
  if(discount||displayName)lines.push({productId:line.productId,attributeId:line.attributeId??0,...(discount?{discount}:{}),...(displayName?{displayName}:{})});
 }
 if(lines.length)result.lines=lines;
 return result;
}

export function sameSaleModifiers(a,b){const encode=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);return encode(a||{})===encode(b||{});}
