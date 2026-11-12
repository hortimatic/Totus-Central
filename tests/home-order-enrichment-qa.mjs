import assert from 'node:assert/strict';
import {enrichHomeOrderLines,homeOrderMargin,homeMarginTotal} from '../src/home-order-enrichment.js';

const order={id:'1',valid:'1',currency_code:'EUR',total_paid_tax_excl:'30',total_shipping_tax_excl:'2',total_wrapping_tax_excl:'0'};
const lines=[{id:'11',product_id:'10',product_attribute_id:'20',product_quantity:'2'},{id:'12',product_id:'10',product_attribute_id:'20',product_quantity:'1'}];
const calls=[];
await enrichHomeOrderLines({store:'hortimatic',lines,invoke:async args=>{
 calls.push(args);
 if(args.resource==='products')return {ok:true,store:'hortimatic',resource:'products',rows:[{id:'10',wholesale_price:'3',id_default_image:'40'}]};
 return {ok:true,item:{id:'20',id_product:'10',wholesale_price:'4'}};
}});
assert.equal(calls.length,2,'Shared product and variant are read once');
assert.equal(homeOrderMargin(order,lines).margin,16,'30 − shipping 2 − 3 units × cost 4');
assert.equal(lines[0].image,'https://hortimatic.com/40-home_default/product.jpg');
assert.equal(homeOrderMargin(order,lines,false).margin,null,'Incomplete detail cannot produce a total');
assert.equal(homeOrderMargin(order,[{product_quantity:1}]).margin,null,'Missing cost does not mean free product');
const fallback=[{product_id:'10',product_attribute_id:'0',product_quantity:'1',purchase_supplier_price:'2'}];
await enrichHomeOrderLines({store:'newoldsmok',lines:fallback,invoke:async()=>({ok:true,store:'hortimatic',resource:'products',rows:[{id:'10',wholesale_price:'99'}]})});
assert.equal(homeOrderMargin(order,fallback).margin,26,'Foreign shop response ignored; recorded purchase cost remains available');
assert.equal(fallback[0].image,null);
assert.equal(await enrichHomeOrderLines({store:'hortimatic',lines,invoke:()=>assert.fail('Cancelled operation'),current:()=>false}),null);
assert.deepEqual(homeMarginTotal([{...order,margin_value:16},{...order,id:'2',margin_value:null},{...order,id:'3',valid:'0',margin_value:1000}]),{value:16,covered:1,total:2,complete:false});
assert.deepEqual(homeMarginTotal([{...order,margin_value:0}]),{value:0,covered:1,total:1,complete:true},'Zero margin is a valid result');
assert.equal(homeMarginTotal([{...order,currency_code:'USD',margin_value:10}]).complete,false,'Do not add different currencies');
console.log('Home order costs, variant cache, shop isolation, images, coverage and cancellation PASS');
