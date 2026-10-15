# Totus Central — estado operativo

Aplicación interna de gestión para Hortimatic y NewOldSmok. Código JavaScript y CSS estático con Supabase, sin conexión con PrestaShop ni TPV.

## Entornos (obligatorio)

| Rama | Uso | Backend |
| --- | --- | --- |
| `main` | Aplicación normal. No modificar sin autorización expresa. | Supabase producción `zwkpmjjuurgjygcrejiw` |
| `staging` | Única rama de desarrollo, limpieza y pruebas. | Supabase staging `awmojepsasikxocoeqtu` |

**No crear otras ramas, sitios ni proyectos para pruebas. No promover cambios a main automáticamente.**

## Estado real

- Módulos: Inicio, Pricing, Cajas, Gastos, Facturación, Documentos, Fiscalidad, Informes, Administración.
- Código: `index.html` y `src/`. Datos y archivos: Supabase del entorno correspondiente.
- Usuario, configuración y permisos deben revisarse también contra las políticas RLS, funciones SQL y funciones Edge.
- Las correcciones en GitHub **no implican que la web de staging esté actualizada**. Es necesario confirmar el despliegue real y la URL original.
- Los flujos de restauración de backup están bloqueados en staging hasta contar con recuperación transaccional segura; la descarga sigue permitida.
- El primer semestre de 2026 no debe importarse sin conciliación de fuentes y aprobación explícita.

## Pruebas

La rama `staging` ejecuta el workflow `.github/workflows/qa.yml`; cubre pruebas estáticas, funcionales, libros contables y simulaciones de interfaz. Estas pruebas **no reemplazan** un ensayo autenticado completo en el staging publicado con datos de prueba, roles y permisos RLS.

No existe actualmente un workflow de publicación certificado para la URL original. No habilitar GitHub Pages sin confirmar que no modifica el despliegue de `main`.

## Seguridad y revisión

- No incluir claves secretas en `index.html` ni `src/`; la publishable key del navegador no permite ignorar RLS.
- Registrar cambios de base de datos mediante migraciones y contrastarlos con el esquema actual.
- Ninguna limpieza puede borrar información histórica, registros fiscales, documentos o copias útiles sin inventario previo y recuperación verificada.
- Documentación base: `TOTUS_CENTRAL_INSTRUCCIONES_AUDITORIA_STAGING_2026-10-14.txt` en fuentes privadas; revisar `docs/auditorias/` para hallazgos y pendientes.
