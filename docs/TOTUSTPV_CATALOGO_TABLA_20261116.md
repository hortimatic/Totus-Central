# Catálogo y tabla del mostrador · trabajo para la entrega final

16/11/2026. Código en desarrollo; esta ampliación aún no está desplegada. No se declara terminada la cobertura de las capturas.

La vista Tabla reutiliza `column-settings.js`, incluido su panel, buscador, movimiento, guardado y cálculo real de posición. Conserva fotografía, nombre, referencia, código, existencias, PVP, marca, proveedor, coste base del producto e identificador según columnas seleccionadas y permisos. El coste requiere acceso a Productos observado por el servidor; se omite del resultado para el resto de cuentas.

La disposición y ordenación se guardan en Central por usuario, conexión, tienda y caja. Los filtros y la distribución no son ediciones de una venta y no generan avisos falsos de cambios sin guardar. Fotos, Compacta, Lista y Tabla utilizan el mismo catálogo; la entrada de mercancía reutiliza estas vistas y permite artículos sin existencias.

El conector consulta y ordena el conjunto filtrado antes de paginar, con desempate por identificador. Admite nombre, referencia, existencias, coste base del producto, marca, proveedor e identificador; ambos sentidos. El recuento corresponde a todos los resultados filtrados. Las variantes usan su consulta paginada y nombres de atributos para la ordenación alfabética. El stock usa la restricción nativa de tienda/grupo; no se presupone que todos los registros pertenezcan a una tienda independiente.

El coste mostrado es el coste base del producto; no debe confundirse con coste completo de compra con IVA/RE ni con un coste particular de combinación. La ordenación de PVP final contextual y la presentación de todos los costes particulares siguen abiertas. El PVP no muestra un control de ordenación que ordene solo la página.

Validación aislada de navegador: 50 artículos sintéticos, dos páginas bajo la misma ordenación, cambio de sentido que vuelve a la primera, columnas ocultas/movidas recuperadas, permisos, panel común dentro de ventana y tres tamaños. La migración tiene pruebas SQL de persistencia, datos inválidos y denegaciones. La consulta PHP y la ordenación nativa completa requieren su comprobación contra la instalación QA antes de cerrar el requisito.

Orden de activación necesario: migración de preferencias/contexto; servicio que filtra costes por permiso; paquete nativo actualizado; interfaz. No instalar primero la ampliación de catálogo en una tienda servida por un controlador que todavía no filtre el coste.
