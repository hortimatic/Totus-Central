# TOTUS CENTRAL — Auditoría de recuperación y plan de corrección
Fecha: 15/10/2026. Fuente principal: `TOTUS_CENTRAL_INSTRUCCIONES_AUDITORIA_STAGING_2026-10-14.txt`.
Este documento recoge comprobaciones reales realizadas sobre la rama staging y Supabase staging, y separa los requisitos que aún requieren prueba. **NO es una certificación de producción.**

## Reglas invariables
1. Dos ramas: `main` (intocable) y `staging` (única rama de trabajo). No crear sitios, proyectos, ramas ni servidores alternativos. No tocar datos de producción.
2. Comprobar primero la URL **original** de staging y su despliegue efectivo. Hasta entonces, un commit en GitHub NO es un cambio visible en el navegador.
3. Inventariar dependencias y residuos antes de retirar nada; conservar históricos/documentos. No ejecutar DROP/CASCADE ni borrar almacenamiento sin lista, prueba y posibilidad de recuperación.
4. Cada bloque: reproducir fallo → corregir en staging → pruebas de UI/backend/RLS/regresión → comprobar en la web original → registrar evidencia.
5. No aplicar cambios de staging a main sin visto bueno expreso.

## Hechos comprobados
- Repositorio `hortimatic/Totus-Central`: ramas encontradas `main` y `staging`.
- `src/config.js` de staging conecta a `awmojepsasikxocoeqtu`; la base de producción es distinta (`zwkpmjjuurgjygcrejiw`).
- `README.md` actual reconoce explícitamente que no existe un despliegue certificado para la URL original de staging. Hay código en staging pero no hay evidencia de que ese mismo código esté publicado para el usuario. **P0 bloqueante.**
- `src/state.js` únicamente define `isAdmin` e `isManager` basados en tres etiquetas de rol; no hay un sistema de permisos configurables por acción/módulo.
- Consulta directa en Supabase staging: `team_members` contiene actualmente **solo una cuenta de rol admin**. No se ha comprobado una cuenta de gerente o encargado en staging. No modificar identidades sin verificar altas/autenticación.
- Se encontraron políticas RLS activas para las tablas operativas, pero buena parte agrupa permisos en `private.is_manager()` / `private.is_team_member()`. Eso NO cubre la petición de permisos editables independientes por pestaña, operación y empleado.
- `index.html` actual ya no contiene el botón de «Crear acceso Staging» ni el redireccionamiento fijo antiguo; evitar reintroducirlo.
- Se desactivó una función Edge de prueba creada indebidamente, `totus-staging-preview`, con respuesta 410 y JWT requerido. **Sigue existiendo el recurso deshabilitado** hasta eliminarlo desde el panel con el procedimiento de seguridad correspondiente; no recrearlo.
- Las pruebas anteriores de sintaxis, render simulado y cálculos son útiles, pero **no verifican** inicio de sesión, operación autenticada, interfaz móvil, flujos integrales ni archivos descargados reales en staging.

## Inventario funcional por sección
| Área | Situación verificada | Estado de aceptación |
|---|---|---|
| Acceso y publicación staging | No hay despliegue confirmado a la URL original; cambios invisibles para el usuario | **P0 BLOQUEADO** |
| Roles, altas, bajas, permisos | Solo admin presente en tabla staging; roles fijos en JS y RLS genérica | **P0 INCOMPLETO** |
| Inicio | Existe interfaz/cálculos; falta conciliación de KPIs y funcionamiento autenticado | NO VERIFICADO |
| Pricing | Existe módulo; priorizar regresión sin rediseñar | NO VERIFICADO |
| Cajas | Existen cierres/cajas, cálculo e interfaz; faltan pruebas reales de apertura heredada, doble caja y bloqueo | ALTO, NO VERIFICADO |
| Gastos | Hay formularios, líneas, adjuntos y comprobaciones de importes; faltan pruebas de edición, deduplicación, fiscalidad y conciliación | ALTO, INCOMPLETO |
| Documentos | Hay carga, vista previa y permisos de propietario en staging; falta prueba Auth/Storage y limpieza de posibles huérfanos | ALTO, INCOMPLETO |
| Importación Excel/CSV de gastos | No se ha demostrado el flujo íntegro de plantilla, mapeo, prevalidación, lote e idempotencia | ALTO, PENDIENTE |
| Facturación | Existe emisión/borradores/proforma/vista previa; falta prueba de numeración, PDF y protección de emitidas | ALTO, NO VERIFICADO |
| Fiscalidad | Cálculos implementados; sin conciliación con libros/gestoría del semestre de 2026 | ALTO, NO VERIFICADO |
| Informes | Generadores de XLSX/ZIP presentes; algunas regresiones numéricas corregidas, sin certificación contra fuentes | ALTO, INCOMPLETO |
| Administración | Hay usuarios/configuración/copias/logs; carece de permisos por acción configurables | CRÍTICO, INCOMPLETO |
| Recuperación/backup | Restauración bloqueada por seguridad, no existe una recuperación integral certificada | P0 PENDIENTE |

