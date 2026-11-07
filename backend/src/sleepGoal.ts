// HU10 — cálculo del cumplimiento diario del objetivo mínimo de sueño.
import type { DatabaseSync } from "node:sqlite";
import { findSleepGoal, sumSleepByDay } from "./db.ts";
import { getMadridToday } from "./sleepCalendar.ts";

/** Número de días (incluido hoy) que se revisan para el cumplimiento. */
export const SLEEP_GOAL_WINDOW_DAYS = 7;

/** Resta días a una fecha YYYY-MM-DD sin depender de la zona horaria. */
export function shiftDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export interface SleepDayCompliance {
  date: string;
  totalHours: number;
  /** null cuando todavía no hay objetivo configurado. */
  met: boolean | null;
}

export interface SleepGoalSummary {
  minHours: number | null;
  updatedAt: string | null;
  fromDate: string;
  toDate: string;
  /** Días con registros de sueño en la ventana, del más reciente al más antiguo. */
  days: SleepDayCompliance[];
  /** Día más reciente con registros, o null si no hay ninguno en la ventana. */
  latest: SleepDayCompliance | null;
  /** true si hay objetivo y el día más reciente con registros no lo alcanza. */
  alert: boolean;
}

export function buildSleepGoalSummary(
  db: DatabaseSync,
  userId: string,
  today = getMadridToday(),
): SleepGoalSummary {
  const goal = findSleepGoal(db, userId);
  const minHours = goal?.min_hours ?? null;
  const fromDate = shiftDate(today, -(SLEEP_GOAL_WINDOW_DAYS - 1));
  const days = sumSleepByDay(db, userId, fromDate, today).map((day) => ({
    date: day.date,
    // Redondeo a 2 decimales para evitar restos de coma flotante al sumar.
    totalHours: Math.round(day.totalHours * 100) / 100,
    met: minHours === null ? null : day.totalHours >= minHours,
  }));
  const latest = days[0] ?? null;
  return {
    minHours,
    updatedAt: goal?.updated_at ?? null,
    fromDate,
    toDate: today,
    days,
    latest,
    alert: latest !== null && latest.met === false,
  };
}
