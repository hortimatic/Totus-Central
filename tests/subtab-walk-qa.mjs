import {chromium} from 'playwright';
import {clickModuleLink} from './ui-navigation.mjs';
import fs from 'node:fs';
fs.mkdirSync('artifacts/mobile-audit',{recursive:true});
const routes=[
 {route:'inicio',sections:[null]},
 {route:'pricing',sections:[null]},
 {route:'cajas',sections:[null]},
 {route:'gastos',action:'expense-section',sections:['registros','facturas','proveedores']},
 {route:'facturacion',action:'billing-section',sections:['documentos','clientes','plantillas','series']},
 {route:'documentos',sections:[null]},
 {route:'cotejos',sections:[null]},
 {route:'tareas',sections:[null]},
 {route:'equipo',sections:[null]},
 {route:'configuracion',attribute:'data-config-section',sections:['appearance','connections']},
 {route:'fiscalidad',sections:[null]},
 {route:'informes',sections:[null]},
 {route:'administracion',action:'admin-section',sections:['usuarios','roles','negocio','fiscal','storage','backups','log']}
];
const browser=await chromium.launch({headless:true}),errors=[],views=[],names=[];
for(const [size,width] of [['wide',1640],['desktop',1180],['mobile',390],['narrow',320]]){
 const page=await browser.newPage({viewport:{width,height:900},locale:'es-ES'});
 page.on('pageerror',e=>errors.push(size+' JavaScript: '+e.message));
 await page.route('**/tests/mock-supabase.js',route=>route.fulfill({contentType:'text/javascript',body:fs.readFileSync('tests/mock-supabase.js','utf8').replace('window.__mockDb=db;',"window.__mockDb=db;\nconst visualDay=new Date().toISOString().slice(0,10),visualStore=db.ops_stores[0].id;\ndb.products.push({id:'visual-product',name:'Producto de ensayo con nombre largo y variantes de nicotina',reference:'REF-VISUAL-2026',type:'simple',active:true});\nfor(const [i,internal] of [false,true].entries())db.ops_expenses.push({id:'visual-expense-'+i,store_id:visualStore,expense_date:visualDay,supplier_name:'Proveedor ficticio de ensayo visual',description:'Descripción extensa de una factura de ensayo para comprobar su lectura en móvil',invoice_number:'QA-VISUAL-'+i,base_amount:1000,vat_amount:210,re_amount:52,irpf_amount:0,gross_expense:1262,accounting_amount:1262,amount_paid:1262,management_only:internal,fiscal_reviewed:!internal,paid_status:'pagado',document_id:'visual-doc'});\ndb.ops_documents.push({id:'visual-doc',original_name:'Justificante ficticio con nombre extenso para comprobar diseño.pdf',document_date:visualDay,store_id:visualStore,mime_type:'application/pdf',size_bytes:123456,status:'reviewed'});\ndb.ops_sales_invoices.push({id:'visual-invoice',store_id:visualStore,document_type:'factura',status:'emitida',issue_date:visualDay,total_amount:1210,base_amount:1000,vat_amount:210,invoice_number:'QA-2026-0001',customer_name:'Cliente ficticio de ensayo visual'});\ndb.ops_daily_closings.push({id:'visual-closing',store_id:visualStore,business_date:visualDay,status:'cerrado',card_sales:2450,cash_sales:1140.5,cash_withdrawals:1140.5,bizum_sales:0,online_sales:0,other_income:0,opening_cash:250,actual_cash:250,reported_total_sales:3590.5,difference:0,notes:'Cierre ficticio de ensayo visual'});\nfor(const [i,d] of db.ops_cash_drawers.filter(d=>d.store_id===visualStore).entries())db.ops_daily_closing_drawers.push({id:crypto.randomUUID(),closing_id:'visual-closing',drawer_id:d.id,opening_cash:i?100:150,closing_cash:i?100:150,card_sales:i?800:1650,cash_withdrawals:i?290.5:850,cash_expenses_declared:0,cash_extra_in:0,cash_extra_out:0});\n").replace('const rpc=async (name,args={})=>{','const rpc=async (name,args={})=>{'+" if(name==='totus_tasks_context')return {data:{rows:[],archived_tasks:[],stores:[],people:[]},error:null};\n if(['totus_chat_context','totus_chat_personalized_context','totus_chat_notification_context'].includes(name))return {data:{channels:[{id:'visual',name:'Canal de ensayo visual',group_name:'Pruebas',member_role:'manager',last_read_seq:10}],messages:[{id:'visual-message',seq:1,channel_id:'visual',author_email:'qa@example.com',body:'Mensaje ficticio para comprobar la lectura.',created_at:new Date().toISOString()}],members:[{email:'qa@example.com',member_role:'manager'}],directory:[],layout:{}},error:null};\n if(name==='totus_chat_command')return {data:{},error:null};")}));
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 for(const mod of routes){
  const nav=page.locator('#nav [data-route="'+mod.route+'"]');
  if(await nav.count()!==1){errors.push(size+': missing '+mod.route+' main navigation');continue}
  await clickModuleLink(page,nav);
  for(const section of mod.sections){
   const key=size+'/'+mod.route+(section?'/'+section:'');
   if(section){
    const selector=mod.attribute?'#content ['+mod.attribute+'="'+section+'"]':'#content [data-action="'+mod.action+'"][data-section="'+section+'"]';const tab=page.locator(selector).first();
    if(!await tab.count()){errors.push(key+': missing subtab');continue}
    await tab.click();
    if(!await page.locator(selector+'.active').count())
      errors.push(key+': subtab not active after clicking');
   }
   if(mod.route==='administracion'&&section==='storage'&&await page.locator('details.storage-technical').count())await page.locator('details.storage-technical > summary').click();
   if(mod.route==='configuracion'&&section==='appearance'){for(const tab of await page.locator('[data-appearance-tab]').all()){await tab.click();await page.screenshot({path:'artifacts/mobile-audit/config-'+size+'-'+await tab.getAttribute('data-appearance-tab')+'.png',fullPage:true});}}
   if(mod.route==='equipo'){await page.locator('[data-chat=open][data-id=visual]').click();await page.locator('#chatBody').waitFor();}
   if(mod.route==='cotejos'){for(const action of ['stock-new','stock-library']){await page.locator('[data-action="'+action+'"]').click();await page.screenshot({path:'artifacts/mobile-audit/recepcion-'+size+'-'+action+'.png',fullPage:true});await page.locator('[data-action=stock-back]').click();}}
   if(width<=480&&mod.route==='administracion'&&section==='backups'){const height=await page.locator('#backupSelectedFile').evaluate(e=>e.getBoundingClientRect().height);if(height>60)errors.push(key+': file selection placeholder reserves '+height+'px of empty height');}
   const info=await page.evaluate(()=>{
    const root=document.querySelector('#content'),rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
    const visible=el=>{const x=getComputedStyle(el),b=el.getBoundingClientRect();return x.display!=='none'&&x.visibility!=='hidden'&&b.width>0&&b.height>0};
    const emptyButtons=[...root.querySelectorAll('button')].filter(visible).filter(el=>!el.dataset.action&&el.type!=='submit'&&!el.closest('#teamChatRoot,#tasksRoot,#appearanceRoot,#connectionsRoot,[data-config-section]')).map(el=>el.outerHTML.slice(0,180));
    const badControls=[],overlaps=[];
    for(const el of root.querySelectorAll('input,select,textarea')){
     if(!visible(el)||el.type==='hidden'||el.type==='file')continue;
     const box=rect(el),ancestor=el.closest('.field,label');
     if(!ancestor)continue;
     const parent=rect(ancestor);
     if(box.x<parent.x-6||box.right>parent.right+6)badControls.push({name:el.id||el.name,box,parent});
    }
    for(const head of root.querySelectorAll('.section-head')){
     const title=head.querySelector('h2,h3'),buttons=[...head.querySelectorAll('.btn')].filter(visible);
     if(!title||!visible(title))continue;
     const a=rect(title);
     for(const button of buttons){const b=rect(button);
      if(Math.min(a.right,b.right)-Math.max(a.x,b.x)>3&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>3)
       overlaps.push({title:title.textContent.slice(0,55),action:button.textContent.slice(0,45),titleBox:a,buttonBox:b});
     }
    }
    const heading=[...root.querySelectorAll('.section-head h2,.section-head h3')].filter(visible).length;
    const blankPanels=[...root.querySelectorAll('.card')].filter(visible).filter(el=>el.getBoundingClientRect().height>380&&(el.innerText||'').trim().length<15).map(el=>({class:el.className,height:Math.round(el.getBoundingClientRect().height)}));
    return {buttons:root.querySelectorAll('button').length,fields:root.querySelectorAll('input,select,textarea').length,emptyButtons,badControls,overlaps,blankPanels,heading,
     scrollWidth:document.documentElement.scrollWidth,innerWidth,htmlChars:(root.innerText||'').trim().length};
   });
   if(info.htmlChars<30)errors.push(key+': empty module');
   if(info.scrollWidth>width+3)errors.push(key+': unexpected whole-page horizontal scroll '+info.scrollWidth+'>'+width);
   if(info.emptyButtons.length)errors.push(key+': inert buttons '+JSON.stringify(info.emptyButtons.slice(0,2)));
   if(info.badControls.length)errors.push(key+': fields protrude from parents '+JSON.stringify(info.badControls.slice(0,2)));
   if(info.overlaps.length)errors.push(key+': header buttons overlap text '+JSON.stringify(info.overlaps.slice(0,2)));
   if(info.blankPanels.length)errors.push(key+': blank oversized card '+JSON.stringify(info.blankPanels.slice(0,2)));
   views.push({key,...info});
   names.push(key);
   if(size==='wide'||size==='narrow')
    await page.screenshot({path:'artifacts/mobile-audit/layout_walk_'+size+'_'+mod.route+'_'+section+'.png',fullPage:true});
  }
 }
 await page.close();
}
await browser.close();
fs.writeFileSync('artifacts/subtab-walk.json',JSON.stringify({screens:names,views,errors},null,2));
console.log('SUBTAB WALK QA: '+views.length+' actual-click states; all module pages and administrative/billing/expense subtab panels at 1640,1180,390,320; '+errors.length+' failures');
if(errors.length){console.error(errors.slice(0,32).join('\n'));process.exit(1)}
