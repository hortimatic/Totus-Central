const messages={
 TPV_PRODUCT_FORBIDDEN:'Necesitas permiso de consulta y creación de Productos para dar de alta artículos en esta caja.',
 TPV_PRODUCT_WRITE_UNAVAILABLE:'El alta de productos no está habilitada para esta conexión. Un responsable debe revisar sus permisos.',
 TPV_PRODUCT_SCOPE_INVALID:'La tienda del alta no coincide con la caja seleccionada. Vuelve a abrir el mostrador.',
 TPV_PRODUCT_METADATA_INVALID:'No se han podido comprobar las categorías, atributos o datos de esta tienda. Actualiza los datos antes de continuar.',
 TPV_PRODUCT_CURRENCY_INVALID:'No se ha podido identificar de forma única la moneda de esta tienda. Pide al responsable que revise sus monedas.',
 TPV_PRODUCT_ATTRIBUTE_GROUP_REPEATED:'Cada combinación admite un valor de cada grupo: por ejemplo, una talla y un color.',
 TPV_PRODUCT_REQUEST_ALREADY_BOUND:'Esta solicitud ya corresponde a otra ficha. Consulta las altas guardadas antes de preparar otra.',
 TPV_PRODUCT_RECONCILIATION_REQUIRED:'La ficha puede estar creada en la tienda. Consulta y continúa su alta; no la vuelvas a crear.',
 TPV_PRODUCT_NOT_FOUND:'No se encuentra esta alta en tu caja. Actualiza las altas guardadas.',
 TPV_PRODUCT_ACTIVE_LIMIT:'Hay cien altas pendientes en esta caja. Revisa y termina o cancela las anteriores.',
 TPV_NATIVE_REMOTE_TOTUS_CATALOGUE_INDEX_BUILD_EXPIRED:'El catálogo tarda demasiado en ordenarse por precio. Selecciona una categoría o acota la búsqueda y vuelve a intentarlo.',
 TPV_NATIVE_REMOTE_TOTUS_CATALOGUE_INDEX_LIMIT:'Selecciona una categoría o acota la búsqueda para ordenar este catálogo por precio.',
 TPV_AUTH_REQUIRED:'Vuelve a entrar en tu cuenta para continuar.',
 TPV_WORKSTATION_NOT_CONFIGURED:'Un administrador debe configurar y asignarte este puesto de pruebas.',
 TPV_ASSIGNMENT_OR_CONNECTION_INVALID:'La asignación o la conexión del puesto ha cambiado. Vuelve a abrir el puesto.',
 TPV_CASH_SESSION_MISMATCH:'La sesión de caja ha cambiado. Vuelve a consultar el puesto.',
 TPV_QUOTE_EXPIRED:'El cálculo ha caducado. Vuelve al ticket y calcula de nuevo antes de cobrar.',
 TPV_QUOTE_CHANGED:'La tienda ha cambiado el precio, los impuestos o el stock. Recalcula y revisa el importe antes de cobrar.',
 TPV_NATIVE_RESULT_UNCERTAIN:'La tienda no ha confirmado la preparación. Conserva esta solicitud y consulta su resultado antes de continuar.',
 TPV_CUSTOMER_PUBLICATION_PENDING:'La ficha está pendiente de verificar. Mantén los mismos datos y consulta de nuevo; no crees otra ficha.',
 TPV_CUSTOMER_FIELDS_REJECTED:'La ficha no se ha enviado. Revisa sus datos y comprueba si el cliente ya existe.',
 TPV_CUSTOMER_CONTEXT_INVALID:'Necesitas acceso al directorio de clientes de esta tienda.',
 TPV_CUSTOMER_METADATA_INCOMPLETE:'No se han podido consultar todos los países o provincias. Vuelve a consultar los datos.',
 TPV_PREPARED_ACTOR_MISMATCH:'Este cobro lo preparó otro operador. Recupera su resultado o prepara tu propio ticket.',
 TPV_CASH_BALANCE_INVALID:'La retirada supera el efectivo disponible de esta caja.',
 TPV_UNRESOLVED_SALES:'Recupera las ventas o devoluciones pendientes antes de cerrar.',
 TPV_DOCUMENT_VERIFIED_SALE_REQUIRED:'El documento estará disponible cuando se verifique la venta.',
 TPV_REFUND_QUANTITY_EXCEEDED:'La cantidad supera las unidades que todavía se pueden devolver.',
 TPV_REFUND_PAYMENT_INVALID:'El reintegro no coincide con los importes disponibles de la venta original.',
 TPV_DISCOUNT_FORBIDDEN:'Necesitas permiso de edición de Ventas para aplicar descuentos.',
 TPV_DRAFT_STALE:'Este ticket ha cambiado. Actualiza los tickets aparcados antes de continuar.',
 TPV_DRAFT_IN_USE:'Otro cobro u operador está utilizando este ticket. Consulta su estado antes de continuar.',
 TPV_ORDER_QUERY_INVALID:'Escribe un número de pedido o una referencia válida.',
 TPV_ORDER_REFERENCE_AMBIGUOUS:'La referencia coincide con varios pedidos. Usa el número del ticket.',
 TPV_ORDER_REFERENCE_LOOKUP_INVALID:'No se ha podido comprobar la referencia en la tienda. Vuelve a intentarlo.',
 TPV_CONFIGURATION_FORBIDDEN:'Solo un responsable autorizado puede gestionar los accesos de caja.',
 TPV_ACCESS_REQUEST_INVALID:'Revisa el acceso elegido. Un puesto activo necesita permiso de consulta.',
 TPV_ACCESS_CHANGED:'Este acceso ha cambiado. Actualiza los accesos y revisa la última configuración antes de guardar.',
 TPV_ACCESS_REQUEST_ALREADY_BOUND:'Esta solicitud corresponde a otros cambios. Actualiza los accesos antes de continuar.',
 TPV_ACCESS_ASSIGNMENT_NOT_FOUND:'No se encuentra esa asignación. Actualiza los accesos de caja.',
 TPV_ACCESS_TARGET_INACTIVE:'La persona, la caja o su conexión ya no están disponibles. Actualiza los accesos.',
 TPV_ACCESS_LIST_LIMIT:'Hay demasiadas asignaciones para esta consulta. Pide al responsable que revise su organización antes de continuar.',
 TPV_STOCK_FORBIDDEN:'Necesitas permiso de edición de Productos para registrar entradas de stock.'
};
/** Snapshot the SAME normal Central session, including its user identity,
 * before each request. Account switching can never lend a new user's JWT to
 * a delayed action initiated by the previous user. No service credentials. */
