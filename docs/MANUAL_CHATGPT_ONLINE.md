# Manual operativo de TotusCentral para ChatGPT online
Actualizado: 23/10/2026. Producción publicada en la raíz; rama única totus-central y proyecto Supabase awmojepsasikxocoeqtu. Consultar el informe de revisión antes de operar.

## 1. Acceso y responsabilidades
La web está en GitHub Pages, el código publicado en la rama totus-central de hortimatic/Totus-Central. Supabase contiene usuarios, permisos, operaciones, referencias documentales y programación del servidor. OneDrive conserva los originales verificados en la carpeta exclusiva de la aplicación.
La sesión del portátil no se hereda a otro chat. Al comenzar, descubre las herramientas de GitHub, Supabase y SharePoint habilitadas en ese chat y verifica una lectura real. La operación diaria de Recepciones usa Supabase para leer textos y guardar el cotejo; SharePoint permite leer los originales de OneDrive personal por sus identificadores Graph. Una búsqueda web pública no equivale a acceso privado. No exigir Work ni una API de IA para este flujo. Antes de cambiar código, comprobar que la conexión de GitHub disponible permite las operaciones de escritura necesarias; no prometer publicar por tener solo lectura.

No guardar contraseñas ni claves en conversaciones, documentos, repositorios, borradores o archivos locales. Las credenciales de Microsoft se mantienen en Vault. No ampliar permisos para resolver un problema de rutas.

## 2. Antes de cada jornada
1. Abrir https://hortimatic.github.io/Totus-Central/ y comprobar la versión visible.
2. Revisar Inicio: fecha de los cierres anteriores, efectivo para abrir cada caja y avisos.
3. Revisar Administración → Copias: fecha de la última copia correcta. Un intento fallido no es una copia.
4. No volver a importar registros existentes. Buscar primero fecha, tienda, número de factura y proveedor.
5. Los primeros tres trimestres históricos fueron aceptados por el titular. No cambiar cifras ni reabrirlos para forzar coincidencias.
6. Octubre se introduce manualmente por el titular para aprender; no importarlo automáticamente.

## 3. Tiendas y cajas
Hortimatic es Azuqueca y tiene dos cajones: Vape y Head. En las capturas antiguas, Smoke corresponde a Head.
NewOldSmok es Alcalá y se lleva por separado. Nunca cruzar sus libros históricos.
Ambas tiendas corresponden a un único autónomo. La tienda identifica la actividad o el logo; no crea un emisor fiscal distinto.

### Apertura
La apertura es el efectivo que quedó al cerrar el mismo cajón el día anterior. No es una venta ni dinero que entra en banco.
Mostrar el importe y fecha de cada cajón. Si falta un cierre anterior, comunicarlo y no inventar una apertura ni copiar el total de la tienda en dos cajones.

### Cierre diario
1. Elegir fecha, tienda y cajón correctos.
2. Comprobar apertura contra cierre anterior.
3. Introducir las ventas del día y los cobros con tarjeta del mismo día de venta.
4. Registrar las retiradas de efectivo de ese cajón y otros movimientos reales, con su motivo.
5. Contar e introducir el efectivo que queda para mañana.
6. Revisar diferencias, guardar, volver a abrir y comprobar importes.
7. Conciliar cuando los justificantes y movimientos hayan sido comprobados. No usar conciliado como forma de ocultar una diferencia.
8. Comprobar Inicio: la apertura siguiente debe reflejar el efectivo conservado en ese cajón.

En el Excel histórico, la tarjeta se anotó el día del abono bancario, normalmente al día siguiente. No tratar el abono de hoy como venta de hoy sin contrastar el cierre. «Al fin» de las capturas era ventas del día; el comentario recogía el efectivo restante. Las retiradas de Hortimatic pueden proceder de ambos cajones: no repartir un total arbitrariamente.
Un cierre mensual ya incluido en ingresos históricos no debe duplicar ingresos al aceptarse.

Los registros importados también pueden conciliarse por el total de tienda cuando las fuentes permiten comprobar aperturas, efectivo final, tarjeta y retiradas, aunque no separen estas últimas entre cajones. El efectivo vendido se calcula como efectivo final + retiradas + gastos en caja + otras salidas − otras entradas − apertura. Se añade la tarjeta del día de venta. Conservar las fuentes y el motivo de aceptación; no inventar el reparto entre cajones ni usar «al fin» como control independiente. La aceptación operativa no confirma la presentación del trimestre. Si el cierre ya tiene referencia fiscal mensual, mantenerlo excluido de ingresos diarios para evitar duplicación.

## 4. Gastos y facturas recibidas
1. Buscar número de factura, proveedor, importe y fecha antes de crear nada.
2. Abrir el original y contrastarlo con el Excel correspondiente. El original determina los datos de la factura; el Excel ayuda a localizar el pago y su tienda.
3. Registrar proveedor, número, fecha, concepto, base, impuestos, retenciones cuando existan y total.
4. Distinguir factura devengada de pago realizado. Una factura sin pago inequívoco no se convierte en pagada por suposiciones.
5. Asociar el PDF o imagen al gasto correcto.
6. Abrir su vista previa desde el gasto, descargarlo si procede y comprobar que es el documento esperado.
7. Revisar la clasificación fiscal antes de aceptarlo. No convertir un gasto interno en deducible para cuadrar resultados.
8. Guardar y volver a abrir para comprobar persistencia y vínculo.
9. Un abono de proveedor reduce gasto; no debe transformarse en una compra positiva.
10. Sustituir o desvincular un justificante no autoriza a destruir el original sin una acción documental separada.

