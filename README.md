# Totus Central

Herramienta de gestión diaria para Hortimatic y NewOldSmok.

## Una aplicación de producción

- Dirección: https://hortimatic.github.io/Totus-Central/
- Código publicado: rama `totus-central` de este repositorio.
- Supabase: proyecto contable existente `awmojepsasikxocoeqtu`. Su identificador se conserva para mantener usuarios, contabilidad, relaciones y tareas.
- OneDrive: carpeta de aplicación de Totus Central. Se accede por su identificador estable, con el permiso AppFolder ya autorizado.
- La dirección anterior `/staging/` solo redirige a la aplicación principal, conservando parámetros y fragmentos de recuperación. No aloja otra aplicación.

La transición renombra la propia rama staging como totus-central y la convierte en principal; no copia la aplicación al main obsoleto. No importa de nuevo datos ni altera importes. El proyecto Supabase antiguo `zwkpmjjuurgjygcrejiw` no es el origen de la contabilidad actual; su retirada definitiva exige comprobar el inventario y la confirmación del titular.

## Desarrollo y publicación

No modificar estructura, pantallas, datos o cálculos sin explicar primero el cambio al titular. Una petición de producción no autoriza a borrar información histórica ni ampliar permisos de proveedores.

`.github/workflows/publish.yml` ejecuta la batería completa antes de publicar un commit de totus-central. Una prueba fallida impide el despliegue. Comprobar también la versión realmente publicada y el funcionamiento autenticado; una prueba simulada no certifica por sí sola la instalación real.

Los módulos siguen siendo Inicio, Pricing, Cajas, Gastos, Facturación, Documentos, Fiscalidad, Informes y Administración. El alojamiento es estático, sin dependencias de un ordenador local.

## Documentación y recuperación

Leer [el manual operativo](docs/MANUAL_CHATGPT_ONLINE.md), [el relevo para ChatGPT](RELEVO_CHATGPT_ONLINE.md) y [la revisión para producción](docs/auditorias/REVISION_PRODUCCION_2026-10-21.md).

Supabase conserva datos, usuarios, permisos, programación, logos e índices. OneDrive conserva originales y copias completas. Los datos privados, contraseñas y secretos no pertenecen al repositorio público.

Copias nocturnas: 00:35 Europe/Madrid, máximo diez ordinarias verificadas, con protección adicional de puntos de recuperación. El formato v3 permite recuperar datos y archivos en el mismo proyecto; no incorpora contraseñas ni sustituye una copia de infraestructura. Límite: 120 MiB de archivo, 128 MiB expandidos y 8 MiB de datos JSON. Preparar ampliación antes de alcanzar estos límites.

No cambiar cifras del histórico aceptado para forzar coincidencia con gestoría. Los originales determinan las facturas; los pagos y el gasto fiscal son conceptos distintos. Mantener los gastos internos y los pagos de impuestos fuera del beneficio fiscal.
