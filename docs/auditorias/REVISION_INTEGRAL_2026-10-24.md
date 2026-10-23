# Revisión integral · 24/10/2026
## Lista de trabajo
1. Auditoría de código y pruebas transversales: en curso.
2. Formato de Recepciones: preparado en rama, pendiente de comprobación.
3. Corrección de Enter en búsqueda de Recepciones y Biblioteca: preparada, pendiente de pruebas.
4. Pricing: código original localizado en OneDrive. Sus datos se leían de una base antigua que no aparece en la conexión actual. No se inventan datos como si fueran originales.
5. Pruebas desde ChatGPT convencional: pendientes; no equivalen a probar conectores aquí.
6. Código y manuales: índice ENTREGA_FUENTES.md preparado.
7. Copia final y recuperación temporal: pendientes tras publicación.

## Cambios y límites
Se conservan navegación, tarjetas, estructura contable y datos. Se ajustan estilos locales de Recepciones y Enter aplica los filtros mediante el mismo botón y permisos. Antes no tenía ninguna acción conectada.
Base: cad4440f5834e923d2fa0342c8f087fad47edede.
La copia previa fue verificada con recuperación temporal de 42 tablas y 63 relaciones, sin restauración real.
Los avisos Supabase se revisan por su función: las tablas de servicio sin políticas cliente están cerradas intencionadamente; los RPC privilegiados deben comprobar identidad y permisos. No se borran índices solo por no acumular uso.
La protección de contraseñas filtradas aparece desactivada en el proyecto gratuito. No se afirma que esté activada.
Una batería correcta no garantiza ausencia futura de errores. El informe final debe distinguir flujos ejecutados y pendientes. No se crean asientos ficticios en producción.