Nóminas, Seguridad Social y cuota de autónomos se presentan a gestoría con su tratamiento correspondiente. Evitar sumar el pago neto de la nómina otra vez si ya se ha contabilizado el gasto bruto.
Almacén y horas extra que el titular identifica como internos se muestran aparte y no reducen el beneficio fiscal usado para prever IRPF. No cambiar su clasificación sin explicación.
Ante una diferencia, registrar documento, periodo, concepto y causa. No editar para forzar el total de gestoría.

## 5. Facturas emitidas
Usar el nombre, NIF y domicilio fiscal verificados en la configuración privada. No copiarlos al repositorio.
Hay un único emisor y una numeración correlativa para ambas tiendas. El logo corresponde al establecimiento elegido.
Comprobar cliente, fecha, líneas, impuestos y total en la vista previa antes de emitir. Guardar un borrador si faltan datos. No emitir una factura de prueba con la numeración real.
Comprobar PDF, logo y dirección antes de entregar. Una factura emitida se corrige mediante el procedimiento de rectificación; no se elimina para reutilizar número.
No confundir proforma, borrador y factura emitida.

## 6. Fiscalidad: cómo interpretar los importes
- Ventas o ingresos: actividad fiscal del periodo, sin duplicar cobros ya incluidos.
- Gastos deducibles: gastos clasificados y revisados para cálculo fiscal.
- Beneficio fiscal: ingresos menos gastos deducibles. Los gastos internos informativos no reducen esta cifra.
- Previsión de impuestos: cálculo propio con los datos registrados. Cambia al añadir operaciones.
- Declaración presentada: cifras efectivamente declaradas, conservadas como referencia.
- Pagado: salida realmente realizada y registrada como pago; una comunicación de gestoría no basta.
- Dinero a reservar: previsión pendiente para impuestos, evitando sumar de nuevo pagos ya realizados.
- Diferencia con gestoría: comparación explicable, no un ajuste automático.

El modelo 130 considera acumulados del ejercicio y los pagos anteriores que correspondan; no asumir que siempre es el 20 % aislado del beneficio trimestral. Revisar deducciones/retenciones y parámetros aplicables.
El 111 corresponde a retenciones de nóminas o profesionales según sus documentos.
El 115 corresponde a la retención del alquiler de Azuqueca indicada por el titular; no es el IVA del alquiler. La otra tienda no debe heredar esa retención automáticamente.
La previsión propia no se sustituye por lo que comunica gestoría. Comparar al finalizar el trimestre y documentar las diferencias, manteniendo ambos valores cuando proceda.

## 7. Informes y entrega trimestral
1. Seleccionar fechas y tienda. Un rango de varios meses debe incluir todos sus meses.
2. Comprobar que la búsqueda y filtros se aplican igual a la vista y a la exportación.
3. Revisar totales de ingresos, gastos, impuestos, retenciones y documentos pendientes.
4. Generar libros mensuales y el formato de gestoría manteniendo columnas y significado.
5. Mantener la columna de número de factura junto a gastos donde corresponde. No inventar códigos internos de gestoría como «Rt» o «Nº fra. rec.».
6. Comprobar XLSX/PDF descargados: meses, tiendas, filas, sumas, formatos de fecha y moneda, y signos de abonos.
7. Incluir los justificantes necesarios; un Excel no sustituye sus originales.
8. Contrastar contra declaraciones/listados recibidos sin alterar datos para aparentar coincidencia.

## 8. OneDrive y ubicación de archivos
Administración → Almacenamiento reúne Supabase y la conexión OneDrive.
La conexión permite únicamente la carpeta de aplicación y su continuidad autorizada; no da acceso general a otras carpetas personales.
El servidor prueba guardado y lectura antes de copiar documentos. La copia por lotes compara tamaño y SHA-256 tras volver a descargar cada archivo.
La organización de documentos es año → tipo → mes. El nombre incluye fecha, proveedor/referencia e identificador para evitar colisiones.
La tarea de documentos se ejecuta en Supabase cada dos minutos, solo si quedan pendientes. No necesita navegador abierto ni ordenador. Usa una reserva temporal para evitar lotes simultáneos.
La barra cuenta documentos verificados, no el porcentaje de todo OneDrive. Un error permanece visible en el estado del último lote.
Los documentos verificados se resuelven desde OneDrive al abrirlos y descargarlos. Un documento nuevo o recién sustituido permanece disponible desde Supabase mientras se copia. La lectura se autoriza con las mismas políticas del usuario en la base de datos; configurar o reconectar OneDrive sigue siendo exclusivo de administración.
La herramienta comprueba tamaño y SHA-256 al abrir un documento. Si el archivo fue alterado directamente en OneDrive, no se debe actualizar su huella para ocultar el problema: recuperar el original correcto o sustituirlo por el flujo normal.
Eliminar o sustituir una ficha conserva el archivo anterior de OneDrive en «99 Archivo de documentos retirados», mediante una tarea del servidor. Esa carpeta es un archivo recuperable, no una papelera que se vacíe automáticamente. No se elimina su contenido para ahorrar cuota de Supabase.
No cambiar manualmente storage_path por una URL de OneDrive: es un identificador estable y la ubicación real se resuelve mediante el índice verificado del servidor.
La retirada de duplicados de Supabase exige comprobar de nuevo ambos archivos, sus referencias y una copia completa de seguridad verificada en OneDrive. El 20/10/2026 se completó con 452 originales: cero objetos restantes en business-documents, 452 índices conservados y las mismas 547 fichas de gastos y 449 cierres. Se abrieron PDFs de ambas tiendas, incluido uno cuyo duplicado ya había sido retirado.

