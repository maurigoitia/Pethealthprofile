/**
 * masterPayloadSanitizer — limpieza semántica antes de guardar en Firestore.
 *
 * Reglas (alineadas con export y Timeline):
 *  1. Emails NUNCA como veterinarian_name, clinic_name, provider (si contiene @ → null)
 *  2. Strip `%Ï` y `> ` (quote markers de reply de email)
 *  3. Placeholders ("Sin interpretación confirmada", "Pendiente de revisión") → null
 *  4. Text trimmed, whitespace normalizado
 *
 * Se aplica en analysisService.safeParseExtractedData antes de devolver el payload
 * para que los eventos nuevos ya entren limpios a la DB.
 */

const EMAIL_RE = /@/;
const NOISE_PATTERNS = [
  /sin interpretaci[oó]n/i,
  /pendiente de revisi[oó]n/i,
  /sin referencia/i,
  /estudio detectado por correo/i,
  /receta detectada por correo/i,
  /diagn[oó]stico detectado por correo/i,
];

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value
    .replace(/[%Ï]/g, "")
    .replace(/^>+\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  for (const re of NOISE_PATTERNS) if (re.test(cleaned)) return null;
  return cleaned;
}

function cleanProfessional(value: unknown): string | null {
  const txt = cleanText(value);
  if (!txt) return null;
  if (EMAIL_RE.test(txt)) return null;  // ❌ emails como profesional
  return txt;
}

/**
 * Sanitiza in-place un masterPayload ya parseado.
 * Devuelve el mismo objeto (mutado) para facilitar chaining.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sanitizeMasterPayload<T extends Record<string, any>>(payload: T): T {
  if (!payload || typeof payload !== "object") return payload;

  // document_info — profesional y clínica sin emails
  if (payload.document_info && typeof payload.document_info === "object") {
    const di = payload.document_info;
    di.veterinarian_name = cleanProfessional(di.veterinarian_name);
    di.clinic_name = cleanProfessional(di.clinic_name);
    di.clinic_address = cleanText(di.clinic_address);
    di.veterinarian_license = cleanText(di.veterinarian_license);
    di.record_number = cleanText(di.record_number);
  }

  // diagnoses — limpiar nombres, drop placeholders
  if (Array.isArray(payload.diagnoses)) {
    payload.diagnoses = payload.diagnoses
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((d: any) => {
        if (!d || typeof d !== "object") return null;
        const cleaned = cleanText(d.name ?? d.diagnosis);
        if (!cleaned) return null;
        return { ...d, name: cleaned };
      })
      .filter(Boolean);
  }

  // treatments / medications — limpiar dose + prescriber
  if (Array.isArray(payload.treatments)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload.treatments = payload.treatments.map((t: any) => {
      if (!t || typeof t !== "object") return t;
      return {
        ...t,
        name: cleanText(t.name) ?? t.name,
        dose: cleanText(t.dose ?? t.dosage),
        frequency: cleanText(t.frequency),
        professional_name: cleanProfessional(t.professional_name ?? t.prescribedBy),
      };
    });
  }

  // recommendations — strip placeholders
  if (Array.isArray(payload.recommendations)) {
    payload.recommendations = payload.recommendations
      .map((r: unknown) => cleanText(r))
      .filter(Boolean);
  }

  // observations — strip placeholders
  if (typeof payload.observations === "string") {
    payload.observations = cleanText(payload.observations);
  }

  return payload;
}

/**
 * Sanitiza el shape "legacy" ExtractedData que todavía usan los consumers.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sanitizeLegacyExtracted<T extends Record<string, any>>(data: T): T {
  if (!data || typeof data !== "object") return data;

  // Campos top-level
  if (data.provider !== undefined) data.provider = cleanProfessional(data.provider);
  if (data.clinic !== undefined) data.clinic = cleanProfessional(data.clinic);
  if (data.diagnosis !== undefined) data.diagnosis = cleanText(data.diagnosis);
  if (data.observations !== undefined) data.observations = cleanText(data.observations);

  // masterPayload anidado
  if (data.masterPayload) {
    data.masterPayload = sanitizeMasterPayload(data.masterPayload);
  }

  return data;
}
