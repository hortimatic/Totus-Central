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
- La recuperación v3 restaura datos y archivos en el mismo proyecto, con comprobación de integridad, punto de vuelta y restauración SQL transaccional. Exige que existan las cuentas Auth originales; no sustituye una copia de infraestructura ni recupera contraseñas. Los formatos antiguos se pueden inspeccionar, pero no restaurar.
- Las copias incluyen como máximo 96 MB de archivo (128 MB descomprimidos) y 8 MB de datos JSON. Si falta un archivo vinculado o se supera el límite, se rechaza la copia completa; nunca se presenta una copia parcial como recuperable.
- Staging tiene el registro público cerrado y exige al menos 12 caracteres en las nuevas contraseñas. La detección de contraseñas filtradas requiere un plan de Supabase compatible y no está habilitada en el plan Free actual.
- Los documentos emitidos conservan su archivo original y su logo histórico. Los vínculos de documentos con gastos y facturas se actualizan dentro de la misma transacción.
- Los tres primeros trimestres de 2026 están cargados y aceptados por el titular. No volver a importarlos ni alterar sus cifras sin contraste y autorización. Octubre se introduce manualmente.

## Pruebas

La rama `staging` ejecuta el workflow `.github/workflows/qa.yml`; cubre pruebas estáticas, funcionales, libros contables y simulaciones de interfaz. Estas pruebas **no reemplazan** un ensayo autenticado completo en el staging publicado con datos de prueba, roles y permisos RLS.

El workflow `publish-staging.yml` comprueba la rama antes de actualizar `/staging/`. Verificar su resultado y la versión mostrada en la aplicación; no asumir que un push ya está publicado. La publicación de staging no autoriza cambios en `main` ni en la base de datos de producción.

Los controles de RETA sin efecto en los cálculos se han retirado. Las cuotas efectivamente pagadas se registran como gastos; la tabla histórica se conserva para compatibilidad de las copias.

## Seguridad y revisión

- No incluir claves secretas en `index.html` ni `src/`; la publishable key del navegador no permite ignorar RLS.
- Registrar cambios de base de datos mediante migraciones y contrastarlos con el esquema actual.
- Ninguna limpieza puede borrar información histórica, registros fiscales, documentos o copias útiles sin inventario previo y recuperación verificada.
- Documentación base: `TOTUS_CENTRAL_INSTRUCCIONES_AUDITORIA_STAGING_2026-10-14.txt` en fuentes privadas; revisar `docs/auditorias/` para hallazgos y pendientes.

## Relevo online

Ver [RELEVO_CHATGPT_ONLINE.md](RELEVO_CHATGPT_ONLINE.md). Las copias nocturnas se ejecutan en Supabase a las 00:35 Europe/Madrid, sin ordenador encendido; se conservan las diez completadas más recientes. Consultar el estado real en Administración → Copias: no confundir intentos fallidos con copias guardadas ni una copia histórica con un respaldo actualizado.