## 9. Copias de seguridad
La programación de las 00:35 Europe/Madrid se ejecuta en Supabase, con cambio de horario automático. Conservar diez copias ordinarias completas: crear y verificar la nueva antes de retirar la antigua.
La copia debe incluir tablas de negocio, vínculos, documentos, logos y datos necesarios para recuperación. Los secretos de proveedores requieren un procedimiento privado de reconexión; no publicarlos dentro de una copia accesible.
Los puntos de recuperación protegidos son distintos de las copias ordinarias y no se borran automáticamente por su nombre.
Eliminar una copia requiere el control de la herramienta; la última copia y las vinculadas a recuperaciones están protegidas.
Una copia correcta debe poder leerse y restaurarse de manera aislada. Creación y comprobación de archivo no equivalen a haber ensayado una restauración completa.
No restaurar sobre el trabajo actual como prueba. Guardar punto de vuelta, usar entorno aislado autorizado, comparar filas/archivos y relaciones, y probar acceso y documentos.

## 10. Espacio y limpieza
La base de datos y los archivos tienen cuotas separadas. Los contenedores de documentos, logos y copias comparten la cuota de archivos.
GitHub contiene la web/código: no almacena contabilidad privada.
La estimación desde nueve meses es una simulación de ritmo, no garantía contractual. Distinguir espacio disponible, límite técnico del archivo de copia y consumos mensuales como tráfico.
Descargar no libera espacio. Eliminar una copia antigua no reduce el tamaño de los documentos actuales; la siguiente copia volverá a incluirlos.
No eliminar facturas vinculadas, archivos originales ni documentación fiscal para mejorar una barra.
OneDrive tiene su propia cuota. No presentar el tamaño de la carpeta de aplicación como espacio libre global de la cuenta.
Mantener los servicios gratuitos acordados; no activar ampliaciones de pago.

## 11. Usuarios, permisos y registro
Crear usuarios solo con el rol y permisos necesarios. Comprobar permisos de lectura, edición, borrado y descarga en el servidor; ocultar un botón no protege datos.
La configuración del proveedor de almacenamiento corresponde a administración. El uso de documentos por empleados debe respetar los permisos normales de la herramienta.
No compartir credenciales del administrador. El titular introduce credenciales nuevas en campos seguros.
Comprobar que las operaciones quedan registradas con fecha y autor o identificadas como tarea automática.

## 12. Si algo falla
- Si pide acceso, iniciar sesión en la aplicación correcta; no enviar contraseñas al chat.
- Si una actualización no aparece, comprobar primero la publicación de GitHub y la versión visible; un commit no significa que la web ya esté publicada.
- Si falla OneDrive, consultar estado del último lote, existencia de la carpeta y permisos. Administración puede usar «Volver a autorizar OneDrive» para renovar una autorización perdida sin borrar archivos. Si Microsoft indica que la credencial de la aplicación ha caducado, renovar esa credencial mediante el procedimiento seguro de administración; no publicarla en un chat, informe o repositorio. No pedir acceso a todo el disco por defecto.
- Si falta un justificante, buscar por identificador y referencia antes de subirlo otra vez.
- Si un filtro y exportación difieren, conservar evidencia y corregir antes de entregar cifras.
- Si falla una copia, no borrar la última correcta. Revisar espacio, límites de archivo, transporte y resultado del servidor.
- Si hay discrepancia contable, detener solo la operación afectada y continuar con el trabajo independiente.

## 13. Protocolo para modificaciones futuras
La instalación de uso diario es producción. Antes de cambiar código, estructura o datos, explicar el cambio al titular y ejecutar pruebas aisladas. Guardar código, migraciones y fuentes de funciones en GitHub; mantener secretos y datos privados fuera del repositorio.
Ejecutar pruebas funcionales y visuales pertinentes, revisar GitHub Actions y comprobar la versión publicada. Registrar pruebas reales y simuladas por separado.
Consultar docs/auditorias/PETICIONES_Y_CIERRE_2026-10-20.md. No declarar «100 % terminado» sin cerrar los criterios y las limitaciones reales.

