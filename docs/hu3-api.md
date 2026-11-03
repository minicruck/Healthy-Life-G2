# Contrato de API — HU3 Registrar consumo diario de agua

Contrato de API para el registro de hidratación de Healthy Life. Referencia Jira: **SCRUM-3**.

## Conexión y fecha diaria

Se utiliza el backend existente en `http://localhost:3001`, configurado mediante `VITE_API_BASE_URL`. El día actual se determina en `Europe/Madrid`, igual que en HU2, y el backend asocia los registros al usuario configurado (`DEMO_USER_ID`).

## `POST /api/water`

Registra un consumo en mililitros para el día actual y devuelve el total acumulado de ese día.

```http
POST /api/water
Content-Type: application/json
```

```json
{ "amountMl": 250 }
```

`amountMl` es obligatorio y debe ser un número entero seguro mayor que cero. No se admiten cadenas numéricas, decimales, valores vacíos, cero ni negativos. Cada consumo se conserva como un registro individual.

### Respuesta correcta — `201 Created`

```json
{
  "id": 1,
  "amountMl": 250,
  "consumedDate": "2026-11-03",
  "createdAt": "2026-11-03T08:30:00.000Z",
  "dailyTotalMl": 250
}
```

`dailyTotalMl` incluye el consumo recién guardado y todos los registros del mismo usuario y fecha.

## `GET /api/water`

Devuelve todos los consumos guardados del usuario configurado, ordenados por fecha e identificador descendentes. Si no existen registros, responde con `[]`. La interfaz muestra este historial como una lista sencilla con la fecha y la cantidad de cada consumo.

```json
[
  {
    "id": 2,
    "amountMl": 500,
    "consumedDate": "2026-11-03",
    "createdAt": "2026-11-03T09:00:00.000Z"
  }
]
```

## `GET /api/water/today`

Devuelve el total del usuario configurado para la fecha actual en `Europe/Madrid`. Si aún no hay registros, devuelve `totalMl: 0`.

```json
{ "date": "2026-11-03", "totalMl": 0 }
```

Las respuestas de error usan `{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }` con estado `400` para datos inválidos. Los errores generales conservan el formato y estados comunes de la API.
