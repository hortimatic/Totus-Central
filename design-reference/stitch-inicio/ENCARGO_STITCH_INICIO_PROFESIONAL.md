# ENCARGO A STITCH — INICIO PROFESIONAL DE TOTUS CENTRAL
**Versión del encargo:** 10/11/2026. **Estado:** especificación lista para entregar a Stitch; todavía NO enviada por conector ni generada por Stitch.
**Proyecto Stitch existente:** https://stitch.withgoogle.com/projects/5869856515258186560
**Referencia aprobada:** `docs/INTERFACE_REDESIGN.md`, `design-reference/stitch-products/`.
**Aplicación actual de referencia:** https://hortimatic.github.io/Totus-Central/
**Código real:** `hortimatic/Totus-Central`, rama productiva `totus-central`.

## 1. MENSAJE PARA EL AGENTE DE DISEÑO DE STITCH

Eres el responsable senior de diseño de producto/UX/UI del **Inicio modular de Totus Central**, una aplicación operativa de un autónomo con dos tiendas y empleados que la utilizan a diario. **NO** crees una aplicación nueva, un dashboard de ejemplo, un escaparate de tarjetas, ni un rediseño de los demás módulos. Trabaja dentro del **proyecto Stitch ya existente**, reutiliza las referencias aprobadas, navegación y diseño común. Inspecciona el sistema visual, la apariencia personal del producto y, cuando esté disponible, la captura de la pantalla fallida para corregir sus defectos.

La entrega debe ser **un puesto de trabajo atractivo, moderno, sobrio, compacto y prioritariamente utilizable**. Un usuario debe poder consultar cifras, cambiar periodo/tienda, leer gráficas, abrir fichas y usar botones sin desplazarse por cajas interiores ni perder contenido. La pantalla modular debe permitir personalizar y guardar la colocación, anchura y orden de widgets, pero **el contenido se adapta inteligentemente al ancho y alto, nunca se corta ni queda oculto detrás de barras**.

No basta con una captura: diseña pantallas conectadas y un prototipo navegable con estados reales del diseño, configuraciones y interacciones. No inventes datos verificados ni operaciones de negocio.

### Principio innegociable: adaptación bidireccional
1. Los paneles se recolocan según su anchura disponible: PC, tableta, móvil y también dentro de otra columna, **usando el ancho efectivo del componente** (container queries), no solo el ancho del navegador.
2. La altura **crece con el contenido necesario**. La altura ajustada manualmente es preferencia/mínimo, no un recorte que genere barras verticales internas en un panel ordinario.
3. **No crear barras de scroll dentro de KPIs, gráficos, resúmenes, formularios ni tarjetas**. La página puede desplazarse verticalmente; los paneles no esconden sus funciones.
4. Gráficos: tamaño legible, escalado responsive, ejes/leyenda/tooltips, etiquetas adaptadas, densidad ajustable, y alternativa de resumen/tabla o botón `Ampliar` cuando el widget es estrecho. **Nunca un gráfico de 24 barras más ancho que la tarjeta con scroll horizontal**.
5. Tablas: en amplio, columnas proporcionadas y controles visibles; en estrecho, reducir columnas según prioridades, convertir filas en fichas compactas o abrir vista de detalle. Nunca depender de scroll horizontal para descubrir acciones fundamentales; si se requieren los diez campos, abrir detalle/vista completa accesible. Los 10 pedidos por página se consultan por paginación visible, no por scroll vertical de una tabla encajonada.
6. Títulos, cifras, filtros y botones deben ajustar línea, jerarquía y tamaño con límites legibles. No encoger la letra hasta hacerla inútil, truncar valores fiscales ni superponer botones.
7. Arrastrar/redimensionar **en modo edición** debe mostrar límites válidos, prever cómo reorganiza el contenido y evitar que un tamaño elegido produzca widgets inutilizables. Ofrecer `Ajustar al contenido` y `Restablecer tamaño recomendado`.
8. Contraste, foco, teclado, tacto, zoom al 200%, área táctil >=44px. Lectura y edición son modos distinguibles.

