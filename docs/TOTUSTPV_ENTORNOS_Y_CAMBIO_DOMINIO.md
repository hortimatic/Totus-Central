# Entornos y futura sustitución de Hortimatic

Acuerdo del propietario, 15/11/2026: el dominio se cambiará únicamente cuando
TotusTPV esté completamente funcional y validado en preproducción.

| Web | Situación | Uso durante este desarrollo |
|---|---|---|
| `hortimatic.com` | Producción, conexión y base de datos propias | Operativa comercial existente; fuera de las pruebas |
| `newoldsmok.com` | Producción, conexión y base de datos propias | Operativa comercial existente; fuera de las pruebas |
| `preproduccion.hortimatic.com` | PrestaShop 8.2.8, futura sustituta de Hortimatic | Único destino remoto de pruebas del nuevo TPV |

No se plantea actualizar a 9. Las simulaciones y el laboratorio local desechable
continúan siendo válidos; no acreditan por sí solos aceptación en preproducción.

## Identidades que se conservan

La conexión de 8.2.8 es `b554f6cc-4df1-412b-b063-e1cbd82d9e66` y su web registrada
es `hortimatic-2`. Su nombre visible no demuestra la versión: la identidad es la
conexión verificada y el perfil nativo, no una coincidencia de texto.

La Hortimatic actual utiliza `ca3d32ef-bd07-4468-baa9-a1557225ece3`; NewOldSmok,
`bfc271c6-1f45-4dda-9ae1-1860a9076d8e`. Un pedido con el mismo número en dos
instalaciones no es el mismo pedido. La clave técnica incluye conexión, tienda
nativa e ID remoto. Un cambio de hostname no debe generar otra identidad para
los pedidos de la instalación 8.2.8 ni convertirlos en pedidos de la conexión antigua.

Hortimatic conserva su establecimiento físico y sus cajas; no se inventa otro
establecimiento comercial para representar preproducción. Las asignaciones de QA
necesitan configuración explícita y aislamiento de entorno. La lectura autenticada
actual del registro de Central muestra la web de preproducción sin establecimiento
asignado; este desarrollo no ha cambiado ese vínculo.

## Barreras implementadas en el código

- `deployment-qa-policy.js` identifica el único origen y conexión de QA y protege
  los dos orígenes y conexiones de producción.
- El transporte comprueba esa política en toda mutación. Un permiso genérico de
  checkout no la sustituye. Los transportes configurados para QA también limitan
  sus lecturas al mismo origen; no hacen pruebas contra producción.
- Las sesiones, asignaciones y operaciones del registro pendiente incluyen
  `environment`. La autorización de esta versión sólo admite `qa`.
- Una sesión QA no puede vincularse a un cierre comercial. El entorno se conserva
  al releer la operación y se contrasta en contexto, cálculo y aceptación de pagos.
- El diagnóstico utiliza APIs autenticadas existentes de Central y metadatos de
  cajas; no crea pedidos, pagos, movimientos de existencias ni asignaciones.

La migración del registro aún no está aplicada en remoto. Las barreras de servidor
se han probado con dependencias aisladas y SQL real en PGlite, no mediante envíos
de ensayo a las webs de producción. No se ha cambiado dominio, DNS ni endpoint.

## Condiciones anteriores al cambio

Se exige aceptación completa de ventas, pagos mixtos, devoluciones, existencias,
usuarios, cajas, recuperación y documentos, además de ensayo de transición,
aislamiento de datos QA e historia de la instalación retirada. Deben verificarse
con los métodos de pago y perfiles reales del TPV; el datáfono es independiente y
el cajero confirma tarjeta, sin cargar dinero desde Totus.

Los pedidos de prueba persistentes de 8.2.8 deben quedar identificados y excluidos
de los futuros totales comerciales. Guardar `environment=qa` es una base para esa
exclusión, no demuestra que todos los lectores e informes futuros ya la apliquen.
Esa integración y su prueba siguen pendientes y bloquean la transición.
El pedido remoto de ensayo 46542 de la instalación 8.2.8 es una referencia QA
conocida del prototipo anterior y debe formar parte de ese inventario, aunque su
registro preceda al nuevo diario de Central. No debe convertirse en ingreso real
por cambiar el dominio ni eliminarse sin un procedimiento nativo autorizado.

## Secuencia prevista, todavía sin ejecutar

1. Completar el TPV y su aceptación en preproducción, incluidos errores, respuestas
   perdidas, devoluciones, permisos, stock y recuentos. Resolver pendientes.
2. Verificar copias y recuperación; definir cómo conservar la historia antigua y
   cómo tratar datos copiados, operaciones QA y actividad comercial hasta el corte.
3. Preparar la baja del endpoint antiguo antes de reasignar el dominio. La conexión
   antigua no puede seguir apuntando a `hortimatic.com` y leer por accidente la
   nueva base de datos con la identidad anterior. Su historia se conserva mediante
   una vía de lectura verificada o archivo, sin mezclar IDs.
4. Con aceptación y autorización explícitas del cambio, actualizar el origen de
   la instalación 8.2.8 conservando conexión, identidad nativa y referencias, y
   verificar las asignaciones del mismo establecimiento y sus cajas.
5. Comprobar el recorrido publicado y la exclusión de operaciones QA antes de
   habilitar la explotación ordinaria. NewOldSmok conserva su conexión independiente.

`planDomainTransition` sólo construye una propuesta cuando están presentes las
condiciones declaradas y ambas instalaciones pertenecen al mismo establecimiento.
Siempre devuelve `executable:false`; no cambia DNS, dominios, conexiones ni datos.
Sus indicadores de aceptación no sustituyen la evidencia de pruebas ni autorizan
activar producción. La activación requiere una entrega posterior validada.
