// Única definición de permisos de interfaz. El servidor (RLS/RPC) siempre decide.
export const PERMISSION_MODULES=[
 ['inicio','Inicio'],['pricing','Precio'],['cajas','Cajas'],['gastos','Gastos'],
 ['facturacion','Facturación'],['documentos','Documentos y recepciones de PrestaShop'],['equipo','Chat'],['tareas','Tareas'],['fiscalidad','Fiscalidad'],
 ['informes','Informes'],['administracion','Administración'],['configuracion','Configuración'],['prestashop','PrestaShop · consultas y automatizaciones']
];
export const PERMISSION_ACTIONS=[['view','Ver'],['create','Crear'],['edit','Editar'],['delete','Borrar'],['export','Exportar']];
export const PERMISSION_HELP={
 documentos:'Incluye la biblioteca de documentos y las recepciones, accesibles desde PrestaShop. Mantiene los permisos sobre sus documentos y cotejos.',
 prestashop:'Ver permite consultar las tiendas. Crear, editar y borrar controlan las automatizaciones; exportar permite descargar resultados. Las conexiones y sus claves se administran en Configuración.',
 configuracion:'La apariencia personal se guarda por usuario. Gestionar las conexiones y sus claves requiere los permisos de administración correspondientes.'
};
let roleOverrides=[];
export function setRolePermissions(rows=[]){roleOverrides=Array.isArray(rows)?rows:[]}
export function defaultRolePermissions(role,module){
 if(!role||!PERMISSION_MODULES.some(([code])=>code===module))return {view:false,create:false,edit:false,delete:false,export:false};
 if(role==='admin')return {view:true,create:true,edit:true,delete:true,export:true};
 if(module==='prestashop')return {view:false,create:false,edit:false,delete:false,export:false};
 if(module==='configuracion')return {view:true,create:false,edit:false,delete:false,export:false};
 if(['equipo','tareas'].includes(module))return {view:true,create:true,edit:true,delete:true,export:true};
 if(role==='gerente')return module==='fiscalidad'
  ?{view:true,create:true,edit:true,delete:false,export:true}
  :module==='administracion'
  ?{view:true,create:false,edit:false,delete:false,export:false}
  :{view:true,create:true,edit:true,delete:true,export:true};
 if(role==='encargado')return {
  view:module!=='administracion',
  create:module==='documentos',
  edit:module==='documentos',
  delete:false,
  export:false
 };
 return {view:false,create:false,edit:false,delete:false,export:false};
}
export function rolePermissions(role,module){
 const base=defaultRolePermissions(role,module);
 if(role==='admin')return base;
 const saved=roleOverrides.find(row=>row.role===role&&row.module===module);
 if(!saved)return base;
 return Object.fromEntries(PERMISSION_ACTIONS.map(([action])=>[action,saved['can_'+action]===true]));
}
export const CONTACT_PERMISSION_SOURCE={clientes:'facturacion',proveedores:'gastos',marcas:'pricing'};
export function permissionsFor(user,module,entries=[]){
 module=CONTACT_PERMISSION_SOURCE[module]||module;
 const original=rolePermissions(user?.role,module);
 if(user?.role==='admin')return original;
 const row=entries.find(p=>p.module===module&&String(p.email||'').toLowerCase()===String(user?.email||'').toLowerCase());
 if(!row)return original;
 return Object.fromEntries(PERMISSION_ACTIONS.map(([action])=>[action,row['can_'+action]===true]));
}
export const canUser=(user,module,action,entries=[])=>{const p=permissionsFor(user,module,entries);return p.view===true&&p[action]===true};
