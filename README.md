# Totus Central — Versión final pendiente de producción

Aplicación de gestión interna de **Hortimatic y NewOldSmok**. La pestaña Pricing forma parte de Totus Central; no requiere una instalación independiente.

## Estado

- **Versión aprobada:** `totus-central-final-2026-10-13`.
- **Rama publicada anterior:** `main`. No sustituirla sin la autorización expresa del responsable.
- **Supabase definitivo:** ID `zwkpmjjuurgjygcrejiw` (la denominación visible del proyecto puede renombrarse sin alterar este ID).
- **Datos de enero-junio 2026:** preparados en paquete privado externo; **no importados** en la base definitiva.
- **Pruebas:** CI de código, vistas de escritorio y móvil, formularios, Excel, PDF, ZIP, permisos simulados y recuperación simulada. Sigue pendiente validación con sesiones reales y restauración en un entorno seguro.
- **Coste adicional autorizado:** ninguno.

## Módulos

Inicio · Pricing · Cajas · Gastos · Facturación · Documentos · Fiscalidad · Informes · Administración.

## Estructura

- `src/app.js`: navegación y acciones
- `src/api.js`: conexión a Supabase
- `src/state.js`: datos y estado
- `src/components.js`: interfaz reutilizable
- `src/pages/main.js`: vistas
- `src/excel.js`: libros y documentos de gestoría
- `src/backup.js`: copia de datos y documentos
- `src/styles.css`: diseño
- `supabase/`: definición SQL
- `tests/`: validaciones y simulaciones

## Seguridad y limpieza

1. No publicar facturas reales, información personal, copias de seguridad ni ficheros del primer semestre en este repositorio: **actualmente es público**.
2. No usar el repositorio antiguo `hortimatic/totus-central`, ya eliminado.
3. No usar el proyecto Supabase antiguo `qgyufbjytcewuevbketz`, ya eliminado.
4. Renombrar únicamente la denominación visible del repositorio y proyecto conservados; **no modificar la URL API ni el ID de Supabase**.
5. No confundir un cambio de nombre de repositorio con una publicación: dejar `main` intacta hasta terminar las pruebas.
6. Crear staging solo con aislamiento y coste cero verificado antes de introducir documentos reales.

## Entrega íntegra

La rama final mantiene todo el código aprobado y la batería de QA. Para recuperar la versión se utiliza su ZIP integral de GitHub Actions o la rama completa. No mezclar archivos de otras ramas.
