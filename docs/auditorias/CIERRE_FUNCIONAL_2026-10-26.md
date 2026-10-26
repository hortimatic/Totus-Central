# Cierre funcional de la revisión del 26/10/2026

Base: producción 4ce6636262c94afc8eeb057416a23b0becef1a96. Esta revisión añade correcciones de validación, arranque y retirada de componentes de copias. No modifica estructura de módulos, datos contables, permisos, conexiones ni planificación.

## Fallos reproducidos y corregidos

1. Una factura con descuento escrito como 150 % se guardaba como 100 % y total cero. Los campos decimales son entradas de texto para aceptar coma española; sus atributos min/max no los validaba el navegador. Ahora se analizan importes finitos y se respetan los límites declarados antes de cualquier escritura. Se conservan ceros, coma/punto, agrupaciones ES/EN y cantidades negativas en los campos que las permiten (por ejemplo abonos). Se retira el mínimo positivo que figuraba por error en Cantidad: las rectificativas necesitan cantidades negativas y el guardado mantiene su rechazo contextual del cero. El recorrido original de devolución parcial y total debe seguir pasando.
2. Guardar un diálogo secundario validaba también importes de una ficha principal aún sin completar. Ahora se comprueba el formulario al que pertenece la acción y se conserva el borrador principal.
3. El arranque mostraba correo y contraseña antes de terminar de recuperar la sesión. Ahora se muestra «Comprobando tu acceso…»; solo aparece el formulario si hace falta acceder o si hay error. Los intentos repetidos de acceso quedan bloqueados mientras uno está en curso. No se cambia la duración ni el almacenamiento de la sesión.
4. La selección de archivos para retirar una copia no reconocía componentes `nombre.totusbackup.datos-0000.zip`, `documentos-0001.zip` y `codigo-0000.zip` por una expresión regular mal escapada. Ahora reconoce únicamente los nombres completos exactos. La prueba incluye otros índices, extensiones añadidas y nombres parecidos que deben conservarse. No se elimina ninguna copia real durante el ensayo.

## Verificación

Tres programas nuevos en la batería de publicación:
- `form-numbers-qa.mjs`: formato, finitud, extremos, vacíos opcionales y abonos.
- `form-boundaries-browser-qa.mjs`: guardado real de formularios en simulación; límites inválidos no escriben, valor válido conserva el total, diálogo independiente no borra el borrador.
- `session-startup-browser-qa.mjs`: sesión guardada lenta, ausencia de sesión y fallo de conexión.

Se amplía `backup-retention-qa.mjs` con los componentes de las copias fraccionadas y archivos que no deben seleccionarse.

La batería completa y las comprobaciones de publicación se ejecutan antes de aceptar esta revisión. Los enlaces y resultado final se incluyen en el relevo de OneDrive. La función alojada de copias debe actualizarse con el mismo módulo de retención, manteniendo su autenticación y los demás archivos desplegados; un merge del frontend por sí solo no la actualiza.

## Cobertura acumulada de cierre

Se conserva la evidencia de la estabilización anterior: cálculos rápidos, cajas por tienda y cajón, gastos fiscales e internos, justificantes, facturas/proformas/rectificativas, productos con variantes, recepciones y equivalencias, calendario y recurrencias, chat y adjuntos, filtros, informes mensuales/trimestrales/anuales, Excel/PDF/ZIP, usuarios y roles, almacenamiento y copias. Los recorridos de escritura se hacen con datos ficticios; la consulta en producción no altera contabilidad.

Datos comprobados en producción antes de la publicación: 486 cierres, 584 gastos, 483 documentos, cero enlaces de gastos a fichas documentales inexistentes. Diez copias guardadas y ninguna ejecución en curso al preparar la actualización del servidor. La copia nocturna del 26/10 ya fue leída y ensayada con 52 tablas y 86 relaciones sin restaurar sobre la base viva.

No se cambian los importes históricos ni se acepta automáticamente el borrador de cierre existente. Un registro pendiente o un justificante aún no aportado no se transforma en completo para presentar todos los indicadores en verde.

## Criterio para futuros cambios

- Leer la rama y la función desplegada actuales antes de editar; conservar todas las funcionalidades validadas.
- Reproducir el fallo; añadir una prueba de comportamiento; comprobar datos válidos y casos de error.
- Revisar el cambio aislado y superar la batería antes de publicar. Verificar después la versión servida y la operación afectada.
- No convertir avisos estadísticos de índices sin uso en autorización para borrarlos. No ampliar privilegios para ocultar errores.
- No probar pagos, borrados irreversibles ni restauraciones sobre contabilidad real.
- Guardar código y relevo en GitHub/OneDrive; no crear una dependencia de un ordenador encendido.

Las mejoras comerciales (instalador y nuevos clientes) siguen fuera de este cierre de correcciones. La prevención de contraseñas filtradas de Supabase requiere un plan de pago: no se contrata para eliminar un aviso, conforme a la decisión del titular de conservar el plan gratuito. El mantenimiento ordinario y la renovación de Microsoft antes del 18/04/2027 siguen siendo necesarios; una revisión no elimina el mantenimiento futuro.
