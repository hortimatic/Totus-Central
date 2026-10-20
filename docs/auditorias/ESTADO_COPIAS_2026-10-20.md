# Estado de estabilización — 20/10/2026

Solo staging. Este informe no certifica todavía la puesta en producción.

## Comprobado con servicios reales

- Carpeta activa única: Apps / TotusCentral Staging. La carpeta manual vacía se envió a la papelera; no se vació la papelera.
- 452 documentos replicados con metadatos completos y sin diferencias de ruta, tamaño ni SHA-256 en el índice verificado.
- Una copia nueva completa se creó correctamente con 454 archivos y 4.854 registros. Se verificaron sus fragmentos en Supabase y se completó la réplica de sus 12 objetos en OneDrive.
- Se volvió a leer la copia nueva desde OneDrive y pasó el ensayo de datos en tablas temporales: 38 tablas, 57 relaciones, sin modificaciones a las tablas contables reales.
- La rotación conserva cinco copias en Supabase; dos son completas de formato v3 y tres son históricas anteriores. No confundirlas con cinco copias nuevas del estado actual.
- Inicio muestra las tres aperturas por caja y fecha del último cierre. El filtro real de septiembre en Cajas devuelve 48 registros aceptados, con tarjeta, retiradas y efectivo visibles.

## Correcciones aplicadas

- Se verifica la huella completa de la copia anterior antes de reutilizar sus originales; la base de datos siempre procede de una instantánea nueva. Cada original vuelve a comprobarse al crear el archivo nuevo.
- Los PDF e imágenes se conservan en el ZIP sin recomprimirlos; se comprimen datos y manifiesto. Se evitan cientos de peticiones repetidas al almacenamiento.
- Reintentos limitados ante saturación o errores transitorios HTTP 429/500/502/503/504; los demás errores se muestran directamente. Se registra la fase de preparación sin contenido privado.
- Se ensaya el contenido de las tablas y sus relaciones en tablas temporales. La restauración contempla limpiar el índice derivado de documentos de OneDrive para evitar el bloqueo por claves foráneas.
- Las pruebas de geometría abren el detalle técnico de Almacenamiento antes de medir controles plegados.

## Pendiente antes de limpiar los originales

1. Adaptar y probar lectura principal, vista previa, descarga individual, ZIP de documentos, documentos de gestoría y creación de copias desde OneDrive.
2. Resolver eliminación/sustitución de adjuntos y permisos de lectura/escritura por rol para el proveedor nuevo.
3. Comprobar recuperación integral independiente, continuidad de la conexión y capacidad superior al límite actual del archivo de respaldo.
4. Retirar los duplicados de Supabase únicamente después de comprobar contenido, referencias y proveedor activo. No borrar base de datos, usuarios, permisos o secretos: OneDrive no los sustituye.
5. Repetir el cálculo de capacidad tras la limpieza. La réplica por sí sola no libera almacenamiento.

Las pruebas simuladas y la creación real correcta son evidencias diferentes. Un ensayo temporal no equivale a recuperar un proyecto completo tras perder su infraestructura. La lista de peticiones está en PETICIONES_Y_CIERRE_2026-10-20.md; los puntos abiertos no deben anunciarse como terminados.
