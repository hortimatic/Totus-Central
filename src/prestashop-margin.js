const number=value=>value!==null&&value!==undefined&&String(value).trim()!==''&&Number.isFinite(Number(value))?Number(value):null;
export function approximateOrderMargin(order,detail){
 const lines=detail?.rows||[];
 let cost=0,missing=0;
 for(const line of lines){
  const quantity=number(line.product_quantity),purchase=number(line.purchase_supplier_price),original=number(line.original_wholesale_price);
  const unit=purchase>0?purchase:original>0?original:null;
  if(unit===null||quantity===null||quantity<=0){missing++;continue;}
  cost+=unit*quantity;
 }
 const paid=number(order.total_paid_tax_excl),shipping=number(order.total_shipping_tax_excl),wrapping=number(order.total_wrapping_tax_excl);
 const revenue=paid!==null&&shipping!==null&&wrapping!==null?paid-shipping-wrapping:null;
 const complete=lines.length>0&&!detail.possibly_more&&missing===0&&revenue!==null;
 const margin=complete?revenue-cost:null;
 return {cost:complete?cost:null,revenue,margin,percent:margin!==null&&revenue>0?margin/revenue*100:null,missing,complete};
}
