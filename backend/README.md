# Backend E2 — Seguimiento de hábitos saludables

API REST del módulo E2 de Healthy Life. Responsable: **Álvaro**.

- **Tecnologías:** Node.js + Express + TypeScript, SQLite (módulo `node:sqlite` integrado en Node).
- **Contratos con el frontend:** [`docs/hu1-api.md`](../docs/hu1-api.md) y [`docs/hu2-api.md`](../docs/hu2-api.md).

## Requisitos

- **Node.js 22.13 o superior** (`node -v` para comprobarlo). No hace falta instalar SQLite aparte.

## Puesta en marcha

```bash
cd backend
npm install
npm run dev
```

El backend queda en `http://localhost:3001`. La base de datos se crea sola en `backend/data/healthy-life-e2.db`.

Al arrancar, Node muestra el aviso `ExperimentalWarning: SQLite is an experimental feature`. Es normal y no afecta al funcionamiento.

## Configuración

Todos los valores tienen un valor por defecto. Para cambiarlos, copia `.env.example` como `.env` (nunca se sube a Git) o define las variables al arrancar.

| Variable | Por defecto | Qué es |
| --- | --- | --- |
| `PORT` | `3001` | Puerto del backend |
| `DB_PATH` | `data/healthy-life-e2.db` | Fichero SQLite |
| `CORS_ORIGIN` | `http://localhost:5173` | Origen del frontend (Vite) |
| `DEMO_USER_ID` | `demo-user` | Usuario de prueba hasta integrar E1 |

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Arranca el backend y lo reinicia al guardar cambios |
| `npm start` | Arranca el backend |
| `npm test` | Ejecuta las pruebas con bases en memoria y ficheros temporales aislados |
| `npm run typecheck` | Comprueba los tipos de TypeScript |

## Prueba manual rápida

```bash
curl -X POST http://localhost:3001/api/activities \
  -H "Content-Type: application/json" \
  -d '{"activityType":"walking","activityDate":"2026-10-09","notes":"Caminata por el parque"}'

curl http://localhost:3001/api/activities
```

En PowerShell, usa `curl.exe` en lugar de `curl`.

## Estructura

```text
backend/
├── src/
│   ├── server.ts       # Arranque y configuración
│   ├── app.ts          # Rutas de la API y gestión de errores
│   ├── validation.ts   # Validación en servidor del contrato HU1
│   └── db.ts           # Tabla SQLite y consultas
└── tests/
    └── activities.test.ts
```

## HU2 — Registrar horas de sueño

El contrato de sueño está documentado en [`docs/hu2-api.md`](../docs/hu2-api.md).
La ampliación añade tipos de descanso y edición individual, conservando la lógica original de HU1 de Álvaro.

| Endpoint | Comportamiento |
| --- | --- |
| `POST /api/sleep` | Crea un descanso y devuelve `201` con el registro persistido. |
| `GET /api/sleep` | Devuelve `200` con los registros del usuario configurado, ordenados por fecha e identificador descendentes; `[]` si no hay registros. |
| `PATCH /api/sleep/:id` | Actualiza fecha, horas y tipo de un registro de ese usuario; devuelve `200` sin cambiar `id` ni `createdAt`. |

Los campos editables son `sleepDate` (fecha real `YYYY-MM-DD`), `hoursSlept` (número finito mayor que 0 y menor o igual que 24, con decimales) y `sleepType` (`night`, `nap` u `other`). El cliente no envía `userId`; se utiliza `DEMO_USER_ID` tanto al crear como al consultar o actualizar. Se permiten varios registros para una misma fecha, incluso del mismo tipo. El límite de 24 horas corresponde a cada registro: no se limita ni se modifica automáticamente la suma diaria.

El POST permite omitir `sleepType` para mantener clientes antiguos y guarda `NULL` en ese caso. Un `null` explícito, un tipo desconocido o una cadena vacía son inválidos. El frontend actualizado siempre selecciona uno de los tres tipos. Las respuestas de todos los endpoints contienen `sleepType`, con `null` para los registros **Sin clasificar**.

El PATCH utiliza una representación completa: exige los tres campos editables. Rechaza un identificador inválido con `400 / VALIDATION_ERROR`; un registro inexistente o de otro usuario recibe el mismo `404 / NOT_FOUND`. El SQL parametrizado restringe la actualización por identificador y usuario. No se insertan filas nuevas al editar ni se ofrece borrado. Los errores mantienen `{ "error": { "code", "message" } }`; JSON incorrecto, peticiones demasiado grandes y fallos internos conservan los estados `400`, `413` y `500` comunes.

### Fechas y compatibilidad histórica

POST y PATCH rechazan fechas posteriores a **hoy en Europe/Madrid**, también cuando un cliente antiguo omite el tipo. La zona es fija y no depende del reloj local de Docker o de la configuración de zona del proceso. Se comparan fechas de calendario, sin desplazar `sleepDate` mediante conversiones UTC; `createdAt` sigue siendo un instante UTC. El backend es la autoridad final y no exige una nueva variable de entorno.

