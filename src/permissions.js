// Única definición de permisos de interfaz. El servidor (RLS/RPC) siempre decide.
export const PERMISSION_MODULES=[
 ['inicio','Inicio'],['pricing','Precio'],['cajas','Cajas'],['gastos','Gastos'],
 ['facturacion','Facturación'],['documentos','Documentos y recepciones de PrestaShop'],['equipo','Chat'],['tareas','Tareas'],['fiscalidad','Fiscalidad'],
 ['informes','Informes'],['administracion','Administración'],['configuracion','Configuración'],['prestashop','PrestaShop · consultas'],['automatizaciones','Automatizaciones y avisos'],['productos','Productos · catálogo y edición']
];
export const PERMISSION_ACTIONS=[['view','Ver'],['create','Crear'],['edit','Editar'],['delete','Borrar'],['export','Exportar']];
export const PERMISSION_HELP={
 inicio:'Consultar el resumen de tiendas, actividad y accesos de trabajo. Las operaciones iniciadas aquí requieren también permiso en su módulo de destino.',
 pricing:'Consultar y gestionar productos, familias y cálculos de precios, costes, impuestos y márgenes. Incluye el directorio compartido de marcas.',
 cajas:'Consultar cierres, registrar cifras y movimientos de caja, corregir datos autorizados y descargar sus informes.',
 gastos:'Consultar y registrar gastos y justificantes, gestionar proveedores y actualizar los datos fiscales y de pago autorizados.',
 facturacion:'Consultar y gestionar clientes, borradores, facturas, series y plantillas. Emitir o corregir documentos conserva sus validaciones contables.',
 equipo:'Leer conversaciones propias, participar, adjuntar archivos y gestionar mensajes o canales según los permisos y la pertenencia al canal.',
 tareas:'Consultar, crear y actualizar tareas, responsables, fechas y documentos vinculados; archivar o eliminar requiere su acción correspondiente.',
 fiscalidad:'Consultar y gestionar la clasificación fiscal y los periodos; descargar los informes y documentos permitidos.',
 informes:'Consultar resultados por tienda y periodo, preparar informes y exportar los datos autorizados de los módulos de origen.',
 administracion:'Gestionar usuarios, roles, negocio, almacenamiento, copias y registros. Las operaciones críticas conservan sus requisitos de administrador.',
 productos:'Ver permite consultar fichas. Crear autoriza altas de productos, combinaciones y sus marcas, proveedores o atributos; editar permite actualizar fichas, imágenes y catálogos compartidos, y archivar; borrar permite eliminar registros seleccionados; exportar permite descargar el catálogo. Las claves siguen reservadas a Administración.',
 documentos:'Incluye la biblioteca de documentos y las recepciones, accesibles desde PrestaShop. Mantiene los permisos sobre sus documentos y cotejos.',
 prestashop:'Ver permite consultar las tiendas; exportar permite descargar resultados. Las conexiones y sus claves se administran en Sistema → APIs. Las reglas programadas se gestionan en Automatizaciones.',
 automatizaciones:'Permite consultar, crear, editar o retirar reglas programadas. Cada ejecución comprueba también los permisos del responsable en el módulo de origen y en el canal de destino.',
 configuracion:'La apariencia personal se guarda por usuario. Las conexiones y sus claves se gestionan en Sistema → APIs, exclusivamente por administración.'
};
let roleOverrides=[];
export function setRolePermissions(rows=[]){roleOverrides=Array.isArray(rows)?rows:[]}
export function defaultRolePermissions(role,module){
 if(!role||!PERMISSION_MODULES.some(([code])=>code===module))return {view:false,create:false,edit:false,delete:false,export:false};
 if(role==='admin')return {view:true,create:true,edit:true,delete:true,export:true};
 if(['prestashop','automatizaciones','productos'].includes(module))return {view:false,create:false,edit:false,delete:false,export:false};
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
