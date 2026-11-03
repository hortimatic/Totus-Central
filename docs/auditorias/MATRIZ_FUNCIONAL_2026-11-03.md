# Matriz de cobertura funcional — 03/11/2026

Base `6aa2b6ad`. Sin juicio visual. «Simulado» significa interacción real de navegador contra servicios y datos ficticios, con comprobación del resultado. «CI» significa evidencia del CI de la base, no una ejecución local nueva de toda esa suite. «Lectura real» significa metadatos o referencias de producción sin escritura. Ninguna fila acredita todas las combinaciones posibles.

## Acceso y módulos operativos

| Área / sección | Operaciones y resultados comprobados | Evidencia principal | Límite o actuación |
|---|---|---|---|
| Acceso y sesión | Inicio con sesión guardada, sesión ausente/retardada/error; un solo acceso simultáneo; cierre y cambio de cuenta limpian datos; refrescar la misma cuenta conserva borrador. | `session-startup-browser-qa`, simulado. | F-01: caída del CDN; no se cambió una contraseña real. |
| Navegación y carga | Rutas conocidas, preferencias de inicio, rechazo de módulo no autorizado, lecturas por módulo, publicación de estado solo tras terminar lecturas válidas. | `full-flow-qa`, `module-navigation-browser-qa` y `startup-timing-browser-qa` (CI); lectura de `api.js` y `module-navigation.js`. | Consultas completas por conjunto; F-07 para volumen. |
| Inicio | Accesos de alta, datos de cierres y gastos, rangos/tiendas, enlaces a módulos consumidores. | `full-flow-qa`; `dashboard-report-browser-qa` (CI). | La lectura del dashboard no certifica cada cifra histórica individual. |
| Pricing / productos | Crear y editar producto simple, conservar relaciones e histórico, referencias activas e inactivas. | `pricing-integral-browser-qa`, `deep-editing-browser-qa`; `pricing-directory-browser-qa` (CI). | Validación de catálogo real por muestreo/relaciones, no revisión comercial de todos los precios. |
| Pricing / variantes | Variantes propias, costes/PVP por variante, cambio de proveedor, borradores, descuento y simulación de margen. | `pricing-integral-browser-qa`; `pricing-variants-browser-qa` (CI). | No se modificaron productos reales. |
| Pricing / consultas | Alta de consulta independiente de producto, histórico y exportaciones sin escribir contabilidad. | `full-flow-qa`; `quick-price-validation-browser-qa` (CI). | Probar adicionalmente volumen masivo antes de cambiar consultas. |
| Cajas / listado y filtros | Filtrar por fecha/tienda, ver cierres, exportar el contenido guardado. | `closing-integral-browser-qa`, `full-flow-qa`, `live-refresh-qa`. | No se cerró una caja real durante la auditoría. |
| Cajas / nuevo y borrador | Apertura/cierre por cajón, tarjeta y otras ventas, retiradas/gastos/entradas/salidas; campos desconocidos siguen desconocidos; cambiar tienda carga sus cajones. | `closing-integral-browser-qa`, simulado. | Mantener distinción entre total de tienda y reparto documentado por cajones. |
| Cajas / cerrar, reabrir y rectificar | Cálculo guardado y relectura, suma de cajones, rechazo de efectivo negativo oculto por otro cajón, revisión concurrente y persistencia de movimientos. | `closing-integral-browser-qa`, `full-flow-qa`; SQL de cierres en CI desechable. | Aprobación y periodo cerrado siguen siendo controles de negocio. |
| Cajas / histórico aceptado | Ventas verificadas conservadas en Excel; no duplicar ingreso mensual fiscal; apertura siguiente coherente. | `closing-integral-browser-qa`; `source-closing-qa` y `historical-acceptance-qa` (CI). | No se revalida aquí toda la documentación histórica. |
| Gastos / registros | Alta, edición, importes decimales, líneas, tienda/común, proveedores/categorías inactivos y relectura. | `full-flow-qa`, `expense-integral-browser-qa`, `deep-editing-browser-qa`. | La simulación no es certificación fiscal de facturas reales. |
| Gastos / impuestos y control interno | Separación de gasto fiscal, pago y control interno; conciliación de evidencias; rechazo de factura duplicada. | `full-flow-qa`, `expense-integral-browser-qa`; `tax-expense-browser-qa` (CI). | No cambiar la revisión fiscal para cuadrar observaciones antiguas. |
| Gastos / facturas y justificantes | Buscar, asociar/reemplazar PDF, vista de gestoría, descargar PDF/Excel; evitar original huérfano tras error. | `full-flow-qa`, `expense-integral-browser-qa`, `ambiguous-write-browser-qa`. | Binarios ficticios en simulación; integridad real contrastada por referencias/huellas. |
| Gastos / pagos | Pagos parciales, estado y fecha, importes rectificativos, conservación de líneas al editar. | `expense-integral-browser-qa`; `expense-credit-browser-qa` y `historical-payment-browser-qa` (CI). | Confirmar cada operación contable real antes de escribir. |
| Clientes | Alta/edición, datos fiscales, uso desde facturación y directorio compartido. | `full-flow-qa`, lectura de permisos y renderizador; CI de referencias. | Hereda permisos de Facturación, no un permiso de contacto independiente. |
| Proveedores | Alta/edición, valores fiscales propuestos, dos directorios sincronizados con IDs conservados, bloqueo de borrado con usos. | `full-flow-qa`, `pricing-integral-browser-qa`; lectura real de integridad; SQL de directorios en CI. | Revisión real comprobó igualdad de identificadores, no la exactitud legal de cada ficha. |
| Marcas / familias | Directorio y referencias de Pricing; conservación de entidades ya utilizadas. | `pricing-integral-browser-qa`; CI de directorios y referencias. | Hereda permisos de Pricing. |

