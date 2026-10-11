import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import XLSXNode from 'xlsx-js-style';
import JSZipNode from 'jszip';

const base='http://127.0.0.1:4173';
const project='zwkpmjjuurgjygcrejiw';
const userId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const email='qa-admin@example.test';
const enc=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const token=enc({alg:'HS256',typ:'JWT'})+'.'+enc({sub:userId,email,role:'authenticated',aud:'authenticated',exp:4102444800})+'.qa';
const session={access_token:token,refresh_token:'qa-refresh',expires_in:3600,expires_at:4102444800,token_type:'bearer',user:{id:userId,aud:'authenticated',role:'authenticated',email,app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}};

const ids={
 h:'4dd28c96-3e32-4f9e-876a-3f9fe3b68845',
 n:'8b2976a9-9589-44fd-ade9-61a95e87359f',
 merch:'11111111-1111-4111-8111-111111111111',
 internal:'22222222-2222-4222-8222-222222222222',
 drHv:'33333333-3333-4333-8333-333333333331',
 drHh:'33333333-3333-4333-8333-333333333332',
 drNv:'33333333-3333-4333-8333-333333333333',
 seriesH:'44444444-4444-4444-8444-444444444441',
 seriesHR:'44444444-4444-4444-8444-444444444443',
 seriesP:'44444444-4444-4444-8444-444444444442',
 seriesN:'44444444-4444-4444-8444-444444444451',
 seriesNR:'44444444-4444-4444-8444-444444444452',
 seriesNP:'44444444-4444-4444-8444-444444444453',
 tpl:'55555555-5555-4555-8555-555555555555',
 supplier:'66666666-6666-4666-8666-666666666666',
 personnel:'77777777-7777-4777-8777-777777777777'
};
const fixtures={
 brands:[],families:[],products:[],product_variants:[],providers:[],product_provider_prices:[],product_competitor_prices:[],
 consultations:[],consultation_history:[],price_history:[],team_email_log:[],
 team_members:[{email,full_name:'QA Admin',role:'admin',active:true,job_title:'Admin'}],
 profiles:[{id:userId,email,full_name:'QA Admin',role:'admin',active:true}],
 ops_business_settings:[{id:1,business_name:'Empresa QA',tax_id:'B00000000',business_address:'Calle QA',business_email:'qa@example.com',business_phone:'',current_year:2026,fiscal_regime:'recargo_equivalencia',estimation_method:'directa_simplificada',irpf_prepayment_rate:20,difficult_expense_enabled:true,difficult_expense_pct:5,difficult_expense_annual_cap:2000,default_sales_vat_rate:21,reta_generic_deduction_pct:7,reta_total_rate:31.5,actual_reta_monthly:315,previous_year_net_income:0,target_operating_margin_pct:15,storage_limit_bytes:1073741824,document_max_bytes:20971520,fiscal_notes:''}],
 ops_stores:[{id:ids.h,code:'HORTIMATIC',name:'Hortimatic',active:true,sort_order:10},{id:ids.n,code:'NEWOLDSMOK',name:'NewOldSmok',active:true,sort_order:20}],
 ops_expense_categories:[{id:ids.merch,code:'MERCH',name:'Mercancía / producto para tienda',manager_code:'600',aeat_group:'Compra de existencias',deductible_default:true,fixed_asset_default:false,sort_order:10},{id:ids.internal,code:'INTERNAL_WAREHOUSE',name:'Almacén / pago interno',manager_code:'',aeat_group:'Control interno',deductible_default:false,fixed_asset_default:false,sort_order:920},{id:'22222222-2222-4222-8222-222222222223',code:'INTERNAL_OVERTIME',name:'Horas extra / pagos internos',manager_code:'',aeat_group:'Control interno',deductible_default:false,fixed_asset_default:false,sort_order:910}],
 ops_suppliers:[{id:ids.supplier,name:'Proveedor Maestro QA',tax_id:'B12345678',email:'proveedor@qa.test',phone:'',address:'Calle Proveedor',city:'',postal_code:'',province:'',country:'España',default_category_id:ids.merch,default_payment_method:'transferencia',default_document_kind:'factura',default_vat_rate:21,default_re_rate:5.2,default_withholding_rate:0,default_withholding_model:null,default_deductible_irpf:true,default_deductible_pct:100,notes:'',active:true,source:'qa'}],
 ops_personnel:[{id:ids.personnel,full_name:'Davinia Hidalgo',tax_id:'',person_type:'family_collaborator',active:true,compensation_mode:'manual',notes:'QA'}],
 ops_entity_revisions:[],ops_backup_archives:[],ops_audit_log:[],ops_fiscal_reference_periods:[],ops_import_batches:[],
 ops_documents:[],
 ops_expenses:[],
 ops_expense_lines:[],
 ops_daily_closings:[],
 ops_cash_drawers:[{id:ids.drHv,store_id:ids.h,code:'VAPE',name:'Caja vape',active:true,sort_order:10},{id:ids.drHh,store_id:ids.h,code:'HEAD',name:'Caja head',active:true,sort_order:20},{id:ids.drNv,store_id:ids.n,code:'VAPE',name:'Caja vape',active:true,sort_order:10}],
 ops_daily_closing_drawers:[],
 ops_invoice_series:[
  {id:ids.seriesH,store_id:ids.h,year:2026,code:'H-2026',prefix:'H-2026-',next_number:1,padding:4,active:true,document_type:'factura',series_kind:'invoice'},
  {id:ids.seriesHR,store_id:ids.h,year:2026,code:'RH-2026',prefix:'RH-2026-',next_number:1,padding:4,active:true,document_type:'factura',series_kind:'rectifying'},
  {id:ids.seriesP,store_id:ids.h,year:2026,code:'HPF-2026',prefix:'HPF-2026-',next_number:1,padding:4,active:true,document_type:'proforma',series_kind:'invoice'},
  {id:ids.seriesN,store_id:ids.n,year:2026,code:'N-2026',prefix:'N-2026-',next_number:1,padding:4,active:true,document_type:'factura',series_kind:'invoice'},
  {id:ids.seriesNR,store_id:ids.n,year:2026,code:'RN-2026',prefix:'RN-2026-',next_number:1,padding:4,active:true,document_type:'factura',series_kind:'rectifying'},
  {id:ids.seriesNP,store_id:ids.n,year:2026,code:'NPF-2026',prefix:'NPF-2026-',next_number:1,padding:4,active:true,document_type:'proforma',series_kind:'invoice'}
 ],
 ops_sales_invoices:[],ops_sales_invoice_lines:[],ops_tax_payments:[],
 ops_reta_brackets:[{id:1,year:2026,bracket_order:1,min_net_monthly:null,max_net_monthly:670,min_inclusive:false,max_inclusive:true,min_base:653.59,max_base:718.94},{id:2,year:2026,bracket_order:15,min_net_monthly:6000,max_net_monthly:null,min_inclusive:false,max_inclusive:true,min_base:1928.10,max_base:5101.20}],
 ops_fiscal_adjustments:[],ops_income_adjustments:[],ops_gestor_quarter_summary:[],ops_reconciliation_notes:[],
 ops_customers:[],
 ops_document_templates:[{id:ids.tpl,code:'TOTUS-QA',name:'Totus QA',style:'brand',primary_color:'#19D3C5',secondary_color:'#101B27',text_color:'#17202A',font_family:'helvetica',logo_path:null,logo_name:null,logo_mime:null,logo_size_bytes:0,logo_width_mm:34,logo_position:'left',show_logo:true,show_payment_details:true,header_text:'',footer_text:'Gracias',payment_terms_default:'Pago al contado',bank_details:'',invoice_title:'FACTURA',proforma_title:'FACTURA PROFORMA',active:true,default_invoice:true,default_proforma:true}],
 ops_legacy_daily_rows:[],ops_historical_income_periods:[],ops_gestor_source_rows:[],ops_gestor_natural_rows:[],
};

