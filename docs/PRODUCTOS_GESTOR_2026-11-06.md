# Productos · estructura del módulo

Revisión 07/11/2026. Procedimiento operativo: [PROTOCOLO_PRODUCTOS.md](PROTOCOLO_PRODUCTOS.md). Comprobar la instalación; este archivo no demuestra publicación.

- Frontend independiente: productos-ui.js, creación por tienda en productos-create-ui.js, etapas en productos-stages-ui.js y contratos puros. Dos fichas paralelas y selección explícita de campos; SEO editable por destino.
- Borrador por cuenta en IndexedDB mediante productos-draft-store.js, con solicitudes estables y sin claves. Reabrir no escribe.
- Precio usa productPriceStudy de pricing-core.js; los costes de origen siguen siendo orientativos.
- totus-connections valida la sesión, la administración, la conexión y su revisión. Solo permite las tiendas oficiales y recursos/operaciones tipados. El servidor conserva la clave; el formulario no recibe XML de escritura ni secretos.
- prestashop-create.js crea la base inactiva; prestashop-product-stage.js completa combinaciones, stock, proveedor, oferta, PNG y publicación; prestashop-write.js actualiza campos seleccionados de productos y combinaciones existentes.
- Diario persistente de altas, etapas y ediciones en tablas privadas. Funciones de servicio sin acceso para visitantes ni clientes autenticados del navegador. Respuesta incierta requiere conciliación por lectura, no otro POST.
- totus-assistant incorpora operation=products con el mismo cliente autenticado del usuario de IA. Consultar catálogo y session_check usando la cuenta explícita. No usar el alias genérico sin comprobar quién responde.
- La migración amplía a 6 MiB únicamente los trabajos de Productos, para imágenes/descripciones; conserva el límite anterior de las demás acciones.
- El manifiesto de despliegue enumera los archivos completos de cada servicio y sus dependencias relativas. Desplegar un archivo aislado rompe el contrato.

## Verificación

Pruebas puras de contratos, XML, imágenes y permisos; diario en PostgreSQL aislado; integración con PrestaShop 1.7.8.11 real en contenedor; navegador a 390/768/1440 con creación, edición, combinación, PNG, descripción y recuperación por cuenta. Crear el producto de demostración en Totus y comprobarlo en la tienda es un cierre separado y obligatorio.

## Límites del adaptador

No modificar tablas privadas de módulos instalados ni prometer su soporte con el Webservice nativo. Los adaptadores de IQIT/Elementor/SEO/POSTPV, packs/descargables, creación de maestros, adjuntos y transportistas específicos requieren controles y pruebas propios. Ver la matriz del protocolo. No eliminar funcionalidades previas ni reutilizar identificadores entre tiendas.
