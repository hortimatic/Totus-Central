# Identidad y acceso de IA a Recepciones

Todos los procedimientos de Recepciones usan el mismo control de actor. La cuenta debe estar activa y disponer del permiso correspondiente de Documentos. Una cuenta de gerencia con esos permisos no necesita convertirse en administradora solo por trabajar desde un conector.

## ChatGPT convencional con Supabase conectado

1. Identificar la cuenta propia acordada con el administrador. No usar el correo de otro usuario ni inventar uno.
2. Si se utiliza el puente autenticado, comprobar `private.totus_assistant_submit('session_check','{}')` y recoger su resultado con `private.totus_assistant_result`. Ejecutar después las operaciones a través del mismo puente: la sesión propia aporta el actor.
3. Si se utiliza directamente el conector administrativo de Supabase, aportar `p_actor_email` con esa cuenta activa en `totus_stock_context`, `totus_stock_save_result` y los demás procedimientos que lo admiten. El servidor comprueba sus permisos reales. No sustituir la cuenta por la de Diego para superar un error.
4. Leer y verificar los dos originales, cotejar todas sus líneas y guardar mediante el procedimiento normal. Releer después. Una lectura directa de tablas no acredita que se pueda guardar ni que el cotejo esté terminado.

Una cuenta eliminada definitivamente no se puede recuperar ni conserva sus credenciales. Administración puede crear una cuenta nueva con el mismo correo desde Nuevo usuario; se asignan el rol y datos del alta nueva, sin recuperar permisos individuales, fotografía ni contraseña anteriores. Una cuenta que solo está en Usuarios eliminados se recupera desde allí. Crear una cuenta manual no configura por sí solo las credenciales de un puente técnico: no confundir ese alta con una comprobación completa del puente.

Las conexiones del gestor de APIs ejecutan las acciones con su usuario asignado. Los permisos de Totus no amplían la cuota del proveedor. La validación completa debe incluir una operación real autorizada y su relectura; una prueba de conexión mínima no basta.
