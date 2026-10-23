# Totus Central: tutorial de trabajo diario con ChatGPT

Esta guía explica cómo operar la herramienta y cómo pedir cambios pequeños sin alterar la contabilidad. Complétala con MANUAL_CHATGPT_ONLINE.md y COPIAS_POR_COMPONENTES.md, disponibles en la carpeta de manuales de OneDrive. La interfaz y los datos guardados son la referencia vigente; no reconstruyas decisiones a partir de recuerdos de otros chats.

## 1. Qué hace cada servicio

- Totus Central es la aplicación donde se registran y consultan las operaciones.
- Supabase conserva los registros, relaciones, permisos y programación del servidor.
- OneDrive conserva los documentos y las copias completas. La aplicación controla sus referencias.
- GitHub conserva el código y su historial de cambios.

Subir un PDF directamente a una carpeta de OneDrive no lo asocia automáticamente a un gasto. Para asociarlo hay que utilizar la ficha correspondiente de Totus Central. Tampoco se deben renombrar o mover por fuera de la aplicación los archivos que esta ya administra.

## 2. Conectar ChatGPT sin depender de un ordenador particular

**Primera comprobación del chat:** descubre las herramientas de GitHub, Supabase y SharePoint/OneDrive disponibles. Estos tres complementos se comprobaron habilitados en la cuenta el 23/10/2026. La autorización de Totus con Microsoft es independiente de la conexión de SharePoint del chat. No vuelvas a crear claves por una búsqueda o lectura de formato fallida.

En Recepciones, Supabase proporciona también el texto extraído y su cobertura. Si ese texto es completo, el chat puede cotejarlo sin descargar otra vez el PDF. Si falta texto, necesita leer el original o dejar el documento pendiente. Para OneDrive personal usa sus herramientas de búsqueda/listado del propio drive; no empieces buscando sitios empresariales. Consulta el diagnóstico exacto en COTEJOS_CHATGPT.md.


Cuando la cuenta de ChatGPT tenga conectado el complemento Microsoft SharePoint, comprueba sus herramientas para OneDrive personal antes de proponer un navegador o Work. La conexión del complemento es distinta de la integración del servidor de Totus con Microsoft. Verifica el acceso real en cada chat y utiliza los permisos existentes; no vuelvas a crear credenciales.

Para acceder a la carpeta de Totus, usa el listado de archivos y carpetas del OneDrive autorizado y desciende por sus identificadores. Una búsqueda puede devolver originales fuera de la carpeta solicitada: contrasta siempre la ruta antes de asociar un documento. Prefiere las direcciones exactas de Microsoft Graph que devuelva el conector para leer un archivo; una dirección de navegación de OneDrive puede fallar al resolverse.

La extracción de texto de un Markdown puede devolver contenido vacío aun cuando el archivo exista. En ese caso no afirmes haberlo leído: usa el archivo original en el entorno de análisis del chat, si está disponible, o la versión equivalente de GitHub. Los PDF pueden ofrecer texto directamente. Para subir un adjunto utiliza la referencia de archivo que admita el conector; no sustituyas los bytes por texto inventado o base64 no admitido.

Subir un PDF suelto a OneDrive no registra automáticamente un gasto en Totus. Hay que crear o actualizar el registro y su vínculo por la vía autorizada, validar los datos y comprobar el resultado. No uses la credencial privada de las tareas automáticas como conexión permanente del chat.


La conexión de Totus Central con OneDrive y el acceso de ChatGPT son autorizaciones diferentes. Una no concede la otra.

