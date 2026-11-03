# Correcciones de la auditoría funcional

Este registro distingue código corregido de publicación y cambios pendientes.
La auditoría fechada conserva sus observaciones originales; este documento recoge su tratamiento.

| Hallazgo | Actuación preparada | Criterio de cierre |
|---|---|---|
| F-01 Arranque | Cliente oficial 2.118.0 local, archivo y licencia verificados por SHA512; arranque ordenado y recuperación sin borrar sesión. | Pruebas de corte externo, fallo local y reintento; CI y publicación exacta. |
| F-05 CSV | Una protección común para exportaciones normales y del agente; espacios y controles antes de fórmulas cubiertos; negativos numéricos conservados. | Regresión de documentos/CSV y actualización del servicio IA que comparte el módulo. |
| F-04 Historial técnico | Parche 060: 30 días de éxitos y 90 de fallos; máximo 20.000 eliminaciones por ejecución; conserva estados activos/desconocidos y todo el Log de negocio. | Base desechable, aplicación autorizada y verificación de programación. |
| F-06 Privilegios | Parche 060: retirar TRUNCATE/TRIGGER/REFERENCES de clientes y de futuras tablas creadas por postgres; conserva DML y RLS. | Prueba de aislamiento y comprobación de privilegios después de aplicar. Las políticas permisivas históricas requieren revisión separada. |
| F-07 Rendimiento | Parche 060: seis índices de claves externas y JWT evaluado una vez por consulta en dos políticas, sin cambiar sus condiciones. | CI SQL, índices válidos y asesores tras aplicación. No sustituye una revisión medida de loadCore. |
| F-11 Dependencias | package.json y lockfile con versiones exactas; todos los flujos npm usan instalación reproducible. SDK sin CDN crítico. | Instalación limpia y CI completo. |
| F-02/F-08 Migración y recuperación | Inventario y plan de migración incluidos en la auditoría. | Sigue pendiente un montaje vacío y recuperación de infraestructura en un destino aislado; no se acredita con documentos. |
| F-03 GitHub | Protección de rama identificada como ausente. | Configurar y comprobar reglas sin impedir las publicaciones legítimas. |
| F-09/F-10 IA | Capacidades y límites reales identificados. | Adaptadores y cotejos completos por proveedor comprobados; no se cierran cambiando solo roles o mensajes. |
| F-12 Relevo | README actualizado a siete servicios; documentación técnica de operación y migración. | Reconciliar entrada operativa y configuración de cada destino. |
| F-13 Orden | Archivos generados excluidos; ramas inventariadas. | Retirar únicamente ramas confirmadas como integradas y conservar trabajo único. |
| F-14 Contraseñas | Hallazgo registrado. | Verificar disponibilidad en el plan actual; no activar gastos. |

## Verificación inicial

- Playwright aislado: acceso sin CDN, error recuperable ante SDK local inaccesible y reintento conservando almacenamiento.
- Pruebas CSV: cuatro prefijos de fórmula con siete combinaciones de espacios/controles en los tres puntos de exportación; comillas, acentos, saltos y negativos.
- Construcción real de publicación: identidad compartida de módulos, versión cargada y contrato de producción.
- Dependencias: instalación limpia con `npm ci --ignore-scripts --no-audit --no-fund`.
- Parche SQL: el flujo de CI lo aplica dos veces a una base desechable y comprueba retención acotada, reanudación, privilegios y aislamiento.

No se ha modificado contabilidad ni se han ejecutado cotejos reales adicionales para producir estos resultados.