function tableFrom(url){
 const m=new URL(url).pathname.match(/\/rest\/v1\/([^/?]+)/);return m?.[1]||'';
}
function out(body,status=200,headers={}){return {status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Content-Range':'0-0/0',...headers},body:JSON.stringify(body)}}

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
const dialogs=[],pageErrors=[];let storageDownloads=0,storageUploads=0;const storageFiles=new Map();
page.on('dialog',async d=>{dialogs.push(d.message());if(d.type()==='confirm')await d.accept();else await d.dismiss()});
page.on('pageerror',e=>{pageErrors.push(e.stack||e.message);console.error('PAGEERROR',e.stack||e.message)});
await page.addInitScript(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key:`sb-${project}-auth-token`,session});

await page.route('https://zwkpmjjuurgjygcrejiw.supabase.co/**',async route=>{
 const req=route.request(),url=req.url(),u=new URL(url),method=req.method();
 if(u.pathname.startsWith('/auth/v1/')){
   if(u.pathname.endsWith('/user')) return route.fulfill(out(session.user));
   if(u.pathname.endsWith('/token')) return route.fulfill(out(session));
   return route.fulfill(out({}));
 }
 if(u.pathname==='/functions/v1/team-admin'){
   let body={};try{body=req.postDataJSON()}catch{}
   if(body.action==='list') return route.fulfill(out({users:[{email,registered:true,confirmed:true,email_confirmed_at:'2026-01-01T00:00:00Z',last_sign_in_at:'2026-10-06T10:00:00Z',auth_created_at:'2026-01-01T00:00:00Z'}]}));
   if(body.action==='email_log') return route.fulfill(out({emails:[]}));
   if(body.action==='audit_log') return route.fulfill(out({actions:[]}));
   if(body.action==='update_member'){
     const row=fixtures.team_members.find(x=>String(x.email).toLowerCase()===String(body.email||'').toLowerCase());
     if(!row)return route.fulfill(out({error:'member not found'},404));
     Object.assign(row,{full_name:body.full_name,role:body.role,active:body.active!==false,phone:body.phone||'',job_title:body.job_title||'',store:body.store||'',employee_notes:body.employee_notes||''});
     return route.fulfill(out({ok:true,message:'Usuario actualizado.'}));
   }
   if(body.action==='create_user'){
     if(fixtures.team_members.some(x=>String(x.email).toLowerCase()===String(body.email||'').toLowerCase()))return route.fulfill(out({error:'already exists'},409));
     fixtures.team_members.push({email:body.email,full_name:body.full_name,role:body.role,active:true,phone:body.phone||'',job_title:body.job_title||'',store:body.store||'',employee_notes:body.employee_notes||''});
     return route.fulfill(out({ok:true,message:'Usuario creado.'}));
   }
   if(body.action==='set_active'){
     const row=fixtures.team_members.find(x=>String(x.email).toLowerCase()===String(body.email||'').toLowerCase());if(row)row.active=!!body.active;
     return route.fulfill(out({ok:true,message:'Estado actualizado.'}));
   }
   if(body.action==='hard_delete'){fixtures.team_members=fixtures.team_members.filter(x=>String(x.email).toLowerCase()!==String(body.email||'').toLowerCase());return route.fulfill(out({ok:true,message:'Usuario eliminado.'}));}
   return route.fulfill(out({ok:true}));
 }
 if(u.pathname==='/functions/v1/ops-restore-backup'){
   let body={};try{body=req.postDataJSON()}catch{}
   return route.fulfill(out({ok:true,tables:Object.keys(body.tables||{}).length}));
 }
 if(u.pathname.startsWith('/storage/v1/object/')){
   const key=u.pathname.replace('/storage/v1/object/','');
   if(method==='GET'){storageDownloads++;const body=storageFiles.get(key)||Buffer.from('%PDF-1.4\nQA\n%%EOF');return route.fulfill({status:200,contentType:'application/octet-stream',body});}
   if(['POST','PUT'].includes(method)){storageUploads++;const pd=await req.postDataBuffer();storageFiles.set(key,pd||Buffer.from('QA'))}
   if(method==='DELETE')storageFiles.delete(key);
   return route.fulfill(out({Key:u.pathname}));
 }
 if(u.pathname.startsWith('/rest/v1/rpc/')){
   const fn=u.pathname.split('/').pop();let body={};try{body=req.postDataJSON()}catch{}
   if(fn==='ops_delete_expense_controlled'){
     const id=body.p_expense_id,row=fixtures.ops_expenses.find(x=>x.id===id);if(!row)return route.fulfill(out({message:'not found'},404));
     const docs=fixtures.ops_documents.filter(x=>x.linked_entity_type==='expense'&&x.linked_entity_id===id),paths=docs.map(x=>x.storage_path);
     fixtures.ops_expenses=fixtures.ops_expenses.filter(x=>x.id!==id);fixtures.ops_expense_lines=fixtures.ops_expense_lines.filter(x=>x.expense_id!==id);fixtures.ops_documents=fixtures.ops_documents.filter(x=>!docs.some(d=>d.id===x.id));
     fixtures.ops_entity_revisions.push({id:Date.now(),created_at:new Date().toISOString(),user_email:email,entity_type:'expense',entity_id:id,action:'delete',reason:body.p_reason,before_data:row,after_data:{},metadata:{}});
     return route.fulfill(out({expense_id:id,storage_paths:paths}));
   }
   if(fn==='ops_delete_document_controlled'){
     const id=body.p_document_id,row=fixtures.ops_documents.find(x=>x.id===id);if(!row)return route.fulfill(out({message:'not found'},404));
     fixtures.ops_documents=fixtures.ops_documents.filter(x=>x.id!==id);fixtures.ops_expenses.forEach(e=>{if(e.document_id===id)e.document_id=null});
     fixtures.ops_entity_revisions.push({id:Date.now(),created_at:new Date().toISOString(),user_email:email,entity_type:'document',entity_id:id,action:'delete',reason:body.p_reason,before_data:row,after_data:{},metadata:{}});
     return route.fulfill(out({id,storage_path:row.storage_path,original_name:row.original_name}));
   }
   if(fn==='ops_link_expense_document'){
     const e=fixtures.ops_expenses.find(x=>x.id===body.p_expense_id);if(e)e.document_id=body.p_document_id;return route.fulfill(out(null));
   }
   if(fn==='ops_set_closing_status_controlled'){
     const c=fixtures.ops_daily_closings.find(x=>x.id===body.p_closing_id);if(c)c.status=body.p_status;return route.fulfill(out(body.p_closing_id));
   }
   if(fn==='ops_delete_closing_controlled'){
     const id=body.p_closing_id;fixtures.ops_daily_closings=fixtures.ops_daily_closings.filter(x=>x.id!==id);fixtures.ops_daily_closing_drawers=fixtures.ops_daily_closing_drawers.filter(x=>x.closing_id!==id);return route.fulfill(out(id));
   }
   if(fn==='ops_delete_supplier_controlled'){
     const id=body.p_supplier_id;fixtures.ops_suppliers=fixtures.ops_suppliers.filter(x=>x.id!==id);fixtures.ops_expenses.forEach(e=>{if(e.supplier_id===id)e.supplier_id=null});return route.fulfill(out(id));
   }
   if(fn==='ops_restore_backup_data') return route.fulfill(out({ok:true,tables:Object.keys(body.p_tables||{}).length}));
   if(fn==='ops_storage_usage'){
     const documents_bytes=fixtures.ops_documents.reduce((a,x)=>a+Number(x.size_bytes||0),0);
     const assets_bytes=fixtures.ops_document_templates.reduce((a,x)=>a+Number(x.logo_size_bytes||0),0);
     return route.fulfill(out({documents_count:fixtures.ops_documents.length,documents_bytes,assets_count:fixtures.ops_document_templates.filter(x=>Number(x.logo_size_bytes||0)>0).length,assets_bytes,total_bytes:documents_bytes+assets_bytes}));
   }
   if(fn==='ops_delete_manual_expense'){
     const id=body.p_expense_id,row=fixtures.ops_expenses.find(x=>x.id===id);
     if(!row||row.source!=='manual')return route.fulfill(out({message:'not allowed'},400));
     const doc=fixtures.ops_documents.find(x=>x.id===row.document_id&&x.linked_entity_type==='expense'&&x.linked_entity_id===id);
     fixtures.ops_expenses=fixtures.ops_expenses.filter(x=>x.id!==id);
     fixtures.ops_expense_lines=fixtures.ops_expense_lines.filter(x=>x.expense_id!==id);
     if(doc)fixtures.ops_documents=fixtures.ops_documents.filter(x=>x.id!==doc.id);
     return route.fulfill(out({expense_id:id,document_id:doc?.id||null,storage_path:doc?.storage_path||null}));
   }
   if(fn==='ops_save_document_template'){
     const id=body.p_id,row=fixtures.ops_document_templates.find(x=>x.id===id),p=body.p_template||{};
     if(!row)return route.fulfill(out({message:'not found'},404));
     if(p.default_invoice)fixtures.ops_document_templates.forEach(x=>{if(x.id!==id)x.default_invoice=false});
     if(p.default_proforma)fixtures.ops_document_templates.forEach(x=>{if(x.id!==id)x.default_proforma=false});
     Object.assign(row,p,{updated_at:new Date().toISOString()});
     return route.fulfill(out(id));
   }
   if(fn==='ops_delete_document'){
     const id=body.p_id,row=fixtures.ops_documents.find(x=>x.id===id);
     if(!row||String(row.linked_entity_type||'').startsWith('sales_invoice'))return route.fulfill(out({message:'not allowed'},400));
     fixtures.ops_documents=fixtures.ops_documents.filter(x=>x.id!==id);
     return route.fulfill(out({id,storage_path:row.storage_path,original_name:row.original_name}));
   }
   if(fn==='ops_save_closing'){
     const p=body.p_closing||{},drawers=body.p_drawers||[];let id=p.id||crypto.randomUUID();
     const sum=k=>drawers.reduce((a,x)=>a+Number(x[k]||0),0);
     const opening=sum('opening_cash'),closing=sum('closing_cash'),card=sum('card_sales'),bizum=sum('bizum_sales'),online=sum('online_sales'),other=sum('other_income'),withdrawals=sum('cash_withdrawals'),cashExpenses=sum('cash_expenses_declared'),extraIn=sum('cash_extra_in'),extraOut=sum('cash_extra_out');
     const quick=(p.entry_mode||'physical')==='quick';
     const cash=quick?Number(p.reported_total_sales||0)-Number(p.card_sales||0)-Number(p.bizum_sales||0)-Number(p.online_sales||0)-Number(p.other_income||0):closing+withdrawals+cashExpenses+extraOut-opening-extraIn;
     const total=quick?Number(p.reported_total_sales||0):cash+card+bizum+online+other;
     const control=p.reported_total_sales==null?total:Number(p.reported_total_sales),difference=Math.round((total-control)*100)/100;
     let row=fixtures.ops_daily_closings.find(x=>x.id===id);
     const data={id,store_id:p.store_id,business_date:p.business_date,opening_cash:opening,cash_sales:cash,card_sales:card,bizum_sales:bizum,online_sales:online,other_income:other,cash_withdrawals:withdrawals,cash_expenses_declared:cashExpenses,cash_extra_in:extraIn,cash_extra_out:extraOut,expected_cash:closing,actual_cash:closing,difference,notes:p.notes||'',status:p.status||'cerrado',source:'manual',legacy_cash_method:false,include_in_income:true,reported_total_sales:control,entry_mode:p.entry_mode||'physical'};
     if(row)Object.assign(row,data);else fixtures.ops_daily_closings.push(data);
     fixtures.ops_daily_closing_drawers=fixtures.ops_daily_closing_drawers.filter(x=>x.closing_id!==id);
     fixtures.ops_daily_closing_drawers.push(...drawers.map(x=>({id:crypto.randomUUID(),closing_id:id,drawer_id:x.drawer_id,opening_cash:Number(x.opening_cash||0),closing_cash:Number(x.closing_cash||0),card_sales:Number(x.card_sales||0),bizum_sales:Number(x.bizum_sales||0),online_sales:Number(x.online_sales||0),other_income:Number(x.other_income||0),cash_withdrawals:Number(x.cash_withdrawals||0),cash_expenses_declared:Number(x.cash_expenses_declared||0),cash_extra_in:Number(x.cash_extra_in||0),cash_extra_out:Number(x.cash_extra_out||0),notes:x.notes||''})));
     return route.fulfill(out(id));
   }
   if(fn==='ops_save_expense'){
     const p=body.p_expense||{},lines=body.p_lines||[];let id=p.id||crypto.randomUUID();
     let row=fixtures.ops_expenses.find(x=>x.id===id);
     let base=0,vat=0,re=0,wh=0;
     const made=lines.map((l,i)=>{const b=Number(l.base_amount||0),vr=Number(l.vat_rate||0),rr=Number(l.re_rate||0),wr=Number(l.withholding_rate||0);base+=b;vat+=b*vr/100;re+=b*rr/100;wh+=b*wr/100;return{...l,id:crypto.randomUUID(),expense_id:id,sort_order:l.sort_order||((i+1)*10),vat_amount:b*vr/100,re_base:rr?b:0,re_amount:b*rr/100,withholding_base:wr?b:0,withholding_amount:b*wr/100,irpf_imputable:l.deductible_irpf===false||l.fixed_asset?0:(b+b*vr/100+b*rr/100)*Number(l.deductible_pct??100)/100}});
     const accounting=base+vat+re;
     let supplier=fixtures.ops_suppliers.find(x=>(p.supplier_tax_id&&x.tax_id===p.supplier_tax_id)||(!p.supplier_tax_id&&x.name===p.supplier_name));if(!supplier){supplier={id:crypto.randomUUID(),name:p.supplier_name,tax_id:p.supplier_tax_id||'',active:true,default_payment_method:p.payment_method||'transferencia',default_document_kind:p.document_kind||'factura',default_vat_rate:21,default_re_rate:0,default_withholding_rate:0,default_deductible_irpf:true,default_deductible_pct:100};fixtures.ops_suppliers.push(supplier)}
     const data={id,store_id:p.store_id||null,supplier_id:supplier.id,expense_date:p.expense_date,supplier_name:p.supplier_name,supplier_tax_id:p.supplier_tax_id||'',invoice_number:p.invoice_number||'',description:p.description||'',payment_method:p.payment_method||'transferencia',paid_status:p.paid_status||'pagado',paid_date:p.paid_date||null,base_amount:base,vat_amount:vat,re_amount:re,withholding_amount:wh,gross_expense:accounting,accounting_amount:accounting,amount_paid:p.amount_paid??(accounting-wh),deductible_irpf:!p.management_only,deductible_pct:p.management_only?0:100,notes:p.notes||'',document_kind:p.document_kind||'factura',source:'manual',fiscal_reviewed:!!p.fiscal_reviewed,management_only:!!p.management_only,document_id:row?.document_id||null};
     if(row)Object.assign(row,data);else fixtures.ops_expenses.push(data);
     fixtures.ops_expense_lines=fixtures.ops_expense_lines.filter(x=>x.expense_id!==id);fixtures.ops_expense_lines.push(...made);
     return route.fulfill(out(id));
   }
   if(fn==='ops_save_document_draft'){
     const p=body.p_document||{},lines=body.p_lines||[];let id=p.id||crypto.randomUUID();
     let row=fixtures.ops_sales_invoices.find(x=>x.id===id);let base=0,vat=0,total=0;
     const made=lines.map((l,i)=>{const q=Number(l.quantity||0),u=Number(l.unit_price_base||0),d=Number(l.discount_pct||0),v=Number(l.vat_rate||0),b=q*u*(1-d/100),va=b*v/100;return{id:crypto.randomUUID(),invoice_id:id,sort_order:l.sort_order||((i+1)*10),description:l.description,quantity:q,unit_price_base:u,discount_pct:d,vat_rate:v,base_amount:b,vat_amount:va,total_amount:b+va}});
     made.forEach(x=>{base+=x.base_amount;vat+=x.vat_amount;total+=x.total_amount});
     const data={...p,id,status:'borrador',number:row?.number||null,display_number:row?.display_number||null,base_amount:base,vat_amount:vat,total_amount:total,external_number_text:row?.external_number_text||null,generated_document_id:row?.generated_document_id||null,converted_invoice_id:row?.converted_invoice_id||null,design_snapshot:row?.design_snapshot||{},template_snapshot:row?.template_snapshot||{},record_hash:row?.record_hash||null,previous_hash:row?.previous_hash||null};
     if(row)Object.assign(row,data);else fixtures.ops_sales_invoices.push(data);
     fixtures.ops_sales_invoice_lines=fixtures.ops_sales_invoice_lines.filter(x=>x.invoice_id!==id);fixtures.ops_sales_invoice_lines.push(...made);
     return route.fulfill(out(id));
   }
   if(fn==='ops_finalize_document'){
     const id=body.p_document_id,row=fixtures.ops_sales_invoices.find(x=>x.id===id);if(!row)return route.fulfill(out({message:'not found'},404));
     const ser=fixtures.ops_invoice_series.find(x=>x.id===row.series_id);const num=ser?.next_number||1;if(ser)ser.next_number=num+1;
     Object.assign(row,{number:num,display_number:(ser?.prefix||'QA-')+String(num).padStart(ser?.padding||4,'0'),status:'emitida',record_hash:'qa-hash-'+id,design_snapshot:fixtures.ops_document_templates[0]||{},template_snapshot:fixtures.ops_document_templates[0]||{}});
     return route.fulfill(out(row));
   }
   if(fn==='ops_register_external_document'){
     const id=body.p_document_id,num=Number(body.p_number),row=fixtures.ops_sales_invoices.find(x=>x.id===id),ser=fixtures.ops_invoice_series.find(x=>x.id===row?.series_id);if(row)Object.assign(row,{number:num,display_number:(ser?.prefix||'QA-')+String(num).padStart(ser?.padding||4,'0'),external_number_text:String(num),status:'emitida',record_hash:'qa-ext-'+id});
     if(ser)ser.next_number=Math.max(ser.next_number,num+1);return route.fulfill(out(row||{}));
   }
   if(fn==='ops_convert_proforma'){
     const src=fixtures.ops_sales_invoices.find(x=>x.id===body.p_proforma_id),id=crypto.randomUUID();if(!src)return route.fulfill(out({message:'not found'},404));
     const inv={...src,id,series_id:body.p_invoice_series_id,document_type:'factura',invoice_kind:'invoice',status:'borrador',number:null,display_number:null,converted_invoice_id:null,source_proforma_document_id:src.id};fixtures.ops_sales_invoices.push(inv);
     fixtures.ops_sales_invoice_lines.push(...fixtures.ops_sales_invoice_lines.filter(x=>x.invoice_id===src.id).map(x=>({...x,id:crypto.randomUUID(),invoice_id:id})));src.status='convertida';src.converted_invoice_id=id;return route.fulfill(out(id));
   }
   return route.fulfill(out({}));
 }
 if(u.pathname.startsWith('/rest/v1/')){
   const table=tableFrom(url);
   if(method==='GET') return route.fulfill(out(fixtures[table]||[]));
   let body={};try{body=req.postDataJSON()}catch{}
   if(method==='POST'){
     const input=Array.isArray(body)?body:[body||{}];
     const made=input.map(row=>({...row,id:row.id||crypto.randomUUID(),created_at:row.created_at||new Date().toISOString()}));
     if(Array.isArray(fixtures[table])) fixtures[table].push(...made);
     const wantsObject=(req.headers()['accept']||'').includes('vnd.pgrst.object');
     return route.fulfill(out(wantsObject?made[0]:made));
   }
   if(method==='PATCH'){
     const eq=[...u.searchParams.entries()].find(([,v])=>/^eq\./.test(v)),field=eq?.[0],value=eq?.[1]?.replace(/^eq\./,'');
     let row=null;if(field&&Array.isArray(fixtures[table])){row=fixtures[table].find(x=>String(x[field])===String(value));if(row)Object.assign(row,body)}
     const wantsObject=(req.headers()['accept']||'').includes('vnd.pgrst.object');
     return route.fulfill(out(wantsObject?(row||body):[]));
   }
   if(method==='DELETE'){
     const eq=[...u.searchParams.entries()].find(([,v])=>/^eq\./.test(v)),field=eq?.[0],value=eq?.[1]?.replace(/^eq\./,'');
     if(field&&Array.isArray(fixtures[table])){const ix=fixtures[table].findIndex(x=>String(x[field])===String(value));if(ix>=0)fixtures[table].splice(ix,1)}
     return route.fulfill(out([]));
   }
   return route.fulfill(out({}));
 }
 return route.fulfill(out({}));
});

function assert(cond,msg){if(!cond)throw new Error(msg)}
function rgb6(v){return String(v||'').toUpperCase().replace(/^FF(?=[0-9A-F]{6}$)/,'').slice(-6)}
function fillRgb(cell){return rgb6(cell?.s?.fill?.fgColor?.rgb||cell?.s?.fgColor?.rgb)}
function fontRgb(cell){return rgb6(cell?.s?.font?.color?.rgb||cell?.s?.color?.rgb)}
async function xlsxXmlStyle(path,sheetNo=1,ref='A1'){
 const buf=await fs.readFile(path),zip=await JSZipNode.loadAsync(buf);
 const sheet=await zip.file(`xl/worksheets/sheet${sheetNo}.xml`).async('string');
 const styles=await zip.file('xl/styles.xml').async('string');
 const cellRe=new RegExp('<c\\b[^>]*\\br="'+ref+'"[^>]*>');
 const tag=(sheet.match(cellRe)||[])[0]||'';
 const styleId=Number(((tag.match(new RegExp('\\bs="(\\d+)"')))||[])[1]||0);
 const block=(xml,name)=>((xml.match(new RegExp('<'+name+'\\b[^>]*>([\\s\\S]*?)</'+name+'>')))||[])[1]||'';
 const xfs=[...block(styles,'cellXfs').matchAll(new RegExp('<xf\\b[^>]*(?:/>|>[\\s\\S]*?</xf>)','g'))].map(m=>m[0]);
 const xf=xfs[styleId]||'';
 const fontId=Number(((xf.match(new RegExp('\\bfontId="(\\d+)"')))||[])[1]||0);
 const fillId=Number(((xf.match(new RegExp('\\bfillId="(\\d+)"')))||[])[1]||0);
 const fonts=[...block(styles,'fonts').matchAll(new RegExp('<font>[\\s\\S]*?</font>','g'))].map(m=>m[0]);
 const fills=[...block(styles,'fills').matchAll(new RegExp('<fill>[\\s\\S]*?</fill>','g'))].map(m=>m[0]);
 const font=fonts[fontId]||'',fill=fills[fillId]||'';
 const rgb=(xml,tagName)=>(((xml.match(new RegExp('<'+tagName+'\\b[^>]*\\brgb="([^"]+)"')))||[])[1]||'');
 const hasYellowFont=/rgb="(?:FF)?FFFF00"/i.test(styles);
 return {styleId,fontId,fillId,fontRgb:rgb6(rgb(font,'color')),fillRgb:rgb6(rgb(fill,'fgColor')),hasYellowFont,tag,xf,font:font.slice(0,300),fill:fill.slice(0,300)};
}
async function heading(text){await page.getByRole('heading',{name:text,exact:true}).first().waitFor({timeout:10000})}
function field(label){return page.locator('#main').locator('label').filter({hasText:label}).first().locator('..').locator('input,select,textarea').first()}
async function auditCurrentUi(section){
 const a=await page.evaluate(()=>{
  const ids=[...document.querySelectorAll('[id]')].map(x=>x.id).filter(Boolean);
  const dupIds=[...new Set(ids.filter((x,i)=>ids.indexOf(x)!==i))];
  const missingHandlers=[];
  for(const el of document.querySelectorAll('[onclick],[onchange],[oninput]')){
   for(const attr of ['onclick','onchange','oninput']){
    const code=el.getAttribute(attr)||'';
    for(const m of code.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)){
     const name=m[1];
     if(m.index>0&&code[m.index-1]==='.')continue;
     if(['if','confirm','alert','Number','String','Math','setTimeout'].includes(name))continue;
     if(typeof window[name]!=='function')missingHandlers.push(name);
    }
   }
  }
  const unlabeled=[...document.querySelectorAll('input:not([type="hidden"]),select,textarea')].filter(el=>{
   if(el.disabled||el.getAttribute('aria-label')||el.getAttribute('title'))return false;
   if(el.id&&document.querySelector(`label[for="${CSS.escape(el.id)}"]`))return false;
   const parent=el.closest('label');
   if(parent&&parent.textContent.trim())return false;
   const wrap=el.parentElement;
   return !(wrap?.querySelector(':scope > label')?.textContent||'').trim();
  }).map(el=>el.id||el.name||el.type||el.tagName);
  const emptyButtons=[...document.querySelectorAll('button:not([disabled])')].filter(b=>!(b.textContent||'').trim()&&!b.getAttribute('aria-label')&&!b.getAttribute('title')).length;
  const badSelects=[...document.querySelectorAll('select:not([disabled])')].flatMap((s,i)=>{
    const opts=[...s.options],vals=opts.map(o=>o.value),duplicateValues=[...new Set(vals.filter((v,j)=>v!==''&&vals.indexOf(v)!==j))];
    const emptyText=opts.filter(o=>!(o.textContent||'').trim()).length;
    const noOptions=opts.length===0;
    return noOptions||emptyText||duplicateValues.length?[{name:s.getAttribute('aria-label')||s.id||'select#'+i,noOptions,emptyText,duplicateValues}]:[];
  });
  return{dupIds,missingHandlers:[...new Set(missingHandlers)],unlabeled,emptyButtons,badSelects};
 });
 assert(a.dupIds.length===0,section+' tiene IDs duplicados: '+a.dupIds.join(', '));
 assert(a.missingHandlers.length===0,section+' tiene handlers inexistentes: '+a.missingHandlers.join(', '));
 assert(a.unlabeled.length===0,section+' tiene campos activos sin etiqueta: '+a.unlabeled.join(', '));
 assert(a.emptyButtons===0,section+' tiene botones activos sin nombre');
 assert(a.badSelects.length===0,section+' tiene desplegables defectuosos: '+JSON.stringify(a.badSelects));
}

