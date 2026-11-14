# Restricciones de trabajo de Totus Central

## PrestaShop y software adicional

Instrucción expresa de Diego, 8 de noviembre de 2026:
- No instalar ni actualizar complementos propios ni de terceros en PrestaShop para cumplir objetivos de Totus.
- No modificar el núcleo, archivos, esquema ni configuración de las tiendas para ampliar la integración.
- No instalar software adicional en otros servicios como sustitución de una limitación de la API.
- Usar la API oficial ya autorizada para las operaciones sobre productos y datos que Diego solicite.
- Si la API de la versión instalada no admite una operación, comprobarlo y explicarlo. No fingir guardados, ocultar errores ni instalar un puente alternativo.
- El módulo totusproductbridge ha sido retirado de Hortimatic por orden del usuario. No reinstalarlo. NewOldSmok no lo tiene instalado.
- La aprobación anterior de instalación quedó revocada; no reutilizarla.

## Protocolo obligatorio de estabilidad

- Partir de la rama publicada y comprobar el estado real de frontend, servicios y migraciones. No desplegar un servicio desde una rama antigua ni mezclar ampliaciones pendientes.
- Consultar `stability/circuits.json` y ejecutar sus recorridos afectados. Una ampliación debe conservar creación, modificación, copia, lectura, permisos, recuperación de errores y configuración existentes.
- Comprobar los paquetes completos con `tools/check-deployment-manifest.mjs`. Antes de sustituir servicios, comparar sus versiones y huellas con `stability/live-services.json` usando `tools/check-service-deployment.mjs`; declarar los archivos cambiados de forma explícita.
- No confundir seleccionar/filtrar/navegar con editar. Tras guardar o publicar y releer, no dejar avisos falsos de pérdida de cambios. Conservar las solicitudes inciertas con el mismo identificador.
- No retirar rutas, RPC, tablas, permisos ni contratos sin identificar todos sus consumidores y disponer de una transición comprobada. No borrar migraciones ni originales para limpiar duplicados.
- Registrar por separado resultados simulados, nativos aislados y reales. Informar en el canal solicitado únicamente de lo publicado o verificado, identificando cualquier pendiente real.
- Conservar el diseño de Stitch y las preferencias de interfaz. Revisar móvil y escritorio; no sustituir controles funcionales por adornos.
- Seguir `docs/PROTOCOLO_ESTABILIDAD.md`. El PR #195 está publicado; las referencias históricas a PR anteriores no describen el estado actual.

Los archivos de sources/ del proyecto sincronizado son referencias de solo lectura.
