# Auditoría de estabilidad y carga · 14/11/2026

Base publicada: a031dcc2d6b38d0e6a8826c4a5ba41fbe9480152. Esta revisión no instala servicios, no cambia tiendas y no activa IA de pago. Vercel queda descartado. La autorización provisional de 10 €/mes no activa una API: Diego aplazó esa integración.

## Correcciones verificables

- El arranque llama al mismo selector de datos por módulo que la navegación. La comparación con el comportamiento anterior en fixtures da 34 tablas distintas frente a 7 para Productos, 7 para Ventas, 7 para Chat, 13 para Gastos y 20 para Inicio. Es reducción de lecturas, no una promesa de porcentaje de tiempo en producción.
- El HTML precarga app.js mientras descarga el SDK. Se comprueba que no evalúa el cliente antes de disponer del SDK, mantiene una única sesión y recupera la pantalla de acceso si falla la biblioteca. El preload lleva exactamente la misma versión que el import publicado.
- El diagnóstico reconoce el SDK local actual, además de la URL histórica.
- Almacenamiento admite referencias verificadas Free, Pro, Team y Enterprise; deja de rotular toda cuota como gratuita, no inventa libre global y conserva el límite interno de documentos separado del plan.
- La auditoría funcional incorpora los circuitos del registro de estabilidad. Usa un servidor ficticio compartido, no intenta abrir otro sobre el mismo puerto, y mantiene evidencia separada de producción.
- La prueba de impresión comprueba la llamada de la aplicación y genera el PDF sin competir con el diálogo nativo de Edge. El fallo intermitente del ensayo de adjuntos no se presenta como reparación de producción: el recorrido aislado y el integral pasan sin cambiar el código del chat.

## Alcance y evidencia

Inventario: 21 rutas, 214 fuentes propias JS/TS, 116 nombres RPC y 467 pruebas MJS/SQL registradas. El grafo estático de arranque conserva 159 módulos: se ha adelantado su descarga, no eliminado funcionalidades ni cambiado de framework.

Artefactos locales: artifacts/audit-stability-20261114/results.json y logs por recorrido; qa-artifacts/stability-circuits.json. Los ensayos incluyen creación/edición/copia de productos, imágenes, variantes, correspondencias entre tiendas, publicación, respuestas tardías, reintentos, documentos, gastos, facturas, cajas, cotejos, directorios, roles, permisos, recuperación, chat, automatizaciones, Inicio y apariencia. Las escrituras de estos ensayos son ficticias. No acreditan una factura emitida ni un movimiento real de stock.

Las pruebas de interfaz incluyen pantallas estrechas y escritorio; el chat recorre nueve anchos entre 320 y 1920 píxeles. La apariencia de Stitch y las preferencias existentes se conservan.

## Supabase y permisos

La organización gjgdmumsjfndvqdknzof confirma plan Pro; el proyecto awmojepsasikxocoeqtu está ACTIVE_HEALTHY. La referencia guardada en Totus seguía en Free desde octubre. Al publicar el render compatible se actualizará únicamente esa referencia de capacidades, no el plan ni el control de gasto del proveedor. Referencia oficial: https://supabase.com/pricing (8 GB de disco incluidos por proyecto, 100 GB de archivos compartidos, 250 GB de salida y 250 GB de salida en caché). No equivalen a capacidad reservada o consumo mensual disponible de esta aplicación.

Los avisos de políticas permisivas múltiples se contrastaron con pg_policies: existen políticas RESTRICTIVE totus_mod_* que siguen imponiendo totus_can, y la privacidad del directorio de usuarios también es RESTRICTIVE. No se eliminan políticas por una advertencia de duplicidad. Tampoco se borran índices por estadísticas de uso escasas. El EXPLAIN de la línea temporal del chat consultó 1024 filas y tardó 21,349 ms en esta lectura privilegiada; no demuestra la latencia bajo RLS ni justifica por sí solo una reconstrucción de índices.

## Circuitos para ChatGPT e integración posterior

La entrada vigente es docs/INICIO_CHATGPT_ACTUAL.md. Productos: docs/PROTOCOLO_PRODUCTOS.md; gastos: docs/CUENTA_CHATGPT_GASTOS.md; cotejos: docs/COTEJOS_CHATGPT.md y docs/PRESTASHOP_RECEPCIONES_SIN_IA.md. Identidad propia y permisos efectivos del servidor, lectura de contexto vigente, solicitud identificada, confirmación y relectura. Ante resultado incierto se conserva el identificador y se consulta su estado; nunca repetir una creación a ciegas.

Antes de integrar el módulo nuevo hay que recibir sus fuentes y contratos, identificar consumidores, añadir sus rutas y permisos y ejecutar los circuitos afectados. Esta revisión no certifica un módulo que aún no se ha entregado. Hortimatic 8 permanece separada y pausada. Tampoco declara resuelto el acceso automático a cajas/vendedores de POSTPV ni las peticiones funcionales aún abiertas en docs/MEJORAS_CANAL_20261114.md.

No borrar migraciones, originales, historial, registros únicos ni respaldos para reducir ruido. Las herramientas de inventario y comprobación de imports se ejecutan antes de retirar código; sin prueba de que no tiene consumidores se conserva. Una batería aprobada reduce regresiones: no garantiza ausencia de todo fallo futuro.
