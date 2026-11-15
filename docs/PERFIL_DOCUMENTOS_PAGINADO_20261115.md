# Documentos del perfil: lectura limitada

Además, cada persona puede ocultar y volver a mostrar documentos de su lista en el dispositivo actual. El alcance local se indica en la pantalla; no se atribuye una sincronización entre dispositivos. Ocultar no borra el original, su autoría ni relaciones contables. La lista de IDs ocultos se separa por cuenta y no permite a un administrador cambiar la ocultación personal de otra cuenta. Se comprueban ocultación, reapertura, restauración y conservación del original con datos ficticios.

La ficha consulta 10, 20 o 50 metadatos por página mediante el cliente autenticado y las reglas RLS ya existentes. Lee un registro adicional para saber si hay siguiente página; no descarga archivos ni cuenta toda la tabla. Orden: fecha descendente e ID ascendente, igual que antes. Buscar consulta el nombre en el servidor, con comodines escritos por el usuario tratados literalmente; Limpiar devuelve la primera página. La escritura, autoría, ubicación y enlaces contables no cambian. Las respuestas tardías se descartan por petición, panel, cuenta y permisos actuales. Tiempo máximo de consulta: 20 segundos.

Pruebas locales: límite de lectura, páginas, búsqueda, autor ajeno, error de permiso, resultados vacíos y recorrido completo de perfil en cuatro anchuras. La comprobación real se registra después de publicar. No requiere migraciones, claves nuevas ni cambios en servicios.

Referencias: https://supabase.com/docs/reference/javascript/range y https://supabase.com/docs/reference/javascript/ilike .
