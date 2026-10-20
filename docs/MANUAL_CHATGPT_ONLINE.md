# Manual operativo de TotusCentral para ChatGPT online
Versión de trabajo: 20/10/2026. Entorno: staging. Revisar el registro de pendientes antes de dar una función por certificada.

## 1. Acceso y responsabilidades
La web está en GitHub Pages, el código en la rama staging de hortimatic/Totus-Central. Supabase contiene usuarios, permisos, operaciones, referencias documentales y programación del servidor. OneDrive conserva los originales verificados en la carpeta exclusiva de la aplicación.
La sesión del portátil no se hereda a ChatGPT online. La app estándar de GitHub de ChatGPT permite consulta; para publicar código se necesita una experiencia con escritura autorizada, como Codex (https://help.openai.com/en/articles/11145903-connecting-github-to-chatgpt). La operación diaria puede hacerse por la web con navegador en la nube cuando esté disponible y autorizado (https://help.openai.com/en/articles/20001280-using-cloud-browser-in-chatgpt). El nuevo chat necesita conectores autorizados o acceso por navegador a cada servicio. Verificar lectura y escritura antes de prometer operaciones.
No guardar contraseñas ni claves en conversaciones, documentos, repositorios, borradores o archivos locales. Las credenciales de Microsoft se mantienen en Vault. No ampliar permisos para resolver un problema de rutas.

## 2. Antes de cada jornada
1. Confirmar que se está en staging y comprobar la versión visible.
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
La programación de las 00:35 Europe/Madrid se ejecuta en Supabase, con cambio de horario automático. Conservar cinco copias ordinarias completas: crear y verificar la nueva antes de retirar la antigua.
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
Trabajar solo en staging. Guardar código, migraciones y fuentes de funciones en GitHub; mantener secretos y datos privados fuera del repositorio.
Ejecutar pruebas funcionales y visuales pertinentes, revisar GitHub Actions y comprobar la versión publicada. Registrar pruebas reales y simuladas por separado.
Consultar docs/auditorias/PETICIONES_Y_CIERRE_2026-10-20.md. No declarar «100 % terminado» sin cerrar los criterios y las limitaciones reales.

## 14. Ruta única de OneDrive y seguridad adicional
La carpeta activa es Mis archivos → Apps → TotusCentral Staging. Se utiliza la carpeta especial de la aplicación, identificada por Microsoft, no una segunda carpeta manual. La estructura inicial vacía TotusCentral se retiró a la papelera después de verificar que sus cuatro subcarpetas no contenían archivos. No volver a crear esa ruta alternativa.
Los documentos ya disponen de espejo verificado. Las copias completas compatibles se trasladan también a 02 Copias de seguridad conservando su índice y fragmentos. Cada fragmento se vuelve a leer y comparar; el índice se publica al final. Una copia parcial no cuenta como guardada. Conservar como máximo cinco copias completas verificadas en OneDrive.
El traslado de seguridad se invoca después de la copia nocturna existente de las 00:35, no mediante otro horario frecuente. Las comprobaciones puntuales son distintas de la programación. La copia de Supabase no se elimina por crear una réplica.
La capacidad total de OneDrive solo se muestra cuando Microsoft permite leerla con los permisos actuales. No solicitar acceso a todos los archivos únicamente para mostrar una cuota ni convertir el tamaño de Totus en el libre total de la cuenta.
ChatGPT online requiere conexiones autorizadas o sesión propia en el navegador disponible; no hereda sesiones de este ordenador. Consultar https://learn.chatgpt.com/docs/enterprise/chatgpt-work-overview y verificar una lectura real antes de iniciar operaciones.

## 15. Evidencias de esta revisión
La batería remota completa ha comprobado permisos, filtros, informes, facturación, documentos, recorridos, campos y geometría de interfaz. Consultar las ejecuciones de GitHub Actions de la revisión publicada; no confundir código escrito con prueba terminada.
Comprobaciones reales del 20/10/2026:
- 452 originales verificados y retirados de Supabase; PDFs de ambas tiendas abiertos desde OneDrive.
- Las mismas 547 fichas de gasto y 449 cierres, con sus 452 ubicaciones documentales.
- Copia nueva completa con 454 archivos y 4.870 registros; traslado a OneDrive, relectura íntegra y ensayo de 38 tablas/57 relaciones.
- Tres copias completas verificadas en OneDrive; sus fragmentos pesados retirados de Supabase, conservando los índices.
- Simulación de 112 MiB creada y leída en ejecuciones separadas; sus 16 objetos temporales se eliminaron.
- Matriz SQL rechaza huella, tamaño, ruta preparada ausente o índice documental incorrectos. La recuperación completa de la base de datos se ejecutó con reversión y límite de ocho segundos: conservó las tablas y las 452 ubicaciones, y no dejó trabajos ni datos de prueba.

El primer ensayo detectó una validación que repetía el análisis del listado completo por documento y agotó la conexión; staging requirió reinicio. Se sustituyó por una validación conjunta materializada, se comprobaron de nuevo los recuentos y el ensayo posterior terminó correctamente. No repetir pruebas sin límite de tiempo ni presentar ese intento inicial como éxito.

## 16. Copias por fases y recuperación
La copia nocturna crea un archivo completo y publica su índice después de verificar los fragmentos. El servidor de Supabase continúa el traslado a OneDrive y la retirada de duplicados mediante la tarea de mantenimiento existente de dos minutos. Cada fase tiene su propia reserva y margen de ejecución; una fase interrumpida conserva el progreso y las copias anteriores.
La tabla Copias identifica el proveedor principal. storage_provider es metadato del servidor: no editarlo para aparentar una migración. Una copia de OneDrive mantiene su referencia estable y un índice pequeño en Supabase.
Antes de retirar los fragmentos pesados, el servidor relee la copia completa desde OneDrive, compara su huella registrada y ensaya filas y relaciones. No ejecutar limpiezas concurrentes: la reserva compartida impide recuperar durante una retirada y una ejecución antigua no puede liberar la reserva de otra nueva.
Los documentos sustituidos o eliminados de una ficha se archivan de forma recuperable; no se borran automáticamente de OneDrive. La rotación de copias ordinarias protege las vinculadas a recuperaciones y conserva una sucesora verificada.

## 17. Alcance y límites
Las copias son de datos y archivos de la aplicación para el mismo proyecto. Conservan autores, usuarios y permisos; las contraseñas permanecen en Supabase Auth. La prueba SQL con reversión y el ensayo temporal de relaciones son distintos de reconstruir toda la infraestructura en una cuenta nueva.
Una pérdida total del proyecto requiere GitHub, las migraciones y funciones, una conexión autorizada y el procedimiento privado de identidades/credenciales. No publicar secretos ni prometer que una copia de aplicación incluye toda la infraestructura de Microsoft o Supabase.
El formato admite 120 MiB de archivo y 128 MiB expandidos. La prueba de 112 MiB cubre un año fiscal al ritmo de los nueve meses observados; sigue siendo una estimación, no capacidad ilimitada. Revisar la advertencia de crecimiento y preparar la ampliación por volúmenes o archivo de ejercicios antes del límite.
La protección nativa de contraseñas filtradas de Supabase requiere un plan compatible; mantener la política de contraseñas y revisar esta limitación sin contratar servicios automáticamente. Referencia: https://supabase.com/docs/guides/auth/password-security.