await page.goto(base,{waitUntil:'networkidle'});
await heading('Totus Central');
assert(await page.locator('.home-zone').count()===4,'Inicio no está organizado en cuatro zonas');
assert(await page.locator('.home-widget').count()===8,'Inicio no conserva dos widgets útiles por zona');
await page.locator('.home-widget').first().waitFor();
await auditCurrentUi('Inicio');
assert(await page.locator('.home-zone').count()===4,'Inicio debe estar organizado en 4 contenedores funcionales');
assert(await page.locator('.home-widget').count()===8,'Inicio debe exponer 8 widgets de trabajo');
for(const name of ['Ampliar estudio','Ver cajas','Nuevo gasto','Nueva factura','Subir / buscar','Abrir previsión fiscal','Backup']){
  assert(await page.getByRole('button',{name,exact:true}).count()===1,'Inicio no expone la acción rápida: '+name);
}
assert(await page.getByRole('button',{name:/^Informe T[1-4]$/}).count()===1,'Inicio no ofrece informe rápido del trimestre activo');
await page.locator('#portal_q_cost').fill('3,20');
await page.locator('#portal_q_pvp').fill('5,70');
await page.locator('#portal_q_comp').fill('6,00');
await page.locator('#portal_q_disc').fill('10');
assert((await page.locator('#portal_q_real').innerText()).includes('4,04'),'Inicio no calcula el coste real en el widget de Pricing');
assert((await page.locator('#portal_q_sale').innerText()).includes('5,13'),'Inicio no calcula la venta final con descuento');
assert((await page.locator('#portal_q_margin').innerText()).includes('1,09'),'Inicio no calcula el margen rápido con descuento');
assert((await page.locator('#portal_q_compdiff').innerText()).replace(/\s/g,'').startsWith('-14,5'),'Inicio no compara contra competencia');
await page.locator('#portal_q_query').fill('Consulta rápida Inicio QA');
await page.getByRole('button',{name:'Guardar consulta',exact:true}).click();
await page.waitForTimeout(180);
const homeConsultation=fixtures.consultations.find(x=>x.query==='Consulta rápida Inicio QA');
assert(homeConsultation,'Inicio no guarda consultas rápidas sin obligar a entrar en Pricing');
assert(Number(homeConsultation.competitor)===6&&Number(homeConsultation.discount)===10,'Inicio no conserva competencia/descuento en la consulta rápida');
await page.locator('.home-widget').first().waitFor();

// Pricing and decimal-focus regression.
await page.getByRole('button',{name:'Pricing',exact:true}).first().click();
await page.getByRole('heading',{name:'Precio rápido',exact:true}).waitFor();await auditCurrentUi('Pricing');
const cost=page.locator('#q_cost');await cost.click();await cost.type('3.20');
assert(await cost.inputValue()==='3,20','El coste no normalizó punto a coma');
assert(await page.evaluate(()=>document.activeElement?.id)==='q_cost','El campo de coste perdió el foco');
await page.locator('#q_pvp').fill('5,70');
await page.locator('#q_disc').fill('10');
await page.waitForTimeout(100);
assert((await page.locator('#q_out_real').innerText()).includes('4,04'),'Cálculo de coste real incorrecto');
assert((await page.locator('#q_out_sale').innerText()).includes('5,13'),'Cálculo de venta final incorrecto');

// Cajas: cada caja física se abre/cierra por separado y la tienda suma sus cifras.
await page.getByRole('button',{name:'Cajas',exact:true}).click();await heading('Cajas');await auditCurrentUi('Cajas');
assert(await page.locator('.ops-closing-step').count()===5,'Cajas debe presentar el cierre en cinco pasos claros');
assert(await page.locator('.ops-drawer-section-title').filter({hasText:'Efectivo'}).count()>=1,'Cajas no separa visualmente el efectivo');
assert(await page.locator('.ops-drawer-section-title').filter({hasText:'Cobros no efectivos'}).count()>=1,'Cajas no separa visualmente los cobros no efectivos');
assert(await page.getByLabel('Fecha del cierre').getAttribute('max'),'La fecha de cierre no bloquea visualmente días futuros');
const infoBtn=page.locator('.ops-info-btn').first();
const infoShape=await infoBtn.evaluate(el=>{const s=getComputedStyle(el);return {w:parseFloat(s.width),h:parseFloat(s.height),r:s.borderRadius}});
const infoRadiusOk=infoShape.r.includes('%')?parseFloat(infoShape.r)>=49:Math.abs(parseFloat(infoShape.r)-infoShape.w/2)<.6;
assert(Math.abs(infoShape.w-infoShape.h)<.1&&infoRadiusOk,'Los botones de información deben ser círculos reales: '+JSON.stringify(infoShape));
if(await infoBtn.count()){
  await infoBtn.click();
  assert(await page.locator('.ops-help-popover').count()===1,'La ayuda contextual no usa el panel flotante');
  assert(await page.locator('.ops-help-layer').count()===0,'La ayuda contextual sigue creando una capa a pantalla completa');
  assert(await page.locator('.ops-modal').count()===0,'La ayuda contextual sigue usando el modal grande');
  await page.locator('.ops-help-close').click();
}
const drawerCards=page.locator('.ops-drawer-card');
assert(await drawerCards.count()===2,'Hortimatic debe mostrar sus dos cajas físicas');
const vape=drawerCards.filter({hasText:'Caja vape'}).first();
const head=drawerCards.filter({hasText:'Caja head'}).first();
assert(await vape.count()===1&&await head.count()===1,'Faltan Caja vape o Caja head');
await vape.getByLabel('Apertura').fill('100');
await vape.getByLabel('Queda en caja').fill('130');
await vape.getByLabel('Tarjeta').fill('200,31');
await vape.getByLabel('Bizum').fill('10');
await vape.getByLabel('Pedidos online').fill('40');
await vape.getByLabel('Otros cobros').fill('0');
await vape.getByLabel('Salida / retirada').fill('30');
await vape.getByLabel('Gastos pagados desde caja').fill('5');
await head.getByLabel('Apertura').fill('100');
await head.getByLabel('Queda en caja').fill('120');
await head.getByLabel('Tarjeta').fill('133');
await head.getByLabel('Bizum').fill('15');
await head.getByLabel('Pedidos online').fill('0');
await head.getByLabel('Otros cobros').fill('10');
await head.getByLabel('Salida / retirada').fill('20');
await head.getByLabel('Gastos pagados desde caja').fill('5');
await page.getByLabel('Total ventas según TPV / cierre').fill('500');
await page.waitForTimeout(50);
const closingsBeforeMismatch=fixtures.ops_daily_closings.length;
await page.getByRole('button',{name:'Cerrar día',exact:true}).click();
await page.waitForTimeout(80);
assert(fixtures.ops_daily_closings.length===closingsBeforeMismatch,'Un cierre descuadrado se guardó como cerrado');
assert(dialogs.some(x=>/NO CUADRA/i.test(x)),'El cierre descuadrado no avisó claramente');
await page.getByLabel('Total ventas según TPV / cierre').fill('518,31');
await page.waitForTimeout(100);
assert((await page.locator('#ops_close_cashsales').innerText()).includes('110,00'),'La suma de efectivo de las dos cajas es incorrecta');
assert((await page.locator('#ops_close_card').innerText()).includes('333,31'),'La suma de tarjeta de las dos cajas es incorrecta');
assert((await page.locator('#ops_close_bizum').innerText()).includes('25,00'),'La suma de Bizum de las dos cajas es incorrecta');
assert((await page.locator('#ops_close_total').innerText()).includes('518,31'),'El total de tienda no suma correctamente todas las cajas');
assert((await page.locator('#ops_close_diff').innerText()).includes('CUADRA'),'El control de cierre no confirma el cuadre');
await page.getByRole('button',{name:'Cerrar día',exact:true}).click();
await page.waitForTimeout(200);
assert(fixtures.ops_daily_closings.length===1,'El cierre no se guardó');
assert(Number(fixtures.ops_daily_closings[0].cash_sales)===110,'El cierre no sumó el efectivo de las cajas');
assert(Number(fixtures.ops_daily_closings[0].card_sales)===333.31,'El cierre no sumó tarjeta por cajas');
assert(Number(fixtures.ops_daily_closings[0].bizum_sales)===25,'El cierre no sumó Bizum por cajas');
assert(Number(fixtures.ops_daily_closings[0].online_sales)===40,'El cierre no sumó online por cajas');
assert(Number(fixtures.ops_daily_closings[0].reported_total_sales)===518.31,'El cierre no conservó el total de control');
assert(Number(fixtures.ops_daily_closings[0].difference)===0,'El cierre guardado no quedó cuadrado');
assert(fixtures.ops_daily_closing_drawers.length===2,'Hortimatic debe guardar sus dos cajas físicas');
assert(fixtures.ops_daily_closing_drawers.some(x=>x.drawer_id===ids.drHv&&Number(x.card_sales)===200.31),'Caja vape no conservó su tarjeta');
assert(fixtures.ops_daily_closing_drawers.some(x=>x.drawer_id===ids.drHh&&Number(x.card_sales)===133),'Caja head no conservó su tarjeta');
let closingCsvPromise=page.waitForEvent('download');
await page.getByRole('button',{name:'Exportar CSV',exact:true}).click();
const closingCsv=await closingCsvPromise;
const closingCsvText=await fs.readFile(await closingCsv.path(),'utf8');
for(const col of ['Entrada extra a caja','Salida extra de caja','Total control','Diferencia','Estado']){
  assert(closingCsvText.includes(col),'CSV de Cajas no incluye '+col);
}

// NewOldSmok debe tener una sola caja.
await page.evaluate(()=>opsNewClosing());
await field('Establecimiento').selectOption(ids.n);
await page.waitForTimeout(100);
assert(await page.locator('.ops-drawer-card').count()===1,'NewOldSmok debe mostrar una sola caja');
assert(await page.locator('.ops-drawer-card').filter({hasText:'Caja vape'}).count()===1,'NewOldSmok debe mostrar su Caja vape');
await field('Establecimiento').selectOption(ids.h);
await page.waitForTimeout(100);

// Gastos: atajos internos, maestros, deducibilidad, factura adjunta y selección masiva.
await page.getByRole('button',{name:'Gastos',exact:true}).click();await heading('Gastos');await auditCurrentUi('Gastos');
assert(await page.locator('.ops-expense-step').count()===4,'Gastos debe presentar el registro en cuatro pasos claros');
assert(await page.getByLabel('Fecha del gasto').getAttribute('max'),'La fecha de gasto no bloquea visualmente días futuros');
await page.getByRole('button',{name:/almacén.*300/i}).click();
assert(await page.locator('#ops_management_only').isChecked(),'Almacén debe quedar como solo control interno');
assert(await page.locator('input[placeholder="Nombre del proveedor"]').inputValue()==='Almacén','Proveedor interno almacén incorrecto');
await page.getByRole('button',{name:/horas extra/i}).click();
assert(await page.locator('#ops_management_only').isChecked(),'Horas extra debe quedar fuera de fiscalidad');
await page.evaluate(()=>opsNewExpense());
await page.locator('#ops_management_only').check();
assert(await page.getByLabel('IVA %').first().inputValue()==='0'&&await page.getByLabel('RE %').first().inputValue()==='0','Modo interno no limpia impuestos');
await page.locator('#ops_management_only').uncheck();
assert(await page.getByLabel('IVA %').first().inputValue()==='21'&&await page.getByLabel('RE %').first().inputValue()==='5,2','Volver de interno a fiscal no restaura impuestos de la categoría');

