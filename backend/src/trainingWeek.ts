import { getMadridToday } from "./sleepCalendar.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

function asIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Semana natural de lunes a domingo, según la fecha de Europe/Madrid. */
export function getTrainingWeek(today = getMadridToday()) {
  const [year, month, day] = today.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const daysAfterMonday = (date.getUTCDay() + 6) % 7;
  const monday = new Date(date.getTime() - daysAfterMonday * DAY_MS);
  return {
    weekStart: asIsoDate(monday),
    weekEnd: asIsoDate(new Date(monday.getTime() + 6 * DAY_MS)),
  };
}
