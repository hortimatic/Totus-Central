# Totus Central — Auditoría operativa de staging (14-10-2026)

## Alcance y límites
Repositorio `hortimatic/Totus-Central`, rama `staging`; Supabase de pruebas `awmojepsasikxocoeqtu`.
**Producción y rama `main` fuera de alcance.** No se importaron facturas ni se restauraron backups.

La revisión de GitHub y de los permisos RPC corresponde al estado real de staging. Las tres pruebas CLI de la copia ZIP local (13-10-2026) no certifican los cambios posteriores. El navegador automatizado local fue bloqueado por el entorno de ejecución, por lo que no se afirma QA visual ni integración Auth/Storage de extremo a extremo.

## Cambios verificados en esta tanda
1. Documentos Excel: vistas previas sin HTML generado directamente por celdas, con escape y límite de 200 filas/30 columnas.
2. Gastos: validador separado `validateExpensePayment(total,amountPaid,status)` rechaza pagos superiores al total, pagos negativos y estados parcial/pendiente incoherentes.
3. Exportación ZIP de documentos: prefijo con ID de documento, para que archivos con el mismo nombre no se sobrescriban.
4. RPC `SECURITY DEFINER`: ocho permisos anónimos eliminados en staging y registrados en `supabase/review_patches/004_revoke_anon_definer_rpcs.sql`.
5. Pruebas de regresión para los puntos anteriores y para mantener deshabilitada la restauración no atómica.

## Evidencia comprobada
- Lectura y análisis sintáctico de 11 módulos JS vigentes en GitHub staging: 11/11 correctos.
- Ejecución aislada de la prueba `tests/code-integrity.mjs` con archivos reales recuperados de staging: correcta (17 archivos, sin modificar datos).
- Validador financiero real de `src/calculations.js`: 10 casos válidos/no válidos, 10 correctos.
- Vista previa Excel real de `src/app.js`: prueba con celda HTML maliciosa, 300 filas/40 columnas; salida limitada a 200/30, sin HTML ejecutable y con aviso.
- Supabase Security Advisors: sin advertencias `anon_security_definer_function_executable` después de revocar permisos. Consulta `pg_proc/has_function_privilege` confirmó anon=false en 11 RPC privilegiadas y authenticated=true solo en RPC de uso normal; restauración=false para ambos.
- Persisten 10 advertencias `authenticated_security_definer_function_executable` (requieren revisión del rol y los límites de cada RPC); protección de contraseñas filtradas no activada.
- Las pruebas Node `tests/qa.mjs`, `tests/functional-regression.mjs`, `tests/code-integrity.mjs` pasaron sobre la instantánea ZIP de 13-10-2026. No son un resultado de CI del commit actual.

## Bloqueos para comercialización
**P0:** La dirección pública de staging no publica automáticamente el contenido de la rama staging. El workflow `pages-preview.yml` apunta a una rama ya inexistente y además el proyecto GitHub Pages tiene un único destino de publicación, por lo que no se debe activar de manera que reemplace producción. El artifact `totus-staging-site` generado por QA no constituye una URL pública.

**P0:** La restauración de backup está bloqueada preventivamente. Debe definirse una restauración recuperable, con pruebas de interrupción y de integridad de archivos.

**P1:** Faltan pruebas reales autenticadas, en móvil y sobremesa, para Inicio, Pricing, Cajas, Gastos, Facturación, Documentos, Fiscalidad, Informes y Administración. Las vistas con mocks no sustituyen estas pruebas.

**P1:** Faltan permisos configurables por usuario/módulo, pruebas de RLS para roles y control de acceso de documentos.

**P1:** Importación masiva Excel de gastos/facturas, validación fiscal y coherencia de numeración/duplicados pendientes de finalización.

**P2:** Mejoras estéticas y ayudas contextuales pendientes de comprobación en el sitio publicado.

## Procedimiento de QA previo a promoción
1. Montar un sitio aislado de staging en un hosting propio, sin reemplazar el sitio GitHub Pages de producción; verificar la URL y la conexión a `awmojepsasikxocoeqtu`.
2. Instalar dependencias de las pruebas y ejecutar todos los comandos del workflow `.github/workflows/qa.yml` sobre el código exacto del commit a evaluar.
3. Iniciar sesión con usuarios de prueba de los roles admin, gerente, encargado; verificar visibilidad y permisos reales en cada pestaña.
4. Ensayar crear, editar, buscar por fecha, exportar, asociar archivo y eliminar con datos sintéticos, incluyendo errores y duplicados, en ambos establecimientos.
5. Probar en escritorio y móvil; registrar capturas, errores JS, consola, fallos de red, tiempos de respuesta y datos reales persistidos.
6. Reconciliar sumas e informes con libro de pruebas contable; comprobar PDFs/Excels y enlaces de descarga.
7. Revisar seguridad con Supabase Advisors y SQL de permisos, especialmente RLS, Storage y `SECURITY DEFINER`.
8. No habilitar restauración hasta superar pruebas de recuperación y fallos a mitad del proceso.
9. Solo con resultados completos y aprobación expresa promover cambios de staging a main; nunca automáticamente.

## Reglas de mantenimiento
- Un problema reproducido → cambio mínimo en staging → pruebas → documentación → validación visual → cerrar.
- No borrar información real de usuarios para probar reparaciones.
- Una prueba estática no demuestra funcionalidad ni despliegue correcto.
- Mantener `main`, su publicación y Supabase de producción sin modificaciones hasta autorización expresa.
