# Protocolo de estabilidad y cierre

## Referencia única antes de cambiar

Registrar commit publicado (`build-info.json`), versión de cada servicio afectado, migraciones aplicadas y rama de trabajo limpia. Una rama con trabajo pendiente no es la referencia de producción. La lectura de `stability/live-services.json` no reemplaza la consulta actual al servicio.

El 14/11/2026 se detectó que el backend activo incorporaba el registro de webs de una rama aún no publicada. Se han reconciliado esas fuentes ya activas, manteniendo la corrección de EAN del #195. Esto no publica la interfaz pendiente de Hortimatic 8 ni cambia sus conexiones. Los paquetes de servicios pueden conservar distintas revisiones de una dependencia: el control las registra por servicio, no presupone que todas sean iguales.

## Contrato de cada circuito

Para cada función conservar: entrada desde su pantalla; contexto de usuario/tienda/caja; validación; llamada autorizada; persistencia; relectura; confirmación; recuperación con el mismo identificador; salida y regreso. Probar además permiso denegado, respuesta tardía, lista vacía y cambio de tienda. Seleccionar, filtrar y leer no son ediciones sin guardar.

Consultar `stability/circuits.json`. Los recorridos afectados se ejecutan antes de publicar y se registran con el commit concreto. Las pruebas con respuestas simuladas no demuestran una escritura real. No usar datos contables ni registros de clientes reales para ensayos destructivos.

## Sustitución segura de servicios

1. Leer el paquete activo mediante el conector autorizado y guardarlo como evidencia local fuera de Fuentes sincronizadas.
2. Preparar un plan JSON con `service`, `reason` y `changedFiles` exactos, sin comodines.
3. Ejecutar `node tools/check-deployment-manifest.mjs`.
4. Ejecutar `node tools/check-service-deployment.mjs --service totus-connections --live artifacts/live-connections.json --plan artifacts/deployment-plan.json`.
5. Si ha cambiado la versión activa, una dependencia no prevista o falta un archivo, detener la sustitución y reconciliar; no añadir excepciones para hacer pasar el control.
6. Desplegar solamente el paquete revisado. Releer versión y archivos, actualizar las huellas y realizar el recorrido real afectado. Conservar la versión anterior para reversión compatible con las migraciones.

## Limpieza y publicación

Eliminar código muerto solo tras comprobar importaciones, rutas, RPC, consumidores del asistente y recuperación. No borrar migraciones, diarios, documentos originales, referencias únicas de operaciones o ramas con trabajo no integrado. Identificar duplicados por contenido y relación, nunca solo por nombre.

Conservar preferencias y apariencia en las zonas nuevas. No ampliar permisos ni mostrar datos privados por corregir un fallo. Las funciones nuevas deben probar también denegaciones de acceso.

Publicar con todos los controles aprobados. Los paquetes Pages llevan nombre distinto por intento y se espera a que sean visibles antes de desplegarlos. Confirmar el commit servido y la versión realmente abierta en el navegador. Actualizar el canal con estados separados: publicado/verificado, implementado pendiente de prueba real y bloqueado con causa concreta. No marcar una petición como terminada por existir un botón o un documento.
