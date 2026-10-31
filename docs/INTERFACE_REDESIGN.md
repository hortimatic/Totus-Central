# Rediseño visual aprobado · 31/10/2026

Estado: en desarrollo, separado de producción. Referencia visual: https://stitch.withgoogle.com/projects/5869856515258186560

## Contrato de conservación

Mantener orden de módulos, rutas, permisos, formularios, acciones, cálculos, documentos, exportaciones y preferencias personales. Los diseños externos usan exclusivamente datos ficticios. Ningún HTML de Stitch sustituye los procedimientos de negocio. La configuración personal existente sigue teniendo prioridad sobre el aspecto base.

## Alcance aprobado

1. Sistema visual común: navegación azul noche, superficies claras, acentos azul/turquesa, estados accesibles y adaptación móvil.
2. Inicio; Pricing y variantes; Cajas y detalle; Gastos y control interno; Facturación; Recepciones; Tareas; Chat; Documentos; Fiscalidad; Informes; Administración y sus pestañas; Configuración; Login.
3. Menú personal superior derecho: foto, datos propios, documentación, tareas, avisos y preferencias. Reutilizar permisos y operaciones existentes; nunca permitir autoasignación de roles ni exponer documentos de terceros.
4. Configuración / Interfaz: conservar todos los controles, añadir un grupo claro para la barra de navegación. Persistencia por usuario, también tras recarga y cambio de ordenador.
5. Mantener Login compartido y fondo/sonidos de Chat en sus ubicaciones actuales.

## Criterios de revisión

- Cada módulo conserva todos sus campos y acciones, incluidos estados vacíos, errores y reintentos.
- Importes y signos íntegros; las tablas anchas disponen de desplazamiento explícito o fichas completas.
- PC, tableta y móvil; teclado, foco, zoom y texto grande; tema claro y oscuro.
- No publicar opciones meramente decorativas: guardar, recargar, cambiar usuario y comprobar aislamiento.
- Documentar por separado diseño, implementación, pruebas y publicación. Una maqueta no es una función terminada.

## Progreso

- Referencia Cajas PC, detalle y móvil generada y dirección visual aprobada.
- Inicio, Mi cuenta PC/móvil y Configuración / Interfaz generados; referencias de Pricing, Gastos, Fiscalidad, Informes, Recepciones y Facturación generadas. Las cifras y funciones inventadas por Stitch no se incorporan a la lógica real.
- Sistema visual común y Mi cuenta preparados en `design/stitch-interface`. Mi cuenta conserva identidad y permisos administrados; guarda únicamente nombre visible, teléfono y foto personales en su propio espacio de preferencias. Documentos son los ya subidos por el usuario, no un nuevo archivo laboral compartido.
- Cajas móvil: menú de módulos completo, filtros desplegables, fichas con desglose accesible y ayudas compactas. Comprobación de siete anchuras (320–1920 px), perfil, borradores y controles: ejecución GitHub 41241507135 aprobada.
- Petición adicional: ventas anotadas por cajón y suma automática del total de tienda. Referencias opcionales para conservar el histórico sin inventar repartos. Guardado y reapertura, céntimos, datos incompletos, diferencias individuales compensadas, permisos existentes y serialización de recuperación: ejecución 41242368020 aprobada en simulación y PostgreSQL desechable.
- Producción sigue en `39850832`. No se han aplicado todavía las migraciones 034/035 ni publicado esta rama. Las pruebas anteriores no acreditan un cambio desplegado.

## Cobertura que debe cerrarse antes de dar por terminado el conjunto

| Módulo | Vistas incluidas |
|---|---|
| Inicio | Indicadores, gráfica, periodos, tiendas y accesos |
| Pricing | Catálogo, simples/variantes, familias/marcas, proveedores, competencia y consultas |
| Cajas | Histórico, filtros, fichas, estados, cada cajón, ventas independientes y suma |
| Gastos | Registros, Facturas y justificantes, Proveedores, control interno, ficha y adjuntos |
| Facturación | Documentos, Clientes, Plantillas y marca, Series, líneas, proformas y rectificativas |
| Recepciones | Registro, nueva recepción, proveedor y documentos, cotejo, incidencias y biblioteca |
| Tareas | Calendario, agenda, recurrencia, asignación, filtros y ficha |
| Chat | Canales, secciones, directos, mensajes, archivos, avisos y configuración |
| Documentos | Archivo, carga, clasificación, vínculos, vistas previas y retirada |
| Fiscalidad | Periodos, ingresos, previsiones, cálculo, pagos, contraste y ajustes |
| Informes | Bloques reordenables, control interno, diarios, gestoría y exportaciones |
| Administración | Usuarios, Roles y permisos, Negocio y cajas, Configuración fiscal, Almacenamiento, Copias y Log |
| Configuración | Todos los controles personales de Interfaz y los compartidos de Login; navegación agrupada |
| Mi cuenta | Perfil/foto, documentos subidos, tareas propias, avisos y acceso a preferencias |
| Acceso | Marca, fondos, errores y recuperación existentes |

El estilo común no equivale por sí solo a haber verificado todas estas vistas. Registrar las pruebas de integración y la publicación final sin sustituirlas por capturas de Stitch.
