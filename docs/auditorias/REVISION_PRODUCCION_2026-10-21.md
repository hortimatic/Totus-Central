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

- Renombrar la propia rama staging a totus-central y convertirla en la rama principal. No fusionar ni copiar la aplicación al main obsoleto; la propuesta anterior quedó cerrada sin fusionar.
- Publicar solo https://hortimatic.github.io/Totus-Central/ desde totus-central, con batería completa obligatoria antes del despliegue y comprobación posterior del commit servido.
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


## Actualización de dirección · 22/10/2026
El titular confirma que se elimina lo antiguo conservando las diez copias de seguridad y la programación nocturna de Totus Central. La propia rama staging se renombró totus-central y se estableció como principal; la propuesta de fusionarla en main se cerró sin fusionar. Los proyectos y archivos de la contabilidad actual no se reemplazan. Las comprobaciones de publicación y la retirada del proyecto antiguo se registrarán cuando hayan concluido; no confundir esta preparación con su finalización.

## Resultados comprobados · 22/10/2026
- La propia rama se llama `totus-central` y es la predeterminada. La colección de ramas de GitHub devuelve exclusivamente esa rama. `main` se retiró; su historial no se fusionó sobre la aplicación ni se reescribió.
- Publicación 460c03655a64a7f92436e3080bed43e8d7fef70f: ejecución [39750756887](https://github.com/hortimatic/Totus-Central/actions/runs/39750756887), trabajo QA 119730437819 y publicación 119732955469, ambos correctos. Incluye comprobación del commit realmente servido y del contrato de producción.
- La dirección raíz muestra Totus Central, versión 460c0365. Se ha comprobado el acceso autenticado con los mismos registros. El enlace /staging/ redirige a la raíz y no publica otra aplicación.
- GitHub Pages admite publicar únicamente desde `totus-central`; se retiraron las reglas de ramas obsoletas. No se ampliaron permisos.
- Supabase Site URL pasó de localhost a la dirección raíz. La función team-admin versión 7 usa esa dirección para invitación y recuperación, conservando validación de sesión y administrador.
- El proyecto antiguo zwkpmjjuurgjygcrejiw se volvió a inventariar sin movimientos contables; tras confirmación específica del titular fue eliminado. La lista de proyectos devuelve únicamente awmojepsasikxocoeqtu, Totus Central, ACTIVE_HEALTHY.
- El registro existente de Microsoft se llama Totus Central. Conserva su client ID y su carpeta; no se recreó la conexión ni se ampliaron permisos. La función OneDrive versión 26 cambia solo la etiqueta de auditoría del entorno.
- Verificación real de la copia nocturna 0e8d187b-0aa5-4781-a947-66aa222036b3, guardada en OneDrive el 22/10 a las 00:35 Madrid: 99.276.323 bytes, 5.163 registros y 483 archivos. Resultado verified=true, 38 tablas, 57 relaciones, ensayo en tablas temporales sin escrituras contables. Se comprobaron huella y lectura íntegra de archivos.
- Inventario actual: 584 gastos, 482 cierres, 481 documentos y dos cuentas. Los 481 documentos tienen verificación y retirada de su duplicado pesado de Supabase; cero tareas de retirada pendientes, cero referencias documentales rotas y cero líneas de gasto huérfanas. Todas las tablas públicas mantienen RLS.
- Cajas conserva tarjeta visible, retiradas, efectivo por cajón, estados y Ver detalle. Inicio conserva el efectivo de apertura separado de Vape y Head de Hortimatic y de NewOldSmok.
- Se abrió desde Gastos el original del alquiler de Azuqueca en OneDrive, sin descarga local. El alquiler de Alcalá conserva su proveedor, documento y tienda propios. No se cambiaron facturas ni importes durante esta transición.
- Informes con 01/07–30/09 muestra julio, agosto y septiembre para las dos tiendas. Se restauró la vista del mes actual al terminar. Fiscalidad mantiene desglose de ingresos y control interno separado.
- Retención configurada: máximo diez copias completas; actualmente ocho tras la prueba manual, no diez archivos artificialmente duplicados. Copia diaria 00:35 Europe/Madrid activa en servidor. Ningún proceso depende de este portátil.
- Revisión del mantenimiento de Microsoft: la credencial vigente caduca el 18/04/2027. Renovarla antes de esa fecha mediante el procedimiento seguro de Administración; no se modificó ni se exportó su valor.

### Limpieza residual y validación final
Las funciones auxiliares antiguas `team-confirm-user` y `totus-staging-preview` no aparecen invocadas en ninguno de los 30 módulos JS/JSON actuales de src. El entorno GitHub Preview no tiene secretos ni variables. Su retirada específica se ha sometido a confirmación; no registrar como eliminados hasta comprobarlo.
Los informes históricos y migraciones siguen siendo trazabilidad de esta misma aplicación, no instalaciones separadas. No reescribir el historial Git ni borrar fuentes fiscales para ocultar nombres antiguos.
La prueba de exportaciones y cargas se ejecutó en la batería aislada de GitHub Actions; no se añadieron operaciones ficticias ni descargas al equipo dentro de la contabilidad real.

### Prueba manual posterior a la publicación
Desde Administración → Copias se creó la copia 46c7906c-160e-4dcf-ae27-cd9f76687e61 el 22/10 a las 11:13 Madrid. Terminó correctamente a las 11:14:16, guardada directamente en OneDrive, con 99.276.351 bytes, 5.164 registros y 483 archivos. La interfaz muestra ocho de diez copias y permite continuar trabajando mientras se prepara. Prueba de archivo sintético de OneDrive completada a las 11:12:30, incluyendo escritura, relectura y traslado reversible; no se utilizó un documento fiscal de prueba ni se guardaron archivos en el portátil.

La verificación iniciada desde la propia interfaz de esa copia manual terminó correctamente: SHA-256 comprobada, 38 tablas, 5.164 registros y 483 archivos. La aplicación mostró «Copia de seguridad verificada»; no se restauró ningún dato real.

### Incidencia adicional detectada en la revisión real de usuarios
Al editar la etiqueta del administrador, el navegador autocompletó los campos de tienda y contraseña. El flujo anterior actualizaba la ficha antes de rechazar una contraseña opcional demasiado corta. Se restableció la tienda vacía y se comprobó en el registro del servidor que no hubo asignación de contraseña ni cambio de rol o permisos; el nombre visible quedó Administrador Totus Central.
Se preparó una corrección mínima, comunicada antes de modificar código: indicadores de no autocompletado en tienda y de nueva contraseña en credenciales; validación previa a cualquier escritura de la ficha. La estructura del formulario se conserva. Se añadió regresión que ejecuta la función real y comprueba cero escrituras ante contraseña inválida, tanto al crear como al editar, y que renombrar solo invoca la actualización de ficha. La publicación mantiene la batería completa como requisito; comprobar su resultado antes de dar esta corrección por desplegada.
