# Productos · primera entrega en rama (06/11/2026)

## Objetivo acordado
Módulo propio **Productos**, separado del Centro PrestaShop, para Hortimatic y NewOldSmok. Crear fichas con variantes y seleccionar destino Hortimatic, NewOldSmok o ambas. Si el destino ya tiene el producto, preparar una **actualización de campos seleccionados**, no una clonación ni sobrescritura total. Las combinaciones se identifican individualmente.

## Hechos que cubre este primer PR
- Ruta propia en Operaciones tienda, reutilizando el permiso de PrestaShop para consulta y las conexiones autorizadas existentes. No crea identidades ni credenciales nuevas.
- Catálogo por páginas y búsqueda entre productos cargados, lectura detallada por ID con recurso products/combinations y comprobación de tienda, ID y pertenencia de combinación.
- Vista de ficha completa recibida por API; campos habituales seleccionables y editables en **borrador**. Los demás aparecen como lectura, sin aparentar que son editables.
- Panel independiente para combinaciones: selección y edición de campos por variante, no por todo el producto.
- Borrador de alta sin ID de PrestaShop y variantes nuevas con identificador temporal.
- Selección de una o ambas tiendas de destino; búsqueda de coincidencia por referencia exacta y comprobación de duplicados; preparación por separado de planes CREATE/UPDATE.
- Vista previa de campos alterados y advertencias para atributos, categorías, imágenes, impuestos y existencias que requieren relaciones propias.
- Tests puros y mock de lectura. No hay SQL ni modificaciones en Supabase, PrestaShop o OneDrive.

## Lo que NO se entrega todavía
- **No existe escritura activa ni POST publicado.** Hay código de alta y edición en la rama, pero las operaciones siguen protegidas por controles de servidor; no se han modificado productos reales.
- No se reasignan automáticamente IDs de categorías, imágenes, atributos, fabricantes o impuestos entre tiendas.
- El modo bulk inicial selecciona combinaciones de la ficha abierta, pero aún no ejecuta lotes de productos completos.
- Los campos personalizados por módulos requieren estudio del Webservice real.
- No hay historial persistente ni mecanismo de reanudación de un lote fallido.
- La lectura detallada limita a 75 combinaciones para evitar respuestas y costes no acotados; ampliar con paginación antes de uso intensivo.
- Un posible duplicado sin referencia se queda pendiente; no se da por nuevo automáticamente para publicación.

## Antes de activar escritura
1. Validar en un PrestaShop **aislado y compatible** qué atributos devuelve GET por ID, cómo limpiar campos no editables y cómo formar el XML completo obligatorio para POST/PUT en 1.7.8.11.
2. Registrar en servidor permiso de escritura específico (no basta el permiso de lectura), operación con request_id estable, estado y auditoría. Confirmar permisos del Webservice de cada tienda.
3. Verificar productos con distintos idiomas, múltiples combinaciones, categorías y reglas fiscales. Un mismo EAN, nombre o ID entre tiendas no acredita misma ficha.
4. Implementar CREATE desactivado por defecto y luego creación de variantes con mapeo de atributos; tras cada respuesta comprobar de nuevo el recurso y sus relaciones antes de darlo por completado.
5. Implementar PUT de campos seleccionados sobre un XML fresco del destino, con comparación previa y detección de cambios concurrentes; no borrar campos omitidos, imágenes ni combinaciones.
6. Añadir imágenes y categorías solo con selección/reasignación explícita, más precios/stock bajo autorizaciones concretas.
7. Implementar lotes pequeños, estado por producto y variante, reintentos sin duplicados y recuperación o compensación cuando un lote quede a medias.
8. Ejecutar pruebas de lectura, escritura, errores, doble envío, sesión, permisos y regresión; revisión técnica del servicio; comparar resultados desde el back office antes de publicar el módulo.

## Normas de despliegue
No fusionar ni publicar por existir esta rama o un CI verde. Un PR en borrador indica implementación parcial, pendiente de validación. No crear pruebas reales, productos falsos ni cambios de stock en las tiendas en producción. El contrato previo de Gastos, Cajas, PrestaShop, Recepciones y Pricing se conserva.

## Ampliación API de prevalidación y escritura protegida (06/11/2026)

