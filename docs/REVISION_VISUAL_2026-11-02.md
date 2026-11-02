# Revisión visual de Totus Central — 2 de noviembre de 2026

Revisión: https://github.com/hortimatic/Totus-Central/pull/85

## Alcance

Presentación adaptable de los 13 módulos. Se conserva la estructura, los campos, las operaciones, la personalización y los permisos existentes. No se modifica la contabilidad ni se prueban altas sobre datos reales.

Stitch aportó una propuesta de Chat móvil y observaciones sobre sus maquetas. Una maqueta de Stitch no acredita el funcionamiento de Totus Central: la verificación se realiza sobre el código real, con capturas, recorridos y una comprobación posterior a la publicación.

## Correcciones

- Chat móvil: cabecera compacta con nombres accesibles, conversación con desplazamiento propio y editor visible. El encabezado repetido del módulo deja de ocupar espacio en teléfonos.
- Herramientas del editor y acciones de mensaje accesibles al tacto sin desplegar todos los controles en cada mensaje. Se conservan adjuntos, menciones, zumbido, emoji, edición, borrado, respuestas, tareas y solicitudes a asistentes según los permisos existentes.
- La altura se recalcula cuando cambia el contenedor, la ventana o el área visible del teclado. Se retiran los observadores al abandonar el módulo.
- Configuración móvil: los tres botones de la barra de guardado ocupan dos filas.
- Copias móvil: el texto de selección de archivos deja de reservar 180 píxeles de alto vacío. El estado de programación se adapta al ancho de la tarjeta.
- Se evita que el texto oculto de Ajustes de Chat ensanche su botón y se superponga a Nuevo.

## Evidencia repetible

- `tests/chat-mobile-reading-browser-qa.mjs`: seis tamaños (320×640, 390×844, 430×932, 700×900, 390×360 y 844×390), hojas de estilo completas, altura de lectura, editor dentro de pantalla, borrador, herramientas, acciones y vuelta a canales. Incluido en la batería ordinaria de publicación.
- `tests/subtab-walk-qa.mjs`: 13 módulos y pestañas de Gastos, Facturación, Administración y Configuración; anchos 320, 390, 1180 y 1640. Incluye registros ficticios con nombres largos, importes y documentos, además de las vistas de nueva recepción y biblioteca.
- `tests/modal-geometry-qa.mjs`: ventanas y páginas de alta de productos, cierres, gastos, facturas, documentos, usuarios, roles, categorías, clientes, plantillas, series y ajustes fiscales, en 320, 390, 768 y 1440 píxeles.
- Las pruebas existentes de temas claro/oscuro, navegación, personalización y comportamiento de Chat complementan esta revisión.
- Capturas y resultados: artefacto `totus-interface-review` en la ejecución de revisión de interfaz del mismo commit del PR. Los controles del PR y la publicación deben terminar correctamente antes de considerar desplegado el arreglo.

## Límites de la comprobación

Las dimensiones pequeñas simulan la reducción del espacio de pantalla; no sustituyen una prueba física con cada teclado de Android o iOS. Los recorridos utilizan datos ficticios y no certifican la corrección fiscal de documentos reales. No se declara ausencia absoluta de defectos futuros ni se cambia la configuración personal de los usuarios para ocultar problemas.
