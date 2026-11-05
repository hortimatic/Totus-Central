# Mis estilos de interfaz

En Configuración → Interfaz, «Mis estilos» guarda una copia con nombre de la vista previa en el perfil de la cuenta. Incluye los ajustes visuales, la navegación y las imágenes. Se conserva entre sesiones y equipos; no cambia el Login compartido ni las preferencias de otras cuentas.

- **Guardar como nuevo** crea una copia independiente del diseño de la vista previa.
- **Cargar en vista previa** permite revisarlo antes de aplicarlo.
- **Aplicar y guardar mi interfaz** sigue siendo la acción que cambia la apariencia activa.
- **Actualizar guardado** reemplaza la copia elegida, tras confirmar.
- **Renombrar** cambia solo su nombre; los nombres no se pueden repetir dentro de una cuenta.
- **Eliminar estilo** retira esa copia, tras confirmar, sin cambiar la apariencia que está aplicada.

Los estilos iniciales reemplazan sus parámetros visuales completos: no arrastran el brillo, grosor de borde, dimensiones ni fondo de imagen del estilo anterior. Conservan identidad, logotipo, orden de navegación y módulo de arranque personales. «Azul compacto» es una base visual, no una reproducción completa de las pantallas de Stitch.

El parche 067 añade una única operación de biblioteca, usando el mismo permiso personal de Configuración y el validador existente. No cambia tablas, permisos de módulos, funciones de guardado anteriores ni datos de negocio. El control de revisión evita que dos ventanas sobrescriban la biblioteca sin advertencia. El tamaño total se limita a 6 MB para evitar cargar imágenes ilimitadas en cada arranque.

Pruebas dirigidas: estilos iniciales completos; creación sin aplicación; cargar y aplicar; recarga; renombrar, actualizar y eliminar; aislamiento entre cuentas; móvil y escritorio; validación de campos y concurrencia de biblioteca en base de datos desechable.
