# Revisión integral · 24/10/2026

## Trabajo realizado
1. Revisión transversal de los módulos propios, API, permisos, formularios, cálculos, informes, documentos, copias y recuperación.
2. Ajustes locales de Recepciones: controles de filtros, subida, formularios y adaptación móvil coherentes con Totus Central. Enter aplica los filtros de Recepciones y Biblioteca.
3. Recuperación de Pricing: atributos editables, disponibilidad activa/inactiva, costes y PVP individuales, márgenes y rangos de variantes, descuento, comparación, historial y edición de consultas reutilizadas. Los guardados de formularios secundarios conservan el borrador principal.
4. Datos de demostración recuperados de los apuntes originales: seis productos y tres variantes; valores no documentados vacíos y referencias provisionales identificadas. No se han sustituido por una lista inventada.
5. Prueba real desde ChatGPT convencional de GitHub, Supabase y OneDrive y circuito de Recepciones con reversión completa.
6. Índice ENTREGA_FUENTES.md y guía PRICING_PRODUCTOS_Y_VARIANTES.md, además de los manuales operativos y de montaje existentes.
7. Copia nocturna del 24/10 iniciada automáticamente a las 00:35 y terminada correctamente. Verificación de archivos y recuperación temporal correcta de 42 tablas y 63 relaciones.

## Validación de la revisión
Base de producción conservada durante la preparación: cad4440f5834e923d2fa0342c8f087fad47edede.
Rama de revisión y PR: https://github.com/hortimatic/Totus-Central/pull/12.
La publicación queda condicionada al éxito de la batería final y su comprobación visual. La copia final posterior deberá incluir los datos de demostración y la nueva revisión: la copia nocturna empezó antes de recuperarlos.

Se comprobaron RLS en todas las tablas públicas, restricciones validadas, ausencia de huérfanos contables/documentales y cierres duplicados por tienda/fecha.
Las pruebas de RPC privilegiados y de periodos cerrados se ejecutaron en producción dentro de transacciones revertidas, con límites de tiempo. No se añadieron asientos ficticios ni se abrió un periodo presentado.
La revisión visual de lectura recorrió Inicio, Pricing, Recepciones, Cajas, Gastos, Facturación, Documentos, Fiscalidad, Informes y Administración. Las pruebas automatizadas incluyen cálculos, exportaciones, maquetación, subida/adjuntos, copias, recuperación y permisos, en entornos de simulación aislados.

## Hallazgo de servidor
Una nota de lectura manual sin confirmación explícita podía superar la comprobación SQL de un documento parcialmente extraído por el tratamiento de NULL.
La migración exige extracción lista o confirmación verdadera y nota. No reescribe resultados históricos. Pruebas PostgreSQL aisladas cubren confirmación ausente, metadatos ausentes y lectura manual válida.
Su aplicación y lectura final se verificarán tras la batería final.

## Conexión convencional acreditada
Evidencia: https://github.com/hortimatic/Totus-Central/pull/12#issuecomment-6376148457.
El chat Revisar Totus Central leyó GitHub, contexto Supabase y ambos PDF originales en OneDrive con SharePoint. Ejecutó escritura SQL temporal y el circuito real de creación de recepción, dos asociaciones, guardado y consulta de 39 líneas/100 unidades. Cuatro revisiones observadas. ROLLBACK y lectura independiente confirmaron que no quedó el pedido de prueba ni cambió la recepción original.
Una primera consulta de prueba falló por ambigüedad de variable y fue revertida; corregida la consulta, la segunda prueba pasó. No se atribuye ese error al módulo.
Límites: esa prueba no transfirió un binario nuevo ni guardó contabilidad persistente; tampoco simuló el acceso de todos los roles desde la interfaz. El registro general de auditoría no se comprobó separadamente en esa prueba.

## Seguridad y continuidad
Se mantienen estructura contable, navegación y datos existentes. No se han creado archivos de trabajo locales.
Los avisos Supabase se revisan por su función: tablas de servicio cerradas sin políticas cliente y RPC privilegiados con comprobación de identidad. No se eliminan índices solo por no acumular uso. La protección de contraseñas filtradas aparece desactivada en el plan gratuito; no se afirma que esté activada.
Las diez copias se conservan con rotación en la nube y comprobación antes de retirar la antigua.
La entrega permite mantener esta instalación; un instalador comercial en una base vacía requiere una prueba independiente de esquema, configuración y recuperación.
Una batería satisfactoria acredita las pruebas ejecutadas, no garantiza ausencia futura de errores.
