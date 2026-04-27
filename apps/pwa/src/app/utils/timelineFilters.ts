// timelineFilters.ts
// Render-layer sanitizers for the Timeline / Historial screen.
// Goal: never show raw email addresses, encoding garbage (%Ï), reply quotes (> ...),
// or placeholder strings like "Sin interpretación confirmada" / "Pendiente de revisión"
// as if they were real clinical content.
//
// These helpers DO NOT mutate Firestore — they just decide what to display.

import type { MedicalEvent } from "../types/medical";

/** Strip markdown, email-quote prefixes, encoding junk, collapse whitespace. */
export function cleanText(value?: unknown): string {
  const raw =
    typeof value === "string"
      ? value
      : typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : "";
  return raw
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/#{1,6}\s+/g, "")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/[%Ï]/g, "")        // email encoding garbage
    .replace(/^>+\s*/gm, "")     // email reply quote prefixes
    .replace(/\n{2,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when the string contains an @ (i.e. looks like an email address). */
export function isEmailLike(value?: string | null): boolean {
  return !!value && /@/.test(value);
}

/** True when the string is effectively a placeholder / review stub. */
export function isNoisePlaceholder(value?: string | null): boolean {
  const s = (value || "").toLowerCase().trim();
  if (!s) return true;
  return (
    s.includes("sin interpretacion") ||
    s.includes("sin interpretación") ||
    s.includes("sin referencia") ||
    s.includes("pendiente de revisión") ||
    s.includes("pendiente de revision") ||
    s.includes("pendiente revisión") ||
    s.includes("pendiente revision") ||
    s === "—" ||
    s === "-"
  );
}

/** Return a usable professional/clinic name, or null if we only have an email / noise. */
export function cleanProfessional(value?: string | null): string | null {
  const s = cleanText(value);
  if (!s || isEmailLike(s) || isNoisePlaceholder(s)) return null;
  return s;
}

/**
 * Resolve the best-known veterinarian / provider name for an event.
 * Priority:
 *   1. extractedData.masterPayload.document_info.veterinarian_name
 *   2. extractedData.provider
 *   3. extractedData.clinic
 * Any email-like value is rejected.
 */
export function getRealProvider(event: MedicalEvent): string | null {
  const d = (event?.extractedData ?? {}) as Record<string, unknown>;
  const mp = d.masterPayload as Record<string, unknown> | undefined;
  const docInfo = mp?.document_info as Record<string, unknown> | undefined;

  const fromPayload = cleanProfessional(docInfo?.veterinarian_name as string | undefined);
  if (fromPayload) return fromPayload;

  const fromProvider = cleanProfessional(d.provider as string | undefined);
  if (fromProvider) return fromProvider;

  const fromClinic = cleanProfessional(d.clinic as string | undefined);
  if (fromClinic) return fromClinic;

  return null;
}

/**
 * True when the event is a "placeholder" email-ingested record — i.e. the title
 * is one of the generic ingestion labels and there is no real diagnosis or
 * observation content. These events add noise to /historial without telling
 * the user anything, so we hide them by default.
 */
export function isEmailIngestedNoiseEvent(event: MedicalEvent): boolean {
  const title = cleanText((event as { title?: unknown })?.title).toLowerCase();
  const d = (event?.extractedData ?? {}) as Record<string, unknown>;

  const looksLikePlaceholderTitle =
    !title ||
    /^estudio detectado por correo$/.test(title) ||
    /^receta detectada por correo$/.test(title) ||
    /^diagn[oó]stico detectado por correo$/.test(title) ||
    /^documento m[eé]dico(?:\s*[-—].*)?$/.test(title) ||
    /^documento cl[ií]nico/.test(title);

  if (!looksLikePlaceholderTitle) return false;

  const diagnosis = cleanText(d.diagnosis as string | undefined);
  const observations = cleanText(d.observations as string | undefined);
  const hasRealDiagnosis = !!diagnosis && !isNoisePlaceholder(diagnosis);
  const hasRealObservations = !!observations && !isNoisePlaceholder(observations);
  const medications = Array.isArray(d.medications) ? (d.medications as unknown[]) : [];
  const measurements = Array.isArray(d.measurements) ? (d.measurements as unknown[]) : [];

  return !hasRealDiagnosis && !hasRealObservations && medications.length === 0 && measurements.length === 0;
}

/** Wrap a displayed "summary" — if it's a noise placeholder, return empty string so the UI can hide it. */
export function sanitizeSummary(value?: string | null): string {
  const cleaned = cleanText(value);
  if (!cleaned || isNoisePlaceholder(cleaned)) return "";
  // Strip common "auto summary pending review" prefix the pipeline emits.
  return cleaned
    .replace(/^resumen autom[aá]tico\s*\(pendiente\s+revisi[oó]n\)\s*:\s*/i, "")
    .replace(/^documento m[eé]dico\s*[-—]\s*resumen autom[aá]tico\s*\(pendiente\s+revisi[oó]n\)\s*:?\s*/i, "")
    .trim();
}
