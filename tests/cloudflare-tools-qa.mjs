import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const helper=new URL('../supabase/functions/totus-ai/cloudflare.js',import.meta.url).href;
const source=readFileSync(new URL('../supabase/functions/totus-ai/tools.ts',import.meta.url),'utf8').replace("'./cloudflare.js'",JSON.stringify(helper)).replace("'../../../src/agent-delivery.js'",JSON.stringify(new URL('../src/agent-delivery.js',import.meta.url).href)).replace("'../../../src/agent-reports.js'",JSON.stringify(new URL('../src/agent-reports.js',import.meta.url).href)).replace("'../../../src/agent-workbooks.js'",JSON.stringify(new URL('../src/agent-workbooks.js',import.meta.url).href)).replace(/import \{attachChatExpenseDocument\} from '[^']+';/,"const attachChatExpenseDocument=()=>{throw Error('unexpected attachment')};");
const {createTools}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64'));
function fixture({wrongTotal=false,saveError=false,deny=false,loadExcel}={}){
 const calls=[],journal=new Map(),tables={ops_stores:[{id:'store'}],ops_cash_drawers:[{id:'drawer',store_id:'store',active:true}],ops_expense_categories:[{id:'cat'}],ops_expenses:[],ops_expense_lines:[],ops_daily_closings:[],ops_daily_closing_drawers:[],ops_stock_receipts:[],ops_sales_invoices:[],ops_fiscal_adjustments:[],ops_income_adjustments:[],ops_tax_payments:[]};
 const client={from(table){const filters=[];let limit=51,offset=0;const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},is(k,v){filters.push(r=>r[k]===v);return q},ilike(k,v){const term=v.slice(1,-1).replace(/\\([%_\\])/g,'$1').toLowerCase();filters.push(r=>String(r[k]||'').toLowerCase().includes(term));return q},gte(k,v){filters.push(r=>r[k]>=v);return q},lte(k,v){filters.push(r=>r[k]<=v);return q},range(a,b){offset=a;limit=b-a+1;return q},order(){return q},limit(n){limit=n;return q},single:async()=>({data:tables[table].filter(r=>filters.every(f=>f(r)))[0]}),then(resolve){resolve({data:tables[table].filter(r=>filters.every(f=>f(r))).slice(offset,offset+limit)})}};return q},rpc:async(name,args)=>{
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
 if(name==='totus_stock_add_source')return {data:{id:'receipt'}};
 throw Error(name);
 }};
 const admin={rpc:async(name,args)=>{assert.equal(name,'totus_ai_action');if(args.p_result){journal.set(args.p_hash,args.p_result);return {data:args.p_result};}if(journal.has(args.p_hash)){const x=journal.get(args.p_hash);if(x==='started')return {error:{message:'uncertain'}};return {data:x};}journal.set(args.p_hash,'started');return {data:null};}};
 const execute=createTools({client,admin,user:{id:'ai',email:'totus-ai@totuscentral.invalid'},job:{id:'job'},files:[],loadExcel,authorize:async()=>{if(deny)throw Error('denied');}});
 const read=table=>execute('consultar',{tabla:table});const run=(name,args)=>execute('ejecutar',{procedimiento:name,argumentos_json:JSON.stringify(args)});
 return {execute,read,run,calls,tables,client,admin};
}
const expense={p_expense:{store_id:'store',supplier_name:'Fiction only',expense_date:'2026-11-01',invoice_number:'QA',fiscal_reviewed:true},p_lines:[{category_id:'cat',description:'fiction',base_amount:20,vat_rate:21,re_rate:0,withholding_rate:0,deductible_pct:100}],expected_total:24.2};
const drawer={drawer_id:'drawer',opening_cash:100,closing_cash:110,card_sales:20,bizum_sales:0,online_sales:0,other_income:0,cash_withdrawals:0,cash_expenses_declared:0,cash_extra_in:0,cash_extra_out:0,reported_total_sales:30};
test('expense uses normal RPC, total check, fiscal pending and independent reread',async()=>{const f=fixture();await f.read('ops_stores');await f.read('ops_expense_categories');const r=await f.run('totus_save_expense',expense);assert.equal(r.verified_write.id,'expense');assert.equal(r.record.fiscal_reviewed,false);assert.equal(f.tables.ops_expense_lines.length,1);assert.equal(f.calls.filter(c=>c.name==='totus_save_expense').length,1);});
test('wrong invoice total cannot create a record',async()=>{const f=fixture();await f.read('ops_stores');await f.read('ops_expense_categories');await assert.rejects(f.run('totus_save_expense',{...expense,expected_total:999}),/cuadran/);assert.equal(f.tables.ops_expenses.length,0);});
test('unseen store cannot be invented',async()=>{const f=fixture();await assert.rejects(f.run('totus_save_expense',expense),/tiendas/);assert.equal(f.calls.length,0);});
test('closing preserves every drawer and amount',async()=>{const f=fixture();await f.read('ops_stores');await f.read('ops_cash_drawers');const r=await f.run('totus_save_closing',{p_closing:{store_id:'store',business_date:'2026-11-01',reported_total_sales:30,status:'cerrado'},p_drawers:[drawer]});assert.equal(r.verified_write.id,'closing');assert.equal(f.tables.ops_daily_closing_drawers[0].card_sales,20);});
test('missing amount and omitted drawer do not write',async()=>{const f=fixture();await f.read('ops_stores');await f.read('ops_cash_drawers');const {opening_cash,...incomplete}=drawer;await assert.rejects(f.run('totus_save_closing',{p_closing:{store_id:'store'},p_drawers:[incomplete]}),/importe/);f.tables.ops_cash_drawers.push({id:'drawer2',store_id:'store',active:true});await assert.rejects(f.run('totus_save_closing',{p_closing:{store_id:'store'},p_drawers:[drawer]}),/todos los cajones/);assert(!f.calls.some(c=>c.name==='totus_save_closing'));});
test('receipt uses own actor and rereads result',async()=>{const f=fixture();await f.read('ops_stores');const r=await f.run('totus_stock_create',{p_store:'store',p_supplier:'Fiction supplier',p_reference:'QA',p_date:'2026-11-01',p_notes:''});assert.equal(r.verified_write.id,'receipt');assert.equal(f.calls[0].args.p_actor_email,'totus-ai@totuscentral.invalid');assert.equal(f.calls[1].name,'totus_stock_context');});

