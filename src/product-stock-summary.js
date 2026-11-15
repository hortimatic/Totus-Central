// The native parent row repeats the combination total: never add both.
export function productStockSummary(product,variants,rows){
 const own=rows.filter(row=>String(row.id_product)===String(product.id)&&(!product.id_shop_default||['0',String(product.id_shop_default)].includes(String(row.id_shop))));
 const quantity=id=>{const matches=own.filter(row=>String(row.id_product_attribute)===String(id));if(matches.length!==1||String(matches[0].quantity??'').trim()==='')return null;const n=Number(matches[0].quantity);return Number.isFinite(n)?n:null;};
 const breakdown=variants.map(v=>({id:String(v.id),quantity:quantity(v.id)}));
 const total=breakdown.length?(breakdown.every(v=>v.quantity!==null)?breakdown.reduce((n,v)=>n+v.quantity,0):null):quantity('0');
 return {total,breakdown};
}
