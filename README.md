# Totus Central

Reconstrucción limpia de Totus Central.

## Principios
- Código nuevo, modular y sin dependencias de la construcción anterior.
- Navegación única y coherente.
- Fechas completas como filtro principal: Desde / Hasta.
- Interfaz responsive.
- Acciones críticas con validación y confirmación.
- Sin datos de demostración.
- Usuarios activos: los definidos en Supabase Auth/team_members.

## Módulos
Inicio · Pricing · Cajas · Gastos · Facturación · Documentos · Fiscalidad · Informes · Usuarios · Configuración · Log

## Estructura
- src/app.js: arranque y acciones.
- src/api.js: acceso a Supabase.
- src/state.js: estado de aplicación.
- src/components.js: componentes compartidos.
- src/pages/main.js: vistas funcionales.
- src/utils.js: utilidades puras.
- src/styles.css: sistema visual.
- tests/qa.mjs: pruebas estructurales y de regresión.

La rama de reconstrucción no debe publicarse en producción hasta pasar QA.
