# Productos - estado y arquitectura del PR #133

Revision: 06/11/2026. Procedimiento operativo: [PROTOCOLO_PRODUCTOS.md](PROTOCOLO_PRODUCTOS.md).

## Componentes

- `src/productos-ui.js`: catalogo paginado, ficha, seleccion de campos, variantes y comparacion por tienda. Las respuestas de otra sesion o montaje se descartan.
- `src/productos-create-ui.js`: alta guiada por destino, categorias por nombre, idiomas reales, prevalidacion, confirmacion y comprobacion de una solicitud incierta.
- `src/productos-core.js`: normalizacion y planes de campos; preparar no equivale a persistir.
- `src/productos-write-contract.js`: campos permitidos, validacion, XML y comprobacion de relectura. Los campos recibidos se verifican; los no implementados se explican y no se ignoran.
- `supabase/functions/totus-connections/prestashop-create.js`: GET de preparacion, POST unico, relectura obligatoria incluso tras HTTP 500 y reconciliacion sin otro POST.
- `supabase/migrations/20261106170000_prestashop_product_create_journal.sql`: diario privado con RLS e identidad de solicitud, actor y conexion; referencia unica por tienda. Ningun acceso del navegador al diario.
- `supabase/functions/deployment-manifest.json`: todos los archivos que deben desplegarse juntos. El frontend no contiene claves privadas.

## Operaciones implementadas

Consulta de catalogo, ficha y combinaciones; busqueda entre lo cargado y paginacion 20/50/100; comparacion por referencia unica o ID explicito de destino; seleccion de campos y variantes; prevalidacion de XML. Alta de producto base inactivo con nombre, URL, referencia, precio, categoria y campos adicionales admitidos, incluyendo descripciones, SEO, coste, EAN, peso y dimensiones. Confirmacion y resultado separados por tienda.

La creacion requiere administracion activa y permiso de edicion de Configuracion. La habilitacion de POST es independiente de PUT. La publicacion se acredita mediante acta de cierre, no por esta descripcion de codigo.

## Operaciones todavia sin escritura

Actualizacion de fichas existentes, creacion de combinaciones con mapeo de atributos, imagenes, existencias y lotes. Sus pantallas preparan propuestas; los controles indican que no se aplican. No se habilita PUT solo porque el motor ficticio tenga pruebas. Estas ampliaciones necesitan su propio diario, conflictos, verificacion e instalacion.

## Pruebas y aceptacion

El CI incluye PostgreSQL descartable y PrestaShop 1.7.8.11 aislado con POST real y relectura; los tests aislados no usan las tiendas comerciales. Hay pruebas de permisos, campos, traducciones, coste/medidas, respuesta perdida y ausencia de segundo POST. El navegador se comprueba en 390, 768 y 1440 pixeles. Debe registrarse aparte la version exacta desplegada y cualquier producto de prueba real autorizado.

## Criterio de cierre

Diario instalado y protegido, servicio actualizado con sus dependencias, habilitacion revisada, controles del commit final aprobados, frontend publicado y prueba autenticada de alta con ID real y relectura. Si falta alguna parte, no afirmar que el alta esta en funcionamiento. No atribuir una funcion no instalada a un problema de permisos de PrestaShop.
