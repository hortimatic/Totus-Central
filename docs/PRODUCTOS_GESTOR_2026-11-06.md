# Productos · primera entrega en rama (06/11/2026)

## Objetivo acordado
Módulo propio **Productos**, separado del Centro PrestaShop, para Hortimatic y NewOldSmok. Crear fichas con variantes y seleccionar destino Hortimatic, NewOldSmok o ambas. Si el destino ya tiene el producto, preparar una **actualización de campos seleccionados**, no una clonación ni sobrescritura total. Las combinaciones se identifican individualmente.

## Hechos que cubre este primer PR
- Ruta propia en Operaciones tienda, reutilizando el permiso de PrestaShop para consulta y las conexiones autorizadas existentes. No crea identidades ni credenciales nuevas.
- Catálogo por páginas y búsqueda entre productos cargados, lectura detallada por ID con recurso products/combinations y comprobación de tienda, ID y pertenencia de combinación.
- Vista de ficha completa recibida por API; campos habituales seleccionables y editables en **borrador**. Los demás aparecen como lectura, sin aparentar que son editables.
- Panel independiente para combinaciones: selección y edición de campos por variante, no por todo el producto.
- Borrador de alta sin ID de PrestaShop y variantes nuevas con identificador temporal.
- Selección de una o ambas tiendas de destino; búsqueda de coincidencia por referencia exacta y comprobación de duplicados; preparación por separado de planes CREATE/UPDATE.
- Vista previa de campos alterados y advertencias para atributos, categorías, imágenes, impuestos y existencias que requieren relaciones propias.
- Tests puros y mock de lectura. No hay SQL ni modificaciones en Supabase, PrestaShop o OneDrive.

## Lo que NO se entrega todavía
- **No existe escritura POST/PUT ni activación de publicar.** El botón permanece deshabilitado por diseño: no se afirma que el módulo cree o modifique ya fichas reales.
- No se reasignan automáticamente IDs de categorías, imágenes, atributos, fabricantes o impuestos entre tiendas.
- El modo bulk inicial selecciona combinaciones de la ficha abierta, pero aún no ejecuta lotes de productos completos.
- Los campos personalizados por módulos requieren estudio del Webservice real.
- No hay historial persistente ni mecanismo de reanudación de un lote fallido.
- La lectura detallada limita a 75 combinaciones para evitar respuestas y costes no acotados; ampliar con paginación antes de uso intensivo.
- Un posible duplicado sin referencia se queda pendiente; no se da por nuevo automáticamente para publicación.

## Antes de activar escritura
1. Validar en un PrestaShop **aislado y compatible** qué atributos devuelve GET por ID, cómo limpiar campos no editables y cómo formar el XML completo obligatorio para POST/PUT en 1.7.8.11.
2. Registrar en servidor permiso de escritura específico (no basta el permiso de lectura), operación con request_id estable, estado y auditoría. Confirmar permisos del Webservice de cada tienda.
3. Verificar productos con distintos idiomas, múltiples combinaciones, categorías y reglas fiscales. Un mismo EAN, nombre o ID entre tiendas no acredita misma ficha.
4. Implementar CREATE desactivado por defecto y luego creación de variantes con mapeo de atributos; tras cada respuesta comprobar de nuevo el recurso y sus relaciones antes de darlo por completado.
5. Implementar PUT de campos seleccionados sobre un XML fresco del destino, con comparación previa y detección de cambios concurrentes; no borrar campos omitidos, imágenes ni combinaciones.
6. Añadir imágenes y categorías solo con selección/reasignación explícita, más precios/stock bajo autorizaciones concretas.
7. Implementar lotes pequeños, estado por producto y variante, reintentos sin duplicados y recuperación o compensación cuando un lote quede a medias.
8. Ejecutar pruebas de lectura, escritura, errores, doble envío, sesión, permisos y regresión; revisión técnica del servicio; comparar resultados desde el back office antes de publicar el módulo.

## Normas de despliegue
No fusionar ni publicar por existir esta rama o un CI verde. Un PR en borrador indica implementación parcial, pendiente de validación. No crear pruebas reales, productos falsos ni cambios de stock en las tiendas en producción. El contrato previo de Gastos, Cajas, PrestaShop, Recepciones y Pricing se conserva.