export function createTpvHttpClient({auth,owner,currentActor,url,key,request=fetch}){
 const base=new URL(url);if(base.protocol!=='https:'||base.username||base.password||base.pathname!=='/'||base.search||base.hash)throw Error('Configuración de Central no válida.');
 const guard=()=>{if(!owner||owner!==currentActor())throw Error('La sesión ha cambiado. Vuelve a abrir TotusTPV.');};
 return async body=>{guard();const {data,error}=await auth.getSession();guard();const session=data?.session;
  if(error||session?.user?.id!==owner||!session.access_token)throw Error(messages.TPV_AUTH_REQUIRED);
  const response=await request(base.origin+'/functions/v1/totus-tpv',{method:'POST',headers:{'Content-Type':'application/json',
   apikey:key,Authorization:'Bearer '+session.access_token},body:JSON.stringify(body),credentials:'omit',redirect:'error',signal:AbortSignal.timeout(60000)});
  const result=await response.json();guard();if(!response.ok||result?.error){const code=result?.error||'TPV_REQUEST_FAILED',
   failure=new Error(code==='TPV_CUSTOMER_FIELDS_REJECTED'&&typeof result.detail==='string'?result.detail:
    messages[code]||'No se pudo confirmar la operación. Conserva sus datos y consulta el resultado antes de repetirla.');failure.code=code;throw failure;}
  return result;
 };
}
