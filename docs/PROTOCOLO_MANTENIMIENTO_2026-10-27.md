# Protocolo de mantenimiento y auditoría — revisión 27/10/2026

## Estado de este documento
Este protocolo acompaña al PR33 de revisión. No presupone que sus cambios estén desplegados. Antes de operar, comparar la rama publicada, las funciones del servidor y las migraciones efectivamente instaladas. No aplicar instrucciones de una revisión a una producción que todavía no las incorpora.

## Reglas que deben conservarse
- Una única producción: rama totus-central. No sustituirla por código antiguo ni reconstruir módulos simplificados. Conservar las funciones y la estructura validadas.
- GitHub contiene código, pruebas y documentación pública; Supabase contiene los registros estructurados, permisos y programación; OneDrive contiene originales, archivo recuperable y copias. No publicar contabilidad, claves ni esquemas privados de ensayo.
- Descubrir las conexiones disponibles en cada chat y probarlas. Poder leer un archivo no acredita poder subirlo; una escritura SQL temporal no acredita el circuito contable completo. No exigir Work si los conectores necesarios están disponibles.
- Antes de crear: buscar duplicados. Antes de cambiar: releer la ficha y conservar su versión. No usar SQL directo para saltarse permisos, validaciones, numeración, auditoría o procedimientos de guardado.
- Separar fecha de venta, fecha de pago y fecha de factura. Conservar las diferencias documentadas; no modificar cifras para que coincidan con gestoría. Las facturas originales prevalecen sobre errores confirmados de transcripción.
- Gastos de control interno e impuestos pagados admiten justificante, pero no reducen el beneficio fiscal. Un adjunto no convierte por sí solo un gasto en deducible.

## Retirada de documentos tras instalar la revisión
Usar el procedimiento de la aplicación. El navegador solicita la retirada y el servidor comprueba los permisos del solicitante. Antes de retirar el original de Supabase, el servidor asegura una copia en OneDrive, relee sus bytes y contrasta tamaño y huella con la referencia protegida. Después completa la retirada y conserva el archivo recuperable. Si falla, la solicitud queda pendiente para reintento y debe mostrarse como tal.

No borrar directamente objetos de Storage ni fichas ops_documents. No llamar desde un chat al procedimiento reservado al servidor para acreditar una copia. No fabricar fechas, identificadores ni huellas de verificación. Un archivo listado en OneDrive no basta para demostrar que conserva los bytes correctos.

## Cambios de código
1. Leer el relevo, el manual del módulo y las pruebas existentes. Identificar el fallo y reproducirlo con datos ficticios.
2. Crear una revisión separada; conservar la producción en servicio. Avisar antes de cambios de estructura o comportamiento que excedan la corrección autorizada.
3. Corregir la causa sin retirar funciones. Probar éxito, cancelación, error, doble pulsación, respuesta perdida, cambio de cuenta y concurrencia cuando sean aplicables.
4. Verificar permisos con el usuario normal y no solo con una conexión administrativa. No ejecutar restauraciones ni ensayos contables sobre producción.
5. Publicar únicamente archivos revisados. Pasar CI y revisar el diff completo. Coordinar migraciones, servidor y cliente: un frontend nuevo no basta para instalar este protocolo.
6. Obtener una copia completa comprobada antes del despliegue. Registrar versión, pruebas y límites. Confirmar los recorridos reales autorizados después de publicar.

## Qué demuestra una prueba
Distinguir pruebas de lógica, navegador simulado, SQL aislado y comprobaciones reales del servicio. Un clic observado solo demuestra ejecución del control; no acredita su resultado. Un simulador de permisos o archivo no demuestra lectura real de OneDrive. Mantener los fallos encontrados y sus reproducciones en el informe.

No afirmar ausencia absoluta de fallos ni producción «100%» por contar pruebas. Enumerar lo comprobado, lo pendiente y las limitaciones materiales. ChatGPT convencional necesita que un usuario inicie su trabajo; no es un agente siempre conectado. Las copias nocturnas y reintentos deben depender del servidor, no de un ordenador encendido ni de un chat activo.
