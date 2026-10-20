# Informe de revisión y estabilización · TotusCentral
Fecha: 20/10/2026. Alcance: staging. Main y producción no se han modificado.

## Resultado comprobado
La lectura principal de originales y las copias completas verificadas utilizan OneDrive. Supabase conserva la contabilidad, usuarios, permisos, referencias, programación, logos y archivos privados necesarios. El funcionamiento del servidor no depende del portátil.
Se conservaron 547 gastos, 449 cierres y 452 documentos. Los 452 originales están verificados en OneDrive y no quedan objetos duplicados en business-documents de Supabase.
Hay cuatro copias completas modernas verificadas en OneDrive, con un máximo ordinario de cinco. La última se creó directamente en OneDrive en unos 100 segundos e incluye 454 archivos y 4.873 registros (85.060.370 bytes). No escribió fragmentos en Supabase: solo un índice pequeño. Se retiraron los fragmentos duplicados de las tres anteriores y las dos copias antiguas sin inventario/huella, después de disponer de sucesoras verificadas.
En la medición de cierre, Supabase conserva unos 33,1 MiB de archivos y 49,8 MiB del conjunto de bases de PostgreSQL (unos 35,3 MiB corresponden a la base de la aplicación). Los archivos restantes son dos logos, cuatro índices pequeños, el relevo privado y dos puntos de una recuperación anterior. No se han borrado como si fueran residuos.

## Cambios y protección de datos
- Lector único para vistas previas, originales asociados a gastos, descargas y exportaciones. Se resuelve el proveedor real con la sesión y las políticas del usuario; los enlaces privados son temporales y HTTPS.
- Tamaño y SHA-256 comprobados. Un documento recién subido o sustituido puede leerse desde Supabase mientras se verifica su copia. Un índice antiguo no abre un archivo distinto.
- Los originales retirados o sustituidos se conservan en una carpeta recuperable de OneDrive. La revisión automática rechazó su eliminación automática por riesgo de perder la única copia; se implementó archivo recuperable mediante traslado.
- Retirada de duplicados de Supabase condicionada a originales y copia completa verificados. Reservas compartidas impiden limpiezas simultáneas y recuperación durante una retirada.
- Las copias se escriben por fragmentos comprobados; el índice se publica al final. La lectura anterior autenticada permite reutilizar originales inmutables sin repetir procesamiento.
- Las nuevas copias se envían directamente a OneDrive con sesiones de subida del permiso AppFolder ya concedido. Un verificador separado relee los fragmentos; Supabase conserva solo el índice pequeño. Se evita el recorrido diario del ZIP por Supabase Storage que consumía transferencia gratuita.
- Creación, traslado de copias anteriores y retirada de fragmentos tienen ejecuciones separadas. La tarea de mantenimiento existente continúa el progreso; no se añadió otro horario de copias.
- Recuperación adaptada a originales de OneDrive. Se conserva el índice documental al reconstruir tablas y se archivan los archivos que ya no se reutilizan.
- Validación SQL por conjuntos: evita analizar el mismo listado completo una vez por documento. Se probaron referencias, huellas y tamaños incorrectos.
- La interfaz distingue volumen lógico, uso físico de Supabase y proveedor de cada copia. Los intentos interrumpidos no cuentan como copias guardadas.

## Pruebas reales
1. PDFs de ambas tiendas abiertos; uno se abrió después de retirar su duplicado de Supabase.
2. 452 retiradas documentales comprobadas, sin errores ni cambios de recuentos contables.
3. Copia nueva completa creada; trasladada a OneDrive, leída íntegramente y sometida al ensayo de 38 tablas y 57 relaciones antes de liberar sus fragmentos.
4. Simulación de 112 MiB: creación por fragmentos en unos 16 segundos y lectura/integridad en unos tres segundos, en ejecuciones separadas. Se retiraron los 16 objetos sintéticos y se comprobó que no quedaron archivos de esa simulación.
5. Recuperación SQL completa con reversión y límite de ocho segundos. Se conservaron las 452 ubicaciones de OneDrive y no quedaron trabajos de prueba.
6. Rechazo de huella incorrecta, tamaño incorrecto, ruta preparada inexistente e índice documental desactualizado.
7. Las 17 funciones privilegiadas expuestas a cuentas identificadas rechazaron una identidad sin membresía activa. Ninguna función privilegiada pública es ejecutable por anon.
8. Limpieza de copias obsoletas: dos retiradas, tres copias modernas conservadas inicialmente, sin advertencias; retirada de fragmentos huérfanos de intentos anteriores. La prueba del nuevo circuito directo añadió una cuarta copia completa, sin duplicar sus partes en Supabase.

9. Copia directa real de 85.060.370 bytes: cero partes en Supabase, 12 archivos de copia verificados en OneDrive (índice y 11 fragmentos), lectura completa independiente y ensayo de 38 tablas/57 relaciones aprobados.

