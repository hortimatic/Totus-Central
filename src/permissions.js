// Única definición de permisos de interfaz. El servidor (RLS/RPC) siempre decide.
export const PERMISSION_MODULES=[
 ['inicio','Inicio'],['pricing','Precios'],['cajas','Cajas'],['gastos','Gastos'],
 ['facturacion','Facturación'],['documentos','Documentos'],['fiscalidad','Fiscalidad'],
 ['informes','Informes'],['administracion','Administración']
];
export const PERMISSION_ACTIONS=[['view','Ver'],['create','Crear'],['edit','Editar'],['delete','Borrar'],['export','Exportar']];
export function rolePermissions(role,module){
 if(role==='admin')return {view:true,create:true,edit:true,delete:true,export:true};
 if(role==='gerente')return module==='administracion'
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
export function permissionsFor(user,module,entries=[]){
 const original=rolePermissions(user?.role,module);
 if(user?.role==='admin')return original;
 const row=entries.find(p=>p.module===module&&String(p.email||'').toLowerCase()===String(user?.email||'').toLowerCase());
 if(!row)return original;
 return Object.fromEntries(PERMISSION_ACTIONS.map(([action])=>[action,row['can_'+action]===true]));
}
export const canUser=(user,module,action,entries=[])=>permissionsFor(user,module,entries)[action]===true;
