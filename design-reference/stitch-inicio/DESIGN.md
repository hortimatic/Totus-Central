# Totus Central · DESIGN.md para Stitch · Inicio profesional
**Origen**: sistema aprobado en `docs/INTERFACE_REDESIGN.md` y `src/interface-design.css` de producción; proyecto Stitch existente `5869856515258186560`. Esta es una **especificación de diseño**, no una exportación generada por Stitch.

## Personalidad del producto
Puesto de trabajo para un autónomo y su equipo: preciso, informativo, sobrio, compacto, confiable, rápido, accesible y flexible; estilo de software de gestión serio, no una presentación comercial. Cada elemento visual tiene propósito funcional.

## Tokens base (los del tema vigente siempre prevalecen)
| Rol | Variable CSS actual | Base aprobada |
|---|---|---|
| Navegación | `--nav` | `#101d32` |
| Navegación activa | `--nav2` | `#1d304c` |
| Fondo | `--bg` | `#f3f6fa` |
| Superficie | `--panel` | `#ffffff` |
| Texto | `--ink` | `#182c43` |
| Secundario | `--muted` | `#607187` |
| Borde | `--line` | `#dce5ee` |
| Acción | `--accent` | `#1463ce` |
| Acción intensiva | `--accent2` | `#104faa` |
| Radio | `--r` | `16px` |
| Sombra | `--shadow` | `0 4px 20px rgb(23 48 79 / 5%)` |

El sistema de `Mi interfaz` puede cambiar tipografía, paleta, densidad, fondos y radios: **los tokens personalizados mandan**. En oscuro, mantener contraste AA, fondos opacos y focus visible. Color no debe ser única señal de significado. Los iconos son secundarios al texto funcional.

## Jerarquía y densidad
- Hero/encabezado pequeño: título y periodo + acciones clave, sin ocupar media pantalla.
- KPI: etiqueta, valor legible y unidad, delta/comparativa opcional, ayuda contextual; no más de 2 líneas de explicación visible de forma permanente.
- Tarjetas de contenido con títulos propios, acciones visibles, espacio para gráfica o tabla. No encapsular una tarjeta dentro de otras tres tarjetas.
- Separaciones 8/12/16/24px, máximo 24px entre bloques ordinarios; tamaños variables por `Mi interfaz`.
- Datos monetarios: alineación por cifras tabulares, signos y unidades intactos, no abreviar sin acceso al importe completo.
- Botones y selectores habituales: altura mínima accesible 40–44px, foco bien diferenciado, labels semánticos, no iconos solos para acciones destructivas.
- Estados `Verificado`, `Parcial`, `No validado`, `Sin datos`, `Error` y `Cargando` distintos visualmente y por texto.

## Cuadrícula y contenedores
- Página fluida con máximo ancho configurable, sin truncar ni forzar tarjeta a una altura fija.
- Escritorio >=1400px: 12 columnas; tablet 700–1399px: 6; móvil <=699px: 1. Recolocar por **container queries** sobre anchura real de cada widget; las anchuras exactas pueden ajustarse según composición.
- Gráfica ordinaria: mínimo funcional visual ~240px de alto en escritorio; en móvil ~190–230px si las etiquetas se mantienen legibles. Si no se puede, ofrecer visualización alternativa compacta con detalle ampliado, no scroll de gráfica.
- Los widgets son de altura `auto` en modo consulta, con un mínimo de diseño. Nunca `overflow:auto` ni `overflow:hidden` sobre contenido operativo. Los formularios despliegan campos y botones en línea/columna según anchura.
- Si el usuario reduce una tarjeta, realizar `reflow`: tres columnas -> dos -> una, leyenda bajo gráfica, etiquetas de eje menos densas, controles en 2 filas, más vendidos resumidos con `Ver todos`.
- Modo edición: marco de resize accesible, sombra/guías discretas y preview real, pero ninguna zona debe ocultarse por recorte o scroll interior. Evitar colisiones y alturas mágicas.
- Evitar botones de opciones que cubran títulos o KPI; colocar acciones en barra secundaria con `Opciones` para casos densos.

