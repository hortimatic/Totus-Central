// Sandbox mock for browser end-to-end tests. No network or real Totus data.
(()=>{
const uuid=()=>crypto.randomUUID();
const storeA='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const storeB='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const userId='cccccccc-cccc-4ccc-cccc-cccccccccccc';
const session={user:{id:userId,email:'qa@example.com'},access_token:'qa-sandbox'};
const role=new URLSearchParams(location.search).get('role')||'admin';
const db={
 ops_backup_config:[{id:1,enabled:false,frequency:'daily',run_hour:3,run_minute:0,weekday:1,month_day:1,retention_days:10,destination_folder:'automaticas'}],
 ops_backup_runs:[],
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
 ops_document_templates:[{id:uuid(),name:'QA Minimal',code:'MIN',style:'minimal',active:true,default_invoice:true,default_proforma:true,primary_color:'#15243d',secondary_color:'#3b82f6',text_color:'#111827'}]
};
const uploaded=new Map();
for(const table of ['ops_daily_closings','ops_daily_closing_drawers','ops_expenses','ops_expense_lines','ops_sales_invoices','ops_sales_invoice_lines','ops_documents','ops_tax_payments','ops_reta_brackets','ops_fiscal_adjustments','ops_income_adjustments','ops_audit_log','brands','families','products','product_variants','providers','product_provider_prices','product_competitor_prices','consultations','consultation_history','price_history'])db[table]=[];
window.__mockDb=db;
window.__mockUploads=uploaded;
let events=null;
class Query{
 constructor(table){this.table=table;this.mode='select';this.value=null;this.filters=[];this.orderBy=null;this.rangeBy=null;}
 select(){return this}
 insert(v){this.mode='insert';this.value=v;return this}
 update(v){this.mode='update';this.value=v;return this}
 upsert(v,{onConflict}={}){this.mode='upsert';this.value=v;this.conflictKeys=String(onConflict||'id').split(',');return this}
 delete(){this.mode='delete';return this}
 eq(k,v){this.filters.push([k,v,'eq']);return this}
 neq(k,v){this.filters.push([k,v,'neq']);return this}
 is(k,v){this.filters.push([k,v,'is']);return this}
 order(k,{ascending=false}={}){this.orderBy=[k,ascending];return this}
 range(a,b){this.rangeBy=[a,b];return this}
 limit(n){this.rangeBy=[0,n-1];return this}
 result(){
  const target=db[this.table];
  if(!target)return {data:null,error:{message:'Tabla de pruebas no definida: '+this.table}};
  let matches=target.filter(r=>this.filters.every(([k,v,op])=>op==='neq'?r[k]!==v:op==='is'?(v===null?r[k]==null:r[k]===v):r[k]===v));
  if(this.mode==='insert'){
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
  if(this.mode==='update'){for(const r of matches)Object.assign(r,this.value);return {data:matches,error:null}}
  if(this.mode==='delete'){for(const r of matches){const i=target.indexOf(r);if(i>=0)target.splice(i,1)}return {data:matches,error:null}}
  if(this.orderBy){const [key,ascending]=this.orderBy;matches=[...matches].sort((a,b)=>String(a[key]??'').localeCompare(String(b[key]??''))*(ascending?1:-1))}
  if(this.rangeBy)matches=matches.slice(this.rangeBy[0],this.rangeBy[1]+1);
  return {data:matches,error:null};
 }
 async single(){const r=this.result();return {data:Array.isArray(r.data)?r.data[0]||null:r.data,error:r.error}}
 async maybeSingle(){return this.single()}
 then(ok,fail){return Promise.resolve(this.result()).then(ok,fail)}
}
const sum=(rows,cb)=>rows.reduce((v,x)=>v+Number(cb(x)||0),0);
const get=(name,id)=>db[name]?.find(x=>x.id===id);
const insert=(name,row)=>{const r={id:uuid(),created_at:new Date().toISOString(),...row};db[name].push(r);return r};
const rpc=async (name,args={})=>{
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
    usage_percent:Number(((docs+assets)*100/limit).toFixed(2)),available_bytes:Math.max(0,limit-docs-assets),
    sample_count:samples.length,trend_days:day?14:null,daily_growth_bytes:day,
    estimated_days_left:day&&docs+assets<limit?Math.ceil((limit-docs-assets)/day):null
  },error:null};
 }
 if(name==='totus_save_closing'){
  const p=args.p_closing,drawers=args.p_drawers||[];let row=p.id?get('ops_daily_closings',p.id):null;
  if(!row)row=insert('ops_daily_closings',{status:'borrador'});
  Object.assign(row,p,{id:row.id,status:p.status||'borrador',
    cash_sales:sum(drawers,d=>Number(d.closing_cash)-Number(d.opening_cash)+Number(d.cash_withdrawals)+Number(d.cash_expenses_declared)+Number(d.cash_extra_out)-Number(d.cash_extra_in)),
    card_sales:sum(drawers,d=>d.card_sales),bizum_sales:sum(drawers,d=>d.bizum_sales),online_sales:sum(drawers,d=>d.online_sales),other_income:sum(drawers,d=>d.other_income),
    cash_withdrawals:sum(drawers,d=>d.cash_withdrawals),cash_expenses_declared:sum(drawers,d=>d.cash_expenses_declared),
    opening_cash:sum(drawers,d=>d.opening_cash),actual_cash:sum(drawers,d=>d.closing_cash),difference:0,include_in_income:true});
  db.ops_daily_closing_drawers=db.ops_daily_closing_drawers.filter(d=>d.closing_id!==row.id);
  drawers.forEach(d=>insert('ops_daily_closing_drawers',{...d,closing_id:row.id}));
  return {data:row.id,error:null};
 }
 if(name==='totus_save_expense'){
  const p=args.p_expense,lines=args.p_lines||[];let row=p.id?get('ops_expenses',p.id):null;
  if(!row)row=insert('ops_expenses',{});
  const base=sum(lines,l=>l.base_amount),vat=sum(lines,l=>l.base_amount*l.vat_rate/100),re=sum(lines,l=>l.base_amount*l.re_rate/100),wh=sum(lines,l=>l.base_amount*l.withholding_rate/100);
  Object.assign(row,p,{id:row.id,base_amount:base,vat_amount:vat,re_amount:re,withholding_amount:wh,accounting_amount:base+vat+re-wh,gross_expense:base+vat+re-wh});
  db.ops_expense_lines=db.ops_expense_lines.filter(l=>l.expense_id!==row.id);
  lines.forEach(l=>insert('ops_expense_lines',{...l,expense_id:row.id,vat_amount:l.base_amount*l.vat_rate/100,re_amount:l.base_amount*l.re_rate/100,withholding_amount:l.base_amount*l.withholding_rate/100,irpf_imputable:l.base_amount}));
  return {data:row.id,error:null};
 }
 if(name==='totus_save_sales_document'){
  const p=args.p_document,lines=args.p_lines||[];let row=p.id?get('ops_sales_invoices',p.id):null;if(!row)row=insert('ops_sales_invoices',{});
  const base=sum(lines,l=>l.quantity*l.unit_price_base*(1-l.discount_pct/100)),vat=sum(lines,l=>l.quantity*l.unit_price_base*(1-l.discount_pct/100)*l.vat_rate/100);
  Object.assign(row,p,{id:row.id,base_amount:base,vat_amount:vat,total_amount:base+vat,status:'borrador',display_number:''});
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
 remove:async paths=>{paths.forEach(path=>uploaded.delete(bucket+'/'+path));return {data:paths,error:null}},
 list:async (prefix='')=>({data:[...uploaded.keys()].filter(k=>k.startsWith(bucket+'/'+prefix)).map(k=>({id:uuid(),name:k.slice((bucket+'/').length)})),error:null}),
 createSignedUrl:async path=>{const f=uploaded.get(bucket+'/'+path);return {data:{signedUrl:f?URL.createObjectURL(f):''},error:f?null:{message:'No encontrado'}}}
});
const mockCloudBackup=async()=>{
 const mod=await import('../src/backup.js');
 const tables=mod.BACKUP_TABLES;
 const database={};for(const table of tables)database[table]=[...(db[table]||[])];
 const zip=new window.JSZip(),files={'business-documents':[],'business-assets':[]},hashes={'business-documents':{},'business-assets':{}};
 const sha=async x=>{
  const b=typeof x==='string'?new TextEncoder().encode(x):x instanceof Blob?await x.arrayBuffer():x;
  const h=await crypto.subtle.digest('SHA-256',b);
  return [...new Uint8Array(h)].map(z=>z.toString(16).padStart(2,'0')).join('');
 };
 for(const bucket of Object.keys(files)){
  for(const [key,file] of uploaded.entries()){
   if(!key.startsWith(bucket+'/'))continue;
   const path=key.slice(bucket.length+1);files[bucket].push(path);
   const content=file instanceof Blob?file:new Blob([file]);
   zip.file('storage/'+bucket+'/'+path,content);
   hashes[bucket][path]=await sha(content);
  }
 }
 const databaseJson=JSON.stringify(database);
 const manifest={format:'totus-clean-backup',version:2,created_at:new Date().toISOString(),tables,storage:files,integrity:{database:await sha(databaseJson),storage:hashes}};
 zip.file('manifest.json',JSON.stringify(manifest));
 zip.file('database.json',databaseJson);
 const blob=await zip.generateAsync({type:'blob'});
 const id=uuid(),path='automaticas/QA_'+id+'.totusbackup';
 uploaded.set('business-backups/'+path,blob);
 db.ops_backup_runs.unshift({id,mode:'manual',status:'success',started_at:new Date().toISOString(),finished_at:new Date().toISOString(),storage_path:path,size_bytes:blob.size,rows_count:Object.values(database).reduce((n,x)=>n+x.length,0),files_count:Object.values(files).reduce((n,x)=>n+x.length,0)});
 const expiry=Date.now()-Number(db.ops_backup_config[0].retention_days||10)*86400000;
 for(const previous of db.ops_backup_runs){
  if(previous.id===id||previous.status!=='success'||Date.parse(previous.started_at)>=expiry)continue;
  uploaded.delete('business-backups/'+previous.storage_path);
  previous.status='expired';
  previous.storage_path=null;
 }
 return {data:{id,status:'success',size_bytes:blob.size},error:null};
};
const client={
 auth:{getSession:async()=>({data:{session},error:null}),signInWithPassword:async()=>({data:{session},error:null}),signOut:async()=>{events?.('SIGNED_OUT',null);return {error:null}},resetPasswordForEmail:async()=>({data:{},error:null}),onAuthStateChange:fn=>{events=fn;return {data:{subscription:{unsubscribe(){}}}}}},
 from:table=>new Query(table),
 rpc,
 functions:{invoke:async name=>name==='totus-backup-run'?await mockCloudBackup():{data:null,error:{message:'Función no simulada'}}},
 storage:{from:storageBucket}
};
window.supabase={createClient:()=>client};
const originalFetch=window.fetch.bind(window);
window.fetch=async (url,opts)=>{
 if(String(url).includes('/functions/v1/team-admin')){
  const p=JSON.parse(opts?.body||'{}');
  if(p.action==='create_user'){db.team_members.push({id:uuid(),email:p.email,full_name:p.full_name,role:p.role,active:true});return new Response(JSON.stringify({ok:true}),{status:200,headers:{'Content-Type':'application/json'}})}
  if(p.action==='update_member'){const row=db.team_members.find(x=>x.email===p.email);if(row)Object.assign(row,p);return new Response(JSON.stringify({ok:true}),{status:200,headers:{'Content-Type':'application/json'}})}
  if(p.action==='hard_delete'){const ix=db.team_members.findIndex(x=>x.email===p.email);if(ix>=0)db.team_members.splice(ix,1);return new Response(JSON.stringify({ok:true}),{status:200,headers:{'Content-Type':'application/json'}})}
  return new Response(JSON.stringify({ok:true}),{status:200,headers:{'Content-Type':'application/json'}});
 }
 return originalFetch(url,opts);
};
})();