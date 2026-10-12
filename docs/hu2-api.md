# Contrato de API — HU2 Registrar horas de sueño

Contrato compartido entre el frontend y el backend del módulo E2 de Healthy Life.
Cualquier cambio en este documento se acuerda entre ambos y se sube mediante Pull Request.
Referencia Jira: **SCRUM-2**.

## Historia

> **HU2 — Registrar horas de sueño.** Como usuario de Healthy Life, quiero registrar las horas que duermo para llevar un seguimiento de mis hábitos de descanso.

HU2 permite crear y editar descansos individuales con fecha, horas y tipo, consultar el historial y obtener estadísticas por registro y por día. No incluye calidad del sueño, observaciones, objetivos, borrado ni autenticación.

## Conexión

| Dato | Valor en local |
| --- | --- |
| URL base del backend | `http://localhost:3001` |
| Variable del frontend | `VITE_API_BASE_URL=http://localhost:3001` |
| Origen del frontend (Vite) | `http://localhost:5173` |
| CORS | Lo resuelve el **backend** (no hace falta proxy en Vite) |

Se utiliza la misma aplicación y configuración que HU1. El calendario de HU2 toma **Europe/Madrid** como referencia fija en frontend y backend, independientemente de la zona del navegador, Node o Docker. No requiere variables nuevas ni cambios en Compose.

`sleepDate` representa el día asignado al descanso, sin hora ni zona horaria. Se compara con el día actual de Madrid, sin convertir la fecha de sueño a UTC. `createdAt`, en cambio, representa un instante y continúa expresándose en UTC. El servidor es la autoridad final para validar el día actual.

## `POST /api/sleep`

```http
POST /api/sleep
Content-Type: application/json
```

### Solicitud

```json
{
  "sleepDate": "2026-10-10",
  "hoursSlept": 7.5,
  "sleepType": "night"
}
```

| Campo | Tipo | Obligatorio | Reglas |
| --- | --- | --- | --- |
| `sleepDate` | `string` | Sí | Fecha real del calendario gregoriano en formato `YYYY-MM-DD`, con año entre `0001` y `9999`, no posterior al día actual en `Europe/Madrid`. Se rechaza p. ej. `2026-02-30`. Sin hora ni zona horaria |
| `hoursSlept` | `number` | Sí | Número finito, mayor que `0` y menor o igual que `24`. Se admiten decimales, como `7.5`; no se admiten cadenas como `"7.5"` |
| `sleepType` | `string` | Sí en la interfaz; omisible en POST por compatibilidad | Uno de: `night` (Sueño nocturno), `nap` (Siesta), `other` (Otro) |

La interfaz actualizada exige seleccionar un tipo. Para clientes antiguos, **omitir** `sleepType` en el POST guarda un registro con tipo `null`; enviarlo explícitamente como `null`, cadena vacía o cualquier valor ajeno al catálogo devuelve `400`. No se presupone que un registro sin tipo sea sueño nocturno.

Se admiten varios registros del mismo usuario en una fecha, incluidas varias siestas, conservando sus identificadores individuales. No se impone unicidad por fecha ni un límite de 24 horas al total diario; el límite de 24 se aplica a cada registro.

No se envía `userId`. Mientras no exista la integración con E1 (Gestión de usuarios), el backend asocia los registros al mismo usuario de prueba configurado (`DEMO_USER_ID`) que utiliza HU1.

### Respuesta correcta — `201 Created`

```json
{
  "id": 1,
  "sleepDate": "2026-10-10",
  "hoursSlept": 7.5,
  "sleepType": "night",
  "createdAt": "2026-10-11T08:30:00.000Z"
}
```

- `id` y `createdAt` los genera el backend **después** de guardar en la base de datos.
- `createdAt` es fecha y hora en UTC (ISO 8601).
- `sleepDate` conserva el día enviado, sin conversiones de zona horaria; `hoursSlept` se devuelve como número.
- `sleepType` siempre está presente en las respuestas: `night`, `nap`, `other` o `null`. El frontend presenta `null` como **Sin clasificar**.

### Datos inválidos — `400 Bad Request`

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Las horas de sueño no son válidas."
  }
}
```

`message` está en español y puede mostrarse directamente al usuario. También se devuelve `400` si el cuerpo no es un JSON válido.

Las fechas futuras se rechazan tanto al crear como al editar:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "No puedes registrar horas de sueño para una fecha futura."
  }
}
```

### Otros errores

Todos los errores usan el mismo formato `{ "error": { "code", "message" } }`:

| Código HTTP | `code` | Cuándo |
| --- | --- | --- |
| `404` | `NOT_FOUND` | Ruta inexistente o registro no disponible para el usuario al editar |
| `413` | `PAYLOAD_TOO_LARGE` | Petición de más de 10 KB |
| `500` | `INTERNAL_ERROR` | Error inesperado (sin detalles internos) |

Si no llega respuesta, es un **error de red** (backend apagado o URL incorrecta): el frontend debe distinguirlo de los anteriores. Solo se confirma una creación después de un `201` válido y una edición después de un `200` válido. POST y PATCH no se reintentan automáticamente: perder la respuesta no demuestra que la operación no se haya guardado.

## `PATCH /api/sleep/:id`

Actualiza un registro existente del usuario configurado. Se ha elegido un **PATCH con representación completa de los tres campos editables**, no una modificación parcial del cuerpo.

```http
PATCH /api/sleep/1
Content-Type: application/json
```

### Solicitud

```json
{
  "sleepDate": "2026-10-10",
  "hoursSlept": 1.5,
  "sleepType": "nap"
}
```

