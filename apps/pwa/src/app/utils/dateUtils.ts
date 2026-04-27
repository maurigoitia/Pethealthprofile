const YMD_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const DMY_REGEX = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/;
const DMY_SHORT_YEAR_REGEX = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2})$/;
const ISO_DATE_PREFIX_REGEX = /^(\d{4})-(\d{2})-(\d{2})T/;
const ISO_MIDNIGHT_REGEX = /^(\d{4})-(\d{2})-(\d{2})T00:00(?::00(?:\.\d{1,3})?)?(?:Z|[+\-]\d{2}:?\d{2})?$/i;

type TimestampLike = {
  toDate?: () => Date;
  seconds?: number;
  nanoseconds?: number;
};

function buildLocalNoonDate(year: number, month1Based: number, day: number): Date | null {
  const parsed = new Date(year, month1Based - 1, day, 12, 0, 0, 0);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeShortYear(twoDigitYear: number): number {
  return twoDigitYear >= 70 ? 1900 + twoDigitYear : 2000 + twoDigitYear;
}

const toDateFromTimestampLike = (value: TimestampLike): Date | null => {
  if (typeof value.toDate === "function") {
    const converted = value.toDate();
    return Number.isNaN(converted.getTime()) ? null : converted;
  }

  if (typeof value.seconds === "number") {
    const millis = value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1_000_000);
    const converted = new Date(millis);
    return Number.isNaN(converted.getTime()) ? null : converted;
  }

  return null;
};

const normalizeDateObject = (date: Date): Date | null => {
  if (Number.isNaN(date.getTime())) return null;

  // Preserve calendar dates that were persisted as UTC midnight.
  if (
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  ) {
    return buildLocalNoonDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }

  return date;
};

export function parseDateSafe(value?: unknown): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return normalizeDateObject(value);
  }

  if (typeof value === "number") {
    return normalizeDateObject(new Date(value));
  }

  if (typeof value === "object") {
    const converted = toDateFromTimestampLike(value as TimestampLike);
    if (converted) return normalizeDateObject(converted);
  }

  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const ymd = trimmed.match(YMD_REGEX);
  if (ymd) {
    return buildLocalNoonDate(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));
  }

  const dmy = trimmed.match(DMY_REGEX);
  if (dmy) {
    return buildLocalNoonDate(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));
  }

  const dmyShort = trimmed.match(DMY_SHORT_YEAR_REGEX);
  if (dmyShort) {
    return buildLocalNoonDate(
      normalizeShortYear(Number(dmyShort[3])),
      Number(dmyShort[2]),
      Number(dmyShort[1])
    );
  }

  // Older records may contain "YYYY-MM-DDT00:00:00.000Z" for date-only values.
  // Preserve calendar day to avoid -1 day shifts in Americas timezones.
  if (ISO_MIDNIGHT_REGEX.test(trimmed)) {
    const isoDatePart = trimmed.slice(0, 10);
    const isoYmd = isoDatePart.match(YMD_REGEX);
    if (isoYmd) {
      return buildLocalNoonDate(Number(isoYmd[1]), Number(isoYmd[2]), Number(isoYmd[3]));
    }
  }

  const parsed = new Date(trimmed);
  return normalizeDateObject(parsed);
}

export function toDateInputValueSafe(value?: unknown): string {
  const parsed = parseDateSafe(value);
  if (!parsed) return "";
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDateSafe(
  value?: unknown,
  locale = "es-AR",
  options?: Intl.DateTimeFormatOptions,
  fallback = "Sin fecha"
): string {
  const parsed = parseDateSafe(value);
  if (!parsed) return fallback;
  return parsed.toLocaleDateString(
    locale,
    options || { day: "2-digit", month: "long", year: "numeric" }
  );
}

export function toDateKeySafe(value?: unknown): string {
  if (!value) return "";

  if (typeof value === "object") {
    const converted = toDateFromTimestampLike(value as TimestampLike);
    if (converted) {
      const y = converted.getUTCFullYear();
      const m = String(converted.getUTCMonth() + 1).padStart(2, "0");
      const d = String(converted.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  }

  if (value instanceof Date || typeof value === "number") {
    const parsed = parseDateSafe(value);
    if (!parsed) return "";
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  if (typeof value !== "string") return "";

  const trimmed = value.trim();
  if (!trimmed) return "";

  const ymd = trimmed.match(YMD_REGEX);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;

  const dmy = trimmed.match(DMY_REGEX);
  if (dmy) {
    const d = String(Number(dmy[1])).padStart(2, "0");
    const m = String(Number(dmy[2])).padStart(2, "0");
    return `${dmy[3]}-${m}-${d}`;
  }

  const dmyShort = trimmed.match(DMY_SHORT_YEAR_REGEX);
  if (dmyShort) {
    const y = normalizeShortYear(Number(dmyShort[3]));
    const d = String(Number(dmyShort[1])).padStart(2, "0");
    const m = String(Number(dmyShort[2])).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const isoPrefix = trimmed.match(ISO_DATE_PREFIX_REGEX);
  if (isoPrefix) return `${isoPrefix[1]}-${isoPrefix[2]}-${isoPrefix[3]}`;

  const parsed = parseDateSafe(trimmed);
  if (!parsed) return "";
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function toTimestampSafe(value?: unknown, fallback = 0): number {
  const parsed = parseDateSafe(value);
  return parsed ? parsed.getTime() : fallback;
}