// Selección desde maestro rellena NIF y defaults.
await page.getByRole('combobox',{name:'Proveedor del gasto'}).selectOption(ids.supplier);
await page.waitForTimeout(80);
assert(await page.locator('input[placeholder="Nombre del proveedor"]').inputValue()==='Proveedor Maestro QA','El maestro no rellenó proveedor');
assert(await field('NIF / CIF proveedor').inputValue()==='B12345678','El maestro no rellenó NIF');
await page.getByLabel('Nombre manual del proveedor').fill('Proveedor manual QA');
assert(await page.evaluate(()=>window.__TotusOpsTest.expenseDraftSupplierId())==='', 'Escribir proveedor manual debe romper el vínculo con el maestro seleccionado');
await page.getByRole('combobox',{name:'Proveedor del gasto'}).selectOption(ids.supplier);
await page.getByRole('button',{name:/almacén.*300/i}).click();
assert(await page.evaluate(()=>window.__TotusOpsTest.expenseDraftSupplierId())==='', 'El atajo interno conserva por error el supplierId anterior');
await page.evaluate(()=>opsNewExpense());await page.waitForTimeout(40);
await page.getByRole('combobox',{name:'Proveedor del gasto'}).selectOption(ids.supplier);
await page.waitForTimeout(60);
await field('Nº factura proveedor').fill('PROV-QA-001');
await field('Base').fill('100');
await page.getByRole('combobox',{name:/Tratamiento IRPF/}).selectOption('partial');
await page.waitForTimeout(80);
await page.getByRole('textbox',{name:/Porcentaje deducible/}).fill('50');
await page.locator('#ops_exp_file').setInputFiles({name:'factura-proveedor-qa.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nFACTURA QA\n%%EOF')});
await page.getByRole('button',{name:'Vista previa seleccionada',exact:true}).click();
await page.getByRole('dialog').waitFor();
assert(await page.getByRole('dialog').locator('iframe.ops-pdf-frame').count()===1,'Factura de aprovisionamiento seleccionada no abre vista previa interna');
assert(await page.getByRole('dialog').getByRole('button',{name:'Descargar',exact:true}).count()===1,'Vista previa de aprovisionamiento no ofrece descarga opcional');
await page.getByRole('dialog').getByRole('button',{name:'Cerrar',exact:true}).click();
await page.getByRole('button',{name:'Guardar gasto',exact:true}).click();
await page.waitForTimeout(250);
const savedExpense=fixtures.ops_expenses.find(x=>x.invoice_number==='PROV-QA-001');
assert(savedExpense,'El gasto con factura real no se guardó');
assert(savedExpense.supplier_id===ids.supplier,'El gasto no quedó enlazado al maestro de proveedor');
assert(savedExpense.document_id,'El gasto no quedó enlazado a su factura adjunta');
const savedLine=fixtures.ops_expense_lines.find(x=>x.expense_id===savedExpense.id);
assert(Math.abs(Number(savedLine.irpf_imputable)-63.10)<0.02,'La deducibilidad parcial del 50 % no se aplicó');

// Abrir gasto y comprobar gestión directa del adjunto.
let savedExpenseRow=page.locator('tr').filter({hasText:'PROV-QA-001'}).first();
assert(await savedExpenseRow.getByRole('button',{name:'Vista previa',exact:true}).count()===1,'La lista de gastos no ofrece vista previa directa');
await savedExpenseRow.getByRole('button',{name:'Editar',exact:true}).click();
assert(await page.getByRole('button',{name:'Vista previa',exact:true}).count()>=1,'La ficha del gasto no permite previsualizar la factura adjunta');
assert(await page.getByRole('button',{name:'Quitar factura',exact:true}).count()===1,'La ficha del gasto no permite quitar el adjunto');

// Maestro: crear un proveedor nuevo desde la propia ficha.
await page.getByRole('button',{name:'+ Nuevo',exact:true}).click();
await page.getByRole('dialog').waitFor();
await page.getByRole('dialog').getByLabel('Nombre / razón social').fill('Distribuidor Nuevo QA');
await page.getByRole('dialog').getByLabel('NIF/CIF').fill('B87654321');
await page.getByRole('dialog').getByLabel('Ciudad').fill('Alcalá de Henares');
await page.getByRole('dialog').getByLabel('Código postal').fill('28801');
await page.getByRole('dialog').getByLabel('Forma de pago habitual').selectOption({label:'domiciliado'});
await page.getByRole('dialog').getByLabel('Documento habitual').selectOption('factura');
await page.getByRole('dialog').getByLabel('Categoría habitual').selectOption(ids.merch);
await page.getByRole('dialog').getByLabel('RE habitual %').fill('5,2');
await page.getByRole('dialog').getByRole('button',{name:'Guardar proveedor'}).click();
await page.waitForTimeout(180);
const createdSupplier=fixtures.ops_suppliers.find(x=>x.name==='Distribuidor Nuevo QA');
assert(createdSupplier,'No se creó el proveedor maestro desde Gastos');
assert(createdSupplier.city==='Alcalá de Henares'&&createdSupplier.postal_code==='28801','El maestro no conserva dirección estructurada');
assert(createdSupplier.default_payment_method==='domiciliado'&&Number(createdSupplier.default_re_rate)===5.2,'El maestro no conserva valores reutilizables');
await page.evaluate(()=>opsNewExpense());await page.waitForTimeout(40);
await page.getByRole('combobox',{name:'Proveedor del gasto'}).selectOption(createdSupplier.id);
await page.waitForTimeout(60);
assert(await page.getByRole('combobox',{name:'Forma de pago del gasto'}).inputValue()==='domiciliado','El proveedor nuevo no reutiliza forma de pago');
assert(await page.getByLabel('RE %').first().inputValue()==='5,2','El proveedor nuevo no reutiliza el RE habitual');

// Bulk download: seleccionar el gasto con factura y obtener ZIP.
await page.evaluate(()=>opsNewExpense());await page.waitForTimeout(50);
savedExpenseRow=page.locator('tr').filter({hasText:'PROV-QA-001'}).first();
await savedExpenseRow.getByRole('checkbox').check();
assert((await page.locator('#ops_exp_selected_count').innerText()).includes('1 seleccionados'),'El contador de selección masiva de gastos no se actualizó');
assert(!(await page.locator('#ops_exp_download_selected').isDisabled()),'La descarga masiva debe activarse al seleccionar un gasto');
let expenseZipPromise=page.waitForEvent('download');
await page.getByRole('button',{name:'Descargar facturas',exact:true}).click();
const expenseZip=await expenseZipPromise;
assert((await expenseZip.suggestedFilename()).endsWith('.zip'),'Descarga masiva de facturas de gasto no generó ZIP');

// Facturación: navegación, plantilla/logo único, cálculo y vista previa modal.
await page.getByRole('button',{name:'Facturación',exact:true}).click();await heading('Facturación');await auditCurrentUi('Facturación');
await page.getByRole('heading',{name:'Factura',exact:true}).waitFor();
assert(await page.getByLabel('Fecha del documento').getAttribute('max'),'La fecha de factura no bloquea visualmente días futuros');
assert(await page.locator('.invoice-editor-state').count()===1,'Facturación no muestra el estado/origen del documento de forma visible');
await page.getByRole('button',{name:'Rectificativas',exact:true}).click();
await page.getByRole('heading',{name:'Factura rectificativa',exact:true}).waitFor();
await page.getByRole('button',{name:'Proformas',exact:true}).click();
await page.getByRole('heading',{name:'Proforma',exact:true}).waitFor();

// Plantillas y logo viven únicamente en Facturación.
await page.locator('.billing-nav').getByRole('button',{name:'Plantillas y marca',exact:true}).click();
await page.getByRole('heading',{name:'Plantillas y marca',exact:true}).waitFor();
await auditCurrentUi('Facturación · Plantillas y marca');
assert(await page.getByRole('heading',{name:'Nombre y estilo',exact:true}).count()===1,'El editor de plantillas no agrupa identidad y estilo');
assert(await page.getByRole('heading',{name:'Logo corporativo',exact:true}).count()===1,'El editor de plantillas no agrupa el logo');
assert(await page.getByRole('heading',{name:'Títulos y textos',exact:true}).count()===1,'El editor de plantillas no agrupa los textos');
await page.locator('#ops_tpl_primary').fill('#123456');
await page.waitForTimeout(50);
assert((await page.locator('#ops_tpl_live_preview').getAttribute('class'))?.includes('invoice-mini-preview'),'La vista previa rápida de plantilla no existe');
let tplPdfPromise=page.waitForEvent('dialog').catch(()=>null);
await page.getByRole('button',{name:'Vista previa PDF',exact:true}).click();
await page.getByRole('dialog').waitFor();
assert(await page.getByRole('dialog').locator('iframe.ops-pdf-frame').count()===1,'La plantilla no abre una vista previa PDF dentro de Totus');
await page.getByRole('dialog').getByRole('button',{name:'Cerrar',exact:true}).click();
await page.locator('#ops_tpl_logo').setInputFiles({name:'logo-facturacion-qa.png',mimeType:'image/png',buffer:Buffer.from('PNG-QA-INVOICE')});
const storageBeforeLogo=storageUploads;
await page.getByRole('button',{name:'Subir / cambiar logo',exact:true}).click();
await page.waitForTimeout(200);
assert(storageUploads===storageBeforeLogo+1,'La subida de logo desde Facturación no llegó a Storage');
assert(fixtures.ops_document_templates[0].logo_name==='logo-facturacion-qa.png','El logo no quedó asociado a la plantilla');
assert(fixtures.ops_document_templates[0].logo_path,'La plantilla no guardó ruta de logo');
await field('Título factura').fill('FACTURA QA PERSONALIZADA');
await page.getByRole('button',{name:'Guardar plantilla',exact:true}).click();
await page.waitForTimeout(180);
assert(fixtures.ops_document_templates[0].invoice_title==='FACTURA QA PERSONALIZADA','Guardar plantilla no persistió el título');
const templatesBeforeDuplicate=fixtures.ops_document_templates.length;
await page.getByRole('button',{name:'Duplicar plantilla',exact:true}).click();
await page.getByRole('dialog').getByRole('button',{name:'Crear copia',exact:true}).click();
await page.waitForTimeout(180);
assert(fixtures.ops_document_templates.length===templatesBeforeDuplicate+1,'Duplicar plantilla no creó una copia');
const duplicatedTemplate=fixtures.ops_document_templates.at(-1);
assert(!duplicatedTemplate.logo_path&&Number(duplicatedTemplate.logo_size_bytes||0)===0,'La plantilla duplicada heredó indebidamente el archivo de logo');

// Clientes: ficha completa reutilizable.
await page.locator('.billing-nav').getByRole('button',{name:'Clientes',exact:true}).click();
await page.getByRole('heading',{name:'Ficha de cliente',exact:true}).waitFor();
await auditCurrentUi('Facturación · Clientes');
await field('Nombre / razón social').fill('Cliente Maestro QA');
await field('NIF/CIF').fill('B11112222');
await field('Email').fill('cliente@qa.test');
await field('Teléfono').fill('600000000');
await field('Dirección').fill('Calle Mayor 1');
await field('Código postal').fill('28801');
await field('Ciudad').fill('Alcalá de Henares');
await field('Provincia').fill('Madrid');
await field('País').fill('España');
await page.getByRole('combobox',{name:'Forma de pago por defecto del cliente'}).selectOption('domiciliado');
await field('Notas internas').fill('Cliente de prueba reutilizable');
await page.getByRole('button',{name:'Crear cliente',exact:true}).click();
await page.waitForTimeout(160);
const masterCustomer=fixtures.ops_customers.find(x=>x.name==='Cliente Maestro QA');
assert(masterCustomer,'No se creó la ficha maestra de cliente · customers='+JSON.stringify(fixtures.ops_customers)+' · dialogs='+dialogs.slice(-8).join(' | '));
assert(masterCustomer.city==='Alcalá de Henares'&&masterCustomer.postal_code==='28801'&&masterCustomer.phone==='600000000','La ficha de cliente no conserva dirección/contacto completos');
assert(masterCustomer.default_payment_method==='domiciliado','La ficha de cliente no conserva forma de pago');
const customerCountBeforeDuplicate=fixtures.ops_customers.length;
await page.getByRole('button',{name:'Nuevo',exact:true}).click();
await field('Nombre / razón social').fill('Cliente duplicado QA');
await field('NIF/CIF').fill('B11112222');
await page.getByRole('button',{name:'Crear cliente',exact:true}).click();
await page.waitForTimeout(80);
assert(fixtures.ops_customers.length===customerCountBeforeDuplicate,'El maestro permite duplicar clientes con el mismo NIF/CIF');
assert(dialogs.some(x=>/ya existe un cliente con ese NIF\/CIF/i.test(x)),'No avisa al intentar duplicar NIF/CIF de cliente');

// Al escribir un nombre manual después de elegir un cliente, la factura no debe conservar el vínculo anterior.
await page.getByRole('button',{name:'Facturación',exact:true}).click();await heading('Facturación');
await page.locator('.billing-nav').getByRole('button',{name:'Documentos',exact:true}).click();
await page.getByRole('combobox',{name:'Cliente guardado'}).selectOption(masterCustomer.id);
await page.waitForTimeout(50);
assert(await page.evaluate(()=>window.__TotusOpsTest.invoiceDraftCustomerId())===masterCustomer.id,'Seleccionar cliente no enlaza la factura con el maestro');
await field('Cliente / razón social').fill('Cliente manual distinto');
assert(await page.evaluate(()=>window.__TotusOpsTest.invoiceDraftCustomerId())==='','Editar manualmente el cliente conserva por error el customerId anterior');

// Series también están dentro de Facturación.
await page.locator('.billing-nav').getByRole('button',{name:'Series',exact:true}).click();
await page.getByRole('heading',{name:'Series 2026',exact:true}).waitFor();
await auditCurrentUi('Facturación · Series');
await page.locator('.billing-nav').getByRole('button',{name:'Documentos',exact:true}).click();
await page.getByRole('button',{name:'Proformas',exact:true}).click();
await page.getByRole('heading',{name:'Proforma',exact:true}).waitFor();
assert(await page.getByRole('combobox',{name:'Estado de cobro'}).count()===0,'La proforma muestra controles de cobro que no corresponden');
assert(await page.locator('#ops_doc_income').count()===0,'La proforma permite marcar ingreso antes de convertirse en factura');
assert(await page.getByLabel('Notas internas del documento').count()===1,'Facturación no separa notas internas del pie impreso');

await field('Cliente / razón social').fill('Cliente QA');
await field('Descripción').fill('Servicio QA');
await field('Cant.').fill('2');
await field('Precio base').fill('100');
await field('Dto %').fill('10');
await page.waitForTimeout(100);
await page.getByRole('button',{name:'Duplicar línea 1',exact:true}).click();
assert(await page.locator('.invoice-lines .ops-line').count()===2,'El editor de factura no permite duplicar líneas');
await page.getByRole('button',{name:'Eliminar línea 2',exact:true}).click();
assert(await page.locator('.invoice-lines .ops-line').count()===1,'El editor de factura no permite eliminar la línea duplicada');
await page.waitForTimeout(100);
assert((await page.locator('.ops-invoice-total').innerText()).includes('217,80'),'Total de proforma incorrecto');

