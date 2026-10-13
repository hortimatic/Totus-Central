# Totus Central

Aplicación única de gestión interna para Hortimatic y NewOldSmok. Pricing está integrado en la navegación general.

## Arquitectura

- Código y versiones: GitHub (este repositorio).
- Usuarios, autenticación, permisos, datos y documentos: Supabase, proyecto `zwkpmjjuurgjygcrejiw`.
- Alojamiento definitivo previsto: GitHub Pages. El despliegue está pendiente de validación y autorización; no se ha activado.
- Vercel no es una dependencia del código y debe retirarse solo después de verificar el nuevo acceso.

## Estado del proyecto

- Rama final aprobada: `totus-central-final-2026-10-13`.
- Rama de revisión: `auditoria-regresion-2026-10-13`.
- Rama `main`: no modificar ni desplegar sin aprobación.
- Datos del primer semestre: NO importados; fuentes privadas, fuera de este repositorio.
- Equipo actual: dos cuentas activas (administración y gerencia). Incorporar nuevos usuarios solo desde la administración verificada.
- Producción: pendiente de pruebas autenticadas, enlaces de recuperación y revisión de seguridad.

## Módulos

Inicio, Pricing, Cajas, Gastos, Facturación, Documentos, Fiscalidad, Informes y Administración.

## QA y publicación

- `.github/workflows/qa.yml`: prueba código, formularios, Excel, PDF, ZIP y vistas simuladas.
- `.github/workflows/pages-preview.yml`: preparación de alojamiento estático GitHub Pages con ejecución manual y verificación previa.
- El paquete web debe incluir únicamente `index.html`, `favicon.svg`, `fondo_original.png` y `src/`.
- No se deben publicar `supabase/`, `tests/`, copias de seguridad, facturas, libros contables ni documentos personales.
- No cambiar ajustes de Auth ni URL de correos hasta disponer de un dominio definitivo comprobado.

## Seguridad

No incluir claves secretas ni service-role en el navegador; solo la clave pública de Supabase. La protección real de los datos depende de Auth y RLS, que requieren revisión autenticada antes de producción. Mantener fuera del repositorio los datos y documentos privados.
