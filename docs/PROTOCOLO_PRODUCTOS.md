# Productos · procedimiento de alta y mantenimiento

Revisión: 06/11/2026. Entrega: PR #133. Este procedimiento es la referencia de trabajo; un cambio en GitHub no está operativo hasta comprobar también base de datos, servicio y web publicada.

## Qué permite esta entrega

Productos es un módulo independiente de PrestaShop. Consulta las dos tiendas, sus fichas y variaciones; permite preparar campos y comparar destinos. El alta operativa crea **un producto base inactivo** en una o ambas tiendas, cada una con su validación, confirmación e identificador.

El alta admite nombre y URL por idioma, referencia, precio base sin impuestos, categoría propia del destino, descripciones y SEO seleccionados; también los campos admitidos de coste, EAN/UPC/ISBN/MPN, peso, dimensiones, cantidad mínima y disponibilidad. El servidor comprueba los campos recibidos mediante una lectura posterior. Los costes de variantes siguen siendo orientativos.

**No confundir preparación con guardado:** las actualizaciones de fichas existentes, nuevas combinaciones, imágenes, stock y lotes siguen sin ejecución de escritura. No se anuncia una ficha con variaciones o imágenes como creada íntegramente. No se copian identificadores entre tiendas ni se activa un producto en la web al darlo de alta.

## Crear un producto desde la interfaz

1. Entrar en Totus con una cuenta administradora activa y acceso de edición a Configuración. Productos comprueba esos permisos; conocer la clave de PrestaShop no sustituye iniciar sesión.
2. Abrir **Operaciones tienda → Productos**. Elegir Hortimatic o NewOldSmok y comprobar su conexión.
3. Pulsar **Crear borrador nuevo**. Rellenar nombre, referencia única y precio base sin IVA. Seleccionar los campos adicionales que se quieran incluir y completar sus valores.
4. Pulsar **Continuar: elegir destino y validar alta**. Elegir una o ambas tiendas y buscar coincidencias. Una referencia existente lleva a una propuesta de actualización; no a un duplicado.
5. En cada destino nuevo, pulsar **Consultar idiomas de la tienda**. Totus carga los idiomas reales y todas las páginas de categorías. Elegir la categoría por nombre, no copiando un ID de otra tienda.
6. Revisar el nombre, URL y textos de cada idioma. Revisar los campos y valores de la propuesta. Las ayudas «i» explican referencia y categoría.
7. Pulsar **Validar alta sin escribir**. Se comprueban esquema, idiomas, categoría, referencia y datos. Hasta aquí solamente se han realizado consultas.
8. Si existe un error, corregir la ficha y validar otra vez. Si se indica que el alta no está habilitada en Totus, no cambiar claves ni probar repetidamente: comprobar el despliegue descrito abajo.
9. Escribir **CREAR** y pulsar **Crear en PrestaShop (inactivo)** en la tienda correspondiente. Cada destino se confirma por separado.
10. Esperar el resultado. Solo se presenta como creado cuando PrestaShop devuelve un producto verificable y el registro de operaciones queda completado. Conservar tienda, referencia, ID e identificador de solicitud.
11. Volver a consultar el catálogo y abrir la ficha por su ID. Comprobar nombre, categoría, precio, textos e inactividad. El alta no modifica existencias, facturas, ventas ni cierres.
12. La activación pública o la configuración de imágenes y combinaciones pertenece a un circuito posterior; no dar por realizadas esas operaciones.

## Si se corta la conexión o aparece HTTP 500

PrestaShop puede guardar el producto y fallar al construir su respuesta. Un HTTP 500 **no demuestra que no exista**. Totus consulta por referencia y contrasta ID, precio, categoría, idiomas, campos seleccionados y estado inactivo antes de declarar éxito.

Si el resultado queda incierto, la referencia se mantiene bloqueada. Usar **Comprobar resultado sin repetir el alta**: conserva la solicitud original y consulta el resultado, sin enviar otro POST. No cambiar la referencia para saltar el bloqueo ni volver a crear el mismo producto desde otra pestaña.

Conservar el identificador mostrado antes de cerrar la pestaña. Tras una recarga, comprobar la referencia en el catálogo; si sigue pendiente, un administrador de mantenimiento debe contrastar el registro de operaciones y la ficha. No se libera una operación incierta borrando el diario ni se ejecuta SQL libre para forzar un éxito.

## Permisos, identidad y claves

- La sesión de Totus determina quién realiza la operación y queda registrada. Una IA no debe presentar una cuenta de otro proveedor como su identidad propia.
- Las claves Webservice permanecen en el servidor. No copiarlas al chat, documentos, archivos exportados ni código del navegador.
- La conexión debe estar habilitada, autorizada para datos reales y verificada en su revisión actual. Cambiar la clave exige guardar y probar esa misma conexión.
- La creación usa POST, exige categoría e idiomas propios y siempre nace inactiva. La habilitación de POST no habilita PUT, imágenes, stock ni operaciones masivas.

## Protocolo de entrega para quien mantenga el módulo

1. Leer este documento y `PRODUCTOS_GESTOR_2026-11-06.md`. Revisar estado real del PR, commit de producción, versión de `totus-connections` y existencia del diario. No repetir explicaciones antiguas como si fueran fallos actuales de PrestaShop.
2. Trabajar en rama o copia aislada. Conservar los contratos de Cajas, Precio, Facturación, Recepciones y conexiones existentes. Revisar que ningún campo preparado se pierda silenciosamente al guardar.
3. Probar validación, XML, idiomas, referencias duplicadas, permisos, doble clic, respuesta perdida y reconciliación. Probar POST y relectura en PrestaShop 1.7.8.11 aislado; repetir al cambiar a PrestaShop 8 antes de activar la nueva tienda.
4. Revisar el diario y sus permisos: tabla privada con RLS, función invocadora y acceso exclusivo del servidor; ninguna clave en logs. La identidad y la tienda deben quedar vinculadas a cada solicitud.
5. Superar los controles del commit exacto. Orden de instalación: diario → servicio y dependencias completas del manifiesto → habilitación deliberada de creación → web. Mantener la edición PUT desactivada mientras no tenga un circuito operativo propio.
6. La variable `TOTUS_PRESTASHOP_PRODUCT_CREATE_ENABLED=1` habilita el alta implementada. `TOTUS_PRESTASHOP_PRODUCT_WRITE_ENABLED` es independiente y debe permanecer sin activar en esta entrega. No eliminar comprobaciones de usuario o permisos para resolver una incidencia.
7. Volver a leer las definiciones instaladas, versión y archivos del servicio. Comprobar el commit que sirve la web, permisos negativos y una operación autorizada mediante la interfaz normal. Una pantalla publicada o un CI verde por sí solos no cierran la entrega.
8. Ante un problema, deshabilitar nuevas altas conservando diario y productos ya creados; restaurar el servicio anterior si corresponde. No borrar el registro de operaciones para volver atrás: impediría distinguir altas ya persistidas.
9. Publicar un acta con commit, versión de servicio, pruebas, resultado real y límites restantes. Actualizar los manuales de OneDrive; conservar antecedentes fechados. No comunicar «todo terminado» si alguna operación sigue siendo solo una propuesta.
