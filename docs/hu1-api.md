# Contrato de API — HU1 Registrar actividad física

Contrato compartido entre el frontend (Ahmed) y el backend (Álvaro) del módulo E2 de Healthy Life.
Cualquier cambio en este documento se acuerda entre ambos y se sube mediante Pull Request.

## Historia

> **HU1 — Registrar actividad física.** Como usuario de Healthy Life, quiero registrar la actividad física y los entrenamientos que realizo para llevar un seguimiento de mi nivel de actividad.

La duración y la intensidad **no** forman parte de HU1. Desde la **HU4** el campo `intensity` es obligatorio en este mismo endpoint: ver [hu4-api.md](hu4-api.md).

## Conexión

| Dato | Valor en local |
| --- | --- |
| URL base del backend | `http://localhost:3001` |
| Variable del frontend | `VITE_API_BASE_URL=http://localhost:3001` |
| Origen del frontend (Vite) | `http://localhost:5173` |
| CORS | Lo resuelve el **backend** (no hace falta proxy en Vite) |

## `POST /api/activities`

```http
POST /api/activities
Content-Type: application/json
```

### Solicitud

```json
{
  "activityType": "walking",
  "activityDate": "2026-10-09",
  "notes": "Caminata por el parque"
}
```

| Campo | Tipo | Obligatorio | Reglas |
| --- | --- | --- | --- |
| `activityType` | `string` | Sí | Uno de: `walking`, `running`, `cycling`, `gym`, `other` |
| `activityDate` | `string` | Sí | Fecha real en formato `YYYY-MM-DD` (se rechaza p. ej. `2026-02-30`). Sin hora ni zona horaria |
| `notes` | `string` | No | Máximo 500 caracteres. Vacío o solo espacios equivale a no enviarlo |

No se envía `userId`. Mientras no exista la integración con E1 (Gestión de usuarios), el backend asocia los registros a un usuario de prueba configurado (`DEMO_USER_ID`).

### Respuesta correcta — `201 Created`

```json
{
  "id": 1,
  "activityType": "walking",
  "activityDate": "2026-10-09",
  "notes": "Caminata por el parque",
  "createdAt": "2026-10-09T10:30:00.000Z"
}
```

- `id` y `createdAt` los genera el backend **después** de guardar en la base de datos.
- `createdAt` es fecha y hora en UTC (ISO 8601).
- Si no se enviaron notas, la respuesta incluye `"notes": null` (el campo siempre está presente).

### Datos inválidos — `400 Bad Request`

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "La fecha de la actividad no es válida."
  }
}
```

`message` está en español y puede mostrarse directamente al usuario. También se devuelve `400` si el cuerpo no es un JSON válido.

### Otros errores

Todos los errores usan el mismo formato `{ "error": { "code", "message" } }`:

| Código HTTP | `code` | Cuándo |
| --- | --- | --- |
| `404` | `NOT_FOUND` | Ruta de la API inexistente |
| `413` | `PAYLOAD_TOO_LARGE` | Petición de más de 10 KB |
| `500` | `INTERNAL_ERROR` | Error inesperado (sin detalles internos) |

Si no llega respuesta, es un **error de red** (backend apagado o URL incorrecta): el frontend debe distinguirlo de los anteriores y no mostrar nunca «guardado correctamente» sin un `201`.

## Endpoints auxiliares (no forman parte de HU1)

| Endpoint | Para qué |
| --- | --- |
| `GET /api/activities` | Lista las actividades del usuario de prueba, de la más reciente a la más antigua. Sirve para comprobar que se ha guardado |
| `GET /api/health` | Devuelve `{ "status": "ok" }` si el backend está arrancado |

## Persistencia

Los registros se guardan en **SQLite** (`backend/data/healthy-life-e2.db`, generado automáticamente y excluido de Git). El frontend nunca accede a la base de datos directamente.
