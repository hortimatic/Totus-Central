# Productos: recorrido de trabajo y comprobaciones de usabilidad

## Qué guarda cada botón

- **Guardar borrador en Totus** conserva el trabajo de esta cuenta. No envía cambios a PrestaShop.
- **Revisar cambios en tienda** muestra las diferencias de la ficha y la tienda de destino. Revisa esa información antes de confirmar su guardado.
- En combinaciones, imágenes, existencias y otros cambios adicionales, **Guardar esta etapa** valida automáticamente la petición y después guarda y verifica. **Validar esta etapa** queda disponible como comprobación previa opcional.
- Si una respuesta se pierde, **Comprobar resultado sin repetir** conserva la identidad de la petición. No se debe crear otra solicitud para sustituir una incierta.
- La ficha distingue cambios pendientes y guardados. Ninguna escritura se considera terminada solamente porque se haya pulsado un botón.

## Catálogo

La primera consulta descarga una página de 100 productos del servidor, pero no es el límite del catálogo. **Consultar catálogo completo** recorre las páginas restantes y permite detenerse después de la página en curso. La tabla muestra 20, 50 o 100 filas por página. Los filtros por nombre, categoría, marca y estado actúan sobre los productos consultados; el aviso de alcance permanece visible mientras faltan páginas.

Para localizar un producto que todavía no se ha descargado, escribe su ID o referencia exacta y pulsa **Buscar ID / referencia en tienda**. Esta acción consulta la API de la tienda; no se limita a filtrar las primeras filas.

La casilla de cabecera selecciona la página visible. La casilla de la barra selecciona todos los resultados del filtro entre los productos cargados. Las tiendas mantienen identidades separadas aunque coincida el ID numérico.

**Abrir ficha** y **Editar fila** permanecen visibles. Archivar, duplicar y eliminar se agrupan en el menú de cada fila. Las columnas se configuran y sus vistas se guardan por usuario. Las flechas recorren las celdas y desplazan horizontalmente la tabla; en los campos de combinaciones se usa Alt + flechas para conservar la edición normal del texto.

## Selectores

Las listas extensas se buscan en un cuadro que conserva el selector nativo como fuente del formulario. En selección múltiple, marcar opciones no aplica todavía el cambio: **Aplicar selección** confirma; Escape o cerrar lo descarta. El fondo de la pantalla no debe captar clics mientras el cuadro está abierto.

## Recorridos de verificación

Pruebas de navegador con transporte simulado, sin escrituras en tiendas comerciales:

1. Catálogo de 137 productos: consulta completa, paginación, búsqueda exacta de un ID fuera de lo descargado y selección.
2. Menús dentro de la pantalla, cierre con Escape, selección múltiple con confirmar/cancelar y búsqueda por teclado.
3. Edición y guardado de fila con relectura; archivo reversible; duplicación en borrador; eliminación con confirmación y comprobación de ausencia.
4. Creación con combinación, existencias, imagen normalizada y descripción; recuperación del borrador sin repetir las peticiones.
5. Copia entre tiendas conservando atributos y combinación predeterminada; añadir una combinación a un producto simple, guardando directamente con validación automática.
6. Copia de fotos desde el origen autenticado, transformación al tamaño del destino, guardado y asociación; portada, fotos de combinaciones, sustitución y organización.
7. Preferencias visuales, cinco pestañas y nueve apartados, tamaños de 390 a 1440 píxeles; el nuevo recorrido del catálogo incluye 1024 píxeles.

Los resultados comerciales y sus identificadores se registran aparte en los informes de recorridos reales. Las simulaciones anteriores no prueban por sí solas una subida comercial de imágenes ni la usabilidad de cualquier configuración personal. La galería principal de PrestaShop 1.7 mantiene las limitaciones documentadas de su API nativa sobre orden y textos alternativos. No se instalan complementos para sustituirlas.
