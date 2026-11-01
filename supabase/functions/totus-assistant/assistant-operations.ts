// Explicit catalogue, executed with the caller's own Auth session, never service_role.
// The existing business RPC remains responsible for permissions, revisions and audit.
const rpcArguments:Record<string,string[]>=Object.fromEntries([
 ['totus_business_write_contract',''],
 ['totus_save_closing','p_closing p_drawers'],
 ['totus_delete_closing','p_id p_reason'],
 ['totus_save_sales_document','p_document p_lines'],
 ['totus_delete_sales_draft','p_id p_reason'],
 ['totus_finalize_sales_document','p_id'],
 ['totus_convert_proforma','p_id p_invoice_series'],
 ['totus_register_external_document','p_id p_number'],
 ['totus_update_invoice_payment','p_id p_payment'],
 ['totus_delete_expense','p_id p_reason'],
 ['totus_set_expense_payment','p_id p_status p_amount p_date'],
 ['totus_set_expense_report_group','p_id p_group p_expected_group'],
 ['totus_delete_income_adjustment','p_id p_reason'],
 ['totus_pricing_save_product','p_product p_variants p_provider'],
 ['totus_pricing_save_provider','p_price'],
 ['totus_stock_context','p_id p_actor_email'],
 ['totus_stock_create','p_store p_supplier p_reference p_date p_notes p_actor_email'],
 ['totus_stock_edit','p_id p_revision p_store p_supplier p_reference p_date p_notes p_actor_email'],
 ['totus_stock_add_source','p_id p_revision p_document p_kind p_text p_extraction p_actor_email'],
 ['totus_stock_import_request','p_id p_revision p_kind p_path p_item p_name p_quickxor p_text p_extraction p_actor_email'],
 ['totus_stock_remove_source','p_id p_revision p_source p_reason p_actor_email'],
 ['totus_stock_save_result','p_id p_revision p_result p_actor_email'],
 ['totus_stock_correct_units','p_id p_revision p_line_id p_expected p_received p_reason p_actor_email'],
 ['totus_stock_mark_reviewed','p_id p_revision p_note p_actor_email'],
 ['totus_stock_confirm_equivalence','p_store p_supplier p_supplier_name p_prestashop_name p_variant p_unit p_factor p_evidence p_actor_email'],
 ['totus_stock_delete','p_id p_revision p_reference p_reason'],
 ['totus_tasks_context','p_from p_to'],
 ['totus_task_command','p_action p_data'],
 ['totus_task_from_message','p_message'],
 ['totus_task_history','p_task'],
 ['totus_save_report_layout','p_order'],
 ['totus_save_my_appearance','p_config p_expected_revision'],
 ['totus_save_appearance','p_section p_config p_expected_revision'],
 ['totus_ai_settings','p_config'],
 ['totus_ai_request','p_message'],
 ['totus_storage_usage',''],
 ['totus_log_cleanup','p_from p_to p_execute p_fingerprint'],
 ['totus_set_closed_period','p_through p_reason']
].map(([name,args])=>[name,args?args.split(' '):[]]));

const tables=new Set(['ops_stores','ops_cash_drawers','ops_daily_closings','ops_daily_closing_drawers',
 'ops_expenses','ops_expense_lines','ops_suppliers','ops_expense_categories','ops_documents',
 'ops_customers','ops_sales_invoices','ops_sales_invoice_lines','ops_invoice_series','ops_document_templates',
 'ops_tax_payments','ops_fiscal_adjustments','ops_income_adjustments','ops_stock_receipts',
 'brands','families','products','product_variants','providers','product_provider_prices',
 'product_competitor_prices','consultations','consultation_history','price_history','ops_audit_log']);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const object=(value:any)=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const column=(value:any)=>typeof value==='string'&&/^[a-z][a-z0-9_]{0,62}$/.test(value);

export function operationCatalogue(){return {rpc:rpcArguments,read_tables:[...tables],
 policy:'Own authenticated session; no arbitrary SQL, credentials, service-role RPCs or owner impersonation. Re-read after writes. Destructive operations require explicit authorization.'};}

export async function runOperation(client:any,payload:any,user:any){
 if(!object(payload)||!['chatgpt@totuscentral.invalid','codex@totuscentral.invalid'].includes(user?.email))throw new Error('Identidad o solicitud no válida');
 const {operation}=payload;
 if(operation==='catalogue')return {catalogue:operationCatalogue()};
 if(operation==='read'){
  if(!tables.has(payload.table))throw new Error('Tabla no admitida; consulta el catálogo');
  const limit=payload.limit??100,offset=payload.offset??0;
  if(!Number.isSafeInteger(limit)||limit<1||limit>200||!Number.isSafeInteger(offset)||offset<0||offset>100000)throw new Error('Paginación no válida');
  const filters=payload.filters??[];
  if(!Array.isArray(filters)||filters.length>8)throw new Error('Filtros no válidos');
  let query=client.from(payload.table).select('*');
  for(const f of filters){
   if(!object(f)||!column(f.column)||!['eq','gte','lte'].includes(f.operator)||!['string','number','boolean'].includes(typeof f.value))throw new Error('Filtro no válido');
   query=query[f.operator](f.column,f.value);
  }
  const order=payload.order??'id';if(!column(order))throw new Error('Orden no válido');
  const {data,error}=await query.order(order,{ascending:payload.ascending!==false}).range(offset,offset+limit-1);
  if(error)throw new Error(error.message);
  return {table:payload.table,rows:data,offset,limit,possibly_more:data?.length===limit};
 }
 if(operation!=='rpc'||!Object.hasOwn(rpcArguments,payload.name)||!object(payload.args))throw new Error('Operación no admitida; consulta el catálogo');
 const args=structuredClone(payload.args),allowed=rpcArguments[payload.name];
 if(Object.keys(args).some(k=>!allowed.includes(k)))throw new Error('Argumento no admitido');
 if(allowed.includes('p_actor_email')){
  if(args.p_actor_email&&args.p_actor_email!==user.email)throw new Error('No se permite suplantar a otro usuario');
  args.p_actor_email=user.email;
 }
 const writeKey=payload.name==='totus_save_closing'?'p_closing':payload.name==='totus_save_sales_document'?'p_document':null;
 if(writeKey){
  const record=args[writeKey];
  if(!object(record)||!uuid.test(record.request_id||''))throw new Error('request_id obligatorio; conserva el mismo al reintentar');
  if(record.id&&!record.expected_updated_at)throw new Error('Relee la ficha antes de editar');
  const {data:contract,error}=await client.rpc('totus_business_write_contract');
  if(error||contract?.request_replay!==1)throw new Error('Protección de guardado no disponible');
 }
 if((payload.name.includes('_delete_')||payload.name==='totus_stock_delete'||payload.name==='totus_stock_remove_source'||payload.name==='totus_set_closed_period'||payload.name==='totus_log_cleanup'&&args.p_execute===true)&&payload.confirmed!==true)throw new Error('Confirmación expresa requerida para esta operación');
 const {data,error}=await client.rpc(payload.name,args);
 if(error)throw new Error(error.message);
 return {operation:payload.name,data,executed:true,requires_readback:true};
}
