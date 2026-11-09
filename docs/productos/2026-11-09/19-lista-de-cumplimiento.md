# Productos y pedidos: control de peticiones

Fecha: 9 de noviembre de 2026. Documento de trabajo; no acredita publicación.

## Reglas que se conservan

- API oficial de cada tienda; no instalar módulos ni modificar PrestaShop.
- Identidad propia de cada operador o IA y permisos efectivos de Productos.
- No cambiar funciones ya validadas salvo para corregir un fallo comprobado.
- Mantener las cinco pestañas de Productos y la estructura visual existente de Stitch.
- Separar prueba simulada de comprobación real y código preparado de código publicado.
- No inventar costes, existencias, EAN, autores ni empleados.

## Matriz de esta entrega

| Petición | Implementación local | Comprobación / pendiente |
|---|---|---|
| Crear producto desde cero | Botón Crear producto, ficha vacía | Prueba local de alta, combinación y publicación superada |
| Guardar y sincronizar producto en Producto | Revisión y aceptación en la propia ficha | Prueba dirigida local en 390/969/1920 |
| Guardar variaciones en su propia sección | Revisión y aceptación por combinación | Prueba dirigida local |
| Subir foto y asociarla a una variación | Subida nativa y selección visual; dos guardados explícitos | Prueba dirigida local |
| Publicar producto simple o con variaciones | Revisión y publicación accesible desde la ficha | Acceso desde ficha, alta y combinación comprobados en simulación |
| Cambios como historial | Historial y borradores, sin editor operativo | Prueba dirigida local |
| Copia con imágenes, combinaciones y textos adaptados | Sección Variaciones; preparar, confirmar subida y completar copia | Simulaciones de copia con imágenes y de combinaciones superadas; falta comprobación real |
| Edición rápida en Catálogo | Doble clic o Intro, revisión y guardado de fila | Prueba dirigida local |
| Tabla Pedidos y ventas configurable | Columnas, orden, anchos, vistas, selección, CSV y páginas | Prueba local 390/969/1920 |
| Limpiar buscador y filtros de pedidos | Conserva periodo y vuelve a la primera página | Prueba dirigida local |
| Cliente, hora, empleado y margen en tabla | Columnas y carga de datos de la página | Cliente y margen requieren detalle; empleado no publicado se identifica como no informado |
| Entrada al producto en backoffice | Enlace de catálogo configurado por sesión de navegador | PrestaShop rechaza enlace sin token; no se elude su validación |
| Personalización de tablas persistente | Productos mantiene perfil; Pedidos guarda en este navegador por usuario | Productos entre dispositivos; Pedidos aún solo navegador |
| Marcas, proveedores y atributos compartidos: consultar, crear y editar | Relaciones por producto y creación de atributos ya disponibles | Gestor compartido implementado y simulado; creación durante la preparación de un producto; falta despliegue y prueba real |
| Contadores de productos asociados | Lectura completa explícita, proveedores principales y adicionales, productos y combinaciones | Pruebas locales superadas; falta comprobación real |
| Descripciones de permisos en todos los módulos | Publicado en entrega anterior | No modificar permisos sin necesidad |
| Ajustes visuales, emergentes, información y accesibilidad | Revisión dirigida en curso | Pendiente inspección final de las pantallas alteradas |
| Manual para ChatGPT | Este índice y manual operativo de la entrega | Completar con evidencias finales y limitaciones reales |
| Publicación y prueba real en ambas tiendas | Pendiente | CI, despliegue y verificación posterior no realizados todavía |

## Peticiones anteriores que se deben preservar

Buscadores sobre catálogo completo en Catálogo, Producto y Copiar; páginas y tamaño de página; caché actualizada por navegación y escrituras; limpiar búsquedas; costes con IVA y recargo; margen en euros; columnas cortas, ordenables y redimensionables; fotos reconocibles y ampliación al pasar el cursor; adaptación Hortimatic/NewOldSmok; selección de imágenes y variantes; navegación sin perder borradores; sin columnas inmovilizadas ni scroll vertical interno; apariencia personal respetada. No reescribir estos circuitos para incorporar los nuevos.

## Criterio de cierre

Solo marcar publicada una petición tras verificar la versión servida. Los circuitos con escrituras necesitan comprobar el ID y contenido de destino y conservar el origen. Ante respuesta incierta, conciliar la misma solicitud; nunca duplicar el alta. Un informe simulado no prueba una escritura en las tiendas reales.