## Comportamiento por anchura **DEL WIDGET**, no solo del viewport
| Ancho útil real | Gráfico | KPIs y resumen | Pedidos / filtros |
|---|---|---|---|
| >=750px | Serie completa, eje Y, leyenda, tooltip y selección; varias series cuando proceda | 3–5 cifras distribuidas sin cortes | Tabla de datos con columnas priorizadas y controles permanentes |
| 500–749px | Serie compacta, menos ticks, leyenda inferior, selector de métrica | 2 columnas, resto debajo | Tabla compacta de 3–5 campos + abrir ficha; filtros en dos filas |
| 320–499px | Gráfico compacto legible o resumen de tendencia + `Ampliar`; **nunca scroll horizontal** | 1–2 columnas según números; texto completo disponible | Fichas por pedido con importe, fecha, estado y `Ver detalle`; demás campos en expansión |
| <320px | Rechazar tamaño como widget funcional o ampliar contenedor | Una sola columna | Ficha única |

Los botones `Aplicar`, `Actualizar`, `Ver pedido`, `Ampliar` y `Restaurar` no pueden quedar ocultos ni fuera de pantalla. **El scroll vertical de toda la página está permitido**; el scroll dentro de las tarjetas está prohibido.

## Composición visual solicitada
### Pantalla normal
Header compacto -> aperturas por tienda y cajón -> KPIs fiscalmente diferenciados -> gráfica grande `Ventas y gastos` -> operaciones/avisos/tareas y accesos -> dos tarjetas de PrestaShop -> pedidos y más vendidos según priorización y tamaños. El usuario puede personalizar posiciones, así que crear variantes de tamaños reales.

### Cabeceras de tienda y periodos
- Selector Tienda: Todas, Hortimatic, NewOldSmok.
- Filtro temporal de alta visibilidad: controles segmentados **Día | Semana | Mes | Personalizado**.
- Navegación anterior/siguiente por día, semana o mes, y selector adecuado (fecha, semana o mes/año).
- Fecha personalizada: `Desde` / `Hasta` / `Aplicar` / `Limpiar`.
- Etiqueta de zona Europe/Madrid, rango exacto aplicado y momento de última lectura.
- El rango de cada widget puede ser propio; indicar cuándo sigue al global o es independiente.
- Todas las métricas y series etiquetadas con unidad, filtros y cobertura.

### Gráficas profesionales
- Línea/área para evolución temporal cuando haya suficientes muestras; barras para comparación o distribución horaria; no mezclar métricas de distinta unidad en el mismo eje.
- Tooltip accesible por teclado, ratón y toque; fecha/hora, tienda, pedidos y EUR solo si está acreditado.
- Clic/tap en punto/barra = seleccionar intervalo y filtrar detalle; selección visual evidente, botón `Quitar filtro` para volver.
- Día: 24 horas como datos, 4–8 ticks legibles. Semana: siete días. Mes: días o semanas seleccionables. Personalizado: resolución declarada.
- Series múltiples con leyenda accesible, selección visible, cambio de métrica y estado `lectura parcial` cuando corresponda.
- Eje Y monetario con 0€, separadores y sufijo de unidad; negativos cuando apliquen; tooltip puede mostrar precisión completa.
- No mostrar barras de 0 inventadas por un periodo sin datos, distinguir `0` acreditado y `no leído`.

### Tabla de pedidos y variantes
- En escritorio tabla dinámica con orden/mostrar columnas/filtros/paginación, pedido clicable y acceso a ficha.
- En compacto/móvil, tarjetas por pedido, no `min-width:1000px` + scroll; información secundaria bajo expandir. Paginación visible, sin contenedor con desplazamiento vertical propio.
- `Atendido por`, `Cliente` y `Margen` muestran `No informado` / `Sin validar` cuando no se conoce el dato original.
- Top de productos **separa combinaciones** y unidades reales, categorías bien identificadas, gráfico de barras proporcional al máximo y siempre legible.
- Calidad de catálogo muestra problemas reales con estados parciales.

## Estados y navegación
Crear ejemplos de: cargando, vacío real, sin permiso, error reintentable, fuente parcial, fecha sin cierre, datos antiguos, importe no verificado. Conservar las rutas y permisos de Totus; toda acción debe tener propósito funcional identificable.

## Pantallas y entregables
Consultar `ENCARGO_STITCH_INICIO_PROFESIONAL.md` para las diez vistas, prototipo interactivo, exports originales HTML/CSS, DESIGN.md final generado por Stitch, miniaturas, ids de nodos y mapping al código. Diseño en el proyecto existente, **sin publicar ni modificar contabilidad**.

## Prohibiciones visuales (rechazar)
`height` fija + `overflow:auto` en tarjeta normal; gráficas con `overflow-x:auto`; 10 columnas obligatorias en móvil; texto por debajo de legibilidad; botones cubiertos; tarjetas del mismo tamaño vacías junto a formularios recortados; información ficticia presentada como dato real; estilos que pisan `Mi interfaz`; acciones o enlaces decorativos.
