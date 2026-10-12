const madridCalendar = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Madrid",
  calendar: "gregory",
  numberingSystem: "latn",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** El día del proyecto es el de Madrid, independientemente de TZ en Node o Docker. */
export function getMadridToday(now = new Date()): string {
  const parts = madridCalendar.formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((value) => value.type === type)!.value;
  return `${part("year").padStart(4, "0")}-${part("month")}-${part("day")}`;
}