## Facturación, documentos e informes

| Área / sección | Operaciones y resultados comprobados | Evidencia principal | Límite o actuación |
|---|---|---|---|
| Facturación / borradores | Crear con líneas, cliente/tienda/serie, cálculos y relectura; nueva factura aún no guardada frente a borrador. | `full-flow-qa`; `stale-form-browser-qa` y `write-version-qa` (CI). | No se emitió factura real. |
| Facturación / emisión | Numeración resultante, series correctas y documento guardado; protección de factura emitida. | `full-flow-qa`; SQL de negocio e inmutabilidad en CI; lectura real de políticas restrictivas/triggers. | Concurrencia de numeración demostrada por pruebas aisladas, no por dos sesiones humanas de producción nuevas. |
| Facturación / externa | Original PDF obligatorio, vínculo y datos recuperables. | `full-flow-qa`, simulado. | No sustituir el original por una vista generada. |
| Facturación / proformas | Emitir, convertir a factura y conservar líneas sin duplicación. | `full-flow-qa`; `rectifying-browser-qa` y contratos de negocio (CI). | Conservación fiscal y numeración deben repetirse al migrar. |
| Facturación / rectificativas y cobros | Signos, devoluciones, referencia a factura, liquidación y no duplicar ingresos. | `rectifying-refunds-qa`, `rectifying-browser-qa`, `draft-income-qa` (CI); lectura de cálculos y triggers. | No se ha revisado la validez tributaria de cada caso real. |
| Facturación / clientes | Registro compartido, referencias inactivas en edición y datos del emisor congelados. | `full-flow-qa`, `deep-editing-browser-qa`; CI de emisor. | No duplicar el directorio al separar el módulo de contactos. |
| Facturación / plantillas y marca | Campos, logo, tipografía/datos del documento, guardar/reabrir, duplicación y cancelación; PDF/impresión usa el estado esperado. | `configuration-journeys-browser-qa`, `deep-editing-browser-qa`; `template-editor-browser-qa` (CI). | Se revisó el resultado funcional, no su apariencia estética. |
| Facturación / series | Tienda, tipo, año, siguiente numeración y conservación de referencias usadas. | `full-flow-qa`, `deep-editing-browser-qa`; CI de serie y factura externa. | Nunca reinstalar una serie con numeración reiniciada en una migración. |
| Documentos / carga individual | PDF, imagen y Excel; metadatos, huella/tamaño, relectura y descarga. | `full-flow-qa`; lectura real de documentos y espejo. | No se subieron originales nuevos reales. |
| Documentos / ZIP y lotes | Vista previa, selección, rechazo de duplicados y homónimos sin sobrescritura en ZIP de salida. | `full-flow-qa`; `attachment-integrity-qa` (CI). | Formatos no admitidos deben seguir dando error explícito. |
| Documentos / retirada | Retirar ficha/original por su circuito, archivar y reintentar; no borrar archivo comprometido tras respuesta perdida. | `ambiguous-write-browser-qa`; `deletion-flows-qa`, `document-removal-worker-qa` (CI); cola real sin pendientes. | No se purgaron archivos reales ni se probó restauración de cada documento. |
| Fiscalidad / filtros y modelos | Rango, trimestre y tienda; actualizar obtiene datos nuevos y conserva fechas; ajuste fiscal creado/editado. | `live-refresh-qa`, `full-flow-qa`; contratos de modelos en CI. | Exactitud normativa y presentación ante Hacienda no certificadas por pruebas de software. |
| Fiscalidad / pagos y periodos | Impuestos pagados sin duplicar gasto deducible, bloqueo de periodo cerrado y ajustes referenciados. | `tax-expense-browser-qa`, `report-period-qa`, pruebas SQL de negocio (CI). | Un periodo cerrado no se reabre como efecto de la auditoría. |
| Informes / periodo y tienda | Lectura de datos filtrados y exportación XLSX/CSV, conciliación con datos guardados. | `full-flow-qa`, `live-refresh-qa`; CI de periodos. | F-05 en el CSV específico del agente; no afecta a todos los constructores por igual. |
| Informes / paquetes | ZIP anual/mensual con diarios, originales, impuestos una sola vez, tienda inactiva y documento ausente indicado. | `annual-package-browser-qa`, `full-flow-qa`. | Prueba con datos ficticios; no nueva descarga completa de toda la contabilidad real. |