await page.getByRole('button',{name:'Vista previa',exact:true}).click();
const previewDialog=page.getByRole('dialog');
await previewDialog.waitFor();
assert(await previewDialog.locator('iframe.ops-pdf-frame').count()===1,'La vista previa no abrió el PDF dentro de Totus');
assert(await previewDialog.getByRole('button',{name:'Descargar PDF',exact:true}).count()===1,'La vista previa no ofrece descarga opcional');
await previewDialog.getByRole('button',{name:'Cerrar',exact:true}).click();

await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();
await page.waitForTimeout(250);
const savedProforma=fixtures.ops_sales_invoices.find(x=>x.document_type==='proforma'&&x.customer_name==='Cliente QA');
assert(savedProforma,'La proforma no se guardó');
assert(fixtures.ops_sales_invoice_lines.some(x=>x.invoice_id===savedProforma.id),'La proforma no guardó sus líneas');
assert(Math.abs(Number(savedProforma.total_amount)-217.8)<0.01,'Total persistido de proforma incorrecto');
await page.getByRole('button',{name:'Proformas',exact:true}).click();
const row=page.locator('tr').filter({hasText:'Cliente QA'}).first();
await row.getByRole('button',{name:'Emitir',exact:true}).click();
await page.getByRole('dialog').waitFor();
assert(await page.getByRole('dialog').locator('iframe.ops-pdf-frame').count()===1,'Emitir proforma no abrió la vista final');
await page.getByRole('dialog').getByRole('button',{name:'Cerrar',exact:true}).click();
await page.waitForTimeout(150);
assert(savedProforma.status==='emitida','La proforma no se emitió');
assert(savedProforma.display_number,'La proforma emitida no recibió numeración');


// Proforma: aceptar y convertir a factura borrador.
let proRow=page.locator('tr').filter({hasText:'Cliente QA'}).first();
await proRow.getByText('Más',{exact:true}).click();
await proRow.getByRole('button',{name:'Aceptar proforma',exact:true}).click();
await page.waitForTimeout(160);
assert(savedProforma.status==='aceptada','Aceptar proforma no actualizó el estado');
proRow=page.locator('tr').filter({hasText:'Cliente QA'}).first();
await proRow.getByText('Más',{exact:true}).click();
await proRow.getByRole('button',{name:'Convertir a factura',exact:true}).click();
await page.waitForTimeout(200);
assert(savedProforma.status==='convertida'&&savedProforma.converted_invoice_id,'La proforma no quedó convertida');
assert(fixtures.ops_sales_invoices.some(x=>x.id===savedProforma.converted_invoice_id&&x.document_type==='factura'&&x.status==='borrador'),'La conversión no creó factura borrador');

// Factura normal: guardar, emitir, cobrar y crear rectificativa.
await page.getByRole('button',{name:'Facturas',exact:true}).click();
await page.getByRole('heading',{name:'Factura',exact:true}).waitFor();
await field('Cliente / razón social').fill('Cliente Factura QA');
await field('Descripción').fill('Venta QA');
await field('Cant.').fill('1');
await field('Precio base').fill('50');
const invoicesBeforeValidation=fixtures.ops_sales_invoices.length;
await field('Vencimiento').fill('2026-01-01');
await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();
await page.waitForTimeout(60);
assert(fixtures.ops_sales_invoices.length===invoicesBeforeValidation,'Facturación guardó un documento con vencimiento anterior a su fecha');
assert(dialogs.some(x=>/vencimiento no puede ser anterior/i.test(x)),'No avisó del vencimiento inválido');
await field('Vencimiento').fill('');
await field('Precio base').fill('-50');
await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();
await page.waitForTimeout(60);
assert(fixtures.ops_sales_invoices.length===invoicesBeforeValidation,'Facturación guardó precio negativo en factura normal');
assert(dialogs.some(x=>/factura normal no puede llevar precios negativos/i.test(x)),'No bloqueó precio negativo en factura normal');
await field('Precio base').fill('50');
await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();
await page.waitForTimeout(180);
const normalInvoice=fixtures.ops_sales_invoices.find(x=>x.customer_name==='Cliente Factura QA'&&x.document_type==='factura'&&x.invoice_kind==='invoice');
assert(normalInvoice&&normalInvoice.status==='borrador','Factura normal no guardada como borrador');
let invoiceRow=page.locator('tr').filter({hasText:'Cliente Factura QA'}).first();
await invoiceRow.getByRole('button',{name:'Emitir',exact:true}).click();
await page.getByRole('dialog').waitFor();
assert(await page.getByRole('dialog').getByRole('button',{name:'Descargar PDF',exact:true}).count()===1,'Factura emitida sin descarga opcional en vista previa');
await page.getByRole('dialog').getByRole('button',{name:'Cerrar',exact:true}).click();
await page.waitForTimeout(150);
assert(normalInvoice.status==='emitida'&&normalInvoice.display_number,'Factura normal no emitida/numerada');
invoiceRow=page.locator('tr').filter({hasText:'Cliente Factura QA'}).first();
assert(await invoiceRow.getByRole('button',{name:'Vista previa',exact:true}).count()===1,'La factura emitida no ofrece vista previa directa');
await invoiceRow.getByRole('button',{name:'Vista previa',exact:true}).click();
await page.getByRole('dialog').waitFor();
assert(await page.getByRole('dialog').locator('iframe.ops-pdf-frame').count()===1,'La vista previa de factura emitida no se abre dentro de Totus');
await page.getByRole('dialog').getByRole('button',{name:'Cerrar',exact:true}).click();
await invoiceRow.getByRole('button',{name:'Cobrar',exact:true}).click();
await page.waitForTimeout(160);
assert(normalInvoice.paid_status==='pagada','Marcar cobrada no persistió');
invoiceRow=page.locator('tr').filter({hasText:'Cliente Factura QA'}).first();
await invoiceRow.getByText('Más',{exact:true}).click();
await invoiceRow.getByRole('button',{name:'Crear rectificativa',exact:true}).click();
await page.getByRole('heading',{name:'Factura rectificativa',exact:true}).waitFor();
assert(Number(await field('Precio base').inputValue())<0,'La rectificativa no propone importe negativo');
await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();
await page.waitForTimeout(180);
const rectInvoice=fixtures.ops_sales_invoices.find(x=>x.customer_name==='Cliente Factura QA'&&x.invoice_kind==='rectifying');
assert(rectInvoice&&rectInvoice.series_id===ids.seriesHR,'Rectificativa no usa su serie independiente');

// Flujo tipo editor: crear y emitir sin salir del documento.
await page.getByRole('button',{name:'Facturas',exact:true}).click();
await field('Cliente / razón social').fill('Cliente Directa QA');
await field('Descripción').fill('Factura directa QA');
await field('Precio base').fill('25');
await page.getByRole('button',{name:'Guardar y emitir',exact:true}).click();
await page.getByRole('dialog').waitFor();
assert(await page.getByRole('dialog').locator('iframe.ops-pdf-frame').count()===1,'Guardar y emitir no terminó en vista previa interna');
await page.getByRole('dialog').getByRole('button',{name:'Cerrar',exact:true}).click();
await page.waitForTimeout(120);
const directInvoice=fixtures.ops_sales_invoices.find(x=>x.customer_name==='Cliente Directa QA');
assert(directInvoice?.status==='emitida'&&directInvoice.display_number,'Guardar y emitir no dejó la factura emitida y numerada');

// Una serie usada conserva prefijo y dígitos; solo puede avanzar el siguiente número.
await page.locator('.billing-nav').getByRole('button',{name:'Series',exact:true}).click();
const seriesHRow=page.locator('tr').filter({hasText:'H-2026'}).first();
await seriesHRow.getByLabel('Prefijo de H-2026').fill('CAMBIADO-');
await seriesHRow.getByLabel('Siguiente número de H-2026').fill('99');
await seriesHRow.getByRole('button',{name:'Guardar',exact:true}).click();
await page.waitForTimeout(60);
assert(fixtures.ops_invoice_series.find(x=>x.id===ids.seriesH).prefix==='H-2026-','Una serie usada permitió cambiar su prefijo');
assert(dialogs.some(x=>/prefijo y número de dígitos quedan bloqueados/i.test(x)),'No avisa al intentar alterar una serie ya usada');
await page.locator('.billing-nav').getByRole('button',{name:'Documentos',exact:true}).click();

// Factura externa: documento original + numeración externa + registro emitido.
await page.getByRole('button',{name:'Facturas',exact:true}).click();
await field('Origen').selectOption('externa');
await page.waitForTimeout(80);
await field('Nº usado fuera').fill('77');
await field('Cliente / razón social').fill('Cliente Externo QA');
await field('Descripción').fill('Venta externa QA');
await field('Precio base').fill('80');
await page.locator('#ops_external_doc_file').setInputFiles({name:'factura-externa-qa.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nEXTERNA QA\n%%EOF')});
await page.getByRole('button',{name:'Vista previa seleccionada',exact:true}).click();
await page.getByRole('dialog').waitFor();
assert(await page.getByRole('dialog').locator('iframe.ops-pdf-frame').count()===1,'Factura externa seleccionada no abre vista previa interna');
await page.getByRole('dialog').getByRole('button',{name:'Cerrar',exact:true}).click();
const beforeExternalUpload=storageUploads;
await page.getByRole('button',{name:'Registrar externa',exact:true}).click();
await page.waitForTimeout(250);
const externalInvoice=fixtures.ops_sales_invoices.find(x=>x.customer_name==='Cliente Externo QA');
assert(externalInvoice&&externalInvoice.status==='emitida','Factura externa no quedó emitida · invoice='+JSON.stringify(externalInvoice||null)+' · dialogs='+dialogs.slice(-8).join(' | '));
assert(externalInvoice.number===77,'Factura externa no conservó su número');
assert(Number(fixtures.ops_invoice_series.find(x=>x.id===ids.seriesH)?.next_number)>=78,'Factura externa no avanzó la serie interna y podría provocar duplicados');
assert(storageUploads===beforeExternalUpload+1,'PDF externo no llegó a Storage');
assert(fixtures.ops_documents.some(x=>x.linked_entity_type==='sales_invoice_source'&&x.linked_entity_id===externalInvoice.id),'PDF externo no quedó archivado');
const externalRow=page.locator('tr').filter({hasText:'Cliente Externo QA'}).first();
assert(await externalRow.getByRole('button',{name:'Original',exact:true}).count()===1,'Factura externa no ofrece vista previa del original');
await externalRow.getByRole('button',{name:'Original',exact:true}).click();
await page.getByRole('dialog').waitFor();
assert(await page.getByRole('dialog').locator('iframe.ops-pdf-frame').count()===1,'El original externo no se abre dentro de Totus');
await page.getByRole('dialog').getByRole('button',{name:'Cerrar',exact:true}).click();


// Validación de tipos/tamaño documental.
const validationQa=await page.evaluate(()=>{
 const ok=[];
 for(const [name,type] of [['a.pdf','application/pdf'],['a.jpg','image/jpeg'],['a.png','image/png'],['a.webp','image/webp'],['a.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],['a.xls','application/vnd.ms-excel'],['a.csv','text/csv'],['a.txt','text/plain'],['a.md','text/markdown']]){
  try{window.__opsValidateDocumentFile(new File(['x'],name,{type}));ok.push(name)}catch(e){}
 }
 let badExt=false,badMime=false,big=false,empty=false;
 try{window.__opsValidateDocumentFile(new File(['x'],'a.exe',{type:'application/octet-stream'}))}catch(e){badExt=true}
 try{window.__opsValidateDocumentFile(new File(['x'],'a.pdf',{type:'application/javascript'}))}catch(e){badMime=true}
 try{window.__opsValidateDocumentFile(new File([new Uint8Array(21*1024*1024)],'big.pdf',{type:'application/pdf'}))}catch(e){big=true}
 try{window.__opsValidateDocumentFile(new File([],'empty.pdf',{type:'application/pdf'}))}catch(e){empty=true}
 return{ok,badExt,badMime,big,empty};
});
assert(validationQa.ok.length===9,'No se aceptan todos los formatos documentales previstos');
assert(validationQa.badExt&&validationQa.badMime&&validationQa.big&&validationQa.empty,'Validación documental no bloquea extensión, MIME, tamaño o vacío');

// Documentos: UI completo subir -> recargar -> descargar.
await page.locator('.app-nav').getByRole('button',{name:'Documentos',exact:true}).click();await heading('Documentos');await auditCurrentUi('Documentos');
assert(await page.getByLabel('Fecha del documento archivado').getAttribute('max'),'Documentos no limita visualmente la fecha futura');
assert(await page.getByRole('option',{name:'Factura recibida',exact:true}).count()>=1,'Documentos sigue mostrando tipos técnicos al usuario');
assert(await page.getByRole('option',{name:'Preparada para gestoría',exact:true}).count()>=1,'Documentos sigue mostrando estados técnicos al usuario');
assert(await page.getByRole('button',{name:'Limpiar filtros',exact:true}).count()===1,'Documentos no ofrece una forma clara de restablecer filtros');

// Las altas rápidas de cliente/proveedor no deben borrar el documento ya preparado.
await page.locator('#ops_doc_file').setInputFiles({name:'preservar.txt',mimeType:'text/plain',buffer:Buffer.from('preservar formulario')});
await page.getByRole('button',{name:'+ Cliente',exact:true}).click();
await page.getByRole('dialog').getByLabel('Nombre / razón social').fill('Cliente Doc QA');
await page.getByRole('dialog').getByLabel('NIF/CIF').fill('B22223333');
await page.getByRole('dialog').getByRole('button',{name:'Guardar cliente',exact:true}).click();
await page.waitForTimeout(120);
assert((await page.locator('#ops_doc_file').inputValue()).includes('preservar.txt'),'Crear cliente desde Documentos borró el archivo preparado');
assert(await page.locator('#ops_doc_party').inputValue()==='Cliente Doc QA','Crear cliente desde Documentos no devolvió el cliente al formulario');
await page.getByRole('button',{name:'+ Proveedor',exact:true}).click();
await page.getByRole('dialog').getByLabel('Nombre / razón social').fill('Proveedor Doc QA');
await page.getByRole('dialog').getByLabel('NIF/CIF').fill('B33334444');
await page.getByRole('dialog').getByRole('button',{name:'Guardar proveedor',exact:true}).click();
await page.waitForTimeout(120);
assert((await page.locator('#ops_doc_file').inputValue()).includes('preservar.txt'),'Crear proveedor desde Documentos borró el archivo preparado');
assert(await page.locator('#ops_doc_party').inputValue()==='Proveedor Doc QA','Crear proveedor desde Documentos no devolvió el proveedor al formulario');

// Un archivo preparado no debe perderse al cambiar de pestaña sin aviso.
await page.locator('#ops_doc_file').setInputFiles({name:'sin-guardar.txt',mimeType:'text/plain',buffer:Buffer.from('pendiente')});
const dialogsBeforeDocLeave=dialogs.length;
await page.locator('.app-nav').getByRole('button',{name:'Gastos',exact:true}).click();
await page.waitForTimeout(60);
assert(dialogs.slice(dialogsBeforeDocLeave).some(x=>/documento preparado para subir/i.test(x)),'Documentos permite salir con un archivo preparado sin avisar');
await page.locator('.app-nav').getByRole('button',{name:'Documentos',exact:true}).click();await heading('Documentos');

// Las facturas archivadas manualmente requieren fecha válida, proveedor/cliente y número.
const docsBeforeInvalid=fixtures.ops_documents.length;
await page.getByLabel('Fecha del documento archivado').fill('2099-01-01');
await page.locator('#ops_doc_file').setInputFiles({name:'future.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nFUTURE\n%%EOF')});
await page.getByRole('button',{name:'Subir',exact:true}).click();
await page.waitForTimeout(70);
assert(fixtures.ops_documents.length===docsBeforeInvalid,'Documentos permitió archivar una fecha futura');
assert(dialogs.some(x=>/fecha futura/i.test(x)),'Documentos no avisa al bloquear una fecha futura');
await page.getByLabel('Fecha del documento archivado').fill('2026-10-11');
await page.locator('#ops_doc_party').fill('');
await field('Nº documento').fill('');
await page.getByRole('button',{name:'Subir',exact:true}).click();
await page.waitForTimeout(70);
assert(fixtures.ops_documents.length===docsBeforeInvalid,'Documentos permitió una factura recibida sin proveedor ni número');
assert(dialogs.some(x=>/proveedor o cliente/i.test(x)),'Documentos no exige proveedor/cliente en una factura archivada');

await page.locator('#ops_doc_party').fill('Proveedor QA');
await page.locator('#ops_doc_tax').fill('BQA000001');
await field('Nº documento').fill('QA-2026-001');
await page.locator('#ops_doc_file').setInputFiles({name:'qa.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nQA\n%%EOF')});
assert((await page.locator('#ops_doc_file').inputValue()).includes('qa.pdf'),'Selector documental no cargó archivo');
await page.getByRole('button',{name:'Vista previa seleccionada',exact:true}).click();
await page.getByRole('dialog').waitFor();
assert(await page.getByRole('dialog').locator('iframe.ops-pdf-frame').count()===1,'Documento seleccionado no abre vista previa antes de subir');
await page.getByRole('dialog').getByRole('button',{name:'Cerrar',exact:true}).click();
const docsBeforeStandalone=fixtures.ops_documents.length;
await page.getByRole('button',{name:'Subir',exact:true}).click();
await page.waitForTimeout(250);
const qaDoc=fixtures.ops_documents.find(x=>x.original_name==='qa.pdf');
assert(fixtures.ops_documents.length===docsBeforeStandalone+1,'El alta documental no llegó al backend simulado. Diálogos: '+dialogs.join(' | '));
assert(qaDoc,'El documento QA no tiene registro persistido. Diálogos: '+dialogs.join(' | '));
const beforeStorageDownloads=storageDownloads;
await page.evaluate(id=>window.opsDownloadDoc(id),qaDoc.id);
await page.waitForTimeout(180);
assert(storageDownloads===beforeStorageDownloads+1,'Descarga documental no consultó Supabase Storage');
assert(fixtures.ops_documents.some(x=>x.original_name==='qa.pdf'),'El documento independiente no persistió');
const qaRow=page.locator('tr').filter({hasText:'qa.pdf'}).first();
assert(await qaRow.getByRole('button',{name:'Vista previa',exact:true}).count()===1,'Los documentos PDF no ofrecen vista previa directa');
await qaRow.getByRole('combobox',{name:'Estado de qa.pdf',exact:true}).selectOption('revisada');
await page.waitForTimeout(120);
assert(qaDoc.status==='revisada','Cambiar estado documental no persistió');

