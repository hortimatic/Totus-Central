# OneDrive: operaciones y formatos

## Regla de trabajo
No se necesita el cliente de OneDrive del ordenador. Utiliza el conector Microsoft SharePoint / OneDrive disponible en el chat, con referencias Graph exactas devueltas por búsqueda/listado. La conexión de la aplicación y el conector del chat son autorizaciones distintas. Tener acceso a Supabase no concede automáticamente herramientas de OneDrive al chat.

## Leer, subir y actualizar
1. Localiza la carpeta correcta de Totus Central. No crees otra raíz paralela.
2. Usa fetch para leer un documento. Para conservar su archivo binario, solicita download_raw_file=true.
3. Reutiliza el file_uri exacto retornado por esa acción en upload_drive_item_content, indicando el padre y un nombre claro. Usa conflict_behavior=fail salvo que se haya autorizado una sustitución.
4. Comprueba tamaño y hash del archivo de destino; vuelve a leerlo.
5. update_file_exact sustituye un archivo completo por su ID. No edita celdas, párrafos ni páginas por sí solo. Antes de reemplazar un archivo de trabajo se necesita el resultado editado y comprobado, y una copia/versionado recuperable.
6. No uses base64 como file_uri, no publiques vínculos y no vuelvas a crear credenciales si el problema es que una herramienta no aparece en ese chat.

## Formatos
- PDF e imágenes: conservar original; la extracción de texto/OCR puede ser incompleta. No dar un cotejo por terminado si faltan páginas o cantidades.
- XLSX/XLS: el archivo binario conserva fórmulas, estilos y hojas; el texto extraído no equivale al libro editable. Para modificarlo hay que usar una herramienta de hojas de cálculo y volver a comprobar el libro completo, no subir un CSV renombrado.
- DOCX/PPTX: requieren una herramienta adecuada para editar su estructura. Sustituir los bytes no demuestra que su diseño sea correcto.
- CSV/TXT/JSON/Markdown: conservar codificación, separadores y estructura. No cambiar un original contable para hacer coincidir cifras.
- ZIP: transporte de archivos; su lectura textual no acredita verificar todos sus componentes.

## Evidencia del 24/10/2026
Se ejecutó lectura binaria de un XLSX, subida de una copia técnica de 64.246 bytes a la carpeta ya existente «90 Pruebas de conexion/Archivo de pruebas», comparación SHA-256 idéntica y lectura textual posterior idéntica. También se comprobó reemplazo de esa copia técnica por los mismos bytes, sin modificar el original. La copia está identificada «QA_TRANSPORTE_NO_USAR» y no es un libro de trabajo contable.

Esto prueba transporte y sustitución de un XLSX existente. No se presenta como una edición de celdas ni como prueba de todos los formatos. La prueba independiente del chat convencional de lectura PDF y guardado transitorio de Recepciones está documentada en PR #12. Una ampliación de esa prueba se ha enviado a ese chat; no debe darse por superada hasta recibir su evidencia.

## Asociación a Totus
Una subida a OneDrive no crea por sí sola un gasto ni una recepción. Utiliza el circuito documentado de la aplicación para registrar metadatos, comprobar huella y asociar al registro correcto. Para Recepciones consulta COTEJOS_CHATGPT.md. Para Gastos conserva el número de factura, proveedor, tienda, importes y tratamiento fiscal; un justificante de control interno sigue excluido del cálculo fiscal.
