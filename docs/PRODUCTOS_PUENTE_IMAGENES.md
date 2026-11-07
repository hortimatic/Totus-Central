# Puente de imágenes · versión 1.1.0 en desarrollo

No instalado en las tiendas reales. El ZIP se genera con `tools/build-prestashop-bridge.py`.

Añade el recurso autenticado `totus_product_images` al módulo existente, conservando
la corrección de precios unitarios. Solo permite GET/PUT sobre imágenes existentes;
POST y DELETE están prohibidos en este recurso. No crea tablas, claves ni overrides.
La imagen mantiene su producto y su portada. El método nativo de PrestaShop reajusta
las posiciones; posición y leyendas se actualizan en una transacción.

La actualización registra `addWebserviceResources`. Para operar necesita GET/PUT del
nuevo recurso en la clave de cada tienda. Es una ampliación que deberá aprobarse
al instalar y configurar, después de superar los controles. No confundir el código
preparado y el entorno desechable con una actualización ya instalada en producción.

Totus conserva la solicitud, prepara una huella del registro actual, muestra los
cambios y relee el resultado. Al editar una leyenda conserva los demás idiomas,
incluidos los instalados inactivos. Reordenar no sustituye el texto alternativo.

El módulo continúa siendo compatible por declaración con 1.7.8–8.x; la validación
nativa de este cambio se realiza en 1.7.8.11. No declarar probado en PrestaShop 8
sin ejecutar la misma batería allí antes de una migración.
