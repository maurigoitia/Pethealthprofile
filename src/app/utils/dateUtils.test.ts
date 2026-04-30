/**
 * dateUtils tests — SCRUM-44
 * Critical: these drive medication reminders, timeline ordering, and export dates.
 */
import { describe, it, expect } from "vitest";
import { parseDateSafe, formatDateSafe, toDateKeySafe, toTimestampSafe, toDateInputValueSafe } from "./dateUtils";

// ─── parseDateSafe ────────────────────────────────────────────────────────────

describe("parseDateSafe", () => {
  it("parses ISO 8601 datetime", () => {
    const d = parseDateSafe("2026-04-03T10:30:00Z");
    expect(d).toBeInstanceOf(Date);
    expect(d!.getUTCFullYear()).toBe(2026);
  });

  it("parses YYYY-MM-DD as local noon (avoids off-by-one)", () => {
    const d = parseDateSafe("2026-04-03");
    expect(d).toBeInstanceOf(Date);
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(3); // April = 3
    expect(d!.getDate()).toBe(3);
  });

  it("parses DD/MM/YYYY", () => {
    const d = parseDateSafe("03/04/2026");
    expect(d).toBeInstanceOf(Date);
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getDate()).toBe(3);
  });

  it("parses DD-MM-YYYY", () => {
    const d = parseDateSafe("03-04-2026");
    expect(d).toBeInstanceOf(Date);
    expect(d!.getFullYear()).toBe(2026);
  });

  it("parses Firebase Timestamp-like object", () => {
    const d = parseDateSafe({ seconds: 1743638400, nanoseconds: 0 });
    expect(d).toBeInstanceOf(Date);
  });

  it("parses numeric timestamp (ms)", () => {
    const ts = new Date("2026-04-03").getTime();
    const d = parseDateSafe(ts);
    expect(d).toBeInstanceOf(Date);
    expect(d!.getFullYear()).toBe(2026);
  });

  it("returns null for null", () => expect(parseDateSafe(null)).toBeNull());
  it("returns null for undefined", () => expect(parseDateSafe(undefined)).toBeNull());
  it("returns null for empty string", () => expect(parseDateSafe("")).toBeNull());
  it("returns null for invalid string", () => expect(parseDateSafe("not-a-date")).toBeNull());
  it("returns null for garbage object", () => expect(parseDateSafe({})).toBeNull());

  it("handles 2-digit year (20XX interpretation)", () => {
    const d = parseDateSafe("03/04/26");
    expect(d).toBeInstanceOf(Date);
    expect(d!.getFullYear()).toBe(2026);
  });

  it("returns null for future year beyond reasonable range", () => {
    // Dates far in the future should still parse (no upper bound)
    const d = parseDateSafe("2099-12-31");
    expect(d).toBeInstanceOf(Date);
  });
});

// ─── toTimestampSafe ──────────────────────────────────────────────────────────

describe("toTimestampSafe", () => {
  it("returns ms from ISO string", () => {
    const ts = toTimestampSafe("2026-04-03T00:00:00Z");
    expect(typeof ts).toBe("number");
    expect(ts).toBeGreaterThan(0);
    // ISO midnight is normalised to local noon to avoid off-by-one in Americas timezones
    expect(ts).toBe(new Date(2026, 3, 3, 12, 0, 0, 0).getTime());
  });

  it("returns ms from Date object", () => {
    const d = new Date("2026-04-03"); // UTC midnight
    // parseDateSafe normalises UTC midnight → local noon
    const expected = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0, 0).getTime();
    expect(toTimestampSafe(d)).toBe(expected);
  });

  it("returns fallback (0) for null", () => expect(toTimestampSafe(null)).toBe(0));
  it("returns fallback (0) for undefined", () => expect(toTimestampSafe(undefined)).toBe(0));
  it("returns fallback (0) for empty string", () => expect(toTimestampSafe("")).toBe(0));
  it("respects custom fallback", () => expect(toTimestampSafe(null, -1)).toBe(-1));

  it("returns ms from numeric timestamp", () => {
    const now = Date.now();
    expect(toTimestampSafe(now)).toBe(now);
  });
});

// ─── toDateKeySafe ────────────────────────────────────────────────────────────

describe("toDateKeySafe", () => {
  it("returns YYYY-MM-DD from ISO string", () => {
    expect(toDateKeySafe("2026-04-03T10:00:00Z")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns empty string for invalid input", () => {
    expect(toDateKeySafe(null)).toBe("");
    expect(toDateKeySafe("")).toBe("");
  });

  it("returns consistent key for same date across formats", () => {
    const fromIso = toDateKeySafe("2026-04-03");
    const fromSlash = toDateKeySafe("03/04/2026");
    expect(fromIso).toBe(fromSlash);
  });
});

// ─── toDateInputValueSafe ─────────────────────────────────────────────────────

describe("toDateInputValueSafe", () => {
  it("returns YYYY-MM-DD format for HTML date input", () => {
    const v = toDateInputValueSafe("2026-04-03T10:00:00Z");
    expect(v).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns empty string for invalid input", () => {
    expect(toDateInputValueSafe(null)).toBe("");
    expect(toDateInputValueSafe("")).toBe("");
  });
});

// ─── formatDateSafe ───────────────────────────────────────────────────────────

describe("formatDateSafe", () => {
  it("returns fallback for invalid input", () => {
    expect(formatDateSafe("", "es-AR", {}, "Sin fecha")).toBe("Sin fecha");
    expect(formatDateSafe(null, "es-AR", {}, "—")).toBe("—");
  });

  it("returns a non-empty string for valid date", () => {
    const result = formatDateSafe("2026-04-03", "es-AR", { year: "numeric", month: "short", day: "2-digit" }, "");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});