- Acción prestashop_product_prepare: GET del XML de producto o combinación existente; devuelve huella SHA-256 y diferencias seleccionadas. No envía PUT ni entrega el XML al navegador.
- Acción prestashop_product_commit: motor PUT preparado y probado con datos ficticios, pero bloqueado por defecto mediante la variable de servidor TOTUS_PRESTASHOP_PRODUCT_WRITE_ENABLED. No habilitar esta variable todavía.
- Solo admin autorizado mediante totus_api_manager y una conexión activa/verificada de tienda. Claves en servidor, tienda y dominio exactos, campos permitidos, ID validado y rechazo de relaciones internas arbitrarias.
- Preflight con XML fresco y conservación de campos no seleccionados; futuras escrituras exigirían huella coincidente, segundo GET, PUT y relectura final. Un GET no hace transaccional el PUT de PrestaShop.
- Campos multidioma requieren ID real de idioma de destino; la interfaz no lo mapea automáticamente. XML autocerrado u otros nodos no comprendidos se rechazan.
- Precios: el de producto es base sin IVA; el precio de una combinación es impacto sobre la base, no PVP final.
- La interfaz permite comprobar contra XML real campos simples en fichas existentes sin escribir. El botón Publicar continúa deshabilitado.

## Bloqueos pendientes antes de activar escritura

NO ACTIVAR ninguna bandera sin instalar y verificar el diario durable de request_id, superar las pruebas en PrestaShop 1.7 aislado y obtener revisión técnica competente. La creación POST básica está codificada; siguen pendientes los atributos, combinaciones, imágenes, stock, bulk e historial recuperable.

Las pruebas de transporte usan únicamente XML ficticio y HTTP simulado. No aseguran compatibilidad comercial en tiendas reales. El código en GitHub no significa que el servicio esté publicado en Supabase.

## Alta POST: adaptación de conexión (06/11/2026)
- Añadido contrato de creación de producto en la rama: `prestashop_product_create_prepare` y `prestashop_product_create_commit`. Comparten la conexión verificada de cada tienda, y nunca reciben claves por el navegador.
- La preparación comprueba en lectura el esquema en blanco de la **tienda de destino**, un ID de categoría real, la existencia de la referencia y la cobertura de idiomas de destino. Prepara nombre, referencia, slug y precio. El nuevo producto siempre nace **inactivo** hasta una publicación separada y autorizada.
- La escritura POST usa un registro de idempotencia persistente, cuya migración `20261106170000_prestashop_product_create_journal.sql` y adaptador de servidor ya están conectados **solo en la rama de trabajo**. La creación permanece bloqueada por la variable exclusiva `TOTUS_PRESTASHOP_PRODUCT_CREATE_ENABLED`, sin activar. La variable de PUT `TOTUS_PRESTASHOP_PRODUCT_WRITE_ENABLED` es independiente y también sigue desactivada. **No se ha desplegado el alta real.**
- El adaptador define reconciliación de la respuesta y relectura posterior del ID asignado por PrestaShop. En caso de respuesta incierta no se repite la creación a ciegas.
- Se añadieron pruebas aisladas de XML, dos idiomas, duplicados, validación de categoría, bloqueo del POST, journal simulado y relectura de producto inactivo.
- La captura facilitada por el titular indica los permisos de la API de Hortimatic habilitados. No se atribuye ningún bloqueo a PrestaShop sin un diagnóstico autenticado de sus recursos. El bloqueo de escritura conocido está en Totus.
- Las operaciones completas para combinaciones nuevas, imágenes, stock y otros recursos siguen pendientes. Los permisos Webservice amplios no autorizan a Totus a ejecutar operaciones no implementadas ni a publicar en caliente.

## API de alta · contrato integrado en rama

- Se añadió `prestashop_product_create_profile` (solo GET): recupera los IDs reales de idioma del esquema `products?schema=blank` de cada tienda.
- El asistente del módulo Productos permite consultar idiomas y categorías, seleccionar referencia/precio/categoría, rellenar nombres y URLs por idioma y validar la futura alta sin enviar POST.
- Cada botón de alta exige `CREAR`, una prevalidación reciente y permiso de administrador; las tiendas se tramitan por separado. Se mantiene un único `request_id` para la petición de alta y los resultados inciertos quedan bloqueados.
- El servidor guarda un diario transaccional protegido por rol de servicio en Supabase (requiere migración todavía no desplegada), con exclusividad por tienda/referencia, estado pendiente/incierto/completado y auditoría mínima sin secretos.
- La prueba de PostgreSQL aislado pasó en CI para el diario; las pruebas de interfaz, servidor y regresiones deben verificarse sobre el último commit.
- Solo se crea el producto base y queda inactivo; no se presenta como una ficha publicable con combinaciones, fotos o stock configurados. Una ficha con variaciones seleccionadas se bloquea para evitar un alta parcial.
- **Sigue pendiente** prueba real de integración en PrestaShop aislado 1.7.8.11 con los campos, categorías, traducciones y módulos correspondientes; revisión técnica independiente, instalación controlada y verificación de flujos publicados.
