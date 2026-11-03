# Preparación de un servidor privado

Estado a 03/11/2026: inventario y procedimiento preparados; **instalación integral desde cero todavía no ensayada**. No se ha contratado servidor ni cambiado producción. Base revisada: `6aa2b6ad`. Este documento es una secuencia de trabajo, no una orden de ejecutar la migración.

## Qué puede significar el cambio

| Escenario | Qué se mueve | Lo que debe seguir funcionando |
|---|---|---|
| Continuar con Supabase gestionado en otro plan | Capacidad/servicio contratado; no obliga a cambiar la aplicación de host. | Mismo esquema, Auth, RLS, funciones, cron, documentos y sesiones según el cambio concreto. No se ha elegido ni contratado plan. |
| Servidor privado para la web | Archivos publicados de la web y dominio; Supabase/OneDrive pueden mantenerse. | API URL y clave pública, HTTPS, orígenes CORS, recuperación de contraseña, recursos y versiones. No equivale a una base de datos privada propia. |
| Infraestructura completa propia | Web, PostgreSQL y servicios compatibles de Auth, REST/RPC, Storage, Functions y Realtime; trabajos y observabilidad. | Contrato Supabase usado por el cliente y los siete servicios; extensiones; políticas; integridad; Graph/OAuth; copias y recuperación. No basta copiar HTML ni instalar un PostgreSQL vacío. |

