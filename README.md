# Totus Central

Gestión diaria para Hortimatic y NewOldSmok: https://hortimatic.github.io/Totus-Central/

## Una producción
- Rama principal: totus-central.
- Supabase: awmojepsasikxocoeqtu, con datos, usuarios, permisos y programación.
- OneDrive: carpeta privada de aplicación, con originales y copias completas verificados.
- GitHub Pages: aplicación estática; /staging/ solo redirige a la raíz.
- No depende de un equipo encendido.

## Trabajo y cambios
Inicio, Pricing, Cajas, Gastos, Facturación, Recepciones, Documentos, Fiscalidad, Informes y Administración.
No alterar estructura, datos o cálculos sin explicar el cambio al titular. Las facturas originales, los pagos y el gasto fiscal son conceptos distintos; el histórico aceptado no se ajusta para forzar una coincidencia.

Para cambiar código, preparar una rama temporal, revisar y ejecutar las pruebas. .github/workflows/publish.yml repite la batería antes de publicar la revisión principal. Comprobar también la versión y los flujos autenticados. Eliminar la rama temporal integrada cuando haya terminado la validación.

## Recepciones
Alta con proveedor y documentos de ambos lados, filtros por rango de fechas, resultados descargables y biblioteca de equivalencias confirmadas. ChatGPT coteja con los conectores existentes y los textos de Supabase, sin API de IA de pago. No modifica existencias ni contabilidad.

## Manuales y montaje
- [Entrada para ChatGPT](RELEVO_CHATGPT_ONLINE.md).
- [Manual operativo y montaje de la instalación](docs/MANUAL_CHATGPT_ONLINE.md).
- [Trabajo diario](docs/GUIA_TRABAJO_DIARIO_CHATGPT.md).
- [Recepciones, biblioteca y conexiones](docs/COTEJOS_CHATGPT.md).
- [Copias por componentes](docs/COPIAS_POR_COMPONENTES.md).

El código incluye el historial de evolución SQL y las cuatro funciones utilizadas. No es todavía un instalador verificado desde una base vacía: una instalación comercial independiente requiere preparar y probar su esquema inicial y sus autorizaciones propias. El manual distingue ese trabajo futuro de la recuperación de esta instalación.

## Copias y privacidad
Copia completa diaria a las 00:35 Europe/Madrid; diez juegos ordinarios verificados, más los puntos de recuperación protegidos que correspondan. Cada juego incluye índice, datos, documentos en ZIP numerados y código publicado. Consultar COPIAS_POR_COMPONENTES.md para comprobar o restaurar. Las copias anteriores compatibles siguen siendo recuperables.
No exporta contraseñas ni sustituye una copia de infraestructura, Auth o Vault. No guardar datos privados, claves de servicio ni secretos de Microsoft en este repositorio.
