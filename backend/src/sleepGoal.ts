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
  /**
   * Día sobre el que se evalúa el aviso: el pedido con ?date= (por ejemplo, el del
   * registro recién guardado) o, si no se pide ninguno, el más reciente con registros.
   */
  checked: SleepDayCompliance | null;
  /** true si hay objetivo y el día evaluado (`checked`) no lo alcanza. */
  alert: boolean;
}

export function buildSleepGoalSummary(
  db: DatabaseSync,
  userId: string,
  today = getMadridToday(),
  checkDate?: string,
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
  let checked = latest;
  if (checkDate !== undefined) {
    // El día pedido puede quedar fuera de la ventana de 7 días: se calcula aparte.
    const [day] = sumSleepByDay(db, userId, checkDate, checkDate);
    const totalHours = day === undefined ? 0 : Math.round(day.totalHours * 100) / 100;
    checked = {
      date: checkDate,
      totalHours,
      met: minHours === null ? null : (day?.totalHours ?? 0) >= minHours,
    };
  }
  return {
    minHours,
    updatedAt: goal?.updated_at ?? null,
    fromDate,
    toDate: today,
    days,
    latest,
    checked,
    alert: checked !== null && checked.met === false,
  };
}
