import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const helper=new URL('../supabase/functions/totus-ai/cloudflare.js',import.meta.url).href;
const source=readFileSync(new URL('../supabase/functions/totus-ai/tools.ts',import.meta.url),'utf8').replace("'./cloudflare.js'",JSON.stringify(helper)).replace(/import \{attachChatExpenseDocument\} from '[^']+';/,"const attachChatExpenseDocument=()=>{throw Error('unexpected attachment')};");
const {createTools}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64'));
function fixture({wrongTotal=false,saveError=false,deny=false}={}){
 const calls=[],journal=new Map(),tables={ops_stores:[{id:'store'}],ops_cash_drawers:[{id:'drawer',store_id:'store',active:true}],ops_expense_categories:[{id:'cat'}],ops_expenses:[],ops_expense_lines:[],ops_daily_closings:[],ops_daily_closing_drawers:[],ops_stock_receipts:[]};
 const client={from(table){const filters=[];let limit=51;const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},is(k,v){filters.push(r=>r[k]===v);return q},order(){return q},limit(n){limit=n;return q},single:async()=>({data:tables[table].filter(r=>filters.every(f=>f(r)))[0]}),then(resolve){resolve({data:tables[table].filter(r=>filters.every(f=>f(r))).slice(0,limit)})}};return q},rpc:async(name,args)=>{
 calls.push({name,args:structuredClone(args)});
 if(name==='totus_ai_validate'){const expense=args.p_kind==='expense',record={...args.p_record,base_amount:20,vat_amount:4.2,re_amount:0,withholding_amount:0,accounting_amount:20},rows=structuredClone(args.p_rows);return {data:{record,rows}};}
 if(name==='totus_save_expense'||name==='totus_save_closing'){
 if(saveError)return {error:{message:'uncertain'}};
 const expense=name==='totus_save_expense',record=expense?args.p_expense:args.p_closing,id=expense?'expense':'closing',rows=expense?args.p_lines:args.p_drawers;
 tables[expense?'ops_expenses':'ops_daily_closings']=[{...record,id,created_by:'ai',...(expense?{base_amount:20,vat_amount:4.2,re_amount:0,withholding_amount:0,accounting_amount:20}:{})}];
 tables[expense?'ops_expense_lines':'ops_daily_closing_drawers']=rows.map(r=>({...r,[expense?'expense_id':'closing_id']:id}));return {data:id};}
 if(name==='totus_stock_create'){tables.ops_stock_receipts=[{id:'receipt',revision:1}];return {data:'receipt'};}
 if(name==='totus_stock_context')return {data:{receipt:tables.ops_stock_receipts[0],sources:[]}};
 if(name==='totus_stock_save_result')return {data:{id:'receipt'}};
 throw Error(name);
 }};
 const admin={rpc:async(name,args)=>{assert.equal(name,'totus_ai_action');if(args.p_result){journal.set(args.p_hash,args.p_result);return {data:args.p_result};}if(journal.has(args.p_hash)){const x=journal.get(args.p_hash);if(x==='started')return {error:{message:'uncertain'}};return {data:x};}journal.set(args.p_hash,'started');return {data:null};}};
 const execute=createTools({client,admin,user:{id:'ai',email:'totus-ai@totuscentral.invalid'},job:{id:'job'},files:[],authorize:async()=>{if(deny)throw Error('denied');}});
 const read=table=>execute('consultar',{tabla:table});const run=(name,args)=>execute('ejecutar',{procedimiento:name,argumentos_json:JSON.stringify(args)});
 return {execute,read,run,calls,tables};
}
const expense={p_expense:{store_id:'store',supplier_name:'Fiction only',expense_date:'2026-11-01',invoice_number:'QA',fiscal_reviewed:true},p_lines:[{category_id:'cat',description:'fiction',base_amount:20,vat_rate:21,re_rate:0,withholding_rate:0,deductible_pct:100}],expected_total:24.2};
const drawer={drawer_id:'drawer',opening_cash:100,closing_cash:110,card_sales:20,bizum_sales:0,online_sales:0,other_income:0,cash_withdrawals:0,cash_expenses_declared:0,cash_extra_in:0,cash_extra_out:0,reported_total_sales:30};
test('expense uses normal RPC, total check, fiscal pending and independent reread',async()=>{const f=fixture();await f.read('ops_stores');await f.read('ops_expense_categories');const r=await f.run('totus_save_expense',expense);assert.equal(r.verified_write.id,'expense');assert.equal(r.record.fiscal_reviewed,false);assert.equal(f.tables.ops_expense_lines.length,1);assert.equal(f.calls.filter(c=>c.name==='totus_save_expense').length,1);});
test('wrong invoice total cannot create a record',async()=>{const f=fixture();await f.read('ops_stores');await f.read('ops_expense_categories');await assert.rejects(f.run('totus_save_expense',{...expense,expected_total:999}),/cuadran/);assert.equal(f.tables.ops_expenses.length,0);});
test('unseen store cannot be invented',async()=>{const f=fixture();await assert.rejects(f.run('totus_save_expense',expense),/tiendas/);assert.equal(f.calls.length,0);});
test('closing preserves every drawer and amount',async()=>{const f=fixture();await f.read('ops_stores');await f.read('ops_cash_drawers');const r=await f.run('totus_save_closing',{p_closing:{store_id:'store',business_date:'2026-11-01',reported_total_sales:30,status:'cerrado'},p_drawers:[drawer]});assert.equal(r.verified_write.id,'closing');assert.equal(f.tables.ops_daily_closing_drawers[0].card_sales,20);});
test('missing amount and omitted drawer do not write',async()=>{const f=fixture();await f.read('ops_stores');await f.read('ops_cash_drawers');const {opening_cash,...incomplete}=drawer;await assert.rejects(f.run('totus_save_closing',{p_closing:{store_id:'store'},p_drawers:[incomplete]}),/importe/);f.tables.ops_cash_drawers.push({id:'drawer2',store_id:'store',active:true});await assert.rejects(f.run('totus_save_closing',{p_closing:{store_id:'store'},p_drawers:[drawer]}),/todos los cajones/);assert(!f.calls.some(c=>c.name==='totus_save_closing'));});
test('receipt uses own actor and rereads result',async()=>{const f=fixture();await f.read('ops_stores');const r=await f.run('totus_stock_create',{p_store:'store',p_supplier:'Fiction supplier',p_reference:'QA',p_date:'2026-11-01',p_notes:''});assert.equal(r.verified_write.id,'receipt');assert.equal(f.calls[0].args.p_actor_email,'totus-ai@totuscentral.invalid');assert.equal(f.calls[1].name,'totus_stock_context');});
test('uncertain write stops further mutations',async()=>{const f=fixture({saveError:true});await f.read('ops_stores');await f.read('ops_expense_categories');await assert.rejects(f.run('totus_save_expense',expense),/uncertain/);await assert.rejects(f.run('totus_stock_create',{p_store:'store'}),/incierto|resultado debe revisarse/);assert(!f.calls.some(c=>c.name==='totus_stock_create'));});
test('arbitrary SQL, delete and unowned files cannot be executed',async()=>{const f=fixture();await assert.rejects(f.run('execute_sql',{}),/autorizado/);await assert.rejects(f.run('totus_delete_expense',{}),/autorizado/);await assert.rejects(f.execute('adjuntar_gasto',{expense_id:'expense',file_id:'file'}),/original/);});
test('permission denial stops before normal RPC',async()=>{const f=fixture({deny:true});await assert.rejects(f.run('totus_save_closing',{p_closing:{store_id:'store'},p_drawers:[]}),/denied/);assert.equal(f.calls.length,0);});

test('live-rule simulations never persist a business write',async()=>{const f=fixture();await f.read('ops_stores');await f.read('ops_expense_categories');const r=await f.execute('simular',{procedimiento:'totus_save_expense',argumentos_json:JSON.stringify(expense)});assert.equal(r.simulation,true);assert.equal(r.persisted,false);assert.equal(r.verified_simulation.total,24.2);assert.equal(r.record.id,undefined);assert(!f.calls.some(c=>c.name==='totus_save_expense'));});
