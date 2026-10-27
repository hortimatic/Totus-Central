// Sandbox mock for browser end-to-end tests. No network or real Totus data.
(()=>{
const uuid=()=>crypto.randomUUID();
const cents=v=>Math.sign(v)*Math.round((Math.abs(v)+Number.EPSILON)*100)/100;
const storeA='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const storeB='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const userId='cccccccc-cccc-4ccc-cccc-cccccccccccc';
const session={user:{id:userId,email:'qa@example.com'},access_token:'qa-sandbox'};
const role=new URLSearchParams(location.search).get('role')||'admin';
const db={
 ops_backup_config:[{id:1,enabled:false,frequency:'daily',run_hour:3,run_minute:0,weekday:1,month_day:1,retention_days:10,destination_folder:'automaticas'}],
 ops_backup_runs:[],
 ops_recovery_jobs:[],
 team_email_log:[],
 team_user_audit_log:[],
 ops_chat_events:[],
 ops_task_events:[],
 ops_roles:[{code:'admin',name:'Administrador',is_system:true,sort_order:0},{code:'gerente',name:'Gerencia',is_system:true,sort_order:10},{code:'encargado',name:'Encargado',is_system:true,sort_order:20}],
 ops_role_permissions:[],
 ops_user_permissions:[],
 team_members:[{id:userId,email:'qa@example.com',full_name:'Administración QA',role,active:true}],
 profiles:[{id:userId,email:'qa@example.com'}],
 ops_business_settings:[{id:1,business_name:'Totus QA',tax_id:'00000000X',business_address:'Calle Pruebas 1',business_email:'qa@example.com',document_max_bytes:20971520,storage_limit_bytes:524288000,default_sales_vat_rate:21,purchase_re_rate:5.2,irpf_prepayment_rate:20,difficult_expense_pct:5,difficult_expense_annual_cap:2000,current_year:2026}],
 ops_stores:[{id:storeA,name:'Hortimatic',code:'HORTI',active:true,sort_order:1},{id:storeB,name:'NewOldSmok',code:'NOS',active:true,sort_order:2}],
 ops_cash_drawers:[{id:uuid(),store_id:storeA,name:'Caja Vape',code:'VAPE',active:true,sort_order:1},{id:uuid(),store_id:storeA,name:'Caja Head',code:'HEAD',active:true,sort_order:2},{id:uuid(),store_id:storeB,name:'Caja Vape',code:'VAPE',active:true,sort_order:1}],
 ops_expense_categories:[{id:uuid(),name:'Mercancía',code:'MERCH',active:true,sort_order:1},{id:uuid(),name:'Alquiler',code:'RENT',active:true,sort_order:2}],
 ops_suppliers:[{id:uuid(),name:'Proveedor QA',tax_id:'B00000000',active:true}],
 ops_customers:[],
 ops_invoice_series:[
  {id:uuid(),store_id:storeA,code:'H26',prefix:'H-',padding:4,year:2026,next_number:1,document_type:'factura',series_kind:'invoice',active:true},
  {id:uuid(),store_id:storeA,code:'RH26',prefix:'RH-',padding:4,year:2026,next_number:1,document_type:'factura',series_kind:'rectifying',active:true},
  {id:uuid(),store_id:storeA,code:'PH26',prefix:'PH-',padding:4,year:2026,next_number:1,document_type:'proforma',series_kind:'invoice',active:true},
  {id:uuid(),store_id:storeB,code:'N26',prefix:'N-',padding:4,year:2026,next_number:1,document_type:'factura',series_kind:'invoice',active:true}
 ],
 ops_document_templates:[{id:uuid(),name:'QA Minimal',code:'MIN',style:'clean',active:true,default_invoice:true,default_proforma:true,primary_color:'#15243d',secondary_color:'#3b82f6',text_color:'#111827'}]
};
const uploaded=new Map();
const archivedDocuments=new Map(),removedDocuments=new Map();
window.__mockArchivedDocuments=archivedDocuments;
for(const table of ['ops_stock_receipts','ops_stock_sources','ops_stock_revisions','ops_stock_equivalences','ops_daily_closings','ops_daily_closing_drawers','ops_expenses','ops_expense_lines','ops_sales_invoices','ops_sales_invoice_lines','ops_documents','ops_tax_payments','ops_reta_brackets','ops_fiscal_adjustments','ops_income_adjustments','ops_audit_log','brands','families','products','product_variants','providers','product_provider_prices','product_competitor_prices','consultations','consultation_history','price_history'])db[table]=[];
window.__mockDb=db;
window.__mockUploads=uploaded;
const documentRemovals=new Map();window.__mockDocumentRemovals=documentRemovals;
let events=null;
function syncDocumentLink(table,row){
 const field=table==='ops_expenses'?'document_id':table==='ops_sales_invoices'?'source_document_id':null;
 if(!field)return;
 const type=table==='ops_expenses'?'expense':'sales_invoice',target=row[field]||null;
 for(const doc of db.ops_documents){
  if(doc.linked_entity_id===row.id&&doc.linked_entity_type===type&&doc.id!==target)Object.assign(doc,{linked_entity_id:null,linked_entity_type:''});
  if(doc.id===target)Object.assign(doc,{linked_entity_id:row.id,linked_entity_type:type});
 }
}
class Query{
 constructor(table){this.table=table;this.mode='select';this.value=null;this.filters=[];this.orderBy=[];this.rangeBy=null;}
 select(){return this}
 insert(v){this.mode='insert';this.value=v;return this}
 update(v){this.mode='update';this.value=v;return this}
 upsert(v,{onConflict}={}){this.mode='upsert';this.value=v;this.conflictKeys=String(onConflict||'id').split(',');return this}
 delete(){this.mode='delete';return this}
 eq(k,v){this.filters.push([k,v,'eq']);return this}
 neq(k,v){this.filters.push([k,v,'neq']);return this}
 gte(k,v){this.filters.push([k,v,'gte']);return this}
 is(k,v){this.filters.push([k,v,'is']);return this}
 order(k,{ascending=false}={}){this.orderBy.push([k,ascending]);return this}
 range(a,b){this.rangeBy=[a,b];return this}
 limit(n){this.rangeBy=[0,n-1];return this}
 result(){
  const target=db[this.table];
  if(!target)return {data:null,error:{message:'Tabla de pruebas no definida: '+this.table}};
  if(this.table==='consultation_history'&&['insert','update','upsert'].includes(this.mode)){
   for(const row of Array.isArray(this.value)?this.value:[this.value])if(row.action!==undefined&&!['CREADA','ABIERTA','ACTUALIZADA','CONVERTIDA','ELIMINADA'].includes(row.action))return {data:null,error:{message:'consultation_history_action_check'}};
  }
  if(this.table==='ops_document_templates'&&['insert','update','upsert'].includes(this.mode)){
   for(const row of Array.isArray(this.value)?this.value:[this.value]){
    if(row.style!==undefined&&!['clean','brand','compact'].includes(row.style))return {data:null,error:{message:'ops_document_templates_style_check'}};
    if(row.font_family!==undefined&&!['helvetica','times','courier'].includes(row.font_family))return {data:null,error:{message:'ops_document_templates_font_family_check'}};
   }
  }
  let matches=target.filter(r=>this.filters.every(([k,v,op])=>op==='neq'?r[k]!==v:op==='gte'?r[k]>=v:op==='is'?(v===null?r[k]==null:r[k]===v):r[k]===v));
  if(this.mode==='insert'){
   if(window.__mockRejectInsertTable===this.table){
    window.__mockRejectInsertTable=null;
    return {data:null,error:{message:'Error simulado al registrar el coste en el proveedor'}};
   }
   let rows=(Array.isArray(this.value)?this.value:[this.value]).map(x=>({id:uuid(),created_at:new Date().toISOString(),...x}));
   target.push(...rows);return {data:rows,error:null};
  }
  if(this.mode==='upsert'){
   const rows=(Array.isArray(this.value)?this.value:[this.value]).map(x=>{
    const old=target.find(v=>this.conflictKeys.every(k=>v[k]===x[k]));
    if(old){Object.assign(old,x);return old}
    const next={id:uuid(),created_at:new Date().toISOString(),...x};target.push(next);return next;
   });
   return {data:rows,error:null};
  }
  if(this.mode==='update'){for(const r of matches){Object.assign(r,this.value);syncDocumentLink(this.table,r)}return {data:matches,error:null}}
  if(this.mode==='delete'){for(const r of matches){const i=target.indexOf(r);if(i>=0)target.splice(i,1)}return {data:matches,error:null}}
  if(this.orderBy.length)matches=[...matches].sort((a,b)=>{for(const [key,ascending] of this.orderBy){const cmp=typeof a[key]==='number'&&typeof b[key]==='number'?a[key]-b[key]:String(a[key]??'').localeCompare(String(b[key]??''));if(cmp)return cmp*(ascending?1:-1)}return 0;});
  if(this.rangeBy)matches=matches.slice(this.rangeBy[0],this.rangeBy[1]+1);
  return {data:matches,error:null};
 }
 async single(){const r=databaseResult(this.result());return {data:Array.isArray(r.data)?r.data[0]||null:r.data,error:r.error}}
 async maybeSingle(){return this.single()}
 then(ok,fail){return Promise.resolve(databaseResult(this.result())).then(ok,fail)}
}
function databaseResult(result){return result.error&&!Object.hasOwn(result.error,'code')?{...result,error:{...result.error,code:'P0001'}}:result;}
const sum=(rows,cb)=>rows.reduce((v,x)=>v+Number(cb(x)||0),0);
const get=(name,id)=>db[name]?.find(x=>x.id===id);
const insert=(name,row)=>{const r={id:uuid(),created_at:new Date().toISOString(),...row};db[name].push(r);return r};
const rpc=async (name,args={})=>{
 if(name==='totus_pending_document_removals')return {data:[...documentRemovals.values()],error:null};
 if(name==='totus_begin_document_removal'){
   const doc=get('ops_documents',args.p_id);if(!doc){const removed=removedDocuments.get(args.p_id);return removed?.storage_path===args.p_path&&removed.sha256===(args.p_sha256||'')?{data:{id:args.p_id,status:'already_removed'},error:null}:{data:null,error:{message:'El documento ya no está disponible. Actualiza el listado.'}};}
  if(doc.storage_path!==args.p_path||(doc.sha256||'')!==(args.p_sha256||''))return {data:null,error:{message:'El archivo ha cambiado desde que abriste la ficha.',code:'40001'}};
  const linked=db.ops_expenses.some(r=>r.document_id===doc.id)||db.ops_tax_payments.some(r=>r.document_id===doc.id)||db.ops_sales_invoices.some(r=>r.source_document_id===doc.id||r.generated_document_id===doc.id)||db.ops_fiscal_adjustments.some(r=>r.document_id===doc.id)||db.ops_stock_sources.some(r=>r.document_id===doc.id);
  if(linked)return {data:null,error:{message:'Este documento está vinculado a otro registro. Quita primero el vínculo desde su ficha.'}};
  documentRemovals.set(doc.id,{id:doc.id,storage_path:doc.storage_path,sha256:doc.sha256||''});return {data:{id:doc.id,status:'pending'},error:null};
 }
 if(name==='totus_finish_document_removal'){
  const doc=get('ops_documents',args.p_id);if(!doc)return {data:{id:args.p_id,status:'already_removed'},error:null};
  if(!documentRemovals.has(doc.id)||doc.storage_path!==args.p_path)return {data:null,error:{message:'No coincide la solicitud de eliminación con el archivo actual.'}};
  if(uploaded.has('business-documents/'+doc.storage_path))return {data:null,error:{message:'El archivo sigue en Supabase. Su ficha se conserva para reintentar la eliminación.'}};
   removedDocuments.set(doc.id,{storage_path:doc.storage_path,sha256:doc.sha256||''});db.ops_documents.splice(db.ops_documents.indexOf(doc),1);documentRemovals.delete(doc.id);return {data:{id:doc.id,status:'removed'},error:null};
 }
 const writeTargets={totus_save_expense:['ops_expenses','p_expense'],totus_save_closing:['ops_daily_closings','p_closing'],totus_save_sales_document:['ops_sales_invoices','p_document']};
 if(writeTargets[name]){
  const [table,key]=writeTargets[name],payload=args[key]||{},row=payload.id?get(table,payload.id):null;
  if(payload.id&&Object.hasOwn(payload,'expected_updated_at')){
   if(!row)return {data:null,error:{message:'El registro ya no existe. Actualiza el listado antes de continuar.',code:'P0001'}};
   const same=(row.updated_at==null&&payload.expected_updated_at==null)||Date.parse(row.updated_at)===Date.parse(payload.expected_updated_at);
   if(!same)return {data:null,error:{message:'Este registro ha cambiado desde que abriste la ficha. Actualiza y revisa los cambios antes de guardar.',code:'40001'}};
  }
  const clean={...payload};delete clean.expected_updated_at;args={...args,[key]:clean};
 }
 if(name==='totus_export_recovery_snapshot'){
  if(role!=='admin')return {data:null,error:{message:'Solo administración'}};
  const {RECOVERY_TABLES,recoveryFileReferences}=await import('../src/recovery-core.js');
  const database=Object.fromEntries(RECOVERY_TABLES.map(table=>[table,structuredClone(db[table]||[]).sort((a,b)=>String(a.id||a.code||a.email).localeCompare(String(b.id||b.code||b.email)))]));
  return {data:{database,storage:recoveryFileReferences(database),identities:db.profiles.map(p=>({id:p.id,email:p.email})),database_instance:userId,schema_hash:'a'.repeat(64),revision:'b'.repeat(64),created_at:new Date().toISOString()},error:null};
 }
 if(name==='totus_set_closed_period'){
  if(role!=='admin')return {data:null,error:{message:'Solo administración puede cerrar o reabrir un periodo'}};
  Object.assign(db.ops_business_settings[0],{closed_through:args.p_through,period_close_notes:args.p_reason});
  insert('ops_audit_log',{area:'fiscalidad',action:'periodo_cierre',detail:{through:args.p_through,reason:args.p_reason}});
  return {data:null,error:null};
 }
 if(name==='totus_set_expense_payment'){
  const row=get('ops_expenses',args.p_id);
  if(!row)return {data:null,error:{message:'Gasto no encontrado'}};
  Object.assign(row,{paid_status:args.p_status,amount_paid:args.p_amount,paid_date:args.p_status==='pendiente'?null:args.p_date});
  insert('ops_audit_log',{area:'gastos',action:'pago_registrado',entity_id:row.id,detail:{status:args.p_status,amount:args.p_amount,date:args.p_date}});
  return {data:null,error:null};
 }
 if(name==='totus_backup_save_settings'){
  if(role!=='admin')return {data:null,error:{message:'Solo administrador'}};
  const x=args.p||{};
  Object.assign(db.ops_backup_config[0],x,{updated_at:new Date().toISOString()});
  return {data:null,error:null};
 }
 if(name==='totus_backup_contract')return {data:{version:window.__mockContractVersion||1,income_adjustments:true,storage:true},error:null};
 if(name==='totus_restore_backup'){
  if(window.__mockContractVersion!==2)return {data:null,error:{message:'Contrato SQL antiguo'}};
  for(const [table,rows] of Object.entries(args.p_payload||{}))if(Array.isArray(rows))db[table]=structuredClone(rows);
  return {data:{restored:true},error:null};
 }
 if(name==='totus_record_activity'){db.ops_audit_log.push({id:crypto.randomUUID(),user_email:session.user.email,area:args.p_area,action:args.p_action,created_at:new Date().toISOString(),detail:{referencia:args.p_reference}});return {data:null,error:null};}
 if(name==='totus_storage_usage'){
  if(window.__mockStorageFailure)return {data:null,error:{message:'Servicio Storage temporalmente no disponible'}};
  const keys=[...uploaded.keys()],measure=bucket=>keys.filter(k=>k.startsWith(bucket+'/')).reduce((total,k)=>total+Number(uploaded.get(k)?.size||0),0);
  const docs=measure('business-documents'),assets=measure('business-assets'),backups=measure('business-backups'),limit=Number(db.ops_business_settings?.[0]?.storage_limit_bytes||524288000);
  const samples=window.__mockStorageSamples||[],day=window.__mockStorageDailyGrowthBytes||null;
  return {data:{status:'ok',source:'supabase_storage_objects',measured_at:new Date().toISOString(),
    documents_count:keys.filter(k=>k.startsWith('business-documents/')).length,documents_bytes:docs,
    assets_bytes:assets,assets_count:keys.filter(k=>k.startsWith('business-assets/')).length,
    backup_bytes:backups,backup_count:keys.filter(k=>k.startsWith('business-backups/')).length,
    total_bytes:docs+assets,all_buckets_bytes:docs+assets+backups,limit_bytes:limit,
    database_bytes:16*1024*1024,observed_total_bytes:16*1024*1024+docs+assets+backups,
    usage_percent:Number(((docs+assets)*100/limit).toFixed(2)),available_bytes:Math.max(0,limit-docs-assets),
    sample_count:samples.length,trend_days:day?14:null,daily_growth_bytes:day,
    estimated_days_left:day&&docs+assets<limit?Math.ceil((limit-docs-assets)/day):null
  },error:null};
 }
 if(name==='totus_delete_income_adjustment'){
  const id=args.p_id,reason=String(args.p_reason||'').trim();
  if(!reason)return {data:null,error:{message:'Motivo obligatorio'}};
  const row=get('ops_income_adjustments',id);
  if(!row)return {data:null,error:{message:'Ingreso manual no encontrado'}};
  insert('ops_audit_log',{area:'fiscalidad',action:'eliminar_ingreso_manual',entity_id:id,detail:{motivo:reason,concepto:row.concept,importe:row.amount}});
  db.ops_income_adjustments=db.ops_income_adjustments.filter(x=>x.id!==id);
  return {data:id,error:null};
 }
 if(['totus_delete_closing','totus_delete_expense','totus_delete_sales_draft'].includes(name)){
  const id=args.p_id,reason=String(args.p_reason||'').trim();
  if(!reason)return {data:null,error:{message:'Motivo obligatorio'}};
  const kind=name==='totus_delete_closing'?'ops_daily_closings':name==='totus_delete_expense'?'ops_expenses':'ops_sales_invoices';
  const row=get(kind,id);if(!row)return {data:null,error:{message:'Registro no encontrado'}};
  if(name==='totus_delete_sales_draft'){
   if(row.status!=='borrador'||row.number!=null||String(row.display_number||'').trim()||row.issued_at)
    return {data:null,error:{message:'Documento emitido o numerado: usa rectificativa'}};
   if(db.ops_sales_invoices.some(x=>x.source_proforma_document_id===id||x.converted_invoice_id===id))
    return {data:null,error:{message:'Borrador vinculado a otro documento'}};
  }
  const children=kind==='ops_daily_closings'?'ops_daily_closing_drawers':kind==='ops_expenses'?'ops_expense_lines':'ops_sales_invoice_lines';
  const key=kind==='ops_daily_closings'?'closing_id':kind==='ops_expenses'?'expense_id':'invoice_id';
  syncDocumentLink(kind,{...row,document_id:null,source_document_id:null});
  db[children]=db[children].filter(x=>x[key]!==id);
  db[kind]=db[kind].filter(x=>x.id!==id);
  insert('ops_audit_log',{area:kind,action:'eliminar',entity_id:id,detail:{motivo:reason}});
  return {data:id,error:null};
 }
 if(name==='totus_pricing_save_provider'){
  const p=args.p_price;if(p.selected)db.product_provider_prices.filter(x=>x.product_id===p.product_id&&!x.variant_id).forEach(x=>x.selected=false);
  const row=p.id?Object.assign(get('product_provider_prices',p.id),p):insert('product_provider_prices',p);
  return {data:row.id,error:null};
 }
 if(name==='totus_pricing_save_product'){
  const p=args.p_product,children=args.p_variants||[],old=get('products',p.id);
  // Simulate failure before the atomic RPC commits; SQL tests cover late rollback.
  if(args.p_provider&&window.__mockRejectInsertTable==='product_provider_prices'){delete window.__mockRejectInsertTable;return {data:null,error:{message:'No se pudo guardar el coste del proveedor. No se ha creado el producto: rechazo de prueba'}}}
  if(window.__mockPricingFailure)return {data:null,error:{message:'Fallo de guardado simulado'}};
  if(p.is_new&&old)return {data:null,error:{message:'El producto ya existe'}};
  if(!p.is_new&&(!old||old.updated_at!==(p.expected_updated_at||null)))return {data:null,error:{message:'El producto ha cambiado'}};
  const {is_new,expected_updated_at,...clean}=p;
  const row=old?Object.assign(old,clean):insert('products',{...clean,created_by:userId});
  children.forEach(v=>insert('product_variants',{...v,product_id:row.id}));
  if(args.p_provider){const pp=args.p_provider,provider=db.providers.find(v=>v.name.toLowerCase()===pp.name.toLowerCase())||insert('providers',{name:pp.name,active:true});insert('product_provider_prices',{...pp,provider_id:provider.id,product_id:row.id,selected:true});}
  insert('price_history',{product_id:row.id,user_id:userId,snapshot:{action:old?'PRODUCTO_EDITADO':'PRODUCTO_CREADO',product:{...row},variants:structuredClone(db.product_variants.filter(v=>v.product_id===row.id))}});
  if(p.consultation_id)insert('consultation_history',{consultation_id:p.consultation_id,action:'CONVERTIDA',user_id:userId,snapshot:{product_id:row.id}});
  return {data:{product:row,replayed:false},error:null};
 }
 if(name==='totus_save_closing'){
  const p=args.p_closing,drawers=args.p_drawers||[];let row=p.id?get('ops_daily_closings',p.id):null;
  if(!row)row=insert('ops_daily_closings',{status:'borrador'});
  Object.assign(row,p,{id:row.id,status:p.status||'borrador',entry_mode:'manual',source:'manual',
    cash_sales:sum(drawers,d=>Number(d.closing_cash)-Number(d.opening_cash)+Number(d.cash_withdrawals)+Number(d.cash_expenses_declared)+Number(d.cash_extra_out)-Number(d.cash_extra_in)),
    card_sales:sum(drawers,d=>d.card_sales),bizum_sales:sum(drawers,d=>d.bizum_sales),online_sales:sum(drawers,d=>d.online_sales),other_income:sum(drawers,d=>d.other_income),
    cash_withdrawals:sum(drawers,d=>d.cash_withdrawals),cash_expenses_declared:sum(drawers,d=>d.cash_expenses_declared),
    opening_cash:sum(drawers,d=>d.opening_cash),actual_cash:sum(drawers,d=>d.closing_cash),difference:0,include_in_income:row.include_in_income??true});
  db.ops_daily_closing_drawers=db.ops_daily_closing_drawers.filter(d=>d.closing_id!==row.id);
  drawers.forEach(d=>insert('ops_daily_closing_drawers',{...d,closing_id:row.id}));
  return {data:row.id,error:null};
 }
 if(name==='totus_save_report_layout'){
  const order=args.p_order,allowed=['income','internal','monthly','gestor','exports'];
  if(!Array.isArray(order)||order.length!==5||new Set(order).size!==5||order.some(x=>!allowed.includes(x)))return {data:null,error:{message:'Orden no válido'}};
  const profile=db.profiles.find(x=>x.id===userId);profile.ui_preferences={...(profile.ui_preferences||{}),report_blocks:[...order]};
  return {data:[...order],error:null};
 }
 if(name==='totus_set_expense_report_group'){
  const row=get('ops_expenses',args.p_id);if(!row)return {data:null,error:{message:'Gasto no encontrado'}};
  const source=JSON.parse(row.source_ref||'{}');
  if((source.report_display?.group||null)!==(args.p_expected_group||null))return {data:null,error:{message:'La categoría del Excel ha cambiado'}};
  if(args.p_group&&!['other','payroll','orders','fixed','irpf'].includes(args.p_group))return {data:null,error:{message:'Categoría no válida'}};
  if(args.p_group)source.report_display={group:args.p_group};else delete source.report_display;
  row.source_ref=Object.keys(source).length?JSON.stringify(source):null;
  insert('ops_audit_log',{area:'gastos',action:'categoria_excel',entity_id:row.id});
  return {data:row.id,error:null};
 }
 if(name==='totus_save_expense'){
  const p=args.p_expense,lines=args.p_lines||[];let row=p.id?get('ops_expenses',p.id):null;
  if(!row)row=insert('ops_expenses',{});
  const base=cents(sum(lines,l=>l.base_amount)),vat=cents(sum(lines,l=>cents(l.base_amount*l.vat_rate/100))),re=cents(sum(lines,l=>cents(l.base_amount*l.re_rate/100))),wh=cents(sum(lines,l=>cents(l.base_amount*l.withholding_rate/100)));
  Object.assign(row,p,{id:row.id,base_amount:base,vat_amount:vat,re_amount:re,withholding_amount:wh,accounting_amount:cents(base+vat+re),gross_expense:cents(base+vat+re)});
  if(Object.hasOwn(p,'report_group')){const source=JSON.parse(row.source_ref||'{}');if(p.report_group)source.report_display={group:p.report_group};else delete source.report_display;row.source_ref=Object.keys(source).length?JSON.stringify(source):null;delete row.report_group;}
  syncDocumentLink('ops_expenses',row);
  db.ops_expense_lines=db.ops_expense_lines.filter(l=>l.expense_id!==row.id);
  lines.forEach(l=>insert('ops_expense_lines',{...l,expense_id:row.id,vat_amount:cents(l.base_amount*l.vat_rate/100),re_base:l.re_rate?l.base_amount:0,re_amount:cents(l.base_amount*l.re_rate/100),withholding_base:l.withholding_rate?l.base_amount:0,withholding_amount:cents(l.base_amount*l.withholding_rate/100),irpf_imputable:l.deductible_irpf&&!l.fixed_asset?cents((l.base_amount+cents(l.base_amount*l.vat_rate/100)+cents(l.base_amount*l.re_rate/100))*(l.deductible_pct??100)/100):0}));
  return {data:row.id,error:null};
 }
 if(name==='totus_save_sales_document'){
  const p=args.p_document,lines=args.p_lines||[];let row=p.id?get('ops_sales_invoices',p.id):null;if(!row)row=insert('ops_sales_invoices',{});
  const base=sum(lines,l=>l.quantity*l.unit_price_base*(1-l.discount_pct/100)),vat=sum(lines,l=>l.quantity*l.unit_price_base*(1-l.discount_pct/100)*l.vat_rate/100);
  Object.assign(row,p,{id:row.id,base_amount:base,vat_amount:vat,total_amount:base+vat,status:'borrador',display_number:''});
  syncDocumentLink('ops_sales_invoices',row);
  db.ops_sales_invoice_lines=db.ops_sales_invoice_lines.filter(l=>l.invoice_id!==row.id);
  lines.forEach(l=>insert('ops_sales_invoice_lines',{...l,invoice_id:row.id}));
  return {data:row.id,error:null};
 }
 if(name==='totus_finalize_sales_document'){
  const row=get('ops_sales_invoices',args.p_id);if(!row)return {data:null,error:{message:'Factura no encontrada'}};
  const series=get('ops_invoice_series',row.series_id);row.status='emitida';const next=series?.next_number||1;if(series)series.next_number=next+1;row.display_number=(series?.prefix||'QA-')+String(next).padStart(4,'0');return {data:row.id,error:null};
 }
 if(name==='totus_update_invoice_payment'){const row=get('ops_sales_invoices',args.p_id);if(row)Object.assign(row,args.p_payment);return {data:row?.id||null,error:null}}
 if(name==='totus_convert_proforma'){
  const row=get('ops_sales_invoices',args.p_id);
  if(!row||row.document_type!=='proforma')return {data:null,error:{message:'Proforma no encontrada'}};
  if(row.status==='convertida'&&row.converted_invoice_id)return {data:row.converted_invoice_id,error:null};
  if(!['emitida','aceptada'].includes(row.status))return {data:null,error:{message:'Emite o acepta la proforma antes de convertirla'}};
  const copy=insert('ops_sales_invoices',{...row,id:uuid(),series_id:args.p_invoice_series,document_type:'factura',invoice_kind:'invoice',status:'borrador',display_number:'',origin:'totus',include_in_income:false,paid_status:'pendiente',source_proforma_document_id:row.id,converted_invoice_id:null});
  db.ops_sales_invoice_lines.filter(x=>x.invoice_id===row.id).forEach(x=>insert('ops_sales_invoice_lines',{...x,id:uuid(),invoice_id:copy.id}));
  row.status='convertida';row.converted_invoice_id=copy.id;
  return {data:copy.id,error:null};
 }
 return {data:null,error:{message:'RPC de prueba sin implementar: '+name}};
};
const storageBucket=bucket=>({
 upload:async(path,file)=>{uploaded.set(bucket+'/'+path,file);return {data:{path},error:null}},
 download:async path=>{const file=uploaded.get(bucket+'/'+path);return {data:file||null,error:file?null:{message:'Archivo no encontrado'}}},
 remove:async paths=>{if(window.__mockStorageRemoveError)return {data:null,error:{message:'Storage no disponible'}};if(window.__mockStorageRemoveNoop)return {data:[],error:null};paths.forEach(path=>uploaded.delete(bucket+'/'+path));return {data:paths,error:null}},
 exists:async path=>({data:window.__mockStorageHeadStale||uploaded.has(bucket+'/'+path),error:window.__mockStorageHeadStale||uploaded.has(bucket+'/'+path)?null:{message:'Not found',originalError:{status:404}}}),
 list:async (prefix='',options={})=>({data:[...uploaded.keys()].filter(k=>k.startsWith(bucket+'/'+prefix)).slice(options.offset||0,(options.offset||0)+(options.limit||1000)).map(k=>({id:uuid(),name:k.slice((bucket+'/'+(prefix?prefix+'/':'')).length)})),error:null}),
 createSignedUrl:async path=>{const f=uploaded.get(bucket+'/'+path);return {data:{signedUrl:f?URL.createObjectURL(f):''},error:f?null:{message:'No encontrado'}}}
});
const mockCloudBackup=async()=>{
 const {buildRecoveryArchive}=await import('../src/recovery-core.js');
 const {data:snapshot}=await rpc('totus_export_recovery_snapshot');
 snapshot.project_ref='awmojepsasikxocoeqtu';
 const {bytes,manifest}=await buildRecoveryArchive(snapshot,window.JSZip,async(bucket,path)=>uploaded.get(bucket+'/'+path));
 const database=snapshot.database,files=manifest.storage,blob=new Blob([bytes]);
 const id=uuid(),path='automaticas/QA_'+id+'.totusbackup';
 uploaded.set('business-backups/'+path,blob);
 db.ops_backup_runs.unshift({id,mode:'manual',status:'success',started_at:new Date().toISOString(),finished_at:new Date().toISOString(),storage_path:path,size_bytes:blob.size,rows_count:Object.values(database).reduce((n,x)=>n+x.length,0),files_count:Object.values(files).reduce((n,x)=>n+x.length,0)});
 const expired=db.ops_backup_runs.filter(r=>r.status==='success'&&r.storage_path).sort((a,b)=>b.started_at.localeCompare(a.started_at)).slice(10);
 for(const previous of expired){
  uploaded.delete('business-backups/'+previous.storage_path);
  previous.status='expired';
  previous.storage_path=null;
 }
 return {data:{id,status:'success',size_bytes:blob.size},error:null};
};
const client={
 auth:{getSession:async()=>({data:{session},error:null}),signInWithPassword:async()=>({data:{session},error:null}),signOut:async()=>{events?.('SIGNED_OUT',null);return {error:null}},resetPasswordForEmail:async()=>({data:{},error:null}),onAuthStateChange:fn=>{events=fn;return {data:{subscription:{unsubscribe(){}}}}}},
 from:table=>new Query(table),
 rpc:async(name,args)=>{
  if(name==='totus_business_write_contract')return databaseResult({data:{request_replay:1},error:null});
  const key={totus_save_expense:'p_expense',totus_save_closing:'p_closing',totus_save_sales_document:'p_document'}[name];
  const request=key&&args?.[key]?.request_id;
  const cache=window.__mockBusinessRequests||=(new Map());
  const cached=request&&cache.get(request);
  if(cached)return databaseResult(cached.fingerprint===JSON.stringify(args)?structuredClone(cached.response):{data:null,error:{message:'Solicitud utilizada con otros datos',code:'P0001'}});
  const executable=request?structuredClone(args):args;
  if(request)delete executable[key].request_id;
  const response=await rpc(name,executable);
  if(request&&!response.error)cache.set(request,{fingerprint:JSON.stringify(args),response:structuredClone(response)});
  return databaseResult(response);
 },
 functions:{invoke:async (name,options)=>{
 if(name==='totus-onedrive'&&options?.body?.action==='complete-document-removal'){
  const request=options.body,args={p_id:request.id,p_path:request.path,p_sha256:request.sha256||''};
  const begun=await rpc('totus_begin_document_removal',args);if(begun.error||begun.data?.status==='already_removed')return begun;
  const doc=get('ops_documents',request.id),blob=uploaded.get('business-documents/'+request.path)||archivedDocuments.get(request.id)?.blob;
  if(window.__mockArchiveError||!blob)return {data:{error:'No se pudo verificar el archivo recuperable. El original se conserva.'},error:null};
  const bytes=await blob.arrayBuffer(),sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
  if(doc.sha256&&doc.sha256!==sha||doc.size_bytes!=null&&Number(doc.size_bytes)!==blob.size)return {data:{error:'El archivo recuperable no coincide con el documento.'},error:null};
  archivedDocuments.set(doc.id,{blob,sha256:sha,storage_path:doc.storage_path});
  const store=storageBucket('business-documents'),removed=await store.remove([request.path]);
  if(removed.error)return {data:{error:'No se pudo retirar el archivo de Supabase.'},error:null};
  const slash=request.path.lastIndexOf('/'),folder=slash<0?'':request.path.slice(0,slash),name=request.path.slice(slash+1);
  const remaining=await store.list(folder,{search:name,limit:100,offset:0});
  if(remaining.error||!Array.isArray(remaining.data)||remaining.data.length>=100||remaining.data.some(file=>file.name===name))return {data:{error:'El archivo sigue en Supabase. Se conserva su ficha para reintentar.'},error:null};
  return await rpc('totus_finish_document_removal',args);
 }
 if(name!=='totus-backup-run')return {data:null,error:{message:'Función no simulada'}};
 if(options?.body?.action!=='delete')return await mockCloudBackup();
 const saved=db.ops_backup_runs.filter(r=>r.status==='success'&&r.storage_path);
 const target=saved.find(r=>r.id===options.body.id);
 if(!target||saved.length<=1)return {data:{error:'Conserva al menos una copia guardada.'},error:null};
 uploaded.delete('business-backups/'+target.storage_path);target.storage_path=null;target.status='expired';
 return {data:{deleted:target.id},error:null};
 }},
 storage:{from:storageBucket}
};
window.supabase={createClient:()=>client};
const originalFetch=window.fetch.bind(window);
window.fetch=async (url,opts)=>{
 if(String(url).includes('/functions/v1/totus-onedrive')&&JSON.parse(opts?.body||'{}').action==='document-file-url')
  return new Response(JSON.stringify({provider:'supabase'}),{status:200,headers:{'Content-Type':'application/json'}});

 if(String(url).includes('/functions/v1/team-admin')){
  const p=JSON.parse(opts?.body||'{}');
  if(p.action==='create_user'){db.team_members.push({id:uuid(),email:p.email,full_name:p.full_name,role:p.role,active:true});return new Response(JSON.stringify({ok:true}),{status:200,headers:{'Content-Type':'application/json'}})}
  if(p.action==='update_member'){const row=db.team_members.find(x=>x.email===p.email);if(row)Object.assign(row,p);return new Response(JSON.stringify({ok:true}),{status:200,headers:{'Content-Type':'application/json'}})}
  if(p.action==='set_active'){const row=db.team_members.find(x=>x.email===p.email);if(row)row.active=p.active;return new Response(JSON.stringify({ok:true}),{status:200,headers:{'Content-Type':'application/json'}})}
  if(p.action==='hard_delete'){const ix=db.team_members.findIndex(x=>x.email===p.email);if(ix>=0)db.team_members.splice(ix,1);return new Response(JSON.stringify({ok:true}),{status:200,headers:{'Content-Type':'application/json'}})}
  return new Response(JSON.stringify({ok:true}),{status:200,headers:{'Content-Type':'application/json'}});
 }
 return originalFetch(url,opts);
};
})();
