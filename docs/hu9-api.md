# Contrato de API — HU9 Configurar meta diaria de hidratación

## `GET /api/hydration-goal`

Devuelve la meta del usuario de prueba. Si todavía no existe, devuelve `null`:

```json
{
  "litersPerDay": null,
  "updatedAt": null
}
```

## `PUT /api/hydration-goal`

Guarda o reemplaza la meta diaria. El frontend envía un número finito mayor que
cero en litros:

```json
{ "litersPerDay": 2 }
```

La respuesta correcta es `200` y contiene el valor persistido y su fecha de
actualización:

```json
{
  "litersPerDay": 2,
  "updatedAt": "2026-11-03T12:30:00.000Z"
}
```

Una meta vacía, cero, negativa o no numérica devuelve `400
VALIDATION_ERROR`, y no modifica la meta anterior.

La meta se guarda en SQLite en la tabla `hydration_goals`. Es independiente de
los futuros registros de agua consumida.
