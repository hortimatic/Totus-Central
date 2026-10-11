# Totus Central

Aplicación interna para Hortimatic y NewOldSmok.

## Ramas
- Producción: `main` — no se modifica sin aprobación expresa.
- Desarrollo: `desarrollo-v6`.

## Estado limpio actual
La rama de desarrollo trabaja únicamente con la arquitectura vigente. Se han retirado importaciones históricas, conciliaciones heredadas, restauradores de backup, datos de prueba operativos y migraciones-parche antiguas.

Usuarios activos previstos:
- Diego Sequera · admin
- Davinia Hidalgo · gerente

## Archivos activos
- `index.html` · acceso general, Inicio y Pricing.
- `app-shell-v6.css` · navegación y estructura general.
- `gestion-v6.css` · estilos operativos.
- `gestion-v6.js` · núcleo de Cajas, Gastos y servicios compartidos.
- `gestion-v6-features.js` · módulos operativos actuales: resumen, facturación, documentos, fiscalidad, informes, configuración y log.
- `tests/ui-smoke.mjs` · comprobación de arquitectura limpia.
- `.github/workflows/totus-central-qa.yml` · QA de la rama de desarrollo.

## Base de datos
Se conservan únicamente las tablas estructurales y funcionales necesarias para:
- Pricing.
- usuarios y perfiles.
- establecimientos y cajas.
- gastos.
- cierres.
- facturación.
- documentos.
- fiscalidad.
- configuración y trazabilidad.

Los datos operativos se encuentran vacíos para reconstruir y probar cada módulo desde una base limpia.

## Reglas de trabajo
- Pricing se conserva.
- No se conectan Prestashop ni TPV.
- No se reintroducen importaciones históricas sin una petición expresa.
- No se añaden capas de compatibilidad con arquitecturas retiradas.
- Cada módulo debe trabajar con una única fuente de datos actual.
- Los listados que dependen de fechas deben disponer de un rango real Desde/Hasta.
- No se promueve `desarrollo-v6` a `main` sin aprobación.

## QA
La QA comprueba sintaxis, navegación principal, ausencia de dependencias legacy y presencia de filtros de fecha reales. Se ejecuta en `desarrollo-v6`.
