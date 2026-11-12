import {approximateOrderMargin} from './prestashop-margin.js';
const amount=value=>value!==null&&value!==undefined&&String(value).trim()!==''&&Number.isFinite(Number(value))?Number(value):null;
export async function readDirectoryCustomerSales(session,customerId){
 const orders=(await session.read('orders',{customer_ids:[String(customerId)]})).rows;
 const currencies=(await session.read('currencies',{}, {cached:true})).rows;
 const lines=[];for(let i=0;i<orders.length;i+=25)lines.push(...(await session.read('order_details',{order_ids:orders.slice(i,i+25).map(o=>String(o.id))})).rows);
 const productIds=[...new Set(lines.map(l=>String(l.product_id)).filter(id=>/^[1-9]\d*$/.test(id)))];
 const products=[],combinations=[];for(let i=0;i<productIds.length;i+=100){const product_ids=productIds.slice(i,i+100);products.push(...(await session.read('products',{product_ids},{cached:true})).rows);combinations.push(...(await session.read('combinations',{product_ids},{cached:true})).rows);}
 const byProduct=new Map(products.map(p=>[String(p.id),p])),byCombination=new Map(combinations.map(c=>[String(c.id),c]));
 const enriched=orders.map(order=>{const detail=lines.filter(l=>String(l.id_order)===String(order.id)).map(line=>{const combination=Number(line.product_attribute_id)>0?byCombination.get(String(line.product_attribute_id)):null;const product=byProduct.get(String(line.product_id));const variantCost=combination&&String(combination.id_product)===String(line.product_id)?amount(combination.wholesale_price):null;const current=variantCost>0?variantCost:amount(product?.wholesale_price);return {...line,...(current!==null?{current_wholesale_price:current}:{})};});return {...order,currency:currencies.find(c=>String(c.id)===String(order.id_currency))?.iso_code||null,marginResult:approximateOrderMargin(order,{rows:detail,possibly_more:false}),lines:detail};});
 const totals=new Map();for(const order of enriched){if(String(order.valid)!=='1')continue;const currency=order.currency||'Moneda #'+order.id_currency;if(!totals.has(currency))totals.set(currency,{currency,orders:0,sales:0,margin:0,missingSales:0,missingMargins:0});const total=totals.get(currency);total.orders++;const paid=amount(order.total_paid_tax_incl);if(paid===null)total.missingSales++;else total.sales+=paid;if(order.marginResult.complete)total.margin+=order.marginResult.margin;else total.missingMargins++;}
 return {orders:enriched,totals:[...totals.values()]};
}
