# Peticiones — Contactos, Configuración e integraciones — 02/11/2026

Estado inicial: rama feat/contactos-configuracion-agentes, basada en producción eac84c2a. No se considera terminado un punto hasta probar el recorrido y su resultado. No se retiran datos ni funciones necesarias.

- [ ] CONTACTOS-01: navegación Contactos → Clientes, Proveedores y Marcas; fichas completas.
- [ ] CONTACTOS-02: directorio compartido y selectores completos en Gastos, Pricing, Recepciones y Facturación, preservando relaciones antiguas.
- [ ] AYUDAS-01: información al pasar el cursor, enfocar con teclado y tocar en móvil.
- [ ] TAREAS-01: eliminar tareas activas/archivadas con permisos y confirmación, sin borrar datos enlazados.
- [ ] CHAT-01: Enviar siempre accesible dentro de la pantalla, con teclado, adjuntos y herramientas.
- [ ] CONFIG-01: tres pestañas principales Interfaz, Login y APIs; mejorar orden sin perder ajustes.
- [ ] API-01: gestor de conexiones HTTP/API, crear/configurar/probar/duplicar/desactivar/eliminar.
- [ ] API-02: secretos exclusivamente en servidor; cuentas propias y privilegios configurables para cada integración.
- [ ] IA-01: proveedor intercambiable asociado a Totus IA.
- [ ] IA-02: consultas por fechas, informes de ventas, documentos/descargas y respuestas con adjuntos en Chat.
- [ ] IA-03: acciones verificadas de gastos, cajas, facturas y cotejos de recepciones, respetando los permisos asignados.
- [ ] IA-04: acceso a mantenimiento de código mediante conexión autorizada y rama de revisión; sin credenciales administrativas en el navegador.
- [ ] CONSUMO-01: consultas, consumo y cuota restante suministrados por el proveedor; límites locales diferenciados y datos no disponibles identificados.
- [ ] CALIDAD-01: retirar implementación sustituida y duplicaciones comprobadas; mantener trazabilidad de migraciones.
- [ ] CALIDAD-02: contraste visual con Stitch, pruebas Playwright de móvil/PC y verificación de resultados, no solo de clics.

## Hallazgos iniciales

- Proveedores separados: ops_suppliers (gastos) y providers (Pricing).
- Configuración agrupa Interfaz/Login y muestra conexiones específicas, no un gestor general.
- Totus IA tiene sesión propia, pero su repertorio de herramientas y sus consultas son limitados. Conceder un rol no añade las operaciones ausentes.
- Las tareas tienen archivado; debe revisarse la operación de eliminación de la tarea y sus ocurrencias/historial antes de implementarla.

## Criterios de aceptación

- Los datos existentes permanecen accesibles y no se duplican silenciosamente.
- Cada selector consulta el mismo directorio y conserva su identificación antigua cuando es necesaria para precios/documentos históricos.
- Las integraciones registran la identidad que ejecuta cada acción y confirman el resultado real antes de responder que está guardado.
- El consumo observado y los límites configurados se muestran por separado. No se presupone que cualquier API tenga el mismo protocolo, autenticación o información de cuota.
- Las pruebas se realizan en copia/rama y con datos ficticios; la publicación requiere controles aprobados.

## Preparado en la rama, todavía sin validar ni publicar

- Navegación inicial de Clientes, Proveedores y Marcas, reutilizando los permisos de sus módulos de origen.
- Separación inicial de Interfaz, Login y APIs; conserva los ajustes existentes.
- Apertura de las ayudas al pasar el cursor y enfocar, conservando el toque.
- Borrador del cambio de Tareas para eliminación recuperable e historial conservado. El parche SQL no está aplicado.

Estos puntos siguen sin marcarse como terminados: faltan las pruebas, la unificación de proveedores y el resto del gestor de conexiones y herramientas de IA. Producción sigue en eac84c2a.