## 2. NEGOCIO, USUARIOS Y DATOS QUE NO PUEDEN CAMBIAR
- **Hortimatic = Azuqueca**. Cajas físicas: Vape y Head (Smoke anterior = Head).
- **NewOldSmok = Alcalá**. Caja Vape.
- Son tiendas de un mismo autónomo con numeración fiscal común; no fusionar libros ni importes sin contexto.
- Apertura de caja = efectivo retenido del cierre anterior **de cada cajón**. Una retirada no es otra venta y no es por sí misma gasto deducible.
- La liquidación de tarjeta bancaria puede ocurrir al día siguiente; no convertirla automáticamente en otra venta de la fecha del abono.
- Ingresos de cierres y referencias mensuales históricas no se suman por duplicado a pedidos de PrestaShop. **PrestaShop es una vista de fuente, no ingresos añadidos automáticamente**.
- Contabilidad, impuesto presentado, impuesto pagado, previsión fiscal, gastos de control interno y beneficio comercial son conceptos distintos.
- Control interno e impuestos pagados permanecen informativos, **excluidos del cálculo fiscal**; no descontarlos otra vez.
- La ganancia comercial real no se muestra como cifra cuando falten costes históricos, variantes, descuentos, devoluciones y moneda fiables: `Sin validar`, con explicación y navegación al origen.
- Solo usar la cuenta y permisos reales del usuario: roles, alcance por tienda, conexión autenticada y preferencias por usuario. Los ejemplos de Stitch deben estar claramente marcados **FICTICIOS**.
- No dar como verificado un recuento o total si la consulta es parcial. Mostrar `Parcial`, cobertura y causa.
- Ningún diseño podrá crear facturas, pagos, cierres, movimientos de stock, cambios de seguridad, ni ajustar contabilidad por sí mismo.

## 3. ARQUITECTURA VISUAL SOLICITADA
Mantener sidebar, header, buscadores, acceso personal, rutas y la estética común aprobada: navegación azul oscuro, superficies claras con jerarquía, acento azul/turquesa de `Mi interfaz`, tema claro/oscuro y preferencias propias. No imponer paleta fija a usuarios con tema personalizado.

**Escritorio 1440–1920:**
- Barra superior contenida, no gigantesca: nombre de la sección, selector de tienda (Todas/Hortimatic/NewOldSmok), selector de periodo y acciones contextualizadas.
- Bloque corto `Hoy y aperturas`: fecha operativa, tres cajones identificables por tienda y estado de cierre anterior. Indicaciones de saldo confirmado/no confirmado con fechas.
- Banda de cuatro KPIs actuales del mismo periodo: ingresos, gastos contables, ingresos menos gastos y control interno. Con etiquetas completas, valor y explicación al detalle; un quinto indicador comercial solo si se diferencia claramente y respeta `Sin validar`.
- Un panel principal de `Ventas y gastos`, con gráfica **grande, legible e interactiva** y filtros reales.
- Bloques para avisos, cierres, gastos, facturas/cobros, documentos, fiscalidad, acciones rápidas, tareas, informes, pricing, estado del sistema y enlaces nativos. El peso visual debe reflejar su importancia, no un catálogo interminable de tarjetas idénticas.
- Área PrestaShop con **dos tiendas lado a lado**, resumen comparativo coherente, gráfico propio, ventas/pedidos, ranking y acceso a tabla de pedidos; espacio flexible que se adapte sin recortes.
- Modo `Personalizar` claramente separado, con biblioteca de 28 tipos, mover/añadir/ocultar/recuperar/duplicar donde sea seguro, tamaños recomendados y vista previa sin perder contenido.

**Tableta 768–1024:** controles agrupados en dos líneas, KPIs en 2x2, gráfico principal a ancho útil, tiendas en 1 o 2 columnas solo cuando caben realmente; editor como panel deslizable/diálogo, no columna lateral que aplasta el contenido.

**Móvil 320–430:** encabezado compacto, selectores en fila plegable o dos líneas, KPIs en 2 columnas o una según ancho real, apertura por tienda y cajón en bloques claros, gráfico refluido con menos etiquetas, PrestaShop por pestañas Hortimatic/NewOldSmok, pedidos como fichas con `Abrir pedido`, no tablas con scroll horizontal. Edición táctil por acciones accesibles, no depender de arrastrar con el dedo.

**Densidad:** preferir información útil por pantalla, espaciado consistente de 8/12/16/24px y alineaciones; evitar márgenes vacíos, duplicación de cabeceras y paneles inflados. Tarjetas del mismo grupo se alinean cuando sea lógico, pero nunca a costa de ocultar contenido.

## 4. PRESTASHOP — REQUISITOS IMPRESCINDIBLES
Dos conexiones reales y separadas, leyendo por el puente autenticado existente. Cada tienda admite filtros independientes y también el alcance `Todas` cuando la consulta y los cálculos puedan combinarse sin duplicación. Mantener visibles el origen y la fecha de consulta.