## Secuencia de implementación. No saltarse pasos
### Fase 0. Recuperar estabilidad y visibilidad
- Identificar el URL original de staging en los registros/configuración de despliegue y contrastar su contenido con HEAD de `staging`, sin cambiar el destino de `main`.
- Hacer inventario de workflows, ramas, DNS/hosting, scripts y dependencias. Clasificar cada residuo por **demostrablemente innecesario / histórico útil / desconocido**. Solo retirar lo primero tras comprobar referencias.
- Detectar y registrar discrepancias entre archivos de GitHub, tablas/funciones/RLS en Supabase y recursos realmente usados.
**Aceptar únicamente si:** el usuario puede abrir la URL original de staging y observar un cambio de prueba identificable que procede de la rama staging, sin tocar main.

### Fase 1. Roles y permisos — prioridad inmediata tras fase 0
- Matriz por usuario, rol, módulo y acción: ver/crear/editar/borrar/exportar/cerrar/reabrir/administrar y documentos.
- Administración editable en UI con validación y trazabilidad. Roles admin, gerente y encargado + overrides por usuario.
- Comprobación real de permisos en RLS y funciones SQL/Edge; pruebas positivas/negativas con tres usuarios sintéticos.
**Aceptar únicamente si:** modificar un permiso en la herramienta cambia la acción tanto en la UI como en la API; ningún usuario puede elevarse permisos ni acceder mediante llamadas directas.

### Fase 2. Gastos, documentos e importador
- Rediseñar el flujo con un solo sitio por acción; comprobación de facturas duplicadas, líneas multi-IVA/RE/retenciones, tipos internos, pago parcial y documentos asociados.
- Plantilla XLSX y CSV, mapeo, validación por fila **sin guardar**, previsualización, confirmación, lotes trazables, errores exportables y protección de doble carga.
- Conservar facturas originales y no rellenar cifras ausentes por deducción.
**Aceptar únicamente si:** altas/ediciones/borrados, archivo, búsquedas y exportaciones cuadran con el mismo lote y no generan documentos huérfanos.

### Fase 3. Cajas, facturación y fiscalidad
- Comprobar cajas H/Vape/Head y N/Vape; apertura desde cierre anterior, cierre bloqueado, diferencias, medios de pago, impuestos y fechas.
- Borrador→proforma→factura, rectificativa, numeración y bloqueos; previsualización PDF en ventana antes de imprimir.
- Reconciliar datos del semestre con Excel diarios y informes del gestor. **No modificar histórico en silencio.**
**Aceptar únicamente si:** importes y estados cuadran con casos de prueba conocidos, y las diferencias respecto a gestoría están explicadas.

### Fase 4. Informes, UX y auditoría completa
- XLSX/CSV/PDF/ZIP abiertos realmente: sumas, referencias, formatos, colores, paginación, filtros por tienda/periodo y sin pérdidas.
- Iconos «i» contextualizados, responsive móvil/escritorio, popups coherentes, carga de logos centralizada y formularios sin duplicidad.
- Backup descargable y **restauración recuperable verificada** contra cortes parciales; no desbloquear antes.
**Aceptar únicamente si:** pruebas de punta a punta sin incidencias bloqueantes y evidencia reproducible en el staging publicado.

## Restricciones de publicación
Si no hay forma segura de publicar en el staging original sin alterar main, **NO lanzar otro hosting ni presentar enlaces inventados**. Documentar el bloqueo con la configuración concreta y trabajar sobre el repositorio hasta disponer del despliegue correcto.

## Auditoría de residuos
Crear inventarios separados de: archivos JavaScript/CSS y exportaciones, imports sin uso, handlers huérfanos, SQL con cláusulas DROP/TRUNCATE, funciones RPC, grants, políticas, índices, buckets, Edge Functions, workflows y URLs antiguas. La mera coincidencia de un nombre antiguo no autoriza borrado. Revisar dependencias antes de cada eliminación.

## Estado actual
**Fase 0 aún no aceptada.** No afirmar que Totus Central está acabado ni probado al 100 %. Todas las mejoras futuras se harán solo en `staging` original; pasar pruebas sintéticas no equivale a comprobar la aplicación publicada.
