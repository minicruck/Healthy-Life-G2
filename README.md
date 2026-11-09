# Healthy Life · Seguimiento de hábitos saludables (E2)

Proyecto **Healthy Life**, módulo **E2 — Seguimiento de hábitos saludables**, desarrollado por el equipo **Scrum & Run (Grupo 2)** para Procesos de Software, Universidad Rey Juan Carlos, curso 2026-27.

La aplicación permite registrar actividades físicas, sueño y agua, consultar historiales, establecer objetivos personales y valorar la calidad del descanso. El frontend y el backend se ejecutan conjuntamente mediante Docker Compose y los datos se almacenan en SQLite.

## Funcionalidades implementadas

| Historia | Función |
| --- | --- |
| HU1 | Registrar una actividad física con tipo, fecha y observaciones |
| HU2 | Registrar y editar descansos, consultar el historial y las estadísticas de sueño |
| HU3 | Registrar consumos de agua y consultar el total diario |
| HU6 | Consultar el historial de actividades físicas, ordenado por fecha |
| HU8 | Fijar un objetivo de entrenamiento de 1 a 7 días por semana y consultar el progreso |
| HU9 | Fijar o modificar la meta diaria de hidratación |
| HU10 | Configurar un objetivo mínimo de sueño y mostrar avisos de cumplimiento |
| HU11 | Registrar una valoración de calidad del sueño de 1 a 5 con comentario opcional |

Las funcionalidades terminadas del **Sprint 2** son HU3, HU6, HU8, HU9, HU10 y HU11. HU1 y HU2 ya estaban completas al finalizar el Sprint 1.

La navegación de la web dispone de seis apartados: **Actividad física**, **Horas de sueño**, **Agua** (registro y meta de hidratación en la misma vista), **Objetivo de entrenamiento**, **Objetivo de sueño** y **Calidad del sueño**.

## Tecnologías y estructura

- **Frontend:** React, TypeScript, Vite; servido por Nginx en Docker.
- **Backend:** Node.js, Express y TypeScript.
- **Persistencia:** SQLite en un volumen Docker.
- **Comunicación:** API HTTP con datos JSON.

```text
Healthy-Life-G2/
├── frontend/         # Interfaz, servicios y pruebas
├── backend/          # API, persistencia y pruebas
├── docs/             # Contratos de API de las historias
├── docker/           # Guía y comprobación básica del despliegue
├── compose.yaml      # Frontend, backend y volumen SQLite
├── Dockerfile.frontend
└── Dockerfile.backend
```

## Arranque con Docker

Requiere Docker Desktop o Docker Engine con Compose. No es necesario instalar Node.js en el equipo para arrancar los contenedores.

Desde la raíz del repositorio, donde está `compose.yaml`:

```sh
docker compose up --build -d
docker compose ps
```

Una vez que `backend` aparezca como `healthy`:

- **Aplicación:** http://localhost:5173
- **API:** http://localhost:3001
- **Estado del backend:** http://localhost:3001/api/health (respuesta `{"status":"ok"}`)

Para consultar los registros o detener la aplicación sin borrar datos:

```sh
docker compose logs --tail=100 backend frontend
docker compose down
```

La base de datos permanece en el volumen `healthy_life_db`. **No ejecutes `docker compose down -v`** si deseas conservar los registros. Los puertos 3001 y 5173 deben estar libres.

Guía ampliada: [Despliegue con Docker](docker/README.md).

## API

Las rutas actuales emplean el usuario de demostración configurado en `DEMO_USER_ID`, por defecto `demo-user`.

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | `/api/health` | Estado del backend |
| GET / POST | `/api/activities` | Historial y alta de actividades |
| GET / POST | `/api/sleep` | Historial y alta de descansos |
| PATCH | `/api/sleep/:id` | Edición de un descanso |
| GET / POST | `/api/water` | Historial y alta de consumos |
| GET | `/api/water/today` | Consumo del día |
| GET / PUT | `/api/hydration-goal` | Meta diaria de agua |
| GET / PUT | `/api/training-goal` | Objetivo y progreso semanal de entrenamiento |
| GET / PUT | `/api/sleep-goal` | Objetivo mínimo de sueño y comprobación de cumplimiento |
| GET / POST | `/api/sleep-quality` | Valoraciones de la calidad del sueño |

Más información en los contratos de [HU1](docs/hu1-api.md), [HU2](docs/hu2-api.md), [HU3](docs/hu3-api.md), [HU8](docs/hu8-api.md), [HU9](docs/hu9-api.md), [HU10](docs/hu10-api.md) y [HU11](docs/sleep-quality-api.md). El historial de HU6 utiliza `GET /api/activities`.

## Pruebas

Las pruebas de backend y frontend se pueden ejecutar por separado con Node.js y npm:

```sh
cd backend
npm ci
npm run typecheck
npm test

cd ../frontend
npm ci
npm run typecheck
npm test
npm run build
```

Las pruebas de navegador requieren instalar los navegadores de Playwright y ejecutar `npm run test:e2e` desde `frontend/`. El script `docker/smoke-test.mjs` permite una comprobación básica de HU1 con los contenedores arrancados; no sustituye la revisión manual de todas las historias.

También existe un workflow de GitHub Actions que comprueba TypeScript, pruebas unitarias y compilación en las Pull Requests. Una PR no debe darse por revisada únicamente porque los checks sean correctos.

## Colaboración y Definition of Done

- El código se prepara en ramas individuales y se integra en `main` mediante Pull Request.
- Otro miembro revisa los cambios y se validan los criterios de aceptación de la historia.
- Se comprueban las pruebas y el funcionamiento de los cambios antes de fusionar.
- No se incluyen contraseñas, secretos ni archivos `.env` con credenciales en el repositorio.

## Limitaciones e integración futura

La versión actual está diseñada para ejecutarse de forma aislada, con un usuario local de demostración. La integración de cuentas de usuario y la lectura de archivos de datos simulados procedentes de otros módulos no forman parte de las rutas funcionales actuales y no deben presentarse como implementadas.
