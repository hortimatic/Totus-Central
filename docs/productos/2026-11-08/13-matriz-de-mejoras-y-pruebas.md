# Matriz de mejoras y prueba equivalente con ChatGPT

Revisión 9/11/2026. Complementa el manual 12, sin reemplazarlo. No se promete ausencia de todos los fallos posibles: cada circuito necesita evidencia de su ejecución y de sus resultados.

## Lista de comprobación por zona

| Zona | Mejora o comportamiento exigido | Prueba reproducible |
| --- | --- | --- |
| Catálogo | Cabeceras en dos líneas, cifras sin ampliar columnas por el texto del título | productos-table-browser-qa |
| Catálogo | Margen en euros = PVP base con IVA − coste × (1 + IVA/100 + RE/100); cambio de RE actualiza resultado | productos-table-browser-qa; productos-tax-qa |
| Catálogo | Impuestos desconocidos no se sustituyen por 21%; coste redondeado sigue siendo aproximado | productos-tax-qa; productos-connection-refresh-browser-qa |
| Catálogo | Limpiar filtros recupera los resultados cargados | productos-ui-browser-qa |
| Catálogo | Más de 100 artículos, páginas 20/50/100, consulta exacta y estado de lista parcial | productos-usability-browser-qa |
| Catálogo | Editar, revisar, guardar y releer la misma fila; archivar, duplicar y eliminación explícita en simulación | productos-table-browser-qa |
| Catálogo | Flechas siguen al bajar; ni columnas ni deslizador se fijan; navegación por teclado | productos-table-browser-qa |
| Producto | Selector común, cambios sin guardar conservados por producto y tienda | productos-shared-selection-browser-qa; productos-stitch-browser-qa |
| Producto | Apartados de datos, contenido, precios, variantes, imágenes, SEO, transporte, existencias y organización | productos-stitch-browser-qa; productos-existing-actions-browser-qa |
| Imágenes | Foto ampliable, galería, sustitución y asociación a combinaciones; no importar dos veces por reintento | productos-existing-actions-browser-qa; productos-image-copy-browser-qa |
| Copiar | Selector de origen dentro de la pestaña, fichas alineadas y destino con vista previa marcada como pendiente | productos-shared-selection-browser-qa; productos-ui-browser-qa |
| Copiar | Todos los campos y combinaciones elegidos, correspondencias de destino, imágenes nativas y textos adaptados | productos-copy-complete-browser-qa |
| Copiar | Interrupción recuperada conservando solicitudes sin fotos/productos duplicados | productos-copy-complete-browser-qa |
| Alta asistida | Cuatro órdenes: crear desde URL, modificar producto, añadir variación y copiar entre tiendas; manual enlazado, datos acreditados e identidades exactas. No confundir encargo con ejecución | productos-ui-browser-qa; productos-create-ui-qa |
| Cambios | Guardado explícito y relectura; no declarar una base o una vista previa como copia completa | productos-ui-browser-qa; productos-existing-actions-browser-qa |
| Todas | Controles y desplegables sin desbordamiento, cierre/escape/foco, ajustes de apariencia | productos-existing-actions-browser-qa; productos-table-browser-qa |
| Manual | Creación, modificación, combinaciones, copia en ambas direcciones, recuperación y límites de API acreditados | documento 12; contraste independiente de ChatGPT |

La revisión local utiliza datos ficticios en 390/680/768/1024/1440 según el circuito. Sus escrituras son simuladas. Las pruebas de API nativa aislada y de tienda comercial se anotan separadamente.

## Hoja de ejecución independiente de ChatGPT

El chat «Creación de productos» no registró el encargo y devolvió error de sistema. Se ha creado en el mismo proyecto «Productos · recorridos completos y pruebas», ID 6af10eb7-5d9c-83eb-ade5-0ebc36bfb1b5. El encargo está registrado; su estado activo no acredita todavía ejecución ni pruebas terminadas.

| Caso | Trabajo | Criterio de aceptación |
| --- | --- | --- |
| A | Crear un producto ficticio simple desde datos acreditados | Un solo ID nuevo, inactivo, sin compras, stock cero; campos y foto releídos |
| B | Modificar texto y precio | Mismo ID, cambios releídos, ningún alta duplicada |
| C | Añadir dos combinaciones al simple | Dos tuplas de atributos propias de destino, padre correcto, referencias únicas |
| D | Modificar una combinación y asociar foto | Mismo ID de combinación; valores y foto nativa releídos |
| E | Copiar H → N completo | Fotos/variantes/relaciones de N, idiomas y enlaces adaptados, H sin cambios |
| F | Preparar vuelta N → H | Detecta referencia existente, no crea tercer producto |
| G | Comprobar recuperación | Misma solicitud e identidad; no repite POST sin verificar |
| H | Seguir encargo de Alta asistida | Ejecución real de las acciones disponibles o explicación exacta del paso no ejecutable |

Antes de escribir: comprobar permisos de su cuenta propia y cuota; nunca elevar límites, compartir claves, instalar componentes ni modificar productos comerciales ajenos a la prueba. Utilizar referencias QA inequívocas. No eliminar definitivamente las muestras. Reutilizar fotos autorizadas, sin generar imágenes de producto.

Formato de informe: caso, fecha/versión, nivel (simulación/aislado/comercial), pasos, tienda/ID/referencia, solicitud, valores antes/después, IDs de fotos y combinaciones, resultado del guardado/relectura, captura o enlace, fallo y siguiente acción. PASS solo con evidencia observada; FAIL ante discrepancia; PENDIENTE si falta acceso o un dato. Un puente de escritura probado no demuestra que ChatGPT haya recorrido la interfaz.

## Precisión del margen

Ejemplo: coste base 1,90 €, IVA 21%, RE 5,2%, PVP 6 €. Coste total sin redondeo intermedio 2,3978 €; margen mostrado 3,60 €. No es beneficio neto: no resta alquileres, portes, comisiones ni otros gastos. El PVP es el precio base calculado de la ficha, sin aplicar ofertas, precios especiales o impactos de variantes; dichos precios deben revisarse en su circuito concreto. No ocultar esta diferencia al usuario.
