# Catálogo y atributos — segundo bloque del listado

## Alcance

Puntos 5 y 17: nueva pestaña **Atributos** en Productos, con secciones Atributos y Características. Puntos 13, 19 y 20: diagnóstico compartido en Inicio y PrestaShop. Este bloque no termina Clientes, Proveedores, Marcas, Ventas, gastos recurrentes ni el acceso automático a POSTPV.

La conexión de Totus permanece en Hortimatic 1.7 y NewOldSmok. No cambia el destino a preproducción, no instala componentes en las tiendas y no requiere migraciones ni despliegue de servicios.

## Atributos y características

1. Selecciona una tienda concreta. «Ambas tiendas» pide elegir una: sus identificadores internos no se mezclan.
2. Abre Atributos. Los grupos aparecen a la izquierda y sus valores a la derecha. Características describe el producto completo; Atributos distingue combinaciones.
3. Busca un grupo o valor por nombre o ID. Los valores se paginan en 10, 20, 50 o 100. Cambiar de tipo limpia filtros anteriores; cambiar de tienda reinicia la selección.
4. **Productos asociados** consulta el catálogo completo y las combinaciones cuando corresponda. Cuenta productos únicos y combinaciones por separado. Las características se relacionan mediante la asociación de la ficha.
5. **Editar grupo/valor** lee el registro y el perfil de la tienda. Modifica los campos, pulsa **Revisar cambios** y **Aceptar y sincronizar**. La respuesta se relee y contrasta antes de cerrar la edición. Otros idiomas y campos quedan conservados. Un único idioma se utiliza sin pedir elegir un ID.
6. **Crear atributo/característica/valor** reutiliza la preparación existente del producto de trabajo. Requiere seleccionar previamente una ficha. La creación independiente de maestros y su eliminación siguen pendientes: no se presentan como terminadas.

Renombrar un dato compartido afecta a los productos que lo usan en esa tienda. No lo confundas con cambiar el nombre de una combinación particular. Actualizar vuelve a leer; entrar muestra la última lectura de esa cuenta/tienda y la renueva sin temporizador. Respuestas de una cuenta, tienda o pantalla abandonada no deben modificar la nueva pantalla.

## Calidad del catálogo

**Consultar catálogo / Actualizar diagnóstico** recorre sus páginas. La pantalla distingue lectura parcial, catálogo completo y ausencia de consulta, e indica fecha, fichas leídas y fichas afectadas. Una ficha puede tener varios avisos; el total de afectadas no suma avisos duplicados.

Se revisan referencia vacía, EAN vacío, formato EAN distinto de 13 dígitos, EAN repetido, peso no positivo y portada no informada. Son candidatos a revisión de la ficha base: un EAN o peso puede estar en las combinaciones. No valida dígito de control ni inventa datos ausentes.

Pulsa un diagnóstico para filtrar las fichas consultadas. **Abrir en Productos** abre la tienda y el producto exactos, respetando el permiso de acceso y el control de cambios sin guardar. Inicio muestra foto, referencia e ID de hasta ocho afectados con acceso a su ficha. Para corregir utiliza el recorrido de publicación existente del producto; consultar no escribe en PrestaShop.

## Verificación y límites

Pruebas dirigidas del modelo y consultas; recorridos Playwright con API simulada en 390, 768, 1017, 1440 y 1920 px. Cubren paginación, edición con relectura, asociaciones sin duplicar, características, separación entre tiendas, consulta de todas las páginas, apertura del producto correcto y ausencia de desbordamiento. Las simulaciones no certifican una escritura real en una tienda: esa comprobación debe registrarse por separado.

Regresiones locales superadas: gestor de maestros existente, selección compartida de producto (incluida apertura externa), relaciones, PrestaShop e Inicio; además, modelo de calidad (3 pruebas), consultas (23), núcleo de Productos (11) y paginación. Los resultados definitivos y la publicación se registran en el PR y en el plan de trabajo. No se declara este documento cargado en Fuentes hasta verificarlo; `sources/` sigue siendo de solo lectura.

Revisión adicional: `REVISION_COBERTURA_2026-11-12.md` registra omisiones, simulaciones de fallos y separación de cuenta/tienda. La publicación #186 se verificó en el commit `35f852568022e585a9349b141cd2e4e6c646adf5`.
