/* Totus Central · inicio modular. Pure layout/model layer, no business writes. */
export const HOME_WIDGET_SCHEMA = 1;
export const HOME_GRID_COLUMNS = Object.freeze({desktop:12,tablet:6,mobile:1});

const definitions = [
  ['cash.openings','Cajas','Dinero para abrir mañana',12,3,8,12],
  ['home.income','Inicio','Ingresos del periodo',3,2,2,6],
  ['home.expenses','Inicio','Gastos contables',3,2,2,6],
  ['home.result','Inicio','Ingresos menos gastos',3,2,2,6],
  ['home.internal','Inicio','Gastos internos',3,2,2,6],
  ['home.gain','Inicio','Ganancia comercial',3,2,2,6],
  ['home.activity','Inicio','Ventas y gastos del periodo',12,5,6,12],
  ['home.alerts','Inicio','Pendientes y avisos',6,4,4,12],
  ['home.shortcuts','Inicio','Acciones rápidas',6,2,4,12],
  ['cash.store','Cajas','Estado de tienda y cierres',6,4,4,12],
  ['cash.history','Cajas','Cierres recientes',6,3,4,12],
  ['cash.withdrawals','Cajas','Retiradas y efectivo',6,3,4,12],
  ['prestashop.summary','PrestaShop','Resumen PrestaShop',6,5,5,12],
  ['prestashop.orders','PrestaShop','Pedidos PrestaShop',12,6,8,12],
  ['prestashop.top','PrestaShop','Más vendidos',6,4,4,12],
  ['prestashop.quality','PrestaShop','Calidad de catálogo',6,3,4,12],
  ['expenses.quarter','Gastos','Gastos del trimestre',6,4,4,12],
  ['expenses.pending','Gastos','Pendientes de revisión',6,3,4,12],
  ['billing.pending','Facturación','Facturas y cobros',6,4,4,12],
  ['pricing.quick','Precio','Consulta rápida de precio',6,5,6,12],
  ['documents.latest','Documentos','Documentos recientes',6,4,4,12],
  ['fiscal.forecast','Fiscalidad','Previsión fiscal',6,5,5,12],
  ['reports.shortcut','Informes','Informes y gestoría',6,3,4,12],
  ['tasks.today','Tareas','Tareas de hoy',6,4,4,12],
  ['system.status','Administración','Estado del sistema',6,4,4,12],
  ['receptions.pending','Recepciones','Recepciones por cotejar',6,4,4,12],
  ['products.pending','Productos','Revisiones de productos',6,4,4,12],
  ['chat.alerts','Chat','Avisos del equipo',6,4,4,12]
];
export const HOME_WIDGET_CATALOG = Object.freeze(Object.fromEntries(definitions.map(([type,category,title,width,height,minWidth,maxWidth])=>[
  type,Object.freeze({type,category,title,width,height,minWidth,maxWidth,minHeight:2,maxHeight:12})
])));
const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const bounded = (x,min,max,def) => Number.isFinite(Number(x)) ? Math.max(min,Math.min(max,Math.round(Number(x)))) : def;
const safeText = x => typeof x==='string' ? x.slice(0,120) : '';
const safeScope = x => {
  const obj=isObj(x)?x:{};
  return {store:typeof obj.store==='string'?obj.store.slice(0,100):'all'};
};
const safeFilters = x => {
  if(!isObj(x))return {};
  const out={};
  for(const key of ['from','to','status','query','payment','origin','sort','period','inheritPeriod','page','pageSize','columns']){
    if(typeof x[key]==='string')out[key]=x[key].slice(0,120);
    else if(typeof x[key]==='boolean')out[key]=x[key];
    else if(['page','pageSize'].includes(key)&&Number.isFinite(x[key]))out[key]=bounded(x[key],0,200,0);
    else if(key==='columns'&&Array.isArray(x[key]))out.columns=x[key].filter(k=>typeof k==='string').slice(0,20).map(k=>k.slice(0,40));
  }
  return out;
};
function widget(type,id,options={}){
  const def=HOME_WIDGET_CATALOG[type];
  if(!Object.hasOwn(HOME_WIDGET_CATALOG,type)||typeof id!=='string'||!/^[-\w]{1,80}$/.test(id))throw new Error('Tipo o identificador de widget no válido');
  const l=isObj(options.layout)?options.layout:{};
  return {
    id,type,
    scope:safeScope(options.scope),filters:safeFilters(options.filters),
    title:safeText(options.title)||def.title,
    hidden:options.hidden===true,
    layout:{desktop:{x:bounded(l.desktop?.x,0,11,0),y:bounded(l.desktop?.y,0,9999,0),w:bounded(l.desktop?.w,def.minWidth,def.maxWidth,def.width),h:bounded(l.desktop?.h,def.minHeight,def.maxHeight,def.height)},
      tablet:{order:bounded(l.tablet?.order,0,9999,0),w:bounded(l.tablet?.w,1,6,Math.min(6,def.width)),h:bounded(l.tablet?.h,2,16,type==='cash.openings'?7:type==='prestashop.orders'?9:def.height)},mobile:{order:bounded(l.mobile?.order,0,9999,0),h:bounded(l.mobile?.h,2,18,type==='cash.openings'?8:type==='prestashop.orders'?9:Math.min(12,def.height))} }
  };
}
export function createHomeWidget(type,id,options={}) {return widget(type,id,options);}
export function createHomeDashboard(initialWidgets=[]){const result={schemaVersion:HOME_WIDGET_SCHEMA,revision:null,widgets:initialWidgets.map((item,i)=>widget(item.type,item.id||`inicio-${i}`,item))};
  if(new Set(result.widgets.map(w=>w.id)).size!==result.widgets.length)throw new Error('Hay identificadores de widgets repetidos');
  return result;}
