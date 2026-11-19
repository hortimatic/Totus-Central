/** Enrich only an authorized, existing receipt from the standard read-only
 * PrestaShop order_details API. Never read today's Customer/Group/Product. */
const positive=value=>Number.isSafeInteger(Number(value))&&Number(value)>0&&(/^[1-9][0-9]{0,9}$/).test(String(value));
export function groupPercentMicros(value){
 if(typeof value==='number'){if(!Number.isFinite(value)||value<0||value>100||Math.abs(value-Math.round(value*1e6)/1e6)>1e-12)return null;value=value.toFixed(6);}
 if(typeof value!=='string'||! /^(0|[1-9][0-9]{0,2})(?:\.[0-9]{1,6})?$/.test(value))return null;
 const [whole,part='']=value.split('.'),scaled=Number(whole)*1e6+Number(part.padEnd(6,'0'));return scaled<=100000000?scaled:null;
}
function cleanDocument(document){return {...document,lines:Array.isArray(document?.lines)?document.lines.map(line=>{const {group_reduction_percent_micros,...rest}=line;return rest;}):document?.lines};}
const lineKey=(name,reference,quantity)=>typeof name==='string'&&name.length<=512&&typeof reference==='string'&&reference.length<=512&&positive(quantity)?JSON.stringify([name,reference,Number(quantity)]):null;
export function withHistoricalGroupRates(document,details,orderId){
 const clean=cleanDocument(document);
 if(document?.kind!=='receipt'||!positive(orderId)||Number(document.order_id)!==Number(orderId)||!Array.isArray(clean.lines)||clean.lines.length<1||clean.lines.length>200||!Array.isArray(details)||details.length!==clean.lines.length)return clean;
 const ids=new Set(),groups=new Map(),counts=new Map();
 for(const row of details){
  if(!row||!positive(row.id)||ids.has(Number(row.id))||!positive(row.id_order)||Number(row.id_order)!==Number(orderId))return clean;ids.add(Number(row.id));
  const key=lineKey(row.product_name,row.product_reference??'',row.product_quantity),rate=groupPercentMicros(row.group_reduction);
  if(key===null||rate===null)return clean;
  const values=groups.get(key)||[];values.push(rate);groups.set(key,values);
 }
 for(const line of clean.lines){const key=lineKey(line.name,line.reference??'',line.quantity);if(key===null||!groups.has(key))return clean;counts.set(key,(counts.get(key)||0)+1);}
 if([...groups].some(([key,values])=>counts.get(key)!==values.length))return clean;
 return {...clean,lines:clean.lines.map(line=>{const values=groups.get(lineKey(line.name,line.reference??'',line.quantity));return values.every(value=>value===values[0])?{...line,group_reduction_percent_micros:values[0]}:line;})};
}
export async function readHistoricalGroupRates({document,orderId,read}){
 if(document?.kind!=='receipt'||!positive(orderId)||Number(document.order_id)!==Number(orderId)||!Array.isArray(document.lines)||document.lines.length<1||document.lines.length>200)return cleanDocument(document);
 try{const response=await read('order_details',{'filter[id_order]':'['+Number(orderId)+']',display:'[id,id_order,product_name,product_reference,product_quantity,group_reduction]',limit:'0,201'});return withHistoricalGroupRates(document,response?.order_details,orderId);}catch{return cleanDocument(document);}
}