1. Entra en ChatGPT en la web y utiliza el entorno de trabajo en la nube que ofrezca tu cuenta. Crea o abre el proyecto dedicado a Totus Central.
2. Consulta las herramientas o plugins disponibles en esa cuenta. Si aparece un conector compatible con tu OneDrive, conéctalo con la cuenta propietaria y revisa sus permisos. La disponibilidad y la compatibilidad con cuentas personales dependen del producto y de la cuenta; no se deben dar por supuestas.
3. Si el conector disponible solo admite cuentas de empresa o no permite trabajar con la carpeta de aplicación, utiliza un navegador controlable desde el entorno de ChatGPT en la nube, si está disponible. Inicia sesión personalmente en Microsoft cuando se solicite.
4. Abre Totus Central y ve a Administración → Almacenamiento → Conexión y comprobaciones de OneDrive → Abrir carpeta de OneDrive. Esa dirección lleva a la carpeta correcta. No crees una segunda carpeta Totus para sustituirla.
5. En la carpeta de la aplicación, abre 04 Manuales y funcionamiento. Pide a ChatGPT que lea esta guía, el manual operativo y el relevo antes de empezar.
6. En otra pestaña del mismo entorno de trabajo, abre Totus Central e inicia sesión con una cuenta con los permisos necesarios. La sesión del navegador de un portátil no se transfiere automáticamente a un navegador en la nube.
7. Comprueba el acceso con una tarea de lectura: identificar un documento autorizado, leer su número e importe, abrir un gasto existente y verificar que su vista previa corresponde. No crear datos de prueba en la contabilidad real para comprobar el acceso.
8. Confirma por separado si ChatGPT puede leer archivos, adjuntarlos en la aplicación y guardar registros. Un conector que solo busca documentos no equivale a control de la web ni a permiso para escribir.
9. Si la cuenta de ChatGPT no dispone de conector compatible ni navegador controlable, no puede operar autónomamente la herramienta desde ese chat. Se pueden adjuntar archivos manualmente para analizarlos o habilitar una integración compatible. No resolverlo compartiendo claves privadas de Supabase o Microsoft.
10. No instales sincronizadores ni tareas en un ordenador particular. Cuando una herramienta necesite un archivo temporal, debe trabajarlo en el entorno de nube autorizado y eliminar el temporal al terminar. Los originales y el resultado deben permanecer en los servicios del proyecto.

Las contraseñas, códigos de acceso y nuevas claves se introducen en sus pantallas protegidas. Nunca deben pegarse en mensajes, manuales, capturas públicas o GitHub.

### Prueba de aceptación del acceso

El acceso está preparado cuando ChatGPT demuestra, desde el entorno que se vaya a usar a diario: lectura de un manual, apertura de un documento autorizado, acceso a Totus y comprobación de un registro. Para comprobar una subida real, utiliza la siguiente factura legítima que haya que registrar, evita duplicados y verifica después su vista previa. No afirmar que existe acceso porque simplemente se ha recibido un enlace.

## 3. Cómo comenzar cada sesión de trabajo

1. Leer las instrucciones del proyecto y el relevo de la última sesión.
2. Confirmar que se está usando la dirección de producción y la carpeta de OneDrive enlazada desde Totus.
3. Anotar el trabajo pedido, periodo y tiendas. Distinguir lo ya cargado de lo nuevo.
4. Revisar la última copia guardada y el estado de la conexión cuando se vaya a hacer un trabajo importante.
5. Inventariar los documentos que se van a tratar, sin mover los originales.
6. Consultar los registros existentes antes de crear ninguno.
7. Hacer el trabajo por lotes pequeños y comprobar cada resultado guardado.
8. Terminar con un resumen de registros creados, corregidos, adjuntos y pendientes, con fechas e identificadores visibles de la herramienta.

ChatGPT no debe considerar una operación terminada solo por pulsar Guardar. Debe volver a abrir el registro y contrastar sus datos y su documento.

## 4. Preparar y contrastar facturas y gastos

Una factura y un pago son hechos relacionados, pero pueden tener fechas e importes distintos por retenciones, pagos parciales o errores de transcripción. El Excel sirve para contrastar lo pagado; la factura determina sus propios datos.

Antes de asociar una factura, comprobar:

