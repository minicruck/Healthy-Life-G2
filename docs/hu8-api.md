# HU8 — Objetivo semanal de entrenamiento

## Alcance

El usuario puede establecer un objetivo de entre 1 y 7 días de entrenamiento por semana.
El sistema compara el objetivo con el número de **fechas distintas** en las que se han registrado actividades físicas durante la semana en curso. Los registros anteriores al lunes y los fechados en el futuro no cuentan.

La semana empieza el lunes y termina el domingo, con calendario de `Europe/Madrid`.
Se utiliza el usuario de prueba configurado en el backend, como en las demás historias, hasta que exista la integración con usuarios externos.

## GET /api/training-goal

Obtiene el objetivo y el progreso calculado en ese momento.

Sin objetivo:

```json
{
  "daysPerWeek": null,
  "completedDays": 0,
  "remainingDays": null,
  "weekStart": "2026-11-02",
  "weekEnd": "2026-11-08",
  "updatedAt": null
}
```

Con un objetivo configurado:

```json
{
  "daysPerWeek": 3,
  "completedDays": 1,
  "remainingDays": 2,
  "weekStart": "2026-11-02",
  "weekEnd": "2026-11-08",
  "updatedAt": "2026-11-05T10:00:00.000Z"
}
```

Las fechas anteriores son ejemplos; el servidor utiliza la semana vigente.

## PUT /api/training-goal

Crea o sustituye el objetivo semanal:

```json
{ "daysPerWeek": 3 }
```

Una operación correcta devuelve `200 OK` y el mismo formato que el GET con el nuevo objetivo.
Los números decimales, cadenas de texto, valores vacíos y enteros fuera de 1 a 7 devuelven
`400` con el código `VALIDATION_ERROR`. El objetivo que ya estaba guardado no se modifica.

## Cálculo del progreso

- Cada fecha de actividad física cuenta como máximo una vez, aunque haya varios registros.
- Se cuentan las fechas entre el lunes de la semana vigente y la fecha actual, ambas incluidas.
- `remainingDays = max(0, daysPerWeek - completedDays)`.
- El objetivo se almacena en la tabla SQLite `training_goals`, independiente del histórico de actividades.
- Después de registrar una actividad, el progreso actualizado aparece al volver al apartado «Objetivo de entrenamiento» o al pulsar «Actualizar progreso».
- La configuración y los registros sobreviven al reinicio normal de los contenedores Docker.

## Comprobaciones

```bash
cd backend
npm ci
npm test
npm run typecheck

cd ../frontend
npm ci
npm test
npm run build
```

Para las pruebas manuales, establecer una meta de 3 días, registrar dos actividades con la misma fecha,
volver al objetivo y comprobar que el progreso es de 1 día. Después registrar una actividad en otra
fecha de la misma semana, comprobar que sube a 2 días y reiniciar el backend para verificar persistencia.
