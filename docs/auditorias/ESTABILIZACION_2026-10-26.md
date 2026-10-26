# Estabilización y contraste de auditoría — 26/10/2026
Estado: correcciones preparadas; publicación y comprobación final pendientes.
Base revisada: 27524bc2ee12609fb5efa4ea5d506f87bd92ed49.

## Defectos corregidos
1. Consulta rápida de Inicio y Pricing: se rechazaban de forma insuficiente textos truncados y valores negativos. El análisis es ahora estricto; importes no negativos, porcentajes entre 0 y 100, valores finitos y rechazo de desbordamientos. Los márgenes negativos por vender por debajo del coste siguen siendo válidos.
2. Las vistas previas de ambas consultas muestran una explicación y guiones ante entrada inválida, sin excepciones no capturadas ni resultados anteriores engañosos. Para guardar se exigen coste y PVP, admitiendo cero explícito.
3. Carpeta de copias: patrón HTML compatible con la bandera Unicode v de los navegadores actuales, conservando letras, números, guion y subrayado.
4. Paquete anual: control interno incluye impuestos efectivamente pagados, sin reducir el resultado fiscal; saldo de control separado y claramente nombrado.
5. Paquete anual: conserva documentos fechados dentro del año y los originales vinculados a registros del año aunque su fecha documental esté fuera.
6. Índice de pendientes: reconoce vínculos documentales inversos y muestra los justificantes de impuestos pagados que faltan.
No se cambia la estructura de los módulos, la numeración, la contabilidad, los documentos originales ni los permisos productivos.

## Pruebas nuevas
- quick-price-validation-qa.mjs: texto inválido, signos, porcentajes, formatos, números pequeños, desbordamientos, cero y pérdidas reales.
- quick-price-validation-browser-qa.mjs: entradas/errores/guardado en Inicio y Pricing, comprobando ausencia de persistencia inválida y de errores JavaScript.
- annual-package-consistency-qa.mjs: selección, totales y vínculos.
- annual-package-browser-qa.mjs: descarga ZIP real con originales ficticios de otro año, impuestos, resultado fiscal e índice de faltantes.
Las cuatro se incorporan a CI.
La fixture visual se alinea con el tratamiento de errores del producto y usa el favicon existente. La prueba de la aplicación real sigue siendo independiente de esta fixture.

## Contraste del informe independiente
F-01: reproducido, corregido y probado en cálculo y navegador aislado.
S-01: la protección de contraseñas filtradas del proveedor requiere Pro según su documentación. No se contrata un plan, no se presenta como brecha demostrada ni se promete eliminar el aviso manteniendo el plan gratuito.
S-02: revisadas definiciones y privilegios de las 26 funciones señaladas y sus controles centrales. Ninguna admite ejecución anónima. Las cuentas web tampoco pueden crear objetos en public. Se mantienen las funciones necesarias con sus validaciones, sin revocar indiscriminadamente.
Las políticas modulares y de privacidad examinadas son RESTRICTIVE; no confundir las políticas permisivas históricas con una ausencia de la restricción modular.
P-01: avisos de índices/políticas no prueban por sí mismos un defecto funcional. No se eliminan índices por ausencia de uso estadístico ni se cambian políticas sin ensayo.
I-01: disponible referencia binaria mediante Graph exacto; la extracción textual del Markdown puede ser nula. Distinguir obtener bytes de haber interpretado el documento. No se recrean credenciales ni se exige Work por ese motivo.
L-01: se preparó un entorno completo de pruebas y se ejecutan recorridos reales de interfaz con datos ficticios; el resultado final de CI y la comprobación autenticada deben registrarse aparte.

## Copias
La copia nocturna del 26/10 terminó con éxito. Se ejecutó además una lectura completa desde OneDrive y ensayo de recuperación mediante el mecanismo existente: HTTP 200, verified=true, 52 tablas y 86 relaciones, modo temporary-tables-no-live-writes.
Se conservaron diez copias correctas. No se restauró la contabilidad productiva.

## Límites
Un hash o una FK no certifican que un PDF corresponda semánticamente a un gasto. No se afirma haber leído individualmente todos los originales ni conciliado de nuevo los trimestres históricos.
No se emiten facturas ficticias, no se ejecutan pagos ni se restauran datos reales como prueba.
La certificación de un instalador comercial desde cero continúa siendo un proyecto separado.
La publicación no debe considerarse terminada hasta completar CI y comprobación de la versión servida.

