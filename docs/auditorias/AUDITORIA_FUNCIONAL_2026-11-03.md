# Auditoría funcional, conexiones y preparación de infraestructura

Fecha: 03/11/2026. Base: `6aa2b6ad2ca5271e2f4ccf8fccc8323704714baf`. Sin revisión estética. Esta entrega documenta comprobaciones y problemas; no aplica correcciones a producción ni equivale a certificar que no existen defectos.

## Resultado y alcance

La batería seleccionada de 21 recorridos Playwright terminó correctamente. Incluye creación, edición, relectura, descargas e inspección de archivos, cambios de sesión, permisos, conservación de referencias inactivas, respuestas perdidas y recuperación simulada. Otras 100 pruebas de lógica de conexiones, proveedores y agentes terminaron correctamente. Se reutilizó además la evidencia del CI completo de la publicación de la base: [ejecución aprobada](https://github.com/hortimatic/Totus-Central/actions/runs/41541616729).

Los datos ficticios y los adaptadores de pruebas no acreditan una escritura real en cada servicio externo. La revisión de producción fue de lectura: catálogos, permisos, versiones, referencias y estado de operaciones. No se modificaron registros contables, usuarios, permisos, archivos, secretos, tareas programadas ni existencias. No se hicieron llamadas nuevas a modelos de IA.

El [informe de Playwright](PLAYWRIGHT_FUNCIONAL_2026-11-03.md) recoge por separado los recorridos y sus comprobaciones. Los scripts de fallo controlado se mantienen fuera de las pruebas normales de publicación: reproducen problemas abiertos, no resultados aprobados.

Se inventariaron los 16 módulos de navegación, sus secciones y operaciones compartidas; los siete servicios; los contratos y tareas programadas; y las ubicaciones de código, documentación, originales y copias. La [matriz funcional](MATRIZ_FUNCIONAL_2026-11-03.md) detalla la evidencia y los límites por área.

## Hallazgos que requieren actuación

| ID | Prioridad | Hallazgo y evidencia | Actuación y criterio de cierre |
|---|---|---|---|
| F-01 | Alta, disponibilidad | Al bloquear el CDN del SDK de Supabase, `index.html` continúa cargando `src/api.js`, que intenta `window.supabase.createClient`. Se produce una excepción y queda «Comprobando tu acceso», sin error recuperable. Reproducido sin peticiones a producción. | Servir la dependencia verificada desde la propia aplicación o controlar explícitamente su carga y fallo. Probar CDN inaccesible, recuperación y arranque normal sin perder sesión. No basta con añadir un mensaje después de una importación que ya ha fallado. |
| F-02 | Alta antes de migrar | No existe un montaje verificado desde una base vacía. Hay SQL base, migraciones históricas y `review_patches` aplicados en distintos momentos; el README ya reconoce este límite. No hay configuración única de instalación de Supabase ni manifiesto reproducible de todos los servicios. | Crear una base de esquema obtenida del estado instalado, sin datos ni secretos; consolidar el orden y las extensiones; instalar en un entorno vacío y verificar tablas, funciones, RLS, Storage, Auth y cron. No ejecutar todos los parches históricos a ciegas. |
| F-03 | Alta, gobierno de cambios | La pantalla de ramas no muestra protecciones clásicas y la de Rulesets indica que no se ha creado ninguno. El CI del despliegue protege la publicación, pero no impone por sí mismo restricciones a los cambios directos o forzados de la rama. | Proteger `totus-central`: PR, controles obligatorios, impedir borrado y force push, definir excepciones mínimas. Ensayar que un cambio sin controles no pueda integrarse. No se ha cambiado esta configuración durante la auditoría. |
| F-04 | Media, crecimiento | `cron.job_run_details` conserva un historial creciente; no se encontró una política de conservación en las tareas ni en el SQL del repositorio. Es distinto del Log funcional que se limpia desde la aplicación. | Definir conservación del historial técnico y purga limitada por fecha, conservar trabajos en curso y muestras de fallos. Medir crecimiento y verificar en una base desechable antes de cambiar producción. El detalle de tamaño y número de filas queda en el informe privado. |
| F-05 | Media, exportaciones | `reportCsv` en `src/agent-delivery.js` protege `=1+1` con apóstrofo, pero no `  =1+1`. La protección canónica de `src/utils.js` sí contempla espacios iniciales. Es una defensa inconsistente frente a fórmulas en texto exportado, no una ejecución de fórmula demostrada. | Reutilizar un único escape de CSV para los informes del agente. Probar espacios, tabuladores, saltos, signos de fórmula, comillas y números negativos reales. El texto hostil debe quedar como texto al abrir el documento. |
| F-06 | Media, permisos y mantenimiento | Se conservan varias políticas permisivas antiguas y nuevas. En las tablas examinadas las políticas restrictivas de módulo, factura emitida y privacidad siguen imponiendo los límites; no se ha demostrado un acceso indebido. Hay además privilegios SQL amplios, incluidos TRUNCATE/TRIGGER/REFERENCES, concedidos a roles de aplicación en tablas antiguas. RLS no gobierna TRUNCATE. | Inventariar privilegios efectivos, reducir permisos no necesarios y consolidar políticas equivalentes por tabla/operación, con pruebas negativas de rol y estado. No borrar políticas por el aviso del asesor sin estudiar su combinación AND/OR. No se ha demostrado que PostgREST exponga una operación de truncado. |
| F-07 | Media, capacidad | El asesor informa de seis claves foráneas sin índice y dos políticas que reevaluan identidad por fila. La carga por módulo sigue descargando conjuntos completos, paginados en el cliente, hasta un límite explícito. El control de concurrencia y el aislamiento de sesión existen, pero no equivalen a una lectura transaccional de todos los conjuntos ni a escalabilidad ilimitada. | Medir las consultas principales y escenarios de volumen; añadir los índices justificados y optimizar RLS. Para tablas crecientes, consultas por periodo y filtros en servidor manteniendo exportaciones completas y sin cambiar cálculos. No retirar los índices marcados sin uso solo por falta de actividad reciente. |
| F-08 | Media, continuidad y archivos | Las copias operativas contienen datos, originales y código, pero no sustituyen una copia de Auth, Vault, configuración del proyecto y autorizaciones externas. El conector de lectura documental no admite directamente el formato binario `.totusbackup`. | Mantener el lector de copias de Totus; ensayar una restauración completa en infraestructura separada con identidades y secretos propios. Registrar huellas, componentes, vínculos y recuentos antes de validar un cambio de servidor. La falta de lector del conector no demuestra una copia corrupta. |
| F-09 | Media, alcance real de IA | El rol de Totus no concede automáticamente control sobre GitHub, Supabase o todo OneDrive. El catálogo de agentes permite operaciones explícitas de negocio y lectura autorizada de archivos GitHub. No implementa un agente de mantenimiento que cree ramas/PR o ejecute cambios SQL arbitrarios. PrestaShop se puede registrar/probar como conexión, pero el cotejo actual se basa en los documentos adjuntos; no hay una operación general de consulta de pedidos PrestaShop en el catálogo del agente. | Publicar una matriz exacta de capacidades. Para mantenimiento externo o consulta directa PrestaShop, crear adaptadores y pruebas propios, con conexiones y usuarios asignados. No presentar «conexión guardada» o «rol administrador» como prueba de esas funciones. |
| F-10 | Media, trabajos extensos de IA | El servicio tiene presupuesto de tiempo y límites de archivos/tokens. Existen preparación por bloques y verificación de resultados, pero una prueba corta de conexión no acredita un cotejo largo. El historial real conserva fallos anteriores de generación y tiempo. | Ensayar un cotejo documental completo por cada proveedor activo, con interrupción/reanudación y verificación final. Registrar cobertura de fuentes y líneas y no marcar terminado un borrador. No se han consumido cuotas externas para repetir estos ensayos en esta auditoría. |
| F-11 | Media, reproducibilidad | La instalación de CI incluye paquetes sin fijar todos sus números de versión y el repositorio no contiene un manifiesto y lockfile únicos de dependencias. En ejecución, el SDK está fijado a una versión, pero se carga de un tercero sin integridad SRI declarada. | Fijar dependencias y lockfile, separar las de ejecución/pruebas, verificar licencias e integridad y reproducir la instalación desde cero. No actualizar paquetes como efecto secundario de una auditoría. |
| F-12 | Media, relevo | El README describe cinco servicios cuando hay siete. La entrada «vigente» lleva fecha anterior a cambios posteriores; varios procedimientos mezclan propuestas y hechos históricos. Hay rutas y orígenes concretos de la instalación en código y procesos de publicación. | Mantener una entrada única con versión, inventario y límites; separar historial y procedimiento vigente. Preparar configuración por entorno y actualizar CORS, redirecciones y referencias al cambiar dominio. Ver [plan de migración](../MIGRACION_SERVIDOR_PRIVADO.md). |
| F-13 | Baja, orden de trabajo | Hay ramas antiguas integradas y otras con commits no alcanzables desde producción, además de carpetas locales de exportaciones y pruebas. No todo lo que parece sobrante es código publicado ni puede borrarse por su nombre. | El inventario privado clasifica las ramas. Retirar únicamente las verificadas como integradas tras revisar el PR; conservar o archivar las demás hasta contrastar cambios. Los artefactos locales se excluyen de nuevos commits; no se han borrado archivos ajenos de trabajo. |
| F-14 | Mejora de seguridad | El asesor indica que la protección de contraseñas filtradas no está activada. También señala funciones SECURITY DEFINER ejecutables por usuarios autenticados; muchas corresponden deliberadamente al contrato de negocio. | Revisar la opción de contraseñas según disponibilidad del servicio, sin contratar nada. Para cada RPC privilegiada comprobar identidad, permiso, argumento, estado y búsqueda de esquema fija. No convertir todo a invoker ni retirar el contrato legítimo por un aviso genérico. |

Las prioridades altas no significan una pérdida de datos observada: F-01 es una condición de indisponibilidad reproducida; F-02 bloquea certificar una instalación independiente; F-03 es ausencia de una barrera del repositorio. No se ha encontrado evidencia de corrupción de los vínculos revisados.

## Código y servicios contrastados con producción

| Servicio | Versión observada | Función y frontera revisada |
|---|---:|---|
| `team-admin` | 11 | Gestión de usuarios, vinculación, retirada y purga, identidad y rol de quien solicita. |
| `totus-backup-run` | 58 | Autorización de ejecución, trabajo por componentes, continuación, verificación y conservación. |
| `totus-recovery` | 18 | Resumen, confirmación, punto anterior y recuperación protegida. |
| `totus-onedrive` | 36 | OAuth, lectura/subida, huellas, archivo de retirados y acceso a originales. |
| `totus-assistant` | 13 | Tickets de un uso, cuenta propia, catálogo y confirmación del resultado. |
| `totus-ai` | 21 | Identidad propia, proveedor asignado, herramientas, límites, entrega y relectura. |
| `totus-connections` | 11 | Gestor de conexiones, altas técnicas, prueba y lectura GitHub autorizada. |

Se compararon los 70 archivos incluidos en los siete despliegues con el repositorio. No hay diferencias funcionales: en OneDrive solo varía un salto de línea final. Los 88 nombres RPC literales encontrados en el código de ejecución existen en la base; esa comprobación acredita presencia, no todas las combinaciones de argumentos dinámicos.

Los servicios que tienen `verify_jwt=false` no se califican automáticamente como abiertos: se revisó su autenticación interna por sesión, ticket o trabajo autorizado. No se han leído secretos para hacer esa comprobación.

## Estado verificado de datos y conexiones

- Todas las tablas públicas inventariadas tienen RLS. No se encontraron vistas públicas que eludan RLS por defecto ni funciones públicas SECURITY DEFINER ejecutables por `anon`. Las funciones privilegiadas revisadas tienen `search_path` configurado.
- Las pruebas HTTP anónimas no devolvieron filas de gastos, documentos ni equipo; Recepciones denegó acceso. La columna pública de apariencia de Login sí devolvió su configuración, como corresponde al diseño autorizado. Las peticiones vacías sin sesión a los siete servicios se rechazaron por autenticación o validación; esto no sustituye probar cada acción válida con cada rol.
- Se comprobaron políticas restrictivas además de permisivas: la presencia de una política antigua no implica que anule la restricción de módulo o de factura emitida.
- No se encontraron líneas de gasto, líneas de factura ni fuentes de recepción huérfanas en los cruces ejecutados. Los directorios de proveedores comparten identificadores; no se detectó divergencia en ese cruce.
- Las fichas documentales revisadas tienen tamaño y huella; sus ubicaciones OneDrive registradas coinciden. No había retiradas pendientes de archivar en la lectura.
- Las cuatro tareas programadas estaban activas y los estados de cron de las últimas 24 horas eran correctos. Se contrastó además que las últimas copias reales terminaron con éxito; no se tomó un cron correcto como prueba suficiente de copia completa.
- OneDrive conserva la estructura de documentos, chat, manuales, pruebas y archivo. Se observó la rotación de diez juegos ordinarios y la estructura de componentes del más reciente. Se revisaron permisos de la raíz, no los permisos individuales de cada archivo.
- El estado histórico de recuperación `committed` es una operación terminada: no se ha presentado como una recuperación atascada por no llamarse `completed`.
- Las conexiones de IA observadas estaban activas, asignadas y verificadas en su revisión actual. Esto no acredita la disponibilidad futura del proveedor ni todas sus tareas largas.
- La búsqueda acotada de patrones de claves y claves privadas en 341 archivos de código/SQL/documentación no encontró coincidencias. No sustituye un escaneo especializado de todo el historial Git.

Los resultados operativos con recuentos, identificadores y detalles se conservan fuera del repositorio público. No se han subido facturas, credenciales ni enlaces privados a GitHub.

## Pruebas, incidentes del entorno y límites

El ejecutor `tools/audit-functional.mjs` inicia su propio servidor local, comprueba las dependencias y genera `artifacts/functional-audit/results.json` y un registro por suite. Reutiliza las pruebas existentes y permite repetir una sola con `AUDIT_ONLY`. Los datos de cada navegador están aislados.

Durante la preparación hubo dos problemas del entorno: servidor local cerrado y dependencias de pruebas que el servidor restringido no servía. Esas ejecuciones no se contabilizan como defectos de Totus ni como pruebas aprobadas. Se corrigió el entorno; los resultados finales son 21/21. Un recorrido necesitó resolver además una importación dinámica de la dependencia de PDF; se repitió únicamente ese recorrido.

La simulación `tools/audit-startup-outage.mjs` bloquea toda petición externa y documenta F-01. La prueba de F-05 usa únicamente texto ficticio. El CI completo de la base sigue siendo evidencia de las pruebas SQL en PostgreSQL desechable; no se afirma haber ejecutado localmente un PostgreSQL que este entorno no tiene.

No se ejecutó una restauración real sobre producción ni un montaje completo en servidor privado. Tampoco se ensayó un corte de DNS, renovación real de credenciales Microsoft, carga simultánea de múltiples equipos reales, todos los formatos OCR ni un cotejo completo nuevo con cada IA. Esos casos tienen puertas de aceptación en el plan de migración y en F-10.

## Orden de resolución recomendado

1. F-01 y F-05: disponibilidad de arranque y unificación del escape CSV, con pruebas de regresión específicas.
2. F-03: protección efectiva de la rama de producción.
3. F-04, F-06 y F-07: conservación técnica, permisos redundantes y medición/índices.
4. F-09 y F-10: capacidades externas reales y cotejos largos por proveedor, sin confundir permisos con herramientas implementadas.
5. F-02, F-08, F-11 y F-12: instalación reproducible, recuperación completa y configuración de entorno antes de cambiar infraestructura.
6. F-13: retirar referencias integradas y archivar material de trabajo con inventario, sin perder cambios no publicados.

## Fuentes de referencia

- [Políticas RLS y combinación de restricciones](https://supabase.com/docs/guides/database/postgres/row-level-security).
- [Funciones de base de datos y privilegios](https://supabase.com/docs/guides/database/functions).
- [Índice oficial de seguridad](https://supabase.com/docs/guides/security/product-security).
- [Autohospedaje de Supabase](https://supabase.com/docs/guides/self-hosting/docker).
- [Protección de ramas de GitHub](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).

Las referencias orientan las correcciones futuras. No se ha sustituido una comprobación del sistema por una recomendación de documentación.