## Recepciones, colaboración y conexiones

| Área / sección | Operaciones y resultados comprobados | Evidencia principal | Límite o actuación |
|---|---|---|---|
| Recepciones / alta y edición | Referencia, proveedor, tienda, fecha, revisión y rechazo de guardado con revisión antigua. | `stock-browser-qa`, `stock-async-browser-qa`; SQL de stock en CI. | Mantener control de revisión al reintentar un trabajo de IA. |
| Recepciones / fuentes | Asociar factura/entrada, distinguir lados, hash, impedir fuente repetida y cruce indebido de tienda. | `stock-browser-qa`; SQL de stock y extracción en CI; lectura real de vínculos. | No se ha leído de nuevo todo el texto de cada documento real. |
| Recepciones / cotejo | Cantidades, conversiones, unidades, ajustes y correspondencias; sin datos no equivale a cero; cobertura de todas las fuentes. | `stock-core-qa`, `stock-workflow-qa`, `verified-extraction-qa` (CI y lógica); pruebas de stock en navegador. | F-09/F-10: no acredita cotejo remoto vivo de PrestaShop ni un cotejo largo nuevo por cada IA. |
| Recepciones / revisión y biblioteca | Revisión manual con justificación, conservar diferencias, correcciones auditadas y equivalencias confirmadas separadas. | Lectura de funciones instaladas y `stock-core.js`; SQL de stock en CI. | «Revisado» es una capa auditada sobre el resultado documental, no borrado de diferencias. |
| Recepciones / eliminar y exportar | Eliminar recepción conserva originales; CSV/HTML/Excel conservan estado, fuentes y correcciones. | `stock-browser-qa`; `stock-workflow-qa` y `receipt-layout-browser-qa` (CI, parte funcional). | No se eliminaron recepciones reales. |
| Tareas / calendario y lista | Alta, edición, repetición, responsable, tienda, checklist y estado por ocasión. | `tasks-browser-qa`. | No es un sistema de fichajes ni escribe contabilidad. |
| Tareas / archivo y borrado | Retirada, recuperación y purga, historial y documentos conservados. | CI de `tasks-recovery-db-qa`, `user-purge-browser-qa` para cuentas; lectura de contratos de tareas. | Las condiciones de purga de tarea se acreditan por CI SQL/contrato, no por borrar una tarea real ahora. |
| Chat / canales y personas | Abrir conversación, crear/editar/organizar, filtros, búsqueda, borradores, miembros, roles, archivo y retiradas. | `team-chat-browser-qa`, `chat-ai-target-browser-qa`; CI de navegación/privacidad. | No se enviaron mensajes reales en esta auditoría. |
| Chat / mensajes y archivos | Enviar, editar, responder, reacciones, adjuntar, quitar y reintentar; vínculo a tareas y descarga del original. | `team-chat-browser-qa`; CI de chat/adjuntos. | Push, audio del dispositivo y notificaciones reales con pantalla bloqueada requieren prueba en dispositivo. |
| Chat / zumbido y avisos | Respeto a silencio/preferencias y límites del destinatario, lectura y avisos aislados por cuenta. | `chat-buzz-browser-qa`, `chat-alerts-browser-qa` y `chat-auto-read-browser-qa` (CI). | No se hicieron sonar dispositivos de otras personas. |
| Chat / destinatario IA | Directo asociado a su usuario, proveedor propio, sin sustitución silenciosa por Cloudflare y cuentas retiradas fuera del directorio activo. | `chat-ai-target-browser-qa`, 100 pruebas de lógica, lectura de conexiones reales. | Activación y prueba corta no garantizan cada tarea; F-10. |
| Cuenta personal | Perfil/avatar, notas/documentos/enlaces de tareas, avisos y protección de cambios pendientes. | `account-workspace-browser-qa`; CI de perfiles SQL. | No se modificó el perfil de una persona real. |
| Configuración / Interfaz | Guardar por usuario, reapertura, preferencias y recursos; permisos de acceso. | `configuration-journeys-browser-qa`; CI de preferencias personales. | Sin revisión visual en esta entrega. |
| Configuración / Login | Marca/fondo guardados, carga pública limitada y tratamiento de recursos. | `configuration-journeys-browser-qa`; CI de apariencia/acceso. | No se cambiaron marca ni permisos anónimos reales. |
| Configuración / APIs | Crear, configurar, guardar, probar, duplicar sin clave, desactivar/eliminar; protección de cambios pendientes; alta/asignación de usuario. | `api-manager-browser-qa`, 100 pruebas de lógica; lectura real de configuración sin secretos. | No se enviaron nuevas claves ni se activó proveedor. |
| APIs / transporte | Destino HTTPS, rechazo de direcciones privadas, redirecciones, límites de cuerpo/tiempo; errores 401/422/429 sin secretos; revisión y presupuesto coherentes en prueba/trabajo. | `api-transport-qa`, `api-provider-qa`, `api-service-qa`, ejecutados de nuevo. | Defensa DNS/SSRF no equivale a un ensayo de red completo de un futuro servidor. |
| APIs / documentos | Identidad y permiso propios, lectura de original autorizado, tamaño/hash y entrega verificada, ausencia de documento no se inventa. | `agent-delivery-qa`, `verified-extraction-qa`, `cloudflare-tools-qa`, ejecutados de nuevo. | Formatos/lectores y cuotas externas conservan sus límites; no se realizó OCR externo nuevo. |
| APIs / código y servicios | Inventario real de operaciones; lectura de archivo GitHub mediante conexión del mismo usuario. | Lectura de `tools.ts`, `totus-connections` y pruebas del catálogo. | No hay mantenimiento arbitrario de GitHub/Supabase/OneDrive por asignar rol; F-09. |