## 14. Ruta única de OneDrive y seguridad adicional
La carpeta activa es Mis archivos → Apps → Totus Central. Se utiliza la carpeta especial de la aplicación, identificada por Microsoft, no una segunda carpeta manual. La estructura inicial vacía TotusCentral se retiró a la papelera después de verificar que sus cuatro subcarpetas no contenían archivos. No volver a crear esa ruta alternativa.
Los documentos ya disponen de espejo verificado. Las copias completas compatibles se trasladan también a 02 Copias de seguridad conservando su índice y fragmentos. Cada fragmento se vuelve a leer y comparar; el índice se publica al final. Una copia parcial no cuenta como guardada. Conservar como máximo diez copias completas verificadas en OneDrive.
La copia nocturna existente se inicia a las 00:35 Madrid. Cuando OneDrive está conectado y comprobado, el archivo nuevo se envía directamente allí mediante sesiones privadas y se verifica por relectura. Supabase conserva un índice pequeño de localización, sin duplicar sus fragmentos. La tarea existente de mantenimiento atiende traslados antiguos y limpiezas pendientes. No hay otro horario frecuente de creación.
La capacidad total de OneDrive solo se muestra cuando Microsoft permite leerla con los permisos actuales. No solicitar acceso a todos los archivos únicamente para mostrar una cuota ni convertir el tamaño de Totus en el libre total de la cuenta.
ChatGPT online requiere conexiones autorizadas o sesión propia en el navegador disponible; no hereda sesiones de este ordenador. Consultar https://learn.chatgpt.com/docs/enterprise/chatgpt-work-overview y verificar una lectura real antes de iniciar operaciones.

## 15. Evidencias de esta revisión
La batería remota completa ha comprobado permisos, filtros, informes, facturación, documentos, recorridos, campos y geometría de interfaz. Consultar las ejecuciones de GitHub Actions de la revisión publicada; no confundir código escrito con prueba terminada.
Comprobaciones reales del 20/10/2026:
- 452 originales verificados y retirados de Supabase; PDFs de ambas tiendas abiertos desde OneDrive.
- Las mismas 547 fichas de gasto y 449 cierres, con sus 452 ubicaciones documentales.
- Copia nueva completa con 454 archivos y 4.870 registros; traslado a OneDrive, relectura íntegra y ensayo de 38 tablas/57 relaciones.
- Tres copias anteriores verificadas en OneDrive, con sus fragmentos pesados retirados de Supabase. La prueba posterior del circuito directo añadió una cuarta copia: 454 archivos, 4.873 registros y 85.060.370 bytes en unos 100 segundos; cero fragmentos nuevos en Supabase.
- Simulación de 112 MiB creada y leída en ejecuciones separadas; sus 16 objetos temporales se eliminaron.
- Matriz SQL rechaza huella, tamaño, ruta preparada ausente o índice documental incorrectos. La recuperación completa de la base de datos se ejecutó con reversión y límite de ocho segundos: conservó las tablas y las 452 ubicaciones, y no dejó trabajos ni datos de prueba.

El primer ensayo detectó una validación que repetía el análisis del listado completo por documento y agotó la conexión; staging requirió reinicio. Se sustituyó por una validación conjunta materializada, se comprobaron de nuevo los recuentos y el ensayo posterior terminó correctamente. No repetir pruebas sin límite de tiempo ni presentar ese intento inicial como éxito.

## 16. Copias por fases y recuperación
La copia nocturna crea un archivo completo y publica su índice después de verificar los fragmentos. Los archivos nuevos se envían directamente a OneDrive con su permiso actual de carpeta de aplicación. Un verificador separado relee cada fragmento y confirma ruta, tamaño y SHA-256; si una subida no se completa, no se publica como copia correcta. El servidor continúa traslados antiguos y la retirada de duplicados mediante la tarea existente de dos minutos. Cada fase tiene su propia reserva y margen de ejecución; una fase interrumpida conserva el progreso y las copias anteriores.
La tabla Copias identifica el proveedor principal. storage_provider es metadato del servidor: no editarlo para aparentar una migración. Una copia de OneDrive mantiene su referencia estable y un índice pequeño en Supabase.
Antes de retirar los fragmentos pesados, el servidor relee la copia completa desde OneDrive, compara su huella registrada y ensaya filas y relaciones. No ejecutar limpiezas concurrentes: la reserva compartida impide recuperar durante una retirada y una ejecución antigua no puede liberar la reserva de otra nueva.
Los documentos sustituidos o eliminados de una ficha se archivan de forma recuperable; no se borran automáticamente de OneDrive. La rotación de copias ordinarias protege las vinculadas a recuperaciones y conserva una sucesora verificada.

