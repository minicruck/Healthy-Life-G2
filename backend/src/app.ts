// Definición de la API. Separada de server.ts para poder probarla sin
// arrancar un servidor real (los tests usan una base de datos en memoria).
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import type { DatabaseSync } from "node:sqlite";
import { insertActivity, listActivities, type ActivityRow } from "./db.ts";
import { validateNewActivity } from "./validation.ts";
import { insertSleep, listSleep, findSleep, updateSleep, type SleepRow } from "./db.ts";
import { validateNewSleep, validateSleepUpdate, parseSleepId } from "./validation.ts";

export interface AppConfig {
  db: DatabaseSync;
  /** Usuario de prueba hasta integrar las cuentas de E1. */
  demoUserId: string;
  /** Origen del frontend permitido por CORS (Vite: http://localhost:5173). */
  corsOrigin: string;
}

function toApi(row: ActivityRow) {
  return {
    id: row.id,
    activityType: row.activity_type,
    activityDate: row.activity_date,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

function errorBody(code: string, message: string) {
  return { error: { code, message } };
}

function sleepToApi(row: SleepRow) {
  return {
    id: row.id,
    sleepDate: row.sleep_date,
    hoursSlept: row.hours_slept,
    sleepType: row.sleep_type,
    createdAt: row.created_at,
  };
}

export function createApp({ db, demoUserId, corsOrigin }: AppConfig) {
  const app = express();
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json({ limit: "10kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // HU1 — Registrar actividad física
  app.post("/api/activities", (req, res) => {
    const result = validateNewActivity(req.body);
    if (!result.ok) {
      res.status(400).json(errorBody("VALIDATION_ERROR", result.message));
      return;
    }
    const row = insertActivity(db, { userId: demoUserId, ...result.value });
    res.status(201).json(toApi(row));
  });

  // Auxiliar: permite comprobar que lo registrado se ha guardado.
  app.get("/api/activities", (_req, res) => {
    res.json(listActivities(db, demoUserId).map(toApi));
  });

  // HU2 — Registrar horas de sueño. La identidad la proporciona el servidor.
  app.post("/api/sleep", (req, res) => {
    const result = validateNewSleep(req.body);
    if (!result.ok) {
      res.status(400).json(errorBody("VALIDATION_ERROR", result.message));
      return;
    }
    const row = insertSleep(db, { userId: demoUserId, ...result.value });
    res.status(201).json(sleepToApi(row));
  });

  // Auxiliar: registros del usuario configurado, del más reciente al más antiguo.
  app.get("/api/sleep", (_req, res) => {
    res.json(listSleep(db, demoUserId).map(sleepToApi));
  });

  // PATCH usa los tres campos editables completos; nunca cambia id, usuario ni createdAt.
  app.patch("/api/sleep/:id", (req, res) => {
    const id = parseSleepId(req.params.id);
    if (id === null) {
      res.status(400).json(errorBody("VALIDATION_ERROR", "El identificador del registro no es válido."));
      return;
    }
    if (!findSleep(db, id, demoUserId)) {
      res.status(404).json(errorBody("NOT_FOUND", "Registro de sueño no encontrado."));
      return;
    }
    const result = validateSleepUpdate(req.body);
    if (!result.ok) {
      res.status(400).json(errorBody("VALIDATION_ERROR", result.message));
      return;
    }
    const row = updateSleep(db, id, demoUserId, result.value);
    if (!row) {
      res.status(404).json(errorBody("NOT_FOUND", "Registro de sueño no encontrado."));
      return;
    }
    res.json(sleepToApi(row));
  });

  app.use("/api", (_req, res) => {
    res.status(404).json(errorBody("NOT_FOUND", "Recurso no encontrado."));
  });

  // JSON mal formado o errores inesperados: nunca se exponen detalles internos.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const e = err as { type?: string; status?: number };
    if (e?.type === "entity.parse.failed") {
      res.status(400).json(errorBody("VALIDATION_ERROR", "El cuerpo no es un JSON válido."));
      return;
    }
    if (e?.type === "entity.too.large") {
      res.status(413).json(errorBody("PAYLOAD_TOO_LARGE", "La petición es demasiado grande."));
      return;
    }
    console.error(err);
    res.status(500).json(errorBody("INTERNAL_ERROR", "Error interno del servidor."));
  });

  return app;
}
