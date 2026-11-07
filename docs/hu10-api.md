# HU10 — Objetivo mínimo de horas de sueño

Referencia Jira: **SCRUM-33** (subtareas SCRUM-55 a SCRUM-58).

> Como usuario de Healthy Life, quiero fijar un objetivo mínimo de horas de sueño diarias para que me notifiquen si no cumplo lo recomendable.

## Alcance

- El usuario fija un **objetivo mínimo de horas de sueño al día**: un número mayor que 0 y como máximo 24 (se admiten decimales, como 7,5).
- Hay **un único objetivo por usuario**; guardarlo de nuevo lo sustituye.
- El cumplimiento se calcula **por día**: se suman todos los descansos de esa fecha (noche, siesta y otros) registrados en HU2 y se comparan con el objetivo.
- Se revisan los **últimos 7 días** (hoy incluido, calendario `Europe/Madrid`). No se inventan días sin registros.
- **Aviso:** si hay objetivo y el día más reciente con registros no lo alcanza, `alert` es `true` y la pantalla muestra una notificación.
- Se usa el usuario de prueba del backend (`DEMO_USER_ID`), como en las demás historias.

## `GET /api/sleep-goal`

Devuelve el objetivo y el cumplimiento calculado en ese momento.

Sin objetivo ni registros:

```json
{
  "minHours": null,
  "updatedAt": null,
  "fromDate": "2026-11-01",
  "toDate": "2026-11-07",
  "days": [],
  "latest": null,
  "alert": false
}
```

Con objetivo y registros:

```json
{
  "minHours": 8,
  "updatedAt": "2026-11-07T08:00:00.000Z",
  "fromDate": "2026-11-01",
  "toDate": "2026-11-07",
  "days": [
    { "date": "2026-11-07", "totalHours": 6.5, "met": false },
    { "date": "2026-11-06", "totalHours": 9, "met": true }
  ],
  "latest": { "date": "2026-11-07", "totalHours": 6.5, "met": false },
  "alert": true
}
```

| Campo | Significado |
| --- | --- |
| `minHours` | Objetivo en horas, o `null` si no se ha configurado |
| `fromDate` / `toDate` | Ventana revisada: últimos 7 días hasta hoy |
| `days` | Días con registros, del más reciente al más antiguo; `met` es `null` si no hay objetivo |
| `latest` | Día más reciente con registros, o `null` |
| `alert` | `true` si hay objetivo y `latest` no lo alcanza |

## `PUT /api/sleep-goal`

```json
{ "minHours": 8 }
```

- `200 OK` con el mismo resumen que el `GET`.
- `400 VALIDATION_ERROR` si `minHours` falta, no es un número, es menor o igual que 0 o mayor que 24. El objetivo anterior se conserva.

## Persistencia

Tabla `sleep_goals` en la misma base SQLite:

| Campo | Tipo | Uso |
| --- | --- | --- |
| `user_id` | `TEXT PRIMARY KEY` | Un objetivo por usuario |
| `min_hours` | `REAL NOT NULL` | Entre 0 (excluido) y 24 |
| `updated_at` | `TEXT NOT NULL` | Última modificación, en UTC |

La tabla se crea de forma aditiva: no modifica `sleep_records` ni ninguna otra.

## Interfaz y criterios de aceptación

| Criterio (Miro) | Dónde se cumple |
| --- | --- |
| CA1 · Configurar 9 h, se guarda y se ve | Pestaña **«Objetivo de sueño»** (al final de la barra, para no alterar el orden de HU1 y HU2): formulario y resumen «9 h como mínimo» con el cumplimiento de los últimos 7 días |
| CA2 · Valores fuera de rango, vacíos o no numéricos | Error en el formulario sin llamar a la API; la API también responde 400 y conserva el objetivo anterior |
| CA3 · Sin objetivo, se indica y se sugiere configurarlo | Pantalla **«Horas de sueño»**: «Aún no has establecido un objetivo mínimo de sueño» con el botón «Configurar objetivo» (y lo mismo en la pestaña del objetivo) |
| CA4 · Al guardar un registro por debajo del objetivo, notificación | Pantalla **«Horas de sueño»**: tras guardar, aparece bajo el formulario «No has alcanzado tu objetivo de sueño» con las horas que faltan |

El aviso consulta `GET /api/sleep-goal` al entrar en la pantalla de sueño y después de cada registro. Si esa consulta falla, no se muestra nada y el registro de sueño sigue funcionando.

En las pruebas de HU2 (`SleepDashboard.test.tsx` y `RegisterSleepPage.test.tsx`) solo se ha cambiado la preparación: las peticiones a `/api/sleep-goal` se responden aparte, para que los recuentos de peticiones sigan midiendo únicamente `/api/sleep`. Ninguna comprobación de HU2 cambia.