## 17. Alcance y límites
Las copias son de datos y archivos de la aplicación para el mismo proyecto. Conservan autores, usuarios y permisos; las contraseñas permanecen en Supabase Auth. La prueba SQL con reversión y el ensayo temporal de relaciones son distintos de reconstruir toda la infraestructura en una cuenta nueva.
Una pérdida total del proyecto requiere GitHub, las migraciones y funciones, una conexión autorizada y el procedimiento privado de identidades/credenciales. No publicar secretos ni prometer que una copia de aplicación incluye toda la infraestructura de Microsoft o Supabase.
El formato admite 120 MiB de archivo y 128 MiB expandidos. La prueba de 112 MiB cubre un año fiscal al ritmo de los nueve meses observados; sigue siendo una estimación, no capacidad ilimitada. Revisar la advertencia de crecimiento y preparar la ampliación por volúmenes o archivo de ejercicios antes del límite.
La protección nativa de contraseñas filtradas de Supabase requiere un plan compatible; mantener la política de contraseñas y revisar esta limitación sin contratar servicios automáticamente. Referencia: https://supabase.com/docs/guides/auth/password-security.

## 18. Transferencia mensual y rescate desde OneDrive
El espacio disponible y la transferencia mensual son límites diferentes. Descargar archivos privados de Supabase, incluso desde una función del servidor, consume transferencia. La creación diaria evita ese recorrido para el ZIP completo: lee fuentes ya verificadas de OneDrive y sube los fragmentos directamente a Microsoft, sin enviarlos dentro de respuestas entre funciones ni almacenarlos primero en Supabase. Solo permanecen el índice pequeño y las lecturas normales de datos/logos. Revisar el consumo real en el panel del proveedor; no convertir esta mejora en una promesa de tráfico gratuito ilimitado.
Referencia: https://supabase.com/docs/guides/platform/manage-your-usage/egress.

Si TotusCentral no abre, una copia de 02 Copias de seguridad sigue conteniendo el archivo completo. El archivo principal .totusbackup puede ser un ZIP pequeño o un índice JSON acompañado de .part-0000 y siguientes. No abrir ni importar solo un fragmento. Un operador autorizado con entorno de trabajo en nube debe usar src/backup-transport.js y src/recovery-core.js desde la revisión de GitHub, reunir los fragmentos en orden, comprobar tamaño y SHA-256 del índice y del archivo completo, y después inspeccionar manifest.json y database.json. No descargar material privado al ordenador por defecto. La restauración de aplicación y la reconstrucción de una infraestructura nueva siguen siendo procedimientos diferentes.

En Informes, «Resultado tras gastos internos» es una cifra de gestión que incluye esos desembolsos. No es la base del IRPF. Para anticipos fiscales utiliza «Beneficio para calcular el IRPF» y «Previsión de impuestos» en Fiscalidad; allí los gastos internos no se descuentan. La verificación de una copia bloquea su botón mientras lee y comprueba el archivo completo, sin crear otra copia ni guardar descargas locales.

## 19. Almacenamiento ordenado y número de copias configurable
Almacenamiento agrupa toda la información por servicio: Supabase (contabilidad y acceso), OneDrive (documentos y copias), GitHub (código y web). Después aparecen la previsión, las cinco barras de Supabase y los detalles de conexión, limpieza y medición. No se ha eliminado información; las secciones abiertas se conservan al actualizar las mediciones.
En Administración → Copias, «Máximo de copias guardadas» permite de 1 a 10. Cambiar el número y pulsar Guardar programación. El valor guardado se utiliza en la pantalla, el servidor de copias y la conservación de OneDrive. Diez es un máximo de copias completadas: no crea diez archivos de golpe. Las vinculadas a recuperaciones se protegen aunque deban conservarse aparte.
La previsión distingue archivos de OneDrive de archivos de Supabase. La capacidad de OneDrive corresponde a la cuenta completa, incluidos otros archivos personales; la simulación de Totus solo extrapola el crecimiento observado del proyecto y las copias configuradas.


## 20. Presentación compacta de Almacenamiento
La vista principal muestra un bloque por servicio con cifras alineadas: ocupado, libre y duración estimada. Supabase separa base de datos de archivos; OneDrive identifica la capacidad de toda la cuenta y el volumen propio de Totus. GitHub usa una referencia fechada, sin inventar capacidad disponible.
Las copias tienen un resumen independiente con número guardado, máximo y programación. El aviso de mantenimiento del formato de copia se separa del espacio disponible: no significa que OneDrive se esté llenando. El desglose de cinco barras de Supabase, el método de estimación, la conexión, la limpieza y el diagnóstico siguen accesibles en apartados propios. Los límites compartidos no deben sumarse como espacios independientes. La duración de la base de datos sigue sin estimarse si no hay una medición fiable de su crecimiento.
Las pruebas automáticas comprueban función y geometría; no equivalen a la aceptación visual del titular. No registrar esta presentación como validada por el usuario hasta que la apruebe.


## 21. Preparar la entrada diaria del cuarto trimestre
Antes de guardar un gasto fiscal, revisar su factura, conceptos e impuestos y marcar «He cotejado el documento, sus conceptos e impuestos; gasto fiscal revisado». Mientras esté sin revisar, no entra en las previsiones 130, 111 ni 115. Inicio y Fiscalidad avisan de los pendientes; no marcar revisión sin cotejar el justificante. Los gastos internos se mantienen fuera del cálculo fiscal. Un pago bancario no sustituye a una factura ni debe registrarse como otro gasto duplicado.
La tabla de documentos muestra el tamaño de los resultados filtrados; la capacidad total se consulta en Almacenamiento. Las vistas previas de libros muestran coma decimal y punto de miles; se conservan los valores numéricos y formatos originales del Excel descargable.
Para la carga de octubre: comprobar documentos ya archivados y buscar coincidencias antes de subir de nuevo. La fecha del documento y la fecha del gasto son campos diferentes; no desplazar fechas para hacer coincidir totales sin comprobar el original.


