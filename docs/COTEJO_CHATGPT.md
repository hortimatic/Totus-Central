# Cotejo de mercancía desde ChatGPT · módulo de Totus Central

## Diseño
El usuario adjunta **en ChatGPT**, no en la web, factura/albarán y movimientos de entrada de PrestaShop.
ChatGPT extrae todas las líneas, contrasta equivalencias y cantidades, y guarda el lote a través de su conexión autorizada a Supabase. La web solo consulta y muestra los resultados. No hay llamadas a API de IA desde la web, ni Work, ni cambios automáticos de stock.

1. En ChatGPT: adjuntar factura/albarán y una o más entradas **del mismo lote y tienda**.
2. Verificar cobertura, línea/página, identidad/variante, unidad compatible y factor antes de marcar correspondencias como confirmadas.
3. Guardar una fila en \`public.ops_stock_cotejos\` con \`shop\`, \`supplier\`, \`reference\`, \`received_on\`, \`coverage\`, \`documents\`, \`warnings\`, \`rows\`, \`complete\` y \`status\`.
4. Cada \`row\` conserva las claves del contrato de comparación: \`id\`, \`supplierProduct\`, \`stockProduct\`, \`unit\`, \`expected\`, \`recorded\`, \`adjustment\`, \`adjustmentIncluded\` ('yes'/'no'/'unknown'), \`adjustmentReason\`, \`matchConfirmed\`, \`evidence\`, \`sourceSupplier\`, \`sourceStock\`, \`action\`. Una cantidad no verificada es \`null\`, nunca cero por defecto.
5. Guardar en \`ops_stock_equivalences\` **solo** correspondencias confirmadas con evidencia, tienda, proveedor, variante y factor. No deducir una equivalencia por parecido de nombre.
6. Revisar en Totus Central → Cotejos el resumen y todas las líneas; corregir el lote desde ChatGPT con nueva evidencia.
7. No volver a pedir conteo físico: las entradas de PrestaShop ya representan lo contado por el equipo. No duplicar factura y albarán de una misma entrega.

**Ajustes:** F = cantidad proveedor, P = entrada neta PrestaShop; A = ajuste ajeno a recepción **incluido** en P; R = P−A solo si la inclusión está confirmada; D = R−F. Si se desconoce el factor de unidad o el estado de ajuste, diferencia pendiente. Si la correspondencia no está confirmada, mostrar pendiente aunque las cantidades coincidan.

**Estados:**
- \`sin_diferencias\`: solo cuando \`complete=true\` y toda identidad, unidad y cantidad está verificada.
- \`con_diferencias\`: hay diferencias documentadas.
- \`incompleto\`: páginas, líneas, referencias o alcance sin poder procesar.
- \`pendiente\`: recepción aún en revisión.

**No deduplicar por suma de líneas:** la restricción de unicidad \`shop+supplier+reference\` para referencias no vacías impide dos cotejos para la misma factura con el mismo proveedor; una entrega parcial o otro lote del mismo documento debe revisarse antes de reutilizarlo. La corrección debe actualizar el mismo registro, nunca crear una copia por accidente.

## Seguridad
La navegación usa el permiso de lectura de Documentos, evitando alterar el catálogo existente de nueve permisos; una cuenta sin ese permiso no ve el módulo. RLS obliga a ser usuario autenticado del equipo autorizado mediante \`private.totus_can('documentos','view')\`. La web tiene solo SELECT; no hay edición ni borrado público. La conexión administrativa de ChatGPT debe guardar el resultado sin copiar secretos ni archivos privados al repositorio GitHub.

## Pendiente antes de publicar
- Ejecutar migración en un entorno aislado, nunca primero en producción. Comprobar RLS con usuarios autorizados/no autorizados y prueba de lectura desde la web autenticada.
- **Integración con copias y recuperación:** estas tablas nuevas no están todavía incluidas en \`private.totus_recovery_tables()\`. Hay que ampliar y probar el contrato de copia, restauración de versiones anteriores y salvaguarda en OneDrive **antes de habilitar el módulo en producción**.
- Ejecutar el conjunto de QA y prueba con factura/albarán y entradas reales. Los ejemplos ficticios solo prueban fórmulas, no OCR ni formatos concretos.
- Comprobar despliegue privado y lectura sin que falle el inicio si la tabla aún no existe.
