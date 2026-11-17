// Public routes are Spanish paths. Internal permission/database IDs stay stable.
export const MODULE_PATHS={totustpv:'tpv',inicio:'inicio',pricing:'precio',ventas:'ventas',productos:'productos',prestashop:'prestashop',clientes:'clientes',proveedores:'proveedores',marcas:'marcas',cajas:'cajas',gastos:'gastos',facturacion:'facturacion',documentos:'documentos',fiscalidad:'fiscalidad',informes:'informes',tareas:'tareas',equipo:'chat',administracion:'administracion',configuracion:'configuracion',automatizaciones:'automatizaciones',apis:'apis',cotejos:'cotejos'};
const moduleId=value=>Object.entries(MODULE_PATHS).find(([,path])=>path===value)?.[0]||value;
const ADMIN_SECTIONS=new Set(['usuarios','roles','negocio','fiscal','storage','backups','log']);
export function adminSectionFromUrl(href){const section=new URL(href).searchParams.get('section');return ADMIN_SECTIONS.has(section)?section:null;}
export function drawerManagementUrl(href){const url=new URL(moduleUrl(href,'administracion'));url.searchParams.set('section','negocio');return url.href;}
export function moduleUrl(href,module){
 const url=new URL(href),parts=url.pathname.split('/').filter(Boolean),last=parts.at(-1)||'';
 const section=module==='administracion'?adminSectionFromUrl(href):null;
 url.search='';url.hash='';
 if(section)url.searchParams.set('section',section);
 // Standalone HTML documents remain usable in local previews and embedded hosts.
 if(/\.html$/.test(last)&&last!=='index.html'){url.searchParams.set('module',MODULE_PATHS[module]||module);return url.href;}
 if(last==='index.html'||Object.hasOwn(MODULE_PATHS,moduleId(last)))parts.pop();
 parts.push(MODULE_PATHS[module]||module);url.pathname='/'+parts.join('/');return url.href;
}
export function requestedModule(href,routes,preferred='inicio',internalReturn=false){const url=new URL(href),path=url.pathname.split('/').filter(Boolean).at(-1),knownPath=Object.values(MODULE_PATHS).includes(path)||Object.hasOwn(MODULE_PATHS,path),requested=knownPath?path:internalReturn?preferred:url.searchParams.get('module')||preferred,id=moduleId(requested);return routes.some(r=>r.id===id)?id:'inicio';}
export function moduleNavigationState(href,module,previous={}){
 const state=previous?.totusModuleNavigation?{totusModuleNavigation:true}:{},params=new URL(href).searchParams;
 if(module==='ventas'||module==='prestashop'){
  const link=Object.fromEntries(['ps_store','ps_order','ps_date'].map(key=>[key,params.get(key)||previous?.totusOrderLink?.[key]||'']));
  if(['hortimatic','newoldsmok'].includes(link.ps_store)&&/^\d{1,15}$/.test(link.ps_order)&&/^\d{4}-\d{2}-\d{2}$/.test(link.ps_date))state.totusOrderLink=link;
 }
 return state;
}
export function nativeModuleClick(event,element){return element?.tagName==='A'&&(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey);}

const financial=['closings','closingDrawers','expenses','expenseLines','invoices','invoiceLines','documents','taxPayments','fiscalAdjustments','incomeAdjustments','customers','categories','suppliers'];
const byModule={
 clientes:['customers'],proveedores:['suppliers','providers','categories','expenses'],marcas:['brands','families'],
 inicio:financial,informes:financial,fiscalidad:financial,
 cajas:['closings','closingDrawers'],
 gastos:['expenses','expenseLines','suppliers','categories','documents','taxPayments'],
 facturacion:['invoices','invoiceLines','customers','series','templates','documents'],
 documentos:['documents','expenses','invoices','customers','suppliers','categories'],
 pricing:['brands','families','products','variants','providers','providerPrices','competitors','consultations'],
 ventas:[],totustpv:[],prestashop:['documents','suppliers'],productos:[],cotejos:['documents','suppliers'],equipo:[],tareas:[],configuracion:[],automatizaciones:[],apis:[]
};
const common=['settings','rolePermissions','userPermissions','team','profiles','stores','drawers'];
export function moduleReads(tasks,module){
 if(!module||module==='administracion')return tasks;
 if(!Object.hasOwn(byModule,module))throw new Error('Módulo no válido');
 const keys=new Set([...common,...byModule[module]]);
 return tasks.filter(([key])=>keys.has(key));
}