**Barra de periodos funcional en cada widget de ventas/pedidos:**
- `Día`: hoy por defecto; navegar al día anterior/siguiente; selector de fecha; horas 00–23 con totales/órdenes correctos para ese día.
- `Semana`: semana local lunes–domingo; selector de semana o fecha de referencia, anterior/siguiente; gráfica diaria lunes–domingo.
- `Mes`: mes natural; selector mes/año, anterior/siguiente; gráfica por días o semanas según ancho y densidad.
- `Personalizado`: `Desde`, `Hasta`, `Aplicar` y `Limpiar`; sugerir granularidad horas/días/semanas/meses sin inventar distribución de datos. Mostrar claramente el periodo exacto.
- Selector `Tienda`: Hortimatic, NewOldSmok o Todas. `Todas` jamás oculta qué parte corresponde a cada tienda.
- Selector de métrica: **pedidos válidos / importe EUR verificado / ticket medio** (según la disponibilidad real). Comparación opcional con periodo anterior, claramente separada del total actual.
- Cada gráfico es interactivo: hover/clic/tacto sobre barra o punto muestra hora/fecha, tienda, unidades, pedidos y € solo si proceden. Clic filtra los pedidos del intervalo; botones `Volver` y `Limpiar selección`.
- No presentar 24 barras apretadas en 300px: agrupar tick labels, gráfico alternativo o modo ampliado, conservando los mismos datos.

**Resumen de cada tienda:** tarjetas compactas con ventas confirmadas, pedidos válidos, ticket medio, productos más vendidos, cobertura y avisos de catálogo. Margen solo si hay evidencia histórica suficiente; de lo contrario `Sin validar`. Mostrar fecha/hora de actualización y botón real `Actualizar`.

**Tabla de pedidos, útil y seleccionable:**
- 10 filas por página inicialmente, selector 10/20/50 si el servicio lo soporta, contador y paginación explícita.
- Filtros por tienda, periodo, número/referencia, validez/estado, forma de pago, orden asc/desc; mostrar filtros aplicados, borrar filtros individualmente.
- Columnas reales disponibles: pedido, referencia, productos y variantes, cliente acreditado, total y moneda comprobada, pago, estado, fecha/hora, empleado/atención **solo si existe origen demostrado**, margen solo verificado.
- Ordenar columnas, mostrar/ocultar columnas y elegir densidad desde un control accesible. En viewport estrecho convertir a fichas: pedido, fecha, importe, estado y botón `Ver` visibles sin scroll lateral; expandir detalle para el resto.
- Seleccionar una fila/segmento del gráfico para consultar detalle o navegar al módulo PrestaShop real. **Ningún botón de muestra**.
- `Más vendidos`: top por tienda, variantes y nicotina independientes, unidades vendidas reales, referencia cuando existe, participación sobre unidades realmente cubiertas, tabla o barras bien proporcionadas.
- `Calidad del catálogo`: incidencias de referencia, EAN, peso, cobertura por tienda; no simular un inventario real ni modificar existencias.
- Consulta parcial: informar `faltan páginas o líneas`; bloquear totales y rankings que pudieran ser falsos; nunca extrapolar silenciosamente.
- Distinguir pedido, cobro, venta de caja y liquidación bancaria. No duplicar importe de los cierres.

## 5. RESTO DE WIDGETS Y ACCIONES QUE HAN DE SEGUIR FUNCIONANDO
El catálogo real tiene 28 tipos, distribuidos así:

- **Inicio:** ingresos, gastos contables, ingresos menos gastos, control interno, ganancia comercial no acreditada, actividad, pendientes/avisos, atajos.
- **Cajas:** dinero de apertura por cajón, estado por tienda, cierres recientes, retiradas y efectivo (sin duplicar operaciones).
- **PrestaShop:** resumen por tienda, pedidos, top vendidos, calidad de catálogo.
- **Gastos:** gastos trimestre y pendientes de revisión fiscal (que no significa impagados ni falta de factura).
- **Facturación:** facturas, cobros y pendientes, con enlaces a fichas originales.
- **Pricing:** consulta rápida de precios/variantes y costes, sin perder sus formularios y reglas.
- **Documentos:** últimos documentos y acceso a vistas previas/originales.
- **Fiscalidad:** previsión propia y vínculo a cálculos/periodos diferenciados de declaración y pago.
- **Informes:** acceso a informes, filtros y paquete para gestoría.
- **Tareas:** tareas de hoy y navegación al calendario.
- **Administración:** estado del sistema sin revelar secretos ni rebajar permisos.
- **Recepciones:** cotejos pendientes, sin modificar stock ni contabilidad desde el widget.
- **Productos:** revisiones y accesos, sin sustituir módulos ricos por un `demo`.
- **Chat:** avisos reales del equipo y su canal, no mensajes inventados.

