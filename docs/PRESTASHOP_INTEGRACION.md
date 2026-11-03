# PrestaShop · primer tramo de integración de solo lectura

Fecha de preparación: 03/11/2026. Base de revisión: `01640d131e1adabafb333749fed17f5b31d589b4`.
Este documento describe código **en revisión**, no una función publicada ni una conexión de tienda comprobada.

## Alcance y estado comprobado

- Hortimatic y NewOldSmok: versión **1.7.8.11 declarada por el titular**, todavía no confirmada mediante API autenticada.
- Al iniciar, el gestor de API en Supabase tenía **cero conexiones PrestaShop**. No se transmitieron credenciales externas ni se comprobó ningún pedido real.
- Se ha preparado Configuración → PrestaShop como cuarta sección, preservando Interfaz, Login y APIs.
- No existen adaptadores de lectura TPV instalados ni pruebas de cierres/retiradas. No se puede concluir qué tablas contienen dichos movimientos.
- El prototipo usa exclusivamente el gestor de API existente (`totus_api_manager` y `totus-connections`) y sus credenciales privadas. No añade secretos al repositorio o a OneDrive.
- `orders`, `stock_availables` y `stock_movements` son candidatos de la API estándar. La capacidad efectiva, el formato JSON y los permisos se acreditarán solo cuando se obtenga una respuesta autenticada.

## Activación futura por tienda

1. Verificar con el titular **la URL exacta del webservice de cada tienda** y que pertenece a la instalación adecuada; un resultado en buscadores no acredita que sea el destino autorizado de una clave. Confirmar HTTPS y ruta `/api`.
2. En Configuración → APIs registrar dos perfiles independientes con protocolo PrestaShop y nombres exactos:
   - `PrestaShop · Hortimatic`
   - `PrestaShop · NewOldSmok`
3. Introducir **cada clave únicamente en la pantalla privada del perfil correspondiente**, nunca en la URL, chat, código o logs. La API estándar de PrestaShop usa su clave como usuario de autenticación HTTP Basic; se envía en cabecera `Authorization` sobre HTTPS.
4. Comprobar en Back Office Webservice de PrestaShop que el recurso y verbo GET están habilitados únicamente para la tienda pertinente. Probar la conexión; una prueba de raíz de API no equivale a leer pedidos, TPV o existencias.
5. Activar el perfil y aprobar explícitamente la lectura de datos reales según el control existente. La pestaña PrestaShop mostrará el estado separado de ambas conexiones.
6. Con el servicio del PR **desplegado tras revisión**, consultar una sola página de pedidos o existencias. Releer y contrastar con PrestaShop sin alterar Totus. Sin servicio desplegado, la interfaz no debe anunciar esta operación como disponible.
7. Verificar fechas: la API devuelve `date_add` como fecha/hora sin zona; contrastar el huso real de cada PrestaShop antes de atribuirla a un día Europe/Madrid.

## Contrato del primer tramo

`prestashop_read`: acción del servicio `totus-connections`. Requiere sesión autenticada con permiso de administración de Configuración, ID/revisión de una conexión existente, tienda exacta, recurso `orders`, `stock_availables` o `stock_movements`, página y tamaño. La URL procede **solo del perfil del servidor**; ninguna petición de navegador admite URL, SQL, tablas o campos arbitrarios. Se aplica límite de 1 a 100 filas por página, autenticación privada, HTTPS, restricción de red, límite de tamaño y registro de petición por el gestor existente.

La respuesta conserva el identificador de origen por fila, evita duplicados en la misma página y solo devuelve campos explícitamente permitidos. Las cantidades e importes regresan como texto: **no deben sumarse, contabilizarse o interpretarse como ventas de caja** sin conciliación posterior. Los pedidos pueden incluir devoluciones/cancelaciones; los saldos de stock no demuestran entradas de proveedor.

## Compatibilidad PrestaShop 1.7.8.11

