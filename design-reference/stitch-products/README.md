# Referencia aprobada de Productos

- Proyecto Stitch: `5869856515258186560`.
- Consola original: `6572b3976ec14951908a50d400cbf949`.
- [Prototipo original](https://stitch.withgoogle.com/preview/5869856515258186560?node-id=6572b3976ec14951908a50d400cbf949).
- 5 vistas principales y 9 subapartados de ficha; 128 controles en la exportación.

`console.original.html` conserva el módulo, las fuentes y el CSS compilado. Se
han excluido el marco global y los programas inyectados por el editor Stitch.
La huella de la captura completa está en `archive.json`. Este archivo es una
referencia de diseño, **no una página funcional de Totus ni una prueba de API**.

`scripts/extract-stitch-products.py` genera las plantillas y estilos aislados de
`src/productos-stitch-*`. Retira los manejadores de demostración antes de su uso.
Las clases del original se conservan. Las acciones reales se conectan desde
`productos-ui.js`; nunca se ejecuta el código de simulación de Stitch.

Los datos y los estados de ejemplo no se deben publicar como si fueran lecturas
reales. Los cambios funcionales se comprueban con el recorrido completo de
Productos y con la prueba específica de las vistas Stitch. La identidad visual
requiere además contraste de capturas de cada vista, no solo pruebas de clics.
