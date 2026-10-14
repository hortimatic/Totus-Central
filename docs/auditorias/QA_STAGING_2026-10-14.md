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

## Ampliación de pruebas — última sesión
- Se renderizaron directamente con el código real de `staging` 19 pantallas y subpantallas con datos vacíos/sintéticos, sin errores de ejecución.
- Se repitió con los datos del `tests/ui-harness.html` de la rama actual: 18 vistas pobladas, sin errores de ejecución.
- Filtros reales de listado: Cajas, Gastos, Facturación y Documentos; para cada módulo se comprobaron inclusión en rango, exclusión fuera de rango, búsqueda sin coincidencias y exclusión de otra tienda (16 verificaciones superadas).
- Auditoría de integridad repetida contra 17 archivos reales de staging: correcta.
- Regresión funcional real de staging: correcta con ejecuciones auxiliares de zona horaria sustituidas; la comprobación de varias zonas horarias sí pasó previamente en Node sobre la copia ZIP local.
- Nueva validación de gastos: fechas pagadas inicialmente precargadas; facturas pendientes sin fecha efectiva de pago; pagos parciales validados como función pura y con diez ejemplos.
- Exportación CSV: se neutralizan fórmulas de celdas de texto, incluso tras espacios o tabulaciones iniciales; se preservan importes negativos numéricos. La primera prueba detectó un caso mal escrito del propio test y se corrigió antes de repetirla correctamente.
- Persisten como **pendientes**, no aprobadas: interacción real con botones mediante navegador, integración Supabase Auth/Storage, descarga/visualización de documentos y publicación visible de staging.

Estas pruebas de render se ejecutaron en un entorno JavaScript aislado, sin navegador, sin usuarios reales y sin modificaciones de datos. No equivalen a verificación visual, responsive ni E2E.

## Actualización — validación financiera, políticas y publicación aislada
1. **Formulario de gastos**: eliminado el ajuste silencioso de bases negativas a cero y de porcentajes fiscales fuera de rango. `validateExpenseLineAmounts` comprueba base, IVA, RE, retención y deducibilidad. Ocho casos no válidos fueron rechazados y uno válido fue aceptado por la función real de staging.
2. **Protección en base de datos**: migración `validate_expense_line_amounts_20261014` aplicada solo al proyecto `awmojepsasikxocoeqtu`. La restricción `ops_expense_lines_valid_amounts_ck` se verificó en `pg_constraint` con `convalidated=true`; tabla vacía antes del cambio. Documentada en `supabase/review_patches/005_expense_line_validation.sql`.
3. **Permisos de documentos**: política de UPDATE `ops_documents_update` ajustada en staging mediante migración `scope_document_updates_to_uploader_20261014`: gerente/admin o miembro del equipo que subió ese documento, en USING y WITH CHECK. Comprobada con `pg_policies`. Documentada en `supabase/review_patches/006_document_update_owner_policy.sql`.
4. **Auditoría de Storage**: se encontró que la política UPDATE de `storage.objects` para `business-documents` sigue siendo amplia (todos los miembros). **Pendiente** de endurecer y probar; un intento de modificarla fue bloqueado por controles de ejecución, no se aplicó. No se declara resuelta la seguridad documental completa.
5. **Nueva publicación independiente**: Edge Function `totus-staging-preview` desplegada como ACTIVE v1 en el Supabase **de staging**, con puerta de acceso temporal propia y Auth/RLS de Supabase para los datos. Sirve HTML, CSS y JS obtenidos de la rama staging, sin sustituir GitHub Pages ni producción. Los controles de acceso/rutas pasaron ocho casos en una simulación del mismo código desplegado, pero **la apertura por navegador externo no se pudo verificar** debido a las restricciones del entorno.
6. **Limitación del despliegue**: la Edge Function es una instantánea estática. Los cambios posteriores en la rama `staging` NO aparecen automáticamente: hay que volver a desplegar el contenido actualizado antes de anunciar al usuario que puede verlo. No publicar tokens de acceso en archivos del repositorio.
7. **QA recurrente**: añadido `tests/route-smoke.mjs` y conectado al workflow `.github/workflows/qa.yml`. Sobre copia local de referencia, sus 35 pantallas/estados, 85 acciones y 12 comprobaciones de fecha/tienda pasaron; ejecución pendiente del workflow de GitHub con el HEAD definitivo.

### Criterio obligatorio de cierre
No afirmar estabilidad comercial al 100 % hasta aprobar las pruebas reales con navegador, autenticación de roles, Storage y documentos, cálculos fiscales comparados con contabilidad, restablecimiento recuperable y publicación verificada desde un dispositivo real. No modificar main/producción sin aprobación.
