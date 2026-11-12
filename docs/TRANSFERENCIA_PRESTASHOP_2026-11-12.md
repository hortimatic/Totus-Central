# Transferencia de tiendas PrestaShop

## Objetivo y alcance

Preparar en Totus un espacio **Transferencias** reutilizable para migrar una tienda antigua a otra nueva. Una transferencia integral requiere base de datos, archivos y relaciones. La sincronización de productos por API es solo una parte de ese objetivo. No se ha ejecutado ninguna importación ni se ha instalado software en las tiendas.

La versión indicada como «1.8» debe confirmarse en destino: el proyecto anterior hablaba de PrestaShop 8. También falta identificar su URL. La conexión futura será independiente, con credencial propia por entorno. Las claves de producción no se copiarán a documentación ni al navegador.

## Ejemplos recibidos

Revisión de solo lectura el 12/11/2026. CSV separados por punto y coma. Los recuentos describen estos ejemplos, no el catálogo real. No se incorporan sus filas ni datos personales al repositorio.

| Archivo | Filas | Columnas | Utilidad |
|---|---:|---:|---|
| products_import.csv | 7 | 66 | Catálogo, contenido, precios, dimensiones, SEO, imágenes, características y disponibilidad |
| combinations_import.csv | 27 | 23 | Atributos y valores, referencias/EAN, costes, impactos de precio/peso, cantidades e imágenes |
| categories_import.csv | 3 | 11 | Jerarquía, actividad, descripción, SEO e imagen |
| brands_import.csv | 4 | 9 | Marcas, descripciones, SEO e imagen |
| suppliers_import.csv | 3 | 9 | Proveedores, descripciones, SEO e imagen |
| customers_import.csv | 9 | 13 | Identidad, grupos, registro y suscripciones; contiene una columna de contraseña que no debe exportarse a informes |
| addresses_import.csv | 16 | 21 | Direcciones relacionadas con clientes, marcas o proveedores |
| alias_import.csv | 4 | 4 | Alias de búsqueda |
| store_contacts.csv | 5 | 17 | Datos de contacto, horarios e imagen de establecimientos |

Estos archivos permiten definir un mapeador. No acreditan respaldo de pedidos, facturas, cobros, devoluciones, carritos, reglas de impuestos, traducciones completas ni tablas privadas de POSTPV. Las URL de imágenes tampoco equivalen a una copia de sus archivos binarios.

## Propuesta de espacio

1. **Conexiones**: origen y destino inequívocos, versión y recursos disponibles; lectura del origen y prueba de destino separadas.
2. **Inventario**: entidades, recuentos, idiomas, monedas, impuestos, grupos, módulos y archivos. Cada entidad indica API, CSV o tratamiento específico.
3. **Mapeo**: campos y relaciones origen/destino; árbol de categorías, marcas, proveedores, atributos, valores, características e idiomas. Nunca asumir que un ID coincide entre dos bases.
4. **Simulación**: vista de altas, actualizaciones, conflictos, referencias repetidas y datos sin correspondencia. Sin escritura.
5. **Transferencia**: lotes reanudables con registro de cada entidad, huella del contenido y correspondencia de ID. Un error no obliga a repetir los ya confirmados.
6. **Verificación**: relectura y comparación de cantidades, contenido, precios/impuestos, fotos, combinaciones, asociaciones, pedidos e importes. Informe de diferencias descargable.
7. **Historial**: ejecución, operador, origen/destino, fechas y resultados; recuperación y reversión según el tipo de cambio.

## Orden de datos

Primero configuración dependiente (idiomas, países, monedas, impuestos y grupos), después maestros (categorías, marcas, proveedores, atributos/valores y características), catálogo y combinaciones, imágenes/documentos, clientes/direcciones, y finalmente historia comercial. El orden exacto depende del esquema y permisos de la versión de destino.

Los pedidos históricos no deben recrearse como ventas nuevas que vuelvan a descontar stock, notificar al cliente, generar pagos o contabilizar ingresos. Las contraseñas requieren comprobar compatibilidad del método de hash y contexto de cifrado; un campo «Password» de CSV no garantiza conservar los accesos actuales. SEO necesita conservar rutas o registrar redirecciones, no únicamente sustituir el nombre de la tienda.

## Migración integral y actualización

Para una copia integral, comparar dos opciones en una copia aislada: actualizar un clon completo de la tienda antigua o extraer/transformar/cargar entidades en la construcción nueva. Si el destino ya está desarrollado, la segunda preserva su diseño y configuración, pero necesita un inventario más detallado. No sobrescribir su base completa con un volcado 1.7.

La alternativa concreta se elegirá tras leer las versiones, esquemas y estado de destino. El corte final requiere respaldo verificado, ensayo, contraste de deltas desde el ensayo y control de ventas durante la transición. No anunciar «todo migrado» si quedan tablas de módulos o archivos fuera del inventario.

## Manual de operación humana y de ChatGPT

Seleccionar conexión/tienda, revisar inventario y diferencias, simular, confirmar el destino, ejecutar el lote y verificar por relectura. ChatGPT debe usar su propia cuenta autorizada y el mismo servicio que la interfaz. No extraer claves privadas, inventar IDs ni continuar una operación incierta sin consultar su registro. Los informes no incluirán contraseñas, tokens ni datos personales innecesarios.

## Fuentes técnicas

- [Proceso oficial de migración a PrestaShop 8](https://devdocs.prestashop-project.org/8/basics/keeping-up-to-date/migration/): extracción, transformación e importación adaptada al esquema de destino.
- [Estructura de base de datos](https://devdocs.prestashop-project.org/8/development/database/structure/).
- [Referencia Webservice](https://devdocs.prestashop-project.org/8/webservice/reference/): comprobar recursos y esquemas admitidos por cada tienda.

## Estado

Diseño de alcance y revisión de ejemplos terminados. Importador/exportador integral, ensayo y ejecución: **pendientes**. No se ha añadido una pantalla que aparente realizar una migración aún inexistente.
