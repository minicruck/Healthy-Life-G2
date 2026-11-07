// Persistencia del módulo E2 con SQLite.
// Usa el módulo sqlite integrado en Node (node:sqlite), así no hace falta
// compilar dependencias nativas en Windows/Mac/Linux.
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { SleepType } from "./validation.ts";

export interface ActivityRow {
  id: number;
  user_id: string;
  activity_type: string;
  activity_date: string;
  notes: string | null;
  created_at: string;
}

export interface NewActivity {
  userId: string;
  activityType: string;
  activityDate: string;
  notes: string | null;
}

export interface SleepRow {
  id: number;
  user_id: string;
  sleep_date: string;
  hours_slept: number;
  created_at: string;
  sleep_type: SleepType | null;
}

export interface NewSleep {
  userId: string;
  sleepDate: string;
  hoursSlept: number;
  sleepType: SleepType | null;
}

export interface HydrationGoalRow {
  user_id: string;
  liters_per_day: number;
  updated_at: string;
}

export interface WaterRow {
  id: number;
  user_id: string;
  consumed_date: string;
  amount_ml: number;
  created_at: string;
}

export function openDatabase(path: string): DatabaseSync {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS activities (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       TEXT    NOT NULL,
      activity_type TEXT    NOT NULL,
      activity_date TEXT    NOT NULL,
      notes         TEXT,
      created_at    TEXT    NOT NULL
    )
  `);
  // Migración aditiva: conserva la tabla activities y sus registros existentes.
  db.exec(`
    CREATE TABLE IF NOT EXISTS sleep_records (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     TEXT    NOT NULL,
      sleep_date  TEXT    NOT NULL,
      hours_slept REAL    NOT NULL,
      created_at  TEXT    NOT NULL,
      sleep_type  TEXT
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS hydration_goals (
      user_id        TEXT PRIMARY KEY,
      liters_per_day REAL NOT NULL,
      updated_at     TEXT NOT NULL
    )
  `);
  // ALTER conserva las filas y asigna NULL a su nueva columna, sin inventar su clasificación.
  const sleepColumns = db.prepare("PRAGMA table_info(sleep_records)").all();
  if (!sleepColumns.some((column) => column.name === "sleep_type")) {
    db.exec("ALTER TABLE sleep_records ADD COLUMN sleep_type TEXT");
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS water_entries (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       TEXT    NOT NULL,
      consumed_date TEXT    NOT NULL,
      amount_ml     INTEGER NOT NULL,
      created_at    TEXT    NOT NULL
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS training_goals (
      user_id       TEXT PRIMARY KEY,
      days_per_week INTEGER NOT NULL CHECK (days_per_week BETWEEN 1 AND 7),
      updated_at    TEXT NOT NULL
    )
  `);
  // HU10 — un único objetivo mínimo de horas de sueño por usuario.
  db.exec(`
    CREATE TABLE IF NOT EXISTS sleep_goals (
      user_id    TEXT PRIMARY KEY,
      min_hours  REAL NOT NULL CHECK (min_hours > 0 AND min_hours <= 24),
      updated_at TEXT NOT NULL
    )
  `);
  return db;
}

export interface SleepGoalRow {
  user_id: string;
  min_hours: number;
  updated_at: string;
}

export function findSleepGoal(db: DatabaseSync, userId: string): SleepGoalRow | undefined {
  return db.prepare("SELECT * FROM sleep_goals WHERE user_id = ?").get(userId) as
    | SleepGoalRow
    | undefined;
}

export function saveSleepGoal(db: DatabaseSync, userId: string, minHours: number): SleepGoalRow {
  const updatedAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO sleep_goals (user_id, min_hours, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      min_hours = excluded.min_hours,
      updated_at = excluded.updated_at
  `).run(userId, minHours, updatedAt);
  return findSleepGoal(db, userId)!;
}

/** Suma las horas de todos los descansos (noche, siesta, otro) de cada fecha del rango. */
export function sumSleepByDay(
  db: DatabaseSync,
  userId: string,
  fromDate: string,
  toDate: string,
): { date: string; totalHours: number }[] {
  const rows = db.prepare(`
    SELECT sleep_date AS date, SUM(hours_slept) AS total_hours
    FROM sleep_records
    WHERE user_id = ? AND sleep_date >= ? AND sleep_date <= ?
    GROUP BY sleep_date
    ORDER BY sleep_date DESC
  `).all(userId, fromDate, toDate) as { date: string; total_hours: number }[];
  return rows.map((row) => ({ date: row.date, totalHours: row.total_hours }));
}

export interface TrainingGoalRow {
  user_id: string;
  days_per_week: number;
  updated_at: string;
}

export function findTrainingGoal(db: DatabaseSync, userId: string): TrainingGoalRow | undefined {
  return db.prepare("SELECT * FROM training_goals WHERE user_id = ?").get(userId) as
    | TrainingGoalRow
    | undefined;
}

export function saveTrainingGoal(
  db: DatabaseSync,
  userId: string,
  daysPerWeek: number,
): TrainingGoalRow {
  const updatedAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO training_goals (user_id, days_per_week, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      days_per_week = excluded.days_per_week,
      updated_at = excluded.updated_at
  `).run(userId, daysPerWeek, updatedAt);
  return findTrainingGoal(db, userId)!;
}