test('37 receipt rows are staged in bounded blocks and saved exactly once with complete coverage',async()=>{
 const f=fixture();f.tables.ops_stock_receipts=[{id:'receipt',revision:3}];await f.read('ops_stock_receipts');
 const rows=Array.from({length:37},(_,i)=>({id:'line-'+i,supplier_name:'Fictitious '+i,supplier_qty:1,prestashop_qty:1}));
 for(let i=0;i<rows.length;i+=5){const r=await f.execute('preparar_cotejo',{receipt_id:'receipt',revision:3,filas_json:JSON.stringify(rows.slice(i,i+5)),cobertura_json:i?'[]':JSON.stringify([{source_id:'supplier',complete:true},{source_id:'prestashop',complete:true}])});assert.equal(r.persisted,false);assert.equal(r.prepared_rows,Math.min(i+5,37));}
 assert(!f.calls.some(c=>c.name==='totus_stock_save_result'));
 await f.execute('preparar_cotejo',{receipt_id:'receipt',revision:3,filas_json:JSON.stringify(rows.slice(0,5))});
 const r=await f.execute('guardar_cotejo',{receipt_id:'receipt',revision:3});assert.equal(r.verified_write.id,'receipt');
 const saves=f.calls.filter(c=>c.name==='totus_stock_save_result');assert.equal(saves.length,1);assert.deepEqual(saves[0].args.p_result.rows,rows);assert.equal(saves[0].args.p_result.coverage.length,2);assert.equal(f.calls.at(-1).name,'totus_stock_context');
 await assert.rejects(f.execute('guardar_cotejo',{receipt_id:'receipt',revision:3}),/Faltan/);
});

test('receipt blocks accept more than five lines and reject conflicts, oversized payloads, stale revisions and missing coverage without saving',async()=>{
 const f=fixture();f.tables.ops_stock_receipts=[{id:'receipt',revision:3}];await f.read('ops_stock_receipts');
 const prepare=rows=>f.execute('preparar_cotejo',{receipt_id:'receipt',revision:3,filas_json:JSON.stringify(rows)});
 await prepare([{id:'a',supplier_qty:1}]);await assert.rejects(prepare([{id:'a',supplier_qty:2}]),/contradice/);
 assert.equal((await prepare(Array.from({length:40},(_,i)=>({id:String(i)})))).prepared_rows,41);
 await assert.rejects(prepare([{id:'large',text:'x'.repeat(150001)}]),/tamaño/);
 await assert.rejects(f.execute('guardar_cotejo',{receipt_id:'receipt',revision:3}),/Faltan/);
 f.tables.ops_stock_receipts[0].revision=4;await assert.rejects(prepare([{id:'b'}]),/cambió/);
 assert(!f.calls.some(c=>c.name==='totus_stock_save_result'));
});