// Los documentos vinculados se consultan aquí, pero no se rompen desde Archivo.
const linkedDoc=fixtures.ops_documents.find(x=>x.linked_entity_type==='sales_invoice_source');
assert(linkedDoc,'No existe documento vinculado de factura externa para probar protección');
const linkedRow=page.locator('tr').filter({hasText:linkedDoc.original_name}).first();
assert(await linkedRow.getByText('Original de factura externa',{exact:true}).count()===1,'Archivo no identifica el origen de un documento vinculado');
assert(await linkedRow.getByRole('button',{name:'Eliminar',exact:true}).count()===0,'Archivo permite borrar individualmente un original vinculado a factura');
await linkedRow.getByRole('checkbox').check();
const linkedCountBefore=fixtures.ops_documents.length;
const bulkDelete=page.getByRole('button',{name:'Eliminar selección',exact:true});
assert(await bulkDelete.isDisabled(),'Eliminar selección debería desactivarse cuando hay documentos vinculados');
assert((await page.locator('#ops_doc_selected_count').innerText()).includes('vinculados'),'La selección no informa cuántos documentos están vinculados');
assert(fixtures.ops_documents.length===linkedCountBefore,'Seleccionar un documento vinculado alteró el archivo');
await linkedRow.getByRole('checkbox').uncheck();

// La búsqueda alcanza también NIF y tipo, no solo nombre/archivo.
await page.locator('#ops_doc_search').fill('BQA000001');
await page.waitForTimeout(60);
assert(await page.locator('tr[data-doc-row="1"]:visible').filter({hasText:'qa.pdf'}).count()===1,'La búsqueda documental no localiza por NIF/CIF');
await page.locator('#ops_doc_search').fill('');

// CSV/Excel también deben abrirse dentro de Totus, nunca descargar automáticamente al pulsar Vista previa.
await page.locator('#ops_doc_party').fill('Proveedor CSV QA');
await field('Nº documento').fill('CSV-2026-001');
await page.locator('#ops_doc_file').setInputFiles({name:'qa.csv',mimeType:'text/csv',buffer:Buffer.from('Concepto;Importe\nUno;10\nDos;20\n')});
await page.getByRole('button',{name:'Subir',exact:true}).click();
await page.waitForTimeout(220);
const csvDoc=fixtures.ops_documents.find(x=>x.original_name==='qa.csv');
assert(csvDoc,'El CSV de prueba no quedó guardado');
const csvRow=page.locator('tr').filter({hasText:'qa.csv'}).first();
const beforeCsvPreview=storageDownloads;
await csvRow.getByRole('button',{name:'Vista previa',exact:true}).click();
await page.getByRole('dialog').waitFor();
assert(await page.getByRole('dialog').locator('.ops-tabular-preview').count()===1,'CSV/Excel no usa vista previa tabular dentro de Totus');
assert(storageDownloads===beforeCsvPreview+1,'Vista previa tabular no recuperó el archivo desde Storage');
await page.getByRole('dialog').getByRole('button',{name:'Cerrar',exact:true}).click();

// TXT permitido por el selector también debe subir y previsualizarse realmente.
await page.locator('#ops_doc_type').selectOption('otro');
await page.locator('#ops_doc_party').fill('');
await field('Nº documento').fill('');
await page.locator('#ops_doc_file').setInputFiles({name:'nota-qa.txt',mimeType:'text/plain',buffer:Buffer.from('Documento de texto QA')});
await page.getByRole('button',{name:'Subir',exact:true}).click();
await page.waitForTimeout(180);
const txtDoc=fixtures.ops_documents.find(x=>x.original_name==='nota-qa.txt');
assert(txtDoc,'El formato TXT anunciado por Documentos no se pudo subir');
const txtRow=page.locator('tr').filter({hasText:'nota-qa.txt'}).first();
await txtRow.getByRole('button',{name:'Vista previa',exact:true}).click();
await page.getByRole('dialog').waitFor();
assert(await page.getByRole('dialog').locator('.ops-text-preview').count()===1,'TXT no usa vista previa interna');
await page.getByRole('dialog').getByRole('button',{name:'Cerrar',exact:true}).click();

// El límite total configurado debe bloquear nuevas subidas, no ser solo un indicador visual.
await page.evaluate(()=>{window.TotusGestion.storageUsage={total_bytes:1073741824,documents_count:0,documents_bytes:1073741824,assets_count:0,assets_bytes:0}});
await page.locator('#ops_doc_type').selectOption('otro');
await page.locator('#ops_doc_file').setInputFiles({name:'sin-espacio.txt',mimeType:'text/plain',buffer:Buffer.from('x')});
const docsBeforeNoSpace=fixtures.ops_documents.length;
await page.getByRole('button',{name:'Subir',exact:true}).click();
await page.waitForTimeout(80);
assert(fixtures.ops_documents.length===docsBeforeNoSpace,'Documentos permitió superar el límite total configurado');
assert(dialogs.some(x=>/espacio total disponible/i.test(x)),'Documentos no informa al bloquear una subida por falta de espacio');
await page.evaluate(()=>{window.TotusGestion.storageUsage={total_bytes:0,documents_count:0,documents_bytes:0,assets_count:0,assets_bytes:0}});

let zipDl=page.waitForEvent('download');
await page.getByRole('button',{name:'ZIP filtrado',exact:true}).click();
const filteredZip=await zipDl;
const filteredZipObj=await JSZipNode.loadAsync(await fs.readFile(await filteredZip.path()));
assert(Object.keys(filteredZipObj.files).some(n=>n.endsWith('qa.pdf')),'ZIP filtrado no contiene el documento esperado');
await qaRow.getByRole('button',{name:'Eliminar',exact:true}).click();
await page.getByRole('dialog').getByLabel('Motivo obligatorio').fill('QA eliminación documento');
await page.getByRole('dialog').getByRole('button',{name:'Confirmar'}).click().catch(async()=>await page.getByRole('dialog').getByRole('button',{name:/Eliminar/}).click());
await page.waitForTimeout(150);
assert(!fixtures.ops_documents.some(x=>x.id===qaDoc.id),'Eliminar documento no quitó el registro');