Las primeras pruebas descubrieron límites reales de memoria/CPU y una validación de recuperación excesivamente costosa. Un ensayo agotó la conexión y staging requirió reinicio. Los recuentos se comprobaron después; la validación se corrigió y los ensayos posteriores terminaron correctamente. Esas incidencias no se presentan como pruebas aprobadas.

## Pruebas automáticas y visuales
La batería completa de [GitHub Actions](https://github.com/hortimatic/Totus-Central/actions/workflows/qa.yml) incluye estructura, sintaxis, inventario de acciones, permisos, cierres históricos, pagos, fiscalidad, filtros, libros mensuales, formato de gestoría, facturas, rectificativas, originales, copias y recuperación.
Incluye recorridos de navegador, escritorio/tableta/móvil, geometría, modales y campos cumplimentados. Las simulaciones usan datos de prueba; no equivalen a ejecutar cada operación destructiva sobre la contabilidad real.
Las pruebas nuevas cubren sesiones de subida directas, confirmaciones de ruta/tamaño/SHA-256, rechazo de transferencias incompletas y sobredimensionadas, protección de copias en preparación, lector de OneDrive, archivo recuperable, retirada de duplicados, reservas, rotación protegida, fallos de transferencia, archivo de 112 MiB y reutilización de fuentes autenticadas. Consultar el resultado asociado a la revisión publicada.

## Peticiones anteriores conservadas
El [registro numerado](PETICIONES_Y_CIERRE_2026-10-20.md) mantiene cajas por cajón, apertura diaria, ventas/tarjeta/retiradas visibles, histórico aceptado, previsión fiscal independiente, gastos internos separados, emisor único, logos por tienda, informes mensuales, columnas de gestoría, proveedores, filtros, registro de cambios e interfaz.
No se importó octubre ni se alteraron cifras para coincidir artificialmente con gestoría. El titular continúa la entrada manual de octubre.

## Seguridad y límites explícitos
Los asesores no mostraron avisos ERROR. Hay seis avisos informativos por tablas de OneDrive cerradas a clientes y accesibles solo al servidor: [explicación del aviso](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
Las 17 funciones SECURITY DEFINER accesibles a usuarios identificados tienen controles de permisos; se comprobó la denegación real. Se conserva el aviso de asesor como revisión de diseño, sin desactivar funciones necesarias: [criterio del asesor](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
La protección nativa contra contraseñas filtradas requiere Pro o superior y no se contrató: [documentación oficial](https://supabase.com/docs/guides/auth/password-security).
El formato actual admite 120 MiB de copia y 128 MiB expandidos. La prueba de 112 MiB cubre el volumen estimado de un año fiscal al ritmo observado; la advertencia de crecimiento debe atenderse antes del límite. El espacio de OneDrive no elimina los límites del procesador o del formato.
La transferencia mensual tiene una cuota distinta del espacio. El circuito directo reduce las lecturas de Supabase Storage, pero el uso normal y las operaciones extraordinarias siguen debiendo vigilarse: [cuota de transferencia](https://supabase.com/docs/guides/platform/manage-your-usage/egress).
La copia es de aplicación y del mismo proyecto: no incluye contraseñas ni secretos de infraestructura. La reconstrucción completa de otro proyecto/cuenta y sus identidades es distinta de los ensayos realizados. No se declara certificada esa reconstrucción ni una disponibilidad ilimitada de proveedores gratuitos.

## Entrega y uso
[Manual operativo para ChatGPT online](../MANUAL_CHATGPT_ONLINE.md) y [punto de entrada](../../RELEVO_CHATGPT_ONLINE.md).
Los cuatro documentos de entrega se sincronizan y releen en OneDrive → 04 Manuales y funcionamiento. El material fiscal privado permanece fuera del repositorio público.
No se guardaron nuevas carpetas de trabajo, descargas ni credenciales en este portátil. El paso a main/producción requiere una operación posterior autorizada, con su configuración y comprobación propias.

## Revisión posterior de Almacenamiento
Se agrupa la información por servicio, manteniendo capacidades, previsiones, ubicación y diagnóstico. Las secciones abiertas se conservan al actualizar. La conservación deja de estar fijada en cinco: la configuración admite de una a diez copias y se comparte entre el guardado, la rotación de Supabase y la rotación de OneDrive. La ampliación no elimina datos ni crea copias adicionales de forma artificial. Se añaden pruebas de persistencia, valores inválidos, conservación de diez, protección de recuperaciones y geometría de las tarjetas.


## Corrección de presentación
La primera organización por tarjetas fue rechazada por el titular por exceso de altura, repetición y confusión entre previsiones de espacio y límite técnico de copia. Se sustituye por bloques compactos de servicio y cifras alineadas, con resumen de copias independiente y detalles conservados. No se considera aceptación visual por parte del titular que las pruebas funcionales pasen.
