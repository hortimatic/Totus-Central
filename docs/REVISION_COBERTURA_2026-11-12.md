# Cobertura del listado y comprobaciones adicionales

## Qué está publicado y qué no

El registro de 26 puntos es la lista de control. Las entregas #185 y #186 no completan el encargo entero. Se corrige el estado del segundo bloque: #186 está publicado, no «en preparación».

Pendientes funcionales que deben conservarse como trabajos abiertos:

- Clientes, Proveedores y Marcas: sincronización por tienda, listado completo, ficha, tablas configurables, escritura nativa y relectura. Conservar relaciones fiscales/comerciales de Totus y no eliminar el acceso duplicado de Proveedores hasta contrastarlas.
- Atributos: la pestaña publicada consulta grupos/valores/características, edita y muestra asociados. Crear maestros sin producto de trabajo y eliminarlos aún no está terminado. La comprobación de asociaciones debe preceder al borrado de un maestro compartido; no se declara una eliminación inexistente.
- Ventas como espacio propio, gastos recurrentes y previsión/avisos, navegación por secciones, calendario compacto de Tareas, ampliación de Mi cuenta y simetría de widgets.
- Margen: los cálculos de Pedidos y Resumen no arreglan por sí mismos el widget independiente `home.gain`, que todavía contiene una respuesta fija «Sin validar», ni añaden la serie a la gráfica. El punto 16 sigue abierto. Aplicar el mismo cálculo basado en costes de producto/variante, cobertura explícita y separación de gastos/beneficio neto.
- Vendedor y cajón: requieren una relación acreditada con el pedido para cada tienda. No asignar por coincidencia de horario ni dar el PR #181 por concluido.
- Reloj/calendario: el color publicado no equivale a tener controles propios de tamaño, diseño y funciones.
- Migración: la preproducción PS 8.2.8 es independiente y Totus permanece conectado a Hortimatic 1.7. No confundir los datos migrados con la autorización de cambio a producción ni omitir el corte final, pagos, correo, envíos y contraste de existencias.
- Manuales en Fuentes: no se acredita la carga por existir los archivos en el repositorio. `sources/` permanece de solo lectura.

## Simulaciones añadidas después de #186

`tests/catalogue-workspaces-resilience-browser-qa.mjs` usa datos ficticios y una API simulada; no hace peticiones ni escrituras a tiendas reales. Se ejecuta a 390 y 1440 px:

| Recorrido | Comprobación |
|---|---|
| Grupos, productos y combinaciones con más de una página | Se consultan las siguientes páginas y se cuentan todos los asociados |
| Cuenta de solo lectura, sin producto de trabajo | Edición y creación deshabilitadas; ninguna operación de escritura |
| Fallo al actualizar | Se conserva la lectura anterior fechada y se muestra el error |
| ID repetido entre páginas | Error; no se anuncia un catálogo completo ni se rellena la caché con el resultado |
| Página vacía que anuncia más resultados | Error; no se interpreta como fin correcto |
| Respuesta de otra tienda | Se rechaza explícitamente dentro del componente |
| Cambio de tienda con una lectura en curso | La respuesta tardía no sustituye la tienda actual |
| Cambio de cuenta con una lectura en curso | Los datos anteriores no aparecen en la nueva cuenta |
| Salida de la pantalla con una lectura en curso | No se vuelve a insertar ni actualizar una pantalla desmontada |
| Diseño y errores JavaScript | Sin desbordamiento de página ni errores no controlados |

La primera ejecución detectó que el componente confiaba en la validación de tienda del conector. El conector de producción ya la realiza; no se ha demostrado una mezcla real de tiendas en producción. Se añade la misma comprobación al componente (`ok`, tienda, recurso, página y filas), y la simulación pasa después del cambio.

Resultados locales: pasan los dos tamaños de esta prueba y los cinco tamaños del recorrido principal de atributos/diagnóstico. El informe JSON se genera en `qa-artifacts/catalogue-resilience/report.json`; el principal, en `qa-artifacts/catalogue-workspaces/report.json`. Los resultados de CI deben consultarse en el PR de esta revisión.

## Condiciones para cerrar cada punto siguiente

Una pantalla creada o un botón visible no basta. Registrar permiso/identidad, tienda, entrada utilizada, respuesta, relectura y resultado comparado. En escritura, distinguir guardado confirmado de resultado incierto y conservar la solicitud para evitar duplicados. En lecturas, identificar cobertura y fecha; no representar desconocidos como cero. Distinguir expresamente prueba simulada, PrestaShop aislado y tienda real.

Clientes/Proveedores/Marcas necesitan además probar direcciones y relaciones, varios resultados/páginas, errores de permiso, edición desde su ficha y tabla, persistencia de columnas y cambio de tienda sin datos cruzados. Gastos recurrentes debe probar vencimientos, reintentos y ausencia de doble contabilización. Ventas/margen debe probar descuentos, devoluciones, coste de combinación frente al de producto, costes ausentes/cero, monedas, agregados y rangos parciales. Estos casos siguen siendo requisitos pendientes, no resultados positivos inventados.
