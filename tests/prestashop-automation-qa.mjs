import test from 'node:test';import assert from 'node:assert/strict';
import {validatePrestaAutomation,onlineOrder,prestashopNotice,automationResult} from '../src/prestashop-automation-core.js';
const rule={name:'Pedidos web',recipe:'online_orders',stores:['hortimatic'],channel_id:'11111111-1111-4111-8111-111111111111',interval_hours:2,online_modules:{hortimatic:['webcheckout']},enabled:true,sharing_confirmed:true};
test('rules support generic queries and validate scope, origins, interval and destination',()=>{
 assert.equal(validatePrestaAutomation(rule).interval_hours,2);assert.equal(validatePrestaAutomation({...rule,recipe:'missing_ean',online_modules:{}}).recipe,'missing_ean');
 for(const patch of [{stores:['other']},{channel_id:'------------------------------------'},{interval_hours:0},{recipe:'sql'},{online_modules:{}},{daily_start:'25:00'},{min_count:-1}])assert.throws(()=>validatePrestaAutomation({...rule,...patch}));
 assert.equal(onlineOrder({module:'pos',payment:'Tarjeta'},['webcheckout']),false);assert.equal(onlineOrder({module:'webcheckout',payment:'Efectivo'},['webcheckout']),true);assert.equal(onlineOrder({payment:'Online'},['webcheckout']),false);
});
test('catalog rule scans pages, applies threshold, and never labels partial data complete',async()=>{
 const calls=[],read=async(resource,p)=>{calls.push(p.page);return {ok:true,store:'hortimatic',resource,page:p.page,possibly_more:p.page===0,rows:p.page===0?[{id:'1',name:'A',ean13:''}]:[{id:'2',name:'B',ean13:'123'}]};};
 const r=await automationResult({...rule,recipe:'missing_ean',min_count:1},'hortimatic',{from:'2026-11-05 00:00:00',to:'2026-11-05 12:00:00'},{read});assert.deepEqual(calls,[0,1]);assert.equal(r.count,1);assert.match(r.body,/A/);assert(!r.body.includes('• B'));
 await assert.rejects(()=>automationResult({...rule,recipe:'missing_ean'},'hortimatic',{}, {read:async()=>({ok:true,store:'newoldsmok',resource:'products',page:0,rows:[]})}),/otra tienda/);
});
test('online notice preserves order identity, source lines, currency and contact; rejects missing amount',()=>{
 const args={store:'hortimatic',order:{id:'17',module:'webcheckout',reference:'WEB17',date_add:'2026-11-05 10:00:00',total_paid_tax_incl:'12.10',current_state:'2'},lines:[{id_order:'17',product_name:'Producto',product_quantity:'2'}],customer:{firstname:'Ficticio'},currency:'EUR',stateName:'Pagado'};
 assert.match(prestashopNotice(args),/2 × Producto/);assert.match(prestashopNotice(args),/WEB17/);assert.match(prestashopNotice(args),/ps_order=17/);
 assert.throws(()=>prestashopNotice({...args,order:{...args.order,total_paid_tax_incl:''}}));assert.throws(()=>prestashopNotice({...args,lines:[{...args.lines[0],id_order:'18'}]}));
});
test('online processing skips TPV and already delivered orders and sends complete details',async()=>{
 const sent=[],rows=[{id:'1',module:'pos'},{id:'2',module:'webcheckout'},{id:'3',module:'webcheckout',id_currency:'1',id_customer:'1',id_address_delivery:'1',current_state:'2',total_paid_tax_incl:'12.10',date_add:'2026-11-05 10:00:00'}];
 const read=async(resource,p)=>({ok:true,store:'hortimatic',resource,page:p.page,possibly_more:false,rows:resource==='orders'?rows:resource==='order_details'?[{id:'40',id_order:p.order_id,product_quantity:'1',product_name:'Prueba'}]:resource==='currencies'?[{id:p.record_id,iso_code:'EUR'}]:[{id:p.record_id,name:'Pagado'}]});
 const r=await automationResult({...rule,min_count:1},'hortimatic',{}, {read,seen:['2'],onOrder:async(order,body)=>sent.push({id:order.id,body})});assert.equal(r.count,1);assert.equal(sent[0].id,'3');assert.match(sent[0].body,/Prueba/);
});
test('hourly sales includes the final minute when saved SQL time values contain seconds',async()=>{
 const read=async(resource,p)=>({ok:true,store:'hortimatic',resource,page:p.page,possibly_more:false,rows:resource==='orders'?[{id:'1',reference:'Dentro',date_add:'2026-11-05 20:30:59',valid:'1',id_currency:'1',total_paid_tax_incl:'1.00'},{id:'2',reference:'Fuera',date_add:'2026-11-05 20:31:00'}]:[{id:'1',iso_code:'EUR'}]});
 const r=await automationResult({...rule,recipe:'sales_window',daily_start:'20:00:00',daily_end:'20:30:00',min_count:1},'hortimatic',{}, {read});assert.equal(r.count,1);assert.match(r.body,/Dentro/);assert(!r.body.includes('Fuera'));
});