- Proveedor e identidad del emisor.
- Número de factura y fecha del documento.
- Concepto, periodo del servicio y establecimiento cuando figure.
- Base, impuestos, retenciones y total.
- Importe pagado y posible diferencia respecto al Excel.
- Existencia de la misma factura o del mismo gasto en Totus.

No asociar únicamente porque dos importes coincidan. Las fechas de los pagos del Excel pueden estar desplazadas. Si el usuario ha confirmado un error del Excel, conservar la referencia del contraste y usar los importes de la factura. No inventar diferencias ni distribuirlas para forzar coincidencias.

Prestar especial atención a alquileres de distintos locales y a proveedores con varias facturas similares. Una factura del local de una tienda no se adjunta al alquiler de la otra. Si falta una prueba inequívoca, dejar el caso pendiente y consultar el dato necesario.

### Registrar un gasto nuevo

1. Abrir Gastos → Nuevo gasto.
2. Elegir la tienda o centro que corresponda al documento o al control interno.
3. Seleccionar o crear el proveedor comprobando que no exista ya.
4. Introducir número y fecha de la factura, concepto, periodo e importes a partir del original.
5. Elegir el tratamiento general adecuado, sin cambiar la configuración fiscal por cuenta propia.
6. Registrar el pago real, distinguiendo fecha del documento y fecha del pago.
7. Adjuntar el original mediante el control de factura o justificante de la ficha.
8. Guardar y volver a abrir el gasto.
9. Revisar todos los importes y abrir la vista previa del adjunto.
10. Comprobar que aparece una sola vez en el listado y en el informe del periodo correspondiente.

### Si el gasto ya existe y solo falta el documento

1. Localizar el gasto por proveedor, importe, concepto y periodo.
2. Abrirlo y comprobarlo antes de adjuntar.
3. Adjuntar la factura correcta.
4. Utilizar Guardar solo adjunto cuando esté disponible y no haya que modificar importes.
5. Reabrir y verificar la vista previa.

No crear otro gasto para poder subir la factura. Cuando la factura todavía no está disponible, conservar el gasto identificado como pendiente de documento; adjuntarla posteriormente al mismo registro.

### Pagos para control interno

Los pagos de impuestos que ya están tratados como información interna se registran con el tratamiento Solo información interna / excluir del cálculo fiscal. El justificante bancario se adjunta como una factura normal. Deben verse para explicar la salida de dinero y en los informes informativos, sin volver a restarlos como gasto fiscal del periodo.

No convertir automáticamente en interno cualquier gasto sin factura: la falta de documento y el tratamiento fiscal son cuestiones diferentes. Tampoco cambiar nóminas, Seguridad Social u otros conceptos ya configurados basándose solo en su nombre. Mantener el criterio registrado y contrastar dudas con la documentación del negocio.

## 5. Registrar cierres de caja

Consulta las tiendas y sus cajas en Negocio y cajas. Cuando una tienda tiene dos cajas, registra el detalle de ambas. Nunca mezclar las fuentes de una tienda con la otra. Las correspondencias particulares de las fuentes históricas se documentan en el relevo privado.

Preparar para cada día y caja:

- Dinero que había al abrir, procedente del cierre anterior.
- Ventas del día y su reparto entre efectivo y tarjeta.
- Retiradas o salidas de efectivo.
- Dinero contado que se deja para la apertura siguiente.
- Incidencias y documentos de contraste.

En las capturas históricas, al comienzo es la apertura; al fin representa las ventas del día; el comentario puede indicar lo que quedó para abrir al día siguiente. Si hay dos cajas, hace falta el dato de cada una: un total de tienda no permite inventar su reparto.

### Introducción diaria