test('any AI identity can associate a stored original only after verifying its bytes and reading it',async()=>{
 const f=fixture(),blob=new Blob(['supplier original'],{type:'text/plain'}),sha=await (await import('../src/chat-files.js')).chatFileHash(blob);
 f.tables.ops_documents=[{id:'doc',original_name:'invoice.txt',storage_path:'qa/invoice.txt',mime_type:'text/plain',size_bytes:blob.size,sha256:sha}];
 f.tables.ops_stock_receipts=[{id:'receipt',revision:1}];
 f.client.functions={invoke:async()=>({data:{provider:'supabase'}})};f.client.storage={from:()=>({download:async()=>({data:blob})})};
 const execute=createTools({client:f.client,admin:f.admin,user:{id:'cohere-id',email:'other-ai@example.invalid'},job:{id:'job'},files:[],authorize:async()=>{},readOriginal:async()=> 'Verified supplier text'});
 await execute('consultar',{tabla:'ops_stock_receipts'});await execute('consultar',{tabla:'ops_documents'});
 const args={p_id:'receipt',p_revision:1,p_document:'doc',p_kind:'supplier'};
 await assert.rejects(execute('ejecutar',{procedimiento:'totus_stock_add_source',argumentos_json:JSON.stringify(args)}),/Lee el original/);
 await execute('leer_documento',{document_id:'doc'});
 const result=await execute('asociar_documento_recepcion',{receipt_id:args.p_id,revision:args.p_revision,document_id:args.p_document,kind:args.p_kind});
 assert.equal(result.verified_write.id,'receipt');const call=f.calls.find(c=>c.name==='totus_stock_add_source');assert.equal(call.args.p_actor_email,'other-ai@example.invalid');assert.equal(call.args.p_text,'Verified supplier text');assert.equal(call.args.p_extraction.sha256,sha);
});
test('uncertain write stops further mutations',async()=>{const f=fixture({saveError:true});await f.read('ops_stores');await f.read('ops_expense_categories');await assert.rejects(f.run('totus_save_expense',expense),/uncertain/);await assert.rejects(f.run('totus_stock_create',{p_store:'store'}),/incierto|resultado debe revisarse/);assert(!f.calls.some(c=>c.name==='totus_stock_create'));});
test('arbitrary SQL, delete and unowned files cannot be executed',async()=>{const f=fixture();await assert.rejects(f.run('execute_sql',{}),/autorizado/);await assert.rejects(f.run('totus_delete_expense',{}),/autorizado/);await assert.rejects(f.execute('adjuntar_gasto',{expense_id:'expense',file_id:'file'}),/original/);});
test('permission denial stops before normal RPC',async()=>{const f=fixture({deny:true});await assert.rejects(f.run('totus_save_closing',{p_closing:{store_id:'store'},p_drawers:[]}),/denied/);assert.equal(f.calls.length,0);});

test('live-rule simulations never persist a business write',async()=>{const f=fixture();await f.read('ops_stores');await f.read('ops_expense_categories');const r=await f.execute('simular',{procedimiento:'totus_save_expense',argumentos_json:JSON.stringify(expense)});assert.equal(r.simulation,true);assert.equal(r.persisted,false);assert.equal(r.verified_simulation.total,24.2);assert.equal(r.record.id,undefined);assert(!f.calls.some(c=>c.name==='totus_save_expense'));});

