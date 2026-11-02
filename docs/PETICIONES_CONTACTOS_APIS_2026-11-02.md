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

## Estado tras los PR #86 y #87

Publicado en 513c0a15; corrección de actividad del PR #87 aplicada e integrada en 7fcc16c.

| Punto | Estado real |
|---|---|
| CONTACTOS-01 | Publicado: Clientes, Proveedores y Marcas; ampliación de campos de contacto. |
| CONTACTOS-02 | Publicado: 54 proveedores sincronizados, UUID y referencias conservados; pruebas de compatibilidad de copias. |
| AYUDAS-01 | Publicado; pruebas de hover, foco y cierre. |
| TAREAS-01 | Publicado; eliminación recuperable, incluidas archivadas, con permisos y control de revisión. |
| CHAT-01 | REABIERTO: el usuario sigue necesitando desplazar la página para el editor. Se reproduce con la cabecera real; no se da por resuelto por pasar el ensayo aislado. |
| CONFIG-01 | Publicadas las tres pestañas; mejora general de orden y configuración todavía parcial. |
| API-01 y API-02 | Pendientes: gestor genérico, ciclo de vida completo, identidades y permisos de conexiones. La conexión específica de Cloudflare no cumple todo este punto. |
| IA-01 | Pendiente: proveedor intercambiable para Totus IA. |
| IA-02 | Parcial: informes completos por fechas y consultas paginadas publicados. Pendientes descargas y envío de documentos como adjuntos. |
| IA-03 | Parcial: existen herramientas de gastos, cierres y cotejos; falta ampliar facturas y validar el circuito real completo de las operaciones solicitadas. |
| IA-04 | Pendiente: conexión de mantenimiento de código mediante rama de revisión. |
| CONSUMO-01 | Pendiente: contador claro de uso, límites locales y cuotas reales del proveedor cuando estén disponibles. |
| CALIDAD-01 | Parcial; no se declara una limpieza total realizada. |
| CALIDAD-02 | Parcial: pruebas de navegador y base de datos aprobadas; falta contraste visual completo con Stitch y validar las ampliaciones aún no construidas. |

No se declara terminado el conjunto de peticiones. Los elementos parciales y pendientes deben conservarse en los relevos.
