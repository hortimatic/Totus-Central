const number=value=>value!==null&&value!==undefined&&String(value).trim()!==''&&Number.isFinite(Number(value))?Number(value):null;
/** Estimate requested by management: gross receipts minus merchandise cost incl. purchase VAT and RE. */
export function approximateOrderGain(order,detail,{vat,re}={}){
 const historical={...detail,rows:(detail?.rows||[]).map(line=>{const cost=number(line.purchase_supplier_price)>0?line.purchase_supplier_price:number(line.original_wholesale_price)>0?line.original_wholesale_price:null;return cost===null?line:{...line,current_wholesale_price:cost};})};
 const base=approximateOrderMargin(order,historical),purchaseVat=number(vat),surcharge=number(re),revenue=number(order.total_paid_tax_incl);
 const complete=base.cost!==null&&revenue!==null&&purchaseVat!==null&&surcharge!==null&&purchaseVat>=0&&purchaseVat<=100&&surcharge>=0&&surcharge<=100;
 const cost=complete?base.cost*(1+(purchaseVat+surcharge)/100):null;
 return {complete,cost,revenue,margin:complete?revenue-cost:null,percent:complete&&revenue>0?(revenue-cost)/revenue*100:null};
}
export function approximateOrderMargin(order,detail){
 const lines=detail?.rows||[];
 let cost=0,missing=0;
 for(const line of lines){
  const quantity=number(line.product_quantity),purchase=number(line.purchase_supplier_price),original=number(line.original_wholesale_price);
  const current=number(line.current_wholesale_price);
  const unit=current!==null&&current>=0?current:purchase>0?purchase:original>0?original:null;
  if(unit===null||quantity===null||quantity<=0){missing++;continue;}
  cost+=unit*quantity;
 }
 const paid=number(order.total_paid_tax_excl),shipping=number(order.total_shipping_tax_excl),wrapping=number(order.total_wrapping_tax_excl);
 const revenue=paid!==null&&shipping!==null&&wrapping!==null?paid-shipping-wrapping:null;
 const complete=lines.length>0&&!detail.possibly_more&&missing===0&&revenue!==null;
 const margin=complete?revenue-cost:null;
 return {cost:complete?cost:null,revenue,margin,percent:margin!==null&&revenue>0?margin/revenue*100:null,missing,complete};
}
