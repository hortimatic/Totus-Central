# Criterios de cumplimiento de la interfaz

Referencia de partida: producción `733c0d69f8cfe24f4667d8b5130455e03b6ec062`. Una implementación o una prueba aislada no acreditan una publicación: contrastar siempre `build-info.json` y el navegador que conserva la caché anterior.

## Peticiones y comportamiento que debe conservarse

| Petición | Comprobación concreta |
|---|---|
| Una misma herramienta, homogénea y compacta | Cabeceras, pestañas, botones, márgenes y formularios usan la escala de `interface-controls.css` en los veinte módulos. Probar también estilos personales grandes. |
| Reducir contenedores vacíos | Los indicadores se ajustan a sus textos. Las tarjetas de Inicio no duplican marcos ni títulos aunque el usuario haya guardado otros tamaños. Se conserva la información del trimestre como metadato. Al eliminar títulos repetidos solo se considera la cabecera inmediata del widget; los nombres de cada caja se conservan después de cualquier redibujado. |
| Simetría en resúmenes PrestaShop | Filtros y métricas regulares, margen a todo el ancho, filas de productos alineadas y acciones al pie. No se modifica la tienda o el periodo para lograr simetría. |
| Móvil con tipografía utilizable | Texto, campos y controles se ajustan al ancho; las tablas desplazan sus columnas dentro de su contenedor. No convertir un texto en una letra por línea para hacerlo caber. |
| Columnas iguales y con guardado | Cabecera, búsqueda, lista y pie de Guardar distribución / Restablecer columnas. El panel completo debe quedar dentro de la ventana y conservar sus manejadores de guardado. |
| Columnas de Gastos rotas | Posicionar mediante el tamaño renderizado de `column-settings.js`, nunca con una altura estimada distinta de su límite CSS. Abrir, cambiar, guardar, cerrar, reabrir y restablecer a 390/1017/1440. |
| Columnas de Inicio iguales al resto | El botón ordinario abre el panel independiente; no obliga a entrar en el editor de widgets. El guardado usa la revisión y relectura de la cuenta. El editor del tablero conserva su inspector. |
| Quitar duplicados | Una herramienta de columnas por tabla. Sin Vistas exterior en directorios, Proveedores en la cabecera de Gastos, ni altas genéricas repetidas en los widgets. No retirar acciones de registros diferentes por compartir etiqueta. |
| Paginación de Productos sin botones fugaces | Cargar siguiente página y Consultar catálogo completo no aparecen en la barra durante la lectura de fondo. Avanzar y cambiar el tamaño se hace al pie; Actualizar permite reintentar una lectura. |
| Productos y Precio con funciones claras | Productos conserva altas, fichas, copias, atributos e historial. Los botones de lotes de precios y ofertas pertenecen a Precio. No desaparecen sus adaptadores ni las solicitudes pendientes. |
| Cambiar venta, coste y ofertas por familias o selección | Precio permite filtrar y seleccionar, revisar el lote y publicar en la tienda seleccionada, con confirmación y relectura. Los importes base y los impactos de combinaciones se identifican antes de guardar. |
| Todo recurso nativo se sincroniza con su tienda | Crear/editar productos, variaciones, marcas, proveedores, clientes y precios usa los circuitos oficiales existentes. Un borrador o una petición en cola no son una escritura confirmada. |
| Limpiar estudios internos | La retirada de los seis estudios, tres variantes y tres familias del 15/11/2026 conserva su copia previa. No repetir la eliminación de registros nuevos creados posteriormente por el usuario. No borrar mercancía de PrestaShop. |
| Ganancia y resultado contable separados | Ganancia estimada: ingresos con IVA menos compra con IVA y RE, con total, desglose por tienda y cobertura. Los gastos generales no se descuentan de esa tarjeta. |
| Carga más rápida sin replicar catálogos | Reutilizar costes registrados, lecturas compartidas y resultados acotados en memoria. El historial de vendedores no bloquea la ganancia. La réplica permanente de catálogos sigue aplazada. |
| Seleccionar proveedores y otros catálogos | Búsqueda de texto completa y orden alfabético español. Frecuencias, estados y posiciones conservan su orden funcional. Buscar no crea un borrador comercial. |
| Previsiones de gastos legibles | Casilla activa junto a su texto, formulario compacto, una sola herramienta de columnas y tabla que no se estrecha al enfocar una celda. |
| Automatizaciones comprensibles y reales | Qué consultar, tiendas, horario, destino, vista previa sin envío y estado de ejecución verificable. Configurar campana abre su configuración; Comprobar ahora sigue el resultado del trabajo, no anuncia éxito al solicitarlo. |
| Estilos compartidos sin copiar códigos | Biblioteca del equipo, aplicación individual y modificación limitada a su autor. Sin barra redundante de búsqueda/expandir ni tarjeta explicativa duplicada. |
| URLs claras | `/precio`, `/tareas`, `/gastos` y demás rutas españolas recargables. Contextos de pedido en el estado de navegación, sin arrastrarlos a otros módulos. |
| La versión nueva debe verse con caché conservada | `version-entry-assets.mjs` versiona todas las hojas y scripts de entrada, incluidas home-widgets, contact-directory e interface-controls. Las rutas se generan después. Ninguna lista manual puede omitir nuevas hojas. |
| Trabajar sin asistencia de IA | Los formularios normales siguen siendo la vía de trabajo. Los agentes usan los mismos contratos y permisos, con originales, validación, solicitud estable y relectura. Véanse los recorridos enlazados debajo. |
| Evitar regresiones y limpiar | Mantener los circuitos, permisos, recuperación, manifiestos de servicios y controles del repositorio. No borrar migraciones ni trabajo sin integrar al limpiar ramas. |

## Recorridos que no pueden sustituirse por un botón decorativo

- **Gastos:** Nuevo gasto → proveedor y tienda → factura/original, fecha y desglose → revisar duplicados → guardar → releer cabecera, líneas y adjunto. Pago y revisión fiscal son estados diferentes. Referencia: [CUENTA_CHATGPT_GASTOS.md](CUENTA_CHATGPT_GASTOS.md).
- **Cotejos:** Recepciones y cotejo → entrada y tienda → original de factura/albarán → revisar equivalencias, variantes y unidades → confirmar las operaciones autorizadas → verificar resultado y referencias. Referencia: [COTEJOS_CHATGPT.md](COTEJOS_CHATGPT.md).
- **Productos:** elegir tienda → crear o abrir ficha → completar campos/variaciones → revisar → publicar cada etapa → releer el ID y los valores nativos. Ante respuesta incierta conservar la misma solicitud. Referencia: [ATRIBUTOS_CARACTERISTICAS_CATEGORIAS_PRODUCTOS.md](ATRIBUTOS_CARACTERISTICAS_CATEGORIAS_PRODUCTOS.md).
- **Precio:** elegir tienda → filtrar productos/familia → seleccionar → ajustar precio/coste o aplicar oferta → revisar valores, fechas y alcance → publicar → comprobar resultado por producto y reanudar una operación incierta con su solicitud original.

Las pruebas ficticias y las nativas en una tienda desechable se registran como tales. No afirmar que se ha creado una marca o modificado mercancía real para acreditar un ensayo.

Los ficheros sincronizados de `sources/` son de solo lectura. El paquete de fuentes debe incluir código y manuales vigentes; no afirmar que se reemplazaron automáticamente las fuentes de ChatGPT si no se dispone de esa operación.
