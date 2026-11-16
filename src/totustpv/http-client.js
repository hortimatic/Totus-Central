const messages={
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
 TPV_ORDER_QUERY_INVALID:'Escribe un número de pedido válido.',
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