1. Abrir Cajas → Nuevo cierre y elegir fecha y tienda.
2. Confirmar la apertura de cada caja frente al cierre anterior que muestra Inicio.
3. Introducir los datos reales de cada caja, no duplicar un total de tienda en las dos.
4. Introducir el cobro con tarjeta y las retiradas de efectivo según las fuentes.
5. Registrar lo que queda físicamente en cada caja.
6. Revisar Total ventas y las diferencias que muestre la herramienta.
7. Elegir el estado apropiado. Conciliado y aceptado significa que se ha comprobado; no utilizarlo para ocultar una diferencia desconocida.
8. Guardar y abrir Ver detalle para revisar los valores.
9. Comprobar que Inicio muestra la apertura siguiente de cada caja y que Fiscalidad recoge lo que corresponde al periodo.

Una retirada de caja mueve dinero; no es por sí misma un gasto deducible ni una venta adicional. No sumarla dos veces.

### Cruce con los Excel históricos

La tarjeta del Excel se apunta al día siguiente, cuando se recibe el ingreso bancario. Para contrastar ventas de un mes hay que atribuir cada importe a su fecha de venta: excluir los ingresos bancarios procedentes del mes anterior e incluir, cuando corresponda, los del último día del mes que entran después. No cambiar la fecha de una factura para cuadrar un cierre.

Si las retiradas de una tienda con dos cajas aparecen solo como total, no asignarlas arbitrariamente a una de ellas. Utilizar el detalle original o dejar anotada la falta de desglose.

Los periodos ya presentados y aceptados conservan sus estados. No reabrirlos ni alterar cifras históricas durante una carga diaria.

## 6. Facturas emitidas a clientes

1. Abrir Facturación y crear el documento del tipo correcto.
2. Seleccionar la tienda para que se utilice su logo.
3. Comprobar el titular fiscal común y el domicilio fiscal configurado. No sustituirlos por el nombre comercial o la dirección del otro local.
4. Seleccionar o crear el cliente sin duplicarlo.
5. Introducir conceptos, cantidades, precios e impuestos.
6. Consultar la vista previa y revisar datos de emisor y cliente.
7. Guardar como borrador si falta información.
8. Emitir solo cuando esté revisada. La numeración debe asignarla la herramienta; no escribir un número inventado ni crear series distintas por tienda sin autorización.
9. Descargar y abrir el documento resultante.
10. Registrar su cobro real. No volver a sumar como ingreso una venta ya incorporada por las cajas sin comprobar cómo se contabiliza en Totus.

Para corregir una factura emitida, utilizar el procedimiento de la herramienta. No editar directamente la base de datos ni borrar documentos emitidos para reutilizar números.

## 7. Fiscalidad e informes para gestoría

En Informes, el selector de mes o trimestre y año aplica las fechas a la tabla y al paquete ZIP del periodo. Comprueba también tienda y búsqueda. El paquete incluye documentos de gastos y facturas emitidas vinculados a sus registros aunque la fecha del archivo sea distinta; enumera los registros que aún no tienen adjunto. Conserva las descargas anuales complementarias. Los bloques se ordenan con Subir y Bajar; el orden es una preferencia de la cuenta.

En Inicio la gráfica y sus cuatro indicadores comparten el mismo periodo aplicado: ventas e ingresos, gastos fiscalizables registrados y gastos internos separados. Los internos incluyen los impuestos pagados y no se restan del beneficio fiscal. Para gastos internos generales puedes elegir el tipo Control interno en la ficha ordinaria y adjuntar su justificante como cualquier otro gasto.