## Pagos de impuestos y facturas pendientes

Los modelos 130, 111, 115 y 309 efectivamente pagados aparecen en «Impuestos pagados · solo información» de Gastos e Informes, y en una hoja independiente de los Excel detallados, resumen y libro anual de conciliación. Se filtran por fecha de pago: un pago del 3T realizado en octubre aparece en octubre, con su periodo original indicado. Son comunes al autónomo; al filtrar una tienda no se reparten arbitrariamente. No se descuentan del beneficio fiscal, no crean una factura ni otro gasto deducible. Los estados previsto y compensado no son salidas de dinero pagadas. RETA, nóminas y Seguridad Social conservan su tratamiento como gastos; no se reclasifican por esta vista.

Si aún no se ha emitido la factura: conservar el registro existente. Abrir «Adjuntar factura / revisar», seleccionar el documento cuando llegue, comprobar su vista previa y pulsar «Guardar solo adjunto». Esta acción conserva ID, importes, fecha, pago, origen y revisión fiscal; no crea otro gasto. Adjuntar un archivo no constituye una revisión fiscal ni resuelve diferencias entre un pago y una factura. Si la factura ya está registrada en otro gasto, conciliar el pago con ese gasto en vez de duplicar el coste. Para incorporar una factura nueva al cálculo, completar sus conceptos y categoría real, cotejarla y marcar la revisión fiscal, retirando el carácter interno cuando corresponda. Nunca deducir un mero apunte bancario por haber adjuntado un archivo.


## Fechas de cobro y actualización de ingresos

En Informes y Fiscalidad, «Aplicar», Intro en el buscador y los accesos por trimestre vuelven a consultar Supabase. Úsalos para incorporar registros guardados desde otra ventana u ordenador sin cerrar la sesión. Los filtros elegidos se conservan.

«De dónde salen los ingresos» desglosa tarjeta, efectivo retirado, cambio del dinero entre apertura y cierre, otros movimientos y otros ingresos fuera de cierres. Las retiradas por sí solas no equivalen a todas las ventas en efectivo. La tarjeta del Excel se anota al día siguiente de la venta, cuando llega al banco: las entradas bancarias del primer día de mes pueden corresponder al mes anterior. Para contrastar, igualar primero las fechas de venta, el periodo cubierto y los cierres nuevos posteriores al Excel. Los resúmenes históricos importados del Excel conservan su criterio y se muestran como ingresos fuera de los cierres; no se recargan ni se duplican para forzar coincidencias.

Los indicadores «Solo control interno» de Gastos y «Gastos internos · solo información» de Fiscalidad e Informes incluyen también los modelos 130, 111, 115 y 309 realmente pagados en las fechas seleccionadas. Esta suma es informativa: no se vuelve a restar del resultado de actividad ni del beneficio fiscal. El Excel resumen incorpora filas informativas de impuestos pagados y del total de control interno, manteniendo independiente el cálculo del resultado. No crear gastos duplicados para hacer aparecer estos pagos: la fuente sigue siendo Pagos de impuestos.

Para adjuntar el comprobante del banco a un pago de impuesto: Gastos → Solo control interno → Impuestos pagados → Adjuntar justificante. Seleccionar PDF o imagen y pulsar Guardar justificante. Después se puede abrir la vista previa, descargarlo o sustituirlo, conservando el original anterior en Documentos. Esta acción solo enlaza un documento con el pago ya existente; no altera importe, fecha, estado, trimestre ni deducciones, y no crea otro gasto. Requiere permiso de edición en Fiscalidad. Los justificantes siguen la misma conservación en OneDrive y copia completa que los demás documentos.


## Revisión de pagos y presentación de Gastos · 21/10/2026

La pantalla conserva la razón social del proveedor y muestra también Vaperalia para reconocer Internet Inteligente. Las acciones compactas Revisar, Adjuntar y Eliminar mantienen las mismas funciones. Los pagos del Excel se pueden consultar con el filtro «Pagos del Excel»; no se consideran por ello un coste interno deducible ni se cuentan otra vez como gasto.

Al vincular un pago con una factura, comprobar proveedor, número y cantidad. Las fechas del Excel pueden estar cambiadas y no se usarán como prueba de correspondencia. Si el usuario confirma que un importe del Excel está mal, corregirlo según el PDF y conservar el importe original en source_ref.source.amount y en el historial. Una relación con estado reconciled y factura identificada es un pago conciliado, pero sigue siendo evidencia del pago, sin duplicar el gasto de la factura. No marcar como conciliadas relaciones de importe que el usuario no haya aclarado. La pantalla muestra la factura, el importe neto, la diferencia y el importe del Excel anterior a una corrección.


