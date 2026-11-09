# Verificación de Productos, Pedidos y perfiles · 9 de noviembre de 2026

## Cambios entregables
- Acciones de Catálogo homogéneas: Abrir ficha, Edición rápida, Publicar y un menú secundario para enlaces y otras operaciones.
- Edición rápida en ventana alineada, con diferencias, guardado nativo, relectura y recuperación conservando la solicitud.
- Guardado y publicación desde Producto. Elección de producto solo o producto con sus cambios de combinaciones y cargas preparadas. Las variaciones existentes se conservan.
- Publicación revisable junto a las acciones principales; si falla una combinación o la asociación de una foto no se activa la ficha.
- Selector de idioma solo cuando existen varios idiomas. Historial consultable y enlace a la ficha para rectificar mediante una nueva operación.
- Margen de Pedidos calculado con coste nativo disponible, preferencia por combinación y respaldo del producto. Se corrige el rechazo de números calculados con más de dos decimales.
- Totales compactos de ventas y margen para los resultados filtrados consultados, con avisos de alcance parcial y moneda. No son beneficio neto.
- Vistas personales con nombre conservadas en la cuenta; ya no solo columnas y anchos. Se elimina la sustitución automática de órdenes de columnas válidos por una plantilla inicial.
- Perfiles de columnas del equipo: compartir explícitamente, aplicar una copia personal y retirar solo los propios. No se comparten consultas, filas ni credenciales. Incluye Productos y Pedidos.

## Evidencia automatizada local
129 comprobaciones de contratos de Productos superadas antes de añadir los perfiles; las pruebas nuevas de publicación también pasan. Pruebas Playwright verificadas:
- Crear desde cero, modificar, añadir variación, subir imagen, asignarla, publicar sin perder combinaciones e historial: 390, 969 y 1920 píxeles.
- Edición rápida, relectura, archivo, recuperación de respuesta perdida y UUID estable: 390, 768 y 1440.
- Copia integral: fotos, correspondencia de atributos, textos y enlaces por tienda; interrupción y recuperación sin duplicados.
- Copia desde su pestaña y selección de producto compartida entre pestañas: 390 y 1440.
- Anchos, orden, guardado y recuperación de perfiles personales con caché local borrada: 390, 680, 969, 1280, 1920 y 2560.
- Pedidos: columnas, configuración, orden, paginación, selección y margen agregado: 390, 969 y 1920.
- Perfiles del equipo: compartir, aplicar desde otra cuenta y retirar conservando la copia personal: 390 y 1440.

Estas pruebas de navegador usan respuestas simuladas de la API de negocio. Verifican la interfaz y sus contratos; no equivalen por sí solas a operaciones en las tiendas reales. Los controles de base de datos y el PrestaShop aislado se ejecutan en CI.

## Prueba real mediante Totus con la cuenta Codex
Tienda Hortimatic. Muestra ficticia autorizada, referencia QA-RECORRIDO-20261109-H-CODEX.
- Producto: 170807061.
- Combinaciones: 6539 (Rojo) y 6540 (Amarillo).
- Imagen: 14847, subida con transparencia y asociada a ambas combinaciones, releída desde la API.
- Precio neto: 10,00; coste nativo: 3,90.
- Publicación: active=1, visibility=both, available_for_order=0. Sin ventas ni cantidades comerciales ficticias.
- Relecturas: trabajos 4807b27d-4799-42d7-b19c-2f9ee2b215b0, 0bafe49b-fd8a-4fe8-a04f-52319dec57bc y 4c16135a-c55c-40dd-bf5d-da8cfc4b659e.

### Segunda tienda: copia de la muestra
Se ha creado en NewOldSmok la muestra 170807262, referencia QA-RECORRIDO-20261109-N-CODEX, con ambas traducciones instaladas, textos adaptados a NewOldSmok y los mismos importes sintéticos. Imagen 12675; combinaciones 4861 (Rojo, atributo nativo 11) y 4862 (Amarillo, atributo nativo 13). La publicación se ha verificado con active=1 y available_for_order=0. Relectura de la ficha: f76b99fe-0288-48b0-bfca-2d2a58456521.

Esta prueba detectó que la lectura individual JSON de combinaciones devolvía 403 aunque el guardado y la comprobación XML nativos funcionaban. La corrección usa XML como representación principal para leer combinaciones, igual que su verificador de escritura, con validación del ID, producto padre y asociaciones. También se aplica a la asignación de fotos y comprobación previa de borrado. Un 403 en esta lectura se conserva como error: no se reintenta por otra ruta ni se alteran permisos. La prueba del servicio actualizado debe completarse después de su despliegue; la creación y publicación citadas sí están verificadas por el servicio anterior.

El circuito real utiliza las operaciones autenticadas de Totus y sus diarios; no debe describirse como prueba Playwright de la interfaz todavía no desplegada.

## Vendedor: hallazgo real y pendiente explícito
El historial nativo de cajas de NewOldSmok relaciona los movimientos con pedido, referencia y empleado. Se comprobaron los pedidos 15162/PIATADYVU y 15163/AJVXYAHJX con Sequera, Diego. El JavaScript nativo de POSTPV consulta getMovimientosByCaja y muestra la columna empleado.

Por tanto, el dato existe. Lo pendiente es proporcionar a Totus una lectura automática autenticada de esa relación: no aparece como recurso de POSTPV en la API publicada que se ha diagnosticado. No basta la lista employees ni el empleado que abrió la caja. No se atribuye un vendedor por coincidencia de hora ni se reutiliza silenciosamente la sesión del administrador para alimentar el servidor. No se instala un puente ni se modifica PrestaShop. Hasta disponer de esa lectura, la columna indica Sin vendedor vinculado con explicación.

## Límites y conservación
No se han instalado módulos ni modificado núcleo/esquema de las tiendas. No se han cambiado ventas, facturas o contabilidad. El parche 075 modifica únicamente preferencias y perfiles de presentación en Totus; conserva las demás preferencias de usuario y exige acceso al módulo. El acceso administrativo directo de PrestaShop necesita un enlace nativo válido de la sesión; no se fabrica un token a partir de la clave API.

Protocolo de uso y de ChatGPT: docs/RECORRIDOS_PRODUCTOS_CHATGPT.md. No dar por terminado un guardado sin resultado verificado y relectura.
