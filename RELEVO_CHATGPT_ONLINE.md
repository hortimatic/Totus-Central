# TotusCentral: relevo para trabajar desde ChatGPT online

## Punto de entrada

Código y documentación: repositorio `hortimatic/Totus-Central`, rama `staging`.
Aplicación: https://hortimatic.github.io/Totus-Central/staging/
Datos de pruebas: proyecto Supabase `awmojepsasikxocoeqtu`.
No modificar `main` ni producción sin autorización expresa del titular.

Este documento no contiene contraseñas, claves secretas ni documentación fiscal privada. No subir esos materiales al repositorio público.

## Qué debe funcionar con todos los ordenadores apagados

- Web estática: GitHub Pages.
- Contabilidad, cajas, gastos, facturas, usuarios, permisos y configuración: Supabase Database.
- Documentos originales: contenedor privado `business-documents` de Supabase Storage.
- Logos: `business-assets`.
- Copias y fragmentos: `business-backups`.
- Programación nocturna: Supabase Cron y función `totus-backup-run`. Todos los días a las **00:35, Europe/Madrid**. La hora se adapta al cambio de horario de España.
- Conservar como máximo las diez copias completadas más recientes. Después de verificar una nueva, retirar la más antigua con sus fragmentos. Los puntos de vuelta de una recuperación están protegidos y no se confunden con copias ordinarias.

No instalar ni usar el programador de tareas de Windows, un servidor local o rutas del portátil para trabajos nocturnos. No contratar planes de pago. Si el plan gratuito impide una operación, comunicar el límite real.

## Acceso desde ChatGPT online

El chat debe disponer de una conexión autorizada a GitHub y a Supabase. Comprobar primero que puede leer este repositorio y el proyecto correcto; después, verificar qué acciones de escritura tiene disponibles. Una conexión de solo lectura no permite mantener la aplicación. No suponer que las sesiones o archivos de un ordenador se heredan automáticamente.

Usar herramientas remotas y autenticación del proveedor. No pegar claves `service_role`, secretos de Vault ni contraseñas en el chat o en documentos. Mantener los permisos existentes; ampliarlos requiere autorización del titular.

Referencia oficial: https://learn.chatgpt.com/docs/plugins (los servicios conectados requieren sus permisos y autenticación, también desde la web).

## Antes de trabajar con datos

1. Confirmar entorno staging y estado de la última copia. Tener un archivo guardado no demuestra por sí solo que incluya los datos actuales o que una restauración haya sido ensayada.
2. Consultar Administración → Copias: última guardada, último intento, archivos incluidos y avisos. Los intentos fallidos o sin finalizar no son copias disponibles y no deben llenar el listado de copias guardadas. El último resultado sí debe mostrarse con veracidad.
3. Consultar Almacenamiento: documentos, logos y copias comparten el espacio de archivos. La base de datos tiene cuota aparte. El margen calculado para este proyecto no demuestra el libre global de la organización.
4. No ejecutar ensayos de restauración, truncados, reinicios del servidor ni grandes importaciones mientras el usuario trabaja.
5. No introducir octubre automáticamente: el titular quiere aprender introduciendo manualmente el cuarto trimestre.

## Reglas de trabajo diario

### Cajas

- Hortimatic/Azuqueca tiene dos cajas: Vape y Head. «Smoke» en las fuentes históricas corresponde a Head.
- NewOldSmok/Alcalá se controla por separado. No mezclar los Excel ni sus capturas.
- La apertura es el efectivo dejado por el cierre anterior en **esa misma caja**. Mostrar por separado apertura, ventas, cobros con tarjeta, retiradas de efectivo y efectivo que queda para el día siguiente.
- El Excel histórico anota los abonos de tarjeta el día de entrada en banco, normalmente al día siguiente de la venta. No trasladar esa fecha sin contrastar con el cierre.
- Las retiradas de Hortimatic pueden salir de ambas cajas: no repartir arbitrariamente un total de tienda.
- Los ingresos históricos mensuales no se suman otra vez al aceptar un cierre ya incluido. Evitar duplicar ventas.

### Gastos y documentos

