// Validación en servidor del contrato HU1 (docs/hu1-api.md).
// El frontend también valida, pero el backend nunca se fía de lo que recibe.
import { getMadridToday } from "./sleepCalendar.ts";

export const ACTIVITY_TYPES = ["walking", "running", "cycling", "gym", "other"] as const;
export const NOTES_MAX_LENGTH = 500;

export type ValidationResult =
  | { ok: true; value: { activityType: string; activityDate: string; notes: string | null } }
  | { ok: false; message: string };

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  // Se trabaja en UTC para que la fecha no cambie de día por la zona horaria.
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

export function validateNewActivity(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, message: "El cuerpo de la petición debe ser un objeto JSON." };
  }
  const { activityType, activityDate, notes } = body as Record<string, unknown>;

  if (typeof activityType !== "string" || !(ACTIVITY_TYPES as readonly string[]).includes(activityType)) {
    return {
      ok: false,
      message: `El tipo de actividad no es válido. Valores permitidos: ${ACTIVITY_TYPES.join(", ")}.`,
    };
  }

  if (typeof activityDate !== "string" || !isRealDate(activityDate)) {
    return { ok: false, message: "La fecha de la actividad no es válida." };
  }

  let cleanNotes: string | null = null;
  if (notes !== undefined && notes !== null) {
    if (typeof notes !== "string") {
      return { ok: false, message: "Las notas deben ser texto." };
    }
    const trimmed = notes.trim();
    if (trimmed.length > NOTES_MAX_LENGTH) {
      return { ok: false, message: `Las notas no pueden superar ${NOTES_MAX_LENGTH} caracteres.` };
    }
    cleanNotes = trimmed === "" ? null : trimmed;
  }

  return { ok: true, value: { activityType, activityDate, notes: cleanNotes } };
}

export const SLEEP_TYPES = ["night", "nap", "other"] as const;
export type SleepType = (typeof SLEEP_TYPES)[number];

export type SleepValidationResult =
  | { ok: true; value: { sleepDate: string; hoursSlept: number; sleepType: SleepType | null } }
  | { ok: false; message: string };

export type SleepUpdateValidationResult =
  | { ok: true; value: { sleepDate: string; hoursSlept: number; sleepType: SleepType } }
  | { ok: false; message: string };

// HU2 usa componentes de calendario, sin conversiones UTC ni cambios en HU1.
function isRealSleepDate(value: string): boolean {
  if (value.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysPerMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysPerMonth[month - 1];
}

export function validateNewSleep(body: unknown, now = new Date()): SleepValidationResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, message: "El cuerpo de la petición debe ser un objeto JSON." };
  }
  const { sleepDate, hoursSlept, sleepType } = body as Record<string, unknown>;

  if (typeof sleepDate !== "string" || !isRealSleepDate(sleepDate)) {
    return { ok: false, message: "La fecha del sueño no es válida." };
  }

  if (sleepDate > getMadridToday(now)) {
    return { ok: false, message: "No puedes registrar horas de sueño para una fecha futura." };
  }

  if (
    typeof hoursSlept !== "number" ||
    !Number.isFinite(hoursSlept) ||
    hoursSlept <= 0 ||
    hoursSlept > 24
  ) {
    return { ok: false, message: "Las horas de sueño no son válidas." };
  }

  // Omitir el campo mantiene la compatibilidad con clientes anteriores; null explícito no es un tipo.
  if (
    sleepType !== undefined &&
    (typeof sleepType !== "string" || !(SLEEP_TYPES as readonly string[]).includes(sleepType))
  ) {
    return { ok: false, message: "El tipo de descanso no es válido. Selecciona sueño nocturno, siesta u otro." };
  }

  return { ok: true, value: { sleepDate, hoursSlept, sleepType: (sleepType as SleepType | undefined) ?? null } };
}

export function validateSleepUpdate(body: unknown, now = new Date()): SleepUpdateValidationResult {
  const result = validateNewSleep(body, now);
  if (!result.ok) return result;
  if (result.value.sleepType === null) {
    return { ok: false, message: "Selecciona un tipo de descanso para guardar los cambios." };
  }
  return { ok: true, value: { ...result.value, sleepType: result.value.sleepType } };
}

export function parseSleepId(value: string): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 && String(id) === value ? id : null;
}
