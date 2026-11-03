# Healthy-Life-G2

**Healthy Life** · Módulo **E2 — Seguimiento de hábitos saludables** · Equipo **Scrum & Run** (Grupo 2)
Procesos de Software · Universidad Rey Juan Carlos · Curso 2026-27

Healthy Life es una plataforma integrada de salud y bienestar que construye toda la clase. Este repositorio contiene el módulo E2: registro de actividad física, objetivos personales, hábitos (sueño, hidratación) y estadísticas de progreso.

## Tecnologías

| Capa | Tecnología | Responsable HU1 |
| --- | --- | --- |
| Frontend | React + TypeScript + Vite | Ahmed |
| Backend | Node.js + Express + TypeScript | Álvaro |
| Base de datos | SQLite | Álvaro |
| Comunicación | API REST con JSON | Ambos (contrato común) |

## Estructura

```text
Healthy-Life-G2/
├── frontend/   # Aplicación React (Ahmed)
├── backend/    # API Express + SQLite (Álvaro) → ver backend/README.md
└── docs/
    ├── hu1-api.md   # Contrato de API de HU1
    ├── hu2-api.md   # Contrato de API de HU2
    └── hu9-api.md   # Contrato de API de HU9
    └── hu3-api.md   # Contrato de API de HU3
```

## Documentación

- [Contrato de API de HU1 — Registrar actividad física](docs/hu1-api.md)
- [Contrato de API de HU2 — Registrar horas de sueño (SCRUM-2)](docs/hu2-api.md)
- [Contrato de API de HU9 — Configurar meta diaria de hidratación](docs/hu9-api.md)
- [Contrato de API de HU3 — Registrar consumo diario de agua (SCRUM-3)](docs/hu3-api.md)
- [Cómo arrancar el backend](backend/README.md)

La aplicación permite elegir entre registrar actividad física (HU1), horas de sueño (HU2) y consumo diario de agua (HU3), sin cambiar de aplicación.

## Cómo colaboramos

- `main` siempre contiene código revisado. Nadie trabaja directamente sobre `main`.
- Cada historia se desarrolla en su rama: `feature/hu1-backend`, `feature/hu1-frontend`…
- Todo entra en `main` mediante **Pull Request revisada por, al menos, otro miembro del equipo**.
- La historia se da por terminada cuando el delegado de Product Owner verifica sus criterios de aceptación (Definition of Done).
- **Nunca** se suben secretos, contraseñas ni ficheros `.env`.

Para ejecutar el proyecto con Docker, consulta la guía de despliegue