test('pagination exposes every authorized row without presenting partial totals',async()=>{const f=fixture();f.tables.ops_expenses=Array.from({length:85},(_,i)=>({id:String(i)}));const a=await f.execute('consultar',{tabla:'ops_expenses',limite:50});const b=await f.execute('consultar',{tabla:'ops_expenses',limite:50,pagina:a.next_page});assert.equal(a.rows.length,50);assert.equal(b.rows.length,35);assert.equal(b.truncated,false);assert.equal(b.next_page,null);assert.equal(new Set([...a.rows,...b.rows].map(r=>r.id)).size,85);});
test('period reports include more than one page and use the real sales rules',async()=>{const f=fixture();f.tables.ops_daily_closings=Array.from({length:620},(_,i)=>({id:String(i),business_date:'2026-11-02',status:'cerrado',cash_sales:10,card_sales:20}));f.tables.ops_expenses=[{id:'e1',expense_date:'2026-11-02',management_only:false,gross_expense:100},{id:'e2',expense_date:'2026-11-02',management_only:true,gross_expense:20},{id:'e3',expense_date:'2026-10-31',gross_expense:900}];const r=await f.execute('informe_periodo',{desde:'2026-11-01',hasta:'2026-11-30'});assert.equal(r.income,18600);assert.equal(r.counts.closings,620);assert.equal(r.recorded_expenses,100);assert.equal(r.internal_expenses,20);assert.equal(r.result_before_taxes,18500);assert.equal(r.complete,true);});
test('invalid date, invented store and permission denial cannot produce a report',async()=>{const f=fixture();await assert.rejects(f.execute('informe_periodo',{desde:'2026-02-30',hasta:'2026-03-01'}),/Periodo/);assert.equal((await f.execute('informe_periodo',{desde:'2026-11-01',hasta:'2026-11-30',tienda:'invented'})).needs_store,true);const denied=fixture({deny:true});await assert.rejects(denied.execute('informe_periodo',{desde:'2026-11-01',hasta:'2026-11-30'}),/denied/);});

test('document lookup finds original IDs by supplier and date without asking the user for UUIDs',async()=>{const f=fixture();f.tables.ops_documents=[{id:'garden',supplier_or_customer:'Garden Seeds',document_date:'2026-10-28'},{id:'other',supplier_or_customer:'Otro',document_date:'2026-10-28'}];const r=await f.execute('buscar_documentos',{proveedor:'garden',desde:'2026-10-01',hasta:'2026-10-31'});assert.equal(r.documents[0].id,'garden');assert.equal(r.documents.length,1);await assert.rejects(f.execute('buscar_documentos',{desde:'2026-02-30'}),/Fecha/);});

test('document search resolves a human store name without an earlier technical lookup',async()=>{const f=fixture();f.tables.ops_stores[0].name='Hortimatic';f.tables.ops_documents=[{id:'garden',store_id:'store',original_name:'Factura Garden.pdf'}];const r=await f.execute('buscar_documentos',{archivo:'Garden',tienda:'hortimatic'});assert.equal(r.documents[0].id,'garden');const missing=await f.execute('buscar_documentos',{tienda:'unknown'});assert.equal(missing.needs_store,true);assert.equal(missing.documents,undefined);});

test('a translated table name yields the real catalogue instead of a false permission denial',async()=>{const f=fixture();const result=await f.execute('consultar',{tabla:'tiendas'});assert.equal(result.completed,false);assert(result.tables.includes('ops_stores'));assert.match(result.instruction,/No traduzcas/);assert.equal(f.calls.length,0);await assert.rejects(f.execute('consultar',{tabla:'ops_stores',limite:100}),/entre 1 y 50/);});

test('monthly diary resolves a real store name and stages the same XLSX instead of a CSV',async()=>{const xlsx=(await import('xlsx-js-style')).default;const f=fixture({loadExcel:async()=>xlsx});f.tables.ops_stores[0].name='Hortimatic';const result=await f.execute('diario_mensual',{anio:2026,mes:10,tienda:'hortimatic'});assert.equal(result.store,'Hortimatic');assert.equal(result.same_workbook_builder,true);assert.match(result.file.name,/\.xlsx$/);assert(!f.calls.some(c=>c.name==='totus_save_expense'));});
test('unknown store returns real choices without exporting another store or asking for a UUID',async()=>{const f=fixture({loadExcel:async()=>{throw Error('must not load')}});f.tables.ops_stores[0].name='Hortimatic';const result=await f.execute('diario_mensual',{anio:2026,mes:10,tienda:'inventada'});assert.equal(result.needs_store,true);assert.equal(result.file,undefined);assert.equal(result.stores[0].name,'Hortimatic');});

test('CSV report resolves a human store name without an earlier ID lookup',async()=>{const f=fixture();f.tables.ops_stores[0].name='Hortimatic';const r=await f.execute('informe_periodo',{desde:'2099-01-01',hasta:'2099-01-31',tienda:'hortimatic',adjuntar:true});assert.equal(r.complete,true);assert.match(r.file.name,/\.csv$/);assert.equal(r.counts.closings,0);assert.equal(f.calls.length,0);});