// Fiscalidad: cifras 1T/2T contrastadas con las Fuentes finales.
fixtures.ops_historical_income_periods.push(
 {id:'hist-h-q1',store_id:ids.h,period_start:'2026-01-01',period_end:'2026-03-31',card_sales:0,cash_income:0,other_income:0,total_income:49469.51,official_total_income:49469.51,gestor_reported_income:49469.51,fiscal_basis_income:49469.51,source:'gestoria',verified_by_gestor:true,notes:'QA FINAL 1T'},
 {id:'hist-n-q1',store_id:ids.n,period_start:'2026-01-01',period_end:'2026-03-31',card_sales:0,cash_income:0,other_income:0,total_income:31809.88,official_total_income:31809.88,gestor_reported_income:31809.88,fiscal_basis_income:31809.88,source:'gestoria',verified_by_gestor:true,notes:'QA FINAL 1T'},
 {id:'hist-h-q2',store_id:ids.h,period_start:'2026-04-01',period_end:'2026-06-30',card_sales:0,cash_income:0,other_income:0,total_income:52846.33,official_total_income:49603.68,gestor_reported_income:49603.68,fiscal_basis_income:52846.33,source:'gestoria',verified_by_gestor:true,notes:'QA FINAL 2T'},
 {id:'hist-n-q2',store_id:ids.n,period_start:'2026-04-01',period_end:'2026-06-30',card_sales:0,cash_income:0,other_income:0,total_income:34845.73,official_total_income:26326.31,gestor_reported_income:26326.31,fiscal_basis_income:34845.73,source:'gestoria',verified_by_gestor:true,notes:'QA FINAL 2T'}
);
fixtures.ops_fiscal_reference_periods.push(
 {id:'ref-h-q1',store_id:ids.h,period_month:'2026-01-01',source_name:'FINAL 1T',income_amount:49469.51,expense_amount:37595.88,through_date:'2026-03-31',authoritative:true},
 {id:'ref-n-q1',store_id:ids.n,period_month:'2026-01-01',source_name:'FINAL 1T',income_amount:31809.88,expense_amount:25211.52,through_date:'2026-03-31',authoritative:true},
 {id:'ref-h-q2',store_id:ids.h,period_month:'2026-04-01',source_name:'FINAL 2T',income_amount:52846.33,expense_amount:44896.81,through_date:'2026-06-30',authoritative:true},
 {id:'ref-n-q2',store_id:ids.n,period_month:'2026-04-01',source_name:'FINAL 2T',income_amount:34845.73,expense_amount:27233.92,through_date:'2026-06-30',authoritative:true}
);
fixtures.ops_gestor_natural_rows.push(
 {id:'gest-q1',source_file:'GASTOS 1T',fiscal_year:2026,quarter:1,order_no:9991,expense_date:'2026-03-31',received_invoice_ref:'',supplier_invoice_no:'',supplier_tax_id:'',supplier_name:'CIERRE GESTOR 1T',concept_code:'',concept_text:'TOTAL FISCAL QA',base_vat:0,vat_rate:0,vat_amount:9189.44,re_base:0,re_rate:0,re_amount:1874.60,imputable_irpf:63436.97,withholding_base:0,withholding_rate:0,withholding_amount:782.18,tax_support_line:false,raw_line:'QA'},
 {id:'gest-q2',source_file:'GASTOS 2T',fiscal_year:2026,quarter:2,order_no:9992,expense_date:'2026-06-30',received_invoice_ref:'',supplier_invoice_no:'',supplier_tax_id:'',supplier_name:'CIERRE GESTOR 2T',concept_code:'',concept_text:'TOTAL FISCAL QA',base_vat:0,vat_rate:0,vat_amount:10365.34,re_base:0,re_rate:0,re_amount:2024.77,imputable_irpf:76241.07,withholding_base:0,withholding_rate:0,withholding_amount:1044.24,tax_support_line:false,raw_line:'QA'}
);
fixtures.ops_tax_payments.push(
 {id:'tax-111-q1',tax_type:'111',fiscal_year:2026,quarter:1,amount:228.71,status:'pagado',payment_date:'2026-04-20',period_label:'1T 2026'},
 {id:'tax-115-q1',tax_type:'115',fiscal_year:2026,quarter:1,amount:553.47,status:'pagado',payment_date:'2026-04-20',period_label:'1T 2026'},
 {id:'tax-130-q1',tax_type:'130',fiscal_year:2026,quarter:1,amount:3390.06,status:'pagado',payment_date:'2026-04-20',period_label:'1T 2026'},
 {id:'tax-111-q2',tax_type:'111',fiscal_year:2026,quarter:2,amount:478.23,status:'pagado',payment_date:'2026-07-20',period_label:'2T 2026'},
 {id:'tax-115-q2',tax_type:'115',fiscal_year:2026,quarter:2,amount:566.01,status:'pagado',payment_date:'2026-07-20',period_label:'2T 2026'},
 {id:'tax-130-q2',tax_type:'130',fiscal_year:2026,quarter:2,amount:2175.69,status:'pagado',payment_date:'2026-07-20',period_label:'2T 2026'}
);
fixtures.ops_reconciliation_notes.push({id:'rec-q2',created_at:'2026-10-06T17:57:56Z',fiscal_year:2026,quarter:2,source_name:'INGRESOS(1).pdf',issue_type:'ingresos_excel_vs_gestoria',detail:'El listado de gestoría difiere de las ventas reconstruidas.',resolution:'Conservar el listado como discrepancia; la base fiscal validada usa 87.692,06 € confirmados por el modelo 130.',amount_difference:11762.07,active:true});
await page.evaluate(async()=>{window.TotusGestion.quarter=2;if(typeof window.opsLoadData==='function')await window.opsLoadData(true);window.TotusGestionFeatures&&await window.TotusGestionFeatures.load(true)});
await page.getByRole('button',{name:'Fiscalidad',exact:true}).click();await heading('Fiscalidad');await auditCurrentUi('Fiscalidad');
assert(await page.locator('.fiscal-nav').count()===1,'Fiscalidad no está seccionada para navegarla con claridad');
for(const n of ['Resumen','Resultado','Impuestos','IRPF','RETA','Fuentes','Modelos'])assert(await page.locator('.fiscal-nav').getByRole('button',{name:n,exact:true}).count()===1,'Falta acceso fiscal '+n);
await page.getByRole('heading',{name:'¿Gastar más o menos?',exact:true}).waitFor();
await page.getByRole('heading',{name:'Cuota según rendimiento',exact:true}).waitFor();
await page.getByText('Cuota actual',{exact:true}).waitFor();
await page.getByRole('heading',{name:/Previsión fiscal/}).waitFor();
await page.getByRole('heading',{name:'Resultado operativo por tienda',exact:true}).waitFor();
await page.getByRole('heading',{name:'IVA y recargo de equivalencia',exact:true}).waitFor();
await page.getByRole('heading',{name:'Números usados para impuestos',exact:true}).waitFor();
assert(await page.getByText('Informe final verificado',{exact:true}).count()===2,'Fiscalidad no identifica las dos referencias verificadas por tienda');
await field('Gasto deducible adicional').fill('500');
await page.waitForTimeout(250);
assert(await page.getByText('Reserva fiscal',{exact:false}).count()>0,'No aparece reserva fiscal');
assert(await page.getByText('Colaboradora familiar activa',{exact:true}).count()===1,'Fiscalidad no separa colaboradora familiar');
const sourceFiscal=await page.evaluate(()=>({
 q1:window.__TotusOpsTest.fiscalProjection(2026,1,0),
 q2:window.__TotusOpsTest.fiscalProjection(2026,2,0),
 h1:window.__TotusOpsTest.incomeTotal('2026-01-01','2026-06-30','all'),
 operationalH1:window.__TotusOpsTest.operationalIncomeTotal('2026-01-01','2026-06-30','all'),
 gestorReportedQ2:window.TotusGestion.features.historicalIncome.filter(x=>x.period_start>='2026-04-01'&&x.period_end<='2026-06-30').reduce((a,x)=>a+Number(x.gestor_reported_income||0),0)
}));
assert(Math.abs(sourceFiscal.q1.income-81279.39)<0.01&&Math.abs(sourceFiscal.q1.raw-63436.97)<0.01,'1T no conserva ventas/gastos FINAL verificados');
assert(Math.abs(sourceFiscal.q1.payable-3390.06)<0.01,'Modelo 130 1T no reproduce 3.390,06 €');
assert(Math.abs(sourceFiscal.q2.income-168971.45)<0.01&&Math.abs(sourceFiscal.q2.raw-139678.04)<0.01,'Acumulado 1S no conserva las bases fiscales verificadas');
assert(Math.abs(sourceFiscal.q2.payable-2175.69)<0.01,'Modelo 130 2T no reproduce 2.175,69 €');
assert(Math.abs(sourceFiscal.q1.reserve)<0.01&&Math.abs(sourceFiscal.q2.reserve)<0.01,'Fiscalidad mantiene como reserva importes 130/111/115 ya satisfechos');
assert(Math.abs(sourceFiscal.q2.pending130)<0.01&&Math.abs(sourceFiscal.q2.pending111)<0.01&&Math.abs(sourceFiscal.q2.pending115)<0.01,'Fiscalidad no separa obligación calculada de importe pendiente');
assert(Math.abs(sourceFiscal.h1-168971.45)<0.01&&Math.abs(sourceFiscal.operationalH1-168971.45)<0.01,'Ventas operativas/fiscales 1S no cuadran con Fuentes');
assert(Math.abs(sourceFiscal.gestorReportedQ2-75929.99)<0.01,'No se conserva el listado INGRESOS(1).pdf de 75.929,99 €');
assert(Math.abs(87692.06-sourceFiscal.gestorReportedQ2-11762.07)<0.01,'La conciliación de ingresos 2T no cuadra');
await page.getByRole('heading',{name:'Conciliaciones documentadas',exact:true}).waitFor();
assert(await page.getByText('INGRESOS(1).pdf',{exact:true}).count()===1,'Fiscalidad no muestra la fuente de conciliación');
await page.getByRole('heading',{name:'Pago / modelo fiscal',exact:true}).waitFor();
assert(await page.getByRole('combobox',{name:'Estado del modelo'}).getByRole('option',{name:'Previsto · pendiente',exact:true}).count()===1,'Fiscalidad no usa el estado previsto admitido por base de datos');
assert(await page.getByRole('combobox',{name:'Estado del modelo'}).getByRole('option',{name:'Compensado',exact:true}).count()===1,'Fiscalidad no permite estado compensado');
assert(await page.getByRole('combobox',{name:'Modelo fiscal'}).getByRole('option',{name:'RETA · Cuota autónomos',exact:true}).count()===1,'Fiscalidad no ofrece RETA según el esquema real');
assert(await page.getByRole('combobox',{name:'Modelo fiscal'}).getByRole('option',{name:'Otro pago fiscal',exact:true}).count()===1,'Fiscalidad no usa OTRO según el esquema real');
await page.getByRole('combobox',{name:'Modelo fiscal'}).selectOption('130');
await page.getByLabel('Año fiscal').fill('2026');
await page.getByRole('combobox',{name:'Trimestre fiscal'}).selectOption('3');
const taxCountBeforeFuture=fixtures.ops_tax_payments.length;
await page.getByLabel('Fecha pago o presentación').fill('2099-01-01');
await page.getByLabel('Importe del modelo').fill('1234,56');
await page.getByRole('button',{name:'Guardar',exact:true}).click();
await page.waitForTimeout(70);
assert(fixtures.ops_tax_payments.length===taxCountBeforeFuture,'Fiscalidad permitió registrar como pagado un modelo con fecha futura');
assert(dialogs.some(x=>/pago ya realizado no puede tener una fecha futura/i.test(x)),'Fiscalidad no avisa al bloquear fecha futura');
await page.getByLabel('Fecha pago o presentación').fill('2026-10-10');
await page.getByLabel('Justificante del modelo').setInputFiles({name:'modelo130-t3.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nMODELO130\n%%EOF')});
await page.getByRole('button',{name:'Guardar',exact:true}).click();
await page.waitForTimeout(220);
const tax130=fixtures.ops_tax_payments.find(x=>x.tax_type==='130'&&Number(x.quarter)===3&&Number(x.fiscal_year)===2026);
assert(tax130&&Math.abs(Number(tax130.amount)-1234.56)<0.01,'Fiscalidad no guardó el modelo 130 registrado');
assert(tax130.document_id,'El modelo fiscal no quedó vinculado a su justificante · tax='+JSON.stringify(tax130)+' · docs='+JSON.stringify(fixtures.ops_documents)+' · dialogs='+dialogs.slice(-6).join(' | '));
assert(fixtures.ops_documents.some(x=>x.id===tax130.document_id&&x.linked_entity_type==='tax_payment'),'El justificante fiscal no quedó archivado correctamente · tax='+JSON.stringify(tax130)+' · docs='+JSON.stringify(fixtures.ops_documents));

// Informes: estructura gestoría + XLSX, PDF and ZIP generators.
const reportQa=await page.evaluate(()=>{
  const g=window.__TotusOpsTest.managerExpenseRows('2026-01-01','2026-12-31');
  const s=window.__TotusOpsTest.managerExpenseSummaryRows('2026-01-01','2026-12-31');
  const i=window.__TotusOpsTest.managerIncomeRows('2026-01-01','2026-12-31');
  const r=window.__TotusOpsTest.reportSummaryRows('2026-04-01','2026-06-30');
  return {g,s,i,r};
});
assert(reportQa.g[0].join('|')==='Orden|Fecha|Nº fra. recibida|Nº fra. proveedor|Rt|NIF/CIF|Razón social|Concepto|Base IVA|% IVA|Cuota IVA|Base R.E.|% R.E.|Cuota R.E.|Imputable a IRPF|Base retención|% retención|Cuota retenida|Total factura|Neto pagado','Cabecera de gastos no coincide con las 20 columnas reales de gestoría');
assert(reportQa.g[0].length===20,'El libro de gastos debe conservar exactamente 20 columnas');
assert(reportQa.g.at(-1)[7]==='TOTAL ACUMULADO','Falta total acumulado en gastos');
assert(String(reportQa.g.at(-1)[18]).startsWith('=SUM(S2:S'),'Falta fórmula de Total factura');
assert(String(reportQa.g.at(-1)[19]).startsWith('=SUM(T2:T'),'Falta fórmula de Neto pagado');
assert(reportQa.s[0][0]==='Código'&&reportQa.s[0][1]==='Descripción'&&reportQa.s[0][6]==='Imputable IRPF','Desglose de conceptos/códigos incorrecto');
assert(reportQa.i[0][0]==='Orden'&&reportQa.i[0][2]==='Nº factura'&&reportQa.i[0][4]==='Identificación del Cliente','Cabecera de ingresos no coincide con gestoría');
assert(reportQa.i.at(-1)[5]==='TOTAL ACUMULADO','Falta total acumulado en ingresos');
assert(reportQa.i.slice(1,-1).every(r=>/^\d{2}\/\d{2}\/\d{4}$/.test(String(r[1]))),'Fechas de ingresos no están en DD/MM/AAAA');
const h1ExpenseRows=reportQa.g.slice(1,-1).filter(r=>{const p=String(r[1]||'').split('/');const iso=p.length===3?p[2]+'-'+p[1]+'-'+p[0]:'';return iso>='2026-01-01'&&iso<='2026-06-30'});
const h1Imputable=h1ExpenseRows.reduce((a,r)=>a+Number(r[14]||0),0);
assert(Math.abs(h1Imputable-139678.04)<0.01,'El detalle GASTOS no respeta el Imputable IRPF original de gestoría · '+h1Imputable);
assert(reportQa.r[1][0]==='Periodo'&&reportQa.r[1][1]==='2026-04-01 → 2026-06-30','El resumen del libro completo no conserva el periodo solicitado');
assert(!reportQa.r.some(r=>String(r[0]).includes('Modelo 130')),'El resumen por fechas mezcla indebidamente el trimestre fiscal global');

await page.getByRole('button',{name:'Informes',exact:true}).click();await heading('Informes');await auditCurrentUi('Informes');
assert(await page.getByRole('heading',{name:'Libros con estructura contable',exact:true}).count()===1,'Informes no separa claramente las exportaciones de gestoría');
assert(await page.getByRole('heading',{name:'Libros de trabajo',exact:true}).count()===1,'Informes no separa los libros internos');
assert(await page.getByRole('heading',{name:'Archivo y fiscalidad',exact:true}).count()===1,'Informes no separa documentación y fiscalidad');
assert(await page.getByLabel('Informe desde').count()===1&&await page.getByLabel('Informe hasta').count()===1,'Informes no identifica claramente el periodo');
const xlsxButtons=page.getByRole('button',{name:'Descargar XLSX'});

let downloadPromise=page.waitForEvent('download');await xlsxButtons.nth(0).click();const expensesXlsx=await downloadPromise;
assert((await expensesXlsx.suggestedFilename()).endsWith('.xlsx'),'Informe de gastos XLSX no generado');
const expensesWb=XLSXNode.readFile(await expensesXlsx.path(),{cellStyles:true});
assert(expensesWb.SheetNames.includes('GASTOS')&&expensesWb.SheetNames.includes('DESGLOSE CONCEPTOS'),'Libro de gastos no contiene sus hojas esperadas');
const expensesRows=XLSXNode.utils.sheet_to_json(expensesWb.Sheets.GASTOS,{header:1,raw:false});
assert(expensesRows[0].length===20&&expensesRows[0][5]==='NIF/CIF'&&expensesRows[0][6]==='Razón social'&&expensesRows[0][7]==='Concepto'&&expensesRows[0][18]==='Total factura'&&expensesRows[0][19]==='Neto pagado'&&expensesRows.at(-1)[7]==='TOTAL ACUMULADO','Contenido/orden del XLSX de gastos incorrecto');
assert(expensesWb.Sheets.GASTOS.A1.s&&expensesWb.Sheets.GASTOS.T1.s,'El XLSX de gastos no conserva estilo completo de cabecera');
assert(fillRgb(expensesWb.Sheets.GASTOS.A1)==='4472C4','La cabecera GASTOS no conserva el azul de referencia · estilo='+JSON.stringify(expensesWb.Sheets.GASTOS.A1.s||null));
assert(expensesWb.Sheets.GASTOS['I'+expensesRows.length].f,'El total de Base IVA no es una fórmula real de Excel');
assert(expensesWb.Sheets.GASTOS['S'+expensesRows.length].f&&expensesWb.Sheets.GASTOS['T'+expensesRows.length].f,'Los totales de factura/neto no son fórmulas reales de Excel');
const conceptRows=XLSXNode.utils.sheet_to_json(expensesWb.Sheets['DESGLOSE CONCEPTOS'],{header:1,raw:false});
assert(conceptRows[0][0]==='Código'&&conceptRows.some(r=>String(r[0])==='600'),'Desglose sin códigos contables');
assert(expensesWb.Sheets['DESGLOSE CONCEPTOS']['A1'].s,'Desglose de conceptos sin formato');

downloadPromise=page.waitForEvent('download');await xlsxButtons.nth(1).click();const incomeXlsx=await downloadPromise;
const incomeWb=XLSXNode.readFile(await incomeXlsx.path(),{cellStyles:true});
assert(incomeWb.SheetNames.join('|')==='INGRESOS','Libro de ingresos debe tener una hoja INGRESOS');
const incomeRows=XLSXNode.utils.sheet_to_json(incomeWb.Sheets.INGRESOS,{header:1,raw:false});
assert(incomeRows[0][0]==='Orden'&&incomeRows[0][5]==='Concepto'&&incomeRows.at(-1)[5]==='TOTAL ACUMULADO','Contenido del XLSX de ingresos incorrecto');
assert(incomeWb.Sheets.INGRESOS.A1.s,'El XLSX de ingresos no conserva estilo de cabecera');
assert(fillRgb(incomeWb.Sheets.INGRESOS.A1)==='4472C4','La cabecera INGRESOS no conserva el azul de referencia');
assert(incomeWb.Sheets.INGRESOS['G'+incomeRows.length].f,'El total de ingresos no es una fórmula real de Excel');