- Buscar primero si existe el gasto, la factura o el documento antes de insertar.
- Contrastar factura original y Excel. Conservar importes, fechas y números originales; no ajustar cifras para forzar coincidencia con gestoría.
- Asociar cada justificante al gasto correspondiente y comprobar su vista previa desde Supabase.
- Los abonos de proveedor reducen gastos; no convertirlos en compras positivas.
- Nóminas, Seguridad Social y autónomos deben tener su tratamiento fiscal y justificantes. Evitar duplicar el pago neto de nómina con su gasto bruto.
- Almacén y horas extra clasificados como internos se muestran aparte: no reducen el beneficio fiscal empleado para prever IRPF.

### Facturación y fiscalidad

- Un único titular autónomo para las dos tiendas, una numeración fiscal correlativa y el logo del establecimiento correspondiente.
- Tomar identidad y domicilio de la configuración fiscal verificada, no de valores inventados ni de rutas locales.
- La previsión propia debe calcularse desde ingresos y gastos deducibles, con los acumulados y pagos anteriores que correspondan. Las cifras de gestoría se usan para contraste, no para sustituir el cálculo.
- Distinguir previsión, declaración presentada y pago efectivamente realizado. No registrar una referencia comunicada como pago bancario.
- El alquiler de Azuqueca es el que tiene la retención de alquiler indicada por el titular. No confundir retención del modelo 115 con IVA.
- Los tres primeros trimestres históricos han sido aceptados por el titular. No reabrirlos ni cambiar sus cifras para cuadrar diferencias sin explicación y autorización.

## Cambios de código y comprobación

Trabajar en `staging`, mantener migraciones y funciones del servidor en el repositorio y ejecutar las pruebas pertinentes. Comprobar el resultado de GitHub Actions y la versión publicada: un commit no significa que la web ya esté actualizada.

Comprobar también el flujo real con sesión autorizada: guardar, volver a abrir, vista previa, descarga y permisos. No afirmar «todo revisado» a partir de simulaciones únicamente.

## Limpieza y continuidad

Los datos necesarios para trabajar deben estar en Supabase y el manual/código en GitHub. Los archivos locales de auditoría son material de trabajo transitorio, no parte de la infraestructura. Antes de retirarlos, comprobar qué contienen y si su conservación remota está verificada. No borrar fuentes originales del titular ni espejos sincronizados protegidos.

Al finalizar cada intervención, actualizar este documento si cambian horarios, destinos, límites o procedimientos. Dejar constancia de comprobaciones reales y pendientes; no ocultar fallos antiguos convirtiéndolos en éxitos.

## Última prueba nocturna verificada

La programación de las 00:35 Europe/Madrid se ejecutó en Supabase el 20/10/2026 sin intervención del portátil y terminó correctamente. Se contrastó que incluyera todos los documentos actuales y que la rotación mantuviera diez copias guardadas. Esto verifica creación, inventario y transporte; no equivale a un ensayo de restauración en producción.

Cada copia guardada dispone de Eliminar con confirmación. Solo el administrador puede hacerlo; el servidor protege la última copia y las vinculadas a recuperaciones. Las copias retiradas y los fallos antiguos no deben mostrarse como elementos disponibles. Los registros técnicos conservan el resultado verdadero.

## Estimación de espacio y limpieza

Administración → Almacenamiento incluye una simulación que usa la referencia privada de nueve meses guardada en la configuración. Debe contar el crecimiento de originales, la sustitución de copias históricas pequeñas por cinco copias completas actuales y el espacio temporal de la nueva copia antes de retirar la antigua. El límite de archivo de Totus y la cuota de Storage son límites separados. No convertir el espacio de este proyecto en una promesa de espacio libre global de la organización.

Descargar no libera espacio; eliminar copias antiguas no elimina los datos actuales, pero la programación vuelve a generar hasta cinco. No proponer borrar facturas o justificantes vinculados para ampliar capacidad. Una exportación Excel no sustituye sus documentos originales. No extrapolar la base de datos sin una referencia comparable.


El titular ha reducido la conservación a cinco copias completas el 20/10/2026. La programación sigue a las 00:35 Europe/Madrid. MAX_SAVED_BACKUPS es la referencia común del servidor, interfaz y simulación; no confundir el campo heredado retention_days con borrado por antigüedad.
