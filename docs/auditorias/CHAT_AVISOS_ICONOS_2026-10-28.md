# Chat: sonido, escritorio e iconos · 28/10/2026

## Uso

- Chat → **Sonido y avisos**: activar o desactivar sonido y notificaciones de escritorio por separado, probar y guardar. Se conserva en la cuenta en Supabase; no se guardan preferencias ni mensajes en disco local.
- Cada navegador/equipo necesita permiso de notificaciones. Si se rechaza, cambiarlo desde los permisos del sitio. Windows puede ocultar avisos con No molestar. El mensaje de prueba confirma el envío al navegador; no puede comprobar el volumen físico ni la configuración de Windows.
- El sonido requiere interacción con la página: pulsar Probar sonido o interactuar con Totus después de entrar. El navegador puede suspender el audio o la pestaña.
- Se comprueban avisos cada 30 segundos también en segundo plano. La suspensión del dispositivo o la limitación de pestañas del navegador puede retrasarlos. No hay push con la aplicación cerrada, coste de API ni automatización de ChatGPT.
- Se respetan los canales silenciados, las menciones y la pertenencia a los canales. No se anuncian mensajes anteriores al inicio, mensajes propios ni la conversación visible al final. Un lote produce un solo sonido; hasta cinco notificaciones, sin mostrar el contenido del mensaje en Windows.
- **Nuevo canal / Configurar → Icono del canal**: elegir icono, cambiarlo o Sin icono. El icono se conserva como prefijo del nombre compartido, de modo que el equipo y ChatGPT ven el mismo nombre sin crear otro canal. Configurar requiere ser responsable con permiso de edición. Los nombres existentes no se modifican automáticamente.

## Implementación y comprobaciones

- `src/chat-alerts.js`: audio generado sin descarga, permiso explícito por gesto, entrega con contenido genérico, controles de sesión y cierre de avisos antiguos. `chat-api.js` mantiene la exportación anterior.
- Preferencias booleanas `sound_enabled` y `desktop_enabled` dentro del `team_chat` existente. El parche 024 conserva autenticación, bloqueo de escritura y alcance del perfil. No añade tablas, permisos o columnas y no cambia datos contables.
- El ajuste general de escritorio tiene prioridad; cuando aún no existe se conserva la opción de escritorio anterior por canal.
- Pruebas de lógica: segundo plano, desactivación, permisos rechazados, arranque sin avisos antiguos, repetición, conversación visible, cambio de cuenta, cierre de sesión con solicitud en vuelo, audio e iconos.
- Pruebas de interfaz: guardar/recuperar/desactivar preferencias, probar sonido y aviso, explicación de permiso rechazado, añadir/quitar icono compartido y formularios a 320, 390, 768, 1024, 1440 y 1920 píxeles.
- Regresión de Chat: crear, editar, archivar, retirar, hilos, miembros, búsquedas, borradores, tareas, reacciones y adjuntos; nueve anchos de pantalla. Sin mensajes ficticios en producción.

Referencia del permiso y límites de navegador: https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API
