# Recepciones y PrestaShop · cotejo documental sin IA

## Recorrido

PrestaShop → Recepciones y cotejo muestra los registros originales de la tienda. Abrir y cotejar navega al módulo Recepciones y abre el mismo identificador, sin copiarlo. Desde Recepciones también se accede directamente al botón **Cotejar factura con entrada · sin IA**.

El editor utiliza los textos y metadatos de los documentos ya asociados. Ver original recupera el archivo a través del lector privado existente, comprobando tamaño y SHA cuando están disponibles. No hay exportación manual ni llamada a un proveedor de IA.

1. Revisar las líneas propuestas frente al original. Hay lectura tabular CSV/TSV/Excel y adaptadores de texto para referencia/cantidad/descripción, SKU/EAN de proveedor y el informe de movimientos «Añadido» de PrestaShop.
2. Confirmar las unidades y, si procede, la conversión de packs con evidencia. Una unidad desconocida permanece pendiente.
3. Incluir un documento de cada lado. Si factura y albarán duplican un suministro, excluir el duplicado y explicar el motivo. La cobertura conserva esa decisión.
4. Confirmar la lectura de cada documento y ejecutar Comparar documentos sin IA.
5. Revisar faltantes, sobrantes y correspondencias pendientes. Guardar crea una revisión mediante `totus_stock_save_result`, usando la revisión leída; después se vuelve a consultar la ficha y su historial.

## Reglas y límites verificables

- EAN o referencia exactos, nombre y variante exactos, o equivalencia única confirmada por tienda y proveedor. No se emplea similitud semántica ni coincidencia aproximada.
- No se emparejan referencias con EAN contradictorios, variantes explícitas distintas o medidas de nicotina/volumen/resistencia contradictorias.
- Varias líneas candidatas en cualquiera de los lados quedan pendientes. No se agregan factura y albarán automáticamente.
- Cero es una cantidad; una cantidad ausente no es cero. Descuentos y cantidades negativas requieren revisión.
- Los packs no se deducen de la diferencia de cantidades. Requieren biblioteca confirmada o factor y evidencia introducidos por la persona que revisa.
- Cada línea conserva documento, localizador e identificador de origen. Las ediciones de las líneas propuestas conservan los valores iniciales y revisados en `rule_evidence.input_edits`.
- Un PDF escaneado o un formato no reconocido necesita lectura e introducción de líneas verificadas. El editor no declara una extracción completa por encontrar una tabla.
- Los resultados con dudas se guardan como «Falta revisar». La asignación manual y la biblioteca existentes permiten resolverlas sin IA.
- No cambia existencias, contabilidad ni documentos de origen. No altera permisos ni requiere migraciones nuevas.

## Flujos guardados

La octava sección permite guardar, duplicar, retirar y ejecutar consultas conocidas con tienda, periodo móvil y tramo horario. Son preferencias por cuenta **en el navegador**, no claves, datos financieros ni trabajos programados. La ejecución usa el lector privado y su paginación, límites y cancelación existentes. No hay ejecución con el ordenador apagado.

## Conectores que deben verificarse por separado

El Webservice de pedidos no aporta por sí solo cierres por cajón del TPV ni demuestra que un movimiento sea una recepción de proveedor. Estos adaptadores necesitan una fuente de origen identificada. El cotejo aquí compara la factura y el documento de entrada que ya están asociados a la recepción; no simula una integración TPV nueva.

## Pruebas

`tests/stock-rules-qa.mjs`: cantidades, formatos, duplicidades, variantes, conversión y cobertura.

`tests/stock-rules-browser-qa.mjs`: recorrido real de Recepciones en simulación a 390/1017/1440, faltante de dos unidades, fallo/reintento de guardado, una revisión y ausencia de llamadas IA.

`tests/prestashop-ui-browser-qa.mjs`: ocho pestañas, datos de tienda aislados, salto a la recepción original, búsqueda, flujos, ejecución y separación por usuario a 390/768/1017/1440.