Las filas históricas con fechas futuras siguen siendo consultables. Para editarlas hay que corregir la fecha a hoy o antes y asignar un tipo válido. No se modifica retrospectivamente el contenido de registros existentes.

### Migración de SQLite

La tabla `sleep_records` sigue en el mismo archivo definido por `DB_PATH`. Al abrir la base, se inspecciona `PRAGMA table_info(sleep_records)` y, si falta la columna, se ejecuta:

```sql
ALTER TABLE sleep_records ADD COLUMN sleep_type TEXT;
```

La columna admite `NULL`: los descansos previos quedan sin clasificar, sin atribuirles un tipo inventado. Sus identificadores, usuario, fecha, horas y fecha de creación permanecen intactos. La comprobación evita repetir el ALTER en posteriores arranques; funciona también con instalaciones nuevas. No se recrean tablas, no se añade unicidad por fecha y `activities` conserva su estructura y datos. No se elimina el volumen Docker.

Se mantienen `DB_PATH`, `DEMO_USER_ID`, `PORT` y `CORS_ORIGIN`, las dependencias y el arranque existentes.

### Probar creación y edición en PowerShell

Con el backend disponible, este ejemplo crea una siesta y modifica ese mismo registro:

```powershell
$sleepApi = "http://localhost:3001/api/sleep"
$sleepBody = @{ sleepDate = "2026-10-10"; hoursSlept = 2; sleepType = "nap" } | ConvertTo-Json
$sleepRecord = Invoke-RestMethod -Method Post -Uri $sleepApi -ContentType "application/json" -Body $sleepBody
$sleepUpdate = @{ sleepDate = "2026-10-10"; hoursSlept = 1.5; sleepType = "nap" } | ConvertTo-Json
Invoke-RestMethod -Method Patch -Uri "$sleepApi/$($sleepRecord.id)" -ContentType "application/json" -Body $sleepUpdate
Invoke-RestMethod -Uri $sleepApi
```

El identificador y `createdAt` deben conservarse, y la lista debe contener una sola fila para el registro creado por el ejemplo, ahora con `1.5` horas. Estos comandos escriben datos reales del usuario de prueba.

### Comprobaciones

```bash
cd backend
npm test
npm run typecheck
```

La suite incluye HU1 y HU2: catálogo y compatibilidad sin tipo, fechas pasadas/actuales/futuras, calendario de Madrid cerca de medianoche y cambios de horario, registros repetidos por fecha, edición y aislamiento por usuario, conservación de `id`/`createdAt`, errores comunes y migración repetible. Las pruebas de persistencia utilizan SQLite real en archivos temporales, los cierran y reabren, y verifican los datos históricos; no usan el archivo de desarrollo ni el volumen Docker.

### Actualizar Docker en Windows después de revisar la rama

La ampliación se prepara en `feature/hu2-sleep-improvements`, a partir del `main` que ya contiene la PR #4 fusionada. Mientras no se autorice y publique esta rama en el fork, `git fetch` desde Windows no puede descargar los cambios locales de Codex. Los pasos de publicación posterior están en el [README del frontend](../frontend/README.md#revisión-local-y-publicación-posterior).

Una vez publicada con autorización, utiliza **la misma carpeta de trabajo y el mismo nombre de proyecto Compose** que contienen tu volumen actual. Comprueba que no hay cambios locales pendientes y ejecuta en PowerShell, desde la raíz:

```powershell
git status --short
git fetch origin
git switch --track origin/feature/hu2-sleep-improvements
```

Si la rama ya existe localmente, utiliza `git switch feature/hu2-sleep-improvements` y `git pull --ff-only origin feature/hu2-sleep-improvements` en lugar de crearla otra vez. No sobrescribas modificaciones locales para forzar el cambio de rama.

Antes del primer arranque con la migración, puedes conservar una copia consistente de la base existente deteniendo el backend y copiando su archivo. Elige una ruta de respaldo nueva, fuera del repositorio:

```powershell
docker compose stop backend
docker compose cp backend:/app/data/healthy-life-e2.db ../healthy-life-e2-before-sleep-improvements.db
docker compose up --build -d
docker compose ps
docker compose logs --tail 50 backend
```

En una instalación nueva todavía no existe un archivo que copiar: basta con `docker compose up --build -d`. En una instalación existente, si la copia falla, comprueba la ruta o el contenedor antes de continuar. Abre `http://localhost:5173`, comprueba los datos anteriores y prueba un registro y su edición. `GET /api/sleep` permite verificar sus valores; un reinicio normal debe conservarlos.

Los Dockerfiles y `compose.yaml` mantienen su configuración. **No ejecutes `docker compose down -v` ni elimines el volumen**: la actualización requiere conservar SQLite. Cambiar de carpeta o de nombre de proyecto Compose puede crear otro volumen y hacer que los datos anteriores parezcan ausentes, aunque sigan en el volumen original.
