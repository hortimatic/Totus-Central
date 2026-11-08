# Productos: revisión funcional y protocolo de trabajo

Fecha: 8 de noviembre de 2026. Alcance: módulo Productos, conservando las cinco pestañas y nueve apartados del diseño de Stitch. Esta documentación no autoriza instalaciones, cambios del núcleo ni SQL en PrestaShop.

## Informes por circuito

1. [Alta con combinaciones](01-alta-con-combinaciones.md).
2. [Modificación y archivado](02-modificacion-y-archivo.md).
3. [Añadir combinaciones a un producto simple](03-combinaciones-en-existente.md).
4. [Copia entre tiendas y duplicación](04-copia-y-duplicacion.md).

## Qué significa cada comprobación

- **Playwright simulado**: navegador real, interfaz real y respuestas controladas. Permite verificar acciones, datos enviados, errores, tamaños y continuidad; no demuestra una escritura en una tienda real.
- **PrestaShop aislado**: API nativa de PrestaShop 1.7.8.11 y base de datos desechables en CI. Realiza POST, PUT, DELETE y relecturas; no toca las tiendas comerciales.
- **Tienda comercial**: requiere registrar tienda, ID, referencia, petición, resultado y relectura. No se marca un circuito como real por haber pasado una simulación.

Las muestras existentes identificadas por interfaz son `pruebas` (Hortimatic 170807054), `pruebas 2` (Hortimatic 170807055; NewOldSmok 170807253) y Argus P3 (Hortimatic 170807057; NewOldSmok 170807255). No borrar ni modificar sus datos comerciales para probar un botón. Las pruebas de escrituras se identifican con referencia QA propia y estado inactivo; no se inventan existencias.

## Cambios revisados

- Edición de nombre, referencia, EAN, coste, precio base, peso, medidas y estado desde la tabla. Elegir idioma cuando corresponda. Revisar diferencias, guardar y releer la ficha.
- La cantidad física no se altera escribiendo un total agregado: se usa su etapa de existencias y combinación exacta.
- Flechas sobre celdas para recorrer filas y columnas; dentro de un campo conservan la edición normal del texto. Home/End van a extremos de la fila. Botones de columnas ofrecen alternativa táctil.
- Búsqueda en selectores largos sin sustituir sus controles nativos. Las selecciones se conservan al filtrar.
- Galería con celdas cuadradas y producto completo, sin recorte. Preferencias visuales de color, tipografía, bordes, radio y espaciado aplicadas sin cambiar la estructura del módulo.
- Archivar prepara desactivación, ocultación y bloqueo de compra. Es reversible. Eliminar utiliza DELETE nativo con revisión y confirmación explícita del ID; no es una papelera.
- Permiso independiente de Productos: ver, crear, editar, borrar y exportar. El permiso no concede acceso al gestor de claves. No se amplían por defecto permisos de usuarios existentes.

## Reglas de operación para ChatGPT

1. Confirmar tienda y producto por ID y referencia; no trasladar ID de otra tienda.
2. Leer la ficha y los idiomas antes de preparar cambios. Elegir expresamente los campos y el idioma.
3. Mantener la misma petición y huella en una escritura incierta. Comprobar el resultado antes de intentar otra operación.
4. Usar atributos, categorías, impuestos, proveedores y características del destino, comprobados por nombre y pertenencia. Ante ambigüedad pedir selección, sin inventar correspondencias.
5. Revisar diferencias. Crear bases inactivas y completar sus etapas. Activación y permiso de compra son decisiones independientes y se guardan expresamente.
6. Releer producto, combinaciones e imágenes. Registrar los ID reales y cualquier dato que no esté acreditado.
7. Una foto o referencia del proveedor no acredita EAN, peso de transporte ni existencias. No inventarlos.
8. No instalar módulos. El orden y los textos alternativos de la galería principal no se prometen como guardados nativos en la API 1.7 instalada; Totus los conserva en el borrador y puede usarlos en la descripción.

## Evidencias y conservación

Los archivos `qa-artifacts/productos-*-report.json` contienen resultados reproducibles del navegador. Las capturas y los datos leídos de tiendas comerciales permanecen fuera del repositorio público. Los informes distinguen expresamente sus niveles de comprobación. El espejo `sources/` es de solo lectura: estos documentos se preparan aquí para incorporarlos posteriormente a Fuentes del proyecto.

## Recorridos consolidados para ChatGPT
Consultar [12-recorridos-operativos-chatgpt.md](12-recorridos-operativos-chatgpt.md) para las instrucciones actuales de selección, creación desde URL, modificación, combinaciones y copia completa. El formato y las lecturas se describen en [11-protocolo-de-formato-y-lecturas.md](11-protocolo-de-formato-y-lecturas.md).