Los tres campos son obligatorios y siguen las reglas del POST, excepto que aquí **no se permite omitir `sleepType`**. Un registro histórico sin clasificar debe recibir `night`, `nap` u `other` al editarlo. Si conserva una fecha futura, también debe corregirse antes de guardar.

El identificador de la ruta debe ser un entero positivo dentro del rango seguro de JavaScript. El servidor obtiene la identidad mediante `DEMO_USER_ID`; el cliente no puede cambiar `userId`, `id` ni `createdAt`.

### Respuesta correcta — `200 OK`

```json
{
  "id": 1,
  "sleepDate": "2026-10-10",
  "hoursSlept": 1.5,
  "sleepType": "nap",
  "createdAt": "2026-10-11T08:30:00.000Z"
}
```

Se conserva el `id` y el `createdAt` originales. La actualización usa SQL parametrizado con identificador y usuario; no crea otra fila. Cambiar la fecha mueve el registro de grupo en las consultas y cálculos del frontend, sin eliminarlo.

### Errores de edición

| Código HTTP | `code` | Cuándo |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Identificador inválido, campo obligatorio ausente, tipo no permitido, fecha inexistente o futura, horas fuera de rango o JSON incorrecto |
| `404` | `NOT_FOUND` | El identificador no existe o pertenece a otro usuario; ambos casos usan el mismo error |
| `413` | `PAYLOAD_TOO_LARGE` | Petición de más de 10 KB |
| `500` | `INTERNAL_ERROR` | Error inesperado, sin detalles internos |

Todos mantienen la estructura `{ "error": { "code", "message" } }`. La cancelación de un formulario antes del envío no realiza un PATCH. Una solicitud ya enviada podría haberse aplicado aunque el cliente pierda la conexión; por eso el frontend no anuncia una reversión ni reintenta la escritura automáticamente.

## Consulta de registros y salud

| Endpoint | Para qué |
| --- | --- |
| `GET /api/sleep` | Lista los registros de sueño del usuario configurado para el historial, la edición y las estadísticas |
| `GET /api/health` | Devuelve `{ "status": "ok" }` si el backend está arrancado |

`GET /api/sleep` devuelve `200 OK` con un array de registros con la misma estructura que la respuesta del POST, sin `userId`. Devuelve `[]` si ese usuario no tiene registros. El orden es por fecha de sueño descendente y, para una misma fecha, por identificador descendente (`ORDER BY sleep_date DESC, id DESC`). Solo se devuelven los registros asociados al usuario configurado.

```json
[
  {
    "id": 1,
    "sleepDate": "2026-10-10",
    "hoursSlept": 7.5,
    "sleepType": null,
    "createdAt": "2026-10-11T08:30:00.000Z"
  }
]
```

La lectura mantiene los registros históricos sin tipo o con fechas futuras; no se corrigen ni se eliminan automáticamente. Las fechas futuras históricas se muestran en **Todo el historial** y se excluyen de los filtros de últimos 7 o 30 días. Todos los registros devueltos incluyen `sleepType`, aunque sea `null`.

## Persistencia

Los registros se guardan en **SQLite**, en el mismo archivo de HU1 (`backend/data/healthy-life-e2.db`, generado automáticamente y excluido de Git). `sleep_records` contiene:

| Campo | Tipo SQLite | Uso |
| --- | --- | --- |
| `id` | `INTEGER PRIMARY KEY AUTOINCREMENT` | Identificador del registro |
| `user_id` | `TEXT NOT NULL` | Usuario asociado por el backend |
| `sleep_date` | `TEXT NOT NULL` | Día en formato `YYYY-MM-DD` |
| `hours_slept` | `REAL NOT NULL` | Horas de sueño, incluidos decimales |
| `created_at` | `TEXT NOT NULL` | Fecha y hora de creación en UTC |
| `sleep_type` | `TEXT` | `night`, `nap`, `other` o `NULL` para datos sin clasificar |

La migración consulta `PRAGMA table_info(sleep_records)` y ejecuta `ALTER TABLE sleep_records ADD COLUMN sleep_type TEXT` únicamente cuando la columna no existe. Funciona en instalaciones nuevas y bases anteriores; repetir el arranque no vuelve a añadir la columna. Los valores existentes de `id`, usuario, fecha, horas y creación permanecen intactos; las filas anteriores quedan con `sleep_type = NULL`.

No se recrea la tabla, no se modifica `activities`, no se fusionan filas ni se añade unicidad por fecha. El volumen Docker se conserva. El frontend nunca accede a SQLite directamente.

## Cálculos del frontend

El cliente agrega los datos confirmados por GET por `sleepDate`, sin modificar las filas persistidas. Cada grupo conserva el detalle de los registros y suma sus horas, con subtotales de Sueño nocturno, Siesta, Otro y Sin clasificar. No se generan días sin datos ni se deducen horas de inicio o fin.

- **Media por registro:** total de horas / número de registros individuales.
- **Media diaria:** total de horas / número de fechas distintas con registros.
- **Total diario:** suma de todos los registros de una fecha, incluso si supera 24 horas.

Los filtros utilizan hoy en `Europe/Madrid`: últimos 7 días incluye desde hoy menos 6 hasta hoy; últimos 30, desde hoy menos 29 hasta hoy. Ambos excluyen fechas futuras. Todo el historial conserva también fechas futuras antiguas. El mismo conjunto filtrado alimenta métricas, ambas gráficas, tabla y desglose diario. Los cambios de horario de verano/invierno no cambian la fecha asignada a un registro.
