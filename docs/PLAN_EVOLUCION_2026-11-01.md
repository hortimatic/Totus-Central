# Peticiones de evolución · 1 noviembre 2026

Base: producción 9f84d754. Esta lista no acredita funciones terminadas. Cada fila se cierra con pruebas y publicación verificadas. Se conservan los cálculos, permisos, adjuntos, formularios y datos existentes.

| ID | Trabajo | Criterio de aceptación | Estado |
|---|---|---|---|
| NAV-01 | Minimizar/ampliar navegación de escritorio | Iconos accesibles, nombre mediante tooltip, sin ocultar accesos por permiso ni romper menú móvil | Publicado bccb55a7; verificado con la cuenta real |
| NAV-02 | Secciones General, Operaciones tienda, Contactos, Análisis, Sistema | Todos los módulos accesibles una sola vez; se mantienen permisos y enlaces | Publicado bccb55a7; verificado con la cuenta real |
| NAV-03 | Retirar identidad y salida inferiores | Mi cuenta sigue mostrando identidad y cerrar sesión; escritorio y móvil | Publicado bccb55a7; verificado con la cuenta real |
| NAV-04 | Configuración de navegación por usuario | Tamaño, modo inicial expandido/compacto, comportamiento y elección de módulo inicial persisten al recargar y cambiar de ordenador; URL explícita conserva prioridad | Publicado bccb55a7; verificado con la cuenta real |
| CFG-01 | Ampliar y ordenar Interfaz | Controles agrupados con vista previa, guardar/cancelar/restablecer claros; conservar todas las opciones | Pendiente |
| CFG-02 | Ampliar y ordenar Login | Logos/fondos legibles, contraseña visible/oculta, Enter, errores y recuperación comprobados; no exponer configuración privada | Pendiente |
| PER-01 | Zona personal ampliada | Notas propias persistentes, tareas propias, documentos e informes autorizados, avisos y preferencias | Implementado en revisión; faltan pruebas y publicación |
| PER-02 | Foto y configuración personal desde Administración | Administrador elige usuario; servidor valida permiso, usuario destino y revisión; cambios auditados sin cambiar permisos por editar perfil | Implementado en revisión; faltan pruebas y publicación |
| CHAT-01 | Chat como centro operativo | Mejoras concretas inventariadas tras revisar estado existente; no duplicar funciones ya construidas | Pendiente |
| CHAT-02 | Chat móvil | Canales/conversación, teclado, redacción, adjuntos, lectura, búsqueda y acciones utilizables a 320/390 px y en horizontal | Parcial: altura, teclado y posición publicados bccb55a7; resto pendiente |
| MOB-01 | Orden y navegación móvil general | Todas las pantallas implicadas sin desbordar la página; tablas conservan datos con desplazamiento o fichas; botones accesibles | Pendiente |
| VIS-01 | Fidelidad a Stitch | Comparación con referencia aprobada: estructura, jerarquía, espacios, colores, barra, cabecera y perfil; respetar preferencias personales | Pendiente |
| IA-01 | Pestaña Conexiones de IA | Proveedor/modelo/estado, prueba ficticia, cuotas/límites y desconexión; claves solo en servidor, nunca en repo, fuentes o navegador persistente | Pendiente |
| IA-02 | Usuario propio Gemini | Identidad diferenciada, permisos legítimos, revocación, registro de acciones y sin suplantar a un administrador | Pendiente |
| IA-03 | Cotejo de recepciones | Lectura de originales, equivalencias explícitas, unidades por paquete, discrepancias y guardado por procedimiento existente; no inventar coincidencias | Pendiente |
| IA-04 | Gastos completos | Original asociado, proveedor/importes/impuestos/categoría/tienda, duplicados, tratamiento interno y revisión fiscal; incertidumbre permanece pendiente | Pendiente |
| IA-05 | Consultas, facturas e informes | Solo datos autorizados, periodo y tienda explícitos, enlaces privados y exportación existente; sin inventar cifras | Pendiente |
| TEL-01 | Bot de Telegram | Token seguro, webhook autenticado, usuarios vinculados/autorizados, idempotencia, respuestas y documentos privados; acciones mutables identificadas y auditadas | Pendiente: bot y autorización externa |
| QA-01 | Playwright y pruebas | Ya existe Playwright en pruebas; ampliar recorridos de lo modificado con sesiones/roles distintos, fallos, recarga y móvil/PC; no sustituye reglas de servidor | Existente; ampliar |

## Condiciones externas verificadas

- Playwright es una herramienta de pruebas del navegador, no almacenamiento ni identidad de IA: https://playwright.dev/docs/intro
- Telegram admite webhooks HTTPS y secret_token: https://core.telegram.org/bots/api#setwebhook
- Google exige revisar condiciones y región antes de activar un cliente Gemini. Los términos consultados el 01/11/2026 indican en Use Restrictions que los clientes disponibles para usuarios del EEE requieren Paid Services. Paid Services para la API significa proyecto asociado a facturación activa; por tanto no se puede prometer este despliegue como API gratuita sin facturación: https://ai.google.dev/gemini-api/terms
- No se activa facturación, no se contrata alojamiento ni se transmite contabilidad a una IA durante preparación.
- Una API gratuita tiene cuotas y condiciones; no se presenta Claude ni cualquier proveedor como gratuito sin comprobación oficial.
- La prueba ficticia de conexión existente no demuestra cotejo, alta de gasto ni ejecución autónoma.

## Orden de ejecución

1. Navegación y sus preferencias, sin tocar contabilidad.
2. Zona personal y administración de perfiles.
3. Configuración y fidelidad visual, Chat y móvil.
4. Conexiones y agente con ensayos ficticios; activación real solo con condiciones y credenciales resueltas.
5. Recorridos completos afectados y entrega final con estado real, sin afirmar ausencia universal de fallos.

## Ampliación del perfil en revisión

- Notas en el JSON del perfil existente: copias y recuperación mantienen el formato; no hay tabla adicional.
- Lectura conservada por las políticas existentes: propio perfil y gestión autorizada.
- Edición administrativa de nombre visible, teléfono, foto y notas, manteniendo la identidad del administrador en la auditoría y el rol del destinatario.
- Revisión optimista por perfil; los clientes antiguos que no envían notas las conservan.
- Documentos personales consultados al abrir la sección, aunque se entre desde Configuración; tareas por usuario y mes e informes mediante los módulos autorizados.