## Impuestos pagados desde la ficha habitual de Gastos

Se conserva la organización del módulo. «Control interno · impuestos pagados» mantiene los pagos separados de las facturas fiscalizables. Su botón Revisar abre la ficha habitual de Gastos con «Solo información interna · excluir del cálculo fiscal» marcado. El archivo se puede consultar, sustituir o guardar con «Guardar solo adjunto» sin modificar el pago.

Para un pago nuevo: Nuevo gasto → Tipo documento «Pago de impuesto · solo control interno». En Tratamiento general comprobar modelo, año, trimestre, fecha e importe realmente pagado. El tratamiento interno se mantiene obligatorio. El pago es común al autónomo, no se reparte entre tiendas ni añade IVA, recargo o gasto fiscal deducible. Se guarda una sola vez en Pagos de impuestos y aparece también en Fiscalidad. No crear otro gasto para el mismo pago; el formulario rechaza un modelo y trimestre ya existentes. Las referencias previstas y compensadas se siguen gestionando en Fiscalidad. Se conservan los permisos de edición/creación de Fiscalidad además del acceso a Gastos.


## Cajas: estados y cierre manual

La estructura del módulo se mantiene. Un cierre manual cerrado y cuadrado muestra «Conciliado y aceptado» y «Ver detalle», igual que un cierre importado ya conciliado. Esta aceptación se refiere al cierre de caja, no a presentar impuestos. No depende de etiquetas privadas ni de su origen. Los datos originales, notas e importes se conservan.

Al crear o terminar un cierre, completar cada caja por separado y «Total ventas». En «Estado al guardar» elegir «Conciliar y aceptar el cierre» o «Borrador · terminar después». El botón principal guarda el estado elegido. «Guardar para terminar después» conserva el acceso directo al borrador. Para conciliar se exige el total de ventas, apertura y cierre de cada caja y que los importes cuadren; la comprobación del servidor sigue siendo obligatoria. Los cerrados quedan bloqueados; para cambiarlos usar Ver detalle → Reabrir cierre, con confirmación e historial, corregir y volver a conciliar. Nunca cambiar un cierre solo para forzar el importe fiscal. El listado muestra un Total ventas y conserva la diferencia; cuando hay un descuadre muestra también el total anotado que permite revisarlo.


En la cabecera de Cajas, «Salidas en metálico» suma las retiradas (cash_withdrawals) de los cierres visibles, aplicando periodo, tienda y búsqueda. No vuelve a sumar sus líneas de caja ni se añade como otra venta o gasto fiscal. «Tarjeta registrada», «Registros», «Borradores» y «Descuadres» se mantienen.


## 22. Transición a una única producción · 21/10/2026
El origen de datos se conserva: proyecto awmojepsasikxocoeqtu. Cambiar el nombre visible de un proyecto no cambia su identificador. No copiar la contabilidad al proyecto antiguo ni reiniciar series o usuarios. La URL de uso diario es https://hortimatic.github.io/Totus-Central/; /staging/ es un acceso de compatibilidad que redirige a la misma aplicación, sin código ni backend propios.
Las páginas, formularios, importes y permisos se mantienen. La retirada definitiva del proyecto antiguo de Supabase se realiza solo después de inventario, verificación de producción y confirmación específica del titular. El historial de Git conserva la versión anterior sin publicar una segunda web.
Los documentos usados por pagos de impuestos están protegidos contra un intento de eliminación incluso cuando el documento antiguo no tenga el vínculo inverso rellenado. Para cambiar el justificante, usar el mismo pago; no borrar primero su archivo desde Documentos. El número de factura se imprime como texto seguro, sin interpretar etiquetas HTML.
Los informes fechados del 20/10 conservan el estado histórico de aquella revisión. Para la puesta en producción consultar REVISION_PRODUCCION_2026-10-21.md y no presentar comprobaciones pendientes como terminadas.

El Excel detallado de Gastos conserva sus filas y columnas originales. «Total de registros» incluye apuntes bancarios y no es el gasto fiscal. Los subtotales distinguen gastos sin duplicar apuntes de pago, gasto fiscal revisado, control interno y apuntes de pago informativos. No sumar esos subtotales entre sí: los dos primeros desgloses pertenecen al gasto sin duplicados. Los impuestos efectivamente pagados se mantienen en su hoja informativa separada.


## Dirección del titular · 22/10/2026
La versión antes llamada staging es la producción definitiva. Su propia rama pasa a llamarse totus-central y es la rama principal del repositorio. La propuesta de fusionarla en el main obsoleto quedó cerrada sin fusionar. No copiar datos ni crear otra instalación para este cambio de nombre. Durante el uso diario, anunciar antes cualquier corrección y limitar los cambios a lo solicitado. Para trabajos complejos futuros, crear un nuevo entorno de pruebas aislado a partir de esta base únicamente cuando el titular lo pida. La futura venta por TotusCode es una fase distinta: no habilitar clientes, licencias, pagos o acceso a la contabilidad del titular como parte de esta transición.

