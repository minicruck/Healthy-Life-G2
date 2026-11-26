# HU7 — Edición y eliminación de actividades

La identidad del usuario se obtiene del servidor (`DEMO_USER_ID`), igual que en HU1 y HU6. No se permite seleccionar otro usuario desde el cuerpo de la petición.

## PATCH /api/activities/:id

Recibe los campos editables completos: `activityType`, `activityDate` y `notes` (opcional; `null` o texto vacío elimina las observaciones). Usa las validaciones de HU1. Devuelve `200` con el registro actualizado, conservando `id` y `createdAt`. Puede incluir `intensity` (`low`, `moderate` o `high`) para corregirla. Si se omite, conserva la intensidad existente; los registros anteriores a HU4 pueden seguir sin intensidad. Un valor explícito no válido, incluido `null`, se rechaza. La actividad y su intensidad se actualizan en una transacción.

## DELETE /api/activities/:id

Elimina exclusivamente el registro indicado del usuario configurado y devuelve `204` sin cuerpo. Si existe una fila dependiente de intensidad de HU4, se elimina en la misma transacción.

Ambas operaciones devuelven `400 VALIDATION_ERROR` si el identificador o los datos no son válidos y `404 NOT_FOUND` si el registro no existe o pertenece a otro usuario. Los errores de servidor siguen el contrato general de la API.

El historial se consulta de nuevo tras confirmar la operación. HU8 calcula los días distintos de actividad desde SQLite al consultar `/api/training-goal`, por lo que no es necesario mantener contadores duplicados.
