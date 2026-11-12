import {approximateOrderMargin} from './prestashop-margin.js';
import {prestashopProductImage} from './prestashop-readonly.js';

// One bounded lookup per distinct product/combination, not per widget or order.
// Missing catalogue data may fall back to the order's recorded purchase cost.
export async function enrichHomeOrderLines({store,lines,invoke,current=()=>true}){
 const products=new Map(),variants=new Map();
 const ids=[...new Set(lines.map(l=>String(l.product_id)).filter(id=>/^[1-9]\d{0,14}$/.test(id)))];
 for(let offset=0;offset<ids.length;offset+=100){
  if(!current())return null;
  const batch=ids.slice(offset,offset+100);
  try{
   const r=await invoke({action:'prestashop_read',resource:'products',product_ids:batch,page:0,page_size:100});
   if(!current())return null;
   if(r?.ok&&r.store===store&&r.resource==='products'&&Array.isArray(r.rows)&&r.rows.every(p=>batch.includes(String(p.id))))for(const p of r.rows)products.set(String(p.id),p);
  }catch{if(!current())return null;}
 }
 for(const line of lines){
  if(!current())return null;
  const product=products.get(String(line.product_id));
  let cost=product?.wholesale_price;
  const variantId=String(line.product_attribute_id||'0');
  if(/^[1-9]\d{0,14}$/.test(variantId)){
   if(!variants.has(variantId)){
    try{
     const r=await invoke({action:'prestashop_item_read',resource:'combinations',record_id:variantId});
     if(!current())return null;
     variants.set(variantId,r?.ok&&String(r.item?.id_product)===String(line.product_id)?r.item:null);
    }catch{if(!current())return null;variants.set(variantId,null);}
   }
   const variant=variants.get(variantId);
   if(Number(variant?.wholesale_price)>0)cost=variant.wholesale_price;
  }
  if(cost!==null&&cost!==undefined&&String(cost).trim()!==''&&Number.isFinite(Number(cost))&&Number(cost)>=0)line.current_wholesale_price=String(cost);
  line.image=product?prestashopProductImage(store,product.id_default_image):null;
 }
 return lines;
}

export function homeOrderMargin(order,lines,complete=true){
 const result=approximateOrderMargin(order,{rows:lines||[],possibly_more:!complete});
 return {...result,currency:String(order.currency_code||'')};
}

export function homeMarginTotal(rows){
 const valid=rows.filter(row=>String(row.valid)==='1');
 const measured=valid.filter(row=>row.currency_code==='EUR'&&Number.isFinite(row.margin_value));
 return {value:measured.reduce((n,r)=>n+r.margin_value,0),covered:measured.length,total:valid.length,complete:measured.length===valid.length};
}
