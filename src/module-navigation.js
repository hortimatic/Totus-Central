// Navigation carries only a module name, never session data or credentials.
export function moduleUrl(href,module){const url=new URL(href);url.searchParams.set('module',module);return url.href;}
export function requestedModule(href,routes,preferred='inicio'){const url=new URL(href),id=url.searchParams.has('module')?url.searchParams.get('module'):preferred;return routes.some(r=>r.id===id)?id:'inicio';}
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
 cotejos:['documents','suppliers'],equipo:[],tareas:[],configuracion:[]
};
const common=['settings','rolePermissions','userPermissions','team','profiles','stores','drawers'];
export function moduleReads(tasks,module){
 if(!module||module==='administracion')return tasks;
 if(!Object.hasOwn(byModule,module))throw new Error('Módulo no válido');
 const keys=new Set([...common,...byModule[module]]);
 return tasks.filter(([key])=>keys.has(key));
}
