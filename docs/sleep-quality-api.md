# Calidad del sueño — Sensación de descanso

> Como usuario de Healthy Life, quiero registrar mi sensación de calidad del sueño (1 a 5) y añadir comentarios para evaluar mi descanso diario.

## Criterios de Aceptación (CA)

- **CA1.** Dado que está en la pantalla de calidad del sueño, cuando elige fecha y valoración de 1 a 5 y guarda, se registra y se confirma.
- **CA2.** La valoración es obligatoria (1 a 5); si falta o no es válida, no se guarda y se avisa.
- **CA3.** No se permiten fechas futuras; se informa del error.
- **CA4.** Una valoración por noche: si ya existe, se ofrece sustituirla sin duplicar.
- **CA5.** Comentario opcional de hasta 200 caracteres; se guarda junto a la valoración.

## `GET /api/sleep-quality`

Devuelve la lista de valoraciones de calidad de sueño registradas para el usuario configurado (`DEMO_USER_ID`), ordenadas de la más reciente a la más antigua.

Parámetro opcional: `?date=YYYY-MM-DD`:
Devuelve `{ exists: boolean, record: SleepQualityRecord | null }`.

### Respuesta 200 OK:
```json
[
  {
    "id": 1,
    "sleepDate": "2026-11-08",
    "rating": 4,
    "notes": "Noche tranquila y descanso profundo",
    "createdAt": "2026-11-08T00:00:00.000Z",
    "updatedAt": "2026-11-08T00:00:00.000Z"
  }
]
```

## `POST /api/sleep-quality`

Registra o actualiza la sensación de calidad del sueño de una noche.

### Cuerpo de la petición:
```json
{
  "sleepDate": "2026-11-08",
  "rating": 4,
  "notes": "Sensación reparadora al despertar",
  "overwrite": false
}
```

- `sleepDate` (obligatorio, `YYYY-MM-DD`, no puede ser posterior a hoy en `Europe/Madrid`).
- `rating` (obligatorio, número entero de 1 a 5).
- `notes` (opcional, texto de hasta 200 caracteres).
- `overwrite` (opcional, booleano, por defecto `false`).

### Respuestas:
- **`201 Created`**: Registro nuevo guardado con éxito (`replaced: false`).
- **`200 OK`**: Registro existente sustituido con éxito (`overwrite: true`, `replaced: true`).
- **`409 Conflict`**: Si ya existe una valoración para esa fecha y `overwrite` es `false`:
  ```json
  {
    "error": {
      "code": "ALREADY_EXISTS",
      "message": "Ya existe una valoración para esta noche. ¿Deseas sustituirla?"
    },
    "existing": {
      "id": 1,
      "sleepDate": "2026-11-08",
      "rating": 3,
      "notes": "Regular"
    }
  }
  ```
- **`400 Bad Request / VALIDATION_ERROR`**: Si falta la valoración, no está entre 1 y 5, la fecha es futura o el comentario supera los 200 caracteres.

## Persistencia

Tabla `sleep_quality` en SQLite:
```sql
CREATE TABLE IF NOT EXISTS sleep_quality (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT    NOT NULL,
  sleep_date  TEXT    NOT NULL,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  notes       TEXT,
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL,
  UNIQUE(user_id, sleep_date)
);
```
