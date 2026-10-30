// Única definición de permisos de interfaz. El servidor (RLS/RPC) siempre decide.
export const PERMISSION_MODULES=[
 ['inicio','Inicio'],['pricing','Precios'],['cajas','Cajas'],['gastos','Gastos'],
 ['facturacion','Facturación'],['documentos','Documentos y recepciones'],['equipo','Chat'],['tareas','Tareas'],['fiscalidad','Fiscalidad'],
 ['informes','Informes'],['administracion','Administración'],['configuracion','Configuración']
];
export const PERMISSION_ACTIONS=[['view','Ver'],['create','Crear'],['edit','Editar'],['delete','Borrar'],['export','Exportar']];
let roleOverrides=[];
export function setRolePermissions(rows=[]){roleOverrides=Array.isArray(rows)?rows:[]}
export function defaultRolePermissions(role,module){
 if(!role||!PERMISSION_MODULES.some(([code])=>code===module))return {view:false,create:false,edit:false,delete:false,export:false};
 if(role==='admin')return {view:true,create:true,edit:true,delete:true,export:true};
 if(module==='configuracion')return {view:role==='gerente',create:false,edit:false,delete:false,export:false};
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
export function permissionsFor(user,module,entries=[]){
 const original=rolePermissions(user?.role,module);
 if(user?.role==='admin')return original;
 const row=entries.find(p=>p.module===module&&String(p.email||'').toLowerCase()===String(user?.email||'').toLowerCase());
 if(!row)return original;
 return Object.fromEntries(PERMISSION_ACTIONS.map(([action])=>[action,row['can_'+action]===true]));
}
export const canUser=(user,module,action,entries=[])=>{const p=permissionsFor(user,module,entries);return p.view===true&&p[action]===true};