## Administración e infraestructura

| Área / sección | Operaciones y resultados comprobados | Evidencia principal | Límite o actuación |
|---|---|---|---|
| Administración / usuarios | Crear, editar, asignar permisos, retirar, recuperar y purgar acceso; cuentas propias separadas. | `full-flow-qa`, `user-permissions-browser-qa`, `user-purge-browser-qa`, lógica y CI SQL. | Guardar identidad histórica no equivale a conservar acceso activo; no se borró cuenta real. |
| Administración / roles | Crear/editar/asignar, conservar códigos, contar usuarios y negar borrado si usado/sistema. | `full-flow-qa`, `user-permissions-browser-qa`; CI de roles. | Revisar privilegios efectivos de SQL aparte de los botones; F-06. |
| Administración / negocio y cajas | Tiendas/cajones y referencias históricas, configuración conservada. | `full-flow-qa`, `closing-integral-browser-qa`, `deep-editing-browser-qa`; CI de referencias. | No se cambió estructura real de tiendas. |
| Administración / fiscal | Parámetros e histórico, no recalcular documentación emitida al cambiar valores. | CI de `tax-expense-qa`, `invoice-issuer-qa`, lectura de cálculos y SQL. | No valida normativa ni selección fiscal humana. |
| Administración / almacenamiento | Lectura diferida, estado pendiente/válido/error, invalidación, sesión y verificación antes de subir. | CI `storage-lazy-browser-qa`, `storage-live-qa`; lectura de código y metadatos reales. | Métricas estimadas no son garantía de capacidad futura; F-07. |
| Administración / copias | Programar, generar por componentes, verificar, conservar diez solo tras nueva copia válida, errores/reanudación. | `full-flow-qa`, `recovery-browser-qa`; CI de copias; estado real cron/ejecuciones/OneDrive. | Verificación de metadatos no equivale a descargar/verificar todos los bytes ni restaurar Auth/Vault. |
| Administración / recuperación | Resumen, confirmación escrita, cancelar sin escribir, punto anterior, proceso y relectura. | `recovery-browser-qa`; SQL y pruebas de transporte en CI. | No se restauró producción ni una infraestructura completa nueva; F-08. |
| Administración / Log | Filtros por fecha/actor/área, actualización, CSV completo, detalle y limpieza acotada; error no equivale a «sin eventos». | CI de `audit-register-browser-qa`, `audit-lazy-browser-qa`, `log-cleanup-browser-qa`; lectura de código. | El Log funcional no gestiona `cron.job_run_details`; F-04. |
| Supabase / seguridad | RLS, políticas permisivas/restrictivas, privilegios de funciones, search_path, buckets privados y ausencia de definer público anónimo. | Consultas reales de catálogo y asesores; CI SQL. | Avisos y privilegios redundantes requieren consolidación probada, F-06/F-14. |
| Supabase / integridad | Vínculos de líneas, documentos y fuentes; directorios compartidos; huellas y metadatos del espejo. | Consultas reales agregadas. | No se realizó peritaje de cada asiento/documento. |
| Supabase / servicios | Fuente desplegada frente a repositorio, nombres RPC usados y versiones. | Comparación de siete despliegues/70 archivos y 88 nombres RPC. | Argumentos construidos dinámicamente necesitan las pruebas de su recorrido; no basta presencia por nombre. |
| GitHub / versión y entrega | Rama correcta, CI aprobado de base y publicación con commit exacto. | Git y ejecución 41541616729. | Protección del repositorio ausente, F-03. |
| GitHub / trabajo antiguo | Alcance de las ramas respecto a producción y material generado separado del código. | Inventario de ramas y archivos versionados. | No eliminar commits únicos sin contraste; F-13. |
| OneDrive / organización | Ubicación de aplicación, originales, copias, chat, manuales y archivo; raíz sin entrada anónima observada. | Conector personal: listado y permisos raíz. | No se certificaron todas las ACL particulares; no se movieron carpetas administradas. |
| Servidor privado | Dependencias, configuración, identidad, cron, autorizaciones y secuencia de migración inventariados. | [Plan de migración](../MIGRACION_SERVIDOR_PRIVADO.md). | Instalación desde cero y restauración integral pendientes: F-02/F-08. |

## Evidencia conservada

- Resultado nuevo de navegador: `artifacts/functional-audit/results.json` y registros por suite (datos ficticios).
- Pruebas de lógica: registro privado con 100 aprobadas, cero fallos.
- Inyección de fallo de SDK: `tools/audit-startup-outage.mjs`; informe privado de excepción y falta de reintento.
- Lecturas de producción: catálogos y resultados privados, separados del repositorio público.
- [Informe y prioridades](AUDITORIA_FUNCIONAL_2026-11-03.md).

La lista sirve como base de regresión para futuras intervenciones: ejecutar el recorrido afectado y sus consumidores, no repetir una auditoría total por cada arreglo pequeño.
