# Configuración visual y avisos de Chat

## Uso

- **Configuración**, debajo de Administración, contiene **Interfaz** y **Login · acceso**. Recupera los controles visuales de la referencia TotusFlow: marca, colores, densidad, tamaños, bordes, sombras, caja de acceso, tipografía, fondos e imágenes.
- Cambiar un control modifica únicamente la vista previa. **Guardar** aplica el cambio a la organización; **Descartar cambios** recupera lo guardado. Restaurar valores iniciales y aplicar un estilo también requieren guardar.
- Solo administración puede guardar. Configuración utiliza los permisos existentes de Administración. No crea roles ni modifica contraseñas, fiscalidad o permisos.
- Los textos y las imágenes de Login son públicos: se muestran antes de entrar. No subir facturas, información personal ni documentos privados como fondo o logotipo.
- **Chat → rueda dentada → Fondo, sonido y avisos** contiene las preferencias personales. Cada usuario elige fondo, imagen, sonido y volumen de 0 a 100 %. Los cambios se conservan en su cuenta para otros ordenadores.
- **Probar sonido** permite escuchar el tono al volumen seleccionado y desbloquea el audio del navegador. El volumen del equipo también influye. Los avisos de escritorio requieren autorización en cada navegador.
- **Zumbido**, junto a las herramientas de escritura, envía un mensaje visible en la conversación principal. No borra ni envía el texto que se esté preparando. Se permite un zumbido cada 30 segundos por emisor, también al cambiar de canal.
- Los receptores que tengan sonido habilitado oirán un aviso distinto. Se respetan silencio, Solo menciones y permisos. Si un canal está en Solo menciones, un zumbido general no fuerza una notificación.
- El chat debe permanecer abierto en un navegador compatible. Esto no incorpora notificaciones push con la aplicación cerrada ni activa automáticamente a ChatGPT.

## Mantenimiento técnico

- `appearance-core.js`: inventario y validación de los 25 controles de Interfaz y 24 de Login, estilos iniciales y variables CSS.
- `appearance-ui.js` / `appearance.css`: editor con vista previa, guardado, control de revisión y adaptación móvil. `app.js` conserva las funciones de autenticación originales.
- `chat-preferences.js`: preferencias validadas, fondos y reducción de imágenes JPG/PNG/WebP. No se permite SVG ni URLs arbitrarias. Tamaño original máximo 5 MB; imagen reducida hasta 350.000 caracteres.
- `chat-alerts.js`: sonidos sintetizados en el navegador, volumen y zumbido. No descarga sonidos externos ni contrata servicios.
- `chat-preference-transport.js`: caché efímera por sesión. El fondo solo se vuelve a transmitir cuando cambia su huella; el sondeo de avisos nunca descarga la imagen. La caché se borra al salir.
- Parche `029_chat_personalization.sql`: preferencias dentro de `profiles.ui_preferences.team_chat`; zumbido con autorización real, exclusión mutua, límite y reintento idempotente. El mensaje y el evento se guardan en las tablas de Chat ya existentes.
- Parche `030_visual_configuration.sql`: tres columnas opcionales en `ops_business_settings`: `appearance_config`, `login_appearance`, `appearance_revision`. El guardado solo acepta campos visuales conocidos, valida tipos y rangos y rechaza revisiones antiguas.
- Antes de autenticar solo se concede lectura de la columna `login_appearance` a `anon`; no puede leer el resto de ajustes, NIF ni datos fiscales. Se mantienen los permisos de usuarios autenticados.
- La configuración personal y global entra en las copias existentes mediante `profiles` y `ops_business_settings`. Las columnas nuevas son opcionales y se excluyen del hash contable de compatibilidad para conservar la restauración de copias anteriores. No se cambia el formato ni la retención de diez copias.
- El registro automático de cambios guarda los nombres de los campos modificados, sin duplicar las imágenes en el Log.
- Los logotipos de Hortimatic y NewOldSmok son recursos estáticos de marca en `assets/branding`. Las imágenes personalizadas se guardan en Supabase junto a los ajustes y en sus copias; no requieren archivos locales permanentes ni un bucket público de documentos.

## Validación

Pruebas puras de normalización, límites, inyección, volumen, sonidos, preferencias del notificador, caché y cambio de sesión. Pruebas de navegador para todos los controles, vista previa sin aplicación anticipada, guardado, compresión de imagen, permisos, descarte, zumbido y conservación del borrador. Tamaños 320, 390, 768, 1024, 1440 y 1920 px.

Pruebas SQL aisladas: anonimato restringido a la apariencia de Login, conservación de ajustes fiscales, rechazo de usuarios no administradores, revisión antigua, campos desconocidos, imágenes remotas, privacidad entre cuentas, límite del zumbido y ausencia de duplicados al reintentar. Se ejecutan antes de aplicar los parches en producción.
