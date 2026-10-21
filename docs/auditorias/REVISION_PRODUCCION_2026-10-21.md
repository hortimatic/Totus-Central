# Revisión y transición de Totus Central · 21/10/2026

## Alcance y autorización

El titular solicita una única instalación de producción con el nombre Totus Central. Exige conservar estructura, pantallas e información y avisar antes de cualquier modificación. La revisión inicial es de lectura; las tres correcciones y el plan de transición se comunicaron antes de preparar cambios.

Versión de partida: 2543a93e2650e1593e564a2ddf50da55269aa4ac. La base contable actual es awmojepsasikxocoeqtu y se conserva, junto con identidades, permisos, documentos, conexiones y programación.

## Evidencia de revisión inicial

- Batería completa relanzada en GitHub Actions, ejecución 39515053428, intento 2, trabajo 119410495198: completada correctamente. Cubre sintaxis e importaciones, inventario de acciones, cálculos, permisos simulados, cierres, gastos, facturación, rectificativas, filtros, informes, Excel, PDF, logos, copias, recuperación y recorridos/geometría de navegador. Las pruebas usan datos aislados y no alteran la contabilidad.
- Funciones desplegadas de copias, OneDrive y recuperación coinciden con las fuentes de GitHub y sus dependencias. La función de equipo coincide tras normalizar saltos de línea.
- Verificación real desde la interfaz de la última copia nocturna de OneDrive: integridad SHA-256 correcta, 38 tablas, 5.115 registros y 483 archivos; ensayo de filas y relaciones, sin restauración sobre tablas contables.
- Prueba real de guardado, relectura y traslado recuperable de un archivo sintético en la carpeta de conexión de OneDrive: correcta. No se utilizaron datos personales en la prueba.
- Inventario de documentos actual: todos los documentos tienen ubicación verificada; no se encontraron líneas de gasto o cajas huérfanas, vínculos de gasto rotos, duplicados de cierre por tienda/fecha ni números de factura recibida duplicados por identificación fiscal.
- Todas las tablas públicas tienen RLS activo. Los avisos sobre funciones SECURITY DEFINER requieren evaluar los controles internos; no constituyen por sí solos una vulnerabilidad. Las tablas privadas del proveedor no tienen políticas cliente deliberadamente.
- Copias automáticas activadas a las 00:35 Europe/Madrid, conservación configurada en diez. La copia nocturna más reciente terminó correctamente. Se conserva la distinción entre intentos fallidos y copias completas.
- Lectura autenticada real de PDF desde su gasto, incluyendo el alquiler de Alcalá; el visor muestra el original y sus controles. No se guardaron descargas ni código local.
- Fiscalidad muestra ingresos, desglose de tarjeta/efectivo, gastos deducibles, control interno y previsión propia. El histórico protegido sigue hasta 30/09/2026. La aceptación histórica no se transforma en pagos supuestos ni se usa para ajustar cifras.

## Correcciones puntuales comunicadas

1. Proteger documentos usados por pagos de impuestos aunque una ficha antigua no tenga vínculo inverso. Evita retirar un archivo antes de que el servidor rechace borrar su ficha referenciada.
2. Escapar el número de factura del título de impresión. La vista y los datos fiscales se mantienen; el texto no se interpreta como HTML.
3. Conservar filas y columnas del Excel detallado de Gastos, aclarar que su total de registros incluye apuntes de pago y añadir subtotales sin duplicados, fiscales e internos. No modifica operaciones, importes almacenados ni previsiones fiscales.

Se añaden pruebas específicas de los tres casos, además de la batería existente.

## Plan de publicación

- Sustituir la versión antigua de main por el árbol revisado, preservando ambas historias Git.
- Publicar solo https://hortimatic.github.io/Totus-Central/ desde main, con batería completa obligatoria antes del despliegue y comprobación posterior del commit servido.
- /staging/ conserva únicamente una redirección a esa aplicación; mantiene parámetros y fragmentos para enlaces de acceso antiguos.
- Mantener el mismo identificador de Supabase y el mismo identificador de aplicación y carpeta de Microsoft. Renombrar sus etiquetas visibles no exige copiar datos ni ampliar permisos.
- Actualizar el retorno de recuperación de usuarios a la dirección principal.
- Retirar el proyecto Supabase antiguo solo después de inventario, verificación final y confirmación específica de su eliminación irreversible.

## Inventario del proyecto antiguo

El proyecto zwkpmjjuurgjygcrejiw no contiene gastos, cierres, documentos, facturas emitidas, productos ni movimientos de precios o consultas. Conserva configuración inicial, dos perfiles y miembros, catálogos, series, cajas, tiendas y un archivo de logo. No contiene la contabilidad actual. No se ha eliminado durante la revisión ni se presenta como una copia de la contabilidad actual.

## Límites y pendientes que no se ocultan

- La validación inicial no equivale todavía a verificar la nueva URL de producción ni a haber retirado el proyecto antiguo. Comprobar resultados de la revisión publicada y registrar la finalización.
- Quedan operaciones con documentos pendientes o diferencias de pago ya identificadas. No asociar facturas por suposiciones ni marcar pagos como cotejados para quitar avisos.
- El libro/Excel de referencia adjunto a un pago de impuesto no sustituye su justificante bancario. El titular puede añadirlo en la misma ficha, sin duplicar gasto.
- La previsión del modelo 130 no es una presentación telemática ni cubre automáticamente todas las casillas personales. Las instrucciones de la AEAT distinguen acumulados, retenciones, anticipos y otras minoraciones: https://sede.agenciatributaria.gob.es/Sede/impuestos-tasas/impuesto-sobre-renta-personas-fisicas/modelo-130-irpf______esionales-estimacion-directa-fraccionado_/instrucciones.html
- Las copias de aplicación v3 son recuperables en el mismo proyecto y no contienen contraseñas, secretos ni toda la infraestructura externa. La reconstrucción total de otro proyecto es una operación distinta.
- El formato de copia admite 120 MiB y 128 MiB expandidos; vigilar su aviso de crecimiento aunque OneDrive disponga de espacio. No prometer capacidad ilimitada ni contratar ampliaciones.
- La protección nativa de contraseñas filtradas no está habilitada en el plan actual. No se reduce ningún control para eliminar avisos. Referencia: https://supabase.com/docs/guides/auth/password-security
- Los informes históricos fechados conservan sus resultados originales. El código de migraciones no se borra por contener nombres antiguos: forma parte del procedimiento de recuperación.

La aceptación operativa se basa en resultados concretos; no se promete ausencia absoluta de fallos futuros. Ante una incidencia, conservar originales e historial, aislar la operación afectada y usar los procedimientos de copia y recuperación.