for(const idx of [2,3]){
 downloadPromise=page.waitForEvent('download');await xlsxButtons.nth(idx).click();const daily=await downloadPromise;
 const dailyPath=await daily.path(),wb=XLSXNode.readFile(dailyPath,{cellStyles:true});
 assert(wb.SheetNames.length===12,'El diario no contiene 12 hojas mensuales');
 const firstSheet=wb.Sheets[wb.SheetNames[0]],firstRows=XLSXNode.utils.sheet_to_json(firstSheet,{header:1,raw:false});
 assert(/^ENERO 2026$/.test(String(firstRows[0]?.[0]||'')),'El diario no conserva el título mensual de referencia · hoja='+wb.SheetNames[0]+' · fila0='+JSON.stringify(firstRows[0]||null)+' · A1='+JSON.stringify(firstSheet.A1||null));
 assert(firstRows[1].slice(0,5).join('|')==='Dia|Gastos|Precio|Tarjeta|Salida de caja','Cabecera del diario no coincide con el formato esperado');
 assert(firstRows.at(-1)[1]==='TOTAL','El diario no termina con fila TOTAL');
 const totalRow=firstRows.length;assert(firstSheet['C'+totalRow].f&&firstSheet['D'+totalRow].f&&firstSheet['E'+totalRow].f,'Los totales mensuales del diario no son fórmulas reales');
 const titleXmlStyle=await xlsxXmlStyle(dailyPath,1,'A1');
 assert(fillRgb(firstSheet.A1)==='000000'&&titleXmlStyle.hasYellowFont,'El título mensual no conserva negro/amarillo del Excel original · cell='+JSON.stringify(firstSheet.A1?.s||null)+' · xml='+JSON.stringify(titleXmlStyle));
 assert(fillRgb(firstSheet.A2)==='4F81BD','La cabecera diaria no conserva el azul del Excel original');
 const summaryLabels=firstRows.slice(-6).map(r=>r[1]);
 assert(summaryLabels.join('|')==='Otros|SS y nóminas|Pedidos|Gastos fijos|IRPF|TOTAL','Falta el resumen por colores/categorías del diario');
}

downloadPromise=page.waitForEvent('download');await xlsxButtons.nth(4).click();const fullXlsx=await downloadPromise;
const fullWb=XLSXNode.readFile(await fullXlsx.path(),{cellStyles:true});
for(const name of ['Resumen','Cierres','Gastos','Desglose conceptos','Facturas'])assert(fullWb.SheetNames.includes(name),'Libro completo no contiene hoja '+name);
for(const name of ['Resumen','Cierres','Gastos','Facturas'])assert(fullWb.Sheets[name]?.A1?.s,'Libro completo deja sin formato la hoja '+name);
const fullSummary=XLSXNode.utils.sheet_to_json(fullWb.Sheets.Resumen,{header:1,raw:false});
assert(fullSummary.some(r=>r[0]==='Periodo'&&String(r[1]).includes('2026-01-01')&&String(r[1]).includes('2026-12-31')),'Libro completo · Resumen no refleja el periodo exportado');
assert(fullSummary.some(r=>r[0]==='Gastos solo control interno'),'Libro completo · Resumen no separa gastos internos');
const closingRows=XLSXNode.utils.sheet_to_json(fullWb.Sheets.Cierres,{header:1,raw:false});
for(const col of ['Entrada extra a caja','Salida extra de caja','Total control','Diferencia','Estado'])assert(closingRows[0].includes(col),'Libro completo · Cierres no incluye '+col);
const fullExpenseRows=XLSXNode.utils.sheet_to_json(fullWb.Sheets.Gastos,{header:1,raw:false});
assert(fullWb.Sheets.Gastos['S'+fullExpenseRows.length]?.f&&fullWb.Sheets.Gastos['T'+fullExpenseRows.length]?.f,'Libro completo pierde fórmulas de total en Gastos');

downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar PDF'}).click();const fiscalPdf=await downloadPromise;
const pdfBytes=await fs.readFile(await fiscalPdf.path());
assert(pdfBytes.subarray(0,4).toString()==='%PDF'&&pdfBytes.length>800,'Informe fiscal PDF inválido o vacío');

await page.getByRole('button',{name:/^T2 2026$/}).click();
await page.waitForTimeout(80);
assert(await page.getByLabel('Informe desde').inputValue()==='2026-04-01'&&await page.getByLabel('Informe hasta').inputValue()==='2026-06-30','El acceso rápido trimestral no ajusta el periodo');
downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Preparar paquete'}).click();const pack=await downloadPromise;
assert((await pack.suggestedFilename()).endsWith('.zip'),'Paquete gestor ZIP no generado');
const zip=await JSZipNode.loadAsync(await fs.readFile(await pack.path()));
const zipNames=Object.keys(zip.files);
for(const folder of ['01_INGRESOS','02_GASTOS','03_DIARIOS','04_RESUMEN','05_DOCUMENTOS'])assert(zipNames.some(n=>n.includes('/'+folder+'/')),'Paquete gestor sin carpeta '+folder);
assert(zipNames.some(n=>n.endsWith('/00_LEEME.txt')),'Paquete gestor sin LEEME');
const diaryNames=zipNames.filter(n=>/\/03_DIARIOS\/.*\.xlsx$/.test(n));
assert(diaryNames.length===2,'Paquete T2 debe contener un diario acotado por cada tienda, no libros anuales completos · '+JSON.stringify(diaryNames));
assert(diaryNames.every(n=>n.includes('2026-04-01_2026-06-30')),'Los diarios del paquete no están nombrados con el periodo seleccionado');
const packedDiary=await zip.file(diaryNames[0]).async('nodebuffer');
const packedDiaryWb=XLSXNode.read(packedDiary,{type:'buffer',cellStyles:true});
assert(packedDiaryWb.SheetNames.length===3&&packedDiaryWb.SheetNames.join('|')==='Abril|Mayo|Junio','El paquete T2 incluye meses fuera del periodo: '+packedDiaryWb.SheetNames.join('|'));

// Administración: configuración, Log y Backup separados.
await page.getByRole('button',{name:'Administración',exact:true}).click();await heading('Usuarios');await auditCurrentUi('Administración');
assert(await page.getByText('QA Admin',{exact:true}).count()>=1,'Usuarios no muestra el miembro actual');
await page.getByRole('button',{name:'Editar',exact:true}).first().click();
await page.getByText('Ficha de empleado',{exact:true}).waitFor();
await auditCurrentUi('Administración · ficha usuario');
await field('Puesto / cargo').fill('Administrador QA');
await page.getByRole('button',{name:'Guardar cambios',exact:true}).click();
await page.waitForTimeout(120);
assert(fixtures.team_members[0].job_title==='Administrador QA','Usuarios no guardó la ficha laboral');
await page.getByRole('button',{name:'Nuevo usuario',exact:true}).click();
await page.getByRole('heading',{name:'Nuevo usuario',exact:true}).waitFor();
await field('Nombre completo').fill('Usuario Nuevo QA');
await field('Email').fill('nuevo@qa.test');
const teamBeforeInvalid=fixtures.team_members.length;
await page.getByRole('button',{name:'Crear usuario',exact:true}).click();
await page.waitForTimeout(40);
assert(fixtures.team_members.length===teamBeforeInvalid,'Usuarios creó una cuenta sin contraseña válida');
assert(dialogs.some(x=>/contraseña de al menos 8/i.test(x)),'Usuarios no valida la contraseña mínima');
await field('Contraseña temporal').fill('QaSegura2026!');
await page.getByRole('button',{name:'Crear usuario',exact:true}).click();
await page.waitForTimeout(140);
assert(fixtures.team_members.some(x=>x.email==='nuevo@qa.test'&&x.full_name==='Usuario Nuevo QA'),'Usuarios no creó una cuenta válida');
assert(fixtures.team_members.some(x=>x.email==='nuevo@qa.test'&&x.active===true),'El usuario nuevo no quedó activo');
await page.getByRole('button',{name:'Cerrar',exact:true}).first().click();
await page.getByRole('button',{name:'Configuración',exact:true}).click();await heading('Configuración');await auditCurrentUi('Configuración');
await page.getByRole('heading',{name:'Configuración general',exact:true}).waitFor();
await page.getByRole('heading',{name:'Identidad fiscal y contacto',exact:true}).waitFor();
await page.getByRole('heading',{name:'Criterios de cálculo',exact:true}).waitFor();
await page.getByRole('heading',{name:'Referencias de cotización',exact:true}).waitFor();
await page.getByRole('heading',{name:'Almacenamiento documental',exact:true}).waitFor();
assert(await page.locator('#ops_tpl_logo').count()===0,'Configuración vuelve a duplicar la subida de logo');
assert(await page.getByText('Logo corporativo',{exact:true}).count()===0,'Configuración vuelve a duplicar la carga de logo');
assert(await page.getByRole('button',{name:'Abrir diseño de facturas',exact:true}).count()===1,'Configuración no dirige la marca a Facturación');
await field('Margen operativo objetivo %').fill('18');
await page.getByRole('button',{name:'Guardar configuración',exact:true}).first().click();
await page.waitForTimeout(100);
assert(Number(fixtures.ops_business_settings[0].target_operating_margin_pct)===18,'No se guardó margen objetivo');

await page.getByRole('button',{name:'Log',exact:true}).click();await heading('Log');await auditCurrentUi('Log');
await page.getByText('Log general',{exact:true}).waitFor();

await page.getByRole('button',{name:'Backup',exact:true}).click();await heading('Backup');await auditCurrentUi('Backup');
await page.getByText('Backup completo',{exact:true}).waitFor();
let backupDl=page.waitForEvent('download');
await page.getByRole('button',{name:'Crear y descargar copia',exact:true}).click();
const backupFile=await backupDl;
assert((await backupFile.suggestedFilename()).endsWith('.totusbackup'),'Backup no descarga .totusbackup');
await page.waitForTimeout(180);
assert(fixtures.ops_backup_archives.length===1,'Backup no registró histórico');
await page.getByLabel('Archivo de copia .totusbackup').setInputFiles(await backupFile.path());
await page.getByRole('button',{name:'Validar',exact:true}).click();
await page.getByRole('dialog').getByText('Estructura completa y restaurable',{exact:false}).waitFor();
await page.getByRole('dialog').getByRole('button',{name:'Cerrar',exact:true}).click();
await page.getByRole('dialog').waitFor({state:'detached'});
await page.getByRole('button',{name:'Restaurar',exact:true}).click();
await page.getByRole('dialog').getByLabel('Motivo obligatorio').fill('QA restauración completa');
await page.getByRole('dialog').getByRole('button',{name:'Restaurar',exact:true}).click();
await page.waitForTimeout(250);
assert(dialogs.every(x=>!/No se pudo restaurar/i.test(x)),'Restauración de backup falló en QA');
await page.getByRole('dialog').getByRole('button',{name:'Cerrar',exact:true}).click();
await page.getByRole('dialog').waitFor({state:'detached'});

// Eliminar gasto manual: doble confirmación y cascada de líneas.
await page.getByRole('button',{name:'Gastos',exact:true}).click();await heading('Gastos');
await page.evaluate(()=>opsNewExpense());
await page.locator('input[placeholder="Nombre del proveedor"]').fill('Gasto eliminable QA');
await field('Nº factura proveedor').fill('QA-DELETE-001');
await field('Base').fill('12');
await page.getByRole('button',{name:'Guardar gasto',exact:true}).click();
await page.waitForTimeout(180);
const disposable=fixtures.ops_expenses.find(x=>x.supplier_name==='Gasto eliminable QA');
assert(disposable&&fixtures.ops_expense_lines.some(x=>x.expense_id===disposable.id),'No se creó gasto temporal para probar borrado');
const disposableRow=page.locator('tr').filter({hasText:'Gasto eliminable QA'}).first();
await disposableRow.getByRole('button',{name:'Eliminar',exact:true}).click();
await page.getByRole('dialog').getByLabel('Motivo obligatorio').fill('QA borrado gasto');
await page.getByRole('dialog').getByRole('button',{name:'Eliminar definitivamente'}).click();
await page.waitForTimeout(180);
assert(!fixtures.ops_expenses.some(x=>x.id===disposable.id),'Eliminar gasto no borró la cabecera');
assert(!fixtures.ops_expense_lines.some(x=>x.expense_id===disposable.id),'Eliminar gasto manual no borró las líneas');

// Encargado: facturación debe quedar estrictamente en modo consulta.
fixtures.team_members[0].role='encargado';
fixtures.profiles[0].role='encargado';
await page.reload({waitUntil:'networkidle'});
await heading('Totus Central');
await page.getByRole('button',{name:'Facturación',exact:true}).click();await heading('Facturación');
await page.getByText('Modo consulta:',{exact:false}).waitFor();
assert(await page.getByRole('button',{name:'Guardar borrador',exact:true}).count()===0,'El encargado no debe poder guardar facturas');
assert(await page.getByRole('button',{name:'+ Nuevo',exact:true}).count()===0,'El encargado no debe poder crear facturas');
assert(await page.getByRole('button',{name:'Facturas',exact:true}).count()===1,'El encargado debe poder consultar facturas');
assert(await page.getByRole('button',{name:'Proformas',exact:true}).count()===1,'El encargado debe poder consultar proformas');
await page.getByRole('button',{name:'Cajas',exact:true}).click();await heading('Cajas');assert(await page.getByRole('button',{name:'Cerrar día',exact:true}).count()===1,'El encargado debe poder cerrar caja');
await page.getByRole('button',{name:'Gastos',exact:true}).click();await heading('Gastos');assert(await page.getByRole('button',{name:'Guardar gasto',exact:true}).count()===1,'El encargado debe poder registrar gastos');

// Pasada visual: restaurar Admin y capturar cada módulo en escritorio y móvil.
fixtures.team_members[0].role='admin';
fixtures.profiles[0].role='admin';
await page.reload({waitUntil:'networkidle'});
await fs.mkdir('qa-screenshots',{recursive:true});
const visualModules=[
  ['inicio',null,'Totus Central'],
  ['pricing','Pricing','Precio rápido'],
  ['cajas','Cajas','Cajas'],
  ['gastos','Gastos','Gastos'],
  ['facturacion','Facturación','Facturación'],
  ['documentos','Documentos','Documentos'],
  ['fiscalidad','Fiscalidad','Fiscalidad'],
  ['informes','Informes','Informes'],
  ['administracion','Administración','Usuarios']
];
await page.setViewportSize({width:1440,height:1000});
await page.locator('.app-home-logo').click();await heading('Totus Central');
for(const [slug,button,head] of visualModules){
  if(button)await page.locator('.app-nav').getByRole('button',{name:button,exact:true}).click();
  await heading(head);await page.waitForTimeout(80);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  assert(overflow<=8,slug+' provoca desbordamiento global escritorio: '+overflow+'px');
  await page.screenshot({path:'qa-screenshots/desktop-'+slug+'.png',fullPage:true});
}

// Responsive: revisar y capturar los mismos módulos, no solo Inicio.
await page.setViewportSize({width:390,height:844});
await page.locator('.app-home-logo').click();await heading('Totus Central');
for(const [slug,button,head] of visualModules){
  if(button)await page.locator('.app-nav').getByRole('button',{name:button,exact:true}).click();
  await heading(head);await page.waitForTimeout(60);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  assert(overflow<=8,slug+' provoca desbordamiento global móvil: '+overflow+'px');
  await page.screenshot({path:'qa-screenshots/mobile-'+slug+'.png',fullPage:true});
}

// No unexpected JS dialogs/errors should have fired during non-destructive smoke.
assert(!dialogs.some(x=>/no se pudo|error/i.test(x)),'Se detectó diálogo de error: '+dialogs.join(' | '));
assert(pageErrors.length===0,'Errores JavaScript en navegador: '+pageErrors.join('\n---\n'));

console.log(JSON.stringify({ok:true,modules:['Pricing','Cajas','Gastos','Facturación','Documentos','Fiscalidad','Informes','Administración'],dialogs,pageErrors},null,2));
await browser.close();