Acciones `Nuevo cierre`, `Registrar gasto`, `Nueva factura`, `Subir documento`, `Abrir pedido`, `Consultar precio`, `Ver gasto`, `Ver documento`, `Ver tareas` deben seguir abriendo **su formulario o módulo auténtico** con permisos existentes. La vista de Stitch puede representar visualmente su estado pero **no crea lógica alternativa**.

## 6. PERSONALIZACIÓN PROFESIONAL
- Tres modos claros: `Consultar` (sin bordes de editor); `Personalizar` (rejilla limpia, guías, reordenar/resize); `Ampliar detalle` (panel ancho o modal accesible, con todos los datos).
- Biblioteca con búsqueda, grupos por módulo, añadir, quitar instancia, duplicar solo si los campos son independientes; componentes con formularios o IDs únicos no duplicables.
- Orden y ancho independientes en escritorio/tableta/móvil; ajuste inteligente automático según contenido.
- Anchos: grid escritorio 12, tableta 6, móvil 1; un widget de gráfico no podrá comprimirse por debajo de la anchura legible sin pasar a modo resumen.
- Si se reduce el ancho, se transforman indicadores, gráficos, listas y controles **de manera documentada**. Si se reduce alto, el widget se expande hasta su altura mínima funcional; jamás cortar botones ni tablas.
- Aspecto heredado de `Mi interfaz`: colores, radios, tipografía, contraste, densidad; conservar tema claro/oscuro.
- Guardado personal entre sesiones mediante la RPC existente `totus_home_dashboard`, lectura posterior y control de revisión; cancelación de cambios; confirmación si abandonas edición sin guardar. Nada de almacenamiento contable en localStorage ni cambios de perfiles ajenos.
- Estado sin datos, error de conexión, permiso insuficiente, consulta parcial, carga lenta, datos desactualizados, cero real, `Sin validar`, y actualización correcta, diseñados con igual calidad que el caso de éxito.
- No convertir el Inicio en una lista vertical de tarjetas gigantes. Diseñar jerarquías y tamaños coherentes con uso diario.

## 7. PANTALLAS Y ENTREGABLES OBLIGATORIOS DE STITCH
Crear dentro del **proyecto Stitch existente**, coordinando su diseño con las pantallas ya aprobadas. Entregar cada una con nombre estable:
1. **INICIO-01 · Escritorio normal 1440px**: datos de muestra ficticios creíbles, operativa completa, gráficas legibles, PrestaShop doble tienda.
2. **INICIO-02 · Escritorio ancho 1920px**: tablero equilibrado, sin tarjetas vacías ni llenado arbitrario.
3. **INICIO-03 · Edición escritorio**: biblioteca, resize, drag, acciones, guardado y recuperación sin alterar las cifras de lectura.
4. **INICIO-04 · Detalle PrestaShop**: barra Día/Semana/Mes/Personalizado; fecha, tienda, serie de datos seleccionable, gráfico, filtros, pedidos/variantes, selección/acciones.
5. **INICIO-05 · Tablet 768/1024px**: mismo contenido y controles, reordenado.
6. **INICIO-06 · Móvil 390px** y **INICIO-07 · móvil 320px**: fichas y gráficos compactos, sin scroll lateral ni tarjetas con scroll interior.
7. **INICIO-08 · Mi interfaz oscuro**: hereda preferencias reales y mantiene legibilidad.
8. **INICIO-09 · Estados especiales**: carga, parcial, sin datos, faltan permisos, error, margen `Sin validar`; mostrar estados tanto en escritorio como en móvil.
9. **INICIO-10 · Detalle completo** de un widget al ampliarlo, con navegación de regreso.

Entregar:
- Prototipo navegable con interacciones: cambiar periodo, seleccionar tienda, zoom/granularidad de gráfica, abrir pedido, filtros, editar tamaño, guardar/cancelar.
- Variantes visuales por breakpoint y por anchura propia del contenedor: 320/390/768/1024/1440/1920, y ejemplos de widget con 320/500/750px útiles.
- Componentes adaptativos y reglas exactas de qué se ve y se transforma a cada anchura/altura; **no screenshots desconectadas**.
- Documento `DESIGN.md` del sistema visual con tokens, grid, tipografía, estados, gráficas, barras, tablas, formularios, comportamiento responsive, focos y navegación por teclado.
- Exportación original completa (HTML/CSS/capturas/metadata), enlace estable del proyecto y nodos por pantalla. Diferenciar prototipo de código real.
- Lista de correspondencias entre cada control visual y la acción real de Totus Central, y de los elementos de datos que requiere del backend.
- Nota explícita sobre vacíos de información: diseño de la interacción sí; número inventado, función inventada o cálculo contable no.

