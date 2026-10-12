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
  // ALTER conserva las filas y asigna NULL a su nueva columna, sin inventar su clasificación.
  const sleepColumns = db.prepare("PRAGMA table_info(sleep_records)").all();
  if (!sleepColumns.some((column) => column.name === "sleep_type")) {
    db.exec("ALTER TABLE sleep_records ADD COLUMN sleep_type TEXT");
  }
  return db;
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
