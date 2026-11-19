# Visibilidad del catálogo · 17/11/2026, 12:46 CET

Ampliación de CFG-09-09, CFG-09-11 y CFG-10-02 en la rama borrador. Implementada y comprobada en laboratorio; activación y aceptación remotas pendientes. No habilita vender sin existencias ni amplía permisos.

## Uso

En **Más acciones → Configuración → Visibilidad del catálogo de venta** puedes ocultar agotados, elegir categorías excluidas y mostrar marca, proveedor y códigos en las tarjetas. Guarda el mostrador. El ticket se conserva y el catálogo se vuelve a consultar. La categoría inicial debe permanecer visible; si la has excluido, se pide elegir otra o **Todas las categorías**.

Las exclusiones incluyen subcategorías. Un producto con alguna variante disponible permanece visible aunque su existencia general sea cero. El padre indica **Existencias por variante**; al abrirlo se muestran las variantes correspondientes. La tabla presenta **Por variante** para evitar confundir la suma general con las unidades seleccionables.

Estos filtros de venta no se aplican en **Entrada de stock**, para poder reponer agotados. Al regresar a Venta se vuelven a aplicar. No se eliminan artículos, no cambia su existencia y no se transforman filtros de presentación en permisos.

Si desaparece una categoría excluida, la herramienta pide revisar las categorías en Configuración y guardar de nuevo. Una consulta fallida no reutiliza los resultados anteriores como si cumplieran un filtro nuevo.

## Construcción

`catalogue-preferences.js` valida opciones, conserva selección múltiple y limita exclusiones a cien categorías. La migración `20261117111400_totustpv_catalogue_filters.sql` amplía la RPC privada por cuenta/caja, conservando autorización y preferencias anteriores. Es la novena migración todavía sin aplicar remotamente.

Adaptador, handler, transporte y conector aceptan parámetros acotados. El servidor exige categorías activas de la tienda y aplica rangos nativos de árbol antes de contar y paginar. Los límites del árbol también permiten ocultar descendientes cuyo padre inactivo no aparece en el selector. El filtro de existencias comprueba artículos simples y variantes reales de la tienda, sin decidir únicamente por la suma general del padre. La elección exacta y el índice de PVP conservan estos filtros en su identidad.

Los datos adicionales se escapan como texto. No incluyen coste ni campos privados. El permiso de costes existente permanece separado. Una conexión que no confirme filtros personalizados no puede ignorarlos silenciosamente.

## Evidencia

- 491 aserciones SQL y 48 recorridos afectados aprobados desde 5a85b973. Después de aclarar la presentación del padre con variantes se repitieron el recorrido nativo, la tabla en navegador y 36 pruebas de contrato/frontera, todas aprobadas.
- PrestaShop 8.2.8/MariaDB locales: existencias simples cero/negativas, padre con suma cero y variante disponible, variante exacta agotada, categorías con ancestro inactivo, exclusión de descendientes e índice de PVP.
- Prueba de 23 artículos: los veinte primeros están agotados; el filtro encuentra en la primera página el artículo disponible que estaba detrás. Los recuentos y la paginación proceden del conjunto filtrado.
- Navegador conectado a handler y SQL reales aislados: validación de categoría inicial oculta, persistencia, reposición sin filtros de venta, regreso a Venta, marca/proveedor, selección de variante, conservación del ticket y 1440/390 píxeles. Se revisaron las capturas.

Las consultas probadas no escriben registros nativos; la preparación del laboratorio crea únicamente datos ficticios. Autenticación y entrega loopback son fixtures. No se toca una tienda remota. Siguen abiertos la venta sin stock, productos deshabilitados para mercancía, almacenes avanzados y los restantes requisitos del TPV final.