export function readHomeDashboard(raw){
  if(!isObj(raw)||raw.schemaVersion!==HOME_WIDGET_SCHEMA||!Array.isArray(raw.widgets))throw new Error('Diseño de Inicio no compatible');
  if(raw.widgets.length>120)throw new Error('El diseño supera el límite de instancias; no se descartará ninguna');
  const seen=new Set(); const widgets=[];
  for(const item of raw.widgets){
    if(!isObj(item)||!Object.hasOwn(HOME_WIDGET_CATALOG,item.type)||seen.has(item.id))throw new Error('El diseño contiene una instancia incompatible o duplicada');
    const w=widget(item.type,item.id,item);widgets.push(w);seen.add(w.id);
  }
  return {schemaVersion:HOME_WIDGET_SCHEMA,revision:typeof raw.revision==='string'?raw.revision:null,widgets};
}
export function addHomeWidget(config,type,id,options={}){
  const next=readHomeDashboard(config);
  if(next.widgets.some(w=>w.id===id))throw new Error('Ya existe esa instancia');
  next.widgets.push(widget(type,id,options)); return next;
}
export function duplicateHomeWidget(config,sourceId,newId){
  const next=readHomeDashboard(config);
  const source=next.widgets.find(w=>w.id===sourceId);
  if(!source)throw new Error('Instancia no encontrada');
  if(next.widgets.some(w=>w.id===newId))throw new Error('Identificador duplicado');
  const copy=widget(source.type,newId,{...source,layout:{...source.layout,desktop:{...source.layout.desktop,y:source.layout.desktop.y+source.layout.desktop.h}}});
  next.widgets.splice(next.widgets.indexOf(source)+1,0,copy);return next;
}
export function removeHomeWidget(config,id){const next=readHomeDashboard(config);next.widgets=next.widgets.filter(w=>w.id!==id);return next;}
export function setHomeWidgetConfig(config,id,patch){
  const next=readHomeDashboard(config);const ix=next.widgets.findIndex(w=>w.id===id);
  if(ix<0)throw new Error('Instancia no encontrada');
  const current=next.widgets[ix];
  if(patch?.type&&patch.type!==current.type)throw new Error('No se admite cambiar el tipo de una instancia');
  next.widgets[ix]=widget(current.type,id,{...current,...patch,scope:{...current.scope,...patch?.scope},filters:{...current.filters,...patch?.filters},layout:{...current.layout,desktop:{...current.layout.desktop,...patch?.layout?.desktop},tablet:{...current.layout.tablet,...patch?.layout?.tablet},mobile:{...current.layout.mobile,...patch?.layout?.mobile}}});
  return next;
}
export function reorderHomeWidget(config,id,direction){
  const next=readHomeDashboard(config);const i=next.widgets.findIndex(w=>w.id===id);
  const j=i+(direction==='up'?-1:direction==='down'?1:0);
  if(i<0||j<0||j>=next.widgets.length)return next;
  const a=next.widgets[i],b=next.widgets[j];
  const apos={...a.layout.desktop},bpos={...b.layout.desktop};
  const at=a.layout.tablet.order,bt=b.layout.tablet.order,am=a.layout.mobile.order,bm=b.layout.mobile.order;
  [next.widgets[i],next.widgets[j]]=[b,a];
  b.layout.desktop={...b.layout.desktop,x:apos.x,y:apos.y}; a.layout.desktop={...a.layout.desktop,x:bpos.x,y:bpos.y};
  b.layout.tablet.order=at;a.layout.tablet.order=bt;b.layout.mobile.order=am;a.layout.mobile.order=bm;
  return next;
}
export function layoutHomeDashboard(config,mode='desktop'){
  const next=readHomeDashboard(config);
  const columns=HOME_GRID_COLUMNS[mode];if(!columns)throw new Error('Tamaño de pantalla desconocido');
  const entries=next.widgets.filter(w=>!w.hidden).map((w,i)=>({widget:w,index:i}));
  const sorted=mode==='desktop'?entries.sort((a,b)=>a.widget.layout.desktop.y-b.widget.layout.desktop.y||a.widget.layout.desktop.x-b.widget.layout.desktop.x||a.index-b.index)
   :entries.sort((a,b)=>a.widget.layout[mode].order-b.widget.layout[mode].order||a.index-b.index);
  const occupied=new Set(),result=[];
  for(const {widget:w} of sorted){
    const def=HOME_WIDGET_CATALOG[w.type];
    const width=mode==='desktop'?bounded(w.layout.desktop.w,def.minWidth,Math.min(def.maxWidth,columns),Math.min(def.width,columns)) : mode==='tablet'?bounded(w.layout.tablet.w,1,columns,Math.min(columns,def.width)):1;
    const height=mode==='desktop'?bounded(w.layout.desktop.h,def.minHeight,def.maxHeight,def.height):mode==='tablet'?bounded(w.layout.tablet.h,2,16,def.height):bounded(w.layout.mobile.h,2,18,def.height);
    const initialX=mode==='desktop'?bounded(w.layout.desktop.x,0,columns-width,0):0;
    const targetY=mode==='desktop'?w.layout.desktop.y:0;
    const clear=(x,y)=>{for(let dy=0;dy<height;dy++)for(let dx=0;dx<width;dx++)if(occupied.has(`${x+dx}:${y+dy}`))return false;return true};
    let x=initialX,y=targetY;
    if(mode!=='desktop'){
      let found=false;
      for(let yy=0;yy<20000&&!found;yy++)for(let xx=0;xx<=columns-width;xx++)if(clear(xx,yy)){x=xx;y=yy;found=true;break}
      if(!found)throw new Error('Cuadrícula agotada');
    }else{
      let found=false;
      for(let yy=targetY;yy<20000&&!found;yy++)for(let xx=yy===targetY?initialX:0;xx<=columns-width;xx++)if(clear(xx,yy)){x=xx;y=yy;found=true;break}
      if(!found)throw new Error('Cuadrícula agotada');
    }
    for(let dy=0;dy<height;dy++)for(let dx=0;dx<width;dx++)occupied.add(`${x+dx}:${y+dy}`);
    result.push({id:w.id,type:w.type,x,y,w:width,h:height});
  }
  return result;
}
