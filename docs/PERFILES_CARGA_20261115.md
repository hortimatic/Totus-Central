# Carga de perfiles y preferencias

La revisión real del 14/11 detectó un tiempo agotado de profiles al navegar a Clientes. No se ocultó el error ni se amplió el tiempo máximo del servidor. La medición de la respuesta completa de 16 perfiles suma 1.662.184 bytes; identidad y ficha de cuenta suman 154.600 bytes en esa muestra. Es volumen, no una medición de reducción de latencia.

El directorio común lee identidad, rol, estado, fechas y account:ui_preferences->account. No descarga los estilos guardados, imágenes de fondo del chat ni distribuciones de todos los demás usuarios. La cuenta de administración conserva el acceso que ya tuviera a las fichas personales; no se amplían las políticas ni los permisos.

El usuario actual mantiene sus preferencias completas. Durante el arranque se reutiliza únicamente su lectura autenticada del mismo arranque. Al refrescar o navegar se vuelve a consultar su perfil concreto. No se utiliza updated_at para decidir si se reutilizan preferencias: los procedimientos actuales no actualizan ese campo de manera uniforme y no hay un trigger que lo garantice. Así no se congelan estilos o cambios realizados desde otra sesión.

readProfileDirectory no modifica el estado compartido durante las peticiones. loadCore sigue verificando usuario y generación antes de publicar resultados. Un error de lectura sigue siendo visible y recuperable; no se sustituye por datos antiguos ni se declara resuelto todo timeout por reducir bytes.

Pruebas dirigidas: directorio reducido, estilos propios conservados, edición de cuenta administrativa, lectura fresca en posteriores consultas, cambio de identidad, perfil ausente y propagación de errores. La batería de recorridos de estabilidad comprueba además navegación, cuenta, temas, productos, gastos, documentos y permisos. La verificación en producción se registra después de publicar.
