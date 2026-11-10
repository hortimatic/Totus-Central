import assert from 'node:assert/strict';
import {HOME_WIDGET_CATALOG,homeCanvasSettings,createHomeWidget,createHomeDashboard,readHomeDashboard,addHomeWidget,duplicateHomeWidget,setHomeWidgetConfig,removeHomeWidget,reorderHomeWidget,layoutHomeDashboard} from '../src/home-widgets-core.js';
import {nextOpeningSummary} from '../src/home-openings-view.js';
import {verifiedProductMargin} from '../src/home-commercial-margin.js';
let count=0;const test=(name,fn)=>{fn();count++;console.log('PASS',name)};
test('Inventario de widgets y aperturas preparado',()=>assert(Object.keys(HOME_WIDGET_CATALOG).length>=25));
test('Instancias independientes de resumen tienda',()=>{
 const a=createHomeDashboard([{type:'prestashop.summary',id:'h',scope:{store:'hortimatic'}}]);
 const b=duplicateHomeWidget(a,'h','n');const c=setHomeWidgetConfig(b,'n',{scope:{store:'newoldsmok'}});
 assert.equal(c.widgets[0].scope.store,'hortimatic');assert.equal(c.widgets[1].scope.store,'newoldsmok');
});
test('Los estilos generales se guardan, son personales y no aceptan CSS o secretos arbitrarios',()=>{
 const a=createHomeDashboard([{id:'a',type:'home.income'}],{gap:'20',width:'1600',density:'compact',background:'soft',token:'privado'});
 assert.deepEqual(a.settings,{gap:'20',width:'1600',density:'compact',background:'soft'});
 const b=duplicateHomeWidget(a,'a','b');
 assert.deepEqual(b.settings,a.settings);
 assert.deepEqual(readHomeDashboard(b).settings,a.settings);
 const changed=homeCanvasSettings({gap:'999',width:'url(https://untrusted.invalid)',density:'javascript:bad',background:'neon'});
 assert.deepEqual(changed,{gap:'inherit',width:'fluid',density:'inherit',background:'inherit'});
 assert(!JSON.stringify(a).includes('privado'));
});
test('Cada tienda configura gráfica, ranking y columnas sin contaminar a otra',()=>{
 const initial=createHomeDashboard([{id:'h',type:'prestashop.summary'},{id:'n',type:'prestashop.summary'},{id:'table',type:'prestashop.orders'}],{gap:'16'});
 const result=setHomeWidgetConfig(setHomeWidgetConfig(initial,'h',{filters:{chartMode:'days',chartMetric:'sales',showTop:false,topLimit:8}}),'table',{filters:{columns:['order','products','total','date']}});
 assert.equal(result.widgets.find(w=>w.id==='h').filters.chartMetric,'sales');
 assert.equal(result.widgets.find(w=>w.id==='n').filters.chartMetric,undefined);
 assert.equal(result.widgets.find(w=>w.id==='h').filters.showTop,false);
 assert.deepEqual(result.widgets.find(w=>w.id==='table').filters.columns,['order','products','total','date']);
 const unknown=setHomeWidgetConfig(result,'h',{filters:{chartMetric:'not-money',chartMode:'unsafe',topLimit:99}});
 assert.equal(unknown.widgets.find(w=>w.id==='h').filters.chartMetric,'orders');
 assert.equal(unknown.widgets.find(w=>w.id==='h').filters.topLimit,4);
 const other=setHomeWidgetConfig(result,'table',{filters:{columns:['order','bad','order','total']}});
 assert.deepEqual(other.widgets.find(w=>w.id==='table').filters.columns,['order','total']);
});
test('Dos tablas sin compartir filtros ni página',()=>{
 const a=createHomeDashboard([{id:'h',type:'prestashop.orders',filters:{query:'A',page:4}}]);
 const b=duplicateHomeWidget(a,'h','n');const c=setHomeWidgetConfig(b,'n',{filters:{page:0,query:'B'}});
 assert.deepEqual(c.widgets.map(x=>x.filters.page),[4,0]);assert.deepEqual(c.widgets.map(x=>x.filters.query),['A','B']);
});
test('Rechazo de id duplicado y tipo malicioso',()=>{
 const a=createHomeDashboard([{id:'w',type:'home.income'}]);
 assert.throws(()=>addHomeWidget(a,'home.income','w'));
 assert.throws(()=>createHomeWidget('__proto__','test'));
});
test('La configuración limpia secretos y claves desconocidas',()=>{
 const a=createHomeDashboard([{type:'prestashop.summary',id:'a',filters:{query:'ok',service_role:'secreto'},scope:{store:'h',token:'bad'}}]);
 assert(!JSON.stringify(a).includes('secreto'));assert(!JSON.stringify(a).includes('token'));
});
test('Carga rechaza esquema incompatible y descarta duplicados',()=>{
 assert.throws(()=>readHomeDashboard({schemaVersion:99,widgets:[]}));
 assert.throws(()=>createHomeDashboard([{id:'a',type:'home.income'},{id:'a',type:'home.expenses'}]));
 assert.throws(()=>readHomeDashboard({schemaVersion:1,widgets:[{id:'a',type:'future.unknown'}]}));
});
test('Widgets respetan 12/6/1 columnas y no se superponen',()=>{
 let a=createHomeDashboard(Array.from({length:35},(_,i)=>({id:'x'+i,type:i%2?'home.activity':'prestashop.summary',layout:{desktop:{x:i%12,y:Math.floor(i/4),w:12,h:4}}})));
 for(const mode of ['desktop','tablet','mobile']){
   const result=layoutHomeDashboard(a,mode),cells=new Set(),limit=mode==='desktop'?12:mode==='tablet'?6:1;
   for(const r of result){assert(r.x>=0&&r.w>=1&&r.x+r.w<=limit);for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++){const k=x+':'+y;assert(!cells.has(k),'colisión '+mode+' '+k);cells.add(k)}}
 }
});
test('Cambiar tamaño no permite columnas inválidas',()=>{
 const a=createHomeDashboard([{id:'g',type:'home.activity'}]);const b=setHomeWidgetConfig(a,'g',{layout:{desktop:{w:99,h:99}}});
 assert.equal(b.widgets[0].layout.desktop.w,12);assert.equal(b.widgets[0].layout.desktop.h,12);
});
test('Reordenar, ocultar y quitar no elimina los demás',()=>{
 const a=createHomeDashboard([{id:'a',type:'home.income'},{id:'b',type:'home.expenses'}]);
 const b=reorderHomeWidget(a,'a','down');assert.deepEqual(b.widgets.map(x=>x.id),['b','a']);
 const c=setHomeWidgetConfig(b,'a',{hidden:true});assert.equal(layoutHomeDashboard(c).length,1);
 const d=removeHomeWidget(c,'a');assert.deepEqual(d.widgets.map(x=>x.id),['b']);
});
const data={stores:[{id:'h',name:'Hortimatic'},{id:'n',name:'NewOldSmok'}],drawers:[{id:'v',store_id:'h',name:'Vape'},{id:'hd',store_id:'h',name:'Head'},{id:'nv',store_id:'n',name:'Caja'}],closings:[{id:'hc',store_id:'h',business_date:'2026-11-09',status:'cerrado'},{id:'nc',store_id:'n',business_date:'2026-11-09',status:'cerrado'}],closingDrawers:[{closing_id:'hc',drawer_id:'v',closing_cash:100},{closing_id:'hc',drawer_id:'hd',closing_cash:75},{closing_id:'nc',drawer_id:'nv',closing_cash:60}]};
test('Apertura de tres cajones y dos tiendas',()=>{
 const x=nextOpeningSummary(data,{today:'2026-11-09'});assert.equal(x.items.length,3);assert.equal(x.total,235);assert(x.complete);assert.deepEqual(x.items.map(t=>t.drawerName),['Vape','Head','Caja']);
});
test('Una caja nueva no se inventa ni se oculta el total parcial',()=>{
 const x=nextOpeningSummary({...data,drawers:[...data.drawers,{id:'extra',store_id:'h',name:'Nueva caja'}]},{today:'2026-11-09'});
 assert.equal(x.items.length,4);assert.equal(x.complete,false);assert.equal(x.total,null);assert.equal(x.partialKnown,235);assert.equal(x.items.find(i=>i.drawerId==='extra').status,'missing');
});
test('Cierre reciente sin saldo no utiliza el anterior por intuición',()=>{
 const x=nextOpeningSummary({...data,closings:[...data.closings,{id:'hc2',store_id:'h',business_date:'2026-11-10',status:'cerrado'}]},{today:'2026-11-10'});
 assert.equal(x.items.find(i=>i.drawerId==='v').amount,null);
});
test('Salto de mes/año en la fecha de apertura',()=>{
 const x=nextOpeningSummary({...data,closings:[]},{today:'2026-12-31'});assert.equal(x.openingDate,'2027-01-01');
});
test('Ganancia exacta con coste histórico validado y devolución',()=>{
 const x=verifiedProductMargin([{kind:'product',currency:'EUR',taxBasis:'ex-tax',costVerified:true,saleVerified:true,costAtSaleVerified:true,saleCents:1500,costCents:850},
 {kind:'return',currency:'EUR',taxBasis:'ex-tax',costVerified:true,saleVerified:true,costAtSaleVerified:true,saleCents:500,costCents:200}]);
 assert.equal(x.status,'verified');assert.equal(x.saleCents,1000);assert.equal(x.costCents,650);assert.equal(x.displayTotal,350);
});
test('Coste de variante no validado => cifra total oculta',()=>{
 const x=verifiedProductMargin([{kind:'product',currency:'EUR',taxBasis:'ex-tax',costVerified:true,saleVerified:true,costAtSaleVerified:true,saleCents:1500,costCents:800},
 {kind:'product',currency:'EUR',taxBasis:'ex-tax',costVerified:false,saleVerified:true,costAtSaleVerified:false,saleCents:600,costCents:200}]);
 assert.equal(x.status,'partial');assert.equal(x.displayTotal,null);assert.equal(x.verifiedLines,1);assert.equal(x.unverifiedLines,1);
});
test('Moneda o IVA no verificable => no mostrar margen',()=>{
 const x=verifiedProductMargin([{kind:'product',currency:'USD',taxBasis:'with-tax',costVerified:true,saleVerified:true,costAtSaleVerified:true,saleCents:1000,costCents:500}]);
 assert.equal(x.status,'unavailable');assert.equal(x.displayTotal,null);
});
test('Cajas sin cierre reciente figuran desactualizadas y total no confirmado',()=>{
 const x=nextOpeningSummary(data,{today:'2026-11-10'});assert.equal(x.stale,3);assert.equal(x.total,null);assert.equal(x.complete,false);
});
test('No inventar un cero si no existen cajones',()=>{
 const x=nextOpeningSummary({stores:data.stores,drawers:[],closings:[]},{today:'2026-11-10'});assert.equal(x.items.length,0);assert.equal(x.total,null);assert.equal(x.complete,false);
});
test('Cuadrícula densa con 120 instancias mantiene geometría y velocidad razonable',()=>{
 const types=Object.keys(HOME_WIDGET_CATALOG);
 const widgets=Array.from({length:120},(_,i)=>({id:'dense'+i,type:types[i%types.length],layout:{desktop:{x:i%12,y:i%17,w:1+(i%12),h:2+(i%5)}}}));
 const start=performance.now();const dashboard=createHomeDashboard(widgets);
 for(const mode of ['desktop','tablet','mobile']){
  const layout=layoutHomeDashboard(dashboard,mode);assert.equal(layout.length,120);
  assert(layout.every(x=>x.w>0&&x.h>0&&Number.isInteger(x.x)&&Number.isInteger(x.y)));
 }
 assert(performance.now()-start<8000);
});
test('El editor rechaza añadir o duplicar por encima del límite de 120 instancias',()=>{
 const config=createHomeDashboard(Array.from({length:120},(_,i)=>({id:'max-'+i,type:'home.income'})));
 assert.throws(()=>addHomeWidget(config,'home.income','max-new'),/120/);
 assert.throws(()=>duplicateHomeWidget(config,'max-0','max-duplicate'),/120/);
});
console.log(`PASS ${count} tests`);