/** Contabiliza fechas distintas con actividad hasta el día de hoy. */
export function countTrainingDays(
  db: DatabaseSync,
  userId: string,
  weekStart: string,
  today: string,
): number {
  const row = db.prepare(`
    SELECT COUNT(DISTINCT activity_date) AS completed_days
    FROM activities
    WHERE user_id = ? AND activity_date >= ? AND activity_date <= ?
  `).get(userId, weekStart, today) as { completed_days: number };
  return row.completed_days;
}

export function findHydrationGoal(
  db: DatabaseSync,
  userId: string,
): HydrationGoalRow | undefined {
  return db
    .prepare("SELECT * FROM hydration_goals WHERE user_id = ?")
    .get(userId) as unknown as HydrationGoalRow | undefined;
}

export function saveHydrationGoal(
  db: DatabaseSync,
  userId: string,
  litersPerDay: number,
): HydrationGoalRow {
  const updatedAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO hydration_goals (user_id, liters_per_day, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      liters_per_day = excluded.liters_per_day,
      updated_at = excluded.updated_at
  `).run(userId, litersPerDay, updatedAt);
  return findHydrationGoal(db, userId)!;
}

export function insertActivity(db: DatabaseSync, a: NewActivity): ActivityRow {
  const createdAt = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO activities (user_id, activity_type, activity_date, notes, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(a.userId, a.activityType, a.activityDate, a.notes, createdAt);

  return db
    .prepare(`SELECT * FROM activities WHERE id = ?`)
    .get(Number(result.lastInsertRowid)) as unknown as ActivityRow;
}

export function listActivities(db: DatabaseSync, userId: string): ActivityRow[] {
  return db
    .prepare(
      `SELECT * FROM activities WHERE user_id = ?
       ORDER BY activity_date DESC, id DESC`
    )
    .all(userId) as unknown as ActivityRow[];
}

export function insertSleep(db: DatabaseSync, sleep: NewSleep): SleepRow {
  const createdAt = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO sleep_records (user_id, sleep_date, hours_slept, created_at, sleep_type)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(sleep.userId, sleep.sleepDate, sleep.hoursSlept, createdAt, sleep.sleepType);

  return db
    .prepare(`SELECT * FROM sleep_records WHERE id = ?`)
    .get(Number(result.lastInsertRowid)) as unknown as SleepRow;
}

export function listSleep(db: DatabaseSync, userId: string): SleepRow[] {
  return db
    .prepare(
      `SELECT * FROM sleep_records WHERE user_id = ?
       ORDER BY sleep_date DESC, id DESC`
    )
    .all(userId) as unknown as SleepRow[];
}

export function findSleep(db: DatabaseSync, id: number, userId: string): SleepRow | undefined {
  return db
    .prepare("SELECT * FROM sleep_records WHERE id = ? AND user_id = ?")
    .get(id, userId) as unknown as SleepRow | undefined;
}

export function updateSleep(
  db: DatabaseSync,
  id: number,
  userId: string,
  changes: { sleepDate: string; hoursSlept: number; sleepType: SleepType },
): SleepRow | undefined {
  const result = db
    .prepare(`
      UPDATE sleep_records SET sleep_date = ?, hours_slept = ?, sleep_type = ?
      WHERE id = ? AND user_id = ?
    `)
    .run(changes.sleepDate, changes.hoursSlept, changes.sleepType, id, userId);
  if (Number(result.changes) === 0) return undefined;
  return findSleep(db, id, userId);
}

export function insertWater(
  db: DatabaseSync,
  entry: { userId: string; consumedDate: string; amountMl: number },
): WaterRow {
  const createdAt = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO water_entries (user_id, consumed_date, amount_ml, created_at)
       VALUES (?, ?, ?, ?)`,
    )
    .run(entry.userId, entry.consumedDate, entry.amountMl, createdAt);

  return db
    .prepare("SELECT * FROM water_entries WHERE id = ?")
    .get(Number(result.lastInsertRowid)) as unknown as WaterRow;
}

export function listWater(db: DatabaseSync, userId: string): WaterRow[] {
  return db
    .prepare(
      `SELECT * FROM water_entries WHERE user_id = ?
       ORDER BY consumed_date DESC, id DESC`,
    )
    .all(userId) as unknown as WaterRow[];
}

export function getWaterTotal(
  db: DatabaseSync,
  userId: string,
  consumedDate: string,
): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(amount_ml), 0) AS total_ml
       FROM water_entries WHERE user_id = ? AND consumed_date = ?`,
    )
    .get(userId, consumedDate) as { total_ml: number };
  return row.total_ml;
}