## 8. CONTRATO ESTRICTO PARA EL IMPLEMENTADOR (CHATGPT)
1. **No programar una nueva estética por intuición.** Partir de las pantallas finales reales de Stitch, no de un parecido razonable.
2. Exportar/guardar **los originales** de Stitch y su procedencia en `design-reference/stitch-inicio/` sin sobrescribir fuentes aprobadas de otros módulos. Mantener `DESIGN.md` y mapeo.
3. Recuperar la última rama productiva; desarrollar desde ella en rama temporal con PR; NO editar directamente `totus-central`. No realizar migraciones de arquitectura ni tocar módulos externos.
4. Integrar HTML/CSS por componentes aislados. No sustituir `src/pages/main.js`, `src/dashboard-activity.js`, sus cálculos, acciones `data-action`, permisos ni las conexiones reales. No clonar formularios con IDs duplicados. Conectar control por control; un control sin acción válida no se declara terminado.
5. Implementar los selectores Día/Semana/Mes/Personalizado, filtrado por tienda y series, tooltips y drilldown mediante fuentes PrestaShop comprobadas. El diseño no autoriza lecturas/escrituras nuevas que el contrato de conexión no exponga.
6. Rediseñar el CSS actual que fuerza alturas y `overflow:auto` en tarjetas/plots. Garantizar reflow semántico y `height:auto` para lectura; las preferencias de resize no pueden imponer recorte. La tabla compacta móvil debe tener acciones y detalle completos sin scroll lateral.
7. Validar con contenido largo, números grandes y negativos, fechas, gráficos de 24 horas, categorías diversas, pedidos con 10 columnas y múltiples variantes, consulta parcial, cero registros y móvil estrecho. Comparar **visualmente con el Stitch exportado** y comprobar interacciones, además de CI.
8. Conservar perfiles, roles, preferencias y toda la información de usuarios. SQL Auth/seguridad y negocios solo con revisión técnica competente, sin saltarse protecciones del repositorio.
9. PR y suite completa existente, verificación de despliegue con commit real de GitHub Pages y relectura de versión. **No afirmar que está publicado o que funciona sin pruebas.**
10. El titular evalúa el resultado visual. Si el Stitch final no ha sido entregado o alguna función no puede implementarse, declarar ese límite; **nunca inventar que Stitch diseñó algo que no consta**.

## 9. PRUEBAS DE ACEPTACIÓN / RECHAZO
**Rechazar inmediatamente** si cualquiera de estos casos aparece:
- Scroll horizontal/vertical **dentro de una tarjeta** para descubrir contenido principal, gráfico o botones.
- Gráficos que se cortan, datos agrupados sin explicarlo, ejes ilegibles, tooltip no accesible con tacto o filtros que no cambian la serie.
- Un widget más pequeño que sus datos sin expansión/reflow/acción `Ampliar`.
- Un panel no usable por el tamaño de su caja, texto sobrepuesto, formularios sin espacio para operar o duplicación de controles.
- Ausencia de Día/Semana/Mes/Personalizado en la zona de PrestaShop y selector de fecha útil.
- Un pedido sin navegación real, columnas inaccesibles o ventas mezcladas entre tiendas.
- Un cambio de diseño que borra/perjudica cálculo, documento, ficha, registro o botón anterior.
- Valores de margen, venta, cliente, empleado, estados fiscales o totales calculados sin evidencia.
- Modo edición que arruina la lectura, cambios sin guardar que se pierden sin aviso, o guardados atribuidos a otra cuenta.
- Solo mockups sin reglas de adaptación, sin prototipo navegable ni `DESIGN.md`.

**Éxito:** una persona puede consultar cada tienda y fecha, localizar la cifra/gráfico/pedido pertinente y actuar en sus módulos de trabajo **desde cualquier pantalla** con mínima fricción, sin buscar botones escondidos. La calidad profesional se comprueba con el uso, no con bordes bonitos.

## 10. RESPUESTA QUE SE LE PIDE A STITCH
No responder solamente `diseño creado`. Primero inspeccionar la referencia aprobada y **explicar brevemente la composición propuesta**. Crear las diez vistas anteriores, proporcionar enlaces/nodos, prototipo y `DESIGN.md`, exportación original e instrucciones de reflow verificables. Explicar explícitamente cómo una gráfica con 24 horas, una tabla de 10 columnas y un formulario extenso se adaptan a tarjetas de **320/500/750 px**, sin scroll interno ni pérdida de función.

**No publicar en Totus desde Stitch**. Stitch propone y exporta el diseño; ChatGPT lo integra en la aplicación real tras comprobar la procedencia y el contrato anterior.
