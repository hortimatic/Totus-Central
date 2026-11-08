# Componente retirado — no instalar

El 8 de noviembre de 2026 Diego revocó la instalación y ordenó retirar el componente propio de PrestaShop.

Hortimatic: desinstalado desde el gestor nativo con retirada del directorio; búsqueda «totus» sin tarjeta posterior. NewOldSmok: búsqueda «totus» sin componente instalado; no se realizó la instalación prevista.

No se habilitó el recurso propio ni se publicó el PR #144 o el servicio nuevo. La documentación siguiente es histórica y NO autoriza instalar el componente. La integración debe adaptarse a la API oficial y distinguir las funciones nativas de las que no admite esta versión.

---

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

## Contraste nativo de esta rama

El trabajo aislado de GitHub Actions `42412423845`, tarea
`prestashop-178-isolated-webservice`, ha finalizado correctamente. Incluye
orden y leyendas, rechazo de cambio de producto/portada, sustitución binaria
con el mismo ID y eliminación con relectura. Se usaron únicamente datos y una
clave ficticia dentro de contenedores desechables. No acredita instalación en
Hortimatic/NewOldSmok ni compatibilidad verificada con PrestaShop 8.
