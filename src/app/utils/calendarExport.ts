interface CalendarEventInput {
  title: string;
  date: string; // YYYY-MM-DD
  time?: string | null; // HH:mm
  durationMinutes?: number;
  location?: string | null;
  description?: string | null;
}

const pad = (value: number): string => String(value).padStart(2, "0");

const toIcsDateUtc = (date: Date): string => {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
};

const parseLocalDateTime = (date: string, time?: string | null): Date | null => {
  if (!date) return null;
  const normalizedTime = time && time.trim() ? time : "09:00";
  const parsed = new Date(`${date}T${normalizedTime}:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const escapeIcsText = (value: string): string => {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
};

export function buildGoogleCalendarUrl(input: CalendarEventInput): string | null {
  const start = parseLocalDateTime(input.date, input.time);
  if (!start) return null;
  const duration = Number.isFinite(input.durationMinutes) ? Number(input.durationMinutes) : 45;
  const end = new Date(start.getTime() + duration * 60000);

  const format = (date: Date) =>
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title || "Turno veterinario",
    dates: `${format(start)}/${format(end)}`,
    details: input.description || "",
    location: input.location || "",
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function downloadIcsEvent(input: CalendarEventInput, fileName = "turno-veterinario.ics"): boolean {
  const start = parseLocalDateTime(input.date, input.time);
  if (!start) return false;

  const duration = Number.isFinite(input.durationMinutes) ? Number(input.durationMinutes) : 45;
  const end = new Date(start.getTime() + duration * 60000);
  const now = new Date();
  const uid = `${now.getTime()}@pessy.app`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PESSY//Turnos//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toIcsDateUtc(now)}`,
    `DTSTART:${toIcsDateUtc(start)}`,
    `DTEND:${toIcsDateUtc(end)}`,
    `SUMMARY:${escapeIcsText(input.title || "Turno veterinario")}`,
    `DESCRIPTION:${escapeIcsText(input.description || "")}`,
    `LOCATION:${escapeIcsText(input.location || "")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}