## 23. Mantenimiento de la conexión de Microsoft
El registro de aplicación se llama Totus Central y conserva su identificador. La credencial actual caduca el 18/04/2027; renovarla antes de esa fecha desde los servicios autorizados, con intervención del titular para introducir credenciales cuando corresponda. No escribir valores secretos en el chat ni publicarlos en GitHub. Comprobar guardado, relectura y copia completa después de una renovación. No desconectar ni ampliar permisos por un simple cambio de nombre.


## Recepciones y cotejo de stock
Usa la pestaña Recepciones y el manual COTEJOS_CHATGPT.md de esta carpeta. Los documentos se suben o asocian en Totus Central; ChatGPT convencional lee la recepción mediante el conector de Supabase y los originales de OneDrive cuando su lector lo permita. El texto extraído queda disponible como segunda vía. Una página sin texto no se considera leída. Cada resultado se guarda con control de revisión y su historial; el módulo no cambia la contabilidad ni el inventario de PrestaShop.

## 24. Recepciones y preparación del chat · 23/10/2026

Consultar COTEJOS_CHATGPT.md para el flujo vigente: proveedor de la lista común o creación rápida, documentos en el alta, filtros por fecha/estado/tienda, reintento sin duplicados, descargas completas y biblioteca confirmada. Los tres complementos se verificaron habilitados en la cuenta; también se comprobó la búsqueda y lectura de un PDF personal con SharePoint. La disponibilidad en otro chat se comprueba al iniciarlo. Las conexiones no se conceden copiando una contraseña ni pegando un secreto.

Supabase es la base de datos; OneDrive es el archivo documental. El texto extraído de Recepciones permite continuar desde Supabase cuando un lector de OneDrive no admite un formato. Extracción parcial o ausente mantiene la revisión pendiente salvo lectura completa acreditada del original. No usar la ausencia de navegador como prueba de que faltan los conectores.

## 25. Código, montaje y entrega del proyecto

### Instalación vigente
- Código completo de la aplicación y documentación: hortimatic/Totus-Central, rama totus-central. Obtener una revisión concreta de GitHub conserva la trazabilidad; no confundir el ZIP de código con una copia de datos.
- Publicación estática: .github/workflows/publish.yml ejecuta .github/workflows/qa.yml y publica la raíz en GitHub Pages. El proceso inyecta la revisión en build-info.json y conserva la antigua dirección solo como redirección.
- src/config.js contiene URL de Supabase y clave pública del cliente; los permisos reales se aplican en Supabase. Nunca poner una clave de servicio o de Microsoft en este archivo.
- Las funciones utilizadas están bajo supabase/functions/: team-admin, totus-onedrive, totus-backup-run y totus-recovery. No desplegar funciones antiguas ni reemplazar todo el servidor para un cambio de interfaz.
- El SQL y su historial están en supabase/ y supabase/migrations/. Comprobar supabase_migrations.schema_migrations del proyecto antes de aplicar nada. No ejecutar de nuevo todos los scripts sobre producción.
- Microsoft utiliza la aplicación registrada y el retorno del servidor actual. Secretos y renovación de tokens permanecen en el servidor; cualquier instalación con otro propietario requiere su propia autorización. Un manual no transfiere credenciales ni permisos.
- Programación: copia diaria a las 00:35 Europe/Madrid, continuidad por lotes en el servidor, diez copias verificadas. Los originales y componentes se verifican en OneDrive; Supabase guarda los registros e índices.

### Recuperación de la instalación actual
1. Conservar los diez juegos completos y una revisión identificada de GitHub.
2. Comprobar la copia elegida y ensayar las tablas temporales antes de autorizar Restaurar esta copia. La verificación no sustituye datos de producción.
3. Restaurar solo con autorización del titular y con el punto de recuperación previo que prepara la herramienta.
4. Revalidar acceso, permisos, originales, una descarga y la creación/verificación de una copia. No incluir contraseñas de usuarios ni secretos en el respaldo público de código.

### Nueva instalación independiente o venta futura
El historial SQL contiene evoluciones de una base ya existente: no se presenta como un instalador desde una base vacía. Antes de entregar a otro cliente hay que preparar y probar un esquema inicial limpio, permisos, configuración de alojamiento, autenticación de Microsoft propia y recuperación en un proyecto independiente. No copiar datos contables, usuarios, documentos o claves de esta empresa a una demostración. Una copia de aplicación del proyecto actual no sustituye el respaldo de infraestructura, Auth ni Vault. Esta fase requiere una prueba de montaje independiente; no se certifica por las pruebas de la instalación actual.

### Fuentes que conviene conservar cuando Diego decida limpiar el proyecto
- Una revisión completa del código de GitHub con su README, SQL, funciones y pruebas.
- RELEVO_CHATGPT_ONLINE.md, este manual, GUIA_TRABAJO_DIARIO_CHATGPT.md, COTEJOS_CHATGPT.md y COPIAS_POR_COMPONENTES.md.
- El informe de revisión vigente y las referencias privadas de originales/copias en los servicios autorizados, sin duplicar facturas privadas en el repositorio.
No borrar ni modificar las fuentes sincronizadas del proyecto por iniciativa del chat. La limpieza de fuentes se hará cuando Diego la pida.