Consulta [Inicio, control interno e informes](https://github.com/hortimatic/Totus-Central/blob/totus-central/docs/MEJORAS_INICIO_E_INFORMES.md) para el detalle de estos controles.


Durante el trimestre, consultar los ingresos, gastos fiscalizables, beneficio fiscal y previsión de impuestos calculada por Totus. Separar el pago previsto, el realmente pagado y los datos de contraste de gestoría. Una cifra facilitada por la gestoría no debe sustituir la previsión propia para hacerla coincidir.

1. Elegir el rango completo de fechas y las tiendas que correspondan.
2. Comprobar que incluye todos los meses y que los cierres necesarios están conciliados.
3. Revisar gastos pendientes de documento, pagos y posibles duplicados.
4. Mantener los gastos internos informativos separados del cálculo fiscal.
5. Descargar los informes y archivos mensuales que correspondan.
6. Abrirlos y comprobar periodo, columnas, número de filas y totales.
7. Contrastar la documentación de gestoría con los originales.
8. Anotar cualquier diferencia con su documento y explicación. No modificar originales para eliminarla.
9. Guardar lo entregado y su fecha en la ubicación del proyecto acordada.
10. Proteger el periodo cuando proceda y con autorización.

Las previsiones dependen de que los datos y la configuración estén completos. La revisión final no implica presentar modelos ni ejecutar pagos a Hacienda; esas operaciones necesitan su autorización específica.

## 8. Copias, restauración y conexión

### Crear y comprobar una copia

Administración → Copias permite crear una copia privada y consultar las diez más recientes según la conservación elegida. La programación se ejecuta en el servidor. Un juego puede tener índice, varios ZIP de documentos, otro de datos y otro de código, y cuenta como una sola copia.

Para descargarlo, pulsar Descargar en su fila y conservar juntos el índice y todos los ZIP. No renombrar las partes ni mezclar juegos de fechas distintas. Verificar comprueba su integridad sin restaurar.

### Recuperar una copia guardada

1. Identificar la fecha exacta que se quiere recuperar.
2. Pulsar Restaurar esta copia en esa fila.
3. Esperar a que el servidor compruebe sus archivos y el destino.
4. Revisar la fecha, registros y archivos del resumen.
5. Entender que sustituirá los registros actuales por los de esa fecha.
6. Cancelar si no se está seguro.
7. Para continuar, confirmar expresamente la restauración. ChatGPT debe obtener autorización humana para sustituir datos reales.
8. Se preparará una copia de protección del estado actual. Si sigue en preparación, esperar y utilizar Continuar recuperación en la solicitud registrada; no crear solicitudes repetidas.
9. Consultar el resultado en Recuperaciones.
10. Comprobar los registros y adjuntos después. No marcar el trabajo como terminado ante un error o un estado en curso.

Esta guía no autoriza a ejecutar una restauración real como prueba de interfaz.

### Renovar Microsoft

Almacenamiento muestra los días restantes y las fechas de primer aviso, aviso urgente y caducidad. Los umbrales se configuran en el panel. Los avisos se muestran dentro de Totus para el administrador; no son mensajes de correo.

La renovación consiste en crear una nueva clave en el registro de la aplicación en Microsoft, copiar su Valor al campo protegido de Totus e indicar su caducidad real. La herramienta comprueba la nueva clave y la cuenta antes de guardarla. Conservar la clave anterior hasta verificar el cambio y seguir las instrucciones que aparecen en el panel. Registrar otra fecha no renueva una clave.

## 9. Qué puede cambiar ChatGPT y cuándo escalar

El trabajo diario consiste en registrar, adjuntar, revisar, conciliar cuando esté comprobado y preparar documentación. No necesita modificar código.

Para un ajuste pequeño de interfaz:
1. Describir el problema y el cambio propuesto.
2. Confirmar que se mantendrán estructura, información y cálculos.
3. Trabajar en una rama temporal del código, no editar directamente el código servido.
4. Revisar el cambio y ejecutar las pruebas pertinentes.
5. Pedir una revisión técnica si afecta a permisos, dinero, ficheros, recuperación, numeración o conexiones.
6. Publicar solo desde el procedimiento existente con sus comprobaciones.
7. Verificar la versión publicada y el resultado.
8. Retirar la rama temporal integrada y actualizar el relevo.

Los cambios de fiscalidad, base de datos, seguridad, almacenamiento, restauración, arquitectura, migraciones o actualizaciones importantes se derivan a Codex para revisión de código y despliegue. Que un cambio ocupe pocas líneas no significa que tenga poco riesgo.

No crear otro entorno de producción, trasladar la contabilidad a un proyecto vacío ni reactivar entornos antiguos. Para cambios complejos futuros se preparará expresamente un entorno de pruebas separado basado en la versión actual.

## 10. Texto para iniciar un nuevo chat

Puedes copiar este texto:

“Trabaja con Totus Central siguiendo GUIA_TRABAJO_DIARIO_CHATGPT.md, MANUAL_CHATGPT_ONLINE.md y el relevo vigente de la carpeta de manuales. Primero demuestra acceso de lectura al OneDrive correcto y a la aplicación. Identifica el periodo, las tiendas y los documentos nuevos; busca duplicados antes de crear registros. Las facturas mandan sobre errores de transcripción del Excel, pero no asocies documentos solo por importe. Mantén separadas las cajas de cada tienda y las dos cajas de la tienda con dos cajas. Registra los pagos de impuestos definidos como internos sin descontarlos otra vez del cálculo fiscal. Verifica cada guardado y cada adjunto. No cambies estructura, cálculos, permisos ni periodos cerrados; no restaures datos sin mi autorización. No guardes archivos en un ordenador particular. Deja un relevo con lo realizado y los pendientes. Escala a revisión técnica los cambios importantes.”

## 11. Formato del relevo de cada sesión

Fecha y periodo trabajado. Fuentes revisadas. Registros creados o corregidos. Adjuntos verificados. Cierres conciliados y pendientes. Diferencias sin resolver. Archivos entregados a gestoría. Última copia comprobada. Estado de la conexión. Próxima tarea concreta.

No incluir contraseñas, claves, códigos de autorización, enlaces temporales privados ni datos personales innecesarios en el relevo.

## Documentación de referencia

- OpenAI: [ChatGPT Work](https://learn.chatgpt.com/docs/get-started-with-work), [navegador](https://learn.chatgpt.com/docs/browser) y [herramientas y plugins](https://learn.chatgpt.com/docs/use-chatgpt).
- Microsoft: [crear credenciales de aplicación](https://learn.microsoft.com/en-us/entra/identity-platform/how-to-add-credentials?tabs=client-secret) y [renovación de credenciales](https://learn.microsoft.com/en-us/entra/identity/monitoring-health/recommendation-renew-expiring-application-credential).

Los menús y capacidades de ChatGPT pueden cambiar. Verificar las herramientas disponibles en la cuenta que se va a utilizar; no prometer acceso por instrucciones escritas.


## Recepciones de mercancía
En Recepciones crea un pedido, añade los documentos de proveedor y las entradas de PrestaShop, y copia la instrucción al chat habitual. No es necesario volver a adjuntar al chat esos documentos si sus conectores pueden leerlos. Consulta COTEJOS_CHATGPT.md para el contrato de lectura y guardado, las cantidades, las variantes y los ajustes. Si falta acceso o lectura de un original, se conserva la recepción pendiente, sin inventar un resultado.

## Recepciones: alta rápida, biblioteca y descargas

La explicación vigente está en [COTEJOS_CHATGPT.md](COTEJOS_CHATGPT.md). Nueva recepción permite elegir o crear un proveedor y seleccionar los archivos de ambos lados antes de guardar. Conserva los archivos pendientes en memoria si una subida falla y permite reintentar sin duplicar el pedido. No cierres la pestaña hasta terminar la cola.

El rango de fechas incluye ambos extremos y todos los meses intermedios. Volver conserva los filtros. Quitar del pedido conserva el original documental y vuelve a dejar el cotejo pendiente. Excel e informe incluyen el resultado completo de la revisión visible. La biblioteca guarda equivalencias confirmadas por gerencia, no aprende automáticamente una variante por parecido.

Antes de cada cotejo, ChatGPT consulta public.totus_stock_context y su biblioteca; después de guardar relee la revisión y estado. Si un chat asegura que no puede acceder, debe identificar la herramienta y operación que faltan y probar el texto de Supabase antes de pedir otro producto o una nueva clave.
