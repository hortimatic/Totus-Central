# TotusTPV — mostrador integrado

## 1. Ambiente
Puesto de trabajo diario compacto, ordenado y simétrico. Densidad 8/10, variación 2/10, movimiento 1/10. La interfaz pertenece a Central y conserva su apariencia guardada.

## 2. Color
Usar los tokens existentes --panel, --bg, --ink, --muted, --line y --accent. Referencia neutra: blanco #ffffff, pizarra #f1f5f9 y texto #0f172a. El acento lo decide la cuenta; no imponer el verde de la referencia ni añadir otra paleta.

## 3. Tipografía
Heredar la familia y escala de Central. Texto de producto 0.88rem, auxiliar 0.74rem, títulos 1.05rem. Importes con números tabulares. Reducir fotos y títulos en móvil conservando controles legibles.

## 4. Componentes
Reutilizar botones, campos, pestañas y permisos de Central. Productos con foto, nombre, referencia, stock y precio. Vistas Fotos, Compacta y Lista sobre los mismos datos. Categorías ordenadas alfabéticamente. Una configuración visible guarda preferencias por usuario y caja en Central.

## 5. Distribución
Referencia suministrada por Diego: búsqueda/categorías y catálogo a la izquierda; cliente y ticket a la derecha; total y cobro al final del ticket. Sin tarjetas decorativas vacías. Columnas con minmax(0,...) y desplazamiento independiente acotado. Bajo 768px, catálogo y ticket en una columna. Comprobar 390, 768, 1024 y 1440px.

## 6. Movimiento
Sin movimiento perpetuo en un puesto de cobro. Estados de carga y errores explícitos; no desplazar el foco al escribir ni animar importes. Respetar reduced-motion.

## 7. Límites y procedencia
Referencia visual oficial exportada desde Stitch: proyecto 11423527375971164234, pantalla Mostrador Inspirado en TPV Tienda, conservada en stitch-mostrador.html. Adaptar su disposición; no ejecutar su HTML, CDN, código de pago o almacenamiento local. El módulo usa pedidos nativos y datos de Central. Las preferencias no copian catálogos al ordenador. La impresora real es de 58mm y el datáfono es independiente.