Supabase documenta el despliegue mediante Docker y la configuración/aseguramiento de sus servicios en la [guía oficial de autohospedaje](https://supabase.com/docs/guides/self-hosting/docker). Se debe fijar una versión del conjunto compatible y comprobarla: no elegir imágenes `latest` durante el traslado. No se ha dimensionado un servidor concreto ni se ha probado su disponibilidad.

## Inventario que debe conservarse

| Componente | Contenido / ubicación | Comprobación de aceptación |
|---|---|---|
| Web | `index.html`, `src/`, `assets/`, favicon y fondo; ensamblado de `.github/workflows/publish.yml`. | Todos los imports y recursos existen; `build-info.json` identifica el commit exacto. No incluir `tests`, credenciales ni exportaciones privadas. |
| Datos de aplicación | Tablas, secuencias, identidades de filas y relaciones de esquemas `public` y `private`. | Esquema y recuentos coinciden; IDs, referencias, huellas y estados se conservan. Valores contables contrastados, no corregidos para cuadrar la migración. |
| Código SQL | Funciones, triggers, políticas, grants, índices y restricciones; historial de instalación. | Comparar definiciones/firmas e índices con el inventario de origen; pruebas positivas y negativas por rol. |
| Extensiones | `pgcrypto`, UUID, Vault, `pg_cron`, `pg_net` y `pg_stat_statements`, además de las necesarias de la plataforma. | Disponibilidad y versión compatibles, permisos correctos, sin secretos incluidos en un archivo público. |
| Identidad | Auth, usuarios, identificadores, metadatos de aplicación y vínculo con equipo/permisos. | Probar usuario humano y técnico, retirada/purga, recuperación y nuevo inicio. Definir cómo se preservan o renuevan credenciales de forma segura. |
| Secretos | Vault y variables de funciones, OAuth Microsoft, credenciales técnicas y claves de proveedores. | Reaprovisionar por canal privado; nadie los copia al informe, chat, frontend o GitHub. El backup operativo no los incluye. |
| Servicios | Los siete directorios de `supabase/functions/` y sus dependencias compartidas de `src/`. | Misma fuente y contrato; autenticación interna, tickets de un uso, sesión propia y errores comprobados. |
| Storage | Buckets privados `business-assets`, `business-documents`, `business-backups`; tipos/tamaños y políticas. | No volver público un bucket para solucionar un error. Los originales pueden estar ya retirados de Storage tras su espejo verificado. |
| OneDrive | `Apps/Totus Central`, IDs Graph, originales, chat, juegos de copia y archivo de retirados. | Preservar IDs/rutas administradas. Cambiar host no exige renombrar estas carpetas ni subir documentos duplicados. |
| Programador | Copias, muestras de almacenamiento, espejo OneDrive y reanudación de copias. | Una sola autoridad ejecutando cada trabajo; timezone Europe/Madrid verificado; nueva copia completa finalizada, no solo un cron exitoso. |
| IA y conexiones | Configuraciones/revisiones, asignación de cuenta, contadores, secretos y lectores autorizados. | Probar cada adaptador con datos ficticios, luego un caso autorizado; no sustituir el proveedor silenciosamente ni poner contadores a cero sin motivo. |
| GitHub y entregas | Rama `totus-central`, historial, CI, protección, versiones y código incluido en copias. | Despliegue revisable y reversible; no eliminar el origen mientras el destino no esté aceptado. |

## Configuración que hay que desacoplar del despliegue actual

1. `src/config.js`: URL de API y clave publicable por entorno. Una clave de servicio nunca sustituye a la pública en el navegador.
2. Origen permitido de los servicios (`totus-ai`, `totus-connections`, copias, recuperación y OneDrive) y el comportamiento de `team-admin`, cuyo CORS actual es distinto.
3. Destino de callbacks Microsoft, URI registrada en la aplicación Microsoft, Site URL y redirecciones de Auth/recuperación.
4. Enlaces de producción/código y proceso que obtiene el código publicado para las copias. Identificar qué sigue en GitHub y qué cambia al nuevo host.
5. URL interna y permisos de las llamadas HTTP del programador. No copiar comandos de cron a documentación: pueden contener autorizaciones.
6. Variables de servicio: `SUPABASE_URL`, claves públicas/anon y de servidor según el servicio. Inventariar también las variables opcionales de correo y el resto de configuración del código. Los valores se conservan en el gestor privado del destino.
7. Credenciales de Vault para cada cuenta de agente y proveedor; almacenamiento de identidad de instancia que valida las copias. Un cambio de instancia no se simula alterando una huella para forzar la recuperación.

Preparar un manifiesto de nombres de variables y servicios, sin valores. El estado instalado se contrasta contra el manifiesto, no contra una lista de recuerdos del chat. No se cambia el dominio/origen actual durante esta auditoría.

## Secuencia de ejecución cuando se decida migrar

### 1. Construir una instalación vacía reproducible

- Exportar por herramienta apropiada el esquema instalado y sus roles/permisos necesarios, con una revisión que excluya secretos y datos privados.
- Ordenar la base inicial y las migraciones posteriores. Las carpetas históricas no son un instalador lineal comprobado; no borrar el historial para que parezca ordenado.
- Levantar un entorno aislado con correo y modelos externos sin envíos reales por defecto; desactivar cron hasta tener identidades y configuración verificadas.
- Aplicar esquema, buckets y siete servicios. Comparar tablas, RPC, triggers, RLS e índices con las huellas del origen.
- Ejecutar pruebas de base de datos y el conjunto funcional de navegador. Capturar logs por caso y resolver fallos antes de copiar datos reales.

### 2. Ensayar una recuperación completa en el destino aislado

- Seleccionar un único juego de copia y reunir su índice y todos sus componentes. No mezclar archivos de fechas diferentes.
- Leer el índice con el lector de Totus; comprobar formato/versiones, componentes, tamaño y SHA-256. Un conector que no lee `.totusbackup` no autoriza a dar por válida la restauración.
- Recuperar datos y archivos en el destino de ensayo. Preparar Auth/Vault/configuración por su circuito independiente y seguro.
- Releer registros, líneas, adjuntos y estados. Abrir/descargar originales de ambas tiendas y del chat; comparar huellas, no solo nombres.
- Comprobar series y siguiente número, facturas emitidas inmutables, cierres/cajones, periodos cerrados, documentos protegidos y equivalencias.
- Ensayar error/reintento, componente corrupto, copia incompleta, restauración cancelada y recuperación del punto anterior. Confirmar que no escribe en el origen.

### 3. Probar conexiones y operación continua

- Autenticación real de una cuenta de prueba por cada rol relevante y de una cuenta técnica por proveedor; desactivar una cuenta debe revocar su operación normal.
- Microsoft: permisos y consentimiento propios, callback y renovación, subida/lectura, original inexistente, transferencia cortada y archivo de retirados.
- IA: prueba de herramientas, informes por fechas, factura original adjunta y un cotejo extenso con cobertura completa. Verificar autor/proveedor, persistencia y relectura. Registrar límites reales, no porcentajes inventados.
- PrestaShop: si se implementa la consulta directa, probar pedidos concretos con la conexión autorizada y distinguirlos del recuento documental aportado. No cambiar existencias por cotejar.
- Activar el programador solo en el ensayo controlado que corresponda; comprobar copia terminada y rotación, no solo activación del trabajo.
- Medir tiempos y consumo con un volumen representativo y dos sesiones concurrentes. Esta auditoría no ha inventado un tiempo de migración ni de recuperación.

### 4. Corte controlado

- Tener origen recuperable, destino aceptado y procedimiento de vuelta atrás. Definir responsables, ventana y aviso a usuarios.
- Evitar escrituras simultáneas en dos producciones. Completar copia/exportación final coherente y conservar IDs/`request_id` y revisiones.
- Transferir configuración privada; desactivar los trabajos del origen antes de activar los del destino. No mantener dos cron generando o rotando copias sobre la misma carpeta.
- Cambiar web/DNS y orígenes autorizados; verificar certificados, inicio de sesión y redirecciones. Obligar a iniciar sesión de nuevo si cambian las claves de firma.
- Comprobar con el usuario: registro y reapertura de una operación autorizada, informes, original, chat y próxima copia programada terminada.
- Mantener el origen detenido pero recuperable hasta aceptación. No eliminar base ni carpetas del origen como parte de un supuesto «limpiar».

## Puertas de aceptación

| Puerta | Estado de esta auditoría |
|---|---|
| Inventario de módulos, servicios y conexiones | Preparado, con matriz y evidencia privada. |
| Fuente de los servicios contrastada con GitHub | Comprobada, sin diferencias funcionales en la base revisada. |
| Pruebas de usuario con datos ficticios | 21/21 nuevas suites y 100 pruebas de lógica correctas; CI completo de la base aprobado. |
| Base inicial instalada desde cero | Pendiente; bloquea certificar una instalación independiente. |
| Copia completa restaurada en infraestructura nueva | Pendiente; no se ha restaurado producción. |
| Auth/Vault/OAuth/secretos y trabajos trasladados | Pendiente del destino; no se han exportado secretos ni contratado servicios. |
| Cotejo largo real por cada proveedor en el destino | Pendiente de ensayo autorizado y cuota disponible. |
| Corte y vuelta atrás ensayados | Pendientes de definir y probar el destino. |

El código se puede preparar para varios hosts, pero comprar un servidor no completa estas puertas por sí solo.
