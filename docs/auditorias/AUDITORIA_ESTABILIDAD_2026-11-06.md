# Auditoría de estabilidad y limpieza · 06/11/2026

Base de producción examinada: `b91e2c522745dee6b024fb508c548f8a306ecf9b`. Esta revisión conserva datos de negocio, permisos y comportamiento contable. No escribe en PrestaShop ni contrata servicios. Los resultados operativos con datos privados se conservan fuera del repositorio público.

## Correcciones y orden

| Área | Hallazgo y actuación |
|---|---|
| Acceso | La comprobación inicial de sesión/perfil podía quedar esperando indefinidamente cuando fallaba el servicio. Se acota la espera y se recupera el formulario con un reintento, conservando la sesión y las preferencias. Incluye el cambio de cuenta. |
| Servicios | Se contrastaron ocho servicios y 81 archivos empaquetados, con 59 fuentes únicas. Dos copias compartidas estaban atrasadas: transporte de conexiones incluido en Totus IA y lector PrestaShop incluido en avisos. El manifiesto canónico permite actualizar esos paquetes conservando su autenticación. |
| Código sustituido | Se retira el acceso residual a PrestaShop desde Configuración. Un contrato lógico TPV sin consumidores de ejecución pasa a `docs/reference/`, manteniendo sus pruebas; no se elimina ninguna función operativa. |
| Base de datos | Aplicados y verificados tres índices de claves externas de automatizaciones. Parche 068 idempotente, con esperas acotadas y comprobación en CI. No altera filas ni permisos. |
| GitHub | Retiradas 20 ramas ya integradas después de contrastar sus cambios, registrar SHA y verificar una copia recuperable. Conservadas 13 con cambios únicos. Cerrado el PR inicial #114, sustituido por entregas posteriores, sin borrar su discusión ni su rama. Inventario: `RAMAS_2026-11-06.md`. |
| OneDrive | Dos manuales antiguos de Chat/configuración se trasladan al historial, conservando sus identificadores. Los originales, copias e índices necesarios no se consideran basura ni se renombran. |
| Documentación | Se actualiza la entrada de mantenimiento, la lista de módulos y los servicios de migración. Los informes anteriores permanecen fechados como antecedentes. |

## Comprobaciones realizadas

- Navegador con Playwright y datos ficticios: 28 recorridos funcionales. Los 21 iniciales comprueban la base; los siete adicionales y los controles específicos comprueban los cambios afectados. Hay registros separados por recorrido y resultados consolidados privados.
- Acceso degradado: cuatro casos de espera de sesión/perfil en anchuras de 390 y 1440 píxeles; formulario recuperable, almacenamiento preservado y reintento correcto. Tres casos adicionales de disponibilidad de SDK/reintento.
- 79 pruebas unitarias de lectores, proveedores, operaciones de agentes, entregas, CSV, automatizaciones y reglas de cotejo. Siete pruebas del contrato TPV de referencia. Los recorridos reales de OneDrive se ejecutan con su harness de navegador, no como pruebas unitarias.
- Integridad de módulos publicados, contratos de producción y dependencias completas de los ocho paquetes. La batería obligatoria de GitHub debe aprobar el commit exacto antes de integrar y vuelve a ejecutarse antes de publicar.
- Supabase: 62 tablas públicas con RLS; ninguna función pública SECURITY DEFINER ejecutable por `anon`, ninguna sin `search_path` fijado y ninguna autorización basada en metadatos de usuario mutables. No se localizaron huérfanos en las relaciones revisadas de líneas de gastos/facturas y fuentes de recepciones, ni usuarios activos sin identidad Auth.
- Seis trabajos programados activos, con ejecuciones correctas en las 24 horas consultadas. La última copia completa examinada estaba terminada y tenía ruta y huella. Un cron correcto por sí solo no acredita que una tarea de negocio haya terminado.
- OneDrive: 768 archivos inventariados en las cuatro zonas administradas, sin huecos de paginación. Las 762 referencias de base de datos —496 documentos, 60 adjuntos y 206 componentes/índices de copias— existen y tienen tamaño coincidente. Los seis restantes son originales archivados. No se descargaron y recalcularon todas las huellas del contenido; la coherencia de tamaño/huella entre registros de espejo también se comprobó.
- Seis conexiones configuradas, habilitadas y verificadas, con usuario asignado activo. Ese estado no certifica cuota disponible ni una generación real de cada proveedor.

## Límites y decisiones que evitan una limpieza dañina

1. Las advertencias de tablas privadas sin políticas, funciones privilegiadas autenticadas, políticas permisivas múltiples e índices sin uso registrado requieren interpretar su función. No se revocan permisos ni se borran índices solamente por aparecer en un asesor. Se conservan las validaciones internas de identidad y privilegios.
2. La protección contra contraseñas filtradas figura desactivada. No se activa un plan de pago ni se afirma que esa protección esté habilitada.
3. Los 13 desarrollos con diferencias únicas y los otros directorios de trabajo no se borran. Su antigüedad no prueba que carezcan de valor; algunos contienen diseños en revisión.
4. Las migraciones y parches históricos son trazabilidad, no basura. No equivalen todavía a un instalador desde cero certificado.
5. Esta auditoría no ensaya una restauración integral en un servidor privado nuevo, no certifica la migración comercial multiempresa y no confirma exactitud de los costes de PrestaShop. Los costes y márgenes siguen siendo aproximados.
6. Las simulaciones funcionales prueban resultados y errores con fixtures. No sustituyen la aceptación de cada integración comercial con datos reales ni justifican afirmar que toda la herramienta carece de fallos.

## Mantenimiento siguiente

Usar `deployment-manifest.json` como inventario de fuentes de cada servicio; comprobar dependencias antes de desplegar y contrastar el paquete servido después. Trabajar en rama, comprobar el recorrido afectado y respetar los controles de publicación. Mantener evidencia privada, manuales vigentes y antecedentes separados. Para un servidor privado, seguir `MIGRACION_SERVIDOR_PRIVADO.md` y ensayar instalación y recuperación aisladas antes del corte.
