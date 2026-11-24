# Contrato de API — HU4 Registrar intensidad del entrenamiento

Jira: **SCRUM-5** (épica SCRUM-98 · Gestión avanzada de actividades). Sprint 3.
Amplía el contrato de [HU1](hu1-api.md): **no hay endpoints nuevos**, se añade el campo `intensity` a `POST /api/activities` y a `GET /api/activities`.

## Historia

> **HU4 — Registrar intensidad del entrenamiento.** Como usuario de Healthy Life, quiero clasificar mis entrenamientos por el nivel de intensidad notado durante este.

| Criterio | Cómo se cumple |
| --- | --- |
| **CA1** Seleccionar nivel de intensidad | El formulario de actividad tiene un selector obligatorio de 3 niveles. El backend guarda la intensidad junto a la actividad en la misma transacción y la devuelve en el `201`. |
| **CA2** Consultar intensidad en el detalle | `GET /api/activities` devuelve `intensity` y el historial (HU6) la muestra en cada registro ("Intensidad alta", etc.). |
| **CA3** Validación de selección | Sin intensidad el frontend no envía la petición, marca el campo y lleva el foco a él. Si un cliente la envía igualmente, el backend responde `400 VALIDATION_ERROR` y no guarda nada. |

## Niveles de intensidad

| Valor (API) | Texto en pantalla | Ayuda que ve el usuario |
| --- | --- | --- |
| `low` | Baja | Suave: podías hablar sin esfuerzo. |
| `moderate` | Moderada | Exigente, pero a un ritmo cómodo. |
| `high` | Alta | Muy exigente: te costaba hablar. |

Se eligen **tres niveles** porque la historia pide la intensidad *notada* (percibida), no una medida fisiológica: tres opciones con una pista de "prueba del habla" se eligen rápido y sin ambigüedad. Los valores de la API van en inglés, como `activityType`; los textos en español solo existen en el frontend.

## `POST /api/activities`

```json
{
  "activityType": "running",
  "activityDate": "2026-11-20",
  "intensity": "high",
  "notes": "Series en la pista"
}
```

| Campo | Tipo | Obligatorio | Reglas |
| --- | --- | --- | --- |
| `intensity` | `string` | **Sí** (nuevo en HU4) | Uno de: `low`, `moderate`, `high`. Distingue mayúsculas. |

El resto de campos no cambia (ver [hu1-api.md](hu1-api.md)).

### Respuesta `201 Created`

```json
{
  "id": 12,
  "activityType": "running",
  "activityDate": "2026-11-20",
  "notes": "Series en la pista",
  "intensity": "high",
  "createdAt": "2026-11-20T18:04:11.512Z"
}
```

El frontend solo confirma el registro si la respuesta trae **la misma** intensidad que envió.

### Respuesta `400 Bad Request` (CA3)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Selecciona una intensidad válida. Valores permitidos: low, moderate, high."
  }
}
```

Se devuelve si `intensity` falta, es `null`, está vacía, no es texto o no es uno de los tres valores. No se guarda ninguna fila.

## `GET /api/activities`

Cada elemento incluye ahora `intensity`:

```json
[
  { "id": 12, "activityType": "running", "activityDate": "2026-11-20", "notes": null, "intensity": "high", "createdAt": "2026-11-20T18:04:11.512Z" },
  { "id": 3, "activityType": "walking", "activityDate": "2026-10-09", "notes": "Paseo", "intensity": null, "createdAt": "2026-10-09T10:30:00.000Z" }
]
```

`intensity: null` solo aparece en actividades registradas **antes** de la HU4. No se les inventa un nivel; el historial muestra "Intensidad sin registrar".

## Persistencia

Tabla nueva, relación 1:1 con `activities`:

```sql
CREATE TABLE IF NOT EXISTS activity_intensity (
  activity_id INTEGER PRIMARY KEY REFERENCES activities(id),
  intensity   TEXT    NOT NULL CHECK (intensity IN ('low', 'moderate', 'high'))
);
```

- **Por qué una tabla aparte y no una columna nueva en `activities`:** la migración es puramente aditiva. La tabla `activities` de HU1 no cambia de esquema ni de filas, y así se siguen cumpliendo las pruebas de migración de HU2 que lo comprueban.
- La actividad y su intensidad se insertan en **una transacción**: o se guardan las dos o ninguna.
- El `CHECK` es una segunda barrera: aunque alguien se saltara la validación del servidor, la base de datos no admite otro valor.
- Las consultas usan `LEFT JOIN`, por eso los registros antiguos salen con `intensity: null`.

## Impacto en otras historias

- **HU1:** el formulario gana el campo *03 Intensidad del entrenamiento* (las observaciones pasan a ser el *04*). Sus pruebas se han actualizado para enviar la intensidad.
- **HU6 (historial):** muestra la intensidad en cada registro.
- **HU8 (objetivo semanal):** no cambia. Sigue contando días con actividad; solo se han añadido intensidades a los datos de sus pruebas.
- **Otros equipos:** ningún equipo vecino consume `POST /api/activities`. Si en el futuro alguno lo hiciera, tendría que enviar `intensity`.

## Pruebas

| Dónde | Qué cubre |
| --- | --- |
| `backend/tests/intensity.test.ts` | CA1 con los 3 niveles (respuesta y fila en SQLite), CA2 en el listado, CA3 con 6 entradas inválidas (sin nada guardado), el `CHECK` de la tabla y la migración de una base de HU1 con registros antiguos. |
| `frontend/src/pages/TrainingIntensity.test.tsx` | El selector accesible, CA1 de extremo a extremo con cada nivel, el rechazo de una respuesta con otra intensidad, CA2 en el historial (incluidos registros antiguos) y CA3 (no envía, marca el error, mueve el foco y se recupera al elegir). |
| `frontend/src/lib/activityValidation.test.ts` y `frontend/src/services/activities.test.ts` | La validación del formulario, el JSON enviado y la validación de las respuestas `201` y del historial. |
