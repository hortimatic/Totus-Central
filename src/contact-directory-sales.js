import {concurrentRead} from './concurrent-read.js';
import {approximateOrderMargin} from './prestashop-margin.js';
const amount=value=>value!==null&&value!==undefined&&String(value).trim()!==''&&Number.isFinite(Number(value))?Number(value):null;
export async function readDirectoryCustomerSales(session,customerId){
 const [orderData,currencyData]=await Promise.all([session.read('orders',{customer_ids:[String(customerId)]}),session.read('currencies',{}, {cached:true})]);
 const orders=orderData.rows,currencies=currencyData.rows;
 const batches=[];for(let i=0;i<orders.length;i+=25)batches.push(orders.slice(i,i+25).map(o=>String(o.id)));
 const lines=(await concurrentRead(batches,order_ids=>session.read('order_details',{order_ids}))).flatMap(result=>result.rows);
 const productIds=[...new Set(lines.map(l=>String(l.product_id)).filter(id=>/^[1-9]\d*$/.test(id)))];
 const jobs=[];for(let i=0;i<productIds.length;i+=100){const product_ids=productIds.slice(i,i+100);for(const resource of ['products','combinations'])jobs.push({resource,product_ids});}
 const results=await concurrentRead(jobs,job=>session.read(job.resource,{product_ids:job.product_ids},{cached:true}));
 const products=results.flatMap((result,index)=>jobs[index].resource==='products'?result.rows:[]),combinations=results.flatMap((result,index)=>jobs[index].resource==='combinations'?result.rows:[]);
 const byProduct=new Map(products.map(p=>[String(p.id),p])),byCombination=new Map(combinations.map(c=>[String(c.id),c]));
 const enriched=orders.map(order=>{const detail=lines.filter(l=>String(l.id_order)===String(order.id)).map(line=>{const combination=Number(line.product_attribute_id)>0?byCombination.get(String(line.product_attribute_id)):null;const product=byProduct.get(String(line.product_id));const variantCost=combination&&String(combination.id_product)===String(line.product_id)?amount(combination.wholesale_price):null;const current=variantCost>0?variantCost:amount(product?.wholesale_price);return {...line,...(current!==null?{current_wholesale_price:current}:{})};});return {...order,currency:currencies.find(c=>String(c.id)===String(order.id_currency))?.iso_code||null,marginResult:approximateOrderMargin(order,{rows:detail,possibly_more:false}),lines:detail};});
 const totals=new Map();for(const order of enriched){if(String(order.valid)!=='1')continue;const currency=order.currency||'Moneda #'+order.id_currency;if(!totals.has(currency))totals.set(currency,{currency,orders:0,sales:0,margin:0,missingSales:0,missingMargins:0});const total=totals.get(currency);total.orders++;const paid=amount(order.total_paid_tax_incl);if(paid===null)total.missingSales++;else total.sales+=paid;if(order.marginResult.complete)total.margin+=order.marginResult.margin;else total.missingMargins++;}
 return {orders:enriched,totals:[...totals.values()]};
}
