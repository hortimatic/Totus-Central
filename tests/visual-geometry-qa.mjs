import {chromium} from 'playwright';
import fs from 'node:fs';
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true});
const failures=[],results=[];
const screens=[
 ['gastos','?route=gastos'],['gastos-facturas','?route=gastos&section=facturas'],
 ['facturacion','?route=facturacion'],['facturacion-series','?route=facturacion&section=series'],
 ['facturacion-plantillas','?route=facturacion&section=plantillas'],
 ['documentos','?route=documentos'],['cajas','?route=cajas'],
 ['admin-users','?route=administracion&section=usuarios'],
 ['admin-log','?route=administracion&section=log'],
 ['admin-roles','?route=administracion&section=roles'],
 ['admin-backups','?route=administracion&section=backups'],
 ['factura-form','?route=facturacion&mode=record&id=new&type=factura&kind=invoice&origin=totus'],
 ['gastos-form','?route=gastos&mode=record&id=new']
];
for(const [size,viewport] of [['desktop',{width:1440,height:960}],['tablet',{width:768,height:1024}],['mobile',{width:390,height:844}],['small-mobile',{width:320,height:740}]]){
 const page=await browser.newPage({viewport,locale:'es-ES'});
 for(const [name,query] of screens){
  await page.goto('http://127.0.0.1:4173/tests/ui-harness.html'+query,{waitUntil:'networkidle'});
  const report=await page.evaluate(()=>{
   const bbox=e=>{const b=e.getBoundingClientRect();return {x:b.left,y:b.top,width:b.width,height:b.height,right:b.right,bottom:b.bottom}};
   const viewWidth=window.innerWidth,bodyWidth=document.documentElement.scrollWidth,root=document.querySelector('#root');
   const cards=[...root.querySelectorAll('.card.table-card')].map(el=>{
    const card=bbox(el),container=bbox(el.closest('.page')||el.parentElement);
    return {card,container,name:el.querySelector('h2')?.textContent||'Tabla'};
   });
   const roles=[...root.querySelectorAll('.role-card-grid .role-card')].map(bbox);
   const badFields=[];
   for(const control of root.querySelectorAll('.form-grid input:not([type="file"]),.form-grid select,.form-grid textarea,.field input,.field select,.field textarea')){
    const style=getComputedStyle(control),box=bbox(control),parent=control.closest('label,.field');
    if(style.display==='none'||!parent||box.width<1||box.height<1)continue;
    const p=bbox(parent);
    if(box.x<p.x-4||box.right>p.right+4)badFields.push({id:control.id||control.name,box,parent:p});
   }
   const record=root.querySelector('.record-layout');
   let overlap=null;
   if(record&&window.innerWidth>1100){
    const main=record.querySelector('.record-main'),side=record.querySelector('.record-side');
    if(main&&side){const a=bbox(main),b=bbox(side);overlap=a.right>b.x-4?{main:a,side:b}:null}
   }
   return {viewWidth,bodyWidth,cards,roles,badFields,overlap};
  });
  const key=size+'/'+name;
  if(report.bodyWidth>report.viewWidth+3)failures.push(key+': page horizontal overflow '+report.bodyWidth+'>'+report.viewWidth);
  if(viewport.width<=800)for(const {name:nameCard,card,container} of report.cards){
   if(Math.abs(card.x-container.x)>5||Math.abs(card.right-container.right)>5)
    failures.push(key+': tarjeta '+nameCard+' desalineada con su columna: '+JSON.stringify({card,container}));
  }
  if(name==='admin-roles'){
   const fixed=await page.locator('.role-card-grid .role-fixed-access').allTextContents();
   if(fixed.length!==1||!fixed[0].includes('Acceso completo'))failures.push(key+': administrador sin nota de permisos permanentes');
  }
  if(name==='admin-roles'&&viewport.width>1100&&report.roles.length>=3){
   const heights=report.roles.map(x=>x.height),spread=Math.max(...heights)-Math.min(...heights);
   if(spread>3)failures.push(key+': tarjetas de roles con alturas diferentes: '+heights.join(','));
  }
  if(report.badFields.length)failures.push(key+': campos salen de sus etiquetas: '+JSON.stringify(report.badFields.slice(0,4)));
  if(report.overlap)failures.push(key+': resumen lateral superpuesto al formulario principal '+JSON.stringify(report.overlap));
  results.push({screen:key,tableCards:report.cards.length,roleCards:report.roles.length,bodyWidth:report.bodyWidth});
 }
 await page.close();
}
// Reproduce dense, imported two-drawer closings rather than an empty list.
for(const width of [1901,1280,881,390]){
 const page=await browser.newPage({viewport:{width,height:960}});
 await page.goto('http://127.0.0.1:4173/tests/ui-harness.html?route=cajas',{waitUntil:'networkidle'});
 await page.evaluate(async()=>{
  const {state,patchFilters,setView}=await import('/src/state.js');const {cajas}=await import('/src/pages/main.js');
  state.data.stores=[{id:'shop',name:'Tienda con dos cajas',active:true}];
  state.data.closings=Array.from({length:50},(_,i)=>({id:'source-'+i,store_id:'shop',business_date:'2026-01-02',entry_mode:'source_snapshot',status:'borrador',include_in_income:false,card_sales:432.45,opening_cash:436.03,actual_cash:281.13,cash_withdrawals:150,reported_total_sales:1108.16,source_ref:JSON.stringify({kind:'closing_source_snapshot',card_sales:432.45,withdrawals:150,drawers:[{name:'Vape'},{name:'Head'}]})}));
  patchFilters('cajas',{from:'2026-01-01',to:'2026-01-31',store:'all',query:''});setView('cajas',{mode:'list'});document.querySelector('#root').innerHTML=cajas();
 });
 const overflow=await page.locator('.data-table td').evaluateAll(cells=>cells.flatMap(cell=>{
  const box=cell.getBoundingClientRect(),bad=[],walker=document.createTreeWalker(cell,NodeFilter.SHOW_TEXT);let node;
  while((node=walker.nextNode())){if(!node.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(node);for(const r of range.getClientRects())if(r.width&& (r.left<box.left-1||r.right>box.right+1))bad.push(node.textContent)}
  return bad;
 }));
 if(overflow.length)failures.push('source-closings/'+width+': text crosses table cells: '+overflow.slice(0,5).join(', '));
 const splitActions=await page.locator('.section-head .inline-actions .btn').evaluateAll(buttons=>buttons.filter(button=>{const range=document.createRange();range.selectNodeContents(button);return new Set([...range.getClientRects()].filter(r=>r.width).map(r=>Math.round(r.top))).size>1}).map(button=>button.textContent));
 if(splitActions.length)failures.push('source-closings/'+width+': header action labels wrap: '+splitActions.join(', '));
 results.push({screen:'source-closings/'+width,rows:50,textOverflows:overflow.length});await page.close();
}
await browser.close();
fs.writeFileSync('artifacts/visual-geometry.json',JSON.stringify({results,failures},null,2));
console.log('VISUAL GEOMETRY QA: '+results.length+' escenas, 4 anchuras (1440, 768, 390, 320 px), tablas, roles, campos y solapamientos; fallos='+failures.length);
if(failures.length){console.error(failures.slice(0,30).join('\n'));process.exit(1)}