La versión 1.7.8.11 de ambas instalaciones fue comunicada por el titular, pero no comprobada por una llamada autenticada. Se usan exclusivamente recursos documentados de Webservice 1.7; `stock_movements` ofrece movimientos de inventario de solo lectura mediante GET, pero no identifica por sí mismo una entrada de mercancía. Los campos expuestos y permisos deben contrastarse con cada instalación. Se emplea autenticación HTTP Basic en cabecera `Authorization` bajo HTTPS; la clave nunca va en la URL ni el código.

## Pendientes que no se simulan

- Confirmar dominios reales autorizados de ambas instalaciones y permisos GET de Webservice sin revelar claves.
- Leer los recursos realmente disponibles y registrar errores HTTP reales.
- Identificar nombre/versión del módulo TPV, tablas de caja y movimientos (incluidas retiradas), empleados, métodos de pago y vínculo entre las cajas Vape/Head y sus IDs.
- Comparar una lectura real con el arqueo del TPV. La API estándar **no ofrece un ejecutor SQL**; un eventual módulo de lectura TPV solo admitirá consultas de parámetros definidos y evaluados en el servidor PrestaShop, nunca SQL libre.
- Diseñar sincronización y almacenamiento de última ejecución e historial persistente de errores mediante revisión técnica de esquema y permisos. Este primer tramo muestra diagnósticos actuales e historial de fallos **de la sesión del navegador**, no una sincronización realizada.
- Vincular los resultados a Cajas y Recepciones conservando sus funciones, con control de idempotencia, paginación completa, fechas Madrid y comprobación de no duplicación fiscal.

## Pruebas

`tests/prestashop-readonly-qa.mjs` cubre contrato, límites, aislamiento y formato. `tests/prestashop-service-qa.mjs` cubre permisos, rechazo de SQL, transporte de cabecera y errores sin exponer credenciales. `tests/prestashop-ui-browser-qa.mjs` cubre en Playwright las cuatro secciones de Configuración, lectura simulada, tiendas aisladas, errores y adaptación móvil/escritorio.

Todas las pruebas utilizan datos ficticios. Un test aprobado no certifica que el TPV o la API de las tiendas reales hayan respondido.

## Contrato TPV preparado, no conectado

En src/prestashop-tpv-contract.js se define únicamente un contrato lógico de cierres y movimientos de caja. Los nombres closings y cash_movements NO son tablas ni rutas comprobadas en PrestaShop.
Se exige tienda explícita, cajón origen y UUID de cajón Totus asociados mediante evidencia confirmada. Hasta contrastar el mapeo, el estado es bloqueado.
Las fechas se interpretan para Europe/Madrid y los instantes de origen deben incluir zona horaria expresa, especialmente en el cambio de hora. Se utilizan céntimos enteros, claves de origen estables y comprobación de duplicados.
Retiradas de efectivo, transferencias internas y ventas con tarjeta son categorías diferentes. Ninguna equivale por sí sola a un ingreso adicional ni provoca escrituras en Cajas, Recepciones o contabilidad.

Pendiente para habilitar un adaptador: nombre/versión instalada del módulo TPV; inventario de tablas y columnas de arqueos y movimientos; correspondencia de cajones Vape/Head y NewOldSmok; significado de signos, métodos y horarios; ruta de lectura parametrizada preparada en el servidor de PrestaShop.
No se inventan rutas de módulo ni se permite SQL libre o MySQL público.

Las pruebas ficticias del contrato están en tests/prestashop-tpv-contract-qa.mjs. Pendientes de su inclusión y ejecución en CI; un intento de modificar el workflow fue bloqueado por controles de seguridad de la plataforma. No declarar dichas pruebas aprobadas.

Referencia documental: https://devdocs.prestashop-project.org/1.7/webservice/reference/ (GET de stock_movements, stock_availables y orders, sujeto a permisos y recursos disponibles en cada instalación).
Referencia de funciones TPV: https://www.pos-tpv.com/es/manual/manuales-tpv-prestashop/cajas-en-pos-tpv-prestashop (no acredita versión instalada, tablas o datos de estas tiendas).

Estado: PR #115 borrador, sin desplegar; cero conexiones PrestaShop verificadas en Supabase; URLs privadas exactas pendientes; sin lecturas comerciales reales.